import { notFound } from "next/navigation";
import { LearningRouteEditor } from "@/components/learning/learning-route-editor";
import { getCurrentUser } from "@/lib/server/current-user";
import { getLearningEditorPath, getLearningEditorResources, getLearningEditorWorkspace } from "@/lib/server/guided-learning-api";

export const dynamic = "force-dynamic";

export default async function LearningPathEditorPage({ params }: { params: Promise<{ pathId: string }> }) {
  const current = await getCurrentUser();
  if (current.status === "authenticated" && !current.features.guidedLearning) notFound();
  const { pathId } = await params;
  const [path, paths, resources] = await Promise.all([
    getLearningEditorPath(pathId),
    getLearningEditorWorkspace(),
    getLearningEditorResources(),
  ]);
  if (path.status !== "ready" || paths.status !== "ready" || resources.status !== "ready") notFound();
  const roles = current.status === "authenticated" ? current.roles : [];
  return <LearningRouteEditor canPublish={roles.includes("coordinator") || roles.includes("administrator")} canReview={roles.includes("coordinator") || roles.includes("administrator")} initialPath={path.path} initialResources={resources.items} paths={paths.items} resourceNextCursor={resources.nextCursor} resourceTopics={resources.resourceTopics} routeTopics={resources.topics} />;
}
