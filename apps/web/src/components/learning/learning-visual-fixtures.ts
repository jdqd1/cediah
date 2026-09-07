import type {
  LearningAttempt,
  LearningEnrollmentProgress,
  LearningEnrollmentUpgradePreviewResponse,
  LearningHome,
  LearningMilestone,
  LearningPathCard,
  LearningPathDetail,
  LearningReward,
} from "@cediah/contracts";

const timestamp = "2026-09-06T14:30:00.000Z";
const uuid = (value: number) => `a1000000-0000-4000-8000-${String(value).padStart(12, "0")}`;

const enrollment = {
  completedAt: null,
  id: uuid(2),
  pathVersionId: uuid(3),
  rowVersion: 4,
  status: "active" as const,
};

export const learningVisualPaths: LearningPathCard[] = [
  {
    coverKey: "lungs",
    enrollment,
    estimatedMinutes: 58,
    id: uuid(1),
    slug: "bases-de-la-fisiologia-respiratoria",
    summary: "Conecta ventilación, intercambio gaseoso y control respiratorio con comprobaciones breves.",
    title: "Bases de la fisiología respiratoria",
    topic: { id: uuid(4), title: "Fisiología" },
    unitCount: 3,
  },
  {
    coverKey: "heart",
    enrollment: null,
    estimatedMinutes: 46,
    id: uuid(5),
    slug: "electrofisiologia-cardiaca-esencial",
    summary: "Recorre el potencial de acción, el sistema de conducción y su lectura clínica inicial.",
    title: "Electrofisiología cardíaca esencial",
    topic: { id: uuid(6), title: "Cardiología" },
    unitCount: 3,
  },
  {
    coverKey: "skull",
    enrollment: null,
    estimatedMinutes: 72,
    id: uuid(7),
    slug: "neuroanatomia-funcional-para-localizacion-clinica",
    summary: "Organiza vías, núcleos y hallazgos para razonar una localización neurológica.",
    title: "Neuroanatomía funcional para la localización clínica",
    topic: { id: uuid(8), title: "Neurociencias" },
    unitCount: 4,
  },
];

const preferences = {
  examDate: null,
  pendingConstancy: null,
  pinnedEnrollmentId: enrollment.id,
  rowVersion: 3,
  sessionMinutes: 10 as const,
  timezone: "America/Caracas",
  weeklyGoalDays: 3 as const,
};

const milestones: LearningMilestone[] = [
  {
    awardKey: `milestone:first-activity:${uuid(20)}`,
    awardedAt: "2026-09-02T13:00:00.000Z",
    kind: "milestone_first_activity",
    title: "Primera actividad completada",
    xp: 0,
  },
  {
    awardKey: `milestone:first-review:${uuid(21)}`,
    awardedAt: "2026-09-04T18:00:00.000Z",
    kind: "milestone_first_review",
    title: "Primer repaso completado",
    xp: 0,
  },
];

