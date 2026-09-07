import type {
  LearningPathDetail,
  LearningPathStatus,
  LearningPathValidationIssue,
  PlatformRole,
} from "@cediah/contracts";

function issue(
  code: string,
  message: string,
  path: string,
  severity: "error" | "warning" = "error",
): LearningPathValidationIssue {
  return { code, message, path, severity };
}

function hasCycle(edges: Map<string, string[]>) {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (key: string): boolean => {
    if (visiting.has(key)) return true;
    if (visited.has(key)) return false;
    visiting.add(key);
    for (const dependency of edges.get(key) ?? []) {
      if (visit(dependency)) return true;
    }
    visiting.delete(key);
    visited.add(key);
    return false;
  };
  return [...edges.keys()].some(visit);
}

export function validateLearningPathDefinition(
  path: LearningPathDetail,
  resourceItems: Map<string, Array<{ explanation?: string; id: string; kind: string }>>,
): LearningPathValidationIssue[] {
  const issues: LearningPathValidationIssue[] = [];
  const allObjectiveIds = new Set<string>();
  const allStepKeys = new Set<string>();
  const dependencies = new Map<string, string[]>();

  if (path.version.units.length === 0) {
    issues.push(issue("unit_required", "Agrega al menos una unidad.", "version.units"));
  }

  path.version.units.forEach((unit, unitIndex) => {
    const unitPath = `version.units.${unitIndex}`;
    if (unit.objectives.length === 0) {
      issues.push(issue("objective_required", "La unidad necesita al menos un objetivo.", `${unitPath}.objectives`));
    }
    for (const objective of unit.objectives) {
      if (allObjectiveIds.has(objective.id)) {
        issues.push(issue("duplicate_objective", "El ID del objetivo está repetido.", `${unitPath}.objectives`));
      }
      allObjectiveIds.add(objective.id);
    }
    if (!unit.steps.some((step) => step.isEssential)) {
      issues.push(issue("essential_step_required", "La unidad necesita un paso esencial.", `${unitPath}.steps`));
    }
    unit.steps.forEach((step, stepIndex) => {
      const stepPath = `${unitPath}.steps.${stepIndex}`;
      if (allStepKeys.has(step.stableKey)) {
        issues.push(issue("duplicate_step_key", "La clave estable del paso está repetida.", `${stepPath}.stableKey`));
      }
      allStepKeys.add(step.stableKey);
      dependencies.set(step.stableKey, step.recommendedAfter);
      if (step.options.length === 0) {
        issues.push(issue("option_required", "El paso necesita al menos una opción válida.", `${stepPath}.options`));
      }
      if (step.options.filter((option) => option.isDefault).length !== 1) {
        issues.push(issue("default_option_required", "Selecciona exactamente una opción predeterminada.", `${stepPath}.options`));
      }
      for (const objectiveId of step.objectiveIds) {
        if (!unit.objectives.some((objective) => objective.id === objectiveId)) {
          issues.push(issue("unknown_objective", "El paso referencia un objetivo ajeno a su unidad.", `${stepPath}.objectiveIds`));
        }
      }
      step.options.forEach((option, optionIndex) => {
        const optionPath = `${stepPath}.options.${optionIndex}`;
        const revisionItems = resourceItems.get(option.resourceRevisionId) ?? [];
        const revisionIds = new Set(revisionItems.map((item) => item.id));
        for (const selectedId of option.config.selectedItemIds) {
          if (!revisionIds.has(selectedId)) {
            issues.push(issue("unknown_resource_item", "La selección contiene un ítem que no pertenece a la revisión.", `${optionPath}.config.selectedItemIds`));
          }
        }
        for (const mapping of option.config.objectiveMappings) {
          if (!revisionIds.has(mapping.itemId)) {
            issues.push(issue("unknown_mapping_item", "El mapping contiene un ítem ajeno a la revisión.", `${optionPath}.config.objectiveMappings`));
          }
          if (mapping.objectiveIds.some((id) => !step.objectiveIds.includes(id))) {
            issues.push(issue("unknown_mapping_objective", "El mapping referencia un objetivo no asociado al paso.", `${optionPath}.config.objectiveMappings`));
          }
        }
        if (option.projection === "quiz") {
          for (const item of revisionItems) {
            if (item.kind === "question" && !item.explanation?.trim()) {
              issues.push(issue("question_explanation_required", "Cada pregunta de una ruta necesita una explicación útil.", optionPath));
              break;
            }
          }
        }
      });
    });
  });

  for (const [key, prerequisites] of dependencies) {
    for (const prerequisite of prerequisites) {
      if (!allStepKeys.has(prerequisite)) {
        issues.push(issue("unknown_prerequisite", "El orden recomendado referencia un paso inexistente.", `step.${key}.recommendedAfter`));
      }
    }
  }
  if (hasCycle(dependencies)) {
    issues.push(issue("cyclic_recommendation", "El orden recomendado contiene un ciclo.", "version.units"));
  }

  for (const objectiveId of allObjectiveIds) {
    const relatedSteps = path.version.units.flatMap((unit) => unit.steps)
      .filter((step) => step.objectiveIds.includes(objectiveId));
    if (!relatedSteps.some((step) => step.purpose === "understand" || step.purpose === "integrate")) {
      issues.push(issue("objective_understanding_missing", "El objetivo necesita material de comprensión.", `objective.${objectiveId}`));
    }
    const retrievalOptions = relatedSteps
      .filter((step) => step.purpose === "recall" || step.purpose === "check")
      .flatMap((step) => step.options)
      .filter((option) => option.projection === "quiz" || option.projection === "flashcards");
    if (retrievalOptions.length === 0) {
      issues.push(issue("objective_retrieval_missing", "El objetivo necesita práctica de recuperación o comprobación.", `objective.${objectiveId}`));
      continue;
    }
    const mappedItems = new Set(
      retrievalOptions.flatMap((option) => option.config.objectiveMappings
        .filter((mapping) => mapping.objectiveIds.includes(objectiveId))
        .map((mapping) => mapping.itemId)),
    );
    if (mappedItems.size === 0) {
      issues.push(issue("objective_mapping_missing", "Asocia preguntas o tarjetas al objetivo.", `objective.${objectiveId}`));
    } else if (mappedItems.size < 5) {
      issues.push(issue(
        path.version.evidenceLevel === "limited" ? "limited_evidence" : "insufficient_evidence",
        path.version.evidenceLevel === "limited"
          ? "La cobertura permite aprender, pero no alcanzar evidencia Consolidada."
          : "Se requieren cinco ítems canónicos distintos para evidencia estándar.",
        `objective.${objectiveId}`,
        path.version.evidenceLevel === "limited" ? "warning" : "error",
      ));
    }
  }
  return issues;
}

export function canTransitionLearningPath(input: {
  actorUserId: string;
  canPublish: boolean;
  canReview: boolean;
  createdBy: string;
  currentStatus: LearningPathStatus;
  roles?: PlatformRole[];
  targetStatus: "in_review" | "changes_requested" | "approved" | "published" | "archived";
}) {
  if (input.targetStatus === "in_review") {
    return (
      (input.currentStatus === "draft" || input.currentStatus === "changes_requested") &&
      (input.actorUserId === input.createdBy || input.canReview)
    );
  }
  if (input.targetStatus === "changes_requested" || input.targetStatus === "approved") {
    return input.currentStatus === "in_review" && input.canReview;
  }
  if (input.targetStatus === "published") {
    return input.currentStatus === "approved" && input.canPublish;
  }
  return input.currentStatus === "published" && input.canPublish;
}
