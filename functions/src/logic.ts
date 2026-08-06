// Verified logic attempts (D57 — the recorded reversal of D31's
// device-local deferral).
//
// The design in one line: the client is never the answer authority.
//
//   logicStartV2    mints the seed SERVER-side, stores it in a per-uid
//                   attempt doc clients cannot read, and returns the
//                   puzzles with the answer index — and the seed —
//                   withheld. Given only cells and options, the sole way
//                   to find the answer is to solve the puzzle, which is
//                   the thing being tested. (Recovering the seed from the
//                   puzzle content means brute-forcing 2^32 generations
//                   inside the attempt deadline — the deadline is what
//                   makes that not a plan.)
//   logicSubmitV2   takes raw pick indexes, regenerates the form from the
//                   stored {seed, gv}, scores inside the deadline, writes
//                   the canonical result to testResults.logic (a key the
//                   rules refuse to let clients mutate — the fcmTokens
//                   pattern), and folds the FIRST scored attempt per
//                   account into an anonymous score histogram, k-floored
//                   and published on the same cadence as the question
//                   aggregates.
//
// What this deliberately does NOT try to do: stop a solver from asking a
// person or a model for help. Unproctored testing cannot prevent
// solve-by-proxy; the per-item cap (enforced in aggregate by the attempt
// deadline) bounds it, and the honest claim is "verified" — scored by the
// server on a form the client could not have seen in advance — not
// "proctored".
//
// The generator import is the byte-identical synced copy of
// src/v2/data/logic-gen.ts — see its header and scripts/check-logic-sync.mjs.

import { getFirestore, type Transaction } from "firebase-admin/firestore";
import { randomBytes } from "node:crypto";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { ENFORCE_APP_CHECK, LIGHT_CALLABLE } from "./ops";
import { generateForm, version as GEN_VERSION, type Cell } from "./logic-gen";
import { shouldPublishAgg } from "./pure";
import { AGG_MIN_N, PUBLISH_EVERY } from "./v2";

const REGION = "us-central1";

// ── administration constants ──
// The per-item cap mirrors the overlay's ITEM_CAP (90s, D56); the server
// enforces the TOTAL: items × cap + slack for network and render. Slack is
// one extra item's worth — generous, because a refusal here surfaces to an
// honest finisher as a swallowed attempt.
export const LOGIC_ITEMS = 25;
export const LOGIC_ITEM_CAP_MS = 90_000;
export const LOGIC_DEADLINE_MS = LOGIC_ITEMS * LOGIC_ITEM_CAP_MS + LOGIC_ITEM_CAP_MS;

// Items per generator era: an attempt opened before a form-length change
// and submitted after it must be validated and scored against ITS form,
// not the current one (D59) — the deadline bounds that window to minutes,
// but a refusal there would swallow an honest finisher's attempt.
export function logicItemsFor(gv: number): number {
  return gv >= 3 ? 25 : 12;
}
// Starting an attempt previews a fresh form, so unfinished restarts
// are a preview channel — bounded per UTC day rather than closed, because
// a crashed app must be able to start again.
export const LOGIC_MAX_STARTS_PER_DAY = 3;
// One verified score is THE score for a while: re-verification opens after
// this many days. (First scored attempt feeds the norms histogram either
// way — the D32 "first attempt counts" rule, for the same reason: retakes
// measure practice, not the population.)
export const LOGIC_REVERIFY_DAYS = 30;

// The percentile curves, byte-for-byte the client's logicPctileFor
// (src/v2/data/logic-score.ts) — one per form length, landmarks asserted
// equal in logic.test.ts so the copies cannot drift apart silently. The
// 12-item parameters are D53's; the 25-item parameters are D59's
// re-derivation for the tail-heavy ramp. Both are only the bootstrap
// below the D58 measured floor.
const CURVES: Record<number, { mid: number; slope: number }> = {
  12: { mid: 62, slope: 14 },
  25: { mid: 54, slope: 12 },
};
export const logicPctileFor = (frac: number, items: number): number => {
  // Unknown lengths fall back by era: anything shorter than the v3 form
  // is legacy 12-item-era material (v1 back-fills reach here with the odd
  // truncated payload), and only 25+ means the tail-heavy ramp.
  const c = CURVES[items] || (items >= 25 ? CURVES[25] : CURVES[12]);
  return Math.max(1, Math.min(99, Math.round(100 / (1 + Math.exp(-((frac * 100) - c.mid) / c.slope)))));
};
export const logicPctile = (frac: number): number => logicPctileFor(frac, 12);

export const utcDayKey = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

// ── the attempt doc (v2_logic_attempts/{uid} — one per account) ──
export interface LogicAttempt {
  seed: number;
  gv: number;
  status: "open" | "scored";
  startedAtMs: number;
  deadlineMs: number;
  /** UTC day the start counter refers to */
  dayKey: string;
  startsToday: number;
  /** true once ANY attempt by this account has fed the norms histogram */
  normsCounted?: boolean;
  scoredAtMs?: number;
  score?: number;
  durationMs?: number;
}

// ── pure decision logic (unit-tested without an emulator) ──

