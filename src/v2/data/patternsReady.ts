// When the Patterns tab may be OFFERED (D265), and the numbers behind the
// word "hidden".
//
// D217 took the tab out of the v1 release by unmounting it, and left the
// nightly fit running so the remount would "ship against live loadings on
// day one instead of an empty screen". This module is what turns that
// sentence into a condition the tree can hold: the tab is absent from the
// bar until the fit has published enough to draw, and appears on its own
// when it has. Nobody flips a flag.
//
// The same argument `data/gamesReady.ts` makes for the reading game
// (D196), pointed at a different feature: the lenses already refuse what
// they cannot draw one item at a time — the Oracle will not guess against
// a vector fitted on fewer than 8 answers, People will not place a
// stranger on fewer than `PEOPLE_MIN_SHARED` shared ones (4, and a third
// of the fetched crowd where that is more), say()/tell() state a basis of
// 12 or say nothing. What none of them can refuse is the CORPUS. A map of
// four questions is four dots and a claim about a population; an Oracle
// with nothing worth asking is a lens that opens on its own apology. So
// the gate is those refusals one level up, and below it the tab is not
// there at all — no teaser, no "coming soon", no third button that opens
// onto "No patterns yet". A tab that announces a feature it cannot serve
// is worse than one that is simply not there yet.
//
// THIS IS NOT A PRIVACY FLOOR, and it has the shape of one, so: nothing
// is withheld from anybody. Every number these lenses read publishes
// exactly and at any size (D98), and the tab's own empty states are
// honest rather than coy. What is withheld is the TAB, until what it
// draws can be believed.
//
// The verdict is pure — no Firebase, no window, no clock — and its two
// inputs arrive from live.ts: one published by the nightly fit onto
// `v2_meta/app` (a document `hydrate()` already reads, so the gate costs
// no read at all), one folded from the votes the device already holds.
// `patternsEarned` at the foot is the one impure thing here, and it is
// one localStorage boolean; the reasoning for it is with it.
import { isCore } from "./deck";

/**
 * The published basis the gate insists the crowd number was counted at.
 *
 * The SERVER owns the floor — `functions/src/patternsFit.ts` counts the
 * questions whose loading rests on at least `PATTERNS_MIN_BASIS` answers
 * and publishes both the count and the floor it used. This constant is
 * the client's half of that handshake: a fit that ever counted on a
 * looser floor is publishing a weaker claim than this gate is about, and
 * the gate stays shut rather than opening on it. That is why the basis
 * travels with the count instead of being assumed — two copies of a
 * number in two deployables drift, and the one that drifts silently is
 * the one nobody reads back.
 *
 * 8 is the Oracle's own `nextAsk(minBasis)`: the point where a fitted
 * vector is worth reading as a prediction rather than as noise.
 */
export const PATTERNS_MIN_BASIS = 8;

/**
 * Questions that must carry such a basis before the tab appears.
 *
 * 24, and the number is derived rather than chosen: the fit is
 * `PATTERNS_K = 8` dimensional, so 24 is three questions per latent
 * dimension. Below roughly that, the plane the Map draws is a picture of
 * the fit's own axes rather than of anything the questions did — the
 * first two factors of a handful of 8-vectors separate whatever they
 * happen to separate, and the archipelago pass then draws communities in
 * it with a straight face. It is an honesty number, not a difficulty
 * one: raising it makes the tab arrive later and mean more on arrival,
 * lowering it makes the first map a shape somebody could reasonably
 * disbelieve.
 *
 * For scale: the eligible corpus is 111 questions today (two-option
 * daily plus core feed, `PATTERNS_QIDS`), so this is roughly a fifth of
 * everything the fit can ever fold.
 */
export const PATTERNS_MIN_POOL = 24;

/**
 * The viewer's own answers among those questions, before the tab appears.
 *
 * 8 = `PATTERNS_K`, and that is the whole reasoning. The viewer's latent
 * vector is a ridge solve over the loadings of the questions they have
 * answered (`estimateTheta`, λ = 0.5, K = 8): with fewer observations
 * than dimensions, θ cannot leave the span of those few loadings and the
 * ridge holds the rest at zero. The People lens draws that as you sitting
 * near the middle of the crowd, under a note that says *"You sit wherever
 * your answers put you, not at the centre"* — and the Oracle seals a
 * guess that is really the crowd's margin wearing your name. Both are the
 * lens saying something it does not know.
 *
 * The crowd half of this gate is what the owner asked for — the tab
 * appears when the APP has the data. This half is the same sentence from
 * the viewer's seat, and it is the cheaper of the two to satisfy: eight
 * answers is a sitting, not a season.
 */
export const PATTERNS_MIN_MINE = 8;

/** The one shape a question needs for the fit's eligibility rule. */
export interface PatternsEligible {
  surface: string;
  core?: boolean;
  active?: boolean;
  options?: readonly unknown[];
}

