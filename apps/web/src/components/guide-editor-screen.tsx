"use client";

import type {
  ClipboardEvent as ReactClipboardEvent,
  MouseEvent as ReactMouseEvent,
} from "react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUDownLeft,
  ArrowUUpLeft,
  CaretDown,
  CaretUp,
  Check,
  CheckCircle,
  Eye,
  HighlighterCircle,
  ImageSquare,
  LinkSimple,
  ListBullets,
  ListNumbers,
  Minus,
  NotePencil,
  Paragraph,
  Plus,
  Question,
  Quotes,
  TextAlignCenter,
  TextAlignLeft,
  TextAlignRight,
  TextB,
  TextItalic,
  TextStrikethrough,
  TextUnderline,
  Table as TableIcon,
  Trash,
} from "@phosphor-icons/react";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import { TableKit } from "@tiptap/extension-table";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor, type Editor, type JSONContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import {
  CellSelection,
  deleteColumn as deleteSelectedColumns,
  deleteRow as deleteSelectedRows,
  deleteTable as deleteSelectedTable,
} from "@tiptap/pm/tables";
import StarterKit from "@tiptap/starter-kit";
import {
  RichTextDocumentSchema,
  type ContentAsset,
  type ContentDraft,
  type ContentStatus,
  type RichTextDocument,
} from "@cediah/contracts";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  extractGuideOutline,
  numberGuideOutline,
  richTextDocumentToPlainText,
  richTextDocumentToSections,
  sectionsToRichTextDocument,
} from "@/lib/guide-document";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { IconBackLink } from "./compact-navigation";
import { PlatformToast, type PlatformNotice } from "./platform-toast";

const PublishedGuideReader = dynamic(
  () => import("./content-detail-screen").then((module) => module.PublishedGuideReader),
  {
    loading: () => <div className="guide-editor-module-loading" role="status">Preparando vista previa…</div>,
    ssr: false,
  },
);

type GuideDraft = Extract<ContentDraft, { kind: "guide" }>;
type VideoDraft = Extract<ContentDraft, { kind: "video" }>;
type EditableGuideDraft = GuideDraft | VideoDraft;
type QuizQuestion = Extract<ContentDraft, { kind: "quiz" }>[
  "content"
]["questions"][number];

type PendingNavigationIntent =
  | { href: string; kind: "href" }
  | { kind: "fallback-back" }
  | { kind: "panel" };

type BrowserNavigateEvent = Event & {
  destination: { url: string };
  downloadRequest: string | null;
  hashChange: boolean;
  navigationType: "push" | "reload" | "replace" | "traverse";
};

type BrowserNavigation = EventTarget;

type TableControlsPosition = {
  bottom: number;
  left: number;
  right: number;
  showColumn: boolean;
  showRow: boolean;
  top: number;
};

type TableContextMenuState = {
  left: number;
  position: number;
  top: number;
};

type TableContextAction =
  | "add-column-after"
  | "add-column-before"
  | "add-row-after"
  | "add-row-before"
  | "delete-column"
  | "delete-row"
  | "delete-table"
  | "toggle-header-row";

type MobileEditorDrawer = "companions" | "outline" | null;

const fallbackGuardStateKey = "__cediahGuideEditorGuard";
const fallbackBaseStateKey = "__cediahGuideEditorBase";

function getBrowserNavigation(): BrowserNavigation | null {
  return (window as Window & { navigation?: BrowserNavigation }).navigation ?? null;
}

function historyStateRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? { ...(value as Record<string, unknown>) }
    : {};
}

