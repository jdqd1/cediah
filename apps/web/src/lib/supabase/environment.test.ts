import { describe, expect, it } from "vitest";

describe("removed Supabase browser configuration", () => {
  it("does not expose a client-side configuration API", async () => {
    expect(Object.keys(await import("./environment"))).toEqual([]);
  });
});
