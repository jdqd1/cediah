import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type ContentPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ContentPage({ params, searchParams }: ContentPageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const nextQuery = new URLSearchParams();
  for (const key of ["asignatura", "tema", "tipo", "origen"] as const) {
    const value = firstSearchValue(query[key])?.trim();
    if (value) nextQuery.set(key, value);
  }
  const suffix = nextQuery.toString();
  redirect(`/contenido/${slug}${suffix ? `?${suffix}` : ""}`);
}
