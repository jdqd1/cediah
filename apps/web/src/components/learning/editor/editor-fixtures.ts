import type {
  LearningEditorMaterialDetail,
  LearningEditorResource,
  LearningPathCreateRequest,
  LearningPathDetail,
  LearningPathOptionDraft,
  LearningPathValidationIssue,
  LearningProjection,
} from "@cediah/contracts";
import type { EditorApi, EditorApiFailure, EditorApiResult } from "./editor-api";

export const editorFixtureModes = ["new", "ready", "errors", "limited", "legacy", "published", "archived", "empty-catalog", "long", "off-page"] as const;
export type EditorFixtureMode = typeof editorFixtureModes[number];
export type EditorFixtureFailure = "none" | "save-401" | "save-409" | "save-503" | "slow" | "transition-503" | "validate-stale";

const fixtureId = (value: number) => `fd000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const actorUserId = fixtureId(1);
const pathId = fixtureId(2);
const versionId = fixtureId(3);
const topicId = fixtureId(4);
const guideId = fixtureId(10);
const quizId = fixtureId(11);
const videoId = fixtureId(12);
const itemIds = Array.from({ length: 7 }, (_, index) => fixtureId(100 + index));

export const editorFixtureTopics = [{ id: topicId, title: "Anatomía" }];

export const editorFixtureResources: LearningEditorResource[] = [
  {
    catalogVisibility: "catalog",
    estimatedMinutes: 14,
    id: guideId,
    issues: [],
    kind: "guide",
    projections: [
      { explanationCoverage: "not_applicable", itemCount: 0, itemIds: [], projection: "guide" },
      { explanationCoverage: "not_applicable", itemCount: 0, itemIds: [], projection: "video" },
    ],
    title: "Pared torácica: guía visual",
    topic: "Anatomía",
    version: 3,
  },
  {
    catalogVisibility: "catalog",
    estimatedMinutes: 9,
    id: quizId,
    issues: [],
    kind: "quiz",
    projections: [
      { explanationCoverage: "complete", itemCount: 7, itemIds, projection: "quiz" },
      { explanationCoverage: "not_applicable", itemCount: 7, itemIds, projection: "flashcards" },
    ],
    title: "Comprobación de la pared torácica",
    topic: "Anatomía",
    version: 5,
  },
  {
    catalogVisibility: "guided_only",
    estimatedMinutes: 6,
    id: videoId,
    issues: [],
    kind: "video",
    projections: [{ explanationCoverage: "not_applicable", itemCount: 0, itemIds: [], projection: "video" }],
    title: "Relaciones del mediastino",
    topic: "Anatomía",
    version: 2,
  },
];

function completionRule(projection: LearningProjection): NonNullable<LearningPathOptionDraft["completionRule"]> {
  if (projection === "guide") return { confirmationRequired: true, type: "guide" };
  if (projection === "video") return { externalDeclarationRequired: true, minimumCoveragePercent: 90, type: "video" };
  if (projection === "quiz") return { completion: "submitted", type: "quiz" };
  return { minimumRated: 5, type: "flashcards" };
}

function option(input: {
  id: number;
  isDefault?: boolean;
  mappings?: string[];
  objectiveIds: string[];
  projection: LearningProjection;
  selected?: string[];
  sourceContentId: string;
}): LearningPathOptionDraft & { id: string } {
  const selected = input.selected ?? [];
  return {
    completionRule: completionRule(input.projection),
    config: {
      objectiveMappings: (input.mappings ?? selected).map((itemId) => ({ itemId, objectiveIds: [...input.objectiveIds] })),
      selectedItemIds: selected,
      ...(input.projection === "video" ? { videoRange: { endSeconds: 320, startSeconds: 20 } } : {}),
    },
    estimatedMinutes: input.projection === "guide" ? 14 : input.projection === "video" ? 6 : 9,
    id: fixtureId(input.id),
    isDefault: input.isDefault ?? true,
    label: input.projection === "guide" ? "Leer guía" : input.projection === "video" ? "Ver video" : input.projection === "quiz" ? "Responder cuestionario" : "Repasar tarjetas",
    projection: input.projection,
    rewardIdentity: fixtureId(input.id + 1_000),
    rewardVersion: 1,
    sourceContentId: input.sourceContentId,
  };
}

function baseRequest(evidenceLevel: "limited" | "standard" = "standard"): LearningPathCreateRequest {
  const objectiveId = fixtureId(20);
  return {
    coverKey: "lungs",
    definition: {
      evidenceLevel,
      policyVersion: "guided-v1",
      releaseNotes: "",
      units: [{
        id: fixtureId(21),
        objectives: [{ id: objectiveId, importance: 3, title: "Identificar las estructuras principales de la pared torácica" }],
        pedagogyVersion: 1,
        stableKey: "unidad-pared-toracica",
        steps: [
          {
            id: fixtureId(22),
            isEssential: true,
            objectiveIds: [objectiveId],
            options: [option({ id: 23, objectiveIds: [objectiveId], projection: "guide", sourceContentId: guideId })],
            pedagogyVersion: 1,
            purpose: "understand",
            recommendedAfter: [],
            stableKey: "actividad-comprender-pared",
            title: "Comprender la pared torácica",
          },
          {
            id: fixtureId(24),
            isEssential: true,
            objectiveIds: [objectiveId],
            options: [option({ id: 25, objectiveIds: [objectiveId], projection: "quiz", selected: itemIds.slice(0, 5), sourceContentId: quizId })],
            pedagogyVersion: 1,
            purpose: "check",
            recommendedAfter: ["actividad-comprender-pared"],
            stableKey: "actividad-practicar-pared",
            title: "Practicar las relaciones anatómicas",
          },
        ],
        title: "Pared torácica",
      }],
    },
    slug: "anatomia-esencial-del-torax-fixture",
    summary: "Una ruta breve para reconocer estructuras, relaciones y puntos de referencia del tórax.",
    title: "Anatomía esencial del tórax",
    topicContentId: topicId,
  };
}

function errorsRequest(evidenceLevel: "limited" | "standard") {
  const request = baseRequest(evidenceLevel);
  const unit = request.definition.units[0]!;
  unit.steps = [structuredClone(unit.steps[1]!)];
  unit.steps[0]!.options[0]!.config.selectedItemIds = itemIds.slice(0, 3);
  unit.steps[0]!.options[0]!.config.objectiveMappings = itemIds.slice(0, 3).map((itemId) => ({ itemId, objectiveIds: [unit.objectives[0]!.id] }));
  unit.steps[0]!.recommendedAfter = [];
  return request;
}

function limitedRequest() {
  const request = baseRequest("limited");
  const option = request.definition.units[0]!.steps[1]!.options[0]!;
  option.config.selectedItemIds = itemIds.slice(0, 3);
  option.config.objectiveMappings = itemIds.slice(0, 3).map((itemId) => ({ itemId, objectiveIds: [...request.definition.units[0]!.steps[1]!.objectiveIds] }));
  return request;
}

function legacyRequest() {
  const request = baseRequest();
  const unit = request.definition.units[0]!;
  const secondObjective = { id: fixtureId(30), importance: 2, title: "Explicar las relaciones del mediastino" };
  unit.objectives.push(secondObjective);
  unit.steps[0]!.purpose = "integrate";
  unit.steps[0]!.objectiveIds.push(secondObjective.id);
  unit.steps[0]!.options.push(option({ id: 31, isDefault: false, objectiveIds: unit.steps[0]!.objectiveIds, projection: "video", sourceContentId: videoId }));
  unit.steps[1]!.purpose = "diagnostic";
  unit.steps[1]!.objectiveIds.push(secondObjective.id);
  unit.steps[1]!.options.push(option({ id: 33, isDefault: false, objectiveIds: unit.steps[1]!.objectiveIds, projection: "flashcards", selected: itemIds.slice(0, 5), sourceContentId: quizId }));
  request.definition.releaseNotes = "Conserva selecciones personalizadas y alternativas heredadas.";
  return request;
}

function longRequest() {
  const request = baseRequest();
  request.title = "Ruta extensa de anatomía clínica " + "y correlación topográfica ".repeat(8);
  request.title = request.title.slice(0, 200);
  request.summary = "Descripción extensa para comprobar el ajuste de texto y el reflow. ".repeat(20).slice(0, 1_100);
  const template = request.definition.units[0]!;
  request.definition.units = Array.from({ length: 30 }, (_, index) => {
    const unit = structuredClone(template);
    unit.id = fixtureId(200 + index * 10);
    unit.stableKey = `unidad-extensa-${index + 1}`;
    unit.title = (`Unidad ${index + 1}: ` + "Relaciones anatómicas y aplicaciones clínicas ".repeat(8)).slice(0, 240);
    unit.objectives = [{ id: fixtureId(201 + index * 10), importance: 3, title: ("Identificar, comparar y explicar estructuras relevantes ".repeat(7)).slice(0, 240) }];
    unit.steps = [structuredClone(template.steps[0]!)];
    unit.steps[0]!.id = fixtureId(202 + index * 10);
    unit.steps[0]!.stableKey = `actividad-extensa-${index + 1}`;
    unit.steps[0]!.title = ("Actividad extensa con un nombre deliberadamente largo ".repeat(7)).slice(0, 240);
    unit.steps[0]!.objectiveIds = [unit.objectives[0]!.id];
    unit.steps[0]!.options[0]!.id = fixtureId(203 + index * 10);
    unit.steps[0]!.options[0]!.rewardIdentity = fixtureId(204 + index * 10);
    return unit;
  });
  return request;
}

function materialize(request: LearningPathCreateRequest, input: { archivedAt?: string | null; editVersion?: number; number?: number; status?: LearningPathDetail["version"]["status"] } = {}): LearningPathDetail {
  return {
    archivedAt: input.archivedAt ?? null,
    coverKey: request.coverKey,
    createdBy: actorUserId,
    enrollment: null,
    id: pathId,
    slug: request.slug,
    summary: request.summary,
    title: request.title,
    topic: { id: request.topicContentId, title: editorFixtureTopics.find((topic) => topic.id === request.topicContentId)?.title ?? "Anatomía" },
    version: {
      editVersion: input.editVersion ?? 1,
      evidenceLevel: request.definition.evidenceLevel,
      id: versionId,
      number: input.number ?? 1,
      policyVersion: request.definition.policyVersion,
      publishedAt: input.status === "published" ? "2026-09-18T12:00:00.000Z" : null,
      releaseNotes: request.definition.releaseNotes,
      status: input.status ?? "draft",
      units: request.definition.units.map((unit, unitIndex) => ({
        ...unit,
        id: unit.id ?? fixtureId(5_000 + unitIndex),
        position: unitIndex,
        steps: unit.steps.map((step, stepIndex) => ({
          ...step,
          id: step.id ?? fixtureId(6_000 + unitIndex * 100 + stepIndex),
          options: step.options.map((entry, optionIndex) => ({
            completionRule: entry.completionRule ?? completionRule(entry.projection),
            config: structuredClone(entry.config),
            estimatedMinutes: entry.estimatedMinutes,
            id: entry.id ?? fixtureId(7_000 + unitIndex * 1_000 + stepIndex * 20 + optionIndex),
            isDefault: entry.isDefault,
            label: entry.label,
            projection: entry.projection,
            resourceRevisionId: fixtureId(8_000 + unitIndex * 1_000 + stepIndex * 20 + optionIndex),
            rewardIdentity: entry.rewardIdentity,
            rewardVersion: entry.rewardVersion,
            sourceContentId: entry.sourceContentId,
          })),
          position: stepIndex,
        })),
      })),
    },
  };
}

export function editorFixture(mode: EditorFixtureMode) {
  const request = mode === "errors" ? errorsRequest("standard")
    : mode === "limited" ? limitedRequest()
      : mode === "legacy" ? legacyRequest()
        : mode === "long" ? longRequest()
          : baseRequest();
  const initialPath = mode === "new" ? undefined : materialize(request, {
    archivedAt: mode === "archived" ? "2026-09-19T12:00:00.000Z" : null,
    editVersion: mode === "legacy" ? 7 : 1,
    number: mode === "legacy" ? 2 : 1,
    status: mode === "published" || mode === "archived" ? "published" : "draft",
  });
  return {
    actorUserId,
    canPublish: true,
    canReview: true,
    initialPath,
    initialResources: mode === "empty-catalog" ? [] : mode === "off-page" ? [editorFixtureResources[2]!] : editorFixtureResources,
    resourceNextCursor: mode === "off-page" ? "fixture-next" : null,
    resourceTopics: mode === "empty-catalog" ? [] : ["Anatomía"],
    routeTopics: editorFixtureTopics,
  };
}

function issue(code: string, path: string, context?: LearningPathValidationIssue["context"], severity: "error" | "warning" = "error"): LearningPathValidationIssue {
  return { code, context, message: "Mensaje técnico de fixture", path, severity };
}

function validateDetail(detail: LearningPathDetail) {
  const issues: LearningPathValidationIssue[] = [];
  if (detail.version.units.length === 0) issues.push(issue("unit_required", "version.units"));
  for (const [unitIndex, unit] of detail.version.units.entries()) {
    const unitContext = { unitId: unit.id, unitStableKey: unit.stableKey };
    if (unit.objectives.length === 0) issues.push(issue("objective_required", `version.units.${unitIndex}.objectives`, unitContext));
    if (!unit.steps.some((activity) => activity.isEssential)) issues.push(issue("essential_step_required", `version.units.${unitIndex}.steps`, unitContext));
    for (const [activityIndex, activity] of unit.steps.entries()) {
      const activityContext = { ...unitContext, stepId: activity.id, stepStableKey: activity.stableKey };
      if (activity.options.length === 0) issues.push(issue("option_required", `version.units.${unitIndex}.steps.${activityIndex}.options`, activityContext));
      if (activity.options.length > 0 && activity.options.filter((entry) => entry.isDefault).length !== 1) issues.push(issue("default_option_required", `version.units.${unitIndex}.steps.${activityIndex}.options`, activityContext));
    }
    for (const objective of unit.objectives) {
      const related = unit.steps.filter((activity) => activity.objectiveIds.includes(objective.id));
      const context = { ...unitContext, objectiveId: objective.id };
      if (!related.some((activity) => activity.purpose === "understand" || activity.purpose === "integrate")) issues.push(issue("objective_understanding_missing", `objective.${objective.id}`, context));
      const retrieval = related.filter((activity) => activity.purpose === "recall" || activity.purpose === "check" || activity.purpose === "diagnostic")
        .flatMap((activity) => activity.options).filter((entry) => entry.projection === "quiz" || entry.projection === "flashcards");
      if (retrieval.length === 0) {
        issues.push(issue("objective_retrieval_missing", `objective.${objective.id}`, context));
        continue;
      }
      const mapped = new Set(retrieval.flatMap((entry) => entry.config.objectiveMappings.filter((mapping) => mapping.objectiveIds.includes(objective.id)).map((mapping) => mapping.itemId)));
      if (mapped.size === 0) issues.push(issue("objective_mapping_missing", `objective.${objective.id}`, context));
      else if (mapped.size < 5) issues.push(issue(detail.version.evidenceLevel === "limited" ? "limited_evidence" : "insufficient_evidence", `objective.${objective.id}`, { ...context, actualCount: mapped.size, requiredCount: 5 }, detail.version.evidenceLevel === "limited" ? "warning" : "error"));
    }
  }
  return issues;
}

function materialDetail(sourceContentId: string, projection: LearningProjection, revisionId: string | null = null): LearningEditorMaterialDetail {
  const resource = editorFixtureResources.find((entry) => entry.id === sourceContentId);
  if (!resource) return { reason: "retired", sourceContentId, status: "unavailable", title: "Material vinculado" };
  const projectionInfo = resource.projections.find((entry) => entry.projection === projection);
  if (!projectionInfo) return { reason: "invalid_revision", sourceContentId, status: "unavailable", title: resource.title };
  return {
    currentSourceVersion: resource.version,
    estimatedMinutes: resource.estimatedMinutes && resource.estimatedMinutes > 0 ? resource.estimatedMinutes : null,
    explanationCoverage: projectionInfo.explanationCoverage,
    items: projectionInfo.itemIds.map((id, index) => ({ id, kind: projection === "flashcards" ? "flashcard" : "question", prompt: projection === "flashcards" ? `Tarjeta ${index + 1}: estructura anatómica` : `Pregunta ${index + 1}: identifica la estructura señalada` })),
    projection,
    resourceRevisionId: revisionId,
    sourceContentId,
    sourceVersion: resource.version,
    status: "ready",
    title: resource.title,
  };
}

export function isEditorFixtureEnabled(nodeEnv: string | undefined) {
  return nodeEnv === "development";
}

export type EditorFixtureRuntime = {
  getPath: () => LearningPathDetail | null;
  requests: string[];
  subscribe: (listener: () => void) => () => void;
  transport: EditorApi;
};

export function createEditorFixtureRuntime(mode: EditorFixtureMode, failure: EditorFixtureFailure = "none"): EditorFixtureRuntime {
  let stored = editorFixture(mode).initialPath ? structuredClone(editorFixture(mode).initialPath!) : null;
  let failureConsumed = false;
  const requests: string[] = [];
  const listeners = new Set<() => void>();
  const record = (entry: string) => { requests.push(entry); for (const listener of listeners) listener(); };
  const ok = <T,>(value: T, status = 200): EditorApiResult<T> => ({ ok: true, status, value });
  const fail = (status: EditorApiFailure["status"], errorCode: string): EditorApiFailure => ({ errorCode, ok: false, status });
  const maybeFail = (operation: "save" | "transition" | "validate") => {
    if (failureConsumed) return null;
    const match = operation === "save" && failure.startsWith("save-")
      || operation === "transition" && failure === "transition-503";
    if (!match) return null;
    failureConsumed = true;
    if (failure.endsWith("401")) return fail(401, "unauthorized");
    if (failure.endsWith("409")) return fail(409, "version_conflict");
    return fail(503, "fixture_unavailable");
  };
  const wait = async (signal?: AbortSignal) => {
    const duration = failure === "slow" ? 800 : 0;
    if (!duration) return;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, duration);
      signal?.addEventListener("abort", () => { clearTimeout(timer); reject(new DOMException("aborted", "AbortError")); }, { once: true });
    });
  };
  const currentOr404 = () => stored ? null : fail(404, "not_found");

  const transport: EditorApi = {
    async create(request) {
      record("create");
      await wait();
      const failed = maybeFail("save");
      if (failed) return failed;
      if (stored) return fail(409, "version_conflict");
      stored = materialize(request);
      return ok(structuredClone(stored), 201);
    },
    async createVersion(requestPathId, releaseNotes) {
      record("create-version");
      await wait();
      if (!stored || stored.id !== requestPathId) return fail(404, "not_found");
      if (stored.archivedAt || stored.version.status !== "published") return fail(409, "invalid_transition");
      stored = { ...structuredClone(stored), version: { ...structuredClone(stored.version), editVersion: 1, id: fixtureId(9_999), number: stored.version.number + 1, publishedAt: null, releaseNotes, status: "draft" } };
      return ok(structuredClone(stored), 201);
    },
    async deletePath(requestPathId, expectedVersion) {
      record(`delete:${expectedVersion}`);
      await wait();
      if (!stored || stored.id !== requestPathId) return fail(404, "not_found");
      if (expectedVersion !== stored.version.editVersion) return fail(409, "version_conflict");
      if (stored.version.status === "published") return fail(409, "conflict");
      const id = stored.id;
      stored = null;
      return ok({ id });
    },
    async currentDetail(sourceContentId, projection, signal) {
      record("current-detail");
      await wait(signal);
      return ok(materialDetail(sourceContentId, projection));
    },
    async fixedDetail(requestPathId, optionId, signal) {
      record("fixed-detail");
      await wait(signal);
      if (!stored || stored.id !== requestPathId) return fail(404, "not_found");
      const entry = stored.version.units.flatMap((unit) => unit.steps).flatMap((activity) => activity.options).find((candidate) => candidate.id === optionId);
      return entry ? ok(materialDetail(entry.sourceContentId, entry.projection, entry.resourceRevisionId)) : fail(404, "not_found");
    },
    async save(requestPathId, request) {
      record(`save:${request.expectedVersion}`);
      await wait();
      const failed = maybeFail("save");
      if (failed) return failed;
      const missing = currentOr404();
      if (missing) return missing;
      if (stored!.id !== requestPathId) return fail(404, "not_found");
      if (request.expectedVersion !== stored!.version.editVersion) return fail(409, "version_conflict");
      stored = materialize(request, { editVersion: stored!.version.editVersion + 1, number: stored!.version.number, status: stored!.version.status });
      return ok(structuredClone(stored));
    },
    async search(input = {}, signal) {
      record("search");
      await wait(signal);
      const source = mode === "empty-catalog" ? [] : editorFixtureResources;
      const q = input.q?.toLocaleLowerCase("es") ?? "";
      const items = source.filter((entry) => (!q || entry.title.toLocaleLowerCase("es").includes(q))
        && (!input.topic || entry.topic === input.topic)
        && (!input.projection || entry.projections.some((projection) => projection.projection === input.projection)));
      return ok({ items, nextCursor: null, resourceTopics: source.length ? ["Anatomía"] : [], topics: editorFixtureTopics });
    },
    async transition(requestPathId, expectedVersion, status) {
      record(`transition:${status}:${expectedVersion}`);
      await wait();
      const failed = maybeFail("transition");
      if (failed) return failed;
      if (!stored || stored.id !== requestPathId) return fail(404, "not_found");
      if (expectedVersion !== stored.version.editVersion) return fail(409, "version_conflict");
      if (["in_review", "approved", "published"].includes(status)) {
        const issues = validateDetail(stored);
        if (issues.some((entry) => entry.severity === "error")) return { errorCode: "not_ready", issues, ok: false, status: 422 };
      }
      stored = { ...stored, version: { ...stored.version, editVersion: stored.version.editVersion + 1, publishedAt: status === "published" ? new Date(0).toISOString() : stored.version.publishedAt, status } };
      return ok(structuredClone(stored));
    },
    async validate(requestPathId, expectedVersion) {
      record(`validate:${expectedVersion}`);
      await wait();
      const failed = maybeFail("validate");
      if (failed) return failed;
      if (!stored || stored.id !== requestPathId) return fail(404, "not_found");
      if (expectedVersion !== stored.version.editVersion) return fail(409, "version_conflict");
      const issues = validateDetail(stored);
      return ok({
        issues,
        ready: !issues.some((entry) => entry.severity === "error"),
        validatedEditVersion: failure === "validate-stale" ? expectedVersion + 1 : expectedVersion,
      });
    },
  };

  return {
    getPath: () => stored ? structuredClone(stored) : null,
    requests,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    transport,
  };
}