export const learningVisualHome: LearningHome = {
  activePath: {
    completedSteps: 3,
    continueHref: "/aprendizaje/rutas/bases-de-la-fisiologia-respiratoria/actividades/a1000000-0000-4000-8000-000000000108?opcion=a1000000-0000-4000-8000-000000000206",
    enrollmentId: enrollment.id,
    progressPercent: 43,
    title: "Bases de la fisiología respiratoria",
    totalSteps: 7,
  },
  constancy: { activeDaysThisWeek: 2, weeklyGoalDays: 3 },
  counts: { activePaths: 1, dueReviews: 18, pendingEssentialSteps: 4 },
  generatedAt: timestamp,
  milestones,
  points: 92,
  policyVersion: "recommendations-v1",
  preferences,
  tasks: [
    {
      band: 0,
      dueAt: "2026-09-06T12:00:00.000Z",
      enrollmentId: enrollment.id,
      estimatedMinutes: 10,
      href: "/aprendizaje/repaso?minutos=10",
      importance: 3,
      itemCount: 10,
      key: "review:due:respiratory",
      kind: "review",
      reason: "18 repasos vencidos · sesión acotada a 10",
      taskKeys: ["review:due:respiratory"],
      title: "Repasar conceptos que vencieron",
    },
    {
      band: 1,
      dueAt: null,
      enrollmentId: enrollment.id,
      estimatedMinutes: 6,
      href: "/aprendizaje/sesiones/a1000000-0000-4000-8000-000000000309",
      importance: 3,
      itemCount: 1,
      key: "resume:gas-exchange",
      kind: "resume",
      reason: "Quedó una actividad a medias",
      taskKeys: ["resume:gas-exchange"],
      title: "Retomar intercambio alveolocapilar",
    },
    {
      band: 2,
      dueAt: null,
      enrollmentId: enrollment.id,
      estimatedMinutes: 7,
      href: "/aprendizaje/rutas/bases-de-la-fisiologia-respiratoria/actividades/a1000000-0000-4000-8000-000000000108?opcion=a1000000-0000-4000-8000-000000000206",
      importance: 2,
      itemCount: 1,
      key: "step:ventilation-perfusion",
      kind: "step",
      reason: "Siguiente paso recomendado de tu ruta",
      taskKeys: ["step:ventilation-perfusion"],
      title: "Relacionar ventilación con perfusión",
    },
    {
      band: 3,
      dueAt: null,
      enrollmentId: enrollment.id,
      estimatedMinutes: 5,
      href: "/aprendizaje/rutas/bases-de-la-fisiologia-respiratoria/actividades/a1000000-0000-4000-8000-000000000109?opcion=a1000000-0000-4000-8000-000000000209",
      importance: 2,
      itemCount: 1,
      key: "reinforcement:oxygen-curve",
      kind: "reinforcement",
      reason: "Refuerzo sugerido por tu última comprobación",
      taskKeys: ["reinforcement:oxygen-curve"],
      title: "Revisar la curva de disociación de la hemoglobina",
    },
    {
      band: 4,
      dueAt: null,
      enrollmentId: enrollment.id,
      estimatedMinutes: 8,
      href: "/aprendizaje/rutas/bases-de-la-fisiologia-respiratoria",
      importance: 1,
      itemCount: 1,
      key: "explore:control-respiratory",
      kind: "explore",
      reason: "Otra actividad disponible",
      taskKeys: ["explore:control-respiratory"],
      title: "Explorar el control central de la respiración",
    },
  ],
};

export const learningVisualNewHome: LearningHome = {
  ...learningVisualHome,
  activePath: null,
  constancy: { activeDaysThisWeek: 0, weeklyGoalDays: null },
  counts: { activePaths: 0, dueReviews: 0, pendingEssentialSteps: 0 },
  milestones: [],
  points: 0,
  preferences: { ...preferences, pinnedEnrollmentId: null, weeklyGoalDays: null },
  tasks: [],
};

export const learningVisualCompleteHome: LearningHome = {
  ...learningVisualHome,
  activePath: { ...learningVisualHome.activePath!, completedSteps: 7, progressPercent: 100 },
  counts: { activePaths: 1, dueReviews: 4, pendingEssentialSteps: 0 },
  milestones: [
    ...milestones,
    {
      awardKey: `route:${uuid(3)}:completed`,
      awardedAt: timestamp,
      kind: "route_completed",
      title: "Primera ruta completada",
      xp: 50,
    },
  ],
  points: 210,
  tasks: [learningVisualHome.tasks[0]!],
};

export const learningVisualLongTitleHome: LearningHome = {
  ...learningVisualHome,
  activePath: {
    ...learningVisualHome.activePath!,
    title: "Integración avanzada de la fisiología respiratoria, el transporte de gases y la respuesta clínica al ejercicio",
  },
  tasks: learningVisualHome.tasks.map((task, index) => index === 2 ? {
    ...task,
    title: "Distinguir los mecanismos que modifican la relación ventilación-perfusión en escenarios clínicos complejos",
  } : task),
};

