import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { LearningPathsEditorIndex } from "@/components/learning/editor/learning-paths-editor-index";
import styles from "@/components/learning/editor/route-editor.module.css";
import { getCurrentUser } from "@/lib/server/current-user";
import { getLearningEditorWorkspace } from "@/lib/server/guided-learning-api";

export const dynamic = "force-dynamic";

export default async function LearningPathsEditorPage() {
  const current = await getCurrentUser();
  if (current.status === "anonymous") redirect("/acceder?next=/panel/rutas");
  if (current.status !== "authenticated") return <EditorGate title="No pudimos confirmar tu sesión" />;
  if (!current.features.guidedLearning) notFound();
  const paths = await getLearningEditorWorkspace();
  if (paths.status !== "ready") {
    return <EditorGate title={paths.status === "forbidden" ? "Esta cuenta no tiene permisos editoriales" : "No pudimos abrir tus rutas"} />;
  }

  const canArchive = current.roles.includes("coordinator") || current.roles.includes("administrator");
  return <LearningPathsEditorIndex canArchive={canArchive} paths={paths.items} />;
}

function EditorGate({ title }: { title: string }) {
  return <main className={styles.editor}><section className={styles.card}><h1>{title}</h1><p>La sesión sigue protegida. Vuelve al panel o intenta actualizar más tarde.</p><Link href="/panel">Volver al panel</Link></section></main>;
}
