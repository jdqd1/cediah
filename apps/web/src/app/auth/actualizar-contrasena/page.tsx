import Link from "next/link";
import { UpdatePasswordForm } from "@/components/update-password-form";

export const dynamic = "force-dynamic";

export default function UpdatePasswordPage() {
  return (
    <main className="auth-page">
      <header className="auth-header">
        <Link className="brand" href="/" aria-label="CEDIAH, inicio">
          <span className="brand-mark" aria-hidden="true">C</span>
          <span>CEDIAH</span>
        </Link>
      </header>
      <div className="auth-content">
        <UpdatePasswordForm />
      </div>
    </main>
  );
}
