// Stated topic preferences — "more of this", "less of this" (D128, tier 1
// of docs/ATTENTION.md).
//
// WHAT THIS IS NOT, and the distinction is the whole reason it can exist.
// It is not engagement scoring, not a funnel, and not an inferred model.
// Nothing here watches what you scroll past or how long you look. A weight
// changes because you TAPPED something that said it would change it, and
// for no other reason.
//
// That matters because inferred behavioural preference IS refused —
// docs/MONITORING.md § "Off the table" lists per-user content selection
// and skip/pass rates, and data-inventory.md says no product analytics
// ship. A stated preference crosses none of those: it is the same kind of
// datum as the city in your profile, given deliberately, and it collects
// nothing about anybody.
//
// It is also the BETTER signal, which is why the plan starts here rather
// than settling here. One deliberate tap outweighs a hundred ambiguous
// scrolls: it needs no dwell threshold, no seen-denominator, and no
// argument about whether scrolling past meant dislike or meant the bus
// arrived. If people use this, most of tiers 2 and 3 is redundant — and
// finding that out is cheaper than building the model that guesses.
//
// LOCAL ONLY, same as data/mutes.ts and for the same reason: a preference
// is the viewer's, not a claim about anyone, so it writes no document and
// is invisible to everyone. The cost is that it does not follow you to a
// second device, which is the honest trade for collecting nothing.
//
// WHERE IT MAY BE APPLIED, and this is a hard limit rather than a scope
// note. The feed, and only the feed. Not the daily question and not the
// Mirror — one blind question a day, the same one for everyone, is the
// thesis, and a Mirror weighted toward the cohorts you like is a filter
// bubble wearing a Mirror's clothes. `interests.test.ts` asserts the
// surfaces that are allowed to read this.

const LS = "insight.topicInterest.v1";

/**
 * A stated weight. Three states rather than a slider, because the states
 * are what a person can actually mean about a topic — and because a
 * number invites the app to start adjusting it, which is tier 2.
 */
export type Interest = -1 | 0 | 1;

export const MUTED: Interest = -1;
export const NEUTRAL: Interest = 0;
export const MORE: Interest = 1;

/** Copy for each state, so the panel and the card agree. */
export const INTEREST_LABEL: Record<string, string> = {
  "-1": "Less",
  "0": "Normal",
  "1": "More",
};

function load(): Record<string, Interest> {
  try {
    const v = JSON.parse(localStorage.getItem(LS) || "{}");
    if (!v || typeof v !== "object") return {};
    const out: Record<string, Interest> = {};
    for (const k of Object.keys(v)) {
      const n = Number(v[k]);
      // Anything that is not one of the three states is dropped rather
      // than clamped: a stored 0.7 came from a version that meant
      // something else, and guessing which way to round it is inventing
      // a preference the user never stated.
      if (n === -1 || n === 0 || n === 1) out[k] = n as Interest;
    }
    return out;
  } catch {
    return {};
  }
}

let weights = load();
const listeners = new Set<() => void>();

function fire(): void {
  listeners.forEach((f) => { try { f(); } catch { /* one listener throwing must not stop the rest */ } });
}

function save(): void {
  try { localStorage.setItem(LS, JSON.stringify(weights)); } catch { /* best-effort */ }
  fire();
}

/** The stated weight for a topic — NEUTRAL when nothing was ever said. */
export function interestIn(topic: string): Interest {
  return weights[topic] ?? NEUTRAL;
}

/**
 * State a preference. Setting NEUTRAL DELETES the key rather than storing
 * a zero, so "I turned this back to normal" and "I never said anything"
 * are the same state — which they are, and storing them differently would
 * let the panel show a topic as touched when the user had undone it.
 */
export function setInterest(topic: string, w: Interest): void {
  if (!topic) return;
  if (w === NEUTRAL) {
    if (!(topic in weights)) return;
    delete weights[topic];
  } else {
    if (weights[topic] === w) return;
    weights[topic] = w;
  }
  save();
}

/** Every topic the user has actually said something about. */
export function statedInterests(): Record<string, Interest> {
  return { ...weights };
}

/** True once anything has been stated — the panel's "you have set nothing" cue. */
export function hasStated(): boolean {
  return Object.keys(weights).length > 0;
}

/** Forget every stated preference. */
export function resetInterests(): void {
  if (!Object.keys(weights).length) return;
  weights = {};
  save();
}

export function subscribeInterests(f: () => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}

/**
 * Apply stated preferences to a feed pool.
 *
 * MUTED topics are dropped. MORE topics are moved forward — but the
 * ordering is a STABLE partition, not a sort by weight, so cards keep
 * their existing relative order inside each group. A comparator on the
 * weight would let a preference silently re-rank the whole pool, and the
 * pool's own order is already carrying meaning (freshness, the lens-card
 * cadence) that a preference has no business overwriting.
 *
 * A card with no topic is treated as NEUTRAL and always survives: an
 * untagged card is not evidence of anything, and dropping it would let a
 * content bug read as a user preference.
 */
export function applyInterests<T>(
  items: readonly T[],
  topicOf: (item: T) => string | null | undefined,
): T[] {
  const more: T[] = [];
  const rest: T[] = [];
  for (const it of items) {
    const t = topicOf(it);
    const w = t ? interestIn(t) : NEUTRAL;
    if (w === MUTED) continue;
    (w === MORE ? more : rest).push(it);
  }
  return more.concat(rest);
}

// D51: every local store hears the purge. Notify without save() — saving
// would re-create the key the wipe just removed.
if (typeof window !== "undefined") {
  window.addEventListener("insight:local-purge", () => {
    weights = {};
    fire();
  });
}
