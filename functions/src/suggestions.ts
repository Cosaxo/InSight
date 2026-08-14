// suggestions.ts — the server half of "Suggest a question"
// (docs/NEXT-FUNCTIONALITY.md §6). The board and composer have existed in
// the spec layer since the port (src/v2/spec/suggestions.jsx), faked onto
// localStorage; this gives the submission a real write path and the
// maintainer a review path, and deliberately nothing more:
//
//   · Submissions land in v2_suggestions with status "review" and are
//     INPUT to the editorial/farm lanes — never a write path into the
//     banks. Promotion stays the human PR gate this repo already has
//     (`npm run promote -- --source community`, D97's provenance rows).
//   · The pool is server-only in v1; the author reads their own rows
//     (firestore.rules). A public voting board is a second UGC surface
//     with the takes' moderation load — its own decision, later.
//   · No public byline. `credit` records that the author WANTS one, for
//     the day a decision grants it (flag authorship is a standing deny
//     for retaliation reasons; a byline is the same shape of exposure).
//
// The write path is a callable rather than a rules grant because three of
// its checks cannot live in rules: App Check attestation (D36), the daily
// budget (a sliding window over prior writes), and the sold-inventory
// tripwire below.

import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { assertOperator, ENFORCE_APP_CHECK, LIGHT_CALLABLE } from "./ops";

const REGION = "us-central1";

/** How many suggestions one account may submit per rolling day. Priced on
 * D33's spine — review capacity is the binding constraint, and a queue
 * nobody can read down is inventory, not participation. */
export const SUGGEST_PER_DAY = 3;

/** How many pending rows one review fetch returns. */
const FETCH_CAP = 200;

// Form bounds. The prompt/option caps mirror the measured corpus bounds
// check:quality holds for real questions (scripts/question-quality.mjs
// PROMPT_MAX / OPTION_MAX) — a suggestion that could never pass the gate
// should be told so at the door, not after a human read it. Mirrored by
// value because a Cloud Function cannot read a repo script at runtime;
// drift degrades to the human gate catching it at review, which is the
// authoritative check anyway.
export const SUGGESTION_PROMPT_MAX = 120;
export const SUGGESTION_OPTION_MAX = 32;
export const SUGGESTION_OPTIONS_MAX = 4;
const TOPIC_HINT_MAX = 40;
const AUDIENCE_HINT_MAX = 80;

/** The composer's forms — the daily surface's five types. Feed forms
 * (dial/field) join when their lane wants community input. */
export const SUGGESTION_TYPES = new Set(["binary", "choice", "scale", "rating", "dilemma"]);
const CADENCE_HINTS = new Set(["once", "daily", "weekly"]);

// ── the sold-inventory tripwire (QUESTION-FARM.md hard rule 6) ──────────
//
// Place-scoped civic questions ("Should Oslo ban cars downtown?") are the
// paid geo-insight inventory (docs/MONETIZATION.md path 1), so the door
// declines them with an honest message instead of letting a reviewer
// silently drop them. A hit needs BOTH a watched place and a civic cue —
// "Mountains or sea?" and an Italian-cuisine option are personal flavor
// and pass.
//
// A copy of scripts/question-quality.mjs's PLACES/CIVIC watchlist (same
// runtime-import constraint as the bounds above; keep edits in both
// places). The watchlist is deliberately small — big names only, never
// the 10,929-place city catalogue, whose names collide with ordinary
// English ("Nice", "Split") and would make the gate cry wolf.
const PLACES = new Set((
  "norway sweden denmark finland iceland germany france spain italy " +
  "portugal netherlands belgium austria switzerland poland ukraine russia " +
  "china india japan korea brazil mexico canada america usa uk britain " +
  "england scotland wales ireland australia turkey greece egypt nigeria " +
  "kenya oslo bergen trondheim london paris berlin madrid rome stockholm " +
  "copenhagen helsinki tokyo beijing delhi moscow sydney toronto chicago " +
  "miami amsterdam brussels vienna zurich warsaw athens cairo lagos " +
  "nairobi norwegian swedish danish german french spanish italian british " +
  "english irish chinese indian japanese russian brazilian mexican " +
  "canadian australian turkish greek american european"
).split(" "));
const CIVIC = /\b(ban|bans|banned|tax|taxes|law|laws|government|mayor|council|citizens?|public transport|rent control|immigration|tourism|too expensive|policy|policies|elections?|vote for)\b/i;

