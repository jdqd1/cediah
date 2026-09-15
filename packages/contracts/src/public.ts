import { z } from "zod";
import {
  PublishableContentDraftSchema as StrictPublishableContentDraftSchema,
} from "./index.js";

export * from "./index.js";

// Editorial topics are optional. Keep the legacy string field for backwards
// compatibility, but allow an empty string to represent content attached
// directly to a subject instead of forcing a synthetic taxonomy topic.
const optionalTopicSentinel = "__cediah_optional_topic_validation_7f4b6f5f__";

export const PublishableContentDraftSchema = z
  .preprocess((input) => {
    if (!input || typeof input !== "object" || Array.isArray(input)) return input;
    const topic = (input as Record<string, unknown>).topic;
    if (typeof topic !== "string" || topic.trim().length > 0) return input;
    return { ...input, topic: optionalTopicSentinel };
  }, StrictPublishableContentDraftSchema)
  .transform((draft) =>
    draft.topic === optionalTopicSentinel
      ? { ...draft, topic: "" }
      : draft,
  );
