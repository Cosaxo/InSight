// profileFanout.test.ts — a changed stamp reaches the rows, and only the
// rows, that exist (DATA-EFFICIENCY-RUNBOOK 2.1).
//
// The fake below is the shape restampSamples touches: an answers
// subcollection paged by id with a projection, a getAll over the sample
// documents, and batches of dotted-path updates. Every write is recorded,
// because the whole claim is WHICH documents were written and WHAT paths.
import { describe, expect, it } from "vitest";
import {
  FANOUT_BUDGET_PREFIX, FANOUT_HEAL_CAP, PROFILE_FANOUT_PER_HOUR, fanoutBudgetId,
  firestoreFanoutHealStore, restampSamples, runFanoutHeal, sampleIdsFor, takeFanoutBudget,
  type FanoutHealStore,
} from "./profileFanout";
import { FieldPath, type Firestore } from "firebase-admin/firestore";
import type { ProfileStamp } from "./profileStamp";
import { PATTERNS_QIDS } from "./patterns";
import { citySampleId, worldSampleId } from "./patternsSamples";

const [CORE_A, CORE_B] = [...PATTERNS_QIDS];

describe("sampleIdsFor", () => {
  it("names the world sample per corpus question and the city sample per frozen city, deduped and sorted", () => {
    const eligible = new Set([CORE_A, CORE_B]);
    const ids = sampleIdsFor([
      { qid: CORE_A, city: "Oslo, NO" },
      { qid: CORE_A, city: "Oslo, NO" },
      { qid: CORE_B },
      { qid: CORE_B, city: "  " },
      { qid: "feed-tail-x", city: "Oslo, NO" }, // no sample exists for the tail
      { qid: "" },
    ], eligible);
    expect(ids).toEqual([
      citySampleId(CORE_A, "Oslo, NO"),
      worldSampleId(CORE_A),
      worldSampleId(CORE_B),
    ].sort());
  });

  it("defaults to the fit's own corpus", () => {
    expect(sampleIdsFor([{ qid: CORE_A }, { qid: "not-a-question" }])).toEqual([worldSampleId(CORE_A)]);
  });
});

