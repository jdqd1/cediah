"use client";

import { Check, Plus, Tag, Trash } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { ContentTopicSchema, type ContentTopic } from "@cediah/contracts";
import { cleanRegion, normalizeRegion, uniqueRegions } from "@/lib/content-regions";
import { StudioConfirmDialog } from "./studio-confirm-dialog";
import { StudioNameDialog } from "./studio-name-dialog";

const contentUnavailableMessage =
  "No se pudo guardar el tema. Actualiza la página y vuelve a intentarlo.";

const topicErrors: Partial<Record<string, string>> = {
  content_unavailable: contentUnavailableMessage,
  forbidden: "Tu cuenta no tiene permiso para administrar temas.",
  invalid_topic: "El nombre del tema no es válido.",
  not_found: "El tema ya no existe o no está disponible.",
  topic_conflict: "No se pudo crear el tema con las materias seleccionadas.",
  topic_in_use: "No puedes eliminar este tema porque todavía está asociado a contenido. Quita el tema de ese contenido, guarda los cambios y vuelve a intentarlo.",
};

export function TopicSelector({
  allowCreate = false,
  disabled = false,
  onChange,
  subjectIds = [],
  subjectSelected,
  suggestions = [],
  values,
}: {
  allowCreate?: boolean;
  disabled?: boolean;
  onChange: (values: string[]) => void;
  subjectIds?: readonly string[];
  subjectSelected: boolean;
  suggestions?: readonly string[];
  values: readonly string[];
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdTopics, setCreatedTopics] = useState<ContentTopic[]>([]);
  const [deletedTopics, setDeletedTopics] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const options = useMemo(
    () => uniqueRegions([
      ...suggestions,
      ...createdTopics
        .filter((topic) =>
          subjectIds.length === 0 || subjectIds.every((id) => topic.subjectIds.includes(id)),
        )
        .map((topic) => topic.name),
      ...values,
    ]).filter(
      (topic) => !deletedTopics.some(
        (deleted) => normalizeRegion(deleted) === normalizeRegion(topic),
      ),
    ),
    [createdTopics, deletedTopics, subjectIds, suggestions, values],
  );
  const cleanInput = cleanRegion(input);
  const existingTopic = options.find(
    (topic) => normalizeRegion(topic) === normalizeRegion(cleanInput),
  );
  const interactive = !disabled && !busy && subjectSelected;
  const selectedTopicForDeletion = values.length === 1 ? values[0] : null;

  function closeDialog() {
    if (busy) return;
    setDialogOpen(false);
    setInput("");
    setError(null);
  }

  async function addTopic() {
    if (!allowCreate || !interactive || !cleanInput) return;
    if (existingTopic) {
      onChange(uniqueRegions([...values, existingTopic]));
      closeDialog();
      return;
    }

    // Older callers only supplied whether a subject was selected. Keep the
    // topic stable in the current editor session; saving the content will
    // persist it through the content provider. New callers pass subjectIds and
    // persist immediately through the taxonomy endpoint below.
    if (subjectIds.length === 0) {
      const localTopic = { name: cleanInput, subjectIds: [] } satisfies ContentTopic;
      setCreatedTopics((current) => [
        ...current.filter(
          (topic) => normalizeRegion(topic.name) !== normalizeRegion(localTopic.name),
        ),
        localTopic,
      ]);
      onChange(uniqueRegions([...values, localTopic.name]));
      setDialogOpen(false);
      setInput("");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/editor/topics", {
        body: JSON.stringify({ name: cleanInput, subjectIds: [...subjectIds] }),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const body: unknown = await response
        .json()
        .catch(() => ({ error: "content_unavailable" }));
      if (!response.ok) {
        const code = body && typeof body === "object" && "error" in body && typeof body.error === "string"
          ? body.error
          : "content_unavailable";
        throw new Error(topicErrors[code] ?? `No se pudo crear el tema (${response.status}).`);
      }
      const parsed = ContentTopicSchema.safeParse(
        body && typeof body === "object" && "topic" in body ? body.topic : null,
      );
      if (!parsed.success) throw new Error(contentUnavailableMessage);

      setCreatedTopics((current) => [
        ...current.filter(
          (topic) => normalizeRegion(topic.name) !== normalizeRegion(parsed.data.name),
        ),
        parsed.data,
      ]);
      onChange(uniqueRegions([...values, parsed.data.name]));
      setDialogOpen(false);
      setInput("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : contentUnavailableMessage);
    } finally {
      setBusy(false);
    }
  }

  async function deleteTopic() {
    if (!allowCreate || !deleteTarget || busy) return;
    setBusy(true);
    setDeleteError(null);
    try {
      const response = await fetch("/api/editor/topics", {
        body: JSON.stringify({ name: deleteTarget }),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: "DELETE",
      });
      const body: unknown = await response
        .json()
        .catch(() => ({ error: "content_unavailable" }));
      if (!response.ok) {
        const code = body && typeof body === "object" && "error" in body && typeof body.error === "string"
          ? body.error
          : "content_unavailable";
        throw new Error(topicErrors[code] ?? `No se pudo eliminar el tema (${response.status}).`);
      }
      const parsed = ContentTopicSchema.safeParse(
        body && typeof body === "object" && "topic" in body ? body.topic : null,
      );
      if (!parsed.success) throw new Error(contentUnavailableMessage);

      setCreatedTopics((current) => current.filter(
        (topic) => normalizeRegion(topic.name) !== normalizeRegion(deleteTarget),
      ));
      setDeletedTopics((current) => uniqueRegions([...current, deleteTarget]));
      onChange(values.filter(
        (value) => normalizeRegion(value) !== normalizeRegion(deleteTarget),
      ));
      setDeleteTarget(null);
      setDeleteError(null);
    } catch (caught) {
      setDeleteError(caught instanceof Error ? caught.message : contentUnavailableMessage);
    } finally {
      setBusy(false);
    }
  }

  function toggleTopic(topic: string) {
    const selected = values.some(
      (value) => normalizeRegion(value) === normalizeRegion(topic),
    );
    onChange(selected
      ? values.filter((value) => normalizeRegion(value) !== normalizeRegion(topic))
      : uniqueRegions([...values, topic]));
  }

  return (
    <div className="topic-selector-field studio-field-wide">
      <span className="topic-selector-label">Tema (opcional)</span>
      <div className="topic-selector-controls">
        <div
          aria-label="Seleccionar tema opcional"
          aria-disabled={!interactive}
          className="topic-selector-options"
          role="group"
        >
          {interactive && options.length > 0 ? options.map((topic) => {
            const selected = values.some(
              (value) => normalizeRegion(value) === normalizeRegion(topic),
            );
            return (
              <button
                aria-pressed={selected}
                className={selected ? "is-selected" : ""}
                key={normalizeRegion(topic)}
                type="button"
                onClick={() => toggleTopic(topic)}
              >
                <span className="topic-selector-check" aria-hidden="true">
                  {selected && <Check size={14} weight="bold" />}
                </span>
                <Tag aria-hidden="true" size={16} />
                <span>{topic}</span>
              </button>
            );
          }) : (
            <p>
              {subjectSelected
                ? allowCreate
                  ? "El tema es opcional. Puedes publicar directamente en la materia o añadir uno para organizar el contenido."
                  : "Esta materia no tiene temas. El contenido puede publicarse directamente en ella."
                : "Selecciona primero una materia."}
            </p>
          )}
        </div>
        {allowCreate && (
          <>
            <button
              className="studio-entity-create-button studio-entity-create-button-primary"
              disabled={!interactive}
              type="button"
              onClick={() => {
                setError(null);
                setDialogOpen(true);
              }}
            >
              <Plus aria-hidden="true" size={16} />
              Añadir tema
            </button>
            <button
              className="studio-entity-create-button"
              disabled={!interactive || !selectedTopicForDeletion}
              type="button"
              onClick={() => {
                if (!selectedTopicForDeletion) return;
                setDeleteError(null);
                setDeleteTarget(selectedTopicForDeletion);
              }}
            >
              <Trash aria-hidden="true" size={16} />
              Eliminar tema
            </button>
          </>
        )}
      </div>

      {allowCreate && (
        <StudioNameDialog
          busy={busy}
          description="El tema quedará disponible dentro de las materias seleccionadas y se sumará a tu selección actual."
          icon={<Tag size={21} />}
          inputLabel="Nombre del tema"
          maxLength={120}
          open={dialogOpen}
          placeholder="Ej. Abdomen"
          submitLabel={existingTopic ? "Seleccionar tema" : "Crear tema"}
          title="Añadir tema"
          value={input}
          onChange={(value) => {
            setInput(value);
            setError(null);
          }}
          onClose={closeDialog}
          onSubmit={addTopic}
        >
          {error && <p role="alert">{error}</p>}
        </StudioNameDialog>
      )}

      <StudioConfirmDialog
        busy={busy}
        busyLabel="Eliminando…"
        confirmLabel="Eliminar tema"
        description={deleteTarget
          ? `Se eliminará “${deleteTarget}” de la lista de temas. Si todavía está asociado a cualquier contenido, la eliminación se bloqueará hasta que retires ese tema del contenido.`
          : "Selecciona el tema que deseas eliminar."}
        error={deleteError}
        icon={<Trash size={21} />}
        open={deleteTarget !== null}
        title="Eliminar tema"
        onClose={() => {
          if (busy) return;
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        onConfirm={deleteTopic}
      />
    </div>
  );
}
