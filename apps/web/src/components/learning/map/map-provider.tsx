"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import type { LearningMapLevelResponse, MapRoute } from "@cediah/contracts";
import { mapClient, type MapClient } from "./map-client";
import { MapLevelCache } from "./map-level-cache";
import { MapLayoutQueue } from "./use-map-layout-save";
import {
  buildMapHref,
  parseMapRoute,
  parentMapRoute,
  ROOT_MAP_ROUTE,
  mapNavigationHref,
} from "./map-route";
import { isolateMapAccount } from "./map-spatial-state";

function useWorkspace(account: string, client: MapClient) {
  const search = useSearchParams();
  const parsedRoute = parseMapRoute(search);
  const routeKey = parsedRoute
    ? buildMapHref(parsedRoute)
    : `/aprendizaje/mapa?${search}`;
  const [level, setLevel] = useState<LearningMapLevelResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<"idle" | "exiting" | "entering">("idle");
  const [, render] = useReducer((n) => n + 1, 0);
  const cache = useMemo(() => new MapLevelCache(), []);
  const queue = useMemo(() => new MapLayoutQueue(client, render), [client]);
  const token = useRef(0),
    prefetchCount = useRef(0),
    history = useRef<string[]>([]);
  const ensureKey = useRef<string | null>(null);
  const cacheGeneration = useRef(0);
  const levelRef = useRef(level);
  useEffect(() => {
    levelRef.current = level;
  }, [level]);
  const load = useCallback(
    async (route: MapRoute, signal?: AbortSignal, fresh = false) => {
      const key = buildMapHref(route);
      const cached = !fresh && cache.get(key);
      if (cached) return cached;
      const generation = cacheGeneration.current;
      const data = await client.level(route, signal);
      if (!signal?.aborted && generation === cacheGeneration.current)
        cache.set(key, data);
      return data;
    },
    [cache, client],
  );
  useEffect(() => {
    isolateMapAccount(account);
    const controller = new AbortController(),
      current = ++token.current;
    const route = parseMapRoute(new URLSearchParams(routeKey.split("?")[1]));
    const delay = (ms: number) =>
      new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, ms);
        controller.signal.addEventListener(
          "abort",
          () => {
            clearTimeout(timer);
            resolve();
          },
          { once: true },
        );
      });
    void (async () => {
      setLoading(true);
      setError("");
      try {
        if (!levelRef.current) {
          const summary = await client.summary();
          if (!summary.map) {
            ensureKey.current ??= crypto.randomUUID();
            await client.mutate("ensure", {}, ensureKey.current);
          }
        }
        if (!route) throw new Error("El enlace del mapa no es válido.");
        const data = await load(route, controller.signal);
        if (controller.signal.aborted || current !== token.current) return;
        const animate =
          levelRef.current &&
          data.levelKey !== levelRef.current.levelKey &&
          !matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (animate) {
          setPhase("exiting");
          await delay(120);
        }
        if (controller.signal.aborted || current !== token.current) return;
        queue.routes.set(data.levelKey, data.route);
        queue.seed(data.levelKey, data.layout.rowVersion);
        setLevel(data);
        setLoading(false);
        setPhase(animate ? "entering" : "idle");
        if (animate) await delay(120);
        if (!controller.signal.aborted && current === token.current)
          setPhase("idle");
      } catch (e) {
        if (!controller.signal.aborted && current === token.current) {
          setError(
            e instanceof Error ? e.message : "No pudimos abrir el mapa.",
          );
          setLoading(false);
          setPhase("idle");
        }
      }
    })();
    return () => {
      controller.abort();
    };
  }, [account, client, load, queue, routeKey]);
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => {
      if (queue.pending) e.preventDefault();
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [queue]);
  const refresh = useCallback(async () => {
    cacheGeneration.current++;
    cache.clear();
    const route = parseMapRoute(new URLSearchParams(window.location.search));
    if (!route) return;
    const current = token.current;
    if (!levelRef.current) {
      const summary = await client.summary();
      if (!summary.map) {
        ensureKey.current ??= crypto.randomUUID();
        await client.mutate("ensure", {}, ensureKey.current);
      }
    }
    const data = await load(route, undefined, true);
    const latest = parseMapRoute(new URLSearchParams(window.location.search));
    if (
      current !== token.current ||
      !latest ||
      buildMapHref(latest) !== buildMapHref(route)
    )
      return;
    queue.routes.set(data.levelKey, data.route);
    queue.seed(data.levelKey, data.layout.rowVersion);
    setLevel(data);
    setError("");
    setLoading(false);
    return data;
  }, [cache, client, load, queue]);
  useEffect(() => {
    const focus = () => {
      void refresh().catch(() => {});
    };
    window.addEventListener("focus", focus);
    return () => window.removeEventListener("focus", focus);
  }, [refresh]);
  const navigate = useCallback((route: MapRoute, detail = false) => {
    const href = buildMapHref(route, detail);
    const previous = levelRef.current;
    const replacingLesson =
      previous?.selectedLesson &&
      route.nodeId === previous.route.nodeId &&
      ((route.unitStableKey && route.entryId === previous.route.entryId) ||
        previous.items.some(
          (i) => i.kind === "lesson" && i.occurrenceId === route.entryId,
        ));
    if (replacingLesson || detail)
      window.history.replaceState(null, "", mapNavigationHref(href));
    else {
      history.current.push(buildMapHref(previous?.route ?? ROOT_MAP_ROUTE));
      window.history.pushState(null, "", mapNavigationHref(href));
    }
  }, []);
  const back = useCallback(() => {
    const r =
      parseMapRoute(new URLSearchParams(window.location.search)) ??
      levelRef.current?.route ??
      ROOT_MAP_ROUTE;
    const parent = parentMapRoute(r),
      href = buildMapHref(parent);
    if (history.current.at(-1) === href) {
      history.current.pop();
      window.history.back();
    } else window.history.replaceState(null, "", mapNavigationHref(href));
  }, []);
  const prefetch = useCallback(
    (route: MapRoute) => {
      if (prefetchCount.current >= 2) return () => {};
      const c = new AbortController();
      prefetchCount.current++;
      void load(route, c.signal)
        .catch(() => {})
        .finally(() => {
          prefetchCount.current--;
        });
      return () => c.abort();
    },
    [load],
  );
  return {
    account,
    client,
    level,
    loading,
    error,
    phase,
    queue,
    navigate,
    back,
    refresh,
    prefetch,
    detail: search.get("detail") === "1",
  };
}
type Workspace = ReturnType<typeof useWorkspace>;
const Context = createContext<Workspace | null>(null);
export function MapWorkspaceProvider({
  account,
  client = mapClient,
  children,
}: {
  account: string;
  client?: MapClient;
  children: ReactNode;
}) {
  const value = useWorkspace(account, client);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useMapWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error("Map workspace missing");
  return value;
}