/**
 * The fit's own pool rule, client-side: two options (the engine is one
 * bit per question), and CORE ONLY (D161) — the daily bank is core by
 * construction, a feed question only if it says so, through `isCore()`
 * rather than by reading the raw flag, which is feed-only.
 *
 * A restatement of `PATTERNS_QIDS` in `functions/src/patterns.ts` rather
 * than an import of it, because the two packages do not share a build.
 * It is deliberately NARROWER than the fit's, in two ways the fit has no
 * equivalent of: this rejects a retired question, and the bank it walks
 * has already dropped retired feed questions and expired windows. Five of
 * the questions the fit folds are `active: false` today, so the device
 * can see all but those five.
 *
 * Narrower is the safe direction for the number this feeds — it
 * under-counts, so the gate opens an answer or two LATE rather than
 * early. What it is not safe for is recomputing the verdict on every
 * launch, because the count can then FALL when a question is retired.
 * That is what `patternsEarned` below exists to stop, and the two have to
 * be read together.
 */
export function patternsEligible(q: PatternsEligible): boolean {
  if (q.active === false) return false;
  if ((q.options || []).length !== 2) return false;
  if (q.surface !== "daily" && q.surface !== "feed") return false;
  return isCore(q);
}

/** What the gate reads. Both default to nothing published and nothing answered. */
export interface PatternsSignal {
  /** Questions the fit published at `basis` or better — `v2_meta/app`. */
  pool?: number;
  /** The floor that count was taken at — published beside it. */
  basis?: number;
  /** The viewer's answers among eligible questions — device-side, free. */
  mine?: number;
}

/**
 * Whether the Patterns tab may be offered at all.
 *
 * Both halves, and the AND is the point: a fit fat enough to draw and a
 * viewer with enough answers to be drawn in it. Either alone puts a lens
 * on screen that has to apologise for one of its two axes.
 *
 * The thresholds are arguments so a test can pin the verdict rather than
 * the constant, and so raising one is a one-line change with a reason
 * beside it rather than an edit spread across three call sites.
 */
export function patternsReady(
  signal: PatternsSignal,
  minPool = PATTERNS_MIN_POOL,
  minMine = PATTERNS_MIN_MINE,
  minBasis = PATTERNS_MIN_BASIS,
): boolean {
  const pool = signal.pool ?? 0;
  const basis = signal.basis ?? 0;
  const mine = signal.mine ?? 0;
  return basis >= minBasis && pool >= minPool && mine >= minMine;
}

/** Where the crossing is remembered — swept with every other insight.*
 * key by purgeLocalTrace, and the app-shell hook drops its own copy on
 * the purge event without writing it back (check:purge). Exported so a
 * test can put a device back to never-having-earned-it: nothing else in
 * the app writes or reads this key by name. */
export const PATTERNS_EARNED_KEY = "insight.patterns.earned.v1";
const LS = PATTERNS_EARNED_KEY;

/**
 * The gate as the shell asks it: has this account EVER met the floor?
 *
 * `patternsReady` answers about right now; this answers about the
 * account, and the difference is not comfort. `mine` counts answers
 * against the bank the device is holding, and a question can leave that
 * bank — `active: false` is what the question farm's scorecard proposes
 * for a landslide, which is precisely a question most people have already
 * answered. Recomputed from scratch every launch, retiring one could take
 * the tab back off somebody who had it yesterday, while the fit's own
 * count (which never prunes a loading) had not moved at all. A tab that
 * comes and goes is worse than one that arrives late.
 *
 * So the crossing is written down once. Reading a stale `true` is safe by
 * construction: it says this account cleared the floor, which is a fact
 * about its past, and the tab's own lens floors still hold the present.
 * Erasing it is the purge's job — the `insight:local-purge` listener at
 * the foot of this module, so a uid change hands the next account a
 * gate it has to earn for itself.
 *
 * Best-effort storage on purpose: a browser that refuses localStorage
 * gets the un-remembered gate, which is the old behaviour and still
 * correct — just recomputed every launch.
 *
 * The write happens inside a read, including the one the shell makes
 * while rendering. That is safe rather than convenient: what it records
 * is that the signal passed, which stays true whether or not React keeps
 * the render it happened in.
 */
export function patternsEarned(signal: PatternsSignal): boolean {
  try {
    if (localStorage.getItem(LS) === "1") return true;
  } catch { /* private mode, or no storage — fall through to the live read */ }
  if (!patternsReady(signal)) return false;
  try { localStorage.setItem(LS, "1"); } catch { /* in-memory truth is still right */ }
  return true;
}

// The purge (D51): the crossing is account state, so it goes with the
// account. `purgeLocalTrace`'s prefix sweep has already taken the key by
// the time this fires — this is here because a module that persists an
// `insight.*` key should not be depending on somebody else's sweep
// continuing to cover it, and because there is a real write-back path to
// close: `patternsEarned` re-writes the key whenever the live signal
// still passes. It cannot on this path (`resetForNewUid` empties the vote
// mirror first, so `mine` is 0), and this makes that a fact about the
// module rather than about the order of two functions in another one.
//
// Nothing in-memory to drop here — every read hits storage. The shell's
// own copy of the answer (`usePatternsTab`'s state) has its own arm on
// the same event, which is where the React state lives.
try {
  window.addEventListener("insight:local-purge", () => {
    try { localStorage.removeItem(LS); } catch { /* best-effort */ }
  });
} catch { /* no window — the pure half of this module still loads */ }
