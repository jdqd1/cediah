import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

const testEnvironment = {
  HOST: "127.0.0.1",
  NODE_ENV: "test" as const,
  PORT: 4000,
  WEB_ORIGINS: "http://localhost:3000",
  webOrigins: new Set(["http://localhost:3000"]),
};

describe("GET /health", () => {
  it("returns a validated healthy response without caching", async () => {
    const app = await buildApp(testEnvironment);
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.json()).toMatchObject({
      service: "cediah-api",
      status: "ok",
      version: "0.1.0",
    });

    await app.close();
  });

  it("does not expose unknown routes", async () => {
    const app = await buildApp(testEnvironment);
    const response = await app.inject({ method: "GET", url: "/private" });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "not_found" });

    await app.close();
  });
});
