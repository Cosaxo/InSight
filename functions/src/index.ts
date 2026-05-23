// insight-functions/index.ts — server-side compute for InSight.
//
// Current scope:
//   - rebuildAreaAggregates / scheduledAreaAggregates: rolls up Big
//     Five vectors per geohash5 cell with k-anonymity.
//   - deleteAccount: user-triggered account wipe. Walks every doc
//     owned by the user + every reference to them in others' subtrees
//     and deletes them, then drops the auth user. App Store + Play
//     Store both require this for any app with sign-up.
//
// All functions use the admin SDK, which bypasses Firestore rules.
// The rules layer is for client traffic; functions can do anything.

import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";

initializeApp();

// k-anonymity floor for area aggregates. Cells with fewer
// contributors are dropped entirely (and any previously-published
// doc gets deleted). 20 is the standard "production privacy" floor;
// for early testing in low-density regions, drop this temporarily.
const K_ANON_FLOOR = 20;

// Share-pref keys. Mirrors SHARE_DATA in SharingOverlay.
const SHARE_KEY_BIG5 = "big5";
const SHARE_KEY_POLITICAL = "political";
const SHARE_KEY_MORALS = "morals";
const SHARE_KEY_MEDIA = "media";

// Media categories — mirror MediaKey in the app (music/film/books/
// podcasts). Favourites live on the profile as media[category]: string[].
const MEDIA_CATEGORIES = ["music", "film", "books", "podcasts"] as const;
type MediaCategory = (typeof MEDIA_CATEGORIES)[number];

interface MediaItemCount {
  name: string;
  count: number;
}
type MediaTop = Partial<Record<MediaCategory, MediaItemCount[]>>;

// The six political axes (matches POLITICAL_KEY in useProfile.ts).
const POLITICAL_AXES = [
  "econ",
  "social",
  "foreign",
  "env",
  "tech",
  "auth",
] as const;

// The eight moral axes (matches MORAL_KEYS in useProfile.ts).
const MORAL_AXES = [
  "tech",
  "future",
  "duty",
  "hedonism",
  "meaning",
  "moral",
  "altruism",
  "beauty",
] as const;

interface UserProfileLike {
  personality?: number[];
  political?: { econ?: number; social?: number };
  politicalAxes?: Record<string, number>;
  morals?: Record<string, number>;
  sharePrefs?: Record<string, string>;
  media?: Record<string, unknown>;
}

// The media share level (default "world" when unset — favourites are
// low-sensitivity, like the "books" category). Levels: nobody / circle
// / city / world. A given level lets favourites count toward a public
// scope: "world" → world + city + area; "city" → city + area; anything
// else → no public aggregation.
function mediaLevel(p: UserProfileLike): string {
  return p.sharePrefs?.[SHARE_KEY_MEDIA] ?? "world";
}

function pickMedia(p: UserProfileLike): Partial<Record<MediaCategory, string[]>> {
  const out: Partial<Record<MediaCategory, string[]>> = {};
  const m = p.media;
  if (!m || typeof m !== "object") return out;
  for (const cat of MEDIA_CATEGORIES) {
    const list = (m as Record<string, unknown>)[cat];
    if (Array.isArray(list)) {
      out[cat] = list.filter((x): x is string => typeof x === "string");
    }
  }
  return out;
}

