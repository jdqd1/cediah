"use client";

import { useState } from "react";
import type { LearningAttempt } from "@cediah/contracts";
import type { ActivityMutation } from "./types";

const grades = [
  ["again", "No la recordé"],
  ["hard", "Me costó"],
  ["good", "La recordé"],
  ["easy", "Fue fácil"],
] as const;

export function FlashcardActivity({ attempt, mutate }: {
  attempt: LearningAttempt & { manifest: Extract<LearningAttempt["manifest"], { projection: "flashcards" }> };
  mutate: ActivityMutation;
}) {
  const card = attempt.manifest.cards[attempt.resume.currentIndex];
  const revealed = card ? attempt.revealedCards.find((entry) => entry.itemId === card.itemId) : undefined;
  const [busy, setBusy] = useState(false);
  if (!card) return null;

  async function reveal() {
    setBusy(true);
    await mutate(`/api/guided-learning/attempts/${attempt.id}/items/${card!.itemId}/reveal`, "POST", {
      expectedVersion: attempt.rowVersion,
    });
    setBusy(false);
  }
  async function rate(recallGrade: typeof grades[number][0]) {
    setBusy(true);
    await mutate(`/api/guided-learning/attempts/${attempt.id}/responses`, "POST", {
      expectedVersion: attempt.rowVersion,
      itemId: card!.itemId,
      kind: "flashcards",
      recallGrade,
      round: 1,
    });
    setBusy(false);
  }

  return (
    <section className="learning-flashcard" key={card.itemId}>
      <div className="learning-activity-counter">Tarjeta {attempt.resume.currentIndex + 1} de {attempt.manifest.cards.length}</div>
      <article>
        <span>Intenta recordarlo antes de revelar</span>
        <h2>{card.front}</h2>
        {revealed ? <div className="learning-flashcard-back"><span>Respuesta</span><p>{revealed.back}</p></div> : null}
      </article>
      {!revealed ? (
        <button className="learning-primary-button" disabled={busy} onClick={() => void reveal()} type="button">
          {busy ? "Guardando…" : "Mostrar respuesta"}
        </button>
      ) : (
        <fieldset className="learning-recall-grades" disabled={busy}>
          <legend>¿Cómo te fue?</legend>
          {grades.map(([value, label]) => <button key={value} onClick={() => void rate(value)} type="button">{label}</button>)}
        </fieldset>
      )}
    </section>
  );
}
