// patterns.ts — the Patterns fold's wiring (v28 §2, trial per D166 §1,
// gated by D167). The arithmetic lives in patternsFit.ts, pure; this file
// decides WHAT gets folded and WHERE the state lives, behind an injected
// store (the calls.ts precedent) so the pass logic tests without an
// emulator. Since axes step 1.1 (AXES-PLAN §2) the same nightly pass also
// folds each person's instrument answers into trait votes (axesFold.ts,
// pure for the same reason) — same ledger read, same user-state write,
// nothing on the answer trigger.
//
// THE SHAPE, and why it is a nightly sweep rather than a trigger arm.
// VISION-V28 §2 asks for "a streaming/incremental fit over the vote log",
// and the app already KEEPS a vote log: the agg-events ledger (D28) —
// one entry per aggregate answer, uid + qid, 90-day TTL, deleted with the
// account. The trigger option — updating vectors inside onV2AnswerCreated
// — would put a read and a write on the app's hottest path (the exact
// worry §2 names), break the pulse.test.mjs tripwire that pins the
// trigger at 5 tx.get sites, and buy real-time vectors nothing needs: a
// map redraws daily at most. So the fit runs where the app's other four
// daily jobs run, folds YESTERDAY's ledger in one pass, and publishes
// once — the write-contention wall (D7) never hears about it.
//
// The ledger lacked one field the fit needs — WHICH option — so
// ledgerEntry now carries optionIdx (v2.ts). Entries written before that
// field existed simply do not fold; the basis counts say so.
//
// THE CORPUS IS CORE ONLY (D161), enforced here at build time: the
// eligible set compiles from the bank the same way POLITICAL_QIDS does,
// so a tail answer cannot enter the fold by any path. Eligibility is the
// prototype's own pool rule — two options, nothing else — over the daily
// bank (core by construction) and the feed's core: true questions.
//
// Scale note, recorded not built (D7) — and CORRECTED 2026-08-31, because
// it named the wrong term and therefore the wrong fix.
//
// It said the binding cost is "the active users' vectors in memory", with
// the remedy "paging the fold by uid range". The vectors are eight floats
// per person; the term that actually binds is the LEDGER DAY, which
// `readLedgerDay` pages out of Firestore and then returns as one array.
// Measured here with realistic 28-character uids and bank-shaped qids,
// after a forced gc: ~290 bytes retained per entry — 124 MiB at 450k
// entries, 250 MiB at 900k. At COSTS.md's ~5 world answers per user per
// day, 100k DAU is ~500k entries ≈ 139 MiB for the array alone, before the
// per-uid Map of Maps built on top of it, the vectors, and node's own
// baseline, on a 256 MiB instance.
//
// Paging by uid range cannot help: the whole day is read precisely to
// learn which uids answered. The fix is the one `velocity.ts` already
// took and wrote down — fold each PAGE as it arrives (`foldInto` there)
// instead of buffering the day — and its note explains why this failure is
// worse than a lost run: nothing here advances a cursor until the end, so
// an OOM re-reads the same day and dies identically, every night, with
// the shards and the rollup behind it never draining.
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { FieldValue } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
// ops.ts sets the global runtime options as an import side effect and must
// stay imported for that reason wherever a function is declared, like every
// other function module imports it (check:fn-runtime guards the outcome).
import { LIGHT_UNBOUNDED, FUNCTIONS_REGION } from "./ops";
import { V2_QUESTIONS } from "./v2content";
import { db as firestore } from "./db";
import { readLedgerDay } from "./ledger";
import {
  PATTERNS_K,
  PATTERNS_MIN_BASIS,
  emptyDayScore,
  emptyModel,
  emptyUser,
  encodeAnswer,
  foldUserDay,
  publishableLoadings,
  publishableQuality,
  displacementSummary,
  readyPool,
  type PatternsDayScore,
  type PatternsDisplacement,
  type PatternsModel,
  type PatternsObservation,
  type PatternsQuality,
  type PatternsQualityDay,
  type PatternsUserState,
} from "./patternsFit";
import { foldTraitDay, traitItems, type TraitVotes } from "./axesFold";

