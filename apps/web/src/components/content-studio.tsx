"use client";

import type { ChangeEvent, FormEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CaretLeft,
  CaretRight,
  CardsThree,
  Check,
  CheckCircle,
  CloudArrowUp,
  Compass,
  FileVideo,
  MagnifyingGlass,
  NotePencil,
  Notebook,
  PlayCircle,
  Plus,
  Question,
  Trash,
  X,
} from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import {
  ContentItemSchema,
  type ContentAssetUploadResponse,
  type ContentDraft,
  type ContentItem,
  type ContentKind,
  type RichTextDocument,
  type RichTextNode,
  type ContentStatus,
  type ContentWorkspaceResponse,
} from "@cediah/contracts";
import { AppShell } from "./app-shell";
import { uniqueRegions } from "@/lib/content-regions";
import { questionAnswer, withQuestionAnswer } from "@/lib/question-answer";
import { RegionTagsInput } from "./region-tags-input";

const GuideEditorScreen = dynamic(
  () => import("./guide-editor-screen").then((module) => module.GuideEditorScreen),
  {
    loading: () => (
      <div className="guide-editor-module-loading" role="status">
        <span className="route-loading-indicator" aria-hidden="true" />
        Preparando el editor de guía…
      </div>
    ),
    ssr: false,
  },
);

type Props = { initialWorkspace: ContentWorkspaceResponse };
type Asset = NonNullable<ContentItem["asset"]>;
type Mime = ContentAssetUploadResponse["asset"]["mimeType"];
type TargetStatus = Exclude<ContentStatus, "draft">;
type Base = Pick<
  ContentDraft,
  "estimatedMinutes" | "featured" | "slug" | "summary" | "title" | "topic"
>;

const kinds: { label: string; value: ContentKind }[] = [
  { label: "Video", value: "video" },
  { label: "Guía", value: "guide" },
  { label: "Cuestionario", value: "quiz" },
  { label: "Flashcards", value: "flashcards" },
  { label: "Tema anatómico", value: "topic" },
];

const primaryKinds = [
  { label: "Video", value: "video" },
  { label: "Guía", value: "guide" },
  { label: "Tema", value: "topic" },
] satisfies { label: string; value: ContentKind }[];

const kindIcons: Record<ContentKind, typeof PlayCircle> = {
  flashcards: CardsThree,
  guide: Notebook,
  quiz: Question,
  topic: Compass,
  video: PlayCircle,
};

const statuses: { label: string; value: ContentStatus }[] = [
  { label: "Borrador", value: "draft" },
  { label: "En revisión", value: "in_review" },
  { label: "Cambios solicitados", value: "changes_requested" },
  { label: "Aprobado", value: "approved" },
  { label: "Publicado", value: "published" },
  { label: "Archivado", value: "archived" },
];

const errors: Record<string, string> = {
  content_conflict: "El contenido cambió o ya existe otro elemento con el mismo slug.",
  content_not_publishable: "Completa el contenido o adjunta el archivo requerido antes de publicar.",
  content_unavailable: "El servicio editorial no está disponible.",
  forbidden: "Tu cuenta no tiene permiso para realizar esta acción.",
  identity_unavailable: "No fue posible validar tu sesión.",
  invalid_content: "Revisa los campos obligatorios y sus límites.",
  invalid_content_asset: "El archivo no cumple los requisitos permitidos.",
  invalid_content_transition: "La transición de estado no es válida.",
  not_found: "El contenido no existe o no tienes acceso.",
  unauthorized: "Tu sesión terminó. Vuelve a iniciar sesión.",
};

function labelOf<T extends string>(options: { label: string; value: T }[], value: T) {
  return options.find((option) => option.value === value)?.label ?? value;
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es");
}

function summaryFromText(value: string) {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > 280 ? compact.slice(0, 277).trimEnd() + "…" : compact;
}

function richTextNodeHasBody(node: RichTextNode, insideHeading = false): boolean {
  const nextInsideHeading = insideHeading || node.type === "heading";
  if (node.type === "text") return !nextInsideHeading && node.text.trim().length > 0;
  if ("content" in node && node.content) {
    return node.content.some((child) => richTextNodeHasBody(child, nextInsideHeading));
  }
  return false;
}

function richTextDocumentHasBody(document: RichTextDocument | null): boolean {
  return Boolean(document?.content.some((node) => richTextNodeHasBody(node)));
}

function prepareDraft(draft: ContentDraft): ContentDraft {
  const slug = draft.slug || slugify(draft.title) || `contenido-${Date.now().toString(36)}`;
  const regions = uniqueRegions(
    draft.content.regions.length > 0 ? draft.content.regions : [draft.topic],
  );
  const topic = regions[0] ?? draft.topic;

  if (draft.kind === "video") {
    return {
      ...draft,
      slug,
      topic,
      content: {
        ...draft.content,
        description: draft.content.description.trim() || draft.summary.trim(),
        regions,
      },
    };
  }
  return {
    ...draft,
    slug,
    topic,
    content: { ...draft.content, regions },
  } as ContentDraft;
}

function emptyDraft(kind: ContentKind, seed: Partial<Base> = {}): ContentDraft {
  const base: Base = {
    estimatedMinutes: null,
    featured: false,
    slug: "",
    summary: "",
    title: "",
    topic: "",
    ...seed,
  };

  if (kind === "video") {
    return {
      ...base,
      kind,
      content: {
        description: "",
        durationSeconds: null,
        externalUrl: null,
        guide: { document: null, sections: [] },
        keyPoints: [],
        quiz: { questions: [] },
        regions: [],
      },
    };
  }
  if (kind === "guide") {
    return {
      ...base,
      kind,
      content: {
        document: null,
        keyPoints: [],
        linkedVideoId: null,
        quiz: { questions: [] },
        regions: [],
        sections: [],
      },
    };
  }
  if (kind === "quiz") {
    return {
      ...base,
      kind,
      content: {
        questions: [{ correctOptionIndex: 0, explanation: "", options: ["", ""], prompt: "" }],
        regions: [],
      },
    };
  }
  if (kind === "flashcards") {
    return { ...base, kind, content: { cards: [{ back: "", front: "" }], regions: [] } };
  }
  return { ...base, kind: "topic", content: { introduction: "", objectives: [], regions: [] } };
}

