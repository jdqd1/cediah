"use client";

import {
  createPortal,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowSquareOut,
  ArrowsLeftRight,
  SpinnerGap,
  X,
} from "@phosphor-icons/react";
import type { ContentItem, GuideKnowledgeIndex } from "@cediah/contracts";
import { sectionsToRichTextDocument } from "@/lib/guide-document";
import { normalizeMarkdownHighlights } from "@/lib/guide-markdown";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import {
  GuideKnowledgeStateProvider,
  useGuideKnowledge,
} from "./guide-knowledge-context";
import { RichTextRenderer } from "./rich-text-renderer";

type GuideItem = Extract<ContentItem, { kind: "guide" }>;

type ComparisonPayload = {
  item: GuideItem;
  knowledge: GuideKnowledgeIndex | null;
};

type ComparisonLoadState =
  | { status: "idle" | "loading" }
  | { status: "error" }
  | { payload: ComparisonPayload; status: "ready" };

const comparisonCache = new Map<string, Promise<ComparisonPayload>>();

function guideHref(slug: string, anchor?: string | null) {
  return `/guias/${slug}${anchor ? `#${anchor}` : ""}`;
}

function documentForGuide(item: GuideItem) {
  return normalizeMarkdownHighlights(
    item.content.document ?? sectionsToRichTextDocument(item.content.sections),
  );
}

async function fetchComparisonGuide(slug: string): Promise<ComparisonPayload> {
  const cached = comparisonCache.get(slug);
  if (cached) return cached;

  const request = fetch(`/api/guide-compare/${encodeURIComponent(slug)}`, {
    headers: { Accept: "application/json" },
  }).then(async (response) => {
    if (!response.ok) throw new Error("comparison_unavailable");
    const payload = await response.json() as {
      item?: ContentItem;
      knowledge?: GuideKnowledgeIndex | null;
    };
    if (!payload.item || payload.item.kind !== "guide") throw new Error("comparison_invalid");
    return { item: payload.item, knowledge: payload.knowledge ?? null };
  }).catch((error) => {
    comparisonCache.delete(slug);
    throw error;
  });
  comparisonCache.set(slug, request);
  return request;
}

function scrollPaneToAnchor(pane: HTMLElement | null, anchor: string | null | undefined) {
  if (!pane || !anchor) return;
  const escaped = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(anchor) : anchor.replace(/[^a-zA-Z0-9_-]/g, "");
  const target = pane.querySelector<HTMLElement>(`#${escaped}`);
  if (target) pane.scrollTo({ top: Math.max(0, target.offsetTop - 76), behavior: "instant" });
}

