"use client";

import {
  ArrowClockwise,
  CheckCircle,
  FloppyDisk,
  LinkSimple,
  MagnifyingGlass,
  Plus,
  Tag,
  Trash,
} from "@phosphor-icons/react";
import { type FormEvent, useState } from "react";
import {
  InteractiveTermAdminListSchema,
  InteractiveTermAdminMutationSchema,
  type InteractiveTermAdmin,
  type InteractiveTermAdminDraft,
  type InteractiveTermOccurrencePolicy,
} from "@/lib/interactive-term-admin";
import { AppShell } from "./app-shell";
import { PlatformToast, type PlatformNotice } from "./platform-toast";

type Props = {
  initialTerms: InteractiveTermAdmin[];
  viewerEmail: string;
};

type StatusFilter = "all" | "active" | "inactive";

type AliasDraft = InteractiveTermAdminDraft["aliases"][number];
type DestinationDraft = InteractiveTermAdminDraft["destinations"][number];

const occurrencePolicyOptions: {
  description: string;
  label: string;
  value: InteractiveTermOccurrencePolicy;
}[] = [
  {
    description: "Marca sólo la primera aparición dentro de cada sección.",
    label: "Primera por sección",
    value: "first_per_section",
  },
  {
    description: "Marca sólo la primera aparición en toda la guía.",
    label: "Primera por guía",
    value: "first_per_guide",
  },
  {
    description: "Marca todas las apariciones compatibles.",
    label: "Todas las apariciones",
    value: "all",
  },
];

const errorMessages: Record<string, string> = {
  forbidden: "Sólo un administrador puede modificar el diccionario global.",
  identity_unavailable: "No fue posible validar la sesión.",
  interactive_term_admin_unavailable: "La administración de términos no está disponible.",
  interactive_term_conflict: "Ya existe un término o alias que entra en conflicto con estos datos.",
  interactive_term_guide_not_found: "No existe una guía con uno de los slugs indicados.",
  interactive_term_section_not_found: "No existe el anchor indicado en una de las guías vinculadas.",
  invalid_interactive_term: "Revisa los campos del término antes de guardar.",
  unauthorized: "La sesión terminó. Vuelve a iniciar sesión.",
};

const fallbackErrorMessage = "La administración de términos no está disponible.";

function emptyDraft(): InteractiveTermAdminDraft {
  return {
    aliases: [],
    autoMatch: true,
    category: null,
    destinations: [],
    isActive: true,
    name: "",
    occurrencePolicy: "first_per_section",
    priority: 0,
    shortDefinition: "",
    slug: "",
  };
}

function termToDraft(term: InteractiveTermAdmin): InteractiveTermAdminDraft {
  return {
    aliases: term.aliases.map((alias) => ({ alias: alias.alias, autoMatch: alias.autoMatch })),
    autoMatch: term.autoMatch,
    category: term.category,
    destinations: term.destinations.map((destination) => ({
      guideSlug: destination.guideSlug,
      primary: destination.primary,
      priority: destination.priority,
      sectionAnchor: destination.sectionAnchor,
    })),
    isActive: term.isActive,
    name: term.name,
    occurrencePolicy: term.occurrencePolicy,
    priority: term.priority,
    shortDefinition: term.shortDefinition,
    slug: term.slug,
  };
}

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
  const body: unknown = await response.json().catch(() => ({ error: "interactive_term_admin_unavailable" }));
  const code =
    body && typeof body === "object" && "error" in body && typeof body.error === "string"
      ? body.error
      : "interactive_term_admin_unavailable";
  return errorMessages[code] ?? `No fue posible completar la operación (${response.status}).`;
}

function updateAt<T>(items: T[], index: number, updater: (item: T) => T) {
  return items.map((item, itemIndex) => (itemIndex === index ? updater(item) : item));
}

