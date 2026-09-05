// paid.ts — the self-serve paid-question loop (D313).
//
// What this closes: PAID-PLAN §9.2 sold by hand — a human contract, an
// operator script per sale (record-purchase.mjs), a content PR per
// question. D313 (owner, 2026-08-26) replaces the human with machinery
// end to end: a buyer composes in the app, an AUTOMATED review checks the
// ask against the guidelines, the price comes off the committed rate card
// server-side, payment runs through Stripe Checkout on the web, and the
// paying webhook writes the purchase record AND the live question in one
// transaction. Nobody at the company touches a sale.
//
// The shape, one state per hop (v2_paid_bookings/{bid}.status):
//
//   review    bookPaidQuestionV2 wrote the ask; the reviewer has not
//             ruled. onPaidBookingCreated reviews immediately;
//             sweepPaidReviewsV2 retries anything stuck (an API outage
//             HOLDS a booking, never declines it — the owner's call).
//   declined  the review said no, with a reason written to be shown.
//             Terminal; money never moved (review runs BEFORE payment,
//             so a decline needs no refund path).
//   approved  the review said yes and LOCKED the quote (rate × idx off
//             the committed card, the cap, the 29-day window promise).
//             createPaidCheckoutV2 turns this into a Stripe session.
//   live      the webhook saw the payment: purchase record written,
//             question doc written into v2_questions with a fresh
//             `updatedAt` (the bank's delta fetch picks it up on every
//             device's next boot — no deploy, no contentRev bump).
//
// What deliberately does NOT move here:
//   · The one-slot inventory (SPONSOR_SLOT, D195). Concurrent buyers
//     share the slot by day rotation, which pickPaid has priced in from
//     the start — self-serve sells windows, never a second card.
//   · Tail, never core. The question doc this module writes carries no
//     `core`, so the Mirror's corpus cannot be bought (D161).
//   · Selection on the device. The audience tag rides the content;
//     nothing here asks the server who should see what.
//   · Bill on answers (D164). Paid upfront at the cap, and the closer
//     refunds what the window did not deliver — the public aggregate is
//     the meter both sides read.
//
// Money and review are ORDERED so no refund path exists for content:
// review first (free, automated), payment second, live third. The only
// refund in the system is the closer's under-delivery refund, which is
// arithmetic over a public number.

import { FieldPath, FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { ENFORCE_APP_CHECK, LIGHT_CALLABLE, FUNCTIONS_REGION } from "./ops";
// The day key, offset in days. Was a byte-identical local copy until the
// two families of `utcDayKey` were separated — see pure.ts's own comment.
import { utcDayKey } from "./pure";
import { db as firestore, FIRESTORE_DB_ID } from "./db";
import { PRICING_CARD, type PricingCard } from "./pricing";
import { ESTIMATE_MIN_DAYS, foldPricing, mergeLivePricing, servedDays, type PurchaseRow } from "./pricingFold";

const REGION = FUNCTIONS_REGION;

// Credentials arrive through the deploy's dotenv, the DC_PRIVATE_KEY
// mechanism (docs/DEPLOYMENT.md § Runtime environment) rather than Cloud
// Secret Manager: defineSecret() makes `firebase deploy` REFUSE until
// the secret exists, and a paid feature must never be able to block an
// emergency rules deploy. In the emulator none are set and every
// consumer below degrades honestly (the reviewer decides on gates alone,
// checkout refuses, the closer records arithmetic without executing the
// refund) — each degradation logged, none silent.
const stripeKey = () => process.env.STRIPE_SECRET_KEY || "";
const stripeWebhookSecret = () => process.env.STRIPE_WEBHOOK_SECRET || "";
const anthropicKey = () => process.env.ANTHROPIC_API_KEY || "";

/** Bookings one account may open per rolling day. Looser than the old
 * suggestion budget's 3 (review capacity was the binding constraint there
 * and a model has no queue), tighter than unlimited (each booking is a
 * Claude review someone pays for — us). */
export const BOOKINGS_PER_DAY = 5;

/** The fixed window every self-serve question runs (the door's "29 days"
 * chip; PAID-PLAN §8's 366-day gate bounds it from far above). Inclusive
 * of its last day: until = start + WINDOW_DAYS - 1. */
export const WINDOW_DAYS = 29;

// ── form bounds, mirrored by value ──────────────────────────────────────
// The same figures suggestions.ts mirrors from scripts/question-quality.mjs
// (PROMPT_MAX/OPTION_MAX), for the same reason: a Cloud Function cannot
// read a repo script at runtime. Drift degrades to the model review
// catching what the bound would have.
export const PAID_PROMPT_MAX = 120;
export const PAID_OPTION_MAX = 32;
export const PAID_OPTIONS_MAX = 4;
const BUCKET_MAX = 80; // matches isValidV2Anchors' widest string bound

/** The daily surface's five forms — what the composer offers. */
export const PAID_TYPES = new Set(["binary", "choice", "scale", "rating", "dilemma"]);

// The synthesized scales, byte-for-byte gen-v2content.mjs's LIKERT/RATING:
// a paid scale answer folds into the same aggregate shape as a bank one,
// and stored optionIdx positions must mean the same thing on both.
export const LIKERT = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"];
export const RATING = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

/** The feed's topic vocabulary (spec/world-feed-data.js WORLD_TOPICS ids;
 * 'now' is the current-events lane and not buyable — a paid card claiming
 * the news lane would wear the wrong provenance). */
export const PAID_TOPICS = new Set([
  "sport", "food", "movies", "music", "tech", "culture", "dilemma", "event", "people", "bigq",
]);

/** The audience vocabulary: a subset of the published breakdown dims
 * (D98/D228), matched against the same anchor keys the answers carry. The
 * politics result is excluded by not being an anchor at all (Art. 9).
 *
 * `jobField` IS a breakdown dim since D328 and is deliberately NOT here,
 * which is why this list is enumerated rather than derived from
 * BREAKDOWN_DIMS — a derived list would have widened ad targeting as a
 * side effect of a Mirror change, and buying the attention of people by
 * their occupation is a different product from showing how occupations
 * split. Adding it is a recorded decision, not an edit. */
export const AUDIENCE_DIMS = new Set([
  "ageBand", "gender", "city", "country", "education", "relationship", "heightBand",
]);
export const AUDIENCE_DIMS_MAX = 3; // D228's coarseness ceiling

// The ad lane's constants (D315 — advertiser/headline/body bounds, the
// URL nose, the one-tag cap) stood here until D370 retired the self-serve
// ad: the sponsored question is the one paid product. The committed ad
// pen (content/ads.json, runSeedAds) keeps its own rules in
// scripts/check-content.mjs.

export interface PaidBookingPayload {
  /** what is being bought: a question (D313). "ad" survives in the
   * union only so a booking stored before D370 retired the ad lane can
   * be read and refused by name; nothing writes one. */
  kind: "question" | "ad";
  prompt: string;
  type: string;
  options: string[];
  topic: string | null;
  scope: "city" | "country" | "world";
  /** dim → bucket, conjunctive. Questions: ≤3 (D228). Ads: ≤1 (D197).
   * For city/country scope the place dim IS the scope; world may still
   * carry e.g. an age band. */
  dims: Record<string, string>;
  wearName: boolean;
  /** The most the buyer will spend, whole euros (D367): the cap the
   * quote locks and Stripe charges up front, refunded per unserved
   * answer at close. Null on ads (flat-priced) — and null on a question
   * booked by a client from before D367, which is quoted at the card's
   * capEur, the figure that client displayed. */
  budgetEur: number | null;
}

export interface PaidQuote {
  ratePerAnswer: number;
  capEur: number;
  cap: number;
  windowDays: number;
}

/**
 * Normalize and bound-check a booking. Returns the payload to store, or a
 * human-readable refusal the composer shows verbatim — every message says
 * what to change, not which rule fired (the suggestions.ts convention).
 */
export function validatePaidBooking(data: unknown): { ok: PaidBookingPayload } | { error: string } {
  const d = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  // The ad lane is retired (D370): a client from before it says so in
  // the refusal register everything else here uses.
  if (d.kind === "ad") return { error: "ads aren't sold here any more — ask a question instead" };
  const prompt = String(d.prompt ?? "").trim();
  if (!prompt) return { error: "write the question first" };
  if (prompt.length > PAID_PROMPT_MAX) {
    return { error: `questions here stay under ${PAID_PROMPT_MAX} characters — trim it down` };
  }
  const type = String(d.type ?? "binary");
  if (!PAID_TYPES.has(type)) return { error: "pick one of the question forms" };
  const rawOptions = Array.isArray(d.options) ? d.options : [];
  let options: string[] = [];
  for (const o of rawOptions) {
    const s = String(o ?? "").trim();
    if (!s) continue;
    if (s.length > PAID_OPTION_MAX) {
      return { error: `option labels stay under ${PAID_OPTION_MAX} characters` };
    }
    options.push(s);
  }
  // The continuum forms carry the app's own scales — an authored option
  // list on a scale question would re-key what every stored optionIdx
  // means, which is the D52 line. Synthesize, never accept.
  //
  // THE BOUND APPLIES TO AUTHORED LISTS, NOT SYNTHESIZED ONES, and that
  // ordering is the whole fix. This validator runs TWICE on a booking:
  // once on the wire, and again on the STORED payload when reviewGates
  // re-reads the doc. The bound used to run before the substitution, so
  // the first pass saw the composer's empty list and passed, the doc was
  // written with five Likert steps or ten rating steps — and the second
  // pass then declined the buyer's own booking with "at most 4 options".
  // Two of the five forms the paid composer offers could not be sold at
  // all, and the buyer read that sentence as the reason.
  //
  // Which makes the property worth stating rather than the line worth
  // moving: validating an already-validated payload must produce the same
  // payload. Pinned as exactly that, over every form.
  if (type === "scale") options = [...LIKERT];
  else if (type === "rating") options = [...RATING];
  else if (options.length < 2) return { error: "give people at least two options" };
  else if (options.length > PAID_OPTIONS_MAX) return { error: `at most ${PAID_OPTIONS_MAX} options` };
  const topicRaw = String(d.topic ?? "").trim().toLowerCase();
  const topic = PAID_TOPICS.has(topicRaw) ? topicRaw : null;

  const scope = d.scope === "city" || d.scope === "country" || d.scope === "world" ? d.scope : null;
  if (!scope) return { error: "pick who gets asked — your city, your country, or everyone" };

  const rawDims = (d.dims && typeof d.dims === "object" ? d.dims : {}) as Record<string, unknown>;
  const dims: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawDims)) {
    if (!AUDIENCE_DIMS.has(k)) return { error: `"${k}" is not an audience the card can state` };
    const s = String(v ?? "").trim();
    if (!s || s.length > BUCKET_MAX) return { error: "an audience value is missing or too long" };
    dims[k] = s;
  }
  if (Object.keys(dims).length > AUDIENCE_DIMS_MAX) {
    return { error: `at most ${AUDIENCE_DIMS_MAX} audience dims — past that a cohort starts shaping a person` };
  }
  // The scope IS a place dim: a "city" ask with no city bucket would match
  // everyone while the band claims Oslo — the exact dishonesty the
  // disclosure design forbids. World must NOT carry a place dim, or the
  // price says world while the serving says Oslo.
  if (scope === "city" && !dims.city) return { error: "a city ask needs your city set on your profile" };
  if (scope === "country" && !dims.country) return { error: "a country ask needs your country set on your profile" };
  if (scope === "world" && (dims.city || dims.country)) {
    return { error: "a world ask can't carry a place — pick the city or country scope instead" };
  }
  if (scope === "city" && dims.country) {
    return { error: "one place per ask — the city already names it" };
  }
  // The budget (D367): whole euros inside the card's range. Absent means
  // a client from before the budget existed, whose door showed the cap —
  // so the cap is what it is quoted, never a smaller figure it never saw.
  let budgetEur: number | null = null;
  if (d.budgetEur !== undefined && d.budgetEur !== null) {
    const b = d.budgetEur;
    if (!Number.isInteger(b) || (b as number) < PRICING_CARD.minEur || (b as number) > PRICING_CARD.capEur) {
      return { error: `pick a budget between €${PRICING_CARD.minEur} and €${PRICING_CARD.capEur}` };
    }
    budgetEur = b as number;
  }

  return {
    ok: {
      kind: "question",
      prompt,
      type,
      options,
      topic,
      scope,
      dims,
      wearName: d.wearName === true,
      budgetEur,
    },
  };
}

