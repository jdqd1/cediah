import type { ContentItem } from "@cediah/contracts";

export function newestContentFirst(left: ContentItem, right: ContentItem) {
  return Date.parse(right.publishedAt ?? right.createdAt) - Date.parse(left.publishedAt ?? left.createdAt)
    || left.id.localeCompare(right.id);
}

export function mostViewedFirst(left: ContentItem, right: ContentItem) {
  return (right.viewCount ?? 0) - (left.viewCount ?? 0) || newestContentFirst(left, right);
}

export function applyContentIdOrder<T extends { id: string }>(
  items: readonly T[],
  orderedIds: readonly string[],
) {
  if (items.length < 2 || orderedIds.length === 0) return [...items];
  const order = new Map(orderedIds.map((id, index) => [id, index]));
  const original = new Map(items.map((item, index) => [item.id, index]));

  return [...items].sort((left, right) => {
    const leftOrder = order.get(left.id);
    const rightOrder = order.get(right.id);
    if (leftOrder !== undefined && rightOrder !== undefined) return leftOrder - rightOrder;
    if (leftOrder !== undefined) return -1;
    if (rightOrder !== undefined) return 1;
    return (original.get(left.id) ?? 0) - (original.get(right.id) ?? 0);
  });
}
