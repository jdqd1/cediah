"use client";

import { createContext, useContext, useLayoutEffect, useRef, type ReactNode } from "react";

type FocusRegistry = {
  register: (key: string, node: HTMLElement | null) => void;
  requestFocus: (key: string) => void;
};

const FocusRegistryContext = createContext<FocusRegistry | null>(null);

export function EditorFocusProvider({ children }: { children: ReactNode }) {
  const nodes = useRef(new Map<string, HTMLElement>());
  const pending = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (!pending.current) return;
    const node = nodes.current.get(pending.current);
    if (!node) return;
    pending.current = null;
    node.focus();
    node.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  const value: FocusRegistry = {
    register(key, node) {
      if (node) nodes.current.set(key, node);
      else nodes.current.delete(key);
    },
    requestFocus(key) {
      pending.current = key;
      const node = nodes.current.get(key);
      if (!node) return;
      pending.current = null;
      node.focus();
      node.scrollIntoView({ behavior: "smooth", block: "center" });
    },
  };

  return <FocusRegistryContext.Provider value={value}>{children}</FocusRegistryContext.Provider>;
}

export function useEditorFocusRegistry() {
  const registry = useContext(FocusRegistryContext);
  if (!registry) throw new Error("Editor focus registry is missing");
  return registry;
}