// Tally distinct media items per category across users (each user
// counts a given item once) and return the top-k per category.
function topMedia(
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

interface DiscoverableLike {
  geohash?: string;
  uid?: string;
}

// Per-axis aggregate stats for a single (cell, axis-set) pair.
interface AxisStats {
  count: number;
  mean: number[];
  stdev: number[];
}

// One geohash5 cell's full rollup. `count` is the count for Big5
// (the most common opt-in); politics / values each carry their own
// counts because users can independently opt out of them.
interface AggregateDoc {
  geohash5: string;
  // Backwards-compat: top-level count + mean + stdev mirror big5.
  // Existing clients reading the old shape still work.
  count: number;
  mean: number[];
  stdev: number[];
  // New: per-vector aggregates. Each is undefined when no users in
  // the cell consented to that vector.
  big5?: AxisStats;
  political?: AxisStats;       // length-6: econ/social/foreign/env/tech/auth
  morals?: AxisStats;          // length-8 in MORAL_AXES order
  // Top media favourites among people in this cell (per category).
  media?: MediaTop;
  updatedAt: FieldValue;
}

// Compute mean and standard deviation per-axis across N vectors.
// All vectors must be the same length; we use the first one to size
// the result arrays.
function summarise(
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

// Pull a 6-axis political vector off a profile. Returns null when
// the user hasn't taken the political test (politicalAxes will be
// missing or incomplete).
function politicalVector(p: UserProfileLike): number[] | null {
  const ax = p.politicalAxes ?? {};
  // Fall back to the 2-axis `political` for econ/social when the
  // full 6-axis store isn't present (the test always writes both,
  // but tolerate older clients that only wrote `political`).
  const econ = ax.econ ?? p.political?.econ;
  const social = ax.social ?? p.political?.social;
  const values: number[] = [];
  const axes: Record<string, number | undefined> = {
    econ,
    social,
    foreign: ax.foreign,
    env: ax.env,
    tech: ax.tech,
    auth: ax.auth,
  };
  for (const axis of POLITICAL_AXES) {
    const v = axes[axis];
    if (typeof v !== "number") return null;
    values.push(v);
  }
  return values;
}

// Pull an 8-axis morals vector off a profile.
function moralsVector(p: UserProfileLike): number[] | null {
  const m = p.morals;
  if (!m) return null;
  const values: number[] = [];
  for (const axis of MORAL_AXES) {
    const v = m[axis];
    if (typeof v !== "number") return null;
    values.push(v);
  }
  return values;
}

// Bucket of vectors per (cell, axis-set) — three streams collected
// in one pass over discoverable users.
interface CellBuckets {
  big5: number[][];
  political: number[][];
  morals: number[][];
  media: Array<Partial<Record<MediaCategory, string[]>>>;
}

async function runAggregation(): Promise<{
  cellsWritten: number;
  cellsDeleted: number;
  usersConsidered: number;
  usersIncluded: number;
}> {
  const db = getFirestore();

  // 1. Read every discoverable doc — these are users who've opted
  //    into having a position.
  const discoverableSnap = await db.collection("insight_discoverable").get();
  logger.info(`[aggregates] ${discoverableSnap.size} discoverable users`);

  // 2. For each one, fetch their profile and bucket into geohash5.
  //    A single user can contribute to any combination of the three
  //    streams (big5 / political / morals) depending on which tests
  //    they've taken and their per-stream sharePrefs.
  const cells: Record<string, CellBuckets> = {};
  // Global media tally — favourites shared at "world" level, counted
  // across the whole discoverable userbase for the World tab.
  const worldMedia: Array<Partial<Record<MediaCategory, string[]>>> = [];
  let usersIncluded = 0;
  for (const docSnap of discoverableSnap.docs) {
    const disc = docSnap.data() as DiscoverableLike;
    const fullHash = disc.geohash;
    if (!fullHash || fullHash.length < 5) continue;
    const hash5 = fullHash.slice(0, 5);

    const profileSnap = await db
      .collection("insight_users")
      .doc(docSnap.id)
      .get();
    if (!profileSnap.exists) continue;
    const profile = profileSnap.data() as UserProfileLike;
    if (!cells[hash5]) {
      cells[hash5] = { big5: [], political: [], morals: [], media: [] };
    }
    const bucket = cells[hash5];
    let contributedSomething = false;

    // Big5 ───────────────
    const b5 = profile.personality;
    const b5Level = profile.sharePrefs?.[SHARE_KEY_BIG5] ?? "circle";
    if (
      Array.isArray(b5) &&
      b5.length === 5 &&
      b5.every((n) => typeof n === "number") &&
      b5Level !== "nobody"
    ) {
      bucket.big5.push(b5);
      contributedSomething = true;
    }

    // Politics ───────────
    const polLevel = profile.sharePrefs?.[SHARE_KEY_POLITICAL] ?? "circle";
    if (polLevel !== "nobody") {
      const pol = politicalVector(profile);
      if (pol) {
        bucket.political.push(pol);
        contributedSomething = true;
      }
    }

    // Morals ─────────────
    const mLevel = profile.sharePrefs?.[SHARE_KEY_MORALS] ?? "circle";
    if (mLevel !== "nobody") {
      const m = moralsVector(profile);
      if (m) {
        bucket.morals.push(m);
        contributedSomething = true;
      }
    }

    // Media ──────────────
    // "city"/"world" → counts toward the area (geohash5) cell;
    // "world" also counts toward the global World-tab tally.
    const medLevel = mediaLevel(profile);
    if (medLevel === "city" || medLevel === "world") {
      const fav = pickMedia(profile);
      bucket.media.push(fav);
      if (medLevel === "world") worldMedia.push(fav);
      contributedSomething = true;
    }

    if (contributedSomething) usersIncluded++;
  }

  // 3. For each cell, write a doc with whichever axis-sets passed
  //    the k-anon floor. A cell with enough Big5 contributors but
  //    not enough political ones writes the Big5 fields and omits
  //    `political`. When ALL three streams are below the floor, the
  //    cell doc is deleted (if it existed) to avoid leaking stale
  //    aggregates.
  const batchWrite = db.batch();
  let cellsWritten = 0;
  let cellsDeleted = 0;
  const existingSnap = await db
    .collection("aggregates_by_geohash5")
    .get();
  const existingCells = new Set(existingSnap.docs.map((d) => d.id));

  for (const [hash5, bucket] of Object.entries(cells)) {
    const b5Ok = bucket.big5.length >= K_ANON_FLOOR;
    const polOk = bucket.political.length >= K_ANON_FLOOR;
    const mOk = bucket.morals.length >= K_ANON_FLOOR;
    const mediaOk = bucket.media.length >= K_ANON_FLOOR;
    if (!b5Ok && !polOk && !mOk && !mediaOk) {
      if (existingCells.has(hash5)) {
        batchWrite.delete(
          db.collection("aggregates_by_geohash5").doc(hash5),
        );
        cellsDeleted++;
      }
      continue;
    }
    const big5Stats = b5Ok ? summarise(bucket.big5) : null;
    const polStats = polOk ? summarise(bucket.political) : null;
    const mStats = mOk ? summarise(bucket.morals) : null;
    const mediaTop = mediaOk ? topMedia(bucket.media, 5) : null;
    const doc: AggregateDoc = {
      geohash5: hash5,
      // Backwards-compat fields for clients reading the old shape.
      // Mirror big5 when present; otherwise fall back to the first
      // axis-set that passed (so something useful gets written).
      count: big5Stats?.mean.length
        ? bucket.big5.length
        : polStats?.mean.length
          ? bucket.political.length
          : bucket.morals.length,
      mean: big5Stats?.mean ?? polStats?.mean ?? mStats?.mean ?? [],
      stdev: big5Stats?.stdev ?? polStats?.stdev ?? mStats?.stdev ?? [],
      updatedAt: FieldValue.serverTimestamp(),
      ...(big5Stats && {
        big5: {
          count: bucket.big5.length,
          mean: big5Stats.mean,
          stdev: big5Stats.stdev,
        },
      }),
      ...(polStats && {
        political: {
          count: bucket.political.length,
          mean: polStats.mean,
          stdev: polStats.stdev,
        },
      }),
      ...(mStats && {
        morals: {
          count: bucket.morals.length,
          mean: mStats.mean,
          stdev: mStats.stdev,
        },
      }),
      ...(mediaTop && Object.keys(mediaTop).length > 0 && { media: mediaTop }),
    };
    batchWrite.set(db.collection("aggregates_by_geohash5").doc(hash5), doc);
    cellsWritten++;
    existingCells.delete(hash5);
  }

  // Cells that previously had aggregates but had zero contributors
  // this run — drop them too.
  for (const orphan of existingCells) {
    batchWrite.delete(db.collection("aggregates_by_geohash5").doc(orphan));
    cellsDeleted++;
  }

  // Global media tally for the World tab — one doc, read by everyone.
  // Below the floor we write an empty doc so the client can tell
  // "ran, but not enough sharers yet" from "never ran".
  batchWrite.set(db.collection("aggregates_media").doc("world"), {
    updatedAt: FieldValue.serverTimestamp(),
    contributors: worldMedia.length,
    media: worldMedia.length >= K_ANON_FLOOR ? topMedia(worldMedia, 12) : {},
  });

  await batchWrite.commit();
  logger.info(
    `[aggregates] done: ${cellsWritten} written, ${cellsDeleted} deleted, ${usersIncluded}/${discoverableSnap.size} users`,
  );

  return {
    cellsWritten,
    cellsDeleted,
    usersConsidered: discoverableSnap.size,
    usersIncluded,
  };
}

// HTTPS-callable for manual / dev runs. Restricted to signed-in
// users; anyone with an account can kick the aggregator. Idempotent
// + cheap (one batch write at the end), so no harm in casual
// invocations.
export const rebuildAreaAggregates = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "must be signed in");
    }
    return runAggregation();
  },
);

