import { z } from "zod";

export const CatalogVisibilitySchema = z.enum(["catalog", "guided_only"]);
export type CatalogVisibility = z.infer<typeof CatalogVisibilitySchema>;

export const LearningProjectionSchema = z.enum(["video", "guide", "quiz", "flashcards"]);
export type LearningProjection = z.infer<typeof LearningProjectionSchema>;

export const LearningResourceRefSchema = z.object({
  projection: LearningProjectionSchema,
  resourceRevisionId: z.string().uuid(),
});

export const PublicLearningQuestionSchema = z.object({
  itemId: z.string().uuid(),
  options: z.array(z.object({ id: z.string().uuid(), text: z.string() })).min(2).max(8),
  prompt: z.string(),
});

export type LearningResourceRef = z.infer<typeof LearningResourceRefSchema>;
export type PublicLearningQuestion = z.infer<typeof PublicLearningQuestionSchema>;

const LearningItemIdentityShape = {
  id: z.string().uuid().optional(),
  memoryVersion: z.number().int().min(1).max(1_000_000).optional(),
};

function validateQuestionIdentity(
  question: {
    correctOptionIndex: number;
    optionIds?: string[];
    options: string[];
  },
  context: z.RefinementCtx,
) {
  if (question.correctOptionIndex >= question.options.length) {
    context.addIssue({
      code: "custom",
      message: "correctOptionIndex must reference an existing option",
      path: ["correctOptionIndex"],
    });
  }
  if (question.optionIds && question.optionIds.length !== question.options.length) {
    context.addIssue({
      code: "custom",
      message: "optionIds must contain one stable ID for every option",
      path: ["optionIds"],
    });
  }
  if (question.optionIds && new Set(question.optionIds).size !== question.optionIds.length) {
    context.addIssue({
      code: "custom",
      message: "optionIds must not contain duplicate IDs",
      path: ["optionIds"],
    });
  }
}

const QuestionIdentityShape = {
  ...LearningItemIdentityShape,
  optionIds: z.array(z.string().uuid()).min(2).max(8).optional(),
};

export const QuizQuestionSchema = z
  .object({
    ...QuestionIdentityShape,
    correctOptionIndex: z.number().int().min(0),
    explanation: z.string().trim().max(4_000).default(""),
    options: z.array(z.string().trim().min(1).max(500)).min(2).max(8),
    prompt: z.string().trim().min(1).max(2_000),
  })
  .superRefine(validateQuestionIdentity);

export const GuideQuizQuestionSchema = z
  .object({
    ...QuestionIdentityShape,
    correctOptionIndex: z.number().int().min(0),
    explanation: z.string().trim().max(4_000).default(""),
    options: z.array(z.string().trim().max(500)).min(2).max(8),
    prompt: z.string().trim().max(2_000),
  })
  .superRefine(validateQuestionIdentity);

export const FlashcardSchema = z.object({
  ...LearningItemIdentityShape,
  back: z.string().trim().min(1).max(4_000),
  front: z.string().trim().min(1).max(2_000),
});

export const DraftFlashcardSchema = z.object({
  ...LearningItemIdentityShape,
  back: z.string().trim().max(4_000),
  front: z.string().trim().max(2_000),
});

type QuestionRecord = {
  correctOptionIndex: number;
  id?: string;
  memoryVersion?: number;
  optionIds?: string[];
  options: string[];
  prompt: string;
  [key: string]: unknown;
};

type CardRecord = {
  back?: string;
  front?: string;
  id?: string;
  memoryVersion?: number;
  [key: string]: unknown;
};

type LearningContentRecord = {
  content: Record<string, unknown>;
  kind: "video" | "guide" | "quiz" | "flashcards" | "topic";
};

export type LearningIdentityNormalization<T> = {
  changed: boolean;
  value: T;
};

export type LearningIdentityReconciliation<T> =
  | { changed: boolean; status: "success"; value: T }
  | { status: "unsafe_identity" };

export function ensureQuestionIdentity<T extends QuestionRecord>(
  question: T,
  createId: () => string,
): LearningIdentityNormalization<T> {
  const optionIds = question.optionIds ?? question.options.map(() => createId());
  const id = question.id ?? createId();
  const memoryVersion = question.memoryVersion ?? 1;
  const changed =
    id !== question.id ||
    memoryVersion !== question.memoryVersion ||
    question.optionIds === undefined;
  return {
    changed,
    value: {
      ...question,
      id,
      memoryVersion,
      optionIds,
    },
  };
}

export function ensureFlashcardIdentity<T extends CardRecord>(
  card: T,
  createId: () => string,
): LearningIdentityNormalization<T> {
  const id = card.id ?? createId();
  const memoryVersion = card.memoryVersion ?? 1;
  return {
    changed: id !== card.id || memoryVersion !== card.memoryVersion,
    value: { ...card, id, memoryVersion },
  };
}

/**
 * Add missing durable identities without changing text, ordering or answers.
 * The caller supplies the UUID factory so this module stays portable between
 * browser editors, Node.js providers and deterministic tests.
 */