describe("restampSamples", () => {
  type Row = Record<string, unknown>;
  function fakeDb(answers: Row[], docs: Record<string, Row>) {
    const updates: Array<{ id: string; data: Record<string, unknown> }> = [];
    const gotIds: string[] = [];
    let projection: string[] = [];
    let from = 0;
    const answersQuery = {
      orderBy: () => answersQuery,
      select: (...f: string[]) => { projection = f; return answersQuery; },
      limit: () => answersQuery,
      startAfter: () => { from = answers.length; return answersQuery; },
      async get() {
        const slice = answers.slice(from);
        return { size: slice.length, docs: slice.map((r) => ({ get: (f: string) => (projection.includes(f) ? r[f] : undefined) })) };
      },
    };
    const db = {
      collection: (name: string) => ({
        doc: (id: string) => (name === "v2_users"
          ? { collection: () => answersQuery }
          : { __id: id }),
      }),
      async getAll(...refs: Array<{ __id: string }>) {
        return refs.map((r) => {
          gotIds.push(r.__id);
          const data = docs[r.__id];
          return { exists: !!data, ref: r, get: (f: string) => data?.[f] };
        });
      },
      batch: () => {
        const pending: typeof updates = [];
        return {
          update: (ref: { __id: string }, data: Record<string, unknown>) => { pending.push({ id: ref.__id, data }); },
          async commit() { updates.push(...pending); },
        };
      },
    };
    return { db: db as unknown as Parameters<typeof restampSamples>[0], updates, gotIds, projection: () => projection };
  }

  const stamp = { n: "Olaf", s: { big5: { O: 70 } }, l: 55 };

  it("rewrites the three stamp fields under the account's row, in every sample that holds one", async () => {
    const world = worldSampleId(CORE_A);
    const city = citySampleId(CORE_A, "Oslo, NO");
    const { db, updates, gotIds, projection } = fakeDb(
      [{ qid: CORE_A, anchors: { city: "Oslo, NO" } }, { qid: CORE_B }],
      {
        [world]: { rows: { u1: { o: 0, a: {}, d: "2026-09-01", n: "old" }, u2: { o: 1, a: {}, d: "2026-09-01" } } },
        [city]: { rows: { u1: { o: 0, a: { city: "Oslo, NO" }, d: "2026-09-01" } } },
        // CORE_B's sample exists but this account has no row in it
        [worldSampleId(CORE_B)]: { rows: { u2: { o: 1, a: {}, d: "2026-09-01" } } },
      },
    );
    const touched = await restampSamples(db, "u1", stamp);
    expect(touched).toBe(2);
    expect(projection(), "the answers read carries more than the two fields it needs").toEqual(["qid", "anchors"]);
    expect(gotIds.sort()).toEqual([city, world, worldSampleId(CORE_B)].sort());
    expect(updates.map((u) => u.id).sort()).toEqual([city, world].sort());
    for (const u of updates) {
      expect(u.data).toEqual({ "rows.u1.n": "Olaf", "rows.u1.s": { big5: { O: 70 } }, "rows.u1.l": 55 });
    }
  });

  it("writes nothing for a row that is not there — a partial row would be minted otherwise", async () => {
    const { db, updates } = fakeDb(
      [{ qid: CORE_A }],
      { [worldSampleId(CORE_A)]: { rows: { u2: { o: 1, a: {}, d: "2026-09-01" } } } },
    );
    expect(await restampSamples(db, "u1", stamp)).toBe(0);
    expect(updates).toEqual([]);
  });

  it("reads nothing at all for an account with no corpus answers", async () => {
    const { db, gotIds } = fakeDb([{ qid: "learn-cell1" }], {});
    expect(await restampSamples(db, "u1", stamp)).toBe(0);
    expect(gotIds).toEqual([]);
  });
});

describe("takeFanoutBudget", () => {
  // The ledger as a transaction sees it: one document, read then written.
  function fakeLedger() {
    const docs: Record<string, Record<string, unknown>> = {};
    const db = {
      collection: () => ({ doc: (id: string) => ({ __id: id }) }),
      async runTransaction<T>(fn: (tx: unknown) => Promise<T>) {
        const tx = {
          async get(ref: { __id: string }) {
            const data = docs[ref.__id];
            return { exists: !!data, get: (f: string) => data?.[f] };
          },
          set(ref: { __id: string }, data: Record<string, unknown>) {
            docs[ref.__id] = { ...(docs[ref.__id] ?? {}), ...data };
          },
        };
        return fn(tx);
      },
    };
    return { db: db as unknown as Parameters<typeof takeFanoutBudget>[0], docs };
  }
  const HOUR = 3_600_000;

  it("allows the hour's changes, defers the next with a pending marker, and opens again an hour on", async () => {
    const { db, docs } = fakeLedger();
    const t0 = Date.UTC(2026, 8, 9, 12);
    for (let i = 0; i < PROFILE_FANOUT_PER_HOUR; i += 1) {
      expect(await takeFanoutBudget(db, "u1", t0 + i * 60_000)).toBe("now");
    }
    const ledger = docs[fanoutBudgetId("u1")];
    expect((ledger.events as number[]).length).toBe(PROFILE_FANOUT_PER_HOUR);
    expect(ledger.pending).toBe(false);
    // The fourth in the hour is the flipper's — or the fourth typo's —
    // and waits for the night.
    expect(await takeFanoutBudget(db, "u1", t0 + 10 * 60_000)).toBe("deferred");
    expect(docs[fanoutBudgetId("u1")].pending).toBe(true);
    expect((docs[fanoutBudgetId("u1")].events as number[]).length, "a refused change spends nothing").toBe(PROFILE_FANOUT_PER_HOUR);
    // An hour after the first, the window has slid and a change goes
    // through — and clears the marker, since it applies the current stamp.
    expect(await takeFanoutBudget(db, "u1", t0 + HOUR + 1)).toBe("now");
    expect(docs[fanoutBudgetId("u1")].pending).toBe(false);
    expect(docs[fanoutBudgetId("u1")].expireAt).toBeInstanceOf(Date);
  });

  it("budgets per account", async () => {
    const { db } = fakeLedger();
    const t0 = Date.UTC(2026, 8, 9, 12);
    for (let i = 0; i < PROFILE_FANOUT_PER_HOUR; i += 1) await takeFanoutBudget(db, "u1", t0 + i);
    expect(await takeFanoutBudget(db, "u1", t0 + 10)).toBe("deferred");
    expect(await takeFanoutBudget(db, "u2", t0 + 10)).toBe("now");
  });
});

