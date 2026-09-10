// answerMaps.test.ts — the map's fold, the heal that fills only what is
// absent, and the backfill that walks the answers in pages
// (DATA-EFFICIENCY-RUNBOOK Phase 3).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BACKFILL_PAGE, WORLD_SURFACES, answerMapMerge, foldAnswerMaps, missingEntries, runAnswerMapBackfill, runAnswerMapHeal,
  type AnswerMapStore, type AnswerRow,
} from "./answerMaps";

const here = dirname(fileURLToPath(import.meta.url));

describe("WORLD_SURFACES", () => {
  it("is the device's WORLD_ANSWER_SURFACES, which the two packages cannot share", () => {
    const src = readFileSync(resolve(here, "../../src/v2/data/voters.ts"), "utf8");
    const m = /export const WORLD_ANSWER_SURFACES = \[([^\]]*)\]/.exec(src);
    expect(m, "voters.ts no longer declares WORLD_ANSWER_SURFACES where this looks").toBeTruthy();
    const theirs = [...m![1].matchAll(/"(\w+)"/g)].map((x) => x[1]);
    expect([...WORLD_SURFACES]).toEqual(theirs);
  });
});

describe("foldAnswerMaps", () => {
  it("keeps the newest answer per person and question, and only usable world answers", () => {
    const rows: AnswerRow[] = [
      { uid: "u1", qid: "q1", optionIdx: 0, surface: "daily" },
      { uid: "u1", qid: "q2", optionIdx: 2, surface: "feed" },
      { uid: "u1", qid: "q1", optionIdx: 1, surface: "daily" }, // the edit, later
      { uid: "u2", qid: "q1", optionIdx: 0, surface: "learn" },
      { uid: "u2", qid: "g1", optionIdx: 0, surface: "duo" }, // sealed: never in a map
      { uid: "u2", qid: "c1", surface: "feed" }, // a catalogue pick: no index
      { uid: "u2", qid: "q3", optionIdx: 25, surface: "feed" }, // out of range
      { uid: "u2", qid: "q4", optionIdx: 1.5, surface: "feed" },
      { uid: "", qid: "q1", optionIdx: 0, surface: "daily" },
      { uid: "u3", qid: "q9", optionIdx: 3 }, // a ledger row: no surface field, admitted
    ];
    const maps = foldAnswerMaps(rows);
    expect([...maps.keys()]).toEqual(["u1", "u2", "u3"]);
    expect(maps.get("u1")).toEqual({ q1: 1, q2: 2 });
    expect(maps.get("u2")).toEqual({ q1: 0 });
    expect(maps.get("u3")).toEqual({ q9: 3 });
  });

  it("missingEntries names what the map lacks and never what it holds, whatever the value", () => {
    expect(missingEntries({ q1: 0 }, { q1: 1, q2: 2 })).toEqual({ q2: 2 });
    expect(missingEntries(null, { q1: 1 })).toEqual({ q1: 1 });
    expect(missingEntries({ q1: 0 }, { q1: 0 })).toEqual({});
  });

  it("the merge shape carries the entries under `a` and a moving `at`", () => {
    const m = answerMapMerge({ q1: 1 });
    expect(m.a).toEqual({ q1: 1 });
    expect(m.at).toBeTruthy();
  });
});

describe("runAnswerMapHeal", () => {
  const NOW = Date.UTC(2026, 8, 6, 3);
  function memoryStore(ledger: AnswerRow[], maps: Record<string, Record<string, number>>) {
    const reads: string[][] = [];
    const writes: Array<Map<string, Record<string, number>>> = [];
    const store: AnswerMapStore = {
      async ledgerDay(day) { return day === "2026-09-05" ? ledger : []; },
      async getMaps(uids) {
        reads.push([...uids]);
        const out = new Map<string, Record<string, number>>();
        for (const u of uids) if (maps[u]) out.set(u, { ...maps[u] });
        return out;
      },
      async putMaps(entries) {
        writes.push(entries);
        for (const [u, m] of entries) maps[u] = { ...(maps[u] ?? {}), ...m };
      },
    };
    return { store, reads, writes, maps };
  }

  it("fills only the entries a person's map lacks, and writes nothing for a map that already has the day", async () => {
    const { store, reads, writes, maps } = memoryStore(
      [
        { uid: "u1", qid: "q1", optionIdx: 1 },
        { uid: "u1", qid: "q2", optionIdx: 0 },
        { uid: "u2", qid: "q1", optionIdx: 0 },
        { uid: "u3", qid: "q5", optionIdx: 2 },
      ],
      {
        // u1's map has q1 at a DIFFERENT value — an edit after the day, the newer truth — and lacks q2
        u1: { q1: 0 },
        // u2's map already holds the day
        u2: { q1: 0, q7: 1 },
        // u3 has no map at all
      },
    );
    const out = await runAnswerMapHeal(store, NOW);
    expect(out).toEqual({ day: "2026-09-05", people: 3, healed: 2, entries: 2 });
    expect(reads).toEqual([["u1", "u2", "u3"]]);
    expect(writes).toHaveLength(1);
    expect(writes[0].get("u1")).toEqual({ q2: 0 });
    expect(writes[0].has("u2"), "a map that had the day was rewritten").toBe(false);
    expect(writes[0].get("u3")).toEqual({ q5: 2 });
    expect(maps.u1, "the heal overwrote a value the trigger wrote after the day").toEqual({ q1: 0, q2: 0 });
  });

  it("a day with no entries reads and writes nothing", async () => {
    const { store, reads, writes } = memoryStore([], {});
    expect(await runAnswerMapHeal(store, NOW)).toEqual({ day: "2026-09-05", people: 0, healed: 0, entries: 0 });
    expect(reads).toEqual([]);
    expect(writes).toEqual([]);
  });
});

