"use client";

import Link from "next/link";
import {
  createContext,
  createPortal,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type TouchEvent,
} from "react";
import type {
  ContentItem,
  GuideKnowledgeIndex,
  GuideKnowledgeTarget,
  GuideKnowledgeTerm,
} from "@cediah/contracts";
import { ArrowRight, ArrowsOut, X } from "@phosphor-icons/react";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";

type GuideItem = Extract<ContentItem, { kind: "guide" }>;

type ActiveTerm = {
  focusPopup: boolean;
  left: number;
  placement: "above" | "below";
  sourceKey: string;
  term: GuideKnowledgeTerm;
  top: number;
  mode: "popover" | "sheet";
};

type GuideKnowledgeContextValue = {
  activeSourceKey: string | null;
  closeComparison: () => void;
  closeTerm: () => void;
  comparisonSourceAnchor: string | null;
  comparisonTarget: GuideKnowledgeTarget | null;
  hideTermSoon: () => void;
  knowledge: GuideKnowledgeIndex | null;
  openComparison: (target: GuideKnowledgeTarget) => void;
  primaryGuide: GuideItem | null;
  showTerm: (
    term: GuideKnowledgeTerm,
    sourceKey: string,
    anchor: HTMLElement,
    options?: { focusPopup?: boolean },
  ) => void;
  stopHidingTerm: () => void;
};

const GuideKnowledgeContext = createContext<GuideKnowledgeContextValue | null>(null);

function relatedHref(target: GuideKnowledgeTarget) {
  return `/guias/${target.slug}${target.anchor ? `#${target.anchor}` : ""}`;
}

function desktopPointer() {
  return typeof window !== "undefined" &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

function currentReadingAnchor() {
  const article = document.querySelector<HTMLElement>(".published-rich-guide-article");
  if (!article) return null;
  const candidates = Array.from(article.querySelectorAll<HTMLElement>("[id]"))
    .filter((element) => element.id && element.getBoundingClientRect().top <= window.innerHeight * 0.32);
  return candidates.at(-1)?.id ?? null;
}

export function GuideKnowledgeStateProvider({
  children,
  knowledge,
  primaryGuide,
}: {
  children: ReactNode;
  knowledge: GuideKnowledgeIndex | null;
  primaryGuide: GuideItem | null;
}) {
  const [activeTerm, setActiveTerm] = useState<ActiveTerm | null>(null);
  const [comparisonTarget, setComparisonTarget] = useState<GuideKnowledgeTarget | null>(null);
  const [comparisonSourceAnchor, setComparisonSourceAnchor] = useState<string | null>(null);
  const hideTimer = useRef<number | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);
  useBodyScrollLock(activeTerm?.mode === "sheet");

  const stopHidingTerm = useCallback(() => {
    if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    hideTimer.current = null;
  }, []);

  const closeTerm = useCallback(() => {
    stopHidingTerm();
    setActiveTerm(null);
  }, [stopHidingTerm]);

  const hideTermSoon = useCallback(() => {
    stopHidingTerm();
    hideTimer.current = window.setTimeout(() => {
      hideTimer.current = null;
      setActiveTerm(null);
    }, 140);
  }, [stopHidingTerm]);

  const showTerm = useCallback((
    term: GuideKnowledgeTerm,
    sourceKey: string,
    anchor: HTMLElement,
    options: { focusPopup?: boolean } = {},
  ) => {
    stopHidingTerm();
    const finePointer = desktopPointer();
    if (!finePointer) {
      setActiveTerm({
        focusPopup: options.focusPopup === true,
        left: 0,
        mode: "sheet",
        placement: "below",
        sourceKey,
        term,
        top: 0,
      });
      return;
    }

    const rect = anchor.getBoundingClientRect();
    const estimatedWidth = 360;
    const left = Math.min(
      Math.max(rect.left + rect.width / 2, estimatedWidth / 2 + 12),
      window.innerWidth - estimatedWidth / 2 - 12,
    );
    const estimatedHeight = 220;
    const placement = rect.bottom + estimatedHeight + 16 <= window.innerHeight ? "below" : "above";
    setActiveTerm({
      focusPopup: options.focusPopup === true,
      left,
      mode: "popover",
      placement,
      sourceKey,
      term,
      top: placement === "below" ? rect.bottom + 8 : rect.top - 8,
    });
  }, [stopHidingTerm]);

  const openComparison = useCallback((target: GuideKnowledgeTarget) => {
    setComparisonSourceAnchor(currentReadingAnchor());
    setActiveTerm(null);
    setComparisonTarget(target);
  }, []);

  const closeComparison = useCallback(() => setComparisonTarget(null), []);

  useEffect(() => {
    if (!activeTerm?.focusPopup) return;
    window.requestAnimationFrame(() => popupRef.current?.focus({ preventScroll: true }));
  }, [activeTerm]);

  useEffect(() => {
    if (!activeTerm) return;
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") closeTerm();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [activeTerm, closeTerm]);

  useEffect(() => () => stopHidingTerm(), [stopHidingTerm]);

  const value = useMemo<GuideKnowledgeContextValue>(() => ({
    activeSourceKey: activeTerm?.sourceKey ?? null,
    closeComparison,
    closeTerm,
    comparisonSourceAnchor,
    comparisonTarget,
    hideTermSoon,
    knowledge,
    openComparison,
    primaryGuide,
    showTerm,
    stopHidingTerm,
  }), [
    activeTerm?.sourceKey,
    closeComparison,
    closeTerm,
    comparisonSourceAnchor,
    comparisonTarget,
    hideTermSoon,
    knowledge,
    openComparison,
    primaryGuide,
    showTerm,
    stopHidingTerm,
  ]);

  const popup = activeTerm && typeof document !== "undefined"
    ? createPortal(
        activeTerm.mode === "sheet" ? (
          <div
            className="guide-term-sheet-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) closeTerm();
            }}
          >
            <section
              aria-label={`Definición de ${activeTerm.term.name}`}
              aria-modal="true"
              className="guide-term-sheet"
              ref={popupRef}
              role="dialog"
              tabIndex={-1}
              onTouchEnd={(event: TouchEvent<HTMLElement>) => {
                const start = touchStartY.current;
                touchStartY.current = null;
                if (start !== null && event.changedTouches[0] && event.changedTouches[0].clientY - start > 64) {
                  closeTerm();
                }
              }}
              onTouchStart={(event: TouchEvent<HTMLElement>) => {
                touchStartY.current = event.touches[0]?.clientY ?? null;
              }}
            >
              <span aria-hidden="true" className="guide-term-sheet-handle" />
              <TermDetails
                close={closeTerm}
                openComparison={openComparison}
                term={activeTerm.term}
              />
            </section>
          </div>
        ) : (
          <section
            aria-label={`Definición de ${activeTerm.term.name}`}
            className={`guide-term-popover is-${activeTerm.placement}`}
            ref={popupRef}
            role="dialog"
            style={{ left: activeTerm.left, top: activeTerm.top }}
            tabIndex={-1}
            onMouseEnter={stopHidingTerm}
            onMouseLeave={hideTermSoon}
          >
            <TermDetails
              close={closeTerm}
              openComparison={openComparison}
              term={activeTerm.term}
            />
          </section>
        ),
        document.body,
      )
    : null;

  return (
    <GuideKnowledgeContext.Provider value={value}>
      {children}
      {popup}
    </GuideKnowledgeContext.Provider>
  );
}

