import type { LearningMapProvider } from "@cediah/contracts";
import type { DatabaseClient } from "../db/database.js";
import { aggregateMapProgress } from "../learning-map/progress.js";
import { readMapLevel, rootRoute } from "../learning-map/resolver.js";
import { createMapMutator } from "../learning-map/mutations.js";
import { readMapCatalog, readMapSuggestions } from "../learning-map/catalog.js";

export function createPostgresLearningMapProvider(
  database: DatabaseClient,
  options: { clock?: () => Date } = {},
): LearningMapProvider {
  return {
    async summary(userId) {
      const level = await readMapLevel(database, userId, rootRoute);
      return level
        ? {
            map: { id: level.mapId },
            nodes: level.items,
            progress: level.containerSummary.progress,
            structuralVersion: level.structuralVersion,
          }
        : {
            map: null,
            nodes: [],
            progress: aggregateMapProgress([]),
            structuralVersion: 0,
          };
    },
    level: (userId, route) => readMapLevel(database, userId, route),
    catalog: (userId, query) => readMapCatalog(database, userId, query),
    suggestions: (userId, route) => readMapSuggestions(database, userId, route),
    mutate: createMapMutator(database, options.clock ?? (() => new Date())),
  };
}
