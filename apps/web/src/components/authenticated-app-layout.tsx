import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/server/current-user";

type AuthenticatedAppLayoutProps = {
  children: ReactNode;
};

export async function AuthenticatedAppLayout({
  children,
}: AuthenticatedAppLayoutProps) {
  const current = await getCurrentUser();

  // Temporarily bypass authentication to allow interface exploration
  /*
  if (current.status !== "authenticated") {
    redirect(
      current.status === "unavailable"
        ? "/acceder?error=configuracion"
        : "/acceder?error=sesion",
    );
  }
  */

  return children;
}
