import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getPublicTurnstileSiteKey,
  getPublicVideoStorageOrigin,
} from "./environment";

afterEach(() => vi.unstubAllEnvs());

describe("public auth environment", () => {
  it("accepts a valid Turnstile site key", () => {
    vi.stubEnv(
      "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
      "0x4AAAAAAA0123456789_example",
    );

    expect(getPublicTurnstileSiteKey()).toBe(
      "0x4AAAAAAA0123456789_example",
    );
  });

  it("rejects malformed Turnstile site keys", () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "replace me");
    expect(getPublicTurnstileSiteKey()).toBeNull();
  });
});

describe("public video storage origin", () => {
  it("returns only the origin of an HTTPS storage URL", () => {
    vi.stubEnv(
      "NEXT_PUBLIC_VIDEO_STORAGE_ORIGIN",
      "https://example.supabase.co/storage/v1/object",
    );

    expect(getPublicVideoStorageOrigin()).toBe("https://example.supabase.co");
  });

  it.each([
    "http://storage.example.com",
    "https://user:password@storage.example.com",
    "javascript:alert(1)",
  ])("rejects an unsafe storage URL: %s", (value) => {
    vi.stubEnv("NEXT_PUBLIC_VIDEO_STORAGE_ORIGIN", value);
    expect(getPublicVideoStorageOrigin()).toBeNull();
  });
});
