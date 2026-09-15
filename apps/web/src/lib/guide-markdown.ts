import type { RichTextDocument } from "@cediah/contracts";
import type { JSONContent } from "@tiptap/react";

type MarkdownMark = { type: string; attrs?: Record<string, unknown> };

const markdownHighlightPattern = /==([^=\n]+?)==/g;

export function markdownInlineContent(value: string): JSONContent[] {
  const content: JSONContent[] = [];
  const pattern = /(\*\*|__)(.+?)\1|~~(.+?)~~|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(?<!\w)(\*|_)([^*_]+)\7|==([^=\n]+?)==/g;
  let cursor = 0;

  const pushText = (text: string, marks?: MarkdownMark[]) => {
    if (!text) return;
    content.push({ type: "text", text, ...(marks?.length ? { marks } : {}) });
  };

  for (const match of value.matchAll(pattern)) {
    const start = match.index ?? cursor;
    pushText(value.slice(cursor, start));
    if (match[2]) pushText(match[2], [{ type: "bold" }]);
    else if (match[3]) pushText(match[3], [{ type: "strike" }]);
    else if (match[4]) pushText(match[4], [{ type: "code" }]);
    else if (match[5] && match[6]) {
      pushText(match[5], [{
        type: "link",
        attrs: { href: match[6], target: "_blank", rel: "noopener noreferrer" },
      }]);
    } else if (match[8]) pushText(match[8], [{ type: "italic" }]);
    else if (match[9]) pushText(match[9], [{ type: "highlight" }]);
    else pushText(match[0]);
    cursor = start + match[0].length;
  }

  pushText(value.slice(cursor));
  return content;
}

export function markdownHighlightInputMatch(textBeforeCursor: string, insertedText: string) {
  if (insertedText !== "=") return null;
  const match = (textBeforeCursor + insertedText).match(/==([^=\n]+)==$/);
  if (!match || match[1] === undefined) return null;
  return {
    text: match[1],
    replacementLengthBeforeInput: match[0].length - insertedText.length,
  };
}

function normalizeNode(node: JSONContent, insideCodeBlock = false): JSONContent[] {
  if (node.type === "text") {
    if (
      insideCodeBlock ||
      typeof node.text !== "string" ||
      !node.text.includes("==") ||
      node.marks?.some((mark) => mark.type === "code")
    ) return [node];

    const normalized: JSONContent[] = [];
    let cursor = 0;
    let matched = false;
    const baseMarks = node.marks ?? [];

    const push = (text: string, marks = baseMarks) => {
      if (!text) return;
      normalized.push({ type: "text", text, ...(marks.length ? { marks } : {}) });
    };

    for (const match of node.text.matchAll(markdownHighlightPattern)) {
      const start = match.index ?? cursor;
      push(node.text.slice(cursor, start));
      const highlightedText = match[1];
      if (highlightedText) {
        matched = true;
        const marks = [
          ...baseMarks.filter((mark) => mark.type !== "highlight"),
          { type: "highlight" },
        ];
        push(highlightedText, marks);
      }
      cursor = start + match[0].length;
    }

    if (!matched) return [node];
    push(node.text.slice(cursor));
    return normalized;
  }

  if (!node.content) return [node];
  const childInsideCodeBlock = insideCodeBlock || node.type === "codeBlock";
  return [{
    ...node,
    content: node.content.flatMap((child) => normalizeNode(child, childInsideCodeBlock)),
  }];
}

export function normalizeMarkdownHighlights(document: RichTextDocument): RichTextDocument {
  const normalized = normalizeNode(document as JSONContent)[0];
  return (normalized ?? document) as RichTextDocument;
}
