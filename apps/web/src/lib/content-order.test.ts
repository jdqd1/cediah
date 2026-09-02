import { describe, expect, it } from "vitest";
import type { ContentItem } from "@cediah/contracts";
import { mostViewedFirst, newestContentFirst } from "./content-order";

const item = (id: string, publishedAt: string | null, viewCount?: number) => ({
  id, publishedAt, viewCount, createdAt: "2026-08-01T00:00:00Z",
}) as ContentItem;

describe("dashboard ordering", () => {
  it("sorts recent publications by publication date, not their edit date or input order", () => {
    const older = item("older", "2026-08-01T00:00:00Z");
    const newer = item("newer", "2026-09-01T00:00:00Z");
    const items = [older, newer];
    expect([...items].sort(newestContentFirst).map((entry) => entry.id)).toEqual(["newer", "older"]);
    expect(items[0]).toBe(older);
  });
  it("puts the most viewed first and uses recent date only to break ties", () => {
    const recent = item("recent", "2026-09-01T00:00:00Z", 2);
    const popular = item("popular", "2026-08-01T00:00:00Z", 50);
    const tied = item("tied", "2026-08-02T00:00:00Z", 2);
    const uncounted = item("uncounted", null);
    expect([recent, uncounted, tied, popular].sort(mostViewedFirst).map((entry) => entry.id)).toEqual(["popular", "recent", "tied", "uncounted"]);
  });
});
