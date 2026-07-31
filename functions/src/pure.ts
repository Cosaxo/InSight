// insight-functions/pure.ts — pure computational helpers.
//
// Everything in this module is deterministic given its inputs: no
// firebase imports, no I/O, no ambient randomness (byte sources and
// clocks come in as parameters). That's what makes these testable
// without an emulator — see pure.test.ts.

// ── invite codes (v2social) ─────────────────────────────────────

// Unambiguous invite alphabet (no 0/O/1/I/L).
export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

// Map 8 caller-supplied random bytes onto the alphabet. The byte
// source is a parameter (randomBytes in production, a stub in tests)
// so the mapping itself stays pure.
export function inviteCodeFromBytes(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < 8; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

// ── day-key arithmetic (v2social) ───────────────────────────────

export function utcDayKey(offsetDays = 0, nowMs: number = Date.now()): string {
  const d = new Date(nowMs + offsetDays * 86400000);
  return d.toISOString().slice(0, 10);
}

export function prevDayKey(dayKey: string): string {
  const d = new Date(dayKey + "T00:00:00Z");
  return new Date(d.getTime() - 86400000).toISOString().slice(0, 10);
}

// ── the pending-day marker (v2social) ───────────────────────────
//
// `v2_groups/{gid}.pendingDays` is the set of day keys this group has at
// least one duel answer for and no reveal yet. onV2AnswerCreated adds to it
// (arrayUnion); the reveal scan removes a day once it has settled it, either
// by publishing the reveal or by deciding the day did not clear the bar.
//
// It exists so the scheduled scan can ask an INDEXED question — "which
// groups played yesterday?" — instead of reading every group document 12
// times a day to find the few that did. It also replaces the older
// `lastCheckedDay` skip-marker outright, and that is the bigger win: the
// marker needed a compensating delete from the answer trigger, whose
// correctness rested on a specific commit ordering between two writers.
// arrayUnion has no such ordering problem — a late answer re-adds the day
// whatever else is happening, so the day re-opens by construction rather
// than by argument.
//
// How many days to keep. firestore.rules refuses a duel answer for a day
// more than 4 days behind request.time, so a pending day older than that can
// never gain another answer and will never settle. 6 is that bound plus
// headroom for the UTC-vs-local skew the rules' forward window allows.
export const PENDING_DAYS_KEEP = 6;

// The next pendingDays array: `settledDay` dropped, anything older than
// `oldestKeptDay` dropped, duplicates and non-strings dropped. Day keys are
// ISO `YYYY-MM-DD`, so a lexicographic compare is a chronological one.
//
// Pure, and separately tested, because the failure it prevents is silent:
// an array that only ever grows turns a duo whose partner never plays into a
// group document that accretes one string per day forever.
export function prunePendingDays(
  current: unknown,
  settledDay: string,
  oldestKeptDay: string,
): string[] {
  if (!Array.isArray(current)) return [];
  const out: string[] = [];
  for (const d of current) {
    if (typeof d !== "string") continue;
    if (d === settledDay) continue;
    if (d < oldestKeptDay) continue;
    if (!out.includes(d)) out.push(d);
  }
  return out;
}

// ── reveal conditions + streaks (v2social) ──────────────────────

// The two reveal conditions (decision D5):
//   group · at least one member answered
//   duo   · both-or-nothing — both members must have played
export function shouldReveal(mode: string, played: number): boolean {
  return mode === "duo" ? played >= 2 : played >= 1;
}

// A streak extends only when the previous reveal was for the day
// immediately before this one; any gap resets to 1.
export function nextStreak(
  lastRevealDay: string | null | undefined,
  dayKey: string,
  currentStreak: number,
): number {
  return lastRevealDay === prevDayKey(dayKey) ? currentStreak + 1 : 1;
}

// ── k-anonymity gate (v2) ───────────────────────────────────────

// The k-floor decision in one place: a bucket is publishable only at
// or above its floor. Buckets below it are dropped (or deleted).
// Sole caller is publishableBreakdown below, since D13 removed the v1
// geo aggregates this was also shared with — kept separate anyway, so
// the floor stays one named decision rather than an inline `>=`.
export function meetsKFloor(count: number, floor: number): boolean {
  return count >= floor;
}

// ── per-anchor breakdowns (v2) ──────────────────────────────────
//
// "How did every kind of person split?" — the same question the world
// aggregate answers, asked one demographic slice at a time.
//
// Two hard constraints shape everything below.
//
// 1. DOCUMENT GROWTH. The counts live inside the existing
//    v2_aggs_private/{qid} document rather than new per-dimension docs, so
//    D7's ~1-write-per-second-per-document ceiling does not move. That only
//    holds if the document cannot grow without bound — so breakdowns are
//    restricted to low-cardinality anchors, and each dimension is capped at
//    BREAKDOWN_MAX_BUCKETS distinct values. `profession` is deliberately
//    excluded: it is free text up to 80 chars, so every distinct spelling
//    would mint a key forever.
//
//    `city` was excluded for that same reason until D9 replaced the profile's
//    free-text city and country boxes with a picker over a fixed catalogue of
//    10,929 places. Its values are now drawn from a closed vocabulary
//    ("Oslo, NO"), every one of them verified at build time to fit
//    BREAKDOWN_MAX_LABEL and to survive breakdownBucket — see
//    scripts/check-cities.mjs. The bucket cap still applies and matters more
//    here than anywhere else: a global question can touch far more than 24
//    cities, so the long tail degrades rather than the dimension freezing.
//
//    `country` was NEVER safe under the old scheme and shipped anyway — as
//    free text it split "Norway"/"norway"/"NO" into three sub-floor cohorts
//    and published none of them. It now carries the ISO code derived from
//    the picked city, which is why that dimension starts working at all.
//
// 2. K-ANONYMITY THAT SURVIVES SUBTRACTION. Suppressing buckets below the
//    floor is not sufficient on its own. If a dimension has exactly one
//    suppressed bucket and a reader knows the dimension's total, that bucket
//    is recoverable by subtracting the published ones — the floor would be
//    decorative. publishableBreakdown therefore applies COMPLEMENTARY
//    SUPPRESSION: if suppressing the sub-floor buckets would leave exactly one
//    hole, the smallest surviving bucket is suppressed too, so there are always
//    either zero holes or at least two. Standard practice in statistical
//    disclosure control, and the reason this is a pure function with its own
//    tests rather than three lines inside the trigger.
//
//    WHAT THE FLOOR DOES NOT DO, stated here because the wording used to
//    imply otherwise. The unit the floor applies to is the BUCKET — the sum
//    of a bucket's per-option counts. It is not applied per option. So a
//    bucket published at exactly the floor can still carry a lopsided split:
//    { "Oslo, NO": { "0": 4, "1": 1 } } says in as many words that exactly
//    one of the five Oslo answers chose option 1.
//
//    That is k-anonymity behaving as specified rather than a hole in it. The
//    floor protects IDENTIFICATION — no cohort is small enough to name a
//    person — and does not protect ATTRIBUTE counts inside a cohort that
//    clears it. Recovering whose answer the "1" is still requires knowing the
//    other four, which is the same collusion bound D7 records for the publish
//    cadence.
//
//    It is also not separately fixable here, which is why it is recorded
//    rather than engineered around. The plain `counts` published alongside
//    have exactly the same property at the same floor (a question at total 5
//    splitting 4/1 discloses one person's option globally), so a per-option
//    floor would have to apply there too — and a per-option floor means a
//    4-option question needs ~20 answers per city before any of it renders,
//    with the surviving options no longer summing to the bucket total. That
//    trades the product's one job, showing the split, for a bound the floor
//    was never claiming. See D18 for the arithmetic.

// Anchors coarse enough to bucket. Order is the display order.
export const BREAKDOWN_DIMS = [
  "ageBand",
  "gender",
  "city",
  "country",
  "education",
  "relationship",
] as const;
export type BreakdownDim = (typeof BREAKDOWN_DIMS)[number];

// Per-dimension distinct-value cap. 6 dims x 24 buckets x up to 20 options is
// ~2.9k integers worst case — tens of KB against Firestore's 1 MiB limit,
// with room for the plain counts alongside.
export const BREAKDOWN_MAX_BUCKETS = 24;
// Bucket labels are stored as map keys; anything longer is a free-text field
// that slipped through and should not be minting keys.
export const BREAKDOWN_MAX_LABEL = 40;

// Dimensions whose values come from a closed vocabulary get their shape
// checked here as well as at the source.
//
// The bucket cap is first-come-first-served, so 24 junk values arriving
// early would crowd out every real one for that question — and anchors are
// written by the CLIENT onto its own answer doc, where firestore.rules can
// only enforce a length. Anyone could mint 24 nonsense cities and blank the
// dimension for everybody. Shape-checking `city` closes that, and it also
// keeps the free text sitting in pre-D9 profiles ("oslo", "Oslo, Norway")
// from competing for slots with the catalogue values.
//
// The other dimensions are short fixed lists chosen from <select>s; a bogus
// value there costs one suppressed sub-floor bucket, not the dimension.
const BREAKDOWN_DIM_SHAPE: Partial<Record<BreakdownDim, RegExp>> = {
  // "Oslo, NO" — a catalogue name and an ISO 3166-1 alpha-2 code. Must
  // agree with placeKey() in src/v2/data/places.ts.
  city: /^.+, [A-Z]{2}$/,
  // ISO 3166-1 alpha-2, derived client-side from the picked city.
  country: /^[A-Z]{2}$/,
};

export type BreakdownCounts = Record<string, Record<string, Record<string, number>>>;

// A bucket label Firestore can hold as a map key, or null to skip. Rejects
// the empty string, over-long values, and the dotted/slashed forms that are
// awkward as field paths. With a dim, also rejects anything outside that
// dimension's vocabulary shape.
export function breakdownBucket(value: unknown, dim?: BreakdownDim): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v || v.length > BREAKDOWN_MAX_LABEL) return null;
  if (/[./[\]*~]/.test(v)) return null;
  const shape = dim && BREAKDOWN_DIM_SHAPE[dim];
  if (shape && !shape.test(v)) return null;
  return v;
}

