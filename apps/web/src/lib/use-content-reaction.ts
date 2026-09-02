"use client";

import { useEffect, useRef, useState } from "react";
import { ContentReactionResponseSchema, type ContentReaction } from "@cediah/contracts";

/** The server owns the choice; no cross-account browser storage or public totals. */
export function useContentReaction(contentId: string | null) {
  const [reaction, setReaction] = useState<ContentReaction | null>(null);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState("");
  const writing = useRef(false);

  useEffect(() => {
    if (!contentId) return;
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/content/${contentId}/reaction`, {
          cache: "no-store", credentials: "same-origin", signal: controller.signal,
        });
        if (!response.ok) throw new Error("unavailable");
        const result = ContentReactionResponseSchema.parse(await response.json());
        if (!controller.signal.aborted) setReaction(result.reaction);
      } catch {
        if (!controller.signal.aborted) setError("No se pudo cargar tu valoración. Puedes volver a intentarlo.");
      } finally {
        if (!controller.signal.aborted) setPending(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [contentId]);

  async function chooseReaction(choice: ContentReaction) {
    if (!contentId || pending || writing.current) return;
    writing.current = true;
    const previous = reaction;
    const next = previous === choice ? null : choice;
    setReaction(next);
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/content/${contentId}/reaction`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reaction: next }),
      });
      if (!response.ok) throw new Error("unavailable");
      const result = ContentReactionResponseSchema.parse(await response.json());
      setReaction(result.reaction);
    } catch {
      setReaction(previous);
      setError("No se pudo guardar tu valoración. Inténtalo de nuevo.");
    } finally {
      writing.current = false;
      setPending(false);
    }
  }

  return { reaction, pending, error, chooseReaction };
}
