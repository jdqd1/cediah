"use client";

import type { CSSProperties, ReactNode } from "react";
import { Fragment } from "react";
import type { RichTextDocument } from "@cediah/contracts";
import type { GuideTermOccurrence } from "@/lib/guide-terms";
import {
  buildGuideCitationIndex,
  parseVancouverCitationNumbers,
  VANCOUVER_CITATION_PATTERN,
  type GuideReference,
} from "@/lib/guide-citations";
import { createStableHeadingIdGenerator } from "@/lib/guide-document";
import { GuideCitation } from "./guide-citation";
import { useGuideTermContext } from "./guide-term-context";
import { InteractiveTerm } from "./interactive-term";

type JsonObject = Record<string, unknown>;

export type RichTextRendererProps = {
  className?: string;
  document: RichTextDocument;
};

const MAX_RENDER_DEPTH = 100;
const ALIGNMENTS = new Set(["left", "center", "right", "justify"]);
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

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

function renderMarkedText(
  node: JsonObject,
  references: Map<number, GuideReference>,
  interactiveCitations: boolean,
): ReactNode {
  const value = typeof node.text === "string" ? node.text : "";
  const marks = Array.isArray(node.marks) ? node.marks : [];
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
      pieces.push(<Fragment key={`text-${citationIndex}-${cursor}`}>{applyMarks(value.slice(cursor, start), marks)}</Fragment>);
    }

    const label = match[0];
    const numbers = parseVancouverCitationNumbers(label);
    const resolved = numbers?.map((number) => references.get(number)).filter((reference): reference is GuideReference => Boolean(reference)) ?? [];
    const complete = numbers !== null && resolved.length === numbers.length;

    if (complete && resolved.length > 0) {
      pieces.push(<GuideCitation key={`citation-${citationIndex}-${start}`} label={label} references={resolved} />);
    } else {
      pieces.push(<Fragment key={`citation-text-${citationIndex}-${start}`}>{applyMarks(label, marks)}</Fragment>);
    }

    cursor = start + label.length;
    citationIndex += 1;
  }

  if (cursor === 0) return applyMarks(value, marks);
  if (cursor < value.length) {
    pieces.push(<Fragment key={`text-tail-${cursor}`}>{applyMarks(value.slice(cursor), marks)}</Fragment>);
  }
  return pieces;
}

function textNodeWithValue(node: JsonObject, text: string): JsonObject {
  return { ...node, text };
}

function renderInteractiveText(
  node: JsonObject,
  occurrences: readonly GuideTermOccurrence[],
  references: Map<number, GuideReference>,
  interactiveCitations: boolean,
): ReactNode {
  const value = typeof node.text === "string" ? node.text : "";
  if (occurrences.length === 0 || !value) {
    return renderMarkedText(node, references, interactiveCitations);
  }

  const valid = occurrences
    .filter((occurrence) => occurrence.s >= 0 && occurrence.e <= value.length && occurrence.e > occurrence.s)
    .sort((left, right) => left.s - right.s || left.e - right.e);
  if (valid.length === 0) return renderMarkedText(node, references, interactiveCitations);

  const pieces: ReactNode[] = [];
  let cursor = 0;
  for (const [index, occurrence] of valid.entries()) {
    if (occurrence.s < cursor) continue;
    if (occurrence.s > cursor) {
      const text = value.slice(cursor, occurrence.s);
      pieces.push(
        <Fragment key={`term-before-${index}-${cursor}`}>
          {renderMarkedText(textNodeWithValue(node, text), references, interactiveCitations)}
        </Fragment>,
      );
    }
    const termText = value.slice(occurrence.s, occurrence.e);
    pieces.push(
      <InteractiveTerm key={`term-${occurrence.t}-${occurrence.s}`} termId={occurrence.t}>
        {renderMarkedText(textNodeWithValue(node, termText), references, interactiveCitations)}
      </InteractiveTerm>,
    );
    cursor = occurrence.e;
  }
  if (cursor < value.length) {
    pieces.push(
      <Fragment key={`term-tail-${cursor}`}>
        {renderMarkedText(textNodeWithValue(node, value.slice(cursor)), references, interactiveCitations)}
      </Fragment>,
    );
  }
  return pieces;
}

function manifestPath(renderPath: string) {
  return renderPath === "root" ? "" : renderPath.startsWith("root.") ? renderPath.slice(5) : renderPath;
}

export function RichTextRenderer({ className, document }: RichTextRendererProps) {
  const nextHeadingId = createStableHeadingIdGenerator();
  const citationIndex = buildGuideCitationIndex(document);
  const termContext = useGuideTermContext();

  const renderNode = (rawNode: unknown, path: string, depth: number, inBibliography = false): ReactNode => {
    if (depth > MAX_RENDER_DEPTH) return null;
    const node = asObject(rawNode);
    if (!node || typeof node.type !== "string") return null;

    if (node.type === "text") {
      const sourcePath = manifestPath(path);
      const occurrences = termContext.occurrencesForPath(sourcePath);
      return (
        <span data-guide-term-path={sourcePath} key={path}>
          {renderInteractiveText(node, occurrences, citationIndex.references, !inBibliography)}
        </span>
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
        const stableAnchor = termContext.sectionAnchorForPath(manifestPath(path));
        const headingClass = `rich-guide-heading rich-guide-heading-${level}${alignmentClass(node)}`;
        const content = renderChildren();
        const anchor = stableAnchor && stableAnchor !== id
          ? <span aria-hidden="true" className="rich-guide-stable-anchor" id={stableAnchor} />
          : null;

        if (level === 1) return <Fragment key={path}>{anchor}<h1 className={headingClass} id={id ?? stableAnchor ?? undefined}>{content}</h1></Fragment>;
        if (level === 2) return <Fragment key={path}>{anchor}<h2 className={headingClass} id={id ?? stableAnchor ?? undefined}>{content}</h2></Fragment>;
        if (level === 3) return <Fragment key={path}>{anchor}<h3 className={headingClass} id={id ?? stableAnchor ?? undefined}>{content}</h3></Fragment>;
        if (level === 4) return <Fragment key={path}>{anchor}<h4 className={headingClass}>{content}</h4></Fragment>;
        if (level === 5) return <Fragment key={path}>{anchor}<h5 className={headingClass}>{content}</h5></Fragment>;
        return <Fragment key={path}>{anchor}<h6 className={headingClass}>{content}</h6></Fragment>;
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
