"use client";

import { X } from "@phosphor-icons/react";
import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";

export function StudioConfirmDialog({
  busy = false,
  confirmLabel,
  description,
  icon,
  onClose,
  onConfirm,
  open,
  title,
}: {
  busy?: boolean;
  confirmLabel: string;
  description: string;
  icon: ReactNode;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  open: boolean;
  title: string;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => cancelRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(frame);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open]);

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape" && !busy) {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'),
    );
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (!open) return null;

  return createPortal(
    <div
      className="studio-confirm-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        aria-busy={busy}
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="studio-confirm-dialog"
        role="dialog"
        onKeyDown={handleKeyDown}
      >
        <button aria-label="Cerrar" disabled={busy} type="button" onClick={onClose}>
          <X aria-hidden="true" size={18} />
        </button>
        <span className="studio-confirm-dialog-icon" aria-hidden="true">{icon}</span>
        <h3 id={titleId}>{title}</h3>
        <p id={descriptionId}>{description}</p>
        <footer>
          <button disabled={busy} ref={cancelRef} type="button" onClick={onClose}>Cancelar</button>
          <button className="is-danger" disabled={busy} type="button" onClick={() => void onConfirm()}>
            {busy ? "Archivando…" : confirmLabel}
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
