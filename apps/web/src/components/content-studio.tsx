"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useMemo, useRef, useState } from "react";
import {
  Check,
  CheckCircle,
  CloudArrowUp,
  Compass,
  FilePdf,
  FileVideo,
  MagnifyingGlass,
  Notebook,
  PlayCircle,
  Plus,
  Question,
  Trash,
  X,
} from "@phosphor-icons/react";
import type {
  ContentAssetUploadResponse,
  ContentDraft,
  ContentItem,
  ContentKind,
  ContentStatus,
  ContentWorkspaceResponse,
} from "@cediah/contracts";
import { AppShell } from "./app-shell";

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
  { icon: PlayCircle, label: "Nuevo video", value: "video" },
  { icon: Notebook, label: "Nueva guía", value: "guide" },
  { icon: Compass, label: "Nuevo tema", value: "topic" },
] satisfies { icon: typeof PlayCircle; label: string; value: ContentKind }[];

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

function summaryFromText(value: string) {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > 280 ? compact.slice(0, 277).trimEnd() + "…" : compact;
}

function prepareDraft(draft: ContentDraft): ContentDraft {
  const slug = draft.slug || slugify(draft.title) || `contenido-${Date.now().toString(36)}`;

  if (draft.kind === "video") {
    return {
      ...draft,
      slug,
      content: {
        ...draft.content,
        description: draft.content.description.trim() || draft.summary.trim(),
      },
    };
  }
  return { ...draft, slug };
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
        guide: { sections: [] },
        keyPoints: [],
        quiz: { questions: [] },
      },
    };
  }
  if (kind === "guide") {
    return { ...base, kind, content: { sections: [] } };
  }
  if (kind === "quiz") {
    return {
      ...base,
      kind,
      content: {
        questions: [{ correctOptionIndex: 0, explanation: "", options: ["", ""], prompt: "" }],
      },
    };
  }
  if (kind === "flashcards") {
    return { ...base, kind, content: { cards: [{ back: "", front: "" }] } };
  }
  return { ...base, kind: "topic", content: { introduction: "", objectives: [] } };
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

type GuideSection = Extract<ContentDraft, { kind: "guide" }>["content"]["sections"][number];
type QuizQuestion = Extract<ContentDraft, { kind: "quiz" }>["content"]["questions"][number];

