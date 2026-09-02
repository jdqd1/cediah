import type { ContentDraft, ContentItem, RichTextNode } from "@cediah/contracts";

type GuideItem = Extract<ContentItem, { kind: "guide" }>;
type GuideContent = Extract<ContentDraft, { kind: "guide" }>["content"];
type VideoDraft = Extract<ContentDraft, { kind: "video" }>;

export function findVideoLinkedGuide(
  items: readonly ContentItem[],
  videoId: string | null | undefined,
): GuideItem | undefined {
  if (!videoId) return undefined;
  let latest: GuideItem | undefined;
  for (const item of items) {
    if (item.kind !== "guide" || item.content.linkedVideoId !== videoId) continue;
    if (!latest || new Date(item.updatedAt).getTime() > new Date(latest.updatedAt).getTime()) latest = item;
  }
  return latest;
}

export function getIndependentPublications(items: readonly ContentItem[]) {
  const videoIds = new Set(items.filter((item) => item.kind === "video").map((item) => item.id));
  return items.filter((item) => (
    item.kind !== "guide" || !item.content.linkedVideoId || !videoIds.has(item.content.linkedVideoId)
  ));
}

export function getVideoGuideContent(
  video: VideoDraft & { id?: string },
  linkedGuide?: GuideItem,
): GuideContent {
  return linkedGuide?.content ?? {
    ...video.content.guide,
    keyPoints: video.content.keyPoints,
    linkedVideoId: video.id ?? null,
    quiz: video.content.quiz,
    regions: video.content.regions,
  };
}

function nodeHasContent(node: RichTextNode): boolean {
  if (node.type === "text") return Boolean(node.text.trim());
  if (node.type === "image") return true;
  return "content" in node && Boolean(node.content?.some(nodeHasContent));
}

/** Read-only projections: the video remains the only stored document/asset. */
export function getGuideCatalog(items: readonly ContentItem[]): GuideItem[] {
  const guides = items.filter((item): item is GuideItem => item.kind === "guide");
  const linkedVideoIds = new Set(guides.map((guide) => guide.content.linkedVideoId).filter(Boolean));
  for (const item of items) {
    if (item.kind !== "video" || linkedVideoIds.has(item.id)) continue;
    const guide = item.content.guide;
    if (!guide.document?.content.some(nodeHasContent) && !guide.sections.some((section) => section.body.trim())) continue;
    guides.push({
      ...item,
      asset: null,
      content: getVideoGuideContent(item),
      kind: "guide",
    });
  }
  return guides;
}
