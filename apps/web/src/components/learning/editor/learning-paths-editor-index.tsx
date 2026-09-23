"use client";

import type { LearningPathDetail, LearningPathStatus } from "@cediah/contracts";
import { Archive, Trash } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type RefObject } from "react";
import { editorApi } from "./editor-api";
import { EditorAlertDialog } from "./editor-dialog";
import styles from "./route-editor.module.css";

const statusLabels: Record<LearningPathStatus, string> = {
  approved: "Aprobada",
  archived: "Archivada",
  changes_requested: "Cambios solicitados",
  draft: "Borrador",
  in_review: "En revisión",
  published: "Publicada",
};

type RouteActionTarget = {
  action: "archive" | "delete";
  path: LearningPathDetail;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
};

function hasPublishedHistory(path: LearningPathDetail) {
  return path.version.number > 1
    || path.version.status === "published"
    || path.version.status === "archived"
    || path.archivedAt !== null;
}

function visibleStatus(path: LearningPathDetail) {
  if (path.archivedAt) return "Archivada";
  if (path.version.status === "draft" && path.version.number > 1) return "Borrador de ruta publicada";
  return statusLabels[path.version.status];
}

function deleteFailureMessage(errorCode: string, status: number) {
  if (errorCode === "version_conflict") {
    return "La ruta cambió mientras intentabas borrarla. Actualiza la página y vuelve a intentarlo.";
  }
  if (status === 409) {
    return "Esta ruta ya fue publicada o está en uso y no se puede borrar. Puedes archivarla desde su editor.";
  }
  if (status === 403) return "No tienes permiso para borrar esta ruta.";
  if (status === 404) return "La ruta ya no existe o no está disponible para tu cuenta.";
  return "No pudimos borrar la ruta. Tu contenido sigue intacto; inténtalo de nuevo.";
}

function archiveFailureMessage(errorCode: string, status: number) {
  if (errorCode === "version_conflict") {
    return "La ruta cambió mientras intentabas archivarla. Actualiza la página y vuelve a intentarlo.";
  }
  if (status === 403) return "No tienes permiso para archivar esta ruta.";
  if (status === 404) return "La ruta ya no existe o no está disponible para tu cuenta.";
  if (status === 409) return "La ruta no se puede archivar en su estado actual.";
  return "No pudimos archivar la ruta. No se cambió ningún dato; inténtalo de nuevo.";
}

export function LearningPathsEditorIndex({ canArchive = false, paths: initialPaths }: { canArchive?: boolean; paths: LearningPathDetail[] }) {
  const router = useRouter();
  const [paths, setPaths] = useState(initialPaths);
  const [actionTarget, setActionTarget] = useState<RouteActionTarget | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const actionButtonRefs = useRef(new Map<string, HTMLButtonElement>());

  async function performSelectedAction() {
    if (!actionTarget || busyId) return;
    const { action, path: selected } = actionTarget;
    setBusyId(selected.id);
    setMessage("");
    if (action === "delete") {
      const result = await editorApi.deletePath(selected.id, selected.version.editVersion);
      if (result.ok) {
        setPaths((current) => current.filter((path) => path.id !== selected.id));
        setMessage(`Se eliminó la ruta «${selected.title}».`);
        router.refresh();
      } else {
        setMessage(deleteFailureMessage(result.errorCode, result.status));
      }
    } else {
      const result = await editorApi.transition(selected.id, selected.version.editVersion, "archived");
      if (result.ok) {
        setPaths((current) => current.map((path) => path.id === selected.id ? result.value : path));
        setMessage(`Se archivó la ruta «${selected.title}». El progreso existente se conserva.`);
        router.refresh();
      } else {
        setMessage(archiveFailureMessage(result.errorCode, result.status));
      }
    }
    setBusyId(null);
    setActionTarget(null);
  }

  return (
    <main className={styles.editor} data-editor-surface>
      <header className={styles.header}>
        <div><span className={styles.backLink}>Panel editorial</span><h1>Rutas de aprendizaje</h1><p>Crea recorridos claros a partir de materiales ya publicados.</p></div>
        <Link className={styles.primaryButton} href="/panel/rutas/nueva">Crear ruta</Link>
      </header>
      {message ? <p aria-live="polite" className={styles.routeListMessage}>{message}</p> : null}
      {paths.length === 0 ? (
        <section className={styles.card}><div className={styles.emptyState}><strong>Aún no hay rutas</strong><p>Crea la primera para organizar objetivos, materiales y práctica.</p></div></section>
      ) : (
        <ul className={styles.routeList}>
          {paths.map((path) => {
            const publishedHistory = hasPublishedHistory(path);
            const action = !publishedHistory ? "delete" : canArchive && !path.archivedAt ? "archive" : null;
            const actionLabel = action === "delete" ? "Eliminar" : "Archivar";
            const busyLabel = action === "delete" ? "Eliminando…" : "Archivando…";
            return (
              <li className={styles.routeListItem} key={path.id}>
                <Link className={styles.routeLink} href={`/panel/rutas/${path.id}`}>
                  <span><strong>{path.title}</strong><small>{path.topic.title} · {path.version.units.length} unidades</small></span>
                  <span>{visibleStatus(path)}</span>
                </Link>
                {action ? (
                  <button
                    aria-label={`${actionLabel} ruta ${path.title}`}
                    className={`${styles.dangerButton} ${styles.routeDeleteButton}`}
                    disabled={busyId !== null}
                    onClick={() => {
                      setMessage("");
                      setActionTarget({
                        action,
                        path,
                        returnFocusRef: {
                          get current() { return actionButtonRefs.current.get(path.id) ?? null; },
                        },
                      });
                    }}
                    ref={(node) => {
                      if (node) actionButtonRefs.current.set(path.id, node);
                      else actionButtonRefs.current.delete(path.id);
                    }}
                    type="button"
                  >
                    {action === "delete" ? <Trash aria-hidden size={18} /> : <Archive aria-hidden size={18} />}
                    {busyId === path.id ? busyLabel : actionLabel}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      <EditorAlertDialog
        confirmLabel={actionTarget?.action === "archive" ? "Archivar ruta" : "Eliminar ruta"}
        description={actionTarget?.action === "archive"
          ? `«${actionTarget.path.title}» dejará de estar disponible para nuevos estudiantes. La versión publicada y el progreso existente se conservarán.`
          : actionTarget
            ? `Se borrará «${actionTarget.path.title}» junto con su borrador. Los materiales publicados que utiliza no se eliminarán. Esta acción no se puede deshacer.`
            : "La ruta y su borrador se eliminarán de forma permanente."}
        onConfirm={() => { void performSelectedAction(); }}
        onOpenChange={(open) => { if (!open && !busyId) setActionTarget(null); }}
        open={Boolean(actionTarget)}
        returnFocusRef={actionTarget?.returnFocusRef}
        title={actionTarget?.action === "archive" ? "¿Archivar esta ruta?" : "¿Eliminar esta ruta?"}
      />
    </main>
  );
}