export type StartVerdict = { ok: true } | { ok: false; code: string; msg: string };

export function canStartLogic(prev: LogicAttempt | null, nowMs: number): StartVerdict {
  if (prev) {
    if (
      prev.status === "scored"
      && prev.scoredAtMs != null
      && nowMs - prev.scoredAtMs < LOGIC_REVERIFY_DAYS * 86_400_000
    ) {
      return { ok: false, code: "cooldown", msg: "verified recently — try again later" };
    }
    if (prev.dayKey === utcDayKey(nowMs) && prev.startsToday >= LOGIC_MAX_STARTS_PER_DAY) {
      return { ok: false, code: "rate-limited", msg: "too many starts today" };
    }
  }
  return { ok: true };
}

export function nextStartsToday(prev: LogicAttempt | null, nowMs: number): number {
  return prev && prev.dayKey === utcDayKey(nowMs) ? prev.startsToday + 1 : 1;
}

// Picks: one per item, -1 = expired/unanswered, else an option index.
export function validLogicPicks(x: unknown, items: number = LOGIC_ITEMS): x is number[] {
  return Array.isArray(x)
    && x.length === items
    && x.every((v) => typeof v === "number" && Number.isInteger(v) && v >= -1 && v <= 5);
}

export function scoreLogicPicks(
  seed: number,
  gv: number,
  picks: number[],
): { marks: boolean[]; score: number } {
  const form = generateForm(seed, gv);
  const marks = form.items.map((item, i) => picks[i] === item.a);
  return { marks, score: marks.filter(Boolean).length };
}

// What the client is allowed to see at start time: renderable cells and
// options plus the (public, fixed-ramp) weight. NOT `a`, NOT `rules` —
// the family names would tell a coached solver which rule to hunt for,
// which is exactly the advance knowledge D56 removed.
export interface LogicClientItem {
  cells: Cell[];
  opts: Cell[];
  diff: number;
}

export function clientItems(seed: number, gv: number): LogicClientItem[] {
  return generateForm(seed, gv).items.map((it) => ({
    cells: it.cells,
    opts: it.opts,
    diff: it.diff,
  }));
}

// ── norms histogram fold (pure; the callable wraps it in a transaction) ──
// Flat b0..b25 buckets + n + the form length it counts (`items` — a
// histogram of 12-item scores must never mix with 25-item ones, so a
// length change starts a fresh era, D59). Exact counts live in the
// private doc; the
// public mirror appears only at or above the same floor as the question
// aggregates, and only every PUBLISH_EVERY-th count — the same
// step-attribution argument (a client watching the public doc must never
// see a lone +1 land right after a friend says "taking it now").
export type LogicNorms = Record<string, number>;

export function foldNorms(prev: LogicNorms | null, score: number): LogicNorms {
  const next: LogicNorms = { ...(prev || {}) };
  next.n = (next.n || 0) + 1;
  const key = `b${score}`;
  next[key] = (next[key] || 0) + 1;
  return next;
}

// ── the measured percentile (D58) ──
// Once the histogram holds enough verified first attempts, the percentile
// stops being a curve and becomes a count: the share of counted players
// this score strictly beats. Ties are not beaten — the claim stays "share
// of players this score beats", exactly the wording logic-score.ts pinned
// for the modelled curve this replaces. Below the floor the model keeps
// the job: an empirical percentile over a handful of players whipsaws by
// tens of points per submission, which is noise wearing a number.
//
// The floor's arithmetic (D58): at n = 100 the worst-case standard error
// of an empirical percentile is sqrt(0.5·0.5/100) ≈ 5 points — comparable
// to the modelled curve's own honesty margin — and the k-anonymity floor
// (AGG_MIN_N) is cleared twenty times over. One constant; lowering it is
// a recorded decision, not a tweak.
export const LOGIC_NORMS_MIN_N = 100;

export function measuredPctile(
  norms: LogicNorms | null,
  score: number,
): { pctile: number; n: number } | null {
  const n = norms?.n || 0;
  if (n < LOGIC_NORMS_MIN_N) return null;
  let below = 0;
  for (let s = 0; s < score; s++) below += norms?.[`b${s}`] || 0;
  // Clamped to the model's [1, 99] range: "top 0%" and "sharper than 100%
  // of players" are display absurdities at any n, and the two sources must
  // not disagree about what numbers are possible. Inside the clamp the
  // measurement speaks for itself — a perfect score among many perfects
  // reads exactly as low as it deserves to, and the model's 94 ceiling
  // (D53) does not apply: that cap existed because a CURVE cannot rank
  // perfect scores, and a count can.
  return { pctile: Math.max(1, Math.min(99, Math.round((100 * below) / n))), n };
}

// ── the callables ──

const attemptRef = (uid: string) => getFirestore().collection("v2_logic_attempts").doc(uid);

