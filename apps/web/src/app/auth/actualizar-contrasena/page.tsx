import Link from "next/link";
import { CediahLogo } from "@/components/cediah-logo";
import { UpdatePasswordForm } from "@/components/update-password-form";

export const dynamic = "force-dynamic";

export default function UpdatePasswordPage() {
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
