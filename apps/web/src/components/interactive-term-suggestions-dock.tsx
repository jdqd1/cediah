"use client";

import {
  ArrowClockwise,
  CheckCircle,
  MagnifyingGlass,
  Plus,
  Tag,
  X,
} from "@phosphor-icons/react";
import { type FormEvent, useState } from "react";
import { InteractiveTermAdminMutationSchema } from "@/lib/interactive-term-admin";
import {
  InteractiveTermSuggestionListSchema,
  type InteractiveTermSuggestion,
} from "@/lib/interactive-term-suggestions";
import styles from "./interactive-term-suggestions-dock.module.css";

const fallbackError = "No fue posible cargar las sugerencias de términos.";

const errorMessages: Record<string, string> = {
  forbidden: "Sólo un administrador puede usar las sugerencias del diccionario.",
  identity_unavailable: "No fue posible validar la sesión.",
  interactive_term_admin_unavailable: "La administración de términos no está disponible.",
  interactive_term_conflict: "Ese término ya existe o entra en conflicto con un alias existente.",
  invalid_interactive_term: "Revisa los datos antes de crear el término.",
  invalid_interactive_term_suggestion_query: "Los filtros de sugerencias no son válidos.",
  unauthorized: "La sesión terminó. Vuelve a iniciar sesión.",
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}

async function readError(response: Response) {
  const body: unknown = await response.json().catch(() => null);
  const code =
    body && typeof body === "object" && "error" in body && typeof body.error === "string"
      ? body.error
      : null;
  return code ? errorMessages[code] ?? `${fallbackError} (${response.status})` : `${fallbackError} (${response.status})`;
}