describe("runAnswerMapBackfill", () => {
  type Row = { path: string; data: Record<string, unknown> };
  /** A fake of the plumbing the scan touches: a path-ordered collection
   * group paged by cursor with a projection, `doc(path).get()` for the
   * resume cursor, and merge batches recorded by path. */
  function fakeDb(rows: Row[]) {
    const sorted = [...rows].sort((a, b) => (a.path < b.path ? -1 : 1));
    const writes: Array<{ path: string; data: Record<string, unknown> }> = [];
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
          const page = sorted.slice(from, from + BACKFILL_PAGE);
          return { empty: page.length === 0, size: page.length, docs: page.map(snapOf) };
        },
      };
      return q;
    };
    const db = {
      collectionGroup: () => query(null),
      doc: (path: string) => ({ async get() { return { ref: { path } }; } }),
      collection: (name: string) => ({
        doc: (uid: string) => ({ collection: (sub: string) => ({ doc: (id: string) => ({ __path: `${name}/${uid}/${sub}/${id}` }) }) }),
      }),
      batch: () => {
        const pending: typeof writes = [];
        return {
          set: (ref: { __path: string }, data: Record<string, unknown>, opts?: { merge?: boolean }) => {
            expect(opts?.merge, "a map write without merge wipes the person's other answers").toBe(true);
            pending.push({ path: ref.__path, data });
          },
          async commit() { writes.push(...pending); },
        };
      },
    };
    return { db: db as unknown as Parameters<typeof runAnswerMapBackfill>[0], writes };
  }
  const answer = (uid: string, qid: string, data: Record<string, unknown>): Row => ({ path: `v2_users/${uid}/answers/${qid}`, data: { qid, ...data } });

  it("folds every world answer into its person's map, skips what is not one, and reports the counts", async () => {
    const { db, writes } = fakeDb([
      answer("ua", "daily-000", { optionIdx: 1, surface: "daily" }),
      answer("ua", "feed-f01", { optionIdx: 0, surface: "feed" }),
      answer("ua", "pick-pk04", { entity: 25, surface: "feed" }),
      answer("ub", "daily-000", { optionIdx: 0, surface: "daily" }),
      answer("ub", "g_grp_2026-09-01", { optionIdx: 1, surface: "duo" }),
    ]);
    const out = await runAnswerMapBackfill(db, { apply: true });
    expect(out).toEqual({ scanned: 5, folded: 3, users: 2, written: 2, next: null, done: true });
    expect(writes.map((w) => [w.path, (w.data as { a: unknown }).a])).toEqual([
      ["v2_users/ua/public/answers", { "daily-000": 1, "feed-f01": 0 }],
      ["v2_users/ub/public/answers", { "daily-000": 0 }],
    ]);
  });

  it("a dry run counts and writes nothing", async () => {
    const { db, writes } = fakeDb([answer("ua", "daily-000", { optionIdx: 1, surface: "daily" })]);
    const out = await runAnswerMapBackfill(db, { apply: false });
    expect(out.folded).toBe(1);
    expect(out.written).toBe(0);
    expect(writes).toEqual([]);
  });

  it("hands back a cursor at its page budget and resumes after it without re-reading", async () => {
    const rows: Row[] = [];
    for (let i = 0; i < BACKFILL_PAGE * 2 + 5; i++) {
      rows.push(answer(`u${String(i % 7).padStart(2, "0")}`, `q${String(i).padStart(5, "0")}`, { optionIdx: i % 2, surface: "feed" }));
    }
    const { db, writes } = fakeDb(rows);
    const first = await runAnswerMapBackfill(db, { apply: true, maxPages: 1 });
    expect(first.scanned).toBe(BACKFILL_PAGE);
    expect(first.done).toBe(false);
    expect(first.next).toBeTruthy();
    const second = await runAnswerMapBackfill(db, { apply: true, after: first.next, maxPages: 1 });
    expect(second.scanned).toBe(BACKFILL_PAGE);
    expect(second.done).toBe(false);
    const third = await runAnswerMapBackfill(db, { apply: true, after: second.next, maxPages: 1 });
    expect(third.scanned).toBe(5);
    expect(third.done).toBe(true);
    expect(third.next).toBeNull();
    // every answer landed in exactly one merge, across the three calls
    const seen = new Set<string>();
    for (const w of writes) for (const q of Object.keys((w.data as { a: Record<string, number> }).a)) seen.add(`${w.path}:${q}`);
    expect(seen.size).toBe(rows.length);
  });
});
