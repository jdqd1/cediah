import type { ContentDraft } from "@cediah/contracts";

export function isPublishedPermittedDraftUpdate(
  current: ContentDraft,
  baseline: ContentDraft,
) {
  const currentLinkedVideoId = current.kind === "guide" ? current.content.linkedVideoId : null;
  const baselineLinkedVideoId = baseline.kind === "guide" ? baseline.content.linkedVideoId : null;
  const permittedFieldChanged =
    current.title !== baseline.title ||
    JSON.stringify(current.subjectIds) !== JSON.stringify(baseline.subjectIds) ||
    current.topic !== baseline.topic ||
    JSON.stringify(current.content.regions) !== JSON.stringify(baseline.content.regions) ||
    currentLinkedVideoId !== baselineLinkedVideoId;
  if (!permittedFieldChanged) return false;

  const currentWithoutPermittedFields = {
    ...current,
    subjectIds: [],
    title: "",
    topic: "",
    content: {
      ...current.content,
      regions: [],
      ...(current.kind === "guide" ? { linkedVideoId: null } : {}),
    },
  };
  const baselineWithoutPermittedFields = {
    ...baseline,
    subjectIds: [],
    title: "",
    topic: "",
    content: {
      ...baseline.content,
      regions: [],
      ...(baseline.kind === "guide" ? { linkedVideoId: null } : {}),
    },
  };
  return JSON.stringify(currentWithoutPermittedFields) === JSON.stringify(baselineWithoutPermittedFields);
}
