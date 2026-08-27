import Link from "next/link";
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

export default async function AccessPage({ searchParams }: AccessPageProps) {
  const { error, mensaje, modo, next } = await searchParams;
  const mode = modo === "registro" ? "sign-up" : "sign-in";
  const nextPath = getSafeNextPath(next);
  const toggleParameters = new URLSearchParams();
  if (mode !== "sign-up") toggleParameters.set("modo", "registro");
  if (nextPath !== "/dashboard") toggleParameters.set("next", nextPath);
  const toggleHref = `/acceder${toggleParameters.size ? `?${toggleParameters}` : ""}`;

  return (
    <main className="auth-page">
      <header className="auth-header">
        <Link className="brand" href="/" aria-label="Koraz, inicio">
          <CediahLogo variant="dark" />
        </Link>
        <Link href={toggleHref}>
          {mode === "sign-up" ? "Ya tengo cuenta" : "Crear cuenta"}
        </Link>
      </header>
      <div className="auth-content">
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
      </div>
    </main>
  );
}
