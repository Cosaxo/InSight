// Sponsored questions in the feed (D195) — which one is offered, why, and
// the sentences the disclosure band prints.
//
// A sponsored question is an ORDINARY question. It aggregates through the
// same trigger, publishes the same exact split, takes the same answers and
// shows the same who-voted sheet. What a sponsor buys is a PLACE and a
// WINDOW, and the four things that follow are the whole of what makes that
// safe to sell:
//
//   1. ITS OWN PLACES, AT ONE DENSITY. `SPONSOR_EVERY` is where paid cards
//      go — one after every sixth world card, positions 6, 12, 18 … — and
//      the density is the cap: a campaign lands at most once per feed
//      build, and how many the feed carries is how far the reader
//      scrolls, never how many the bank holds. Until D372 this read "ONE
//      AT A TIME" — `SPONSOR_SLOT = 1`, the prototype's "a feed with two is
//      a feed for sale" — which made inventory one card per phone per day
//      whatever the app's size, every sale diluting the last. The density
//      is a named constant for the reason the cap was: a change to it is
//      a diff, and the door prints it.
//   2. SELECTION HAPPENS HERE, ON THE DEVICE. The audience tag rides on
//      the CONTENT, which every device downloads whole; this module
//      matches it against the anchors the device already holds. The server
//      is never asked who should see what, which is the line
//      docs/QUESTION-FARM.md draws — server-side per-user selection is the
//      moment a behavioural profile exists, whatever the intentions.
//   3. THE MATCH IS DISCLOSED. `whyMatched` returns the reason in the
//      user's own vocabulary, and the band prints it. A targeted card that
//      cannot say why you got it is the thing this design refuses.
//   4. THE TAIL, NEVER THE CORE. `check:content` refuses `core: true` on a
//      sponsored question, because a paid question inside the Mirror's
//      corpus would make the honest aggregate a paid-for sample
//      (docs/SCALE-PLAN.md §5).
//
// Pure: no Firebase, no window, no clock. The day index is passed in.
import type { QuestionDoc } from "./deck";
import { DIM_LABEL } from "./cohort";

/** Who bought a question, and the coarse tags they bought it against. */
export interface Sponsor {
  /**
   * The name the buyer chose to wear, or absent for a nameless purchase
   * (D228). Companies AND individuals buy questions, and printing a
   * person's name on every serve is theirs to want or refuse — the PAID
   * band renders either way, from this block's presence, because the
   * fact of payment is the app's disclosure and not the buyer's choice.
   */
  buyer?: string;
  /**
   * dim → bucket, one to three entries (D228 widened D195's one),
   * matched conjunctively — every named dim must agree. Absent = shown
   * to everyone. Each matched dim is printed on the band (`whyMatched`).
   */
  audience?: Record<string, string>;
  /**
   * The buyer's one link (D373): an https address, validated for shape
   * by the server and for substance by the review. The card prints it as
   * its bare domain (`linkDomain`) ONLY after the person has answered —
   * the question is answered as a question, and the link is the buyer's
   * thank-you rather than the card's purpose — and opens it in the
   * system browser with no referrer of ours. Nothing is counted: no tap
   * log, no parameter added. Absent for no link, which is every question
   * bought before it existed.
   */
  link?: string;
}

/**
 * The bare domain a link prints as — `harboursauna.no`, never the path
 * and never a `www.`: what a reader needs to decide whether to tap is
 * WHOSE page it is, and a full address on a card is the click-out the
 * ad rules refused. Null when the value is not an https address, so a
 * malformed one that somehow reached content prints nothing rather than
 * a broken control.
 */
export function linkDomain(link: string | undefined): string | null {
  if (!link) return null;
  try {
    const u = new URL(link);
    if (u.protocol !== "https:") return null;
    return u.hostname.replace(/^www\./i, "").toLowerCase() || null;
  } catch {
    return null;
  }
}

/**
 * A paid card after every this-many world cards (D372): positions 6, 12,
 * 18 … as far as the day's pool reaches. The unit of sale is a PLACE in
 * this rhythm rather than a single slot — docs/SCALE-PLAN.md §5's
 * argument survives the change: inventory is still computable from the
 * content schedule without telemetry, and the density is one greppable
 * number rather than something demand can quietly inflate. One in six is
 * a routine's pick (docs/SPONSORED-PLAN.md §5); the first week of use
 * re-tunes it.
 */
