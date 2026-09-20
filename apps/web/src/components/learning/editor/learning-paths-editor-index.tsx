"use client";

import type { LearningPathDetail, LearningPathStatus } from "@cediah/contracts";
import { Trash } from "@phosphor-icons/react";
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

type DeleteTarget = {
  path: LearningPathDetail;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
};

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

export function LearningPathsEditorIndex({ paths: initialPaths }: { paths: LearningPathDetail[] }) {
  const router = useRouter();
  const [paths, setPaths] = useState(initialPaths);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const deleteButtonRefs = useRef(new Map<string, HTMLButtonElement>());

  async function deleteSelectedPath() {
    if (!deleteTarget || deletingId) return;
    const selected = deleteTarget.path;
    setDeletingId(selected.id);
    setMessage("");
    const result = await editorApi.deletePath(selected.id, selected.version.editVersion);
    if (result.ok) {
      setPaths((current) => current.filter((path) => path.id !== selected.id));
      setMessage(`Se eliminó la ruta «${selected.title}».`);
      router.refresh();
    } else {
      setMessage(deleteFailureMessage(result.errorCode, result.status));
    }
    setDeletingId(null);
    setDeleteTarget(null);
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
          {paths.map((path) => (
            <li className={styles.routeListItem} key={path.id}>
              <Link className={styles.routeLink} href={`/panel/rutas/${path.id}`}>
                <span><strong>{path.title}</strong><small>{path.topic.title} · {path.version.units.length} unidades</small></span>
                <span>{statusLabels[path.version.status]}</span>
              </Link>
              <button
                aria-label={`Eliminar ruta ${path.title}`}
                className={`${styles.dangerButton} ${styles.routeDeleteButton}`}
                disabled={deletingId !== null}
                onClick={() => {
                  setMessage("");
                  setDeleteTarget({
                    path,
                    returnFocusRef: {
                      get current() { return deleteButtonRefs.current.get(path.id) ?? null; },
                    },
                  });
                }}
                ref={(node) => {
                  if (node) deleteButtonRefs.current.set(path.id, node);
                  else deleteButtonRefs.current.delete(path.id);
                }}
                type="button"
              >
                <Trash aria-hidden size={18} />
                {deletingId === path.id ? "Eliminando…" : "Eliminar"}
              </button>
            </li>
          ))}
        </ul>
      )}
      <EditorAlertDialog
        confirmLabel="Eliminar ruta"
        description={deleteTarget
          ? `Se borrará «${deleteTarget.path.title}» junto con su borrador. Los materiales publicados que utiliza no se eliminarán. Esta acción no se puede deshacer.`
          : "La ruta y su borrador se eliminarán de forma permanente."}
        onConfirm={() => { void deleteSelectedPath(); }}
        onOpenChange={(open) => { if (!open && !deletingId) setDeleteTarget(null); }}
        open={Boolean(deleteTarget)}
        returnFocusRef={deleteTarget?.returnFocusRef}
        title="¿Eliminar esta ruta?"
      />
    </main>
  );
}
