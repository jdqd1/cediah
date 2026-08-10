import Link from "next/link";
import { redirect } from "next/navigation";
import { VideoTestUploader } from "@/components/video-test-uploader";
import { getCurrentUser } from "@/lib/server/current-user";

export const dynamic = "force-dynamic";

export default async function VideoTestPage() {
  const currentUser = await getCurrentUser();
  if (currentUser.status === "anonymous") redirect("/acceder?next=/pruebas/video");

  if (currentUser.status === "unavailable") {
    return (
      <main className="auth-page">
        <header className="auth-header">
          <Link className="brand" href="/" aria-label="CEDIAH, inicio">
            <span className="brand-mark" aria-hidden="true">C</span>
            <span>CEDIAH</span>
          </Link>
        </header>
        <div className="auth-content">
          <section className="auth-form" aria-labelledby="video-test-setup-title">
            <p className="eyebrow">Laboratorio de video</p>
            <h1 id="video-test-setup-title">La prueba privada aún no está disponible.</h1>
            <p>
              Este ambiente necesita Supabase, la API y Cloudflare Stream configurados antes de
              emitir enlaces de carga de prueba.
            </p>
            <Link className="button button-primary" href="/">
              Volver al inicio
            </Link>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="video-test-page">
      <div className="video-test-top">
        <header className="site-header course-header">
          <Link className="brand" href="/" aria-label="CEDIAH, inicio">
            <span className="brand-mark" aria-hidden="true">C</span>
            <span>CEDIAH</span>
          </Link>
          <nav aria-label="Navegación del laboratorio de video">
            <Link href="/panel">Panel</Link>
            <Link href="/#cursos">Catálogo</Link>
            <Link className="nav-cta" href="/acceder">
              Cuenta
            </Link>
          </nav>
        </header>

        <section className="video-test-hero" aria-labelledby="video-test-title">
          <div>
            <p className="eyebrow">Laboratorio interno / Video</p>
            <h1 id="video-test-title">Prueba el reproductor con tu propio video.</h1>
            <p>
              Esta área sirve únicamente para validar carga, procesamiento y reproducción privada
              antes de publicar contenido académico.
            </p>
          </div>
          <aside className="video-test-account">
            <span className="lesson-status-dot" aria-hidden="true" />
            <div>
              <strong>Cuenta de prueba autenticada</strong>
              <p>{currentUser.user.email}</p>
            </div>
          </aside>
        </section>
      </div>

      <section className="video-test-shell" aria-labelledby="video-test-upload-title">
        <div className="video-test-guidance">
          <p className="eyebrow dark">Antes de cargar</p>
          <h2>Un entorno aislado para comprobar el flujo completo.</h2>
          <ol>
            <li>El servidor confirma que esta cuenta está permitida para probar.</li>
            <li>Cloudflare Stream recibe el archivo mediante un enlace de un solo uso.</li>
            <li>Cuando termine el procesamiento, la misma cuenta recibe un reproductor firmado.</li>
          </ol>
          <p className="video-test-warning">
            Usa solo material de prueba propio. No subas clases, datos de pacientes, material con
            derechos de terceros ni contenido que pueda confundirse con una lección publicada.
          </p>
        </div>
        <VideoTestUploader />
      </section>

      <footer>
        <span>CEDIAH</span>
        <p>Prueba privada del reproductor - no publica contenido académico</p>
        <p>Caracas, Venezuela</p>
      </footer>
    </main>
  );
}
