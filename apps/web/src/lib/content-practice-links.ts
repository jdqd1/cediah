import type { ContentItem } from "@cediah/contracts";
import { findVideoLinkedGuide, getGuideCatalog, getVideoGuideContent } from "./content-guide-links";
import type { StudyContentKind } from "./content-navigation";
import { questionAnswer } from "./question-answer";

export type PracticeKind = "quiz" | "flashcards";
type GuideItem = Extract<ContentItem, { kind: "guide" }>;
type PracticeItem = Extract<ContentItem, { kind: PracticeKind }>;

/** A read-only view of the original questions. Never save this as a publication. */
export function projectPracticeContent(
  item: ContentItem,
  kind: PracticeKind,
  linkedGuide?: GuideItem,
): PracticeItem | null {
  if (item.status !== "published") return null;
  if (item.kind === kind) return item as PracticeItem;
  if (item.kind !== "video" && item.kind !== "guide") return null;

  const source = item.kind === "video" ? linkedGuide ?? item : item;
  if (source.status !== "published") return null;
  const content = item.kind === "video" ? getVideoGuideContent(item, linkedGuide) : item.content;
  const questions = content.quiz.questions;
  if (!questions.length) return null;
  const record = {
    ...source,
    asset: null,
    subjectIds: [...new Set([...item.subjectIds, ...source.subjectIds])],
  };
  return kind === "quiz"
    ? { ...record, kind, content: { questions, regions: content.regions } }
    : {
      ...record,
      kind,
      content: {
        cards: questions.map((question) => ({ front: question.prompt, back: questionAnswer(question) })),
        regions: content.regions,
      },
    };
}

export function getPracticeCatalog(items: readonly ContentItem[], kind: PracticeKind): PracticeItem[] {
  const published = items.filter((item) => item.status === "published");
  const resources = new Map<string, PracticeItem>();
  for (const item of published) {
    // A linked guide is the canonical source used by the video's companion panel.
    const linkedGuide = item.kind === "video" ? findVideoLinkedGuide(published, item.id) : undefined;
    if (item.kind === "guide" && item.content.linkedVideoId &&
      findVideoLinkedGuide(published, item.content.linkedVideoId)?.id !== item.id) continue;
    const resource = projectPracticeContent(item, kind, linkedGuide);
    if (!resource) continue;
    const existing = resources.get(resource.id);
    resources.set(resource.id, existing
      ? { ...resource, subjectIds: [...new Set([...existing.subjectIds, ...resource.subjectIds])] }
      : resource);
  }
  return [...resources.values()];
}

export function getStudyCatalog(items: readonly ContentItem[], kind: StudyContentKind): ContentItem[] {
  if (kind === "guide") return getGuideCatalog(items);
  if (kind === "quiz" || kind === "flashcards") return getPracticeCatalog(items, kind);
  return items.filter((item) => item.kind === kind);
}

export function getSubjectStudyCatalog(
  items: readonly ContentItem[],
  kind: StudyContentKind,
  subjectId: string,
): ContentItem[] {
  return getStudyCatalog(items, kind).filter((item) => item.subjectIds.includes(subjectId));
}