const statusLabels: Record<ContentStatus, string> = {
  approved: "Aprobado",
  archived: "Archivado",
  changes_requested: "Cambios solicitados",
  draft: "Borrador",
  in_review: "En revisión",
  published: "Publicado",
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function summaryFromText(value: string) {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > 280 ? compact.slice(0, 277).trimEnd() + "…" : compact;
}

// Keep this callback stable. BubbleMenu updates its plugin whenever this prop
// changes; recreating it on every editor transaction can otherwise create an
// update/render loop when edit mode is enabled.
function showBubbleMenuForSelection({ from, to }: { from: number; to: number }) {
  return from !== to;
}

function guideDocument(draft: EditableGuideDraft) {
  const guide = draft.kind === "video" ? draft.content.guide : draft.content;
  return guide.document ?? sectionsToRichTextDocument(guide.sections);
}

function guideKeyPoints(draft: EditableGuideDraft) {
  return draft.content.keyPoints;
}

function guideQuestions(draft: EditableGuideDraft) {
  return draft.content.quiz.questions;
}

function withDocument(draft: EditableGuideDraft, document: RichTextDocument): EditableGuideDraft {
  const sections = richTextDocumentToSections(document);
  if (draft.kind === "video") {
    return {
      ...draft,
      content: {
        ...draft.content,
        guide: { ...draft.content.guide, document, sections },
      },
    };
  }
  return { ...draft, content: { ...draft.content, document, sections } };
}

function withKeyPoints(draft: EditableGuideDraft, keyPoints: string[]): EditableGuideDraft {
  return { ...draft, content: { ...draft.content, keyPoints } } as EditableGuideDraft;
}

function withQuestions(draft: EditableGuideDraft, questions: QuizQuestion[]): EditableGuideDraft {
  return {
    ...draft,
    content: { ...draft.content, quiz: { questions } },
  } as EditableGuideDraft;
}

function sanitizeEditorJson(content: JSONContent): JSONContent {
  const node: JSONContent = { type: content.type };
  if (typeof content.text === "string") node.text = content.text;
  if (content.content) node.content = content.content.map(sanitizeEditorJson);
  if (content.marks) {
    node.marks = content.marks.flatMap((mark) => {
      if (mark.type === "link") {
        try {
          const href = typeof mark.attrs?.href === "string" ? mark.attrs.href : "";
          const url = new URL(href);
          return url.protocol === "https:"
            ? [{ type: mark.type, attrs: { href: url.toString() } }]
            : [];
        } catch {
          return [];
        }
      }
      if (mark.type === "highlight") return [{ type: mark.type }];
      return [{ type: mark.type }];
    });
  }
  if (content.type === "heading") {
    node.attrs = {
      level: content.attrs?.level,
      ...(content.attrs?.textAlign ? { textAlign: content.attrs.textAlign } : {}),
    };
  } else if (content.type === "paragraph" && content.attrs?.textAlign) {
    node.attrs = { textAlign: content.attrs.textAlign };
  } else if (content.type === "orderedList" && Number.isInteger(content.attrs?.start)) {
    node.attrs = { start: content.attrs?.start };
  } else if (content.type === "tableCell" || content.type === "tableHeader") {
    const attrs = content.attrs;
    const colspan = attrs?.colspan;
    const rowspan = attrs?.rowspan;
    const colwidth = Array.isArray(attrs?.colwidth)
      ? attrs.colwidth.filter((value): value is number => typeof value === "number" && Number.isFinite(value))
      : null;
    node.attrs = {
      ...(Number.isInteger(colspan) ? { colspan } : {}),
      ...(Number.isInteger(rowspan) ? { rowspan } : {}),
      colwidth,
    };
  } else if (content.type === "image") {
    node.attrs = {
      src: content.attrs?.src,
      ...(content.attrs?.alt ? { alt: content.attrs.alt } : {}),
      ...(content.attrs?.title ? { title: content.attrs.title } : {}),
    };
  }
  return node;
}

type MarkdownMark = { type: string; attrs?: Record<string, unknown> };

function markdownInlineContent(value: string): JSONContent[] {
  const content: JSONContent[] = [];
  const pattern = /(\*\*|__)(.+?)\1|~~(.+?)~~|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(?<!\w)(\*|_)([^*_]+)\7/g;
  let cursor = 0;

  const pushText = (text: string, marks?: MarkdownMark[]) => {
    if (!text) return;
    content.push({ type: "text", text, ...(marks?.length ? { marks } : {}) });
  };

  for (const match of value.matchAll(pattern)) {
    const start = match.index ?? cursor;
    pushText(value.slice(cursor, start));
    if (match[2]) pushText(match[2], [{ type: "bold" }]);
    else if (match[3]) pushText(match[3], [{ type: "strike" }]);
    else if (match[4]) pushText(match[4], [{ type: "code" }]);
    else if (match[5] && match[6]) {
      pushText(match[5], [{
        type: "link",
        attrs: { href: match[6], target: "_blank", rel: "noopener noreferrer" },
      }]);
    } else if (match[8]) pushText(match[8], [{ type: "italic" }]);
    else pushText(match[0]);
    cursor = start + match[0].length;
  }

  pushText(value.slice(cursor));
  return content;
}

function paragraphFromMarkdown(value: string): JSONContent {
  const lines = value.split("\n");
  const content: JSONContent[] = [];
  lines.forEach((line, index) => {
    content.push(...markdownInlineContent(line));
    if (index < lines.length - 1) content.push({ type: "hardBreak" });
  });
  return { type: "paragraph", ...(content.length > 0 ? { content } : {}) };
}

function splitTableRow(value: string): string[] {
  const trimmed = value.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells: string[] = [];
  let cell = "";
  let escaped = false;

  for (const character of trimmed) {
    if (escaped) {
      cell += character;
      escaped = false;
    } else if (character === "\\") {
      escaped = true;
    } else if (character === "|") {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += character;
    }
  }

  if (escaped) cell += "\\";
  cells.push(cell.trim());
  return cells;
}

function isMarkdownTableSeparator(value: string): boolean {
  const cells = splitTableRow(value);
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function tableFromRows(rows: string[][], firstRowIsHeader = true): JSONContent | null {
  const normalizedRows = rows
    .map((row) => row.map((cell) => cell.replace(/\\\|/g, "|").trim()))
    .filter((row) => row.length > 0);
  if (normalizedRows.length < 2) return null;

  const columnCount = Math.max(...normalizedRows.map((row) => row.length));
  if (columnCount < 2) return null;

  return {
    type: "table",
    content: normalizedRows.map((row, rowIndex) => ({
      type: "tableRow",
      content: Array.from({ length: columnCount }, (_, columnIndex) => ({
        type: firstRowIsHeader && rowIndex === 0 ? "tableHeader" : "tableCell",
        attrs: { colspan: 1, rowspan: 1, colwidth: null },
        content: [{
          type: "paragraph",
          content: markdownInlineContent(row[columnIndex] ?? ""),
        }],
      })),
    })),
  };
}

function htmlTableContent(html: string): JSONContent | null {
  if (!html || typeof DOMParser === "undefined") return null;
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const table = parsed.querySelector("table");
  if (!table) return null;

  const rows = Array.from(table.querySelectorAll("tr"))
    .map((row) => Array.from(row.children)
      .filter((cell) => cell.tagName === "TD" || cell.tagName === "TH")
      .map((cell) => (cell.textContent ?? "").replace(/\s+/g, " ").trim()))
    .filter((row) => row.length > 0);
  return tableFromRows(rows, true);
}

function textTableContent(text: string): JSONContent | null {
  const lines = text.replace(/\r/g, "").split("\n").filter((line) => line.trim());
  if (lines.length < 2) return null;

  const tabRows = lines.map((line) => line.split("\t").map((cell) => cell.trim()));
  if (tabRows.every((row) => row.length > 1)) {
    const width = Math.max(...tabRows.map((row) => row.length));
    if (width > 1 && tabRows.every((row) => row.length === width)) {
      return tableFromRows(tabRows);
    }
  }

  const firstLine = lines[0] ?? "";
  const secondLine = lines[1] ?? "";
  if (lines.length >= 3 && isMarkdownTableSeparator(secondLine)) {
    const header = splitTableRow(firstLine);
    const separator = splitTableRow(secondLine);
    if (header.length === separator.length && header.length > 1) {
      const rows = [header, ...lines.slice(2).map(splitTableRow)];
      if (rows.slice(1).every((row) => row.length === header.length)) return tableFromRows(rows);
    }
  }

  return null;
}

function markdownPasteContent(text: string): JSONContent[] {
  const lines = text.replace(/\r/g, "").split("\n");
  const content: JSONContent[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (/^\s*```/.test(line)) {
      const language = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !/^\s*```/.test(lines[index] ?? "")) {
        codeLines.push(lines[index] ?? "");
        index += 1;
      }
      if (index < lines.length) index += 1;
      content.push({
        type: "codeBlock",
        ...(language ? { attrs: { language } } : {}),
        content: codeLines.length > 0 ? [{ type: "text", text: codeLines.join("\n") }] : undefined,
      });
      continue;
    }

    if (index + 1 < lines.length && isMarkdownTableSeparator(lines[index + 1] ?? "")) {
      const header = splitTableRow(line);
      const separator = splitTableRow(lines[index + 1] ?? "");
      if (header.length === separator.length && header.length > 1) {
        const rows = [header];
        index += 2;
        while (index < lines.length && lines[index]?.trim() && lines[index]?.includes("|")) {
          const row = splitTableRow(lines[index] ?? "");
          if (row.length !== header.length) break;
          rows.push(row);
          index += 1;
        }
        const table = tableFromRows(rows);
        if (table) content.push(table);
        continue;
      }
    }

    const heading = line.match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      content.push({
        type: "heading",
        attrs: { level: Math.min(3, heading[1]?.length ?? 1) },
        content: markdownInlineContent(heading[2] ?? ""),
      });
      index += 1;
      continue;
    }

    if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
      content.push({ type: "horizontalRule" });
      index += 1;
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const items: JSONContent[] = [];
      while (index < lines.length && /^\s*[-*+]\s+/.test(lines[index] ?? "")) {
        items.push({
          type: "listItem",
          content: [{ type: "paragraph", content: markdownInlineContent((lines[index] ?? "").replace(/^\s*[-*+]\s+/, "")) }],
        });
        index += 1;
      }
      content.push({ type: "bulletList", content: items });
      continue;
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: JSONContent[] = [];
      const firstNumber = Number((line.match(/^\s*(\d+)/)?.[1] ?? "1"));
      while (index < lines.length && /^\s*\d+[.)]\s+/.test(lines[index] ?? "")) {
        items.push({
          type: "listItem",
          content: [{ type: "paragraph", content: markdownInlineContent((lines[index] ?? "").replace(/^\s*\d+[.)]\s+/, "")) }],
        });
        index += 1;
      }
      content.push({ type: "orderedList", attrs: { start: firstNumber }, content: items });
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^\s*>\s?/.test(lines[index] ?? "")) {
        quoteLines.push((lines[index] ?? "").replace(/^\s*>\s?/, ""));
        index += 1;
      }
      content.push({ type: "blockquote", content: [paragraphFromMarkdown(quoteLines.join("\n"))] });
      continue;
    }

    const paragraphLines: string[] = [line];
    index += 1;
    while (index < lines.length && lines[index]?.trim()) {
      paragraphLines.push(lines[index] ?? "");
      index += 1;
    }
    content.push(paragraphFromMarkdown(paragraphLines.join("\n")));
  }

  return content.length > 0 ? content : [{ type: "paragraph" }];
}

function pastedContent(text: string, html: string): JSONContent[] {
  const table = htmlTableContent(html) ?? textTableContent(text);
  return table ? [table] : markdownPasteContent(text);
}

