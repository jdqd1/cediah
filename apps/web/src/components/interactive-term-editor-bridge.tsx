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
import {
  isContentSearchResponse,
  type ContentSearchResult,
} from "@/lib/content-search";
import { GuideTermManifestSchema, type GuideTermOccurrence } from "@/lib/guide-terms";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { useAccessRoles } from "./access-context";
import { setGuideTermPreviewManifest } from "./guide-term-context";
import styles from "./interactive-term-editor-bridge.module.css";

type Point = { left: number; top: number };
type EditorSelection = { point: Point; text: string };
type SimpleTermDraft = { name: string; shortDefinition: string };
type RelatedGuide = { guideSlug: string; guideTitle: string; topic: string };
type PreviewLeaf = { path: string; section: string; text: string };
type PreviewSource = {
  leaves: PreviewLeaf[];
  mode: "editor" | "preview";
  textNodes: Map<string, Text>;
};

type HighlightRegistry = {
  delete(name: string): boolean;
  set(name: string, highlight: unknown): void;
};
type HighlightConstructor = new (...ranges: Range[]) => unknown;

const fallbackError = "No fue posible guardar el término.";
const editorHighlightName = "koraz-editor-interactive-terms";
const termsChangedEvent = "koraz:interactive-terms-changed";

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

function relatedGuideFromTerm(term: InteractiveTermAdmin): RelatedGuide | null {
  const destination = term.destinations.find((item) => item.primary) ?? term.destinations[0];
  return destination
    ? {
        guideSlug: destination.guideSlug,
        guideTitle: destination.guideTitle,
        topic: destination.sectionHeading ?? "",
      }
    : null;
}

