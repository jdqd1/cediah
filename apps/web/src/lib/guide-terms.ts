import { z } from "zod";

export const GuideTermPrimaryLinkSchema = z.object({
  guideSlug: z.string().min(1),
  guideTitle: z.string().min(1),
  sectionAnchor: z.string().nullable(),
  sectionHeading: z.string().nullable(),
});

export const GuideTermSummarySchema = z.object({
  category: z.string().nullable(),
  id: z.string().uuid(),
  name: z.string().min(1),
  primaryLink: GuideTermPrimaryLinkSchema.nullable(),
  shortDefinition: z.string().min(1),
  slug: z.string().min(1),
});

export const GuideTermManifestSchema = z.object({
  contentId: z.string().uuid(),
  contentVersion: z.number().int().positive(),
  dictionaryRevision: z.number().int().positive(),
  occurrences: z.array(z.object({
    e: z.number().int().nonnegative(),
    p: z.string(),
    s: z.number().int().nonnegative(),
    t: z.string().uuid(),
  }).refine((occurrence) => occurrence.e > occurrence.s, {
    message: "Interactive term occurrence end must be after start",
  })),
  sections: z.array(z.object({
    anchor: z.string().min(1),
    path: z.string(),
  })),
  terms: z.array(GuideTermSummarySchema),
});

export const InteractiveTermDetailSchema = z.object({
  term: GuideTermSummarySchema.omit({ primaryLink: true }).extend({
    links: z.array(z.object({
      guideSlug: z.string().min(1),
      guideTitle: z.string().min(1),
      primary: z.boolean(),
      sectionAnchor: z.string().nullable(),
      sectionHeading: z.string().nullable(),
    })),
  }),
});

export type GuideTermManifest = z.infer<typeof GuideTermManifestSchema>;
export type GuideTermOccurrence = GuideTermManifest["occurrences"][number];
export type GuideTermSummary = z.infer<typeof GuideTermSummarySchema>;
export type InteractiveTermDetail = z.infer<typeof InteractiveTermDetailSchema>;
