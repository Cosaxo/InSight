// The sweep's pass logic, against an injected store (the calls.test.ts
// precedent — the real Firestore is not needed to prove which writes a
// function chooses to make). What matters here and is pinned:
//
//   1. CORE ONLY (D161) — a tail or ineligible entry never folds, by any
//      path. This is the fold half of the rule SCALE-RUNBOOK 2.1 records;
//      the eligible set compiles from the bank.
//   2. Idempotence — a retried schedule re-folds nothing (lastDay), and a
//      missed night folds on the next run, bounded by the catch-up window.
//   3. Entries without an option (pre-deploy ledger rows, catalog rows)
//      are skipped, not guessed.
import { describe, expect, it, vi } from "vitest";

vi.mock("firebase-functions", () => ({
  logger: { info() {}, warn() {}, error() {} },
}));

import { PATTERNS_CATCHUP_DAYS, PATTERNS_QIDS, firestorePatternsStore, runPatternsFit, utcDay, type PatternsLedgerEntry, type PatternsStore } from "./patterns";
import { V2_QUESTIONS } from "./v2content";
import type { Firestore } from "firebase-admin/firestore";
import {
  PATTERNS_MIN_BASIS,
  PATTERNS_QUALITY_FLOOR,
  PATTERNS_QUALITY_NOTE,
  emptyModel,
  prequentialBits,
  type PatternsDisplacement,
  type PatternsModel,
  type PatternsQuality,
  type PatternsUserState,
} from "./patternsFit";

const NOW = Date.UTC(2026, 7, 19, 3, 0, 0); // the 02:37 schedule's morning

function memoryStore(ledger: Record<string, PatternsLedgerEntry[]>) {
  const state: {
    model: (PatternsModel & { lastDay?: string }) | null;
    users: Map<string, PatternsUserState>;
    putModelCalls: number;
    breakPutModelOnce: boolean;
    quality: PatternsQuality | null;
    displacement: PatternsDisplacement | null;
  } = {
    model: null, users: new Map(), putModelCalls: 0,
    breakPutModelOnce: false, quality: null, displacement: null,
  };
  const store: PatternsStore = {
    async ledgerDay(day) { return ledger[day] ?? []; },
    // the real store hands the series back off the published doc — the
    // memory one hands back what the last putModel published
    async getModel() {
      return state.model
        ? {
          ...state.model,
          series: state.quality?.series ?? [],
          // The whole previous publish, as the real store hands it back —
          // a run that scores nothing carries it forward rather than
          // replacing it with a row about nothing.
          ...(state.quality ? { quality: state.quality } : {}),
        }
        : null;
    },
    async putModel(model, lastDay, folded, quality, displacement) {
      if (state.breakPutModelOnce) {
        state.breakPutModelOnce = false;
        throw new Error("model write lost");
      }
      state.model = { ...model, lastDay };
      state.quality = quality;
      state.displacement = displacement;
      state.putModelCalls++;
      void folded;
    },
    // PROJECTED, field by field, exactly as firestorePatternsStore does —
    // and it used to hand back the same object REFERENCE, so anything the
    // fold hung on the state survived here for free while the real store
    // named `v` and `n` and nothing else. That is how the retry guard
    // shipped dead. A fake that carries more than its subject proves
    // nothing about it.
    async getUsers(uids) {
      const out = new Map<string, PatternsUserState>();
      for (const uid of uids) {
        const s = state.users.get(uid);
        if (s) out.set(uid, { v: [...s.v], n: s.n, ...(s.d ? { d: s.d } : {}) });
      }
      return out;
    },
    async putUsers(states) {
      for (const [uid, s] of states) {
        state.users.set(uid, { v: [...s.v], n: s.n, ...(s.d ? { d: s.d } : {}) });
      }
    },
  };
  return { store, state };
}

// two real eligible qids from the compiled bank, so the test moves with it
const [CORE_A, CORE_B] = [...PATTERNS_QIDS];
const yesterday = utcDay(NOW, -1);
const twoBack = utcDay(NOW, -2);