// Fold one answer's anchors into the running breakdown. Mutates and returns
// `into` so the trigger can keep this inside its existing transaction.
export function foldAnchors(
  into: BreakdownCounts,
  anchors: unknown,
  optionIdx: number,
): BreakdownCounts {
  if (!anchors || typeof anchors !== "object") return into;
  const src = anchors as Record<string, unknown>;
  for (const dim of BREAKDOWN_DIMS) {
    const bucket = breakdownBucket(src[dim], dim);
    if (bucket === null) continue;
    const byDim = into[dim] || (into[dim] = {});
    // Cap reached and this is a new bucket: drop it rather than grow the
    // document. Existing buckets keep counting, so the cap degrades the
    // long tail rather than freezing the dimension.
    if (!byDim[bucket] && Object.keys(byDim).length >= BREAKDOWN_MAX_BUCKETS) continue;
    const cell = byDim[bucket] || (byDim[bucket] = {});
    const k = String(optionIdx);
    cell[k] = (cell[k] || 0) + 1;
  }
  return into;
}

// A bucket's total across every option — the quantity the floor is applied
// to. Named for the bucket rather than the "cell" this used to say, because
// `cell` was doing duty for both this and the per-option numbers inside it,
// and the two have different guarantees (see constraint 2 above).
function bucketTotal(bucket: Record<string, number>): number {
  let n = 0;
  for (const k of Object.keys(bucket)) n += bucket[k];
  return n;
}

