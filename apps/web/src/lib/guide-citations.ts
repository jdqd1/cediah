import type { RichTextDocument } from "@cediah/contracts";

type JsonObject = Record<string, unknown>;

export type GuideReference = {
  number: number;
  text: string;
  url?: string;
};

export type GuideCitationIndex = {
  bibliographyTopLevelIndexes: Set<number>;
  references: Map<number, GuideReference>;
};

const REFERENCE_HEADING_PATTERN = /^(referencias|bibliograf(?:ia|ía))$/i;
const EXPLICIT_REFERENCE_NUMBER = /^\s*(?:\[(\d+)\]|(\d+)[.)])\s*/;
const URL_PATTERN = /https:\/\/[^\s)\]}>,;]+/i;

function asObject(value: unknown): JsonObject | null {
  return typeof value === "object" && value !== null ? (value as JsonObject) : null;
}

function childrenOf(node: JsonObject): readonly unknown[] {
  return Array.isArray(node.content) ? node.content : [];
}

function attrsOf(node: JsonObject): JsonObject | null {
  return asObject(node.attrs);
}

function textContent(node: unknown, depth = 0): string {
  if (depth > 100) return "";
  const object = asObject(node);
  if (!object) return "";
  if (object.type === "text") return typeof object.text === "string" ? object.text : "";
  if (object.type === "hardBreak") return " ";
  return childrenOf(object)
    .map((child) => textContent(child, depth + 1))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function firstHttpsLink(node: unknown, depth = 0): string | undefined {
  if (depth > 100) return undefined;
  const object = asObject(node);
  if (!object) return undefined;

  if (object.type === "text") {
    const marks = Array.isArray(object.marks) ? object.marks : [];
    for (const rawMark of marks) {
      const mark = asObject(rawMark);
      if (!mark || mark.type !== "link") continue;
      const href = asObject(mark.attrs)?.href;
      if (typeof href === "string" && href.startsWith("https://")) return href;
    }
    const text = typeof object.text === "string" ? object.text : "";
    return text.match(URL_PATTERN)?.[0];
  }

  for (const child of childrenOf(object)) {
    const url = firstHttpsLink(child, depth + 1);
    if (url) return url;
  }
  return undefined;
}

function headingLevel(node: JsonObject): number | null {
  if (node.type !== "heading") return null;
  const level = attrsOf(node)?.level;
  return typeof level === "number" && Number.isInteger(level) ? level : 2;
}

function isReferenceHeading(node: JsonObject): boolean {
  return node.type === "heading" && REFERENCE_HEADING_PATTERN.test(textContent(node).trim());
}

function flattenReferenceCandidates(node: unknown): unknown[] {
  const object = asObject(node);
  if (!object) return [];
  if (object.type === "orderedList" || object.type === "bulletList") {
    return childrenOf(object).flatMap((child) => flattenReferenceCandidates(child));
  }
  if (object.type === "listItem") return [object];
  if (object.type === "paragraph") return [object];
  return [object];
}

export function buildGuideCitationIndex(document: RichTextDocument): GuideCitationIndex {
  const references = new Map<number, GuideReference>();
  const bibliographyTopLevelIndexes = new Set<number>();
  const root = asObject(document);
  const content = root ? childrenOf(root) : [];

  let referenceHeadingIndex = -1;
  let referenceHeadingLevel = 2;
  for (let index = 0; index < content.length; index += 1) {
    const node = asObject(content[index]);
    if (!node || !isReferenceHeading(node)) continue;
    referenceHeadingIndex = index;
    referenceHeadingLevel = headingLevel(node) ?? 2;
    bibliographyTopLevelIndexes.add(index);
    break;
  }

  if (referenceHeadingIndex < 0) return { bibliographyTopLevelIndexes, references };

  let implicitNumber = 1;
  for (let index = referenceHeadingIndex + 1; index < content.length; index += 1) {
    const node = asObject(content[index]);
    if (!node) continue;
    const level = headingLevel(node);
    if (level !== null && level <= referenceHeadingLevel) break;

    bibliographyTopLevelIndexes.add(index);
    for (const candidate of flattenReferenceCandidates(node)) {
      const rawText = textContent(candidate).trim();
      if (!rawText) continue;
      const explicit = rawText.match(EXPLICIT_REFERENCE_NUMBER);
      const number = Number(explicit?.[1] ?? explicit?.[2] ?? implicitNumber);
      const text = explicit ? rawText.slice(explicit[0].length).trim() : rawText;
      if (!text || !Number.isSafeInteger(number) || number <= 0) continue;
      references.set(number, { number, text, url: firstHttpsLink(candidate) });
      implicitNumber = Math.max(implicitNumber, number + 1);
    }
  }

  return { bibliographyTopLevelIndexes, references };
}

export function parseVancouverCitationNumbers(value: string): number[] | null {
  if (!/^\[(?:\d+\s*(?:[-–]\s*\d+)?)(?:\s*,\s*\d+\s*(?:[-–]\s*\d+)?)*\]$/.test(value)) return null;
  const body = value.slice(1, -1);
  const numbers: number[] = [];

  for (const part of body.split(",")) {
    const trimmed = part.trim();
    const range = trimmed.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (start <= 0 || end <= 0 || end < start || end - start > 50) return null;
      for (let number = start; number <= end; number += 1) numbers.push(number);
      continue;
    }
    const number = Number(trimmed);
    if (!Number.isSafeInteger(number) || number <= 0) return null;
    numbers.push(number);
  }

  return [...new Set(numbers)];
}

export const VANCOUVER_CITATION_PATTERN = /\[(?:\d+\s*(?:[-–]\s*\d+)?)(?:\s*,\s*\d+\s*(?:[-–]\s*\d+)?)*\]/g;
