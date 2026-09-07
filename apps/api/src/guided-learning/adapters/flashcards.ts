import { z } from "zod";
import { DraftFlashcardSchema } from "@cediah/contracts";
import type { ActivityAdapter } from "./types.js";

const ExecutableCardSchema = DraftFlashcardSchema.extend({
  itemKind: z.enum(["question", "flashcard"]).optional(),
}).superRefine((card, context) => {
  if (!card.id) context.addIssue({ code: "custom", message: "Card identity is required", path: ["id"] });
  if (!card.front.trim() || !card.back.trim()) {
    context.addIssue({ code: "custom", message: "Card faces are required" });
  }
});

const FlashcardPayloadSchema = z.object({
  cards: z.array(ExecutableCardSchema).min(1).max(500),
});

export type ExecutableCard = z.infer<typeof ExecutableCardSchema> & { id: string };
export type FlashcardPayload = { cards: ExecutableCard[] };

export const flashcardAdapter: ActivityAdapter<FlashcardPayload, {
  cards: Array<{ front: string; itemId: string }>;
}> = {
  key: "flashcards",
  version: 1,
  items(payload) {
    return payload.cards.map((card) => ({
      id: card.id,
      kind: card.itemKind ?? "flashcard",
      memoryVersion: card.memoryVersion ?? 1,
    }));
  },
  parse(content) {
    return FlashcardPayloadSchema.parse(content) as FlashcardPayload;
  },
  toStudentPayload(payload) {
    return {
      cards: payload.cards.map((card) => ({ front: card.front, itemId: card.id })),
    };
  },
};
