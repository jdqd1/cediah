import type {
  LearningEditorMaterialDetail,
  LearningPathCreateRequest,
  LearningPathDefinition,
  LearningPathDetail,
  LearningPathOptionDraft,
  LearningPathStepDraft,
  LearningPathUnitDraft,
  LearningPathValidationIssue,
} from "@cediah/contracts";

export type EditorSection = "basics" | "activities" | "review";
export type EditorOperation = "idle" | "saving" | "validating" | "transitioning" | "creating-version";

export type EditorOption = Omit<LearningPathOptionDraft, "id"> & { id: string };
export type EditorActivity = Omit<LearningPathStepDraft, "id" | "options"> & {
  id: string;
  options: EditorOption[];
};
export type EditorUnit = Omit<LearningPathUnitDraft, "id" | "steps"> & {
  id: string;
  steps: EditorActivity[];
};
export type EditorDefinition = Omit<LearningPathDefinition, "units"> & { units: EditorUnit[] };
export type EditorDraft = Omit<LearningPathCreateRequest, "definition"> & {
  definition: EditorDefinition;
};

export type ValidationStamp = {
  editVersion: number;
  issues: LearningPathValidationIssue[];
  localRevision: number;
  ready: boolean;
};

export type RouteEditorState = {
  creationId: string;
  dirty: boolean;
  draft: EditorDraft;
  expandedActivityId: string | null;
  expandedUnitId: string | null;
  frozenSlug: string | null;
  localRevision: number;
  operation: EditorOperation;
  savedPath: LearningPathDetail | null;
  section: EditorSection;
  validation: ValidationStamp | null;
};

export type IdFactory = () => string;

const createUuid: IdFactory = () => crypto.randomUUID();

export function makeStableKey(kind: "unidad" | "actividad", id: string) {
  return `${kind}-${id}`;
}

export function makeSlug(title: string, creationId: string) {
  const base = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 155)
    .replace(/-+$/g, "") || "ruta";
  return `${base}-${creationId}`;
}

export function createObjective(createId: IdFactory = createUuid) {
  return { id: createId(), importance: 3 as const, title: "" };
}

export function createUnit(createId: IdFactory = createUuid): EditorUnit {
  const id = createId();
  return {
    id,
    objectives: [createObjective(createId)],
    pedagogyVersion: 1,
    stableKey: makeStableKey("unidad", id),
    steps: [],
    title: "",
  };
}

export const activityLabelByProjection = {
  flashcards: "Repasar tarjetas",
  guide: "Leer guía",
  quiz: "Responder cuestionario",
  video: "Ver video",
} as const;

export const activityPurposeByProjection = {
  flashcards: "recall",
  guide: "understand",
  quiz: "check",
  video: "understand",
} as const;

type ReadyMaterialDetail = Extract<LearningEditorMaterialDetail, { status: "ready" }>;

export function createActivityFromMaterial(input: {
  createId?: IdFactory;
  detail: ReadyMaterialDetail;
  objectiveIds: string[];
}): EditorActivity {
  const createId = input.createId ?? createUuid;
  const id = createId();
  const optionId = createId();
  const rewardIdentity = createId();
  const selectedItemIds = input.detail.items.map((item) => item.id);
  return {
    id,
    isEssential: true,
    objectiveIds: [...input.objectiveIds],
    options: [{
      config: {
        objectiveMappings: selectedItemIds.map((itemId) => ({
          itemId,
          objectiveIds: [...input.objectiveIds],
        })),
        selectedItemIds,
      },
      estimatedMinutes: input.detail.estimatedMinutes,
      expectedSourceVersion: input.detail.sourceVersion,
      id: optionId,
      isDefault: true,
      label: activityLabelByProjection[input.detail.projection],
      projection: input.detail.projection,
      rewardIdentity,
      rewardVersion: 1,
      sourceContentId: input.detail.sourceContentId,
    }],
    pedagogyVersion: 1,
    purpose: activityPurposeByProjection[input.detail.projection],
    recommendedAfter: [],
    stableKey: makeStableKey("actividad", id),
    title: input.detail.title,
  };
}

export function createEmptyDraft(topics: Array<{ id: string; title: string }>): EditorDraft {
  return {
    coverKey: "lungs",
    definition: {
      evidenceLevel: "standard",
      policyVersion: "guided-v1",
      releaseNotes: "",
      units: [],
    },
    slug: "",
    summary: "",
    title: "",
    topicContentId: topics.length === 1 ? topics[0]!.id : "",
  };
}

export function editorDraftFromDetail(path: LearningPathDetail): EditorDraft {
  return {
    coverKey: path.coverKey,
    definition: {
      evidenceLevel: path.version.evidenceLevel,
      policyVersion: path.version.policyVersion,
      releaseNotes: path.version.releaseNotes,
      units: path.version.units.map((unit) => ({
        id: unit.id,
        objectives: unit.objectives.map((objective) => ({ ...objective })),
        pedagogyVersion: unit.pedagogyVersion,
        stableKey: unit.stableKey,
        steps: unit.steps.map((step) => ({
          id: step.id,
          isEssential: step.isEssential,
          objectiveIds: [...step.objectiveIds],
          options: step.options.map((option) => ({
            completionRule: { ...option.completionRule },
            config: {
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
            estimatedMinutes: option.estimatedMinutes,
            id: option.id,
            isDefault: option.isDefault,
            label: option.label,
            projection: option.projection,
            rewardIdentity: option.rewardIdentity,
            rewardVersion: option.rewardVersion,
            sourceContentId: option.sourceContentId,
          })),
          pedagogyVersion: step.pedagogyVersion,
          purpose: step.purpose,
          recommendedAfter: [...step.recommendedAfter],
          stableKey: step.stableKey,
          title: step.title,
        })),
        title: unit.title,
      })),
    },
    slug: path.slug,
    summary: path.summary,
    title: path.title,
    topicContentId: path.topic.id,
  };
}

export function createNewEditorState(input: {
  createId?: IdFactory;
  topics: Array<{ id: string; title: string }>;
}): RouteEditorState {
  const creationId = (input.createId ?? createUuid)();
  return {
    creationId,
    dirty: false,
    draft: createEmptyDraft(input.topics),
    expandedActivityId: null,
    expandedUnitId: null,
    frozenSlug: null,
    localRevision: 0,
    operation: "idle",
    savedPath: null,
    section: "basics",
    validation: null,
  };
}

export function createEditorStateFromDetail(path: LearningPathDetail): RouteEditorState {
  return {
    creationId: path.id,
    dirty: false,
    draft: editorDraftFromDetail(path),
    expandedActivityId: path.version.units[0]?.steps[0]?.id ?? null,
    expandedUnitId: path.version.units[0]?.id ?? null,
    frozenSlug: path.slug,
    localRevision: 0,
    operation: "idle",
    savedPath: path,
    section: "basics",
    validation: null,
  };
}