// Scheduled every 6 hours. Keeps the aggregates fresh as users come
// + go discoverable. Time zone defaults to Etc/UTC.
export const scheduledAreaAggregates = onSchedule(
  { schedule: "every 6 hours", region: "us-central1" },
  async () => {
    await runAggregation();
  },
);


// ── World aggregates ────────────────────────────────────────────
//
// Pre-rolls a single \`aggregates_world/snapshot\` doc that the World
// tab subscribes to. Reads every \`insight_discoverable\` doc (public
// projection of profile data, already opt-in via SharingOverlay),
// groups by country, computes personality + demographics + top
// interests per country and globally, writes one doc.
//
// Cost-efficient by design: one Firestore write per day, reads
// scale with discoverable-user count. At 100,000 users an
// invocation costs cents. Client reads one doc to render the
// entire World tab content.
//
// k-anonymity: per-country breakdowns appear only when the country
// has \`WORLD_K_ANON_FLOOR\` users. Smaller countries roll up into
// "other" globally rather than appearing identifiable.

const WORLD_K_ANON_FLOOR = 20;

interface CountryBreakdown {
  userCount: number;
  personalityAvg: number[] | null;
  genderRatio: Record<string, number>;
  ageBuckets: Record<string, number>;
  topInterests: { name: string; count: number }[];
  topImpressions: { trait: string; count: number }[];
}

interface WorldSnapshot {
  updatedAt: FirebaseFirestore.FieldValue;
  totalUsers: number;
  countriesRepresented: number;
  globalPersonalityAvg: number[] | null;
  globalTopInterests: { name: string; count: number }[];
  globalTopImpressions: { trait: string; count: number }[];
  byCountry: Record<string, CountryBreakdown>;
}

interface DiscoverableProjection {
  personality?: number[];
  gender?: string;
  age?: number;
  country?: string;
  interestNames?: string[];
}

function ageBucket(age: number): string {
  if (age < 20) return "<20";
  if (age < 30) return "20-29";
  if (age < 40) return "30-39";
  if (age < 50) return "40-49";
  return "50+";
}

