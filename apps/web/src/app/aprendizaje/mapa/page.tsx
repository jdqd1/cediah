import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/server/current-user";
import { LearningMapWorkspace } from "@/components/learning/map/learning-map-workspace";
import { AppShell } from "@/components/app-shell";
export const dynamic = "force-dynamic";
export default async function LearningMapPage() {
  const current = await getCurrentUser();
  if (
    current.status !== "authenticated" ||
    !current.features.guidedLearning ||
    !current.features.guidedLearningMap
  )
    notFound();
  return (
    <AppShell
      activeKey="learning"
      headerTitle="Aprendizaje guiado"
      guidedLearningEnabled
    >
      <Suspense fallback={<p>Preparando mapa…</p>}>
        <LearningMapWorkspace account={current.user.id} />
      </Suspense>
    </AppShell>
  );
}
