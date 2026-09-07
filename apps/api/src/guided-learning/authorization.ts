import type { CatalogVisibility } from "@cediah/contracts";

/** Central visibility decision used by every guided-learning resource path. */
export function canAccessLearningResource(input: {
  catalogVisibility: CatalogVisibility;
  hasPublishedPathReference: boolean;
  isEditorPreview?: boolean;
  isEnrolled?: boolean;
  retired: boolean;
}) {
  if (input.retired) return false;
  if (input.isEditorPreview) return true;
  if (!input.hasPublishedPathReference) return false;
  return input.catalogVisibility === "catalog" || input.isEnrolled === true;
}
