import { z } from "zod";
import type { ActivityAdapter } from "./types.js";

const VideoPayloadSchema = z.object({
  durationSeconds: z.number().int().positive().nullable(),
  externalUrl: z.string().url().nullable(),
});

export type VideoPayload = z.infer<typeof VideoPayloadSchema>;

export const videoAdapter: ActivityAdapter<VideoPayload, VideoPayload> = {
  key: "video",
  version: 1,
  items: () => [],
  parse: (content) => VideoPayloadSchema.parse(content),
  toStudentPayload: (payload) => payload,
};
