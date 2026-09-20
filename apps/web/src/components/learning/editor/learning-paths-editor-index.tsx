import type { LearningPathDetail, LearningPathStatus } from "@cediah/contracts";
import Link from "next/link";
import styles from "./route-editor.module.css";

const statusLabels: Record<LearningPathStatus, string> = {
  approved: "Aprobada",
  archived: "Archivada",
  changes_requested: "Cambios solicitados",
  draft: "Borrador",
  in_review: "En revisión",
  published: "Publicada",
};

export function LearningPathsEditorIndex({ paths }: { paths: LearningPathDetail[] }) {
  return (
    <main className={styles.editor} data-editor-surface>
      <header className={styles.header}>
        <div><span className={styles.backLink}>Panel editorial</span><h1>Rutas de aprendizaje</h1><p>Crea recorridos claros a partir de materiales ya publicados.</p></div>
        <Link className={styles.primaryButton} href="/panel/rutas/nueva">Crear ruta</Link>
      </header>
      {paths.length === 0 ? (
        <section className={styles.card}><div className={styles.emptyState}><strong>Aún no hay rutas</strong><p>Crea la primera para organizar objetivos, materiales y práctica.</p></div></section>
      ) : (
        <ul className={styles.routeList}>
          {paths.map((path) => (
            <li key={path.id}><Link href={`/panel/rutas/${path.id}`}><span><strong>{path.title}</strong><small>{path.topic.title} · {path.version.units.length} unidades</small></span><span>{statusLabels[path.version.status]}</span></Link></li>
          ))}
        </ul>
      )}
    </main>
  );
}
