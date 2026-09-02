import type { ContentItem } from "@cediah/contracts";

export function newestContentFirst(left: ContentItem, right: ContentItem) {
  return Date.parse(right.publishedAt ?? right.createdAt) - Date.parse(left.publishedAt ?? left.createdAt)
    || left.id.localeCompare(right.id);
}

export function mostViewedFirst(left: ContentItem, right: ContentItem) {
  return (right.viewCount ?? 0) - (left.viewCount ?? 0) || newestContentFirst(left, right);
}
