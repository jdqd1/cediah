import { z } from "zod";

export const InteractiveTermOccurrencePolicySchema = z.enum([
  "first_per_section",
  "first_per_guide",
  "all",
]);

export const InteractiveTermAdminAliasSchema = z.object({
  alias: z.string(),
  autoMatch: z.boolean(),
  id: z.string().uuid(),
});

export const InteractiveTermAdminDestinationSchema = z.object({
  guideId: z.string().uuid(),
  guideSlug: z.string(),
  guideTitle: z.string(),
  id: z.string().uuid(),
  primary: z.boolean(),
  priority: z.number().int(),
  sectionAnchor: z.string().nullable(),
  sectionHeading: z.string().nullable(),
});

export const InteractiveTermAdminSchema = z.object({
  aliases: z.array(InteractiveTermAdminAliasSchema),
  autoMatch: z.boolean(),
  category: z.string().nullable(),
  createdAt: z.string(),
  destinations: z.array(InteractiveTermAdminDestinationSchema),
  id: z.string().uuid(),
  isActive: z.boolean(),
  name: z.string(),
  occurrencePolicy: InteractiveTermOccurrencePolicySchema,
  priority: z.number().int(),
  shortDefinition: z.string(),
  slug: z.string(),
  updatedAt: z.string(),
  usageCount: z.number().int().nonnegative(),
});

export const InteractiveTermAdminListSchema = z.object({
  terms: z.array(InteractiveTermAdminSchema),
});

export const InteractiveTermAdminMutationSchema = z.object({
  term: InteractiveTermAdminSchema,
});

export type InteractiveTermOccurrencePolicy = z.infer<typeof InteractiveTermOccurrencePolicySchema>;
export type InteractiveTermAdmin = z.infer<typeof InteractiveTermAdminSchema>;

export type InteractiveTermAdminDraft = {
  aliases: { alias: string; autoMatch: boolean }[];
  autoMatch: boolean;
  category: string | null;
  destinations: {
    guideSlug: string;
    primary: boolean;
    priority: number;
    sectionAnchor: string | null;
  }[];
  isActive: boolean;
  name: string;
  occurrencePolicy: InteractiveTermOccurrencePolicy;
  priority: number;
  shortDefinition: string;
  slug: string;
};
