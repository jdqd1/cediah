"use client";

import Link from "next/link";
import { ArrowSquareOut, BookOpen, X } from "@phosphor-icons/react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./interactive-term.module.css";

export type InteractiveTermSummary = {
  category: string | null;
  id: string;
  link: {
    anchor: string | null;
    contentId: string;
    slug: string;
    title: string;
  } | null;
  name: string;
  shortDefinition: string;
  slug: string;
};

function relatedHref(term: InteractiveTermSummary) {
  if (!term.link) return null;
  const anchor = term.link.anchor ? `#${encodeURIComponent(term.link.anchor)}` : "";
  return `/guias/${encodeURIComponent(term.link.slug)}${anchor}`;
}

export function InteractiveTerm({
  children,
  term,
}: {
  children: ReactNode;
  term: InteractiveTermSummary;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const descriptionId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const href = relatedHref(term);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMobileOpen(false);
      triggerRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  const detail = (
    <>
      <div className={styles.heading}>
        <div>
          <strong>{term.name}</strong>
          {term.category ? <span>{term.category}</span> : null}
        </div>
      </div>
      <p id={descriptionId}>{term.shortDefinition}</p>
      {href ? (
        <div className={styles.actions}>
          <Link href={href} className={styles.primaryAction}>
            <BookOpen aria-hidden="true" size={16} />
            Ver en profundidad
          </Link>
          <a
            aria-label={`Abrir ${term.link?.title ?? term.name} en otra pestaña`}
            className={styles.iconAction}
            href={href}
            rel="noopener noreferrer"
            target="_blank"
          >
            <ArrowSquareOut aria-hidden="true" size={17} />
          </a>
        </div>
      ) : null}
    </>
  );

  return (
    <span className={styles.root}>
      <button
        aria-describedby={descriptionId}
        aria-expanded={mobileOpen}
        className={styles.trigger}
        onClick={() => setMobileOpen(true)}
        ref={triggerRef}
        type="button"
      >
        {children}
      </button>
      <span className={styles.desktopPopover} role="tooltip">
        {detail}
      </span>
      {mobileOpen && typeof document !== "undefined"
        ? createPortal(
            <div className={styles.mobileLayer}>
              <button
                aria-label="Cerrar definición"
                className={styles.backdrop}
                onClick={() => {
                  setMobileOpen(false);
                  triggerRef.current?.focus({ preventScroll: true });
                }}
                type="button"
              />
              <section
                aria-describedby={descriptionId}
                aria-label={term.name}
                aria-modal="true"
                className={styles.sheet}
                role="dialog"
              >
                <div className={styles.sheetHandle} aria-hidden="true" />
                <button
                  aria-label="Cerrar"
                  className={styles.closeButton}
                  onClick={() => {
                    setMobileOpen(false);
                    triggerRef.current?.focus({ preventScroll: true });
                  }}
                  type="button"
                >
                  <X aria-hidden="true" size={18} />
                </button>
                {detail}
              </section>
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}
