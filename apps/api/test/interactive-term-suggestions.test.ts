import { describe, expect, it } from "vitest";
import { isGenericInteractiveTermHeading } from "../src/interactive-terms/admin-suggestions.js";

describe("interactive-term suggestions", () => {
  it("filters structural headings that would create noisy global terms", () => {
    expect(isGenericInteractiveTermHeading("referencias")).toBe(true);
    expect(isGenericInteractiveTermHeading("correlaciones clinicas")).toBe(true);
    expect(isGenericInteractiveTermHeading("relaciones posteriores")).toBe(true);
    expect(isGenericInteractiveTermHeading("cara anterior")).toBe(true);
  });

  it("keeps reusable medical entities and concepts", () => {
    expect(isGenericInteractiveTermHeading("nervio mediano")).toBe(false);
    expect(isGenericInteractiveTermHeading("lamina propia")).toBe(false);
    expect(isGenericInteractiveTermHeading("glandula tiroides")).toBe(false);
    expect(isGenericInteractiveTermHeading("cavidad peritoneal")).toBe(false);
  });
});
