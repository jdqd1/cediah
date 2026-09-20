import {
  LearningPathCreateRequestSchema,
  LearningPathUpdateRequestSchema,
  type LearningPathCreateRequest,
  type LearningPathUpdateRequest,
} from "@cediah/contracts";
import type { EditorDraft, EditorUnit } from "./editor-model";

export type EditorFieldTarget =
  | { entity: "route"; field: "title" | "summary" | "topicContentId" | "slug" }
  | { entity: "unit"; field: "title" | "stableKey"; unitId: string }
  | { entity: "objective"; field: "title"; objectiveId: string; unitId: string }
  | { activityId: string; entity: "activity"; field: "title" | "objectiveIds" | "stableKey"; unitId: string }
  | { activityId: string; entity: "option"; field: string; optionId: string; unitId: string }
  | { entity: "review"; field: string };

export type EditorSerializationError = {
  code: string;
  target: EditorFieldTarget;
};

export type EditorSerializationResult<T> =
  | { ok: true; value: T }
  | { errors: EditorSerializationError[]; ok: false };

type ContractIssue = { code: string; path: PropertyKey[] };

function referencedObjectiveIds(unit: EditorUnit) {
  return new Set(unit.steps.flatMap((step) => [
    ...step.objectiveIds,
    ...step.options.flatMap((option) => option.config.objectiveMappings.flatMap((mapping) => mapping.objectiveIds)),
  ]));
}

function prepareDraft(draft: EditorDraft): LearningPathCreateRequest {
  return {
    ...draft,
    definition: {
      ...draft.definition,
      units: draft.definition.units.map((unit) => {
        const referenced = referencedObjectiveIds(unit);
        return {
          ...unit,
          objectives: unit.objectives.filter((objective) => objective.title.trim() || referenced.has(objective.id)),
          steps: unit.steps.map((step) => ({
            ...step,
            objectiveIds: [...step.objectiveIds],
            options: step.options.map((option) => ({
              ...option,
              config: {
                ...option.config,
                guideSectionIndexes: option.config.guideSectionIndexes
                  ? [...option.config.guideSectionIndexes]
                  : undefined,
                objectiveMappings: option.config.objectiveMappings.map((mapping) => ({
                  itemId: mapping.itemId,
                  objectiveIds: [...mapping.objectiveIds],
                })),
                selectedItemIds: [...option.config.selectedItemIds],
                videoRange: option.config.videoRange ? { ...option.config.videoRange } : undefined,
              },
            })),
            recommendedAfter: [...step.recommendedAfter],
          })),
        };
      }),
    },
  };
}

function targetForIssue(issue: ContractIssue, draft: EditorDraft): EditorFieldTarget {
  const path = issue.path;
  if (path[0] === "title" || path[0] === "summary" || path[0] === "topicContentId" || path[0] === "slug") {
    return { entity: "route", field: path[0] };
  }
  const unitIndex = typeof path[2] === "number" ? path[2] : -1;
  const unit = draft.definition.units[unitIndex];
  if (!unit) return { entity: "review", field: path.join(".") };
  if (path[3] === "title" || path[3] === "stableKey") {
    return { entity: "unit", field: path[3], unitId: unit.id };
  }
  if (path[3] === "objectives") {
    const objectiveIndex = typeof path[4] === "number" ? path[4] : -1;
    const objective = unit.objectives[objectiveIndex];
    return objective
      ? { entity: "objective", field: "title", objectiveId: objective.id, unitId: unit.id }
      : { entity: "unit", field: "title", unitId: unit.id };
  }
  const stepIndex = typeof path[4] === "number" ? path[4] : -1;
  const activity = unit.steps[stepIndex];
  if (!activity) return { entity: "unit", field: "title", unitId: unit.id };
  if (path[5] === "title" || path[5] === "objectiveIds" || path[5] === "stableKey") {
    return { activityId: activity.id, entity: "activity", field: path[5], unitId: unit.id };
  }
  if (path[5] === "options") {
    const optionIndex = typeof path[6] === "number" ? path[6] : -1;
    const option = activity.options[optionIndex];
    if (option) {
      return {
        activityId: activity.id,
        entity: "option",
        field: String(path[7] ?? "material"),
        optionId: option.id,
        unitId: unit.id,
      };
    }
  }
  return { activityId: activity.id, entity: "activity", field: "title", unitId: unit.id };
}

function errorsFromIssues(issues: ContractIssue[], draft: EditorDraft) {
  const errors = issues.map((issue) => ({ code: issue.code, target: targetForIssue(issue, draft) }));
  return [...new Map(errors.map((error) => [JSON.stringify(error.target), error])).values()];
}

export function serializeCreateRequest(draft: EditorDraft): EditorSerializationResult<LearningPathCreateRequest> {
  const prepared = prepareDraft(draft);
  const parsed = LearningPathCreateRequestSchema.safeParse(prepared);
  if (!parsed.success) {
    return { errors: errorsFromIssues(parsed.error.issues, prepared as EditorDraft), ok: false };
  }
  return { ok: true, value: parsed.data };
}

export function serializeUpdateRequest(
  draft: EditorDraft,
  expectedVersion: number,
): EditorSerializationResult<LearningPathUpdateRequest> {
  const prepared = prepareDraft(draft);
  const parsed = LearningPathUpdateRequestSchema.safeParse({ ...prepared, expectedVersion });
  if (!parsed.success) {
    return { errors: errorsFromIssues(parsed.error.issues, prepared as EditorDraft), ok: false };
  }
  return { ok: true, value: parsed.data };
}
