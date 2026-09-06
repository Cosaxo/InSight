// The political consent record (D331), and the one predicate everything
// else asks.
//
// WHAT THIS GATES, AND IT IS NOT THE CARDS. The visible half of "politics
// in this app" is 14 questions carrying the political marker, out of the
// 487 on the daily and the feed, and they are ordinary public answers
// like every other. (It said "ten out of 278" — both numbers had moved,
// and the second was already wrong when it was written. They are
// check:figures' now, counted off the bank.) The half
// that needed a decision is derived and invisible: `syncPassiveResults`
// (data/live.ts) folds ordinary feed answers into `testResults.political`
// and writes a six-axis political coordinate onto the WORLD-READABLE
// profile — `MIN_AXIS_ITEMS = 2` over six axes, so roughly a dozen feed
// cards produce a published political position, with no act by the user
// and no screen that ever said so.
//
// So the toggle governs whether that coordinate is COMPUTED AND
// PUBLISHED, never whether it is drawn. A switch that hid a value still
// sitting world-readable on the profile would be the D327 failure exactly
// — a surface saying something the server does not do — and it would also
// not be the thing the owner's legal answer asked for, which is a control
// over the result being out there rather than over the viewer's own sight
// of it.
//
// PURE ON PURPOSE. No Firebase, no window, no clock — the caller passes
// `now`. That is what lets the whole matrix be tested without mocks, the
// data/cohort.ts posture, and it is why the withdrawal branch below can be
// asserted rather than argued about.

/**
 * The stored record. Lives at `v2_users/{uid}.consent.political`, on the
 * profile document `hydrate()` already fetches — so asking this question
 * costs no extra read anywhere.
 */
export interface PoliticalConsent {
  /** The version of the ASK that was agreed to. */
  v: number;
  /** When it was given, epoch ms. */
  at: number;
  /**
   * When it was withdrawn. PRESENT-OR-ABSENT, never a boolean.
   *
   * A boolean would mean every document written before the field existed
   * carries neither `true` nor `false`, and a `where("off","==",false)`
   * filter drops all of them — the absence-shaped bug this repo has now
   * shipped twice (D258's missing surfaces, D328's missing index
   * exemption). Absence here means one thing only: never withdrawn.
   */
  off?: number;
}

/**
 * The version of the ask itself.
 *
 * Bump it when the WORDS materially change what is being agreed to, and
 * everyone who agreed to the old wording is asked again — their old
 * record stays on the document as the evidence that they once did.
 * Cosmetic edits do not bump it; a new consequence in the list does.
 */
export const POLITICAL_CONSENT_VERSION = 1;

/** The shape of the profile fragment this module reads. */
export interface ConsentCarrier {
  consent?: { political?: unknown };
}

/** The stored record, or null when there is none / it is unreadable. */
export function readPoliticalConsent(profile: unknown): PoliticalConsent | null {
  const raw = (profile as ConsentCarrier | null | undefined)?.consent?.political;
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.v !== "number" || typeof r.at !== "number") return null;
  const off = typeof r.off === "number" ? r.off : undefined;
  return off === undefined ? { v: r.v, at: r.at } : { v: r.v, at: r.at, off };
}

/**
 * May this account's political coordinate be computed and published?
 *
 * Three ways to be false, and they are deliberately indistinguishable to
 * every caller — the coordinate is either allowed or it is not:
 *   · never asked (no record) — the default, and it is OFF;
 *   · asked and declined, or later withdrawn (`off` present);
 *   · agreed to a version of the ask that no longer describes what
 *     happens (`v` behind), which is a re-ask rather than a refusal but
 *     must not keep publishing in the meantime.
 *
 * DEFAULT OFF is the whole design. A default of on would mean the window
 * between install and answering is a window in which the app publishes a
 * political position nobody agreed to — which is the state this record
 * exists to end, not a smaller version of it.
 */
export function mayPublishPolitical(profile: unknown): boolean {
  const c = readPoliticalConsent(profile);
  if (!c) return false;
  if (c.off !== undefined) return false;
  return c.v >= POLITICAL_CONSENT_VERSION;
}

/**
 * Has this account answered the CURRENT ask at all?
 *
 * Distinct from `mayPublishPolitical`, and the difference is what the
 * setup screen and the account row need: a decline is an answer and must
 * not be re-asked, while a stale version must be. `false` means "ask".
 */
export function hasAnsweredPoliticalAsk(profile: unknown): boolean {
  const c = readPoliticalConsent(profile);
  return !!c && c.v >= POLITICAL_CONSENT_VERSION;
}

/**
 * The record to write for a decision.
 *
 * A decline and a withdrawal produce the same shape — `at` is when the
 * question was answered, `off` when the answer became no. For a decline
 * they are the same instant, and that is correct rather than sloppy:
 * "agreed at T, not in force since T" is a true account of somebody who
 * said no, and it keeps ONE branch here instead of two.
 *
 * The record is kept on withdrawal rather than deleted, because Art. 7(1)
 * accountability wants the controller able to show that consent was
 * obtained and when it ended. Deleting the row would destroy exactly the
 * evidence that the withdrawal was honoured.
 */
export function politicalConsentRecord(on: boolean, now: number): PoliticalConsent {
  return on
    ? { v: POLITICAL_CONSENT_VERSION, at: now }
    : { v: POLITICAL_CONSENT_VERSION, at: now, off: now };
}

/**
 * Turning it off must also REMOVE what was already published.
 *
 * This is the half a display toggle skips, and skipping it is what would
 * make the control a lie: a coordinate written last week is still on a
 * world-readable profile until something deletes it. The caller writes
 * the consent record and this deletion in the same operation.
 */
export const POLITICAL_RESULT_KEY = "political";
