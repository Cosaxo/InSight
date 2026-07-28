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

// ── k-anonymity gate (index) ────────────────────────────────────

// The k-floor decision in one place: a bucket is publishable only at
// or above its floor. Buckets below it are dropped (or deleted).
export function meetsKFloor(count: number, floor: number): boolean {
  return count >= floor;
}

// ── media tallies (index) ───────────────────────────────────────

// Media categories — mirror MediaKey in the app (music/film/books/
// podcasts). Favourites live on the profile as media[category]: string[].
export const MEDIA_CATEGORIES = ["music", "film", "books", "podcasts"] as const;
export type MediaCategory = (typeof MEDIA_CATEGORIES)[number];

export interface MediaItemCount {
  name: string;
  count: number;
}
export type MediaTop = Partial<Record<MediaCategory, MediaItemCount[]>>;

// Tally distinct media items per category across users (each user
// counts a given item once) and return the top-k per category.
export function topMedia(
  perUser: Array<Partial<Record<MediaCategory, string[]>>>,
  k: number,
): MediaTop {
  const counts: Record<string, Map<string, MediaItemCount>> = {};
  for (const cat of MEDIA_CATEGORIES) counts[cat] = new Map();
  for (const media of perUser) {
    for (const cat of MEDIA_CATEGORIES) {
      const list = media[cat];
      if (!Array.isArray(list)) continue;
      const seen = new Set<string>();
      for (const raw of list) {
        const key = raw.toLowerCase().trim();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        const existing = counts[cat].get(key);
        if (existing) existing.count += 1;
        else counts[cat].set(key, { name: raw, count: 1 });
      }
    }
  }
  const out: MediaTop = {};
  for (const cat of MEDIA_CATEGORIES) {
    const arr = [...counts[cat].values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, k);
    if (arr.length > 0) out[cat] = arr;
  }
  return out;
}

// ── vector rollup math (index) ──────────────────────────────────

// Compute mean and standard deviation per-axis across N vectors.
// All vectors must be the same length; we use the first one to size
// the result arrays.
export function summarise(
  vectors: number[][],
): { mean: number[]; stdev: number[] } {
  const n = vectors.length;
  if (n === 0) return { mean: [], stdev: [] };
  const len = vectors[0].length;
  const sums = new Array(len).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < len; i++) sums[i] += v[i];
  }
  const mean = sums.map((s) => s / n);
  const sqs = new Array(len).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < len; i++) {
      const d = v[i] - mean[i];
      sqs[i] += d * d;
    }
  }
  const stdev = sqs.map((s) => Math.sqrt(s / n));
  return {
    mean: mean.map((m) => Math.round(m * 100) / 100),
    stdev: stdev.map((s) => Math.round(s * 100) / 100),
  };
}

export function averagePersonality(vectors: number[][]): number[] | null {
  if (vectors.length === 0) return null;
  const sums = [0, 0, 0, 0, 0];
  for (const v of vectors) {
    for (let i = 0; i < 5; i++) sums[i] += v[i];
  }
  return sums.map((s) => Math.round(s / vectors.length));
}

// ── demographic bucketing (index) ───────────────────────────────

export function ageBucket(age: number): string {
  if (age < 20) return "<20";
  if (age < 30) return "20-29";
  if (age < 40) return "30-39";
  if (age < 50) return "40-49";
  return "50+";
}

export function tally<T extends string>(values: T[]): Record<string, number> {
  const counts: Record<string, number> = {};
  let total = 0;
  for (const v of values) {
    if (!v) continue;
    counts[v] = (counts[v] || 0) + 1;
    total += 1;
  }
  if (total === 0) return {};
  const out: Record<string, number> = {};
  for (const [k, n] of Object.entries(counts)) {
    out[k] = Math.round((n / total) * 1000) / 1000;
  }
  return out;
}

export function topInterests(
  names: string[][],
  k: number,
): { name: string; count: number }[] {
  const counts: Record<string, { name: string; count: number }> = {};
  for (const list of names) {
    const seen = new Set<string>();
    for (const raw of list) {
      const key = raw.toLowerCase().trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      if (!counts[key]) counts[key] = { name: raw, count: 0 };
      counts[key].count += 1;
    }
  }
  return Object.values(counts)
    .sort((a, b) => b.count - a.count)
    .slice(0, k);
}

// City names come from user input (free text) so we slugify
// (lowercase + alnum) when bucketing.
export function slugifyCity(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
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
//    BREAKDOWN_MAX_BUCKETS distinct values. `city` and `profession` are
//    deliberately excluded: they are free text up to 80 chars, so every
//    distinct spelling would mint a key forever.
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
  "country",
  "education",
  "relationship",
] as const;
export type BreakdownDim = (typeof BREAKDOWN_DIMS)[number];

// Per-dimension distinct-value cap. 5 dims x 24 buckets x up to 20 options is
// ~2.4k integers worst case — tens of KB against Firestore's 1 MiB limit,
// with room for the plain counts alongside.
export const BREAKDOWN_MAX_BUCKETS = 24;
// Bucket labels are stored as map keys; anything longer is a free-text field
// that slipped through and should not be minting keys.
export const BREAKDOWN_MAX_LABEL = 40;

export type BreakdownCounts = Record<string, Record<string, Record<string, number>>>;

// A bucket label Firestore can hold as a map key, or null to skip. Rejects
// the empty string, over-long values, and the dotted/slashed forms that are
// awkward as field paths.
export function breakdownBucket(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v || v.length > BREAKDOWN_MAX_LABEL) return null;
  if (/[./[\]*~]/.test(v)) return null;
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
    const bucket = breakdownBucket(src[dim]);
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
