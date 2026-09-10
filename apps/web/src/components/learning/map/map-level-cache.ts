import type { LearningMapLevelResponse } from "@cediah/contracts";
/** Instance belongs to one mounted account workspace. No module-global private data. */
export class MapLevelCache {
  private entries = new Map<
    string,
    { value: LearningMapLevelResponse; at: number; bytes: number }
  >();
  get(key: string, now = Date.now()) {
    const entry = this.entries.get(key);
    if (!entry || now - entry.at > 15_000) {
      this.entries.delete(key);
      return null;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }
  set(key: string, value: LearningMapLevelResponse, now = Date.now()) {
    this.entries.delete(key);
    this.entries.set(key, {
      value,
      at: now,
      bytes: new TextEncoder().encode(JSON.stringify(value)).length,
    });
    while (
      this.entries.size > 12 ||
      [...this.entries.values()].reduce((n, e) => n + e.bytes, 0) >
        2 * 1024 * 1024
    )
      this.entries.delete(this.entries.keys().next().value!);
  }
  clear() {
    this.entries.clear();
  }
  get size() {
    return this.entries.size;
  }
}