export function InteractiveTermAdminScreen({ initialTerms, viewerEmail }: Props) {
  const firstTerm = initialTerms.at(0) ?? null;
  const [terms, setTerms] = useState(initialTerms);
  const [selectedId, setSelectedId] = useState<string | null>(firstTerm?.id ?? null);
  const [draft, setDraft] = useState<InteractiveTermAdminDraft>(
    firstTerm ? termToDraft(firstTerm) : emptyDraft(),
  );
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [notice, setNotice] = useState<PlatformNotice | null>(null);
  const [busy, setBusy] = useState<"search" | "save" | null>(null);
  const [creating, setCreating] = useState(firstTerm === null);
  const [slugManual, setSlugManual] = useState(firstTerm !== null);

  const selectedTerm = selectedId ? terms.find((term) => term.id === selectedId) ?? null : null;
  const activeCount = terms.filter((term) => term.isActive).length;
  const totalUsages = terms.reduce((sum, term) => sum + term.usageCount, 0);
  const policyDescription =
    occurrencePolicyOptions.find((option) => option.value === draft.occurrencePolicy)?.description ?? "";

  function selectTerm(term: InteractiveTermAdmin) {
    setSelectedId(term.id);
    setDraft(termToDraft(term));
    setCreating(false);
    setSlugManual(true);
    setNotice(null);
  }

  function createTerm() {
    setSelectedId(null);
    setDraft(emptyDraft());
    setCreating(true);
    setSlugManual(false);
    setNotice(null);
  }

  function updateAlias(index: number, updater: (alias: AliasDraft) => AliasDraft) {
    setDraft((current) => ({
      ...current,
      aliases: updateAt(current.aliases, index, updater),
    }));
  }

  function updateDestination(
    index: number,
    updater: (destination: DestinationDraft) => DestinationDraft,
  ) {
    setDraft((current) => ({
      ...current,
      destinations: updateAt(current.destinations, index, updater),
    }));
  }

  async function search(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (busy) return;
    setBusy("search");
    setNotice(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      params.set(
        "active",
        statusFilter === "all" ? "all" : statusFilter === "active" ? "true" : "false",
      );
      const response = await fetch(`/api/admin/interactive-terms?${params.toString()}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(await readError(response));
      const parsed = InteractiveTermAdminListSchema.safeParse(await response.json());
      if (!parsed.success) throw new Error(fallbackErrorMessage);

      setTerms(parsed.data.terms);
      const next = parsed.data.terms.find((term) => term.id === selectedId)
        ?? parsed.data.terms.at(0)
        ?? null;
      if (next) {
        selectTerm(next);
      } else {
        setSelectedId(null);
        setDraft(emptyDraft());
        setCreating(true);
        setSlugManual(false);
      }
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : fallbackErrorMessage,
      });
    } finally {
      setBusy(null);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!draft.name.trim() || !draft.slug.trim() || !draft.shortDefinition.trim()) {
      setNotice({ tone: "error", text: "Nombre, slug y definición breve son obligatorios." });
      return;
    }

    setBusy("save");
    setNotice(null);
    try {
      const isCreate = creating || !selectedId;
      const endpoint = isCreate
        ? "/api/admin/interactive-terms"
        : `/api/admin/interactive-terms/${selectedId}`;
      const response = await fetch(endpoint, {
        body: JSON.stringify({
          ...draft,
          aliases: draft.aliases
            .filter((alias) => alias.alias.trim())
            .map((alias) => ({ ...alias, alias: alias.alias.trim() })),
          category: draft.category?.trim() || null,
          destinations: draft.destinations
            .filter((destination) => destination.guideSlug.trim())
            .map((destination) => ({
              ...destination,
              guideSlug: destination.guideSlug.trim(),
              sectionAnchor: destination.sectionAnchor?.trim() || null,
            })),
          name: draft.name.trim(),
          shortDefinition: draft.shortDefinition.trim(),
          slug: draft.slug.trim(),
        }),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: isCreate ? "POST" : "PATCH",
      });
      if (!response.ok) throw new Error(await readError(response));
      const parsed = InteractiveTermAdminMutationSchema.safeParse(await response.json());
      if (!parsed.success) throw new Error(fallbackErrorMessage);

      const saved = parsed.data.term;
      setTerms((current) => {
        const exists = current.some((term) => term.id === saved.id);
        return exists
          ? current.map((term) => (term.id === saved.id ? saved : term))
          : [saved, ...current];
      });
      setSelectedId(saved.id);
      setDraft(termToDraft(saved));
      setCreating(false);
      setSlugManual(true);
      setNotice({ tone: "success", text: isCreate ? "Término creado." : "Cambios guardados." });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : fallbackErrorMessage,
      });
    } finally {
      setBusy(null);
    }
  }

  function updateName(name: string) {
    setDraft((current) => ({
      ...current,
      name,
      slug: creating && !slugManual ? slugify(name) : current.slug,
    }));
  }

  function addAlias() {
    setDraft((current) => ({
      ...current,
      aliases: [...current.aliases, { alias: "", autoMatch: true }],
    }));
  }

  function addDestination() {
    setDraft((current) => ({
      ...current,
      destinations: [
        ...current.destinations,
        {
          guideSlug: "",
          primary: current.destinations.length === 0,
          priority: 0,
          sectionAnchor: null,
        },
      ],
    }));
  }

  return (
    <AppShell
      activeKey="terms"
      headerTitle="Términos interactivos"
      isAdministrator
      mainClassName="term-admin-main"
      viewer={{ email: viewerEmail }}
    >
      <PlatformToast notice={notice} onDismiss={() => setNotice(null)} />
      <section className="term-admin-page" aria-label="Administración de términos interactivos">
        <header className="term-admin-hero">
          <div>
            <p className="eyebrow dark">Diccionario global</p>
            <h1>Términos interactivos</h1>
            <p>Define una vez cada concepto y controla cómo aparece en todas las guías de la plataforma.</p>
          </div>
          <button className="studio-button studio-button-primary" type="button" onClick={createTerm}>
            <Plus size={17} aria-hidden="true" />
            Nuevo término
          </button>
        </header>

        <div className="term-admin-stats" aria-label="Resumen del diccionario visible">
          <div><span>Términos cargados</span><strong>{terms.length}</strong></div>
          <div><span>Activos</span><strong>{activeCount}</strong></div>
          <div><span>Apariciones indexadas</span><strong>{totalUsages}</strong></div>
        </div>

        <div className="term-admin-workspace">
          <aside className="term-admin-list-panel" aria-label="Buscar términos">
            <form className="term-admin-search" onSubmit={search}>
              <div className="term-admin-search-input">
                <MagnifyingGlass size={18} aria-hidden="true" />
                <input
                  aria-label="Buscar término"
                  disabled={busy !== null}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Nombre, alias o categoría"
                  value={query}
                />
              </div>
              <div className="term-admin-filter-row">
                <select
                  aria-label="Filtrar por estado"
                  disabled={busy !== null}
                  onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                  value={statusFilter}
                >
                  <option value="all">Todos</option>
                  <option value="active">Activos</option>
                  <option value="inactive">Inactivos</option>
                </select>
                <button className="studio-button studio-button-secondary" disabled={busy !== null} type="submit">
                  {busy === "search"
                    ? <ArrowClockwise className="term-admin-spin" size={17} />
                    : <MagnifyingGlass size={17} />}
                  Buscar
                </button>
              </div>
            </form>

            <div className="term-admin-list" role="list">
              {terms.length ? terms.map((term) => (
                <button
                  className={`term-admin-list-item ${term.id === selectedId && !creating ? "is-selected" : ""}`.trim()}
                  key={term.id}
                  onClick={() => selectTerm(term)}
                  role="listitem"
                  type="button"
                >
                  <span className="term-admin-list-name"><Tag size={16} aria-hidden="true" />{term.name}</span>
                  <span className="term-admin-list-meta">
                    <span>{term.category || "Sin categoría"}</span>
                    <span>{term.usageCount} apariciones</span>
                  </span>
                  <span className={`term-admin-status ${term.isActive ? "is-active" : "is-inactive"}`}>
                    {term.isActive ? "Activo" : "Inactivo"}
                  </span>
                </button>
              )) : (
                <div className="term-admin-empty-list">
                  <Tag size={24} aria-hidden="true" />
                  <p>No hay términos en esta búsqueda.</p>
                </div>
              )}
            </div>
          </aside>

          <form className="term-admin-editor" onSubmit={save}>
            <header className="term-admin-editor-header">
              <div>
                <span>{creating ? "Nuevo término" : "Editando"}</span>
                <h2>{draft.name || "Concepto sin nombre"}</h2>
                {!creating && selectedTerm ? (
                  <p>
                    {selectedTerm.usageCount} apariciones indexadas · actualizado {new Date(selectedTerm.updatedAt).toLocaleDateString("es")}
                  </p>
                ) : (
                  <p>Los cambios de matching reindexarán las guías automáticamente.</p>
                )}
              </div>
              <button className="studio-button studio-button-primary" disabled={busy !== null} type="submit">
                <FloppyDisk size={17} aria-hidden="true" />
                {busy === "save" ? "Guardando…" : "Guardar"}
              </button>
            </header>

            <section className="term-admin-card" aria-labelledby="term-admin-basic-title">
              <div className="term-admin-card-heading">
                <div><Tag size={18} aria-hidden="true" /><h3 id="term-admin-basic-title">Identidad y definición</h3></div>
                <label className="term-admin-switch">
                  <input
                    checked={draft.isActive}
                    onChange={(event) => setDraft((current) => ({ ...current, isActive: event.target.checked }))}
                    type="checkbox"
                  />
                  <span>{draft.isActive ? "Activo" : "Inactivo"}</span>
                </label>
              </div>

              <div className="term-admin-field-grid">
                <label className="term-admin-field">
                  <span>Nombre canónico</span>
                  <input
                    maxLength={180}
                    onChange={(event) => updateName(event.target.value)}
                    placeholder="Arteria mesentérica superior"
                    required
                    value={draft.name}
                  />
                </label>
                <label className="term-admin-field">
                  <span>Slug</span>
                  <input
                    maxLength={180}
                    onChange={(event) => {
                      setSlugManual(true);
                      setDraft((current) => ({ ...current, slug: event.target.value.toLowerCase() }));
                    }}
                    pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                    placeholder="arteria-mesenterica-superior"
                    required
                    value={draft.slug}
                  />
                </label>
                <label className="term-admin-field">
                  <span>Categoría</span>
                  <input
                    maxLength={120}
                    onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}
                    placeholder="Anatomía vascular"
                    value={draft.category ?? ""}
                  />
                </label>
                <label className="term-admin-field">
                  <span>Prioridad de matching</span>
                  <input
                    max={1000}
                    min={-1000}
                    onChange={(event) => setDraft((current) => ({ ...current, priority: Number(event.target.value) || 0 }))}
                    type="number"
                    value={draft.priority}
                  />
                </label>
              </div>

              <label className="term-admin-field term-admin-field-wide">
                <span>Definición breve</span>
                <textarea
                  maxLength={1200}
                  onChange={(event) => setDraft((current) => ({ ...current, shortDefinition: event.target.value }))}
                  placeholder="Descripción breve que verá el estudiante en el popover o bottom sheet."
                  required
                  rows={4}
                  value={draft.shortDefinition}
                />
                <small>{draft.shortDefinition.length}/1200</small>
              </label>
            </section>

            <section className="term-admin-card" aria-labelledby="term-admin-matching-title">
              <div className="term-admin-card-heading">
                <div>
                  <CheckCircle size={18} aria-hidden="true" />
                  <h3 id="term-admin-matching-title">Reglas de aparición</h3>
                </div>
              </div>
              <div className="term-admin-field-grid">
                <label className="term-admin-field">
                  <span>Frecuencia</span>
                  <select
                    onChange={(event) => setDraft((current) => ({
                      ...current,
                      occurrencePolicy: event.target.value as InteractiveTermOccurrencePolicy,
                    }))}
                    value={draft.occurrencePolicy}
                  >
                    {occurrencePolicyOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <small>{policyDescription}</small>
                </label>
                <label className="term-admin-checkbox-card">
                  <input
                    checked={draft.autoMatch}
                    onChange={(event) => setDraft((current) => ({ ...current, autoMatch: event.target.checked }))}
                    type="checkbox"
                  />
                  <span>
                    <strong>Detección automática</strong>
                    <small>Permite que el indexador encuentre el nombre canónico en nuevas guías.</small>
                  </span>
                </label>
              </div>
            </section>

            <section className="term-admin-card" aria-labelledby="term-admin-aliases-title">
              <div className="term-admin-card-heading">
                <div><Tag size={18} aria-hidden="true" /><h3 id="term-admin-aliases-title">Aliases y abreviaturas</h3></div>
                <button className="studio-button studio-button-secondary" onClick={addAlias} type="button">
                  <Plus size={16} aria-hidden="true" />Agregar alias
                </button>
              </div>
              {draft.aliases.length ? (
                <div className="term-admin-repeat-list">
                  {draft.aliases.map((alias, index) => (
                    <div className="term-admin-alias-row" key={`alias-${index}`}>
                      <input
                        aria-label={`Alias ${index + 1}`}
                        maxLength={180}
                        onChange={(event) => updateAlias(index, (item) => ({ ...item, alias: event.target.value }))}
                        placeholder="AMS"
                        value={alias.alias}
                      />
                      <label className="term-admin-inline-check">
                        <input
                          checked={alias.autoMatch}
                          onChange={(event) => updateAlias(index, (item) => ({ ...item, autoMatch: event.target.checked }))}
                          type="checkbox"
                        />
                        Auto-detectar
                      </label>
                      <button
                        aria-label={`Eliminar alias ${alias.alias || index + 1}`}
                        className="term-admin-icon-button"
                        onClick={() => setDraft((current) => ({
                          ...current,
                          aliases: current.aliases.filter((_, itemIndex) => itemIndex !== index),
                        }))}
                        type="button"
                      >
                        <Trash size={17} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="term-admin-empty-section">
                  No hay aliases. El nombre canónico seguirá funcionando por sí solo.
                </p>
              )}
            </section>

            <section className="term-admin-card" aria-labelledby="term-admin-links-title">
              <div className="term-admin-card-heading">
                <div><LinkSimple size={18} aria-hidden="true" /><h3 id="term-admin-links-title">Destinos relacionados</h3></div>
                <button className="studio-button studio-button-secondary" onClick={addDestination} type="button">
                  <Plus size={16} aria-hidden="true" />Agregar destino
                </button>
              </div>
              <p className="term-admin-card-help">
                Usa el slug de una guía y, opcionalmente, el anchor estable de una sección. Un único destino puede ser principal.
              </p>
              {draft.destinations.length ? (
                <div className="term-admin-repeat-list">
                  {draft.destinations.map((destination, index) => (
                    <div className="term-admin-destination-row" key={`destination-${index}`}>
                      <label className="term-admin-field">
                        <span>Slug de la guía</span>
                        <input
                          onChange={(event) => updateDestination(index, (item) => ({
                            ...item,
                            guideSlug: event.target.value,
                          }))}
                          placeholder="vascularizacion-intestinal"
                          value={destination.guideSlug}
                        />
                      </label>
                      <label className="term-admin-field">
                        <span>Anchor de sección</span>
                        <input
                          onChange={(event) => updateDestination(index, (item) => ({
                            ...item,
                            sectionAnchor: event.target.value || null,
                          }))}
                          placeholder="Opcional"
                          value={destination.sectionAnchor ?? ""}
                        />
                      </label>
                      <label className="term-admin-field term-admin-priority-field">
                        <span>Prioridad</span>
                        <input
                          max={1000}
                          min={-1000}
                          onChange={(event) => updateDestination(index, (item) => ({
                            ...item,
                            priority: Number(event.target.value) || 0,
                          }))}
                          type="number"
                          value={destination.priority}
                        />
                      </label>
                      <label className="term-admin-inline-check term-admin-primary-check">
                        <input
                          checked={destination.primary}
                          onChange={(event) => setDraft((current) => ({
                            ...current,
                            destinations: current.destinations.map((item, itemIndex) => ({
                              ...item,
                              primary: event.target.checked
                                ? itemIndex === index
                                : itemIndex === index ? false : item.primary,
                            })),
                          }))}
                          type="checkbox"
                        />
                        Principal
                      </label>
                      <button
                        aria-label={`Eliminar destino ${destination.guideSlug || index + 1}`}
                        className="term-admin-icon-button"
                        onClick={() => setDraft((current) => ({
                          ...current,
                          destinations: current.destinations.filter((_, itemIndex) => itemIndex !== index),
                        }))}
                        type="button"
                      >
                        <Trash size={17} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="term-admin-empty-section">
                  Sin destino vinculado. El término seguirá mostrando su definición breve.
                </p>
              )}
            </section>
          </form>
        </div>
      </section>
    </AppShell>
  );
}
