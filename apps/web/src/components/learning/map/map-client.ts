import {
  LearningMapLevelResponseSchema,
  LearningMapMutationResponseSchema,
  LearningMapSummaryResponseSchema,
  LearningMapCatalogResponseSchema,
  LearningMapSuggestionsResponseSchema,
  type MapRoute,
} from "@cediah/contracts";
import { buildMapHref } from "./map-route";
export class MapRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
async function request(path: string, init?: RequestInit) {
  const response = await fetch(`/api/guided-learning/map${path}`, {
    cache: "no-store",
    ...init,
  });
  const body: unknown = await response.json();
  if (!response.ok)
    throw new MapRequestError(
      response.status,
      response.status === 409
        ? "El mapa cambió en otra pestaña. Revisa la versión guardada."
        : response.status === 404
          ? "Este contenido ya no está disponible en tu mapa."
          : response.status === 422
            ? "Esta operación supera el límite del mapa o contiene contenido no disponible."
            : "No pudimos confirmar el cambio. Reintenta con conexión.",
    );
  return body;
}
export const mapQuery = (r: MapRoute) => buildMapHref(r).split("?")[1] ?? "";
export const mapClient = {
  summary: async () =>
    LearningMapSummaryResponseSchema.parse(await request("")),
  level: async (route: MapRoute, signal?: AbortSignal) =>
    LearningMapLevelResponseSchema.parse(
      await request(`/level?${mapQuery(route)}`, { signal }),
    ),
  suggestions: async (route: MapRoute, signal?: AbortSignal) =>
    LearningMapSuggestionsResponseSchema.parse(
      await request(`/suggestions?${mapQuery(route)}`, { signal }),
    ),
  catalog: async (query: URLSearchParams, signal?: AbortSignal) =>
    LearningMapCatalogResponseSchema.parse(
      await request(`/catalog?${query}`, { signal }),
    ),
  mutate: async (operation: string, body: unknown, idempotencyKey: string) =>
    LearningMapMutationResponseSchema.parse(
      await request(`/${operation}`, {
        method:
          operation === "layout" || operation.startsWith("nodes/")
            ? "PATCH"
            : "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(body),
      }),
    ),
};
export type MapClient = typeof mapClient;
