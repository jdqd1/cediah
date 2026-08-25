import { ArrowRight } from "@phosphor-icons/react";
import type { ContentItem } from "@cediah/contracts";
import Link from "next/link";
import { ContentTypeCover } from "./content-type-cover";

type ContentResourceListProps<T extends ContentItem> = {
  ariaLabel?: string;
  className?: string;
  contextForItem?: (item: T) => string[];
  hrefForItem: (item: T) => string;
  items: T[];
};

export function ContentResourceList<T extends ContentItem>({
  ariaLabel,
  className = "",
  contextForItem,
  hrefForItem,
  items,
}: ContentResourceListProps<T>) {
  return (
    <ul aria-label={ariaLabel} className={`content-resource-list ${className}`.trim()}>
      {items.map((item) => {
        const context = [...new Set(contextForItem?.(item).filter(Boolean) ?? [])];

        return (
          <li key={item.id}>
            <Link className="content-resource-item" href={hrefForItem(item)}>
              <ContentTypeCover className="content-resource-cover" kind={item.kind} />
              <span className="content-resource-copy">
                <strong>{item.title}</strong>
                {context.length > 0 && (
                  <span className="content-resource-context">{context.join(" · ")}</span>
                )}
                <span className="content-resource-summary">{item.summary}</span>
              </span>
              <ArrowRight aria-hidden="true" size={18} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
