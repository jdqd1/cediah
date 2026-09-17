"use client";

import type { CSSProperties, ReactNode } from "react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import type { RichTextDocument } from "@cediah/contracts";
import {
  buildGuideCitationIndex,
  parseVancouverCitationNumbers,
  VANCOUVER_CITATION_PATTERN,
  type GuideReference,
} from "@/lib/guide-citations";
import { createStableHeadingIdGenerator } from "@/lib/guide-document";
import { GuideCitation } from "./guide-citation";
import { InteractiveTerm, type InteractiveTermSummary } from "./interactive-term";

type JsonObject = Record<string, unknown>;

type InteractiveTermAnnotation = {
  end: number;
  path: string;
  start: number;
  termId: string;
};

type InteractiveTermsPayload = {
  annotations: InteractiveTermAnnotation[];
  dictionaryVersion: number;
  terms: InteractiveTermSummary[];
};

export type RichTextRendererProps = {
  className?: string;
  document: RichTextDocument;
};

const MAX_RENDER_DEPTH = 100;
const ALIGNMENTS = new Set(["left", "center", "right", "justify"]);
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const interactiveTermsCache = new Map<string, Promise<InteractiveTermsPayload | null>>();

function asObject(value: unknown): JsonObject | null {
  return typeof value === "object" && value !== null ? (value as JsonObject) : null;
}

function childrenOf(node: JsonObject): readonly unknown[] {
  return Array.isArray(node.content) ? node.content : [];
}

function attributesOf(node: JsonObject): JsonObject | null {
  return asObject(node.attrs);
}

function stringAttribute(node: JsonObject, name: string): string | null {
  const value = attributesOf(node)?.[name];
  return typeof value === "string" ? value : null;
}

function positiveIntegerAttribute(node: JsonObject, name: string): number | undefined {
  const value = attributesOf(node)?.[name];
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
}

function textContent(node: unknown, depth = 0): string {
  if (depth > MAX_RENDER_DEPTH) return "";
  const object = asObject(node);
  if (!object) return "";
  if (object.type === "text") return typeof object.text === "string" ? object.text : "";
  if (object.type === "hardBreak") return " ";
  if (object.type === "image") {
    const alternative = attributesOf(object)?.alt;
    return typeof alternative === "string" ? alternative : "";
  }

  return childrenOf(object)
    .map((child) => textContent(child, depth + 1))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const candidate = value.trim();
  try {
    return new URL(candidate).protocol === "https:" ? candidate : null;
  } catch {
    return null;
  }
}

function safeImageSource(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const candidate = value.trim();
  if (candidate.startsWith("/") && !candidate.startsWith("//") && !candidate.includes("\\")) {
    return candidate;
  }
  return safeHttpsUrl(candidate);
}

function alignmentClass(node: JsonObject): string {
  const alignment = stringAttribute(node, "textAlign");
  return alignment && ALIGNMENTS.has(alignment) ? ` rich-guide-align-${alignment}` : "";
}

function applyMarks(rendered: ReactNode, rawMarks: unknown[]): ReactNode {
  let result = rendered;
  for (const rawMark of rawMarks) {
    const mark = asObject(rawMark);
    if (!mark || typeof mark.type !== "string") continue;

    switch (mark.type) {
      case "bold":
        result = <strong className="rich-guide-bold">{result}</strong>;
        break;
      case "italic":
        result = <em className="rich-guide-italic">{result}</em>;
        break;
      case "underline":
        result = <u className="rich-guide-underline">{result}</u>;
        break;
      case "strike":
        result = <s className="rich-guide-strike">{result}</s>;
        break;
      case "highlight": {
        const color = asObject(mark.attrs)?.color;
        const style: CSSProperties | undefined =
          typeof color === "string" && HEX_COLOR.test(color)
            ? { backgroundColor: color }
            : undefined;
        result = (
          <mark className="rich-guide-highlight" style={style}>
            {result}
          </mark>
        );
        break;
      }
      case "link": {
        const attributes = asObject(mark.attrs);
        const href = safeHttpsUrl(attributes?.href);
        if (!href) break;
        const target = attributes?.target === "_self" ? "_self" : "_blank";
        result = (
          <a
            className="rich-guide-link"
            href={href}
            rel={target === "_blank" ? "noopener noreferrer" : undefined}
            target={target}
          >
            {result}
          </a>
        );
        break;
      }
    }
  }
  return result;
}

