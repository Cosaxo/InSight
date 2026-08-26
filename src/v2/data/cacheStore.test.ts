// cacheStore's contract (D311, docs/ANSWER-SCALE.md §2.2), driven against
// fake-indexeddb — a spec implementation, not a hand-rolled double,
// because transaction auto-commit and event ordering are exactly where a
// hand-mirrored fake would encode this module's own assumptions back at
// it.
//
// What each case pins:
//   - rows and meta round-trip, and meta commits with the rows;
//   - clearFirst is a REPLACE, not a merge — the full-fetch shape;
//   - a write past WRITE_CHUNK still lands whole, meta included (the
//     chunked path is the 100k-answer cold import's);
//   - the purge event empties every store (check-purge-listeners.mjs
//     holds the listener's existence; this holds what it does);
//   - no IndexedDB at all reads as empty and swallows writes silently —
//     the caches are an optimisation, and an exotic environment must not
//     grow an error budget line;
//   - an unclonable value counts and reports ONCE per session, the §2.1
//     throttle one box over.

import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";

const h = vi.hoisted(() => ({
  reportError: vi.fn(),
}));

vi.mock("../../lib/sentry", () => ({
  reportError: h.reportError,
  setSentryUser: vi.fn(),
}));

// Captures the module's purge listener so a test can fire it without a
// DOM event system (node environment).
const listeners: Record<string, () => void> = {};

type CacheStore = typeof import("./cacheStore");

async function freshStore(withIdb = true): Promise<CacheStore> {
  vi.resetModules();
  if (withIdb) vi.stubGlobal("indexedDB", new IDBFactory());
  vi.stubGlobal("window", {
    addEventListener: (type: string, fn: () => void) => { listeners[type] = fn; },
    removeEventListener: (type: string) => { delete listeners[type]; },
    dispatchEvent: () => true,
  });
  return import("./cacheStore");
}

beforeEach(() => {
  h.reportError.mockClear();
  for (const k of Object.keys(listeners)) delete listeners[k];
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("cacheStore", () => {
  it("round-trips rows and meta", async () => {
    const cs = await freshStore();
    await cs.write("aggs", [["q_1", { total: 3 }], ["q_2", { total: 9 }]], {
      meta: [["aggCheck", { q_1: 42 }]],
    });
    const rows = await cs.readAll<{ total: number }>("aggs");
    expect(rows.get("q_1")).toEqual({ total: 3 });
    expect(rows.get("q_2")).toEqual({ total: 9 });
    expect(await cs.readMeta("aggCheck")).toEqual({ q_1: 42 });
    // A key nothing wrote is null, not undefined-shaped surprises.
    expect(await cs.readMeta("bank")).toBeNull();
  });

  it("a repeated key overwrites its row — a vote edit is one put, not a duplicate", async () => {
    const cs = await freshStore();
    await cs.write("answers", [["q_1", "0"]]);
    await cs.write("answers", [["q_1", "1"]]);
    const rows = await cs.readAll<string>("answers");
    expect(rows.size).toBe(1);
    expect(rows.get("q_1")).toBe("1");
  });

  it("clearFirst replaces the store's contents, in the same write", async () => {
    const cs = await freshStore();
    await cs.write("bank", [["stale_1", { id: "stale_1" }], ["stale_2", { id: "stale_2" }]]);
    await cs.write("bank", [["fresh", { id: "fresh" }]], {
      clearFirst: true,
      meta: [["bank", { rev: 7, cursor: 100 }]],
    });
    const rows = await cs.readAll<{ id: string }>("bank");
    expect([...rows.keys()]).toEqual(["fresh"]);
    expect(await cs.readMeta("bank")).toEqual({ rev: 7, cursor: 100 });
  });

  it("lands a write bigger than one chunk whole, meta included", async () => {
    const cs = await freshStore();
    // Past WRITE_CHUNK (4000), so this exercises the chunked path the
    // cold answers import takes — and meta must ride the LAST chunk, so
    // its presence beside a complete row set is the crash-safety
    // ordering working.
    const n = 4500;
    const rows: Array<[string, unknown]> = [];
    for (let i = 0; i < n; i++) rows.push([`q_${String(i).padStart(6, "0")}`, String(i % 4)]);
    await cs.write("answers", rows, { meta: [["answers", { uid: "u", maxTs: 5, maxEditTs: 0 }]] });
    const back = await cs.readAll<string>("answers");
    expect(back.size).toBe(n);
    expect(back.get("q_004499")).toBe("3");
    expect(await cs.readMeta("answers")).toEqual({ uid: "u", maxTs: 5, maxEditTs: 0 });
  });

  it("empties every store on the purge event", async () => {
    const cs = await freshStore();
    await cs.write("bank", [["q_1", { id: "q_1" }]]);
    await cs.write("aggs", [["q_1", { total: 1 }]]);
    await cs.write("answers", [["q_1", "0"]], { meta: [["answers", { uid: "u" }]] });
    expect(listeners["insight:local-purge"]).toBeTypeOf("function");
    listeners["insight:local-purge"]();
    // The listener's clear is fire-and-forget; clearAll from here queues
    // behind it on the same connection, so awaiting a no-op settles the
    // order before reading.
    await cs.clearAll();
    expect((await cs.readAll("bank")).size).toBe(0);
    expect((await cs.readAll("aggs")).size).toBe(0);
    expect((await cs.readAll("answers")).size).toBe(0);
    expect(await cs.readMeta("answers")).toBeNull();
  });

  it("reads empty and swallows writes when IndexedDB does not exist", async () => {
    const cs = await freshStore(false);
    await expect(cs.write("bank", [["q_1", {}]])).resolves.toBeUndefined();
    expect((await cs.readAll("bank")).size).toBe(0);
    expect(await cs.readMeta("bank")).toBeNull();
    await expect(cs.clearAll()).resolves.toBeUndefined();
    // An environment is not a failure: no count, no report.
    expect(cs.cacheStoreFailures()).toBe(0);
    expect(h.reportError).not.toHaveBeenCalled();
  });

  it("counts every failed write and reports only the first", async () => {
    const cs = await freshStore();
    // A function cannot be structured-cloned, so the put throws — a real
    // write failure, produced without reaching into the fake's internals.
    await cs.write("aggs", [["q_1", () => 0]]);
    await cs.write("aggs", [["q_2", () => 0]]);
    expect(cs.cacheStoreFailures()).toBe(2);
    const reports = h.reportError.mock.calls.filter((c) => c[1]?.where === "cacheStore");
    expect(reports).toHaveLength(1);
    // …and the store still works for clonable values afterwards.
    await cs.write("aggs", [["q_3", { total: 1 }]]);
    expect((await cs.readAll("aggs")).get("q_3")).toEqual({ total: 1 });
  });
});
