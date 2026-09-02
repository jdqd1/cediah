import { describe, expect, it } from "vitest";
import { formatVideoViews } from "./video-views";

describe("video playback count labels", () => {
  it("formats empty, singular, plural and large counts", () => {
    expect(formatVideoViews()).toBe("0 reproducciones");
    expect(formatVideoViews(1)).toBe("1 reproducción");
    expect(formatVideoViews(2)).toBe("2 reproducciones");
    expect(formatVideoViews(123456)).toBe("123.456 reproducciones");
  });
  it("never renders invalid or negative counts", () => {
    expect(formatVideoViews(-1)).toBe("0 reproducciones");
    expect(formatVideoViews(NaN)).toBe("0 reproducciones");
    expect(formatVideoViews(Infinity)).toBe("0 reproducciones");
  });
});