function tally<T extends string>(values: T[]): Record<string, number> {
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

function averagePersonality(vectors: number[][]): number[] | null {
  if (vectors.length === 0) return null;
  const sums = [0, 0, 0, 0, 0];
  for (const v of vectors) {
    for (let i = 0; i < 5; i++) sums[i] += v[i];
  }
  return sums.map((s) => Math.round(s / vectors.length));
}

function topInterests(
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

// Walk every user's insight_inbound_impressions subcollection and
// bucket the trait counts by the recipient's country / city. The
// recipient's country/city is what matters here — these are
// impressions LEFT FOR people in that place, so they describe how
// that place's people get read by others.
//
// Aggregated into:
//   - aggregates_world/snapshot.byCountry[ISO].topImpressions
//   - aggregates_city/{slug}.topImpressions
// K-anonymity: per-bucket floor of 5 raters (counted via the
// number of distinct senderUid contributions to each trait).
async function rollUpImpressions(): Promise<{
  recipientsWithCountry: Map<string, Map<string, Set<string>>>;
  recipientsWithCity: Map<string, Map<string, Set<string>>>;
}> {
  const db = getFirestore();
  // Map<country, Map<trait, Set<senderUid>>>
  const byCountry = new Map<string, Map<string, Set<string>>>();
  const byCity = new Map<string, Map<string, Set<string>>>();

  // First read every discoverable doc — gives us each user's
  // country and a rough "their city" (the slug we'd compute for
  // their cityName ratings, which we approximate via their
  // displayName-ish… actually no, cities are only known from the
  // recipient's city ratings). To avoid building a per-user
  // recipient→city map (expensive), we only bucket by country
  // here and let the per-city aggregator below handle the city
  // dimension when it walks city-ratings.
  const discoverable = await db.collection("insight_discoverable").get();
  const userCountry = new Map<string, string>();
  discoverable.forEach((d) => {
    const data = d.data();
    if (typeof data.country === "string" && data.country.length === 2) {
      userCountry.set(d.id, data.country.toUpperCase());
    }
  });

  // Walk every inbound-impressions subcollection. The
  // collectionGroup query reads across all users.
  const impressions = await db.collectionGroup("insight_inbound_impressions").get();
  impressions.forEach((doc) => {
    // doc.ref.parent.parent points at the user doc that owns this
    // subcollection — that's the recipient.
    const recipientUid = doc.ref.parent.parent?.id;
    if (!recipientUid) return;
    const country = userCountry.get(recipientUid);
    if (!country) return;
    const data = doc.data() as { senderUid?: unknown; traits?: unknown };
    if (typeof data.senderUid !== "string") return;
    if (!Array.isArray(data.traits)) return;
    if (!byCountry.has(country)) byCountry.set(country, new Map());
    const traits = byCountry.get(country)!;
    for (const raw of data.traits) {
      if (typeof raw !== "string") continue;
      const trait = raw.trim().toLowerCase();
      if (!trait) continue;
      if (!traits.has(trait)) traits.set(trait, new Set());
      traits.get(trait)!.add(data.senderUid);
    }
  });

  // City bucketing — uses the city-rating doc IDs as a proxy for
  // "this user is associated with this city". The slug computation
  // matches slugifyCity above.
  const cityRatings = await db.collectionGroup("insight_cityratings").get();
  // Map<userUid, Set<citySlug>>
  const userCities = new Map<string, Set<string>>();
  cityRatings.forEach((d) => {
    const recipientUid = d.ref.parent.parent?.id;
    if (!recipientUid) return;
    const slug = slugifyCity(d.id);
    if (!slug) return;
    if (!userCities.has(recipientUid)) userCities.set(recipientUid, new Set());
    userCities.get(recipientUid)!.add(slug);
  });
  // Walk impressions a second time, bucketing by each recipient's
  // city slugs. A recipient can contribute to multiple city
  // buckets (everywhere they've rated).
  impressions.forEach((doc) => {
    const recipientUid = doc.ref.parent.parent?.id;
    if (!recipientUid) return;
    const cities = userCities.get(recipientUid);
    if (!cities || cities.size === 0) return;
    const data = doc.data() as { senderUid?: unknown; traits?: unknown };
    if (typeof data.senderUid !== "string") return;
    if (!Array.isArray(data.traits)) return;
    for (const slug of cities) {
      if (!byCity.has(slug)) byCity.set(slug, new Map());
      const traits = byCity.get(slug)!;
      for (const raw of data.traits) {
        if (typeof raw !== "string") continue;
        const trait = raw.trim().toLowerCase();
        if (!trait) continue;
        if (!traits.has(trait)) traits.set(trait, new Set());
        traits.get(trait)!.add(data.senderUid);
      }
    }
  });
  return {
    recipientsWithCountry: byCountry,
    recipientsWithCity: byCity,
  };
}

const IMPRESSION_K_ANON_FLOOR = 5;

function topImpressionsFromRollup(
  rollup: Map<string, Set<string>>,
  k: number,
): { trait: string; count: number }[] {
  return Array.from(rollup.entries())
    .map(([trait, senders]) => ({ trait, count: senders.size }))
    .filter((x) => x.count >= IMPRESSION_K_ANON_FLOOR)
    .sort((a, b) => b.count - a.count)
    .slice(0, k);
}

async function runWorldAggregation(): Promise<{
  totalUsers: number;
  countriesRepresented: number;
}> {
  const db = getFirestore();
  logger.info("[worldAgg] starting");
  const snap = await db.collection("insight_discoverable").get();
  const projections: DiscoverableProjection[] = [];
  snap.forEach((doc) => {
    const d = doc.data();
    const personality =
      Array.isArray(d.personality) &&
      (d.personality as unknown[]).length === 5 &&
      (d.personality as unknown[]).every((n) => typeof n === "number")
        ? (d.personality as number[])
        : undefined;
    const gender =
      typeof d.gender === "string" &&
      ["man", "woman", "non-binary", "prefer-not-to-say"].includes(d.gender)
        ? d.gender
        : undefined;
    const age =
      typeof d.age === "number" && d.age >= 10 && d.age <= 130
        ? d.age
        : undefined;
    const country =
      typeof d.country === "string" && d.country.length === 2
        ? d.country.toUpperCase()
        : undefined;
    const interestNames = Array.isArray(d.interestNames)
      ? (d.interestNames as unknown[]).filter(
          (x): x is string => typeof x === "string",
        )
      : undefined;
    projections.push({ personality, gender, age, country, interestNames });
  });

  const totalUsers = projections.length;
  logger.info(`[worldAgg] read ${totalUsers} discoverable docs`);

  // Impressions rollup — written by other users about people in
  // each country. K-anonymity floor is applied per trait inside
  // topImpressionsFromRollup, so smaller countries simply yield
  // an empty topImpressions list.
  const { recipientsWithCountry: impressionsByCountry } =
    await rollUpImpressions();

  // Group by country code.
  const byCountryRaw = new Map<string, DiscoverableProjection[]>();
  for (const p of projections) {
    if (!p.country) continue;
    if (!byCountryRaw.has(p.country)) byCountryRaw.set(p.country, []);
    byCountryRaw.get(p.country)!.push(p);
  }

  const byCountry: Record<string, CountryBreakdown> = {};
  for (const [code, group] of byCountryRaw) {
    if (group.length < WORLD_K_ANON_FLOOR) continue;
    const personalities = group
      .map((g) => g.personality)
      .filter((p): p is number[] => Array.isArray(p));
    const genders = group
      .map((g) => g.gender)
      .filter((v): v is string => !!v);
    const ages = group
      .map((g) => g.age)
      .filter((v): v is number => typeof v === "number")
      .map(ageBucket);
    const interestLists = group
      .map((g) => g.interestNames)
      .filter((v): v is string[] => Array.isArray(v));
    byCountry[code] = {
      userCount: group.length,
      personalityAvg:
        personalities.length >= WORLD_K_ANON_FLOOR
          ? averagePersonality(personalities)
          : null,
      genderRatio: tally(genders),
      ageBuckets: tally(ages),
      topInterests: topInterests(interestLists, 8),
      topImpressions: topImpressionsFromRollup(
        impressionsByCountry.get(code) ?? new Map(),
        8,
      ),
    };
  }

  // Global aggregates (no country grouping; k-anon still enforced).
  const globalPersonalityVectors = projections
    .map((p) => p.personality)
    .filter((v): v is number[] => Array.isArray(v));
  const globalInterestLists = projections
    .map((p) => p.interestNames)
    .filter((v): v is string[] => Array.isArray(v));

  // Global impressions roll-up — flatten every country's
  // trait-sender map into one bucket and re-aggregate.
  const globalImpressions = new Map<string, Set<string>>();
  for (const traitMap of impressionsByCountry.values()) {
    for (const [trait, senders] of traitMap) {
      if (!globalImpressions.has(trait)) globalImpressions.set(trait, new Set());
      const target = globalImpressions.get(trait)!;
      for (const s of senders) target.add(s);
    }
  }

  const snapshot: WorldSnapshot = {
    updatedAt: FieldValue.serverTimestamp(),
    totalUsers,
    countriesRepresented: Object.keys(byCountry).length,
    globalPersonalityAvg:
      globalPersonalityVectors.length >= WORLD_K_ANON_FLOOR
        ? averagePersonality(globalPersonalityVectors)
        : null,
    globalTopInterests: topInterests(globalInterestLists, 12),
    globalTopImpressions: topImpressionsFromRollup(globalImpressions, 12),
    byCountry,
  };

  await db.collection("aggregates_world").doc("snapshot").set(snapshot);
  logger.info(
    `[worldAgg] wrote snapshot · ${totalUsers} users · ${Object.keys(byCountry).length} countries`,
  );
  return {
    totalUsers,
    countriesRepresented: Object.keys(byCountry).length,
  };
}

export const rebuildWorldAggregates = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "must be signed in");
    }
    return runWorldAggregation();
  },
);

