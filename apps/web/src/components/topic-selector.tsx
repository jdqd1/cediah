"use client";

import { Check, Plus, Tag } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { ContentTopicSchema, type ContentTopic } from "@cediah/contracts";
import { cleanRegion, normalizeRegion, uniqueRegions } from "@/lib/content-regions";
import { StudioNameDialog } from "./studio-name-dialog";

const contentUnavailableMessage =
  "No se pudo guardar el tema. Actualiza la página y vuelve a intentarlo.";

const topicErrors: Partial<Record<string, string>> = {
  content_unavailable: contentUnavailableMessage,
  forbidden: "Tu cuenta no tiene permiso para crear temas.",
  invalid_topic: "El nombre del tema no es válido.",
  not_found: "No se pudo asociar el tema con las materias seleccionadas.",
  topic_conflict: "No se pudo crear el tema con las materias seleccionadas.",
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
  const options = useMemo(
    () => uniqueRegions([
      ...suggestions,
      ...createdTopics
        .filter((topic) =>
          subjectIds.length === 0 || subjectIds.every((id) => topic.subjectIds.includes(id)),
        )
        .map((topic) => topic.name),
      ...values,
    ]),
    [createdTopics, subjectIds, suggestions, values],
  );
  const cleanInput = cleanRegion(input);
  const existingTopic = options.find(
    (topic) => normalizeRegion(topic) === normalizeRegion(cleanInput),
  );
  const interactive = !disabled && !busy && subjectSelected;

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
      <span className="topic-selector-label">Seleccionar tema</span>
      <div className="topic-selector-controls">
        <div
          aria-label="Seleccionar tema"
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
                  ? "Aún no hay temas. Añade el primero."
                  : "Administración aún no ha creado temas para esta materia."
                : "Selecciona primero una materia."}
            </p>
          )}
        </div>
        {allowCreate && (
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
    </div>
  );
}