function GuideSectionsEditor({
  sections,
  onChange,
  title,
}: {
  sections: GuideSection[];
  onChange: (sections: GuideSection[]) => void;
  title: string;
}) {
  return (
    <section className="studio-builder" aria-label={title}>
      <header className="studio-builder-heading">
        <div>
          <Notebook size={19} />
          <h4>{title}</h4>
        </div>
        <span>{sections.length} {sections.length === 1 ? "sección" : "secciones"}</span>
      </header>
      {sections.map((section, index) => (
        <article className="studio-repeater" key={index}>
          <header>
            <strong>Sección {index + 1}</strong>
            <button
              aria-label={`Eliminar sección ${index + 1}`}
              type="button"
              onClick={() => onChange(sections.filter((_, position) => position !== index))}
            >
              <Trash size={16} />
            </button>
          </header>
          <label className="studio-field">
            <span>Título de la sección</span>
            <input
              required
              maxLength={200}
              value={section.heading}
              onChange={(event) =>
                onChange(
                  sections.map((current, position) =>
                    position === index ? { ...current, heading: event.target.value } : current,
                  ),
                )
              }
            />
          </label>
          <label className="studio-field">
            <span>Contenido</span>
            <textarea
              required
              maxLength={30000}
              rows={6}
              value={section.body}
              onChange={(event) =>
                onChange(
                  sections.map((current, position) =>
                    position === index ? { ...current, body: event.target.value } : current,
                  ),
                )
              }
            />
          </label>
        </article>
      ))}
      {sections.length === 0 && (
        <button
          className="studio-builder-empty"
          type="button"
          onClick={() => onChange([{ body: "", heading: "" }])}
        >
          <Plus size={19} />
          <span>Añadir la primera sección</span>
        </button>
      )}
      {sections.length > 0 && (
        <button
          className="studio-add"
          disabled={sections.length >= 100}
          type="button"
          onClick={() => onChange([...sections, { body: "", heading: "" }])}
        >
          <Plus size={16} /> Añadir sección
        </button>
      )}
    </section>
  );
}

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
    <section className="studio-builder" aria-label={title}>
      <header className="studio-builder-heading">
        <div>
          <Question size={19} />
          <h4>{title}</h4>
        </div>
        <span>{questions.length} {questions.length === 1 ? "pregunta" : "preguntas"}</span>
      </header>
      {questions.map((question, questionIndex) => (
        <article className="studio-repeater" key={questionIndex}>
          <header>
            <strong>Pregunta {questionIndex + 1}</strong>
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
          <div className="studio-options">
            <strong>Respuestas</strong>
            {question.options.map((option, optionIndex) => (
              <div className="studio-option" key={optionIndex}>
                <input
                  aria-label={`Marcar respuesta ${optionIndex + 1} como correcta`}
                  checked={question.correctOptionIndex === optionIndex}
                  name={`correct-${questionIndex}`}
                  type="radio"
                  onChange={() => updateQuestion(questionIndex, { correctOptionIndex: optionIndex })}
                />
                <input
                  required
                  aria-label={`Respuesta ${optionIndex + 1}`}
                  maxLength={500}
                  placeholder={`Respuesta ${optionIndex + 1}`}
                  value={option}
                  onChange={(event) =>
                    updateQuestion(questionIndex, {
                      options: question.options.map((current, index) =>
                        index === optionIndex ? event.target.value : current,
                      ),
                    })
                  }
                />
                <button
                  aria-label={`Eliminar respuesta ${optionIndex + 1}`}
                  disabled={question.options.length <= 2}
                  type="button"
                  onClick={() => {
                    const options = question.options.filter((_, index) => index !== optionIndex);
                    const currentCorrectOptionIndex = question.correctOptionIndex;
                    const correctOptionIndex =
                      optionIndex < currentCorrectOptionIndex
                        ? currentCorrectOptionIndex - 1
                        : optionIndex === currentCorrectOptionIndex
                          ? Math.min(optionIndex, options.length - 1)
                          : currentCorrectOptionIndex;
                    updateQuestion(questionIndex, {
                      correctOptionIndex,
                      options,
                    });
                  }}
                >
                  <Trash size={16} />
                </button>
              </div>
            ))}
            <button
              className="studio-add"
              disabled={question.options.length >= 8}
              type="button"
              onClick={() => updateQuestion(questionIndex, { options: [...question.options, ""] })}
            >
              <Plus size={16} /> Añadir respuesta
            </button>
          </div>
          <label className="studio-field">
            <span>Explicación de la respuesta</span>
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

function TypeEditor({
  draft,
  onChange,
}: {
  draft: ContentDraft;
  onChange: (draft: ContentDraft) => void;
}) {
  if (draft.kind === "video") {
    return (
      <div className="studio-type-editor studio-video-resources">
        <section className="studio-builder" aria-label="Puntos clave">
          <header className="studio-builder-heading">
            <div>
              <CheckCircle size={19} />
              <h4>Puntos clave</h4>
            </div>
            <span>{draft.content.keyPoints.length}</span>
          </header>
          <StringList
            label="Puntos clave"
            max={30}
            showLabel={false}
            values={draft.content.keyPoints}
            onChange={(keyPoints) =>
              onChange({ ...draft, content: { ...draft.content, keyPoints } })
            }
          />
        </section>
        <GuideSectionsEditor
          title="Guía del video"
          sections={draft.content.guide.sections}
          onChange={(sections) =>
            onChange({
              ...draft,
              content: { ...draft.content, guide: { sections } },
            })
          }
        />
        <QuizQuestionsEditor
          allowEmpty
          title="Cuestionario del video"
          questions={draft.content.quiz.questions}
          onChange={(questions) =>
            onChange({
              ...draft,
              content: { ...draft.content, quiz: { questions } },
            })
          }
        />
      </div>
    );
  }

  if (draft.kind === "guide") {
    return (
      <div className="studio-type-editor">
        <GuideSectionsEditor
          title="Contenido de la guía"
          sections={draft.content.sections}
          onChange={(sections) => onChange({ ...draft, content: { sections } })}
        />
      </div>
    );
  }
  if (draft.kind === "quiz") {
    return (
      <div className="studio-type-editor">
        <QuizQuestionsEditor
          title="Preguntas del cuestionario"
          questions={draft.content.questions}
          onChange={(questions) => onChange({ ...draft, content: { questions } })}
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
                      content: { cards: draft.content.cards.filter((_, position) => position !== index) },
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
              content: { cards: [...draft.content.cards, { back: "", front: "" }] },
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
  const fileRef = useRef<HTMLInputElement>(null);
  const capabilities = initialWorkspace.capabilities;
  const item = editingId ? items.find((current) => current.id === editingId) : undefined;

  const visibleItems = useMemo(() => {
    const text = query.trim().toLocaleLowerCase("es");
    return [...items]
      .filter((current) => {
        const haystack = `${current.title} ${current.summary} ${current.topic} ${current.slug}`
          .toLocaleLowerCase("es");
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
    (isNew ||
      Boolean(
        item &&
          item.status !== "published" &&
          item.status !== "archived" &&
          (capabilities.canCreate || capabilities.canEditAll),
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
  }

  function create(kind: ContentKind = "video") {
    if (busy) return;
    if (!confirmDiscard()) return;
    setDraft(emptyDraft(kind));
    setEditingId(null);
    setIsNew(true);
    resetFeedback();
  }

  function close() {
    if (busy || !confirmDiscard()) return;
    setDraft(null);
    setEditingId(null);
    setIsNew(false);
    resetFeedback();
  }

  function upsert(current: ContentItem) {
    setItems((existing) => [current, ...existing.filter((value) => value.id !== current.id)]);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft || !editable || busy) return;
    setBusy("save");
    setNotice(null);

    try {
      const payload = prepareDraft(draft);
      const current = await json<ContentItem>(
        isNew ? "/api/editor/content" : `/api/editor/content/${encodeURIComponent(editingId!)}`,
        { body: JSON.stringify(payload), method: isNew ? "POST" : "PATCH" },
      );
      upsert(current);
      setDraft(itemDraft(current));
      setEditingId(current.id);
      setIsNew(false);
      setNotice({ text: "Contenido guardado.", tone: "success" });
    } catch (error) {
      setNotice({
        text: error instanceof Error ? error.message : "No fue posible guardar.",
        tone: "error",
      });
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
      const current = await json<ContentItem>(
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
        (await json<ContentItem>("/api/editor/content", {
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
  const accepts =
    draft?.kind === "video"
      ? "video/mp4,video/quicktime,video/webm"
      : draft?.kind === "guide"
        ? "application/pdf"
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
            draft.content.guide.sections.length > 0 &&
            draft.content.guide.sections.every(
              (section) => section.heading.trim().length > 0 && section.body.trim().length > 0,
            ),
        },
        {
          icon: Question,
          label: "Cuestionario",
          ready:
            draft.content.quiz.questions.length > 0 &&
            draft.content.quiz.questions.every(
              (question) =>
                question.prompt.trim().length > 0 &&
                question.options.length >= 2 &&
                question.options.every((option) => option.trim().length > 0) &&
                question.correctOptionIndex >= 0 &&
                question.correctOptionIndex < question.options.length,
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
          <p>{items.length} {items.length === 1 ? "publicación" : "publicaciones"}</p>
        </div>
        {capabilities.canCreate && (
          <div className="studio-create-actions" aria-label="Crear contenido">
            {primaryKinds.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  className="studio-create-button"
                  disabled={busy !== null}
                  key={option.value}
                  type="button"
                  onClick={() => create(option.value)}
                >
                  <Icon size={18} /> {option.label}
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

      <div className="studio-workspace">
        <aside className="studio-items" aria-label="Contenido disponible">
          <strong>{visibleItems.length} {visibleItems.length === 1 ? "resultado" : "resultados"}</strong>
          {visibleItems.map((current) => (
            <button
              aria-pressed={item?.id === current.id}
              className={`studio-item ${item?.id === current.id ? "studio-item-active" : ""}`}
              disabled={busy !== null}
              key={current.id}
              type="button"
              onClick={() => open(current)}
            >
              <span className={`studio-kind studio-kind-${current.kind}`}>
                {labelOf(kinds, current.kind)}
              </span>
              <strong>{current.title}</strong>
              <small>{current.topic}</small>
              <span className={`studio-badge studio-badge-${current.status}`}>
                {labelOf(statuses, current.status)}
              </span>
            </button>
          ))}
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
            <div className="studio-empty">
              <Notebook size={30} />
              <h3>Elige una publicación</h3>
            </div>
          ) : (
            <>
              <header className="studio-editor-heading">
                <div>
                  <small>{labelOf(kinds, draft.kind)}</small>
                  <h3>{isNew ? `Nuevo ${labelOf(kinds, draft.kind).toLocaleLowerCase("es")}` : draft.title}</h3>
                </div>
                {item && (
                  <span className={`studio-badge studio-editor-status studio-badge-${item.status}`}>
                    {labelOf(statuses, item.status)}
                  </span>
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
                      {draft.kind === "video" ? <FileVideo size={22} /> : <FilePdf size={22} />}
                    </span>
                    <div>
                      <h4 id="studio-upload-title">{draft.kind === "video" ? "Video" : "Archivo PDF"}</h4>
                      {item?.asset && (
                        <p className="studio-current-file">
                          <CheckCircle size={15} weight="fill" /> {item.asset.fileName}
                        </p>
                      )}
                    </div>
                  </div>
                  <label className={`studio-upload-zone ${file ? "has-file" : ""}`}>
                    <CloudArrowUp size={24} />
                    <span>{file ? file.name : draft.kind === "video" ? "Seleccionar video" : "Seleccionar PDF"}</span>
                    <small>{draft.kind === "video" ? "MP4, MOV o WebM" : "PDF"}</small>
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
                    {busy === "upload"
                      ? "Subiendo..."
                      : draft.kind === "video"
                        ? "Subir video"
                        : "Subir PDF"}
                  </button>
                </section>
              )}

              <form onSubmit={save}>
                <fieldset disabled={!editable || busy !== null}>
                  <section className="studio-form-section">
                    <h4>Información básica</h4>
                    <div className="studio-form-grid">
                      <label className="studio-field">
                        <span>Título</span>
                        <input
                          required
                          autoFocus={isNew}
                          maxLength={200}
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
                      <label className="studio-field">
                        <span>Región anatómica</span>
                        <input
                          required
                          maxLength={120}
                          value={draft.topic}
                          onChange={(event) =>
                            setDraft({ ...draft, topic: event.target.value } as ContentDraft)
                          }
                        />
                      </label>
                      {draft.kind !== "topic" && (
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

                  <TypeEditor draft={draft} onChange={setDraft} />
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

              {item && (
                <footer className="studio-workflow">
                  <strong>Estado: {labelOf(statuses, item.status)}</strong>
                  <div>
                    {actions.map((action) => (
                      <button
                        className={`studio-button studio-button-${action.tone}`}
                        disabled={
                          busy !== null ||
                          (draft.kind === "video" &&
                            (action.status === "in_review" || action.status === "published") &&
                            !videoComplete)
                        }
                        key={action.status}
                        type="button"
                        title={
                          draft.kind === "video" && !videoComplete
                            ? "Completa video, puntos clave, guía y cuestionario"
                            : undefined
                        }
                        onClick={() => transition(action.status)}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </footer>
              )}
            </>
          )}
        </section>
      </div>
    </AppShell>
  );
}
