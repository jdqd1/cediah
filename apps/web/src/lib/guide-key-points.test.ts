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

const variantDocument = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "Punto clave: El transporte vesicular conserva la identidad de membrana." }],
    },
    {
      type: "bulletList",
      content: [{
        type: "listItem",
        content: [{
          type: "paragraph",
          content: [{ type: "text", text: "💡 PUNTO CLAVE — Las SNARE acercan las membranas durante la fusión." }],
        }],
      }],
    },
    {
      type: "table",
      content: [{
        type: "tableRow",
        content: [{
          type: "tableCell",
          content: [{
            type: "paragraph",
            content: [{ type: "text", text: "Punto clave 2. La secreción regulada depende de una señal intracelular." }],
          }],
        }],
      }],
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Puntos clave" }],
    },
    {
      type: "paragraph",
      content: [{ type: "text", text: "RELACIÓN CLÍNICA: este bloque no debe convertirse en punto clave." }],
    },
  ],
};

describe("guide key points", () => {
  it("extracts PUNTO CLAVE callouts from rich guide documents", () => {
    expect(extractGuideKeyPoints(document)).toEqual([
      "La bomba Na+/K+-ATPasa transporta tres Na+ hacia afuera y dos K+ hacia adentro.",
    ]);
  });

  it("recognizes key points by their semantic label across supported rich-text containers", () => {
    expect(extractGuideKeyPoints(variantDocument)).toEqual([
      "El transporte vesicular conserva la identidad de membrana.",
      "Las SNARE acercan las membranas durante la fusión.",
      "La secreción regulada depende de una señal intracelular.",
    ]);
  });

  it("does not treat headings or clinical correlations as study key points", () => {
    const extracted = extractGuideKeyPoints(variantDocument);
    expect(extracted).not.toContain("Puntos clave");
    expect(extracted.some((point) => point.includes("RELACIÓN CLÍNICA"))).toBe(false);
  });

  it("does not duplicate a key point because blockquote and paragraph nodes are nested", () => {
    const nested = {
      type: "doc",
      content: [{
        type: "blockquote",
        content: [{
          type: "paragraph",
          content: [{ type: "text", text: "Punto clave: La TGN distribuye carga hacia rutas post-Golgi." }],
        }],
      }],
    };
    expect(extractGuideKeyPoints(nested)).toEqual([
      "La TGN distribuye carga hacia rutas post-Golgi.",
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
    expect(isGuideKeyPointLinked(
      variantDocument,
      "Las SNARE acercan las membranas durante la fusión.",
    )).toBe(true);
  });

  it("allows manual study points that are not linked to guide text", () => {
    expect(isGuideKeyPointLinked(document, "Repasar este concepto antes del examen")).toBe(false);
  });
});
