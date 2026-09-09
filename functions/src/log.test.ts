// log.test.ts — the answer log's row, the reconcile that makes a missed
// append a day's lag rather than a hole, the erasure that defers rather
// than fails, and the backfill's page walk (SCALE-ARCHITECTURE.md phase A,
// D440).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LOG_BACKFILL_PAGE, LOG_ERASURE_RETRY_MS, eraseUserLog, logRow, rowFromLedgerEntry, runLogBackfill, runLogReconcile,
  type LogErasureStore, type LogReconcileStore, type LogRow, type LogWriter,
} from "./log";
import type { LedgerDayEntry } from "./ledger";

const here = dirname(fileURLToPath(import.meta.url));
const quiet = { info: () => {}, warn: () => {} };

describe("logRow", () => {
  it("has exactly the schema's fields, in the schema's names", () => {
    // The table is created from bigquery/answers.schema.json and the row
    // is built here; a field renamed on one side and not the other is a
    // streaming insert that fails on every answer. Held to the file.
    const schema = JSON.parse(readFileSync(resolve(here, "../../bigquery/answers.schema.json"), "utf8")) as Array<{ name: string; mode: string }>;
    const row = logRow({ id: "e1", uid: "u1", qid: "q1", atMs: Date.UTC(2026, 8, 8, 10), surface: "daily", optionIdx: 2, anchors: { city: "Oslo, NO" } });
    expect(Object.keys(row).sort()).toEqual(schema.map((f) => f.name).sort());
    for (const f of schema.filter((f) => f.mode === "REQUIRED")) expect(row[f.name as keyof LogRow], `${f.name} is required`).not.toBeNull();
  });

  it("carries the answer's facts and nothing invented: null where the ledger has nothing", () => {
    const at = Date.UTC(2026, 8, 8, 23, 59, 30);
    const row = logRow({ id: "e1", uid: "u1", qid: "q1", atMs: at, surface: "feed", optionIdx: 3, fromIdx: 1, anchors: { country: "NO", city: "Oslo, NO" } });
    expect(row).toEqual({
      id: "e1", uid: "u1", qid: "q1", surface: "feed", option_idx: 3, from_idx: 1,
      answered_at: "2026-09-08T23:59:30.000Z", day: "2026-09-08", anchors: JSON.stringify({ country: "NO", city: "Oslo, NO" }),
    });
    const bare = logRow({ id: "e2", uid: "u1", qid: "pick-1", atMs: at, optionIdx: 25, anchors: {} });
    expect(bare.option_idx, "an index past the option range is not an option").toBeNull();
    expect(bare.from_idx).toBeNull();
    expect(bare.surface).toBeNull();
    expect(bare.anchors, "empty chips are no chips").toBeNull();
  });

  it("a ledger entry becomes a row keyed by its document id", () => {
    const e: LedgerDayEntry = { id: "evt-9", uid: "u2", qid: "daily-000", optionIdx: 1, fromIdx: 0, at: Date.UTC(2026, 8, 8, 2), anchors: { ageBand: "25-34" } };
    expect(rowFromLedgerEntry(e)).toMatchObject({ id: "evt-9", uid: "u2", qid: "daily-000", option_idx: 1, from_idx: 0, day: "2026-09-08", surface: null });
  });
});