const objectiveIds = [uuid(101), uuid(102), uuid(103)];
const stepIds = [uuid(105), uuid(106), uuid(107), uuid(108), uuid(109), uuid(110), uuid(111)];

function option(
  stepIndex: number,
  projection: "video" | "guide" | "quiz" | "flashcards",
  isDefault = true,
): LearningPathDetail["version"]["units"][number]["steps"][number]["options"][number] {
  return {
    completionRule: projection === "video"
      ? { externalDeclarationRequired: true, minimumCoveragePercent: 90, type: "video" as const }
      : projection === "guide"
        ? { confirmationRequired: true as const, type: "guide" as const }
        : projection === "quiz"
          ? { completion: "submitted" as const, type: "quiz" as const }
          : { minimumRated: 4, type: "flashcards" as const },
    config: { objectiveMappings: [], selectedItemIds: [] },
    estimatedMinutes: projection === "video" ? 8 : 6,
    id: uuid(200 + stepIndex * 2 + (isDefault ? 0 : 1)),
    isDefault,
    label: isDefault ? "Actividad recomendada" : "Alternativa breve",
    projection,
    resourceRevisionId: uuid(300 + stepIndex * 2 + (isDefault ? 0 : 1)),
    rewardIdentity: uuid(400 + stepIndex),
    rewardVersion: 1,
    sourceContentId: uuid(500 + stepIndex * 2 + (isDefault ? 0 : 1)),
  };
}

export const learningVisualPathDetail: LearningPathDetail = {
  archivedAt: null,
  coverKey: "lungs",
  createdBy: uuid(600),
  enrollment,
  id: uuid(1),
  slug: "bases-de-la-fisiologia-respiratoria",
  summary: "Conecta ventilación, intercambio gaseoso y control respiratorio con comprobaciones breves que dejan evidencia útil.",
  title: "Bases de la fisiología respiratoria",
  topic: { id: uuid(4), title: "Fisiología" },
  version: {
    editVersion: 3,
    evidenceLevel: "standard",
    id: uuid(3),
    number: 1,
    policyVersion: "guided-v1",
    publishedAt: "2026-08-28T12:00:00.000Z",
    releaseNotes: "Primera revisión académica de desarrollo.",
    status: "published",
    units: [
      {
        id: uuid(701),
        objectives: [{ id: objectiveIds[0]!, importance: 3, title: "Explicar cómo se genera la ventilación alveolar" }],
        pedagogyVersion: 1,
        position: 0,
        stableKey: "ventilacion",
        steps: [
          { id: stepIds[0]!, isEssential: true, objectiveIds: [objectiveIds[0]!], options: [option(0, "video"), option(0, "guide", false)], pedagogyVersion: 1, position: 0, purpose: "understand", recommendedAfter: [], stableKey: "mecanica", title: "Comprender la mecánica ventilatoria" },
          { id: stepIds[1]!, isEssential: true, objectiveIds: [objectiveIds[0]!], options: [option(1, "flashcards")], pedagogyVersion: 1, position: 1, purpose: "recall", recommendedAfter: ["mecanica"], stableKey: "conceptos", title: "Recuperar los conceptos esenciales" },
          { id: stepIds[2]!, isEssential: true, objectiveIds: [objectiveIds[0]!], options: [option(2, "quiz")], pedagogyVersion: 1, position: 2, purpose: "check", recommendedAfter: ["conceptos"], stableKey: "comprobar-ventilacion", title: "Comprobar ventilación alveolar" },
        ],
        title: "Ventilación alveolar",
      },
      {
        id: uuid(702),
        objectives: [{ id: objectiveIds[1]!, importance: 3, title: "Relacionar difusión, perfusión y transporte de oxígeno" }],
        pedagogyVersion: 1,
        position: 1,
        stableKey: "intercambio",
        steps: [
          { id: stepIds[3]!, isEssential: true, objectiveIds: [objectiveIds[1]!], options: [option(3, "guide")], pedagogyVersion: 1, position: 0, purpose: "understand", recommendedAfter: [], stableKey: "intercambio-alveolar", title: "Analizar el intercambio alveolocapilar" },
          { id: stepIds[4]!, isEssential: true, objectiveIds: [objectiveIds[1]!], options: [option(4, "quiz")], pedagogyVersion: 1, position: 1, purpose: "check", recommendedAfter: ["intercambio-alveolar"], stableKey: "curva-hemoglobina", title: "Aplicar la curva de disociación" },
        ],
        title: "Intercambio y transporte de gases",
      },
      {
        id: uuid(703),
        objectives: [{ id: objectiveIds[2]!, importance: 2, title: "Integrar el control neural y químico de la respiración" }],
        pedagogyVersion: 1,
        position: 2,
        stableKey: "control",
        steps: [
          { id: stepIds[5]!, isEssential: true, objectiveIds: [objectiveIds[2]!], options: [option(5, "video")], pedagogyVersion: 1, position: 0, purpose: "understand", recommendedAfter: [], stableKey: "centros", title: "Ubicar los centros respiratorios" },
          { id: stepIds[6]!, isEssential: true, objectiveIds: [objectiveIds[2]!], options: [option(6, "quiz")], pedagogyVersion: 1, position: 1, purpose: "integrate", recommendedAfter: ["centros"], stableKey: "integracion", title: "Integrar el control en un caso clínico" },
        ],
        title: "Control de la respiración",
      },
    ],
  },
};

