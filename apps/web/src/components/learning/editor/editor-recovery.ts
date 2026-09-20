import { z } from "zod";
import {
  LearningCompletionRuleSchema,
  LearningCoverKeySchema,
  LearningOptionConfigSchema,
  LearningProjectionSchema,
  LearningStepPurposeSchema,
} from "@cediah/contracts";
import type { EditorDraft, RouteEditorState } from "./editor-model";

export const EDITOR_RECOVERY_TTL_MS = 24 * 60 * 60 * 1_000;

const RecoveryObjectiveSchema = z.strictObject({
  id: z.string().uuid(),
  importance: z.number().int().min(1).max(3),
  title: z.string().max(240),
});

const RecoveryOptionSchema = z.strictObject({
  completionRule: LearningCompletionRuleSchema.optional(),
  config: LearningOptionConfigSchema,
  estimatedMinutes: z.number().int().min(1).max(600).nullable(),
  expectedSourceVersion: z.number().int().positive().optional(),
  id: z.string().uuid(),
  isDefault: z.boolean(),
  label: z.string().max(120),
  projection: LearningProjectionSchema,
  refreshResource: z.boolean().optional(),
  rewardIdentity: z.string().uuid(),
  rewardVersion: z.number().int().min(1).max(1_000_000),
  sourceContentId: z.string().uuid(),
});

const RecoveryActivitySchema = z.strictObject({
  id: z.string().uuid(),
  isEssential: z.boolean(),
  objectiveIds: z.array(z.string().uuid()).max(20),
  options: z.array(RecoveryOptionSchema).max(12),
  pedagogyVersion: z.number().int().min(1).max(1_000_000),
  purpose: LearningStepPurposeSchema,
  recommendedAfter: z.array(z.string().trim().min(1).max(120)).max(20),
  stableKey: z.string().trim().min(1).max(120),
  title: z.string().max(240),
});

const RecoveryUnitSchema = z.strictObject({
  id: z.string().uuid(),
  objectives: z.array(RecoveryObjectiveSchema).max(30),
  pedagogyVersion: z.number().int().min(1).max(1_000_000),
  stableKey: z.string().trim().min(1).max(120),
  steps: z.array(RecoveryActivitySchema).max(60),
  title: z.string().max(240),
});

export const EditorRecoverySchema = z.strictObject({
  baseEditVersion: z.number().int().positive().nullable(),
  creationId: z.string().uuid(),
  draft: z.strictObject({
    coverKey: LearningCoverKeySchema,
    definition: z.strictObject({
      evidenceLevel: z.enum(["standard", "limited"]),
      policyVersion: z.string().trim().min(1).max(80),
      releaseNotes: z.string().max(4_000),
      units: z.array(RecoveryUnitSchema).max(30),
    }),
    slug: z.string().max(200),
    summary: z.string().max(2_000),
    title: z.string().max(200),
    topicContentId: z.union([z.literal(""), z.string().uuid()]),
  }),
  localRevision: z.number().int().nonnegative(),
  savedAt: z.number().int().nonnegative(),
  slug: z.string().max(200),
});

export type EditorRecovery = z.infer<typeof EditorRecoverySchema>;

export function editorRecoveryKey(actorUserId: string, pathId?: string | null) {
  return `cediah:route-editor:v1:${actorUserId}:${pathId ?? "new"}`;
}

export function createEditorRecovery(state: RouteEditorState, savedAt = Date.now()): EditorRecovery {
  return {
    baseEditVersion: state.savedPath?.version.editVersion ?? null,
    creationId: state.creationId,
    draft: structuredClone(state.draft),
    localRevision: state.localRevision,
    savedAt,
    slug: state.frozenSlug ?? state.draft.slug,
  };
}

export type RecoveryParseResult =
  | { recovery: EditorRecovery; status: "available" }
  | { status: "expired" | "invalid" | "missing" };

export function parseEditorRecovery(raw: string | null, now = Date.now()): RecoveryParseResult {
  if (!raw) return { status: "missing" };
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { status: "invalid" };
  }
  const parsed = EditorRecoverySchema.safeParse(value);
  if (!parsed.success) return { status: "invalid" };
  if (now - parsed.data.savedAt >= EDITOR_RECOVERY_TTL_MS || parsed.data.savedAt > now + 60_000) {
    return { status: "expired" };
  }
  return { recovery: parsed.data, status: "available" };
}

export function recoveryMatchesBase(recovery: EditorRecovery, currentEditVersion: number | null) {
  return recovery.baseEditVersion === currentEditVersion;
}

export function applyEditorRecovery(state: RouteEditorState, recovery: EditorRecovery): RouteEditorState {
  return {
    ...state,
    creationId: recovery.creationId,
    dirty: true,
    draft: structuredClone(recovery.draft) as EditorDraft,
    frozenSlug: recovery.slug || null,
    localRevision: Math.max(state.localRevision + 1, recovery.localRevision),
    operation: "idle",
    validation: null,
  };
}

export function serializeEditorRecovery(recovery: EditorRecovery) {
  return JSON.stringify(recovery, null, 2);
}
