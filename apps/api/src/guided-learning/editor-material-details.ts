import { z } from "zod";
import {
  LearningEditorMaterialDetailSchema,
  LearningProjectionSchema,
  type GuidedLearningResult,
  type LearningEditorMaterialDetail,
  type LearningProjection,
} from "@cediah/contracts";
import type { DatabaseClient } from "../db/database.js";
import { getLearningAdapter } from "./adapters/registry.js";
import type { LearningRevisionSnapshot, LearningSnapshotItem } from "./adapters/types.js";
import { readCanonicalPublishedLearningContent } from "./content-resolver.js";
import { hashLearningSnapshot } from "./snapshot-hash.js";

const LearningRevisionSnapshotSchema = z.strictObject({
  content: z.unknown(),
  projection: LearningProjectionSchema,
  sourceContentId: z.string().uuid(),
  sourceVersion: z.number().int().positive(),
  title: z.string().trim().min(1).max(240),
});

function questionCoverage(content: unknown) {
  const questions = content && typeof content === "object" && "questions" in content
    ? (content as { questions?: unknown }).questions
    : undefined;
  if (!Array.isArray(questions) || questions.length === 0) return "missing" as const;
  const explained = questions.filter((question) => (
    question && typeof question === "object" && "explanation" in question
    && typeof (question as { explanation?: unknown }).explanation === "string"
    && (question as { explanation: string }).explanation.trim().length > 0
  )).length;
  return explained === questions.length ? "complete" as const
    : explained === 0 ? "missing" as const : "partial" as const;
}

function flashcardCoverage(content: unknown, items: LearningSnapshotItem[]) {
  if (items.every((item) => item.kind === "flashcard")) return "not_applicable" as const;
  const cards = content && typeof content === "object" && "cards" in content
    ? (content as { cards?: unknown }).cards
    : undefined;
  if (!Array.isArray(cards) || cards.length === 0) return "missing" as const;
  const explained = cards.filter((card) => (
    card && typeof card === "object" && "back" in card
    && typeof (card as { back?: unknown }).back === "string"
    && (card as { back: string }).back.includes("\n\n")
  )).length;
  return explained === cards.length ? "complete" as const
    : explained === 0 ? "missing" as const : "partial" as const;
}

function explanationCoverage(snapshot: LearningRevisionSnapshot, items: LearningSnapshotItem[]) {
  if (snapshot.projection === "quiz") return questionCoverage(snapshot.content);
  if (snapshot.projection === "flashcards") return flashcardCoverage(snapshot.content, items);
  return "not_applicable" as const;
}

function itemPrompts(snapshot: LearningRevisionSnapshot, items: LearningSnapshotItem[]) {
  const values = snapshot.content && typeof snapshot.content === "object"
    ? snapshot.projection === "quiz" && "questions" in snapshot.content
      ? (snapshot.content as { questions?: unknown }).questions
      : snapshot.projection === "flashcards" && "cards" in snapshot.content
        ? (snapshot.content as { cards?: unknown }).cards
        : undefined
    : undefined;
  if (!Array.isArray(values)) return [];
  const prompts = new Map(values.flatMap((value) => {
    if (!value || typeof value !== "object" || !("id" in value)) return [];
    const id = (value as { id?: unknown }).id;
    const prompt = "prompt" in value
      ? (value as { prompt?: unknown }).prompt
      : "front" in value ? (value as { front?: unknown }).front : undefined;
    return typeof id === "string" && typeof prompt === "string" ? [[id, prompt] as const] : [];
  }));
  return items.flatMap((item) => {
    const prompt = prompts.get(item.id);
    return prompt ? [{ id: item.id, kind: item.kind, prompt }] : [];
  });
}

function readyDetail(input: {
  currentSourceVersion: number | null;
  estimatedMinutes: number | null;
  items: LearningSnapshotItem[];
  resourceRevisionId: string | null;
  snapshot: LearningRevisionSnapshot;
}): LearningEditorMaterialDetail | null {
  const parsed = LearningEditorMaterialDetailSchema.safeParse({
    currentSourceVersion: input.currentSourceVersion,
    estimatedMinutes: input.estimatedMinutes,
    explanationCoverage: explanationCoverage(input.snapshot, input.items),
    items: itemPrompts(input.snapshot, input.items),
    projection: input.snapshot.projection,
    resourceRevisionId: input.resourceRevisionId,
    sourceContentId: input.snapshot.sourceContentId,
    sourceVersion: input.snapshot.sourceVersion,
    status: "ready",
    title: input.snapshot.title,
  });
  return parsed.success ? parsed.data : null;
}

