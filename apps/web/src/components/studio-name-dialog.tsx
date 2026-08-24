"use client";

import type { FormEvent, KeyboardEvent, ReactNode } from "react";
import { useEffect, useId, useRef } from "react";
import { X } from "@phosphor-icons/react";
import { createPortal } from "react-dom";

export function StudioNameDialog({
  busy = false,
  children,
  description,
  icon,
  inputLabel,
  maxLength,
  onChange,
  onClose,
  onSubmit,
  open,
  placeholder,
  submitLabel,
  title,
  value,
}: {
  busy?: boolean;
  children?: ReactNode;
  description?: string;
  icon: ReactNode;
  inputLabel: string;
  maxLength: number;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
  open: boolean;
  placeholder: string;
  submitLabel: string;
  title: string;
  value: string;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());

    return () => {
      window.cancelAnimationFrame(frame);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open]);

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape" && !busy) {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ),
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

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!value.trim() || busy) return;
    void onSubmit();
  }

  if (!open) return null;

  return createPortal(
    <div
      className="studio-name-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        aria-busy={busy}
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className="studio-name-dialog"
        ref={dialogRef}
        role="dialog"
        onKeyDown={handleKeyDown}
      >
        <header>
          <span aria-hidden="true" className="studio-name-dialog-icon">{icon}</span>
          <div>
            <h3 id={titleId}>{title}</h3>
            {description && <p id={descriptionId}>{description}</p>}
          </div>
          <button
            aria-label="Cerrar"
            className="studio-name-dialog-close"
            disabled={busy}
            type="button"
            onClick={onClose}
          >
            <X aria-hidden="true" size={18} />
          </button>
        </header>

        <form onSubmit={submit}>
          <label>
            <span>{inputLabel}</span>
            <input
              autoComplete="off"
              maxLength={maxLength}
              placeholder={placeholder}
              ref={inputRef}
              type="text"
              value={value}
              onChange={(event) => onChange(event.target.value)}
            />
          </label>
          {children}
          <footer>
            <button disabled={busy} type="button" onClick={onClose}>Cancelar</button>
            <button className="is-primary" disabled={!value.trim() || busy} type="submit">
              {busy ? "Guardando…" : submitLabel}
            </button>
          </footer>
        </form>
      </section>
    </div>,
    document.body,
  );
}