/** True when a suggestion reads as place-scoped civic inventory. */
export function placeCivicHit(prompt: string, options: string[]): boolean {
  const text = [prompt, ...options].join(" ");
  const words = text.toLowerCase().split(/[^a-z0-9]+/);
  return words.some((w) => PLACES.has(w)) && CIVIC.test(text);
}

export interface SuggestionPayload {
  prompt: string;
  type: string;
  options: string[];
  topicHint: string | null;
  audienceHint: string | null;
  cadenceHint: string | null;
  credit: boolean;
}

/**
 * Normalize and bound-check a submission. Returns the payload to store,
 * or a human-readable refusal — the composer shows it verbatim, so every
 * message says what to change rather than what rule fired.
 */
export function validateSuggestion(data: unknown): { ok: SuggestionPayload } | { error: string } {
  const d = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const prompt = String(d.prompt ?? "").trim();
  if (!prompt) return { error: "write the question first" };
  if (prompt.length > SUGGESTION_PROMPT_MAX) {
    return { error: `questions here stay under ${SUGGESTION_PROMPT_MAX} characters — trim it down` };
  }
  const type = String(d.type ?? "binary");
  if (!SUGGESTION_TYPES.has(type)) {
    return { error: "pick one of the question forms" };
  }
  const rawOptions = Array.isArray(d.options) ? d.options : [];
  const options: string[] = [];
  for (const o of rawOptions) {
    const s = String(o ?? "").trim();
    if (!s) continue;
    if (s.length > SUGGESTION_OPTION_MAX) {
      return { error: `option labels stay under ${SUGGESTION_OPTION_MAX} characters` };
    }
    options.push(s);
  }
  if (options.length > SUGGESTION_OPTIONS_MAX) {
    return { error: `at most ${SUGGESTION_OPTIONS_MAX} options` };
  }
  const topicHint = String(d.topicHint ?? d.topic ?? "").trim().slice(0, TOPIC_HINT_MAX) || null;
  const audienceHint = String(d.audienceHint ?? "").trim().slice(0, AUDIENCE_HINT_MAX) || null;
  const cadenceRaw = String(d.cadenceHint ?? "").trim();
  const cadenceHint = CADENCE_HINTS.has(cadenceRaw) ? cadenceRaw : null;
  return {
    ok: {
      prompt,
      type,
      options,
      topicHint,
      audienceHint,
      cadenceHint,
      credit: d.credit === true,
    },
  };
}

// The invite budget's shape (v2social.ts assertInviteBudget): a sliding
// window of timestamps in a server-only ledger doc, trimmed on every
// check. expireAt is double the window so Firestore TTL can sweep idle
// ledgers; deleteAccount removes it by exact id with the other ledgers.
async function assertSuggestBudget(uid: string): Promise<void> {
  const db = getFirestore();
  const ref = db.collection("v2_ratelimits").doc(`suggest_${uid}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const cutoff = Date.now() - 86400000;
    const events: number[] = ((snap.exists && snap.get("events")) || [])
      .filter((t: number) => t > cutoff);
    if (events.length >= SUGGEST_PER_DAY) {
      throw new HttpsError(
        "resource-exhausted",
        `that's ${SUGGEST_PER_DAY} suggestions today — a human reads every one, so the queue is paced to what review can absorb. Try tomorrow.`,
      );
    }
    events.push(Date.now());
    tx.set(ref, { events, expireAt: new Date(Date.now() + 2 * 86400000) });
  });
}

/**
 * Submit a question suggestion. Signed-in + attested; budgeted; declines
 * sold-inventory asks at the door.
 */
