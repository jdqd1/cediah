import Image from "next/image";
import Link from "next/link";
import { BookOpen, ImagesSquare, MonitorPlay } from "@phosphor-icons/react/dist/ssr";
import { AuthForm } from "@/components/auth-form";
import { CediahLogo } from "@/components/cediah-logo";
import { getSafeNextPath } from "@/lib/auth/validation";

type AccessPageProps = {
  searchParams: Promise<{
    error?: string;
    mensaje?: string;
    next?: string;
    modo?: string;
  }>;
};

const callbackErrorMessages: Record<string, string> = {
  confirmacion: "El enlace de acceso no es válido o ya expiró. Solicita uno nuevo.",
  configuracion: "El acceso no está disponible en este ambiente.",
  sesion: "Tu sesión terminó. Inicia sesión de nuevo para continuar.",
};

const authMessages: Record<string, string> = {
  "contrasena-actualizada":
    "Tu contraseña fue actualizada. Inicia sesión con la nueva contraseña.",
};

const learningResources = [
  { label: "Materias médicas", icon: BookOpen },
  { label: "Videos y guías", icon: MonitorPlay },
  { label: "Flashcards", icon: ImagesSquare },
] as const;

export default async function AccessPage({ searchParams }: AccessPageProps) {
  const { error, mensaje, modo, next } = await searchParams;
  const mode = modo === "registro" ? "sign-up" : "sign-in";
  const nextPath = getSafeNextPath(next);
  const toggleParameters = new URLSearchParams();
  if (mode !== "sign-up") toggleParameters.set("modo", "registro");
  if (nextPath !== "/dashboard") toggleParameters.set("next", nextPath);
  const toggleHref = `/acceder${toggleParameters.size ? `?${toggleParameters}` : ""}`;

  return (
    <main className={`auth-page auth-page-paper auth-page-${mode}`}>
      <header className="auth-header">
        <Link className="brand" href="/" aria-label="Koraz, inicio">
          <CediahLogo variant="dark" priority />
        </Link>
        <div className="auth-header-actions">
          <span>
            {mode === "sign-up" ? "¿Ya tienes una cuenta?" : "¿Aún no tienes una cuenta?"}
          </span>
          <Link className="auth-mode-link" href={toggleHref}>
            {mode === "sign-up" ? "Inicia sesión" : "Regístrate"}
          </Link>
        </div>
      </header>
      <div className="auth-content">
        <aside className="auth-showcase" aria-label="Recursos de aprendizaje de Koraz">
          <div className="auth-showcase-copy">
            <span className="auth-showcase-kicker">Todo en un solo lugar</span>
            <h2>
              Estudia a tu manera.
              <span>Llega más lejos.</span>
            </h2>
            <p>
              Combina tus apuntes de siempre con herramientas digitales que te ayudan a avanzar.
            </p>
          </div>

          <ul className="auth-resource-list" aria-label="Recursos disponibles">
            {learningResources.map(({ label, icon: Icon }) => (
              <li key={label}>
                <Icon aria-hidden="true" size={20} weight="regular" />
                <span>{label}</span>
              </li>
            ))}
          </ul>

          <div className="auth-showcase-art" aria-hidden="true">
            <Image
              alt=""
              height={1024}
              priority
              sizes="(max-width: 960px) 1px, 62vw"
              src="/landing/platform-devices.png"
              width={1536}
            />
          </div>
        </aside>

        <section className="auth-form-panel" aria-label={mode === "sign-up" ? "Registro" : "Inicio de sesión"}>
          <AuthForm
            initialMessage={
              error
                ? callbackErrorMessages[error]
                : mensaje
                  ? authMessages[mensaje]
                  : undefined
            }
            initialMessageTone={mensaje && !error ? "success" : "error"}
            mode={mode}
            nextPath={nextPath}
          />
          <p className="auth-privacy-note">
            Tus datos se usan únicamente para proteger y gestionar tu cuenta.
          </p>
        </section>
      </div>
    </main>
  );
}