/** The eligible pool: two options (the engine is one bit per question —
 * the prototype's own rule), and CORE ONLY (D161): the daily bank is core
 * by construction, a feed question only if it says so. Everything else —
 * tests, learn, pulse's composite ids, calls, catalog — never enters. */
export const PATTERNS_QIDS: ReadonlySet<string> = new Set(
  V2_QUESTIONS.filter(
    (q) =>
      Array.isArray(q.options) && q.options.length === 2 &&
      (q.surface === "daily" || (q.surface === "feed" && q.core === true)),
  ).map((q) => q.id),
);

/** The instruments' items, compiled from the bank the way PATTERNS_QIDS
 * is (axes step 1.1, AXES-PLAN §2): the axes fold reads these out of the
 * same ledger days the fit already reads, at zero extra Firestore reads.
 * Disjoint from PATTERNS_QIDS by construction — instrument items are
 * 5-option test-surface, the fit's pool is two-option daily/core-feed —
 * and the no-tautology pin in patterns.test.ts is what keeps "by
 * construction" from silently becoming "used to be". */
export const AXES_TRAIT_ITEMS = traitItems(V2_QUESTIONS);
const AXES_TRAIT_QIDS: ReadonlySet<string> = new Set(AXES_TRAIT_ITEMS.map((i) => i.qid));

/** A missed night folds on the next run, up to a week back — bounded, so
 * a long outage cannot turn the catch-up into an unbounded ledger scan.
 * Beyond it, unfolded days stay unfolded and the basis counts say so. */
export const PATTERNS_CATCHUP_DAYS = 7;

export interface PatternsLedgerEntry {
  uid: string;
  qid: string;
  optionIdx?: number;
  /** Present only on a D86 edit (v2.ts's ledgerEntry): the index the
   *  answer moved away from. Its ABSENCE is what marks a first answer. */
  fromIdx?: number;
}

/** What the per-person state doc carries: the fit's own vector state plus
 * the axes fold's trait votes (step 1.1). One doc on purpose — putUsers
 * replaces the doc whole, so a second doc would double the write count for
 * nothing, and the erasure story is already this subtree's. */
export type PatternsUserDoc = PatternsUserState & {
  /** Trait votes, qid → 0..4 (axesFold.TraitVotes). Optional because every
   * doc written before this existed has none. */
  t?: TraitVotes;
};

/** The I/O the fit needs, as an interface (calls.ts's store precedent) —
 * the sweep's pass logic is testable without any Firestore shape. */
export interface PatternsStore {
  /** The ledger entries for one UTC day, oldest first. */
  ledgerDay(dayKey: string): Promise<PatternsLedgerEntry[]>;
  /** The model, plus the published quality series (D325) so the fit can
   * append to it rather than restart it every night. */
  getModel(): Promise<(PatternsModel & {
    lastDay?: string;
    series?: PatternsQualityDay[];
    /** The previous publish in full — carried forward by a run that scores
     * nothing, so a crashed day does not cost the perQ table too. */
    quality?: PatternsQuality;
  }) | null>;
  putModel(
    model: PatternsModel,
    lastDay: string,
    folded: number,
    quality: PatternsQuality,
    displacement: PatternsDisplacement,
  ): Promise<void>;
  getUsers(uids: string[]): Promise<Map<string, PatternsUserDoc>>;
  putUsers(states: Map<string, PatternsUserDoc>): Promise<void>;
}

// The fold arithmetic lives in pure.ts (ORIENTATION §3). Re-exported
// because this module's own test imports it from here, and because the
// two nightly folds must not be able to disagree about what a day is.
import { utcDay } from "./pure";
export { utcDay };

