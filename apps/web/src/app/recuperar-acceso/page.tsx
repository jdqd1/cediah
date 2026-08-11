import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export const dynamic = "force-dynamic";

export default function RecoverAccessPage() {
  return (
    <main className="auth-page">
      <header className="auth-header">
        <Link className="brand" href="/" aria-label="CEDIAH, inicio">
          <span className="brand-mark" aria-hidden="true">C</span>
          <span>CEDIAH</span>
        </Link>
        <Link href="/acceder">Volver a acceder</Link>
      </header>
      <div className="auth-content">
        <AuthForm mode="recover" />
      </div>
    </main>
  );
}