function itemDraft(item: ContentItem): ContentDraft {
  const draft = structuredClone(item) as unknown as Record<string, unknown>;
  for (const key of [
    "asset",
    "authorUserId",
    "createdAt",
    "id",
    "publishedAt",
    "status",
    "updatedAt",
  ]) {
    delete draft[key];
  }
  return draft as ContentDraft;
}

async function json<T>(url: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body !== undefined) headers.set("Content-Type", "application/json");
  const response = await fetch(url, { ...init, cache: "no-store", headers });
  const body: unknown = await response
    .json()
    .catch(() => ({ error: "content_unavailable" }));

  if (!response.ok) {
    const code =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : "content_unavailable";
    throw new Error(errors[code] ?? `No fue posible completar la acción (${response.status}).`);
  }
  return body as T;
}

async function contentItemJson(url: string, init: RequestInit = {}) {
  const parsed = ContentItemSchema.safeParse(await json<unknown>(url, init));
  if (!parsed.success) throw new Error(errors.content_unavailable);
  return parsed.data;
}

function signedPut(url: string, file: File, onProgress: (value: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    const form = new FormData();
    form.append("cacheControl", "3600");
    form.append("", file);
    request.open("PUT", url);
    request.setRequestHeader("x-upsert", "false");
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener("error", () => reject(new Error("La carga se interrumpió.")));
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error(`El archivo fue rechazado (${request.status}).`));
    });
    request.send(form);
  });
}

function workflow(
  item: ContentItem,
  capabilities: ContentWorkspaceResponse["capabilities"],
): { label: string; status: TargetStatus; tone: string }[] {
  if (item.status === "draft" || item.status === "changes_requested") {
    return capabilities.canCreate || capabilities.canEditAll
      ? [{ label: "Enviar a revisión", status: "in_review", tone: "primary" }]
      : [];
  }
  if (item.status === "in_review" && capabilities.canReview) {
    return [
      { label: "Solicitar cambios", status: "changes_requested", tone: "warning" },
      { label: "Aprobar", status: "approved", tone: "success" },
    ];
  }
  if (item.status === "approved" && capabilities.canPublish) {
    return [{ label: "Publicar", status: "published", tone: "success" }];
  }
  if (item.status === "published" && capabilities.canPublish) {
    return [{ label: "Archivar", status: "archived", tone: "danger" }];
  }
  return [];
}

function StringList({
  label,
  max,
  showLabel = true,
  values,
  onChange,
}: {
  label: string;
  max: number;
  showLabel?: boolean;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <div className="studio-list-editor">
      {showLabel && <strong>{label}</strong>}
      {values.map((value, index) => (
        <div className="studio-inline-row" key={index}>
          <input
            aria-label={`${label} ${index + 1}`}
            maxLength={500}
            required
            value={value}
            onChange={(event) =>
              onChange(values.map((current, position) => (position === index ? event.target.value : current)))
            }
          />
          <button
            aria-label={`Eliminar ${label.toLowerCase()} ${index + 1}`}
            type="button"
            onClick={() => onChange(values.filter((_, position) => position !== index))}
          >
            <Trash size={16} />
          </button>
        </div>
      ))}
      <button
        className="studio-add"
        disabled={values.length >= max}
        type="button"
        onClick={() => onChange([...values, ""])}
      >
        <Plus size={16} /> Añadir
      </button>
    </div>
  );
}

type QuizQuestion = Extract<ContentDraft, { kind: "quiz" }>["content"]["questions"][number];

function QuizQuestionsEditor({
  allowEmpty = false,
  questions,
  onChange,
  title,
}: {
  allowEmpty?: boolean;
  questions: QuizQuestion[];
  onChange: (questions: QuizQuestion[]) => void;
  title: string;
}) {
  const emptyQuestion: QuizQuestion = {
    correctOptionIndex: 0,
    explanation: "",
    options: ["", ""],
    prompt: "",
  };
  const updateQuestion = (index: number, patch: Partial<QuizQuestion>) =>
    onChange(
      questions.map((question, position) =>
        position === index ? { ...question, ...patch } : question,
      ),
    );

  return (
    <section className="studio-builder studio-question-answer-builder" aria-label={title}>
      <header className="studio-builder-heading">
        <div>
          <CardsThree size={19} />
          <h4>{title}</h4>
        </div>
        <span>{questions.length} {questions.length === 1 ? "tarjeta" : "tarjetas"}</span>
      </header>
      {questions.map((question, questionIndex) => (
        <article className="studio-repeater studio-question-answer-card" key={questionIndex}>
          <header>
            <span className="studio-question-number">{String(questionIndex + 1).padStart(2, "0")}</span>
            <strong>Pregunta y respuesta</strong>
            <button
              aria-label={`Eliminar pregunta ${questionIndex + 1}`}
              disabled={!allowEmpty && questions.length <= 1}
              type="button"
              onClick={() => onChange(questions.filter((_, index) => index !== questionIndex))}
            >
              <Trash size={16} />
            </button>
          </header>
          <label className="studio-field">
            <span>Pregunta</span>
            <textarea
              required
              maxLength={2000}
              rows={2}
              value={question.prompt}
              onChange={(event) => updateQuestion(questionIndex, { prompt: event.target.value })}
            />
          </label>
          <label className="studio-field studio-answer-field">
            <span>Respuesta</span>
            <textarea
              required
              aria-label={`Respuesta ${questionIndex + 1}`}
              maxLength={500}
              placeholder="Escribe la respuesta directa…"
              rows={2}
              value={questionAnswer(question)}
              onChange={(event) =>
                updateQuestion(questionIndex, withQuestionAnswer(question, event.target.value))
              }
            />
          </label>
          <label className="studio-field">
            <span>Contexto adicional <small>(opcional)</small></span>
            <textarea
              maxLength={4000}
              rows={2}
              value={question.explanation}
              onChange={(event) => updateQuestion(questionIndex, { explanation: event.target.value })}
            />
          </label>
        </article>
      ))}
      {questions.length === 0 && (
        <button
          className="studio-builder-empty"
          type="button"
          onClick={() => onChange([emptyQuestion])}
        >
          <Plus size={19} />
          <span>Añadir la primera pregunta</span>
        </button>
      )}
      {questions.length > 0 && (
        <button
          className="studio-add"
          disabled={questions.length >= 100}
          type="button"
          onClick={() => onChange([...questions, emptyQuestion])}
        >
          <Plus size={16} /> Añadir pregunta
        </button>
      )}
    </section>
  );
}