// The publishable view: every bucket whose TOTAL is at or above the floor,
// with complementary suppression so no single bucket is recoverable by
// subtraction. A dimension with nothing left to say is omitted entirely
// rather than published empty.
//
// The per-option counts inside a surviving bucket are published as they
// stand — the floor is a bound on cohort size, not on how lopsided a cohort
// is allowed to be. Constraint 2 above has the reasoning and D18 the
// arithmetic; `publishes a lopsided split inside a bucket at the floor` in
// pure.test.ts pins it so the property stays deliberate.
export function publishableBreakdown(
  by: BreakdownCounts,
  floor: number,
): BreakdownCounts {
  const out: BreakdownCounts = {};
  for (const dim of Object.keys(by)) {
    const buckets = by[dim] || {};
    const rows = Object.keys(buckets).map((b) => ({
      bucket: b,
      total: bucketTotal(buckets[b]),
    }));
    const kept = rows.filter((r) => meetsKFloor(r.total, floor));
    const suppressed = rows.length - kept.length;
    // Exactly one hole is a hole with a name on it — take the smallest
    // survivor down with it so at least two buckets are unknown.
    if (suppressed === 1 && kept.length > 0) {
      let smallest = 0;
      for (let i = 1; i < kept.length; i++) {
        if (kept[i].total < kept[smallest].total) smallest = i;
      }
      kept.splice(smallest, 1);
    }
    // One surviving bucket says "everyone we can show you is in this
    // bucket", which is a population statement, not a split. Two is the
    // minimum that reads as a comparison.
    if (kept.length < 2) continue;
    const dimOut: Record<string, Record<string, number>> = {};
    for (const r of kept) dimOut[r.bucket] = { ...buckets[r.bucket] };
    out[dim] = dimOut;
  }
  return out;
}

