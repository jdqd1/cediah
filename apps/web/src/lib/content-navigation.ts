import type { ContentItem, ContentKind } from "@cediah/contracts";

export const studyContentKinds = ["video", "guide", "flashcards", "quiz"] as const;

export type StudyContentKind = (typeof studyContentKinds)[number];

export const studyContentKindLabels: Record<StudyContentKind, string> = {
  flashcards: "Flashcards",
  guide: "Guías",
  quiz: "Cuestionarios",
  video: "Videos",
};

export function isStudyContentKind(value: string | null | undefined): value is StudyContentKind {
  return Boolean(value && studyContentKinds.includes(value as StudyContentKind));
}

export function subjectContentHref(
  subjectSlug: string,
  kind?: StudyContentKind,
  topic?: string,
) {
  const params = new URLSearchParams();
  if (kind) params.set("tipo", kind);
  if (topic) params.set("tema", topic);
  const query = params.toString();
  return `/asignaturas/${subjectSlug}${query ? `?${query}` : ""}`;
}

export function subjectDirectoryHref(kind?: StudyContentKind) {
  return kind ? `/asignaturas?tipo=${kind}` : "/asignaturas";
}

export function publishedContentHref(
  item: ContentItem,
  context?: {
    origin?: "guias" | "asignatura";
    subjectSlug?: string;
    topic?: string;
  },
) {
  const pathname = item.kind === "guide" ? `/guias/${item.slug}` : `/contenido/${item.slug}`;
  const params = new URLSearchParams();
  if (context?.subjectSlug) params.set("asignatura", context.subjectSlug);
  if (context?.topic) params.set("tema", context.topic);
  if (isStudyContentKind(item.kind)) params.set("tipo", item.kind);
  if (context?.origin) params.set("origen", context.origin);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function contentKindLabel(kind: ContentKind) {
  if (isStudyContentKind(kind)) return studyContentKindLabels[kind];
  return "Temas";
}
