import { describe, expect, it } from "vitest";
import type { ContentItem } from "@cediah/contracts";
import { findVideoLinkedGuide, getGuideCatalog, getIndependentPublications, getVideoGuideContent } from "./content-guide-links";

const video: Extract<ContentItem, { kind: "video" }> = {
  asset: null,
  authorUserId: "author",
  content: {
    description: "Video",
    durationSeconds: null,
    externalUrl: "https://example.test/video",
    guide: { document: null, sections: [{ heading: "Original", body: "Guía del video" }] },
    keyPoints: ["Punto original"],
    quiz: { questions: [] },
    regions: ["Cuello"],
  },
  createdAt: "2026-09-01T00:00:00.000Z",
  estimatedMinutes: null,
  featured: false,
  id: "video",
  kind: "video",
  publishedAt: "2026-09-01T00:00:00.000Z",
  slug: "video-de-cuello",
  status: "published",
  subjectIds: [],
  summary: "Resumen",
  title: "Video de cuello",
  topic: "Cuello",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

const guide: Extract<ContentItem, { kind: "guide" }> = {
  ...video,
  content: {
    document: null,
    keyPoints: ["Punto de la guía enlazada"],
    linkedVideoId: video.id,
    quiz: {
      questions: [{ correctOptionIndex: 0, explanation: "", options: ["Correcta", "Otra"], prompt: "Pregunta enlazada" }],
    },
    regions: ["Cuello"],
    sections: [{ heading: "Principal", body: "Guía independiente enlazada" }],
  },
  id: "guide",
  kind: "guide",
  slug: "guia-de-cuello",
  title: "Guía de cuello",
};

describe("video-linked guides", () => {
  it("lists an embedded guide without copying its body or video asset", () => {
    const [entry] = getGuideCatalog([video]);
    expect(entry?.kind).toBe("guide");
    expect(entry?.id).toBe(video.id);
    expect(entry?.slug).toBe(video.slug);
    expect(entry?.content.sections).toBe(video.content.guide.sections);
    expect(entry?.asset).toBeNull();
    expect(video.kind).toBe("video");
  });

  it("lists a linked guide only once, and excludes empty video guides", () => {
    expect(getGuideCatalog([video, guide])).toEqual([guide]);
    const empty = { ...video, content: { ...video.content, guide: { document: null, sections: [] } } };
    expect(getGuideCatalog([empty])).toEqual([]);
  });

  it("uses the linked guide as the source for the document and every companion resource", () => {
    expect(getVideoGuideContent(video, guide)).toBe(guide.content);
    expect(getVideoGuideContent(video, guide).sections[0]?.heading).toBe("Principal");
    expect(getVideoGuideContent(video, guide).quiz.questions[0]?.prompt).toBe("Pregunta enlazada");
  });

  it("keeps the embedded guide as the fallback for videos without a linked guide", () => {
    expect(getVideoGuideContent(video)).toEqual({
      ...video.content.guide,
      keyPoints: video.content.keyPoints,
      linkedVideoId: video.id,
      quiz: video.content.quiz,
      regions: video.content.regions,
    });
  });

  it("removes a linked guide from publications without deleting its record", () => {
    const items = [video, guide];
    expect(getIndependentPublications(items)).toEqual([video]);
    expect(findVideoLinkedGuide(items, video.id)).toBe(guide);
    expect(items).toHaveLength(2);
  });

  it("keeps independent and orphaned guides reachable for editing", () => {
    const independent = { ...guide, content: { ...guide.content, linkedVideoId: null } };
    expect(getIndependentPublications([video, independent])).toEqual([video, independent]);
    expect(getIndependentPublications([guide])).toEqual([guide]);
  });

  it("finds the most recently updated linked guide without reordering the workspace", () => {
    const newer = { ...guide, id: "newer-guide", updatedAt: "2026-09-02T00:00:00.000Z" };
    const items = [video, guide, newer];
    expect(findVideoLinkedGuide(items, video.id)).toBe(newer);
    expect(findVideoLinkedGuide(items, null)).toBeUndefined();
    expect(items[1]).toBe(guide);
  });
});
