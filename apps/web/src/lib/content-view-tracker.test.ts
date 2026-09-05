import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createContentViewTracker } from "./content-view-tracker";

const fetchMock = vi.fn();
const recorded = vi.fn();
const page = { visibilityState: "visible" };
const connection = { onLine: true };
const receipt = { counted: true, viewCount: 12, retryAfterMs: 1_800_000 };
const ok = (body = receipt) => new Response(JSON.stringify(body));
const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  page.visibilityState = "visible";
  connection.onLine = true;
  vi.stubGlobal("document", page);
  vi.stubGlobal("navigator", connection);
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset().mockImplementation(async () => ok());
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("reliable playback receipts", () => {
  it("waits for playback, sends once during concurrent events and uses the server total", async () => {
    const tracker = createContentViewTracker("video", recorded);
    tracker.resume();
    expect(fetchMock).not.toHaveBeenCalled();
    tracker.record(); tracker.record(); tracker.record();
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(recorded).toHaveBeenCalledExactlyOnceWith(receipt);
    tracker.record();
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    tracker.dispose();
  });

  it("retries a lost response and reconciles a server-deduplicated playback", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("network lost"))
      .mockResolvedValueOnce(ok({ counted: false, viewCount: 13, retryAfterMs: 900_000 }));
    const tracker = createContentViewTracker("video", recorded);
    tracker.record();
    await flush();
    expect(recorded).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(recorded).toHaveBeenCalledExactlyOnceWith({ counted: false, viewCount: 13, retryAfterMs: 900_000 });
    await vi.advanceTimersByTimeAsync(900_000);
    tracker.resume();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    tracker.record();
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    tracker.dispose();
  });

  it("retains playback intent while hidden or offline and sends on return", async () => {
    page.visibilityState = "hidden";
    const tracker = createContentViewTracker("video", recorded);
    tracker.record();
    expect(fetchMock).not.toHaveBeenCalled();
    page.visibilityState = "visible";
    connection.onLine = false;
    tracker.resume();
    expect(fetchMock).not.toHaveBeenCalled();
    connection.onLine = true;
    tracker.resume();
    await flush();
    expect(recorded).toHaveBeenCalledTimes(1);
    tracker.dispose();
  });

  it("does not share browser suppression across mounts or accounts", async () => {
    const first = createContentViewTracker("video", recorded);
    first.record(); await flush(); first.dispose();
    const second = createContentViewTracker("video", recorded);
    second.record(); await flush(); second.dispose();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("bounds retries, recovers after reconnecting and cancels on unmount", async () => {
    fetchMock.mockImplementation(async () => new Response("unavailable", { status: 503 }));
    const tracker = createContentViewTracker("video", recorded);
    tracker.record();
    await vi.advanceTimersByTimeAsync(200_000);
    expect(fetchMock).toHaveBeenCalledTimes(6);
    tracker.record();
    await vi.advanceTimersByTimeAsync(200_000);
    expect(fetchMock).toHaveBeenCalledTimes(6);
    fetchMock.mockImplementation(async () => ok());
    tracker.resume(); await flush();
    expect(recorded).toHaveBeenCalledTimes(1);
    tracker.dispose();
    await vi.advanceTimersByTimeAsync(2_000_000);
    tracker.record();
    expect(fetchMock).toHaveBeenCalledTimes(7);
  });

  it("never confirms malformed receipts or retries forbidden content", async () => {
    fetchMock.mockResolvedValueOnce(ok({ ...receipt, viewCount: -1 }))
      .mockResolvedValueOnce(new Response("forbidden", { status: 403 }));
    const tracker = createContentViewTracker("video", recorded);
    tracker.record();
    await vi.advanceTimersByTimeAsync(200_000);
    tracker.resume();
    expect(recorded).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    tracker.dispose();
  });
});
