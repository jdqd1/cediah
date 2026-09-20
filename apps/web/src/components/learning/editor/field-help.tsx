"use client";

import type { ReactNode } from "react";
import { Question } from "@phosphor-icons/react";
import { Popover } from "radix-ui";
import styles from "./route-editor.module.css";

export type FieldHelpFamily = "objectives" | "alternatives" | "practice-mode";

export function FieldHelp({
  children,
  family,
  label,
  onOpenFamilyChange,
  openFamily,
}: {
  children: ReactNode;
  family: FieldHelpFamily;
  label: string;
  onOpenFamilyChange: (family: FieldHelpFamily | null) => void;
  openFamily: FieldHelpFamily | null;
}) {
  const open = openFamily === family;
  return (
    <Popover.Root open={open} onOpenChange={(nextOpen) => onOpenFamilyChange(nextOpen ? family : null)}>
      <Popover.Trigger asChild>
        <button aria-label={`Ayuda: ${label}`} className={styles.helpButton} type="button">
          <Question aria-hidden size={18} weight="bold" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" className={styles.helpContent} data-editor-surface sideOffset={8}>
          <p>{children}</p>
          <Popover.Close asChild>
            <button className={styles.helpClose} type="button">Cerrar ayuda</button>
          </Popover.Close>
          <Popover.Arrow className={styles.helpArrow} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
