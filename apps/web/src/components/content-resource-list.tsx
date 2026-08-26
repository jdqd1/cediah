import { ArrowRight } from "@phosphor-icons/react";
import type { ContentItem } from "@cediah/contracts";
import Link from "next/link";
import type { ReactNode } from "react";
import { ContentTypeCover } from "./content-type-cover";

type ContentResourceListProps<T extends ContentItem> = {
  ariaLabel?: string;
  className?: string;
  contextForItem?: (item: T) => string[];
  hrefForItem: (item: T) => string;
  items: T[];
  searchQuery?: string;
};

const diacriticPattern = /\p{Diacritic}/gu;

function normalizeComparableText(value: string) {
  return value
    .normalize("NFD")
    .replace(diacriticPattern, "")
    .toLocaleLowerCase("es");
}

function normalizedTextWithSourceMap(value: string) {
  let normalized = "";
  const sourceStarts: number[] = [];
  const sourceEnds: number[] = [];
  let sourceIndex = 0;

  for (const character of value) {
    const comparable = normalizeComparableText(character);

    for (let comparableIndex = 0; comparableIndex < comparable.length; comparableIndex += 1) {
      normalized += comparable[comparableIndex];
      sourceStarts.push(sourceIndex);
      sourceEnds.push(sourceIndex + character.length);
    }
    sourceIndex += character.length;
  }

  return { normalized, sourceEnds, sourceStarts };
}

function HighlightedText({ normalizedQuery, value }: { normalizedQuery: string; value: string }) {
  if (!normalizedQuery) return value;

  const { normalized, sourceEnds, sourceStarts } = normalizedTextWithSourceMap(value);
  const ranges: Array<{ end: number; start: number }> = [];
  let matchIndex = normalized.indexOf(normalizedQuery);
  while (matchIndex >= 0) {
    const matchEndIndex = matchIndex + normalizedQuery.length - 1;
    ranges.push({
      end: sourceEnds[matchEndIndex] ?? value.length,
      start: sourceStarts[matchIndex] ?? 0,
    });
    matchIndex = normalized.indexOf(normalizedQuery, matchIndex + normalizedQuery.length);
  }
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
}: ContentResourceListProps<T>) {
  const normalizedQuery = normalizeComparableText(searchQuery.trim());

  return (
    <ul aria-label={ariaLabel} className={`content-resource-list ${className}`.trim()}>
      {items.map((item) => {
        const context = [...new Set(contextForItem?.(item).filter(Boolean) ?? [])];
        const contextText = context.join(" · ");

        return (
          <li key={item.id}>
            <Link className="content-resource-item" href={hrefForItem(item)}>
              <ContentTypeCover className="content-resource-cover" kind={item.kind} />
              <span className="content-resource-copy">
                <strong><HighlightedText normalizedQuery={normalizedQuery} value={item.title} /></strong>
                {context.length > 0 && (
                  <span className="content-resource-context">
                    <HighlightedText normalizedQuery={normalizedQuery} value={contextText} />
                  </span>
                )}
                <span className="content-resource-summary">
                  <HighlightedText normalizedQuery={normalizedQuery} value={item.summary} />
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
