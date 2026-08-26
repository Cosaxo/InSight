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

import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { ENFORCE_APP_CHECK, LIGHT_CALLABLE, FUNCTIONS_REGION } from "./ops";
import { db as firestore, FIRESTORE_DB_ID } from "./db";
import { PRICING_CARD } from "./pricing";

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

/** The audience vocabulary: the published breakdown dims (D98/D228),
 * matched against the same anchor keys the answers carry. Profession and
 * the politics result are excluded by the vocabulary itself (D8/Art. 9). */
export const AUDIENCE_DIMS = new Set([
  "ageBand", "gender", "city", "country", "education", "relationship", "heightBand",
]);
export const AUDIENCE_DIMS_MAX = 3; // D228's coarseness ceiling

// ── the ad lane (D315) ──────────────────────────────────────────────────
// Bounds mirrored by value from scripts/check-content.mjs's ad rules
// (advertiser 40 · headline 70 · body 140), the same runtime-import
// constraint every mirrored figure in this file carries. The URL nose is
// check-content's own, byte-for-byte: an ad card has no tap-through
// (D197), so a typed-out address is a worse click-out, not a clever one.
export const AD_ADVERTISER_MAX = 40;
export const AD_HEADLINE_MAX = 70;
export const AD_BODY_MAX = 140;
export const AD_URL_RE = /https?:\/\/|www\.|\.com\b|\.no\b/i;
/** D197 authoring rule 4: an ad wears AT MOST ONE audience tag — the
 * scope's place dim counts as it. Narrower than the question path's
 * three on purpose; widening it is a recorded decision, not an edit. */
export const AD_AUDIENCE_MAX = 1;

export interface PaidBookingPayload {
  /** what is being bought: a question (D313) or a feed ad (D315). */
  kind: "question" | "ad";
  prompt: string;
  type: string;
  options: string[];
  topic: string | null;
  /** the ad half — null on question bookings. The advertiser is ALWAYS
   * printed on the band (D197); there is no nameless ad. */
  advertiser: string | null;
  headline: string | null;
  body: string | null;
  scope: "city" | "country" | "world";
  /** dim → bucket, conjunctive. Questions: ≤3 (D228). Ads: ≤1 (D197).
   * For city/country scope the place dim IS the scope; world may still
   * carry e.g. an age band. */
  dims: Record<string, string>;
  wearName: boolean;
}

export interface PaidQuote {
  ratePerAnswer: number;
  capEur: number;
  cap: number;
  windowDays: number;
}

/** An ad's quote: one flat figure for the window, because an ad produces
 * no number to bill per — no answers, no clicks (nothing is tappable),
 * and no impressions, deliberately (D197: nothing is counted). What the
 * money buys IS the window, computable in advance with no meter. */
export interface PaidAdQuote {
  flatEur: number;
  windowDays: number;
}

/**
 * Normalize and bound-check a booking. Returns the payload to store, or a
 * human-readable refusal the composer shows verbatim — every message says
 * what to change, not which rule fired (the suggestions.ts convention).
 */
export function validatePaidBooking(data: unknown): { ok: PaidBookingPayload } | { error: string } {
  const d = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  if (d.kind === "ad") return validateAdBooking(d);
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
  if (options.length > PAID_OPTIONS_MAX) return { error: `at most ${PAID_OPTIONS_MAX} options` };
  // The continuum forms carry the app's own scales — an authored option
  // list on a scale question would re-key what every stored optionIdx
  // means, which is the D52 line. Synthesize, never accept.
  if (type === "scale") options = [...LIKERT];
  else if (type === "rating") options = [...RATING];
  else if (options.length < 2) return { error: "give people at least two options" };
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

  return {
    ok: {
      kind: "question",
      prompt,
      type,
      options,
      topic,
      advertiser: null,
      headline: null,
      body: null,
      scope,
      dims,
      wearName: d.wearName === true,
    },
  };
}

/** The ad booking's half of the door (D315) — same refusal register:
 * every message says what to change. */
