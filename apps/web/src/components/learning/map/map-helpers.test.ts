import { describe, expect, it, vi } from "vitest";
import {
  buildMapHref,
  parseMapRoute,
  parentMapRoute,
  safeMapReturnHref,
  ROOT_MAP_ROUTE,
} from "./map-route";
import {
  initialLayout,
  reconcileLayout,
  resolveDropOverlap,
} from "./map-layout";
import { MapLevelCache } from "./map-level-cache";
import { MapLayoutQueue } from "./use-map-layout-save";
import { MapRequestError, type MapClient } from "./map-client";
import { mapVisualLevel, mapFixtureId } from "./map-visual-fixtures";
import { SpatialSnapshotSchema } from "./map-spatial-state";
describe("map navigation and layout", () => {
  it("round trips hierarchy and rejects return URL attacks", () => {
    const route = {
      nodeId: mapFixtureId(1),
      entryId: mapFixtureId(2),
      unitStableKey: "corazon",
    };
    expect(
      parseMapRoute(new URLSearchParams(buildMapHref(route).split("?")[1])),
    ).toEqual(route);
    expect(parentMapRoute(route).unitStableKey).toBeNull();
    expect(parentMapRoute(ROOT_MAP_ROUTE)).toEqual(ROOT_MAP_ROUTE);
    for (const href of [
      "//evil.test",
      "javascript:alert(1)",
      "/aprendizaje/mapa/evil",
      "/aprendizaje/mapa?item=bad",
      "/aprendizaje/mapa?userId=other",
      "/aprendizaje/mapa\\evil",
      "https://evil.test/aprendizaje/mapa",
    ])
      expect(safeMapReturnHref(href)).toBeNull();
    expect(safeMapReturnHref(buildMapHref(route))).toBe(buildMapHref(route));
  });
  it("200 items are deterministic; inserting and dropping only moves the new item", () => {
    const ids = Array.from({ length: 200 }, (_, i) => `${i}`),
      positions = initialLayout(ids, 1200);
    expect(initialLayout(ids, 1200)).toEqual(positions);
    expect(initialLayout(ids.slice(0, 6), 350, true)["2"]!.y).toBeGreaterThan(
      0,
    );
    expect(initialLayout(ids.slice(0, 6), 1200, true)["2"]!.y).toBe(0);
    const extended = reconcileLayout([...ids, "new"], positions, 700);
    for (const id of ids) expect(extended[id]).toEqual(positions[id]);
    expect(
      new Set(Object.values(extended).map((p) => `${p.x}:${p.y}`)).size,
    ).toBe(201);
    expect(resolveDropOverlap("0", { x: 9999, y: 9999 }, positions)).toEqual({
      x: 9999,
      y: 9999,
    });
    expect(resolveDropOverlap("0", positions["1"]!, positions)).not.toEqual(
      positions["1"],
    );
  });
  it("bounds cache and snapshot fields without private progress", () => {
    const cache = new MapLevelCache(),
      value = mapVisualLevel(ROOT_MAP_ROUTE);
    for (let i = 0; i < 30; i++) cache.set(`${i}`, value, 1000);
    expect(cache.size).toBe(12);
    expect(cache.get("29", 16001)).toBeNull();
    expect(
      SpatialSnapshotSchema.safeParse({
        schemaVersion: 1,
        viewport: { x: 0, y: 0, zoom: 1 },
        selectedOccurrenceId: null,
        focusedOccurrenceId: null,
        navigationPath: [],
        containerWidth: 100,
        containerHeight: 100,
        progress: 100,
      }).success,
    ).toBe(false);
  });
  it("fixture counts and all edge endpoints remain consistent", () => {
    const level = mapVisualLevel({
      nodeId: mapFixtureId(1),
      entryId: mapFixtureId(22),
      unitStableKey: "leccion-2",
    });
    expect(level.selectedLesson?.progress.percentage).toBe(13);
    expect(
      level.selectedLesson?.activities.filter((a) => a.state === "completed"),
    ).toHaveLength(1);
    expect(
      level.items.reduce((n, i) => n + i.progress.totalEssentialSteps!, 0),
    ).toBe(40);
    expect(
      level.items.reduce((n, i) => n + i.progress.completedEssentialSteps!, 0),
    ).toBe(15);
  });
});
describe("layout transport", () => {
  it("keeps confirmed moves when returning through an older cached level", async () => {
    const mutate = vi.fn(async () => ({ layoutVersion: 1 }));
    const queue = new MapLayoutQueue(
      { mutate } as unknown as MapClient,
      () => {},
    );
    queue.seed("root", 0);
    queue.enqueue("root", { a: { x: 200, y: 50 } });
    await vi.waitFor(() => expect(queue.state).toBe("saved"));
    queue.seed("root", 0);
    expect(queue.levels.get("root")?.version).toBe(1);
    expect(queue.positions("root")).toEqual({ a: { x: 200, y: 50 } });
    queue.seed("root", 1);
    expect(queue.positions("root")).toEqual({});
  });
  it("retries a lost response unchanged and preserves a newer drag", async () => {
    const calls: { body: unknown; key: string }[] = [];
    let succeed = false;
    const client = {
      mutate: vi.fn(async (_op: string, body: unknown, key: string) => {
        calls.push({ body, key });
        if (!succeed) throw new Error("Lost response");
        return { layoutVersion: calls.length };
      }),
    } as unknown as MapClient;
    const queue = new MapLayoutQueue(client, () => {});
    queue.seed("root", 0);
    queue.enqueue("root", { a: { x: 1, y: 1 } });
    await vi.waitFor(() => expect(queue.state).toBe("failed"));
    queue.enqueue("root", { a: { x: 2, y: 2 } });
    succeed = true;
    await queue.flush("root");
    expect(calls[1]).toEqual(calls[0]);
    expect(calls[2]?.key).not.toBe(calls[1]?.key);
    expect(calls[2]?.body).toMatchObject({
      positions: [{ id: "a", x: 2, y: 2 }],
    });
    expect(queue.pending).toBe(false);
  });
  it("never overwrites a conflict without an explicit choice", async () => {
    const client = {
      mutate: vi.fn(async () => {
        throw new MapRequestError(409, "Conflict");
      }),
    } as unknown as MapClient;
    const queue = new MapLayoutQueue(client, () => {});
    queue.seed("root", 0);
    queue.enqueue("root", { a: { x: 1, y: 1 } });
    await vi.waitFor(() => expect(queue.state).toBe("conflict"));
    await queue.flush("root");
    expect(client.mutate).toHaveBeenCalledTimes(1);
    expect(queue.positions("root")).toEqual({ a: { x: 1, y: 1 } });
    queue.resolve("root", 2, false);
    expect(queue.pending).toBe(false);
  });
});
