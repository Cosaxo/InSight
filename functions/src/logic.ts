// Verified logic attempts (D56 — the recorded reversal of D31's
// device-local deferral).
//
// The design in one line: the client is never the answer authority.
//
//   logicStartV2    mints the seed SERVER-side, stores it in a per-uid
//                   attempt doc clients cannot read, and returns the
//                   twelve puzzles with the answer index — and the seed —
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
// The per-item cap mirrors the overlay's ITEM_CAP (90s, D55); the server
// enforces the TOTAL: items × cap + slack for network and render. Slack is
// one extra item's worth — generous, because a refusal here surfaces to an
// honest finisher as a swallowed attempt.
export const LOGIC_ITEMS = 12;
export const LOGIC_ITEM_CAP_MS = 90_000;
export const LOGIC_DEADLINE_MS = LOGIC_ITEMS * LOGIC_ITEM_CAP_MS + LOGIC_ITEM_CAP_MS;
// Starting an attempt shows twelve fresh puzzles, so unfinished restarts
// are a preview channel — bounded per UTC day rather than closed, because
// a crashed app must be able to start again.
export const LOGIC_MAX_STARTS_PER_DAY = 3;
// One verified score is THE score for a while: re-verification opens after
// this many days. (First scored attempt feeds the norms histogram either
// way — the D32 "first attempt counts" rule, for the same reason: retakes
// measure practice, not the population.)
export const LOGIC_REVERIFY_DAYS = 30;

// The percentile curve, byte-for-byte the client's logicPctile
// (src/v2/data/logic-score.ts) — the D53-pinned landmarks (chance→4,
// 6/12→30, midpoint→50, perfect→94) are asserted equal in logic.test.ts,
// so the two copies cannot drift apart silently. It stays the MODELLED
// curve on purpose: the measured histogram replaces it only when the
// verified count clears the same floor the question aggregates use, and
// that flip will be its own recorded decision.
export const logicPctile = (frac: number): number =>
  Math.max(1, Math.min(99, Math.round(100 / (1 + Math.exp(-((frac * 100) - 62) / 14)))));

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
export function validLogicPicks(x: unknown): x is number[] {
  return Array.isArray(x)
    && x.length === LOGIC_ITEMS
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
// which is exactly the advance knowledge D55 removed.
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
// Flat b0..b12 buckets + n. Exact counts live in the private doc; the
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
    if (!validLogicPicks(picks)) {
      throw new HttpsError("invalid-argument", "picks must be 12 integers in -1..5");
    }
    const now = Date.now();
    const db = getFirestore();

    const out = await db.runTransaction(async (tx: Transaction) => {
      const ref = attemptRef(uid);
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpsError("failed-precondition", "no open attempt");
      const attempt = snap.data() as LogicAttempt;
      if (attempt.status !== "open") throw new HttpsError("failed-precondition", "already scored");
      if (now > attempt.deadlineMs) throw new HttpsError("deadline-exceeded", "attempt expired");

      const { marks, score } = scoreLogicPicks(attempt.seed, attempt.gv, picks);
      const pctile = logicPctile(score / LOGIC_ITEMS);
      const durationMs = now - attempt.startedAtMs;

      // First scored attempt per account feeds the histogram (D32's rule);
      // the reads all happen before any write, as transactions require.
      const countsNorms = attempt.normsCounted !== true;
      let norms: LogicNorms | null = null;
      const privRef = db.collection("v2_logic_norms_private").doc("global");
      if (countsNorms) {
        const privSnap = await tx.get(privRef);
        norms = foldNorms(privSnap.exists ? (privSnap.data() as LogicNorms) : null, score);
      }

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
              source: "model",
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
      return { marks, score, pctile, durationMs, seed: attempt.seed, gv: attempt.gv };
    });

    logger.info(`[logicSubmitV2] uid=${uid} scored ${out.score}/${LOGIC_ITEMS}`);
    return out;
  },
);