function validateAdBooking(d: Record<string, unknown>): { ok: PaidBookingPayload } | { error: string } {
  const advertiser = String(d.advertiser ?? "").trim();
  const headline = String(d.headline ?? "").trim();
  const body = String(d.body ?? "").trim();
  if (!advertiser) return { error: "name the advertiser — every ad card says who paid" };
  if (advertiser.length > AD_ADVERTISER_MAX) return { error: `the advertiser name stays under ${AD_ADVERTISER_MAX} characters` };
  if (!headline) return { error: "write the headline first" };
  if (headline.length > AD_HEADLINE_MAX) return { error: `headlines stay under ${AD_HEADLINE_MAX} characters — trim it down` };
  if (!body) return { error: "write the ad's line of text" };
  if (body.length > AD_BODY_MAX) return { error: `the text stays under ${AD_BODY_MAX} characters` };
  for (const v of [advertiser, headline, body]) {
    if (AD_URL_RE.test(v)) {
      return { error: "no web addresses — an ad card here has nowhere to send anyone, and a typed-out link would just be a worse one" };
    }
  }
  const scope = d.scope === "city" || d.scope === "country" || d.scope === "world" ? d.scope : null;
  if (!scope) return { error: "pick who sees it — your city, your country, or everyone" };
  const rawDims = (d.dims && typeof d.dims === "object" ? d.dims : {}) as Record<string, unknown>;
  const dims: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawDims)) {
    if (!AUDIENCE_DIMS.has(k)) return { error: `"${k}" is not an audience the card can state` };
    const s = String(v ?? "").trim();
    if (!s || s.length > BUCKET_MAX) return { error: "an audience value is missing or too long" };
    dims[k] = s;
  }
  if (Object.keys(dims).length > AD_AUDIENCE_MAX) {
    return { error: "an ad wears at most one audience tag — the place already is one" };
  }
  if (scope === "city" && !dims.city) return { error: "a city ad needs your city set on your profile" };
  if (scope === "country" && !dims.country) return { error: "a country ad needs your country set on your profile" };
  if (scope === "world" && (dims.city || dims.country)) {
    return { error: "a world ad can't carry a place — pick the city or country scope instead" };
  }
  return {
    ok: {
      kind: "ad",
      prompt: "",
      type: "ad",
      options: [],
      topic: null,
      advertiser,
      headline,
      body,
      scope,
      dims,
      // The advertiser is always printed (D197) — there is no nameless
      // ad, so the flag is structural rather than a choice.
      wearName: true,
    },
  };
}

/**
 * The quote, server-side, off the committed card — the client's figure is
 * display and never the invoice. Locked into the booking at approval so
 * a card recompute mid-flow cannot move a price someone already saw.
 */
export function priceQuote(scope: "city" | "country" | "world", card = PRICING_CARD): PaidQuote {
  const idx = Math.min(Math.max(card.cohorts[scope].idx, card.floorX), card.ceilX);
  // 4 decimals: base 0.16 × idx 0.9 = 0.144 exactly; rounding is for the
  // day a recomputed idx carries more digits than a price should.
  const ratePerAnswer = Math.round(card.base * idx * 10000) / 10000;
  const capEur = card.capEur;
  const cap = Math.floor(capEur / ratePerAnswer);
  return { ratePerAnswer, capEur, cap, windowDays: WINDOW_DAYS };
}

/** The ad window's flat price (D315): adBase × the scope's demand index —
 * the same inventory the question path occupies, priced by the same idx,
 * with no meter because an ad produces nothing to meter. */
