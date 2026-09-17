import Link from "next/link";
import { redirect } from "next/navigation";
import { InteractiveTermAdminScreen } from "@/components/interactive-term-admin-screen";
import { getInteractiveTermAdminTerms } from "@/lib/server/interactive-term-admin-api";
import { getCurrentUser } from "@/lib/server/current-user";

export const dynamic = "force-dynamic";

export default async function InteractiveTermAdminPage() {
  const current = await getCurrentUser();
  if (current.status === "anonymous") {
    redirect("/acceder?next=/panel/administracion/terminos");
  }

  if (current.status === "unavailable") {
    return (
      <main className="studio-gate">
        <section>
          <p className="eyebrow dark">Términos interactivos</p>
          <h1>La identidad no está disponible.</h1>
          <p>La administración del diccionario requiere una sesión verificada.</p>
          <Link href="/panel">Volver al panel</Link>
        </section>
      </main>
    );
  }

  if (!current.roles.includes("administrator")) {
    return (
      <main className="studio-gate">
        <section>
          <p className="eyebrow dark">Acceso restringido</p>
          <h1>Sólo un administrador puede gestionar el diccionario global.</h1>
          <p>Los creadores de contenido pueden seguir publicando guías sin modificar las reglas globales de términos.</p>
          <Link href="/panel">Volver a mi panel</Link>
        </section>
      </main>
    );
  }

  const terms = await getInteractiveTermAdminTerms();
  if (terms.status !== "ready") {
    return (
      <main className="studio-gate">
        <section>
          <p className="eyebrow dark">Términos interactivos</p>
          <h1>No pudimos cargar el diccionario.</h1>
          <p>La sesión sigue protegida. Verifica la API y las migraciones antes de editar términos.</p>
          <Link href="/panel">Volver al panel</Link>
        </section>
      </main>
    );
  }

  return <InteractiveTermAdminScreen initialTerms={terms.terms} viewerEmail={current.user.email} />;
}