function GuideEditorLaunch({
  description,
  label,
  onOpen,
}: {
  description: string;
  label: string;
  onOpen: () => void;
}) {
  return (
    <button
      aria-label={`${label}. Abrir editor visual`}
      className="studio-type-editor studio-guide-launch studio-guide-cta"
      type="button"
      onClick={onOpen}
    >
      <span aria-hidden="true" className="studio-guide-preview">
        <span className="studio-guide-preview-toolbar">
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
        <span className="studio-guide-preview-layout">
          <span className="studio-guide-preview-outline"><i /><i /><i /><i /></span>
          <span className="studio-guide-preview-document">
            <i className="is-title" /><i /><i /><i className="is-short" />
            <i className="is-subtitle" /><i /><i /><i className="is-short" />
          </span>
          <span className="studio-guide-preview-companions"><i /><i /><i /></span>
        </span>
      </span>
      <span className="studio-guide-preview-cta">
        <span className="studio-guide-launch-icon"><NotePencil size={22} /></span>
        <span className="studio-guide-cta-copy">
          <strong>{label}</strong>
          <small>{description}</small>
        </span>
        <span className="studio-guide-preview-action">
          Ir al editor <CaretRight aria-hidden="true" size={16} />
        </span>
      </span>
    </button>
  );
}