describe("runFanoutHeal", () => {
  const stamp: ProfileStamp = { n: "Olaf", s: { big5: { O: 70 } }, l: 55 };
  function fakeStore(pending: string[], profiles: Record<string, ProfileStamp>) {
    const restamped: string[] = [];
    const cleared: string[] = [];
    let asked = 0;
    const store: FanoutHealStore = {
      // HONOURS THE LIMIT, which it recorded and then ignored. A fake
      // that answers more than its contract allows says nothing about a
      // caller whose defect is what it does at the cap — the same class
      // as the log reconcile's fake, and the pricing fold's, both of
      // which hid a real one.
      async pending(limit) { asked = limit; return pending.slice(0, limit); },
      async stampOf(uid) { return profiles[uid] ?? null; },
      async restamp(uid) { restamped.push(uid); return 4; },
      async clear(uid) { cleared.push(uid); },
    };
    return { store, restamped, cleared, asked: () => asked };
  }

  it("heals a full page and SAYS a night did not reach everyone", async () => {
    // `pending` is the count FETCHED, capped, so a night that left five
    // thousand accounts waiting reported the cap and read exactly like an
    // ordinary one — while the file's header promises the last name lands
    // within a day. The same silence the log reconcile carried.
    const many = Array.from({ length: FANOUT_HEAL_CAP * 2 + 1 }, (_, i) => `u${i}`);
    const profiles = Object.fromEntries(many.map((u) => [u, stamp]));
    const { store, restamped, cleared } = fakeStore(many, profiles);
    const out = await runFanoutHeal(store);
    expect(out).toMatchObject({ pending: FANOUT_HEAL_CAP, healed: FANOUT_HEAL_CAP, left: true });
    // The page is healed and no more; the rest keep their markers.
    expect(restamped).toHaveLength(FANOUT_HEAL_CAP);
    expect(cleared).toHaveLength(FANOUT_HEAL_CAP);
    expect(cleared).not.toContain(`u${FANOUT_HEAL_CAP}`);
  });

  it("a night at exactly the cap is not a backlog — the control", async () => {
    // Why the query asks for one MORE rather than testing the count: a
    // night with exactly the cap waiting and every one healed is
    // indistinguishable from a backlog if you infer it, and that
    // inference would warn on every busy night forever.
    const exact = Array.from({ length: FANOUT_HEAL_CAP }, (_, i) => `u${i}`);
    const { store } = fakeStore(exact, Object.fromEntries(exact.map((u) => [u, stamp])));
    expect(await runFanoutHeal(store)).toMatchObject({ pending: FANOUT_HEAL_CAP, left: false });
  });

  it("applies the current stamp for every deferred account, clears every marker, and reads nothing for a gone profile", async () => {
    const { store, restamped, cleared, asked } = fakeStore(["u1", "gone", "u2"], { u1: stamp, u2: stamp });
    const out = await runFanoutHeal(store);
    expect(restamped).toEqual(["u1", "u2"]);
    expect(cleared).toEqual(["u1", "gone", "u2"]);
    expect(out).toEqual({ pending: 3, healed: 2, touched: 8, left: false });
    // One MORE than the night can act on, so a backlog is a fact rather
    // than an inference from a full page (see runFanoutHeal).
    expect(asked()).toBe(FANOUT_HEAL_CAP + 1);
  });

  it("a night with no markers does nothing", async () => {
    const { store, restamped } = fakeStore([], {});
    expect(await runFanoutHeal(store)).toEqual({ pending: 0, healed: 0, touched: 0, left: false });
    expect(restamped).toEqual([]);
  });
});