export const logicStartV2 = onCall(
  { ...LIGHT_CALLABLE, region: REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "must be signed in");
    const uid = request.auth.uid;
    const now = Date.now();
    const seed = randomBytes(4).readUInt32BE(0);

    await getFirestore().runTransaction(async (tx: Transaction) => {
      const ref = attemptRef(uid);
      const snap = await tx.get(ref);
      const prev = snap.exists ? (snap.data() as LogicAttempt) : null;
      const verdict = canStartLogic(prev, now);
      if (!verdict.ok) throw new HttpsError("failed-precondition", verdict.msg, { code: verdict.code });
      const attempt: LogicAttempt = {
        seed,
        gv: GEN_VERSION,
        status: "open",
        startedAtMs: now,
        deadlineMs: now + LOGIC_DEADLINE_MS,
        dayKey: utcDayKey(now),
        startsToday: nextStartsToday(prev, now),
        normsCounted: prev?.normsCounted === true,
      };
      tx.set(ref, attempt);
    });

    logger.info(`[logicStartV2] uid=${uid} attempt opened`);
    return {
      items: clientItems(seed, GEN_VERSION),
      capMs: LOGIC_ITEM_CAP_MS,
      deadlineMs: LOGIC_DEADLINE_MS,
    };
  },
);

export const logicSubmitV2 = onCall(
  { ...LIGHT_CALLABLE, region: REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "must be signed in");
    const uid = request.auth.uid;
    const picks = (request.data as { picks?: unknown } | null)?.picks;
    const now = Date.now();
    const db = getFirestore();

    const out = await db.runTransaction(async (tx: Transaction) => {
      const ref = attemptRef(uid);
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpsError("failed-precondition", "no open attempt");
      const attempt = snap.data() as LogicAttempt;
      if (attempt.status !== "open") throw new HttpsError("failed-precondition", "already scored");
      if (now > attempt.deadlineMs) throw new HttpsError("deadline-exceeded", "attempt expired");

      // Validated against the ATTEMPT's form length: an attempt opened just
      // before a form-length deploy still scores against its own era.
      const items = logicItemsFor(attempt.gv);
      if (!validLogicPicks(picks, items)) {
        throw new HttpsError("invalid-argument", `picks must be ${items} integers in -1..5`);
      }

      const { marks, score } = scoreLogicPicks(attempt.seed, attempt.gv, picks);
      const durationMs = now - attempt.startedAtMs;

      // The histogram is read on EVERY submit now (still before any write,
      // as transactions require): it is the fold target for a first
      // attempt (D32's rule) and, since D58, the percentile's comparison
      // population. Read PRE-fold on purpose — "sharper than X% of N
      // verified players" compares against the players counted before this
      // one, so a submitter is never a member of their own field, and a
      // re-verifier (who never folds) is measured against the same kind of
      // population as everyone else.
      const privRef = db.collection("v2_logic_norms_private").doc("global");
      const privSnap = await tx.get(privRef);
      const stored = privSnap.exists ? (privSnap.data() as LogicNorms) : null;
      // A histogram from another form-length era ranks nothing and folds
      // nothing — the first current-era submit starts the count fresh.
      const sameEra = stored != null && stored.items === LOGIC_ITEMS;
      const prevNorms = sameEra ? stored : null;
      const isCurrentEra = items === LOGIC_ITEMS;
      const measured = isCurrentEra ? measuredPctile(prevNorms, score) : null;
      const pctile = measured ? measured.pctile : logicPctileFor(score / items, items);
      const source = measured ? "measured" : "model";
      const countsNorms = attempt.normsCounted !== true && isCurrentEra;
      const norms: LogicNorms | null = countsNorms
        ? { ...foldNorms(prevNorms, score), items: LOGIC_ITEMS }
        : null;

      tx.set(ref, {
        ...attempt,
        status: "scored",
        normsCounted: true,
        scoredAtMs: now,
        score,
        durationMs,
      });
      // The canonical verified result. Server-written (admin SDK bypasses
      // rules); the rules deny clients this key, so it cannot be forged.
      // No per-item times: the client's timings are unverifiable claims,
      // so the verified record carries only the server-observed duration.
      // `n` travels only when the percentile is measured — it is the size
      // of the population the claim is about, meaningless for the model.
      tx.set(
        db.collection("v2_users").doc(uid),
        {
          testResults: {
            logic: {
              v: 2,
              verified: true,
              seed: attempt.seed,
              gv: attempt.gv,
              marks,
              pctile,
              durationMs,
              source,
              ...(measured ? { n: measured.n } : {}),
              when: now,
            },
          },
        },
        { merge: true },
      );
      if (norms) {
        tx.set(privRef, norms);
        if (shouldPublishAgg(norms.n, AGG_MIN_N, PUBLISH_EVERY)) {
          tx.set(db.collection("v2_logic_norms").doc("global"), { ...norms, updatedAtMs: now });
        }
      }
      // The seed is disclosed only NOW — the attempt is scored and cannot
      // be resubmitted, so it is no longer an answer key; handing it back
      // keeps the client's saved result reconstructable, the D31 property
      // practice results have always had.
      return {
        marks,
        score,
        pctile,
        durationMs,
        source,
        ...(measured ? { n: measured.n } : {}),
        seed: attempt.seed,
        gv: attempt.gv,
      };
    });

    logger.info(`[logicSubmitV2] uid=${uid} scored ${out.score}/${LOGIC_ITEMS}`);
    return out;
  },
);