/**
 * Fold every unfolded day up to and including yesterday.
 *
 * IDEMPOTENT PER PERSON, which is the claim that is true. The model's
 * cursor is written ONCE, after the whole catch-up loop, while the user
 * vectors are written per day — so a crash inside the loop leaves the
 * cursor behind and the next run re-reads days these vectors already
 * carry. `foldUserDay` is a STEP, not a set, so re-reading them moved
 * every touched person's vector twice and re-stepped the model from it.
 * The docstring here used to say the model's cursor made that impossible.
 *
 * Each vector now carries the last day folded into it and a day already
 * stamped on a person is skipped.
 *
 * WHAT THAT COSTS, stated because it is a real trade and not a free win.
 * The model and the vectors co-evolve: the model is stepped from each
 * person's vector as that person's day is folded. On a retry the skipped
 * people do not step the model either, so a crashed night's contribution
 * to the MODEL from people already folded is lost rather than applied
 * twice. That is the same bargain the engagement folds strike — "a crash
 * leaves work unfolded rather than double-folded" — and it is the right
 * one here: an under-learned day is noise in an online fit, while a
 * double-stepped vector is a person's own coordinate moved to somewhere
 * they never were.
 */
export async function runPatternsFit(
  store: PatternsStore,
  nowMs: number,
  eligible: ReadonlySet<string> = PATTERNS_QIDS,
): Promise<{ days: number; folded: number; users: number; questions: number; bits: number; traits: number }> {
  const yesterday = utcDay(nowMs, -1);
  const floor = utcDay(nowMs, -PATTERNS_CATCHUP_DAYS);
  const model = (await store.getModel()) ?? { ...emptyModel(PATTERNS_K), lastDay: "" };
  const lastDay = model.lastDay ?? "";
  // The published series this run appends to, and the loadings as the
  // last run PUBLISHED them (getModel reads the doc, so these are the
  // 4 dp vectors a returning reader was actually shown) — copied before
  // the fold mutates them, so the displacement summary (D325) compares
  // publish to publish with zero extra reads.
  const priorSeries = model.series ?? [];
  // The whole previous publish, not just its series: it is what a run that
  // scores nothing carries forward, perQ table included.
  const prevQuality = model.quality;
  const prevPub: Record<string, number[]> = {};
  for (const [qid, L] of Object.entries(model.q)) prevPub[qid] = [...L.v];

  // the days still owed, oldest first, bounded by the catch-up window
  const days: string[] = [];
  for (let off = -PATTERNS_CATCHUP_DAYS; off <= -1; off++) {
    const day = utcDay(nowMs, off);
    if (day > lastDay && day >= floor) days.push(day);
  }
  if (!days.length || yesterday <= lastDay) {
    return { days: 0, folded: 0, users: 0, questions: Object.keys(model.q).length, bits: 0, traits: 0 };
  }

  let folded = 0;
  let traits = 0;
  const touched = new Set<string>();
  // One tally per owed day (D325) — a day with nothing eligible keeps
  // its n: 0 row, so the series says "no answers" out loud rather than
  // skipping the date (the putModel zero-rather-than-nothing idiom).
  const scored: { day: string; score: PatternsDayScore }[] = [];
  for (const day of days) {
    const score = emptyDayScore();
    scored.push({ day, score });
    const dayEntries = await store.ledgerDay(day);
    const entries = dayEntries.filter(
      (e) => eligible.has(e.qid) && (e.optionIdx === 0 || e.optionIdx === 1),
    );
    // The axes fold's slice of the SAME read (step 1.1, AXES-PLAN §2):
    // instrument answers, 0..4. Disjoint from `entries` — the no-tautology
    // pin in patterns.test.ts is what holds that — so no row is ever both.
    const traitEntries = dayEntries.filter(
      (e) =>
        AXES_TRAIT_QIDS.has(e.qid) &&
        Number.isInteger(e.optionIdx) &&
        (e.optionIdx as number) >= 0 && (e.optionIdx as number) <= 4,
    );
    let refolded = 0;
    if (!entries.length && !traitEntries.length) continue;
    // group by person; sort each person's day by qid so a replay
    // reproduces the run (the fit is order-sensitive within a day)
    //
    // ONE OBSERVATION PER (person, question), LAST WINS. The ledger is a log
    // of aggregate EVENTS, not of people: a D86 edit writes a second entry
    // under a fresh `event.id` (v2.ts, the onV2AnswerUpdated handler), byte-
    // identical in shape to the create it supersedes. Read as two rows, one
    // person who answered 0 and changed their mind to 1 folds as two people
    // who disagree — 30 of them became `{n: 60, marginal: 0}`, a p0 of 0.500
    // against a truth of 0.050. That inflates the published basis
    // `nextAsk(minBasis = 8)` gates the Oracle on, and whipsaws theta inside
    // a single day.
    //
    // v2.ts:161 shows the theta consequence of edits was considered and
    // accepted; the n and marginal dilution was not. Deduping here rather
    // than at either write site because the ledger's two entries are both
    // correct as AGGREGATE events — the -old/+new delta the counts need is
    // exactly why the second one exists. It is only this reader that wants a
    // person's latest answer instead.
    //
    // AND ACROSS DAYS, WHICH IS THE COMMON CASE. This map was built inside
    // the per-day loop and nowhere else, so "last wins" held only within
    // one UTC day — while an edit has no day window at all (rules impose a
    // 60-second cooldown, nothing more). A person who changed their mind
    // on Tuesday about Monday's answer produced exactly the
    // `{n: 60, marginal: 0}` the paragraph above calls the bug, from the
    // very code that says it fixed it.
    //
    // What makes it fixable without per-person state is that an edit's
    // ledger entry now carries `fromIdx` — what the answer moved away
    // from. An entry with no `fromIdx` is a first answer and counts a
    // person; a day whose entries for a pair are ALL edits is a revision
    // of something an earlier day folded, and moves the marginal by
    // -old/+new without adding to `n` (foldUserDay). An edit written
    // before that field existed carries none, so it reads as a first
    // answer and folds the old way — history stays as it was folded.
    //
    // `ledgerDay` returns the day in `at` order, so the last entry for a pair
    // is the newest and the FIRST edit carries the value the model holds.
    const byUid = new Map<string, Map<string, { x: number; prev?: number }>>();
    for (const e of entries) {
      const seen = byUid.get(e.uid) ?? new Map<string, { x: number; prev?: number }>();
      const x = encodeAnswer(e.optionIdx as number);
      const cur = seen.get(e.qid);
      if (e.fromIdx === undefined) {
        // A first answer supersedes anything the day held for this pair:
        // create-then-edit inside one day is one person, final answer.
        seen.set(e.qid, { x });
      } else if (cur) {
        // Another edit on a pair the day has already classified — keep
        // that classification, take the newer answer.
        seen.set(e.qid, { ...cur, x });
      } else {
        seen.set(e.qid, { x, prev: encodeAnswer(e.fromIdx) });
      }
      byUid.set(e.uid, seen);
    }
    // Trait answers group per person too, kept in `at` order — last wins
    // inside foldTraitDay, so the dedupe pass above is not repeated here.
    const traitByUid = new Map<string, PatternsLedgerEntry[]>();
    for (const e of traitEntries) {
      const list = traitByUid.get(e.uid) ?? [];
      list.push(e);
      traitByUid.set(e.uid, list);
    }
    const uids = [...new Set([...byUid.keys(), ...traitByUid.keys()])].sort();
    const states = await store.getUsers(uids);
    const write = new Map<string, PatternsUserDoc>();
    // People whose PATTERNS observations folded this attempt. The
    // crashed-day publication guard below is about the fit's own
    // scorecard, so a trait-only write must not satisfy it.
    let stepped = 0;
    for (const uid of uids) {
      const user: PatternsUserDoc = states.get(uid) ?? emptyUser(model.k);
      // ALREADY FOLDED — a previous attempt at this day wrote this person
      // before it died. Neither the vector nor the model steps again (see
      // the note on the trade in this function's header), and that same
      // attempt's putUsers carried the trait votes, so nothing is owed
      // there either.
      if (user.d && user.d >= day) { if (byUid.has(uid)) refolded += 1; continue; }
      const seen = byUid.get(uid);
      if (seen) {
        const obs: PatternsObservation[] = [...seen.entries()].map(([qid, v]) => (
          v.prev === undefined ? { qid, x: v.x } : { qid, x: v.x, prev: v.prev }
        ));
        obs.sort((a, b) => (a.qid < b.qid ? -1 : 1));
        foldUserDay(model, user, obs, score);
        folded += obs.length;
        stepped += 1;
      }
      const te = traitByUid.get(uid);
      if (te) {
        const t = user.t ?? {};
        const applied = foldTraitDay(t, te, AXES_TRAIT_QIDS);
        // Hang the map on the doc only when something landed — an empty
        // `t` written for everybody would be noise on every state doc.
        if (applied) { user.t = t; traits += applied; }
      }
      user.d = day;
      write.set(uid, user);
      touched.add(uid);
    }
    if (write.size) await store.putUsers(write);
    // A DAY A DEAD RUN ALREADY FOLDED IS NOT AN EMPTY DAY. The retry guard
    // above skips everybody a previous attempt stamped, so `score` stays at
    // n: 0 — and a zero row published into the series says exactly what the
    // series' own docstring defines it to mean: nobody answered. For a day
    // that had answers, folded into the model that crashed before it could
    // publish. The row then lives 90 days in the standing prequential
    // record D325 keeps as "the number any candidate engine must beat", and
    // the ledger day it describes is consumed, so nothing can recompute it.
    //
    // Silence is the honest reading: a previous attempt owned that day's
    // score and it is gone. Dropped from `scored` rather than published,
    // and only when the day had entries and every one of them was skipped
    // as already folded — a day that genuinely had no eligible answers
    // keeps its n: 0 row, which is the putModel zero-rather-than-nothing
    // idiom working as intended.
    if (!stepped && refolded > 0) scored.pop();
  }
  // …and if EVERY owed day was one of those, there is no head to publish.
  // `lastDay` still advances — the days really are folded, and not
  // advancing would re-walk them forever, since every user is stamped — so
  // the previous publish is carried forward untouched rather than replaced
  // by a row about nothing.
  const quality = scored.length
    ? publishableQuality(scored, priorSeries)
    : (prevQuality ?? publishableQuality([{ day: yesterday, score: emptyDayScore() }], priorSeries));
  const displacement = displacementSummary(prevPub, model);
  await store.putModel(model, yesterday, folded, quality, displacement);
  return { days: days.length, folded, users: touched.size, questions: Object.keys(model.q).length, bits: quality.bits, traits };
}

