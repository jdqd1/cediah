import type { GuideSection, RichTextDocument } from "@cediah/contracts";

type JsonObject = Record<string, unknown>;

export type GuideOutlineItem = {
  id: string;
  index: number;
  label: string;
  level: 2 | 3;
};

const MAX_TRAVERSAL_DEPTH = 100;

function asObject(value: unknown): JsonObject | null {
  return typeof value === "object" && value !== null ? (value as JsonObject) : null;
}

function nodeType(node: unknown): string {
  const object = asObject(node);
  return object && typeof object.type === "string" ? object.type : "";
}

function nodeChildren(node: unknown): readonly unknown[] {
  const object = asObject(node);
  return object && Array.isArray(object.content) ? object.content : [];
}

function nodeAttributes(node: unknown): JsonObject | null {
  const object = asObject(node);
  return object ? asObject(object.attrs) : null;
}

function headingLevel(node: unknown): number | null {
  const level = nodeAttributes(node)?.level;
  return typeof level === "number" && Number.isInteger(level) ? level : null;
}

function imageAlternative(node: unknown): string {
  const alternative = nodeAttributes(node)?.alt;
  return typeof alternative === "string" ? alternative : "";
}

function textNode(text: string): JsonObject | null {
  return text.length > 0 ? { type: "text", text } : null;
}

function paragraphNode(value: string): JsonObject {
  const lines = value.split("\n");
  const content: JsonObject[] = [];

  lines.forEach((line, index) => {
    const text = textNode(line);
    if (text) content.push(text);
    if (index < lines.length - 1) content.push({ type: "hardBreak" });
  });

  return { type: "paragraph", content };
}

function bodyToParagraphs(value: string): JsonObject[] {
  const normalized = value.replace(/\r\n?/g, "\n");
  if (!normalized) return [{ type: "paragraph", content: [] }];

  return normalized
    .split(/\n[\t ]*\n+/)
    .map((paragraph) => paragraphNode(paragraph));
}

/**
 * Converts the former section-based guide format into a Tiptap document.
 * Single line breaks are retained as hard breaks and blank lines become
 * separate paragraphs, so importing a legacy draft does not flatten it.
 */
export function sectionsToRichTextDocument(
  sections: readonly GuideSection[],
): RichTextDocument {
  const content: JsonObject[] = [];

  for (const section of sections) {
    const heading = textNode(section.heading);
    content.push({
      type: "heading",
      attrs: { level: 2 },
      content: heading ? [heading] : [],
    });
    content.push(...bodyToParagraphs(section.body));
  }

  return { type: "doc", content } as RichTextDocument;
}

function inlineNodeText(node: unknown, depth = 0): string {
  if (depth > MAX_TRAVERSAL_DEPTH) return "";

  const object = asObject(node);
  if (!object) return "";

  if (object.type === "text") {
    return typeof object.text === "string" ? object.text : "";
  }
  if (object.type === "hardBreak") return "\n";
  if (object.type === "image") return imageAlternative(object);
  if (object.type === "horizontalRule") return "";

  return nodeChildren(object)
    .map((child) => inlineNodeText(child, depth + 1))
    .join("");
}

function listItemText(node: unknown, depth: number): string {
  return nodeChildren(node)
    .map((child) => blockNodeText(child, depth + 1))
    .filter(Boolean)
    .join("\n");
}

