import type { ContentItem, StudyCatalogItem } from "@cediah/contracts";
import type { StudyContentKind } from "./content-navigation";
import { uniqueRegions } from "./content-regions";

function videoHasEmbeddedGuide(item: Extract<ContentItem, { kind: "video" }>) {
  return Boolean(
    item.content.guide.sections.some((section) => section.body.trim()) ||
      item.content.guide.document?.content.length,
  );
}

export function summarizeContentItem(item: ContentItem): StudyCatalogItem {
  const regions = uniqueRegions(item.content.regions);
  const common = {
    estimatedMinutes: item.estimatedMinutes,
    featured: item.featured,
    id: item.id,
    kind: item.kind,
    publishedAt: item.publishedAt,
    regions,
    slug: item.slug,
    subjectIds: item.subjectIds,
    summary: item.summary,
    title: item.title,
    topic: item.topic,
    updatedAt: item.updatedAt,
    viewCount: item.viewCount ?? 0,
  };

  if (item.kind === "video") {
    const hasQuestions = item.content.quiz.questions.length > 0;
    return {
      ...common,
      hasEmbeddedGuide: videoHasEmbeddedGuide(item),
      hasFlashcards: hasQuestions,
      hasQuiz: hasQuestions,
      linkedVideoId: null,
    };
  }
  if (item.kind === "guide") {
    const hasQuestions = item.content.quiz.questions.length > 0;
    return {
      ...common,
      hasEmbeddedGuide: false,
      hasFlashcards: hasQuestions,
      hasQuiz: hasQuestions,
      linkedVideoId: item.content.linkedVideoId,
    };
  }
  return {
    ...common,
    hasEmbeddedGuide: false,
    hasFlashcards: item.kind === "flashcards" && item.content.cards.length > 0,
    hasQuiz: item.kind === "quiz" && item.content.questions.length > 0,
    linkedVideoId: null,
  };
}

export function studyItemTopics(item: StudyCatalogItem) {
  return uniqueRegions(item.regions.length > 0 ? item.regions : item.topic ? [item.topic] : []);
}

export function studyItemSearchText(item: StudyCatalogItem) {
  return [item.title, item.summary, item.topic, ...studyItemTopics(item)]
    .filter(Boolean)
    .join(" ");
}

export function findStudyLinkedGuide(
  items: readonly StudyCatalogItem[],
  videoId: string | null | undefined,
) {
  if (!videoId) return undefined;
  let latest: StudyCatalogItem | undefined;
  for (const item of items) {
    if (item.kind !== "guide" || item.linkedVideoId !== videoId) continue;
    if (!latest || new Date(item.updatedAt).getTime() > new Date(latest.updatedAt).getTime()) {
      latest = item;
    }
  }
  return latest;
}

function mergeResource(
  resources: Map<string, StudyCatalogItem>,
  resource: StudyCatalogItem,
) {
  const existing = resources.get(resource.id);
  resources.set(resource.id, existing
    ? {
        ...resource,
        subjectIds: [...new Set([...existing.subjectIds, ...resource.subjectIds])],
      }
    : resource);
}

export function getStudySummaryCatalog(
  items: readonly StudyCatalogItem[],
  kind: StudyContentKind,
): StudyCatalogItem[] {
  if (kind === "video") return items.filter((item) => item.kind === "video");

  if (kind === "guide") {
    const guides = items.filter((item) => item.kind === "guide");
    const linkedVideoIds = new Set(
      guides.map((guide) => guide.linkedVideoId).filter((id): id is string => Boolean(id)),
    );
    const resources = new Map(guides.map((guide) => [guide.id, guide]));
    for (const item of items) {
      if (item.kind !== "video" || linkedVideoIds.has(item.id) || !item.hasEmbeddedGuide) continue;
      resources.set(item.id, { ...item, kind: "guide" });
    }
    return [...resources.values()];
  }

  const resources = new Map<string, StudyCatalogItem>();
  for (const item of items) {
    if (item.kind === kind) {
      mergeResource(resources, item);
      continue;
    }
    if (item.kind !== "video" && item.kind !== "guide") continue;

    const linkedGuide = item.kind === "video" ? findStudyLinkedGuide(items, item.id) : undefined;
    if (
      item.kind === "guide" &&
      item.linkedVideoId &&
      findStudyLinkedGuide(items, item.linkedVideoId)?.id !== item.id
    ) {
      continue;
    }

    const source = item.kind === "video" ? linkedGuide ?? item : item;
    const hasPractice = kind === "quiz" ? source.hasQuiz : source.hasFlashcards;
    if (!hasPractice) continue;

    mergeResource(resources, {
      ...source,
      kind,
      subjectIds: [...new Set([...item.subjectIds, ...source.subjectIds])],
    });
  }
  return [...resources.values()];
}

export function getSubjectStudySummaryCatalog(
  items: readonly StudyCatalogItem[],
  kind: StudyContentKind,
  subjectId: string,
) {
  return getStudySummaryCatalog(items, kind).filter((item) => item.subjectIds.includes(subjectId));
}
