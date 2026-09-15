import { describe, expect, it } from "vitest";
import type { ContentDraft, ContentItem } from "@cediah/contracts";
import { isPublishedPermittedUpdate } from "../src/content-authorization.js";

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

const publishedItem = (draft: ContentDraft) => ({
  ...draft,
  status: "published",
}) as unknown as ContentItem;

describe("published content authorization", () => {
  it("allows full updates to an already published guide", () => {
    expect(isPublishedPermittedUpdate(
      publishedItem(guideDraft),
      {
        ...guideDraft,
        summary: "Resumen actualizado",
        estimatedMinutes: 8,
        content: {
          ...guideDraft.content,
          keyPoints: ["Nuevo punto clave"],
        },
      },
    )).toBe(true);
  });

  it("does not allow changing the slug of a published guide", () => {
    expect(isPublishedPermittedUpdate(
      publishedItem(guideDraft),
      { ...guideDraft, slug: "otro-slug" },
    )).toBe(false);
  });

  it("keeps full editorial updates restricted for published videos", () => {
    expect(isPublishedPermittedUpdate(
      publishedItem(videoDraft),
      { ...videoDraft, summary: "Resumen actualizado" },
    )).toBe(false);
  });
});
