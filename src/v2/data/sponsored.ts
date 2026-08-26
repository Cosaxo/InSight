// Sponsored questions in the feed (D195) — which one is offered, why, and
// the sentences the disclosure band prints.
//
// A sponsored question is an ORDINARY question. It aggregates through the
// same trigger, publishes the same exact split, takes the same answers and
// shows the same who-voted sheet. What a sponsor buys is a SLOT and a
// WINDOW, and the four things that follow are the whole of what makes that
// safe to sell:
//
//   1. ONE AT A TIME. `SPONSOR_SLOT` is a cap on inventory, not a
//      preference. "A feed with two is a feed for sale"
//      (design/standalone-v24/paid-data.js), and a cap that can be
//      inflated is not a cap — so the pick below returns at most one card,
//      whatever the bank holds.
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
}

/**
 * How many sponsored cards may be in the feed at once.
 *
 * One. Written as a constant rather than as `[0]` so the number is
 * greppable and a change to it is visible in a diff — this is the unit of
 * sale (docs/SCALE-PLAN.md §5: naming the cap is what stops inventory
 * being quietly inflated without visibly devaluing what was already sold).
 */
export const SPONSOR_SLOT = 1;

/** Where the one sponsored card sits in the stream, counted in world cards. */
export const SPONSOR_AT = 6;

export type SponsoredQ = QuestionDoc & { id: string; sponsor?: Sponsor };

/**
 * Does this device's own profile match the tag the question was bought
 * against?
 *
 * An untagged question matches everyone. A tagged one matches only an
 * exact bucket equality — no ranges, no "near", no inference. The whole
 * vocabulary is the published breakdown dims, which is to say the cohorts
 * a user can already see themselves counted in; profession (never a dim,
 * D8) and the politics result (Art. 9) are excluded by that fact alone
 * rather than by a rule of their own.
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
 * The one sponsored card to offer, or null.
 *
 * Rotates by UTC day across the eligible ones. Rotation rather than "the
 * first" for a reason that is about the seller as much as the reader: with
 * two buyers in the same window, first-in-bank-order would give one of them
 * every impression and the other none, which is inventory nobody could
 * price. The day index makes the share equal and the schedule computable
 * in advance — which is exactly what lets a slot be SOLD without any
 * per-impression telemetry (docs/SCALE-PLAN.md §5).
 *
 * The caller has already filtered expired questions (`until`, live.ts) and
 * inactive ones, so eligibility here is: it is sponsored, and it matches.
 */
export function pickSponsored<T extends SponsoredQ>(
  pool: readonly T[],
  anchors: Readonly<Record<string, string>>,
  utcDay: number,
): T | null {
  const eligible = pool.filter((q) => q.sponsor && matches(q.sponsor, anchors));
  if (!eligible.length) return null;
  // Sorted by id so the rotation is a property of the bank rather than of
  // whatever order the pages happened to arrive in.
  const sorted = [...eligible].sort((a, b) => a.id.localeCompare(b.id));
  // `% length` on a negative day index would return a negative slot; the
  // day index is derived from the epoch and cannot be negative today, and
  // the `+ length` makes that a fact rather than an assumption.
  const i = ((utcDay % sorted.length) + sorted.length) % sorted.length;
  return sorted[i];
}

/** One feed ad (D197) — text, an advertiser, a window. Never a question.
 * `from` joined with D315: a committed ad's window opens at seed time so
 * it never carries one, but a self-serve ad QUEUES behind the scope's
 * running ad (paid.ts adStartDay) and must not serve before its day. */
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
 * What the single paid slot is holding, if anything.
 *
 * A discriminated union rather than two separate slots, because the CAP
 * is the product: one paid thing in the feed, whichever kind it is. Two
 * slots would be two paid cards with extra words on top.
 */
export type PaidSlot<T> =
  | { kind: "question"; question: T }
  | { kind: "ad"; ad: FeedAd }
  | null;

/**
 * Pick the one paid item, across BOTH kinds.
 *
 * Sponsored questions and ads compete for the same slot and rotate
 * together by day, so a week with one of each gives them alternate days
 * rather than giving the question every day because questions were
 * checked first. The combined pool is sorted by id for the same reason
 * the question-only pool was: the rotation should be a property of what
 * was bought, not of which query returned first.
 */
export function pickPaid<T extends SponsoredQ>(
  questions: readonly T[],
  ads: readonly FeedAd[],
  anchors: Readonly<Record<string, string>>,
  utcDay: number,
  today = "",
): PaidSlot<T> {
  const eligibleQs = questions.filter((q) => q.sponsor && matches(q.sponsor, anchors));
  const eligibleAds = ads.filter((a) =>
    a.active !== false
    // An ad's window is enforced HERE as well as by the seed, because the
    // pool is cached on the device: a session that outlived the last day
    // of a campaign would otherwise keep serving it. Questions get the
    // same filter one layer up, in live.ts's bank build. Both ends since
    // D315: a queued self-serve ad carries `from` and must not serve
    // before its scheduled day — that day-exclusivity is what its flat
    // price bought.
    && (!today || !a.until || a.until >= today)
    && (!today || !a.from || a.from <= today)
    && matches({ buyer: a.advertiser, audience: a.audience }, anchors));
  const pool: Array<{ id: string; slot: PaidSlot<T> }> = [
    ...eligibleQs.map((q) => ({ id: q.id, slot: { kind: "question" as const, question: q } })),
    ...eligibleAds.map((a) => ({ id: a.id, slot: { kind: "ad" as const, ad: a } })),
  ].sort((x, y) => x.id.localeCompare(y.id));
  if (!pool.length) return null;
  const i = ((utcDay % pool.length) + pool.length) % pool.length;
  return pool[i].slot;
}

/** Split a feed pool into the sponsored card and everything else. */
export function partitionSponsored<T extends SponsoredQ>(
  pool: readonly T[],
  anchors: Readonly<Record<string, string>>,
  utcDay: number,
  ads: readonly FeedAd[] = [],
  today = "",
): { sponsored: T | null; ad: FeedAd | null; rest: T[] } {
  const slot = pickPaid(pool, ads, anchors, utcDay, today);
  const sponsored = slot?.kind === "question" ? slot.question : null;
  const ad = slot?.kind === "ad" ? slot.ad : null;
  // EVERY sponsored question leaves the ordinary stream, not just the one
  // that was picked. Otherwise the cap is decorative: three bought cards
  // would still be three cards in the feed, one of them merely labelled
  // first.
  const rest = pool.filter((q) => !q.sponsor);
  return { sponsored, ad, rest };
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
