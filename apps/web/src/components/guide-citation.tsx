"use client";

import { ArrowSquareOut, BookOpenText, X } from "@phosphor-icons/react";
import { createPortal } from "react-dom";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { GuideReference } from "@/lib/guide-citations";

type CitationPopoverLayout =
  | { mode: "mobile" }
  | {
      mode: "desktop";
      top: number;
      left: number;
      maxHeight: number;
      arrowLeft: number;
      placement: "top" | "bottom";
    };

export function GuideCitation({
  label,
  references,
}: {
  label: string;
  references: GuideReference[];
}) {
  const [open, setOpen] = useState(false);
  const [popoverLayout, setPopoverLayout] = useState<CitationPopoverLayout | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const positionFrameRef = useRef<number | null>(null);
  const rootRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLSpanElement>(null);

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

  const positionPopover = useCallback(() => {
    const trigger = triggerRef.current;
    const popover = popoverRef.current;
    if (!trigger || !popover) return;

    const compactQuery = window.matchMedia("(max-width: 760px), (hover: none)");
    if (compactQuery.matches) {
      setPopoverLayout({ mode: "mobile" });
      return;
    }

    const viewport = window.visualViewport;
    const viewportLeft = viewport?.offsetLeft ?? 0;
    const viewportTop = viewport?.offsetTop ?? 0;
    const viewportWidth = viewport?.width ?? window.innerWidth;
    const viewportHeight = viewport?.height ?? window.innerHeight;
    const viewportRight = viewportLeft + viewportWidth;
    const viewportBottom = viewportTop + viewportHeight;
    const margin = 16;
    const gap = 11;

    const triggerRect = trigger.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    const popoverWidth = popoverRect.width;
    const fullHeight = popover.scrollHeight;
    const spaceAbove = triggerRect.top - viewportTop - margin - gap;
    const spaceBelow = viewportBottom - triggerRect.bottom - margin - gap;
    const preferredHeight = Math.min(fullHeight, 420);
    const placement: "top" | "bottom" =
      spaceAbove >= Math.min(preferredHeight, 260) || spaceAbove >= spaceBelow ? "top" : "bottom";
    const availableHeight = Math.max(0, placement === "top" ? spaceAbove : spaceBelow);
    const maxHeight = Math.min(420, availableHeight);
    const renderedHeight = Math.min(fullHeight, maxHeight);

    const triggerCenter = triggerRect.left + triggerRect.width / 2;
    const minimumLeft = viewportLeft + margin;
    const maximumLeft = Math.max(minimumLeft, viewportRight - margin - popoverWidth);
    const left = Math.min(Math.max(triggerCenter - popoverWidth / 2, minimumLeft), maximumLeft);

    const desiredTop =
      placement === "top" ? triggerRect.top - gap - renderedHeight : triggerRect.bottom + gap;
    const minimumTop = viewportTop + margin;
    const maximumTop = Math.max(minimumTop, viewportBottom - margin - renderedHeight);
    const top = Math.min(Math.max(desiredTop, minimumTop), maximumTop);

    const arrowInset = Math.min(24, Math.max(14, popoverWidth / 4));
    const arrowLeft = Math.min(
      Math.max(triggerCenter - left, arrowInset),
      Math.max(arrowInset, popoverWidth - arrowInset),
    );

    setPopoverLayout({
      mode: "desktop",
      top,
      left,
      maxHeight,
      arrowLeft,
      placement,
    });
  }, []);

  const schedulePositionUpdate = useCallback(() => {
    if (positionFrameRef.current !== null) window.cancelAnimationFrame(positionFrameRef.current);
    positionFrameRef.current = window.requestAnimationFrame(() => {
      positionPopover();
      positionFrameRef.current = null;
    });
  }, [positionPopover]);

  useEffect(() => {
    if (!open) return;
    const closeOnPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (rootRef.current?.contains(event.target) || popoverRef.current?.contains(event.target)) return;
      setOpen(false);
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

  useLayoutEffect(() => {
    if (!open) return;

    positionPopover();
    const compactQuery = window.matchMedia("(max-width: 760px), (hover: none)");
    const resizeObserver = new ResizeObserver(schedulePositionUpdate);
    if (triggerRef.current) resizeObserver.observe(triggerRef.current);
    if (popoverRef.current) resizeObserver.observe(popoverRef.current);

    window.addEventListener("resize", schedulePositionUpdate);
    window.addEventListener("scroll", schedulePositionUpdate, true);
    compactQuery.addEventListener("change", schedulePositionUpdate);
    window.visualViewport?.addEventListener("resize", schedulePositionUpdate);
    window.visualViewport?.addEventListener("scroll", schedulePositionUpdate);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", schedulePositionUpdate);
      window.removeEventListener("scroll", schedulePositionUpdate, true);
      compactQuery.removeEventListener("change", schedulePositionUpdate);
      window.visualViewport?.removeEventListener("resize", schedulePositionUpdate);
      window.visualViewport?.removeEventListener("scroll", schedulePositionUpdate);
      if (positionFrameRef.current !== null) {
        window.cancelAnimationFrame(positionFrameRef.current);
        positionFrameRef.current = null;
      }
    };
  }, [open, positionPopover, references, schedulePositionUpdate]);

  useEffect(() => () => clearCloseTimer(), []);

  const desktopPopoverStyle =
    popoverLayout?.mode === "desktop"
      ? ({
          top: `${popoverLayout.top}px`,
          left: `${popoverLayout.left}px`,
          maxHeight: `${popoverLayout.maxHeight}px`,
          "--guide-citation-arrow-left": `${popoverLayout.arrowLeft}px`,
        } as CSSProperties)
      : undefined;

  const popover = open ? (
    <span
      aria-label="Fuentes citadas"
      className="guide-citation-popover"
      data-placement={popoverLayout?.mode === "desktop" ? popoverLayout.placement : undefined}
      ref={popoverRef}
      role="dialog"
      style={desktopPopoverStyle}
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
  ) : null;

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
        ref={triggerRef}
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

      {popover && typeof document !== "undefined" ? createPortal(popover, document.body) : null}
    </span>
  );
}
