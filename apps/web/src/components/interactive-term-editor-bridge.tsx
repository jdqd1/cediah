"use client";

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
type Mode = "existing" | "new";

type NewTermDraft = {
  category: string;
  name: string;
  shortDefinition: string;
};

type EditorSelection = {
  point: Point;
  text: string;
};

const fallbackError = "No fue posible actualizar el diccionario de términos.";

const errorMessages: Record<string, string> = {
  forbidden: "Sólo un administrador puede modificar el diccionario global.",
  identity_unavailable: "No fue posible validar la sesión.",
  interactive_term_admin_unavailable: "La administración de términos no está disponible.",
  interactive_term_conflict: "Ya existe un término o alias que entra en conflicto con esta selección.",
  invalid_interactive_term: "Revisa los datos del término antes de guardarlo.",
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
  const [mode, setMode] = useState<Mode>("existing");
  const [query, setQuery] = useState("");
  const [terms, setTerms] = useState<InteractiveTermAdmin[]>([]);
  const [busy, setBusy] = useState<"search" | "save" | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [newTerm, setNewTerm] = useState<NewTermDraft>({
    category: "",
    name: "",
    shortDefinition: "",
  });
  const normalizedSelection = useMemo(() => normalize(selection), [selection]);

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
      setOpen(false);
      setMessage(null);
      setSelection("");
      setPoint(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, open]);

  if (!administrator) return null;

  async function searchTerms(searchQuery = query) {
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
    setQuery(text);
    setNewTerm({ category: "", name: text, shortDefinition: "" });
    setTerms([]);
    setMode("existing");
    setMessage(null);
    setOpen(true);
    void searchTerms(text);
  }

  function closeDialog() {
    if (busy === "save") return;
    setOpen(false);
    setMessage(null);
    setSelection("");
    setPoint(null);
  }

  async function linkToTerm(term: InteractiveTermAdmin) {
    if (busy) return;
    const alreadyRecognized =
      normalize(term.name) === normalizedSelection
      || term.aliases.some((alias) => normalize(alias.alias) === normalizedSelection);

    if (alreadyRecognized) {
      setMessage({
        tone: "success",
        text: `“${selection}” ya está reconocido como ${term.name}.`,
      });
      return;
    }

    setBusy("save");
    setMessage(null);
    try {
      const draft = termToDraft(term);
      const response = await fetch(`/api/admin/interactive-terms/${term.id}`, {
        body: JSON.stringify({
          ...draft,
          aliases: [...draft.aliases, { alias: selection.trim(), autoMatch: true }],
        }),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      if (!response.ok) throw new Error(await readError(response));
      const parsed = InteractiveTermAdminMutationSchema.safeParse(await response.json());
      if (!parsed.success) throw new Error(fallbackError);
      setTerms((current) => current.map((item) => (
        item.id === parsed.data.term.id ? parsed.data.term : item
      )));
      setMessage({
        tone: "success",
        text: `“${selection}” quedó vinculado a ${parsed.data.term.name}.`,
      });
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : fallbackError,
      });
    } finally {
      setBusy(null);
    }
  }

  async function createTerm() {
    if (busy) return;
    const name = newTerm.name.trim();
    const shortDefinition = newTerm.shortDefinition.trim();
    const slug = slugify(name);
    if (!name || !shortDefinition || !slug) {
      setMessage({ tone: "error", text: "Nombre y definición breve son obligatorios." });
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
          category: newTerm.category.trim() || null,
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
      setTerms([parsed.data.term]);
      setMessage({
        tone: "success",
        text: `${parsed.data.term.name} se añadió al diccionario global.`,
      });
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : fallbackError,
      });
    } finally {
      setBusy(null);
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
            aria-label="Convertir selección en término interactivo"
            aria-modal="true"
            className={styles.dialog}
            role="dialog"
          >
            <header className={styles.header}>
              <div>
                <h2>Término interactivo</h2>
                <p>Vincula esta selección al diccionario global sin modificar el contenido de la guía.</p>
              </div>
              <button
                aria-label="Cerrar"
                className={styles.close}
                disabled={busy === "save"}
                type="button"
                onClick={closeDialog}
              >
                ×
              </button>
            </header>

            <div className={styles.body}>
              <p className={styles.selection}>“{selection}”</p>

              <div className={styles.tabs} role="tablist" aria-label="Acción del término">
                <button
                  aria-selected={mode === "existing"}
                  className={`${styles.tab} ${mode === "existing" ? styles.tabActive : ""}`.trim()}
                  role="tab"
                  type="button"
                  onClick={() => {
                    setMode("existing");
                    setMessage(null);
                  }}
                >
                  Vincular existente
                </button>
                <button
                  aria-selected={mode === "new"}
                  className={`${styles.tab} ${mode === "new" ? styles.tabActive : ""}`.trim()}
                  role="tab"
                  type="button"
                  onClick={() => {
                    setMode("new");
                    setMessage(null);
                  }}
                >
                  Crear nuevo
                </button>
              </div>

              {mode === "existing" ? (
                <>
                  <form
                    className={styles.searchRow}
                    onSubmit={(event) => {
                      event.preventDefault();
                      void searchTerms();
                    }}
                  >
                    <input
                      aria-label="Buscar término existente"
                      className={styles.input}
                      disabled={busy !== null}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Nombre, alias o categoría"
                      value={query}
                    />
                    <button className={styles.searchButton} disabled={busy !== null} type="submit">
                      {busy === "search" ? "Buscando…" : "Buscar"}
                    </button>
                  </form>

                  <div className={styles.results}>
                    {terms.map((term) => (
                      <button
                        className={styles.termButton}
                        disabled={busy !== null}
                        key={term.id}
                        type="button"
                        onClick={() => void linkToTerm(term)}
                      >
                        <span>
                          <span className={styles.termName}>{term.name}</span>
                          <span className={styles.termMeta}>
                            {term.category || "Sin categoría"} · {term.shortDefinition}
                          </span>
                        </span>
                        <span className={styles.linkLabel}>Vincular selección</span>
                      </button>
                    ))}
                    {busy !== "search" && terms.length === 0 ? (
                      <p className={styles.empty}>
                        No se encontraron términos. Puedes crear uno nuevo con esta selección.
                      </p>
                    ) : null}
                  </div>
                </>
              ) : (
                <div className={styles.form}>
                  <label className={styles.field}>
                    <span>Nombre canónico</span>
                    <input
                      className={styles.input}
                      disabled={busy !== null}
                      maxLength={180}
                      onChange={(event) => setNewTerm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))}
                      value={newTerm.name}
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Definición breve</span>
                    <textarea
                      className={styles.textarea}
                      disabled={busy !== null}
                      maxLength={1200}
                      onChange={(event) => setNewTerm((current) => ({
                        ...current,
                        shortDefinition: event.target.value,
                      }))}
                      placeholder="Descripción académica breve que verá el estudiante."
                      value={newTerm.shortDefinition}
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Categoría opcional</span>
                    <input
                      className={styles.input}
                      disabled={busy !== null}
                      maxLength={120}
                      onChange={(event) => setNewTerm((current) => ({
                        ...current,
                        category: event.target.value,
                      }))}
                      placeholder="Anatomía, fisiología, clínica…"
                      value={newTerm.category}
                    />
                  </label>
                  <p className={styles.note}>
                    Se creará activo, con reconocimiento automático y política “primera aparición por sección”. Puedes afinarlo después en Términos interactivos.
                  </p>
                  <div className={styles.actions}>
                    <button
                      className={styles.secondaryButton}
                      disabled={busy === "save"}
                      type="button"
                      onClick={closeDialog}
                    >
                      Cancelar
                    </button>
                    <button
                      className={styles.primaryButton}
                      disabled={busy !== null}
                      type="button"
                      onClick={() => void createTerm()}
                    >
                      {busy === "save" ? "Creando…" : "Crear término"}
                    </button>
                  </div>
                </div>
              )}

              {message ? (
                <p className={message.tone === "error" ? styles.error : styles.success}>
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
