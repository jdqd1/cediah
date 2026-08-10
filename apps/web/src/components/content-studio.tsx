"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useMemo, useRef, useState } from "react";
import { CloudArrowUp, MagnifyingGlass, Plus, Trash, X } from "@phosphor-icons/react";
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
  { label: "Tema", value: "topic" },
];

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
      content: { description: "", durationSeconds: null, externalUrl: null, keyPoints: [] },
    };
  }
  if (kind === "guide") {
    return { ...base, kind, content: { sections: [{ body: "", heading: "" }] } };
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
  values,
  onChange,
}: {
  label: string;
  max: number;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <div className="studio-list-editor">
      <strong>{label}</strong>
      {values.map((value, index) => (
        <div className="studio-inline-row" key={index}>
          <input
            maxLength={500}
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

function TypeEditor({
  draft,
  onChange,
}: {
  draft: ContentDraft;
  onChange: (draft: ContentDraft) => void;
}) {
  if (draft.kind === "video") {
    return (
      <section className="studio-type-editor">
        <h4>Contenido del video</h4>
        <label className="studio-field">
          <span>Descripción</span>
          <textarea
            required
            maxLength={10000}
            rows={5}
            value={draft.content.description}
            onChange={(event) =>
              onChange({ ...draft, content: { ...draft.content, description: event.target.value } })
            }
          />
        </label>
        <div className="studio-form-grid">
          <label className="studio-field">
            <span>Duración en segundos</span>
            <input
              min={0}
              max={86400}
              type="number"
              value={draft.content.durationSeconds ?? ""}
              onChange={(event) =>
                onChange({
                  ...draft,
                  content: {
                    ...draft.content,
                    durationSeconds: event.target.value === "" ? null : Number(event.target.value),
                  },
                })
              }
            />
          </label>
          <label className="studio-field">
            <span>URL externa HTTPS</span>
            <input
              type="url"
              placeholder="https://..."
              value={draft.content.externalUrl ?? ""}
              onChange={(event) =>
                onChange({
                  ...draft,
                  content: { ...draft.content, externalUrl: event.target.value || null },
                })
              }
            />
          </label>
        </div>
        <StringList
          label="Puntos clave"
          max={30}
          values={draft.content.keyPoints}
          onChange={(keyPoints) => onChange({ ...draft, content: { ...draft.content, keyPoints } })}
        />
      </section>
    );
  }

  if (draft.kind === "guide") {
    return (
      <section className="studio-type-editor">
        <h4>Secciones de la guía</h4>
        {draft.content.sections.map((section, index) => (
          <article className="studio-repeater" key={index}>
            <header>
              <strong>Sección {index + 1}</strong>
              <button
                aria-label={`Eliminar sección ${index + 1}`}
                disabled={draft.content.sections.length === 1}
                type="button"
                onClick={() =>
                  onChange({
                    ...draft,
                    content: { sections: draft.content.sections.filter((_, position) => position !== index) },
                  })
                }
              >
                <Trash size={16} />
              </button>
            </header>
            <label className="studio-field">
              <span>Encabezado</span>
              <input
                required
                maxLength={200}
                value={section.heading}
                onChange={(event) =>
                  onChange({
                    ...draft,
                    content: {
                      sections: draft.content.sections.map((current, position) =>
                        position === index ? { ...current, heading: event.target.value } : current,
                      ),
                    },
                  })
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
                  onChange({
                    ...draft,
                    content: {
                      sections: draft.content.sections.map((current, position) =>
                        position === index ? { ...current, body: event.target.value } : current,
                      ),
                    },
                  })
                }
              />
            </label>
          </article>
        ))}
        <button
          className="studio-add"
          disabled={draft.content.sections.length >= 100}
          type="button"
          onClick={() =>
            onChange({
              ...draft,
              content: { sections: [...draft.content.sections, { body: "", heading: "" }] },
            })
          }
        >
          <Plus size={16} /> Añadir sección
        </button>
      </section>
    );
  }
  if (draft.kind === "quiz") {
    const updateQuestion = (
      index: number,
      patch: Partial<(typeof draft.content.questions)[number]>,
    ) =>
      onChange({
        ...draft,
        content: {
          questions: draft.content.questions.map((question, position) =>
            position === index ? { ...question, ...patch } : question,
          ),
        },
      });

    return (
      <section className="studio-type-editor">
        <h4>Preguntas del cuestionario</h4>
        {draft.content.questions.map((question, questionIndex) => (
          <article className="studio-repeater" key={questionIndex}>
            <header>
              <strong>Pregunta {questionIndex + 1}</strong>
              <button
                aria-label={`Eliminar pregunta ${questionIndex + 1}`}
                disabled={draft.content.questions.length === 1}
                type="button"
                onClick={() =>
                  onChange({
                    ...draft,
                    content: {
                      questions: draft.content.questions.filter((_, index) => index !== questionIndex),
                    },
                  })
                }
              >
                <Trash size={16} />
              </button>
            </header>
            <label className="studio-field">
              <span>Enunciado</span>
              <textarea
                required
                maxLength={2000}
                rows={3}
                value={question.prompt}
                onChange={(event) => updateQuestion(questionIndex, { prompt: event.target.value })}
              />
            </label>
            <div className="studio-options">
              <strong>Opciones y respuesta correcta</strong>
              {question.options.map((option, optionIndex) => (
                <div className="studio-option" key={optionIndex}>
                  <input
                    aria-label={`Opción correcta ${optionIndex + 1}`}
                    checked={question.correctOptionIndex === optionIndex}
                    name={`correct-${questionIndex}`}
                    type="radio"
                    onChange={() => updateQuestion(questionIndex, { correctOptionIndex: optionIndex })}
                  />
                  <input
                    required
                    maxLength={500}
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
                    aria-label={`Eliminar opción ${optionIndex + 1}`}
                    disabled={question.options.length <= 2}
                    type="button"
                    onClick={() => {
                      const options = question.options.filter((_, index) => index !== optionIndex);
                      updateQuestion(questionIndex, {
                        correctOptionIndex: Math.min(question.correctOptionIndex, options.length - 1),
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
                onClick={() =>
                  updateQuestion(questionIndex, { options: [...question.options, ""] })
                }
              >
                <Plus size={16} /> Añadir opción
              </button>
            </div>
            <label className="studio-field">
              <span>Explicación</span>
              <textarea
                maxLength={4000}
                rows={3}
                value={question.explanation}
                onChange={(event) =>
                  updateQuestion(questionIndex, { explanation: event.target.value })
                }
              />
            </label>
          </article>
        ))}
        <button
          className="studio-add"
          disabled={draft.content.questions.length >= 100}
          type="button"
          onClick={() =>
            onChange({
              ...draft,
              content: {
                questions: [
                  ...draft.content.questions,
                  { correctOptionIndex: 0, explanation: "", options: ["", ""], prompt: "" },
                ],
              },
            })
          }
        >
          <Plus size={16} /> Añadir pregunta
        </button>
      </section>
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
      <h4>Contenido del tema</h4>
      <label className="studio-field">
        <span>Introducción</span>
        <textarea
          required
          maxLength={20000}
          rows={7}
          value={draft.content.introduction}
          onChange={(event) =>
            onChange({
              ...draft,
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

  function resetFeedback() {
    setNotice(null);
    setFile(null);
    setProgress(0);
    if (fileRef.current) fileRef.current.value = "";
  }

  function open(current: ContentItem) {
    setDraft(itemDraft(current));
    setEditingId(current.id);
    setIsNew(false);
    resetFeedback();
  }

  function create(kind: ContentKind = "video") {
    setDraft(emptyDraft(kind));
    setEditingId(null);
    setIsNew(true);
    resetFeedback();
  }

  function upsert(current: ContentItem) {
    setItems((existing) => [current, ...existing.filter((value) => value.id !== current.id)]);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft || !editable) return;
    setBusy("save");
    setNotice(null);

    try {
      const current = await json<ContentItem>(
        isNew ? "/api/editor/content" : `/api/editor/content/${encodeURIComponent(editingId!)}`,
        { body: JSON.stringify(draft), method: isNew ? "POST" : "PATCH" },
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
    if (!item) return;
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
    setFile(event.target.files?.[0] ?? null);
    setProgress(0);
    setNotice(null);
  }

  async function upload() {
    if (!item || !draft || !file || !editable || !capabilities.canUpload) return;
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
      const reservation = await json<ContentAssetUploadResponse>(
        `/api/editor/content/${encodeURIComponent(item.id)}/assets`,
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
          value.id === item.id ? ({ ...value, asset } as ContentItem) : value,
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
  return (
    <AppShell
      activeKey="editor"
      canManageContent
      canManageRoles={initialWorkspace.roles.includes("administrator")}
      headerTitle="Gestión de contenido"
      headerSubtitle="Crea, revisa y publica material académico."
      mainClassName="studio-main"
    >
      <header className="studio-heading">
        <div>
          <span>ESTUDIO EDITORIAL</span>
          <h2>Biblioteca de contenidos</h2>
          <p>{items.length} elementos disponibles</p>
        </div>
        {capabilities.canCreate && (
          <button
            className="studio-button studio-button-primary"
            type="button"
            onClick={() => create()}
          >
            <Plus size={17} /> Nuevo contenido
          </button>
        )}
      </header>

      <div className="studio-toolbar">
        <label className="studio-search">
          <MagnifyingGlass size={18} />
          <input
            aria-label="Buscar contenido"
            placeholder="Buscar por título, tema o slug..."
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <select
          aria-label="Filtrar por tipo"
          value={kindFilter}
          onChange={(event) => setKindFilter(event.target.value as "all" | ContentKind)}
        >
          <option value="all">Todos los tipos</option>
          {kinds.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
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
      </div>

      <div className="studio-workspace">
        <aside className="studio-items">
          <strong>{visibleItems.length} resultados</strong>
          {visibleItems.map((current) => (
            <button
              className={`studio-item ${item?.id === current.id ? "studio-item-active" : ""}`}
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

        <section className="studio-editor">
          {!draft ? (
            <div className="studio-empty">
              <h3>Selecciona o crea un contenido</h3>
              <p>El editor aparecerá en este espacio.</p>
            </div>
          ) : (
            <>
              <header className="studio-editor-heading">
                <div>
                  <small>{labelOf(kinds, draft.kind)}</small>
                  <h3>{isNew ? "Nuevo contenido" : draft.title}</h3>
                </div>
                <button aria-label="Cerrar editor" type="button" onClick={() => setDraft(null)}>
                  <X size={19} />
                </button>
              </header>

              {notice && (
                <p className={`studio-notice studio-notice-${notice.tone}`} role="status">
                  {notice.text}
                </p>
              )}

              <form onSubmit={save}>
                <fieldset disabled={!editable || busy !== null}>
                  <div className="studio-form-grid">
                    <label className="studio-field">
                      <span>Tipo</span>
                      <select
                        disabled={!isNew}
                        value={draft.kind}
                        onChange={(event) => {
                          const kind = event.target.value as ContentKind;
                          setDraft(
                            emptyDraft(kind, {
                              estimatedMinutes: draft.estimatedMinutes,
                              featured: draft.featured,
                              slug: draft.slug,
                              summary: draft.summary,
                              title: draft.title,
                              topic: draft.topic,
                            }),
                          );
                        }}
                      >
                        {kinds.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>

                    <label className="studio-field">
                      <span>Título</span>
                      <input
                        required
                        maxLength={200}
                        value={draft.title}
                        onChange={(event) => {
                          const title = event.target.value;
                          const automatic = !draft.slug || draft.slug === slugify(draft.title);
                          setDraft({
                            ...draft,
                            slug: automatic ? slugify(title) : draft.slug,
                            title,
                          } as ContentDraft);
                        }}
                      />
                    </label>

                    <label className="studio-field">
                      <span>Slug</span>
                      <input
                        required
                        maxLength={200}
                        value={draft.slug}
                        onChange={(event) =>
                          setDraft({ ...draft, slug: slugify(event.target.value) } as ContentDraft)
                        }
                      />
                    </label>

                    <label className="studio-field">
                      <span>Tema o región</span>
                      <input
                        required
                        maxLength={120}
                        value={draft.topic}
                        onChange={(event) =>
                          setDraft({ ...draft, topic: event.target.value } as ContentDraft)
                        }
                      />
                    </label>
                    <label className="studio-field">
                      <span>Duración estimada</span>
                      <input
                        min={0}
                        max={100000}
                        type="number"
                        value={draft.estimatedMinutes ?? ""}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            estimatedMinutes:
                              event.target.value === "" ? null : Number(event.target.value),
                          } as ContentDraft)
                        }
                      />
                    </label>

                    <label className="studio-featured">
                      <input
                        checked={draft.featured}
                        type="checkbox"
                        onChange={(event) =>
                          setDraft({ ...draft, featured: event.target.checked } as ContentDraft)
                        }
                      />
                      Contenido destacado
                    </label>

                    <label className="studio-field studio-field-wide">
                      <span>Resumen</span>
                      <textarea
                        required
                        maxLength={2000}
                        rows={3}
                        value={draft.summary}
                        onChange={(event) =>
                          setDraft({ ...draft, summary: event.target.value } as ContentDraft)
                        }
                      />
                    </label>
                  </div>

                  <TypeEditor draft={draft} onChange={setDraft} />
                </fieldset>

                {editable && (
                  <footer className="studio-save">
                    <button
                      className="studio-button studio-button-primary"
                      disabled={busy !== null}
                      type="submit"
                    >
                      {busy === "save" ? "Guardando..." : "Guardar contenido"}
                    </button>
                  </footer>
                )}
              </form>

              {accepts && item && capabilities.canUpload && editable && (
                <section className="studio-assets">
                  <div>
                    <h4>Archivo asociado</h4>
                    <p>{draft.kind === "video" ? "MP4, MOV o WebM." : "Documento PDF."}</p>
                  </div>
                  {item.asset && (
                    <p className="studio-current-file">
                      {item.asset.fileName} · {item.asset.status}
                    </p>
                  )}
                  <input ref={fileRef} accept={accepts} type="file" onChange={selectFile} />
                  {busy === "upload" && (
                    <div className="studio-progress">
                      <progress max={100} value={progress} />
                      <span>{progress}%</span>
                    </div>
                  )}
                  <button
                    className="studio-button studio-button-secondary"
                    disabled={!file || busy !== null}
                    type="button"
                    onClick={upload}
                  >
                    <CloudArrowUp size={17} />
                    {busy === "upload" ? "Subiendo..." : "Subir archivo"}
                  </button>
                </section>
              )}

              {item && actions.length > 0 && (
                <footer className="studio-workflow">
                  <strong>Estado: {labelOf(statuses, item.status)}</strong>
                  <div>
                    {actions.map((action) => (
                      <button
                        className={`studio-button studio-button-${action.tone}`}
                        disabled={busy !== null}
                        key={action.status}
                        type="button"
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