describe("runLogReconcile", () => {
  const NOW = Date.UTC(2026, 8, 9, 2, 23);
  const entry = (id: string, uid = "u1"): LedgerDayEntry => ({ id, uid, qid: "q1", optionIdx: 0, at: Date.UTC(2026, 8, 8, 12) });
  function fakeStore(o: { present: Set<string> | null; entries: LedgerDayEntry[]; pending?: string[]; refuse?: Set<string> }) {
    const appended: LogRow[][] = [];
    const deleted: string[] = [];
    const done: string[] = [];
    const store: LogReconcileStore = {
      async ledgerDay(day) { return day === "2026-09-08" ? o.entries : []; },
      async presentIds() { return o.present; },
      async append(rows) { appended.push([...rows]); },
      async pendingErasures() { return o.pending ?? []; },
      async deleteUser(uid) { deleted.push(uid); return o.refuse?.has(uid) ? "deferred" : "done"; },
      async eraseDone(uid) { done.push(uid); },
    };
    return { store, appended, deleted, done };
  }

  it("appends only the entries the table lacks, keyed by id", async () => {
    const { store, appended } = fakeStore({ present: new Set(["e1", "e3"]), entries: [entry("e1"), entry("e2"), entry("e3"), entry("e4", "u2")] });
    const out = await runLogReconcile(store, NOW, quiet);
    expect(out).toMatchObject({ day: "2026-09-08", skipped: false, entries: 4, missing: 2, appended: 2 });
    expect(appended).toHaveLength(1);
    expect(appended[0].map((r) => r.id)).toEqual(["e2", "e4"]);
  });

  it("a complete day appends nothing", async () => {
    const { store, appended } = fakeStore({ present: new Set(["e1"]), entries: [entry("e1")] });
    expect((await runLogReconcile(store, NOW, quiet)).missing).toBe(0);
    expect(appended).toEqual([]);
  });

  it("skips itself, reading nothing, where there is no BigQuery", async () => {
    let read = 0;
    const { store } = fakeStore({ present: null, entries: [] });
    store.ledgerDay = async () => { read += 1; return []; };
    expect((await runLogReconcile(store, NOW, quiet)).skipped).toBe(true);
    expect(read).toBe(0);
  });

  it("retries the deferred erasures and clears the ones that went through", async () => {
    const { store, deleted, done } = fakeStore({ present: new Set(), entries: [], pending: ["gone-1", "still-buffered"], refuse: new Set(["still-buffered"]) });
    const out = await runLogReconcile(store, NOW, quiet);
    expect(deleted).toEqual(["gone-1", "still-buffered"]);
    expect(done).toEqual(["gone-1"]);
    expect(out).toMatchObject({ erasures: 2, erased: 1 });
  });
});

describe("eraseUserLog", () => {
  function fakeErasure(outcome: "done" | "deferred" | Error) {
    const deferred: Array<[string, number]> = [];
    const store: LogErasureStore = {
      async deleteUser() { if (outcome instanceof Error) throw outcome; return outcome; },
      async defer(uid, at) { deferred.push([uid, at]); },
    };
    return { store, deferred };
  }
  it("done now leaves no marker", async () => {
    const { store, deferred } = fakeErasure("done");
    expect(await eraseUserLog(store, "u1", 1000, quiet)).toBe("done");
    expect(deferred).toEqual([]);
  });
  it("a streaming-buffer refusal leaves the marker the night retries from", async () => {
    const { store, deferred } = fakeErasure("deferred");
    expect(await eraseUserLog(store, "u1", 1000, quiet)).toBe("deferred");
    expect(deferred).toEqual([["u1", 1000]]);
  });
  it("any other failure defers too — the marker is the promise, not the DML", async () => {
    const { store, deferred } = fakeErasure(new Error("503 backend"));
    expect(await eraseUserLog(store, "u1", 1000, quiet)).toBe("deferred");
    expect(deferred).toEqual([["u1", 1000]]);
    expect(LOG_ERASURE_RETRY_MS).toBeGreaterThanOrEqual(90 * 60 * 1000);
  });
});

