"use client";

import type { ReactNode, RefObject } from "react";
import { useRef } from "react";
import { AlertDialog, Dialog } from "radix-ui";
import styles from "./route-editor.module.css";

export function EditorDialog({
  children,
  description,
  onOpenChange,
  open,
  returnFocusRef,
  title,
}: {
  children: ReactNode;
  description: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  returnFocusRef?: RefObject<HTMLElement | null>;
  title: string;
}) {
  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.dialogOverlay} />
        <Dialog.Content
          className={styles.dialog}
          data-editor-surface
          onCloseAutoFocus={(event) => {
            if (!returnFocusRef?.current) return;
            event.preventDefault();
            returnFocusRef.current.focus();
          }}
        >
          <Dialog.Title className={styles.dialogTitle}>{title}</Dialog.Title>
          <Dialog.Description className={styles.dialogDescription}>{description}</Dialog.Description>
          {children}
          <Dialog.Close asChild><button className={styles.secondaryButton} type="button">Cerrar</button></Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function EditorAlertDialog({
  cancelLabel = "Cancelar",
  children,
  confirmLabel,
  description,
  onConfirm,
  onOpenChange,
  open,
  returnFocusRef,
  title,
}: {
  cancelLabel?: string;
  children?: ReactNode;
  confirmLabel: string;
  description: string;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  returnFocusRef?: RefObject<HTMLElement | null>;
  title: string;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const lastReturnFocusRef = useRef<HTMLElement | null>(null);
  return (
    <AlertDialog.Root
      onOpenChange={(nextOpen) => {
        if (!nextOpen && returnFocusRef?.current) {
          lastReturnFocusRef.current = returnFocusRef.current;
        }
        onOpenChange(nextOpen);
      }}
      open={open}
    >
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={styles.dialogOverlay} />
        <AlertDialog.Content
          className={styles.dialog}
          data-editor-surface
          onCloseAutoFocus={(event) => {
            const returnTarget = returnFocusRef?.current ?? lastReturnFocusRef.current;
            if (!returnTarget) return;
            event.preventDefault();
            returnTarget.focus();
          }}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            cancelRef.current?.focus();
          }}
        >
          <AlertDialog.Title className={styles.dialogTitle}>{title}</AlertDialog.Title>
          <AlertDialog.Description className={styles.dialogDescription}>{description}</AlertDialog.Description>
          {children}
          <div className={styles.dialogActions}>
            <AlertDialog.Cancel asChild><button className={styles.secondaryButton} ref={cancelRef} type="button">{cancelLabel}</button></AlertDialog.Cancel>
            <AlertDialog.Action asChild><button className={styles.dangerButton} onClick={onConfirm} type="button">{confirmLabel}</button></AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
