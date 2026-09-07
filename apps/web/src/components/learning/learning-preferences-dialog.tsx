"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, type KeyboardEvent, useId, useMemo, useRef, useState } from "react";
import { GearSix, X } from "@phosphor-icons/react";
import {
  LearningPreferencesSchema,
  type LearningPreferences,
} from "@cediah/contracts";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";

type SelectablePath = { enrollmentId: string; title: string };

export function LearningPreferencesDialog({ paths, preferences }: {
  paths: SelectablePath[];
  preferences: LearningPreferences;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmedPreferences, setConfirmedPreferences] = useState(preferences);
  const [sessionMinutes, setSessionMinutes] = useState<5 | 10 | 20>(preferences.sessionMinutes);
  const [weeklyGoalDays, setWeeklyGoalDays] = useState<2 | 3 | 5 | null>(
    preferences.pendingConstancy?.weeklyGoalDays ?? preferences.weeklyGoalDays,
  );
  const [pinnedEnrollmentId, setPinnedEnrollmentId] = useState(preferences.pinnedEnrollmentId ?? "");
  const [timezone, setTimezone] = useState(
    preferences.pendingConstancy?.timezone ?? preferences.timezone,
  );
  const requestKeys = useRef(new Map<string, string>());
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const deviceTimezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", []);
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
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const currentGoal = confirmedPreferences.pendingConstancy?.weeklyGoalDays ?? confirmedPreferences.weeklyGoalDays;
    const currentTimezone = confirmedPreferences.pendingConstancy?.timezone ?? confirmedPreferences.timezone;
    const body: Record<string, unknown> = { expectedVersion: confirmedPreferences.rowVersion };
    if (sessionMinutes !== confirmedPreferences.sessionMinutes) body.sessionMinutes = sessionMinutes;
    if ((pinnedEnrollmentId || null) !== confirmedPreferences.pinnedEnrollmentId) {
      body.pinnedEnrollmentId = pinnedEnrollmentId || null;
    }
    if (weeklyGoalDays !== currentGoal) body.weeklyGoalDays = weeklyGoalDays;
    if (timezone !== currentTimezone) body.timezone = timezone;
    if (Object.keys(body).length === 1) {
      setMessage("No hay cambios pendientes.");
      return;
    }
    setBusy(true);
    setMessage("");
    const signature = JSON.stringify(body);
    const requestKey = requestKeys.current.get(signature) ?? crypto.randomUUID();
    requestKeys.current.set(signature, requestKey);
    try {
      const response = await fetch("/api/guided-learning/preferences", {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json", "Idempotency-Key": requestKey },
        method: "PATCH",
      });
      const payload: unknown = await response.json();
      const parsed = LearningPreferencesSchema.safeParse(payload);
      if (!response.ok || !parsed.success) {
        setMessage(response.status === 409
          ? "Las preferencias cambiaron en otro dispositivo. Cierra y actualiza para ver el estado confirmado."
          : "No pudimos guardar las preferencias. Tu configuración anterior sigue activa.");
        return;
      }
      requestKeys.current.delete(signature);
      setConfirmedPreferences(parsed.data);
      setSessionMinutes(parsed.data.sessionMinutes);
      setWeeklyGoalDays(parsed.data.pendingConstancy?.weeklyGoalDays ?? parsed.data.weeklyGoalDays);
      setPinnedEnrollmentId(parsed.data.pinnedEnrollmentId ?? "");
      setTimezone(parsed.data.pendingConstancy?.timezone ?? parsed.data.timezone);
      setMessage(parsed.data.pendingConstancy
        ? `Sesión actualizada. La meta o zona horaria cambiará el ${parsed.data.pendingConstancy.effectiveOn}.`
        : "Preferencias guardadas.");
      router.refresh();
    } catch {
      setMessage("Sin conexión: las preferencias no se marcaron como guardadas.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="learning-settings-button" ref={triggerRef} type="button" onClick={() => {
        setMessage("");
        setOpen(true);
        window.requestAnimationFrame(() => closeRef.current?.focus());
      }}>
        <GearSix aria-hidden="true" size={19} /> Ajustar aprendizaje
      </button>
      {open ? (
        <div className="learning-dialog-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) close();
        }}>
          <section aria-busy={busy} aria-labelledby={titleId} aria-modal="true" className="learning-dialog learning-preferences-dialog" role="dialog" onKeyDown={handleKeyDown}>
            <header>
              <span className="learning-dialog-icon"><GearSix aria-hidden="true" size={22} /></span>
              <div><span>Preferencias</span><h2 id={titleId}>Ajusta tu próxima sesión</h2></div>
              <button aria-label="Cerrar" disabled={busy} ref={closeRef} type="button" onClick={close}><X aria-hidden="true" size={20} /></button>
            </header>
            <form onSubmit={submit}>
              <fieldset disabled={busy}>
                <legend>Duración orientativa</legend>
                <div className="learning-segmented-control">
                  {([5, 10, 20] as const).map((minutes) => <label key={minutes}><input checked={sessionMinutes === minutes} name="session-minutes" type="radio" onChange={() => setSessionMinutes(minutes)} /><span>{minutes} min</span></label>)}
                </div>
              </fieldset>
              <fieldset disabled={busy}>
                <legend>Meta voluntaria de constancia</legend>
                <div className="learning-segmented-control has-four">
                  {([null, 2, 3, 5] as const).map((days) => <label key={days ?? "none"}><input checked={weeklyGoalDays === days} name="weekly-goal" type="radio" onChange={() => setWeeklyGoalDays(days)} /><span>{days ? `${days} días` : "Sin meta"}</span></label>)}
                </div>
                <small>No hay rachas perdidas ni penalizaciones por pausar.</small>
              </fieldset>
              {paths.length > 1 ? <label><span>Ruta destacada en Inicio</span><select disabled={busy} value={pinnedEnrollmentId} onChange={(event) => setPinnedEnrollmentId(event.target.value)}>{paths.map((path) => <option key={path.enrollmentId} value={path.enrollmentId}>{path.title}</option>)}</select></label> : null}
              <label>
                <span>Zona horaria para tu semana</span>
                <input disabled={busy} maxLength={80} required value={timezone} onChange={(event) => setTimezone(event.target.value)} />
                {deviceTimezone !== timezone ? <button className="learning-inline-action" disabled={busy} type="button" onClick={() => setTimezone(deviceTimezone)}>Usar {deviceTimezone}</button> : <small>Coincide con este dispositivo.</small>}
              </label>
              <footer><button disabled={busy} type="button" onClick={close}>Cerrar</button><button className="learning-primary-button" disabled={busy} type="submit">{busy ? "Guardando…" : "Guardar preferencias"}</button></footer>
              <p aria-live="polite" className="learning-dialog-message">{message}</p>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
