import { describe, expect, it } from "vitest";
import type { RichTextDocument } from "@cediah/contracts";
import {
  buildGuideCitationIndex,
  parseVancouverCitationNumbers,
} from "./guide-citations";

describe("Vancouver guide citations", () => {
  it("parses individual, grouped and ranged citations", () => {
    expect(parseVancouverCitationNumbers("[1]")).toEqual([1]);
    expect(parseVancouverCitationNumbers("[1,2]")).toEqual([1, 2]);
    expect(parseVancouverCitationNumbers("[1, 3-5]")).toEqual([1, 3, 4, 5]);
    expect(parseVancouverCitationNumbers("[2–4, 7]")).toEqual([2, 3, 4, 7]);
  });

  it("rejects text that is not a Vancouver numeric citation", () => {
    expect(parseVancouverCitationNumbers("[Autor, 2024]")).toBeNull();
    expect(parseVancouverCitationNumbers("[3-1]")).toBeNull();
    expect(parseVancouverCitationNumbers("[0]")).toBeNull();
    expect(parseVancouverCitationNumbers("1,2")).toBeNull();
  });

  it("indexes numbered references after a Referencias heading and preserves source links", () => {
    const document = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Dato clínico importante. [1,2]" }],
        },
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Referencias" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "[1] Pérez A. Manual de medicina. 2026." }],
        },
        {
          type: "paragraph",
          content: [{
            type: "text",
            text: "2. Organización de ejemplo. Guía clínica.",
            marks: [{ type: "link", attrs: { href: "https://example.org/guia" } }],
          }],
        },
      ],
    } as RichTextDocument;

    const index = buildGuideCitationIndex(document);
    expect([...index.bibliographyTopLevelIndexes]).toEqual([1, 2, 3]);
    expect(index.references.get(1)).toEqual({
      number: 1,
      text: "Pérez A. Manual de medicina. 2026.",
      url: undefined,
    });
    expect(index.references.get(2)).toEqual({
      number: 2,
      text: "Organización de ejemplo. Guía clínica.",
      url: "https://example.org/guia",
    });
  });

  it("indexes references in an ordered list by their Vancouver order", () => {
    const document = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Bibliografía" }],
        },
        {
          type: "orderedList",
          attrs: { start: 1 },
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Primera fuente." }] }],
            },
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Segunda fuente." }] }],
            },
          ],
        },
      ],
    } as RichTextDocument;

    const index = buildGuideCitationIndex(document);
    expect(index.references.get(1)?.text).toBe("Primera fuente.");
    expect(index.references.get(2)?.text).toBe("Segunda fuente.");
  });
});