function stepProgress(index: number, state: "completed" | "in_progress" | "not_started") {
  return {
    attemptId: state === "not_started" ? null : uuid(800 + index),
    completedAt: state === "completed" ? timestamp : null,
    completionMethod: state === "completed" ? "graded" as const : null,
    isEssential: true,
    rowVersion: state === "not_started" ? 0 : 2,
    state,
    stepId: stepIds[index]!,
    title: learningVisualPathDetail.version.units.flatMap((unit) => unit.steps)[index]!.title,
  };
}

export const learningVisualProgress: LearningEnrollmentProgress = {
  completedEssentialSteps: 3,
  enrollmentId: enrollment.id,
  pathVersionId: enrollment.pathVersionId,
  percentage: 43,
  totalEssentialSteps: 7,
  units: [
    {
      completedEssentialSteps: 3,
      id: uuid(701),
      objectives: [{ distinctQuestions: 6, evidenceLimited: false, id: objectiveIds[0]!, lastAssessedAt: timestamp, lastCheckPercent: 82, lastReviewAt: timestamp, reviewRecommended: false, state: "developing", title: "Explicar cómo se genera la ventilación alveolar" }],
      steps: [stepProgress(0, "completed"), stepProgress(1, "completed"), stepProgress(2, "completed")],
      title: "Ventilación alveolar",
      totalEssentialSteps: 3,
    },
    {
      completedEssentialSteps: 0,
      id: uuid(702),
      objectives: [{ distinctQuestions: 2, evidenceLimited: true, id: objectiveIds[1]!, lastAssessedAt: timestamp, lastCheckPercent: 50, lastReviewAt: null, reviewRecommended: true, state: "practicing", title: "Relacionar difusión, perfusión y transporte de oxígeno" }],
      steps: [stepProgress(3, "in_progress"), stepProgress(4, "not_started")],
      title: "Intercambio y transporte de gases",
      totalEssentialSteps: 2,
    },
    {
      completedEssentialSteps: 0,
      id: uuid(703),
      objectives: [{ distinctQuestions: 0, evidenceLimited: false, id: objectiveIds[2]!, lastAssessedAt: null, lastCheckPercent: null, lastReviewAt: null, reviewRecommended: false, state: "unassessed", title: "Integrar el control neural y químico de la respiración" }],
      steps: [stepProgress(5, "not_started"), stepProgress(6, "not_started")],
      title: "Control de la respiración",
      totalEssentialSteps: 2,
    },
  ],
};

