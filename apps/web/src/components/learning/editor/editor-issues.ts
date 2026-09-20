import type {
  LearningPathDetail,
  LearningPathValidationIssue,
} from "@cediah/contracts";

export type PresentedIssueTarget =
  | { activityId: string; kind: "alternative"; unitId: string }
  | { kind: "add-activity"; unitId: string }
  | { kind: "add-unit" }
  | { href: string; kind: "external" }
  | { activityId?: string; focusKey: string; kind: "focus"; openMore?: boolean; section: "activities" | "basics" | "review"; unitId?: string }
  | { activityId: string; kind: "replace"; optionId: string; unitId: string }
  | { kind: "retry" };

export type PresentedIssue = {
  actionLabel: string;
  code: string;
  location: string;
  resolution: string;
  severity: "error" | "warning";
  target: PresentedIssueTarget;
  title: string;
};

type Located = {
  activity?: LearningPathDetail["version"]["units"][number]["steps"][number];
  objective?: LearningPathDetail["version"]["units"][number]["objectives"][number];
  option?: LearningPathDetail["version"]["units"][number]["steps"][number]["options"][number];
  unit?: LearningPathDetail["version"]["units"][number];
};

export const issueFocusKeys = {
  activities: "activities:heading",
  activity: (activityId: string) => `activity:${activityId}`,
  activityMore: (activityId: string) => `activity:${activityId}:more`,
  objective: (unitId: string, objectiveId?: string) => `unit:${unitId}:objective:${objectiveId ?? "first"}`,
  option: (optionId: string) => `option:${optionId}`,
  routeField: (field: "summary" | "title" | "topicContentId") => `route:${field}`,
  review: "review:heading",
  topic: "route:topic",
  unitTitle: (unitId: string) => `unit:${unitId}:title`,
  activityTitle: (activityId: string) => `activity:${activityId}:title`,
};

function locateByContext(issue: LearningPathValidationIssue, detail: LearningPathDetail): Located | null {
  const context = issue.context;
  if (!context) return null;
  let unit = context.unitId
    ? detail.version.units.find((entry) => entry.id === context.unitId)
    : context.unitStableKey
      ? detail.version.units.find((entry) => entry.stableKey === context.unitStableKey)
      : undefined;
  const units = unit ? [unit] : detail.version.units;
  let activity = context.stepId
    ? units.flatMap((entry) => entry.steps).find((entry) => entry.id === context.stepId)
    : context.stepStableKey
      ? units.flatMap((entry) => entry.steps).find((entry) => entry.stableKey === context.stepStableKey)
      : undefined;
  if (activity && !unit) unit = detail.version.units.find((entry) => entry.steps.some((step) => step.id === activity!.id));
  const option = context.optionId
    ? (activity ? activity.options : units.flatMap((entry) => entry.steps).flatMap((entry) => entry.options))
      .find((entry) => entry.id === context.optionId)
    : undefined;
  if (option && !activity) {
    activity = units.flatMap((entry) => entry.steps).find((entry) => entry.options.some((entryOption) => entryOption.id === option.id));
    if (activity && !unit) unit = detail.version.units.find((entry) => entry.steps.some((step) => step.id === activity!.id));
  }
  const objective = context.objectiveId
    ? units.flatMap((entry) => entry.objectives).find((entry) => entry.id === context.objectiveId)
    : undefined;
  if (objective && !unit) unit = detail.version.units.find((entry) => entry.objectives.some((entryObjective) => entryObjective.id === objective.id));
  const hasLocator = Boolean(context.unitId || context.unitStableKey || context.stepId || context.stepStableKey || context.optionId || context.objectiveId);
  if (hasLocator && !unit && !activity && !option && !objective) return {};
  return { activity, objective, option, unit };
}

