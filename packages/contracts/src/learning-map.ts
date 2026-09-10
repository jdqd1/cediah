import { z } from "zod";
import type { GuidedLearningResult } from "./guided-learning.js";

const Id = z.string().uuid();
const StableKey = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/);
const Version = z.number().int().positive();
const Title = z.string().trim().min(1).max(80);
export const MapIconKeySchema = z.enum([
  "anatomy",
  "molecule",
  "heart",
  "tissue",
  "pill",
  "stethoscope",
  "head",
  "arm",
  "chest",
  "abdomen",
  "pelvis",
  "leg",
  "brain",
  "skin",
  "lungs",
  "vessel",
  "diaphragm",
  "kidney",
  "endocrine",
  "droplet",
  "folder",
]);
export const MapContentRefSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("block"), pathId: Id }),
  z.strictObject({
    kind: z.literal("lesson"),
    pathId: Id,
    unitStableKey: StableKey,
  }),
]);
export const MapRouteSchema = z
  .strictObject({
    nodeId: Id.nullable(),
    entryId: Id.nullable(),
    unitStableKey: StableKey.nullable(),
  })
  .refine(
    (r) => (!r.entryId || r.nodeId) && (!r.unitStableKey || r.entryId),
    "Invalid ancestry",
  );
export const MapQuerySchema = z
  .strictObject({
    node: Id.optional(),
    item: Id.optional(),
    unit: StableKey.optional(),
  })
  .refine(
    (r) => (!r.item || r.node) && (!r.unit || r.item),
    "Invalid ancestry",
  );
export const MapProgressSchema = z.strictObject({
  status: z.enum([
    "not_started",
    "in_progress",
    "completed",
    "empty",
    "unavailable",
  ]),
  percentage: z.number().int().min(0).max(100).nullable(),
  completedEssentialSteps: z.number().int().nonnegative().nullable(),
  totalEssentialSteps: z.number().int().nonnegative().nullable(),
  started: z.boolean(),
});
export const MapPositionSchema = z.strictObject({
  x: z.number().min(-100_000).max(100_000),
  y: z.number().min(-100_000).max(100_000),
});
export const MapLevelKeySchema = z
  .string()
  .regex(/^(root|(?:node|block):[0-9a-f-]{36})$/);
