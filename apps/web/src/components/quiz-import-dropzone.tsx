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
};

type ImportStatus =
  | { kind: "error"; message: string }
  | { kind: "success"; message: string }
  | null;

export function QuizImportDropzone({
  disabled = false,
  maxQuestions,
  onImport,
}: QuizImportDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);
  const [status, setStatus] = useState<ImportStatus>(null);

  const unavailable = disabled || reading || maxQuestions <= 0;

  async function importFile(file: File) {
    if (unavailable) return;
    setStatus(null);

    if (!isQuizImportFile(file)) {
      setStatus({ kind: "error", message: "Usa un archivo .json con el formato de cuestionario de CEDIAH." });
      return;
    }
    if (file.size > MAX_QUIZ_IMPORT_FILE_BYTES) {
      setStatus({ kind: "error", message: "El archivo es demasiado grande. El máximo permitido es 1 MB." });
      return;
    }

    setReading(true);
    try {
      const imported = parseQuizImportFile(await file.text());
      if (imported.length > maxQuestions) {
        setStatus({
          kind: "error",
          message: `El archivo contiene ${imported.length} preguntas, pero solo quedan ${maxQuestions} espacios disponibles.`,
        });
        return;
      }
      onImport(imported);
      setStatus({
        kind: "success",
        message: `${imported.length} ${imported.length === 1 ? "pregunta agregada" : "preguntas agregadas"} correctamente.`,
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
    <div>
      <div
        aria-disabled={unavailable}
        className={[
          styles.dropzone,
          dragging ? styles.dropzoneDragging : "",
          unavailable ? styles.dropzoneDisabled : "",
        ].filter(Boolean).join(" ")}
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
        <span className={styles.icon} aria-hidden="true"><UploadSimple size={17} /></span>
        <div className={styles.copy}>
          <strong>{reading ? "Leyendo cuestionario…" : "Importar preguntas"}</strong>
          <span>Arrastra aquí un JSON o selecciónalo. El archivo se procesa solo en tu navegador.</span>
        </div>
        <div className={styles.actions}>
          <button
            className={styles.selectButton}
            disabled={unavailable}
            type="button"
            onClick={() => inputRef.current?.click()}
          >
            Seleccionar archivo
          </button>
          <span className={styles.hint}>JSON · máximo 1 MB · {maxQuestions} espacios disponibles</span>
        </div>
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