function blockNodeText(node: unknown, depth = 0): string {
  if (depth > MAX_TRAVERSAL_DEPTH) return "";

  const type = nodeType(node);
  if (type === "text" || type === "hardBreak" || type === "image") {
    return inlineNodeText(node, depth + 1);
  }
  if (type === "horizontalRule") return "";

  if (type === "bulletList") {
    return nodeChildren(node)
      .map((child) => listItemText(child, depth + 1))
      .filter(Boolean)
      .map((item) => `- ${item.replace(/\n/g, "\n  ")}`)
      .join("\n");
  }

  if (type === "orderedList") {
    const startAttribute = nodeAttributes(node)?.start;
    const start =
      typeof startAttribute === "number" && Number.isSafeInteger(startAttribute)
        ? startAttribute
        : 1;
    return nodeChildren(node)
      .map((child) => listItemText(child, depth + 1))
      .filter(Boolean)
      .map((item, index) => `${start + index}. ${item.replace(/\n/g, "\n   ")}`)
      .join("\n");
  }

  if (type === "listItem" || type === "blockquote") {
    return nodeChildren(node)
      .map((child) => blockNodeText(child, depth + 1))
      .filter(Boolean)
      .join("\n");
  }

  if (type === "paragraph" || type === "heading") {
    return inlineNodeText(node, depth + 1);
  }

  return nodeChildren(node)
    .map((child) => blockNodeText(child, depth + 1))
    .filter(Boolean)
    .join("\n\n");
}

function normalizeExtractedText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[\t ]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Extracts readable text for search, summaries, validation and legacy fields. */
export function richTextDocumentToPlainText(document: RichTextDocument): string {
  return normalizeExtractedText(
    nodeChildren(document)
      .map((node) => blockNodeText(node))
      .filter(Boolean)
      .join("\n\n"),
  );
}

/**
 * Projects a rich document back to the old `{ heading, body }` representation.
 * Every level-two heading starts a section. Content before the first one is kept
 * in a neutral section instead of being discarded.
 */
export function richTextDocumentToSections(
  document: RichTextDocument,
): GuideSection[] {
  const sections: GuideSection[] = [];
  let heading = "";
  let bodyParts: string[] = [];

  const flush = () => {
    const body = normalizeExtractedText(bodyParts.filter(Boolean).join("\n\n"));
    if (!body) {
      heading = "";
      bodyParts = [];
      return;
    }

    sections.push({
      heading: heading.trim() || "Contenido",
      body,
    } as GuideSection);
    heading = "";
    bodyParts = [];
  };

  for (const node of nodeChildren(document)) {
    if (nodeType(node) === "heading" && headingLevel(node) === 2) {
      flush();
      heading = normalizeExtractedText(inlineNodeText(node));
      continue;
    }

    const text = blockNodeText(node);
    if (text) bodyParts.push(text);
  }

  flush();
  return sections;
}

function headingSlug(label: string): string {
  return (
    label
      .normalize("NFKD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80)
      .replace(/-+$/g, "") || "seccion"
  );
}

/** Creates the deterministic base ID used by guide headings. */
export function createStableHeadingId(label: string, occurrence = 1): string {
  const base = headingSlug(label);
  return occurrence > 1 ? `${base}-${occurrence}` : base;
}

/**
 * Returns a stateful ID allocator. In addition to duplicate labels, it handles
 * collisions such as `Tema`, `Tema 2`, `Tema` without emitting the same ID.
 */
export function createStableHeadingIdGenerator(): (label: string) => string {
  const occurrences = new Map<string, number>();
  const used = new Set<string>();

  return (label: string) => {
    const base = headingSlug(label);
    let occurrence = (occurrences.get(base) ?? 0) + 1;
    let candidate = createStableHeadingId(label, occurrence);

    while (used.has(candidate)) {
      occurrence += 1;
      candidate = createStableHeadingId(label, occurrence);
    }

    occurrences.set(base, occurrence);
    used.add(candidate);
    return candidate;
  };
}

/** Builds the reader/editor outline from level-two and level-three headings. */
export function extractGuideOutline(document: RichTextDocument): GuideOutlineItem[] {
  const outline: GuideOutlineItem[] = [];
  const nextId = createStableHeadingIdGenerator();

  const visit = (node: unknown, depth: number) => {
    if (depth > MAX_TRAVERSAL_DEPTH) return;

    if (nodeType(node) === "heading") {
      const level = headingLevel(node);
      if (level === 2 || level === 3) {
        const label = normalizeExtractedText(inlineNodeText(node));
        const id = nextId(label);
        if (label) {
          outline.push({ id, index: outline.length, label, level });
        }
      }
    }

    for (const child of nodeChildren(node)) visit(child, depth + 1);
  };

  visit(document, 0);
  return outline;
}
