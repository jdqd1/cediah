import Link from "next/link";
import { redirect } from "next/navigation";
import { RoleManagementScreen } from "@/components/role-management-screen";
import { getAdminRoleUser } from "@/lib/server/admin-role-api";
import { getCurrentUser } from "@/lib/server/current-user";

export const dynamic = "force-dynamic";

export default async function RoleManagementPage() {
  const current = await getCurrentUser();
  if (current.status === "anonymous") redirect("/acceder?next=/panel/administracion/roles");

  if (current.status === "unavailable") {
    return (
      <main className="studio-gate">
        <section>
          <p className="eyebrow dark">Administración de roles</p>
          <h1>La identidad no está disponible.</h1>
          <p>Configura Supabase Auth y la API antes de abrir el control de acceso.</p>
          <Link href="/panel">Volver al panel</Link>
        </section>
      </main>
    );
  }

  const result = await getAdminRoleUser(current.accessToken, current.user.email);
  if (result.status === "forbidden") {
    return (
      <main className="studio-gate">
        <section>
          <p className="eyebrow dark">Acceso restringido</p>
          <h1>Sólo un administrador puede asignar roles.</h1>
          <p>Solicita a la cuenta administradora inicial que te otorgue permisos desde el SQL Editor de Supabase.</p>
          <Link href="/panel">Volver a mi panel</Link>
        </section>
      </main>
    );
  }

  if (result.status !== "ready") {
    return (
      <main className="studio-gate">
        <section>
          <p className="eyebrow dark">Administración de roles</p>
          <h1>No pudimos cargar el control de acceso.</h1>
          <p>La sesión sigue protegida. Intenta actualizar en unos minutos.</p>
          <Link href="/panel">Volver al panel</Link>
        </section>
      </main>
    );
  }

  return <RoleManagementScreen initialUser={result.user} />;
}