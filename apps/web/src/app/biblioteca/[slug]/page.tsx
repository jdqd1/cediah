import { notFound } from "next/navigation";
import { ContentDetailScreen } from "@/components/content-detail-screen";
import { getPublishedContentItem } from "@/lib/server/content-api";
import { currentUserIsAdministrator } from "@/lib/server/current-user";

export const dynamic = "force-dynamic";

type ContentPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ContentPage({ params }: ContentPageProps) {
  const { slug } = await params;
  const result = await getPublishedContentItem(slug);

  if (result.status === "ready") {
    return <ContentDetailScreen item={result.item} isAdministrator={await currentUserIsAdministrator()} />;
  }
  if (result.status === "not_found") notFound();

  return (
    <main className="content-unavailable-page">
      <h1>No pudimos cargar este contenido.</h1>
      <p>Intenta actualizar la página en unos minutos.</p>
    </main>
  );
}