/**
 * The quote, server-side, off the committed card — the client's figure is
 * display and never the invoice. Locked into the booking at approval so
 * a card recompute mid-flow cannot move a price someone already saw.
 */
export function priceQuote(
  scope: "city" | "country" | "world",
  card = PRICING_CARD,
  budgetEur: number | null = null,
): PaidQuote {
  // Held to the floor only: the index measures crowding and has no
  // ceiling (D368). A stored idx under the floor is a bug, not a price.
  const idx = Math.max(card.cohorts[scope].idx, card.floorX);
  // 4 decimals: rounding is for the day a folded idx carries more digits
  // than a price should (base 0.02 × idx 1.75 = 0.035 exactly).
  const ratePerAnswer = Math.round(card.base * idx * 10000) / 10000;
  // The buyer's budget IS the cap (D367), held to the card's range here
  // too — the validator already refused anything outside it, and a
  // stored booking from before the budget existed carries null, which
  // quotes at the card's own cap.
  const want = typeof budgetEur === "number" && Number.isFinite(budgetEur) ? Math.round(budgetEur) : card.capEur;
  const capEur = Math.min(card.capEur, Math.max(card.minEur, want));
  const cap = Math.floor(capEur / ratePerAnswer);
  return { ratePerAnswer, capEur, cap, windowDays: WINDOW_DAYS };
}

// ── the review ──────────────────────────────────────────────────────────
//
// Two halves, ordered cheap-first:
//
//   1. GATES — deterministic rules a machine can hold exactly: the form
//      bounds above (re-checked, because the booking doc could in
//      principle be written by a future pen this module does not own),
//      plus the content-shape rules check:quality holds for bank
//      questions where they are mechanical.
//   2. THE MODEL — everything a rulebook cannot enumerate: hate,
//      harassment, a private person named, push-polling, gibberish. The
//      guidelines below are the instruction; the verdict comes back as
//      strict JSON with a reason written to be shown.
//
// Money never buys the review (D288): the review runs before any payment
// exists to be swayed by, and its reasons are published to the buyer.
//
// FAILURE POSTURE (the owner's explicit call, 2026-08-26): an API outage
// HOLDS the booking in "review" for the sweep to retry — never an
// auto-decline, never an auto-approve. In the emulator (and any deploy
// without the ANTHROPIC_API_KEY secret) the model half is SKIPPED and
// gates alone decide, logged loudly — the e2e loop must run offline, and
// a silent "the model approved it" that no model saw would be worse than
// the honest "gates only" it records.

export interface ReviewVerdict {
  verdict: "approve" | "decline";
  reason: string | null;
  by: "gates" | "model" | "gates-only";
  model?: string;
}

/** The deterministic half. Returns null when the gates have nothing
 * against the booking (the model still gets its say). */
export function reviewGates(b: PaidBookingPayload): string | null {
  const v = validatePaidBooking(b);
  if ("error" in v) return v.error;
  // Duplicate options make two option indexes mean one answer — the
  // aggregate would publish a split between identical labels.
  const seen = new Set<string>();
  for (const o of b.options) {
    const key = o.toLowerCase();
    if (seen.has(key)) return `two options say the same thing (${JSON.stringify(o)}) — make each one distinct`;
    seen.add(key);
  }
  // A prompt that is all punctuation/whitespace once trimmed of symbols
  // is not a question anyone can answer blind.
  if (!/[\p{L}\p{N}]{2}/u.test(b.prompt)) return "that doesn't read as a question yet — write it out in words";
  return null;
}

