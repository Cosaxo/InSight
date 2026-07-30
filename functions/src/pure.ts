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
//    was never claiming. See D15 for the arithmetic.

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
// is allowed to be. Constraint 2 above has the reasoning and D15 the
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
 * The stored form of a catalog answer's entity, or null to never aggregate.
 * `max` is the catalogue's key ceiling (CATALOG_MAX_ENTITY in v2.ts —
 * cross-checked against the committed catalogue by scripts/check-pokedex.mjs);
 * parameter-pure like meetsKFloor so this stays testable without it.
 */
export function catalogEntityKey(value: unknown, max: number): string | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  if (value < 0 || value > max) return null;
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
