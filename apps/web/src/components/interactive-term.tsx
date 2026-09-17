"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowSquareOut, ArrowsLeftRight, X } from "@phosphor-icons/react";
import {
  createPortal,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { useGuideTermContext } from "./guide-term-context";

const mobileQuery = "(max-width: 760px)";

function subscribeMobileQuery(onStoreChange: () => void) {
  const media = window.matchMedia(mobileQuery);
  media.addEventListener("change", onStoreChange);
  return () => media.removeEventListener("change", onStoreChange);
}

function getMobileSnapshot() {
  return window.matchMedia(mobileQuery).matches;
}

function getMobileServerSnapshot() {
  return false;
}

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
  const [open, setOpen] = useState(false);
  const mobile = useSyncExternalStore(
    subscribeMobileQuery,
    getMobileSnapshot,
    getMobileServerSnapshot,
  );
  useBodyScrollLock(open && mobile);

  function cancelClose() {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function close(restoreFocus = false) {
    cancelClose();
    setOpen(false);
    if (restoreFocus) window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function scheduleClose() {
    cancelClose();
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      setOpen(false);
    }, 180);
  }

  useLayoutEffect(() => {
    if (!open || mobile) return;
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;

    function updatePosition() {
      const triggerRect = trigger!.getBoundingClientRect();
      const width = Math.min(360, window.innerWidth - 24);
      const measuredHeight = panel!.offsetHeight || 180;
      const left = Math.min(
        Math.max(12, triggerRect.left + triggerRect.width / 2 - width / 2),
        Math.max(12, window.innerWidth - width - 12),
      );
      const placeAbove = triggerRect.bottom + 10 + measuredHeight > window.innerHeight - 12;
      const top = placeAbove
        ? Math.max(12, triggerRect.top - measuredHeight - 10)
        : Math.min(window.innerHeight - measuredHeight - 12, triggerRect.bottom + 10);
      panel!.style.left = `${left}px`;
      panel!.style.top = `${top}px`;
      panel!.style.width = `${width}px`;
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [mobile, open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open || !mobile) return;
    const frame = window.requestAnimationFrame(() => closeRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [mobile, open]);

  useEffect(() => () => cancelClose(), []);

  if (!summary) return <>{children}</>;

  const destination = summary.primaryLink;
  const destinationHref = destination
    ? termHref(destination.guideSlug, destination.sectionAnchor)
    : null;
  const panelId = `interactive-term-${id}`;
  const titleId = `interactive-term-title-${id}`;
  const descriptionId = `interactive-term-description-${id}`;

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
      if (open) {
        close(false);
        return;
      }
      setOpen(true);
      window.requestAnimationFrame(() => closeRef.current?.focus());
    }
  }

  function onPanelKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
      return;
    }
    if (!mobile || event.key !== "Tab") return;
    const panel = panelRef.current;
    if (!panel) return;
    const controls = Array.from(panel.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], [tabindex="0"]',
    )).filter((element) => element.getClientRects().length > 0);
    const first = controls[0];
    const last = controls.at(-1);
    if (!first || !last) {
      event.preventDefault();
      panel.focus();
      return;
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const panel = open ? (
    <div
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      aria-modal={mobile || undefined}
      className={`interactive-term-panel${mobile ? " is-mobile" : ""}`}
      id={panelId}
      onKeyDown={onPanelKeyDown}
      onPointerEnter={cancelClose}
      onPointerLeave={mobile ? undefined : scheduleClose}
      ref={panelRef}
      role="dialog"
      tabIndex={-1}
    >
      <div className="interactive-term-panel-header">
        <div>
          {summary.category ? <span>{summary.category}</span> : null}
          <strong id={titleId}>{summary.name}</strong>
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
      <p id={descriptionId}>{summary.shortDefinition}</p>
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
        aria-controls={open ? panelId : undefined}
        aria-describedby={open ? descriptionId : undefined}
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
          {mobile ? (
            <button
              aria-label="Cerrar información del término"
              className="interactive-term-backdrop"
              onClick={() => close(true)}
              tabIndex={-1}
              type="button"
            />
          ) : null}
          {panel}
        </>,
        document.body,
      ) : null}
    </>
  );
}