describe("the eligible set", () => {
  it("is two-option daily plus core feed, and nothing else", () => {
    for (const q of V2_QUESTIONS) {
      const expected =
        Array.isArray(q.options) && q.options.length === 2 &&
        (q.surface === "daily" || (q.surface === "feed" && q.core === true));
      expect(PATTERNS_QIDS.has(q.id), q.id).toBe(expected);
    }
    // and the set is non-trivial — a bank change that empties it should fail loudly
    expect(PATTERNS_QIDS.size).toBeGreaterThan(50);
  });
});

describe("what folds", () => {
  it("folds eligible entries and refuses tail, unknown and option-less ones", async () => {
    const { store, state } = memoryStore({
      [yesterday]: [
        { uid: "u1", qid: CORE_A, optionIdx: 0 },
        { uid: "u1", qid: CORE_B, optionIdx: 1 },
        { uid: "u1", qid: "feed-tail-x", optionIdx: 0 },      // not in the bank → tail by definition
        { uid: "u1", qid: CORE_A },                            // pre-deploy row, no option
        { uid: "u2", qid: CORE_A, optionIdx: 1 },
      ],
    });
    const r = await runPatternsFit(store, NOW);
    expect(r.folded).toBe(3);
    expect(r.users).toBe(2);
    expect(Object.keys(state.model?.q ?? {}).sort()).toEqual([CORE_A, CORE_B].sort());
    expect(state.model?.q[CORE_A].n).toBe(2);
    expect(state.users.get("u1")?.n).toBe(2);
    expect(state.users.get("u2")?.n).toBe(1);
  });
});