export const MapLayoutSchema = z.strictObject({
  schemaVersion: z.literal(1),
  levelKey: MapLevelKeySchema,
  rowVersion: z.number().int().nonnegative(),
  positions: z.record(z.string().min(1).max(160), MapPositionSchema),
});
export const MapItemSchema = z.strictObject({
  occurrenceId: z.string().min(1).max(160),
  canonicalKey: z.string(),
  kind: z.enum(["node", "block", "lesson"]),
  title: z.string(),
  iconKey: MapIconKeySchema,
  progress: MapProgressSchema,
  childCount: z.number().int().nonnegative(),
  childCountLabel: z.string(),
  availability: z.enum(["available", "retired", "version_missing"]),
  enrollmentState: z.enum(["none", "active", "paused", "archived"]),
  pathId: Id.nullable(),
  pathVersionId: Id.nullable(),
  unitStableKey: StableKey.nullable(),
});
export const MapRelationSchema = z.strictObject({
  sourceOccurrenceId: z.string(),
  targetOccurrenceId: z.string(),
  kind: z.enum(["sequence", "related", "prerequisite"]),
  provenance: z.string(),
  label: z.string(),
});
export const MapActivitySchema = z.strictObject({
  id: Id,
  stableKey: StableKey,
  title: z.string(),
  isEssential: z.boolean(),
  state: z.enum(["not_started", "in_progress", "completed", "skipped"]),
  options: z.array(
    z.strictObject({
      id: Id,
      label: z.string(),
      projection: z.enum(["video", "guide", "quiz", "flashcards"]),
      estimatedMinutes: z.number().nullable(),
      isDefault: z.boolean(),
      existingAttemptId: Id.nullable(),
    }),
  ),
});
export const MapLessonSchema = z.strictObject({
  pathId: Id,
  pathSlug: z.string(),
  pathVersionId: Id,
  unitStableKey: StableKey,
  title: z.string(),
  description: z.string(),
  enrollmentId: Id.nullable(),
  enrollmentState: z.enum(["none", "active", "paused", "archived"]),
  enrollmentVersion: Version.nullable(),
  progress: MapProgressSchema,
  activities: z.array(MapActivitySchema),
});
export const MapNextActivitySchema = z.strictObject({
  stepId: Id,
  optionId: Id,
  reason: z.string(),
});
export const LearningMapSummaryResponseSchema = z.strictObject({
  map: z.strictObject({ id: Id }).nullable(),
  nodes: z.array(MapItemSchema),
  progress: MapProgressSchema,
  structuralVersion: z.number().int().nonnegative(),
});
export const LearningMapLevelResponseSchema = z.strictObject({
  mapId: Id,
  structuralVersion: Version,
  route: MapRouteSchema,
  levelKey: MapLevelKeySchema,
  ancestry: z.array(
    z.strictObject({ title: z.string(), route: MapRouteSchema }),
  ),
  layout: MapLayoutSchema,
  items: z.array(MapItemSchema),
  edges: z.array(MapRelationSchema),
  selectedLesson: MapLessonSchema.nullable(),
  containerSummary: z.strictObject({
    title: z.string(),
    description: z.string(),
    progress: MapProgressSchema,
  }),
  nextActivity: MapNextActivitySchema.nullable(),
  generatedAt: z.string().datetime(),
  resolvedVersionIds: z.array(Id),
});
export const MapCatalogItemSchema = z.strictObject({
  key: z.string(),
  kind: z.enum(["topic_template", "block", "lesson"]),
  title: z.string(),
  topicId: Id,
  topicTitle: z.string(),
  ref: MapContentRefSchema.nullable(),
  reason: z.string().nullable(),
  membership: z.enum(["absent", "direct", "covered"]),
});
export const LearningMapCatalogResponseSchema = z.strictObject({
  items: z.array(MapCatalogItemSchema),
  nextCursor: z.string().nullable(),
});
export const LearningMapSuggestionsResponseSchema = z.strictObject({
  items: z.array(MapCatalogItemSchema).max(3),
  incompleteBlocks: z.array(
    z.strictObject({
      pathId: Id,
      title: z.string(),
      addedLessons: z.number().int(),
      totalLessons: z.number().int(),
    }),
  ),
});
export const MapCatalogQuerySchema = z
  .strictObject({
    node: Id.optional(),
    item: Id.optional(),
    unit: StableKey.optional(),
    q: z.string().trim().max(120).default(""),
    kind: z.enum(["all", "block", "lesson", "topic_template"]).default("all"),
    limit: z.coerce.number().int().min(1).max(50).default(24),
    cursor: z.string().max(1000).optional(),
  })
  .refine(
    (r) => (!r.item || r.node) && (!r.unit || r.item),
    "Invalid ancestry",
  );
export const MapSelectionSchema = z.union([
  z.strictObject({ rootNodeId: Id }),
  z.strictObject({ entryId: Id }),
  z.strictObject({ blockEntryId: Id, unitStableKey: StableKey }),
]);
export const MapEnsureRequestSchema = z.strictObject({});
export const MapNodeCreateRequestSchema = z
  .strictObject({
    expectedVersion: Version,
    title: Title,
    iconKey: MapIconKeySchema,
    items: z.array(MapContentRefSchema).max(200).optional(),
    topicTemplateId: Id.optional(),
  })
  .refine((v) => !(v.items && v.topicTemplateId), "Choose items or template");
export const MapNodeUpdateRequestSchema = z
  .strictObject({
    expectedVersion: Version,
    title: Title.optional(),
    iconKey: MapIconKeySchema.optional(),
  })
  .refine(
    (v) => v.title !== undefined || v.iconKey !== undefined,
    "No changes",
  );
