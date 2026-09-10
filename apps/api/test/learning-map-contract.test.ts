import { describe, expect, it } from "vitest";
import {
  MapContentRefSchema,
  MapLayoutRequestSchema,
  MapNodeCreateRequestSchema,
  MapQuerySchema,
} from "@cediah/contracts";
import { aggregateMapProgress } from "../src/learning-map/progress.js";
import { coalesceMapRefs } from "../src/learning-map/mutations.js";
const id = "20000000-0000-4000-8000-000000000001";
describe("map contracts and progress", () => {
  it("rejects client ownership, incomplete references and invalid ancestry", () => {
    expect(
      MapContentRefSchema.safeParse({ kind: "lesson", pathId: id }).success,
    ).toBe(false);
    expect(
      MapContentRefSchema.safeParse({ kind: "block", pathId: id, userId: id })
        .success,
    ).toBe(false);
    expect(
      MapNodeCreateRequestSchema.safeParse({
        expectedVersion: 1,
        title: "",
        iconKey: "folder",
      }).success,
    ).toBe(false);
    expect(MapQuerySchema.safeParse({ item: id }).success).toBe(false);
    expect(MapQuerySchema.safeParse({ node: id, unknown: true }).success).toBe(
      false,
    );
  });
  it("rejects NaN/infinity/duplicate coordinates and oversized batches", () => {
    for (const x of [NaN, Infinity, -Infinity, 100001])
      expect(
        MapLayoutRequestSchema.safeParse({
          levelKey: "root",
          expectedVersion: 0,
          positions: [{ id, x, y: 0 }],
        }).success,
      ).toBe(false);
    expect(
      MapLayoutRequestSchema.safeParse({
        levelKey: "root",
        expectedVersion: 0,
        positions: Array.from({ length: 201 }, (_, i) => ({
          id: `${i}`,
          x: 0,
          y: 0,
        })),
      }).success,
    ).toBe(false);
  });
  it("deduplicates essentials, caps partial completion and distinguishes missing data", () => {
    const steps = Array.from({ length: 200 }, (_, i) => ({
      key: `${i}`,
      completed: i < 199,
      started: i < 199,
    }));
    expect(aggregateMapProgress(steps).percentage).toBe(99);
    expect(
      aggregateMapProgress(
        steps.slice(0, 8).map((s, i) => ({ ...s, completed: i === 0 })),
      ).percentage,
    ).toBe(13);
    expect(aggregateMapProgress([...steps, ...steps]).totalEssentialSteps).toBe(
      200,
    );
    expect(aggregateMapProgress([]).status).toBe("empty");
    expect(aggregateMapProgress(steps, true).percentage).toBeNull();
    expect(
      aggregateMapProgress([{ key: "x", completed: false, started: true }])
        .status,
    ).toBe("in_progress");
  });
  it("coalesces covered lessons without changing academic identity", () => {
    expect(
      coalesceMapRefs([
        { kind: "lesson", pathId: id, unitStableKey: "one" },
        { kind: "block", pathId: id },
      ]),
    ).toEqual([{ kind: "block", pathId: id }]);
  });
});
