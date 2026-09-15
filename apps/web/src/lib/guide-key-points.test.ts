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
      content: [{ type: "text", text: "RELACIÓN CLÍNICA: este párrafo normal no es un callout visual." }],
    },
  ],
};

const unlabeledCallouts = {
  type: "doc",
  content: [
    {
      type: "blockquote",
      content: [{
        type: "paragraph",
        content: [{ type: "text", text: "CORRELACIÓN CLÍNICA: las SNARE son dianas de toxinas bacterianas." }],
      }],
    },
    {
      type: "blockquote",
      content: [{
        type: "paragraph",
        content: [{ type: "text", text: "Este recuadro no tiene etiqueta, pero sigue siendo información importante." }],
      }],
    },
  ],
};

describe("guide key points", () => {
  it("extracts every visual blockquote callout regardless of its label", () => {
    expect(extractGuideKeyPoints(document)).toEqual([
      "La bomba Na+/K+-ATPasa transporta tres Na+ hacia afuera y dos K+ hacia adentro.",
      "RELACIÓN CLÍNICA — La digoxina inhibe la Na+/K+-ATPasa.",
    ]);
  });

  it("includes clinical correlations and unlabeled visual callouts", () => {
    expect(extractGuideKeyPoints(unlabeledCallouts)).toEqual([
      "CORRELACIÓN CLÍNICA: las SNARE son dianas de toxinas bacterianas.",
      "Este recuadro no tiene etiqueta, pero sigue siendo información importante.",
    ]);
  });

  it("keeps compatibility with semantic Punto clave labels outside blockquotes", () => {
    expect(extractGuideKeyPoints(variantDocument)).toEqual([
      "El transporte vesicular conserva la identidad de membrana.",
      "Las SNARE acercan las membranas durante la fusión.",
      "La secreción regulada depende de una señal intracelular.",
    ]);
  });

  it("does not treat headings or ordinary clinical-correlation paragraphs as visual callouts", () => {
    const extracted = extractGuideKeyPoints(variantDocument);
    expect(extracted).not.toContain("Puntos clave");
    expect(extracted.some((point) => point.includes("párrafo normal"))).toBe(false);
  });

  it("does not duplicate a callout because blockquote and paragraph nodes are nested", () => {
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

  it("appends every imported callout without deleting manual publisher entries", () => {
    expect(appendDiscoveredGuideKeyPoints(
      ["Dato manual", ""],
      extractGuideKeyPoints(document),
    )).toEqual([
      "Dato manual",
      "",
      "La bomba Na+/K+-ATPasa transporta tres Na+ hacia afuera y dos K+ hacia adentro.",
      "RELACIÓN CLÍNICA — La digoxina inhibe la Na+/K+-ATPasa.",
    ]);
  });

  it("merges visual callouts with manual points without duplicates for the reader", () => {
    expect(mergeGuideKeyPoints(
      ["Dato manual", "La bomba Na+/K+-ATPasa transporta tres Na+ hacia afuera y dos K+ hacia adentro."],
      extractGuideKeyPoints(document),
    )).toEqual([
      "Dato manual",
      "La bomba Na+/K+-ATPasa transporta tres Na+ hacia afuera y dos K+ hacia adentro.",
      "RELACIÓN CLÍNICA — La digoxina inhibe la Na+/K+-ATPasa.",
    ]);
  });

  it("recognizes visual callouts and selected passages as linked", () => {
    expect(isGuideKeyPointLinked(
      document,
      "La bomba Na+/K+-ATPasa transporta tres Na+ hacia afuera y dos K+ hacia adentro.",
    )).toBe(true);
    expect(isGuideKeyPointLinked(
      document,
      "RELACIÓN CLÍNICA — La digoxina inhibe la Na+/K+-ATPasa.",
    )).toBe(true);
    expect(isGuideKeyPointLinked(document, "mantiene gradientes electroquímicos")).toBe(true);
    expect(isGuideKeyPointLinked(
      unlabeledCallouts,
      "Este recuadro no tiene etiqueta, pero sigue siendo información importante.",
    )).toBe(true);
  });

  it("allows manual study points that are not linked to guide text", () => {
    expect(isGuideKeyPointLinked(document, "Repasar este concepto antes del examen")).toBe(false);
  });
});
