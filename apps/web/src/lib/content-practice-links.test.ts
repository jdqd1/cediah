import { describe, expect, it } from "vitest";
import type { ContentItem } from "@cediah/contracts";
import {
  getPracticeCatalog,
  getStudyCatalog,
  getSubjectStudyCatalog,
  projectPracticeContent,
} from "./content-practice-links";
import { publishedContentHref } from "./content-navigation";

const question = { prompt: "Pregunta del video", options: ["Distractor", "Respuesta"], correctOptionIndex: 1, explanation: "Explicación" };
const video: Extract<ContentItem, { kind: "video" }> = {
  id: "video", kind: "video", title: "Peritoneo", slug: "peritoneo", summary: "Resumen", topic: "Abdomen",
  subjectIds: ["anatomia"], status: "published", asset: null, authorUserId: "author", featured: false,
  estimatedMinutes: null, createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z", publishedAt: "2026-09-01T00:00:00Z",
  content: {
    description: "Video", durationSeconds: null, externalUrl: null, regions: ["Abdomen"],
    keyPoints: ["Punto"], guide: { document: null, sections: [{ heading: "Guía", body: "Texto" }] }, quiz: { questions: [question] },
  },
};
const guide: Extract<ContentItem, { kind: "guide" }> = {
  ...video, id: "guide", kind: "guide", slug: "guia-peritoneo", subjectIds: ["cirugia"],
  content: {
    document: null, sections: [], linkedVideoId: video.id, regions: ["Abdomen"], keyPoints: [],
    quiz: { questions: [{ ...question, prompt: "Pregunta de la guía enlazada" }] },
  },
};

describe("shared practice catalogs", () => {
  it("exposes video questions in both sections without altering or cloning stored content", () => {
    const before = JSON.stringify(video);
    const [quiz] = getPracticeCatalog([video], "quiz");
    const [cards] = getPracticeCatalog([video], "flashcards");
    expect(quiz).toMatchObject({ id: video.id, slug: video.slug, kind: "quiz", asset: null });
    expect(quiz?.kind === "quiz" && quiz.content.questions).toBe(video.content.quiz.questions);
    expect(cards).toMatchObject({ id: video.id, kind: "flashcards", content: { cards: [{ front: question.prompt, back: "Respuesta" }] } });
    expect(JSON.stringify(video)).toBe(before);
  });

  it("shows one canonical resource for a video and linked guide regardless of order", () => {
    for (const items of [[video, guide], [guide, video]]) {
      for (const kind of ["quiz", "flashcards"] as const) {
        const resources = getPracticeCatalog(items, kind);
        expect(resources).toHaveLength(1);
        expect(resources[0]).toMatchObject({ id: guide.id, slug: guide.slug, kind });
        expect(resources[0]?.subjectIds.toSorted()).toEqual(["anatomia", "cirugia"]);
      }
    }
    expect(getSubjectStudyCatalog([video, guide], "quiz", "anatomia")).toHaveLength(1);
    expect(getSubjectStudyCatalog([video, guide], "quiz", "cirugia")).toHaveLength(1);
    expect(getSubjectStudyCatalog([video, guide], "quiz", "pediatria")).toHaveLength(0);
  });

  it("resolves direct links to the same questions and reflects subsequent edits", () => {
    const projected = projectPracticeContent(video, "quiz", guide)!;
    expect(publishedContentHref(projected, { subjectSlug: "anatomia", topic: "Abdomen" }))
      .toBe("/contenido/guia-peritoneo?asignatura=anatomia&tema=Abdomen&tipo=quiz");
    expect(projected.content).toBeDefined();
    expect(projected.content).toEqual(projectPracticeContent(guide, "quiz")?.content);
    const edited = { ...guide, content: { ...guide.content, quiz: { questions: [{ ...question, prompt: "Pregunta actualizada" }] } } };
    expect(getPracticeCatalog([video, edited], "flashcards")[0]).toMatchObject({
      content: { cards: [{ front: "Pregunta actualizada", back: "Respuesta" }] },
    });
  });

  it("preserves independent practice sets while skipping drafts and empty companions", () => {
    const standalone = { ...projectPracticeContent(video, "quiz")!, id: "standalone", slug: "repaso" };
    const empty = { ...video, id: "empty", content: { ...video.content, quiz: { questions: [] } } };
    const draft = { ...video, id: "draft", status: "draft" as const };
    expect(getPracticeCatalog([standalone, video, empty, draft], "quiz").map(({ id }) => id)).toEqual(["standalone", "video"]);
    expect(getStudyCatalog([video], "guide")).toHaveLength(1);
    expect(getStudyCatalog([video], "video")).toEqual([video]);
    expect(projectPracticeContent(draft, "quiz")).toBeNull();
  });

  it("does not revive old embedded questions when the canonical guide is empty or replaced", () => {
    const latest = { ...guide, id: "latest", updatedAt: "2026-09-03T00:00:00Z", content: { ...guide.content, quiz: { questions: [] } } };
    expect(getPracticeCatalog([video, guide, latest], "quiz")).toEqual([]);
  });
});