describe("the heal's pending query", () => {
  // `v2_ratelimits` is SHARED — `suggest_`, `invite_`, `join_`,
  // `paidbook_` and the paid reviewer all keep ledgers in it. The prefix
  // filter that keeps the heal to its own rows was applied AFTER the
  // limit, which is worse than not filtering at all: the first ledger to
  // write `pending: true` for its own reasons fills the night's page with
  // rows that are then every one of them discarded, and the heal heals
  // nobody, every night, logging `pending: 0`.
  //
  // The fake models the ordering Firestore applies — by document id —
  // because that is what decides which rows a limit keeps, and a fake
  // that answers in insertion order would prove nothing about a page.
  function fakeDb(rows: { id: string; pending: boolean }[]) {
    const q = (where: [string | FieldPath, string, string | boolean][], lim: number | null) => ({
      where: (f: string | FieldPath, op: string, v: string | boolean) => q([...where, [f, op, v]], lim),
      limit: (n: number) => q(where, n),
      async get() {
        let out = rows.filter((r) => where.every(([f, op, v]) => {
          const got: string | boolean = typeof f === "string" ? r.pending : r.id;
          if (op === "==") return got === v;
          if (op === ">=") return String(got) >= String(v);
          if (op === "<") return String(got) < String(v);
          return false;
        }));
        out = [...out].sort((a, b) => a.id.localeCompare(b.id));
        if (lim != null) out = out.slice(0, lim);
        return { docs: out.map((r) => ({ id: r.id })) };
      },
    });
    return { collection: () => q([], null) } as unknown as Firestore;
  }

  it("is not starved by another ledger that borrows the field", () => {
    // Foreign ids that SORT BEFORE the prefix, which is the condition
    // that makes it bite: a query with one equality filter and a limit is
    // ordered by document id, so the page goes to whatever sorts first.
    // MEASURED, and it corrects the finding as first written: none of
    // today's neighbours does — `invite_`, `join_`, `paidbook_` and
    // `suggest_` all sort AFTER `fanout_`, so with the old query the
    // heal's own rows happened to survive. The exposure is a future
    // ledger whose prefix begins with a digit, an uppercase letter, or a
    // through e. One page's worth of those is enough to take the night,
    // every night, silently.
    const foreign = Array.from({ length: FANOUT_HEAL_CAP }, (_, i) => ({ id: `answer_${String(i).padStart(4, "0")}`, pending: true }));
    const mine = ["a", "b", "c"].map((u) => ({ id: `${FANOUT_BUDGET_PREFIX}${u}`, pending: true }));
    const store = firestoreFanoutHealStore(fakeDb([...foreign, ...mine]));
    return store.pending(FANOUT_HEAL_CAP).then((uids) => {
      expect(uids, "the night's page went to another ledger's rows").toEqual(["a", "b", "c"]);
    });
  });

  it("…and still takes only its own rows when nothing else is pending — the control", async () => {
    // The range must not be so wide that it adopts a neighbour, which is
    // the over-fix direction: `fanout` with no separator, and the next id
    // after the prefix's own successor.
    const store = firestoreFanoutHealStore(fakeDb([
      { id: `${FANOUT_BUDGET_PREFIX}a`, pending: true },
      { id: "fanout", pending: true },
      { id: "fanouta", pending: true },
      { id: `${FANOUT_BUDGET_PREFIX}b`, pending: false },
    ]));
    expect(await store.pending(FANOUT_HEAL_CAP)).toEqual(["a"]);
  });
});
