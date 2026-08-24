import { notFound } from "next/navigation";
import { ContentDetailScreen } from "@/components/content-detail-screen";
import { isStudyContentKind, subjectContentHref } from "@/lib/content-navigation";
import {
  getPublishedContent,
  getPublishedContentItem,
  getSubjects,
} from "@/lib/server/content-api";
import { currentUserIsAdministrator } from "@/lib/server/current-user";

export const dynamic = "force-dynamic";

type ContentPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ContentPage({ params, searchParams }: ContentPageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const [result, subjectsResult, isAdministrator] = await Promise.all([
    getPublishedContentItem(slug),
    getSubjects(),
    currentUserIsAdministrator(),
  ]);

  if (result.status === "ready") {
    const requestedSubject = firstSearchValue(query.asignatura)?.trim();
    const subjects = subjectsResult.status === "ready" ? subjectsResult.subjects : [];
    const subject = subjects.find((current) => current.slug === requestedSubject) ??
      subjects.find((current) => result.item.subjectIds.includes(current.id));
    const requestedKind = firstSearchValue(query.tipo)?.trim();
    const kind = isStudyContentKind(requestedKind)
      ? requestedKind
      : isStudyContentKind(result.item.kind)
        ? result.item.kind
        : undefined;
    const topic = firstSearchValue(query.tema)?.trim() ||
      result.item.content.regions[0] ||
      result.item.topic;
    const returnHref = subject
      ? subjectContentHref(subject.slug, kind, topic || undefined)
      : "/asignaturas";
    const returnLabel = topic
      ? `Volver a ${topic}`
      : subject
        ? `Volver a ${subject.name}`
        : "Volver a asignaturas";
    const linkedGuideResult = result.item.kind === "video"
      ? await getPublishedContent({ kind: "guide", linkedVideoId: result.item.id, limit: 1 })
      : null;
    const linkedGuide = linkedGuideResult?.status === "ready"
      ? linkedGuideResult.catalog.items.find((item) => item.kind === "guide")
      : undefined;

    return (
      <ContentDetailScreen
        contextLabel={subject?.name}
        item={result.item}
        isAdministrator={isAdministrator}
        linkedGuide={linkedGuide}
        returnHref={returnHref}
        returnLabel={returnLabel}
      />
    );
  }
  if (result.status === "not_found") notFound();

  return (
    <main className="content-unavailable-page">
      <h1>No pudimos cargar este contenido.</h1>
      <p>Intenta actualizar la página en unos minutos.</p>
    </main>
  );
}