function GuideComparisonLayer() {
  const context = useGuideKnowledge();
  const router = useRouter();
  const target = context?.comparisonTarget ?? null;
  const primaryGuide = context?.primaryGuide ?? null;
  const [loadState, setLoadState] = useState<ComparisonLoadState>({ status: "idle" });
  const [ratio, setRatio] = useState(50);
  const [swapped, setSwapped] = useState(false);
  const [dragging, setDragging] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const primaryPaneRef = useRef<HTMLElement>(null);
  const relatedPaneRef = useRef<HTMLElement>(null);
  useBodyScrollLock(Boolean(target));

  useEffect(() => {
    if (!target) {
      setLoadState({ status: "idle" });
      setSwapped(false);
      return;
    }
    let active = true;
    setLoadState({ status: "loading" });
    void fetchComparisonGuide(target.slug)
      .then((payload) => {
        if (active) setLoadState({ payload, status: "ready" });
      })
      .catch(() => {
        if (active) setLoadState({ status: "error" });
      });
    return () => { active = false; };
  }, [target]);

  useEffect(() => {
    if (!target) return;
    const saved = Number(window.sessionStorage.getItem("cediah:guide-split-ratio"));
    if (Number.isFinite(saved) && saved >= 28 && saved <= 72) setRatio(saved);
  }, [target]);

  useEffect(() => {
    if (!target) return;
    window.sessionStorage.setItem("cediah:guide-split-ratio", String(ratio));
  }, [ratio, target]);

  useEffect(() => {
    if (!target || !context?.comparisonSourceAnchor) return;
    const frame = window.requestAnimationFrame(() => {
      scrollPaneToAnchor(primaryPaneRef.current, context.comparisonSourceAnchor);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [context?.comparisonSourceAnchor, target]);

  useEffect(() => {
    if (!target || loadState.status !== "ready") return;
    const frame = window.requestAnimationFrame(() => {
      scrollPaneToAnchor(relatedPaneRef.current, target.anchor);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loadState, target]);

  useEffect(() => {
    if (!dragging) return;
    const move = (event: globalThis.PointerEvent) => {
      const frame = frameRef.current?.getBoundingClientRect();
      if (!frame || frame.width <= 0) return;
      const next = ((event.clientX - frame.left) / frame.width) * 100;
      setRatio(Math.min(72, Math.max(28, next)));
    };
    const stop = () => setDragging(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
  }, [dragging]);

  const primaryDocument = useMemo(
    () => primaryGuide ? documentForGuide(primaryGuide) : null,
    [primaryGuide],
  );
  const relatedDocument = useMemo(
    () => loadState.status === "ready" ? documentForGuide(loadState.payload.item) : null,
    [loadState],
  );

  if (!target || !primaryGuide || typeof document === "undefined") return null;

  const stayWithRelated = () => router.push(guideHref(target.slug, target.anchor));
  const closeRelated = () => context?.closeComparison();
  const primaryOrder = swapped ? 3 : 1;
  const relatedOrder = swapped ? 1 : 3;
  const primaryWidth = swapped ? 100 - ratio : ratio;
  const relatedWidth = 100 - primaryWidth;

  function resizeFromKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const delta = event.key === "ArrowLeft" ? -4 : 4;
    setRatio((value) => Math.min(72, Math.max(28, value + delta)));
  }

  return createPortal(
    <div aria-label="Comparación de guías" aria-modal="true" className="guide-comparison-overlay" role="dialog">
      <div className="guide-comparison-mobile-bar">
        <button type="button" onClick={closeRelated}>
          <ArrowLeft aria-hidden="true" size={18} /> Volver
        </button>
        <button className="is-primary" type="button" onClick={stayWithRelated}>
          Quedarme aquí
        </button>
      </div>
      <div className="guide-comparison-frame" ref={frameRef}>
        <section
          className="guide-comparison-pane guide-comparison-primary"
          ref={primaryPaneRef}
          style={{ order: primaryOrder, width: `${primaryWidth}%` }}
        >
          <ComparisonHeader
            title={primaryGuide.title}
            href={guideHref(primaryGuide.slug, context?.comparisonSourceAnchor)}
            onClose={stayWithRelated}
            onSwap={() => setSwapped((value) => !value)}
          />
          <div className="guide-comparison-reading">
            {primaryDocument ? (
              <RichTextRenderer document={primaryDocument} knowledge={context?.knowledge ?? null} />
            ) : null}
          </div>
        </section>

        <div
          aria-label="Cambiar ancho de las guías"
          aria-orientation="vertical"
          aria-valuemax={72}
          aria-valuemin={28}
          aria-valuenow={Math.round(ratio)}
          className="guide-comparison-divider"
          role="separator"
          style={{ order: 2 }}
          tabIndex={0}
          onKeyDown={resizeFromKeyboard}
          onPointerDown={(event: PointerEvent<HTMLDivElement>) => {
            event.preventDefault();
            setDragging(true);
          }}
        >
          <span aria-hidden="true" />
        </div>

        <section
          className="guide-comparison-pane guide-comparison-related"
          ref={relatedPaneRef}
          style={{ order: relatedOrder, width: `${relatedWidth}%` }}
        >
          <ComparisonHeader
            title={loadState.status === "ready" ? loadState.payload.item.title : target.title}
            href={guideHref(target.slug, target.anchor)}
            onClose={closeRelated}
            onSwap={() => setSwapped((value) => !value)}
          />
          <div className="guide-comparison-reading">
            {loadState.status === "loading" ? (
              <div className="guide-comparison-status" role="status">
                <SpinnerGap aria-hidden="true" className="is-spinning" size={20} /> Cargando guía relacionada…
              </div>
            ) : null}
            {loadState.status === "error" ? (
              <div className="guide-comparison-status" role="alert">
                No fue posible cargar esta guía. Puedes abrirla directamente.
                <a href={guideHref(target.slug, target.anchor)}>Abrir guía</a>
              </div>
            ) : null}
            {loadState.status === "ready" && relatedDocument ? (
              <RichTextRenderer document={relatedDocument} knowledge={loadState.payload.knowledge} />
            ) : null}
          </div>
        </section>
      </div>
    </div>,
    document.body,
  );
}

function ComparisonHeader({
  href,
  onClose,
  onSwap,
  title,
}: {
  href: string;
  onClose: () => void;
  onSwap: () => void;
  title: string;
}) {
  return (
    <header className="guide-comparison-header">
      <strong title={title}>{title}</strong>
      <div>
        <button aria-label="Intercambiar lados" title="Intercambiar lados" type="button" onClick={onSwap}>
          <ArrowsLeftRight aria-hidden="true" size={17} />
        </button>
        <a aria-label="Abrir en una pestaña nueva" href={href} rel="noopener noreferrer" target="_blank" title="Abrir en una pestaña nueva">
          <ArrowSquareOut aria-hidden="true" size={17} />
        </a>
        <button aria-label="Cerrar este panel" title="Cerrar este panel" type="button" onClick={onClose}>
          <X aria-hidden="true" size={17} />
        </button>
      </div>
    </header>
  );
}

export function GuideKnowledgeShell({
  children,
  knowledge,
  primaryGuide,
}: {
  children: ReactNode;
  knowledge: GuideKnowledgeIndex | null;
  primaryGuide: GuideItem | null;
}) {
  return (
    <GuideKnowledgeStateProvider knowledge={knowledge} primaryGuide={primaryGuide}>
      {children}
      <GuideComparisonLayer />
    </GuideKnowledgeStateProvider>
  );
}
