import { notFound, redirect } from "next/navigation";
import { LearningRouteEditor } from "@/components/learning/learning-route-editor";
import { getCurrentUser } from "@/lib/server/current-user";
import { getLearningEditorPath, getLearningEditorResources } from "@/lib/server/guided-learning-api";

export const dynamic = "force-dynamic";

export default async function LearningPathEditorPage({ params }: { params: Promise<{ pathId: string }> }) {
  const current = await getCurrentUser();
  if (current.status === "anonymous") redirect("/acceder?next=/panel/rutas");
  if (current.status !== "authenticated") notFound();
  if (!current.features.guidedLearning) notFound();
  const { pathId } = await params;
  const [path, resources] = await Promise.all([
    getLearningEditorPath(pathId),
    getLearningEditorResources(),
  ]);
  if (path.status !== "ready" || resources.status !== "ready") notFound();
  const canReview = current.roles.includes("coordinator") || current.roles.includes("administrator");
  return <LearningRouteEditor actorUserId={current.user.id} canPublish={canReview} canReview={canReview} initialPath={path.path} initialResources={resources.items} key={path.path.id} resourceNextCursor={resources.nextCursor} resourceTopics={resources.resourceTopics} routeTopics={resources.topics} />;
}
