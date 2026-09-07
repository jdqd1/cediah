import { describe, expect, it } from "vitest";
import { isRetryableLearningStatus, learningMutationQueueKey } from "./learning-mutation-queue";

describe("guided-learning mutation retry policy", () => {
  it.each([401, 429, 500, 503])("keeps retryable status %s queued", (status) => {
    expect(isRetryableLearningStatus(status)).toBe(true);
  });

  it.each([200, 400, 403, 404, 409, 422])("does not retry final status %s", (status) => {
    expect(isRetryableLearningStatus(status)).toBe(false);
  });

  it("partitions identical idempotency keys by account", () => {
    const key = "60000000-0000-4000-8000-000000000009";
    expect(learningMutationQueueKey("student-a", key)).not.toBe(learningMutationQueueKey("student-b", key));
  });
});
