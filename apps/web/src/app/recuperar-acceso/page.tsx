import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { CediahLogo } from "@/components/cediah-logo";

export const dynamic = "force-dynamic";

export default function RecoverAccessPage() {
  return (
    <main className="auth-page">
      <header className="auth-header">
        <Link className="brand" href="/" aria-label="Koraz, inicio">
          <CediahLogo variant="dark" />
        </Link>
        <Link href="/acceder">Volver a acceder</Link>
      </header>
      <div className="auth-content">
        <AuthForm mode="recover" />
      </div>
    </main>
  );
}
