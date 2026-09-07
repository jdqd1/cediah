import { describe, expect, it } from "vitest";
import { isSameOriginRequest } from "./request-origin";

describe("same-origin view requests", () => {
  it("accepts the public Host when Next listens on another address", () => {
    expect(isSameOriginRequest(new Request("http://0.0.0.0:3000/api/content/id/views", {
      headers: { host: "localhost:3000", origin: "http://localhost:3000", "sec-fetch-site": "same-origin" },
    }))).toBe(true);
  });

  it("accepts HTTPS behind the deployment proxy", () => {
    expect(isSameOriginRequest(new Request("http://internal/api/content/id/views", {
      headers: { host: "koras.example", origin: "https://koras.example", "x-forwarded-proto": "https" },
    }))).toBe(true);
  });

  it("rejects foreign, sibling, null, or malformed origins", () => {
    for (const origin of ["https://other.example", "https://sub.koras.example", "null", "not-a-url"]) {
      expect(isSameOriginRequest(new Request("https://koras.example/api/content/id/views", {
        headers: { host: "koras.example", origin },
      }))).toBe(false);
    }
  });

  it("rejects cross-site fetch metadata even without an origin", () => {
    expect(isSameOriginRequest(new Request("https://koras.example/api/content/id/views", {
      headers: { "sec-fetch-site": "cross-site" },
    }))).toBe(false);
  });
});
