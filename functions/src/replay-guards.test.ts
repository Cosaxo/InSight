// replay-guards.test.ts — the rebuild's three write-side refusals, executed.
//
// WHY THIS FILE EXISTS. `runRebuild` is the operator tool that overwrites a
// published aggregate with a fresh fold, `merge: false`. Three guards stand
// between a mis-indexed or racing scan and that write:
//
//   1. a scan that matched NOTHING over an aggregate that holds something
//   2. an aggregate with no write stamp, so concurrency cannot be ruled out
//   3. a stamp that MOVED between the read and the write — a racing fold
//
// All three could be replaced with `if (false)` and the whole functions
// suite stayed green at 531 passed. Nothing executed them: replay.test.ts
// pins the pure feeders (the fold transcription, docStamp, armFor,
// rebuildRefusal) and never calls runRebuild, because it reaches Firestore
// through db(). The first guard's own comment records it firing on the
// first production dry run, so the failure it prevents has happened.
//
// WHAT THE FAKE IS AND IS NOT. It stands in for Firestore's PLUMBING — a
// doc get with an updateTime, and a collection-group query that pages —
// not for its semantics, and nothing here asserts anything about
// Firestore. The property under test is this function's own branching.
// The idiom is idempotence.test.ts's, for the same reason: the state these
// guards react to is precisely what a healthy emulator does not produce.
import { describe, it, expect, vi, beforeEach } from "vitest";

type Doc = Record<string, unknown>;
type Stamp = { seconds: number; nanoseconds: number } | undefined;

const docs = new Map<string, { data: Doc; updateTime: Stamp }>();
/** Successive updateTimes handed to the aggregate ref, in call order. A
 *  second entry is how a fold landing mid-scan is expressed. */
let aggStamps: Stamp[] = [];
let aggGets = 0;
const writes: { path: string; data: Doc }[] = [];

function snapOf(path: string, stamp?: Stamp) {
  const held = docs.get(path);
  return {
    exists: !!held,
    get: (f: string) => held?.data[f],
    updateTime: held ? (stamp !== undefined ? stamp : held.updateTime) : undefined,
  };
}

const AGG = (qid: string) => `v2_question_aggs/${qid}`;

/** Shard deletes the vote arm's batch issues (D400) — recorded apart from
 *  the sets so the write assertion below stays about the aggregate. */
const deletes: string[] = [];

const fakeDb = {
  // The vote arm writes the aggregate and all eight tail shards in one
  // batch since D400; a set lands like a direct one, a delete is recorded.
  batch() {
    const ops: Array<() => void> = [];
    return {
      set(ref: { path: string }, data: Doc) {
        ops.push(() => {
          writes.push({ path: ref.path, data });
          docs.set(ref.path, { data, updateTime: { seconds: 999, nanoseconds: 0 } });
        });
      },
      delete(ref: { path: string }) {
        ops.push(() => { deletes.push(ref.path); docs.delete(ref.path); });
      },
      async commit() { for (const op of ops) op(); },
    };
  },
  collection(name: string) {
    return {
      doc: (id: string) => ({
        path: `${name}/${id}`,
        // The write, so the escape-hatch case can go all the way through.
        async set(data: Doc) {
          writes.push({ path: `${name}/${id}`, data });
          docs.set(`${name}/${id}`, { data, updateTime: { seconds: 999, nanoseconds: 0 } });
        },
        async get() {
          if (name === "v2_question_aggs") {
            const stamp = aggStamps[Math.min(aggGets, aggStamps.length - 1)];
            aggGets += 1;
            return snapOf(`${name}/${id}`, stamp);
          }
          return snapOf(`${name}/${id}`);
        },
      }),
    };
  },
  // The scan. Every builder method returns the same object; `get` answers
  // empty, which is the state all three guards are reached from.
  collectionGroup() {
    const q = {
      where: () => q,
      orderBy: () => q,
      limit: () => q,
      startAfter: () => q,
      get: async () => ({ empty: true, docs: [] as unknown[] }),
    };
    return q;
  },
};

vi.mock("./db", () => ({ db: () => fakeDb, FIRESTORE_DB_ID: "insight" }));

const { runRebuild } = await import("./replay");

const QID = "daily-2026-08-24";
const OPTS = { apply: true, exclude: new Set<string>() };

/** A vote question the tool will address, and its published aggregate. */
function seed(total: number, stamp: Stamp) {
  docs.clear();
  docs.set(`v2_questions/${QID}`, {
    data: { surface: "daily", type: "binary", options: ["A", "B"] },
    updateTime: { seconds: 1, nanoseconds: 0 },
  });
  docs.set(AGG(QID), { data: { total, counts: { "0": total } }, updateTime: stamp });
  aggStamps = [stamp];
  aggGets = 0;
}

describe("runRebuild's write-side refusals", () => {
  beforeEach(() => { aggGets = 0; });

  it("refuses to overwrite a published aggregate with an empty fold", async () => {
    seed(42, { seconds: 100, nanoseconds: 0 });
    await expect(runRebuild(QID, OPTS)).rejects.toThrow(/matched no answers/);
  });

  it("…and allowEmpty is the deliberate way through, all the way to the write", async () => {
    // The escape hatch matters as much as the refusal: a question really
    // can go from answered to unanswered (an erasure sweep, a retraction),
    // and that is the repair this tool exists for.
    //
    // apply: true, and that is the assertion rather than a detail. Written
    // with apply: false this case passed while the guard was made
    // UNCONDITIONAL — because all three refusals live inside `if
    // (opts.apply)`, so a dry run never reaches any of them. It was a test
    // of the dry-run path wearing the escape hatch's name.
    seed(42, { seconds: 100, nanoseconds: 0 });
    writes.length = 0;
    deletes.length = 0;
    const report = await runRebuild(QID, { ...OPTS, allowEmpty: true });
    expect(report.applied).toBe(true);
    expect(report.scanned).toBe(0);
    expect(writes.map((w) => w.path)).toEqual([AGG(QID)]);
    expect(writes[0].data.total).toBe(0);
    // …and the tail goes with it (D400): an empty fold has no shards, so
    // all eight are deleted in the same batch — a rebuild is a whole
    // replacement of both documents' worth, never of the hot one alone.
    expect(report.tailShards).toBe(0);
    expect(deletes).toEqual(Array.from({ length: 8 }, (_, s) => `v2_agg_overflow/${QID}-${s}`));
  });

  it("refuses when the aggregate carries no write stamp", async () => {
    // undefined rather than absent: docStamp returns null for a document
    // that does not exist (a first fold, legitimately) and undefined for
    // one that exists with no updateTime — only the second is unverifiable.
    seed(42, undefined);
    await expect(runRebuild(QID, { ...OPTS, allowEmpty: true }))
      .rejects.toThrow(/no write stamp/);
  });

  it("refuses when a fold landed during the scan", async () => {
    seed(42, { seconds: 100, nanoseconds: 0 });
    // Second read of the same ref, different stamp — the race the guard is
    // for. allowEmpty so the empty-scan refusal above cannot be what fires.
    aggStamps = [{ seconds: 100, nanoseconds: 0 }, { seconds: 200, nanoseconds: 0 }];
    await expect(runRebuild(QID, { ...OPTS, allowEmpty: true }))
      .rejects.toThrow(/was written during the scan/);
  });
});