export const SPONSOR_EVERY = 6;

export type SponsoredQ = QuestionDoc & { id: string; sponsor?: Sponsor };

/**
 * Does this device's own profile match the tag the question was bought
 * against?
 *
 * An untagged question matches everyone. A tagged one matches only an
 * exact bucket equality — no ranges, no "near", no inference. The whole
 * vocabulary is `AUDIENCE_DIMS` (functions/src/paid.ts) — a SUBSET of the
 * published breakdown dims, which is to say cohorts a user can already see
 * themselves counted in. The politics result is excluded by not being an
 * anchor at all (Art. 9); `jobField`, a breakdown dim since D328, is
 * excluded by that list naming its seven rather than deriving them.
 */
export function matches(sponsor: Sponsor | undefined, anchors: Readonly<Record<string, string>>): boolean {
  const tag = sponsor?.audience;
  if (!tag) return true;
  for (const dim in tag) {
    if (anchors[dim] !== tag[dim]) return false;
  }
  return true;
}

/**
 * The reasons to print on the band, in the user's own words.
 *
 * Empty when the question was bought untargeted — and the band says that
 * plainly rather than omitting the line, because "shown to everyone" is
 * information too.
 */
export function whyMatched(sponsor: Sponsor | undefined): string[] {
  const tag = sponsor?.audience;
  if (!tag) return [];
  return Object.entries(tag).map(([dim, bucket]) => `${DIM_LABEL[dim] ?? dim}: ${bucket}`);
}

/**
 * The day's order over a pool: sorted by id, then started at the day's
 * index and wrapped, so every campaign appears once and which one comes
 * FIRST rotates by UTC day.
 *
 * Rotation rather than "the first" for a reason that is about the seller
 * as much as the reader: the first place is the one most readers reach,
 * and with two buyers in the same window, first-in-bank-order would give
 * one of them every first impression and the other none, which is
 * inventory nobody could price. The day index makes the share equal and
 * the schedule computable in advance — which is exactly what lets a place
 * be SOLD without any per-impression telemetry (docs/SCALE-PLAN.md §5).
 * Sorted by id so the order is a property of the bank rather than of
 * whatever order the pages happened to arrive in.
 */
function dayOrder<T extends { id: string }>(items: readonly T[], utcDay: number): T[] {
  if (!items.length) return [];
  const sorted = [...items].sort((a, b) => a.id.localeCompare(b.id));
  // `% length` on a negative day index would return a negative start; the
  // day index is derived from the epoch and cannot be negative today, and
  // the `+ length` makes that a fact rather than an assumption.
  const start = ((utcDay % sorted.length) + sorted.length) % sorted.length;
  return sorted.slice(start).concat(sorted.slice(0, start));
}

/**
 * The sponsored questions to offer, in the day's order — every eligible
 * one, once, the first place rotating by day (D372; until then the one
 * card the day's rotation landed on).
 *
 * The caller has already filtered expired questions (`until`, live.ts) and
 * inactive ones, so eligibility here is: it is sponsored, and it matches.
 */
export function orderSponsored<T extends SponsoredQ>(
  pool: readonly T[],
  anchors: Readonly<Record<string, string>>,
  utcDay: number,
): T[] {
  return dayOrder(pool.filter((q) => q.sponsor && matches(q.sponsor, anchors)), utcDay);
}

/** The sponsored card in the day's FIRST place, or null — the one most
 * readers reach, which is the one the rotation shares out. */
export function pickSponsored<T extends SponsoredQ>(
  pool: readonly T[],
  anchors: Readonly<Record<string, string>>,
  utcDay: number,
): T | null {
  return orderSponsored(pool, anchors, utcDay)[0] ?? null;
}

/** One feed ad (D197) — text, an advertiser, a window. Never a question.
 * `from` joined with D315: a committed ad's window opens at seed time so
 * it never carries one, while a self-serve ad's is the day after payment
 * (D369; under D315 it queued behind the scope's running ad) and it must
 * not serve before that day. */
