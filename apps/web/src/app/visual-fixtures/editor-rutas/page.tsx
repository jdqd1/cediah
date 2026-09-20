import { notFound } from "next/navigation";
import { EditorFixtureWorkspace } from "@/components/learning/editor/editor-fixture-workspace";
import {
  editorFixtureModes,
  isEditorFixtureEnabled,
  type EditorFixtureFailure,
  type EditorFixtureMode,
} from "@/components/learning/editor/editor-fixtures";

export const dynamic = "force-dynamic";

const supportedFailures = new Set<EditorFixtureFailure>(["none", "save-401", "save-409", "save-503", "slow", "transition-503", "validate-stale"]);

export default async function EditorRouteFixturePage({ searchParams }: {
  searchParams: Promise<{ estado?: string; fallo?: string; vista?: string }>;
}) {
  if (!isEditorFixtureEnabled(process.env.NODE_ENV)) notFound();
  const query = await searchParams;
  const mode = editorFixtureModes.includes(query.estado as EditorFixtureMode) ? query.estado as EditorFixtureMode : "ready";
  const failure = supportedFailures.has(query.fallo as EditorFixtureFailure) ? query.fallo as EditorFixtureFailure : "none";
  const view = query.vista === "indice" ? "index" : "editor";
  return <EditorFixtureWorkspace failure={failure} key={`${mode}:${failure}:${view}`} mode={mode} view={view} />;
}
