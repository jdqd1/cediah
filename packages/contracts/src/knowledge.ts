import { z } from "zod";

export const KnowledgeTermFrequencySchema = z.enum([
  "first_section",
  "first_guide",
  "all",
]);

export type KnowledgeTermFrequency = z.infer<typeof KnowledgeTermFrequencySchema>;

export const GuideKnowledgeSectionSchema = z.object({
  anchor: z.string().min(1).max(160),
  heading: z.string().min(1).max(500),
  nodePath: z.string().min(1).max(500),
  ordinal: z.number().int().nonnegative(),
});

export const GuideKnowledgeTargetSchema = z.object({
  anchor: z.string().min(1).max(160).nullable(),
  contentId: z.string().uuid(),
  label: z.string().min(1).max(200).nullable(),
  slug: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
});

export const GuideKnowledgeTermSchema = z.object({
  category: z.string().min(1).max(120).nullable(),
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  shortDefinition: z.string().min(1).max(1200),
  slug: z.string().min(1).max(200),
  target: GuideKnowledgeTargetSchema.nullable(),
});

export const GuideKnowledgeOccurrenceSchema = z.object({
  endOffset: z.number().int().positive(),
  nodePath: z.string().min(1).max(500),
  startOffset: z.number().int().nonnegative(),
  termId: z.string().uuid(),
});

export const GuideKnowledgeIndexSchema = z.object({
  occurrences: z.array(GuideKnowledgeOccurrenceSchema).max(20_000),
  sections: z.array(GuideKnowledgeSectionSchema).max(2_000),
  terms: z.array(GuideKnowledgeTermSchema).max(5_000),
});

export type GuideKnowledgeIndex = z.infer<typeof GuideKnowledgeIndexSchema>;
export type GuideKnowledgeOccurrence = z.infer<typeof GuideKnowledgeOccurrenceSchema>;
export type GuideKnowledgeSection = z.infer<typeof GuideKnowledgeSectionSchema>;
export type GuideKnowledgeTarget = z.infer<typeof GuideKnowledgeTargetSchema>;
export type GuideKnowledgeTerm = z.infer<typeof GuideKnowledgeTermSchema>;

const KnowledgeAliasInputSchema = z.object({
  alias: z.string().trim().min(2).max(200),
  autoLink: z.boolean().default(true),
  caseSensitive: z.boolean().default(false),
  priority: z.number().int().min(-1000).max(1000).default(0),
});

export const KnowledgeTermTargetInputSchema = z.object({
  contentId: z.string().uuid(),
  label: z.string().trim().min(1).max(200).nullable().optional(),
  sectionAnchor: z.string().trim().min(1).max(160).nullable().optional(),
  priority: z.number().int().min(-1000).max(1000).default(0),
});

export const KnowledgeTermCreateRequestSchema = z.object({
  aliases: z.array(KnowledgeAliasInputSchema).max(50).default([]),
  autoLink: z.boolean().default(true),
  category: z.string().trim().min(1).max(120).nullable().default(null),
  frequency: KnowledgeTermFrequencySchema.default("first_section"),
  name: z.string().trim().min(1).max(200),
  priority: z.number().int().min(-1000).max(1000).default(0),
  shortDefinition: z.string().trim().min(1).max(1200),
  slug: z.string().trim().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  target: KnowledgeTermTargetInputSchema.nullable().default(null),
});

export const KnowledgeTermUpdateRequestSchema = KnowledgeTermCreateRequestSchema
  .omit({ slug: true })
  .partial()
  .extend({
    active: z.boolean().optional(),
    slug: z.string().trim().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  });

export const KnowledgeTermAdminSchema = z.object({
  active: z.boolean(),
  aliases: z.array(KnowledgeAliasInputSchema.extend({ id: z.string().uuid() })),
  autoLink: z.boolean(),
  category: z.string().nullable(),
  frequency: KnowledgeTermFrequencySchema,
  id: z.string().uuid(),
  name: z.string(),
  priority: z.number().int(),
  shortDefinition: z.string(),
  slug: z.string(),
  target: KnowledgeTermTargetInputSchema.extend({
    anchor: z.string().nullable(),
    title: z.string(),
    slug: z.string(),
  }).nullable(),
});

export const KnowledgeTermAdminListSchema = z.object({
  terms: z.array(KnowledgeTermAdminSchema),
});

export type KnowledgeTermCreateRequest = z.infer<typeof KnowledgeTermCreateRequestSchema>;
export type KnowledgeTermUpdateRequest = z.infer<typeof KnowledgeTermUpdateRequestSchema>;
export type KnowledgeTermAdmin = z.infer<typeof KnowledgeTermAdminSchema>;
