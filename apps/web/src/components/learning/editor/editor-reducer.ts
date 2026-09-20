import type { EditorActivity, EditorDraft, EditorOption, EditorUnit, RouteEditorState } from "./editor-model";

type ActivityPatch = Partial<Pick<EditorActivity,
  "isEssential" | "purpose" | "recommendedAfter" | "title"
>>;
type OptionPatch = Partial<Pick<EditorOption, "estimatedMinutes" | "label">>;

export type RouteEditorAction =
  | { type: "add-unit"; unit: EditorUnit }
  | { type: "update-unit"; unitId: string; title: string }
  | { direction: -1 | 1; type: "move-unit"; unitId: string }
  | { type: "remove-unit"; unitId: string }
  | { activity: EditorActivity; type: "add-activity"; unitId: string }
  | { activityId: string; patch: ActivityPatch; type: "update-activity"; unitId: string }
  | { activityId: string; direction: -1 | 1; type: "move-activity"; unitId: string }
  | { activityId: string; type: "remove-activity"; unitId: string }
  | { activityId: string; option: EditorOption; type: "add-option"; unitId: string }
  | { activityId: string; optionId: string; patch: OptionPatch; type: "update-option"; unitId: string }
  | {
      activityId: string;
      objectiveMappings: EditorOption["config"]["objectiveMappings"];
      optionId: string;
      selectedItemIds: string[];
      type: "update-option-mappings";
      unitId: string;
    }
  | { activityId: string; optionId: string; type: "set-default-option"; unitId: string }
  | { activityId: string; optionId: string; type: "remove-option"; unitId: string }
  | {
      activityId: string;
      optionId: string;
      replacement: Pick<EditorOption,
        "config" | "estimatedMinutes" | "expectedSourceVersion" | "projection" | "sourceContentId"
      > & { label?: string };
      type: "replace-option-material";
      unitId: string;
    }
  | { objective: EditorUnit["objectives"][number]; type: "add-objective"; unitId: string }
  | { objectiveId: string; title: string; type: "update-objective"; unitId: string }
  | { objectiveId: string; replacementObjectiveId?: string; type: "remove-objective"; unitId: string };

function updateUnit(draft: EditorDraft, unitId: string, updater: (unit: EditorUnit) => EditorUnit | null) {
  const index = draft.definition.units.findIndex((unit) => unit.id === unitId);
  if (index < 0) return draft;
  const current = draft.definition.units[index]!;
  const updated = updater(current);
  if (!updated || updated === current) return draft;
  const units = [...draft.definition.units];
  units[index] = updated;
  return { ...draft, definition: { ...draft.definition, units } };
}

function updateActivity(
  draft: EditorDraft,
  unitId: string,
  activityId: string,
  updater: (activity: EditorActivity) => EditorActivity | null,
) {
  return updateUnit(draft, unitId, (unit) => {
    const index = unit.steps.findIndex((activity) => activity.id === activityId);
    if (index < 0) return unit;
    const current = unit.steps[index]!;
    const updated = updater(current);
    if (!updated || updated === current) return unit;
    const steps = [...unit.steps];
    steps[index] = updated;
    return { ...unit, steps };
  });
}

function withoutRecommendedKeys(draft: EditorDraft, deletedKeys: ReadonlySet<string>) {
  if (deletedKeys.size === 0) return draft;
  let changed = false;
  const units = draft.definition.units.map((unit) => {
    let unitChanged = false;
    const steps = unit.steps.map((activity) => {
      const recommendedAfter = activity.recommendedAfter.filter((key) => !deletedKeys.has(key));
      if (recommendedAfter.length === activity.recommendedAfter.length) return activity;
      changed = true;
      unitChanged = true;
      return { ...activity, recommendedAfter };
    });
    return unitChanged ? { ...unit, steps } : unit;
  });
  return changed ? { ...draft, definition: { ...draft.definition, units } } : draft;
}

function moveById<T extends { id: string }>(items: T[], id: string, direction: -1 | 1) {
  const index = items.findIndex((item) => item.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= items.length) return items;
  const moved = [...items];
  [moved[index], moved[target]] = [moved[target]!, moved[index]!];
  return moved;
}

