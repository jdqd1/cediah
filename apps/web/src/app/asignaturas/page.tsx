import { SubjectDirectoryScreen } from "@/components/subject-directory-screen";
import { isStudyContentKind } from "@/lib/content-navigation";
import { getPublishedContent, getSubjects } from "@/lib/server/content-api";
import { currentUserIsAdministrator } from "@/lib/server/current-user";

export const dynamic = "force-dynamic";

type SubjectsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SubjectsPage({ searchParams }: SubjectsPageProps) {
  const params = await searchParams;
  const requestedKind = Array.isArray(params.tipo) ? params.tipo[0] : params.tipo;
  const kind = isStudyContentKind(requestedKind) ? requestedKind : undefined;
  const [result, isAdministrator, contentResult] = await Promise.all([
    getSubjects(),
    currentUserIsAdministrator(),
    kind ? getPublishedContent({ kind, limit: 100 }) : Promise.resolve(null),
  ]);

  return (
    <SubjectDirectoryScreen
      available={result.status === "ready"}
      initialKind={kind}
      isAdministrator={isAdministrator}
      items={contentResult?.status === "ready" ? contentResult.catalog.items : []}
      subjects={result.status === "ready" ? result.subjects : []}
    />
  );
}