// ── when the public mirror may be rewritten ─────────────────────
//
// The k-floor stops a reader recovering an individual's answer from a tiny
// cohort. It does NOT, on its own, stop them recovering one from the
// PUBLISHED DOCUMENT'S HISTORY — and clients hold an onSnapshot on it.
// Rewriting on every answer streams a sequence like
//
//   {0:2, 1:3}  →  {0:2, 1:4}  →  {0:3, 1:4}
//
// where every step is exactly one person's choice, attributable by arrival
// time. Past the floor, that discloses every individual vote regardless of
// how large the cohort grew — which is the floor's whole purpose, defeated
// by the update cadence rather than by the numbers.
//
// So the same k applies to the INCREMENT, not just the total: a publish
// happens only once `every` further answers have landed, and each observed
// delta therefore aggregates that many votes. The document lags by at most
// `every - 1` answers; the private doc keeps the exact running total, so
// nothing is lost.
//
// Residual, stated rather than papered over: this is k-anonymity, so a
// reader who already knows `every - 1` of the votes in a step can infer the
// last one. That is the same bound the floor itself carries, not a new
// weakness — and it needs collusion with almost everyone in the step.
//
// `floor` should be a multiple of `every`, or the first publish waits for
// the next multiple above it. That is safe (it only delays), so it is not
// enforced — but it is why AGG_MIN_N and PUBLISH_EVERY are both 5.
export function shouldPublishAgg(
  total: number,
  floor: number,
  every: number,
): boolean {
  if (total < floor) return false;
  if (every <= 1) return true;
  return total % every === 0;
}

// ─── catalog questions: key validation + the leaderboard fold ───────────
//
// docs/CATALOG-QUESTIONS.md. A catalog answer is one pick from a shipped
// catalogue of ~1,025 entities, stored as the entry's integer key (0 is the
// "Not listed" bucket). A favourite-of-a-thousand has no 52/48 to stage, so
// the reveal is a canon, not a split: the top N entities above the k-floor,
// and ONE "everyone else" bucket covering everything suppressed — which is
// the same complementary-suppression argument as publishableBreakdown,
// pointed at entities instead of demographic cells.

/**
 * How a domain's catalogue defines its key space. Contiguous catalogues
 * (pokedex) need only a ceiling; QID-keyed catalogues (films, artists —
 * D15) are sparse, so membership is the only honest test — a range would
 * admit every integer between two real QIDs, and each junk key an attacker
 * lands mints a bucket in the private doc forever (the document-growth
 * constraint the breakdown cap exists for).
 */
export type CatalogSpec =
  | { max: number }
  | { keys: ReadonlySet<number> };

/**
 * The stored form of a catalog answer's entity, or null to never
 * aggregate. 0 ("Not listed") is valid in every domain. Parameter-pure
 * like meetsKFloor: the specs live in v2.ts (CATALOG_DOMAINS), the
 * committed catalogues are cross-checked against them by
 * scripts/check-pokedex.mjs and scripts/check-catalogs.mjs.
 */
export function catalogEntityKey(value: unknown, spec: CatalogSpec): string | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  if (value < 0) return null;
  if (value !== 0) {
    if ("max" in spec) {
      if (value > spec.max) return null;
    } else if (!spec.keys.has(value)) {
      return null;
    }
  }
  return String(value);
}

export type CanonCounts = Record<string, number>;

/**
 * The publishable leaderboard: entities at or above the floor, capped at
 * topN, everything else folded into `rest`. Null means nothing finer than
 * the total may be published.
 *
 * Three rules beyond the plain floor, each with a reader in mind:
 *
 * - Key "0" ("Not listed") is counted but NEVER enumerated — the moment it
 *   would lead a board, the catalogue is stale, not newsworthy.
 * - Ties at the topN boundary fold entirely: publishing 2 of 4 entities
 *   that share the boundary count would rank equals arbitrarily, and the
 *   arbitrary half would look like a standing.
 * - Complementary suppression, tie-group flavoured: exactly one folded
 *   entity is recoverable as `total - published`, so the smallest published
 *   COUNT (the whole tie group at that count, to keep the no-split rule)
 *   folds with it. Conservative on purpose: a nonzero "Not listed" count
 *   inside `rest` would often mask the hole, but "often" is not a floor.
 */
