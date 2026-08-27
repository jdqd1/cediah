import { describe, expect, it, vi } from "vitest";
import type { AuthService } from "../src/auth.js";
import { buildApp } from "../src/app.js";

const testEnvironment = {
  HOST: "127.0.0.1",
  NODE_ENV: "test" as const,
  PORT: 4000,
  WEB_ORIGINS: "http://localhost:3000",
  webOrigins: new Set(["http://localhost:3000"]),
};

describe("Better Auth HTTP bridge", () => {
  it("forwards the request body and preserves independent Set-Cookie headers", async () => {
    const handledRequests: Request[] = [];
    const responseHeaders = new Headers({ "content-type": "application/json" });
    responseHeaders.append(
      "set-cookie",
      "cediah.session_token=session; Path=/; HttpOnly; SameSite=Lax",
    );
    responseHeaders.append(
      "set-cookie",
      "cediah.session_data=data; Path=/; HttpOnly; SameSite=Lax",
    );
    const authService: AuthService = {
      close: vi.fn(async () => undefined),
      getUser: vi.fn(async () => null),
      handle: vi.fn(async (request) => {
        handledRequests.push(request);
        return new Response(JSON.stringify({ ok: true }), {
          headers: responseHeaders,
          status: 201,
        });
      }),
      revokeSessions: vi.fn(async () => undefined),
    };
    const app = await buildApp(testEnvironment, { authService });

    const response = await app.inject({
      headers: {
        cookie: "cediah.session_token=previous",
        "content-type": "application/json",
        origin: "http://localhost:3000",
      },
      method: "POST",
      payload: { email: "student@example.test", password: "secure-password" },
      url: "/api/auth/sign-in/email",
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ ok: true });
    expect(response.headers["set-cookie"]).toEqual([
      "cediah.session_token=session; Path=/; HttpOnly; SameSite=Lax",
      "cediah.session_data=data; Path=/; HttpOnly; SameSite=Lax",
    ]);
    expect(handledRequests).toHaveLength(1);
    expect(handledRequests[0]?.headers.get("cookie")).toBe(
      "cediah.session_token=previous",
    );
    await expect(handledRequests[0]?.json()).resolves.toEqual({
      email: "student@example.test",
      password: "secure-password",
    });

    await app.close();
  });
});
