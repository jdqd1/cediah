import { z } from "zod";
import { RichTextDocumentSchema } from "@cediah/contracts";
import type { ActivityAdapter } from "./types.js";

const GuidePayloadSchema = z.object({
  document: RichTextDocumentSchema.nullable().default(null),
  sections: z.array(z.object({ body: z.string(), heading: z.string() })).max(100).default([]),
});

export type GuidePayload = z.infer<typeof GuidePayloadSchema>;

export const guideAdapter: ActivityAdapter<GuidePayload, GuidePayload> = {
  key: "guide",
  version: 1,
  items: () => [],
  parse: (content) => GuidePayloadSchema.parse(content),
  toStudentPayload: (payload) => payload,
};
