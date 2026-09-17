"use client";

import { CopySimple } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PlatformToast, type PlatformNotice } from "./platform-toast";

const actionHostSelector = ".guide-editor-heading-actions";
const contentSelector = ".guide-editor-prosemirror";

function normalizeCopiedText(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[\t ]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function fallbackCopy(text: string) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.setAttribute("aria-hidden", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    return document.execCommand("copy");
  } finally {
    textarea.remove();
  }
}

export function GuideEditorCopyAction() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [notice, setNotice] = useState<PlatformNotice | null>(null);

  useEffect(() => {
    const syncHost = () => {
      const nextHost = document.querySelector<HTMLElement>(actionHostSelector);
      setHost((current) => current === nextHost ? current : nextHost);
    };

    syncHost();
    const observer = new MutationObserver(syncHost);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  async function copyGuideContent() {
    const content = document.querySelector<HTMLElement>(contentSelector);
    const text = normalizeCopiedText(content?.innerText ?? "");

    if (!content || !text) {
      setNotice({
        text: "La guía no tiene contenido para copiar.",
        tone: "warning",
      });
      return;
    }

    try {
      if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([content.innerHTML], { type: "text/html" }),
            "text/plain": new Blob([text], { type: "text/plain" }),
          }),
        ]);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else if (!fallbackCopy(text)) {
        throw new Error("Clipboard unavailable");
      }

      setNotice({
        text: "Contenido de la guía copiado al portapapeles.",
        tone: "success",
      });
    } catch {
      try {
        if (!fallbackCopy(text)) throw new Error("Copy failed");
        setNotice({
          text: "Contenido de la guía copiado al portapapeles.",
          tone: "success",
        });
      } catch {
        setNotice({
          text: "No pudimos copiar el contenido de la guía.",
          tone: "error",
        });
      }
    }
  }

  return (
    <>
      {host && createPortal(
        <button
          aria-label="Copiar todo el contenido de la guía"
          title="Copiar contenido"
          type="button"
          onClick={() => void copyGuideContent()}
        >
          <CopySimple aria-hidden="true" size={17} />
          <span>Copiar contenido</span>
        </button>,
        host,
      )}
      <PlatformToast notice={notice} onDismiss={() => setNotice(null)} />
    </>
  );
}
