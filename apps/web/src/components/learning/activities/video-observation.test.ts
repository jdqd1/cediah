import { describe, expect, it } from "vitest";
import {
  compactVideoObservedRanges,
  normalizeVideoDurationSeconds,
  takeVideoObservedBatch,
} from "./video-observation";

describe("video observation batching", () => {
  it("compacts frequent contiguous time updates into a valid range", () => {
    const ranges = Array.from({ length: 60 }, (_, index) => ({
      endSeconds: (index + 1) / 4,
      startSeconds: index / 4,
    }));
    expect(compactVideoObservedRanges(ranges)).toEqual([{ startSeconds: 0, endSeconds: 15 }]);
  });

  it("respects the API limits without dropping remaining coverage", () => {
    const { batch, remaining } = takeVideoObservedBatch([
      { startSeconds: 0, endSeconds: 80 },
    ]);
    expect(batch).toEqual([
      { startSeconds: 0, endSeconds: 30 },
      { startSeconds: 30, endSeconds: 45 },
    ]);
    expect(remaining).toEqual([
      { startSeconds: 45, endSeconds: 60 },
      { startSeconds: 60, endSeconds: 80 },
    ]);
  });

  it("rounds browser media duration up so the final playback position remains valid", () => {
    expect(normalizeVideoDurationSeconds(69.3)).toBe(70);
    expect(normalizeVideoDurationSeconds(Number.NaN)).toBeNull();
    expect(normalizeVideoDurationSeconds(0)).toBeNull();
    expect(normalizeVideoDurationSeconds(86_400.1)).toBeNull();
  });
});