function renderCitationAwareText(
  value: string,
  marks: unknown[],
  references: Map<number, GuideReference>,
  interactiveCitations: boolean,
  keyPrefix: string,
): ReactNode {
  const hasUnsafeInteractiveWrapper = marks.some((rawMark) => {
    const mark = asObject(rawMark);
    return mark?.type === "link" || mark?.type === "code";
  });

  if (!interactiveCitations || hasUnsafeInteractiveWrapper || references.size === 0) {
    return applyMarks(value, marks);
  }

  const pieces: ReactNode[] = [];
  let cursor = 0;
  let citationIndex = 0;

  for (const match of value.matchAll(VANCOUVER_CITATION_PATTERN)) {
    const start = match.index ?? cursor;
    if (start > cursor) {
      pieces.push(
        <Fragment key={`${keyPrefix}-text-${citationIndex}-${cursor}`}>
          {applyMarks(value.slice(cursor, start), marks)}
        </Fragment>,
      );
    }

    const label = match[0];
    const numbers = parseVancouverCitationNumbers(label);
    const resolved = numbers?.map((number) => references.get(number)).filter((reference): reference is GuideReference => Boolean(reference)) ?? [];
    const complete = numbers !== null && resolved.length === numbers.length;

    if (complete && resolved.length > 0) {
      pieces.push(
        <GuideCitation
          key={`${keyPrefix}-citation-${citationIndex}-${start}`}
          label={label}
          references={resolved}
        />,
      );
    } else {
      pieces.push(
        <Fragment key={`${keyPrefix}-citation-text-${citationIndex}-${start}`}>
          {applyMarks(label, marks)}
        </Fragment>,
      );
    }

    cursor = start + label.length;
    citationIndex += 1;
  }

  if (cursor === 0) return applyMarks(value, marks);
  if (cursor < value.length) {
    pieces.push(
      <Fragment key={`${keyPrefix}-text-tail-${cursor}`}>
        {applyMarks(value.slice(cursor), marks)}
      </Fragment>,
    );
  }
  return pieces;
}

function renderMarkedText(
  node: JsonObject,
  path: string,
  references: Map<number, GuideReference>,
  interactiveCitations: boolean,
  annotations: readonly InteractiveTermAnnotation[],
  terms: ReadonlyMap<string, InteractiveTermSummary>,
): ReactNode {
  const value = typeof node.text === "string" ? node.text : "";
  const marks = Array.isArray(node.marks) ? node.marks : [];
  const ranges = annotations
    .filter((annotation) => annotation.start >= 0 && annotation.end <= value.length && annotation.end > annotation.start)
    .sort((left, right) => left.start - right.start || left.end - right.end);

  if (ranges.length === 0) {
    return renderCitationAwareText(value, marks, references, interactiveCitations, path);
  }

  const pieces: ReactNode[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start < cursor) continue;
    if (range.start > cursor) {
      pieces.push(
        <Fragment key={`${path}-plain-${cursor}`}>
          {renderCitationAwareText(
            value.slice(cursor, range.start),
            marks,
            references,
            interactiveCitations,
            `${path}-plain-${cursor}`,
          )}
        </Fragment>,
      );
    }

    const term = terms.get(range.termId);
    const label = value.slice(range.start, range.end);
    if (term) {
      pieces.push(
        <InteractiveTerm key={`${path}-term-${range.start}-${range.termId}`} term={term}>
          {applyMarks(label, marks)}
        </InteractiveTerm>,
      );
    } else {
      pieces.push(
        <Fragment key={`${path}-missing-term-${range.start}`}>
          {applyMarks(label, marks)}
        </Fragment>,
      );
    }
    cursor = range.end;
  }

  if (cursor < value.length) {
    pieces.push(
      <Fragment key={`${path}-plain-tail-${cursor}`}>
        {renderCitationAwareText(
          value.slice(cursor),
          marks,
          references,
          interactiveCitations,
          `${path}-plain-tail-${cursor}`,
        )}
      </Fragment>,
    );
  }
  return pieces;
}

