import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createLearningAdapterRegistry } from "../src/guided-learning/adapters/registry.js";
import type { ActivityAdapter } from "../src/guided-learning/adapters/types.js";

describe("guided-learning adapter registry", () => {
  it("accepts a new adapter type without exposing it as published content", () => {
    const PayloadSchema = z.strictObject({ prompt: z.string().min(1) });
    const caseStudyAdapter: ActivityAdapter<
      z.infer<typeof PayloadSchema>,
      { prompt: string },
      "case-study-test"
    > = {
      items: () => [],
      key: "case-study-test",
      parse: (content) => PayloadSchema.parse(content),
      toStudentPayload: (payload) => ({ prompt: payload.prompt }),
      version: 1,
    };

    const registry = createLearningAdapterRegistry([caseStudyAdapter]);
    const adapter = registry.get("case-study-test");
    const payload = adapter.parse({ prompt: "Correlaciona los hallazgos" });

    expect(adapter.toStudentPayload(payload)).toEqual({ prompt: "Correlaciona los hallazgos" });
  });

  it("rejects duplicate adapter keys", () => {
    const adapter: ActivityAdapter<unknown, unknown, "duplicate-test"> = {
      items: () => [],
      key: "duplicate-test",
      parse: (content) => content,
      toStudentPayload: (payload) => payload,
      version: 1,
    };

    expect(() => createLearningAdapterRegistry([adapter, adapter])).toThrow(/unique/);
  });
});
