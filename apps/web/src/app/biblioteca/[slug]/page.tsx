import { notFound } from "next/navigation";
import { ContentDetailScreen } from "@/components/content-detail-screen";
import { getPublishedContent, getPublishedContentItem } from "@/lib/server/content-api";
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
  const subjectSlug = firstSearchValue(query.asignatura)?.trim() ?? "";
  const topic = firstSearchValue(query.tema)?.trim() ?? "";
  const requestedKind = firstSearchValue(query.tipo)?.trim() ?? "";
  const returnKind = ["flashcards", "quiz", "video"].includes(requestedKind)
    ? requestedKind
    : "video";
  const returnParams = new URLSearchParams({ tipo: returnKind });
  if (subjectSlug) returnParams.set("asignatura", subjectSlug);
  if (topic) returnParams.set("tema", topic);
  const returnHref = subjectSlug || topic
    ? `/biblioteca?${returnParams.toString()}`
    : undefined;
  const [result, isAdministrator] = await Promise.all([
    getPublishedContentItem(slug),
    currentUserIsAdministrator(),
  ]);

  if (result.status === "ready") {
    const linkedGuideResult = result.item.kind === "video"
      ? await getPublishedContent({ kind: "guide", linkedVideoId: result.item.id, limit: 1 })
      : null;
    const linkedGuide = linkedGuideResult?.status === "ready"
      ? linkedGuideResult.catalog.items.find((item) => item.kind === "guide")
      : undefined;
    return (
      <ContentDetailScreen
        item={result.item}
        isAdministrator={isAdministrator}
        linkedGuide={linkedGuide}
        returnHref={returnHref}
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
