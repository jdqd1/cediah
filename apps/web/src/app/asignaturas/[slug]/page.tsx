import { notFound } from "next/navigation";
import { SubjectDetailScreen } from "@/components/subject-detail-screen";
import { findVideoLinkedGuide } from "@/lib/content-guide-links";
import { getPublishedContent, getSubjectContent } from "@/lib/server/content-api";
import { currentUserIsAdministrator } from "@/lib/server/current-user";

export const dynamic = "force-dynamic";

type SubjectPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function SubjectPage({ params }: SubjectPageProps) {
  const { slug } = await params;
  const [result, catalog, isAdministrator] = await Promise.all([
    getSubjectContent(slug),
    getPublishedContent({ kind: "guide", limit: 100 }),
    currentUserIsAdministrator(),
  ]);

  if (result.status === "ready") {
    const itemsById = new Map(result.detail.items.map((item) => [item.id, item]));
    if (catalog.status === "ready") {
      for (const item of result.detail.items) {
        if (item.kind !== "video") continue;
        const linkedGuide = findVideoLinkedGuide(catalog.catalog.items, item.id);
        if (linkedGuide && !itemsById.has(linkedGuide.id)) {
          itemsById.set(linkedGuide.id, linkedGuide);
        }
      }
    }
    return (
      <SubjectDetailScreen
        isAdministrator={isAdministrator}
        items={[...itemsById.values()]}
        subject={result.detail.subject}
      />
    );
  }
  if (result.status === "not_found") notFound();

  return (
    <main className="content-unavailable-page">
      <h1>No pudimos cargar esta materia.</h1>
      <p>Intenta actualizar la página en unos minutos.</p>
    </main>
  );
}
