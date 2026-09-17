import { notFound } from "next/navigation";
import { ContentDetailScreen } from "@/components/content-detail-screen";
import { GuideSplitView } from "@/components/guide-split-view";
import { GuideTermProvider } from "@/components/guide-term-context";
import { subjectContentHref } from "@/lib/content-navigation";
import { getPublishedContent, getPublishedContentItem, getSubjects } from "@/lib/server/content-api";
import { currentUserIsAdministrator } from "@/lib/server/current-user";
import { getPublishedGuideTermManifest } from "@/lib/server/guide-terms-api";

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

    if (result.item.kind === "guide") {
      const compareSlug = firstSearchValue(query.compare)?.trim();
      const compareAnchor = firstSearchValue(query.compareAnchor)?.trim();
      const primaryManifestResult = await getPublishedGuideTermManifest(result.item.slug);
      const primaryManifest = primaryManifestResult.status === "ready"
        ? primaryManifestResult.manifest
        : null;

      if (compareSlug && compareSlug !== result.item.slug) {
        const [relatedResult, relatedManifestResult] = await Promise.all([
          getPublishedContentItem(compareSlug),
          getPublishedGuideTermManifest(compareSlug),
        ]);
        if (relatedResult.status === "ready" && relatedResult.item.kind === "guide") {
          return (
            <GuideSplitView
              compareAnchor={compareAnchor || undefined}
              isAdministrator={isAdministrator}
              primary={result.item}
              primaryManifest={primaryManifest}
              related={relatedResult.item}
              relatedManifest={relatedManifestResult.status === "ready" ? relatedManifestResult.manifest : null}
            />
          );
        }
      }

      const requestedSubject = firstSearchValue(query.asignatura)?.trim();
      const subjects = subjectsResult.status === "ready" ? subjectsResult.subjects : [];
      const subject = subjects.find((current) => current.slug === requestedSubject) ??
        subjects.find((current) => result.item.subjectIds.includes(current.id));
      const topic = firstSearchValue(query.tema)?.trim() ||
        result.item.content.regions[0] ||
        result.item.topic;
      const origin = firstSearchValue(query.origen)?.trim();
      const guideParams = new URLSearchParams();
      if (subject) guideParams.set("asignatura", subject.slug);
      const returnHref = origin === "asignatura" && subject
        ? subjectContentHref(subject.slug, "guide", topic || undefined)
        : `/guias${guideParams.size > 0 ? `?${guideParams.toString()}` : ""}`;

      return (
        <GuideTermProvider manifest={primaryManifest}>
          <ContentDetailScreen
            item={result.item}
            isAdministrator={isAdministrator}
            returnHref={returnHref}
            returnLabel={origin === "asignatura" && topic ? `Volver a ${topic}` : "Volver a guías"}
          />
        </GuideTermProvider>
      );
    }

    const requestedSubject = firstSearchValue(query.asignatura)?.trim();
    const subjects = subjectsResult.status === "ready" ? subjectsResult.subjects : [];
    const subject = subjects.find((current) => current.slug === requestedSubject) ??
      subjects.find((current) => result.item.subjectIds.includes(current.id));
    const topic = firstSearchValue(query.tema)?.trim() ||
      result.item.content.regions[0] ||
      result.item.topic;
    const origin = firstSearchValue(query.origen)?.trim();
    const guideParams = new URLSearchParams();
    if (subject) guideParams.set("asignatura", subject.slug);
    const returnHref = origin === "asignatura" && subject
      ? subjectContentHref(subject.slug, "guide", topic || undefined)
      : origin !== "guias"
        ? `/contenido/${result.item.slug}`
        : `/guias${guideParams.size > 0 ? `?${guideParams.toString()}` : ""}`;
    const linkedResult = await getPublishedContent({
      kind: "guide",
      linkedVideoId: result.item.id,
      limit: 1,
    });
    const linkedGuide = linkedResult.status === "ready"
      ? linkedResult.catalog.items.find((item) => item.kind === "guide")
      : undefined;
    const linkedManifestResult = linkedGuide
      ? await getPublishedGuideTermManifest(linkedGuide.slug)
      : null;

    return (
      <GuideTermProvider manifest={linkedManifestResult?.status === "ready" ? linkedManifestResult.manifest : null}>
        <ContentDetailScreen
          guideMode
          item={result.item}
          isAdministrator={isAdministrator}
          linkedGuide={linkedGuide}
          returnHref={returnHref}
          returnLabel={returnHref.startsWith("/contenido/") ? "Volver al video" : origin === "asignatura" && topic ? `Volver a ${topic}` : "Volver a guías"}
        />
      </GuideTermProvider>
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
