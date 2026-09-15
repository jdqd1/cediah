type JsonNode = Record<string, unknown>;

const KEY_POINT_PREFIX = /^\s*PUNTO\s+CLAVE\b\s*(?:[—–:\-]\s*)?/i;
const LINKABLE_BLOCK_TYPES = new Set([
  "blockquote",
  "heading",
  "listItem",
  "paragraph",
  "tableCell",
  "tableHeader",
]);

function asNode(value: unknown): JsonNode | null {
  return typeof value === "object" && value !== null ? value as JsonNode : null;
}

function childrenOf(node: JsonNode): readonly unknown[] {
  return Array.isArray(node.content) ? node.content : [];
}

function nodeText(value: unknown, depth = 0): string {
  if (depth > 100) return "";
  const node = asNode(value);
  if (!node) return "";
  if (node.type === "text") return typeof node.text === "string" ? node.text : "";
  if (node.type === "hardBreak") return " ";
  return childrenOf(node).map((child) => nodeText(child, depth + 1)).join("");
}

export function normalizeGuideKeyPoint(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function stripGuideKeyPointPrefix(value: string): string | null {
  if (!KEY_POINT_PREFIX.test(value)) return null;
  const stripped = value.replace(KEY_POINT_PREFIX, "").replace(/\s+/g, " ").trim();
  return stripped || null;
}

export function extractGuideKeyPoints(source: unknown): string[] {
  const points: string[] = [];
  const seen = new Set<string>();

  const visit = (value: unknown, depth = 0) => {
    if (depth > 100) return;
    if (Array.isArray(value)) {
      value.forEach((child) => visit(child, depth + 1));
      return;
    }

    const node = asNode(value);
    if (!node) return;

    if (node.type === "blockquote") {
      const point = stripGuideKeyPointPrefix(nodeText(node));
      if (point) {
        const normalized = normalizeGuideKeyPoint(point);
        if (normalized && !seen.has(normalized)) {
          seen.add(normalized);
          points.push(point);
        }
      }
      return;
    }

    childrenOf(node).forEach((child) => visit(child, depth + 1));
  };

  visit(source);
  return points;
}

export function appendDiscoveredGuideKeyPoints(
  existing: readonly string[],
  discovered: readonly string[],
  limit = 30,
): string[] {
  const merged = existing.slice(0, limit);
  const seen = new Set(
    merged.map(normalizeGuideKeyPoint).filter(Boolean),
  );

  for (const raw of discovered) {
    if (merged.length >= limit) break;
    const value = raw.replace(/\s+/g, " ").trim();
    const normalized = normalizeGuideKeyPoint(value);
    if (!value || !normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    merged.push(value);
  }

  return merged;
}

export function mergeGuideKeyPoints(
  existing: readonly string[],
  discovered: readonly string[],
  limit = 30,
): string[] {
  const merged: string[] = [];
  const seen = new Set<string>();

  for (const raw of [...existing, ...discovered]) {
    const value = raw.replace(/\s+/g, " ").trim();
    const normalized = normalizeGuideKeyPoint(value);
    if (!value || !normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    merged.push(value);
    if (merged.length >= limit) break;
  }

  return merged;
}

export function isGuideKeyPointLinked(source: unknown, point: string): boolean {
  const target = normalizeGuideKeyPoint(point);
  if (!target) return false;
  let linked = false;

  const visit = (value: unknown, depth = 0) => {
    if (linked || depth > 100) return;
    if (Array.isArray(value)) {
      value.forEach((child) => visit(child, depth + 1));
      return;
    }

    const node = asNode(value);
    if (!node) return;

    if (typeof node.type === "string" && LINKABLE_BLOCK_TYPES.has(node.type)) {
      const raw = nodeText(node).replace(KEY_POINT_PREFIX, "");
      const candidate = normalizeGuideKeyPoint(raw);
      if (
        candidate &&
        (candidate.includes(target) || (candidate.length >= 24 && target.includes(candidate)))
      ) {
        linked = true;
        return;
      }
    }

    childrenOf(node).forEach((child) => visit(child, depth + 1));
  };

  visit(source);
  return linked;
}
