import { MapQuerySchema, type MapRoute } from "@cediah/contracts";
export const ROOT_MAP_ROUTE: MapRoute = {
  nodeId: null,
  entryId: null,
  unitStableKey: null,
};
export function parseMapRoute(params: URLSearchParams): MapRoute | null {
  const parsed = MapQuerySchema.safeParse(
    Object.fromEntries(
      ["node", "item", "unit"].flatMap((k) =>
        params.has(k) ? [[k, params.get(k)]] : [],
      ),
    ),
  );
  return parsed.success
    ? {
        nodeId: parsed.data.node ?? null,
        entryId: parsed.data.item ?? null,
        unitStableKey: parsed.data.unit ?? null,
      }
    : null;
}
export function buildMapHref(route: MapRoute, detail = false) {
  const q = new URLSearchParams();
  if (route.nodeId) q.set("node", route.nodeId);
  if (route.entryId) q.set("item", route.entryId);
  if (route.unitStableKey) q.set("unit", route.unitStableKey);
  if (detail) q.set("detail", "1");
  return `/aprendizaje/mapa${q.size ? `?${q}` : ""}`;
}
export function parentMapRoute(r: MapRoute): MapRoute {
  return r.unitStableKey
    ? { ...r, unitStableKey: null }
    : r.entryId
      ? { ...r, entryId: null }
      : ROOT_MAP_ROUTE;
}
export function mapNavigationHref(href: string) {
  if (
    typeof window === "undefined" ||
    window.location.pathname !== "/visual-fixtures/mapa"
  )
    return href;
  const query = new URLSearchParams(href.split("?")[1]);
  const mode = new URLSearchParams(window.location.search).get("estado");
  if (mode) query.set("estado", mode);
  return `/visual-fixtures/mapa${query.size ? `?${query}` : ""}`;
}
export function safeMapReturnHref(
  value: string | null | undefined,
): string | null {
  if (!value || !value.startsWith("/aprendizaje/mapa") || /[\\\s]/.test(value))
    return null;
  try {
    const u = new URL(value, "https://map.local");
    if (
      u.origin !== "https://map.local" ||
      u.pathname !== "/aprendizaje/mapa" ||
      u.hash
    )
      return null;
    if (
      [...u.searchParams.keys()].some(
        (k) => !["node", "item", "unit", "detail"].includes(k),
      )
    )
      return null;
    const route = parseMapRoute(u.searchParams);
    return route
      ? buildMapHref(route, u.searchParams.get("detail") === "1")
      : null;
  } catch {
    return null;
  }
}
