"use client";

import { Check, Plus, Tag } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { cleanRegion, normalizeRegion, uniqueRegions } from "@/lib/content-regions";
import { StudioNameDialog } from "./studio-name-dialog";

export function TopicSelector({
  allowCreate = false,
  disabled = false,
  onChange,
  subjectSelected,
  suggestions = [],
  values,
}: {
  allowCreate?: boolean;
  disabled?: boolean;
  onChange: (values: string[]) => void;
  subjectSelected: boolean;
  suggestions?: readonly string[];
  values: readonly string[];
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [input, setInput] = useState("");
  const options = useMemo(
    () => uniqueRegions([...suggestions, ...values]),
    [suggestions, values],
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
    if (!allowCreate || !interactive || !cleanInput) return;
    onChange(uniqueRegions([...values, existingTopic ?? cleanInput]));
    closeDialog();
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
            onClick={() => setDialogOpen(true)}
          >
            <Plus aria-hidden="true" size={16} />
            Añadir tema
          </button>
        )}
      </div>

      {allowCreate && (
        <StudioNameDialog
          description="El tema quedará disponible dentro de las materias seleccionadas y se sumará a tu selección actual."
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
      )}
    </div>
  );
}
