"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowSquareOut, ArrowsLeftRight, X } from "@phosphor-icons/react";
import {
  createPortal,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useGuideTermContext } from "./guide-term-context";

const mobileQuery = "(max-width: 760px)";

function termHref(slug: string, anchor: string | null) {
  return `/guias/${encodeURIComponent(slug)}${anchor ? `#${anchor}` : ""}`;
}

export function InteractiveTerm({
  children,
  termId,
}: {
  children: ReactNode;
  termId: string;
}) {
  const termContext = useGuideTermContext();
  const summary = termContext.term(termId);
  const id = useId();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({});

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const close = useCallback((restoreFocus = false) => {
    cancelClose();
    setOpen(false);
    if (restoreFocus) window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, [cancelClose]);

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      setOpen(false);
    }, 180);
  }, [cancelClose]);

  const updatePosition = useCallback(() => {
    if (!open || mobile) return;
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(360, window.innerWidth - 24);
    const measuredHeight = panel.offsetHeight || 180;
    const left = Math.min(
      Math.max(12, rect.left + rect.width / 2 - width / 2),
      Math.max(12, window.innerWidth - width - 12),
    );
    const placeAbove = rect.bottom + 10 + measuredHeight > window.innerHeight - 12;
    const top = placeAbove
      ? Math.max(12, rect.top - measuredHeight - 10)
      : Math.min(window.innerHeight - measuredHeight - 12, rect.bottom + 10);
    setPosition({ left, top, width });
  }, [mobile, open]);

  useEffect(() => {
    setMounted(true);
    const media = window.matchMedia(mobileQuery);
    const sync = () => setMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const onChange = () => updatePosition();
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      close(false);
    };
    window.addEventListener("resize", onChange);
    window.addEventListener("scroll", onChange, true);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("resize", onChange);
      window.removeEventListener("scroll", onChange, true);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [close, open, updatePosition]);

  useEffect(() => {
    if (open && mobile) window.requestAnimationFrame(() => closeRef.current?.focus());
  }, [mobile, open]);

  useEffect(() => () => cancelClose(), [cancelClose]);

  if (!summary) return <>{children}</>;

  const destination = summary.primaryLink;
  const destinationHref = destination
    ? termHref(destination.guideSlug, destination.sectionAnchor)
    : null;

  function openComparison() {
    if (!destination) return;
    const query = new URLSearchParams(searchParams.toString());
    query.set("compare", destination.guideSlug);
    if (destination.sectionAnchor) query.set("compareAnchor", destination.sectionAnchor);
    else query.delete("compareAnchor");
    close(false);
    router.push(`${pathname}?${query.toString()}`);
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close(false);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      cancelClose();
      setOpen((current) => !current);
    }
  }

  const panel = open && mounted ? (
    <div
      aria-label={`Información sobre ${summary.name}`}
      aria-modal={mobile || undefined}
      className={`interactive-term-panel${mobile ? " is-mobile" : ""}`}
      id={`interactive-term-${id}`}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          close(true);
        }
      }}
      onPointerEnter={cancelClose}
      onPointerLeave={mobile ? undefined : scheduleClose}
      ref={panelRef}
      role="dialog"
      style={mobile ? undefined : position}
    >
      <div className="interactive-term-panel-header">
        <div>
          {summary.category ? <span>{summary.category}</span> : null}
          <strong>{summary.name}</strong>
        </div>
        <button
          aria-label="Cerrar información del término"
          className="interactive-term-close"
          onClick={() => close(true)}
          ref={closeRef}
          type="button"
        >
          <X aria-hidden="true" size={16} />
        </button>
      </div>
      <p>{summary.shortDefinition}</p>
      {destination && destinationHref ? (
        <div className="interactive-term-actions">
          <Link href={destinationHref} onClick={() => close(false)} prefetch={false}>
            <span>Ver en profundidad</span>
            <ArrowSquareOut aria-hidden="true" size={15} />
          </Link>
          <button onClick={openComparison} type="button">
            <ArrowsLeftRight aria-hidden="true" size={15} />
            <span>{mobile ? "Abrir vista relacionada" : "Vista dividida"}</span>
          </button>
          <a
            aria-label={`Abrir ${destination.guideTitle} en una pestaña nueva`}
            href={destinationHref}
            rel="noopener noreferrer"
            target="_blank"
          >
            Nueva pestaña
          </a>
        </div>
      ) : null}
    </div>
  ) : null;

  return (
    <>
      <button
        aria-controls={open ? `interactive-term-${id}` : undefined}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="interactive-term-trigger"
        onBlur={(event) => {
          if (!open || mobile) return;
          const next = event.relatedTarget as Node | null;
          if (!panelRef.current?.contains(next)) scheduleClose();
        }}
        onClick={() => {
          cancelClose();
          setOpen((current) => !current);
        }}
        onFocus={() => {
          cancelClose();
          setOpen(true);
        }}
        onKeyDown={onTriggerKeyDown}
        onPointerEnter={() => {
          if (mobile) return;
          cancelClose();
          setOpen(true);
        }}
        onPointerLeave={mobile ? undefined : scheduleClose}
        ref={triggerRef}
        type="button"
      >
        {children}
      </button>
      {panel ? createPortal(
        <>
          {mobile ? <button aria-label="Cerrar" className="interactive-term-backdrop" onClick={() => close(true)} type="button" /> : null}
          {panel}
        </>,
        document.body,
      ) : null}
    </>
  );
}
