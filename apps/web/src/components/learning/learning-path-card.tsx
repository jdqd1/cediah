import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock, Stack } from "@phosphor-icons/react/dist/ssr";
import type { LearningPathCard as LearningPathCardData } from "@cediah/contracts";

const coverImages = {
  "back-muscles": "/anatomy/back-muscles.png",
  heart: "/anatomy/heart.png",
  intestines: "/anatomy/intestines.png",
  lungs: "/anatomy/lungs.png",
  "neck-muscles": "/anatomy/neck-muscles.png",
  pelvis: "/anatomy/pelvis.png",
  skull: "/anatomy/skull.png",
  thigh: "/anatomy/thigh.png",
} as const;

export function LearningPathCard({ path, priority = false }: {
  path: LearningPathCardData;
  priority?: boolean;
}) {
  return (
    <article className="learning-path-card">
      <Link aria-label={`Abrir ruta ${path.title}`} className="learning-path-card-link" href={`/aprendizaje/rutas/${path.slug}`}>
        <div className="learning-path-card-cover">
          <Image
            alt=""
            fill
            priority={priority}
            sizes="(max-width: 767px) 100vw, (max-width: 1200px) 50vw, 360px"
            src={coverImages[path.coverKey]}
          />
          {path.enrollment ? (
            <span className="learning-path-state">
              {path.enrollment.status === "paused" ? "Pausada" : path.enrollment.status === "archived" ? "Archivada" : "En curso"}
            </span>
          ) : null}
        </div>
        <div className="learning-path-card-copy">
          <span className="learning-topic-label">{path.topic.title}</span>
          <h2>{path.title}</h2>
          <p>{path.summary}</p>
          <div className="learning-path-facts" aria-label="Resumen de la ruta">
            <span><Stack aria-hidden="true" size={18} />{path.unitCount} {path.unitCount === 1 ? "unidad" : "unidades"}</span>
            {path.estimatedMinutes > 0 ? <span><Clock aria-hidden="true" size={18} />{path.estimatedMinutes} min aprox.</span> : null}
          </div>
          <span className="learning-card-action">Ver ruta <ArrowRight aria-hidden="true" size={18} /></span>
        </div>
      </Link>
    </article>
  );
}
