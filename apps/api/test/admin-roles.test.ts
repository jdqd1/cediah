import { describe, expect, it } from "vitest";
import type {
  AdminRoleUser,
  IdentityProvider,
  PlatformRole,
  ProviderUser,
  RoleManagementProvider,
} from "@cediah/contracts";
import { buildApp } from "../src/app.js";
import type { ApiEnvironment } from "../src/config.js";

const users = {
  administrator: { email: "admin@example.test", id: "20402bbc-63e1-437f-ad0d-71d4c73a9d8f" },
  contributor: { email: "contributor@example.test", id: "466ac8eb-6473-4a9e-a4ee-1ef992671ffa" },
  student: { email: "student@example.test", id: "04761a7d-4c02-48d7-b3a2-94b8baadf021" },
} satisfies Record<string, ProviderUser>;

const environment: ApiEnvironment = {
  HOST: "127.0.0.1",
  NODE_ENV: "test",
  PORT: 4000,
  WEB_ORIGINS: "http://localhost:3000",
  webOrigins: new Set(["http://localhost:3000"]),
};

function identityProvider(): IdentityProvider {
  const byToken = new Map<string, ProviderUser>([
    ["administrator-token", users.administrator],
    ["student-token", users.student],
  ]);
  return {
    getUser: async (token) => byToken.get(token) ?? null,
    revokeSessions: async () => undefined,
  };
}

function user(email: string, id: string, roles: PlatformRole[]): AdminRoleUser {
  return { email, id, roles };
}

function roleProvider(overrides: Partial<RoleManagementProvider> = {}): RoleManagementProvider {
  return {
    getRoles: async (userId) => (userId === users.administrator.id ? ["administrator"] : ["student"]),
    lookupUserByEmail: async (email) =>
      email === users.contributor.email
        ? user(users.contributor.email, users.contributor.id, ["community_contributor"])
        : null,
    mutateRole: async () => ({
      status: "success",
      value: user(users.contributor.email, users.contributor.id, ["community_contributor", "academic_editor"]),
    }),
    ...overrides,
  };
}

const auth = (token: string) => ({ authorization: `Bearer ${token}` });

describe("administrator role API", () => {
  it("fails closed before looking up roles for anonymous requests", async () => {
    let lookups = 0;
    const provider = roleProvider({ getRoles: async () => { lookups += 1; return ["administrator"]; } });
    const app = await buildApp(environment, { identityProvider: identityProvider(), roleManagementProvider: provider });

    const response = await app.inject({ method: "GET", url: "/v1/admin/roles?email=contributor@example.test" });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "unauthorized" });
    expect(lookups).toBe(0);
    await app.close();
  });

  it("rejects a student before querying the target account", async () => {
    let lookups = 0;
    const provider = roleProvider({
      getRoles: async () => ["student"],
      lookupUserByEmail: async () => { lookups += 1; return null; },
    });
    const app = await buildApp(environment, { identityProvider: identityProvider(), roleManagementProvider: provider });

    const response = await app.inject({
      headers: auth("student-token"),
      method: "GET",
      url: "/v1/admin/roles?email=contributor@example.test",
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "forbidden" });
    expect(lookups).toBe(0);
    await app.close();
  });

  it("lets an administrator assign a role by email", async () => {
    const mutations: Parameters<RoleManagementProvider["mutateRole"]>[0][] = [];
    const provider = roleProvider({
      mutateRole: async (input) => {
        mutations.push(input);
        return {
          status: "success",
          value: user(users.contributor.email, users.contributor.id, ["community_contributor", "academic_editor"]),
        };
      },
    });
    const app = await buildApp(environment, { identityProvider: identityProvider(), roleManagementProvider: provider });

    const response = await app.inject({
      headers: auth("administrator-token"),
      method: "POST",
      payload: { action: "assign", email: "CONTRIBUTOR@example.test", role: "academic_editor" },
      url: "/v1/admin/roles",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().user.roles).toEqual(["community_contributor", "academic_editor"]);
    expect(mutations).toEqual([
      {
        action: "assign",
        actorUserId: users.administrator.id,
        email: "contributor@example.test",
        role: "academic_editor",
      },
    ]);
    await app.close();
  });

  it("protects the last administrator from revocation", async () => {
    const provider = roleProvider({ mutateRole: async () => ({ status: "last_administrator" }) });
    const app = await buildApp(environment, { identityProvider: identityProvider(), roleManagementProvider: provider });

    const response = await app.inject({
      headers: auth("administrator-token"),
      method: "POST",
      payload: { action: "revoke", email: "contributor@example.test", role: "administrator" },
      url: "/v1/admin/roles",
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: "last_administrator" });
    await app.close();
  });
});