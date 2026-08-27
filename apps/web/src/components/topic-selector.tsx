"use client";

import { Check, Plus, Tag } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { cleanRegion, normalizeRegion, uniqueRegions } from "@/lib/content-regions";
import { StudioNameDialog } from "./studio-name-dialog";

export function TopicSelector({
  disabled = false,
  onChange,
  subjectSelected,
  suggestions = [],
  value,
}: {
  disabled?: boolean;
  onChange: (value: string) => void;
  subjectSelected: boolean;
  suggestions?: readonly string[];
  value: string;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [input, setInput] = useState("");
  const options = useMemo(
    () => uniqueRegions([...suggestions, ...(value ? [value] : [])]),
    [suggestions, value],
  );
  const cleanInput = cleanRegion(input);
  const existingTopic = options.find(
    (topic) => normalizeRegion(topic) === normalizeRegion(cleanInput),
  );
  const interactive = !disabled && subjectSelected;

  function closeDialog() {
    setDialogOpen(false);
    setInput("");
  }

  function addTopic() {
    if (!interactive || !cleanInput) return;
    onChange(existingTopic ?? cleanInput);
    closeDialog();
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
            const selected = normalizeRegion(topic) === normalizeRegion(value);
            return (
              <button
                aria-pressed={selected}
                className={selected ? "is-selected" : ""}
                key={normalizeRegion(topic)}
                type="button"
                onClick={() => onChange(selected ? "" : topic)}
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
                ? "Aún no hay temas. Añade el primero."
                : "Selecciona primero una materia."}
            </p>
          )}
        </div>
        <button
          className="studio-entity-create-button studio-entity-create-button-primary"
          disabled={!interactive}
          type="button"
          onClick={() => setDialogOpen(true)}
        >
          <Plus aria-hidden="true" size={16} />
          Añadir tema
        </button>
      </div>

      <StudioNameDialog
        description="El tema quedará disponible dentro de las materias seleccionadas al guardar."
        icon={<Tag size={21} />}
        inputLabel="Nombre del tema"
        maxLength={120}
        open={dialogOpen}
        placeholder="Ej. Abdomen"
        submitLabel={existingTopic ? "Seleccionar tema" : "Crear tema"}
        title="Añadir tema"
        value={input}
        onChange={setInput}
        onClose={closeDialog}
        onSubmit={addTopic}
      />
    </div>
  );
}
