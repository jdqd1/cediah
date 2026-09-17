import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function InteractiveTermAdminPage() {
  redirect("/panel/contenido");
}
