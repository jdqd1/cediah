"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import type {
  GuideTermManifest,
  GuideTermOccurrence,
  GuideTermSummary,
} from "@/lib/guide-terms";

type GuideTermContextValue = {
  occurrencesForPath(path: string): readonly GuideTermOccurrence[];
  sectionAnchorForPath(path: string): string | null;
  term(termId: string): GuideTermSummary | null;
};

const GuideTermContext = createContext<GuideTermContextValue | null>(null);
const sessionTerms = new Map<string, GuideTermSummary>();

function emptyContext(): GuideTermContextValue {
  return {
    occurrencesForPath: () => [],
    sectionAnchorForPath: () => null,
    term: (termId) => sessionTerms.get(termId) ?? null,
  };
}

const fallbackContext = emptyContext();

export function GuideTermProvider({
  children,
  manifest,
}: {
  children: ReactNode;
  manifest: GuideTermManifest | null;
}) {
  const value = useMemo<GuideTermContextValue>(() => {
    if (!manifest) return fallbackContext;
    const terms = new Map(manifest.terms.map((term) => [term.id, term]));
    for (const term of manifest.terms) sessionTerms.set(term.id, term);

    const occurrences = new Map<string, GuideTermOccurrence[]>();
    for (const occurrence of manifest.occurrences) {
      occurrences.set(occurrence.p, [
        ...(occurrences.get(occurrence.p) ?? []),
        occurrence,
      ]);
    }
    for (const list of occurrences.values()) {
      list.sort((left, right) => left.s - right.s || left.e - right.e);
    }

    const sections = new Map(manifest.sections.map((section) => [section.path, section.anchor]));
    return {
      occurrencesForPath: (path) => occurrences.get(path) ?? [],
      sectionAnchorForPath: (path) => sections.get(path) ?? null,
      term: (termId) => terms.get(termId) ?? sessionTerms.get(termId) ?? null,
    };
  }, [manifest]);

  return <GuideTermContext.Provider value={value}>{children}</GuideTermContext.Provider>;
}

export function useGuideTermContext() {
  return useContext(GuideTermContext) ?? fallbackContext;
}
