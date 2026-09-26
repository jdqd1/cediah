"use client";

import Link from "next/link";
import { ArrowLeft, ArrowSquareOut, ArrowsLeftRight, X } from "@phosphor-icons/react";
import type { ContentItem } from "@cediah/contracts";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { GuideTermManifest } from "@/lib/guide-terms";
import { sectionsToRichTextDocument } from "@/lib/guide-document";
import { normalizeMarkdownHighlights } from "@/lib/guide-markdown";
import { useContentView } from "@/lib/use-content-view";
import { AppShell } from "./app-shell";
import { GuideTermProvider } from "./guide-term-context";
import { RichTextRenderer } from "./rich-text-renderer";

type GuideItem = Extract<ContentItem, { kind: "guide" }>;
type PanelRole = "original" | "related";

type Panel = {
  item: GuideItem;
  manifest: GuideTermManifest | null;
  role: PanelRole;
};

function guideDocument(item: GuideItem) {
  return normalizeMarkdownHighlights(
    item.content.document ?? sectionsToRichTextDocument(item.content.sections),
  );
}

function GuidePanel({ panel }: { panel: Panel }) {
  const document = useMemo(() => guideDocument(panel.item), [panel.item]);
  return (
    <GuideTermProvider manifest={panel.manifest}>
      <article className="guide-split-article">
        <header>
          <span>Guía</span>
          <h2>{panel.item.title}</h2>
        </header>
        <RichTextRenderer document={document} />
      </article>
    </GuideTermProvider>
  );
}

function guideHref(item: GuideItem, anchor?: string) {
  return `/guias/${encodeURIComponent(item.slug)}${anchor ? `#${anchor}` : ""}`;
}

function panelLabel(panel: Panel) {
  return panel.role === "original" ? "Original" : "Relacionado";
}

