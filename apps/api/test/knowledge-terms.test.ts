import { describe, expect, it } from "vitest";
import { compileKnowledgeTermAnnotations } from "../src/knowledge-terms.js";

const term = (
  termId: string,
  alias: string,
  overrides: Partial<{
    caseSensitive: boolean;
    frequency: "first_document" | "first_section" | "all";
    priority: number;
  }> = {},
) => ({
  alias,
  caseSensitive: false,
  frequency: "all" as const,
  priority: 0,
  termId,
  ...overrides,
});

function doc(content: unknown[]) {
  return { content, type: "doc" } as never;
}

function paragraph(text: string, marks?: unknown[]) {
  return {
    content: [{ ...(marks ? { marks } : {}), text, type: "text" }],
    type: "paragraph",
  };
}

describe("compileKnowledgeTermAnnotations", () => {
  it("prefers the longest term when aliases overlap", () => {
    const result = compileKnowledgeTermAnnotations(
      doc([paragraph("La arteria mesentérica superior irriga el intestino.")]),
      [
        term("00000000-0000-0000-0000-000000000001", "arteria"),
        term("00000000-0000-0000-0000-000000000002", "arteria mesentérica"),
        term("00000000-0000-0000-0000-000000000003", "arteria mesentérica superior"),
      ],
    );

    expect(result).toEqual([
      {
        end: 31,
        path: "root.0.0",
        start: 3,
        termId: "00000000-0000-0000-0000-000000000003",
      },
    ]);
  });

  it("links the first occurrence in each section by default", () => {
    const result = compileKnowledgeTermAnnotations(
      doc([
        { attrs: { level: 1 }, content: [{ text: "Primera", type: "text" }], type: "heading" },
        paragraph("Somita y somita."),
        { attrs: { level: 2 }, content: [{ text: "Segunda", type: "text" }], type: "heading" },
        paragraph("Somita y somita."),
      ]),
      [term("00000000-0000-0000-0000-000000000001", "somita", { frequency: "first_section" })],
    );

    expect(result.map(({ path, start }) => ({ path, start }))).toEqual([
      { path: "root.1.0", start: 0 },
      { path: "root.3.0", start: 0 },
    ]);
  });

  it("does not annotate inside existing links", () => {
    const result = compileKnowledgeTermAnnotations(
      doc([
        paragraph("Blastocisto", [{ attrs: { href: "https://example.com" }, type: "link" }]),
      ]),
      [term("00000000-0000-0000-0000-000000000001", "blastocisto")],
    );

    expect(result).toEqual([]);
  });

  it("respects case-sensitive aliases", () => {
    const result = compileKnowledgeTermAnnotations(
      doc([paragraph("ams y AMS")]),
      [term("00000000-0000-0000-0000-000000000001", "AMS", { caseSensitive: true })],
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.start).toBe(6);
  });
});
