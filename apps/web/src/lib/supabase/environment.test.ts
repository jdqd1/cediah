import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getSupabaseCookieOptions,
  isSafePublicSupabaseKey,
} from "./environment";

afterEach(() => vi.unstubAllEnvs());

function legacyJwtWithRole(role: string) {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ role })}.signature`;
}

describe("public Supabase key validation", () => {
  it("accepts modern publishable keys and legacy anon JWTs", () => {
    expect(isSafePublicSupabaseKey("sb_publishable_validPublicKey123456789")).toBe(true);
    expect(isSafePublicSupabaseKey(legacyJwtWithRole("anon"))).toBe(true);
  });

  it("rejects modern and legacy server-side secrets", () => {
    expect(isSafePublicSupabaseKey("sb_secret_neverExposeThis123456789")).toBe(false);
    expect(isSafePublicSupabaseKey(legacyJwtWithRole("service_role"))).toBe(false);
    expect(isSafePublicSupabaseKey(legacyJwtWithRole("supabase_admin"))).toBe(false);
  });

  it("rejects malformed or unrecognized values", () => {
    expect(isSafePublicSupabaseKey("not-a-supabase-key")).toBe(false);
    expect(isSafePublicSupabaseKey("sb_publishable_invalid.value")).toBe(false);
  });
});

describe("Supabase cookie security", () => {
  it("does not allow an insecure override on a public production origin", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://koraz.example");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_COOKIE_SECURE", "false");

    expect(getSupabaseCookieOptions().secure).toBe(true);
  });

  it("allows plain HTTP only for an explicitly configured local production test", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://127.0.0.1:3000");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_COOKIE_SECURE", "false");

    expect(getSupabaseCookieOptions().secure).toBe(false);
  });
});
