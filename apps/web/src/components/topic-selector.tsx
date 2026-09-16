"use client";

import { Check, NotePencil, Plus, Tag, Trash } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { ContentTopicSchema, type ContentTopic } from "@cediah/contracts";
import { cleanRegion, normalizeRegion, uniqueRegions } from "@/lib/content-regions";
import { StudioConfirmDialog } from "./studio-confirm-dialog";
import { StudioNameDialog } from "./studio-name-dialog";
import { TopicItemManagementProvider, TopicItemManager } from "./topic-item-manager";
import styles from "./topic-selector.module.css";

const contentUnavailableMessage =
  "No se pudo guardar el tema. Actualiza la página y vuelve a intentarlo.";

const topicErrors: Partial<Record<string, string>> = {
  content_unavailable: contentUnavailableMessage,
  forbidden: "Tu cuenta no tiene permiso para administrar temas.",
  invalid_topic: "El nombre del tema no es válido.",
  not_found: "El tema ya no existe o no está disponible.",
  topic_conflict: "Ya existe un tema con ese nombre o no se pudo guardar con las materias seleccionadas.",
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
  const [renamedTopics, setRenamedTopics] = useState<Record<string, string>>({});
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const options = useMemo(() => {
    const resolveRenamedTopic = (topic: string) => {
      let current = topic;
      const seen = new Set<string>();
      while (true) {
        const key = normalizeRegion(current);
        if (seen.has(key)) return current;
        seen.add(key);
        const renamed = renamedTopics[key];
        if (!renamed) return current;
        current = renamed;
      }
    };

    return uniqueRegions([
      ...suggestions,
      ...createdTopics
        .filter((topic) =>
          subjectIds.length === 0 || subjectIds.every((id) => topic.subjectIds.includes(id)),
        )
        .map((topic) => topic.name),
      ...values,
    ].map(resolveRenamedTopic)).filter(
      (topic) => !deletedTopics.some(
        (deleted) => normalizeRegion(deleted) === normalizeRegion(topic),
      ),
    );
  }, [createdTopics, deletedTopics, renamedTopics, subjectIds, suggestions, values]);
  const cleanInput = cleanRegion(input);
  const cleanRenameInput = cleanRegion(renameInput);
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

  function closeRenameDialog() {
    if (busy) return;
    setRenameTarget(null);
    setRenameInput("");
    setRenameError(null);
  }

  async function addTopic() {
    if (!allowCreate || !interactive || !cleanInput) return;
    if (existingTopic) {
      onChange(uniqueRegions([...values, existingTopic]));
      closeDialog();
      return;
    }

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

  async function renameTopic() {
    if (!allowCreate || !renameTarget || !cleanRenameInput || busy) return;
    if (cleanRenameInput === renameTarget) {
      closeRenameDialog();
      return;
    }

    setBusy(true);
    setRenameError(null);
    try {
      const response = await fetch("/api/editor/topics", {
        body: JSON.stringify({ name: cleanRenameInput, previousName: renameTarget }),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const body: unknown = await response
        .json()
        .catch(() => ({ error: "content_unavailable" }));
      if (!response.ok) {
        const code = body && typeof body === "object" && "error" in body && typeof body.error === "string"
          ? body.error
          : "content_unavailable";
        throw new Error(topicErrors[code] ?? `No se pudo renombrar el tema (${response.status}).`);
      }
      const parsed = ContentTopicSchema.safeParse(
        body && typeof body === "object" && "topic" in body ? body.topic : null,
      );
      if (!parsed.success) throw new Error(contentUnavailableMessage);

      const previousKey = normalizeRegion(renameTarget);
      setCreatedTopics((current) => [
        ...current.filter((topic) =>
          normalizeRegion(topic.name) !== previousKey &&
          normalizeRegion(topic.name) !== normalizeRegion(parsed.data.name),
        ),
        parsed.data,
      ]);
      setRenamedTopics((current) => {
        const next = { ...current };
        for (const [key, value] of Object.entries(next)) {
          if (normalizeRegion(value) === previousKey) next[key] = parsed.data.name;
        }
        next[previousKey] = parsed.data.name;
        return next;
      });
      setDeletedTopics((current) => current.filter(
        (topic) => normalizeRegion(topic) !== normalizeRegion(parsed.data.name),
      ));
      onChange(uniqueRegions(values.map((value) =>
        normalizeRegion(value) === previousKey ? parsed.data.name : value,
      )));
      setRenameTarget(null);
      setRenameInput("");
      setRenameError(null);
    } catch (caught) {
      setRenameError(caught instanceof Error ? caught.message : contentUnavailableMessage);
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
      setDeletedTopics((current) => uniqueRegions([...current, parsed.data.name]));
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
    <TopicItemManagementProvider
      enabled={allowCreate && subjectSelected}
      subjectIds={subjectIds}
    >
      <div className="topic-selector-field studio-field-wide">
        <span className="topic-selector-label">Tema (opcional)</span>
        <div className="topic-selector-controls">
          <div
            aria-label="Seleccionar tema opcional"
            aria-disabled={!interactive}
            className="topic-selector-options"
            role="group"
          >
            {subjectSelected && options.length > 0 ? options.map((topic) => {
              const selected = values.some(
                (value) => normalizeRegion(value) === normalizeRegion(topic),
              );
              return (
                <div className={styles.topicBlock} key={normalizeRegion(topic)}>
                  <div className={styles.topicRow}>
                    <button
                      aria-pressed={selected}
                      className={`${styles.topicToggle} ${selected ? styles.topicToggleSelected : ""}`}
                      disabled={!interactive}
                      type="button"
                      onClick={() => toggleTopic(topic)}
                    >
                      <span className={styles.topicCheck} aria-hidden="true">
                        {selected && <Check size={14} weight="bold" />}
                      </span>
                      <Tag aria-hidden="true" size={16} />
                      <span>{topic}</span>
                    </button>
                    {allowCreate && (
                      <div className={styles.topicActions}>
                        <button
                          aria-label={`Editar nombre del tema ${topic}`}
                          className={styles.topicAction}
                          disabled={!interactive}
                          title="Editar nombre"
                          type="button"
                          onClick={() => {
                            setRenameError(null);
                            setRenameTarget(topic);
                            setRenameInput(topic);
                          }}
                        >
                          <NotePencil aria-hidden="true" size={16} />
                        </button>
                        <button
                          aria-label={`Eliminar tema ${topic}`}
                          className={`${styles.topicAction} ${styles.topicActionDanger}`}
                          disabled={!interactive}
                          title="Eliminar tema"
                          type="button"
                          onClick={() => {
                            setDeleteError(null);
                            setDeleteTarget(topic);
                          }}
                        >
                          <Trash aria-hidden="true" size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                  {allowCreate && <TopicItemManager disabled={!interactive} topic={topic} />}
                </div>
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
            <button
              className={`studio-entity-create-button studio-entity-create-button-primary ${styles.addTopicButton}`}
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

        {allowCreate && (
          <StudioNameDialog
            busy={busy}
            description={renameTarget
              ? `Cambia el nombre de “${renameTarget}”. El nuevo nombre se aplicará también al contenido que ya usa este tema.`
              : "Cambia el nombre del tema."}
            icon={<NotePencil size={21} />}
            inputLabel="Nombre del tema"
            maxLength={120}
            open={renameTarget !== null}
            placeholder="Ej. Abdomen"
            submitLabel="Guardar nombre"
            title="Editar nombre del tema"
            value={renameInput}
            onChange={(value) => {
              setRenameInput(value);
              setRenameError(null);
            }}
            onClose={closeRenameDialog}
            onSubmit={renameTopic}
          >
            {renameError && <p role="alert">{renameError}</p>}
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
    </TopicItemManagementProvider>
  );
}
