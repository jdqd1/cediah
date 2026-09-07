import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AuthenticatedAppLayout } from "@/components/authenticated-app-layout";
import { getCurrentUser } from "@/lib/server/current-user";

export default async function GuidedLearningLayout({ children }: { children: ReactNode }) {
  const current = await getCurrentUser();
  if (current.status === "authenticated" && !current.features.guidedLearning) notFound();
  return <AuthenticatedAppLayout>{children}</AuthenticatedAppLayout>;
}
