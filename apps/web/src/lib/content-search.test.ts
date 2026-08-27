import type { ContentItem, RichTextDocument } from "@cediah/contracts";
import { describe, expect, it } from "vitest";
import {
  contentItemSearchText,
  getContentSearchExcerpt,
  getSearchMatchRanges,
  searchPublishedContent,
} from "./content-search";

type GuideItem = Extract<ContentItem, { kind: "guide" }>;
type VideoItem = Extract<ContentItem, { kind: "video" }>;

function sharedItem(input: {
  id: string;
  slug: string;
  summary: string;
  title: string;
  topic?: string;
}) {
  return {
    asset: null,
    authorUserId: "00000000-0000-4000-8000-000000000001",
    createdAt: "2026-08-01T10:00:00.000Z",
    estimatedMinutes: 8,
    featured: false,
    id: input.id,
    publishedAt: "2026-08-02T10:00:00.000Z",
    slug: input.slug,
    status: "published" as const,
    subjectIds: [],
    summary: input.summary,
    title: input.title,
    topic: input.topic ?? "Anatomía",
    updatedAt: "2026-08-02T10:00:00.000Z",
  };
}

function guideItem(input: {
  body: string;
  id?: string;
  slug?: string;
  summary?: string;
  title?: string;
}): GuideItem {
  const document: RichTextDocument = {
    content: [
      {
        content: [{ text: input.body, type: "text" }],
        type: "paragraph",
      },
    ],
    type: "doc",
  };

  return {
    ...sharedItem({
      id: input.id ?? "00000000-0000-4000-8000-000000000010",
      slug: input.slug ?? "guia-anatomica",
      summary: input.summary ?? "Material de estudio general.",
      title: input.title ?? "Guía anatómica",
    }),
    content: {
      document,
      keyPoints: [],
      linkedVideoId: null,
      quiz: { questions: [] },
      regions: [],
      sections: [],
    },
    kind: "guide",
  };
}

function videoItem(input: {
  id: string;
  slug: string;
  title: string;
}): VideoItem {
  return {
    ...sharedItem({
      id: input.id,
      slug: input.slug,
      summary: "Explicación audiovisual de anatomía.",
      title: input.title,
      topic: "Cuello",
    }),
    content: {
      description: "Clase anatómica.",
      durationSeconds: 600,
      externalUrl: null,
      guide: { document: null, sections: [] },
      keyPoints: [],
      quiz: { questions: [] },
      regions: ["Cuello"],
    },
    kind: "video",
  };
}

describe("published content search", () => {
  it("finds accent-insensitive matches inside a guide and returns a short context", () => {
    const response = searchPublishedContent(
      [
        guideItem({
          body: "El triángulo posterior del cuello contiene estructuras vasculares y nerviosas relevantes para la práctica clínica.",
        }),
      ],
      "triangulo cuello",
    );

    expect(response.videos).toEqual([]);
    expect(response.guides).toHaveLength(1);
    expect(response.guides[0]).toMatchObject({
      excerptType: "content",
      kind: "guide",
      title: "Guía anatómica",
    });
    expect(response.guides[0]?.excerpt).toContain("triángulo posterior del cuello");
  });

  it("orders the strongest title match first and limits videos to four", () => {
    const videos = [
      videoItem({ id: "1", slug: "introduccion-cuello", title: "Introducción al cuello" }),
      videoItem({ id: "2", slug: "cuello", title: "Cuello" }),
      videoItem({ id: "3", slug: "vasos-cuello", title: "Vasos del cuello" }),
      videoItem({ id: "4", slug: "musculos-cuello", title: "Músculos del cuello" }),
      videoItem({ id: "5", slug: "fascias-cuello", title: "Fascias cervicales" }),
      videoItem({ id: "6", slug: "nervios-cuello", title: "Nervios cervicales" }),
    ];

    const response = searchPublishedContent(videos, "cuello");

    expect(response.videos).toHaveLength(4);
    expect(response.videos[0]?.title).toBe("Cuello");
  });

  it("maps normalized matches back to the accented source text", () => {
    const value = "Triángulo del cuello";
    const [range] = getSearchMatchRanges(value, "triangulo");

    expect(value.slice(range?.start, range?.end)).toBe("Triángulo");
  });

  it("exposes full guide text and a focused excerpt for catalog searches", () => {
    const guide = guideItem({
      body: "El peritoneo parietal tapiza la pared abdominopélvica y conserva sensibilidad somática.",
      summary: "Introducción al abdomen.",
    });
    const searchableText = contentItemSearchText(guide);

    expect(searchableText).toContain("sensibilidad somática");
    expect(getContentSearchExcerpt(searchableText, "sensibilidad somatica"))
      .toContain("sensibilidad somática");
  });
});