describe("idempotence and catch-up", () => {
  it("a second run the same morning folds nothing", async () => {
    const { store, state } = memoryStore({
      [yesterday]: [{ uid: "u1", qid: CORE_A, optionIdx: 0 }],
    });
    await runPatternsFit(store, NOW);
    const again = await runPatternsFit(store, NOW);
    expect(again.folded).toBe(0);
    expect(state.model?.q[CORE_A].n).toBe(1);
  });

  // THE CRASH the case above cannot reach. "A second run the same
  // morning" works because the cursor was written; the cursor is written
  // ONCE, after the whole catch-up loop, while the user vectors are
  // written per day — so a crash inside the loop leaves the cursor behind
  // and the next run re-reads days those vectors already carry.
  // `foldUserDay` is a step, not a set, so it moved every touched
  // person's coordinate twice.
  it("a crash before the model is published does not step a vector twice", async () => {
    const { store, state } = memoryStore({
      [yesterday]: [{ uid: "u1", qid: CORE_A, optionIdx: 0 }],
    });
    state.breakPutModelOnce = true;
    await expect(runPatternsFit(store, NOW)).rejects.toThrow("model write lost");
    const after = state.users.get("u1")!;
    expect(after.n, "the vector was written before the crash").toBe(1);
    expect(after.d, "and stamped with the day it folded").toBe(yesterday);
    expect(state.model, "the cursor never landed").toBeNull();

    const again = await runPatternsFit(store, NOW);
    expect(
      state.users.get("u1")!.n,
      "the vector was stepped twice — the crash left the cursor behind and "
      + "the retry re-read a day this person already carries",
    ).toBe(1);
    expect(again.folded).toBe(0);
    expect(again.users).toBe(0);
  });

  // …AND IT DOES NOT PUBLISH "NOBODY ANSWERED" ABOUT THAT DAY. The retry
  // guard above skips everybody the dead run stamped, so the re-walk scores
  // nothing — and a zero row in the series means exactly one thing, which
  // that day is not: the day HAD answers, they were folded, and the run
  // that folded them died before it could publish. The row would have sat
  // 90 days in the standing prequential record, and the ledger day is
  // consumed, so nothing could ever recompute it.
  it("a crashed day is not republished as a day nobody answered", async () => {
    const { store, state } = memoryStore({
      [twoBack]: [{ uid: "u1", qid: CORE_A, optionIdx: 0 }, { uid: "u2", qid: CORE_A, optionIdx: 1 }],
      [yesterday]: [{ uid: "u1", qid: CORE_B, optionIdx: 1 }, { uid: "u2", qid: CORE_B, optionIdx: 0 }],
    });
    state.breakPutModelOnce = true;
    await expect(runPatternsFit(store, NOW)).rejects.toThrow("model write lost");
    expect(state.quality, "nothing was published by the run that died").toBeNull();

    await runPatternsFit(store, NOW);
    const series = state.quality!.series;
    const zeros = series.filter((r) => r.n === 0).map((r) => r.day);
    // Only about the two days that HAD answers. The catch-up window's
    // genuinely empty days keep their zero rows, which is the putModel
    // zero-rather-than-nothing idiom saying something true.
    expect(zeros, "a day that had answers was published as a day with none")
      .not.toContain(twoBack);
    expect(zeros).not.toContain(yesterday);
    // …and the cursor still advanced, or the same days would be re-walked
    // every night forever: every person is stamped, so no later run can
    // ever score them.
    expect(state.model!.lastDay).toBe(yesterday);
  });

  it("keeps a day the retry actually scored, even though a dead run stamped some of it", async () => {
    // THE CASE THE `&&` EXISTS FOR, and the one neither test above
    // reaches: both of those are all-or-nothing — every person stamped, or
    // no entries at all. The guard drops a day only when it had entries
    // AND every one of them was already folded. A PARTIAL crash — the run
    // died after stamping some people and before stamping the rest — is
    // the ordinary shape of a crash, and there `write.size` is non-zero
    // and `refolded` is non-zero at the same time.
    //
    // Measured before this case existed: `&&` → `||` left all 616
    // functions tests green, and the day that really scored an
    // observation then vanished from the published series — the standing
    // 90-day prequential record D325 calls "the number any candidate
    // engine must beat", world-readable and unrecomputable once the
    // ledger day it describes has been consumed. `taste.test.ts` has this
    // exact case for its own fold; its twin here did not.
    const { store, state } = memoryStore({
      [yesterday]: [
        { uid: "stamped", qid: CORE_A, optionIdx: 0 },
        { uid: "fresh", qid: CORE_A, optionIdx: 1 },
      ],
    });
    // What a dead run leaves behind: one person carrying the day's stamp,
    // one untouched. `d >= day` is the retry guard's own test.
    state.users.set("stamped", { v: Array(8).fill(0), n: 1, d: yesterday });

    await runPatternsFit(store, NOW);

    const row = state.quality!.series.find((r) => r.day === yesterday);
    expect(row, "the day the retry scored is missing from the series").toBeTruthy();
    expect(row!.n, "the day was published as one nobody answered").toBeGreaterThan(0);
    // …and the person the dead run never reached really was folded, so
    // this is a day that was scored rather than merely kept.
    expect(state.users.get("fresh")?.d).toBe(yesterday);
  });

  it("publishes NO scorecard when every owed day crashed and there is no prior", async () => {
    // The hole in the case above's own scenario. When `scored` empties AND
    // there is no previous publish to carry forward, the fallback
    // manufactured `publishableQuality([{ day: yesterday, score:
    // emptyDayScore() }])` — the exact "nobody answered" row the drop
    // exists to suppress, published as the head of the series.
    //
    // Reachable, and this is the shape: a FIRST-EVER run with answers on
    // every day of the catch-up window, which dies before putModel. Every
    // person is stamped as folded, no model was written, so the retry
    // drops all seven days and has no prior. The case above escapes it
    // only because its window still holds five genuinely-empty days.
    const ledger: Record<string, Array<{ uid: string; qid: string; optionIdx: number }>> = {};
    for (let back = 1; back <= PATTERNS_CATCHUP_DAYS; back++) {
      ledger[utcDay(NOW, -back)] = [
        { uid: "u1", qid: CORE_A, optionIdx: 0 },
        { uid: "u2", qid: CORE_A, optionIdx: 1 },
      ];
    }
    const { store, state } = memoryStore(ledger);
    state.breakPutModelOnce = true;
    await expect(runPatternsFit(store, NOW)).rejects.toThrow("model write lost");
    expect(state.quality, "nothing was published by the run that died").toBeNull();

    const r = await runPatternsFit(store, NOW);
    //  because the two absences differ by construction: the
    // memory store starts at null and the fix OMITS the field, so it is
    // undefined. Both mean the same thing here — nothing was published.
    expect(state.quality ?? null, "a run with nothing to score published a day nobody answered")
      .toBeNull();
    // The model itself still publishes and the cursor still advances —
    // the loadings are the product, the scorecard is the commentary.
    expect(state.model!.lastDay).toBe(yesterday);
    expect(r.bits).toBe(0);
  });

  it("a vector written before the stamp existed folds once, not never", async () => {
    // Every vector in production predates `d`. An absent stamp has to mean
    // "fold it", or this fix would freeze every existing coordinate.
    const { store, state } = memoryStore({
      [yesterday]: [{ uid: "u1", qid: CORE_A, optionIdx: 0 }],
    });
    state.users.set("u1", { v: [0, 0, 0, 0, 0, 0, 0, 0], n: 3 });
    const r = await runPatternsFit(store, NOW);
    expect(r.folded).toBe(1);
    expect(state.users.get("u1")!.n).toBe(4);
    expect(state.users.get("u1")!.d).toBe(yesterday);
  });

  it("a missed night folds on the next run, oldest day first", async () => {
    const dayBefore = utcDay(NOW, -2);
    const { store, state } = memoryStore({
      [dayBefore]: [{ uid: "u1", qid: CORE_A, optionIdx: 0 }],
      [yesterday]: [{ uid: "u1", qid: CORE_A, optionIdx: 0 }],
    });
    // the model has folded up to three days ago; two nights are owed
    state.model = { k: 8, q: {}, lastDay: utcDay(NOW, -3) };
    const r = await runPatternsFit(store, NOW);
    expect(r.days).toBe(2);
    expect(state.model?.q[CORE_A].n).toBe(2);
    expect(state.model?.lastDay).toBe(yesterday);
  });

  it("a fresh model's first run asks the whole bounded window", async () => {
    const { store } = memoryStore({
      [yesterday]: [{ uid: "u1", qid: CORE_A, optionIdx: 0 }],
    });
    const r = await runPatternsFit(store, NOW);
    expect(r.days).toBe(7); // asked, not folded — six were empty
    expect(r.folded).toBe(1);
  });

  it("folds a D86 edit as ONE answer, not as two people disagreeing", async () => {
    // The ledger is a log of aggregate EVENTS. An optionIdx edit writes a
    // second entry under a fresh event.id, byte-identical in shape to the
    // create it supersedes — so a person who answered 0 and changed their
    // mind to 1 arrived here as two rows. Thirty of them folded as
    // {n: 60, marginal: 0}: a p0 of 0.500 against a truth of 0.050, which
    // inflates the basis nextAsk(minBasis = 8) gates the Oracle on.
    const { store } = memoryStore({
      [yesterday]: [
        { uid: "u1", qid: CORE_A, optionIdx: 0 },   // answered
        { uid: "u1", qid: CORE_A, optionIdx: 1 },   // …then edited
        { uid: "u2", qid: CORE_A, optionIdx: 1 },   // one real second person
      ],
    });
    const r = await runPatternsFit(store, NOW);
    // Two people, two observations — not three.
    expect(r.folded).toBe(2);
    expect(r.users).toBe(2);
  });

  it("keeps the LATEST answer of an edited pair, not the first", async () => {
    // Last-wins, because ledgerDay returns the day in `at` order. Taking the
    // first would fold the answer the user explicitly retracted, which is
    // worse than double-counting: it is confidently wrong rather than noisy.
    //
    // Read through the user state: u1's only surviving observation must be
    // the one u2 agrees with, so both users fold identically.
    const edited = memoryStore({
      [yesterday]: [
        { uid: "u1", qid: CORE_A, optionIdx: 0 },
        { uid: "u1", qid: CORE_A, optionIdx: 1 },
      ],
    });
    await runPatternsFit(edited.store, NOW);
    const plain = memoryStore({
      [yesterday]: [{ uid: "u1", qid: CORE_A, optionIdx: 1 }],
    });
    await runPatternsFit(plain.store, NOW);
    expect(edited.state.users.get("u1")).toEqual(plain.state.users.get("u1"));
    expect(edited.state.model?.q).toEqual(plain.state.model?.q);
  });

  it("an edit made on a LATER day is a revision, not a second person", async () => {
    // The case the per-day dedupe could not see, and the common one: an
    // edit has no day window, so most of them land after the day the
    // answer was folded. Read as a first answer it put the same person in
    // `n` twice and left both answers in `sum` — thirty people who said 0
    // and changed to 1 published `{n: 60, marginal: 0}` where the truth is
    // `{n: 30, marginal: +1}`.
    const dayA = utcDay(NOW, -2);
    const dayB = utcDay(NOW, -1);
    const N = 30;
    const ledger: Record<string, PatternsLedgerEntry[]> = { [dayA]: [], [dayB]: [] };
    for (let i = 0; i < N; i++) {
      const uid = `u${i}`;
      ledger[dayA].push({ uid, qid: CORE_A, optionIdx: 1 });
      // the edit: option 1 → option 0, carrying what it moved away from
      ledger[dayB].push({ uid, qid: CORE_A, optionIdx: 0, fromIdx: 1 });
    }
    const { store, state } = memoryStore(ledger);
    await runPatternsFit(store, NOW);
    const L = state.model!.q[CORE_A];
    expect(L.n, "the population did not grow — one member changed their mind").toBe(N);
    expect(L.sum / L.n, "everyone now says option 0, which encodes +1").toBe(1);
  });

  it("counts the person once even when the create and the edit share a day", async () => {
    // The other order, which the per-day dedupe already handled and must
    // keep handling: a create and an edit on the same day is one person
    // with their final answer, never a revision of something unfolded.
    const { store, state } = memoryStore({
      [yesterday]: [
        { uid: "u1", qid: CORE_A, optionIdx: 1 },
        { uid: "u1", qid: CORE_A, optionIdx: 0, fromIdx: 1 },
      ],
    });
    await runPatternsFit(store, NOW);
    const L = state.model!.q[CORE_A];
    expect(L.n).toBe(1);
    expect(L.sum).toBe(1);
  });

  it("folds an edit written before the ledger carried fromIdx exactly as it used to", async () => {
    // History is not rewritten. An entry with no `fromIdx` is a first
    // answer by definition, so rows already in the ledger keep folding the
    // way they were folded — the fix is forward-looking and says so.
    const dayA = utcDay(NOW, -2);
    const dayB = utcDay(NOW, -1);
    const { store, state } = memoryStore({
      [dayA]: [{ uid: "u1", qid: CORE_A, optionIdx: 1 }],
      [dayB]: [{ uid: "u1", qid: CORE_A, optionIdx: 0 }],
    });
    await runPatternsFit(store, NOW);
    expect(state.model!.q[CORE_A].n).toBe(2);
  });

  it("still folds two DIFFERENT questions from one person", async () => {
    // The dedup is per (person, question). Collapsing to one observation per
    // person would be the obvious wrong version of this fix, and it would
    // quietly halve the model's input.
    const { store } = memoryStore({
      [yesterday]: [
        { uid: "u1", qid: CORE_A, optionIdx: 0 },
        { uid: "u1", qid: CORE_B, optionIdx: 1 },
      ],
    });
    const r = await runPatternsFit(store, NOW);
    expect(r.folded).toBe(2);
    expect(r.users).toBe(1);
  });

  it("the catch-up window is bounded — an ancient lastDay does not scan the whole ledger", async () => {
    const { store, state } = memoryStore({});
    state.model = { k: 8, q: {}, lastDay: "2020-01-01" };
    const r = await runPatternsFit(store, NOW);
    // only the last PATTERNS_CATCHUP_DAYS days were even asked for
    expect(r.days).toBeLessThanOrEqual(7);
  });
});

