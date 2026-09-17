import { describe, expect, it } from "vitest";
import {
  KeyPointsImportError,
  parseKeyPointsImportFile,
} from "./key-points-import";

describe("parseKeyPointsImportFile", () => {
  it("normalizes and returns valid key points", () => {
    const points = parseKeyPointsImportFile(JSON.stringify({
      version: 1,
      puntos_clave: [
        "  La retina deriva del neuroectodermo.  ",
        "El cristalino deriva del ectodermo superficial.",
      ],
    }));

    expect(points).toEqual([
      "La retina deriva del neuroectodermo.",
      "El cristalino deriva del ectodermo superficial.",
    ]);
  });

  it("removes duplicates inside the same file", () => {
    const points = parseKeyPointsImportFile(JSON.stringify({
      version: 1,
      puntos_clave: [
        "La retina deriva del neuroectodermo.",
        "La retina deriva del neuroectodermo",
      ],
    }));

    expect(points).toEqual(["La retina deriva del neuroectodermo."]);
  });

  it("rejects malformed JSON", () => {
    expect(() => parseKeyPointsImportFile("{"))
      .toThrow(KeyPointsImportError);
  });

  it("rejects points longer than 500 characters", () => {
    expect(() => parseKeyPointsImportFile(JSON.stringify({
      version: 1,
      puntos_clave: ["a".repeat(501)],
    }))).toThrow(/500 caracteres/);
  });
});
