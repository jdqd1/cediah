import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/server/current-user";
import { AccessProvider } from "./access-context";

type AuthenticatedAppLayoutProps = {
  children: ReactNode;
};

export async function AuthenticatedAppLayout({
  children,
}: AuthenticatedAppLayoutProps) {
  const current = await getCurrentUser();

  if (current.status !== "authenticated") {
    redirect(
      current.status === "unavailable"
        ? "/acceder?error=configuracion"
        : "/acceder?error=sesion",
    );
  }

  return <AccessProvider roles={current.roles}>{children}</AccessProvider>;
}
