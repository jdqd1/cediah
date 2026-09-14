"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/icons/ArrowRight";
import { Clock } from "@phosphor-icons/react/dist/icons/Clock";
import { Eye } from "@phosphor-icons/react/dist/icons/Eye";
import { X } from "@phosphor-icons/react/dist/icons/X";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { useDialogFocus } from "@/lib/use-dialog-focus";

type ActivityDetails = {
  estimatedMinutes: number | null;
  href: string;
  label: string;
  reason: string;
  title: string;
};

function ActivityDetailsDialog({
  details,
  labelId,
  onClose,
}: {
  details: ActivityDetails;
  labelId: string;
  onClose: () => void;
}) {
  const dialogRef = useDialogFocus();
  useBodyScrollLock(true);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div
      className="learning-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        aria-labelledby={labelId}
        aria-modal="true"
        className="learning-dialog dashboard-activity-dialog"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <header>
          <span className="learning-dialog-icon"><Eye aria-hidden="true" size={22} /></span>
          <div>
            <span>Detalles de la actividad</span>
            <h2 id={labelId}>{details.title}</h2>
          </div>
          <button aria-label="Cerrar detalles" onClick={onClose} type="button">
            <X aria-hidden="true" size={21} />
          </button>
        </header>

        <p>{details.reason}</p>

        <dl className="dashboard-activity-details-list">
          <div>
            <dt>Recomendación</dt>
            <dd>{details.label}</dd>
          </div>
          {details.estimatedMinutes ? (
            <div>
              <dt><Clock aria-hidden="true" size={16} /> Duración estimada</dt>
              <dd>{details.estimatedMinutes} min</dd>
            </div>
          ) : null}
        </dl>

        <Link className="learning-primary-button dashboard-activity-dialog-action" href={details.href}>
          Ir a la actividad <ArrowRight aria-hidden="true" size={18} />
        </Link>
      </section>
    </div>
  );
}

export function LearningDashboardActivityDetails({ details }: { details: ActivityDetails }) {
  const [open, setOpen] = useState(false);
  const dialogLabelId = useId();

  return (
    <>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Ver detalles de ${details.title}`}
        className="dashboard-learning-task-details-button"
        onClick={() => setOpen(true)}
        title="Ver detalles"
        type="button"
      >
        <Eye aria-hidden="true" size={19} />
      </button>
      {open ? (
        <ActivityDetailsDialog
          details={details}
          labelId={dialogLabelId}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
