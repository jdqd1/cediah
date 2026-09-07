"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, type KeyboardEvent, useId, useRef, useState } from "react";
import { ArrowRight, CalendarBlank, DotsThree, X } from "@phosphor-icons/react";
import type { LearningHomeTask } from "@cediah/contracts";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";

function toLocalDateTimeInput(value: Date) {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function LearningTaskActions({ task }: { task: LearningHomeTask }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const [minimumDate, setMinimumDate] = useState("");
  const [message, setMessage] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const pendingKeys = useRef(new Map<string, string>());
  const titleId = useId();
  useBodyScrollLock(open);

  function close() {
    if (busy) return;
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab") return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    ));
    const first = controls[0];
    const last = controls.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function override(action: "dismiss" | "snooze", snoozedUntil?: string) {
    setBusy(true);
    setMessage("");
    const signature = `${task.key}:${action}:${snoozedUntil ?? ""}`;
    const idempotencyKey = pendingKeys.current.get(signature) ?? crypto.randomUUID();
    pendingKeys.current.set(signature, idempotencyKey);
    try {
      const response = await fetch("/api/guided-learning/tasks/override", {
        body: JSON.stringify({
          action,
          ...(action === "snooze" ? { snoozedUntil } : {}),
          taskKeys: task.taskKeys,
        }),
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        method: "PATCH",
      });
      if (!response.ok) {
        setMessage("No pudimos cambiar la recomendación. La cola original sigue visible.");
        return;
      }
      pendingKeys.current.delete(signature);
      setOpen(false);
      router.refresh();
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    } catch {
      setMessage("Sin conexión: la recomendación sigue visible y tu calendario no cambió.");
    } finally {
      setBusy(false);
    }
  }

  function submitCustomDate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customDate) return;
    void override("snooze", new Date(customDate).toISOString());
  }

  return (
    <div className="learning-task-actions">
      <Link className="learning-primary-button" href={task.href}>
        {task.kind === "review" ? "Repasar" : task.kind === "resume" ? "Retomar" : "Abrir"}
        <ArrowRight aria-hidden="true" size={17} />
      </Link>
      <button
        aria-haspopup="dialog"
        className="learning-task-options-button"
        ref={triggerRef}
        type="button"
        onClick={() => {
          setMessage("");
          setMinimumDate(toLocalDateTimeInput(new Date()));
          setOpen(true);
          window.requestAnimationFrame(() => closeRef.current?.focus());
        }}
      >
        <DotsThree aria-hidden="true" size={22} weight="bold" />
        <span className="sr-only">Opciones para {task.title}</span>
      </button>

      {open ? (
        <div className="learning-dialog-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) close();
        }}>
          <section
            aria-busy={busy}
            aria-labelledby={titleId}
            aria-modal="true"
            className="learning-dialog learning-task-dialog"
            role="dialog"
            onKeyDown={handleKeyDown}
          >
            <header>
              <span className="learning-dialog-icon"><CalendarBlank aria-hidden="true" size={22} /></span>
              <div><span>Organiza tu sesión</span><h2 id={titleId}>{task.title}</h2></div>
              <button aria-label="Cerrar" disabled={busy} ref={closeRef} type="button" onClick={close}>
                <X aria-hidden="true" size={20} />
              </button>
            </header>
            <p>Posponer solo cambia cuándo ves esta sugerencia; no altera la fecha del repaso ni tu progreso.</p>
            <div className="learning-task-quick-options">
              <button disabled={busy} type="button" onClick={() => void override("snooze", new Date(Date.now() + 2 * 60 * 60_000).toISOString())}>Más tarde hoy</button>
              <button disabled={busy} type="button" onClick={() => void override("snooze", new Date(Date.now() + 86_400_000).toISOString())}>Mañana</button>
              <button disabled={busy} type="button" onClick={() => void override("dismiss")}>Omitir sugerencia</button>
            </div>
            <form onSubmit={submitCustomDate}>
              <label><span>Elegir fecha y hora</span><input disabled={busy} min={minimumDate} required type="datetime-local" value={customDate} onChange={(event) => setCustomDate(event.target.value)} /></label>
              <button className="learning-secondary-button" disabled={busy || !customDate} type="submit">Guardar fecha</button>
            </form>
            <p aria-live="polite" className="learning-dialog-message">{busy ? "Guardando…" : message}</p>
          </section>
        </div>
      ) : null}
    </div>
  );
}
