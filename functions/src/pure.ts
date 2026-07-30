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
// 2. K-ANONYMITY THAT SURVIVES SUBTRACTION. Suppressing cells below the
//    floor is not sufficient on its own. If a dimension has exactly one
//    suppressed cell and a reader knows the dimension's total, that cell is
//    recoverable by subtracting the published ones — the floor would be
//    decorative. publishableBreakdown therefore applies COMPLEMENTARY
//    SUPPRESSION: if suppressing the sub-floor cells would leave exactly one
//    hole, the smallest surviving cell is suppressed too, so there are always
//    either zero holes or at least two. Standard practice in statistical
//    disclosure control, and the reason this is a pure function with its own
//    tests rather than three lines inside the trigger.

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

function cellTotal(cell: Record<string, number>): number {
  let n = 0;
  for (const k of Object.keys(cell)) n += cell[k];
  return n;
}

// The publishable view: every bucket at or above the floor, with
// complementary suppression so no single bucket is recoverable by
// subtraction. A dimension with nothing left to say is omitted entirely
// rather than published empty.
export function publishableBreakdown(
  by: BreakdownCounts,
  floor: number,
): BreakdownCounts {
  const out: BreakdownCounts = {};
  for (const dim of Object.keys(by)) {
    const buckets = by[dim] || {};
    const rows = Object.keys(buckets).map((b) => ({
      bucket: b,
      total: cellTotal(buckets[b]),
    }));
    const kept = rows.filter((r) => meetsKFloor(r.total, floor));
    const suppressed = rows.length - kept.length;
    // Exactly one hole is a hole with a name on it — take the smallest
    // survivor down with it so at least two cells are unknown.
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

// ─── catalog breakdowns: how each segment orders the canon (D16) ────────
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
 * Two deliberate conservatisms, recorded in D16:
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
