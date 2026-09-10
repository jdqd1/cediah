import "server-only";
import { LearningMapSummaryResponseSchema } from "@cediah/contracts";
import { getApiRequestCookie } from "./api-session";
import { requestContentApi } from "./content-api";

export async function getLearningMapSummary() {
  const session = await getApiRequestCookie();
  if (session.status === "anonymous") return null;
  const response = await requestContentApi({
    cookie: session.cookie,
    method: "GET",
    path: "/v1/guided-learning/map",
  });
  const parsed = LearningMapSummaryResponseSchema.safeParse(response.body);
  return response.status === 200 && parsed.success ? parsed.data : null;
}