export function GuideSplitView({
  compareAnchor,
  isAdministrator = false,
  primary,
  primaryManifest,
  related,
  relatedManifest,
}: {
  compareAnchor?: string;
  isAdministrator?: boolean;
  primary: GuideItem;
  primaryManifest: GuideTermManifest | null;
  related: GuideItem;
  relatedManifest: GuideTermManifest | null;
}) {
  useContentView(primary.id);
  const [left, setLeft] = useState<Panel | null>({
    item: primary,
    manifest: primaryManifest,
    role: "original",
  });
  const [right, setRight] = useState<Panel | null>({
    item: related,
    manifest: relatedManifest,
    role: "related",
  });
  const [ratio, setRatio] = useState(50);
  const [mobileActive, setMobileActive] = useState<"left" | "right">("right");
  const containerRef = useRef<HTMLDivElement>(null);
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);
  const scrollPositionsRef = useRef(new Map<string, number>());

  function rememberScrollPositions() {
    if (left && leftScrollRef.current) {
      scrollPositionsRef.current.set(left.item.slug, leftScrollRef.current.scrollTop);
    }
    if (right && rightScrollRef.current) {
      scrollPositionsRef.current.set(right.item.slug, rightScrollRef.current.scrollTop);
    }
  }

  useEffect(() => {
    if (!left || !right) return;
    const frame = window.requestAnimationFrame(() => {
      const panels = [
        { panel: left, root: leftScrollRef.current },
        { panel: right, root: rightScrollRef.current },
      ];
      for (const current of panels) {
        const root = current.root;
        if (!root) continue;
        const saved = scrollPositionsRef.current.get(current.panel.item.slug);
        if (saved !== undefined) {
          root.scrollTop = saved;
          continue;
        }
        if (current.panel.role !== "related" || !compareAnchor) continue;
        const escaped = typeof CSS !== "undefined" && "escape" in CSS
          ? CSS.escape(compareAnchor)
          : compareAnchor.replace(/[^a-zA-Z0-9_-]/g, "");
        root.querySelector<HTMLElement>(`#${escaped}`)?.scrollIntoView({ block: "start" });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [compareAnchor, left, right]);

  function keepPanel(side: "left" | "right") {
    const selected = side === "left" ? left : right;
    if (!selected) return;
    rememberScrollPositions();
    setLeft(selected);
    setRight(null);
    setMobileActive("left");
  }

  function closeLeft() {
    rememberScrollPositions();
    if (right) {
      setLeft(right);
      setRight(null);
      setMobileActive("left");
      return;
    }
    setLeft(null);
  }

  function closeRight() {
    rememberScrollPositions();
    setRight(null);
    setMobileActive("left");
  }

  function swap() {
    if (!left || !right) return;
    rememberScrollPositions();
    setLeft(right);
    setRight(left);
    setRatio(100 - ratio);
    setMobileActive((current) => current === "left" ? "right" : "left");
  }

  function beginResize(event: ReactPointerEvent<HTMLButtonElement>) {
    const container = containerRef.current;
    if (!container || !left || !right) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = container.getBoundingClientRect();
    const onMove = (moveEvent: PointerEvent) => {
      const next = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      setRatio(Math.min(72, Math.max(28, next)));
    };
    const stop = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", stop, { once: true });
    window.addEventListener("pointercancel", stop, { once: true });
  }

  const single = left && !right ? left : right && !left ? right : null;
  if (!left && !right) {
    return (
      <AppShell activeKey="guides" headerTitle="Guías" isAdministrator={isAdministrator} mainClassName="guide-split-main">
        <section className="guide-split-empty">
          <h2>Lectura cerrada</h2>
          <Link href="/guias"><ArrowLeft size={17} /> Volver a guías</Link>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell activeKey="guides" headerTitle="Lectura relacionada" isAdministrator={isAdministrator} mainClassName="guide-split-main">
      <section className="guide-split-shell">
        <header className="guide-split-toolbar">
          <Link href={guideHref(primary)}><ArrowLeft size={17} /> Volver a la guía original</Link>
          {left && right ? (
            <>
              <button onClick={swap} type="button"><ArrowsLeftRight size={16} /> Intercambiar</button>
              <span className="guide-split-mobile-switch" role="group" aria-label="Artículo visible">
                <button aria-pressed={mobileActive === "left"} onClick={() => setMobileActive("left")} type="button">
                  {panelLabel(left)}
                </button>
                <button aria-pressed={mobileActive === "right"} onClick={() => setMobileActive("right")} type="button">
                  {panelLabel(right)}
                </button>
              </span>
            </>
          ) : null}
        </header>

        {single ? (
          <div className="guide-split-single">
            <div className="guide-split-panel-controls">
              <strong>{panelLabel(single)}</strong>
              <a
                href={guideHref(single.item, single.role === "related" ? compareAnchor : undefined)}
                rel="noopener noreferrer"
                target="_blank"
              ><ArrowSquareOut size={15} /> Nueva pestaña</a>
            </div>
            <GuidePanel panel={single} />
          </div>
        ) : null}

        {left && right ? (
          <div
            className="guide-split-grid"
            ref={containerRef}
            style={{ gridTemplateColumns: `minmax(0, ${ratio}fr) 12px minmax(0, ${100 - ratio}fr)` }}
          >
            <div className={`guide-split-panel${mobileActive === "left" ? " is-mobile-active" : ""}`}>
              <div className="guide-split-panel-controls">
                <strong>{panelLabel(left)}</strong>
                {left.role === "related" ? (
                  <button className="guide-split-keep" onClick={() => keepPanel("left")} type="button">Quedarme aquí</button>
                ) : null}
                <a
                  aria-label={`Abrir guía ${panelLabel(left).toLowerCase()} en otra pestaña`}
                  href={guideHref(left.item, left.role === "related" ? compareAnchor : undefined)}
                  rel="noopener noreferrer"
                  target="_blank"
                ><ArrowSquareOut size={15} /></a>
                <button aria-label={`Cerrar guía ${panelLabel(left).toLowerCase()}`} onClick={closeLeft} type="button"><X size={16} /></button>
              </div>
              <div className="guide-split-scroll" ref={leftScrollRef}><GuidePanel panel={left} /></div>
            </div>

            <button
              aria-label="Cambiar tamaño de los paneles"
              className="guide-split-resizer"
              onPointerDown={beginResize}
              type="button"
            ><span /></button>

            <div className={`guide-split-panel${mobileActive === "right" ? " is-mobile-active" : ""}`}>
              <div className="guide-split-panel-controls">
                <strong>{panelLabel(right)}</strong>
                {right.role === "related" ? (
                  <button className="guide-split-keep" onClick={() => keepPanel("right")} type="button">Quedarme aquí</button>
                ) : null}
                <a
                  aria-label={`Abrir guía ${panelLabel(right).toLowerCase()} en otra pestaña`}
                  href={guideHref(right.item, right.role === "related" ? compareAnchor : undefined)}
                  rel="noopener noreferrer"
                  target="_blank"
                ><ArrowSquareOut size={15} /></a>
                <button aria-label={`Cerrar guía ${panelLabel(right).toLowerCase()}`} onClick={closeRight} type="button"><X size={16} /></button>
              </div>
              <div className="guide-split-scroll" ref={rightScrollRef}><GuidePanel panel={right} /></div>
            </div>
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}