// ── the fit's own scorecard (D325) ────────────────────────────────────
//
// The two bridge-approved instruments, at the run level: the prequential
// score is computed ON the fold (one step ahead, the model as it stood),
// and the displacement compares publish to publish. Both ride putModel;
// neither adds a read or a write.
describe("the scorecard the run publishes", () => {
  it("scores the day one step ahead and publishes pooled bits with the day's basis", async () => {
    const { store, state } = memoryStore({
      [yesterday]: [
        { uid: "u1", qid: CORE_A, optionIdx: 0 },
        { uid: "u2", qid: CORE_A, optionIdx: 0 },
      ],
    });
    const r = await runPatternsFit(store, NOW);
    const q = state.quality;
    expect(q?.day).toBe(yesterday);
    expect(q?.n).toBe(2);
    // u1 folds first (uid order): a never-seen question against a zero
    // vector is a coin — exactly 1 bit. u2 then faces a marginal of +1
    // and agrees with it: the Oracle link's own clamp price.
    const expected = (1 + prequentialBits(1, 1)) / 2;
    expect(q?.bits).toBeCloseTo(expected, 3);
    expect(r.bits).toBe(q?.bits);
    expect(q?.note).toBe(PATTERNS_QUALITY_NOTE);
  });

  it("keeps an n:0 row for an empty day rather than skipping the date", async () => {
    const { store, state } = memoryStore({
      [yesterday]: [{ uid: "u1", qid: CORE_A, optionIdx: 0 }],
    });
    await runPatternsFit(store, NOW);
    // a fresh model asks the whole bounded window; six of the seven days
    // held nothing and the series says so out loud
    const series = state.quality?.series ?? [];
    expect(series).toHaveLength(7);
    expect(series[series.length - 1]).toEqual({ day: yesterday, n: 1, bits: 1 });
    expect(series.filter((row) => row.n === 0)).toHaveLength(6);
  });

  it("appends to the published series across runs instead of restarting it", async () => {
    const today = utcDay(NOW, 0);
    const ledger = {
      [yesterday]: [{ uid: "u1", qid: CORE_A, optionIdx: 0 }],
      [today]: [{ uid: "u2", qid: CORE_A, optionIdx: 1 }],
    };
    const { store, state } = memoryStore(ledger);
    await runPatternsFit(store, NOW);
    const tomorrow = NOW + 24 * 3600 * 1000;
    await runPatternsFit(store, tomorrow);
    const series = state.quality?.series ?? [];
    expect(series).toHaveLength(8); // 7 from the first window + 1 owed day
    expect(series[series.length - 1]?.day).toBe(today);
  });

  it("publishes a question's own day only at the floor, pooled always (the verdict's condition)", async () => {
    const crowd = Array.from({ length: PATTERNS_QUALITY_FLOOR }, (_, i) => ({
      uid: `u${i}`,
      qid: CORE_A,
      optionIdx: (i % 2) as 0 | 1,
    }));
    const { store, state } = memoryStore({
      [yesterday]: [...crowd, { uid: "u0", qid: CORE_B, optionIdx: 0 }],
    });
    await runPatternsFit(store, NOW);
    const q = state.quality;
    // CORE_B's one answer IS one person's surprisal — pooled only
    expect(q?.n).toBe(PATTERNS_QUALITY_FLOOR + 1);
    expect(Object.keys(q?.perQ ?? {})).toEqual([CORE_A]);
    expect(q?.perQ[CORE_A]?.n).toBe(PATTERNS_QUALITY_FLOOR);
    expect(q?.floor).toBe(PATTERNS_QUALITY_FLOOR);
  });

  it("measures displacement publish-to-publish, in loading space, unaligned", async () => {
    const today = utcDay(NOW, 0);
    const ledger = {
      [yesterday]: [
        { uid: "u1", qid: CORE_A, optionIdx: 0 },
        { uid: "u2", qid: CORE_A, optionIdx: 1 },
        { uid: "u1", qid: CORE_B, optionIdx: 0 },
      ],
      [today]: [{ uid: "u3", qid: CORE_A, optionIdx: 1 }],
    };
    const { store, state } = memoryStore(ledger);
    await runPatternsFit(store, NOW);
    // the first publish has nothing behind it to compare against
    expect(state.displacement).toMatchObject({ space: "loading", n: 0, moved: 0 });

    // Day 2's answerer carries a real vector — a fresh user's θ is all
    // zeros, and e·θ is the only term that moves a loading beyond the
    // 4 dp the publication keeps, so a cold crowd would (correctly)
    // measure as "nothing moved".
    state.users.set("u3", { v: [1, 0, 0, 0, 0, 0, 0, 0], n: 5 });
    await runPatternsFit(store, NOW + 24 * 3600 * 1000);
    const d = state.displacement;
    // both previously published questions are compared; only the one the
    // new day folded moved (CORE_B saw no answer, so it sat still)
    expect(d?.n).toBe(2);
    expect(d?.moved).toBe(1);
    expect(Object.keys(d?.perQ ?? {})).toEqual([CORE_A]);
    expect(d?.max).toBe(d?.perQ[CORE_A]);
    expect(d?.p50).toBe(0); // the median question did not move
  });
});

