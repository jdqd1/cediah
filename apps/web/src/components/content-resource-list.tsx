import { ArrowRight } from "@phosphor-icons/react";
import type { ContentItem } from "@cediah/contracts";
import Link from "next/link";
import type { ReactNode } from "react";
import { getSearchMatchRanges } from "@/lib/content-search";
import { ContentTypeCover } from "./content-type-cover";

type ContentResourceListProps<T extends ContentItem> = {
  ariaLabel?: string;
  className?: string;
  contextForItem?: (item: T) => string[];
  hrefForItem: (item: T) => string;
  items: T[];
  searchQuery?: string;
  summaryForItem?: (item: T) => string;
};

function HighlightedText({ query, value }: { query: string; value: string }) {
  if (!query.trim()) return value;

  const ranges = getSearchMatchRanges(value, query);
  if (ranges.length === 0) return value;

  const parts: ReactNode[] = [];
  let cursor = 0;
  ranges.forEach((range, index) => {
    if (range.start > cursor) parts.push(value.slice(cursor, range.start));
    parts.push(
      <mark className="content-search-match" key={`${range.start}-${range.end}-${index}`}>
        {value.slice(range.start, range.end)}
      </mark>,
    );
    cursor = range.end;
  });
  if (cursor < value.length) parts.push(value.slice(cursor));
  return parts;
}

export function ContentResourceList<T extends ContentItem>({
  ariaLabel,
  className = "",
  contextForItem,
  hrefForItem,
  items,
  searchQuery = "",
  summaryForItem,
}: ContentResourceListProps<T>) {
  return (
    <ul aria-label={ariaLabel} className={`content-resource-list ${className}`.trim()}>
      {items.map((item) => {
        const context = [...new Set(contextForItem?.(item).filter(Boolean) ?? [])];
        const contextText = context.join(" · ");
        const summary = summaryForItem?.(item) ?? item.summary;

        return (
          <li key={item.id}>
            <Link className="content-resource-item" href={hrefForItem(item)}>
              <ContentTypeCover className="content-resource-cover" kind={item.kind} />
              <span className="content-resource-copy">
                <strong><HighlightedText query={searchQuery} value={item.title} /></strong>
                {context.length > 0 && (
                  <span className="content-resource-context">
                    <HighlightedText query={searchQuery} value={contextText} />
                  </span>
                )}
                <span className="content-resource-summary">
                  <HighlightedText query={searchQuery} value={summary} />
                </span>
              </span>
              <ArrowRight aria-hidden="true" size={18} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
