import type { FastifyReply, FastifyRequest } from "fastify";
import type { IdentityProvider, IdentityRequest, ProviderUser } from "@cediah/contracts";

export type GuidedUserResolution =
  | { kind: "authenticated"; user: ProviderUser }
  | { kind: "identity_unavailable" }
  | { kind: "unauthorized" };

function identityRequest(headers: FastifyRequest["headers"]): IdentityRequest {
  const forwardedFor = headers["x-forwarded-for"];
  return {
    authorization: headers.authorization,
    cookie: headers.cookie,
    forwardedFor: Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor,
    userAgent: headers["user-agent"],
  };
}

export async function resolveGuidedUser(
  request: FastifyRequest,
  identityProvider: IdentityProvider | undefined,
): Promise<GuidedUserResolution> {
  const identity = identityRequest(request.headers);
  if (!identity.authorization && !identity.cookie) return { kind: "unauthorized" };
  if (!identityProvider) return { kind: "identity_unavailable" };
  try {
    const user = await identityProvider.getUser(identity);
    return user ? { kind: "authenticated", user } : { kind: "unauthorized" };
  } catch {
    return { kind: "identity_unavailable" };
  }
}

export function sendGuidedUserError(
  resolution: Exclude<GuidedUserResolution, { kind: "authenticated" }>,
  reply: FastifyReply,
) {
  return reply.status(resolution.kind === "unauthorized" ? 401 : 503)
    .header("Cache-Control", "private, no-store")
    .send({ error: resolution.kind });
}