/** The Firestore store. State lives in two places, each chosen for its
 * erasure story: the model in ONE public doc (v2_patterns/loadings —
 * world-readable like every aggregate, written once per run so D7's
 * write wall never hears about it, nothing per-person in it), and each
 * person's vector under their own subtree (v2_users/{uid}/patterns/state
 * — readable by NOBODY, the push/ precedent, and deleteAccount's
 * recursive delete takes it with the account, no new arm). */
export function firestorePatternsStore(db: Firestore): PatternsStore {
  const modelRef = db.collection("v2_patterns").doc("loadings");
  return {
    async ledgerDay(dayKey) {
      // One reader for one day of the ledger, shared with the taste fold
      // (ledger.ts, extracted at D322 for D197's one-copy reason).
      return readLedgerDay(db, dayKey);
    },
    async getModel() {
      const snap = await modelRef.get();
      if (!snap.exists) return null;
      return {
        k: (snap.get("k") as number) ?? PATTERNS_K,
        q: (snap.get("q") as PatternsModel["q"]) ?? {},
        lastDay: (snap.get("lastDay") as string) ?? "",
        series: (snap.get("quality") as PatternsQuality | undefined)?.series ?? [],
        quality: snap.get("quality") as PatternsQuality | undefined,
      };
    },
    async putModel(model, lastDay, folded, quality, displacement) {
      // publishableLoadings rounds to 4 dp — the next run refits from the
      // rounded values, a perturbation orders of magnitude under the
      // step size, and the doc stays small enough to read in one go
      const q: Record<string, { v: number[]; n: number; sum: number }> = {};
      const pub = publishableLoadings(model);
      for (const [qid, L] of Object.entries(model.q)) {
        q[qid] = { v: pub[qid].v, n: L.n, sum: L.sum };
      }
      await modelRef.set({
        k: model.k,
        lastDay,
        folded,
        at: FieldValue.serverTimestamp(),
        q,
        // ── the fit's own scorecard (D325) ─────────────────────────
        //
        // Both ride the loadings doc and its one nightly write: the
        // prequential score (pooled daily series plus the floored
        // per-question day — patternsFit.PATTERNS_QUALITY_FLOOR has the
        // floor's why) and the publish-to-publish loading-space
        // displacement. Zero extra reads, zero extra writes; the client
        // reads only `k` and `q` and ignores both until something is
        // built to draw them.
        quality,
        displacement,
      });
      // ── the mount signal (D265) ──────────────────────────────────
      //
      // The Patterns tab is absent from the bar until the fit can carry
      // it, and the client decides that from ONE number: how many
      // questions are fitted on a basis worth drawing. That number has to
      // reach a device that has not opened the tab — which is every
      // device, before the gate opens — so it cannot live in the loadings
      // doc: reading 11 KB of vectors on every cold start to decide
      // whether to render a button is the read this app spends its
      // hydrate budget avoiding.
      //
      // `v2_meta/app` is the document `hydrate()` already fetches for
      // contentRev and the build gates, so the gate costs ZERO extra
      // reads — the same argument D196's gate makes by folding aggregates
      // the store already holds. Merged, never set: this fit owns two
      // fields on a document the seed and the operator own the rest of.
      //
      // The floor rides along with the count so the client can tell what
      // the number means rather than assuming (patternsFit.readyPool).
      await db.collection("v2_meta").doc("app").set(
        {
          patternsPool: readyPool(model, PATTERNS_MIN_BASIS),
          patternsBasis: PATTERNS_MIN_BASIS,
        },
        { merge: true },
      );
    },
    async getUsers(uids) {
      const out = new Map<string, PatternsUserState>();
      for (let i = 0; i < uids.length; i += 300) {
        const chunk = uids.slice(i, i + 300);
        const refs = chunk.map((uid) =>
          db.collection("v2_users").doc(uid).collection("patterns").doc("state"));
        const snaps = await db.getAll(...refs);
        snaps.forEach((snap, j) => {
          if (snap.exists) {
            out.set(chunk[j], {
              v: (snap.get("v") as number[]) ?? [],
              n: (snap.get("n") as number) ?? 0,
              // The day stamp, BOTH WAYS — see the twin in taste.ts. The
              // retry guard reads `d` off what this returns, so omitting
              // it here made that guard dead in production.
              ...(snap.get("d") ? { d: String(snap.get("d")) } : {}),
              // The trait votes, both ways for the same reason: putUsers
              // replaces the doc whole, so a `t` this projection dropped
              // would be erased by the person's next patterns-only fold.
              ...(snap.get("t") ? { t: snap.get("t") as TraitVotes } : {}),
            });
          }
        });
      }
      return out;
    },
    async putUsers(states) {
      const entries = [...states.entries()];
      for (let i = 0; i < entries.length; i += 400) {
        const batch = db.batch();
        for (const [uid, s] of entries.slice(i, i + 400)) {
          batch.set(
            db.collection("v2_users").doc(uid).collection("patterns").doc("state"),
            // `set` with no merge replaces the document — `d` and `t` have
            // to be named or the stamp/votes never land (or, worse for
            // `t`, land once and vanish on the next write).
            { v: s.v, n: s.n, at: FieldValue.serverTimestamp(), ...(s.d ? { d: s.d } : {}), ...(s.t ? { t: s.t } : {}) },
          );
        }
        await batch.commit();
      }
    },
  };
}

const REGION = FUNCTIONS_REGION;

export const fitPatternsV2 = onSchedule(
  // Nightly, off the top-of-hour herd and before the velocity scan reads
  // the same ledger for its own purpose. Cost is in docs/COSTS.md's
  // Patterns row — measured before this shipped, per VISION-V28 §11.4.
  { schedule: "37 2 * * *", region: REGION, ...LIGHT_UNBOUNDED },
  async () => {
    const summary = await runPatternsFit(firestorePatternsStore(firestore()), Date.now());
    if (summary.folded > 0 || summary.days > 0) {
      logger.info("patterns fit", { metric: "patterns_fit", ...summary });
    }
  },
);