describe("runLogBackfill", () => {
  type Row = { path: string; data: Record<string, unknown> };
  const ts = (ms: number) => ({ toMillis: () => ms });
  function fakeDb(rows: Row[]) {
    const sorted = [...rows].sort((a, b) => (a.path < b.path ? -1 : 1));
    let projection: string[] = [];
    const snapOf = (r: Row) => ({
      id: r.path.split("/").pop(),
      ref: { path: r.path, parent: { parent: { id: r.path.split("/")[1] } } },
      get: (f: string) => (projection.includes(f) ? r.data[f] : undefined),
    });
    const query = (after: string | null) => {
      const q = {
        orderBy: () => q,
        select: (...f: string[]) => { projection = f; return q; },
        limit: () => q,
        startAfter: (s: { ref: { path: string } }) => query(s.ref.path),
        async get() {
          const from = after ? sorted.findIndex((r) => r.path === after) + 1 : 0;
          const page = sorted.slice(from, from + LOG_BACKFILL_PAGE);
          return { empty: page.length === 0, size: page.length, docs: page.map(snapOf) };
        },
      };
      return q;
    };
    return { collectionGroup: () => query(null), doc: (path: string) => ({ async get() { return { ref: { path } }; } }) } as unknown as Parameters<typeof runLogBackfill>[0];
  }
  function fakeWriter(): LogWriter & { rows: LogRow[] } {
    const rows: LogRow[] = [];
    return { enabled: true, rows, async append(r) { rows.push(...r); }, async presentIds() { return new Set(); }, async deleteUser() { return "done"; } };
  }
  const answer = (uid: string, qid: string, data: Record<string, unknown>): Row => ({ path: `v2_users/${uid}/answers/${qid}`, data: { qid, ...data } });
  const OLD = Date.UTC(2026, 7, 1, 9);
  const NEW = Date.UTC(2026, 8, 9, 9);

  it("rows every answer written before the cutoff, with a deterministic id, and skips the rest", async () => {
    const db = fakeDb([
      answer("ua", "daily-000", { optionIdx: 1, surface: "daily", answeredAt: ts(OLD), anchors: { country: "NO" } }),
      answer("ua", "pick-pk04", { entity: 25, surface: "feed", answeredAt: ts(OLD) }),
      answer("ub", "daily-000", { optionIdx: 0, surface: "daily", answeredAt: ts(NEW) }), // after the trigger started appending
      answer("uc", "feed-f01", { optionIdx: 2, surface: "feed" }), // no answeredAt — cannot be dated, skipped
    ]);
    const w = fakeWriter();
    const out = await runLogBackfill(db, w, { before: "2026-09-09", apply: true });
    expect(out).toEqual({ scanned: 4, rows: 2, appended: 2, next: null, done: true });
    expect(w.rows.map((r) => [r.id, r.option_idx, r.day])).toEqual([["bf:ua:daily-000", 1, "2026-08-01"], ["bf:ua:pick-pk04", null, "2026-08-01"]]);
  });

  it("a dry run counts and appends nothing; a bad cutoff is refused", async () => {
    const db = fakeDb([answer("ua", "daily-000", { optionIdx: 1, surface: "daily", answeredAt: ts(OLD) })]);
    const w = fakeWriter();
    expect((await runLogBackfill(db, w, { before: "2026-09-09", apply: false })).rows).toBe(1);
    expect(w.rows).toEqual([]);
    await expect(runLogBackfill(db, w, { before: "yesterday", apply: false })).rejects.toThrow(/UTC day/);
  });

  it("hands back a cursor at its page budget and resumes after it", async () => {
    const rows: Row[] = [];
    for (let i = 0; i < LOG_BACKFILL_PAGE + 3; i++) rows.push(answer(`u${String(i % 5)}`, `q${String(i).padStart(5, "0")}`, { optionIdx: i % 2, surface: "feed", answeredAt: ts(OLD) }));
    const db = fakeDb(rows);
    const w = fakeWriter();
    const first = await runLogBackfill(db, w, { before: "2026-09-09", apply: true, maxPages: 1 });
    expect(first.done).toBe(false);
    const second = await runLogBackfill(db, w, { before: "2026-09-09", apply: true, after: first.next, maxPages: 1 });
    expect(second.done).toBe(true);
    expect(new Set(w.rows.map((r) => r.id)).size).toBe(rows.length);
  });
});
