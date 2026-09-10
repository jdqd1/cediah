import type { MapClient } from "./map-client";
import { MapRequestError } from "./map-client";
import type { Positions } from "./map-layout";
import type { MapRoute } from "@cediah/contracts";
type Batch = { key: string; version: number; positions: Positions };
type Queue = {
  version: number;
  confirmed: Positions;
  draft: Positions;
  batch: Batch | null;
  state: "saved" | "saving" | "failed" | "conflict";
  sending: boolean;
};
/** One in-flight immutable batch per level; newer drags remain in draft. */
export class MapLayoutQueue {
  readonly levels = new Map<string, Queue>();
  readonly routes = new Map<string, MapRoute>();
  constructor(
    private client: MapClient,
    private notify: () => void,
  ) {}
  seed(level: string, version: number) {
    if (!this.levels.has(level))
      this.levels.set(level, {
        version,
        confirmed: {},
        draft: {},
        batch: null,
        state: "saved",
        sending: false,
      });
    else {
      const q = this.levels.get(level)!;
      if (q.state === "saved" && version >= q.version) {
        q.version = version;
        q.confirmed = {};
      }
    }
  }
  positions(level: string) {
    const q = this.levels.get(level);
    return { ...q?.confirmed, ...q?.batch?.positions, ...q?.draft };
  }
  get pending() {
    return [...this.levels.values()].some((q) => q.state !== "saved");
  }
  get state() {
    const states = [...this.levels.values()].map((q) => q.state);
    return states.includes("conflict")
      ? "conflict"
      : states.includes("failed")
        ? "failed"
        : states.includes("saving")
          ? "saving"
          : "saved";
  }
  enqueue(level: string, positions: Positions) {
    const q = this.levels.get(level)!;
    Object.assign(q.draft, positions);
    if (q.state !== "failed" && q.state !== "conflict") void this.flush(level);
    this.notify();
  }
  async flush(level: string) {
    const q = this.levels.get(level)!;
    if (q.sending || q.state === "conflict") return;
    if (!q.batch && !Object.keys(q.draft).length) return;
    if (!q.batch) {
      q.batch = {
        key: crypto.randomUUID(),
        version: q.version,
        positions: q.draft,
      };
      q.draft = {};
    }
    q.sending = true;
    q.state = "saving";
    this.notify();
    const batch = q.batch;
    try {
      const saved = await this.client.mutate(
        "layout",
        {
          levelKey: level,
          expectedVersion: batch.version,
          positions: Object.entries(batch.positions).map(([id, p]) => ({
            id,
            ...p,
          })),
        },
        batch.key,
      );
      q.version = saved.layoutVersion!;
      Object.assign(q.confirmed, batch.positions);
      q.batch = null;
      q.state = "saved";
    } catch (error) {
      q.state =
        error instanceof MapRequestError && error.status === 409
          ? "conflict"
          : "failed";
    } finally {
      q.sending = false;
      this.notify();
    }
    if (q.state === "saved" && Object.keys(q.draft).length)
      await this.flush(level);
  }
  resolve(level: string, version: number, mine: boolean) {
    const q = this.levels.get(level)!;
    q.draft = mine ? { ...q.batch?.positions, ...q.draft } : {};
    q.confirmed = {};
    q.batch = null;
    q.version = version;
    q.state = "saved";
    this.notify();
    if (mine) void this.flush(level);
  }
}
