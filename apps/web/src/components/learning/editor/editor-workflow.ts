import type { LearningPathDetail, LearningPathStatus } from "@cediah/contracts";

export const editorStatusLabels: Record<LearningPathStatus, string> = {
  approved: "Aprobada",
  archived: "Archivada",
  changes_requested: "Cambios solicitados",
  draft: "Borrador",
  in_review: "En revisión",
  published: "Publicada",
};

export type EditorWorkflowAction = "approve" | "archive" | "changes-requested" | "create-version" | "publish" | "send-review";

export function editorWorkflowActions(
  detail: LearningPathDetail | null,
  capabilities: { canPublish: boolean; canReview: boolean },
): EditorWorkflowAction[] {
  if (detail?.archivedAt || detail?.version.status === "archived") return [];
  const status = detail?.version.status;
  const canArchive = Boolean(detail && capabilities.canPublish
    && (status === "published" || detail.version.number > 1));
  const withArchive = (actions: EditorWorkflowAction[]): EditorWorkflowAction[] => (
    canArchive ? [...actions, "archive"] : actions
  );
  if (!status || status === "draft" || status === "changes_requested") return withArchive(["send-review"]);
  if (status === "in_review") return withArchive(capabilities.canReview ? ["changes-requested", "approve"] : []);
  if (status === "approved") return withArchive(capabilities.canPublish ? ["publish"] : []);
  if (status === "published") return withArchive(["create-version"]);
  return [];
}
