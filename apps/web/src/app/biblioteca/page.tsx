import { redirect } from "next/navigation";
import {
  isStudyContentKind,
  subjectContentHref,
  subjectDirectoryHref,
} from "@/lib/content-navigation";

export const dynamic = "force-dynamic";

type LibraryPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LibraryPage({ searchParams }: LibraryPageProps) {
  const params = await searchParams;
  const requestedKind = Array.isArray(params.tipo) ? params.tipo[0] : params.tipo;
  const requestedTopic = Array.isArray(params.tema) ? params.tema[0] : params.tema;
  const requestedSubject = Array.isArray(params.asignatura) ? params.asignatura[0] : params.asignatura;
  const kind = isStudyContentKind(requestedKind) ? requestedKind : undefined;
  const subject = requestedSubject?.trim();
  const topic = requestedTopic?.trim();

  if (subject) redirect(subjectContentHref(subject, kind, topic));
  redirect(subjectDirectoryHref(kind));
}
