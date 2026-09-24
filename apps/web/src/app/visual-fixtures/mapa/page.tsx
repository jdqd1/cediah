import { Suspense } from "react";
import { notFound } from "next/navigation";
import { MapFixtureWorkspace } from "@/components/learning/map/map-fixture-workspace";
export const dynamic = "force-dynamic";
export default async function MapFixturePage({ searchParams }: { searchParams:Promise<{estado?:string}> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const mode = (await searchParams).estado ?? "root";
  return <Suspense fallback={<p>Cargando fixture…</p>}><MapFixtureWorkspace mode={mode}/></Suspense>;
}