/** What the model is asked to hold. Kept as one exported string so the
 * unit test can pin that the load-bearing rules are actually in the
 * prompt — a guideline that silently falls out of the instruction is the
 * failure mode of every prompt under edit. */
export const REVIEW_GUIDELINES = `You review questions submitted to InSight, an opinion-polling app where every answer is public and aggregated. A PAID question is shown to the buyer's chosen audience with a PAID disclosure band naming the audience dims (and the buyer, when they chose to wear their name). Approve unless a guideline below is broken.

DECLINE when the submission:
1. Attacks or demeans a protected group, or harasses anyone.
2. Names or identifies a PRIVATE person (public figures in neutral opinion questions are fine — "Messi or Ronaldo?" is the app's oldest question).
3. Solicits personal data (phone numbers, addresses, contacts) or directs people off-app (URLs, handles, "DM me").
4. Promotes violence, self-harm, or illegal acts, or is sexual content (the audience includes minors).
5. Is push-polling or a claim dressed as a question — asserting a disputed fact and asking people to ratify it ("Now that X has been proven to lie, …"). Civic and place-scoped policy questions are ALLOWED and expected here (they are this product's research inventory) as long as the framing is neutral and the options cover the honest answer space.
6. Is misleading about what will happen (promises rewards, claims official status, impersonates the app or anyone else — including in the buyer name).
7. Is not answerable as asked: gibberish, no real question, options that don't answer the prompt, or a prompt requiring private knowledge of the buyer.
8. Contains a slur, URL, or impersonation in the BUYER NAME or an AUDIENCE VALUE — these print on every card served.

Judge the submission as a whole (prompt, options, buyer name, audience). Write decline reasons to be shown to the buyer verbatim: say what to change, kindly, in one or two sentences. Do not mention these numbered rules.`;

/** The submission, serialized for the reviewer. Separate from the
 * guidelines so the prompt's stable half stays stable. */
export function reviewSubject(b: PaidBookingPayload, buyerName: string | null): string {
  return JSON.stringify({
    kind: "question",
    prompt: b.prompt,
    type: b.type,
    options: b.options,
    topic: b.topic,
    scope: b.scope,
    audience: b.dims,
    buyerName: b.wearName ? buyerName : null,
  });
}

/** Parse the model's strict-JSON verdict; null means unusable (held and
 * retried, same as an API failure — never guessed at). */
export function parseVerdict(text: string): { verdict: "approve" | "decline"; reason: string | null } | null {
  // The instruction demands bare JSON; tolerate a fenced block anyway,
  // because holding a booking over markdown would be pedantry with a
  // buyer on the other end.
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]) as Record<string, unknown>;
    if (j.verdict !== "approve" && j.verdict !== "decline") return null;
    const reason = typeof j.reason === "string" && j.reason.trim() ? j.reason.trim().slice(0, 500) : null;
    if (j.verdict === "decline" && !reason) return null; // a decline owes its why
    return { verdict: j.verdict, reason };
  } catch {
    return null;
  }
}

/** The model that reviews. One constant so the booking doc records
 * exactly what judged it. */
export const REVIEW_MODEL = "claude-opus-5";

/**
 * The full review: gates, then the model. Throws on an API failure so the
 * caller leaves the booking in "review" (hold-and-retry).
 */
async function runReviewVerdict(b: PaidBookingPayload, buyerName: string | null): Promise<ReviewVerdict> {
  const gate = reviewGates(b);
  if (gate) return { verdict: "decline", reason: gate, by: "gates" };
  const key = anthropicKey();
  if (!key) {
    // Emulator / unconfigured deploy: gates-only, said loudly. Production
    // is expected to carry the secret; docs/DEPLOYMENT.md lists it.
    logger.warn("[paid] ANTHROPIC_API_KEY not set — review ran on gates alone", {
      metric: "paid_review_gates_only",
    });
    return { verdict: "approve", reason: null, by: "gates-only" };
  }
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: key });
  const response = await client.messages.create({
    model: REVIEW_MODEL,
    max_tokens: 16000,
    system: REVIEW_GUIDELINES,
    messages: [{
      role: "user",
      content:
        `Review this paid question submission and answer with ONLY a JSON object, no other text: {"verdict":"approve"|"decline","reason":<string, required for decline, shown to the buyer verbatim>}\n\n`
        + reviewSubject(b, buyerName),
    }],
  });
  // A safety refusal is a verdict in itself: content the reviewer will
  // not even assess does not run as a paid card.
  if (response.stop_reason === "refusal") {
    return {
      verdict: "decline",
      reason: "The review could not accept this content. Rework the question and try again.",
      by: "model",
      model: REVIEW_MODEL,
    };
  }
  const text = response.content
    .filter((blk): blk is { type: "text"; text: string } & typeof blk => blk.type === "text")
    .map((blk) => blk.text)
    .join("");
  const parsed = parseVerdict(text);
  if (!parsed) {
    // Unusable output is an outage, not a verdict — throw so the booking
    // holds and the sweep retries.
    throw new Error(`review verdict did not parse: ${text.slice(0, 200)}`);
  }
  return { ...parsed, by: "model", model: REVIEW_MODEL };
}

/** One reader for the booking doc's payload half — reviewBooking and
 * goLive both need it, and two hand-rolled copies would drift. */
function bookingPayloadOf(snap: FirebaseFirestore.DocumentSnapshot): PaidBookingPayload {
  return {
    kind: snap.get("kind") === "ad" ? "ad" : "question",
    prompt: String(snap.get("prompt") ?? ""),
    type: String(snap.get("type") ?? ""),
    options: (snap.get("options") as string[]) ?? [],
    topic: (snap.get("topic") as string | null) ?? null,
    scope: snap.get("scope"),
    dims: (snap.get("dims") as Record<string, string>) ?? {},
    wearName: snap.get("wearName") === true,
    budgetEur: typeof snap.get("budgetEur") === "number" ? (snap.get("budgetEur") as number) : null,
  };
}

/**
 * Review one booking doc and settle its status. Idempotent: the
 * transaction re-reads status and only ever moves "review" → verdict, so
 * the trigger and the sweep can race without a double transition.
 */
/**
 * How many times a held booking is re-reviewed before the sweep gives up
 * on reviewing it automatically.
 *
 * WHY A CEILING AT ALL. A verdict that does not parse is thrown as if it
 * were an outage — deliberately, so a truncated answer never decides a
 * booking — but a prompt that reliably produces unusable output is not an
 * outage, it is a permanent condition. Without a ceiling that booking was
 * re-reviewed every thirty minutes forever, each attempt a billed model
 * call, and — because the sweep's `createdAt <` inequality forces
 * oldest-first order — it held one of fifty slots for good. Fifty such
 * bookings, which ten free accounts can create in a day at the 5/day
 * budget, starved the retry queue outright: a booking held behind a REAL
 * outage would then never be retried at all.
 *
 * Six is three hours at the sweep's half-hour cadence, which is longer
 * than any Anthropic incident this app has seen and far short of a bill
 * anybody would notice. Past it the booking stops being called for and
 * starts being ALARMED for, which is the honest reading: no automatic
 * reviewer is going to settle it.
 *
 * What it deliberately does NOT do is decide the booking. Declining a
 * buyer because our reviewer broke would be a verdict about them for a
 * fault of ours. The booking stays in review, the operator gets a metric
 * and a query, and what the buyer should be TOLD past this point is a
 * product decision this constant does not make.
 */
export const MAX_REVIEW_ATTEMPTS = 6;