export const learningVisualUpgrade: LearningEnrollmentUpgradePreviewResponse = {
  history: [
    {
      adoptedAt: "2026-08-28T12:00:00.000Z",
      pathVersionId: enrollment.pathVersionId,
      previousVersionId: null,
      versionNumber: 1,
    },
  ],
  upgrade: {
    activeAttempt: null,
    currentProgress: {
      completedEssentialSteps: 3,
      percentage: 43,
      totalEssentialSteps: 7,
    },
    currentVersion: {
      id: enrollment.pathVersionId,
      number: 1,
      publishedAt: "2026-08-28T12:00:00.000Z",
      releaseNotes: "Primera revisión académica de desarrollo.",
    },
    projectedProgress: {
      completedEssentialSteps: 3,
      percentage: 38,
      totalEssentialSteps: 8,
    },
    steps: [
      {
        completed: true,
        currentStepId: stepIds[0]!,
        kind: "changed",
        stableKey: "mecanica",
        targetStepId: uuid(405),
        title: "Aplicar la mecánica ventilatoria a un caso",
        transferable: false,
      },
      {
        completed: false,
        currentStepId: null,
        kind: "added",
        stableKey: "integracion-respiratoria",
        targetStepId: uuid(412),
        title: "Integrar la respuesta respiratoria al ejercicio",
        transferable: false,
      },
    ],
    summary: {
      added: 1,
      changed: 1,
      removed: 0,
      transferableCompleted: 2,
    },
    targetVersion: {
      id: uuid(403),
      number: 2,
      publishedAt: timestamp,
      releaseNotes: "Reorganizamos la ruta y añadimos una integración clínica final.",
    },
  },
};

export const learningVisualBlockedUpgrade: LearningEnrollmentUpgradePreviewResponse = {
  ...learningVisualUpgrade,
  upgrade: learningVisualUpgrade.upgrade
    ? {
        ...learningVisualUpgrade.upgrade,
        activeAttempt: {
          attemptId: uuid(309),
          href: `/aprendizaje/sesiones/${uuid(309)}`,
          title: "Analizar el intercambio alveolocapilar",
        },
      }
    : null,
};

export const learningVisualAttempt: LearningAttempt = {
  clientAttemptId: uuid(900),
  enrollmentId: enrollment.id,
  id: uuid(901),
  manifest: {
    completionRule: { completion: "submitted", type: "quiz" },
    projection: "quiz",
    questions: [{ itemId: uuid(910), memoryVersion: 1, objectiveIds: [objectiveIds[1]!], options: [{ id: uuid(911), text: "A" }, { id: uuid(912), text: "B" }], prompt: "Pregunta de comprobación" }],
    resourceRevisionId: uuid(913),
    sourceContentId: uuid(914),
    title: "Aplicar la curva de disociación",
  },
  pathSlug: "bases-de-la-fisiologia-respiratoria",
  pathVersionId: enrollment.pathVersionId,
  responses: [],
  resume: { answeredItemIds: [uuid(910)], currentIndex: 1, guidePosition: null, observedRanges: [], ratedItemIds: [], revealedItemIds: [], videoPositionSeconds: null },
  revealedCards: [],
  rowVersion: 3,
  score: { answered: 1, correct: 1, percent: 100, total: 1 },
  startedAt: "2026-09-06T14:20:00.000Z",
  status: "completed",
  stepId: stepIds[4]!,
  stepOptionId: uuid(208),
  submittedAt: timestamp,
};

export const learningVisualAwards: LearningReward[] = [
  { awardKey: `activity:${uuid(404)}:1`, awardedAt: timestamp, kind: "activity_check", title: "Comprobación completada", xp: 15 },
  { awardKey: `unit:${uuid(702)}:completed`, awardedAt: timestamp, kind: "unit_completed", title: "Unidad completada", xp: 20 },
  { awardKey: `milestone:first-unit:${uuid(702)}`, awardedAt: timestamp, kind: "milestone_first_unit", title: "Primera unidad completada", xp: 0 },
];
