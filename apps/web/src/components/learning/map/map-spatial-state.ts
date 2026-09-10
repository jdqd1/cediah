import { z } from "zod";
import { MapRouteSchema } from "@cediah/contracts";
export const SpatialSnapshotSchema = z.strictObject({
  schemaVersion: z.literal(1),
  viewport: z.strictObject({
    x: z.number().finite(),
    y: z.number().finite(),
    zoom: z.number().min(0.65).max(1.35),
  }),
  selectedOccurrenceId: z.string().max(160).nullable(),
  focusedOccurrenceId: z.string().max(160).nullable(),
  navigationPath: z.array(MapRouteSchema).max(20),
  containerWidth: z.number().positive(),
  containerHeight: z.number().positive(),
});
export type SpatialSnapshot = z.infer<typeof SpatialSnapshotSchema>;
export function spatialKey(
  account: string,
  mapId: string,
  level: string,
  compact: boolean,
) {
  return `learning-map:v1:${account}:${mapId}:${level}:${compact ? "compact" : "wide"}`;
}
export function readSpatialSnapshot(key: string): SpatialSnapshot | null {
  try {
    const p = SpatialSnapshotSchema.safeParse(
      JSON.parse(sessionStorage.getItem(key) ?? "null"),
    );
    return p.success ? p.data : null;
  } catch {
    return null;
  }
}
export function writeSpatialSnapshot(key: string, snapshot: SpatialSnapshot) {
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify(SpatialSnapshotSchema.parse(snapshot)),
    );
  } catch {
    /* Encadre opcional; posiciones siguen en servidor. */
  }
}
export function isolateMapAccount(account: string) {
  try {
    for (const key of Object.keys(sessionStorage))
      if (
        key.startsWith("learning-map:v1:") &&
        !key.startsWith(`learning-map:v1:${account}:`)
      )
        sessionStorage.removeItem(key);
  } catch {
    /* Storage unavailable. */
  }
}
