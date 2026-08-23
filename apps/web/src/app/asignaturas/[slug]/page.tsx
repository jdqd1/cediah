import { notFound } from "next/navigation";
import { SubjectDetailScreen } from "@/components/subject-detail-screen";
import { getSubjectContent } from "@/lib/server/content-api";
import { currentUserIsAdministrator } from "@/lib/server/current-user";

export const dynamic = "force-dynamic";

type SubjectPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function SubjectPage({ params }: SubjectPageProps) {
  const { slug } = await params;
  const [result, isAdministrator] = await Promise.all([
    getSubjectContent(slug),
    currentUserIsAdministrator(),
  ]);

  if (result.status === "ready") {
    return (
      <SubjectDetailScreen
        isAdministrator={isAdministrator}
        items={result.detail.items}
        subject={result.detail.subject}
      />
    );
  }
  if (result.status === "not_found") notFound();

  return (
    <main className="content-unavailable-page">
      <h1>No pudimos cargar esta asignatura.</h1>
      <p>Intenta actualizar la página en unos minutos.</p>
    </main>
  );
}
