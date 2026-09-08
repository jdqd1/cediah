import { z } from "zod";
import {
  LearningAttemptManifestSchema,
  LearningAttemptResumeSchema,
  LearningCompletionRuleSchema,
  LearningOptionConfigSchema,
  LearningProjectionSchema,
  type LearningAttemptManifest,
  type LearningAttemptResume,
  type LearningCompletionRule,
  type LearningOptionConfig,
  type LearningProjection,
} from "@cediah/contracts";
import { flashcardAdapter, type ExecutableCard } from "./adapters/flashcards.js";
import { guideAdapter } from "./adapters/guide.js";
import { quizAdapter, type ExecutableQuestion } from "./adapters/quiz.js";
import { videoAdapter } from "./adapters/video.js";

const StoredRouteAttemptManifestSchema = z.strictObject({
  completionRule: LearningCompletionRuleSchema,
  config: LearningOptionConfigSchema,
  content: z.unknown(),
  payloadHash: z.string().regex(/^[0-9a-f]{64}$/),
  projection: LearningProjectionSchema,
  resourceRevisionId: z.string().uuid(),
  schemaVersion: z.literal(1),
  sourceContentId: z.string().uuid(),
  title: z.string().trim().min(1).max(500),
});

const StoredReviewItemSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    content: z.unknown(),
    evidenceEnrollmentIds: z.array(z.string().uuid()).max(50),
    kind: z.literal("quiz"),
    objectiveIds: z.array(z.string().uuid()).max(20),
    payloadHash: z.string().regex(/^[0-9a-f]{64}$/),
    resourceRevisionId: z.string().uuid(),
    reviewStateVersion: z.number().int().positive(),
    sourceContentId: z.string().uuid(),
  }),
  z.strictObject({
    content: z.unknown(),
    evidenceEnrollmentIds: z.array(z.string().uuid()).max(50),
    kind: z.literal("flashcards"),
    objectiveIds: z.array(z.string().uuid()).max(20),
    payloadHash: z.string().regex(/^[0-9a-f]{64}$/),
    resourceRevisionId: z.string().uuid(),
    reviewStateVersion: z.number().int().positive(),
    sourceContentId: z.string().uuid(),
  }),
]);

const StoredReviewAttemptManifestSchema = z.strictObject({
  items: z.array(StoredReviewItemSchema).min(1).max(10),
  projection: z.literal("review"),
  schemaVersion: z.literal(1),
  title: z.string().trim().min(1).max(500),
});

const StoredAttemptManifestSchema = z.discriminatedUnion("projection", [
  StoredRouteAttemptManifestSchema.extend({ projection: z.literal("video") }),
  StoredRouteAttemptManifestSchema.extend({ projection: z.literal("guide") }),
  StoredRouteAttemptManifestSchema.extend({ projection: z.literal("quiz") }),
  StoredRouteAttemptManifestSchema.extend({ projection: z.literal("flashcards") }),
  StoredReviewAttemptManifestSchema,
]);

export type StoredAttemptManifest = z.infer<typeof StoredAttemptManifestSchema>;
export type StoredRouteAttemptManifest = z.infer<typeof StoredRouteAttemptManifestSchema>;
export type StoredReviewItem = z.infer<typeof StoredReviewItemSchema>;

function selectedIds(config: LearningOptionConfig, allIds: string[]) {
  if (config.selectedItemIds.length === 0) return new Set(allIds);
  return new Set(config.selectedItemIds);
}

export function createStoredAttemptManifest(input: {
  completionRule: LearningCompletionRule;
  config: LearningOptionConfig;
  content: unknown;
  payloadHash: string;
  projection: LearningProjection;
  resourceRevisionId: string;
  sourceContentId: string;
  title: string;
}): StoredRouteAttemptManifest {
  let content: unknown;
  if (input.projection === "quiz") {
    const parsed = quizAdapter.parse(input.content);
    const selected = selectedIds(input.config, parsed.questions.map((question) => question.id));
    content = { questions: parsed.questions.filter((question) => selected.has(question.id)) };
  } else if (input.projection === "flashcards") {
    const parsed = flashcardAdapter.parse(input.content);
    const selected = selectedIds(input.config, parsed.cards.map((card) => card.id));
    content = { cards: parsed.cards.filter((card) => selected.has(card.id)) };
  } else if (input.projection === "guide") {
    content = guideAdapter.parse(input.content);
  } else {
    content = videoAdapter.parse(input.content);
  }
  return StoredRouteAttemptManifestSchema.parse({ ...input, content, schemaVersion: 1 });
}

export function createStoredReviewAttemptManifest(items: StoredReviewItem[]): StoredAttemptManifest {
  return StoredAttemptManifestSchema.parse({
    items,
    projection: "review",
    schemaVersion: 1,
    title: "Repaso recomendado",
  });
}

export function parseStoredAttemptManifest(value: unknown) {
  return StoredAttemptManifestSchema.parse(value);
}

function objectiveMap(config: LearningOptionConfig) {
  return new Map(config.objectiveMappings.map((mapping) => [mapping.itemId, mapping.objectiveIds]));
}