export function publishableCanon(
  ent: CanonCounts,
  floor: number,
  topN: number,
): { top: CanonCounts; rest: number } | null {
  let total = 0;
  for (const k of Object.keys(ent)) total += ent[k];
  const rows = Object.keys(ent)
    .filter((k) => k !== "0")
    .map((k) => ({ k, n: ent[k] }))
    .filter((r) => r.n > 0);
  // Count desc; key asc only so equal inputs give equal outputs — the
  // published map is unordered and the client re-sorts anyway.
  rows.sort((a, b) => b.n - a.n || Number(a.k) - Number(b.k));
  const cleared = rows.filter((r) => meetsKFloor(r.n, floor));
  let kept = cleared.slice(0, topN);
  // A floor cut cannot tie (below-floor < floor <= kept), so the boundary
  // tie only exists where the topN cap did the cutting.
  if (cleared.length > kept.length && kept.length > 0) {
    const boundary = kept[kept.length - 1].n;
    if (cleared[kept.length].n === boundary) {
      kept = kept.filter((r) => r.n > boundary);
    }
  }
  // rows, not cleared: the recoverable-hole count is over every answered
  // entity a reader could name, whether the floor or the cap folded it.
  if (rows.length - kept.length === 1 && kept.length > 0) {
    const smallest = kept[kept.length - 1].n;
    kept = kept.filter((r) => r.n > smallest);
  }
  if (kept.length === 0) return null;
  const top: CanonCounts = {};
  let shown = 0;
  for (const r of kept) {
    top[r.k] = r.n;
    shown += r.n;
  }
  return { top, rest: total - shown };
}

// ─── catalog breakdowns: how each segment orders the canon (D17) ────────
//
// D14 deferred per-anchor breakdowns for catalog questions with the
// arithmetic, and named the one viable form: breakdowns for the published
// top-N only — 10 entities × 6 dims is the same cell count a vote
// question already handles. Demand appeared (2026-07-30), so this is that
// form: each segment shows how IT orders the global board, never a board
// of its own.
//
// Write side: the same fold as vote questions, transposed — cells hold
// per-ENTITY counts instead of per-option counts. Options are bounded at
// 20 by rules; entities are not, so without a per-cell cap one
// (dim, bucket) cell could hold the whole 1,025-entry catalogue and the
// document-growth constraint above collapses. Same cap semantics as the
// bucket cap: first come, known entities keep counting, the long tail
// degrades. A capped-out entity that later becomes popular undercounts in
// that cell — visible only if it also reaches the global top 10, and 32
// is far above the 10 the publish path can ever show.
export const CANON_BY_MAX_ENTITIES = 32;

export function foldCanonAnchors(
  into: BreakdownCounts,
  anchors: unknown,
  entityKey: string,
): BreakdownCounts {
  if (!anchors || typeof anchors !== "object") return into;
  const src = anchors as Record<string, unknown>;
  for (const dim of BREAKDOWN_DIMS) {
    const bucket = breakdownBucket(src[dim], dim);
    if (bucket === null) continue;
    const byDim = into[dim] || (into[dim] = {});
    if (!byDim[bucket] && Object.keys(byDim).length >= BREAKDOWN_MAX_BUCKETS) continue;
    const cell = byDim[bucket] || (byDim[bucket] = {});
    if (!cell[entityKey] && Object.keys(cell).length >= CANON_BY_MAX_ENTITIES) continue;
    cell[entityKey] = (cell[entityKey] || 0) + 1;
  }
  return into;
}

/**
 * The publishable form of a catalog breakdown: every cell restricted to
 * the entities the canon actually published. The caller then hands the
 * result to publishableBreakdown, whose bucket-cohort floor, complementary
 * suppression and minimum-comparison rules apply unchanged — D8's
 * k-argument carries over exactly (a per-entity count of 1 inside a
 * ≥floor bucket says "one of these five", never which one).
 *
 * Two deliberate conservatisms, recorded in D17:
 * - the floor then applies to the SHOWN total (top-N answers in the
 *   bucket), not the bucket's true cohort — a bucket can be suppressed
 *   more than strictly necessary, never less;
 * - entities outside the global top-N do not exist here. A segment's own
 *   favourite that never made the global board is not published — the
 *   D14 arithmetic, not an oversight.
 */