export function normalizeContentLearningIdentity<
  T extends LearningContentRecord,
>(draft: T, createId: () => string): LearningIdentityNormalization<T> {
  if (draft.kind === "topic") return { changed: false, value: draft };
  const value = structuredClone(draft);
  let changed = false;

  if (value.kind === "flashcards") {
    const cards = Array.isArray(value.content.cards) ? value.content.cards : [];
    value.content.cards = cards.map((entry) => {
      const normalized = ensureFlashcardIdentity(entry as CardRecord, createId);
      changed ||= normalized.changed;
      return normalized.value;
    });
    return { changed, value };
  }

  const questionContainer = value.kind === "quiz"
    ? value.content
    : (value.content.quiz as Record<string, unknown> | undefined);
  const questions = Array.isArray(questionContainer?.questions)
    ? questionContainer.questions
    : [];
  const normalizedQuestions = questions.map((entry) => {
    const normalized = ensureQuestionIdentity(entry as QuestionRecord, createId);
    changed ||= normalized.changed;
    return normalized.value;
  });
  if (questionContainer) questionContainer.questions = normalizedQuestions;
  return { changed, value };
}

function questionRecords(value: LearningContentRecord): QuestionRecord[] {
  if (value.kind === "flashcards" || value.kind === "topic") return [];
  const container = value.kind === "quiz"
    ? value.content
    : (value.content.quiz as Record<string, unknown> | undefined);
  return Array.isArray(container?.questions)
    ? container.questions as QuestionRecord[]
    : [];
}

function cardRecords(value: LearningContentRecord): CardRecord[] {
  return value.kind === "flashcards" && Array.isArray(value.content.cards)
    ? value.content.cards as CardRecord[]
    : [];
}

function completeQuestionIdentity(question: QuestionRecord) {
  return Boolean(
    question.id &&
    question.memoryVersion &&
    question.optionIds &&
    question.optionIds.length === question.options.length,
  );
}

function hasUniqueIdentities(value: LearningContentRecord) {
  const items = [...questionRecords(value), ...cardRecords(value)];
  const itemIds = items.map((item) => item.id);
  if (itemIds.some((id) => !id) || new Set(itemIds).size !== itemIds.length) return false;
  const optionIds = questionRecords(value).flatMap((question) => question.optionIds ?? []);
  return new Set(optionIds).size === optionIds.length;
}

function questionMemoryChanged(previous: QuestionRecord, next: QuestionRecord) {
  const previousOptionIds = previous.optionIds ?? [];
  const nextOptionIds = next.optionIds ?? [];
  const previousOptions = previousOptionIds
    .map((id, index) => [id, previous.options[index] ?? ""] as const)
    .sort(([left], [right]) => left.localeCompare(right));
  const nextOptions = nextOptionIds
    .map((id, index) => [id, next.options[index] ?? ""] as const)
    .sort(([left], [right]) => left.localeCompare(right));
  return previous.prompt !== next.prompt ||
    previousOptionIds[previous.correctOptionIndex] !== nextOptionIds[next.correctOptionIndex] ||
    JSON.stringify(previousOptions) !== JSON.stringify(nextOptions);
}

/**
 * Reconciles an editorial update against the stored identities. Existing IDs
 * are mandatory, reordering is cosmetic, and a substantive prompt/answer/card
 * change advances memoryVersion under server control.
 */
export function reconcileContentLearningIdentity<T extends LearningContentRecord>(
  current: LearningContentRecord,
  draft: T,
): LearningIdentityReconciliation<T> {
  if (draft.kind === "topic") return { changed: false, status: "success", value: draft };
  const incomingQuestions = questionRecords(draft);
  if (incomingQuestions.some((question) => !completeQuestionIdentity(question))) {
    return { status: "unsafe_identity" };
  }
  if (cardRecords(draft).some((card) => !card.id || !card.memoryVersion)) {
    return { status: "unsafe_identity" };
  }
  if (!hasUniqueIdentities(draft)) return { status: "unsafe_identity" };

  const value = structuredClone(draft);
  let changed = false;
  const previousQuestions = new Map(questionRecords(current).map((question) => [question.id, question]));
  for (const question of questionRecords(value)) {
    const previous = previousQuestions.get(question.id);
    const memoryVersion = previous
      ? (previous.memoryVersion ?? 1) + Number(questionMemoryChanged(previous, question))
      : 1;
    if (question.memoryVersion !== memoryVersion) changed = true;
    question.memoryVersion = memoryVersion;
  }

  const previousCards = new Map(cardRecords(current).map((card) => [card.id, card]));
  for (const card of cardRecords(value)) {
    const previous = previousCards.get(card.id);
    const memoryChanged = previous &&
      (previous.front !== card.front || previous.back !== card.back);
    const memoryVersion = previous
      ? (previous.memoryVersion ?? 1) + Number(Boolean(memoryChanged))
      : 1;
    if (card.memoryVersion !== memoryVersion) changed = true;
    card.memoryVersion = memoryVersion;
  }
  return { changed, status: "success", value };
}