// Scheduled daily. Cost-efficient: one full pass per day produces
// one doc, every client reads that one doc.
export const scheduledWorldAggregates = onSchedule(
  { schedule: "every 24 hours", region: "us-central1" },
  async () => {
    await runWorldAggregation();
  },
);


// ── City aggregates ─────────────────────────────────────────────
//
// Walks every \`insight_cityratings\` subcollection across the
// userbase (via a collectionGroup query) and rolls up per-city
// per-dimension averages into \`aggregates_city/{citySlug}\`.
// Each subscriber to the City tab then reads ONE doc per city
// they care about — far cheaper than each client fanning out.
//
// City names come from user input (free text) so we slugify
// (lowercase + alnum) when bucketing. Doc IDs in the user's
// subcollection remain the original casing for human-readable
// localStorage backups; the aggregator does the normalization.

const CITY_K_ANON_FLOOR = 3;
const CITY_DIMENSIONS = [
  "beauty",
  "commute",
  "safety",
  "culture",
  "nature",
  "food",
  "cost",
] as const;

function slugifyCity(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

interface CityAggregate {
  cityKey: string;
  displayName: string;
  updatedAt: FirebaseFirestore.FieldValue;
  totalRaters: number;
  byDimension: Record<string, { avg: number; count: number }>;
  // Personality + media of the people who've rated this city — the
  // honest per-city profile signal (distinct from the geohash5 area
  // cell). Each is omitted when below the k-anon floor.
  personality?: { count: number; mean: number[] };
  media?: MediaTop;
  topImpressions: { trait: string; count: number }[];
}

async function runCityAggregation(): Promise<{
  citiesProcessed: number;
  citiesAboveFloor: number;
}> {
  const db = getFirestore();
  logger.info("[cityAgg] starting");
  // collectionGroup walks every "insight_cityratings" subcollection
  // across all users. Admin SDK bypasses Firestore rules so it
  // can read everyone's ratings.
  const snap = await db.collectionGroup("insight_cityratings").get();
  logger.info(`[cityAgg] read ${snap.size} rating docs`);

  // Per city slug: dimension values + a display name + the set of
  // rater uids (so we can pull their personality / media in one
  // deduped profile fetch and attribute it back per city).
  const byCity = new Map<
    string,
    { display: string; dims: Map<string, number[]>; raters: Set<string> }
  >();
  const allRaterUids = new Set<string>();

  snap.forEach((doc) => {
    const cityName = doc.id;
    const slug = slugifyCity(cityName);
    if (!slug) return;
    if (!byCity.has(slug)) {
      byCity.set(slug, { display: cityName, dims: new Map(), raters: new Set() });
    }
    const entry = byCity.get(slug)!;
    const raterUid = doc.ref.parent.parent?.id;
    if (raterUid) {
      entry.raters.add(raterUid);
      allRaterUids.add(raterUid);
    }
    const data = doc.data() as Record<string, unknown>;
    for (const dim of CITY_DIMENSIONS) {
      const v = data[dim];
      if (typeof v === "number" && v >= 1 && v <= 5) {
        if (!entry.dims.has(dim)) entry.dims.set(dim, []);
        entry.dims.get(dim)!.push(v);
      }
    }
  });

  // Fetch each rater's profile once (deduped). Used for the per-city
  // Big Five average + media tally.
  const profiles = new Map<string, UserProfileLike>();
  await Promise.all(
    [...allRaterUids].map(async (uid) => {
      const p = await db.collection("insight_users").doc(uid).get();
      if (p.exists) profiles.set(uid, p.data() as UserProfileLike);
    }),
  );
  // Impressions rollup, keyed by the same city slug.
  const { recipientsWithCity: impressionsByCity } =
    await rollUpImpressions();

  let citiesAboveFloor = 0;
  const batch = db.batch();
  // Cap batch size at 450 to stay under the 500-write hard limit
  // when commits flush.
  let inBatch = 0;
  const commits: Array<Promise<unknown>> = [];

  for (const [slug, entry] of byCity) {
    const byDimension: Record<string, { avg: number; count: number }> = {};
    let total = 0;
    for (const [dim, values] of entry.dims) {
      if (values.length < CITY_K_ANON_FLOOR) continue;
      byDimension[dim] = {
        avg: Math.round(
          (values.reduce((s, v) => s + v, 0) / values.length) * 100,
        ) / 100,
        count: values.length,
      };
      total = Math.max(total, values.length);
    }

    // Per-city Big Five — averaged over raters with a valid vector and
    // big5 sharing on. Independent k-anon floor.
    const big5Vectors: number[][] = [];
    const mediaLists: Array<Partial<Record<MediaCategory, string[]>>> = [];
    for (const uid of entry.raters) {
      const profile = profiles.get(uid);
      if (!profile) continue;
      const b5 = profile.personality;
      const b5Level = profile.sharePrefs?.[SHARE_KEY_BIG5] ?? "circle";
      if (
        Array.isArray(b5) &&
        b5.length === 5 &&
        b5.every((n) => typeof n === "number") &&
        b5Level !== "nobody"
      ) {
        big5Vectors.push(b5);
      }
      // Media counts toward a city when shared at city or world level.
      const mLevel = mediaLevel(profile);
      if (mLevel === "city" || mLevel === "world") {
        mediaLists.push(pickMedia(profile));
      }
    }
    const personality =
      big5Vectors.length >= CITY_K_ANON_FLOOR
        ? { count: big5Vectors.length, mean: summarise(big5Vectors).mean }
        : undefined;
    const media =
      mediaLists.length >= CITY_K_ANON_FLOOR ? topMedia(mediaLists, 5) : undefined;

    if (
      Object.keys(byDimension).length === 0 &&
      !personality &&
      (!media || Object.keys(media).length === 0)
    ) {
      continue;
    }
    citiesAboveFloor += 1;
    const aggregate: CityAggregate = {
      cityKey: slug,
      displayName: entry.display,
      updatedAt: FieldValue.serverTimestamp(),
      totalRaters: total,
      byDimension,
      ...(personality && { personality }),
      ...(media && Object.keys(media).length > 0 && { media }),
      topImpressions: topImpressionsFromRollup(
        impressionsByCity.get(slug) ?? new Map(),
        8,
      ),
    };
    batch.set(db.collection("aggregates_city").doc(slug), aggregate);
    inBatch += 1;
    if (inBatch >= 450) {
      commits.push(batch.commit());
      inBatch = 0;
    }
  }
  if (inBatch > 0) commits.push(batch.commit());
  await Promise.all(commits);

  logger.info(
    `[cityAgg] processed ${byCity.size} cities, ${citiesAboveFloor} above floor`,
  );
  return {
    citiesProcessed: byCity.size,
    citiesAboveFloor,
  };
}

export const rebuildCityAggregates = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "must be signed in");
    }
    return runCityAggregation();
  },
);