async function reviewBooking(db: Firestore, bid: string): Promise<void> {
  const ref = db.collection("v2_paid_bookings").doc(bid);
  const snap = await ref.get();
  if (!snap.exists || snap.get("status") !== "review") return;
  // The ceiling, checked before the model is called rather than after:
  // the whole cost of an unreviewable booking is the call.
  const attempts = Number(snap.get("reviewAttempts") ?? 0);
  if (attempts >= MAX_REVIEW_ATTEMPTS) {
    logger.error(`[paid] review STALLED for ${bid} after ${attempts} attempts — no automatic verdict is coming`, {
      metric: "paid_review_stalled",
      bid,
      attempts,
    });
    return;
  }
  const payload = bookingPayloadOf(snap);
  // An ad booking still in review — one that arrived before D370 retired
  // the lane — is declined by name rather than reviewed, priced or held.
  if (payload.kind === "ad") {
    await db.runTransaction(async (tx) => {
      const cur = await tx.get(ref);
      if (!cur.exists || cur.get("status") !== "review") return;
      tx.update(ref, {
        status: "declined",
        note: "ads aren't sold here any more — ask a question instead",
        review: { by: "gates", model: null, at: Timestamp.now() },
      });
    });
    logger.info(`[paid] review ${bid}: declined (ad lane retired, D370)`, { metric: "paid_review_declined" });
    return;
  }
  const buyerName = (snap.get("buyerName") as string | null) ?? null;
  let verdict: ReviewVerdict;
  try {
    verdict = await runReviewVerdict(payload, buyerName);
  } catch (err) {
    // Hold, count, retry (the sweep). The attempt counter is telemetry —
    // a booking climbing it is the alert that the reviewer is down.
    await ref.update({ reviewAttempts: FieldValue.increment(1), reviewTriedAt: FieldValue.serverTimestamp() });
    logger.error(`[paid] review failed for ${bid} — held for retry`, {
      metric: "paid_review_held",
      message: String((err as Error)?.message ?? err),
    });
    return;
  }
  // The quote is computed AT VERDICT TIME and stored — this is the lock
  // PAID-PLAN §6 promises ("the rate LOCKED at booking"). A refold between
  // approval and payment changes nothing for this buyer. Off the LIVE card
  // (D366): the committed constants under the demand half the last sale
  // or the last nightly closer published — the same document the door
  // prints from, so the figure the buyer read is the figure locked here.
  const card = await liveCard(db);
  const quote = priceQuote(payload.scope, card, payload.budgetEur);
  await db.runTransaction(async (tx) => {
    const cur = await tx.get(ref);
    if (!cur.exists || cur.get("status") !== "review") return;
    if (verdict.verdict === "approve") {
      tx.update(ref, {
        status: "approved",
        quote,
        review: { by: verdict.by, model: verdict.model ?? null, at: Timestamp.now() },
      });
    } else {
      tx.update(ref, {
        status: "declined",
        note: verdict.reason,
        review: { by: verdict.by, model: verdict.model ?? null, at: Timestamp.now() },
      });
    }
  });
  logger.info(`[paid] review ${bid}: ${verdict.verdict} (${verdict.by})`, {
    metric: verdict.verdict === "approve" ? "paid_review_approved" : "paid_review_declined",
  });
}

// ── the booking callable ────────────────────────────────────────────────

// The invite/suggest budget shape (v2social.ts, suggestions.ts): a sliding
// window of timestamps in a server-only ledger doc, TTL-swept, erased by
// deleteAccount with the other ledgers.
async function assertBookingBudget(uid: string): Promise<void> {
  const db = firestore();
  const ref = db.collection("v2_ratelimits").doc(`paidbook_${uid}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const cutoff = Date.now() - 86400000;
    const events: number[] = ((snap.exists && snap.get("events")) || [])
      .filter((t: number) => t > cutoff);
    if (events.length >= BOOKINGS_PER_DAY) {
      throw new HttpsError(
        "resource-exhausted",
        `that's ${BOOKINGS_PER_DAY} bookings today — finish or cancel one before opening more. Try tomorrow.`,
      );
    }
    events.push(Date.now());
    tx.set(ref, { events, expireAt: new Date(Date.now() + 2 * 86400000) });
  });
}

/**
 * Open a paid-question booking. Signed-in + attested; budgeted; the
 * review is asynchronous (the create trigger) so the tap never waits on
 * a model. Returns { id } — the client watches its own row.
 */
export const bookPaidQuestionV2 = onCall(
  { ...LIGHT_CALLABLE, region: REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "must be signed in");
    const uid = request.auth.uid;
    const checked = validatePaidBooking(request.data);
    if ("error" in checked) throw new HttpsError("invalid-argument", checked.error);
    const b = checked.ok;
    await assertBookingBudget(uid);
    const db = firestore();
    // The buyer name is read off the profile, not the wire: the name that
    // prints on the band is the one the account actually wears, and a
    // nameless profile books namelessly (D228 made the name optional).
    // An ad skips this — its band prints the ADVERTISER, which is part
    // of the reviewed content rather than an identity claim (D197).
    let buyerName: string | null = null;
    if (b.kind === "question" && b.wearName) {
      const prof = await db.collection("v2_users").doc(uid).get();
      // `displayName`, which is the only name a v2_users document can
      // hold: firestore.rules admits exactly seven keys there and `name`
      // is not one of them, so this read had been returning undefined
      // since it was written. Two things were dead behind it — the band
      // never wore the buyer's name however hard they asked for it, and
      // the reviewer's rule about slurs or impersonation IN THE BUYER
      // NAME was judging `null` on every submission. (`name` is a real
      // field one collection over, on v2_people, which is the likely
      // origin of the typo.)
      const n = prof.exists ? String(prof.get("displayName") ?? "").trim() : "";
      buyerName = n ? n.slice(0, 40) : null;
    }
    const ref = db.collection("v2_paid_bookings").doc(`${uid}_${Date.now().toString(36)}`);
    await ref.create({
      ...b,
      uid,
      buyerName,
      status: "review",
      reviewAttempts: 0,
      createdAt: FieldValue.serverTimestamp(),
    });
    logger.info(`[paid] booking ${ref.id} opened (${b.scope}, ${b.type})`);
    return { id: ref.id };
  },
);

/** Review on arrival. `database:` is load-bearing (db.ts's header): a
 * trigger without it fires on `(default)` while every write here lands
 * on the named database — deploys green, never fires, and the e2e's
 * paid leg caught this exact omission the first time it ran. */
export const onPaidBookingCreated = onDocumentCreated(
  { document: "v2_paid_bookings/{bid}", region: REGION, database: FIRESTORE_DB_ID },
  async (event) => {
    await reviewBooking(firestore(), event.params.bid);
  },
);

/** The hold-and-retry half: anything still "review" after ten minutes is
 * a booking the trigger's attempt could not settle (API outage, unparsed
 * verdict, a crash between write and review). Every 30 minutes, again —
 * a held booking is never dropped and never defaulted. */
/** One page of held bookings, oldest first, and the retry itself. */
export interface ReviewSweepStore {
  heldPage(after: string | null, limit: number): Promise<Array<{ id: string; attempts: number }>>;
  review(bid: string): Promise<void>;
}

/**
 * One page of held bookings, cursored on the previous page's last id.
 *
 * EXPORTED, and a named function rather than the closure it was, because
 * the paging is the half `runReviewSweep`'s own tests cannot see: they
 * inject a `ReviewSweepStore` and prove the LOOP, while the adapter that
 * talks to Firestore ran under nothing. That is the shape this file has
 * already paid for once — `taste.ts` and `patterns.ts` both carry the
 * note about a guard that "was dead in production while the in-memory
 * fake, which keeps the whole object, went on proving it worked".
 *
 * A VANISHED CURSOR ENDS THE RUN. It used to fall through to `base` with
 * no `startAfter` at all, which is page ONE — so the sweep re-scanned and
 * re-reviewed the same held bookings up to SWEEP_MAX_PAGES times, each
 * retry a billed model call, while the bookings actually starved behind
 * them were never reached: precisely the starvation runReviewSweep exists
 * to fix, reintroduced by the adapter under it. The cursor can genuinely
 * disappear mid-run — `deleteAccount` sweeps this collection by uid — so
 * this is a real state, not a defensive branch.
 *
 * Ending rather than rewinding is the conservative half of the choice:
 * the bookings past the lost cursor wait for the next scheduled run,
 * which is minutes, instead of the queue re-reviewing its own head.
 */
