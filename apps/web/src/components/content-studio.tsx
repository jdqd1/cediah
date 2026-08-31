"use client";

import type { ChangeEvent, FormEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArrowLeft,
  CaretLeft,
  CaretRight,
  CardsThree,
  Check,
  CheckCircle,
  CloudArrowUp,
  Compass,
  FileArchive,
  FilePdf,
  FileVideo,
  FunnelSimple,
  GraduationCap,
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
  SubjectSchema,
  type ContentAssetUploadResponse,
  type ContentDraft,
  type ContentItem,
  type ContentKind,
  type RichTextDocument,
  type RichTextNode,
  type Subject,
  type ContentStatus,
  type ContentTopic,
  type ContentWorkspaceResponse,
} from "@cediah/contracts";
import { AppShell } from "./app-shell";
import { isPublishedPermittedDraftUpdate } from "@/lib/content-editing";
import { uniqueRegions } from "@/lib/content-regions";
import { questionAnswer, withQuestionAnswer } from "@/lib/question-answer";
import { TopicSelector } from "./topic-selector";
import { StudioConfirmDialog } from "./studio-confirm-dialog";
import { StudioNameDialog } from "./studio-name-dialog";
import { PlatformToast, type PlatformNotice } from "./platform-toast";

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
  "estimatedMinutes" | "featured" | "slug" | "subjectIds" | "summary" | "title" | "topic"
>;

const kinds: { label: string; value: ContentKind }[] = [
  { label: "Video", value: "video" },
  { label: "Guía", value: "guide" },
  { label: "Cuestionario", value: "quiz" },
  { label: "Flashcards", value: "flashcards" },
  { label: "Tema", value: "topic" },
];

const primaryKinds = [
  { label: "Video", value: "video" },
  { label: "Guía", value: "guide" },
] satisfies { label: string; value: ContentKind }[];

// Non-video editorial assets stay disabled until they have an independent
// storage provider. The private video test uses its own isolated flow.
const contentAssetUploadsEnabled = false;

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
  invalid_subject: "Escribe un nombre válido para la materia.",
  subject_conflict: "Ya existe una materia con ese nombre.",
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