export const scheduledCityAggregates = onSchedule(
  { schedule: "every 24 hours", region: "us-central1" },
  async () => {
    await runCityAggregation();
  },
);


// ── sendInboundImpression ───────────────────────────────────────
//
// The only write path for inbound impressions. firestore.rules
// denies client `create` on insight_inbound_impressions outright;
// every legitimate impression flows through here so we can enforce
// a rate limit the rules layer can't express (it has no way to
// count a sender's recent writes across recipients).
//
// This callable re-implements the authorization the rule used to do
// — not-blocked + (in-circle OR follower-with-opt-in OR anyone) —
// because the admin SDK bypasses rules, so we own the gate now.
//
// Rate limit: a per-sender ledger at insight_ratelimits/{senderUid}
// holds recent send timestamps. One transaction prunes the window,
// checks both a per-recipient cap and a global hourly cap, and (when
// under both) reserves the slot + writes the impression atomically.
// A flooding circle member is stopped at the source instead of
// landing dozens of docs that have to be cleaned up after the fact.

const IMPRESSION_LIMITS = {
  // At most this many impressions to the SAME recipient per window.
  perRecipientMax: 3,
  perRecipientWindowMs: 24 * 60 * 60 * 1000, // 24h
  // At most this many impressions to ANYONE per window (anti-spam).
  globalMax: 20,
  globalWindowMs: 60 * 60 * 1000, // 1h
  // Hard cap on retained ledger events so the doc can't grow without
  // bound; we only ever need the longest window's worth.
  ledgerCap: 200,
} as const;

interface SendImpressionData {
  recipientUid?: unknown;
  traits?: unknown;
  context?: unknown;
}

interface LedgerEvent {
  r: string; // recipient uid
  t: number; // epoch ms
}