export async function heldPageFrom(
  base: FirebaseFirestore.Query,
  db: FirebaseFirestore.Firestore,
  after: string | null,
  limit: number,
): Promise<Array<{ id: string; attempts: number }>> {
  let q = base.limit(limit);
  if (after) {
    const cur = await db.collection("v2_paid_bookings").doc(after).get();
    if (!cur.exists) return [];
    q = base.startAfter(cur).limit(limit);
  }
  const snap = await q.get();
  return snap.docs.map((d) => ({ id: d.id, attempts: Number(d.get("reviewAttempts") ?? 0) }));
}

export const SWEEP_PAGE = 50;
/** A loop bound, not a policy: 250 held bookings in one run is already an
 * incident, and an unbounded `while` in a scheduled job is worse. */
export const SWEEP_MAX_PAGES = 5;

/**
 * Retry every held booking that has not exhausted its attempts.
 *
 * PAGES, because it used to take one page of fifty and stop. The query's
 * `createdAt <` inequality forces oldest-first order, so a booking that
 * can never be settled sat at the front of that page for good and the
 * fifty slots were permanently spent on bookings the ceiling above now
 * declines to call for. Skipping them without paging past them would only
 * move the starvation one step: the page would still be fifty documents,
 * just fifty it does nothing with.
 */
export async function runReviewSweep(
  store: ReviewSweepStore,
  maxAttempts = MAX_REVIEW_ATTEMPTS,
): Promise<{ scanned: number; retried: number; stalled: number }> {
  let after: string | null = null;
  let scanned = 0;
  let retried = 0;
  let stalled = 0;
  for (let page = 0; page < SWEEP_MAX_PAGES; page++) {
    const rows = await store.heldPage(after, SWEEP_PAGE);
    if (!rows.length) break;
    scanned += rows.length;
    after = rows[rows.length - 1].id;
    for (const row of rows) {
      if (row.attempts >= maxAttempts) { stalled++; continue; }
      await store.review(row.id);
      retried++;
    }
    if (rows.length < SWEEP_PAGE) break;
  }
  return { scanned, retried, stalled };
}

export const sweepPaidReviewsV2 = onSchedule(
  { schedule: "every 30 minutes", region: REGION },
  async () => {
    const db = firestore();
    const cutoff = Timestamp.fromMillis(Date.now() - 10 * 60 * 1000);
    const base = db.collection("v2_paid_bookings")
      .where("status", "==", "review")
      .where("createdAt", "<", cutoff);
    const res = await runReviewSweep({
      heldPage: (after, limit) => heldPageFrom(base, db, after, limit),
      review: (bid) => reviewBooking(db, bid),
    });
    if (res.scanned) {
      logger.info(`[paid] review sweep retried ${res.retried} of ${res.scanned} held booking(s)`, {
        metric: "paid_review_sweep",
        ...res,
      });
    }
    if (res.stalled) {
      logger.error(`[paid] ${res.stalled} booking(s) past the review ceiling — no automatic verdict is coming`, {
        metric: "paid_review_stalled_total",
        stalled: res.stalled,
      });
    }
  },
);

// ── checkout ────────────────────────────────────────────────────────────

/**
 * Turn an approved booking into a Stripe Checkout session and hand back
 * its URL. The session is created fresh per call (an abandoned session
 * simply expires server-side at Stripe); amount and currency come off the
 * LOCKED quote, never the wire.
 */
export const createPaidCheckoutV2 = onCall(
  { ...LIGHT_CALLABLE, region: REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "must be signed in");
    const uid = request.auth.uid;
    const bid = String(request.data?.id || "");
    if (!bid) throw new HttpsError("invalid-argument", "id required");
    const db = firestore();
    const snap = await db.collection("v2_paid_bookings").doc(bid).get();
    if (!snap.exists || snap.get("uid") !== uid) {
      throw new HttpsError("not-found", "no such booking");
    }
    if (snap.get("status") === "live") {
      throw new HttpsError("failed-precondition", "already paid — the question is live or about to be");
    }
    if (snap.get("status") !== "approved") {
      throw new HttpsError("failed-precondition", "the booking isn't approved yet");
    }
    const key = stripeKey();
    if (!key) {
      throw new HttpsError("unavailable", "payments aren't configured on this deployment");
    }
    if (snap.get("kind") === "ad") {
      // An approved-but-unpaid ad from before D370: nothing sells it now.
      throw new HttpsError("failed-precondition", "ads aren't sold here any more — ask a question instead");
    }
    const quote = snap.get("quote") as PaidQuote;
    const amountEur = quote.capEur;
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(key);
    // ONE PAYABLE SESSION AT A TIME. Every call here used to mint a fresh
    // Checkout session and overwrite the stored id without touching the
    // old one, which stays payable for Stripe's default day — and
    // web/paid-cancel.html actively tells the buyer that pressing Pay
    // again "opens a fresh payment page". Two open sessions is two ways
    // to be charged for one question.
    //
    // Expiring is best-effort by construction: Stripe refuses to expire a
    // session that is already complete or expired, and a session that
    // completed while this ran is exactly the case goLive's duplicate
    // guard exists for. A failure here must not stop the buyer paying, so
    // it is logged and the new session is minted regardless.
    const priorSession = (snap.get("stripe") as { sessionId?: string } | undefined)?.sessionId;
    if (priorSession) {
      try {
        await stripe.checkout.sessions.expire(priorSession);
      } catch (err) {
        logger.info(`[paid] could not expire the prior session for ${bid}`, {
          metric: "paid_session_expire_skipped",
          bid,
          message: String((err as Error)?.message ?? err),
        });
      }
    }
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: bid,
      metadata: { bid, uid },
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: Math.round(amountEur * 100),
          product_data: {
            name: "InSight paid question",
            description:
              `${quote.windowDays}-day window · billed €${quote.ratePerAnswer.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")} per answer `
              + `up to ${quote.cap} answers · the unserved part refunds automatically at close`,
          },
        },
      }],
      // The web pages exist for exactly this hop (commerce stays on the
      // web side): web/paid-done.html and web/paid-cancel.html on the
      // hosting origin home.html already serves. The app never learns of
      // the payment from these pages — the webhook is the truth. (An ad
      // had its own landing page from D315 to D370, because the
      // question's promises — serving tomorrow, answers in Asked by you,
      // the refund at close — were all false of an ad; with one product
      // there is one page again, and every sentence on it is true.)
      success_url: "https://prvfire33.web.app/paid-done.html",
      cancel_url: "https://prvfire33.web.app/paid-cancel.html",
    });
    await snap.ref.update({
      stripe: { sessionId: session.id, at: Timestamp.now() },
    });
    logger.info(`[paid] checkout session for ${bid}`);
    return { url: session.url };
  },
);

// ── going live: the webhook ─────────────────────────────────────────────

/** Day arithmetic on the same grain: `dayPlus("2026-08-27", 1)` →
 * "2026-08-28". Null-safe against a malformed key (returns the input). */
export function dayPlus(day: string, days: number): string {
  const t = Date.parse(`${day}T00:00:00Z`);
  if (Number.isNaN(t)) return day;
  return new Date(t + days * 86400000).toISOString().slice(0, 10);
}

/**
 * The question doc a paid booking becomes — the third pen for
 * v2_questions (the seed, D34's reseed, and now this), writing the SAME
 * field shapes the seed writes so no client can tell the difference. The
 * things that make it safely sellable are structural here:
 *   · surface "feed", never core — the Mirror's corpus cannot be bought.
 *   · sponsor always present — the PAID band renders from its presence.
 *   · from/until — one value serves the filter and the band label.
 *   · updatedAt — what the bank's delta fetch keys on; this line is why
 *     going live needs no deploy and no contentRev bump.
 */
