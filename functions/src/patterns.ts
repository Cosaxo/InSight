// patterns.ts — the Patterns fold's wiring (v28 §2, trial per D166 §1,
// gated by D167). The arithmetic lives in patternsFit.ts, pure; this file
// decides WHAT gets folded and WHERE the state lives, behind an injected
// store (the calls.ts precedent) so the pass logic tests without an
// emulator.
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
// Scale note, recorded not built (D7): the day's per-user fold holds the
// active users' vectors in memory — fine to ~100k DAU under 256MiB, and
// the fix at that size is paging the fold by uid range, not a bigger box.
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { FieldValue } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
// ops.ts sets the global runtime options as an import side effect and must
// stay imported for that reason wherever a function is declared, like every
// other function module imports it (check:fn-runtime guards the outcome).
import { LIGHT_UNBOUNDED, FUNCTIONS_REGION } from "./ops";
import { TEST_AXES, TEST_ITEM_META, V2_QUESTIONS } from "./v2content";
import { db as firestore } from "./db";
import { readLedgerDay } from "./ledger";
import { fitAxes, traitScores, type PublishedAxes } from "./axesFit";
import {
  PATTERNS_K,
  PATTERNS_MIN_BASIS,
  emptyModel,
  emptyUser,
  encodeAnswer,
  foldUserDay,
  publishableLoadings,
  readyPool,
  type PatternsModel,
  type PatternsObservation,
  type PatternsUserState,
} from "./patternsFit";

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

/** A missed night folds on the next run, up to a week back — bounded, so
 * a long outage cannot turn the catch-up into an unbounded ledger scan.
 * Beyond it, unfolded days stay unfolded and the basis counts say so. */
export const PATTERNS_CATCHUP_DAYS = 7;

/** key → label for the published axes block, compiled from the same
 * source the instruments render from (AXES-RUNBOOK 1.1). */
export const AXES_LABELS: ReadonlyMap<string, string> = new Map(
  TEST_AXES.map((a) => [a.key, a.label]),
);

export interface PatternsLedgerEntry {
  uid: string;
  qid: string;
  optionIdx?: number;
}

/** The I/O the fit needs, as an interface (calls.ts's store precedent) —
 * the sweep's pass logic is testable without any Firestore shape. */
export interface PatternsStore {
  /** The ledger entries for one UTC day, oldest first. */
  ledgerDay(dayKey: string): Promise<PatternsLedgerEntry[]>;
  getModel(): Promise<(PatternsModel & { lastDay?: string }) | null>;
  putModel(model: PatternsModel, lastDay: string, folded: number): Promise<void>;
  getUsers(uids: string[]): Promise<Map<string, PatternsUserState>>;
  putUsers(states: Map<string, PatternsUserState>): Promise<void>;
  // ── the axes sweep's three (AXES-PLAN §2, AXES-RUNBOOK 1.1–1.2) ──
  /** Every fitted person's θ — the whole population, uid → state. */
  allUserStates(): Promise<Map<string, PatternsUserState>>;
  /** Every public test-surface answer, the sweep's read: uid, qid, and
   * the vote. One doc per (person, question) by the create-only rule. */
  testAnswers(): Promise<Array<{ uid: string; qid: string; optionIdx: number }>>;
  /** Publish the axes block beside the loadings. Called on EVERY folding
   * run, an empty block included — the recording-fake test pins that, so
   * a fit that quietly stops writing the block fails a test instead of
   * shipping silence (the D265 pattern). */
  putAxes(axes: PublishedAxes): Promise<void>;
}

// The fold arithmetic lives in pure.ts (ORIENTATION §3). Re-exported
// because this module's own test imports it from here, and because the
// two nightly folds must not be able to disagree about what a day is.
import { utcDay } from "./pure";
export { utcDay };

/**
 * Fold every unfolded day up to and including yesterday. Idempotent: the
 * model carries the last folded day, so a retried schedule re-folds
 * nothing and a missed night folds on the next run.
 */