export interface FeedAd {
  id: string;
  seq?: number;
  advertiser: string;
  headline: string;
  body: string;
  from?: string;
  until?: string;
  audience?: Record<string, string>;
  active?: boolean;
}

/**
 * One paid thing, of either kind.
 *
 * A discriminated union rather than two lists, because the PLACES are
 * the product: a paid card in the feed is a paid card whichever kind it
 * is, and the two kinds share the same places in the same day's order.
 */
export type PaidItem<T> =
  | { kind: "question"; question: T }
  | { kind: "ad"; ad: FeedAd };

/** What a paid place is holding, if anything. */
export type PaidSlot<T> = PaidItem<T> | null;

/**
 * The day's order over BOTH kinds — every eligible sponsored question and
 * ad, once each, the first place rotating by day.
 *
 * Sponsored questions and ads take the same places and rotate together,
 * so a week with one of each alternates which comes first rather than
 * giving the question the first place every day because questions were
 * checked first. The combined pool is sorted by id for the same reason
 * the question-only pool is: the order should be a property of what was
 * bought, not of which query returned first.
 */
export function orderPaid<T extends SponsoredQ>(
  questions: readonly T[],
  ads: readonly FeedAd[],
  anchors: Readonly<Record<string, string>>,
  utcDay: number,
  today = "",
): PaidItem<T>[] {
  const eligibleQs = questions.filter((q) => q.sponsor && matches(q.sponsor, anchors));
  const eligibleAds = ads.filter((a) =>
    a.active !== false
    // An ad's window is enforced HERE as well as by the seed, because the
    // pool is cached on the device: a session that outlived the last day
    // of a campaign would otherwise keep serving it. Questions get the
    // same filter one layer up, in live.ts's bank build. Both ends since
    // D315: a self-serve ad carries `from` and must not serve before its
    // first day — the day after payment since D369, a queued day under
    // D315 — so a device that cached the pool before then holds it.
    && (!today || !a.until || a.until >= today)
    && (!today || !a.from || a.from <= today)
    && matches({ buyer: a.advertiser, audience: a.audience }, anchors));
  const pool: Array<{ id: string; item: PaidItem<T> }> = [
    ...eligibleQs.map((q) => ({ id: q.id, item: { kind: "question" as const, question: q } })),
    ...eligibleAds.map((a) => ({ id: a.id, item: { kind: "ad" as const, ad: a } })),
  ];
  return dayOrder(pool, utcDay).map((x) => x.item);
}

/** The paid thing in the day's FIRST place, of either kind, or null. */
export function pickPaid<T extends SponsoredQ>(
  questions: readonly T[],
  ads: readonly FeedAd[],
  anchors: Readonly<Record<string, string>>,
  utcDay: number,
  today = "",
): PaidSlot<T> {
  return orderPaid(questions, ads, anchors, utcDay, today)[0] ?? null;
}

/**
 * Split a feed pool into the day's paid cards, in order, and everything
 * else.
 *
 * EVERY sponsored question leaves the ordinary stream, matched or not:
 * the paid cards' places are the interleave's, at `SPONSOR_EVERY`, and a
 * sponsored card left in the ordinary stream would be a paid card in an
 * unpaid place — and a non-matching one is offered to nobody rather than
 * moved.
 */
export function partitionSponsored<T extends SponsoredQ>(
  pool: readonly T[],
  anchors: Readonly<Record<string, string>>,
  utcDay: number,
  ads: readonly FeedAd[] = [],
  today = "",
): { paid: PaidItem<T>[]; rest: T[] } {
  const paid = orderPaid(pool, ads, anchors, utcDay, today);
  const rest = pool.filter((q) => !q.sponsor);
  return { paid, rest };
}

/**
 * The window label — "until 21 Aug", composed from `until` rather than
 * authored beside it.
 *
 * One value, so the sentence the card prints and the filter that stops
 * serving the card cannot disagree. Returns null for a question with no
 * window, which `check:content` refuses for a sponsored one — so a null
 * here means a bank that predates the gate, and the band simply says less.
 */
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function windowLabel(until: string | undefined): string | null {
  if (!until || !/^\d{4}-\d{2}-\d{2}$/.test(until)) return null;
  const d = new Date(`${until}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return `until ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
}
