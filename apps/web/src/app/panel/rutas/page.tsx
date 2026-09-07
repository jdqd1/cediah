import Link from "next/link";
import { notFound } from "next/navigation";
import { LearningRouteEditor } from "@/components/learning/learning-route-editor";
import { getCurrentUser } from "@/lib/server/current-user";
import { getLearningEditorResources, getLearningEditorWorkspace } from "@/lib/server/guided-learning-api";

export const dynamic = "force-dynamic";

export default async function LearningPathsEditorPage() {
  const current = await getCurrentUser();
  if (current.status === "authenticated" && !current.features.guidedLearning) notFound();
  const [paths, resources] = await Promise.all([getLearningEditorWorkspace(), getLearningEditorResources()]);
  if (paths.status !== "ready" || resources.status !== "ready") {
    return <main className="studio-gate"><section><p className="eyebrow dark">Editor de rutas</p><h1>No pudimos abrir el espacio editorial.</h1><p>{paths.status === "forbidden" || resources.status === "forbidden" ? "Esta cuenta no tiene permisos editoriales." : "La sesión está protegida; intenta actualizar en unos minutos."}</p><Link href="/panel">Volver al panel</Link></section></main>;
  }
  const roles = current.status === "authenticated" ? current.roles : [];
  return <LearningRouteEditor canPublish={roles.includes("coordinator") || roles.includes("administrator")} canReview={roles.includes("coordinator") || roles.includes("administrator")} initialResources={resources.items} paths={paths.items} resourceNextCursor={resources.nextCursor} resourceTopics={resources.resourceTopics} routeTopics={resources.topics} />;
}
