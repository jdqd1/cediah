"use client";

import { Plus, Tag, X } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { cleanRegion, normalizeRegion, uniqueRegions } from "@/lib/content-regions";
import { StudioNameDialog } from "./studio-name-dialog";

const MAX_REGIONS = 12;

export function RegionTagsInput({
  disabled = false,
  label = "Etiquetas del tema",
  onChange,
  suggestions = [],
  values,
}: {
  disabled?: boolean;
  label?: string;
  onChange: (values: string[]) => void;
  suggestions?: readonly string[];
  values: readonly string[];
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [input, setInput] = useState("");
  const cleanValues = useMemo(() => uniqueRegions(values), [values]);
  const available = useMemo(() => {
    const selected = new Set(cleanValues.map(normalizeRegion));
    const query = normalizeRegion(input);
    return uniqueRegions(suggestions)
      .filter((suggestion) => !selected.has(normalizeRegion(suggestion)))
      .filter((suggestion) => !query || normalizeRegion(suggestion).includes(query))
      .slice(0, 6);
  }, [cleanValues, input, suggestions]);

  function closeDialog() {
    setDialogOpen(false);
    setInput("");
  }

  function add(rawValue = input) {
    if (disabled || cleanValues.length >= MAX_REGIONS) return;
    const value = cleanRegion(rawValue);
    if (!value) return;
    const key = normalizeRegion(value);
    if (!cleanValues.some((current) => normalizeRegion(current) === key)) {
      onChange([...cleanValues, value]);
    }
    closeDialog();
  }

  function remove(index: number) {
    if (disabled) return;
    onChange(cleanValues.filter((_, position) => position !== index));
  }

  return (
    <div className="region-tags-field studio-field-wide">
      <span className="region-tags-label">{label}</span>
      <div className="region-tags-summary">
        <div className="region-tags-values" aria-label="Etiquetas seleccionadas">
          {cleanValues.map((value, index) => (
            <span className="region-tag" key={normalizeRegion(value)}>
              {value}
              <button
                aria-label={`Quitar etiqueta ${value}`}
                disabled={disabled}
                type="button"
                onClick={() => remove(index)}
              >
                <X aria-hidden="true" size={12} weight="bold" />
              </button>
            </span>
          ))}
          {cleanValues.length === 0 && (
            <span className="region-tags-empty">Aún no hay etiquetas asignadas.</span>
          )}
        </div>
        <button
          className="studio-entity-create-button"
          disabled={disabled || cleanValues.length >= MAX_REGIONS}
          type="button"
          onClick={() => setDialogOpen(true)}
        >
          <Plus aria-hidden="true" size={16} />
          Añadir etiqueta
        </button>
      </div>

      <StudioNameDialog
        description="Escribe una etiqueta nueva o elige una de las sugerencias disponibles."
        icon={<Tag size={21} />}
        inputLabel="Nombre de la etiqueta"
        maxLength={80}
        open={dialogOpen}
        placeholder="Ej. Tórax"
        submitLabel="Añadir etiqueta"
        title="Añadir etiqueta"
        value={input}
        onChange={setInput}
        onClose={closeDialog}
        onSubmit={() => add()}
      >
        {available.length > 0 && (
          <div className="studio-name-dialog-suggestions">
            <span>Sugerencias</span>
            <div>
              {available.map((suggestion) => (
                <button key={normalizeRegion(suggestion)} type="button" onClick={() => add(suggestion)}>
                  <Tag aria-hidden="true" size={14} /> {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
      </StudioNameDialog>
    </div>
  );
}
