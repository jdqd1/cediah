import { describe, expect, it } from "vitest";
import { getSafeNextPath, validateAuthInput } from "./validation";

describe("auth validation", () => {
  it("normalizes a valid email without changing the password", () => {
    const result = validateAuthInput("sign-in", {
      email: "  Student@Example.COM ",
      password: "existing password",
    });

    expect(result).toEqual({
      success: true,
      value: {
        email: "student@example.com",
        mode: "sign-in",
        password: "existing password",
      },
    });
  });

  it("does not apply the new-password policy to existing accounts", () => {
    expect(
      validateAuthInput("sign-in", {
        email: "student@example.com",
        password: "legacy-pass",
      }).success,
    ).toBe(true);
  });

  it("requires a strong, confirmed password for registration", () => {
    const weak = validateAuthInput("sign-up", {
      confirmPassword: "short",
      email: "student@example.com",
      password: "short",
    });
    const mismatch = validateAuthInput("sign-up", {
      confirmPassword: "Different2!Password",
      email: "student@example.com",
      password: "Secure2!Password",
    });

    expect(weak.success).toBe(false);
    expect(weak.success ? undefined : weak.errors.password).toBeDefined();
    expect(mismatch.success).toBe(false);
    expect(mismatch.success ? undefined : mismatch.errors.confirmPassword).toBe(
      "Las contraseñas no coinciden.",
    );
  });

  it("accepts a strong registration password", () => {
    expect(
      validateAuthInput("sign-up", {
        confirmPassword: "Secure2!Password",
        email: "student@example.com",
        password: "Secure2!Password",
      }).success,
    ).toBe(true);
  });
});

describe("safe auth redirects", () => {
  it("keeps same-origin paths and their query string", () => {
    expect(getSafeNextPath("/guias?tema=torax#inicio")).toBe(
      "/guias?tema=torax#inicio",
    );
  });

  it.each([
    "https://evil.example/path",
    "//evil.example/path",
    "/\\evil.example/path",
    "/%5cevil.example/path",
    "/%2f%2fevil.example/path",
    "/path%0d%0aSet-Cookie:test",
  ])("rejects an unsafe redirect target: %s", (target: string) => {
    expect(getSafeNextPath(target)).toBe("/dashboard");
  });
});
