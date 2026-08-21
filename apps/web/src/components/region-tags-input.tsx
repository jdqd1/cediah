"use client";

import { CaretDown, Plus, Tag, X } from "@phosphor-icons/react";
import { useId, useMemo, useRef, useState } from "react";
import { cleanRegion, normalizeRegion, uniqueRegions } from "@/lib/content-regions";

const MAX_REGIONS = 12;

export function RegionTagsInput({
  disabled = false,
  label = "Regiones anatómicas",
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
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suppressListOpenRef = useRef(false);
  const listId = useId();
  const helpId = useId();
  const cleanValues = useMemo(() => uniqueRegions(values), [values]);
  const available = useMemo(() => {
    const selected = new Set(cleanValues.map(normalizeRegion));
    const query = normalizeRegion(input);
    return uniqueRegions(suggestions)
      .filter((suggestion) => !selected.has(normalizeRegion(suggestion)))
      .filter((suggestion) => !query || normalizeRegion(suggestion).includes(query))
      .slice(0, 6);
  }, [cleanValues, input, suggestions]);
  const showCreate = Boolean(input.trim()) &&
    !available.some((value) => normalizeRegion(value) === normalizeRegion(input));
  const optionCount = available.length + (showCreate ? 1 : 0);
  const hasInput = Boolean(input.trim());
  const suggestionsVisible =
    listOpen && !disabled && cleanValues.length < MAX_REGIONS && optionCount > 0;

  function add(rawValue = input) {
    if (disabled || cleanValues.length >= MAX_REGIONS) return;
    const value = cleanRegion(rawValue.replace(/,$/, ""));
    if (!value) return;
    const key = normalizeRegion(value);
    const existing = cleanValues.find((current) => normalizeRegion(current) === key);
    if (!existing) onChange([...cleanValues, value]);
    setInput("");
    setActiveIndex(-1);
  }

  function remove(index: number) {
    if (disabled) return;
    onChange(cleanValues.filter((_, position) => position !== index));
  }

  return (
    <div
      className="region-tags-field"
      onFocus={() => {
        setFocused(true);
        if (suppressListOpenRef.current) {
          suppressListOpenRef.current = false;
        } else {
          setListOpen(true);
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setFocused(false);
          setListOpen(false);
          setActiveIndex(-1);
          add();
        }
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !listOpen) return;
        event.preventDefault();
        event.stopPropagation();
        setListOpen(false);
        setActiveIndex(-1);
        if (event.target !== inputRef.current) {
          suppressListOpenRef.current = true;
          inputRef.current?.focus();
        }
      }}
    >
      <span className="region-tags-label">{label}</span>
      <div className={`region-tags-control ${focused ? "is-focused" : ""}`}>
        {cleanValues.map((value, index) => (
          <span className="region-tag" key={normalizeRegion(value)}>
            {value}
            <button
              aria-label={`Quitar región ${value}`}
              disabled={disabled}
              type="button"
              onClick={() => remove(index)}
            >
              <X aria-hidden="true" size={12} weight="bold" />
            </button>
          </span>
        ))}
        <input
          aria-activedescendant={
            suggestionsVisible && activeIndex >= 0
              ? `${listId}-option-${activeIndex}`
              : undefined
          }
          aria-autocomplete="list"
          aria-controls={listId}
          aria-describedby={helpId}
          aria-expanded={suggestionsVisible}
          aria-label="Añadir región anatómica"
          autoComplete="off"
          disabled={disabled || cleanValues.length >= MAX_REGIONS}
          placeholder={cleanValues.length === 0 ? "Escribe una región y pulsa Enter" : "Añadir región…"}
          ref={inputRef}
          role="combobox"
          value={input}
          onClick={() => setListOpen(true)}
          onChange={(event) => {
            const value = event.target.value;
            if (value.endsWith(",")) add(value);
            else {
              setInput(value);
              setListOpen(true);
              setActiveIndex(-1);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && optionCount > 0) {
              event.preventDefault();
              setListOpen(true);
              setActiveIndex((current) => current < 0 ? 0 : (current + 1) % optionCount);
            } else if (event.key === "ArrowUp" && optionCount > 0) {
              event.preventDefault();
              setListOpen(true);
              setActiveIndex((current) => current < 0 ? optionCount - 1 : (current - 1 + optionCount) % optionCount);
            } else if (event.key === "Enter") {
              event.preventDefault();
              if (suggestionsVisible && activeIndex >= 0 && activeIndex < available.length) {
                add(available[activeIndex]);
              } else {
                add();
              }
            } else if (event.key === "Backspace" && !input && cleanValues.length > 0) {
              remove(cleanValues.length - 1);
            }
          }}
        />
        <button
          aria-controls={listId}
          aria-expanded={hasInput ? undefined : suggestionsVisible}
          aria-haspopup={hasInput ? undefined : "listbox"}
          aria-label={hasInput ? "Añadir región" : "Mostrar regiones disponibles"}
          className={`region-tags-add${hasInput ? "" : " is-menu"}`}
          disabled={
            disabled ||
            cleanValues.length >= MAX_REGIONS ||
            (!hasInput && available.length === 0)
          }
          type="button"
          onClick={() => {
            if (hasInput) {
              add();
              return;
            }
            setListOpen(true);
            inputRef.current?.focus();
          }}
        >
          {hasInput ? <Plus size={15} /> : <CaretDown size={15} />}
        </button>
      </div>
      {suggestionsVisible && (
        <div className="region-tags-suggestions" id={listId} role="listbox">
          {available.map((suggestion, index) => (
            <button
              aria-selected={activeIndex === index}
              id={`${listId}-option-${index}`}
              key={normalizeRegion(suggestion)}
              role="option"
              type="button"
              onFocus={() => setActiveIndex(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => add(suggestion)}
            >
              <Tag size={14} /> {suggestion}
            </button>
          ))}
          {showCreate && (
            <button
              aria-selected={activeIndex === available.length}
              id={`${listId}-option-${available.length}`}
              role="option"
              type="button"
              onFocus={() => setActiveIndex(available.length)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => add()}
            >
              <Plus size={14} /> Crear “{cleanRegion(input)}”
            </button>
          )}
        </div>
      )}
      <span className="sr-only" id={helpId}>
        La primera etiqueta será la región principal. Puedes añadir hasta {MAX_REGIONS}.
      </span>
    </div>
  );
}
