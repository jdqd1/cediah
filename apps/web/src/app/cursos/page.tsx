import { CoursesScreen } from "@/components/courses-screen";
import { currentUserIsAdministrator } from "@/lib/server/current-user";

export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  return <CoursesScreen isAdministrator={await currentUserIsAdministrator()} />;
}