// ── the mount signal (D265) ───────────────────────────────────────────
//
// The publication half, which the injected store above deliberately
// cannot see: `firestorePatternsStore` is what decides WHERE the numbers
// land, and the tab appearing at all depends on the second write landing
// on the document `hydrate()` reads. Without this, a fit that stopped
// writing the signal would leave the tab hidden on a database full of
// loadings — a failure with no error anywhere, which is the shape the
// store interface exists to keep testable.
describe("what the fit publishes for the tab's gate", () => {
  /** putModel touches two collections and nothing else, so the cast is a
   * claim this test can be read against rather than a hole. */
  const asDb = (fake: { collection: (name: string) => unknown }): Firestore =>
    fake as unknown as Firestore;

  /** Just enough Firestore for putModel: refs that record their writes. */
  function fakeDb() {
    const writes: { path: string; data: Record<string, unknown>; opts?: unknown }[] = [];
    const db = {
      collection(name: string) {
        return {
          doc(id: string) {
            return {
              set(data: Record<string, unknown>, opts?: unknown) {
                writes.push({ path: `${name}/${id}`, data, opts });
                return Promise.resolve();
              },
            };
          },
        };
      },
    };
    return { db, writes };
  }

  const modelWith = (basisByQid: Record<string, number>): PatternsModel => {
    const model = emptyModel();
    for (const [qid, n] of Object.entries(basisByQid)) {
      model.q[qid] = { v: Array.from({ length: model.k }, () => 0.1), n, sum: 0 };
    }
    return model;
  };

  // the scorecard fixtures putModel now carries (D325) — what the run
  // computed; this block only cares WHERE they land
  const QUALITY: PatternsQuality = {
    day: "2026-08-22",
    n: 12,
    bits: 0.91,
    perQ: {},
    floor: PATTERNS_QUALITY_FLOOR,
    series: [{ day: "2026-08-22", n: 12, bits: 0.91 }],
    note: PATTERNS_QUALITY_NOTE,
  };
  const DISPLACEMENT: PatternsDisplacement = {
    space: "loading", n: 0, moved: 0, mean: 0, p50: 0, p90: 0, max: 0, perQ: {},
  };

  it("writes the drawable count and its floor onto the meta doc, merged", async () => {
    const { db, writes } = fakeDb();
    // three published questions, two of them at the floor or better
    const model = modelWith({ a: PATTERNS_MIN_BASIS, b: PATTERNS_MIN_BASIS + 40, c: 1 });
    await firestorePatternsStore(asDb(db)).putModel(model, "2026-08-22", 12, QUALITY, DISPLACEMENT);

    expect(writes.map((w) => w.path)).toEqual(["v2_patterns/loadings", "v2_meta/app"]);
    const loadings = writes[0];
    // every vector still publishes, floor or no floor — the basis rides
    // with each one and the readers refuse per question
    expect(Object.keys(loadings.data.q as Record<string, unknown>)).toEqual(["a", "b", "c"]);
    // the scorecard rides the SAME write (D325): no extra doc, no extra
    // read for whoever comes to draw it
    expect(loadings.data.quality).toEqual(QUALITY);
    expect(loadings.data.displacement).toEqual(DISPLACEMENT);

    const meta = writes[1];
    expect(meta.data).toEqual({ patternsPool: 2, patternsBasis: PATTERNS_MIN_BASIS });
    // MERGED, never set: contentRev, latestBuild, minBuild and updateUrl
    // live on this document and belong to the seed and the operator.
    expect(meta.opts).toEqual({ merge: true });
  });

  it("publishes a zero rather than nothing when no question is drawable yet", async () => {
    const { db, writes } = fakeDb();
    await firestorePatternsStore(asDb(db)).putModel(modelWith({ a: 1, b: 2 }), "2026-08-22", 2, QUALITY, DISPLACEMENT);
    // A field that stops being written is a field the client keeps
    // reading at its last value — so early nights say 0 out loud.
    expect(writes[1].data).toEqual({ patternsPool: 0, patternsBasis: PATTERNS_MIN_BASIS });
  });
});
