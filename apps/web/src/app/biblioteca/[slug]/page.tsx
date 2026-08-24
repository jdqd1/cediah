import { notFound } from "next/navigation";
import { ContentDetailScreen } from "@/components/content-detail-screen";
import { getPublishedContent, getPublishedContentItem } from "@/lib/server/content-api";
import { currentUserIsAdministrator } from "@/lib/server/current-user";

export const dynamic = "force-dynamic";

type ContentPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ContentPage({ params }: ContentPageProps) {
  const { slug } = await params;
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
