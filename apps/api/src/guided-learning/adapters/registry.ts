import type { LearningProjection } from "@cediah/contracts";
import { flashcardAdapter } from "./flashcards.js";
import { guideAdapter } from "./guide.js";
import { quizAdapter } from "./quiz.js";
import type { ActivityAdapter } from "./types.js";
import { videoAdapter } from "./video.js";

export function createLearningAdapterRegistry<TKey extends string>(
  adapters: ReadonlyArray<ActivityAdapter<unknown, unknown, TKey>>,
) {
  const byKey = new Map(adapters.map((adapter) => [adapter.key, adapter]));
  if (byKey.size !== adapters.length) throw new Error("Learning adapter keys must be unique");
  return {
    get(key: TKey) {
      const adapter = byKey.get(key);
      if (!adapter) throw new Error(`Unknown learning adapter: ${key}`);
      return adapter;
    },
  };
}

const registry = createLearningAdapterRegistry<LearningProjection>([
  flashcardAdapter,
  guideAdapter,
  quizAdapter,
  videoAdapter,
]);

export function getLearningAdapter(projection: LearningProjection) {
  return registry.get(projection);
}