export const sendInboundImpression = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "must be signed in");
    }
    const senderUid = request.auth.uid;
    const data = (request.data ?? {}) as SendImpressionData;

    // ── Validate input (mirrors isValidInboundImpressionWrite). ──
    const recipientUid = data.recipientUid;
    if (typeof recipientUid !== "string" || recipientUid.length === 0) {
      throw new HttpsError("invalid-argument", "recipientUid required");
    }
    if (recipientUid === senderUid) {
      throw new HttpsError("invalid-argument", "cannot leave an impression on yourself");
    }
    if (
      !Array.isArray(data.traits) ||
      data.traits.length === 0 ||
      data.traits.length > 24 ||
      !data.traits.every((t) => typeof t === "string" && t.length <= 64)
    ) {
      throw new HttpsError("invalid-argument", "traits must be 1-24 short strings");
    }
    const traits = data.traits as string[];
    let context: string | undefined;
    if (data.context !== undefined && data.context !== null) {
      if (typeof data.context !== "string" || data.context.length > 256) {
        throw new HttpsError("invalid-argument", "context too long");
      }
      context = data.context;
    }

    const db = getFirestore();
    const recipientRef = db.collection("insight_users").doc(recipientUid);

    // ── Authorization (admin SDK bypasses rules, so we re-check). ──
    const [blockSnap, circleSnap, followerSnap, profileSnap] =
      await Promise.all([
        recipientRef.collection("blocks").doc(senderUid).get(),
        recipientRef.collection("circle").doc(senderUid).get(),
        recipientRef.collection("followers").doc(senderUid).get(),
        recipientRef.get(),
      ]);

    if (blockSnap.exists) {
      throw new HttpsError("permission-denied", "blocked by recipient");
    }
    const acceptFrom =
      (profileSnap.data()?.acceptImpressionsFrom as string | undefined) ??
      "circle";
    if (acceptFrom === "nobody") {
      throw new HttpsError("permission-denied", "recipient is not accepting impressions");
    }
    const allowed =
      circleSnap.exists ||
      (followerSnap.exists && (acceptFrom === "nearby" || acceptFrom === "anyone")) ||
      acceptFrom === "anyone";
    if (!allowed) {
      throw new HttpsError("permission-denied", "not permitted to leave an impression");
    }

    // ── Rate limit + write, atomically. ──
    const ledgerRef = db.collection("insight_ratelimits").doc(senderUid);
    const impressionRef = recipientRef
      .collection("insight_inbound_impressions")
      .doc();
    const now = Date.now();

    await db.runTransaction(async (tx) => {
      const ledgerSnap = await tx.get(ledgerRef);
      const raw = (ledgerSnap.data()?.impressionEvents as LedgerEvent[]) ?? [];
      // Prune anything older than the longest window we care about.
      const maxWindow = Math.max(
        IMPRESSION_LIMITS.perRecipientWindowMs,
        IMPRESSION_LIMITS.globalWindowMs,
      );
      const events = raw.filter(
        (e) =>
          e &&
          typeof e.t === "number" &&
          typeof e.r === "string" &&
          now - e.t < maxWindow,
      );

      const globalRecent = events.filter(
        (e) => now - e.t < IMPRESSION_LIMITS.globalWindowMs,
      ).length;
      if (globalRecent >= IMPRESSION_LIMITS.globalMax) {
        throw new HttpsError(
          "resource-exhausted",
          "You're sending impressions too quickly. Try again later.",
        );
      }
      const perRecipientRecent = events.filter(
        (e) =>
          e.r === recipientUid &&
          now - e.t < IMPRESSION_LIMITS.perRecipientWindowMs,
      ).length;
      if (perRecipientRecent >= IMPRESSION_LIMITS.perRecipientMax) {
        throw new HttpsError(
          "resource-exhausted",
          "You've already left a few impressions on this person recently.",
        );
      }

      // Under both caps — reserve the slot and write the impression.
      const nextEvents = [...events, { r: recipientUid, t: now }].slice(
        -IMPRESSION_LIMITS.ledgerCap,
      );
      tx.set(ledgerRef, { impressionEvents: nextEvents }, { merge: true });
      tx.set(impressionRef, {
        senderUid,
        traits,
        ...(context !== undefined && { context }),
        createdAt: now,
      });
    });

    logger.info(
      `[sendImpression] ${senderUid} -> ${recipientUid} (${traits.length} traits)`,
    );
    return { ok: true, id: impressionRef.id };
  },
);


// ── deleteAccount ───────────────────────────────────────────────
//
// Walks every doc that belongs to the calling user OR references
// them, deletes each, then drops the Firebase Auth account.
//
// Order matters slightly — we delete the data first, then the auth
// user. If the auth-user delete fails (rare), the next sign-in will
// see an empty profile and the migration won't run (it gates on
// profileExists), so they're effectively in a fresh-account state.
//
// What we wipe (admin SDK, bypasses rules):
//   1. Every doc in insight_users/{uid}/* (all subcollections)
//   2. The user's profile doc insight_users/{uid}
//   3. insight_discoverable/{uid} (if present)
//   4. Inbound impressions the user sent into OTHER users' subtrees
//      — collectionGroup("insight_inbound_impressions") where
//      senderUid == uid
//   5. Relations in OTHER users' subtrees that point at this user
//      — collectionGroup("relations") where linkedUid == uid
//   6. The auth user itself
//
// What we leave (intentional):
//   - aggregates_by_geohash5: the user's Big Five contributed to
//     anonymous averages. Pulling specific contributions back out
//     would either require re-running the aggregator or storing
//     per-user provenance (which would defeat the anonymity). The
//     next scheduled run naturally rebuilds without this user.
//   - circle/{thisUid} marker docs on OTHER users' subtrees: stale
//     after this user is gone (their daily reports can no longer
//     be fetched, so the grant doesn't grant anything), but harmless
//     and finding them all would require another collectionGroup
//     query without an index. The other user can clean them up by
//     removing their relation.

// Delete every doc in a query, in batches of 400 (Firestore batch
// limit is 500; leaving headroom for safety).
async function deleteQueryDocs(
  query: FirebaseFirestore.Query,
): Promise<number> {
  const db = getFirestore();
  let total = 0;
  for (;;) {
    const snap = await query.limit(400).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    total += snap.docs.length;
    if (snap.docs.length < 400) break;
  }
  return total;
}