export async function runPatternsFit(
  store: PatternsStore,
  nowMs: number,
  eligible: ReadonlySet<string> = PATTERNS_QIDS,
): Promise<{ days: number; folded: number; users: number; questions: number; axes: number }> {
  const yesterday = utcDay(nowMs, -1);
  const floor = utcDay(nowMs, -PATTERNS_CATCHUP_DAYS);
  const model = (await store.getModel()) ?? { ...emptyModel(PATTERNS_K), lastDay: "" };
  const lastDay = model.lastDay ?? "";

  // the days still owed, oldest first, bounded by the catch-up window
  const days: string[] = [];
  for (let off = -PATTERNS_CATCHUP_DAYS; off <= -1; off++) {
    const day = utcDay(nowMs, off);
    if (day > lastDay && day >= floor) days.push(day);
  }
  if (!days.length || yesterday <= lastDay) {
    // No new folds means no θ moved, so the standing axes block is still
    // the truth — the sweep is skipped rather than re-run for free.
    return { days: 0, folded: 0, users: 0, questions: Object.keys(model.q).length, axes: 0 };
  }

  let folded = 0;
  const touched = new Set<string>();
  for (const day of days) {
    const entries = (await store.ledgerDay(day)).filter(
      (e) => eligible.has(e.qid) && (e.optionIdx === 0 || e.optionIdx === 1),
    );
    if (!entries.length) continue;
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
    // `ledgerDay` returns the day in `at` order, so the last entry for a pair
    // is the newest.
    const byUid = new Map<string, Map<string, number>>();
    for (const e of entries) {
      const seen = byUid.get(e.uid) ?? new Map<string, number>();
      seen.set(e.qid, encodeAnswer(e.optionIdx as number));
      byUid.set(e.uid, seen);
    }
    const states = await store.getUsers([...byUid.keys()].sort());
    for (const [uid, seen] of [...byUid.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
      const obs: PatternsObservation[] = [...seen.entries()].map(([qid, x]) => ({ qid, x }));
      obs.sort((a, b) => (a.qid < b.qid ? -1 : 1));
      const user = states.get(uid) ?? emptyUser(model.k);
      foldUserDay(model, user, obs);
      states.set(uid, user);
      touched.add(uid);
      folded += obs.length;
    }
    await store.putUsers(states);
  }
  await store.putModel(model, yesterday, folded);

  // ── the axes projection (AXES-PLAN §2: "project, don't refit") ──────
  //
  // Runs after the fold so it regresses on tonight's θ, and only on
  // folding nights — an unchanged population projects to an unchanged
  // block. The sweep is the plan's own priced shape: one pass over every
  // fitted person's θ and one over the public test answers, nothing
  // per-person published (n people enter, one direction per axis leaves).
  // putModel rewrites the whole loadings doc without the axes field and
  // putAxes merges it back one write later — a crash in that window
  // leaves a doc with no block for a night, which the client draws as
  // nothing (D1), never as stale axes against fresh loadings.
  const states = await store.allUserStates();
  const answers = await store.testAnswers();
  const byUidAnswers = new Map<string, Array<{ qid: string; optionIdx: number }>>();
  for (const a of answers) {
    const list = byUidAnswers.get(a.uid) ?? [];
    list.push({ qid: a.qid, optionIdx: a.optionIdx });
    byUidAnswers.set(a.uid, list);
  }
  const persons: Array<{ theta: readonly number[]; scores: ReadonlyMap<string, number> }> = [];
  for (const [uid, state] of states) {
    const mine = byUidAnswers.get(uid);
    if (!mine || state.n <= 0) continue;
    const scored = traitScores(mine, TEST_ITEM_META);
    if (!scored.size) continue;
    persons.push({
      theta: state.v,
      scores: new Map([...scored.entries()].map(([k2, s]) => [k2, s.value])),
    });
  }
  const axes = fitAxes(persons, model.k, AXES_LABELS);
  await store.putAxes(axes);

  return {
    days: days.length,
    folded,
    users: touched.size,
    questions: Object.keys(model.q).length,
    axes: Object.keys(axes).length,
  };
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
      };
    },
    async putModel(model, lastDay, folded) {
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
            { v: s.v, n: s.n, at: FieldValue.serverTimestamp() },
          );
        }
        await batch.commit();
      }
    },
    async allUserStates() {
      // Every patterns subcollection holds exactly one doc ("state"), so
      // the collection-group query IS the fitted population. Admin SDK —
      // the rules' readable-by-nobody deny is for clients; the sweep runs
      // where the private column lives and publishes only the regression
      // (AXES-PLAN §2's custody rule).
      const snap = await db.collectionGroup("patterns").get();
      const out = new Map<string, PatternsUserState>();
      for (const d of snap.docs) {
        const uid = d.ref.parent.parent?.id;
        if (!uid || d.id !== "state") continue;
        out.set(uid, {
          v: (d.get("v") as number[]) ?? [],
          n: (d.get("n") as number) ?? 0,
        });
      }
      return out;
    },
    async testAnswers() {
      // The value filter mirrors the client rules' shape (voters.ts): one
      // surface, named. Test answers are public by D98; the sweep reads
      // qid + vote and the uid the path carries, nothing else.
      const snap = await db
        .collectionGroup("answers")
        .where("surface", "==", "test")
        .get();
      const out: Array<{ uid: string; qid: string; optionIdx: number }> = [];
      for (const d of snap.docs) {
        const uid = d.ref.parent.parent?.id;
        const qid = d.get("qid") as string;
        const optionIdx = d.get("optionIdx");
        if (!uid || typeof qid !== "string" || typeof optionIdx !== "number") continue;
        out.push({ uid, qid, optionIdx });
      }
      return out;
    },
    async putAxes(axes) {
      await modelRef.set(
        { axes, axesAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
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