export const MapEntryCreateRequestSchema = z.strictObject({
  expectedVersion: Version,
  nodeId: Id,
  ref: MapContentRefSchema,
});
export const MapGroupRequestSchema = z.strictObject({
  expectedVersion: Version,
  title: Title,
  iconKey: MapIconKeySchema,
  route: MapRouteSchema,
  selections: z.array(MapSelectionSchema).min(1).max(200),
});
export const MapCompleteBlockRequestSchema = z.strictObject({
  expectedVersion: Version,
  nodeId: Id,
  pathId: Id,
});
export const MapRemoveRequestSchema = z.strictObject({
  expectedVersion: Version,
  target: z.strictObject({ kind: z.enum(["node", "entry"]), id: Id }),
});
export const MapRestoreRequestSchema = z.strictObject({
  expectedVersion: Version,
  undoReceiptKey: z.string().min(1).max(200),
});
export const MapLayoutRequestSchema = z
  .strictObject({
    levelKey: MapLevelKeySchema,
    expectedVersion: z.number().int().nonnegative(),
    positions: z
      .array(MapPositionSchema.extend({ id: z.string().min(1).max(160) }))
      .min(1)
      .max(200),
  })
  .refine(
    (v) => new Set(v.positions.map((p) => p.id)).size === v.positions.length,
    "Duplicate positions",
  );
export const LearningMapMutationResponseSchema = z.strictObject({
  mapId: Id,
  structuralVersion: Version,
  affectedLevelKeys: z.array(MapLevelKeySchema),
  changedIds: z.array(z.string()),
  layoutVersion: z.number().int().nonnegative().optional(),
  undo: z
    .strictObject({
      undoReceiptKey: z.string(),
      expiresAt: z.string().datetime(),
    })
    .nullable(),
});
export const MapMutationSchemas = {
  ensure: MapEnsureRequestSchema,
  nodes: MapNodeCreateRequestSchema,
  updateNode: MapNodeUpdateRequestSchema,
  entries: MapEntryCreateRequestSchema,
  group: MapGroupRequestSchema,
  "complete-block": MapCompleteBlockRequestSchema,
  remove: MapRemoveRequestSchema,
  restore: MapRestoreRequestSchema,
  layout: MapLayoutRequestSchema,
};
export type MapIconKey = z.infer<typeof MapIconKeySchema>;
export type MapContentRef = z.infer<typeof MapContentRefSchema>;
export type MapRoute = z.infer<typeof MapRouteSchema>;
export type MapProgress = z.infer<typeof MapProgressSchema>;
export type MapItem = z.infer<typeof MapItemSchema>;
export type MapLayout = z.infer<typeof MapLayoutSchema>;
export type MapLesson = z.infer<typeof MapLessonSchema>;
export type MapCatalogItem = z.infer<typeof MapCatalogItemSchema>;
export type LearningMapLevelResponse = z.infer<
  typeof LearningMapLevelResponseSchema
>;
export type LearningMapSummaryResponse = z.infer<
  typeof LearningMapSummaryResponseSchema
>;
export type LearningMapCatalogResponse = z.infer<
  typeof LearningMapCatalogResponseSchema
>;
export type LearningMapSuggestionsResponse = z.infer<
  typeof LearningMapSuggestionsResponseSchema
>;
export type LearningMapMutationResponse = z.infer<
  typeof LearningMapMutationResponseSchema
>;
export type MapCatalogQuery = z.infer<typeof MapCatalogQuerySchema>;
export type MapMutation = {
  [K in keyof typeof MapMutationSchemas]: {
    operation: K;
    request: z.infer<(typeof MapMutationSchemas)[K]>;
  };
}[keyof typeof MapMutationSchemas];
export interface LearningMapProvider {
  summary(userId: string): Promise<LearningMapSummaryResponse>;
  level(
    userId: string,
    route: MapRoute,
  ): Promise<LearningMapLevelResponse | null>;
  catalog(
    userId: string,
    query: MapCatalogQuery,
  ): Promise<LearningMapCatalogResponse | null>;
  suggestions(
    userId: string,
    route: MapRoute,
  ): Promise<LearningMapSuggestionsResponse | null>;
  mutate(
    input: MapMutation & {
      userId: string;
      idempotencyKey: string;
      nodeId?: string;
    },
  ): Promise<GuidedLearningResult<LearningMapMutationResponse>>;
}
