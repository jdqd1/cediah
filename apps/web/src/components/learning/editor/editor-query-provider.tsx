"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { editorApi, type EditorApi } from "./editor-api";

export const editorQueryDefaults = {
  gcTime: 300_000,
  networkMode: "always" as const,
  refetchOnReconnect: false,
  refetchOnWindowFocus: false,
  retry: false,
  staleTime: 30_000,
};

const EditorTransportContext = createContext<EditorApi>(editorApi);

export function EditorQueryProvider({ children, transport = editorApi }: { children: ReactNode; transport?: EditorApi }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: { queries: editorQueryDefaults },
  }));
  return <EditorTransportContext.Provider value={transport}><QueryClientProvider client={client}>{children}</QueryClientProvider></EditorTransportContext.Provider>;
}

export function useEditorTransport() {
  return useContext(EditorTransportContext);
}
