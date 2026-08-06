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

// WHICH DAYS a run looks at, and this is the half that used to be wrong.
//
// The scan asked about exactly one day — `utcDayKey(-1)` — and the schedule
// never passed one, so a group-day was eligible for reveal during the single
// UTC day after it and never again. That is not the window the rest of the
// system works in: firestore.rules accepts a duel answer up to FOUR days
// late (deliberately, so a client flushing a queue after ~3 days offline
// still lands its vote), and onV2AnswerCreated re-adds the day to
// `pendingDays` whenever one arrives. So an answer syncing on D+2 re-opened
// day D, correctly, into a scan that would never ask about day D again.
// Nothing errored: both members had answered, the day sat pending forever,
// and the duo's streak stayed at whatever the earlier empty settle left it.
//
// The window is PENDING_DAYS_KEEP, because that is already the bound the
// pruning uses — a pending day older than that can never gain another answer
// and is dropped. Matching them means the scan asks about exactly the days
// that can still change, which is the definition `pendingDays` was given.
//
// Steady-state cost is five extra indexed queries per run that return
// nothing. An explicit `dayKey` still means that day alone: the operator
// lever and the e2e both pass one, and narrowing is what an operator
// reaching for it during an incident usually wants.
export function scanDays(dayKey?: string, nowMs: number = Date.now()): string[] {
  if (dayKey) return [dayKey];
  return Array.from({ length: PENDING_DAYS_KEEP }, (_, i) => utcDayKey(-(i + 1), nowMs));
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

// Who a day's reveal may be shown to.
//
// The reveal doc carries its own `members` array and firestore.rules gates
// the read on THAT, not on the group's current membership — which is what
// makes the guarantee retroactive in one direction: joining tomorrow does
// not hand you every past day, and leaving does not retract the days you
// played. The array was the membership AT REVEAL TIME, and that is a
// different thing from membership on the day being revealed.
//
// The gap it left is one scan wide, every day. Day D is revealed by the D+1
// scan, which runs `every 120 minutes` — so anyone who joined between
// 00:00 UTC and that scan was a current member when the snapshot was taken,
// went into `members`, and could read day D's votes and names for a day they
// were not in the group for. `revealGroupDay`'s own comment claimed to have
// closed this by preferring the page snapshot to a fresher read, but both
// reads happen on D+1, so it only ever closed the seconds between them.
//
// The bound is the END of the day being revealed, not its start: someone who
// joined midway through day D was there for it and may have played it.
//
// …and anyone who DID play the day is included whatever their join time
// says. firestore.rules accepts a duel answer up to four days late, so a
// member can legitimately land a vote for a day that precedes their join —
// an offline client flushing a queue, or a fresh group playing a recent day.
// Excluding them would publish a reveal containing their own vote that they
// alone cannot read, and "you see the days you played" is the invariant the
// e2e already asserts.
//
// KNOWN RESIDUAL, recorded rather than papered over: that clause is also an
// unlock. Join a group, backfill an answer for a day inside the four-day
// window, and the reveal admits you. It is strictly narrower than what this
// replaces — passive joining now reveals nothing, and the unlock costs a
// visible vote in the circle's own reveal — but it is not nothing. Closing
// it means bounding the write, not the read: firestore.rules would have to
// refuse a duel answer for a day preceding the member's join. That is a
// change to the densest rule in the file, whose failure mode is a vote that
// silently vanishes, and it would refuse the legitimate fresh-group case
// above. Left for a decision of its own (D54 §9).
//
// A uid with NO recorded join time is included, and that is not a fallback —
// it is the correct answer. The field is written by createGroupV2 and
// joinGroupV2 from the day this shipped, so its absence means the member
// joined before that, which is necessarily before any day this function will
// ever be asked about. Reading absence as "unknown, exclude" would blank
// every reveal for every group that existed on deploy day.
//
// Takes plain millis rather than Timestamps so this stays firebase-free like
// the rest of the module; the caller converts.
export function revealMembersFor(
  members: readonly string[],
  joinedAtMs: Record<string, unknown>,
  dayKey: string,
  playedUids: readonly string[] = [],
): string[] {
  const dayEnd = Date.parse(`${dayKey}T00:00:00Z`) + 86400000;
  // Server-generated (utcDayKey), so this is unreachable in the pipeline. It
  // degrades to the previous behaviour rather than to an empty array: a
  // reveal nobody can read is a worse failure than one scoped too widely,
  // and a malformed day key means the reveal is already wrong.
  if (!Number.isFinite(dayEnd)) return [...members];
  const played = new Set(playedUids);
  return members.filter((uid) => {
    if (played.has(uid)) return true;
    const at = Object.prototype.hasOwnProperty.call(joinedAtMs, uid)
      ? joinedAtMs[uid]
      : undefined;
    if (typeof at !== "number" || !Number.isFinite(at)) return true;
    return at < dayEnd;
  });
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
// The bucket cap is a scarce resource, and anchors are written by the CLIENT
// onto its own answer doc where firestore.rules can only enforce a length —
// so whoever fills the slots first decides what the dimension can ever show.
// 24 nonsense values blank it for everybody, permanently: nothing evicts a
// bucket, and `by` is carried forward across every publish.
//
// Two different defences, because the dimensions are two different shapes.
//
// FOUR OF THEM HAVE A CLOSED VOCABULARY, and it is SHORTER THAN THE CAP.
// ageBand/gender/education/relationship come from <select>s of 7, 4, 15 and 6
// values; checking membership means the dimension cannot be exhausted at all,
// because there are fewer legal buckets than slots. That is the real fix and
// it is available here and nowhere else — the rules layer cannot hold a
// vocabulary, and the client choosing from a list says nothing about what a
// script sends. `npm run check:anchors` holds these equal to the <select>
// lists in src/v2/spec/profile-general.jsx, the way check-cities.mjs holds
// the city catalogue to its own rules.
//
// This used to say a bogus value in these four "costs one suppressed
// sub-floor bucket, not the dimension". That was wrong in the same way the
// city note was right: 24 of them cost the dimension.
//
// CITY AND COUNTRY CANNOT BE CLOSED THAT WAY — 10,929 places and ~249
// countries against 24 slots — so membership would still leave them
// exhaustible with real values. Their shapes stay, and the cap itself
// changed instead: see the eviction rule in foldAnchors.
const BREAKDOWN_DIM_SHAPE: Partial<Record<BreakdownDim, RegExp>> = {
  // "Oslo, NO" — a catalogue name and an ISO 3166-1 alpha-2 code. Must
  // agree with placeKey() in src/v2/data/places.ts.
  city: /^.+, [A-Z]{2}$/,
  // ISO 3166-1 alpha-2, derived client-side from the picked city.
  country: /^[A-Z]{2}$/,
};

// The closed vocabularies, verbatim from the profile's <select>s. Every value
// must survive breakdownBucket and fit BREAKDOWN_MAX_LABEL, and every list
// must be shorter than BREAKDOWN_MAX_BUCKETS — check:anchors asserts all
// three, and the last is the one that makes exhaustion impossible rather
// than merely harder.
//
// `Vocational / trade` is deliberately spelled "Vocational or trade" here
// AND in the profile: the slash is in breakdownBucket's rejected class, so
// the shipped option folded into no bucket at all from the day it was added.
// Nothing surfaced it — the answer wrote, the aggregate just never counted
// it — which is precisely the silence check:anchors now closes.
export const BREAKDOWN_DIM_VOCAB: Partial<Record<BreakdownDim, readonly string[]>> = {
  ageBand: ["Under 18", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"],
  gender: ["Woman", "Man", "Non-binary", "Prefer not to say"],
  education: [
    "Primary school", "Middle school", "High school", "Vocational or trade",
    "Some college", "Associate degree", "Bachelor's", "Postgraduate diploma",
    "Master's", "MBA", "Doctorate", "Postdoctoral",
    "Professional certification", "Self-taught", "Other",
  ],
  relationship: [
    "Single", "Dating", "Partnered", "Married", "It’s complicated",
    "Prefer not to say",
  ],
};

const VOCAB_SETS: Partial<Record<BreakdownDim, ReadonlySet<string>>> = Object.fromEntries(
  Object.entries(BREAKDOWN_DIM_VOCAB).map(([dim, vals]) => [dim, new Set(vals)]),
);

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
  // A label already keyed on Object.prototype is not a bucket name — it is a
  // write into the prototype chain. The folds below do
  // `byDim[bucket] || (byDim[bucket] = {})`, and with bucket === "__proto__"
  // that assignment sets the PROTOTYPE rather than a property; the per-option
  // counter beneath it then increments a field every later object in the
  // process inherits. Measured, not reasoned: one answer carrying
  // `anchors: { gender: "__proto__" }` makes an unrelated question publish
  // `{"f":{"1":6}}` for five voters — counts nobody cast, on every question
  // that instance goes on to serve. "constructor" and "toString" are the same
  // shape one step weaker: they read back truthy and so also walk past the
  // BREAKDOWN_MAX_BUCKETS check.
  //
  // This is the only place it can be caught. firestore.rules can bound an
  // anchor's LENGTH and nothing else (the reason BREAKDOWN_DIM_SHAPE exists
  // above), and four of the six dimensions have no closed vocabulary to check
  // against — so a free anonymous account can put any 40-char string here.
  //
  // Membership in the prototype rather than a blocklist: a list of names the
  // language owns is a list this repo would have to maintain against it.
  if (v in ({} as Record<string, unknown>)) return null;
  const shape = dim && BREAKDOWN_DIM_SHAPE[dim];
  if (shape && !shape.test(v)) return null;
  const vocab = dim && VOCAB_SETS[dim];
  if (vocab && !vocab.has(v)) return null;
  return v;
}

// Make room for a new bucket in a dimension that is at its cap, or return
// false to refuse it.
//
// The cap has to hold — it is the document-growth bound D7's arithmetic
// rests on — but WHICH buckets hold the slots was first-come-first-served,
// and that is what made the dimension attackable: a bucket below the floor
// is suppressed from every publish, so it occupies a slot while showing
// nobody anything. 24 of those arriving early blanked `city` permanently,
// and no vocabulary can prevent it there because the catalogue is 10,929
// places against 24 slots — the attacker only needs real city names.
//
// So a sub-floor bucket is evictable and a publishable one is not. The
// smallest goes, and only if it is genuinely below the floor; once every
// slot holds a cohort large enough to publish, the cap refuses again and the
// long tail degrades exactly as it always did.
//
// What eviction costs, stated because it is a real loss and not a rounding
// one: the evicted bucket's partial count is discarded, so a value that
// re-appears restarts from zero and undercounts by up to `floor - 1`. That
// is bounded, it only ever applies to counts no reader has seen, and the
// alternative it replaces is a dimension that shows nothing at all for the
// life of the question.
//
// AMONG EQUALS IT IS FIRST-IN-FIRST-OUT, and that is not incidental — the
// scan keeps the first key at the minimum (`<`, not `<=`), and insertion
// order is Firestore's map order. So a dimension whose buckets all sit at one
// answer does churn, oldest out. That has to be true for this to work at all:
// the attack state IS 24 buckets of one answer each, and a rule that
// protected incumbents there would protect exactly the junk.
//
// What it costs is the long tail, which is where the cap was already
// documented to degrade. What it buys is that recurrence wins: a value that
// comes back grows past the churn and, at the floor, stops being evictable at
// all. Nothing published can be taken away.
function evictForNewBucket(
  byDim: Record<string, Record<string, number>>,
  floor: number,
): boolean {
  const keys = Object.keys(byDim);
  if (keys.length < BREAKDOWN_MAX_BUCKETS) return true;
  let victim: string | null = null;
  let victimTotal = floor;
  for (const k of keys) {
    const n = bucketTotal(byDim[k]);
    if (n < victimTotal) {
      victim = k;
      victimTotal = n;
    }
  }
  if (victim === null) return false;
  delete byDim[victim];
  return true;
}

// Fold one answer's anchors into the running breakdown. Mutates and returns
// `into` so the trigger can keep this inside its existing transaction.
//
// `floor` is the k-floor the publish path will apply (AGG_MIN_N). It is a
// parameter rather than a constant for the reason meetsKFloor's is: the
// floors in this module are named decisions passed in, never assumed.
export function foldAnchors(
  into: BreakdownCounts,
  anchors: unknown,
  optionIdx: number,
  floor: number,
): BreakdownCounts {
  if (!anchors || typeof anchors !== "object") return into;
  const src = anchors as Record<string, unknown>;
  for (const dim of BREAKDOWN_DIMS) {
    const bucket = breakdownBucket(src[dim], dim);
    if (bucket === null) continue;
    const byDim = into[dim] || (into[dim] = {});
    if (!byDim[bucket] && !evictForNewBucket(byDim, floor)) continue;
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

// The breakdown a publish is allowed to RELEASE, given what the last publish
// already released.
//
// shouldPublishAgg below bounds how often the document is rewritten, which
// bounds the delta a snapshot-watcher can attribute — for `counts`. It does
// nothing for `by`, because the cadence is counted in answers to the QUESTION
// while the quantity on display is a count per BUCKET. A bucket therefore
// moves by however many of the window's answers happened to carry its anchor,
// and one is the common case: anchors are empty until the user fills the
// Basics card (D8), so a window of five answers routinely contains a single
// anchored one. Measured on the real fold: two consecutive published states
// differing by `{"f":{"0":5}}` → `{"f":{"0":5,"1":1}}` name one person's vote
// as exactly as a k=1 cohort would, past a floor that cleared.
//
// Worse in the shape that actually ships, because the anchors travel
// together: that single answer moves all six dimensions at once, so the step
// discloses a full {ageBand, gender, city, country, education, relationship}
// tuple joined to one option. That is the re-identification the floor exists
// to prevent, defeated by the update cadence rather than by the numbers —
// the same failure the comment under shouldPublishAgg records for `counts`,
// on the field that was added after it.
//
// So the same k applies per bucket: a bucket's counts may be re-released only
// once it has gained `step` answers since the value a reader last saw. Until
// then the PREVIOUS released value is re-emitted, so the document is
// unchanged for that bucket rather than merely un-rewritten. The private doc
// keeps the exact running total, so nothing is lost — a bucket lags by at
// most `step - 1` answers, the same bound the cadence gives `counts`.
//
// A bucket seen for the first time is released whole: that discloses a cohort
// of at least the floor arriving together, which is the floor's own
// guarantee, not a step. The caller hands the result to publishableBreakdown,
// whose floor, complementary suppression and minimum-comparison rules then
// apply unchanged — this gates WHEN a value moves, never whether it clears.
//
// `released` is the last map this function returned, not the last one
// published: publishableBreakdown only ever suppresses buckets, never alters
// their counts, so a bucket it dropped was seen by nobody and measuring from
// the older released value is the conservative direction.
export function steppedBreakdown(
  by: BreakdownCounts,
  released: BreakdownCounts,
  step: number,
): BreakdownCounts {
  const out: BreakdownCounts = {};
  for (const dim of Object.keys(by)) {
    const buckets = by[dim] || {};
    const prevDim = released[dim] || {};
    const dimOut: Record<string, Record<string, number>> = {};
    for (const bucket of Object.keys(buckets)) {
      const prev = prevDim[bucket];
      if (!prev) {
        dimOut[bucket] = { ...buckets[bucket] };
        continue;
      }
      dimOut[bucket] = bucketTotal(buckets[bucket]) - bucketTotal(prev) >= step
        ? { ...buckets[bucket] }
        : { ...prev };
    }
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
//
// Scope, because it was once read as wider than it is: this bounds the delta
// of `counts`, whose unit is the question. It says nothing about `by`, whose
// unit is the bucket — steppedBreakdown above is the same argument carried to
// that field, and the trigger must apply both.
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
  floor: number,
): BreakdownCounts {
  if (!anchors || typeof anchors !== "object") return into;
  const src = anchors as Record<string, unknown>;
  for (const dim of BREAKDOWN_DIMS) {
    const bucket = breakdownBucket(src[dim], dim);
    if (bucket === null) continue;
    const byDim = into[dim] || (into[dim] = {});
    // Same bucket cap and the same eviction rule as foldAnchors — the
    // slots are just as attackable here, and for the same reason.
    if (!byDim[bucket] && !evictForNewBucket(byDim, floor)) continue;
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
 * Tally one flag per takeId.
 *
 * A Map rather than an object literal, because the KEY IS CLIENT-CHOSEN: the
 * flag's `takeId` is the take's document id, and firestore.rules lets any
 * circle member pick that id when they create the take (the rules constrain
 * its fields, never its name). On a plain object, `counts[takeId] || 0` reads
 * back through the prototype for `constructor`, `toString`, `valueOf` and the
 * rest — so `counts["constructor"] = (counts["constructor"] || 0) + 1` yields
 * the string `"function Object() { [native code] }1111111111"`, every
 * comparison in buildModQueueFrom against it is NaN-false, and the take is
 * never queued however many people flag it. A take that cannot enter the
 * queue cannot be moderated at all: permanent immunity, chosen at post time,
 * with nothing logged.
 *
 * Firestore's own reserved-id rule (`__.*__`) is the only reason "__proto__"
 * is not also reachable here, which is not a guarantee this module should be
 * resting on.
 *
 * Pure, so the shape is pinned without an emulator — the emulator run that
 * found this had to create a take called `constructor` to see it.
 */
export function tallyFlags(takeIds: readonly unknown[]): Record<string, number> {
  return Object.fromEntries(tallyFlagsInto(new Map(), takeIds));
}

/**
 * The same tally, one page at a time.
 *
 * `v2_flags` has no upper bound — MOD_ADVISORY makes the keep-verdict sweep
 * that deletes flags dead code, nothing else deletes them, and there is no
 * TTL — so the caller pages through it and folds each page in rather than
 * materialising the collection. What is retained is one entry per DISTINCT
 * take, which is smaller than the flag count by however many people flagged
 * the same take, and is the smallest thing the queue can be built from.
 */
export function tallyFlagsInto(
  counts: Map<string, number>,
  takeIds: readonly unknown[],
): Map<string, number> {
  for (const takeId of takeIds) {
    if (typeof takeId !== "string" || !takeId) continue;
    counts.set(takeId, (counts.get(takeId) || 0) + 1);
  }
  return counts;
}

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

// ── seed diffing (v2 content seed) ──────────────────────────────
//
// The seed used to write all 369 question docs and bump `contentRev`
// on every run, unconditionally. Both halves were waste, and the second
// was expensive: `contentRev` keys the client's whole-bank cache
// (live.ts), so every bump made every returning device re-read the
// entire bank — 369 billable reads for content that had usually not
// moved at all. docs/COSTS.md carries the arithmetic.
//
// So the seed now asks this: does the stored doc already say what we are
// about to say? Only the fields the client actually consumes are
// compared. `active` is deliberately NOT among them — it is the
// operational kill switch, owned by whoever flipped it in the console,
// and the seed only ever writes it on create.
export const SEEDED_FIELDS = [
  "surface", "seq", "type", "domain", "prompt", "options", "topic", "axis", "test",
] as const;

/**
 * True when `existing` already carries every seeded field of `desired`.
 * `existing` is null/undefined for a doc that does not exist yet.
 *
 * Array-valued fields (`options`) compare element-wise; everything else
 * is a scalar or null. Deliberately strict about null vs undefined:
 * Firestore round-trips an explicit null as null, and a doc seeded
 * before a field existed reads it back as undefined — treating those as
 * equal would leave old docs permanently un-upgraded.
 */
export function seedDocMatches(
  existing: Record<string, unknown> | null | undefined,
  desired: Record<string, unknown>,
): boolean {
  if (!existing) return false;
  for (const f of SEEDED_FIELDS) {
    const a = existing[f];
    const b = desired[f];
    if (Array.isArray(b)) {
      if (!Array.isArray(a) || a.length !== b.length) return false;
      for (let i = 0; i < b.length; i++) if (a[i] !== b[i]) return false;
    } else if ((a ?? null) !== (b ?? null)) {
      return false;
    }
  }
  return true;
}