export const suggestQuestionV2 = onCall(
  { ...LIGHT_CALLABLE, region: REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "must be signed in");
    const uid = request.auth.uid;
    const checked = validateSuggestion(request.data);
    if ("error" in checked) throw new HttpsError("invalid-argument", checked.error);
    const s = checked.ok;
    if (placeCivicHit(s.prompt, s.options)) {
      // failed-precondition rather than invalid-argument: the form is
      // fine, the SUBJECT is reserved. The message carries the reason so
      // the decline reads as a policy, not a bug.
      throw new HttpsError(
        "failed-precondition",
        "questions about what a city or country should do are the app's paid research path, not the community board — ask something personal instead",
      );
    }
    await assertSuggestBudget(uid);
    const db = getFirestore();
    // uid-prefixed id so an operator eyeballing the collection sees whose
    // rows are whose without opening them; create() (not set) so an id
    // collision fails loudly instead of overwriting a row.
    const ref = db.collection("v2_suggestions").doc(`${uid}_${Date.now().toString(36)}`);
    await ref.create({
      ...s,
      uid,
      status: "review",
      at: FieldValue.serverTimestamp(),
    });
    logger.info(`[suggest] queued ${ref.id} (${s.type}, ${s.options.length} options)`);
    return { id: ref.id };
  },
);

// ── the review instruments (operator-gated, the moderation shape) ───────
//
// NO enforceAppCheck on either, and that is the decision rather than the
// omission it looks like: review happens from the maintainer's dev
// session (docs/NEXT-FUNCTIONALITY.md §6), which has no attested app to
// call from. assertOperator + SEED_ADMIN_UIDS is the control in its
// place; `npm run check:appcheck` holds the exemption.

export const fetchSuggestionsV2 = onCall(
  { ...LIGHT_CALLABLE, region: REGION },
  async (request) => {
    assertOperator(request);
    const db = getFirestore();
    // Oldest first: review is a queue, not a feed, and the row that has
    // waited longest is owed the next read. Composite index
    // (status ASC, at ASC) in firestore.indexes.json.
    const pending = await db
      .collection("v2_suggestions")
      .where("status", "==", "review")
      .orderBy("at", "asc")
      .limit(FETCH_CAP)
      .get();
    return {
      items: pending.docs.map((d) => ({
        id: d.id,
        prompt: d.get("prompt"),
        type: d.get("type"),
        options: d.get("options") || [],
        topicHint: d.get("topicHint") || null,
        audienceHint: d.get("audienceHint") || null,
        cadenceHint: d.get("cadenceHint") || null,
        credit: d.get("credit") === true,
        at: d.get("at")?.toMillis?.() ?? null,
      })),
    };
  },
);

export const reviewSuggestionV2 = onCall(
  { ...LIGHT_CALLABLE, region: REGION },
  async (request) => {
    assertOperator(request);
    const id = String(request.data?.id || "");
    const verdict = String(request.data?.verdict || "");
    const note = String(request.data?.note || "").slice(0, 280) || null;
    if (!id) throw new HttpsError("invalid-argument", "id required");
    // "picked" marks the row for promotion (which stays the human PR path
    // — this callable never touches the banks); "declined" keeps the row
    // so the author's board can say so, with the note as the reason.
    if (verdict !== "picked" && verdict !== "declined") {
      throw new HttpsError("invalid-argument", "verdict must be picked or declined");
    }
    const db = getFirestore();
    await db.runTransaction(async (tx) => {
      const ref = db.collection("v2_suggestions").doc(id);
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpsError("failed-precondition", "no such suggestion");
      // One verdict per row: re-judging a settled row silently is how a
      // "picked" the author already saw becomes a "declined" (the
      // moderation log's generation lesson, in the simpler one-shot form
      // this queue needs).
      if (snap.get("status") !== "review") {
        throw new HttpsError("already-exists", "already reviewed");
      }
      tx.update(ref, { status: verdict, note, reviewedAt: FieldValue.serverTimestamp() });
    });
    return { ok: true };
  },
);
