import { z } from "zod";

export const InteractiveTermSuggestionExampleSchema = z.object({
  guideSlug: z.string(),
  guideTitle: z.string(),
  sectionAnchor: z.string(),
  sectionHeading: z.string(),
});

export const InteractiveTermSuggestionSchema = z.object({
  examples: z.array(InteractiveTermSuggestionExampleSchema),
  generic: z.boolean(),
  guideCount: z.number().int().nonnegative(),
  name: z.string(),
  normalizedKey: z.string(),
  sectionCount: z.number().int().nonnegative(),
});

export const InteractiveTermSuggestionListSchema = z.object({
  suggestions: z.array(InteractiveTermSuggestionSchema),
});

export type InteractiveTermSuggestion = z.infer<typeof InteractiveTermSuggestionSchema>;