function relatedGuideFromSearch(result: ContentSearchResult): RelatedGuide | null {
  if (result.kind !== "guide") return null;
  const match = result.href.match(/^\/guias\/([^/?#]+)/);
  if (!match?.[1]) return null;
  try {
    return {
      guideSlug: decodeURIComponent(match[1]),
      guideTitle: result.title,
      topic: result.topic,
    };
  } catch {
    return null;
  }
}

function destinationForGuide(guide: RelatedGuide | null) {
  return guide
    ? [{
        guideSlug: guide.guideSlug,
        primary: true,
        priority: 0,
        sectionAnchor: null,
      }]
    : [];
}

function highlightRegistry(): HighlightRegistry | null {
  if (typeof CSS === "undefined") return null;
  return (CSS as unknown as { highlights?: HighlightRegistry }).highlights ?? null;
}

function clearEditorHighlights() {
  highlightRegistry()?.delete(editorHighlightName);
}

function applyEditorHighlights(
  occurrences: readonly GuideTermOccurrence[],
  textNodes: Map<string, Text>,
) {
  const registry = highlightRegistry();
  const HighlightClass = (globalThis as unknown as { Highlight?: HighlightConstructor }).Highlight;
  if (!registry || !HighlightClass) return;

  const ranges: Range[] = [];
  for (const occurrence of occurrences) {
    const textNode = textNodes.get(occurrence.p);
    if (!textNode || occurrence.s < 0 || occurrence.e > textNode.data.length || occurrence.e <= occurrence.s) continue;
    const range = document.createRange();
    range.setStart(textNode, occurrence.s);
    range.setEnd(textNode, occurrence.e);
    ranges.push(range);
  }

  registry.delete(editorHighlightName);
  if (ranges.length > 0) registry.set(editorHighlightName, new HighlightClass(...ranges));
}

function previewSourceFromReader(): PreviewSource | null {
  const article = document.querySelector<HTMLElement>(
    ".guide-editor-page .published-rich-guide-article",
  );
  if (!article) return null;

  const spans = Array.from(article.querySelectorAll<HTMLElement>("[data-guide-term-path]"));
  if (spans.length === 0) return null;

  let section = "__root";
  const leaves: PreviewLeaf[] = [];
  for (const span of spans) {
    const path = span.dataset.guideTermPath;
    if (!path) continue;
    const heading = span.closest("h1, h2, h3, h4, h5, h6");
    if (heading) {
      section = `heading:${path}`;
      continue;
    }
    if (span.querySelector("a.rich-guide-link, code") || span.closest("a.rich-guide-link, code")) continue;
    leaves.push({ path, section, text: span.textContent ?? "" });
  }

  return { leaves, mode: "preview", textNodes: new Map() };
}

function previewSourceFromEditor(): PreviewSource | null {
  const root = document.querySelector<HTMLElement>(
    ".guide-editor-canvas .ProseMirror[contenteditable='true']",
  );
  if (!root) return null;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const leaves: PreviewLeaf[] = [];
  const textNodes = new Map<string, Text>();
  const seenHeadings = new Set<Element>();
  let section = "__root";
  let leafIndex = 0;
  let headingIndex = 0;
  let current = walker.nextNode();

  while (current) {
    const textNode = current as Text;
    const parent = textNode.parentElement;
    const heading = parent?.closest("h1, h2, h3, h4, h5, h6") ?? null;
    if (heading) {
      if (!seenHeadings.has(heading)) {
        seenHeadings.add(heading);
        section = `heading:${headingIndex}`;
        headingIndex += 1;
      }
      current = walker.nextNode();
      continue;
    }
    if (!parent || parent.closest("a, code, pre") || !textNode.data) {
      current = walker.nextNode();
      continue;
    }

    const path = `editor:${leafIndex}`;
    leafIndex += 1;
    leaves.push({ path, section, text: textNode.data });
    textNodes.set(path, textNode);
    current = walker.nextNode();
  }

  return { leaves, mode: "editor", textNodes };
}

function currentPreviewSource() {
  return previewSourceFromReader() ?? previewSourceFromEditor();
}

function sourceFingerprint(source: PreviewSource) {
  return `${source.mode}|${source.leaves.map((leaf) => `${leaf.path}\u0000${leaf.section}\u0000${leaf.text}`).join("\u0001")}`;
}

function notifyTermsChanged() {
  window.dispatchEvent(new CustomEvent(termsChangedEvent));
}

function RelatedGuidePicker({
  busy,
  onClear,
  onQueryChange,
  onSearch,
  onSelect,
  query,
  results,
  selected,
}: {
  busy: boolean;
  onClear: () => void;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  onSelect: (guide: RelatedGuide) => void;
  query: string;
  results: ContentSearchResult[];
  selected: RelatedGuide | null;
}) {
  return (
    <div className={styles.field}>
      <span>Artículo relacionado <small>(opcional)</small></span>
      {selected ? (
        <div className={styles.selection}>
          <span>Ver en profundidad llevará a</span>
          <strong>{selected.guideTitle}</strong>
          {selected.topic ? <small>{selected.topic}</small> : null}
          <button
            className={styles.textButton}
            disabled={busy}
            type="button"
            onClick={onClear}
          >
            <X aria-hidden="true" size={14} /> Quitar artículo
          </button>
        </div>
      ) : (
        <>
          <form
            className={styles.searchRow}
            onSubmit={(event) => {
              event.preventDefault();
              onSearch();
            }}
          >
            <input
              aria-label="Buscar artículo relacionado"
              className={styles.input}
              disabled={busy}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Buscar una guía de Koras"
              value={query}
            />
            <button className={styles.searchButton} disabled={busy || query.trim().length < 2} type="submit">
              <MagnifyingGlass aria-hidden="true" size={15} />
              {busy ? "Buscando…" : "Buscar"}
            </button>
          </form>
          {results.length > 0 ? (
            <div className={styles.results}>
              {results.map((result) => {
                const guide = relatedGuideFromSearch(result);
                if (!guide) return null;
                return (
                  <button
                    className={styles.termButton}
                    disabled={busy}
                    key={result.id}
                    type="button"
                    onClick={() => onSelect(guide)}
                  >
                    <span>
                      <strong>{result.title}</strong>
                      <small>{result.topic || result.excerpt}</small>
                    </span>
                    <span>Vincular</span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </>
      )}
      <p className={styles.smartNote}>
        Al tocar las acciones del término, el estudiante podrá abrir esta guía sin tener que buscarla.
      </p>
    </div>
  );
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
  const [articleBusy, setArticleBusy] = useState(false);
  const [articleQuery, setArticleQuery] = useState("");
  const [articleResults, setArticleResults] = useState<ContentSearchResult[]>([]);
  const [selectedGuide, setSelectedGuide] = useState<RelatedGuide | null>(null);
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
  const removableAliasIds = useMemo(() => {
    if (!exactTerm || normalize(exactTerm.name) === normalizedSelection) return new Set<string>();
    return new Set(
      exactTerm.aliases
        .filter((alias) => normalize(alias.alias) === normalizedSelection)
        .map((alias) => alias.id),
    );
  }, [exactTerm, normalizedSelection]);
  const canUnlink = removableAliasIds.size > 0;
  const currentRelatedGuide = useMemo(
    () => exactTerm ? relatedGuideFromTerm(exactTerm) : null,
    [exactTerm],
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
    if (!administrator) {
      setGuideTermPreviewManifest(null);
      clearEditorHighlights();
      return;
    }

    let timer: number | null = null;
    let controller: AbortController | null = null;
    let lastFingerprint = "";

    const synchronize = async (force = false) => {
      const source = currentPreviewSource();
      if (!source) {
        lastFingerprint = "";
        setGuideTermPreviewManifest(null);
        clearEditorHighlights();
        return;
      }
      const fingerprint = sourceFingerprint(source);
      if (!force && fingerprint === lastFingerprint) return;
      lastFingerprint = fingerprint;

      controller?.abort();
      controller = new AbortController();
      try {
        const response = await fetch("/api/admin/interactive-terms/preview", {
          body: JSON.stringify({ leaves: source.leaves }),
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          method: "POST",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const parsed = GuideTermManifestSchema.safeParse(await response.json());
        if (!parsed.success) return;

        if (source.mode === "preview") {
          clearEditorHighlights();
          setGuideTermPreviewManifest(parsed.data);
        } else {
          setGuideTermPreviewManifest(null);
          applyEditorHighlights(parsed.data.occurrences, source.textNodes);
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          // Preview hints are non-blocking; term creation/editing remains usable.
        }
      }
    };

    const schedule = (force = false) => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        void synchronize(force);
      }, force ? 0 : 320);
    };

    const observer = new MutationObserver(() => schedule(false));
    observer.observe(document.body, { childList: true, characterData: true, subtree: true });
    const refresh = () => schedule(true);
    window.addEventListener(termsChangedEvent, refresh);
    schedule(true);

    return () => {
      if (timer !== null) window.clearTimeout(timer);
      controller?.abort();
      observer.disconnect();
      window.removeEventListener(termsChangedEvent, refresh);
      setGuideTermPreviewManifest(null);
      clearEditorHighlights();
    };
  }, [administrator]);

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

  function resetArticlePicker(guide: RelatedGuide | null = null) {
    setArticleBusy(false);
    setArticleQuery("");
    setArticleResults([]);
    setSelectedGuide(guide);
  }

  function resetDialog() {
    setOpen(false);
    setMessage(null);
    setTerms([]);
    setQuery("");
    setShowSearch(false);
    setEditingExisting(false);
    resetArticlePicker();
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
      setMessage({ tone: "error", text: error instanceof Error ? error.message : fallbackError });
    } finally {
      setBusy(null);
    }
  }

  async function searchArticles() {
    const trimmed = articleQuery.trim();
    if (articleBusy || trimmed.length < 2) return;
    setArticleBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/search?query=${encodeURIComponent(trimmed)}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("No fue posible buscar guías en este momento.");
      const body: unknown = await response.json();
      if (!isContentSearchResponse(body)) throw new Error("No fue posible leer los resultados de búsqueda.");
      setArticleResults(body.guides);
      if (body.guides.length === 0) {
        setMessage({ tone: "error", text: "No encontré una guía publicada con esa búsqueda." });
      }
    } catch (error) {
      setArticleResults([]);
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "No fue posible buscar guías." });
    } finally {
      setArticleBusy(false);
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
    resetArticlePicker();
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
      notifyTermsChanged();
      completeAction(`Listo. “${selection}” ahora se reconoce como ${parsed.data.term.name}.`);
    } catch (error) {
      setBusy(null);
      setMessage({ tone: "error", text: error instanceof Error ? error.message : fallbackError });
    }
  }

  async function unlinkTerm() {
    if (!exactTerm || !canUnlink || busy) return;
    setBusy("save");
    setMessage(null);
    try {
      const current = termToDraft(exactTerm);
      const response = await fetch(`/api/admin/interactive-terms/${exactTerm.id}`, {
        body: JSON.stringify({
          ...current,
          aliases: exactTerm.aliases
            .filter((alias) => !removableAliasIds.has(alias.id))
            .map((alias) => ({ alias: alias.alias, autoMatch: alias.autoMatch })),
        }),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      if (!response.ok) throw new Error(await readError(response));
      const parsed = InteractiveTermAdminMutationSchema.safeParse(await response.json());
      if (!parsed.success) throw new Error(fallbackError);
      setBusy(null);
      notifyTermsChanged();
      completeAction(`“${selection}” dejó de estar vinculado a ${parsed.data.term.name}.`);
    } catch (error) {
      setBusy(null);
      setMessage({ tone: "error", text: error instanceof Error ? error.message : fallbackError });
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
          destinations: destinationForGuide(selectedGuide),
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
      notifyTermsChanged();
      completeAction(`${parsed.data.term.name} ya es un término interactivo.`);
    } catch (error) {
      setBusy(null);
      setMessage({ tone: "error", text: error instanceof Error ? error.message : fallbackError });
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
          destinations: destinationForGuide(selectedGuide),
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
      notifyTermsChanged();
      completeAction(`${parsed.data.term.name} quedó actualizado.`);
    } catch (error) {
      setBusy(null);
      setMessage({ tone: "error", text: error instanceof Error ? error.message : fallbackError });
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
                      <RelatedGuidePicker
                        busy={articleBusy || busy !== null}
                        onClear={() => {
                          setSelectedGuide(null);
                          setArticleResults([]);
                        }}
                        onQueryChange={(value) => {
                          setArticleQuery(value);
                          setArticleResults([]);
                        }}
                        onSearch={() => void searchArticles()}
                        onSelect={(guide) => {
                          setSelectedGuide(guide);
                          setArticleQuery("");
                          setArticleResults([]);
                          setMessage(null);
                        }}
                        query={articleQuery}
                        results={articleResults}
                        selected={selectedGuide}
                      />
                      <div className={styles.actions}>
                        <button
                          className={styles.secondaryButton}
                          disabled={busy !== null}
                          type="button"
                          onClick={() => {
                            setEditingExisting(false);
                            setExistingDraft({ name: exactTerm.name, shortDefinition: exactTerm.shortDefinition });
                            resetArticlePicker(currentRelatedGuide);
                            setMessage(null);
                          }}
                        >
                          Cancelar
                        </button>
                        <button
                          className={styles.primaryButton}
                          disabled={busy !== null || articleBusy}
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
                      {currentRelatedGuide ? (
                        <div className={styles.selection}>
                          <span>Artículo relacionado</span>
                          <strong>{currentRelatedGuide.guideTitle}</strong>
                        </div>
                      ) : null}
                      <p className={styles.smartNote}>Koras ya reconoce esta palabra automáticamente en las guías.</p>
                      <div className={styles.actions}>
                        {canUnlink ? (
                          <button
                            className={`${styles.secondaryButton} term-unlink-button`}
                            disabled={busy !== null}
                            type="button"
                            onClick={() => void unlinkTerm()}
                          >
                            {busy === "save" ? "Desvinculando…" : "Desvincular"}
                          </button>
                        ) : null}
                        <button className={styles.secondaryButton} type="button" onClick={closeDialog}>
                          Listo
                        </button>
                        <button
                          className={styles.primaryButton}
                          type="button"
                          onClick={() => {
                            setExistingDraft({ name: exactTerm.name, shortDefinition: exactTerm.shortDefinition });
                            resetArticlePicker(currentRelatedGuide);
                            setEditingExisting(true);
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
                        <p>Nombre, explicación y, si quieres, una guía para profundizar.</p>
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
                      <RelatedGuidePicker
                        busy={articleBusy || busy !== null}
                        onClear={() => {
                          setSelectedGuide(null);
                          setArticleResults([]);
                        }}
                        onQueryChange={(value) => {
                          setArticleQuery(value);
                          setArticleResults([]);
                        }}
                        onSearch={() => void searchArticles()}
                        onSelect={(guide) => {
                          setSelectedGuide(guide);
                          setArticleQuery("");
                          setArticleResults([]);
                          setMessage(null);
                        }}
                        query={articleQuery}
                        results={articleResults}
                        selected={selectedGuide}
                      />
                      <button
                        className={styles.primaryButtonWide}
                        disabled={busy !== null || articleBusy || !draft.name.trim() || !draft.shortDefinition.trim()}
                        type="button"
                        onClick={() => void createTerm()}
                      >
                        {busy === "save" ? "Creando…" : "Crear término"}
                      </button>
                      <p className={styles.smartNote}>Se activará y reconocerá automáticamente. No necesitas configurar opciones técnicas.</p>
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