function TermDetails({
  close,
  openComparison,
  term,
}: {
  close: () => void;
  openComparison: (target: GuideKnowledgeTarget) => void;
  term: GuideKnowledgeTerm;
}) {
  const descriptionId = `guide-term-description-${term.id}`;
  return (
    <div className="guide-term-details">
      <header>
        <div>
          {term.category ? <small>{term.category}</small> : null}
          <strong>{term.name}</strong>
        </div>
        <button aria-label="Cerrar definición" className="guide-term-close" type="button" onClick={close}>
          <X aria-hidden="true" size={16} />
        </button>
      </header>
      <p id={descriptionId}>{term.shortDefinition}</p>
      {term.target ? (
        <footer>
          <Link href={relatedHref(term.target)} onClick={close}>
            Ver en profundidad <ArrowRight aria-hidden="true" size={15} />
          </Link>
          <button type="button" onClick={() => openComparison(term.target!)}>
            <ArrowsOut aria-hidden="true" size={15} /> Comparar
          </button>
        </footer>
      ) : null}
    </div>
  );
}

export function useGuideKnowledge() {
  return useContext(GuideKnowledgeContext);
}

export function InteractiveTerm({
  children,
  term,
}: {
  children: ReactNode;
  term: GuideKnowledgeTerm;
}) {
  const context = useGuideKnowledge();
  const sourceKey = useId();
  if (!context) return children;
  const active = context.activeSourceKey === sourceKey;

  function open(event: MouseEvent<HTMLButtonElement>, focusPopup = false) {
    context?.showTerm(term, sourceKey, event.currentTarget, { focusPopup });
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape") {
      context?.closeTerm();
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      context?.showTerm(term, sourceKey, event.currentTarget, { focusPopup: true });
    }
  }

  return (
    <button
      aria-expanded={active || undefined}
      aria-haspopup="dialog"
      className={`guide-interactive-term${active ? " is-active" : ""}`}
      type="button"
      onBlur={context.hideTermSoon}
      onClick={(event) => open(event, event.detail === 0)}
      onFocus={(event) => context.showTerm(term, sourceKey, event.currentTarget)}
      onKeyDown={onKeyDown}
      onMouseEnter={(event) => {
        if (desktopPointer()) context.showTerm(term, sourceKey, event.currentTarget);
      }}
      onMouseLeave={context.hideTermSoon}
    >
      {children}
    </button>
  );
}