export function paidQuestionDoc(
  b: PaidBookingPayload,
  buyerName: string | null,
  start: string,
  until: string,
  seq: number,
): Record<string, unknown> {
  return {
    surface: "feed",
    // THE MARKER THE BOOT FETCH NEEDS, and the reason it exists rather
    // than being inferred.
    //
    // D316/D321 narrowed what a device fetches whole: the boot surfaces,
    // plus `surface == "feed" && core == true`. Everything else on the
    // feed pages behind the order `rankBankV2` publishes — and that order
    // is built from the COMPILED bank (`V2_QUESTIONS`), which a question
    // written here at runtime can never be in. Both halves landed the same
    // day as this file, in that sequence, so a bought question went into
    // `v2_questions` and was fetched by nobody: the buyer paid, the
    // aggregate stayed at zero, and the closer refunded the whole cap 29
    // days later.
    //
    // `core` would be the wrong fix — core is the Mirror's corpus (D161),
    // which a paid question must not join. This says what is actually
    // true: a runtime question no compiled order carries, which therefore
    // ships whole for the length of its window. Paired with `until` in the
    // client's query, so the set is the campaigns RUNNING, not every one
    // ever bought.
    paid: true,
    seq,
    type: b.type,
    domain: null,
    prompt: b.prompt,
    options: b.options,
    topic: b.topic,
    axis: null,
    test: null,
    sponsor: {
      ...(b.wearName && buyerName ? { buyer: buyerName } : {}),
      ...(Object.keys(b.dims).length ? { audience: b.dims } : {}),
    },
    from: start,
    until,
    updatedAt: FieldValue.serverTimestamp(),
  };
}

/** The purchase record (PAID-PLAN §7 shape, unchanged from
 * record-purchase.mjs — the room already reads exactly this). */
export function paidPurchaseDoc(
  uid: string,
  qid: string,
  b: PaidBookingPayload,
  quote: PaidQuote,
  start: string,
  until: string,
  paymentIntentId: string | null,
): Record<string, unknown> {
  return {
    uid,
    kind: "question",
    qid,
    prompt: b.prompt,
    options: b.options,
    scope: b.scope,
    place: b.scope === "city" ? b.dims.city ?? null : b.scope === "country" ? b.dims.country ?? null : null,
    dims: Object.entries(b.dims).map(([k, v]) => `${k}:${v}`),
    window: { start, until },
    cadence: "once",
    budget: { cap: quote.cap, capEur: quote.capEur, ratePerAnswer: quote.ratePerAnswer },
    state: "running",
    reports: [],
    ...(paymentIntentId ? { stripePaymentIntent: paymentIntentId } : {}),
    createdAt: FieldValue.serverTimestamp(),
  };
}

/**
 * checkout.session.completed → live, in one transaction: purchase
 * written, question written, booking stamped. Exported for the e2e loop,
 * which drives it with a signed synthetic event.
 */
export async function goLive(db: Firestore, bid: string, paymentIntentId: string | null): Promise<boolean> {
  const bookingRef = db.collection("v2_paid_bookings").doc(bid);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(bookingRef);
    if (!snap.exists) {
      logger.warn(`[paid] webhook for unknown booking ${bid}`);
      return false;
    }
    // Stripe delivers at-least-once; "live" means an earlier delivery won.
    //
    // A REPLAY AND A SECOND PAYMENT ARE NOT THE SAME THING, and this
    // returned true for both. Nothing stops two Checkout sessions
    // existing for one booking — the cancel page invites the buyer to
    // press Pay again, which mints one — and if both complete, the second
    // delivery landed here, answered 200, minted nothing and recorded
    // nothing. A buyer charged twice for one question, with the second
    // charge existing nowhere in this app: not on the booking, not in the
    // purchase row, and therefore not reachable by the closer's refund.
    //
    // The intent id is what tells them apart: a replay carries the SAME
    // one, a second payment a different one. There is no refund here on
    // purpose — moving money is the operator's call, and a refund issued
    // from a webhook retry path is its own hazard — but it is written
    // down and alarmed, so "recorded nowhere" stops being true.
    if (snap.get("status") === "live") {
      const first = (snap.get("stripePaymentIntent") as string | null) ?? null;
      if (paymentIntentId && first && paymentIntentId !== first) {
        tx.update(bookingRef, {
          duplicatePayments: FieldValue.arrayUnion(paymentIntentId),
        });
        logger.error(`[paid] SECOND payment for ${bid} — the buyer was charged twice`, {
          metric: "paid_duplicate_payment",
          bid,
          firstIntent: first,
          duplicateIntent: paymentIntentId,
        });
      }
      return true;
    }
    if (snap.get("status") !== "approved") {
      logger.warn(`[paid] webhook for ${bid} in status ${snap.get("status")} — ignored`);
      return false;
    }
    const b = bookingPayloadOf(snap);
    const uid = String(snap.get("uid"));
    // seq places the card in bank order for anything that sorts by it;
    // sponsored cards leave the ordinary stream (partitionSponsored), so
    // this is bookkeeping, not placement. Day-derived for stability.
    const seq = 100000 + Math.floor(Date.now() / 86400000);

    if (b.kind === "ad") {
      // The ad lane is retired (D370); nothing approves an ad, so a
      // payment for one is a stale booking paid off an old approval. Not
      // ours to go live — logged, and the operator refunds by hand.
      logger.error(`[paid] payment for ad booking ${bid} after the lane was retired (D370) — refund by hand`, {
        metric: "paid_ad_after_retirement",
        bid,
      });
      return false;
    }

    const quote = snap.get("quote") as PaidQuote;
    const buyerName = (snap.get("buyerName") as string | null) ?? null;
    // The window starts TOMORROW (UTC): today's decks are already dealt
    // on devices that booted this morning, and a window that starts on
    // its first fully-served day is the honest version of "29 days".
    const start = utcDayKey(1);
    const until = utcDayKey(WINDOW_DAYS); // start + 28 more days, inclusive
    const qid = `paidq-${bid}`;
    tx.set(db.collection("v2_questions").doc(qid), paidQuestionDoc(b, buyerName, start, until, seq));
    tx.set(
      db.collection("v2_purchases").doc(`${uid}_${bid}`),
      paidPurchaseDoc(uid, qid, b, quote, start, until, paymentIntentId),
    );
    tx.update(bookingRef, {
      status: "live",
      qid,
      window: { start, until },
      paidAt: Timestamp.now(),
      ...(paymentIntentId ? { stripePaymentIntent: paymentIntentId } : {}),
    });
    return true;
  });
}

/**
 * The Stripe webhook. onRequest, not onCall: Stripe is the caller, and
 * its signature — not App Check — is the authentication (the shared
 * webhook secret signs every delivery; constructEvent verifies it
 * timing-safely). Configured in the Stripe dashboard per
 * docs/DEPLOYMENT.md § Paid-question secrets.
 */
