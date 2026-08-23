import { SubjectDirectoryScreen } from "@/components/subject-directory-screen";
import { getSubjects } from "@/lib/server/content-api";
import { currentUserIsAdministrator } from "@/lib/server/current-user";

export const dynamic = "force-dynamic";

export default async function SubjectsPage() {
  const [result, isAdministrator] = await Promise.all([
    getSubjects(),
    currentUserIsAdministrator(),
  ]);

  return (
    <SubjectDirectoryScreen
      available={result.status === "ready"}
      isAdministrator={isAdministrator}
      subjects={result.status === "ready" ? result.subjects : []}
    />
  );
}
