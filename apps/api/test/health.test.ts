import { describe, expect, it } from "vitest";
import type { IdentityProvider } from "@cediah/contracts";
import { buildApp } from "../src/app.js";
import { readEnvironment } from "../src/config.js";

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

  it("validates a bearer token through the configured identity provider", async () => {
    const identityProvider: IdentityProvider = {
      getUser: async (request) =>
        request.authorization === "Bearer valid-access-token"
          ? { email: "estudiante@example.test", id: "04761a7d-4c02-48d7-b3a2-94b8baadf021" }
          : null,
      revokeSessions: async () => undefined,
    };
    const app = await buildApp(testEnvironment, { identityProvider });

    const allowed = await app.inject({
      headers: { authorization: "Bearer valid-access-token" },
      method: "GET",
      url: "/v1/auth/me",
    });
    const denied = await app.inject({ method: "GET", url: "/v1/auth/me" });

    expect(allowed.statusCode).toBe(200);
    expect(allowed.headers["cache-control"]).toBe("no-store");
    expect(allowed.json()).toEqual({
      roles: [],
      user: { email: "estudiante@example.test", id: "04761a7d-4c02-48d7-b3a2-94b8baadf021" },
    });
    expect(denied.statusCode).toBe(401);
    expect(denied.json()).toEqual({ error: "unauthorized" });

    await app.close();
  });

  it("fails closed when no identity provider is configured", async () => {
    const app = await buildApp(testEnvironment);
    const response = await app.inject({
      headers: { authorization: "Bearer valid-access-token" },
      method: "GET",
      url: "/v1/auth/me",
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ error: "identity_unavailable" });

    await app.close();
  });

  it("requires the database and Better Auth settings to be configured together", () => {
    expect(() => readEnvironment({ BETTER_AUTH_URL: "https://cediah.example" })).toThrow(
      "DATABASE_URL, BETTER_AUTH_SECRET and BETTER_AUTH_URL must be configured together",
    );
  });

  it("fails closed when private video testing is enabled without S3 configuration", () => {
    expect(() => readEnvironment({ VIDEO_TEST_UPLOAD_ENABLED: "true" })).toThrow(
      "S3-compatible video storage must be configured when VIDEO_TEST_PROVIDER is s3",
    );
  });

  it("normalizes the explicit video-test uploader allowlist", () => {
    const environment = readEnvironment({
      CLOUDFLARE_STREAM_ACCOUNT_ID: "a".repeat(32),
      CLOUDFLARE_STREAM_API_TOKEN: "test-token",
      CLOUDFLARE_STREAM_CUSTOMER_CODE: "test-customer",
      VIDEO_TEST_UPLOAD_ENABLED: "true",
      VIDEO_TEST_PROVIDER: "cloudflare",
      VIDEO_TEST_UPLOADER_IDS: "04761A7D-4C02-48D7-B3A2-94B8BAADF021",
    });

    expect(environment.testVideoUpload?.uploaderIds.has("04761a7d-4c02-48d7-b3a2-94b8baadf021")).toBe(
      true,
    );
  });
});
