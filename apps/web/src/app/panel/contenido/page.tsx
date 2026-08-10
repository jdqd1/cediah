import Link from "next/link";
import { redirect } from "next/navigation";
import { ContentStudio } from "@/components/content-studio";
import { getContentWorkspace } from "@/lib/server/content-api";
import { getCurrentUser } from "@/lib/server/current-user";

export const dynamic = "force-dynamic";

export default async function ContentStudioPage() {
  const user = await getCurrentUser();
  if (user.status === "anonymous") {
    redirect("/acceder?next=/panel/contenido");
  }

  if (user.status === "unavailable") {
    return (
      <main className="studio-gate">
        <section>
          <p className="eyebrow dark">Gestión de contenido</p>
          <h1>La identidad no está disponible.</h1>
          <p>Configura Supabase Auth y la API antes de abrir el espacio editorial.</p>
          <Link href="/">Volver al inicio</Link>
        </section>
      </main>
    );
  }

  const result = await getContentWorkspace(user.accessToken);
  if (result.status === "forbidden") {
    return (
      <main className="studio-gate">
        <section>
          <p className="eyebrow dark">Acceso restringido</p>
          <h1>Esta cuenta no tiene permisos editoriales.</h1>
          <p>
            Coordinación debe asignarte el rol de colaborador de comunidad,
            presentador, editor académico o administrador.
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