export async function readCurrentEditorMaterialDetail(
  database: DatabaseClient,
  input: { contentId: string; projection: LearningProjection },
): Promise<GuidedLearningResult<LearningEditorMaterialDetail>> {
  const canonical = await readCanonicalPublishedLearningContent(database, {
    allowGuidedOnly: true,
    projection: input.projection,
    sourceContentId: input.contentId,
  });
  if (canonical.status === "not_found") return { status: "not_found" };
  if (canonical.status !== "success") return { status: "resource_changed" };
  const detail = readyDetail({
    currentSourceVersion: canonical.value.sourceVersion,
    estimatedMinutes: canonical.value.estimatedMinutes,
    items: canonical.value.items,
    resourceRevisionId: null,
    snapshot: canonical.value.payload,
  });
  return detail ? { status: "success", value: detail } : { status: "resource_changed" };
}

function unavailable(input: {
  reason: "retired" | "not_published" | "invalid_revision";
  sourceContentId: string;
  title?: string;
}): LearningEditorMaterialDetail {
  return LearningEditorMaterialDetailSchema.parse({
    reason: input.reason,
    sourceContentId: input.sourceContentId,
    status: "unavailable",
    title: input.title ?? "Material vinculado",
  });
}

export async function readFixedEditorMaterialDetail(
  database: DatabaseClient,
  input: { optionId: string; pathVersionId: string },
): Promise<LearningEditorMaterialDetail | null> {
  const option = await database.selectFrom("learning_step_options")
    .select(["estimated_minutes", "projection", "resource_revision_id", "source_content_id"])
    .where("id", "=", input.optionId)
    .where("path_version_id", "=", input.pathVersionId)
    .executeTakeFirst();
  if (!option) return null;
  const revision = await database.selectFrom("learning_resource_revisions")
    .innerJoin("learning_resources", "learning_resources.id", "learning_resource_revisions.resource_id")
    .select([
      "learning_resource_revisions.payload_hash",
      "learning_resource_revisions.payload_json",
      "learning_resources.projection",
      "learning_resources.retired_at",
      "learning_resources.source_content_id",
    ])
    .where("learning_resource_revisions.id", "=", option.resource_revision_id)
    .executeTakeFirst();
  if (!revision) {
    return unavailable({ reason: "invalid_revision", sourceContentId: option.source_content_id });
  }
  if (hashLearningSnapshot(revision.payload_json) !== revision.payload_hash) {
    return unavailable({ reason: "invalid_revision", sourceContentId: option.source_content_id });
  }
  const snapshotResult = LearningRevisionSnapshotSchema.safeParse(revision.payload_json);
  if (!snapshotResult.success) {
    return unavailable({ reason: "invalid_revision", sourceContentId: option.source_content_id });
  }
  const snapshot = snapshotResult.data;
  if (
    snapshot.projection !== option.projection
    || revision.projection !== option.projection
    || snapshot.sourceContentId !== option.source_content_id
    || revision.source_content_id !== option.source_content_id
  ) {
    return unavailable({ reason: "invalid_revision", sourceContentId: option.source_content_id });
  }
  if (revision.retired_at) {
    return unavailable({ reason: "retired", sourceContentId: snapshot.sourceContentId, title: snapshot.title });
  }
  const source = await database.selectFrom("content_items")
    .select(["status", "version"])
    .where("id", "=", snapshot.sourceContentId)
    .executeTakeFirst();
  if (!source || source.status !== "published") {
    return unavailable({ reason: "not_published", sourceContentId: snapshot.sourceContentId, title: snapshot.title });
  }
  const adapter = getLearningAdapter(snapshot.projection);
  let parsed: unknown;
  try {
    parsed = adapter.parse(snapshot.content);
  } catch {
    return unavailable({ reason: "invalid_revision", sourceContentId: snapshot.sourceContentId });
  }
  const normalizedSnapshot = { ...snapshot, content: parsed };
  return readyDetail({
    currentSourceVersion: source.version,
    estimatedMinutes: option.estimated_minutes,
    items: adapter.items(parsed),
    resourceRevisionId: option.resource_revision_id,
    snapshot: normalizedSnapshot,
  }) ?? unavailable({ reason: "invalid_revision", sourceContentId: snapshot.sourceContentId });
}