// Recursively delete every doc under insight_users/{uid}/*.
// Firestore's CLI has `firestore:delete --recursive` but that's
// admin tooling, not callable from a function. We do it by hand:
// list all subcollections, delete their docs, then delete the
// parent doc.
async function deleteUserSubtree(uid: string): Promise<number> {
  const db = getFirestore();
  const userRef = db.collection("insight_users").doc(uid);
  let total = 0;
  // Drop subcollections — listCollections is admin-only.
  const subcollections = await userRef.listCollections();
  for (const sub of subcollections) {
    total += await deleteQueryDocs(sub);
  }
  // Drop the parent doc last so subscriptions don't see a phantom
  // profile with no children mid-delete.
  await userRef.delete();
  total += 1;
  return total;
}

export const deleteAccount = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "must be signed in");
    }
    const uid = request.auth.uid;
    const db = getFirestore();
    logger.info(`[deleteAccount] starting for uid=${uid}`);

    const counts = {
      ownSubtree: 0,
      discoverable: 0,
      othersRelations: 0,
      othersInbound: 0,
    };

    // 1. Wipe insight_users/{uid}/* + the profile doc itself.
    try {
      counts.ownSubtree = await deleteUserSubtree(uid);
    } catch (err) {
      logger.error("[deleteAccount] subtree wipe failed:", err);
    }

    // 2. Drop insight_discoverable/{uid} if present.
    try {
      const discRef = db.collection("insight_discoverable").doc(uid);
      const discSnap = await discRef.get();
      if (discSnap.exists) {
        await discRef.delete();
        counts.discoverable = 1;
      }
    } catch (err) {
      logger.error("[deleteAccount] discoverable wipe failed:", err);
    }

    // 3. Inbound impressions this user sent into other people's
    //    subtrees. Requires a collection-group index on senderUid;
    //    see firestore.indexes.json.
    try {
      const sentQuery = db
        .collectionGroup("insight_inbound_impressions")
        .where("senderUid", "==", uid);
      counts.othersInbound = await deleteQueryDocs(sentQuery);
    } catch (err) {
      logger.error("[deleteAccount] inbound impressions wipe failed:", err);
    }

    // 4. Other users' relations pointing at this user via linkedUid.
    //    Requires a collection-group index on linkedUid.
    try {
      const relQuery = db
        .collectionGroup("relations")
        .where("linkedUid", "==", uid);
      counts.othersRelations = await deleteQueryDocs(relQuery);
    } catch (err) {
      logger.error("[deleteAccount] cross-user relations wipe failed:", err);
    }

    // 5. Finally drop the auth user. Doing this last means any
    //    failure above leaves the user able to retry (they're still
    //    signed in). If THIS step fails, the user is mostly-wiped
    //    but their auth account lingers — they can sign in to a
    //    fresh, empty account.
    try {
      await getAuth().deleteUser(uid);
    } catch (err) {
      logger.error("[deleteAccount] auth.deleteUser failed:", err);
      throw new HttpsError(
        "internal",
        "Account data was wiped, but the auth account couldn't be deleted. Sign out and contact support.",
      );
    }

    logger.info(`[deleteAccount] done for uid=${uid}`, counts);
    return { ok: true, ...counts };
  },
);

// ── Taxonomies ──────────────────────────────────────────────────
//
// Canonical reference data (interest categories, etc.) mirrored into
// a read-only `taxonomies` collection so it can be edited without an
// app redeploy. The client keeps a bundled copy as its offline
// fallback (useTaxonomies), so a missing doc is never fatal.
//
// The data is baked HERE rather than accepted from a client payload:
// these docs are read by every user, so letting an arbitrary caller
// supply their contents would be a global vandalism vector. The
// seeder only ever writes this known-good copy, so it's safe for any
// signed-in user to trigger (idempotent). Keep this in sync with
// src/data/taxonomies.ts.

const TAXONOMY_INTEREST_CATEGORIES = [
  { id: "sports", label: "Sports", hue: 12, glyph: "◉" },
  { id: "outdoor", label: "Outdoor", hue: 145, glyph: "△" },
  { id: "fitness", label: "Fitness", hue: 25, glyph: "↗" },
  { id: "literary", label: "Literary", hue: 38, glyph: "✎" },
  { id: "thought", label: "Thought", hue: 250, glyph: "○" },
  { id: "music", label: "Music", hue: 305, glyph: "♪" },
  { id: "art", label: "Art & craft", hue: 80, glyph: "✦" },
  { id: "games", label: "Games", hue: 200, glyph: "♟" },
  { id: "tech", label: "Tech", hue: 260, glyph: "◇" },
  { id: "food", label: "Food", hue: 30, glyph: "◐" },
  { id: "civic", label: "Civic", hue: 220, glyph: "✚" },
  { id: "faith", label: "Faith", hue: 285, glyph: "✟" },
];

async function runSeedTaxonomies(): Promise<{ written: string[] }> {
  const db = getFirestore();
  const written: string[] = [];
  await db.collection("taxonomies").doc("interest_categories").set({
    items: TAXONOMY_INTEREST_CATEGORIES,
    updatedAt: FieldValue.serverTimestamp(),
  });
  written.push("interest_categories");
  logger.info(`[taxonomies] seeded: ${written.join(", ")}`);
  return { written };
}

export const seedTaxonomies = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "must be signed in");
    }
    return runSeedTaxonomies();
  },
);

// Keep the daily refresh cheap + current as the baked data evolves.
export const scheduledTaxonomies = onSchedule(
  { schedule: "every 24 hours", region: "us-central1" },
  async () => {
    await runSeedTaxonomies();
  },
);
