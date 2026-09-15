import { describe, expect, it } from "vitest";
import {
  appendDiscoveredGuideKeyPoints,
  extractGuideKeyPoints,
  isGuideKeyPointLinked,
  mergeGuideKeyPoints,
} from "./guide-key-points";

const document = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "La membrana mantiene gradientes electroquímicos." }],
    },
    {
      type: "blockquote",
      content: [{
        type: "paragraph",
        content: [
          { type: "text", text: "PUNTO CLAVE — " },
          { type: "text", text: "La bomba Na+/K+-ATPasa transporta tres Na+ hacia afuera y dos K+ hacia adentro." },
        ],
      }],
    },
    {
      type: "blockquote",
      content: [{
        type: "paragraph",
        content: [{ type: "text", text: "RELACIÓN CLÍNICA — La digoxina inhibe la Na+/K+-ATPasa." }],
      }],
    },
  ],
};

describe("guide key points", () => {
  it("extracts PUNTO CLAVE callouts from rich guide documents", () => {
    expect(extractGuideKeyPoints(document)).toEqual([
      "La bomba Na+/K+-ATPasa transporta tres Na+ hacia afuera y dos K+ hacia adentro.",
    ]);
  });

  it("appends imported callouts without deleting blank or manual publisher entries", () => {
    expect(appendDiscoveredGuideKeyPoints(
      ["Dato manual", ""],
      extractGuideKeyPoints(document),
    )).toEqual([
      "Dato manual",
      "",
      "La bomba Na+/K+-ATPasa transporta tres Na+ hacia afuera y dos K+ hacia adentro.",
    ]);
  });

  it("merges imported callouts with manual points without duplicates for the reader", () => {
    expect(mergeGuideKeyPoints(
      ["Dato manual", "La bomba Na+/K+-ATPasa transporta tres Na+ hacia afuera y dos K+ hacia adentro."],
      extractGuideKeyPoints(document),
    )).toEqual([
      "Dato manual",
      "La bomba Na+/K+-ATPasa transporta tres Na+ hacia afuera y dos K+ hacia adentro.",
    ]);
  });

  it("recognizes imported callouts and selected passages as linked", () => {
    expect(isGuideKeyPointLinked(
      document,
      "La bomba Na+/K+-ATPasa transporta tres Na+ hacia afuera y dos K+ hacia adentro.",
    )).toBe(true);
    expect(isGuideKeyPointLinked(document, "mantiene gradientes electroquímicos")).toBe(true);
  });

  it("allows manual study points that are not linked to guide text", () => {
    expect(isGuideKeyPointLinked(document, "Repasar este concepto antes del examen")).toBe(false);
  });
});
