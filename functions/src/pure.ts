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