function TypeEditor({
  draft,
  onOpenGuide,
  onChange,
}: {
  draft: ContentDraft;
  onOpenGuide: () => void;
  onChange: (draft: ContentDraft) => void;
}) {
  if (draft.kind === "video") {
    return (
      <GuideEditorLaunch
        description={`${draft.content.guide.sections.length} secciones · ${draft.content.keyPoints.length} puntos clave · ${draft.content.quiz.questions.length} preguntas`}
        label="Editar guía y recursos"
        onOpen={onOpenGuide}
      />
    );
  }

  if (draft.kind === "guide") {
    return (
      <GuideEditorLaunch
        description="Organiza el documento, el índice y los recursos de estudio."
        label="Editar contenido de la guía"
        onOpen={onOpenGuide}
      />
    );
  }
  if (draft.kind === "quiz") {
    return (
      <div className="studio-type-editor">
        <QuizQuestionsEditor
          title="Preguntas y respuestas"
          questions={draft.content.questions}
          onChange={(questions) => onChange({ ...draft, content: { ...draft.content, questions } })}
        />
      </div>
    );
  }

  if (draft.kind === "flashcards") {
    return (
      <section className="studio-type-editor">
        <h4>Tarjetas de estudio</h4>
        <div className="studio-card-grid">
          {draft.content.cards.map((card, index) => (
            <article className="studio-repeater" key={index}>
              <header>
                <strong>Tarjeta {index + 1}</strong>
                <button
                  aria-label={`Eliminar tarjeta ${index + 1}`}
                  disabled={draft.content.cards.length === 1}
                  type="button"
                  onClick={() =>
                    onChange({
                      ...draft,
                      content: { ...draft.content, cards: draft.content.cards.filter((_, position) => position !== index) },
                    })
                  }
                >
                  <Trash size={16} />
                </button>
              </header>
              {(["front", "back"] as const).map((side) => (
                <label className="studio-field" key={side}>
                  <span>{side === "front" ? "Frente" : "Reverso"}</span>
                  <textarea
                    required
                    maxLength={side === "front" ? 2000 : 4000}
                    rows={side === "front" ? 3 : 4}
                    value={card[side]}
                    onChange={(event) =>
                      onChange({
                        ...draft,
                        content: {
                          ...draft.content,
                          cards: draft.content.cards.map((current, position) =>
                            position === index ? { ...current, [side]: event.target.value } : current,
                          ),
                        },
                      })
                    }
                  />
                </label>
              ))}
            </article>
          ))}
        </div>
        <button
          className="studio-add"
          disabled={draft.content.cards.length >= 500}
          type="button"
          onClick={() =>
            onChange({
              ...draft,
              content: { ...draft.content, cards: [...draft.content.cards, { back: "", front: "" }] },
            })
          }
        >
          <Plus size={16} /> Añadir tarjeta
        </button>
      </section>
    );
  }

  return (
    <section className="studio-type-editor">
      <h4>Contenido del tema anatómico</h4>
      <label className="studio-field">
        <span>Contenido</span>
        <textarea
          required
          maxLength={20000}
          rows={7}
          value={draft.content.introduction}
          onChange={(event) =>
            onChange({
              ...draft,
              summary: summaryFromText(event.target.value),
              content: { ...draft.content, introduction: event.target.value },
            })
          }
        />
      </label>
      <StringList
        label="Objetivos"
        max={30}
        values={draft.content.objectives}
        onChange={(objectives) =>
          onChange({ ...draft, content: { ...draft.content, objectives } })
        }
      />
    </section>
  );
}
export function ContentStudio({ initialWorkspace }: Props) {
  const [items, setItems] = useState(initialWorkspace.items);
  const [draft, setDraft] = useState<ContentDraft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | ContentKind>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | ContentStatus>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; tone: "error" | "success" } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [guideEditing, setGuideEditing] = useState(false);
  const [guideCreateOpen, setGuideCreateOpen] = useState(false);
  const [linkedVideoId, setLinkedVideoId] = useState("");
  const [publicationsCollapsed, setPublicationsCollapsed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const guideEntryDraftRef = useRef<ContentDraft | null>(null);
  const guideChoiceDialogRef = useRef<HTMLElement>(null);
  const guideChoiceTriggerRef = useRef<HTMLElement | null>(null);
  const capabilities = initialWorkspace.capabilities;
  const item = editingId ? items.find((current) => current.id === editingId) : undefined;

  const regionSuggestions = useMemo(
    () => Array.from(new Set(items.flatMap((current) =>
      current.content.regions.length > 0 ? current.content.regions : [current.topic],
    ))).sort((left, right) => left.localeCompare(right, "es")),
    [items],
  );
  const linkableVideos = useMemo(
    () =>
      items.filter(
        (current): current is ContentItem & { kind: "video" } =>
          current.kind === "video" &&
          current.status !== "archived" &&
          ((current.asset?.kind === "video" && current.asset.status === "ready") ||
            Boolean(current.content.externalUrl)),
      ),
    [items],
  );

  const visibleItems = useMemo(() => {
    const text = normalizeSearch(query.trim());
    return [...items]
      .filter((current) => {
        const regions = current.content.regions.length > 0
          ? current.content.regions
          : [current.topic];
        const haystack = normalizeSearch(
          `${current.title} ${current.summary} ${current.topic} ${regions.join(" ")} ${current.slug}`,
        );
        return (
          (!text || haystack.includes(text)) &&
          (kindFilter === "all" || current.kind === kindFilter) &&
          (statusFilter === "all" || current.status === statusFilter)
        );
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [items, kindFilter, query, statusFilter]);

  const editable =
    Boolean(draft) &&
    (isNew
      ? capabilities.canCreate
      : Boolean(
          item &&
            (capabilities.canEditAll ||
              (capabilities.canCreate &&
                (item.status === "draft" || item.status === "changes_requested"))),
        ));
  const draftBaseline = draft
    ? isNew
      ? emptyDraft(draft.kind)
      : item
        ? itemDraft(item)
        : null
    : null;
  const hasUnsavedChanges = Boolean(
    draft &&
      (!draftBaseline ||
        file !== null ||
        JSON.stringify(draft) !== JSON.stringify(draftBaseline)),
  );

  useEffect(() => {
    if (!guideCreateOpen) return;
    guideChoiceDialogRef.current
      ?.querySelector<HTMLElement>("[data-guide-choice-initial]")
      ?.focus();
  }, [guideCreateOpen]);

  function confirmDiscard() {
    return (
      !hasUnsavedChanges ||
      window.confirm("Hay cambios sin guardar. ¿Quieres descartarlos?")
    );
  }

  function resetFeedback() {
    setNotice(null);
    setFile(null);
    setProgress(0);
    if (fileRef.current) fileRef.current.value = "";
  }

  function open(current: ContentItem) {
    if (busy) return;
    if (!isNew && current.id === editingId) return;
    if (!confirmDiscard()) return;
    setDraft(itemDraft(current));
    setEditingId(current.id);
    setIsNew(false);
    resetFeedback();
    if (current.kind === "guide") {
      guideEntryDraftRef.current = itemDraft(current);
    }
    setGuideEditing(false);
  }

  function create(kind: ContentKind = "video") {
    if (busy) return;
    if (!confirmDiscard()) return;
    if (kind === "guide") {
      guideChoiceTriggerRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setLinkedVideoId("");
      setGuideCreateOpen(true);
      return;
    }
    setDraft(emptyDraft(kind));
    setEditingId(null);
    setIsNew(true);
    resetFeedback();
  }

  function closeGuideCreationChoice() {
    const trigger = guideChoiceTriggerRef.current;
    setGuideCreateOpen(false);
    window.requestAnimationFrame(() => {
      if (trigger?.isConnected) trigger.focus();
    });
  }

  function handleGuideChoiceKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeGuideCreationChoice();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => !element.hasAttribute("hidden"));
    if (focusable.length === 0) {
      event.preventDefault();
      event.currentTarget.focus();
      return;
    }

    const first = focusable[0]!;
    const last = focusable.at(-1)!;
    const active = document.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function beginGuideCreation(videoId: string | null) {
    const linkedVideo = videoId
      ? linkableVideos.find((current) => current.id === videoId)
      : undefined;
    const created = emptyDraft("guide") as Extract<ContentDraft, { kind: "guide" }>;
    const regions = linkedVideo
      ? linkedVideo.content.regions.length > 0
        ? linkedVideo.content.regions
        : [linkedVideo.topic]
      : [];
    const next: Extract<ContentDraft, { kind: "guide" }> = {
      ...created,
      topic: regions[0] ?? "",
      content: {
        ...created.content,
        linkedVideoId: linkedVideo?.id ?? null,
        regions,
      },
    };
    setDraft(next);
    setEditingId(null);
    setIsNew(true);
    setGuideCreateOpen(false);
    guideEntryDraftRef.current = structuredClone(next);
    setGuideEditing(true);
    resetFeedback();
  }

  function openGuideEditor() {
    if (!draft || (draft.kind !== "guide" && draft.kind !== "video")) return;
    guideEntryDraftRef.current = structuredClone(draft);
    setGuideEditing(true);
    setNotice(null);
  }

  function leaveGuideEditor(discard: boolean) {
    if (discard && isNew && draft?.kind === "guide") {
      setDraft(null);
      setEditingId(null);
      setIsNew(false);
      setGuideEditing(false);
      guideEntryDraftRef.current = null;
      resetFeedback();
      return;
    }
    if (discard && guideEntryDraftRef.current) {
      setDraft(structuredClone(guideEntryDraftRef.current));
    }
    setGuideEditing(false);
    guideEntryDraftRef.current = null;
  }

  function close() {
    if (busy || !confirmDiscard()) return;
    setDraft(null);
    setEditingId(null);
    setIsNew(false);
    setGuideEditing(false);
    resetFeedback();
  }

  function upsert(current: ContentItem) {
    setItems((existing) => [current, ...existing.filter((value) => value.id !== current.id)]);
  }

  async function save(event?: FormEvent): Promise<boolean> {
    event?.preventDefault();
    if (!draft || !editable || busy) return false;
    if (!hasUnsavedChanges) return true;
    setBusy("save");
    setNotice(null);

    try {
      const payload = prepareDraft(draft);
      const current = await contentItemJson(
        isNew ? "/api/editor/content" : `/api/editor/content/${encodeURIComponent(editingId!)}`,
        { body: JSON.stringify(payload), method: isNew ? "POST" : "PATCH" },
      );
      upsert(current);
      setDraft(itemDraft(current));
      setEditingId(current.id);
      setIsNew(false);
      guideEntryDraftRef.current = itemDraft(current);
      setNotice({ text: "Contenido guardado.", tone: "success" });
      return true;
    } catch (error) {
      setNotice({
        text: error instanceof Error ? error.message : "No fue posible guardar.",
        tone: "error",
      });
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function transition(status: TargetStatus) {
    if (!item || busy) return;
    if (hasUnsavedChanges) {
      setNotice({ text: "Guarda los cambios antes de cambiar el estado.", tone: "error" });
      return;
    }
    if (status === "archived" && !window.confirm("¿Archivar este contenido?")) return;
    setBusy("transition");
    setNotice(null);

    try {
      const current = await contentItemJson(
        `/api/editor/content/${encodeURIComponent(item.id)}/transition`,
        { body: JSON.stringify({ status }), method: "POST" },
      );
      upsert(current);
      setDraft(itemDraft(current));
      setEditingId(current.id);
      setIsNew(false);
      setNotice({
        text: `Estado actualizado a ${labelOf(statuses, current.status)}.`,
        tone: "success",
      });
    } catch (error) {
      setNotice({
        text: error instanceof Error ? error.message : "No fue posible actualizar el estado.",
        tone: "error",
      });
    } finally {
      setBusy(null);
    }
  }

  async function removeGuide() {
    if (!item || item.kind !== "guide" || !capabilities.canPublish || busy) return;
    const confirmed = window.confirm(
      `¿Eliminar permanentemente la guía “${item.title}”?\n\nSe borrarán su contenido y sus archivos asociados. Esta acción no se puede deshacer.`,
    );
    if (!confirmed) return;

    setBusy("delete");
    setNotice(null);
    try {
      const deleted = await json<{ id: string }>(
        `/api/editor/content/${encodeURIComponent(item.id)}`,
        { method: "DELETE" },
      );
      if (deleted.id !== item.id) throw new Error(errors.content_unavailable);

      const remaining = items.filter((current) => current.id !== item.id);
      const next = remaining[0] ?? null;
      setItems(remaining);
      setDraft(next ? itemDraft(next) : null);
      setEditingId(next?.id ?? null);
      setIsNew(false);
      setGuideEditing(false);
      guideEntryDraftRef.current = null;
      setFile(null);
      setProgress(0);
      if (fileRef.current) fileRef.current.value = "";
      setNotice({ text: "Guía eliminada permanentemente.", tone: "success" });
    } catch (error) {
      setNotice({
        text: error instanceof Error ? error.message : "No fue posible eliminar la guía.",
        tone: "error",
      });
    } finally {
      setBusy(null);
    }
  }

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setProgress(0);
    setNotice(null);

    if (selected && draft?.kind === "video" && selected.type.startsWith("video/")) {
      const media = document.createElement("video");
      const objectUrl = URL.createObjectURL(selected);
      media.preload = "metadata";
      media.onloadedmetadata = () => {
        if (fileRef.current?.files?.[0] !== selected) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        const seconds = Number.isFinite(media.duration) ? Math.round(media.duration) : null;
        setDraft((current) =>
          current?.kind === "video"
            ? { ...current, content: { ...current.content, durationSeconds: seconds } }
            : current,
        );
        URL.revokeObjectURL(objectUrl);
      };
      media.onerror = () => URL.revokeObjectURL(objectUrl);
      media.src = objectUrl;
    }
  }

  async function upload() {
    if (!draft || !file || !editable || !capabilities.canUpload || busy) return;
    const isVideo = draft.kind === "video";
    const isGuide = draft.kind === "guide";
    const valid =
      (isVideo && ["video/mp4", "video/quicktime", "video/webm"].includes(file.type)) ||
      (isGuide && file.type === "application/pdf");

    if (!valid) {
      setNotice({ text: "El tipo de archivo no corresponde al contenido.", tone: "error" });
      return;
    }

    setBusy("upload");
    setNotice(null);
    try {
      // Assets require a content ID, but authors should not have to save a
      // separate draft just to reveal the video picker. Create it as part of
      // the upload action when this is a new item.
      const target =
        item ??
        (await contentItemJson("/api/editor/content", {
          body: JSON.stringify(prepareDraft(draft)),
          method: "POST",
        }));
      if (!item) {
        upsert(target);
        setDraft(itemDraft(target));
        setEditingId(target.id);
        setIsNew(false);
      }

      const reservation = await json<ContentAssetUploadResponse>(
        `/api/editor/content/${encodeURIComponent(target.id)}/assets`,
        {
          body: JSON.stringify({
            fileName: file.name,
            fileSizeBytes: file.size,
            kind: isVideo ? "video" : "document",
            mimeType: file.type as Mime,
          }),
          method: "POST",
        },
      );
      if (file.size > reservation.constraints.maxFileSizeBytes) {
        throw new Error("El archivo supera el límite permitido.");
      }
      await signedPut(reservation.upload.url, file, setProgress);
      const asset = await json<Asset>(
        `/api/editor/assets/${encodeURIComponent(reservation.asset.id)}/finalize`,
        { method: "POST" },
      );
      setItems((current) =>
        current.map((value) =>
          value.id === target.id ? ({ ...value, asset } as ContentItem) : value,
        ),
      );
      setFile(null);
      setProgress(100);
      if (fileRef.current) fileRef.current.value = "";
      setNotice({ text: "Archivo cargado y verificado.", tone: "success" });
    } catch (error) {
      setNotice({
        text: error instanceof Error ? error.message : "No fue posible cargar el archivo.",
        tone: "error",
      });
    } finally {
      setBusy(null);
    }
  }

  const actions = item ? workflow(item, capabilities) : [];
  const accepts = draft?.kind === "video"
    ? "video/mp4,video/quicktime,video/webm"
    : undefined;
  const videoChecklist = draft?.kind === "video"
    ? [
        {
          icon: FileVideo,
          label: "Video",
          ready: Boolean(
            (item?.asset?.status === "ready" && item.asset.kind === "video") ||
              draft.content.externalUrl,
          ),
        },
        {
          icon: CheckCircle,
          label: "Puntos clave",
          ready:
            draft.content.keyPoints.length > 0 &&
            draft.content.keyPoints.every((point) => point.trim().length > 0),
        },
        {
          icon: Notebook,
          label: "Guía",
          ready:
            (draft.content.guide.sections.length > 0 &&
              draft.content.guide.sections.every(
                (section) => section.heading.trim().length > 0 && section.body.trim().length > 0,
              )) || richTextDocumentHasBody(draft.content.guide.document),
        },
        {
          icon: Question,
          label: "Preguntas y respuestas",
          ready:
            draft.content.quiz.questions.length > 0 &&
            draft.content.quiz.questions.every(
              (question) =>
                question.prompt.trim().length > 0 &&
                questionAnswer(question).trim().length > 0,
            ),
        },
      ]
    : [];
const videoComplete = videoChecklist.length > 0 && videoChecklist.every((requirement) => requirement.ready);
  const basicsComplete = Boolean(
    draft?.title.trim() &&
      draft.topic.trim() &&
      (draft.kind === "topic" ? draft.content.introduction.trim() : draft.summary.trim()),
  );

  if (guideEditing && draft && (draft.kind === "guide" || draft.kind === "video")) {
    return (
      <AppShell
        activeKey="editor"
        canManageContent
        canManageRoles={initialWorkspace.roles.includes("administrator")}
        isAdministrator={initialWorkspace.roles.includes("administrator")}
        headerTitle="Editor de guía"
        mainClassName="guide-editor-main"
      >
        <GuideEditorScreen
          key={`${editingId ?? "new"}-${draft.kind}`}
          busy={busy !== null}
          draft={draft}
          editable={editable}
          hasUnsavedChanges={hasUnsavedChanges}
          isNew={isNew}
          notice={notice}
          status={item?.status}
          onChange={(next) => {
            setDraft(next);
            setNotice(null);
          }}
          onLeave={leaveGuideEditor}
          onSave={() => save()}
        />
      </AppShell>
    );
  }

  return (
    <AppShell
      activeKey="editor"
      canManageContent
      canManageRoles={initialWorkspace.roles.includes("administrator")}
      isAdministrator={initialWorkspace.roles.includes("administrator")}
      headerTitle="Contenido"
      mainClassName="studio-main"
    >
      <header className="studio-heading">
        <div>
          <h2>Gestionar contenido</h2>
        </div>
        {capabilities.canCreate && (
          <div className="studio-create-actions" aria-label="Crear contenido">
            {primaryKinds.map((option) => {
              return (
                <button
                  className="studio-create-button"
                  disabled={busy !== null}
                  key={option.value}
                  type="button"
                  onClick={() => create(option.value)}
                >
                  <Plus aria-hidden="true" size={16} weight="bold" />
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </header>

      <div className="studio-toolbar">
        <label className="studio-search">
          <MagnifyingGlass size={18} />
          <input
            aria-label="Buscar contenido"
            placeholder="Buscar por título o región"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="studio-kind-filters" role="group" aria-label="Filtrar por tipo">
          {([
            { label: "Todo", value: "all" },
            { label: "Videos", value: "video" },
            { label: "Guías", value: "guide" },
            { label: "Temas", value: "topic" },
          ] as const).map((option) => (
            <button
              aria-pressed={kindFilter === option.value}
              className={kindFilter === option.value ? "is-active" : ""}
              key={option.value}
              type="button"
              onClick={() => setKindFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <label className="studio-status-filter">
          <span className="sr-only">Estado</span>
          <select
            aria-label="Filtrar por estado"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "all" | ContentStatus)}
          >
            <option value="all">Todos los estados</option>
            {statuses.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className={`studio-workspace ${publicationsCollapsed ? "publications-collapsed" : ""}`}>
        <aside className="studio-items" aria-label="Publicaciones" id="studio-publications">
          <header className="studio-publications-heading">
            <div>
              <strong>Publicaciones</strong>
              <small>{visibleItems.length}</small>
            </div>
            <button
              aria-controls="studio-publications"
              aria-expanded={!publicationsCollapsed}
              aria-label={publicationsCollapsed ? "Expandir publicaciones" : "Contraer publicaciones"}
              title={publicationsCollapsed ? "Expandir publicaciones" : "Contraer publicaciones"}
              type="button"
              onClick={() => setPublicationsCollapsed((value) => !value)}
            >
              {publicationsCollapsed ? <CaretRight size={17} /> : <CaretLeft size={17} />}
            </button>
          </header>
          {visibleItems.map((current) => {
            const ItemIcon = kindIcons[current.kind];
            return (
              <button
                aria-label={`${labelOf(kinds, current.kind)}: ${current.title}. ${labelOf(statuses, current.status)}`}
                aria-pressed={item?.id === current.id}
                className={`studio-item ${item?.id === current.id ? "studio-item-active" : ""}`}
                disabled={busy !== null}
                key={current.id}
                title={publicationsCollapsed ? current.title : undefined}
                type="button"
                onClick={() => open(current)}
              >
                <span className={`studio-kind studio-kind-${current.kind}`}>
                  <ItemIcon aria-hidden="true" size={15} />
                  <span>{labelOf(kinds, current.kind)}</span>
                </span>
                <strong>{current.title}</strong>
                <small>{current.topic}</small>
                <span className={`studio-badge studio-badge-${current.status}`}>
                  {labelOf(statuses, current.status)}
                </span>
              </button>
            );
          })}
          {visibleItems.length === 0 && (
            <p className="studio-empty">No hay contenido con estos filtros.</p>
          )}
        </aside>

        <section
          className="studio-editor"
          aria-busy={busy !== null}
          aria-label="Editor de contenido"
        >
          {!draft ? (
            <>
              {notice && (
                <p
                  className={`studio-notice studio-notice-${notice.tone}`}
                  role={notice.tone === "error" ? "alert" : "status"}
                >
                  {notice.text}
                </p>
              )}
              <div className="studio-empty">
                <Notebook size={30} />
                <h3>Elige una publicación</h3>
              </div>
            </>
          ) : (
            <>
              <header className="studio-editor-heading">
                <div className="studio-editor-title-block">
                  <small>{labelOf(kinds, draft.kind)}</small>
                  <h3>{draft.title || `${labelOf(kinds, draft.kind)} sin título`}</h3>
                </div>
                <div className="studio-editor-heading-actions">
                  {item && (
                    <span className={`studio-badge studio-editor-status studio-badge-${item.status}`}>
                      {labelOf(statuses, item.status)}
                    </span>
                  )}
                  {actions.map((action) => (
                    <button
                      className={`studio-button studio-editor-action studio-button-${action.tone}`}
                      disabled={
                        busy !== null ||
                        (draft.kind === "video" &&
                          (action.status === "in_review" || action.status === "published") &&
                          !videoComplete)
                      }
                      key={action.status}
                      title={
                        draft.kind === "video" && !videoComplete
                          ? "Completa el video, los puntos clave, la guía y las preguntas y respuestas"
                          : undefined
                      }
                      type="button"
                      onClick={() => transition(action.status)}
                    >
                      {action.label}
                    </button>
                  ))}
                  {item?.kind === "guide" && capabilities.canPublish && (
                    <button
                      aria-label={`Eliminar guía ${item.title}`}
                      className="studio-button studio-editor-action studio-guide-delete"
                      disabled={busy !== null}
                      title="Eliminar guía permanentemente"
                      type="button"
                      onClick={() => void removeGuide()}
                    >
                      <Trash aria-hidden="true" size={16} />
                      <span>{busy === "delete" ? "Eliminando…" : "Eliminar"}</span>
                    </button>
                  )}
                  <button
                    className="studio-editor-close"
                    aria-label="Cerrar editor"
                    disabled={busy !== null}
                    type="button"
                    onClick={close}
                  >
                    <X size={19} />
                  </button>
                </div>
              </header>

              {draft.kind === "video" && (
                <div className="studio-package-checklist" aria-label="Requisitos del video">
                  {videoChecklist.map((requirement) => {
                    const Icon = requirement.icon;
                    return (
                      <span
                        aria-label={`${requirement.label}: ${requirement.ready ? "completo" : "pendiente"}`}
                        className={requirement.ready ? "is-ready" : ""}
                        key={requirement.label}
                      >
                        {requirement.ready ? (
                          <Check aria-hidden="true" size={16} weight="bold" />
                        ) : (
                          <Icon aria-hidden="true" size={16} />
                        )}
                        {requirement.label}
                      </span>
                    );
                  })}
                </div>
              )}

              {notice && (
                <p
                  className={`studio-notice studio-notice-${notice.tone}`}
                  role={notice.tone === "error" ? "alert" : "status"}
                >
                  {notice.text}
                </p>
              )}

              {accepts && capabilities.canUpload && editable && (
                <section className="studio-assets" aria-labelledby="studio-upload-title">
                  <div className="studio-assets-heading">
                    <span className="studio-assets-icon">
                      <FileVideo size={22} />
                    </span>
                    <div>
                      <h4 id="studio-upload-title">Video</h4>
                      {item?.asset && (
                        <p className="studio-current-file">
                          <CheckCircle size={15} weight="fill" /> {item.asset.fileName}
                        </p>
                      )}
                    </div>
                  </div>
                  <label className={`studio-upload-zone ${file ? "has-file" : ""}`}>
                    <CloudArrowUp size={24} />
                    <span>{file ? file.name : "Seleccionar video"}</span>
                    <small>MP4, MOV o WebM</small>
                    <input
                      ref={fileRef}
                      accept={accepts}
                      disabled={busy !== null}
                      type="file"
                      onChange={selectFile}
                    />
                  </label>
                  {busy === "upload" && (
                    <div className="studio-progress" aria-live="polite">
                      <progress aria-label="Progreso de carga" max={100} value={progress} />
                      <span>{progress}%</span>
                    </div>
                  )}
                  {file && !basicsComplete && (
                    <p className="studio-upload-requirement" id="studio-upload-requirement">
                      Completa título, región y resumen para subir el archivo.
                    </p>
                  )}
                  <button
                    aria-describedby={
                      file && !basicsComplete ? "studio-upload-requirement" : undefined
                    }
                    className="studio-button studio-button-secondary"
                    disabled={!file || busy !== null || !basicsComplete}
                    type="button"
                    onClick={upload}
                  >
                    <CloudArrowUp size={17} />
                    {busy === "upload" ? "Subiendo..." : "Subir video"}
                  </button>
                </section>
              )}

              <form id="studio-content-form" onSubmit={save}>
                <fieldset disabled={!editable || busy !== null}>
                  <section className="studio-form-section">
                    <h4>Información básica</h4>
                    <div className="studio-form-grid">
                      <label className="studio-field studio-field-wide">
                        <span>Título</span>
                        <input
                          aria-label="Título"
                          autoFocus={isNew}
                          maxLength={200}
                          placeholder="Escribe el título de la publicación"
                          required
                          value={draft.title}
                          onChange={(event) => {
                            const title = event.target.value;
                            setDraft({
                              ...draft,
                              slug: isNew ? slugify(title) : draft.slug,
                              title,
                            } as ContentDraft);
                          }}
                        />
                      </label>
                      <RegionTagsInput
                        disabled={!editable || busy !== null}
                        suggestions={regionSuggestions}
                        values={draft.content.regions.length > 0 ? draft.content.regions : draft.topic ? [draft.topic] : []}
                        onChange={(regions) =>
                          setDraft({
                            ...draft,
                            topic: regions[0] ?? "",
                            content: { ...draft.content, regions },
                          } as ContentDraft)
                        }
                      />
                      {draft.kind !== "topic" && draft.kind !== "guide" && (
                        <label className="studio-field studio-field-wide">
                          <span>Resumen</span>
                          <textarea
                            required
                            maxLength={2000}
                            rows={3}
                            value={draft.summary}
                            onChange={(event) => {
                              const summary = event.target.value;
                              setDraft(
                                draft.kind === "video"
                                  ? {
                                      ...draft,
                                      summary,
                                      content: { ...draft.content, description: summary },
                                    }
                                  : ({ ...draft, summary } as ContentDraft),
                              );
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </section>

                  <TypeEditor draft={draft} onChange={setDraft} onOpenGuide={openGuideEditor} />
                </fieldset>

                {editable && (
                  <footer className="studio-save">
                    <button
                      className="studio-button studio-button-primary"
                      disabled={busy !== null}
                      type="submit"
                    >
                      {busy === "save" ? "Guardando..." : isNew ? "Guardar borrador" : "Guardar cambios"}
                    </button>
                  </footer>
                )}
              </form>
            </>
          )}
        </section>
      </div>

      {guideCreateOpen && (
        <div
          className="studio-guide-choice-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeGuideCreationChoice();
          }}
        >
          <section
            aria-describedby="guide-choice-description"
            aria-labelledby="guide-choice-title"
            aria-modal="true"
            className="studio-guide-choice"
            ref={guideChoiceDialogRef}
            role="dialog"
            tabIndex={-1}
            onKeyDown={handleGuideChoiceKeyDown}
          >
            <header>
              <span><Notebook size={23} /></span>
              <div>
                <small>Nueva guía</small>
                <h3 id="guide-choice-title">¿Dónde se publicará?</h3>
                <p id="guide-choice-description">Puedes crear una guía independiente o enlazarla como material anexo de un video.</p>
              </div>
              <button aria-label="Cerrar" type="button" onClick={closeGuideCreationChoice}><X size={18} /></button>
            </header>
            <div className="studio-guide-choice-options">
              <button
                className="studio-guide-choice-card"
                data-guide-choice-initial
                type="button"
                onClick={() => beginGuideCreation(null)}
              >
                <span><Notebook size={22} /></span>
                <strong>Guía independiente</strong>
                <small>Se mostrará en el catálogo de guías sin depender de un video.</small>
                <CaretRight size={18} />
              </button>
              <div className="studio-guide-choice-card studio-guide-choice-linked">
                <span><PlayCircle size={22} /></span>
                <strong>Anexo de un video</strong>
                <small>La guía aparecerá también dentro del material complementario del video elegido.</small>
                <label>
                  <span className="sr-only">Video relacionado</span>
                  <select value={linkedVideoId} onChange={(event) => setLinkedVideoId(event.target.value)}>
                    <option value="">
                      {linkableVideos.length > 0
                        ? "Selecciona un video…"
                        : "No hay videos disponibles"}
                    </option>
                    {linkableVideos.map((video) => (
                      <option key={video.id} value={video.id}>
                        {video.title} · {labelOf(statuses, video.status)}
                      </option>
                    ))}
                  </select>
                </label>
                <button disabled={!linkedVideoId} type="button" onClick={() => beginGuideCreation(linkedVideoId)}>
                  Continuar <CaretRight size={16} />
                </button>
              </div>
            </div>
            <button className="studio-guide-choice-cancel" type="button" onClick={closeGuideCreationChoice}>
              <ArrowLeft size={16} /> Cancelar
            </button>
          </section>
        </div>
      )}
    </AppShell>
  );
}