function locateLegacy(issue: LearningPathValidationIssue, detail: LearningPathDetail): Located {
  let match = /^version\.units\.(\d+)(?:\.steps\.(\d+)(?:\.options\.(\d+))?)?/.exec(issue.path);
  if (match) {
    const unit = detail.version.units[Number(match[1])];
    const activity = match[2] === undefined ? undefined : unit?.steps[Number(match[2])];
    const option = match[3] === undefined ? undefined : activity?.options[Number(match[3])];
    return unit ? { activity, option, unit } : {};
  }
  match = /^objective\.([0-9a-f-]+)$/i.exec(issue.path);
  if (match) {
    for (const unit of detail.version.units) {
      const objective = unit.objectives.find((entry) => entry.id === match![1]);
      if (objective) return { objective, unit };
    }
    return {};
  }
  match = /^resource\.([0-9a-f-]+)$/i.exec(issue.path);
  if (match) {
    for (const unit of detail.version.units) for (const activity of unit.steps) {
      const option = activity.options.find((entry) => entry.resourceRevisionId === match![1]);
      if (option) return { activity, option, unit };
    }
    return {};
  }
  match = /^step\.([a-z0-9_-]+)\.recommendedAfter$/.exec(issue.path);
  if (match) {
    for (const unit of detail.version.units) {
      const activity = unit.steps.find((entry) => entry.stableKey === match![1]);
      if (activity) return { activity, unit };
    }
  }
  return {};
}

function locate(issue: LearningPathValidationIssue, detail: LearningPathDetail) {
  return locateByContext(issue, detail) ?? locateLegacy(issue, detail);
}

function locationText(located: Located) {
  const unitTitle = located.unit?.title;
  const activityTitle = located.activity?.title;
  const objectiveTitle = located.objective?.title;
  const optionLabel = located.option?.label;
  return [unitTitle, activityTitle ?? objectiveTitle, optionLabel]
    .filter((value, index, values) => value && values.indexOf(value) === index)
    .join(" · ") || (located.unit ? "Unidad sin título" : "Ruta completa");
}

function focusTarget(located: Located, openMore = false): PresentedIssueTarget {
  if (located.option && located.activity && located.unit) return {
    activityId: located.activity.id,
    focusKey: openMore ? issueFocusKeys.activityMore(located.activity.id) : issueFocusKeys.option(located.option.id),
    kind: "focus",
    openMore,
    section: "activities",
    unitId: located.unit.id,
  };
  if (located.activity && located.unit) return {
    activityId: located.activity.id,
    focusKey: openMore ? issueFocusKeys.activityMore(located.activity.id) : issueFocusKeys.activity(located.activity.id),
    kind: "focus",
    openMore,
    section: "activities",
    unitId: located.unit.id,
  };
  if (located.unit) return {
    focusKey: issueFocusKeys.objective(located.unit.id, located.objective?.id),
    kind: "focus",
    section: "activities",
    unitId: located.unit.id,
  };
  return { focusKey: issueFocusKeys.review, kind: "focus", section: "review" };
}

