import { describe, expect, it } from "vitest";
import type { RichTextDocument } from "@cediah/contracts";
import {
  markdownHighlightInputMatch,
  markdownInlineContent,
  normalizeMarkdownHighlights,
} from "./guide-markdown";

describe("guide Markdown highlights", () => {
  it("converts ==text== into the native highlight mark while parsing pasted Markdown", () => {
    expect(markdownInlineContent("La ==información clave== debe destacar.")).toEqual([
      { type: "text", text: "La " },
      { type: "text", text: "información clave", marks: [{ type: "highlight" }] },
      { type: "text", text: " debe destacar." },
    ]);
  });

  it("recognizes the second closing equals sign while typing", () => {
    expect(markdownHighlightInputMatch("La ==información clave=", "=")).toEqual({
      text: "información clave",
      replacementLengthBeforeInput: "==información clave==".length - 1,
    });
  });

  it("normalizes raw highlight markers already stored in rich-text documents", () => {
    const document = {
      type: "doc",
      content: [{
        type: "paragraph",
        content: [{ type: "text", text: "Antes ==dato esencial== después" }],
      }],
    } as RichTextDocument;

    expect(normalizeMarkdownHighlights(document)).toEqual({
      type: "doc",
      content: [{
        type: "paragraph",
        content: [
          { type: "text", text: "Antes " },
          { type: "text", text: "dato esencial", marks: [{ type: "highlight" }] },
          { type: "text", text: " después" },
        ],
      }],
    });
  });

  it("does not interpret highlight markers inside code", () => {
    const document = {
      type: "doc",
      content: [{
        type: "codeBlock",
        content: [{ type: "text", text: "==literal==" }],
      }],
    } as RichTextDocument;

    expect(normalizeMarkdownHighlights(document)).toEqual(document);
  });
});
