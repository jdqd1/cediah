import Link from "next/link";
import { redirect } from "next/navigation";
import { getContentWorkspace } from "@/lib/server/content-api";
import { getCurrentUser } from "@/lib/server/current-user";
import { getLearningDashboard } from "@/lib/server/learning-dashboard";
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

  const [learning, editorial] = await Promise.all([
    getLearningDashboard(result.accessToken),
    getContentWorkspace(result.accessToken),
  ]);

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
        <p>Tu acceso fue validado por la API. Solo verás cursos con una matrícula vigente.</p>
        {learning.status === "ready" ? (
          learning.dashboard.courses.length > 0 ? (
            <section className="learning-summary" aria-labelledby="learning-summary-title">
              <div>
                <p className="eyebrow">Mi aprendizaje</p>
                <h2 id="learning-summary-title">Cursos activos</h2>
              </div>
              <ul className="learning-course-list">
                {learning.dashboard.courses.map((course) => {
                  const percentage =
                    course.progress.totalLessons === 0
                      ? 0
                      : Math.round((course.progress.completedLessons / course.progress.totalLessons) * 100);

                  return (
                    <li key={course.id} className="learning-course">
                      <div>
                        <h3>{course.title}</h3>
                        <p>
                          {course.progress.completedLessons} de {course.progress.totalLessons} lecciones completadas
                        </p>
                      </div>
                      <progress
                        aria-label={`Progreso de ${course.title}`}
                        max={100}
                        value={percentage}
                      >
                        {percentage}%
                      </progress>
                      <span>{percentage}%</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : (
            <section className="learning-summary" aria-labelledby="learning-summary-title">
              <p className="eyebrow">Mi aprendizaje</p>
              <h2 id="learning-summary-title">Aún no tienes cursos activos.</h2>
              <p>
                Cuando coordinación apruebe una matrícula, el curso y su progreso aparecerán aquí.
              </p>
            </section>
          )
        ) : (
          <p className="learning-unavailable" role="status">
            No pudimos cargar tus matrículas en este momento. Tu sesión sigue protegida; intenta actualizar la página más tarde.
          </p>
        )}
        {editorial.status === "ready" && (
          <Link className="button button-primary" href="/panel/contenido">
            Gestionar contenido académico
          </Link>
        )}
        {editorial.status === "ready" && editorial.workspace.roles.includes("administrator") && (
          <Link className="button button-secondary" href="/panel/administracion/roles">
            Administrar roles
          </Link>
        )}        <Link className="button button-primary" href="/cursos">Explorar catálogo</Link>
        <Link className="text-link" href="/pruebas/video">
          Abrir laboratorio de video de prueba <span aria-hidden="true">→</span>
        </Link>
      </section>
    </main>
  );
}