function guideSlugFromPathname(pathname: string) {
  const match = pathname.match(/^\/guias\/([^/?#]+)/);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

function loadInteractiveTerms(slug: string) {
  const cached = interactiveTermsCache.get(slug);
  if (cached) return cached;
  const request = fetch(`/api/guides/${encodeURIComponent(slug)}/interactive-terms`, {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  })
    .then(async (response) => {
      if (!response.ok) return null;
      return await response.json() as InteractiveTermsPayload;
    })
    .catch(() => null);
  interactiveTermsCache.set(slug, request);
  return request;
}

export function RichTextRenderer({ className, document }: RichTextRendererProps) {
  const pathname = usePathname();
  const slug = useMemo(() => guideSlugFromPathname(pathname), [pathname]);
  const [interactiveTerms, setInteractiveTerms] = useState<InteractiveTermsPayload | null>(null);
  const nextHeadingId = createStableHeadingIdGenerator();
  const citationIndex = buildGuideCitationIndex(document);

  useEffect(() => {
    let active = true;
    if (slug) {
      void loadInteractiveTerms(slug).then((payload) => {
        if (active) setInteractiveTerms(payload);
      });
    }
    return () => {
      active = false;
    };
  }, [slug]);

  const effectiveInteractiveTerms = slug ? interactiveTerms : null;
  const annotationsByPath = useMemo(() => {
    const result = new Map<string, InteractiveTermAnnotation[]>();
    for (const annotation of effectiveInteractiveTerms?.annotations ?? []) {
      result.set(annotation.path, [...(result.get(annotation.path) ?? []), annotation]);
    }
    return result;
  }, [effectiveInteractiveTerms]);
  const termsById = useMemo(
    () => new Map((effectiveInteractiveTerms?.terms ?? []).map((term) => [term.id, term])),
    [effectiveInteractiveTerms],
  );

  const renderNode = (rawNode: unknown, path: string, depth: number, inBibliography = false): ReactNode => {
    if (depth > MAX_RENDER_DEPTH) return null;
    const node = asObject(rawNode);
    if (!node || typeof node.type !== "string") return null;

    if (node.type === "text") {
      return (
        <Fragment key={path}>
          {renderMarkedText(
            node,
            path,
            citationIndex.references,
            !inBibliography,
            annotationsByPath.get(path) ?? [],
            termsById,
          )}
        </Fragment>
      );
    }

    const renderChildren = () =>
      childrenOf(node).map((child, index) =>
        renderNode(child, `${path}.${index}`, depth + 1, inBibliography),
      );

    switch (node.type) {
      case "doc":
        return (
          <Fragment key={path}>
            {childrenOf(node).map((child, index) =>
              renderNode(
                child,
                `${path}.${index}`,
                depth + 1,
                citationIndex.bibliographyTopLevelIndexes.has(index),
              ),
            )}
          </Fragment>
        );
      case "paragraph":
        return (
          <p className={`rich-guide-paragraph${alignmentClass(node)}`} key={path}>
            {renderChildren()}
          </p>
        );
      case "heading": {
        const rawLevel = attributesOf(node)?.level;
        const level =
          typeof rawLevel === "number" && Number.isInteger(rawLevel) && rawLevel >= 1 && rawLevel <= 6
            ? rawLevel
            : 2;
        const label = textContent(node);
        const id = level >= 1 && level <= 3 ? nextHeadingId(label) : undefined;
        const headingClass = `rich-guide-heading rich-guide-heading-${level}${alignmentClass(node)}`;
        const content = renderChildren();

        if (level === 1) return <h1 className={headingClass} id={id} key={path}>{content}</h1>;
        if (level === 2) return <h2 className={headingClass} id={id} key={path}>{content}</h2>;
        if (level === 3) return <h3 className={headingClass} id={id} key={path}>{content}</h3>;
        if (level === 4) return <h4 className={headingClass} key={path}>{content}</h4>;
        if (level === 5) return <h5 className={headingClass} key={path}>{content}</h5>;
        return <h6 className={headingClass} key={path}>{content}</h6>;
      }
      case "table":
        return (
          <div className="rich-guide-table-wrap" key={path}>
            <table className="rich-guide-table">
              <tbody>{renderChildren()}</tbody>
            </table>
          </div>
        );
      case "tableRow":
        return <tr className="rich-guide-table-row" key={path}>{renderChildren()}</tr>;
      case "tableHeader": {
        const colSpan = positiveIntegerAttribute(node, "colspan");
        const rowSpan = positiveIntegerAttribute(node, "rowspan");
        return (
          <th className="rich-guide-table-header" colSpan={colSpan} key={path} rowSpan={rowSpan}>
            {renderChildren()}
          </th>
        );
      }
      case "tableCell": {
        const colSpan = positiveIntegerAttribute(node, "colspan");
        const rowSpan = positiveIntegerAttribute(node, "rowspan");
        return (
          <td className="rich-guide-table-cell" colSpan={colSpan} key={path} rowSpan={rowSpan}>
            {renderChildren()}
          </td>
        );
      }
      case "bulletList":
        return <ul className="rich-guide-bullet-list" key={path}>{renderChildren()}</ul>;
      case "orderedList": {
        const rawStart = attributesOf(node)?.start;
        const start =
          typeof rawStart === "number" && Number.isSafeInteger(rawStart) && rawStart > 0
            ? rawStart
            : undefined;
        return <ol className="rich-guide-ordered-list" key={path} start={start}>{renderChildren()}</ol>;
      }
      case "listItem":
        return <li className="rich-guide-list-item" key={path}>{renderChildren()}</li>;
      case "blockquote": {
        const calloutPrefix = textContent(node)
          .trimStart()
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .toLocaleUpperCase("es");
        const calloutClass = calloutPrefix.startsWith("RELACION CLINICA")
          ? " is-clinical"
          : calloutPrefix.startsWith("PUNTO CLAVE")
            ? " is-key-point"
            : "";
        return <blockquote className={`rich-guide-blockquote${calloutClass}`} key={path}>{renderChildren()}</blockquote>;
      }
      case "horizontalRule":
        return <hr className="rich-guide-horizontal-rule" key={path} />;
      case "hardBreak":
        return <br key={path} />;
      case "image": {
        const src = safeImageSource(attributesOf(node)?.src);
        if (!src) return null;
        const alt = stringAttribute(node, "alt") ?? "";
        const title = stringAttribute(node, "title") ?? undefined;
        return (
          // Rich guide images may use user-uploaded HTTPS hosts unknown at build time.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={alt}
            className="rich-guide-image"
            decoding="async"
            key={path}
            loading="lazy"
            src={src}
            title={title}
          />
        );
      }
      default:
        // Unsupported wrappers never become DOM elements, but their supported
        // descendants remain readable (and are still processed by this allowlist).
        return <Fragment key={path}>{renderChildren()}</Fragment>;
    }
  };

  const rootClassName = ["rich-guide-document", className].filter(Boolean).join(" ");
  return <div className={rootClassName}>{renderNode(document, "root", 0)}</div>;
}
