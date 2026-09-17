import "server-only";
import { InteractiveTermAdminListSchema, type InteractiveTermAdmin } from "@/lib/interactive-term-admin";
import { getApiRequestCookie } from "./api-session";
import { requestContentApi } from "./content-api";

export type InteractiveTermAdminListResult =
  | { status: "forbidden" | "unavailable" }
  | { status: "ready"; terms: InteractiveTermAdmin[] };

export async function getInteractiveTermAdminTerms(): Promise<InteractiveTermAdminListResult> {
  const session = await getApiRequestCookie();
  if (session.status === "anonymous") return { status: "forbidden" };

  const response = await requestContentApi({
    cookie: session.cookie,
    method: "GET",
    path: "/v1/admin/interactive-terms?active=all&limit=200",
  });
  if (response.status === 401 || response.status === 403) return { status: "forbidden" };
  if (response.status !== 200) return { status: "unavailable" };

  const parsed = InteractiveTermAdminListSchema.safeParse(response.body);
  return parsed.success
    ? { status: "ready", terms: parsed.data.terms }
    : { status: "unavailable" };
}