function ToolbarButton({
  active = false,
  disabled = false,
  label,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={active || undefined}
      className={active ? "is-active" : ""}
      disabled={disabled}
      title={label}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function KeyPointsPanel({
  disabled,
  editor,
  onChange,
  values,
}: {
  disabled: boolean;
  editor: Editor | null;
  onChange: (values: string[]) => void;
  values: string[];
}) {
  const [collapsed, setCollapsed] = useState(false);

  function addSelection() {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const selected = editor.state.doc.textBetween(from, to, " ").trim();
    onChange([...values, selected || ""]);
  }

  return (
    <section className={`guide-companion-panel ${collapsed ? "is-collapsed" : ""}`}>
      <header>
        <button type="button" onClick={() => setCollapsed((value) => !value)}>
          <span><HighlighterCircle size={19} /> Puntos clave <small className="guide-count guide-count-key-points">{values.length}</small></span>
          {collapsed ? <CaretDown size={16} /> : <CaretUp size={16} />}
        </button>
      </header>
      {!collapsed && (
        <div className="guide-companion-body">
          {values.map((value, index) => (
            <div className="guide-key-point-row" key={index}>
              <span>{index + 1}</span>
              <textarea
                aria-label={`Punto clave ${index + 1}`}
                disabled={disabled}
                maxLength={500}
                placeholder="Escribe una idea esencial…"
                rows={2}
                value={value}
                onChange={(event) =>
                  onChange(values.map((current, position) => position === index ? event.target.value : current))
                }
              />
              <button
                aria-label={`Eliminar punto clave ${index + 1}`}
                disabled={disabled}
                type="button"
                onClick={() => onChange(values.filter((_, position) => position !== index))}
              >
                <Trash size={15} />
              </button>
            </div>
          ))}
          <button className="guide-panel-add" disabled={disabled || values.length >= 30} type="button" onClick={addSelection}>
            <Plus size={15} /> {editor && !editor.state.selection.empty ? "Añadir selección" : "Añadir punto clave"}
          </button>
        </div>
      )}
    </section>
  );
}

function QuizPanel({
  disabled,
  onChange,
  questions,
}: {
  disabled: boolean;
  onChange: (questions: QuizQuestion[]) => void;
  questions: QuizQuestion[];
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [openQuestion, setOpenQuestion] = useState(0);
  const emptyQuestion: QuizQuestion = {
    correctOptionIndex: 0,
    explanation: "",
    options: ["", ""],
    prompt: "",
  };

  function update(index: number, patch: Partial<QuizQuestion>) {
    onChange(questions.map((question, position) => position === index ? { ...question, ...patch } : question));
  }

  function updateOption(questionIndex: number, optionIndex: number, value: string) {
    const question = questions[questionIndex];
    if (!question) return;
    update(questionIndex, {
      options: question.options.map((option, index) => index === optionIndex ? value : option),
    });
  }

  function removeOption(questionIndex: number, optionIndex: number) {
    const question = questions[questionIndex];
    if (!question || question.options.length <= 2) return;
    const options = question.options.filter((_, index) => index !== optionIndex);
    const correctOptionIndex = question.correctOptionIndex === optionIndex
      ? 0
      : question.correctOptionIndex > optionIndex
        ? question.correctOptionIndex - 1
        : question.correctOptionIndex;
    update(questionIndex, { correctOptionIndex, options });
  }

  return (
    <section className={`guide-companion-panel ${collapsed ? "is-collapsed" : ""}`}>
      <header>
        <button type="button" onClick={() => setCollapsed((value) => !value)}>
          <span><Question size={19} /> Cuestionario <small className="guide-count guide-count-quiz">{questions.length}</small></span>
          {collapsed ? <CaretDown size={16} /> : <CaretUp size={16} />}
        </button>
      </header>
      {!collapsed && (
        <div className="guide-companion-body guide-quiz-builder">
          {questions.map((question, questionIndex) => {
            const complete = Boolean(
              question.prompt.trim() &&
              question.options.length >= 2 &&
              question.options.every((option) => option.trim()) &&
              question.correctOptionIndex < question.options.length,
            );
            const open = openQuestion === questionIndex;
            return (
              <article className={`guide-question-answer-card${open ? " is-open" : ""}`} key={questionIndex}>
                <header>
                  <button type="button" onClick={() => setOpenQuestion(open ? -1 : questionIndex)}>
                    {complete ? <CheckCircle size={16} weight="fill" /> : <span>{questionIndex + 1}</span>}
                    <span className="guide-question-answer-title">
                      <small>Pregunta</small>
                      <strong>{question.prompt || `Pregunta ${questionIndex + 1}`}</strong>
                    </span>
                    {open ? <CaretUp size={14} /> : <CaretDown size={14} />}
                  </button>
                  <button
                    aria-label={`Eliminar pregunta ${questionIndex + 1}`}
                    disabled={disabled}
                    type="button"
                    onClick={() => onChange(questions.filter((_, index) => index !== questionIndex))}
                  >
                    <Trash size={14} />
                  </button>
                </header>
                {open && (
                  <div className="guide-quiz-fields guide-question-answer-fields">
                    <label className="guide-question-field">
                      <span>Enunciado</span>
                      <textarea
                        aria-label={`Enunciado de la pregunta ${questionIndex + 1}`}
                        disabled={disabled}
                        maxLength={2000}
                        placeholder="Escribe una pregunta breve y concreta…"
                        rows={2}
                        value={question.prompt}
                        onChange={(event) => update(questionIndex, { prompt: event.target.value })}
                      />
                    </label>
                    <fieldset className="guide-answer-options-field" disabled={disabled}>
                      <legend>Opciones de respuesta</legend>
                      <div className="guide-answer-options">
                        {question.options.map((option, optionIndex) => (
                          <div
                            className={`guide-quiz-option${question.correctOptionIndex === optionIndex ? " is-correct" : ""}`}
                            key={optionIndex}
                          >
                            <input
                              aria-label={`Marcar la opción ${optionIndex + 1} como correcta`}
                              checked={question.correctOptionIndex === optionIndex}
                              name={`guide-question-${questionIndex}-correct-option`}
                              type="radio"
                              onChange={() => update(questionIndex, { correctOptionIndex: optionIndex })}
                            />
                            <span aria-hidden="true" className="guide-option-letter">
                              {String.fromCharCode(65 + optionIndex)}
                            </span>
                            <input
                              aria-label={`Opción ${optionIndex + 1} de la pregunta ${questionIndex + 1}`}
                              maxLength={500}
                              placeholder={`Opción ${String.fromCharCode(65 + optionIndex)}`}
                              type="text"
                              value={option}
                              onChange={(event) => updateOption(questionIndex, optionIndex, event.target.value)}
                            />
                            <button
                              aria-label={`Eliminar opción ${optionIndex + 1}`}
                              disabled={disabled || question.options.length <= 2}
                              title={question.options.length <= 2 ? "Cada pregunta necesita al menos dos opciones" : "Eliminar opción"}
                              type="button"
                              onClick={() => removeOption(questionIndex, optionIndex)}
                            >
                              <Trash size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                      <button
                        className="guide-quiz-inline-add"
                        disabled={disabled || question.options.length >= 8}
                        type="button"
                        onClick={() => update(questionIndex, { options: [...question.options, ""] })}
                      >
                        <Plus size={14} /> Añadir opción
                      </button>
                    </fieldset>
                    <label className="guide-answer-context-field">
                      <span>Explicación <small>(opcional)</small></span>
                      <textarea
                        aria-label={`Explicación de la pregunta ${questionIndex + 1}`}
                        disabled={disabled}
                        maxLength={4000}
                        placeholder="Aclara por qué la respuesta es correcta…"
                        rows={2}
                        value={question.explanation}
                        onChange={(event) => update(questionIndex, { explanation: event.target.value })}
                      />
                    </label>
                  </div>
                )}
              </article>
            );
          })}
          <button
            className="guide-panel-add"
            disabled={disabled || questions.length >= 100}
            type="button"
            onClick={() => {
              onChange([...questions, emptyQuestion]);
              setOpenQuestion(questions.length);
            }}
          >
            <Plus size={15} /> Añadir pregunta
          </button>
        </div>
      )}
    </section>
  );
}

function GuideReaderPreview({
  asset,
  guideDocument,
  keyPoints,
  onReturn,
  questions,
  title,
}: {
  asset?: ContentAsset | null;
  guideDocument: RichTextDocument;
  keyPoints: string[];
  onReturn: () => void;
  questions: QuizQuestion[];
  title: string;
}) {
  return (
    <article className="published-content" aria-label="Vista previa como lector">
      <header className="published-content-header published-rich-guide-header">
        <nav aria-label="Volver al editor" className="published-content-context">
          <IconBackLink
            className="published-content-back"
            href="#editor"
            label="Volver al editor"
            onClick={(event) => {
              event.preventDefault();
              onReturn();
            }}
          />
        </nav>
        <div className="published-guide-title-row">
          <h2>{title || "Guía sin título"}</h2>
        </div>
      </header>
      <PublishedGuideReader
        asset={asset}
        content={{
          document: guideDocument,
          keyPoints,
          linkedVideoId: null,
          quiz: { questions },
          regions: [],
          sections: [],
        }}
      />
    </article>
  );
}

export function GuideEditorScreen({
  asset,
  busy,
  draft,
  editable,
  hasUnsavedChanges,
  isNew,
  notice,
  onDismissNotice,
  onChange,
  onLeave,
  onSave,
  status = "draft",
}: {
  asset?: ContentAsset | null;
  busy: boolean;
  draft: EditableGuideDraft;
  editable: boolean;
  hasUnsavedChanges: boolean;
  isNew: boolean;
  notice: PlatformNotice | null;
  onChange: (draft: EditableGuideDraft) => void;
  onLeave: (discard: boolean) => void;
  onDismissNotice: () => void;
  onSave: () => Promise<boolean>;
  status?: ContentStatus;
}) {
  const router = useRouter();
  const [initialDocument] = useState(() => guideDocument(draft)); // Editor remounts for each selected publication.
  const [documentState, setDocumentState] = useState<RichTextDocument>(initialDocument);
  const [interactionNotice, setInteractionNotice] = useState<PlatformNotice | null>(null);
  const [exitPrompt, setExitPrompt] = useState(false);
  const [preview, setPreview] = useState(false);
  const canEditDocument = editable && status !== "published";
  const [editMode, setEditMode] = useState(() => isNew);
  const [editingTitle, setEditingTitle] = useState(false);
  const [outlineCollapsed, setOutlineCollapsed] = useState(false);
  const [companionsCollapsed, setCompanionsCollapsed] = useState(false);
  const [savingToLeave, setSavingToLeave] = useState(false);
  const [activeOutline, setActiveOutline] = useState(0);
  const [tableControlsPosition, setTableControlsPosition] = useState<TableControlsPosition | null>(null);
  const [tableContextMenu, setTableContextMenu] = useState<TableContextMenuState | null>(null);
  const [mobileDrawer, setMobileDrawer] = useState<MobileEditorDrawer>(null);
  const mobileDrawerActionTimerRef = useRef<number | null>(null);
  useBodyScrollLock(mobileDrawer !== null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const hoveredTableRef = useRef<HTMLTableElement | null>(null);
  const tableContextMenuRef = useRef<HTMLDivElement>(null);
  const exitDialogRef = useRef<HTMLElement>(null);
  const draftRef = useRef(draft);
  const allowNavigationRef = useRef(false);
  const bypassNavigationEventRef = useRef(false);
  const exitPromptOpenRef = useRef(false);
  const fallbackGuardId = useId();
  const fallbackRestoringRef = useRef(false);
  const fallbackReleasingRef = useRef(false);
  const pendingNavigationRef = useRef<PendingNavigationIntent | null>(null);
  const outline = useMemo(() => extractGuideOutline(documentState), [documentState]);
  const numberedOutline = useMemo(() => numberGuideOutline(outline), [outline]);
  const isEditing = canEditDocument && editMode;
  const isEditingRef = useRef(isEditing);
  const releaseFallbackSentinel = useCallback((continuation?: () => void) => {
    const state = historyStateRecord(window.history.state);
    if (state[fallbackGuardStateKey] !== fallbackGuardId || fallbackReleasingRef.current) {
      continuation?.();
      return;
    }

    fallbackReleasingRef.current = true;
    const releasedGuardState = { ...state };
    delete releasedGuardState[fallbackGuardStateKey];
    window.history.replaceState(releasedGuardState, "", window.location.href);
    window.addEventListener(
      "popstate",
      () => {
        fallbackReleasingRef.current = false;
        const releasedState = historyStateRecord(window.history.state);
        if (releasedState[fallbackBaseStateKey] === fallbackGuardId) {
          delete releasedState[fallbackBaseStateKey];
          window.history.replaceState(releasedState, "", window.location.href);
        }
        continuation?.();
      },
      { once: true },
    );
    window.history.back();
  }, [fallbackGuardId]);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    isEditingRef.current = isEditing;
  }, [isEditing]);

  useEffect(() => {
    // The editor replaces the publication form without a route navigation.
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({ link: false, underline: false }),
      Underline,
      Highlight.configure({ multicolor: false }),
      Link.configure({ autolink: false, defaultProtocol: "https", openOnClick: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TableKit,
      Image.configure({ allowBase64: false }),
      Placeholder.configure({
        placeholder: "Pega aquí el contenido de tu guía en texto plano o comienza a escribir…",
      }),
    ],
    content: initialDocument as JSONContent,
    editorProps: {
      attributes: {
        "aria-label": "Contenido de la guía",
        class: "guide-editor-prosemirror",
      },
      handleKeyDown(view, event) {
        if (event.key !== "Backspace" && event.key !== "Delete") return false;
        const selection = view.state.selection;
        if (!(selection instanceof CellSelection)) return false;

        if (selection.isRowSelection() && selection.isColSelection()) {
          return deleteSelectedTable(view.state, view.dispatch);
        }
        if (selection.isRowSelection()) {
          return deleteSelectedRows(view.state, view.dispatch);
        }
        if (selection.isColSelection()) {
          return deleteSelectedColumns(view.state, view.dispatch);
        }
        return false;
      },
    },
    onUpdate({ editor: currentEditor }) {
      if (!isEditingRef.current) return;
      const parsed = RichTextDocumentSchema.safeParse(sanitizeEditorJson(currentEditor.getJSON()));
      if (!parsed.success) return;
      setDocumentState(parsed.data);
      const currentDraft = draftRef.current;
      let next = withDocument(currentDraft, parsed.data);
      if (currentDraft.kind === "guide") {
        const summary = summaryFromText(richTextDocumentToPlainText(parsed.data));
        next = { ...next, summary } as EditableGuideDraft;
      }
      onChange(next);
    },
  });

  useEffect(() => {
    editor?.setEditable(isEditing && !preview);
  }, [editor, isEditing, preview]);

  useEffect(() => {
    if (!tableContextMenu) return;
    const frame = window.requestAnimationFrame(() => {
      tableContextMenuRef.current
        ?.querySelector<HTMLButtonElement>("button:not([disabled])")
        ?.focus({ preventScroll: true });
    });
    const closeOnPointerDown = (event: MouseEvent) => {
      if (
        event.target instanceof Node &&
        !tableContextMenuRef.current?.contains(event.target)
      ) setTableContextMenu(null);
    };
    const closeOnKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTableContextMenu(null);
    };
    const close = () => setTableContextMenu(null);

    document.addEventListener("mousedown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnKeyDown);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, { capture: true, passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("mousedown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnKeyDown);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [tableContextMenu]);

  useEffect(() => {
    if (!mobileDrawer) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileDrawer(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [mobileDrawer]);

  useEffect(() => () => {
    if (mobileDrawerActionTimerRef.current !== null) {
      window.clearTimeout(mobileDrawerActionTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (allowNavigationRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const interceptNavigation = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) return;

      const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!target || target.download || target.target === "_blank") return;

      const next = new URL(target.href, window.location.href);
      const current = new URL(window.location.href);
      if (next.protocol !== "http:" && next.protocol !== "https:") return;
      if (
        next.origin === current.origin &&
        next.pathname === current.pathname &&
        next.search === current.search
      ) return;

      event.preventDefault();
      openExitPrompt({ href: next.href, kind: "href" });
    };

    document.addEventListener("click", interceptNavigation, true);
    return () => document.removeEventListener("click", interceptNavigation, true);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const navigation = getBrowserNavigation();
    if (!navigation) return;

    const interceptHistoryNavigation = (rawEvent: Event) => {
      const event = rawEvent as BrowserNavigateEvent;
      if (event.navigationType === "traverse") return;
      if (allowNavigationRef.current || bypassNavigationEventRef.current) {
        bypassNavigationEventRef.current = false;
        return;
      }
      if (
        Boolean(event.downloadRequest) ||
        event.hashChange ||
        event.navigationType === "reload" ||
        !event.destination.url ||
        event.destination.url === window.location.href
      ) return;

      if (!event.cancelable) return;

      event.preventDefault();
      if (exitPromptOpenRef.current) return;
      openExitPrompt({ href: event.destination.url, kind: "href" });
    };

    navigation.addEventListener("navigate", interceptHistoryNavigation);
    return () => navigation.removeEventListener("navigate", interceptHistoryNavigation);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const currentState = historyStateRecord(window.history.state);
    if (currentState[fallbackGuardStateKey] !== fallbackGuardId) {
      if (window.history.length <= 1) return;
      const baseState: Record<string, unknown> = { ...currentState, [fallbackBaseStateKey]: fallbackGuardId };
      delete baseState[fallbackGuardStateKey];
      const guardState: Record<string, unknown> = { ...currentState, [fallbackGuardStateKey]: fallbackGuardId };
      delete guardState[fallbackBaseStateKey];
      window.history.replaceState(baseState, "", window.location.href);
      window.history.pushState(guardState, "", window.location.href);
    }

    const interceptFallbackBack = (event: PopStateEvent) => {
      if (fallbackReleasingRef.current || allowNavigationRef.current) return;
      if (fallbackRestoringRef.current) {
        fallbackRestoringRef.current = false;
        openExitPrompt({ kind: "fallback-back" });
        return;
      }

      const state = historyStateRecord(event.state);
      if (state[fallbackBaseStateKey] !== fallbackGuardId) return;

      fallbackRestoringRef.current = true;
      window.history.forward();
    };

    window.addEventListener("popstate", interceptFallbackBack);
    return () => window.removeEventListener("popstate", interceptFallbackBack);
  }, [fallbackGuardId, hasUnsavedChanges]);

  useEffect(() => {
    if (hasUnsavedChanges || exitPromptOpenRef.current) return;
    releaseFallbackSentinel();
  }, [hasUnsavedChanges, releaseFallbackSentinel]);

  useEffect(() => {
    if (!exitPrompt) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = exitDialogRef.current;
    const focusable = dialog?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable?.[0];
    const last = focusable?.[focusable.length - 1];
    first?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !savingToLeave && !busy) {
        event.preventDefault();
        closeExitPrompt();
        return;
      }
      if (event.key !== "Tab" || !first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [busy, exitPrompt, savingToLeave]);

  function openExitPrompt(intent: PendingNavigationIntent) {
    if (exitPromptOpenRef.current) return;
    pendingNavigationRef.current = intent;
    exitPromptOpenRef.current = true;
    setExitPrompt(true);
  }

  function closeExitPrompt() {
    pendingNavigationRef.current = null;
    exitPromptOpenRef.current = false;
    setExitPrompt(false);
  }

  function finishLeaving(discard: boolean) {
    const intent = pendingNavigationRef.current ?? { kind: "panel" };
    pendingNavigationRef.current = null;
    exitPromptOpenRef.current = false;
    setExitPrompt(false);

    if (intent.kind === "fallback-back") {
      releaseFallbackSentinel(() => {
        allowNavigationRef.current = true;
        window.history.back();
      });
      return;
    }

    releaseFallbackSentinel(() => {
      if (intent.kind === "panel") {
        onLeave(discard);
        return;
      }

      const target = new URL(intent.href, window.location.href);
      const targetsCurrentRoute =
        target.origin === window.location.origin &&
        target.pathname === window.location.pathname &&
        target.search === window.location.search;

      if (targetsCurrentRoute) {
        onLeave(discard);
      } else if (target.origin === window.location.origin) {
        allowNavigationRef.current = true;
        bypassNavigationEventRef.current = true;
        router.push(`${target.pathname}${target.search}${target.hash}`);
      } else {
        allowNavigationRef.current = true;
        window.location.assign(target.href);
      }
    });
  }

  function requestLeave() {
    if (hasUnsavedChanges) {
      openExitPrompt({ kind: "panel" });
    }
    else onLeave(isNew && draft.kind === "guide");
  }

  async function saveAndLeave() {
    setSavingToLeave(true);
    const saved = await onSave();
    setSavingToLeave(false);
    if (saved) finishLeaving(false);
    else closeExitPrompt();
  }

  function setLink() {
    if (!editor) return;
    const previous = editor.getAttributes("link").href as string | undefined;
    const requested = window.prompt("Dirección HTTPS del enlace", previous ?? "https://");
    if (requested === null) return;
    if (!requested.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    try {
      const value = new URL(requested.startsWith("http") ? requested : `https://${requested}`);
      if (value.protocol !== "https:") throw new Error("invalid");
      editor.chain().focus().extendMarkRange("link").setLink({ href: value.toString() }).run();
    } catch {
      window.alert("Usa una dirección web segura que comience por https://");
    }
  }

  function addImage() {
    if (!editor) return;
    const requested = window.prompt("Dirección HTTPS de la imagen", "https://");
    if (!requested) return;
    try {
      const value = new URL(requested);
      if (value.protocol !== "https:") throw new Error("invalid");
      const alt = window.prompt("Descripción breve de la imagen para accesibilidad", "") ?? "";
      editor.chain().focus().setImage({ src: value.toString(), alt }).run();
    } catch {
      window.alert("Usa una dirección de imagen segura que comience por https://");
    }
  }

  function addCallout(kind: "key" | "clinical") {
    if (!editor) return;
    const label = kind === "key" ? "PUNTO CLAVE — " : "RELACIÓN CLÍNICA — ";
    const selected = editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, " ").trim();
    editor.chain().focus().insertContent({
      type: "blockquote",
      content: [{ type: "paragraph", content: [{ type: "text", text: label + selected }] }],
    }).run();
  }

  function handlePlainPaste(event: ReactClipboardEvent<HTMLDivElement>) {
    if (!editor || !isEditing || preview) return;
    const text = event.clipboardData.getData("text/plain");
    const html = event.clipboardData.getData("text/html");
    if (!text && !html) return;
    event.preventDefault();
    event.stopPropagation();
    editor.chain().focus().insertContent(pastedContent(text, html)).run();
  }

  function handleTableContextMenu(event: ReactMouseEvent<HTMLDivElement>) {
    if (!editor || !isEditing || preview) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const cell = target.closest("td, th");
    const table = cell?.closest("table");
    if (!(cell instanceof HTMLTableCellElement) || !(table instanceof HTMLTableElement)) return;

    event.preventDefault();
    event.stopPropagation();
    try {
      const position = editor.view.posAtDOM(cell, 0) + 1;
      editor.chain().focus().setTextSelection(position).run();
      hoveredTableRef.current = table;
      setTableControlsPosition(null);
      setTableContextMenu({
        left: Math.max(12, Math.min(event.clientX, window.innerWidth - 252)),
        position,
        top: Math.max(12, Math.min(event.clientY, window.innerHeight - 390)),
      });
    } catch {
      setTableContextMenu(null);
    }
  }

  function runTableContextAction(action: TableContextAction) {
    if (!editor || !tableContextMenu) return;
    const chain = editor.chain().focus().setTextSelection(tableContextMenu.position);
    if (action === "add-column-after") chain.addColumnAfter().run();
    else if (action === "add-column-before") chain.addColumnBefore().run();
    else if (action === "add-row-after") chain.addRowAfter().run();
    else if (action === "add-row-before") chain.addRowBefore().run();
    else if (action === "delete-column") chain.deleteColumn().run();
    else if (action === "delete-row") chain.deleteRow().run();
    else if (action === "toggle-header-row") chain.toggleHeaderRow().run();
    else chain.deleteTable().run();
    setTableContextMenu(null);
    setTableControlsPosition(null);
  }

  function handleTablePointerMove(event: ReactMouseEvent<HTMLDivElement>) {
    if (!isEditing || preview || !canvasRef.current) return;
    const pointerTarget = event.target;
    if (!(pointerTarget instanceof Element)) return;
    if (pointerTarget.closest(".guide-table-edge-controls")) return;

    const table = pointerTarget.closest("table");
    if (!(table instanceof HTMLTableElement)) {
      hoveredTableRef.current = null;
      setTableControlsPosition(null);
      return;
    }

    hoveredTableRef.current = table;
    const tableRect = table.getBoundingClientRect();
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const showColumn = tableRect.right - event.clientX <= 52;
    const showRow = tableRect.bottom - event.clientY <= 44;
    if (!showColumn && !showRow) {
      setTableControlsPosition(null);
      return;
    }
    const next = {
      bottom: Math.round(tableRect.bottom - canvasRect.top),
      left: Math.round(tableRect.left - canvasRect.left + tableRect.width / 2),
      right: Math.round(tableRect.right - canvasRect.left),
      showColumn,
      showRow,
      top: Math.round(tableRect.top - canvasRect.top + tableRect.height / 2),
    };
    setTableControlsPosition((current) =>
      current &&
      current.bottom === next.bottom &&
      current.left === next.left &&
      current.right === next.right &&
      current.showColumn === next.showColumn &&
      current.showRow === next.showRow &&
      current.top === next.top
        ? current
        : next,
    );
  }

  function changeTablePart(kind: "column" | "row", action: "add" | "delete") {
    if (!editor || !hoveredTableRef.current) return;
    const rows = Array.from(hoveredTableRef.current.rows);
    const cell = kind === "column"
      ? rows[0]?.cells[rows[0].cells.length - 1]
      : rows[rows.length - 1]?.cells[0];
    if (!cell) return;

    try {
      const position = editor.view.posAtDOM(cell, 0) + 1;
      const chain = editor.chain().focus().setTextSelection(position);
      if (kind === "column" && action === "add") chain.addColumnAfter().run();
      else if (kind === "column") chain.deleteColumn().run();
      else if (action === "add") chain.addRowAfter().run();
      else chain.deleteRow().run();
    } catch {
      // The table may have been removed between pointer movement and click.
    }
  }

  function runAfterClosingMobileDrawer(action: () => void) {
    if (!mobileDrawer) {
      action();
      return;
    }
    setMobileDrawer(null);
    if (mobileDrawerActionTimerRef.current !== null) window.clearTimeout(mobileDrawerActionTimerRef.current);
    // Let the body-scroll lock restore its saved position before navigating.
    mobileDrawerActionTimerRef.current = window.setTimeout(() => {
      mobileDrawerActionTimerRef.current = null;
      window.requestAnimationFrame(action);
    }, 80);
  }

  const disabled = !isEditing || busy || preview || !editor;

  return (
    <div className="guide-editor-page">
      {!preview && <header className="guide-editor-heading">
        <button aria-label="Volver a publicaciones" className="guide-editor-back" title="Volver a publicaciones" type="button" onClick={requestLeave}>
          <ArrowLeft size={18} />
        </button>
        <div className="guide-editor-title-block">
          {draft.kind === "guide" ? (
            editingTitle ? (
              <input
                aria-label="Título de la guía"
                autoFocus
                disabled={!isEditing || busy}
                maxLength={200}
                placeholder="Título de la guía"
                value={draft.title}
                onBlur={() => setEditingTitle(false)}
                onChange={(event) => {
                  const title = event.target.value;
                  onChange({ ...draft, slug: isNew ? slugify(title) : draft.slug, title });
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === "Escape") {
                    event.preventDefault();
                    setEditingTitle(false);
                  }
                }}
              />
            ) : (
              <button
                aria-label="Cambiar título de la guía"
                className="guide-editor-title-trigger"
                disabled={!isEditing || busy}
                type="button"
                onClick={() => setEditingTitle(true)}
              >
                {draft.title || "Título de la guía"}
              </button>
            )
          ) : (
            <h2>Guía de {draft.title || "nuevo video"}</h2>
          )}
          <small>
            <span className={`guide-editor-status guide-editor-status-${status}`}>{statusLabels[status]}</span>
            {hasUnsavedChanges ? "Cambios sin guardar" : "Todo guardado"}
          </small>
        </div>
        <div className="guide-editor-heading-actions">
          {!preview && (
            <button
              aria-label={isEditing ? "Editando la guía" : "Editar la guía"}
              aria-pressed={isEditing}
              className={isEditing ? "is-active" : ""}
              disabled={busy}
              title={
                canEditDocument
                  ? "Editar guía"
                  : status === "published"
                    ? "Archiva la guía antes de editarla"
                    : "No tienes permisos para editar esta guía"
              }
              type="button"
              onClick={() => {
                if (!canEditDocument) {
                  setInteractionNotice({
                      text: status === "published"
                      ? "No puedes editar el documento mientras la guía está publicada. Para solucionarlo, vuelve al panel, archívala y abre el editor de nuevo."
                      : "No puedes editar esta guía con los permisos actuales. Para solucionarlo, pide a coordinación o administración que te asigne acceso de edición.",
                    tone: "warning",
                  });
                  return;
                }
                setInteractionNotice(null);
                setEditMode(true);
                editor?.setEditable(true);
                window.requestAnimationFrame(() => editor?.commands.focus("end"));
              }}
            >
              <NotePencil size={17} /> <span>{isEditing ? "Editando" : "Editar"}</span>
            </button>
          )}
          {isEditing && (
            <button
              aria-label="Guardar guía"
              className="guide-editor-save"
              disabled={busy || !hasUnsavedChanges}
              title="Guardar guía"
              type="button"
              onClick={() => void onSave()}
            >
              {busy ? <span className="guide-editor-saving" /> : <Check size={17} weight="bold" />}
              {busy ? "Guardando…" : "Guardar"}
            </button>
          )}
          <button
            aria-label={preview ? "Volver al editor" : "Vista previa de lector"}
            className={preview ? "is-active" : ""}
            title={preview ? "Volver al editor" : "Vista previa"}
            type="button"
            onClick={() => {
              setMobileDrawer(null);
              setTableContextMenu(null);
              setPreview((value) => !value);
            }}
          >
            <Eye size={17} /> <span>{preview ? "Seguir editando" : "Vista previa"}</span>
          </button>
        </div>
      </header>}

      {!preview && isEditing && <div className="guide-format-toolbar" aria-label="Formato del texto" role="toolbar">
        <div className="guide-toolbar-group">
          <ToolbarButton disabled={disabled || !editor?.can().undo()} label="Deshacer" onClick={() => editor?.chain().focus().undo().run()}><ArrowUUpLeft size={18} /></ToolbarButton>
          <ToolbarButton disabled={disabled || !editor?.can().redo()} label="Rehacer" onClick={() => editor?.chain().focus().redo().run()}><ArrowUDownLeft size={18} /></ToolbarButton>
        </div>
        <label className="guide-style-select">
          <Paragraph size={17} />
          <select
            aria-label="Estilo de párrafo"
            disabled={disabled}
            value={editor?.isActive("heading", { level: 1 }) ? "h1" : editor?.isActive("heading", { level: 2 }) ? "h2" : editor?.isActive("heading", { level: 3 }) ? "h3" : "p"}
            onChange={(event) => {
              const value = event.target.value;
              if (value === "p") editor?.chain().focus().setParagraph().run();
              else editor?.chain().focus().toggleHeading({ level: Number(value.slice(1)) as 1 | 2 | 3 }).run();
            }}
          >
            <option value="p">Párrafo</option>
            <option value="h1">Título 1</option>
            <option value="h2">Título 2</option>
            <option value="h3">Título 3</option>
          </select>
        </label>
        <div className="guide-toolbar-group">
          <ToolbarButton active={Boolean(editor?.isActive("bold"))} disabled={disabled} label="Negrita" onClick={() => editor?.chain().focus().toggleBold().run()}><TextB size={18} weight="bold" /></ToolbarButton>
          <ToolbarButton active={Boolean(editor?.isActive("italic"))} disabled={disabled} label="Cursiva" onClick={() => editor?.chain().focus().toggleItalic().run()}><TextItalic size={18} /></ToolbarButton>
          <ToolbarButton active={Boolean(editor?.isActive("underline"))} disabled={disabled} label="Subrayado" onClick={() => editor?.chain().focus().toggleUnderline().run()}><TextUnderline size={18} /></ToolbarButton>
          <ToolbarButton active={Boolean(editor?.isActive("strike"))} disabled={disabled} label="Tachado" onClick={() => editor?.chain().focus().toggleStrike().run()}><TextStrikethrough size={18} /></ToolbarButton>
          <ToolbarButton active={Boolean(editor?.isActive("highlight"))} disabled={disabled} label="Resaltar" onClick={() => editor?.chain().focus().toggleHighlight().run()}><HighlighterCircle size={18} /></ToolbarButton>
        </div>
        <div className="guide-toolbar-group">
          <ToolbarButton active={Boolean(editor?.isActive("bulletList"))} disabled={disabled} label="Lista con viñetas" onClick={() => editor?.chain().focus().toggleBulletList().run()}><ListBullets size={18} /></ToolbarButton>
          <ToolbarButton active={Boolean(editor?.isActive("orderedList"))} disabled={disabled} label="Lista numerada" onClick={() => editor?.chain().focus().toggleOrderedList().run()}><ListNumbers size={18} /></ToolbarButton>
          <ToolbarButton active={Boolean(editor?.isActive("table"))} disabled={disabled} label="Insertar tabla" onClick={() => editor?.chain().focus().insertTable({ cols: 3, rows: 2, withHeaderRow: true }).run()}><TableIcon size={18} /></ToolbarButton>
          <ToolbarButton active={Boolean(editor?.isActive({ textAlign: "left" }))} disabled={disabled} label="Alinear a la izquierda" onClick={() => editor?.chain().focus().setTextAlign("left").run()}><TextAlignLeft size={18} /></ToolbarButton>
          <ToolbarButton active={Boolean(editor?.isActive({ textAlign: "center" }))} disabled={disabled} label="Centrar" onClick={() => editor?.chain().focus().setTextAlign("center").run()}><TextAlignCenter size={18} /></ToolbarButton>
          <ToolbarButton active={Boolean(editor?.isActive({ textAlign: "right" }))} disabled={disabled} label="Alinear a la derecha" onClick={() => editor?.chain().focus().setTextAlign("right").run()}><TextAlignRight size={18} /></ToolbarButton>
        </div>
        {editor?.isActive("table") && (
          <div className="guide-toolbar-group guide-table-toolbar-group" aria-label="Editar tabla">
            <ToolbarButton disabled={disabled || !editor.can().addRowAfter()} label="Añadir fila" onClick={() => editor.chain().focus().addRowAfter().run()}><Plus size={17} /><span>Fila</span></ToolbarButton>
            <ToolbarButton disabled={disabled || !editor.can().deleteRow()} label="Eliminar fila" onClick={() => editor.chain().focus().deleteRow().run()}><Trash size={16} /><span>Fila</span></ToolbarButton>
            <ToolbarButton disabled={disabled || !editor.can().addColumnAfter()} label="Añadir columna" onClick={() => editor.chain().focus().addColumnAfter().run()}><Plus size={17} /><span>Col.</span></ToolbarButton>
            <ToolbarButton disabled={disabled || !editor.can().deleteColumn()} label="Eliminar columna" onClick={() => editor.chain().focus().deleteColumn().run()}><Trash size={16} /><span>Col.</span></ToolbarButton>
            <ToolbarButton disabled={disabled || !editor.can().deleteTable()} label="Eliminar tabla" onClick={() => editor.chain().focus().deleteTable().run()}><Trash size={17} /><span>Tabla</span></ToolbarButton>
          </div>
        )}
        <div className="guide-toolbar-group">
          <ToolbarButton active={Boolean(editor?.isActive("link"))} disabled={disabled} label="Añadir enlace" onClick={setLink}><LinkSimple size={18} /></ToolbarButton>
          <ToolbarButton disabled={disabled} label="Insertar imagen mediante URL" onClick={addImage}><ImageSquare size={18} /></ToolbarButton>
          <ToolbarButton disabled={disabled} label="Añadir separador" onClick={() => editor?.chain().focus().setHorizontalRule().run()}><Minus size={18} /></ToolbarButton>
          <ToolbarButton disabled={disabled} label="Insertar punto clave" onClick={() => addCallout("key")}><HighlighterCircle size={18} /></ToolbarButton>
          <ToolbarButton disabled={disabled} label="Insertar relación clínica" onClick={() => addCallout("clinical")}><Quotes size={18} /></ToolbarButton>
        </div>
      </div>}

      {editor && isEditing && !preview && (
        <BubbleMenu
          className="guide-selection-toolbar"
          editor={editor}
          shouldShow={showBubbleMenuForSelection}
        >
          <ToolbarButton active={editor.isActive("bold")} label="Negrita" onClick={() => editor.chain().focus().toggleBold().run()}><TextB size={17} weight="bold" /></ToolbarButton>
          <ToolbarButton active={editor.isActive("italic")} label="Cursiva" onClick={() => editor.chain().focus().toggleItalic().run()}><TextItalic size={17} /></ToolbarButton>
          <span aria-hidden="true" />
          <ToolbarButton active={editor.isActive("bulletList")} label="Lista con viñetas" onClick={() => editor.chain().focus().toggleBulletList().run()}><ListBullets size={17} /></ToolbarButton>
          <ToolbarButton active={editor.isActive("orderedList")} label="Lista numerada" onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListNumbers size={17} /></ToolbarButton>
          <span aria-hidden="true" />
          <ToolbarButton active={editor.isActive({ textAlign: "left" })} label="Alinear a la izquierda" onClick={() => editor.chain().focus().setTextAlign("left").run()}><TextAlignLeft size={17} /></ToolbarButton>
          <ToolbarButton active={editor.isActive({ textAlign: "center" })} label="Centrar" onClick={() => editor.chain().focus().setTextAlign("center").run()}><TextAlignCenter size={17} /></ToolbarButton>
          <ToolbarButton active={editor.isActive({ textAlign: "right" })} label="Alinear a la derecha" onClick={() => editor.chain().focus().setTextAlign("right").run()}><TextAlignRight size={17} /></ToolbarButton>
        </BubbleMenu>
      )}

      <PlatformToast
        notice={interactionNotice ?? notice}
        onDismiss={() => {
          if (interactionNotice) setInteractionNotice(null);
          else onDismissNotice();
        }}
      />

      {preview ? (
        <GuideReaderPreview
          asset={asset}
          guideDocument={documentState}
          onReturn={() => setPreview(false)}
          questions={guideQuestions(draft)}
          title={draft.title}
          keyPoints={guideKeyPoints(draft)}
        />
      ) : (
        <>
          <div className="guide-editor-mobile-sidebar-controls" aria-label="Paneles laterales del editor">
            <button
              aria-controls="guide-editor-outline-content"
              aria-expanded={mobileDrawer === "outline"}
              type="button"
              onClick={() => setMobileDrawer((current) => current === "outline" ? null : "outline")}
            >
              <ListBullets aria-hidden="true" size={18} />
              <span>Índice</span>
              <small>{outline.length}</small>
            </button>
            <button
              aria-controls="guide-editor-companions-content"
              aria-expanded={mobileDrawer === "companions"}
              type="button"
              onClick={() => setMobileDrawer((current) => current === "companions" ? null : "companions")}
            >
              <HighlighterCircle aria-hidden="true" size={18} />
              <span>Complementos</span>
              <small>{guideKeyPoints(draft).length + guideQuestions(draft).length}</small>
            </button>
          </div>
          {mobileDrawer && (
            <button
              aria-label="Cerrar panel lateral"
              className="guide-editor-mobile-drawer-backdrop"
              type="button"
              onClick={() => setMobileDrawer(null)}
            />
          )}
          <div
            className={`guide-editor-workspace${outlineCollapsed ? " is-outline-collapsed" : ""}${companionsCollapsed ? " is-companions-collapsed" : ""}${isEditing ? "" : " is-view-mode"}`}
          >
          <aside className={`guide-editor-outline${outlineCollapsed && mobileDrawer !== "outline" ? " is-collapsed" : ""}${mobileDrawer === "outline" ? " is-mobile-open" : ""}`} aria-label="Índice de la guía">
            <header>
              <button
                aria-controls="guide-editor-outline-content"
                aria-expanded={mobileDrawer === "outline" || !outlineCollapsed}
                aria-label={mobileDrawer === "outline" || !outlineCollapsed ? "Contraer índice de la guía" : "Expandir índice de la guía"}
                type="button"
                onClick={() => {
                  if (mobileDrawer === "outline") setMobileDrawer(null);
                  else setOutlineCollapsed((value) => !value);
                }}
              >
                <ListBullets aria-hidden="true" size={17} />
                <strong>Índice de la guía</strong>
                <small>{outline.length}</small>
              </button>
            </header>
            {(!outlineCollapsed || mobileDrawer === "outline") && (
              <div className="guide-editor-outline-content" id="guide-editor-outline-content">
                <ol>
                  {numberedOutline.map((entry, index) => (
                    <li className={`level-${entry.displayLevel} ${activeOutline === index ? "is-active" : ""}`} key={`${entry.id}-${index}`}>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveOutline(index);
                          setOutlineCollapsed(true);
                          runAfterClosingMobileDrawer(() => {
                            const headings = canvasRef.current?.querySelectorAll(".ProseMirror h1, .ProseMirror h2, .ProseMirror h3");
                            headings?.[index]?.scrollIntoView({ behavior: "smooth", block: "center" });
                          });
                        }}
                      >
                        <span className="guide-outline-number">{entry.number}</span>
                        {entry.label}
                      </button>
                    </li>
                  ))}
                </ol>
                {outline.length === 0 && <p>Los títulos que añadas aparecerán aquí automáticamente.</p>}
                <button
                  className="guide-outline-add"
                  disabled={disabled}
                  type="button"
                  onClick={() => editor?.chain().focus().insertContent([
                    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Nueva sección" }] },
                    { type: "paragraph" },
                  ]).run()}
                >
                  <Plus size={16} /> Nueva sección
                </button>
              </div>
            )}
          </aside>

          <main
            className="guide-editor-canvas"
            ref={canvasRef}
            onMouseLeave={() => {
              hoveredTableRef.current = null;
              setTableControlsPosition(null);
            }}
            onContextMenu={handleTableContextMenu}
            onMouseMove={handleTablePointerMove}
          >
            <div className="guide-editor-canvas-label">
              <span><TableIcon aria-hidden="true" size={15} /> Pega una tabla o escribe Markdown: el contenido seguirá siendo editable.</span>
            </div>
            <div onPasteCapture={handlePlainPaste}>
              <EditorContent editor={editor} />
            </div>
            {tableControlsPosition && isEditing && (
              <div className="guide-table-edge-controls" aria-label="Controles rápidos de tabla" role="toolbar">
                {tableControlsPosition.showColumn && (
                  <>
                    <button
                      aria-label="Añadir columna a la derecha"
                      className="is-column"
                      style={{ left: tableControlsPosition.right, top: tableControlsPosition.top - 17 }}
                      title="Añadir columna"
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => changeTablePart("column", "add")}
                    >
                      <Plus aria-hidden="true" size={14} /> <span>Columna</span>
                    </button>
                    <button
                      aria-label="Eliminar última columna"
                      className="is-column is-delete"
                      style={{ left: tableControlsPosition.right, top: tableControlsPosition.top + 17 }}
                      title="Eliminar última columna"
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => changeTablePart("column", "delete")}
                    >
                      <Trash aria-hidden="true" size={13} /> <span>Columna</span>
                    </button>
                  </>
                )}
                {tableControlsPosition.showRow && (
                  <>
                    <button
                      aria-label="Añadir fila debajo"
                      className="is-row"
                      style={{ left: tableControlsPosition.left - 42, top: tableControlsPosition.bottom }}
                      title="Añadir fila"
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => changeTablePart("row", "add")}
                    >
                      <Plus aria-hidden="true" size={14} /> <span>Fila</span>
                    </button>
                    <button
                      aria-label="Eliminar última fila"
                      className="is-row is-delete"
                      style={{ left: tableControlsPosition.left + 42, top: tableControlsPosition.bottom }}
                      title="Eliminar última fila"
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => changeTablePart("row", "delete")}
                    >
                      <Trash aria-hidden="true" size={13} /> <span>Fila</span>
                    </button>
                  </>
                )}
              </div>
            )}
            {tableContextMenu && isEditing && (
              <div
                aria-label="Opciones de tabla"
                className="guide-table-context-menu"
                ref={tableContextMenuRef}
                role="menu"
                style={{ left: tableContextMenu.left, top: tableContextMenu.top }}
              >
                <header>
                  <TableIcon aria-hidden="true" size={17} />
                  <span>
                    <strong>Opciones de tabla</strong>
                    <small>Aplica cambios desde la celda seleccionada</small>
                  </span>
                </header>
                <div role="group" aria-label="Filas">
                  <button disabled={disabled || !editor?.can().addRowBefore()} role="menuitem" type="button" onClick={() => runTableContextAction("add-row-before")}>
                    <Plus aria-hidden="true" size={15} /> Añadir fila arriba
                  </button>
                  <button disabled={disabled || !editor?.can().addRowAfter()} role="menuitem" type="button" onClick={() => runTableContextAction("add-row-after")}>
                    <Plus aria-hidden="true" size={15} /> Añadir fila debajo
                  </button>
                  <button disabled={disabled || !editor?.can().deleteRow()} role="menuitem" type="button" onClick={() => runTableContextAction("delete-row")}>
                    <Trash aria-hidden="true" size={15} /> Eliminar fila
                  </button>
                </div>
                <div role="group" aria-label="Columnas">
                  <button disabled={disabled || !editor?.can().addColumnBefore()} role="menuitem" type="button" onClick={() => runTableContextAction("add-column-before")}>
                    <Plus aria-hidden="true" size={15} /> Añadir columna a la izquierda
                  </button>
                  <button disabled={disabled || !editor?.can().addColumnAfter()} role="menuitem" type="button" onClick={() => runTableContextAction("add-column-after")}>
                    <Plus aria-hidden="true" size={15} /> Añadir columna a la derecha
                  </button>
                  <button disabled={disabled || !editor?.can().deleteColumn()} role="menuitem" type="button" onClick={() => runTableContextAction("delete-column")}>
                    <Trash aria-hidden="true" size={15} /> Eliminar columna
                  </button>
                </div>
                <div role="group" aria-label="Tabla">
                  <button disabled={disabled || !editor?.can().toggleHeaderRow()} role="menuitem" type="button" onClick={() => runTableContextAction("toggle-header-row")}>
                    <Check aria-hidden="true" size={15} /> Alternar fila de encabezado
                  </button>
                  <button className="is-danger" disabled={disabled || !editor?.can().deleteTable()} role="menuitem" type="button" onClick={() => runTableContextAction("delete-table")}>
                    <Trash aria-hidden="true" size={15} /> Eliminar tabla
                  </button>
                </div>
              </div>
            )}
          </main>

          <aside className={`guide-editor-companions${companionsCollapsed && mobileDrawer !== "companions" ? " is-collapsed" : ""}${mobileDrawer === "companions" ? " is-mobile-open" : ""}`} aria-label="Complementos de la guía">
            <section className={`guide-companions-container${companionsCollapsed && mobileDrawer !== "companions" ? " is-collapsed" : ""}`}>
              <header>
                <button
                  aria-controls="guide-editor-companions-content"
                  aria-expanded={mobileDrawer === "companions" || !companionsCollapsed}
                  aria-label={mobileDrawer === "companions" || !companionsCollapsed ? "Contraer complementos de la guía" : "Expandir complementos de la guía"}
                  type="button"
                  onClick={() => {
                    if (mobileDrawer === "companions") setMobileDrawer(null);
                    else setCompanionsCollapsed((value) => !value);
                  }}
                >
                  <HighlighterCircle aria-hidden="true" size={17} />
                  <span>Complementos de la guía</span>
                </button>
              </header>
              {(!companionsCollapsed || mobileDrawer === "companions") && (
                <div className="guide-editor-companions-content" id="guide-editor-companions-content">
                  <KeyPointsPanel
                    disabled={!isEditing || busy}
                    editor={editor}
                    values={guideKeyPoints(draft)}
                    onChange={(values) => onChange(withKeyPoints(draft, values))}
                  />
                  <QuizPanel
                    disabled={!isEditing || busy}
                    questions={guideQuestions(draft)}
                    onChange={(questions) => onChange(withQuestions(draft, questions))}
                  />
                </div>
              )}
            </section>
          </aside>
        </div>
        </>
      )}

      {exitPrompt && (
        <div className="guide-exit-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !savingToLeave && !busy) closeExitPrompt();
        }}>
          <section
            aria-describedby="guide-exit-description"
            aria-labelledby="guide-exit-title"
            aria-modal="true"
            className="guide-exit-dialog"
            ref={exitDialogRef}
            role="dialog"
          >
            <span className="guide-exit-icon"><NotePencil size={24} /></span>
            <h3 id="guide-exit-title">¿Quieres guardar tu progreso?</h3>
            <p id="guide-exit-description">Hay cambios en la guía que todavía no se han guardado.</p>
            <div>
              <button disabled={savingToLeave || busy} type="button" onClick={closeExitPrompt}>Seguir editando</button>
              <button disabled={savingToLeave || busy} type="button" onClick={() => finishLeaving(true)}>Volver sin guardar</button>
              <button className="is-primary" disabled={savingToLeave || busy} type="button" onClick={() => void saveAndLeave()}>
                {savingToLeave ? "Guardando…" : "Guardar y volver"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
