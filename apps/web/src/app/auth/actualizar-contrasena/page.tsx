import Link from "next/link";
import { redirect } from "next/navigation";
import { CediahLogo } from "@/components/cediah-logo";
import { UpdatePasswordForm } from "@/components/update-password-form";

export const dynamic = "force-dynamic";

type UpdatePasswordPageProps = {
  searchParams: Promise<{ error?: string; token?: string }>;
};

export default async function UpdatePasswordPage({
  searchParams,
}: UpdatePasswordPageProps) {
  const { error, token } = await searchParams;
  if (
    error ||
    !token ||
    token.length > 512 ||
    /[\u0000-\u001f\u007f]/.test(token)
  ) {
    redirect("/acceder?error=confirmacion");
  }

  return (
    <main className="auth-page">
      <header className="auth-header">
        <Link className="brand" href="/" aria-label="Koraz, inicio">
          <CediahLogo variant="dark" />
        </Link>
      </header>
      <div className="auth-content">
        <UpdatePasswordForm token={token} />
      </div>
    </main>
  );
}
