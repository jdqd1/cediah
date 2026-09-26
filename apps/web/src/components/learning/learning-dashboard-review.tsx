import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight, Check, ClockCounterClockwise } from "@phosphor-icons/react/dist/ssr";
import type { LearningHome } from "@cediah/contracts";

export function LearningDashboardReview({
  available,
  enabled,
  home,
}: {
  available: boolean;
  enabled: boolean;
  home: LearningHome | null;
}) {
  if (!enabled) return null;

  const dueReviews = available && home ? home.counts.dueReviews : null;
  const reviewTask = home?.tasks.find((task) => task.kind === "review") ?? null;
  const reviewTone = dueReviews === null ? "calm" : dueReviews === 0
    ? "complete"
    : dueReviews <= 5 ? "calm" : dueReviews <= 12 ? "active" : dueReviews <= 20 ? "attention" : "urgent";
  const reviewAngle = dueReviews === null ? 0 : dueReviews === 0
    ? 360
    : Math.max(36, Math.min(dueReviews, 20) / 20 * 360);
  const reviewRingStyle = {
    "--dashboard-review-angle": `${reviewAngle}deg`,
  } as CSSProperties;

  return (
    <section aria-labelledby="dashboard-review-title" className="dashboard-review-section">
      <div className="section-heading-row">
        <h2 id="dashboard-review-title">Repaso pendiente</h2>
      </div>
      <article className="dashboard-review-card" data-tone={reviewTone}>
        <header className="dashboard-review-heading">
          <span className="dashboard-review-icon"><ClockCounterClockwise aria-hidden="true" size={24} /></span>
          <span className="dashboard-review-copy">
            <strong>{dueReviews === 0 ? "Repaso al día" : "Repasar flashcards"}</strong>
            <span>{dueReviews === null
              ? "Puedes iniciar un repaso aunque tu progreso no haya cargado."
              : dueReviews === 0
                ? "No tienes conceptos pendientes por ahora."
                : `${dueReviews} ${dueReviews === 1 ? "concepto pendiente" : "conceptos pendientes"}`}</span>
          </span>
          {dueReviews !== null && (
            <div
              aria-label={dueReviews === 0 ? "No hay repasos pendientes" : `${dueReviews} repasos pendientes`}
              className="dashboard-review-ring"
              role="img"
              style={reviewRingStyle}
            >
              <span aria-hidden="true">
                {dueReviews === 0 ? <Check size={24} weight="bold" /> : <><strong>{dueReviews}</strong><small>pendientes</small></>}
              </span>
            </div>
          )}
        </header>
        {dueReviews === 0 ? (
          <Link className="dashboard-review-clear-link" href="/aprendizaje">
            Ver mi aprendizaje <ArrowRight aria-hidden="true" size={18} />
          </Link>
        ) : (
          <Link className="dashboard-review-button" href={reviewTask?.href ?? "/aprendizaje/repaso"}>
            Iniciar repaso <ArrowRight aria-hidden="true" size={19} />
          </Link>
        )}
      </article>
    </section>
  );
}