export function canonBreakdownFor(
  entBy: BreakdownCounts,
  top: CanonCounts,
): BreakdownCounts {
  const out: BreakdownCounts = {};
  for (const dim of Object.keys(entBy)) {
    const buckets = entBy[dim] || {};
    const dimOut: Record<string, Record<string, number>> = {};
    for (const bucket of Object.keys(buckets)) {
      const cell = buckets[bucket];
      const kept: Record<string, number> = {};
      for (const k of Object.keys(cell)) {
        if (top[k] !== undefined) kept[k] = cell[k];
      }
      if (Object.keys(kept).length > 0) dimOut[bucket] = kept;
    }
    if (Object.keys(dimOut).length > 0) out[dim] = dimOut;
  }
  return out;
}

// ─── FCM token registration (registerPushToken, v2social.ts) ────────────
//
// Token writes used to be a direct client merge onto the profile doc.
// The threat that moved them behind a callable: fcmTokens is where the
// reveal sender fans out to, and the ruleset could only check the SHAPE
// of the array — so any signed-in script could plant a token it did not
// own on its own account and route reveal pushes to someone else's
// device. The callable runs behind App Check (the caller must be the
// real app, where the only token you can obtain is your own device's),
// and these two pure pieces keep the rest testable.
//
// Honest scope: this binds token→uid by attestation, not by cryptographic
// possession proof. If that is ever needed, the shape is a nonce sent TO
// the token that the device echoes back — a place this callable leaves
// room for.

// A plausible FCM registration token: an instance id, a colon, and an
// APA91… blob. Bounds chosen from observed tokens (~140–200 chars) with
// slack for format drift; the point is rejecting garbage and truncation,
// not modelling FCM's internals.
export function isPlausibleFcmToken(t: unknown): t is string {
  if (typeof t !== "string") return false;
  if (t.length < 100 || t.length > 400) return false;
  return /^[A-Za-z0-9_:%.-]+$/.test(t);
}

// The next fcmTokens array: `remove` dropped (a rotated predecessor),
// `add` appended if absent, oldest evicted past `cap`. Mirrors the
// arrayRemove+arrayUnion pair the client used to issue, in one
// deterministic step the server can transaction.
export function nextFcmTokens(
  current: unknown,
  add: string,
  remove: string | null,
  cap: number,
): string[] {
  const base = Array.isArray(current)
    ? current.filter((x): x is string => typeof x === "string" && x !== remove && x !== add)
    : [];
  base.push(add);
  return base.length > cap ? base.slice(base.length - cap) : base;
}

// ─── moderation: queue fold + verdict validation (docs/MODERATION.md) ───
//
// Both sides of the moderation run's confinement are pure and tested:
// the SERVER picks the targets (buildModQueueFrom — the run judges what
// the queue hands it, never chooses), and the verdict channel accepts
// exactly one shape (modVerdictError — anything else is rejected before
// it touches a document). The policy lines are H1–H5 in
// docs/MODERATION.md; a `remove` without a line, or a line on a
// non-remove, is invalid by construction so every removal is citable.

export const MOD_POLICY_LINES = ["H1", "H2", "H3", "H4", "H5"] as const;

/**
 * Fold raw flag counts into the queue: takes at or above the flag
 * threshold, most-flagged first (id ascending on ties so equal inputs
 * give equal queues), capped at k.
 */
export function buildModQueueFrom(
  flagCounts: Record<string, number>,
  minFlags: number,
  k: number,
): { takeId: string; flags: number }[] {
  return Object.keys(flagCounts)
    .map((takeId) => ({ takeId, flags: flagCounts[takeId] }))
    .filter((r) => r.flags >= minFlags)
    .sort((a, b) => b.flags - a.flags || (a.takeId < b.takeId ? -1 : 1))
    .slice(0, k);
}

