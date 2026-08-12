import { ContentKindSchema } from "@cediah/contracts";
import { ContentLibraryScreen } from "@/components/content-library-screen";
import { getPublishedContent } from "@/lib/server/content-api";
import { currentUserIsAdministrator } from "@/lib/server/current-user";

export const dynamic = "force-dynamic";

type LibraryPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LibraryPage({ searchParams }: LibraryPageProps) {
  const params = await searchParams;
  const requestedKind = Array.isArray(params.tipo) ? params.tipo[0] : params.tipo;
  const requestedTopic = Array.isArray(params.tema) ? params.tema[0] : params.tema;
  const kind = ContentKindSchema.safeParse(requestedKind);
  const [result, isAdministrator] = await Promise.all([
    getPublishedContent({ limit: 100 }),
    currentUserIsAdministrator(),
  ]);

  return (
    <ContentLibraryScreen
      available={result.status === "ready"}
      initialKind={kind.success ? kind.data : undefined}
      initialTopic={requestedTopic}
      items={result.status === "ready" ? result.catalog.items : []}
      isAdministrator={isAdministrator}
    />
  );
}
