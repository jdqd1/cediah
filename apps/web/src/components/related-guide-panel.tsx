"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowSquareOut, ArrowsLeftRight, X } from "@phosphor-icons/react";
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { RichTextDocument } from "@cediah/contracts";
import { sectionsToRichTextDocument } from "@/lib/guide-document";
import { normalizeMarkdownHighlights } from "@/lib/guide-markdown";
import { RichTextRenderer } from "./rich-text-renderer";
import styles from "./related-guide-panel.module.css";

type RelatedReaderPayload = {
  document: RichTextDocument | null;
  sections: Array<{ body: string; heading: string }>;
  slug: string;
  title: string;
};

export function RelatedGuidePanel({
  anchor,
  onClose,
  slug,
  title,
}: {
  anchor: string | null;
  onClose: () => void;
  slug: string;
  title: string;
}) {
  const [payload, setPayload] = useState<RelatedReaderPayload | null>(null);
  const [side, setSide] = useState<"left" | "right">("right");
  const [width, setWidth] = useState(50);
  const readerRef = useRef<HTMLDivElement>(null);
  const href = `/guias/${encodeURIComponent(slug)}${anchor ? `#${encodeURIComponent(anchor)}` : ""}`;

  useEffect(() => {
    let active = true;
    void fetch(`/api/guides/${encodeURIComponent(slug)}/related-reader`, {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    })
      .then(async (response) => response.ok ? await response.json() as RelatedReaderPayload : null)
      .then((result) => {
        if (active) setPayload(result);
      })
      .catch(() => {
        if (active) setPayload(null);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    const body = document.body;
    const previousPaddingLeft = body.style.paddingLeft;
    const previousPaddingRight = body.style.paddingRight;
    const previousTransition = body.style.transition;
    body.style.transition = "padding 160ms ease";
    if (window.matchMedia("(min-width: 768px)").matches) {
      if (side === "right") {
        body.style.paddingRight = `${width}vw`;
        body.style.paddingLeft = "0";
      } else {
        body.style.paddingLeft = `${width}vw`;
        body.style.paddingRight = "0";
      }
    }
    return () => {
      body.style.paddingLeft = previousPaddingLeft;
      body.style.paddingRight = previousPaddingRight;
      body.style.transition = previousTransition;
    };
  }, [side, width]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const guideDocument = useMemo(() => {
    if (!payload) return null;
    return normalizeMarkdownHighlights(
      payload.document ?? sectionsToRichTextDocument(payload.sections),
    );
  }, [payload]);

  useEffect(() => {
    if (!guideDocument || !anchor) return;
    const frame = window.requestAnimationFrame(() => {
      const target = Array.from(readerRef.current?.querySelectorAll<HTMLElement>("[id]") ?? [])
        .find((element) => element.id === anchor);
      target?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [anchor, guideDocument]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <aside
      aria-label={`Guía relacionada: ${title}`}
      className={`${styles.panel} ${side === "left" ? styles.left : styles.right}`}
      style={{ "--related-panel-width": `${width}vw` } as CSSProperties}
    >
      <header className={styles.toolbar}>
        <div className={styles.titleBlock}>
          <small>Lectura relacionada</small>
          <strong>{payload?.title ?? title}</strong>
        </div>
        <div className={styles.toolbarActions}>
          <button
            aria-label={side === "right" ? "Mover panel a la izquierda" : "Mover panel a la derecha"}
            onClick={() => setSide((current) => current === "right" ? "left" : "right")}
            title="Intercambiar lados"
            type="button"
          >
            {side === "right" ? <ArrowLeft size={17} /> : <ArrowRight size={17} />}
          </button>
          <Link href={href} title="Quedarme en esta guía">
            <ArrowsLeftRight size={17} />
          </Link>
          <a href={href} rel="noopener noreferrer" target="_blank" title="Abrir en otra pestaña">
            <ArrowSquareOut size={17} />
          </a>
          <button aria-label="Cerrar guía relacionada" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>
      </header>

      <label className={styles.resizeControl}>
        <span>Ancho del panel</span>
        <input
          aria-label="Ancho de la guía relacionada"
          max="70"
          min="30"
          onChange={(event) => setWidth(Number(event.target.value))}
          type="range"
          value={width}
        />
      </label>

      <div className={styles.reader} ref={readerRef}>
        {guideDocument ? (
          <RichTextRenderer
            className="published-rich-guide-article"
            document={guideDocument}
            interactiveTermsSlug={slug}
          />
        ) : (
          <p className={styles.loading}>Cargando contenido relacionado…</p>
        )}
      </div>
    </aside>,
    document.body,
  );
}