export const stripeWebhookV2 = onRequest(
  { region: REGION, memory: "256MiB", timeoutSeconds: 60 },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("POST only");
      return;
    }
    const whsec = stripeWebhookSecret();
    if (!whsec) {
      res.status(503).send("webhook not configured");
      return;
    }
    const sig = req.headers["stripe-signature"];
    const { default: Stripe } = await import("stripe");
    let event: import("stripe").Stripe.Event;
    try {
      // constructEvent needs the raw bytes — a reserialized body would
      // fail the HMAC even when honest. Functions v2 hands us rawBody.
      event = Stripe.webhooks.constructEvent(req.rawBody, String(sig ?? ""), whsec);
    } catch (err) {
      logger.warn("[paid] webhook signature rejected", { message: String((err as Error)?.message ?? err) });
      res.status(400).send("bad signature");
      return;
    }
    // THREE EVENTS, because "the checkout completed" is not "the money
    // arrived" for every payment method.
    //
    // The session is created without `payment_method_types`, so Stripe's
    // dynamic methods apply — and for EUR that can include the
    // delayed-notification ones (SEPA Direct Debit, bank transfer). Those
    // deliver `checkout.session.completed` with `payment_status: "unpaid"`
    // and settle hours or days later. This endpoint took `completed` as
    // payment received, so a 29-day window could serve in full against a
    // debit that never cleared, and the failure event was answered
    // "ignored".
    //
    // So: `completed` goes live only when it says paid;
    // `async_payment_succeeded` is when a delayed method actually clears,
    // and without it the guard alone would mean those buyers never went
    // live at all; `async_payment_failed` has nothing to revoke — the
    // guard is why — but it is logged loudly rather than swallowed,
    // because a buyer sitting on an approved booking that will never pay
    // itself is an operator's problem, not noise.
    //
    // docs/DEPLOYMENT.md lists the events to subscribe to; all three are
    // named there now.
    const KIND = {
      "checkout.session.completed": "completed",
      "checkout.session.async_payment_succeeded": "async_ok",
      "checkout.session.async_payment_failed": "async_fail",
    } as const;
    const kind = KIND[event.type as keyof typeof KIND];
    if (!kind) {
      // Everything else is noise at this endpoint; 200 stops the retries.
      res.status(200).send("ignored");
      return;
    }
    const session = event.data.object as import("stripe").Stripe.Checkout.Session;
    const bid = String(session.client_reference_id ?? session.metadata?.bid ?? "");
    if (!bid) {
      logger.warn("[paid] completed session without a booking reference");
      res.status(200).send("no reference");
      return;
    }
    if (kind === "async_fail") {
      logger.error(`[paid] delayed payment FAILED for ${bid} — the booking stays approved and unpaid`, {
        metric: "paid_async_failed",
        bid,
      });
      res.status(200).send("async failed");
      return;
    }
    if (session.payment_status !== "paid") {
      // Not an error: this is the ordinary first half of a delayed
      // method, and `async_payment_succeeded` is what finishes it.
      logger.info(`[paid] session for ${bid} completed unpaid (${String(session.payment_status)}) — waiting to settle`, {
        metric: "paid_awaiting_settlement",
        bid,
      });
      res.status(200).send("not paid yet");
      return;
    }
    const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null;
    const db = firestore();
    const went = await goLive(db, bid, paymentIntentId);
    // The sale just moved the ledger, so the rate card moves with it
    // (D366): the next buyer's door and the next quote read this. AFTER
    // the 200 is decided and never a reason to withhold it — the money
    // has landed and the question is live; a fold that fails is logged
    // and the nightly closer folds again.
    if (went) await publishPricing(db);
    res.status(200).send("ok");
  },
);

// ── the live rate card (D366) ───────────────────────────────────────────
//
// `v2_meta/pricing` carries the demand-derived half of the card — idx,
// the booked fortnight, the next open day, the estimates, and the day it
// was folded for — published by machinery where the ledger changes: the
// payment webhook above and the nightly closer below. Every signed-in
// user reads `v2_meta/*` (firestore.rules), so the number stays public;
// it just no longer waits for an operator to run a script and commit.
// The CONSTANTS never live here: base, floor, ceiling, caps and fx are
// the committed file's, and a deliberate re-pricing is still a PR.

/** The committed card with the published live half over it — or the
 * committed card alone when nothing has been published yet, or the read
 * fails. Never throws: a quote must not depend on a document that a
 * fresh deployment does not have. */
export async function liveCard(db: Firestore, card: PricingCard = PRICING_CARD): Promise<PricingCard> {
  try {
    const snap = await db.collection("v2_meta").doc("pricing").get();
    return snap.exists ? mergeLivePricing(card, snap.data()) : card;
  } catch (err) {
    logger.warn("[paid] live rate card unreadable — quoting off the committed card", {
      metric: "paid_pricing_read_failed",
      message: String((err as Error)?.message ?? err),
    });
    return card;
  }
}

/** How far back the fold reads purchase rows. The index needs the
 * trailing window; the estimates want completed campaigns, for which a
 * year is a bound rather than a policy (a forecast off campaigns older
 * than that measures a population that no longer exists). */
export const PRICING_ROWS_DAYS = 366;
/** The most rows one fold reads — far past anything the rate card
 * contemplates (one slot per scope per day), and a bound so a scheduled
 * job cannot grow an unbounded read. */
export const PRICING_ROWS_MAX = 1000;
/** The most running campaigns one fold reads an aggregate for (D367). */
export const PRICING_PROGRESS_MAX = 50;

/**
 * Fold the ledger and publish the live half of the card. Best-effort:
 * logs and returns false rather than throwing, because both callers are
 * on a path (a paid webhook, the closer's nightly loop) where the fold
 * failing must not undo what already happened.
 */
export async function publishPricing(db: Firestore, today = utcDayKey(0)): Promise<boolean> {
  try {
    // One range on `window.until`: every row that ended inside the
    // lookback or has not ended yet. Kind and scope are filtered in the
    // fold rather than the query, so this needs no composite index.
    const cutoff = dayPlus(today, -PRICING_ROWS_DAYS);
    const snap = await db.collection("v2_purchases")
      .where("window.until", ">=", cutoff)
      .limit(PRICING_ROWS_MAX)
      .get();
    const rows = snap.docs.map((d) => d.data() as PurchaseRow);
    // A running campaign that has served a week is an estimate's basis
    // (D367): its answer total so far is the public aggregate, one read
    // per such campaign — a handful at most, and bounded so the webhook
    // never waits on a runaway ledger.
    let reads = 0;
    for (const row of rows) {
      if (row.kind !== "question" || row.state !== "running" || !row.qid) continue;
      if (servedDays(row, today) < ESTIMATE_MIN_DAYS) continue;
      if (reads >= PRICING_PROGRESS_MAX) break;
      reads += 1;
      const agg = await db.collection("v2_question_aggs").doc(row.qid).get();
      const counts = (agg.exists ? agg.get("counts") : null) as Record<string, number> | null;
      if (counts) row.progress = { answers: Object.values(counts).reduce((a, b) => a + (Number(b) || 0), 0) };
    }
    const live = foldPricing(PRICING_CARD, rows, today);
    await db.collection("v2_meta").doc("pricing").set({ ...live, at: FieldValue.serverTimestamp() });
    logger.info(`[paid] rate card published for ${today}: ${(["city", "country", "world"] as const).map((s) => `${s} ×${live.cohorts[s].idx}`).join(" · ")} (${rows.length} row(s) folded)`, {
      metric: "paid_pricing_published",
      rows: rows.length,
    });
    if (snap.size >= PRICING_ROWS_MAX) {
      logger.warn(`[paid] the pricing fold hit its ${PRICING_ROWS_MAX}-row bound — the index is folded from a truncated ledger`, {
        metric: "paid_pricing_rows_cap",
      });
    }
    return true;
  } catch (err) {
    logger.error("[paid] rate card publish failed — the door prints the last published card", {
      metric: "paid_pricing_publish_failed",
      message: String((err as Error)?.message ?? err),
    });
    return false;
  }
}

// ── the closer ──────────────────────────────────────────────────────────

/** One page of running purchases per query. */
export const CLOSER_PAGE = 200;
/** How many pages one nightly run may walk. 5,000 running campaigns is
 *  far past anything the rate card contemplates; the bound is here so a
 *  runaway collection cannot turn a scheduled job into an unbounded read,
 *  and hitting it logs rather than passing quietly. */
export const CLOSER_MAX_PAGES = 25;


/** The refund the closer owes at window end: the unserved answers at the
 * locked rate, clamped into [0, capEur]. Billed per answer (D164) with
 * payment taken up front means under-delivery is the buyer's money. */
export function refundEurFor(cap: number, capEur: number, ratePerAnswer: number, answers: number): number {
  const unserved = Math.max(0, cap - Math.max(0, answers));
  return Math.min(capEur, Math.round(unserved * ratePerAnswer * 100) / 100);
}

/**
 * Close campaigns whose window has passed: count the answers off the
 * PUBLIC aggregate (the same doc buyer and voters read — D164's whole
 * point), refund the unserved part through Stripe, and mark the purchase
 * closed. Runs daily; a run that dies resumes tomorrow (state stays
 * "running" until the refund half has actually settled).
 */
