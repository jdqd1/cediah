"use client";

import { CheckCircle, Info, WarningCircle, X } from "@phosphor-icons/react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export type PlatformNotice = {
  text: string;
  tone: "error" | "success" | "warning";
};

export function PlatformToast({
  duration = 6500,
  notice,
  onDismiss,
}: {
  duration?: number;
  notice: PlatformNotice | null;
  onDismiss: () => void;
}) {
  const dismissRef = useRef(onDismiss);

  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => dismissRef.current(), duration);
    return () => window.clearTimeout(timer);
  }, [duration, notice]);

  if (!notice || typeof document === "undefined") return null;

  const Icon = notice.tone === "success"
    ? CheckCircle
    : notice.tone === "warning"
      ? Info
      : WarningCircle;

  return createPortal(
    <aside
      aria-atomic="true"
      aria-live={notice.tone === "error" ? "assertive" : "polite"}
      className={`platform-toast platform-toast-${notice.tone}`}
      role={notice.tone === "error" ? "alert" : "status"}
    >
      <span className="platform-toast-icon" aria-hidden="true">
        <Icon size={20} weight="fill" />
      </span>
      <p>{notice.text}</p>
      <button aria-label="Cerrar notificación" title="Cerrar" type="button" onClick={onDismiss}>
        <X aria-hidden="true" size={17} />
      </button>
    </aside>,
    document.body,
  );
}
