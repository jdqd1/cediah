import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

type AccessPageProps = {
  searchParams: Promise<{ next?: string; modo?: string }>;
};

export default async function AccessPage({ searchParams }: AccessPageProps) {
  const { modo, next } = await searchParams;
  const mode = modo === "registro" ? "sign-up" : "sign-in";

  return (
    <main className="auth-page">
      <header className="auth-header">
        <Link className="brand" href="/" aria-label="CEDIAH, inicio">
          <span className="brand-mark" aria-hidden="true">C</span>
          <span>CEDIAH</span>
        </Link>
        <Link href={mode === "sign-up" ? "/acceder" : "/acceder?modo=registro"}>
          {mode === "sign-up" ? "Ya tengo cuenta" : "Crear cuenta"}
        </Link>
      </header>
      <div className="auth-content">
        <AuthForm mode={mode} nextPath={next} />
        {mode === "sign-in" && <Link className="auth-helper" href="/recuperar-acceso">¿Olvidaste tu contraseña?</Link>}
      </div>
    </main>
  );
}
