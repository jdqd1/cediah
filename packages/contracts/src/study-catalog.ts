import { z } from "zod";

export const StudyCatalogKindSchema = z.enum([
  "video",
  "guide",
  "quiz",
  "flashcards",
  "topic",
]);

export const StudyCatalogItemSchema = z.object({
  estimatedMinutes: z.number().int().min(0).max(100_000).nullable(),
  featured: z.boolean(),
  hasEmbeddedGuide: z.boolean(),
  hasFlashcards: z.boolean(),
  hasQuiz: z.boolean(),
  id: z.string().uuid(),
  kind: StudyCatalogKindSchema,
  linkedVideoId: z.string().uuid().nullable(),
  publishedAt: z.string().datetime({ offset: true }).nullable(),
  regions: z.array(z.string().trim().min(1).max(120)).max(12),
  slug: z.string().trim().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  subjectIds: z.array(z.string().uuid()).max(20),
  summary: z.string().trim().max(2_000),
  title: z.string().trim().min(1).max(200),
  topic: z.string().trim().max(120),
  updatedAt: z.string().datetime({ offset: true }),
  viewCount: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
});

export const StudyCatalogResponseSchema = z.object({
  items: z.array(StudyCatalogItemSchema),
});

export const StudyCatalogSubjectSchema = z.object({
  contentCount: z.number().int().nonnegative(),
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

export const SubjectStudyCatalogResponseSchema = z.object({
  items: z.array(StudyCatalogItemSchema),
  subject: StudyCatalogSubjectSchema,
});

export type StudyCatalogKind = z.infer<typeof StudyCatalogKindSchema>;
export type StudyCatalogItem = z.infer<typeof StudyCatalogItemSchema>;
export type StudyCatalogResponse = z.infer<typeof StudyCatalogResponseSchema>;
export type StudyCatalogSubject = z.infer<typeof StudyCatalogSubjectSchema>;
export type SubjectStudyCatalogResponse = z.infer<typeof SubjectStudyCatalogResponseSchema>;
