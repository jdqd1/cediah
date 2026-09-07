import { z } from "zod";
import { GuideQuizQuestionSchema, PublicLearningQuestionSchema } from "@cediah/contracts";
import type { ActivityAdapter } from "./types.js";

const ExecutableQuestionSchema = GuideQuizQuestionSchema.superRefine((question, context) => {
  if (!question.id) {
    context.addIssue({ code: "custom", message: "Question identity is required", path: ["id"] });
  }
  if (!question.optionIds) {
    context.addIssue({ code: "custom", message: "Option identities are required", path: ["optionIds"] });
  }
});

const QuizPayloadSchema = z.object({
  questions: z.array(ExecutableQuestionSchema).min(1).max(100),
});

export type ExecutableQuestion = z.infer<typeof ExecutableQuestionSchema> & {
  id: string;
  optionIds: string[];
};
export type QuizPayload = { questions: ExecutableQuestion[] };

export const quizAdapter: ActivityAdapter<QuizPayload, {
  questions: Array<z.infer<typeof PublicLearningQuestionSchema>>;
}> = {
  key: "quiz",
  version: 1,
  items(payload) {
    return payload.questions.map((question) => ({
      id: question.id,
      kind: "question",
      memoryVersion: question.memoryVersion ?? 1,
    }));
  },
  parse(content) {
    return QuizPayloadSchema.parse(content) as QuizPayload;
  },
  toStudentPayload(payload) {
    return {
      questions: payload.questions.map((question) => PublicLearningQuestionSchema.parse({
        itemId: question.id,
        options: question.options.map((text, index) => ({
          id: question.optionIds[index],
          text,
        })),
        prompt: question.prompt,
      })),
    };
  },
};

export function gradeQuizOption(question: ExecutableQuestion, optionId: string) {
  const correctOptionId = question.optionIds[question.correctOptionIndex];
  if (!question.optionIds.includes(optionId) || !correctOptionId) return null;
  return {
    correct: optionId === correctOptionId,
    correctOptionId,
    explanation: question.explanation,
  };
}
