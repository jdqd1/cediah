import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LearningRouteEditor } from "@/components/learning/learning-route-editor";
import { getCurrentUser } from "@/lib/server/current-user";
import { getLearningEditorResources } from "@/lib/server/guided-learning-api";

export const dynamic = "force-dynamic";

export default async function NewLearningPathPage() {
  const current = await getCurrentUser();
  if (current.status === "anonymous") redirect("/acceder?next=/panel/rutas/nueva");
  if (current.status !== "authenticated") return <EditorUnavailable />;
  if (!current.features.guidedLearning) notFound();
  const resources = await getLearningEditorResources();
  if (resources.status !== "ready") return <EditorUnavailable forbidden={resources.status === "forbidden"} />;
  const canReview = current.roles.includes("coordinator") || current.roles.includes("administrator");

  return <LearningRouteEditor actorUserId={current.user.id} canPublish={canReview} canReview={canReview} initialResources={resources.items} resourceNextCursor={resources.nextCursor} resourceTopics={resources.resourceTopics} routeTopics={resources.topics} />;
}

function EditorUnavailable({ forbidden = false }: { forbidden?: boolean }) {
  return <main className="studio-gate"><section><h1>{forbidden ? "Esta cuenta no puede crear rutas" : "No pudimos abrir el editor"}</h1><p>La sesión sigue protegida. Intenta actualizar o vuelve al panel.</p><Link href="/panel/rutas">Volver a rutas</Link></section></main>;
}
