"use client";

import { ArrowSquareOut, BookOpenText, X } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import type { GuideReference } from "@/lib/guide-citations";

export function GuideCitation({
  label,
  references,
}: {
  label: string;
  references: GuideReference[];
}) {
  const [open, setOpen] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const rootRef = useRef<HTMLSpanElement>(null);

  const clearCloseTimer = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleClose = () => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      closeTimerRef.current = null;
    }, 140);
  };

  useEffect(() => {
    if (!open) return;
    const closeOnPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  useEffect(() => () => clearCloseTimer(), []);

  return (
    <span
      className="guide-citation"
      ref={rootRef}
      onMouseEnter={() => {
        clearCloseTimer();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
    >
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`${label}. Ver ${references.length === 1 ? "fuente citada" : "fuentes citadas"}`}
        className="guide-citation-trigger"
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        onFocus={() => {
          clearCloseTimer();
          setOpen(true);
        }}
      >
        <BookOpenText aria-hidden="true" size={12} weight="bold" />
        <span>{label}</span>
      </button>

      {open ? (
        <span
          aria-label="Fuentes citadas"
          className="guide-citation-popover"
          role="dialog"
          onMouseEnter={clearCloseTimer}
          onMouseLeave={scheduleClose}
        >
          <span className="guide-citation-popover-header">
            <span>
              <BookOpenText aria-hidden="true" size={17} weight="duotone" />
              <span>
                <strong>Fuentes citadas</strong>
                <small>{references.length === 1 ? "1 referencia" : `${references.length} referencias`}</small>
              </span>
            </span>
            <button
              aria-label="Cerrar fuentes citadas"
              className="guide-citation-close"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setOpen(false);
              }}
            >
              <X aria-hidden="true" size={15} />
            </button>
          </span>

          <span className="guide-citation-reference-list">
            {references.map((reference) => (
              <span className="guide-citation-reference" key={reference.number}>
                <span className="guide-citation-reference-number">{reference.number}</span>
                <span className="guide-citation-reference-body">
                  <span>{reference.text}</span>
                  {reference.url ? (
                    <a
                      className="guide-citation-source-link"
                      href={reference.url}
                      rel="noopener noreferrer"
                      target="_blank"
                      onClick={(event) => event.stopPropagation()}
                    >
                      Abrir fuente <ArrowSquareOut aria-hidden="true" size={13} />
                    </a>
                  ) : null}
                </span>
              </span>
            ))}
          </span>
        </span>
      ) : null}
    </span>
  );
}