export function toPublicAttemptManifest(value: StoredAttemptManifest): LearningAttemptManifest {
  if (value.projection === "review") {
    return LearningAttemptManifestSchema.parse({
      items: value.items.map((entry) => {
        if (entry.kind === "quiz") {
          const question = quizAdapter.parse({ questions: [entry.content] }).questions[0]!;
          return {
            itemId: question.id,
            kind: "quiz",
            memoryVersion: question.memoryVersion ?? 1,
            objectiveIds: entry.objectiveIds,
            options: question.options.map((text, index) => ({ id: question.optionIds[index], text })),
            prompt: question.prompt,
            resourceRevisionId: entry.resourceRevisionId,
            reviewStateVersion: entry.reviewStateVersion,
            sourceContentId: entry.sourceContentId,
          };
        }
        const card = flashcardAdapter.parse({ cards: [entry.content] }).cards[0]!;
        return {
          front: card.front,
          itemId: card.id,
          kind: "flashcards",
          memoryVersion: card.memoryVersion ?? 1,
          objectiveIds: entry.objectiveIds,
          resourceRevisionId: entry.resourceRevisionId,
          reviewStateVersion: entry.reviewStateVersion,
          sourceContentId: entry.sourceContentId,
        };
      }),
      projection: "review",
      title: value.title,
    });
  }
  const objectives = objectiveMap(value.config);
  const base = {
    completionRule: value.completionRule,
    resourceRevisionId: value.resourceRevisionId,
    sourceContentId: value.sourceContentId,
    title: value.title,
  };
  if (value.projection === "quiz") {
    const payload = quizAdapter.parse(value.content);
    return LearningAttemptManifestSchema.parse({
      ...base,
      projection: "quiz",
      questions: payload.questions.map((question) => ({
        itemId: question.id,
        memoryVersion: question.memoryVersion ?? 1,
        objectiveIds: objectives.get(question.id) ?? [],
        options: question.options.map((text, index) => ({ id: question.optionIds[index], text })),
        prompt: question.prompt,
      })),
    });
  }
  if (value.projection === "flashcards") {
    const payload = flashcardAdapter.parse(value.content);
    return LearningAttemptManifestSchema.parse({
      ...base,
      cards: payload.cards.map((card) => ({
        front: card.front,
        itemId: card.id,
        memoryVersion: card.memoryVersion ?? 1,
        objectiveIds: objectives.get(card.id) ?? [],
      })),
      projection: "flashcards",
    });
  }
  if (value.projection === "guide") {
    const payload = guideAdapter.parse(value.content);
    const indexes = value.config.guideSectionIndexes ?? [];
    return LearningAttemptManifestSchema.parse({
      ...base,
      document: payload.document,
      projection: "guide",
      sections: indexes.length > 0
        ? payload.sections.filter((_, index) => indexes.includes(index))
        : payload.sections,
      selectedSectionIndexes: indexes,
    });
  }
  const payload = videoAdapter.parse(value.content);
  return LearningAttemptManifestSchema.parse({
    ...base,
    durationSeconds: payload.durationSeconds,
    externalUrl: payload.externalUrl,
    projection: "video",
    range: value.config.videoRange ?? null,
  });
}

export function initialAttemptResume(): LearningAttemptResume {
  return LearningAttemptResumeSchema.parse({
    answeredItemIds: [],
    currentIndex: 0,
    guidePosition: null,
    observedRanges: [],
    ratedItemIds: [],
    revealedItemIds: [],
    videoDurationSeconds: null,
    videoPositionSeconds: null,
  });
}

export function manifestItemIds(manifest: StoredAttemptManifest) {
  if (manifest.projection === "review") {
    return manifest.items.map((entry) => entry.kind === "quiz"
      ? quizAdapter.parse({ questions: [entry.content] }).questions[0]!.id
      : flashcardAdapter.parse({ cards: [entry.content] }).cards[0]!.id);
  }
  if (manifest.projection === "quiz") {
    return quizAdapter.parse(manifest.content).questions.map((question) => question.id);
  }
  if (manifest.projection === "flashcards") {
    return flashcardAdapter.parse(manifest.content).cards.map((card) => card.id);
  }
  return [];
}

export function manifestQuestion(
  manifest: StoredAttemptManifest,
  itemId: string,
): ExecutableQuestion | null {
  if (manifest.projection === "review") {
    const entry = manifest.items.find((item) => item.kind === "quiz" &&
      quizAdapter.parse({ questions: [item.content] }).questions[0]?.id === itemId);
    return entry ? quizAdapter.parse({ questions: [entry.content] }).questions[0] ?? null : null;
  }
  if (manifest.projection !== "quiz") return null;
  return quizAdapter.parse(manifest.content).questions.find((question) => question.id === itemId) ?? null;
}

export function manifestCard(
  manifest: StoredAttemptManifest,
  itemId: string,
): ExecutableCard | null {
  if (manifest.projection === "review") {
    const entry = manifest.items.find((item) => item.kind === "flashcards" &&
      flashcardAdapter.parse({ cards: [item.content] }).cards[0]?.id === itemId);
    return entry ? flashcardAdapter.parse({ cards: [entry.content] }).cards[0] ?? null : null;
  }
  if (manifest.projection !== "flashcards") return null;
  return flashcardAdapter.parse(manifest.content).cards.find((card) => card.id === itemId) ?? null;
}

export function manifestReviewItem(manifest: StoredAttemptManifest, itemId: string) {
  if (manifest.projection !== "review") return null;
  return manifest.items.find((entry) => entry.kind === "quiz"
    ? quizAdapter.parse({ questions: [entry.content] }).questions[0]?.id === itemId
    : flashcardAdapter.parse({ cards: [entry.content] }).cards[0]?.id === itemId) ?? null;
}