export function adPriceQuote(scope: "city" | "country" | "world", card = PRICING_CARD): PaidAdQuote {
  const idx = Math.min(Math.max(card.cohorts[scope].idx, card.floorX), card.ceilX);
  const flatEur = Math.round(card.adBase * idx * 100) / 100;
  return { flatEur, windowDays: WINDOW_DAYS };
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
  if (b.kind === "ad") {
    // The form bounds and the URL nose already ran in validate; what is
    // left for a gate is the same is-this-words check the prompt gets.
    if (!/[\p{L}\p{N}]{2}/u.test(`${b.headline} ${b.body}`)) {
      return "that doesn't read as an ad yet — write it out in words";
    }
    return null;
  }
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

Judge the submission as a whole (prompt, options, buyer name, audience). Write decline reasons to be shown to the buyer verbatim: say what to change, kindly, in one or two sentences. Do not mention these numbered rules.

A submission with "kind":"ad" is a FEED AD, not a question: text-only (advertiser · headline · body), no link, nothing tappable, shown with a PAID band naming the advertiser. The rules above apply to it as written, and additionally DECLINE an ad that: states an unverifiable or miracle claim as fact (health cures, guaranteed returns, "clinically proven" without a named study); impersonates a brand or organization the buyer plainly is not; or is a political campaign ad for a candidate or party (civic QUESTIONS are welcome inventory — one-sided campaign copy is not a question and has no answer space to keep it honest).`;

/** The submission, serialized for the reviewer. Separate from the
 * guidelines so the prompt's stable half stays stable. */
export function reviewSubject(b: PaidBookingPayload, buyerName: string | null): string {
  if (b.kind === "ad") {
    return JSON.stringify({
      kind: "ad",
      advertiser: b.advertiser,
      headline: b.headline,
      body: b.body,
      scope: b.scope,
      audience: b.dims,
    });
  }
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
    advertiser: (snap.get("advertiser") as string | null) ?? null,
    headline: (snap.get("headline") as string | null) ?? null,
    body: (snap.get("body") as string | null) ?? null,
    scope: snap.get("scope"),
    dims: (snap.get("dims") as Record<string, string>) ?? {},
    wearName: snap.get("wearName") === true,
  };
}

/**
 * Review one booking doc and settle its status. Idempotent: the
 * transaction re-reads status and only ever moves "review" → verdict, so
 * the trigger and the sweep can race without a double transition.
 */
async function reviewBooking(db: Firestore, bid: string): Promise<void> {
  const ref = db.collection("v2_paid_bookings").doc(bid);
  const snap = await ref.get();
  if (!snap.exists || snap.get("status") !== "review") return;
  const payload = bookingPayloadOf(snap);
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
  // PAID-PLAN §6 promises ("the rate LOCKED at booking"). A pricing.json
  // recompute between approval and payment changes nothing for this buyer.
  const quote = payload.kind === "ad" ? adPriceQuote(payload.scope) : priceQuote(payload.scope);
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
      const n = prof.exists ? String(prof.get("name") ?? "").trim() : "";
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
export const sweepPaidReviewsV2 = onSchedule(
  { schedule: "every 30 minutes", region: REGION },
  async () => {
    const db = firestore();
    const cutoff = Timestamp.fromMillis(Date.now() - 10 * 60 * 1000);
    const stuck = await db.collection("v2_paid_bookings")
      .where("status", "==", "review")
      .where("createdAt", "<", cutoff)
      .limit(50)
      .get();
    for (const doc of stuck.docs) {
      await reviewBooking(db, doc.id);
    }
    if (stuck.size) {
      logger.info(`[paid] review sweep retried ${stuck.size} held booking(s)`, {
        metric: "paid_review_sweep",
        count: stuck.size,
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
    const isAd = snap.get("kind") === "ad";
    const quote = snap.get("quote") as PaidQuote & PaidAdQuote;
    const amountEur = isAd ? quote.flatEur : quote.capEur;
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(key);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: bid,
      metadata: { bid, uid },
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: Math.round(amountEur * 100),
          product_data: isAd
            ? {
              name: "InSight feed ad",
              description:
                `${quote.windowDays}-day window at a flat price · text-only, no link, no tracking · `
                + "starts on the scope's first open day after payment",
            }
            : {
              name: "InSight paid question",
              description:
                `${quote.windowDays}-day window · billed €${quote.ratePerAnswer.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")} per answer `
                + `up to ${quote.cap} answers · the unserved part refunds automatically at close`,
            },
        },
      }],
      // The web pages exist for exactly this hop (commerce stays on the
      // web side): web/paid-done*.html and web/paid-cancel.html on the
      // hosting origin home.html already serves. The app never learns of
      // the payment from these pages — the webhook is the truth.
      //
      // ONE PAGE PER PRODUCT. Both kinds used to land on the question's
      // page, which tells the buyer their QUESTION is going live, that it
      // starts serving TOMORROW, that everything it collects lands in
      // Asked by you, and that the unserved part REFUNDS automatically at
      // close. For an ad all four are false — it queues behind the ad
      // running in its scope, it asks nothing, and it has no refund path
      // (D315) — so an advertiser was promised a refund in writing, at
      // the moment of payment, that nothing in this file will ever issue.
      success_url: isAd
        ? "https://prvfire33.web.app/paid-done-ad.html"
        : "https://prvfire33.web.app/paid-done.html",
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

/** The UTC day key, offset in days — the same YYYY-MM-DD grain every
 * window in the bank speaks. */
export function utcDayKey(offsetDays: number, nowMs = Date.now()): string {
  return new Date(nowMs + offsetDays * 86400000).toISOString().slice(0, 10);
}

/** Day arithmetic on the same grain: `dayPlus("2026-08-27", 1)` →
 * "2026-08-28". Null-safe against a malformed key (returns the input). */
export function dayPlus(day: string, days: number): string {
  const t = Date.parse(`${day}T00:00:00Z`);
  if (Number.isNaN(t)) return day;
  return new Date(t + days * 86400000).toISOString().slice(0, 10);
}

/**
 * Where a NEW ad window starts (D315): the scope's first day with no
 * other paid ad running — ads QUEUE rather than share, which is the flat
 * price's honesty. A question's dilution self-corrects through per-answer
 * billing and its refund; a flat-priced ad silently diluted by another ad
 * would be getting less for the same money, so the second buyer's window
 * simply begins the day after the first one ends. Sharing with paid
 * QUESTIONS remains (their billing absorbs it) and the door says so
 * before payment.
 */
