"use client";

import { useId } from "react";
import Link from "next/link";
import type { LearningCoverKey } from "@cediah/contracts";
import type { EditorDraft } from "./editor-model";
import styles from "./route-editor.module.css";
import { issueFocusKeys } from "./editor-issues";
import { useEditorFocusRegistry } from "./editor-focus";

const coverOptions: Array<{ label: string; value: LearningCoverKey }> = [
  { label: "Pulmones", value: "lungs" },
  { label: "Corazón", value: "heart" },
  { label: "Cráneo", value: "skull" },
  { label: "Cuello", value: "neck-muscles" },
  { label: "Abdomen", value: "intestines" },
  { label: "Pelvis", value: "pelvis" },
  { label: "Muslo", value: "thigh" },
  { label: "Espalda", value: "back-muscles" },
];

export type RouteBasicsErrors = Partial<Record<"summary" | "title" | "topicContentId", string>>;

export function RouteBasics({
  disabled,
  draft,
  errors = {},
  onChange,
  topics,
}: {
  disabled: boolean;
  draft: EditorDraft;
  errors?: RouteBasicsErrors;
  onChange: (draft: EditorDraft) => void;
  topics: Array<{ id: string; title: string }>;
}) {
  const focusRegistry = useEditorFocusRegistry();
  const id = useId();
  const ids = {
    summary: `${id}-summary`,
    title: `${id}-title`,
    topic: `${id}-topic`,
  };
  return (
    <section aria-labelledby={`${id}-heading`} className={styles.card}>
      <div className={styles.sectionHeading}>
        <div><span>Paso 1 de 3</span><h2 id={`${id}-heading`}>Datos de la ruta</h2></div>
        <p>El enlace se crea automáticamente a partir del título.</p>
      </div>
      <fieldset className={styles.fieldset} disabled={disabled}>
        <div className={styles.fieldGrid}>
          <label className={styles.field} htmlFor={ids.title}>
            <span>Título de la ruta</span>
            <input
              aria-describedby={errors.title ? `${ids.title}-error` : undefined}
              aria-invalid={Boolean(errors.title)}
              id={ids.title}
              maxLength={200}
              minLength={1}
              onChange={(event) => onChange({ ...draft, title: event.target.value })}
              placeholder="Ej. Anatomía esencial del tórax"
              ref={(node) => focusRegistry.register(issueFocusKeys.routeField("title"), node)}
              required
              value={draft.title}
            />
            {errors.title ? <small className={styles.fieldError} id={`${ids.title}-error`}>{errors.title}</small> : null}
          </label>
          <label className={styles.field} htmlFor={ids.topic}>
            <span>Tema</span>
            <select
              aria-describedby={errors.topicContentId ? `${ids.topic}-error` : undefined}
              aria-invalid={Boolean(errors.topicContentId)}
              id={ids.topic}
              onChange={(event) => onChange({ ...draft, topicContentId: event.target.value })}
              required
              ref={(node) => focusRegistry.register(issueFocusKeys.topic, node)}
              value={draft.topicContentId}
            >
              <option value="">Selecciona un tema</option>
              {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}
            </select>
            {errors.topicContentId ? <small className={styles.fieldError} id={`${ids.topic}-error`}>{errors.topicContentId}</small> : null}
          </label>
          <label className={`${styles.field} ${styles.wideField}`} htmlFor={ids.summary}>
            <span>Descripción breve</span>
            <textarea
              aria-describedby={`${ids.summary}-help${errors.summary ? ` ${ids.summary}-error` : ""}`}
              aria-invalid={Boolean(errors.summary)}
              id={ids.summary}
              maxLength={2_000}
              minLength={1}
              onChange={(event) => onChange({ ...draft, summary: event.target.value })}
              placeholder="Explica brevemente qué aprenderán."
              ref={(node) => focusRegistry.register(issueFocusKeys.routeField("summary"), node)}
              required
              rows={4}
              value={draft.summary}
            />
            <small className={styles.fieldHint} id={`${ids.summary}-help`}>Explica qué se estudiará y para quién es útil.</small>
            {errors.summary ? <small className={styles.fieldError} id={`${ids.summary}-error`}>{errors.summary}</small> : null}
          </label>
        </div>

        <details className={styles.disclosure}>
          <summary>Personalizar portada</summary>
          <div className={styles.coverChoices}>
            {coverOptions.map((cover) => (
              <label key={cover.value}>
                <input
                  checked={draft.coverKey === cover.value}
                  name={`${id}-cover`}
                  onChange={() => onChange({ ...draft, coverKey: cover.value })}
                  type="radio"
                />
                <span>{cover.label}</span>
              </label>
            ))}
          </div>
          <p className={styles.fieldHint}>La portada es decorativa; no cambia el contenido ni el tema de la ruta.</p>
        </details>
      </fieldset>
      {topics.length === 0 ? (
        <p className={styles.emptyNote}>Todavía no hay temas publicados. <Link href="/panel/contenido" rel="noreferrer" target="_blank">Crear y publicar un tema en Contenido</Link>.</p>
      ) : null}
    </section>
  );
}
