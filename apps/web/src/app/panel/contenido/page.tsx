import Link from "next/link";
import { redirect } from "next/navigation";
import { ContentStudio } from "@/components/content-studio";
import { getContentWorkspace } from "@/lib/server/content-api";

export const dynamic = "force-dynamic";

export default async function ContentStudioPage() {
  // The protected editorial request already authenticates the session and resolves
  // editor roles, so a separate /v1/auth/me request only adds duplicated work.
  const result = await getContentWorkspace();

  if (result.status === "anonymous") {
    redirect("/acceder?next=/panel/contenido");
  }

  if (result.status === "forbidden") {
    return (
      <main className="studio-gate">
        <section>
          <p className="eyebrow dark">Acceso restringido</p>
          <h1>Esta cuenta no tiene permisos editoriales.</h1>
          <p>
            Un administrador debe asignarte el rol de creador de contenido,
            coordinador o administrador.
          </p>
          <Link href="/panel">Volver a mi panel</Link>
        </section>
      </main>
    );
  }

  if (result.status === "unavailable") {
    return (
      <main className="studio-gate">
        <section>
          <p className="eyebrow dark">Gestión de contenido</p>
          <h1>No pudimos cargar el espacio editorial.</h1>
          <p>La sesión sigue protegida. Intenta actualizar en unos minutos.</p>
          <Link href="/panel">Volver a mi panel</Link>
        </section>
      </main>
    );
  }

  return <ContentStudio initialWorkspace={result.workspace} />;
}
