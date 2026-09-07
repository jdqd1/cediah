"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle, XCircle } from "@phosphor-icons/react";
import type { LearningAttempt, LearningAttemptResponseRecord } from "@cediah/contracts";
import type { ActivityMutation } from "./types";

export function QuizActivity({
  attempt,
  feedback,
  mutate,
  onFeedback,
}: {
  attempt: LearningAttempt & { manifest: Extract<LearningAttempt["manifest"], { projection: "quiz" }> };
  feedback: LearningAttemptResponseRecord | null;
  mutate: ActivityMutation;
  onFeedback: (feedback: LearningAttemptResponseRecord | null) => void;
}) {
  const question = attempt.manifest.questions[attempt.resume.currentIndex];
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);

  async function check() {
    if (!question || !selected) return;
    setBusy(true);
    const result = await mutate(`/api/guided-learning/attempts/${attempt.id}/responses`, "POST", {
      expectedVersion: attempt.rowVersion,
      itemId: question.itemId,
      kind: "quiz",
      optionId: selected,
      round: 1,
    });
    if (result?.feedback) onFeedback(result.feedback);
    setBusy(false);
  }

  if (feedback) {
    const correct = feedback.grading.correct === true;
    return (
      <section className={`learning-feedback ${correct ? "is-correct" : "is-incorrect"}`} role="status">
        {correct ? <CheckCircle aria-hidden="true" size={34} weight="fill" /> : <XCircle aria-hidden="true" size={34} weight="fill" />}
        <div>
          <h2>{correct ? "Respuesta correcta" : "Todavía no"}</h2>
          {feedback.grading.explanation ? <p>{feedback.grading.explanation}</p> : <p>La respuesta quedó guardada. Puedes reforzar este punto desde la ruta.</p>}
        </div>
        <button className="learning-primary-button" onClick={() => { setSelected(""); onFeedback(null); }} type="button">
          {attempt.status === "completed" ? "Ver resultado" : "Siguiente pregunta"}<ArrowRight aria-hidden="true" size={18} />
        </button>
      </section>
    );
  }
  if (!question) return null;
  return (
    <section className="learning-question-card" key={question.itemId}>
      <div className="learning-activity-counter">Pregunta {attempt.resume.currentIndex + 1} de {attempt.manifest.questions.length}</div>
      <h2>{question.prompt}</h2>
      <fieldset disabled={busy}>
        <legend className="sr-only">Elige una respuesta</legend>
        {question.options.map((option) => (
          <label className={selected === option.id ? "is-selected" : ""} key={option.id}>
            <input checked={selected === option.id} name={`question-${question.itemId}`} onChange={() => setSelected(option.id)} type="radio" />
            <span>{option.text}</span>
          </label>
        ))}
      </fieldset>
      <button className="learning-primary-button" disabled={!selected || busy} onClick={() => void check()} type="button">
        {busy ? "Guardando…" : "Comprobar"}
      </button>
    </section>
  );
}