export const closePaidCampaignsV2 = onSchedule(
  { schedule: "every day 03:30", region: REGION },
  async () => {
    const db = firestore();
    const today = utcDayKey(0);
    const key = stripeKey();
    let stripe: import("stripe").Stripe | null = null;
    // PAGED, and the page is the whole point. A single `limit(200)` reads
    // the first 200 running purchases by document id and never a second
    // page — and a purchase leaves "running" only when THIS job closes it.
    // So past 200 concurrent campaigns the same first 200 come back every
    // night, and a campaign that sits beyond the cut never closes: its
    // window ends, its refund is owed, and nothing ever pays it. Silent on
    // both sides — the buyer sees a campaign that never settles, and no
    // log line says the closer ran out of page.
    //
    // Ordered by document id explicitly, which is what an equality-only
    // query already does implicitly — written down because `startAfter`
    // depends on it, and an order nobody stated is an order somebody can
    // change.
    let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    let pages = 0;
    for (;;) {
      let q = db.collection("v2_purchases")
        .where("state", "==", "running")
        .orderBy(FieldPath.documentId())
        .limit(CLOSER_PAGE);
      if (cursor) q = q.startAfter(cursor);
      const running = await q.get();
      if (running.empty) break;
      for (const doc of running.docs) {
        const until = String((doc.get("window") as { until?: string })?.until ?? "");
        if (!until || until >= today) continue; // still serving
        const kind = String(doc.get("kind") ?? "question");
        if (kind === "ad") {
          // A row from before D370 retired the lane; nothing writes new
          // ones, and this arm stays so an old window still closes.
          // No refund arithmetic: the flat price bought the window and the
          // window ran (D315). The DELETE is the janitor half runSeedAds
          // gave up for `paidad-` ids: an expired paid ad would otherwise
          // sit in a pool every client downloads whole, forever — the
          // exact accumulation the seed's own delete exists to prevent.
          const adId = String(doc.get("adId") ?? "");
          if (adId) await db.collection("v2_ads").doc(adId).delete();
          await doc.ref.update({ state: "closed", closed: { at: Timestamp.now() } });
          logger.info(`[paid] closed ad ${doc.id}`, { metric: "paid_campaign_closed" });
          continue;
        }
        if (kind !== "question") continue; // subscriptions (PAID-PLAN §5) are not this job's
        const qid = String(doc.get("qid") ?? "");
        const budget = (doc.get("budget") as { cap: number; capEur: number; ratePerAnswer: number }) ?? { cap: 0, capEur: 0, ratePerAnswer: 0 };
        let answers = 0;
        if (qid) {
          const agg = await db.collection("v2_question_aggs").doc(qid).get();
          const counts = (agg.exists ? agg.get("counts") : null) as Record<string, number> | null;
          if (counts) answers = Object.values(counts).reduce((a, b) => a + (b || 0), 0);
        }
        const refundEur = refundEurFor(budget.cap, budget.capEur, budget.ratePerAnswer, answers);
        const paymentIntent = String(doc.get("stripePaymentIntent") ?? "");
        let refundId: string | null = null;
        // What actually went back, which is not always what was owed —
        // see the prior-refund lookup below. Starts at 0 and stays there
        // on the paths that transfer nothing.
        let refundedEur = 0;
        if (refundEur > 0 && paymentIntent && key) {
          try {
            if (!stripe) {
              const { default: Stripe } = await import("stripe");
              stripe = new Stripe(key);
            }
            // ASK BEFORE PAYING, and pay idempotently. The refund moves
            // money and the purchase is marked closed AFTER it — so a
            // timeout or a crash in that window leaves the row `running`
            // with the money already sent, and `until < today` stays true
            // forever, which means tomorrow's run recomputes the SAME
            // amount and refunds again. When twice the refund still fits
            // under the cap the buyer is quietly refunded twice; when it
            // does not, Stripe rejects it, the catch below holds the
            // purchase open, and the campaign can never close — every
            // night, until an operator intervenes.
            //
            // Two guards because one is not enough. The idempotency key
            // covers a retry inside Stripe's 24-hour window; this job runs
            // daily, so the NEXT night is outside it, and only the lookup
            // covers that. The charge side of this file already takes this
            // seriously — it records duplicate payments and alarms on them,
            // and expires a prior checkout session because "two open
            // sessions is two ways to be charged for one question". The
            // refund side had nothing.
            // ALL of them, and their AMOUNTS. This took `limit: 1` and
            // then closed the purchase recording `refundEur` — what was
            // OWED — as settled, whatever had actually gone back. An
            // operator issuing a partial refund by hand in the Stripe
            // dashboard therefore closed the campaign with the remainder
            // neither paid nor flagged, and the contract record saying it
            // had been. The record is the thing a dispute is read against.
            //
            // Failed and canceled refunds do not count as money returned.
            const prior = await stripe.refunds.list({ payment_intent: paymentIntent, limit: 100 });
            const settled = prior.data.filter(
              (r) => r.status !== "failed" && r.status !== "canceled",
            );
            if (settled.length) {
              refundId = settled[0].id;
              refundedEur = Math.round(
                settled.reduce((a, r) => a + (r.amount || 0), 0),
              ) / 100;
              // A cent of slack: both sides are cents rounded through
              // floats, and a warning that fires on 639.999999 is noise.
              if (refundedEur + 0.005 < refundEur) {
                logger.warn(
                  `[paid] ${doc.id} was refunded €${refundedEur} of €${refundEur} owed — €${Math.round((refundEur - refundedEur) * 100) / 100} outstanding, settle off-app`,
                  { metric: "paid_refund_offapp", refundedEur, owedEur: refundEur },
                );
              } else {
                logger.warn(`[paid] ${doc.id} already refunded (${refundId}) — closing without a second transfer`, {
                  metric: "paid_refund_already", refundedEur,
                });
              }
            } else {
              const refund = await stripe.refunds.create({
                payment_intent: paymentIntent,
                amount: Math.round(refundEur * 100),
              }, { idempotencyKey: `close_${doc.id}` });
              refundId = refund.id;
              refundedEur = refundEur;
            }
          } catch (err) {
            // A failed refund HOLDS the purchase open — closing it would
            // record the debt as settled. Tomorrow's run retries.
            logger.error(`[paid] refund failed for ${doc.id} — held for retry`, {
              metric: "paid_refund_held",
              message: String((err as Error)?.message ?? err),
            });
            continue;
          }
        } else if (refundEur > 0 && (!paymentIntent || !key)) {
          // Emulator, or a purchase written by the operator script (no
          // payment intent): record the arithmetic, close without a
          // transfer — the contract channel settles those by hand.
          logger.warn(`[paid] ${doc.id} closes owing €${refundEur} with no refund path — settle off-app`, {
            metric: "paid_refund_offapp",
          });
        }
        await doc.ref.update({
          state: "closed",
          closed: {
            at: Timestamp.now(),
            answers,
            // What was OWED, unchanged — the arithmetic the buyer can
            // re-derive from the public counts.
            refundEur,
            // …and what was SENT, which the record could not previously
            // distinguish from it.
            refundedEur,
            ...(refundId ? { refundId } : {}),
          },
        });
        logger.info(`[paid] closed ${doc.id}: ${answers}/${budget.cap} answers, refund €${refundedEur} of €${refundEur} owed`, {
          metric: "paid_campaign_closed",
        });
      }
      pages += 1;
      // A short page is the end of the collection; a full one may not be.
      if (running.size < CLOSER_PAGE) break;
      if (pages >= CLOSER_MAX_PAGES) {
        // The bound exists so one scheduled run cannot walk forever, and
        // it must never become the silent cap the single page was: say so,
        // and tomorrow's run starts from the top and gets further because
        // tonight closed some.
        logger.warn(
          `[paid] closer stopped at ${pages} pages (${pages * CLOSER_PAGE} running purchases) — more remain`,
          { metric: "paid_closer_page_cap", pages },
        );
        break;
      }
      cursor = running.docs[running.docs.length - 1];
    }
    // The nightly refold (D366): a window that ended tonight leaves the
    // index, the booked strip rolls one day forward, and a campaign
    // closed above becomes an estimate's basis. Daily even with no sale,
    // because `booked` is relative to today and a strip that never rolls
    // is a strip that goes stale.
    await publishPricing(db, today);
  },
);