function normalizeDefaultOptions(options: EditorOption[]) {
  if (options.length === 0) return options;
  const preferred = options.findIndex((option) => option.isDefault);
  const defaultIndex = preferred >= 0 ? preferred : 0;
  return options.map((option, index) => option.isDefault === (index === defaultIndex)
    ? option
    : { ...option, isDefault: index === defaultIndex });
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function objectiveIsReferenced(unit: EditorUnit, objectiveId: string) {
  return unit.steps.some((activity) => (
    activity.objectiveIds.includes(objectiveId)
    || activity.options.some((option) => option.config.objectiveMappings.some((mapping) => (
      mapping.objectiveIds.includes(objectiveId)
    )))
  ));
}

function removeOrReassignObjective(
  unit: EditorUnit,
  objectiveId: string,
  replacementObjectiveId?: string,
) {
  if (!unit.objectives.some((objective) => objective.id === objectiveId)) return unit;
  const referenced = objectiveIsReferenced(unit, objectiveId);
  if (referenced && (!replacementObjectiveId || replacementObjectiveId === objectiveId)) return unit;
  if (replacementObjectiveId && !unit.objectives.some((objective) => objective.id === replacementObjectiveId)) return unit;

  const objectives = unit.objectives.filter((objective) => objective.id !== objectiveId);
  const steps = unit.steps.map((activity) => ({
    ...activity,
    objectiveIds: unique(activity.objectiveIds.flatMap((id) => (
      id === objectiveId ? replacementObjectiveId ? [replacementObjectiveId] : [] : [id]
    ))),
    options: activity.options.map((option) => ({
      ...option,
      config: {
        ...option.config,
        objectiveMappings: option.config.objectiveMappings.map((mapping) => ({
          ...mapping,
          objectiveIds: unique(mapping.objectiveIds.flatMap((id) => (
            id === objectiveId ? replacementObjectiveId ? [replacementObjectiveId] : [] : [id]
          ))),
        })),
      },
    })),
  }));
  return { ...unit, objectives, steps };
}

function mutateDraft(draft: EditorDraft, action: RouteEditorAction): EditorDraft {
  switch (action.type) {
    case "add-unit":
      return draft.definition.units.length >= 30
        ? draft
        : { ...draft, definition: { ...draft.definition, units: [...draft.definition.units, action.unit] } };
    case "update-unit":
      return updateUnit(draft, action.unitId, (unit) => unit.title === action.title ? unit : { ...unit, title: action.title });
    case "move-unit": {
      const units = moveById(draft.definition.units, action.unitId, action.direction);
      return units === draft.definition.units ? draft : { ...draft, definition: { ...draft.definition, units } };
    }
    case "remove-unit": {
      const removed = draft.definition.units.find((unit) => unit.id === action.unitId);
      if (!removed) return draft;
      const withoutUnit = {
        ...draft,
        definition: {
          ...draft.definition,
          units: draft.definition.units.filter((unit) => unit.id !== action.unitId),
        },
      };
      return withoutRecommendedKeys(withoutUnit, new Set(removed.steps.map((activity) => activity.stableKey)));
    }
    case "add-activity":
      return updateUnit(draft, action.unitId, (unit) => unit.steps.length >= 60
        ? unit
        : { ...unit, steps: [...unit.steps, action.activity] });
    case "update-activity":
      return updateActivity(draft, action.unitId, action.activityId, (activity) => {
        const changed = Object.entries(action.patch).some(([key, value]) => (
          activity[key as keyof ActivityPatch] !== value
        ));
        return changed ? { ...activity, ...action.patch } : activity;
      });
    case "move-activity":
      return updateUnit(draft, action.unitId, (unit) => {
        const steps = moveById(unit.steps, action.activityId, action.direction);
        return steps === unit.steps ? unit : { ...unit, steps };
      });
    case "remove-activity": {
      const unit = draft.definition.units.find((entry) => entry.id === action.unitId);
      const activity = unit?.steps.find((entry) => entry.id === action.activityId);
      if (!unit || !activity) return draft;
      const withoutActivity = updateUnit(draft, action.unitId, (current) => ({
        ...current,
        steps: current.steps.filter((entry) => entry.id !== action.activityId),
      }));
      return withoutRecommendedKeys(withoutActivity, new Set([activity.stableKey]));
    }
    case "add-option":
      return updateActivity(draft, action.unitId, action.activityId, (activity) => activity.options.length >= 12
        ? activity
        : { ...activity, options: normalizeDefaultOptions([...activity.options, action.option]) });
    case "update-option":
      return updateActivity(draft, action.unitId, action.activityId, (activity) => {
        const index = activity.options.findIndex((option) => option.id === action.optionId);
        if (index < 0) return activity;
        const current = activity.options[index]!;
        const changed = Object.entries(action.patch).some(([key, value]) => (
          current[key as keyof OptionPatch] !== value
        ));
        if (!changed) return activity;
        const options = [...activity.options];
        options[index] = { ...current, ...action.patch };
        return { ...activity, options };
      });
    case "update-option-mappings":
      return updateActivity(draft, action.unitId, action.activityId, (activity) => {
        const index = activity.options.findIndex((option) => option.id === action.optionId);
        if (index < 0) return activity;
        const current = activity.options[index]!;
        if (
          JSON.stringify(current.config.selectedItemIds) === JSON.stringify(action.selectedItemIds)
          && JSON.stringify(current.config.objectiveMappings) === JSON.stringify(action.objectiveMappings)
        ) return activity;
        const options = [...activity.options];
        options[index] = {
          ...current,
          config: {
            ...current.config,
            objectiveMappings: action.objectiveMappings.map((mapping) => ({
              itemId: mapping.itemId,
              objectiveIds: [...mapping.objectiveIds],
            })),
            selectedItemIds: [...action.selectedItemIds],
          },
        };
        return { ...activity, options };
      });
    case "set-default-option":
      return updateActivity(draft, action.unitId, action.activityId, (activity) => {
        if (!activity.options.some((option) => option.id === action.optionId)) return activity;
        if (activity.options.every((option) => option.isDefault === (option.id === action.optionId))) return activity;
        return {
          ...activity,
          options: activity.options.map((option) => ({ ...option, isDefault: option.id === action.optionId })),
        };
      });
    case "remove-option":
      return updateActivity(draft, action.unitId, action.activityId, (activity) => {
        if (!activity.options.some((option) => option.id === action.optionId)) return activity;
        return {
          ...activity,
          options: normalizeDefaultOptions(activity.options.filter((option) => option.id !== action.optionId)),
        };
      });
    case "replace-option-material":
      return updateActivity(draft, action.unitId, action.activityId, (activity) => {
        const index = activity.options.findIndex((option) => option.id === action.optionId);
        if (index < 0) return activity;
        const current = activity.options[index]!;
        const options = [...activity.options];
        options[index] = {
          ...current,
          completionRule: undefined,
          config: action.replacement.config,
          estimatedMinutes: action.replacement.estimatedMinutes,
          expectedSourceVersion: action.replacement.expectedSourceVersion,
          label: action.replacement.label ?? current.label,
          projection: action.replacement.projection,
          refreshResource: true,
          sourceContentId: action.replacement.sourceContentId,
        };
        return { ...activity, options };
      });
    case "add-objective":
      return updateUnit(draft, action.unitId, (unit) => unit.objectives.length >= 30
        ? unit
        : { ...unit, objectives: [...unit.objectives, action.objective] });
    case "update-objective":
      return updateUnit(draft, action.unitId, (unit) => {
        const index = unit.objectives.findIndex((objective) => objective.id === action.objectiveId);
        if (index < 0 || unit.objectives[index]!.title === action.title) return unit;
        const objectives = [...unit.objectives];
        objectives[index] = { ...objectives[index]!, title: action.title };
        return { ...unit, objectives };
      });
    case "remove-objective":
      return updateUnit(draft, action.unitId, (unit) => removeOrReassignObjective(
        unit,
        action.objectiveId,
        action.replacementObjectiveId,
      ));
  }
}

export function routeEditorReducer(state: RouteEditorState, action: RouteEditorAction): RouteEditorState {
  if (state.operation !== "idle") return state;
  const draft = mutateDraft(state.draft, action);
  if (draft === state.draft) return state;

  let expandedUnitId = state.expandedUnitId;
  let expandedActivityId = state.expandedActivityId;
  if (action.type === "remove-unit" && expandedUnitId === action.unitId) {
    expandedUnitId = null;
    expandedActivityId = null;
  }
  if (action.type === "remove-activity" && expandedActivityId === action.activityId) {
    expandedActivityId = null;
  }

  return {
    ...state,
    dirty: true,
    draft,
    expandedActivityId,
    expandedUnitId,
    localRevision: state.localRevision + 1,
    validation: null,
  };
}
