import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { MapFixtureWorkspace } from "@/components/learning/map/map-fixture-workspace";
export const dynamic = "force-dynamic";
export default async function MapFixturePage({ searchParams }: { searchParams:Promise<{estado?:string}> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const mode = (await searchParams).estado ?? "root";
  return <AppShell activeKey="learning" guidedLearningEnabled headerTitle="Aprendizaje guiado" viewer={{email:"mapa.visual@example.test"}}><Suspense fallback={<p>Cargando fixture…</p>}><MapFixtureWorkspace mode={mode}/></Suspense></AppShell>;
}