/**
 * The verdict log's document id: one entry per (take, QUEUE GENERATION).
 *
 * Keyed by takeId alone, the log doubled as a lock that never released —
 * the first verdict on a take made every later one impossible. That reads
 * as correct right up until you notice the queue is REBUILT WHOLESALE on
 * every run: in advisory mode nothing is hidden and no flags are cleared,
 * so the same take is back in tomorrow's queue, the run judges it again,
 * and the submission dies `already-exists`. The daily re-judgement is not
 * an edge case — it is the material the trust ladder is made of.
 *
 * `escalate` had it worst. It is the one verdict that deliberately KEEPS
 * the entry queued for a human, so "come back to this" was precisely the
 * decision that could never be come back to.
 *
 * The generation is the queue entry's own `queuedAt`, not a counter: an
 * entry is written exactly once per build, so its timestamp already names
 * the build that picked it — no second collection, no shared sequence.
 * The moderation run never names it either. It submits the same
 * `{ takeId, verdict, policyLine? }` as before and the SERVER reads the
 * generation off the server-picked queue entry, so confinement is
 * unchanged: the run can address the take in front of it, never a
 * generation of its choosing.
 *
 * Unknown generation falls back to the bare takeId, which is fail-SAFE
 * rather than fail-open — a verdict already in the log keeps blocking a
 * second one. The reverse default would let a queue entry with no usable
 * timestamp re-open a settled take.
 */
export function modVerdictId(takeId: string, gen: number): string {
  return Number.isFinite(gen) && gen > 0 ? `${takeId}__${gen}` : takeId;
}

/**
 * How many times a take has been escalated, carried across a queue
 * rebuild. Takes the PREVIOUS queue entry's fields; returns the count to
 * stamp on the new one.
 *
 * Escalation is the policy's safety valve — "uncertain → escalate", and
 * docs/MODERATION.md promises escalations reach a human in BOTH phases.
 * Nothing carried them. `submitModVerdict` marked the queue entry and
 * `runBuildModQueue` rebuilds that collection wholesale, so the mark lived
 * until the next daily build and then vanished; the verdict log kept the
 * row, but nothing reads the log yet (the digest is unbuilt), so the valve
 * had no outlet at all.
 *
 * It was worse than a 24-hour window in the phase the system is actually
 * in. Under MOD_ADVISORY the callable returns after writing
 * `advisoryVerdict`, so the `escalated` flag was never set — meaning the
 * `escalated` field `fetchModQueue` hands the run was permanently false
 * today. Both spellings are read here, so the signal means one thing in
 * both phases.
 *
 * A COUNT rather than a flag: a take the run keeps escalating is a
 * different signal from one it escalated once, and it is the signal the
 * digest wants. Monotonic across rebuilds, and the fresh generation is
 * left alone — an escalated take is still re-judgeable, deliberately. A
 * second escalation is information, not a duplicate.
 *
 * Known limit, stated rather than engineered around: the chain is
 * entry-to-entry, so a take that drops out of the top-MOD_QUEUE_SIZE and
 * later returns comes back at zero. The verdict log holds the real history
 * for the digest; this number is the run's cheap in-queue hint, not the
 * record.
 */
export function carriedEscalations(prior: {
  escalations?: unknown;
  escalated?: unknown;
  advisoryVerdict?: unknown;
} | null | undefined): number {
  if (!prior) return 0;
  const base =
    typeof prior.escalations === "number" &&
    Number.isInteger(prior.escalations) &&
    prior.escalations > 0
      ? prior.escalations
      : 0;
  const escalatedThisGeneration =
    prior.escalated === true || prior.advisoryVerdict === "escalate";
  return escalatedThisGeneration ? base + 1 : base;
}

/**
 * Why a submitted verdict is invalid, or null when it is well-formed.
 * Returns the reason as text so the callable can hand it back verbatim.
 */
export function modVerdictError(value: unknown): string | null {
  if (!value || typeof value !== "object") return "verdict must be an object";
  const v = value as Record<string, unknown>;
  const keys = Object.keys(v).sort().join(",");
  if (keys !== "policyLine,takeId,verdict" && keys !== "takeId,verdict") {
    return "unexpected fields — takeId, verdict, and policyLine only";
  }
  if (typeof v.takeId !== "string" || !v.takeId || v.takeId.length > 128) {
    return "takeId must be a non-empty string";
  }
  if (v.verdict !== "remove" && v.verdict !== "keep" && v.verdict !== "escalate") {
    return "verdict must be remove, keep, or escalate";
  }
  if (v.verdict === "remove") {
    if (!MOD_POLICY_LINES.includes(v.policyLine as never)) {
      return "a removal must cite a policy line (H1–H5)";
    }
  } else if (v.policyLine != null) {
    return "only removals carry a policy line";
  }
  return null;
}
