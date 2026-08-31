import { describe, expect, it } from "vitest";
import type { ContentDraft } from "@cediah/contracts";
import { isPublishedPermittedDraftUpdate } from "./content-editing";

const videoDraft: ContentDraft = {
  content: {
    description: "Descripción",
    durationSeconds: 120,
    externalUrl: "https://example.test/video",
    guide: { document: null, sections: [] },
    keyPoints: ["Punto clave"],
    quiz: { questions: [] },
    regions: ["Cuello"],
  },
  estimatedMinutes: 2,
  featured: false,
  kind: "video",
  slug: "video-de-cuello",
  subjectIds: [],
  summary: "Resumen",
  title: "Video de cuello",
  topic: "Cuello",
};

const guideDraft: ContentDraft = {
  content: {
    document: null,
    keyPoints: [],
    linkedVideoId: null,
    quiz: { questions: [] },
    regions: ["Cuello"],
    sections: [],
  },
  estimatedMinutes: 5,
  featured: false,
  kind: "guide",
  slug: "guia-de-cuello",
  subjectIds: [],
  summary: "Resumen",
  title: "Guía de cuello",
  topic: "Cuello",
};

describe("published content edits", () => {
  it.each([
    ["video", videoDraft],
    ["guide", guideDraft],
  ])("allows changing the title of a published %s", (_kind, baseline) => {
    expect(isPublishedPermittedDraftUpdate(
      { ...baseline, title: "Título actualizado" } as ContentDraft,
      baseline,
    )).toBe(true);
  });

  it("allows combining a title change with organization changes", () => {
    expect(isPublishedPermittedDraftUpdate(
      {
        ...guideDraft,
        title: "Título actualizado",
        topic: "Cabeza",
        content: { ...guideDraft.content, regions: ["Cabeza"] },
      },
      guideDraft,
    )).toBe(true);
  });

  it("continues rejecting editorial content changes after publication", () => {
    expect(isPublishedPermittedDraftUpdate(
      { ...videoDraft, summary: "Resumen modificado", title: "Título actualizado" },
      videoDraft,
    )).toBe(false);
  });
});