function topicsForSubjects(
  items: ContentItem[],
  taxonomyTopics: ContentTopic[],
  subjectIds: readonly string[],
  requireEverySubject: boolean,
) {
  if (subjectIds.length === 0) return [];
  const selected = new Set(subjectIds);
  const matchesSubjects = (candidateSubjectIds: readonly string[]) =>
    requireEverySubject
      ? subjectIds.every((id) => candidateSubjectIds.includes(id))
      : candidateSubjectIds.some((id) => selected.has(id));
  return uniqueRegions([
    ...taxonomyTopics
      .filter((topic) => matchesSubjects(topic.subjectIds))
      .map((topic) => topic.name),
    ...items
      .filter((current) => matchesSubjects(current.subjectIds))
      .flatMap((current) => current.content.regions.length > 0
        ? current.content.regions
        : [current.topic]),
  ])
    .sort((left, right) => left.localeCompare(right, "es"));
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
      subjectIds: Array.from(new Set(draft.subjectIds)),
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
    subjectIds: Array.from(new Set(draft.subjectIds)),
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
    subjectIds: [],
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

function onlySubjectAssignmentChanged(current: ContentDraft, baseline: ContentDraft) {
  if (JSON.stringify(current.subjectIds) === JSON.stringify(baseline.subjectIds)) return false;
  const currentWithoutSubjects = { ...current, subjectIds: [] };
  const baselineWithoutSubjects = { ...baseline, subjectIds: [] };
  return JSON.stringify(currentWithoutSubjects) === JSON.stringify(baselineWithoutSubjects);
}

function missingGuideContent(draft: ContentDraft) {
  if (draft.kind !== "guide") return [];
  const missing: string[] = [];
  const hasDocument = richTextDocumentHasBody(draft.content.document) ||
    (draft.content.sections.length > 0 && draft.content.sections.every(
      (section) => section.heading.trim() && section.body.trim(),
    ));
  const hasKeyPoints = draft.content.keyPoints.length > 0 &&
    draft.content.keyPoints.every((point) => point.trim());
  const hasQuestionnaire = draft.content.quiz.questions.length > 0 &&
    draft.content.quiz.questions.every(
      (question) => question.prompt.trim() && questionAnswer(question).trim(),
    );

  if (!hasDocument) missing.push("contenido de la guía");
  if (!hasKeyPoints) missing.push("puntos clave");
  if (!hasQuestionnaire) missing.push("cuestionario");
  return missing;
}
function signedPut(url: string, file: File, onProgress: (value: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("Content-Type", file.type);
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener("error", () => reject(new Error("La carga se interrumpió.")));
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error(`El archivo fue rechazado (${request.status}).`));
    });
    request.send(file);
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
  if (item.status === "archived" && capabilities.canPublish) {
    return [{ label: "Desarchivar", status: "published", tone: "primary" }];
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
  description?: string;
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
          {description && <small>{description}</small>}
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
        label="Editar contenido"
        onOpen={onOpenGuide}
      />
    );
  }
  if (draft.kind === "quiz") {
    return (
      <div className="studio-type-editor">
        <QuizQuestionsEditor
          title="Cuestionario"
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
      <h4>Contenido del tema</h4>
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

function SupportingMaterialFields() {
  const [ankiDeck, setAnkiDeck] = useState<File | null>(null);
  const [slideDeck, setSlideDeck] = useState<File | null>(null);

  return (
    <section className="studio-form-section studio-supporting-materials" aria-labelledby="studio-supporting-materials-title">
      <h4 id="studio-supporting-materials-title">Archivos complementarios</h4>
      <div className="studio-supporting-material-grid">
        <article className={slideDeck ? "has-file" : ""}>
          <label>
            <span className="studio-supporting-material-icon"><FilePdf aria-hidden="true" size={24} /></span>
            <span className="studio-supporting-material-copy">
              <strong>Diapositivas</strong>
              <small>{slideDeck?.name ?? "Adjuntar PDF"}</small>
            </span>
            <span className="studio-supporting-material-action">
              {slideDeck ? <CheckCircle aria-hidden="true" size={19} weight="fill" /> : <CloudArrowUp aria-hidden="true" size={19} />}
            </span>
            <input
              accept="application/pdf,.pdf"
              aria-label="Adjuntar PDF de diapositivas"
              type="file"
              onChange={(event) => setSlideDeck(event.target.files?.[0] ?? null)}
            />
          </label>
          {slideDeck && (
            <button aria-label="Quitar PDF de diapositivas" type="button" onClick={() => setSlideDeck(null)}>
              <X aria-hidden="true" size={15} />
            </button>
          )}
        </article>

        <article className={ankiDeck ? "has-file" : ""}>
          <label>
            <span className="studio-supporting-material-icon"><FileArchive aria-hidden="true" size={24} /></span>
            <span className="studio-supporting-material-copy">
              <strong>Mazo de Anki</strong>
              <small>{ankiDeck?.name ?? "Adjuntar APKG"}</small>
            </span>
            <span className="studio-supporting-material-action">
              {ankiDeck ? <CheckCircle aria-hidden="true" size={19} weight="fill" /> : <CloudArrowUp aria-hidden="true" size={19} />}
            </span>
            <input
              accept=".apkg,.colpkg,application/octet-stream"
              aria-label="Adjuntar mazo de Anki"
              type="file"
              onChange={(event) => setAnkiDeck(event.target.files?.[0] ?? null)}
            />
          </label>
          {ankiDeck && (
            <button aria-label="Quitar mazo de Anki" type="button" onClick={() => setAnkiDeck(null)}>
              <X aria-hidden="true" size={15} />
            </button>
          )}
        </article>
      </div>
    </section>
  );
}
export function ContentStudio({ initialWorkspace }: Props) {
  const [items, setItems] = useState(initialWorkspace.items);
  const [subjects, setSubjects] = useState(initialWorkspace.subjects);
  const [draft, setDraft] = useState<ContentDraft | null>(null);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [subjectCreateOpen, setSubjectCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | ContentKind>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | ContentStatus>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<PlatformNotice | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [guideEditing, setGuideEditing] = useState(false);
  const [guideCreateOpen, setGuideCreateOpen] = useState(false);
  const [linkedVideoId, setLinkedVideoId] = useState("");
  const [archiveConfirmationOpen, setArchiveConfirmationOpen] = useState(false);
  const [publicationsCollapsed, setPublicationsCollapsed] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const guideEntryDraftRef = useRef<ContentDraft | null>(null);
  const guideChoiceDialogRef = useRef<HTMLElement>(null);
  const guideChoiceTriggerRef = useRef<HTMLElement | null>(null);
  const capabilities = initialWorkspace.capabilities;
  const isAdministrator = initialWorkspace.roles.includes("administrator");
  const item = editingId ? items.find((current) => current.id === editingId) : undefined;

  const topicSuggestions = useMemo(
    () => topicsForSubjects(
      items,
      initialWorkspace.topics,
      draft?.subjectIds ?? [],
      !capabilities.canManageTaxonomy,
    ),
    [capabilities.canManageTaxonomy, draft?.subjectIds, initialWorkspace.topics, items],
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
  const guideVideoOptions = useMemo(() => {
    if (draft?.kind !== "guide") return linkableVideos;
    const selectedSubjects = new Set(draft.subjectIds);
    const candidates = linkableVideos.filter((video) =>
      selectedSubjects.size === 0 || video.subjectIds.some((id) => selectedSubjects.has(id)),
    );
    const current = draft.content.linkedVideoId
      ? items.find((value): value is ContentItem & { kind: "video" } =>
          value.kind === "video" && value.id === draft.content.linkedVideoId)
      : undefined;
    if (current && !candidates.some((video) => video.id === current.id)) candidates.push(current);
    return candidates.sort((left, right) => left.title.localeCompare(right.title, "es"));
  }, [draft, items, linkableVideos]);

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
    (draft?.kind !== "topic" || capabilities.canManageTaxonomy) &&
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

  const subjectOnlyAssignment = Boolean(
    !isNew &&
    item &&
    draft &&
    draftBaseline &&
    (item.status === "published" || item.status === "archived") &&
    onlySubjectAssignmentChanged(draft, draftBaseline),
  );
  const publishedPermittedUpdate = Boolean(
    !isNew &&
    item?.status === "published" &&
    draft &&
    draftBaseline &&
    isPublishedPermittedDraftUpdate(draft, draftBaseline),
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
    setArchiveConfirmationOpen(false);
    setNewSubjectName("");
    setSubjectCreateOpen(false);
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
    if (window.matchMedia("(max-width: 760px)").matches) {
      setPublicationsCollapsed(true);
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
      subjectIds: linkedVideo?.subjectIds ?? [],
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

  async function createSubject() {
    const name = newSubjectName.trim();
    if (!name || !editable || !capabilities.canManageTaxonomy || busy) return;
    setBusy("subject");
    setNotice(null);
    try {
      const response = await json<{ subject: unknown }>("/api/editor/subjects", {
        body: JSON.stringify({ name }),
        method: "POST",
      });
      const parsed = SubjectSchema.safeParse(response.subject);
      if (!parsed.success) throw new Error(errors.content_unavailable);
      setSubjects((current) =>
        [...current.filter((subject) => subject.id !== parsed.data.id), parsed.data]
          .sort((left, right) => left.name.localeCompare(right.name, "es")),
      );
      setDraft((current) =>
        current
          ? { ...current, subjectIds: Array.from(new Set([...current.subjectIds, parsed.data.id])) }
          : current,
      );
      setNewSubjectName("");
      setSubjectCreateOpen(false);
      setNotice({ text: `Materia “${parsed.data.name}” creada y seleccionada.`, tone: "success" });
    } catch (error) {
      setNotice({
        text: error instanceof Error ? error.message : "No fue posible crear la materia.",
        tone: "error",
      });
    } finally {
      setBusy(null);
    }
  }

  async function removeSubject(subject: Subject) {
    if (!capabilities.canManageTaxonomy || busy) return;
    const resourceLabel = subject.contentCount === 1
      ? "1 publicación dejará de estar clasificada en ella"
      : `${subject.contentCount} publicaciones dejarán de estar clasificadas en ella`;
    const confirmed = window.confirm(
      `¿Eliminar la materia “${subject.name}”?\n\n${resourceLabel}. Las publicaciones no se eliminarán. Esta acción no se puede deshacer.`,
    );
    if (!confirmed) return;

    setBusy(`subject-delete-${subject.id}`);
    setNotice(null);
    try {
      const deleted = await json<{ id: string }>(
        `/api/editor/subjects/${encodeURIComponent(subject.id)}`,
        { method: "DELETE" },
      );
      if (deleted.id !== subject.id) throw new Error(errors.content_unavailable);

      setSubjects((current) => current.filter((value) => value.id !== subject.id));
      setItems((current) => current.map((value) => ({
        ...value,
        subjectIds: value.subjectIds.filter((id) => id !== subject.id),
      })) as ContentItem[]);
      setDraft((current) => current
        ? { ...current, subjectIds: current.subjectIds.filter((id) => id !== subject.id) } as ContentDraft
        : current);
      setNotice({ text: `Materia “${subject.name}” eliminada. El contenido se conservó.`, tone: "success" });
    } catch (error) {
      setNotice({
        text: error instanceof Error ? error.message : "No fue posible eliminar la materia.",
        tone: "error",
      });
    } finally {
      setBusy(null);
    }
  }
  async function save(event?: FormEvent): Promise<boolean> {
    event?.preventDefault();
    if (!draft || !editable || busy) return false;
    if (!hasUnsavedChanges) return true;
    if (
      item &&
      !isNew &&
      ((item.status === "published" &&
        (!isAdministrator && (!capabilities.canEditAll || !publishedPermittedUpdate))) ||
        (item.status === "archived" && !capabilities.canPublish)) &&
      !subjectOnlyAssignment
    ) {
      setNotice({
        text: item.status === "published"
          ? capabilities.canEditAll
            ? "El contenido publicado sólo permite actualizar su título, materias, tema y video relacionado desde este editor."
            : "No tienes permisos para reorganizar contenido publicado."
          : "Sólo coordinación o administración pueden editar contenido archivado.",
        tone: "error",
      });
      return false;
    }

    setBusy("save");
    setNotice(null);

    try {
      const payload = prepareDraft(draft);
      const current = await contentItemJson(
        subjectOnlyAssignment
          ? `/api/editor/content/${encodeURIComponent(editingId!)}/subjects`
          : isNew
            ? "/api/editor/content"
            : `/api/editor/content/${encodeURIComponent(editingId!)}`,
        {
          body: JSON.stringify(subjectOnlyAssignment ? { subjectIds: payload.subjectIds } : payload),
          method: subjectOnlyAssignment || !isNew ? "PATCH" : "POST",
        },
      );
      upsert(current);
      setDraft(itemDraft(current));
      setEditingId(current.id);
      setIsNew(false);
      guideEntryDraftRef.current = itemDraft(current);
      const missing = missingGuideContent(payload);
      setNotice(missing.length > 0
        ? {
            text: `Contenido guardado. Para completar la guía faltan: ${missing.join(", ")}.`,
            tone: "warning",
          }
        : { text: "Contenido guardado.", tone: "success" });
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
    if (
      item.status === "archived" &&
      status === "published" &&
      !window.confirm("¿Desarchivar y volver a publicar este contenido?")
    ) return;
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
      if (status === "archived") setArchiveConfirmationOpen(false);
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

  async function removeContent() {
    if (!item || !["guide", "video"].includes(item.kind) || !capabilities.canDeleteContent || busy) return;
    const kindLabel = item.kind === "guide" ? "guía" : "video";
    const confirmed = window.confirm(
      `¿Eliminar permanentemente ${kindLabel === "guía" ? "la" : "el"} ${kindLabel} “${item.title}”?\n\nSe borrarán su contenido y sus archivos asociados. Esta acción no se puede deshacer.`,
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
      setNotice({ text: `${kindLabel === "guía" ? "Guía eliminada" : "Video eliminado"} permanentemente.`, tone: "success" });
    } catch (error) {
      setNotice({
        text: error instanceof Error ? error.message : `No fue posible eliminar ${kindLabel === "guía" ? "la guía" : "el video"}.`,
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

    if (selected) void upload(selected);
  }

  async function upload(selectedFile: File) {
    if (!draft || !editable || !capabilities.canUpload || busy) return;
    const isVideo = draft.kind === "video";
    const isGuide = draft.kind === "guide";
    const valid =
      (isVideo && ["video/mp4", "video/quicktime", "video/webm"].includes(selectedFile.type)) ||
      (isGuide && selectedFile.type === "application/pdf");

    if (!valid) {
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
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
            fileName: selectedFile.name,
            fileSizeBytes: selectedFile.size,
            kind: isVideo ? "video" : "document",
            mimeType: selectedFile.type as Mime,
          }),
          method: "POST",
        },
      );
      if (selectedFile.size > reservation.constraints.maxFileSizeBytes) {
        throw new Error("El archivo supera el límite permitido.");
      }
      await signedPut(reservation.upload.url, selectedFile, setProgress);
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
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      setNotice({
        text: error instanceof Error ? error.message : "No fue posible cargar el archivo.",
        tone: "error",
      });
    } finally {
      setBusy(null);
    }
  }

  async function removeAsset() {
    const asset = item?.asset;
    if (!item || !asset || !editable || !capabilities.canUpload || busy) return;
    if (item.status === "published") {
      setNotice({
        text: "Archiva el video antes de quitar el archivo para no dejar una publicación activa incompleta.",
        tone: "warning",
      });
      return;
    }
    if (!window.confirm(`¿Quitar el video “${asset.fileName}”? Esta acción no se puede deshacer.`)) return;

    setBusy("asset-delete");
    setNotice(null);
    try {
      const updated = await contentItemJson(
        `/api/editor/assets/${encodeURIComponent(asset.id)}`,
        { method: "DELETE" },
      );
      upsert(updated);
      setFile(null);
      setProgress(0);
      if (fileRef.current) fileRef.current.value = "";
      setNotice({ text: "Video eliminado del contenido.", tone: "success" });
    } catch (error) {
      setNotice({
        text: error instanceof Error ? error.message : "No fue posible quitar el video.",
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
          label: "Cuestionario",
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
  const videoReadyCount = videoChecklist.filter((requirement) => requirement.ready).length;
  const videoNextStepIndex = videoChecklist.findIndex((requirement) => !requirement.ready);

  if (guideEditing && draft && (draft.kind === "guide" || draft.kind === "video")) {
    return (
      <AppShell
        activeKey="editor"
        isAdministrator={initialWorkspace.roles.includes("administrator")}
        headerTitle="Editor de guía"
        mainClassName="guide-editor-main"
      >
        <GuideEditorScreen
          key={`${editingId ?? "new"}-${draft.kind}`}
          busy={busy !== null}
          draft={draft}
          editable={editable && (item?.status !== "archived" || capabilities.canPublish)}
          hasUnsavedChanges={hasUnsavedChanges}
          isNew={isNew}
          notice={notice}
          onDismissNotice={() => setNotice(null)}
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
      isAdministrator={initialWorkspace.roles.includes("administrator")}
      headerTitle="Contenido"
      mainClassName="studio-main"
    >
      <PlatformToast notice={notice} onDismiss={() => setNotice(null)} />
      <header className="studio-heading">
        <div>
          <h2>Publicar contenido</h2>
        </div>
        {capabilities.canCreate && (
          <div className="studio-create-actions" aria-label="Crear contenido">
            {primaryKinds.map((option) => {
              const CreateIcon = kindIcons[option.value];
              return (
                <button
                  aria-label={`Crear ${option.label.toLocaleLowerCase("es")}`}
                  className="studio-create-button"
                  disabled={busy !== null}
                  key={option.value}
                  title={`Crear ${option.label.toLocaleLowerCase("es")}`}
                  type="button"
                  onClick={() => create(option.value)}
                >
                  <CreateIcon aria-hidden="true" size={18} weight="bold" />
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </header>

      <div className="studio-toolbar" role="search">
        <label className="studio-search">
          <MagnifyingGlass aria-hidden="true" size={18} />
          <input
            aria-label="Buscar contenido"
            placeholder="Buscar por título, región o slug…"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="studio-filter-section">
          <span className="studio-filter-label">Tipo</span>
          <div className="studio-kind-filters" role="group" aria-label="Filtrar por tipo">
            {([
              { label: "Todo", value: "all" },
              { label: "Videos", value: "video" },
              { label: "Guías", value: "guide" },
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
        </div>
        <label className="studio-kind-select">
          <span className="sr-only">Filtrar por tipo</span>
          <select
            aria-label="Filtrar por tipo"
            value={kindFilter}
            onChange={(event) => setKindFilter(event.target.value as "all" | ContentKind)}
          >
            <option value="all">Todos los tipos</option>
            <option value="video">Videos</option>
            <option value="guide">Guías</option>
          </select>
        </label>
        <label className="studio-status-filter">
          <FunnelSimple aria-hidden="true" size={17} />
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
              <div className="studio-empty">
                <Notebook size={30} />
                <h3>Elige o crea una publicación</h3>
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
                      aria-label={action.label}
                      className={`studio-button studio-editor-action studio-button-${action.tone}${action.status === "archived" ? " is-icon-only" : ""}`}
                      disabled={
                        busy !== null ||
                        (draft.kind === "video" &&
                          (action.status === "in_review" || action.status === "published") &&
                          !videoComplete)
                      }
                      key={action.status}
                      title={
                        draft.kind === "video" && !videoComplete
                          ? "Completa el video, los puntos clave, la guía y el cuestionario"
                          : action.label
                      }
                      type="button"
                      onClick={() => action.status === "archived"
                        ? setArchiveConfirmationOpen(true)
                        : void transition(action.status)}
                    >
                      {action.status === "archived"
                        ? <Archive aria-hidden="true" size={17} />
                        : action.label}
                    </button>
                  ))}
                  {item && ["guide", "video"].includes(item.kind) && capabilities.canDeleteContent && (
                    <button
                      aria-label={`Eliminar ${item.kind === "guide" ? "guía" : "video"} ${item.title}`}
                      className="studio-button studio-editor-action studio-content-delete"
                      disabled={busy !== null}
                      title={`Eliminar ${item.kind === "guide" ? "guía" : "video"} permanentemente`}
                      type="button"
                      onClick={() => void removeContent()}
                    >
                      <Trash aria-hidden="true" size={16} />
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
                <section className="studio-package-roadmap" aria-label="Preparación del video">
                  <header>
                    <strong>Preparación del video</strong>
                    <span>{videoReadyCount}/{videoChecklist.length} completado</span>
                  </header>
                  <ol>
                    {videoChecklist.map((requirement, index) => {
                      return (
                        <li
                          aria-label={`${requirement.label}: ${requirement.ready ? "completo" : "pendiente"}`}
                          className={`${requirement.ready ? "is-ready" : ""}${index === videoNextStepIndex ? " is-current" : ""}`.trim()}
                          key={requirement.label}
                        >
                          <span>{requirement.ready ? <Check aria-hidden="true" size={13} weight="bold" /> : index + 1}</span>
                          <small>{requirement.label}</small>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              )}

              {contentAssetUploadsEnabled && accepts && capabilities.canUpload && editable && (
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
                    {item?.asset && (
                      <button
                        aria-label={`Quitar video ${item.asset.fileName}`}
                        className="studio-asset-remove"
                        disabled={busy !== null}
                        title="Quitar video"
                        type="button"
                        onClick={() => void removeAsset()}
                      >
                        <Trash aria-hidden="true" size={16} />
                        <span>{busy === "asset-delete" ? "Quitando…" : "Quitar"}</span>
                      </button>
                    )}
                  </div>
                  <label className={`studio-upload-zone ${file ? "has-file" : ""}`}>
                    <CloudArrowUp size={24} />
                    <span>{file ? file.name : item?.asset ? "Reemplazar video" : "Adjuntar video"}</span>
                    <small>{busy === "upload" ? `Subiendo automáticamente · ${progress}%` : "MP4, MOV o WebM · carga automática"}</small>
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
                      <section className="studio-subject-assignment studio-field-wide" aria-labelledby="studio-subject-title">
                        <div className="studio-subject-heading">
                          <div>
                            <h5 id="studio-subject-title">Materias</h5>
                          </div>
                        </div>
                        <div className="studio-subject-options" role="group" aria-label="Materias del contenido">
                          {subjects.map((subject) => (
                            <div className="studio-subject-option-row" key={subject.id}>
                              <label className={`studio-subject-option ${draft.subjectIds.includes(subject.id) ? "is-selected" : ""}`.trim()}>
                                <input
                                  checked={draft.subjectIds.includes(subject.id)}
                                  type="checkbox"
                                  onChange={(event) => setDraft((current) => {
                                    if (!current) return current;
                                    const nextSubjectIds = event.target.checked
                                      ? Array.from(new Set([...current.subjectIds, subject.id]))
                                      : current.subjectIds.filter((id) => id !== subject.id);
                                    const currentTopics = uniqueRegions(
                                      current.content.regions.length > 0
                                        ? current.content.regions
                                        : [current.topic],
                                    );
                                    const previousTopics = topicsForSubjects(
                                      items,
                                      initialWorkspace.topics,
                                      current.subjectIds,
                                      !capabilities.canManageTaxonomy,
                                    );
                                    const nextTopics = topicsForSubjects(
                                      items,
                                      initialWorkspace.topics,
                                      nextSubjectIds,
                                      !capabilities.canManageTaxonomy,
                                    );
                                    const nextRegions = nextSubjectIds.length > 0
                                      ? currentTopics.filter((currentTopic) => {
                                          const topicWasExisting = previousTopics.some(
                                            (value) => normalizeSearch(value) === normalizeSearch(currentTopic),
                                          );
                                          const topicStillAvailable = nextTopics.some(
                                            (value) => normalizeSearch(value) === normalizeSearch(currentTopic),
                                          );
                                          return topicStillAvailable || !topicWasExisting;
                                        })
                                      : [];
                                    return {
                                      ...current,
                                      subjectIds: nextSubjectIds,
                                      topic: nextRegions[0] ?? "",
                                      content: { ...current.content, regions: nextRegions },
                                    } as ContentDraft;
                                  })}
                                />
                                <span>
                                  <strong>{subject.name}</strong>
                                  <small>{subject.contentCount} recursos</small>
                                </span>
                              </label>
                              {capabilities.canManageTaxonomy && (
                                <button
                                  aria-label={`Eliminar materia ${subject.name}`}
                                  className="studio-subject-delete"
                                  disabled={busy !== null}
                                  title={`Eliminar ${subject.name}`}
                                  type="button"
                                  onClick={() => void removeSubject(subject)}
                                >
                                  <Trash aria-hidden="true" size={15} />
                                </button>
                              )}
                            </div>
                          ))}
                          {subjects.length === 0 && (
                            <p className="studio-subject-empty">
                              {capabilities.canManageTaxonomy
                                ? "Crea la primera materia para organizar el contenido."
                                : "Administración aún no ha creado materias disponibles."}
                            </p>
                          )}
                        </div>
                        {capabilities.canManageTaxonomy && (
                          <div className="studio-new-subject">
                            <button
                              className="studio-entity-create-button studio-entity-create-button-primary"
                              disabled={!editable || busy !== null}
                              type="button"
                              onClick={() => setSubjectCreateOpen(true)}
                            >
                              <Plus aria-hidden="true" size={16} /> Nueva materia
                            </button>
                          </div>
                        )}
                      </section>
                      <TopicSelector
                        allowCreate={capabilities.canManageTaxonomy}
                        disabled={!editable || busy !== null}
                        subjectSelected={draft.subjectIds.length > 0}
                        suggestions={topicSuggestions}
                        values={draft.content.regions.length > 0
                          ? draft.content.regions
                          : draft.topic ? [draft.topic] : []}
                        onChange={(regions) =>
                          setDraft({
                            ...draft,
                            topic: regions[0] ?? "",
                            content: { ...draft.content, regions },
                          } as ContentDraft)
                        }
                      />
                      {draft.kind === "guide" && (
                        <label className="studio-field studio-field-wide studio-linked-video-field">
                          <span>Video relacionado</span>
                          <select
                            value={draft.content.linkedVideoId ?? ""}
                            onChange={(event) => setDraft({
                              ...draft,
                              content: {
                                ...draft.content,
                                linkedVideoId: event.target.value || null,
                              },
                            })}
                          >
                            <option value="">Sin video relacionado</option>
                            {guideVideoOptions.map((video) => (
                              <option key={video.id} value={video.id}>
                                {video.title} · {labelOf(statuses, video.status)}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    </div>
                  </section>

                  {draft.kind === "video" && (
                    <SupportingMaterialFields key={`${editingId ?? "new"}-supporting-materials`} />
                  )}

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

      <StudioNameDialog
        busy={busy === "subject"}
        description="La nueva materia quedará seleccionada automáticamente en este contenido."
        icon={<GraduationCap size={22} />}
        inputLabel="Nombre de la materia"
        maxLength={120}
        open={subjectCreateOpen}
        placeholder="Ej. Anatomía"
        submitLabel="Crear materia"
        title="Nueva materia"
        value={newSubjectName}
        onChange={setNewSubjectName}
        onClose={() => {
          setSubjectCreateOpen(false);
          setNewSubjectName("");
        }}
        onSubmit={createSubject}
      />

      <StudioConfirmDialog
        busy={busy === "transition"}
        confirmLabel="Archivar"
        description={`“${item?.title ?? "Esta publicación"}” dejará de estar visible para los estudiantes. Podrás volver a publicarla más adelante.`}
        icon={<Archive size={24} />}
        open={archiveConfirmationOpen && Boolean(item)}
        title="¿Archivar esta publicación?"
        onClose={() => setArchiveConfirmationOpen(false)}
        onConfirm={() => transition("archived")}
      />

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
