"use client";
import { useLayoutEffect, type ReactNode } from "react";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import styles from "./learning-map.module.css";
export function MapMobileSheet({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useDialogFocus();
  useBodyScrollLock(true);
  useLayoutEffect(() => {
    const launcher =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const background = document.querySelector<HTMLElement>(
      "[data-map-background]",
    );
    if (background) background.inert = true;
    return () => {
      if (background) background.inert = false;
      requestAnimationFrame(() => {
        if (launcher?.isConnected) launcher.focus({ preventScroll: true });
      });
    };
  }, []);
  return (
    <>
      <div className={styles.panelBackdrop} onClick={onClose} />
      <section
        className={styles.modalPanel}
        role="dialog"
        aria-modal="true"
        aria-label="Detalle del mapa"
        tabIndex={-1}
        ref={ref}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
          }
        }}
      >
        {children}
      </section>
    </>
  );
}
