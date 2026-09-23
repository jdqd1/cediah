"use client";

import { useState, useSyncExternalStore } from "react";
import { AppShell } from "@/components/app-shell";
import { LearningRouteEditor } from "./learning-route-editor-facade";
import { LearningPathsEditorIndex } from "./learning-paths-editor-index";
import {
  createEditorFixtureRuntime,
  editorFixture,
  type EditorFixtureFailure,
  type EditorFixtureMode,
} from "./editor-fixtures";

export function EditorFixtureWorkspace({
  failure,
  mode,
  view = "editor",
}: {
  failure: EditorFixtureFailure;
  mode: EditorFixtureMode;
  view?: "editor" | "index";
}) {
  const [runtime] = useState(() => createEditorFixtureRuntime(mode, failure));
  const fixture = editorFixture(mode);
  const requestLog = useSyncExternalStore(
    runtime.subscribe,
    () => runtime.requests.join("|"),
    () => "",
  );
  if (view === "index") {
    return (
      <AppShell activeKey="learning" guidedLearningEnabled headerTitle="Editor de rutas">
        <LearningPathsEditorIndex canArchive={fixture.canPublish} paths={fixture.initialPath ? [fixture.initialPath] : []} />
      </AppShell>
    );
  }
  return (
    <AppShell activeKey="learning" guidedLearningEnabled headerTitle="Editor de rutas">
      <div data-fixture-mode={mode}>
        <LearningRouteEditor
          {...fixture}
          replaceUrl={() => {}}
          transport={runtime.transport}
        />
        <output data-testid="fixture-request-log" hidden>{requestLog}</output>
      </div>
    </AppShell>
  );
}
