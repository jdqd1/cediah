"use client";

import { UploadSimple } from "@phosphor-icons/react";
import { useRef, useState, type DragEvent } from "react";
import {
  isKeyPointsImportFile,
  KeyPointsImportError,
  MAX_KEY_POINTS_IMPORT_FILE_BYTES,
  parseKeyPointsImportFile,
} from "@/lib/key-points-import";
import styles from "./quiz-import-dropzone.module.css";

type ImportResult =
  | { added: number }
  | { error: string };

type KeyPointsImportDropzoneProps = {
  disabled?: boolean;
  maxPoints: number;
  onImport: (points: string[]) => ImportResult;
  onRequestEdit?: () => void;
  requiresEdit?: boolean;
};

type ImportStatus =
  | { kind: "error"; message: string }
  | { kind: "success"; message: string }
  | null;

export function KeyPointsImportDropzone({
  disabled = false,
  maxPoints,
  onImport,
  onRequestEdit,
  requiresEdit = false,
}: KeyPointsImportDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);
  const [status, setStatus] = useState<ImportStatus>(null);

  const unavailable = disabled || reading || maxPoints <= 0 || requiresEdit;

  async function importFile(file: File) {
    if (unavailable) return;
    setStatus(null);

    if (!isKeyPointsImportFile(file)) {
      setStatus({ kind: "error", message: "Usa un archivo .json con el formato de puntos clave de Koras." });
      return;
    }
    if (file.size > MAX_KEY_POINTS_IMPORT_FILE_BYTES) {
      setStatus({ kind: "error", message: "El archivo supera el máximo de 1 MB." });
      return;
    }

    setReading(true);
    try {
      const imported = parseKeyPointsImportFile(await file.text());
      const result = onImport(imported);
      if ("error" in result) {
        setStatus({ kind: "error", message: result.error });
        return;
      }

      setStatus({
        kind: "success",
        message: result.added === 0
          ? "No había puntos nuevos para agregar."
          : `${result.added} ${result.added === 1 ? "punto agregado" : "puntos agregados"}.`,
      });
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof KeyPointsImportError ? error.message : "No se pudo leer el archivo.",
      });
    } finally {
      setReading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (unavailable) return;
    const [file] = Array.from(event.dataTransfer.files);
    if (file) void importFile(file);
  }

  return (
    <div className={styles.wrapper}>
      <div
        aria-disabled={unavailable}
        className={[
          styles.dropzone,
          dragging ? styles.dropzoneDragging : "",
          disabled ? styles.dropzoneDisabled : "",
        ].filter(Boolean).join(" ")}
        title={requiresEdit ? "Activa el modo de edición para gestionar los puntos clave" : "Arrastra un JSON aquí o selecciónalo"}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!unavailable) setDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = unavailable ? "none" : "copy";
        }}
        onDrop={handleDrop}
      >
        <span className={styles.icon} aria-hidden="true"><UploadSimple size={16} /></span>
        <div className={styles.copy}>
          <strong>{reading ? "Leyendo…" : "Importar JSON"}</strong>
          {!requiresEdit && <span>{maxPoints} libres</span>}
        </div>

        {requiresEdit ? (
          <button
            className={styles.selectButton}
            disabled={disabled}
            type="button"
            onClick={onRequestEdit}
          >
            Editar
          </button>
        ) : (
          <button
            className={styles.selectButton}
            disabled={unavailable}
            type="button"
            onClick={() => inputRef.current?.click()}
          >
            Seleccionar
          </button>
        )}

        <input
          ref={inputRef}
          accept=".json,application/json"
          aria-label="Seleccionar archivo JSON con puntos clave"
          disabled={unavailable}
          hidden
          type="file"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) void importFile(file);
          }}
        />
      </div>

      {status && (
        <div
          className={`${styles.status} ${status.kind === "success" ? styles.statusSuccess : styles.statusError}`}
          role={status.kind === "error" ? "alert" : "status"}
        >
          {status.message}
        </div>
      )}
    </div>
  );
}
