"use client";
import { useMemo } from "react";
import type { MapLayout } from "@cediah/contracts";
import { mapVisualLevel, mapFixtureId } from "./map-visual-fixtures";
import { ROOT_MAP_ROUTE } from "./map-route";
import { MapRequestError, type MapClient } from "./map-client";
import { LearningMapWorkspace } from "./learning-map-workspace";
/** Deliberately in-memory and development-only. Never used as a failed API fallback. */
export function MapFixtureWorkspace({ mode }: { mode: string }) {
  const client = useMemo<MapClient>(() => {
    const layouts = new Map<string, MapLayout>();
    return {
      async summary() {
        const root = mapVisualLevel(ROOT_MAP_ROUTE, mode);
        return {
          map: { id: root.mapId },
          nodes: root.items,
          progress: root.containerSummary.progress,
          structuralVersion: 1,
        };
      },
      async level(route) {
        if (mode === "error")
          throw new MapRequestError(
            503,
            "No pudimos recuperar el mapa de prueba.",
          );
        const level = mapVisualLevel(route, mode);
        if (layouts.has(level.levelKey))
          level.layout = layouts.get(level.levelKey)!;
        return level;
      },
      async suggestions() {
        return { items: [], incompleteBlocks: [] };
      },
      async catalog() {
        return { items: [], nextCursor: null };
      },
      async mutate(operation, body) {
        if (operation !== "layout")
          throw new Error(
            "La edición de contenido se verifica con la API de prueba; este fixture solo muestra el diseño.",
          );
        const input = body as {
          levelKey: string;
          expectedVersion: number;
          positions: { id: string; x: number; y: number }[];
        };
        const old = layouts.get(input.levelKey);
        if ((old?.rowVersion ?? 0) !== input.expectedVersion)
          throw new MapRequestError(409, "Conflicto de fixture");
        layouts.set(input.levelKey, {
          schemaVersion: 1,
          levelKey: input.levelKey,
          rowVersion: input.expectedVersion + 1,
          positions: {
            ...old?.positions,
            ...Object.fromEntries(
              input.positions.map(({ id, x, y }) => [id, { x, y }]),
            ),
          },
        });
        return {
          mapId: mapFixtureId(900),
          structuralVersion: 1,
          affectedLevelKeys: [input.levelKey],
          changedIds: input.positions.map((p) => p.id),
          undo: null,
          layoutVersion: input.expectedVersion + 1,
        };
      },
    };
  }, [mode]);
  return <LearningMapWorkspace account="fixture-account" client={client} />;
}
