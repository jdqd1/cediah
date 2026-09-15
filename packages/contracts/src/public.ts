import { z } from "zod";
import {
  PublishableContentDraftSchema as StrictPublishableContentDraftSchema,
} from "./index.js";

export * from "./index.js";
export * from "./study-catalog.js";

// Editorial topics are optional when content is attached directly to at least
// one subject. Keep the legacy string field for backwards compatibility and
// preserve the existing rule that otherwise requires complete metadata.
const optionalTopicSentinel = "__cediah_optional_topic_validation_7f4b6f5f__";

export const PublishableContentDraftSchema = z
  .preprocess((input) => {
    if (!input || typeof input !== "object" || Array.isArray(input)) return input;
    const record = input as Record<string, unknown>;
    const topic = record.topic;
    const subjectIds = record.subjectIds;
    if (typeof topic !== "string" || topic.trim().length > 0) return input;
    if (!Array.isArray(subjectIds) || subjectIds.length === 0) return input;
    return { ...record, topic: optionalTopicSentinel };
  }, StrictPublishableContentDraftSchema)
  .transform((draft) =>
    draft.topic === optionalTopicSentinel
      ? { ...draft, topic: "" }
      : draft,
  );
