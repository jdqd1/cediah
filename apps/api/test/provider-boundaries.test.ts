import { readFile, readdir } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getAuthTables } from "better-auth/db";
import type { BetterAuthOptions } from "better-auth";
import { describe, expect, it } from "vitest";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));

async function sourceFiles(
  directory: string,
  extensions = new Set([".ts", ".tsx"]),
): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(directory, entry.name);
      return entry.isDirectory() ? sourceFiles(path, extensions) : [path];
    }),
  );
  return files.flat().filter((path) => extensions.has(extname(path)));
}

async function combinedSource(directory: string, extensions?: Set<string>) {
  const files = await sourceFiles(resolve(repositoryRoot, directory), extensions);
  return (await Promise.all(files.map((path) => readFile(path, "utf8")))).join("\n");
}

describe("provider boundaries", () => {
  it("does not ship a Supabase SDK or Supabase Auth/Database runtime configuration", async () => {
    const [apiPackage, webPackage, apiSource, webSource] = await Promise.all([
      readFile(resolve(repositoryRoot, "apps/api/package.json"), "utf8"),
      readFile(resolve(repositoryRoot, "apps/web/package.json"), "utf8"),
      combinedSource("apps/api/src"),
      combinedSource("apps/web/src"),
    ]);
    const runtime = [apiPackage, webPackage, apiSource, webSource].join("\n");

    expect(runtime).not.toMatch(/@supabase\//i);
    expect(runtime).not.toMatch(/\bSUPABASE_(?:URL|SECRET_KEY|SERVICE_ROLE_KEY|ANON_KEY)\b/);
    expect(runtime).not.toMatch(/\bsupabase\.auth\b/i);
    expect(runtime).not.toMatch(/\bcreateSupabaseClient\b/i);
  });

  it("keeps portable migrations independent from Supabase schemas and roles", async () => {
    const migrations = await combinedSource(
      "database/migrations",
      new Set([".sql"]),
    );

    expect(migrations).not.toMatch(/\bauth\.users\b/i);
    expect(migrations).not.toMatch(/\bstorage\.(?:buckets|objects)\b/i);
    expect(migrations).not.toMatch(/\bservice_role\b/i);
    expect(migrations).toMatch(/references public\.auth_users/i);
  });

  it("contains every table and field required by the configured Better Auth schema", async () => {
    const migration = await readFile(
      resolve(repositoryRoot, "database/migrations/0001_auth.sql"),
      "utf8",
    );
    const options = {
      account: {
        fields: {
          accessToken: "access_token",
          accessTokenExpiresAt: "access_token_expires_at",
          accountId: "account_id",
          createdAt: "created_at",
          idToken: "id_token",
          providerId: "provider_id",
          refreshToken: "refresh_token",
          refreshTokenExpiresAt: "refresh_token_expires_at",
          updatedAt: "updated_at",
          userId: "user_id",
        },
        modelName: "auth_accounts",
      },
      advanced: { database: { generateId: "uuid" as const } },
      rateLimit: {
        fields: { lastRequest: "last_request" },
        modelName: "auth_rate_limits",
        storage: "database" as const,
      },
      session: {
        fields: {
          createdAt: "created_at",
          expiresAt: "expires_at",
          ipAddress: "ip_address",
          updatedAt: "updated_at",
          userAgent: "user_agent",
          userId: "user_id",
        },
        modelName: "auth_sessions",
      },
      user: {
        fields: {
          createdAt: "created_at",
          emailVerified: "email_verified",
          updatedAt: "updated_at",
        },
        modelName: "auth_users",
      },
      verification: {
        fields: {
          createdAt: "created_at",
          expiresAt: "expires_at",
          updatedAt: "updated_at",
        },
        modelName: "auth_verifications",
      },
    } satisfies BetterAuthOptions;

    for (const table of Object.values(getAuthTables(options))) {
      expect(migration).toMatch(
        new RegExp(`create table public\\.${table.modelName}\\s*\\(`, "i"),
      );
      for (const field of Object.values(table.fields)) {
        expect(migration).toMatch(new RegExp(`\\b${field.fieldName}\\b`, "i"));
      }
    }
  });

  it("does not restore browser bearer-token plumbing", async () => {
    const webSource = await combinedSource("apps/web/src");

    expect(webSource).not.toMatch(/\bgetApiAccessToken\b/);
    expect(webSource).not.toMatch(/\baccessToken\b/);
    expect(webSource).not.toMatch(/authorization\s*:\s*[`'"]Bearer\b/i);
  });
});
