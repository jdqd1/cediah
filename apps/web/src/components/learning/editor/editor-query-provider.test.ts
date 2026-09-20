import { describe, expect, it } from "vitest";
import type { LearningEditorResourceCatalogResponse } from "@cediah/contracts";
import { editorQueryDefaults } from "./editor-query-provider";
import { editorQueryKeys, normalizeMaterialFilters } from "./editor-query-keys";
import { dedupeCatalogItems } from "./use-material-catalog";

const scope = editorQueryKeys.scope("e1000000-0000-4000-8000-000000000001", "new:session");

describe("editor query isolation", () => {
  it("uses the fixed editor GET defaults", () => {
    expect(editorQueryDefaults).toEqual({
      gcTime: 300_000,
      networkMode: "always",
      refetchOnReconnect: false,
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 30_000,
    });
  });

  it("separates catalog filters, current detail and fixed detail keys", () => {
    const unfiltered = editorQueryKeys.catalog(scope, { projection: "", q: "", topic: "" });
    const filtered = editorQueryKeys.catalog(scope, { projection: "quiz", q: "tórax", topic: "Anatomía" });
    expect(unfiltered).not.toEqual(filtered);
    expect(editorQueryKeys.currentDetail(scope, "e1000000-0000-4000-8000-000000000002", "quiz", 3))
      .not.toEqual(editorQueryKeys.fixedDetail(
        scope,
        "e1000000-0000-4000-8000-000000000003",
        "e1000000-0000-4000-8000-000000000004",
      ));
    expect(normalizeMaterialFilters({ projection: "", q: "  pared torácica  ", topic: "" }).q)
      .toBe("pared torácica");
  });

  it("derives deduplicated resources from active pages", () => {
    const item = {
      catalogVisibility: "catalog" as const,
      estimatedMinutes: 8,
      id: "e1000000-0000-4000-8000-000000000005",
      issues: [],
      kind: "quiz" as const,
      projections: [{ explanationCoverage: "complete" as const, itemCount: 1, itemIds: ["e1000000-0000-4000-8000-000000000006"], projection: "quiz" as const }],
      title: "Relaciones torácicas",
      topic: "Tórax",
      version: 2,
    };
    const page = (items: typeof item[]): LearningEditorResourceCatalogResponse => ({
      items,
      nextCursor: null,
      resourceTopics: ["Tórax"],
      topics: [],
    });
    expect(dedupeCatalogItems([page([item]), page([{ ...item, title: "Último título" }])]))
      .toEqual([{ ...item, title: "Último título" }]);
  });
});
