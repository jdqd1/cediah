"use client";
import { useLayoutEffect } from "react";
import { X } from "@phosphor-icons/react";
import type { MapItem } from "@cediah/contracts";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { MedicalMapIcon } from "./medical-map-icon";
import styles from "./learning-map.module.css";

const colors = [
  { name: "Azul", value: "#29356f" },
  { name: "Celeste", value: "#2474a6" },
  { name: "Verde", value: "#2e8066" },
  { name: "Amarillo", value: "#ad761a" },
  { name: "Coral", value: "#c45e4b" },
  { name: "Violeta", value: "#7656a6" },
];

export function MapIconColorDialog({ item, color, onChoose, onClose }: {
  item: MapItem;
  color: string | null;
  onChoose: (color: string | null) => void;
  onClose: () => void;
}) {
  const ref = useDialogFocus();
  useBodyScrollLock(true);
  useLayoutEffect(() => {
    const launcher = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const background = document.querySelector<HTMLElement>("[data-map-background]");
    if (background) background.inert = true;
    return () => {
      if (background) background.inert = false;
      requestAnimationFrame(() => { if (launcher?.isConnected) launcher.focus({ preventScroll: true }); });
    };
  }, []);
  return (
    <div className={styles.overlay}>
      <section ref={ref} className={`${styles.dialog} ${styles.colorDialog}`} role="dialog" aria-modal="true" aria-label={`Color de ${item.title}`} tabIndex={-1} onKeyDown={(event) => { if (event.key === "Escape") onClose(); }}>
        <header><h2>Color del icono</h2><button className={styles.iconButton} aria-label="Cerrar diálogo" onClick={onClose}><X size={18} /></button></header>
        <p className={styles.colorPreview}><span style={{ color: color ?? colors[0]!.value }}><MedicalMapIcon iconKey={item.iconKey} /></span><strong>{item.title}</strong></p>
        <div className={styles.colorChoices} aria-label="Colores disponibles">
          {colors.map((choice) => <button key={choice.value} type="button" aria-label={choice.name} aria-pressed={color === choice.value} title={choice.name} style={{ backgroundColor: choice.value }} onClick={() => onChoose(choice.value)} />)}
        </div>
        <button className={styles.colorReset} onClick={() => onChoose(null)}>Restablecer color</button>
      </section>
    </div>
  );
}
