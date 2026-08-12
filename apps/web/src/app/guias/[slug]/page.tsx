import { notFound } from "next/navigation";
import { ContentDetailScreen } from "@/components/content-detail-screen";
import { getPublishedContentItem } from "@/lib/server/content-api";
import { currentUserIsAdministrator } from "@/lib/server/current-user";

export const dynamic = "force-dynamic";

type GuidePageProps = {
  params: Promise<{ slug: string }>;
};

export default async function GuidePage({ params }: GuidePageProps) {
  const { slug } = await params;
  const result = await getPublishedContentItem(slug);

  if (result.status === "ready") {
    if (result.item.kind !== "guide") notFound();
    return <ContentDetailScreen item={result.item} isAdministrator={await currentUserIsAdministrator()} />;
  }
  if (result.status === "not_found") notFound();

  return (
    <main className="content-unavailable-page">
      <h1>No pudimos cargar esta guía.</h1>
      <p>Intenta actualizar la página en unos minutos.</p>
    </main>
  );
}