export function adStartDay(
  runningAdWindows: ReadonlyArray<{ until?: string }>,
  nowMs = Date.now(),
): string {
  let start = utcDayKey(1, nowMs);
  for (const w of runningAdWindows) {
    if (w.until && w.until >= start) start = dayPlus(w.until, 1);
  }
  return start;
}

/**
 * The ad doc the webhook writes into v2_ads (D315) — the seed's own
 * field shape (runSeedAds) plus `from`, which committed ads never need
 * (their window starts at seed time) and a queued paid ad does:
 * pickPaid's ad filter honours it so a window scheduled to open next
 * week does not serve tonight. The id prefix `paidad-` is what
 * runSeedAds spares and the closer retires.
 */
export function paidAdDoc(
  b: PaidBookingPayload,
  start: string,
  until: string,
  seq: number,
): Record<string, unknown> {
  return {
    seq,
    advertiser: b.advertiser,
    headline: b.headline,
    body: b.body,
    from: start,
    until,
    ...(Object.keys(b.dims).length ? { audience: b.dims } : {}),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

/** The ad sale's purchase record — kind "ad", a flat price, no meter and
 * no report shelf: an ad collects nothing, so there is nothing to
 * report. The room renders the window and the price, and says exactly
 * that. */
export function paidAdPurchaseDoc(
  uid: string,
  adId: string,
  b: PaidBookingPayload,
  quote: PaidAdQuote,
  start: string,
  until: string,
  paymentIntentId: string | null,
): Record<string, unknown> {
  return {
    uid,
    kind: "ad",
    adId,
    advertiser: b.advertiser,
    headline: b.headline,
    body: b.body,
    scope: b.scope,
    place: b.scope === "city" ? b.dims.city ?? null : b.scope === "country" ? b.dims.country ?? null : null,
    dims: Object.entries(b.dims).map(([k, v]) => `${k}:${v}`),
    window: { start, until },
    priceEur: quote.flatEur,
    state: "running",
    ...(paymentIntentId ? { stripePaymentIntent: paymentIntentId } : {}),
    createdAt: FieldValue.serverTimestamp(),
  };
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
    if (snap.get("status") === "live") return true;
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
      const quote = snap.get("quote") as PaidAdQuote;
      // The scheduling read runs INSIDE the transaction, before any
      // write, so two payments racing for the same scope serialize: the
      // second retries against the first's committed window and queues
      // behind it (adStartDay). This is the day-exclusivity the flat
      // price is honest by.
      const runningAds = await tx.get(
        db.collection("v2_purchases")
          .where("kind", "==", "ad")
          .where("scope", "==", b.scope)
          .where("state", "==", "running"),
      );
      const start = adStartDay(runningAds.docs.map((d) => (d.get("window") as { until?: string }) ?? {}));
      const until = dayPlus(start, WINDOW_DAYS - 1); // 29 days inclusive
      const adId = `paidad-${bid}`;
      tx.set(db.collection("v2_ads").doc(adId), paidAdDoc(b, start, until, seq));
      tx.set(
        db.collection("v2_purchases").doc(`${uid}_${bid}`),
        paidAdPurchaseDoc(uid, adId, b, quote, start, until, paymentIntentId),
      );
      tx.update(bookingRef, {
        status: "live",
        adId,
        window: { start, until },
        paidAt: Timestamp.now(),
        ...(paymentIntentId ? { stripePaymentIntent: paymentIntentId } : {}),
      });
      return true;
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
    await goLive(firestore(), bid, paymentIntentId);
    res.status(200).send("ok");
  },
);

// ── the closer ──────────────────────────────────────────────────────────

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
    const running = await db.collection("v2_purchases")
      .where("state", "==", "running")
      .limit(200)
      .get();
    const key = stripeKey();
    let stripe: import("stripe").Stripe | null = null;
    for (const doc of running.docs) {
      const until = String((doc.get("window") as { until?: string })?.until ?? "");
      if (!until || until >= today) continue; // still serving
      const kind = String(doc.get("kind") ?? "question");
      if (kind === "ad") {
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
      if (refundEur > 0 && paymentIntent && key) {
        try {
          if (!stripe) {
            const { default: Stripe } = await import("stripe");
            stripe = new Stripe(key);
          }
          const refund = await stripe.refunds.create({
            payment_intent: paymentIntent,
            amount: Math.round(refundEur * 100),
          });
          refundId = refund.id;
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
          refundEur,
          ...(refundId ? { refundId } : {}),
        },
      });
      logger.info(`[paid] closed ${doc.id}: ${answers}/${budget.cap} answers, refund €${refundEur}`, {
        metric: "paid_campaign_closed",
      });
    }
  },
);