export function InteractiveTermSuggestionsDock() {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<InteractiveTermSuggestion[]>([]);
  const [query, setQuery] = useState("");
  const [minGuides, setMinGuides] = useState(2);
  const [includeGeneric, setIncludeGeneric] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<InteractiveTermSuggestion | null>(null);
  const [definition, setDefinition] = useState("");
  const [category, setCategory] = useState("");
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  async function loadSuggestions(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (loading || saving) return;
    setLoading(true);
    setMessage(null);
    try {
      const params = new URLSearchParams({
        includeGeneric: String(includeGeneric),
        limit: "40",
        minGuides: String(minGuides),
      });
      if (query.trim()) params.set("q", query.trim());
      const response = await fetch(`/api/admin/interactive-terms/suggestions?${params.toString()}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(await readError(response));
      const parsed = InteractiveTermSuggestionListSchema.safeParse(await response.json());
      if (!parsed.success) throw new Error(fallbackError);
      setSuggestions(parsed.data.suggestions);
      if (selected && !parsed.data.suggestions.some((item) => item.normalizedKey === selected.normalizedKey)) {
        setSelected(null);
        setDefinition("");
        setCategory("");
      }
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : fallbackError });
    } finally {
      setLoading(false);
    }
  }

  function openDock() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setMessage(null);
    if (suggestions.length === 0) void loadSuggestions();
  }

  function chooseSuggestion(suggestion: InteractiveTermSuggestion) {
    setSelected(suggestion);
    setDefinition("");
    setCategory("");
    setMessage(null);
  }

  async function createSuggestionTerm() {
    if (!selected || saving || loading) return;
    const shortDefinition = definition.trim();
    if (!shortDefinition) {
      setMessage({ tone: "error", text: "Añade una definición breve antes de crear el término." });
      return;
    }
    const slug = slugify(selected.name);
    if (!slug) {
      setMessage({ tone: "error", text: "No fue posible generar un slug válido para esta sugerencia." });
      return;
    }

    const primaryExample = selected.examples.at(0) ?? null;
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/interactive-terms", {
        body: JSON.stringify({
          aliases: [],
          autoMatch: true,
          category: category.trim() || null,
          destinations: primaryExample ? [{
            guideSlug: primaryExample.guideSlug,
            primary: true,
            priority: 0,
            sectionAnchor: primaryExample.sectionAnchor,
          }] : [],
          isActive: true,
          name: selected.name,
          occurrencePolicy: "first_per_section",
          priority: 0,
          shortDefinition,
          slug,
        }),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!response.ok) throw new Error(await readError(response));
      const parsed = InteractiveTermAdminMutationSchema.safeParse(await response.json());
      if (!parsed.success) throw new Error(fallbackError);

      setSuggestions((current) => current.filter((item) => item.normalizedKey !== selected.normalizedKey));
      setMessage({
        tone: "success",
        text: `${parsed.data.term.name} se añadió al diccionario y entró en la cola de reindexación.`,
      });
      setSelected(null);
      setDefinition("");
      setCategory("");
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : fallbackError });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        className={styles.launcher}
        type="button"
        onClick={openDock}
      >
        <Tag size={18} weight="bold" aria-hidden="true" />
        Sugerencias
      </button>

      {open ? (
        <aside
          aria-label="Sugerencias automáticas de términos"
          className={styles.dock}
          role="dialog"
          onKeyDown={(event) => {
            if (event.key === "Escape" && !saving) setOpen(false);
          }}
        >
          <header className={styles.header}>
            <div>
              <span>Corpus de guías</span>
              <h2>Sugerencias de términos</h2>
              <p>Encabezados repetidos que todavía no existen en el diccionario global.</p>
            </div>
            <button
              aria-label="Cerrar sugerencias"
              className={styles.close}
              disabled={saving}
              type="button"
              onClick={() => setOpen(false)}
            >
              <X size={18} />
            </button>
          </header>

          <form className={styles.filters} onSubmit={loadSuggestions}>
            <label className={styles.search}>
              <MagnifyingGlass size={17} aria-hidden="true" />
              <input
                aria-label="Buscar sugerencias"
                disabled={loading || saving}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar un concepto"
                value={query}
              />
            </label>
            <div className={styles.filterRow}>
              <label>
                <span>Mínimo de guías</span>
                <select
                  disabled={loading || saving}
                  onChange={(event) => setMinGuides(Number(event.target.value))}
                  value={minGuides}
                >
                  <option value={1}>1 guía</option>
                  <option value={2}>2 guías</option>
                  <option value={3}>3 guías</option>
                  <option value={5}>5 guías</option>
                  <option value={10}>10 guías</option>
                </select>
              </label>
              <label className={styles.check}>
                <input
                  checked={includeGeneric}
                  disabled={loading || saving}
                  onChange={(event) => setIncludeGeneric(event.target.checked)}
                  type="checkbox"
                />
                Incluir encabezados estructurales
              </label>
              <button className={styles.refresh} disabled={loading || saving} type="submit">
                <ArrowClockwise className={loading ? styles.spin : undefined} size={16} />
                {loading ? "Analizando…" : "Actualizar"}
              </button>
            </div>
          </form>

          {message ? (
            <p className={message.tone === "success" ? styles.success : styles.error} role="status">
              {message.tone === "success" ? <CheckCircle size={17} weight="fill" /> : null}
              {message.text}
            </p>
          ) : null}

          <div className={styles.body}>
            <div className={styles.list} aria-label="Candidatos sugeridos">
              {suggestions.length ? suggestions.map((suggestion) => (
                <button
                  className={`${styles.suggestion} ${selected?.normalizedKey === suggestion.normalizedKey ? styles.selected : ""}`.trim()}
                  disabled={saving}
                  key={suggestion.normalizedKey}
                  type="button"
                  onClick={() => chooseSuggestion(suggestion)}
                >
                  <span className={styles.suggestionTitle}>{suggestion.name}</span>
                  <span className={styles.metrics}>
                    {suggestion.guideCount} guías · {suggestion.sectionCount} secciones
                  </span>
                  {suggestion.examples.at(0) ? (
                    <span className={styles.example}>
                      Ej.: {suggestion.examples[0]!.guideTitle}
                    </span>
                  ) : null}
                </button>
              )) : (
                <div className={styles.empty}>
                  <Tag size={24} aria-hidden="true" />
                  <p>{loading ? "Analizando encabezados…" : "No hay sugerencias con estos filtros."}</p>
                </div>
              )}
            </div>

            {selected ? (
              <section className={styles.editor} aria-label={`Crear término ${selected.name}`}>
                <div className={styles.editorHeading}>
                  <span>Candidato seleccionado</span>
                  <h3>{selected.name}</h3>
                  <p>
                    Se detectó en {selected.guideCount} {selected.guideCount === 1 ? "guía" : "guías"}.
                    El destino inicial apuntará al primer ejemplo y podrás editarlo después.
                  </p>
                </div>

                <div className={styles.examples}>
                  {selected.examples.map((example) => (
                    <div key={`${example.guideSlug}-${example.sectionAnchor}`}>
                      <strong>{example.guideTitle}</strong>
                      <span>{example.sectionHeading}</span>
                    </div>
                  ))}
                </div>

                <label className={styles.field}>
                  <span>Definición breve</span>
                  <textarea
                    autoFocus
                    disabled={saving}
                    maxLength={700}
                    onChange={(event) => setDefinition(event.target.value)}
                    placeholder="Definición académica breve que verá el estudiante."
                    rows={5}
                    value={definition}
                  />
                  <small>{definition.length}/700</small>
                </label>

                <label className={styles.field}>
                  <span>Categoría opcional</span>
                  <input
                    disabled={saving}
                    maxLength={120}
                    onChange={(event) => setCategory(event.target.value)}
                    placeholder="Anatomía, bioquímica, embriología…"
                    value={category}
                  />
                </label>

                <button
                  className={styles.create}
                  disabled={saving || !definition.trim()}
                  type="button"
                  onClick={() => void createSuggestionTerm()}
                >
                  <Plus size={17} weight="bold" />
                  {saving ? "Creando…" : "Crear término"}
                </button>
              </section>
            ) : null}
          </div>
        </aside>
      ) : null}
    </>
  );
}
