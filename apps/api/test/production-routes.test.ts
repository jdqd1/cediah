import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { registerProductionAuxiliaryRoutes } from "../src/production-auxiliary-routes.js";

const testEnvironment = {
  HOST: "127.0.0.1",
  NODE_ENV: "test" as const,
  PORT: 4000,
  WEB_ORIGINS: "http://localhost:3000",
  webOrigins: new Set(["http://localhost:3000"]),
};

describe("production route composition", () => {
  it("registers all server routes without duplicate Fastify routes", async () => {
    const app = await buildApp(testEnvironment);

    expect(() => registerProductionAuxiliaryRoutes(app, undefined)).not.toThrow();
    await app.ready();

    const health = await app.inject({ method: "GET", url: "/health" });
    expect(health.statusCode).toBe(200);

    await app.close();
  });
});
