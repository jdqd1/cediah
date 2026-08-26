import Link from "next/link";
import { redirect } from "next/navigation";
import { CediahLogo } from "@/components/cediah-logo";
import { UpdatePasswordForm } from "@/components/update-password-form";
import { getCurrentUser } from "@/lib/server/current-user";

export const dynamic = "force-dynamic";

export default async function UpdatePasswordPage() {
  const current = await getCurrentUser();
  if (current.status !== "authenticated") {
    redirect(
      current.status === "unavailable"
        ? "/acceder?error=configuracion"
        : "/acceder?error=sesion",
    );
  }

  return (
    <main className="auth-page">
      <header className="auth-header">
        <Link className="brand" href="/" aria-label="Koraz, inicio">
          <CediahLogo variant="dark" />
        </Link>
      </header>
      <div className="auth-content">
        <UpdatePasswordForm />
      </div>
    </main>
  );
}
