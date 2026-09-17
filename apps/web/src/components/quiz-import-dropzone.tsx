"use client";

import { UploadSimple } from "@phosphor-icons/react";
import { useRef, useState, type DragEvent } from "react";
import {
  isQuizImportFile,
  MAX_QUIZ_IMPORT_FILE_BYTES,
  parseQuizImportFile,
  QuizImportError,
  type ImportedQuizQuestion,
} from "@/lib/quiz-import";
import styles from "./quiz-import-dropzone.module.css";

type QuizImportDropzoneProps = {
  disabled?: boolean;
  maxQuestions: number;
  onImport: (questions: ImportedQuizQuestion[]) => void;
  onRequestEdit?: () => void;
  requiresEdit?: boolean;
};

type ImportStatus =
  | { kind: "error"; message: string }
  | { kind: "success"; message: string }
  | null;

export function QuizImportDropzone({
  disabled = false,
  maxQuestions,
  onImport,
  onRequestEdit,
  requiresEdit = false,
}: QuizImportDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);
  const [status, setStatus] = useState<ImportStatus>(null);

  const unavailable = disabled || reading || maxQuestions <= 0 || requiresEdit;

  async function importFile(file: File) {
    if (unavailable) return;
    setStatus(null);

    if (!isQuizImportFile(file)) {
      setStatus({ kind: "error", message: "Usa un archivo .json con el formato de cuestionario de Koras." });
      return;
    }
    if (file.size > MAX_QUIZ_IMPORT_FILE_BYTES) {
      setStatus({ kind: "error", message: "El archivo supera el máximo de 1 MB." });
      return;
    }

    setReading(true);
    try {
      const imported = parseQuizImportFile(await file.text());
      if (imported.length > maxQuestions) {
        setStatus({
          kind: "error",
          message: `El archivo contiene ${imported.length} preguntas y solo quedan ${maxQuestions} espacios.`,
        });
        return;
      }
      onImport(imported);
      setStatus({
        kind: "success",
        message: `${imported.length} ${imported.length === 1 ? "pregunta agregada" : "preguntas agregadas"}.`,
      });
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof QuizImportError ? error.message : "No se pudo leer el archivo.",
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
        title={requiresEdit ? "Activa el modo de edición para gestionar el cuestionario" : "Arrastra un JSON aquí o selecciónalo"}
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
          {!requiresEdit && <span>{maxQuestions} libres</span>}
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
          aria-label="Seleccionar archivo JSON con preguntas"
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
