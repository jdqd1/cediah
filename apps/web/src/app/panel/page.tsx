import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server/current-user";
import { signOut } from "./actions";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const result = await getCurrentUser();
  if (result.status === "anonymous") redirect("/acceder?next=/panel");

  if (result.status === "unavailable") {
    return (
      <main className="auth-page">
        <header className="auth-header">
          <Link className="brand" href="/" aria-label="CEDIAH, inicio">
            <span className="brand-mark" aria-hidden="true">C</span>
            <span>CEDIAH</span>
          </Link>
        </header>
        <div className="auth-content">
          <section className="auth-form" aria-labelledby="access-setup-title">
            <p className="eyebrow">Acceso protegido</p>
            <h1 id="access-setup-title">El panel estará disponible pronto.</h1>
            <p>La identidad o la API todavía no están configuradas para este ambiente.</p>
            <Link className="button button-primary" href="/">Volver al inicio</Link>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="dashboard-page">
      <header className="auth-header dashboard-header">
        <Link className="brand" href="/" aria-label="CEDIAH, inicio">
          <span className="brand-mark" aria-hidden="true">C</span>
          <span>CEDIAH</span>
        </Link>
        <form action={signOut}>
          <button className="text-button" type="submit">Cerrar sesión</button>
        </form>
      </header>
      <section className="dashboard-content" aria-labelledby="dashboard-title">
        <p className="eyebrow">Panel del estudiante</p>
        <h1 id="dashboard-title">Hola, {result.user.email}.</h1>
        <p>Tu acceso fue validado por la API. El curso vertical aparecerá aquí cuando coordinación entregue el contenido autorizado.</p>
        <Link className="button button-primary" href="/cursos">Explorar catálogo demo</Link>
        <Link className="text-link" href="/pruebas/video">
          Abrir laboratorio de video de prueba <span aria-hidden="true">→</span>
        </Link>
      </section>
    </main>
  );
}