export function presentIssue(issue: LearningPathValidationIssue, validatedDetail: LearningPathDetail): PresentedIssue {
  let located = locate(issue, validatedDetail);
  if (issue.code === "objective_mapping_missing" && located.objective && located.unit && !located.activity) {
    const activity = located.unit.steps.find((entry) => entry.objectiveIds.includes(located.objective!.id)
      && entry.options.some((option) => option.projection === "quiz" || option.projection === "flashcards"));
    const option = activity?.options.find((entry) => entry.projection === "quiz" || entry.projection === "flashcards");
    if (activity) located = { ...located, activity, option };
  }
  const location = issue.path === "topicContentId" ? "Datos de la ruta" : locationText(located);
  const retry: PresentedIssueTarget = { kind: "retry" };
  const addActivity = located.unit ? { kind: "add-activity" as const, unitId: located.unit.id } : focusTarget(located);
  const replace = located.unit && located.activity && located.option
    ? { activityId: located.activity.id, kind: "replace" as const, optionId: located.option.id, unitId: located.unit.id }
    : focusTarget(located);
  const base = { code: issue.code, location, severity: issue.severity };
  switch (issue.code) {
    case "unit_required": return { ...base, actionLabel: "Añadir unidad", resolution: "Añade una unidad para organizar las actividades.", target: { kind: "add-unit" }, title: "La ruta todavía no tiene unidades" };
    case "objective_required": return { ...base, actionLabel: "Escribir objetivo", resolution: "Escribe al menos un objetivo en esta unidad.", target: focusTarget(located), title: "Falta indicar qué se aprenderá" };
    case "essential_step_required": return { ...base, actionLabel: "Revisar actividades", resolution: "Añade una actividad o desactiva “Actividad opcional” en una existente.", target: focusTarget(located), title: "Esta unidad necesita una actividad obligatoria" };
    case "option_required": return {
      ...base,
      actionLabel: "Elegir material",
      resolution: "Selecciona un video, guía, cuestionario o tarjetas.",
      target: located.unit && located.activity
        ? { activityId: located.activity.id, kind: "alternative", unitId: located.unit.id }
        : addActivity,
      title: "Esta actividad no tiene material",
    };
    case "default_option_required": return { ...base, actionLabel: "Elegir recomendado", resolution: "Marca una de las alternativas de esta actividad.", target: focusTarget(located, true), title: "Elige el formato recomendado" };
    case "unknown_objective": return { ...base, actionLabel: "Asociar objetivo", resolution: "Selecciona un objetivo de esta unidad.", target: focusTarget(located, true), title: "La actividad está asociada a un objetivo que ya no existe" };
    case "unknown_resource_item": return { ...base, actionLabel: "Revisar selección", resolution: "Abre el material y vuelve a seleccionar las preguntas o tarjetas que usarás.", target: focusTarget(located, true), title: "La selección incluye preguntas o tarjetas que ya no están disponibles" };
    case "unknown_mapping_item": return { ...base, actionLabel: "Revisar asociaciones", resolution: "Revisa la selección y vuelve a asignar sus objetivos.", target: focusTarget(located, true), title: "Hay asociaciones con preguntas o tarjetas que ya no están disponibles" };
    case "unknown_mapping_objective": return { ...base, actionLabel: "Revisar asociaciones", resolution: "Selecciona el objetivo correspondiente.", target: focusTarget(located, true), title: "Una pregunta o tarjeta está asociada a otro objetivo" };
    case "question_explanation_required": return { ...base, actionLabel: "Abrir Contenido", resolution: `En Contenido, busca “${located.activity?.title || "este material"}”, añade las explicaciones y publica la corrección. Después actualiza el material aquí.`, target: { href: "/panel/contenido", kind: "external" }, title: "Hay preguntas sin explicación de la respuesta" };
    case "unknown_prerequisite": return { ...base, actionLabel: "Revisar orden", resolution: "Quita esa referencia o elige otra actividad.", target: focusTarget(located, true), title: "El orden recomendado incluye una actividad eliminada" };
    case "cyclic_recommendation": return { ...base, actionLabel: "Revisar orden", resolution: "Revisa el orden y quita una de esas relaciones.", target: located.activity ? focusTarget(located, true) : { focusKey: issueFocusKeys.activities, kind: "focus", section: "activities" }, title: "Dos o más actividades se recomiendan unas después de otras" };
    case "objective_understanding_missing": return { ...base, actionLabel: "Añadir explicación", resolution: "Añade una guía o un video. Si ya existe, comprueba que esté asociado a este objetivo y su uso sea Comprender o Integrar conocimientos.", target: addActivity, title: "Falta una actividad para comprender este objetivo" };
    case "objective_retrieval_missing": return { ...base, actionLabel: "Añadir práctica", resolution: "Añade un cuestionario o tarjetas y asócialos a este objetivo.", target: addActivity, title: "Falta práctica para este objetivo" };
    case "objective_mapping_missing": return { ...base, actionLabel: "Asociar práctica", resolution: "Indica qué preguntas o tarjetas practican este objetivo.", target: focusTarget(located, true), title: "Las preguntas o tarjetas no están asociadas a este objetivo" };
    case "insufficient_evidence": {
      const actual = issue.context?.actualCount;
      const required = issue.context?.requiredCount;
      const hasCount = actual !== undefined && required !== undefined;
      const missing = hasCount ? Math.max(required - actual, 0) : null;
      return {
        ...base,
        actionLabel: "Añadir práctica",
        resolution: hasCount ? `Hay ${actual} de las ${required} necesarias. Añade práctica que cubra este objetivo o revisa las preguntas asociadas.` : "Asocia al menos 5 preguntas o tarjetas distintas a este objetivo.",
        target: addActivity,
        title: missing === null ? "Faltan preguntas o tarjetas para este objetivo" : `Faltan ${missing} preguntas o tarjetas para este objetivo`,
      };
    }
    case "limited_evidence": return { ...base, actionLabel: "Mejorar práctica", resolution: "Puedes continuar. Añade hasta completar 5 preguntas o tarjetas distintas si quieres ofrecer práctica completa.", target: addActivity, title: "Este objetivo tiene práctica introductoria" };
    case "resource_unavailable": return { ...base, actionLabel: "Cambiar material", resolution: "Elige otro material publicado o publica su corrección en Contenido y actualízalo aquí.", target: replace, title: "Este material ya no está disponible para la ruta" };
    case "topic_unavailable": return { ...base, actionLabel: "Elegir tema", resolution: "Selecciona un tema publicado o publica el tema desde Contenido.", target: { focusKey: issueFocusKeys.topic, kind: "focus", section: "basics" }, title: "El tema de la ruta no está publicado" };
    case "duplicate_objective": return { ...base, actionLabel: "Reintentar comprobación", resolution: "Tus cambios siguen aquí. Reintenta la comprobación; si continúa, solicita ayuda al equipo del sitio.", target: retry, title: "No pudimos distinguir dos objetivos de la ruta" };
    case "duplicate_step_key": return { ...base, actionLabel: "Reintentar comprobación", resolution: "Tus cambios siguen aquí. Reintenta la comprobación; si continúa, solicita ayuda al equipo del sitio.", target: retry, title: "No pudimos distinguir dos actividades de la ruta" };
    case "duplicate_unit_key": return { ...base, actionLabel: "Reintentar comprobación", resolution: "Tus cambios siguen aquí. Reintenta la comprobación; si continúa, solicita ayuda al equipo del sitio.", target: retry, title: "No pudimos distinguir dos unidades de la ruta" };
    case "resource_changed": return { ...base, actionLabel: "Revisar material", resolution: "Vuelve a seleccionarlo y revisa las preguntas antes de guardar.", target: replace, title: "El material cambió mientras editabas" };
    default: return { ...base, actionLabel: "Reintentar comprobación", resolution: "Tus cambios siguen aquí. Reintenta; si continúa, solicita ayuda al equipo del sitio.", target: retry, title: "No pudimos completar esta comprobación" };
  }
}

export function presentIssues(issues: LearningPathValidationIssue[], detail: LearningPathDetail) {
  const seen = new Set<string>();
  return issues.flatMap((issue, index) => {
    const identity = JSON.stringify([issue.code, issue.context ?? null, issue.path]);
    if (seen.has(identity)) return [];
    seen.add(identity);
    const presented = presentIssue(issue, detail);
    const target = presented.target;
    const unitId = "unitId" in target ? target.unitId : undefined;
    const activityId = "activityId" in target ? target.activityId : undefined;
    const unitIndex = unitId ? detail.version.units.findIndex((unit) => unit.id === unitId) : detail.version.units.length;
    const activityIndex = activityId && unitIndex >= 0
      ? detail.version.units[unitIndex]!.steps.findIndex((activity) => activity.id === activityId)
      : 0;
    return [{ index, presented, sort: [unitIndex < 0 ? detail.version.units.length : unitIndex, activityIndex < 0 ? 0 : activityIndex] as const }];
  }).sort((a, b) => a.sort[0] - b.sort[0] || a.sort[1] - b.sort[1] || a.index - b.index)
    .map((entry) => entry.presented);
}
