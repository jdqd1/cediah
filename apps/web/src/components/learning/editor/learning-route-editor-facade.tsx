"use client";

import type { LearningEditorResource, LearningPathDetail } from "@cediah/contracts";
import { EditorShell } from "./editor-shell";
import { EditorQueryProvider } from "./editor-query-provider";
import { EditorFocusProvider } from "./editor-focus";
import type { EditorApi } from "./editor-api";
import { useRouteEditor } from "./use-route-editor";

export type LearningRouteEditorProps = {
  actorUserId: string;
  canPublish: boolean;
  canReview: boolean;
  initialPath?: LearningPathDetail;
  initialResources: LearningEditorResource[];
  resourceNextCursor: string | null;
  resourceTopics: string[];
  routeTopics: Array<{ id: string; title: string }>;
  transport?: EditorApi;
  replaceUrl?: (href: string) => void;
};

export function LearningRouteEditor(props: LearningRouteEditorProps) {
  const editor = useRouteEditor({
    actorUserId: props.actorUserId,
    initialPath: props.initialPath,
    replaceUrl: props.replaceUrl,
    routeTopics: props.routeTopics,
    transport: props.transport,
  });

  const pathSessionId = editor.state.savedPath?.id ?? `new:${editor.state.creationId}`;
  return (
    <EditorQueryProvider key={`${props.actorUserId}:${pathSessionId}`} transport={props.transport}>
      <EditorFocusProvider>
        <EditorShell {...props} editor={editor} />
      </EditorFocusProvider>
    </EditorQueryProvider>
  );
}
