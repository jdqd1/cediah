import { notFound } from "next/navigation";
import { ContentDetailScreen } from "@/components/content-detail-screen";
import { subjectContentHref } from "@/lib/content-navigation";
import { getPublishedContent, getPublishedContentItem, getSubjects } from "@/lib/server/content-api";
import { currentUserIsAdministrator } from "@/lib/server/current-user";

export const dynamic = "force-dynamic";

type GuidePageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function GuidePage({ params, searchParams }: GuidePageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const [result, subjectsResult, isAdministrator] = await Promise.all([
    getPublishedContentItem(slug),
    getSubjects(),
    currentUserIsAdministrator(),
  ]);

  if (result.status === "ready") {
    if (result.item.kind !== "guide" && result.item.kind !== "video") notFound();
    const requestedSubject = firstSearchValue(query.asignatura)?.trim();
    const subjects = subjectsResult.status === "ready" ? subjectsResult.subjects : [];
    const subject = subjects.find((current) => current.slug === requestedSubject) ??
      subjects.find((current) => result.item.subjectIds.includes(current.id));
    const topic = firstSearchValue(query.tema)?.trim() ||
      result.item.content.regions[0] ||
      result.item.topic;
    const origin = firstSearchValue(query.origen)?.trim();
    const guideMode = result.item.kind === "video";
    const guideParams = new URLSearchParams();
    if (subject) guideParams.set("asignatura", subject.slug);
    const returnHref = origin === "asignatura" && subject
        ? subjectContentHref(subject.slug, "guide", topic || undefined)
        : guideMode && origin !== "guias"
          ? `/contenido/${result.item.slug}`
          : `/guias${guideParams.size > 0 ? `?${guideParams.toString()}` : ""}`;
    const linkedResult = guideMode
      ? await getPublishedContent({ kind: "guide", linkedVideoId: result.item.id, limit: 1 })
      : null;
    const linkedGuide = linkedResult?.status === "ready"
      ? linkedResult.catalog.items.find((item) => item.kind === "guide")
      : undefined;
    return (
      <ContentDetailScreen
        guideMode={guideMode}
        item={result.item}
        isAdministrator={isAdministrator}
        linkedGuide={linkedGuide}
        returnHref={returnHref}
        returnLabel={returnHref.startsWith("/contenido/") ? "Volver al video" : origin === "asignatura" && topic ? `Volver a ${topic}` : "Volver a guías"}
      />
    );
  }
  if (result.status === "not_found") notFound();

  return (
    <main className="content-unavailable-page">
      <h1>No pudimos cargar esta guía.</h1>
      <p>Intenta actualizar la página en unos minutos.</p>
    </main>
  );
}
