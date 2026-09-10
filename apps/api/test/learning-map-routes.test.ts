import { describe, expect, it, vi } from "vitest";
import type { IdentityProvider, LearningMapProvider } from "@cediah/contracts";
import { buildApp } from "../src/app.js";
import type { ApiEnvironment } from "../src/config.js";
const userId = "b1000000-0000-4000-8000-000000000001";
const env: ApiEnvironment = {
  HOST: "127.0.0.1",
  PORT: 4000,
  NODE_ENV: "test",
  VIDEO_TEST_PROVIDER: "s3",
  WEB_ORIGINS: "http://localhost:3000",
  webOrigins: new Set(["http://localhost:3000"]),
};
const identity: IdentityProvider = {
  getUser: async (r) =>
    r.authorization === "Bearer valid"
      ? { id: userId, email: "map@example.test" }
      : null,
  revokeSessions: async () => {},
};
function provider(): LearningMapProvider {
  return {
    summary: vi.fn(async () => ({
      map: null,
      nodes: [],
      structuralVersion: 0,
      progress: {
        status: "empty" as const,
        percentage: null,
        completedEssentialSteps: 0,
        totalEssentialSteps: 0,
        started: false,
      },
    })),
    level: vi.fn(async () => null),
    catalog: vi.fn(async () => ({ items: [], nextCursor: null })),
    suggestions: vi.fn(async () => ({ items: [], incompleteBlocks: [] })),
    mutate: vi.fn(async () => ({ status: "not_found" as const })),
  };
}
describe("map feature and API boundary", { timeout: 20_000 }, () => {
  for (const guided of [false, true])
    for (const map of [false, true])
      it(`requires both flags (${guided}/${map})`, async () => {
        const p = provider();
        const app = await buildApp(
          {
            ...env,
            guidedLearningEnabled: guided,
            guidedLearningMapEnabled: map,
          },
          { identityProvider: identity, learningMapProvider: p },
        );
        const response = await app.inject({
          url: "/v1/guided-learning/map",
          headers: { authorization: "Bearer valid" },
        });
        expect(response.statusCode).toBe(guided && map ? 200 : 404);
        if (guided && map)
          expect(response.headers["cache-control"]).toContain("private");
        else expect(p.summary).not.toHaveBeenCalled();
        await app.close();
      });
  it("validates session, query, body and operation-specific receipt key", async () => {
    const p = provider(),
      app = await buildApp(
        { ...env, guidedLearningEnabled: true, guidedLearningMapEnabled: true },
        { identityProvider: identity, learningMapProvider: p },
      );
    expect(
      (await app.inject({ url: "/v1/guided-learning/map" })).statusCode,
    ).toBe(401);
    const headers = {
      authorization: "Bearer valid",
      "idempotency-key": userId,
    };
    for (const suffix of [
      "?userId=other",
      "/level?item=bad",
      "/catalog?q=" + "x".repeat(121),
      "/suggestions?unit=alone",
    ])
      expect(
        (await app.inject({ url: `/v1/guided-learning/map${suffix}`, headers }))
          .statusCode,
      ).toBe(400);
    expect(
      (
        await app.inject({
          url: "/v1/guided-learning/map/ensure",
          method: "POST",
          headers,
          payload: { userId },
        })
      ).statusCode,
    ).toBe(400);
    const response = await app.inject({
      url: "/v1/guided-learning/map/ensure",
      method: "POST",
      headers,
      payload: {},
    });
    expect(response.statusCode).toBe(404);
    expect(response.headers["cache-control"]).toContain("private");
    expect(p.mutate).toHaveBeenCalledWith({
      operation: "ensure",
      request: {},
      userId,
      idempotencyKey: userId,
      nodeId: undefined,
    });
    await app.close();
  });
});
