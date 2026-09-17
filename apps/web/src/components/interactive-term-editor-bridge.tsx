"use client";

import {
  CheckCircle,
  LinkSimple,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  X,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import {
  InteractiveTermAdminListSchema,
  InteractiveTermAdminMutationSchema,
  type InteractiveTermAdmin,
  type InteractiveTermAdminDraft,
} from "@/lib/interactive-term-admin";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { useAccessRoles } from "./access-context";
import styles from "./interactive-term-editor-bridge.module.css";

type Point = { left: number; top: number };
type EditorSelection = { point: Point; text: string };
type SimpleTermDraft = { name: string; shortDefinition: string };

const fallbackError = "No fue posible guardar el término.";

const errorMessages: Record<string, string> = {
  forbidden: "Sólo un administrador puede modificar los términos interactivos.",
  identity_unavailable: "No fue posible validar la sesión.",
  interactive_term_admin_unavailable: "Los términos interactivos no están disponibles en este momento.",
  interactive_term_conflict: "Ese nombre ya está siendo usado por otro término. Prueba vincularlo con el término existente.",
  invalid_interactive_term: "Revisa el nombre y la definición antes de guardar.",
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

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function nodeElement(node: Node | null) {
  if (!node) return null;
  return node instanceof Element ? node : node.parentElement;
}

function readEditorSelection(): EditorSelection | null {
  const current = window.getSelection();
  if (!current || current.isCollapsed || current.rangeCount === 0) return null;

  const text = current.toString().replace(/\s+/g, " ").trim();
  if (!text || text.length > 180) return null;

  const anchorElement = nodeElement(current.anchorNode);
  const focusElement = nodeElement(current.focusNode);
  const editorRoot = anchorElement?.closest(".guide-editor-canvas .ProseMirror[contenteditable='true']");
  if (!editorRoot || !focusElement || !editorRoot.contains(focusElement)) return null;

  const range = current.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  if (!rect.width && !rect.height) return null;

  return {
    point: {
      left: Math.max(20, Math.min(window.innerWidth - 20, rect.left + rect.width / 2)),
      top: Math.max(56, rect.top - 8),
    },
    text,
  };
}

async function readError(response: Response) {
  const body: unknown = await response.json().catch(() => null);
  const code =
    body && typeof body === "object" && "error" in body && typeof body.error === "string"
      ? body.error
      : null;
  return code
    ? errorMessages[code] ?? `${fallbackError} (${response.status})`
    : `${fallbackError} (${response.status})`;
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

export function InteractiveTermEditorBridge() {
  const roles = useAccessRoles();
  const administrator = roles.includes("administrator");
  const [selection, setSelection] = useState("");
  const [point, setPoint] = useState<Point | null>(null);
  const [open, setOpen] = useState(false);
  const [terms, setTerms] = useState<InteractiveTermAdmin[]>([]);
  const [query, setQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [editingExisting, setEditingExisting] = useState(false);
  const [busy, setBusy] = useState<"search" | "save" | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [draft, setDraft] = useState<SimpleTermDraft>({ name: "", shortDefinition: "" });
  const [existingDraft, setExistingDraft] = useState<SimpleTermDraft>({ name: "", shortDefinition: "" });

  const normalizedSelection = useMemo(() => normalize(selection), [selection]);
  const exactTerm = useMemo(() => terms.find((term) => (
    normalize(term.name) === normalizedSelection
    || term.aliases.some((alias) => normalize(alias.alias) === normalizedSelection)
  )) ?? null, [normalizedSelection, terms]);
  const relatedTerms = useMemo(
    () => terms.filter((term) => term.id !== exactTerm?.id).slice(0, 4),
    [exactTerm, terms],
  );

  useBodyScrollLock(open);

  useEffect(() => {
    if (!administrator || open) return;

    const update = () => {
      const current = readEditorSelection();
      setSelection(current?.text ?? "");
      setPoint(current?.point ?? null);
    };

    const reposition = () => {
      const current = readEditorSelection();
      setPoint(current?.point ?? null);
    };

    document.addEventListener("selectionchange", update);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("selectionchange", update);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [administrator, open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || busy === "save") return;
      closeDialog();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (!administrator) return null;

  function resetDialog() {
    setOpen(false);
    setMessage(null);
    setTerms([]);
    setQuery("");
    setShowSearch(false);
    setEditingExisting(false);
    setSelection("");
    setPoint(null);
  }

  function closeDialog() {
    if (busy === "save") return;
    resetDialog();
  }

  function completeAction(text: string) {
    setMessage({ tone: "success", text });
    window.setTimeout(resetDialog, 700);
  }

  async function searchTerms(searchQuery: string) {
    if (busy) return;
    const trimmed = searchQuery.trim();
    setBusy("search");
    setMessage(null);
    try {
      const params = new URLSearchParams({ active: "true" });
      if (trimmed) params.set("q", trimmed);
      const response = await fetch(`/api/admin/interactive-terms?${params.toString()}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(await readError(response));
      const parsed = InteractiveTermAdminListSchema.safeParse(await response.json());
      if (!parsed.success) throw new Error(fallbackError);
      setTerms(parsed.data.terms);
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : fallbackError,
      });
    } finally {
      setBusy(null);
    }
  }

  function openDialog() {
    const text = selection.trim();
    if (!text) return;
    setDraft({ name: text, shortDefinition: "" });
    setExistingDraft({ name: "", shortDefinition: "" });
    setTerms([]);
    setQuery(text);
    setShowSearch(false);
    setEditingExisting(false);
    setMessage(null);
    setOpen(true);
    void searchTerms(text);
  }

  async function linkToTerm(term: InteractiveTermAdmin) {
    if (busy) return;
    const alreadyRecognized =
      normalize(term.name) === normalizedSelection
      || term.aliases.some((alias) => normalize(alias.alias) === normalizedSelection);

    if (alreadyRecognized) {
      completeAction(`“${selection}” ya está conectado con ${term.name}.`);
      return;
    }

    setBusy("save");
    setMessage(null);
    try {
      const current = termToDraft(term);
      const response = await fetch(`/api/admin/interactive-terms/${term.id}`, {
        body: JSON.stringify({
          ...current,
          aliases: [...current.aliases, { alias: selection.trim(), autoMatch: true }],
        }),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      if (!response.ok) throw new Error(await readError(response));
      const parsed = InteractiveTermAdminMutationSchema.safeParse(await response.json());
      if (!parsed.success) throw new Error(fallbackError);
      setBusy(null);
      completeAction(`Listo. “${selection}” ahora se reconoce como ${parsed.data.term.name}.`);
    } catch (error) {
      setBusy(null);
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : fallbackError,
      });
    }
  }

  async function createTerm() {
    if (busy) return;
    const name = draft.name.trim();
    const shortDefinition = draft.shortDefinition.trim();
    const slug = slugify(name);
    if (!name || !shortDefinition || !slug) {
      setMessage({ tone: "error", text: "Escribe un nombre y una definición breve." });
      return;
    }

    setBusy("save");
    setMessage(null);
    try {
      const aliases = normalize(name) === normalizedSelection
        ? []
        : [{ alias: selection.trim(), autoMatch: true }];
      const response = await fetch("/api/admin/interactive-terms", {
        body: JSON.stringify({
          aliases,
          autoMatch: true,
          category: null,
          destinations: [],
          isActive: true,
          name,
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
      setBusy(null);
      completeAction(`${parsed.data.term.name} ya es un término interactivo.`);
    } catch (error) {
      setBusy(null);
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : fallbackError,
      });
    }
  }

  async function saveExistingTerm() {
    if (!exactTerm || busy) return;
    const name = existingDraft.name.trim();
    const shortDefinition = existingDraft.shortDefinition.trim();
    if (!name || !shortDefinition) {
      setMessage({ tone: "error", text: "Escribe un nombre y una definición breve." });
      return;
    }

    setBusy("save");
    setMessage(null);
    try {
      const current = termToDraft(exactTerm);
      const response = await fetch(`/api/admin/interactive-terms/${exactTerm.id}`, {
        body: JSON.stringify({
          ...current,
          name,
          shortDefinition,
        }),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      if (!response.ok) throw new Error(await readError(response));
      const parsed = InteractiveTermAdminMutationSchema.safeParse(await response.json());
      if (!parsed.success) throw new Error(fallbackError);
      setBusy(null);
      completeAction(`${parsed.data.term.name} quedó actualizado.`);
    } catch (error) {
      setBusy(null);
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : fallbackError,
      });
    }
  }

  return (
    <>
      {!open && selection && point ? (
        <button
          className={styles.trigger}
          style={{ left: point.left, top: point.top }}
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={openDialog}
        >
          <LinkSimple aria-hidden="true" size={14} weight="bold" />
          Término
        </button>
      ) : null}

      {open ? (
        <div
          className={styles.backdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDialog();
          }}
        >
          <section
            aria-label="Crear o vincular término interactivo"
            aria-modal="true"
            className={styles.dialog}
            role="dialog"
          >
            <header className={styles.header}>
              <div>
                <h2>Término</h2>
                <p>Haz que esta selección muestre una explicación al estudiante.</p>
              </div>
              <button
                aria-label="Cerrar"
                className={styles.close}
                disabled={busy === "save"}
                type="button"
                onClick={closeDialog}
              >
                <X aria-hidden="true" size={18} />
              </button>
            </header>

            <div className={styles.body}>
              <div className={styles.selection}>
                <span>Selección</span>
                <strong>“{selection}”</strong>
              </div>

              {busy === "search" && terms.length === 0 ? (
                <div className={styles.loading} role="status">
                  <span /> Comprobando si ya existe…
                </div>
              ) : exactTerm ? (
                <div className={styles.existingPanel}>
                  <div className={styles.existingHeading}>
                    <span className={styles.statusIcon}><CheckCircle size={19} weight="fill" /></span>
                    <div>
                      <small>Ya está conectado</small>
                      <h3>{exactTerm.name}</h3>
                    </div>
                  </div>

                  {editingExisting ? (
                    <div className={styles.form}>
                      <label className={styles.field}>
                        <span>Nombre</span>
                        <input
                          className={styles.input}
                          disabled={busy !== null}
                          maxLength={180}
                          value={existingDraft.name}
                          onChange={(event) => setExistingDraft((current) => ({ ...current, name: event.target.value }))}
                        />
                      </label>
                      <label className={styles.field}>
                        <span>¿Qué significa?</span>
                        <textarea
                          autoFocus
                          className={styles.textarea}
                          disabled={busy !== null}
                          maxLength={1200}
                          placeholder="Escribe una explicación breve y clara."
                          value={existingDraft.shortDefinition}
                          onChange={(event) => setExistingDraft((current) => ({ ...current, shortDefinition: event.target.value }))}
                        />
                      </label>
                      <div className={styles.actions}>
                        <button
                          className={styles.secondaryButton}
                          disabled={busy !== null}
                          type="button"
                          onClick={() => {
                            setEditingExisting(false);
                            setExistingDraft({ name: exactTerm.name, shortDefinition: exactTerm.shortDefinition });
                            setMessage(null);
                          }}
                        >
                          Cancelar
                        </button>
                        <button
                          className={styles.primaryButton}
                          disabled={busy !== null}
                          type="button"
                          onClick={() => void saveExistingTerm()}
                        >
                          {busy === "save" ? "Guardando…" : "Guardar cambios"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className={styles.definition}>{exactTerm.shortDefinition}</p>
                      <p className={styles.smartNote}>Koras ya reconoce esta palabra automáticamente en las guías.</p>
                      <div className={styles.actions}>
                        <button className={styles.secondaryButton} type="button" onClick={closeDialog}>
                          Listo
                        </button>
                        <button
                          className={styles.primaryButton}
                          type="button"
                          onClick={() => {
                            setExistingDraft({
                              name: exactTerm.name,
                              shortDefinition: exactTerm.shortDefinition,
                            });
                            setEditingExisting(true);
                            setMessage(null);
                          }}
                        >
                          <PencilSimple aria-hidden="true" size={15} /> Editar
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <>
                  <div className={styles.createPanel}>
                    <div className={styles.panelTitle}>
                      <span className={styles.plusIcon}><Plus size={17} weight="bold" /></span>
                      <div>
                        <h3>Crear término</h3>
                        <p>Solo necesitas el nombre y una explicación corta.</p>
                      </div>
                    </div>

                    <div className={styles.form}>
                      <label className={styles.field}>
                        <span>Nombre</span>
                        <input
                          className={styles.input}
                          disabled={busy !== null}
                          maxLength={180}
                          value={draft.name}
                          onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                        />
                      </label>
                      <label className={styles.field}>
                        <span>¿Qué significa?</span>
                        <textarea
                          autoFocus
                          className={styles.textarea}
                          disabled={busy !== null}
                          maxLength={1200}
                          placeholder="Ej.: estructura, concepto o definición que el estudiante debe entender de inmediato."
                          value={draft.shortDefinition}
                          onChange={(event) => setDraft((current) => ({ ...current, shortDefinition: event.target.value }))}
                        />
                      </label>
                      <button
                        className={styles.primaryButtonWide}
                        disabled={busy !== null || !draft.name.trim() || !draft.shortDefinition.trim()}
                        type="button"
                        onClick={() => void createTerm()}
                      >
                        {busy === "save" ? "Creando…" : "Crear término"}
                      </button>
                      <p className={styles.smartNote}>Se activará y reconocerá automáticamente. No necesitas configurar nada más.</p>
                    </div>
                  </div>

                  {relatedTerms.length > 0 ? (
                    <section className={styles.suggestions}>
                      <div className={styles.suggestionsHeading}>
                        <strong>¿Quizás ya existe?</strong>
                        <span>Evita duplicados vinculando la selección con uno de estos términos.</span>
                      </div>
                      <div className={styles.results}>
                        {relatedTerms.map((term) => (
                          <button
                            className={styles.termButton}
                            disabled={busy !== null}
                            key={term.id}
                            type="button"
                            onClick={() => void linkToTerm(term)}
                          >
                            <span>
                              <strong>{term.name}</strong>
                              <small>{term.shortDefinition}</small>
                            </span>
                            <span>Usar este</span>
                          </button>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  <div className={styles.searchArea}>
                    {!showSearch ? (
                      <button className={styles.textButton} type="button" onClick={() => setShowSearch(true)}>
                        <MagnifyingGlass aria-hidden="true" size={15} /> Buscar un término existente
                      </button>
                    ) : (
                      <form
                        className={styles.searchRow}
                        onSubmit={(event) => {
                          event.preventDefault();
                          void searchTerms(query);
                        }}
                      >
                        <input
                          aria-label="Buscar término existente"
                          className={styles.input}
                          disabled={busy !== null}
                          onChange={(event) => setQuery(event.target.value)}
                          placeholder="Escribe el nombre del término"
                          value={query}
                        />
                        <button className={styles.searchButton} disabled={busy !== null} type="submit">
                          {busy === "search" ? "Buscando…" : "Buscar"}
                        </button>
                      </form>
                    )}
                  </div>
                </>
              )}

              {message ? (
                <p className={message.tone === "error" ? styles.error : styles.success} role="status">
                  {message.text}
                </p>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
