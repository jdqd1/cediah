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
  coordinator: { email: "coordinator@example.test", id: "df747a77-f05c-4bec-a2d9-29dd0de7ec33" },
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
    ["coordinator-token", users.coordinator],
    ["student-token", users.student],
  ]);
  return {
    getUser: async (request) =>
      byToken.get(request.authorization?.replace(/^Bearer\s+/, "") ?? "") ?? null,
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
        ? user(users.contributor.email, users.contributor.id, ["content_creator"])
        : null,
    mutateRole: async () => ({
      status: "success",
      value: user(users.contributor.email, users.contributor.id, ["content_creator", "coordinator"]),
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

  it.each([
    { label: "student", role: "student", token: "student-token" },
    { label: "coordinator", role: "coordinator", token: "coordinator-token" },
  ] satisfies { label: string; role: PlatformRole; token: string }[])(
    "rejects a $label before querying the target account",
    async ({ role, token }) => {
      let lookups = 0;
      const provider = roleProvider({
        getRoles: async () => [role],
        lookupUserByEmail: async () => { lookups += 1; return null; },
      });
      const app = await buildApp(environment, { identityProvider: identityProvider(), roleManagementProvider: provider });

      const response = await app.inject({
        headers: auth(token),
        method: "GET",
        url: "/v1/admin/roles?email=contributor@example.test",
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({ error: "forbidden" });
      expect(lookups).toBe(0);
      await app.close();
    },
  );

  it("lets an administrator assign a role by email", async () => {
    const mutations: Parameters<RoleManagementProvider["mutateRole"]>[0][] = [];
    const provider = roleProvider({
      mutateRole: async (input) => {
        mutations.push(input);
        return {
          status: "success",
          value: user(users.contributor.email, users.contributor.id, ["content_creator", "coordinator"]),
        };
      },
    });
    const app = await buildApp(environment, { identityProvider: identityProvider(), roleManagementProvider: provider });

    const response = await app.inject({
      headers: auth("administrator-token"),
      method: "POST",
      payload: { action: "assign", email: "CONTRIBUTOR@example.test", role: "coordinator" },
      url: "/v1/admin/roles",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().user.roles).toEqual(["content_creator", "coordinator"]);
    expect(mutations).toEqual([
      {
        action: "assign",
        actorUserId: users.administrator.id,
        email: "contributor@example.test",
        role: "coordinator",
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
