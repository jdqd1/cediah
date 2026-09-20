import type { LearningPathDetail, LearningPathStatus } from "@cediah/contracts";

export const editorStatusLabels: Record<LearningPathStatus, string> = {
  approved: "Aprobada",
  archived: "Archivada",
  changes_requested: "Cambios solicitados",
  draft: "Borrador",
  in_review: "En revisión",
  published: "Publicada",
};

export type EditorWorkflowAction = "approve" | "changes-requested" | "create-version" | "publish" | "send-review";

export function editorWorkflowActions(
  detail: LearningPathDetail | null,
  capabilities: { canPublish: boolean; canReview: boolean },
): EditorWorkflowAction[] {
  if (detail?.archivedAt || detail?.version.status === "archived") return [];
  const status = detail?.version.status;
  if (!status || status === "draft" || status === "changes_requested") return ["send-review"];
  if (status === "in_review") return capabilities.canReview ? ["changes-requested", "approve"] : [];
  if (status === "approved") return capabilities.canPublish ? ["publish"] : [];
  if (status === "published") return ["create-version"];
  return [];
}
