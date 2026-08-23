// engagement.ts — rung 1's device half (R2/D253): the anonymous feature
// tally. docs/ENGAGEMENT-PLAN.md §4.1 is the argument; this file is the
// whole client surface of it.
//
// WHAT IT IS. A per-day counter map in memory, mirrored to
// `insight.engagement.v1`, and — once the day is OVER — one create-only
// shard written to `v2_attention/{randomId}`: bucketed counts of which
// features this device used, under a fresh random id, with no uid, no
// name, no anchor and no question id. The nightly fold sums the shards
// into the public day doc and DELETES them (functions/src/engagement.ts),
// so the raw pile never accumulates into the per-user funnel this rung
// promises not to be.
//
// THE COST RULE (ATTENTION.md §1, treated as binding by D164): never an
// event per impression. Seams call note() — a memory increment — and the
// server hears ONE write per device per day, after the day ends. Flushing
// yesterday rather than today keeps the shard create-only: no rules arm
// for mid-day updates exists to be widened later.
//
// THE TWO-CHANNEL RULE (the plan's hard line): this shard is the QUESTION
// channel's carrier and the FEATURE tally — it may never carry a uid, and
// the per-question map (R4/D254) stays out until that record is adopted;
// the rules pin `qids` absent-or-empty, so per-question collection is
// structurally off, not merely polite.
//
// UNLINKABILITY IS LOAD-BEARING: the shard id is random PER WRITE, so two
// days from one phone cannot be joined — or it is a per-user funnel with
// extra steps (ATTENTION.md §4). Nothing here may add a stable device
// token, an install id, or anything derived from one.
//
// INERT UNTIL ARMED. Importing this module does nothing; every note() is
// a no-op until initLive() calls arm() with a writer — which is what
// keeps the demo build, the ui unit tests and the jsdom mounts free of
// tallies without any test-mode flag. The seams (vote in live.ts, the
// shell's tab/stop/overlay effects, the feed's pass/seen sites, the lens
// row, the duel reveal, the push tap) all call the same note().

export const LS_KEY = "insight.engagement.v1";

/** The sampling lever (ATTENTION.md §4: 10% of devices answers a feature
 * question as well as 100% and costs a tenth). 1 for launch — at
 * launch-sized DAU a sample would leave the panel reading noise — and
 * the constant to drop when the fold's read budget starts to matter; the
 * shard carries the rate so the fold can scale its estimates either way. */
export const SHARD_SAMPLE_RATE = 1;

/** A tally older than this is dropped, not flushed: the rules arm refuses
 * days older than its window (clock-skew allowance included), and a
 * phone dormant for a week is a retention fact the digest already sees —
 * its lost feature tally is priced, stated, and small. */
export const MAX_SHARD_AGE_DAYS = 7;

/** Counts leave the device as BUCKETS, never exact (ATTENTION.md §4: an
 * exact 137 is a fingerprint; a bucket is not): 0 · 1–2 · 3–5 · 6–10 ·
 * 11+ → indexes 0..4. The fold's midpoint estimates live server-side. */
export function bucketize(n: number): number {
  if (n <= 0) return 0;
  if (n <= 2) return 1;
  if (n <= 5) return 2;
  if (n <= 10) return 3;
  return 4;
}

/** The counter vocabulary — one key per feature reading the plan's §3
 * catalogue marked ○. A note() with a key off this list is ignored (and
 * the test pins the list), so a typo'd seam cannot mint a field the
 * rules arm would then refuse the whole shard over. */
export const S_KEYS = [
  "opens", "slowBoots", "errors",
  "tabDaily", "tabMirror", "overlays",
  "stopYou", "stopNear", "stopCircle", "stopGroups", "stopCity", "stopCountry", "stopWorld",
  "lensPeople", "lensCompare", "lensExplore", "lensScores",
  "feedSeen", "feedPass", "feedDefer",
  "ansDaily", "ansFeed", "ansTest", "ansLearn", "ansPulse", "ansCall", "ansDuel", "edits",
  "revealSeen", "notifOpen",
] as const;
export type SKey = (typeof S_KEYS)[number];
const S_KEY_SET: ReadonlySet<string> = new Set(S_KEYS);

export interface AttentionShard {
  day: string;
  build: number;
  platform: string;
  sampled: true;
  rate: number;
  s: Record<string, number>; // bucket indexes 0..4
}

export interface ArmCtx {
  /** Writes one shard; the Firestore SDK's offline queue owns delivery,
   * so the caller fires and forgets — a rollup written on a dead train
   * arrives when the phone wakes. */
  write(shard: AttentionShard): Promise<void>;
  build: number;
  nowMs?: () => number;
  rand?: () => number;
}

interface DayTally {
  sampled: boolean;
  s: Record<string, number>; // exact ints, device-local only
}
interface Stored {
  v: 1;
  days: Record<string, DayTally>;
}

const pad = (n: number) => String(n).padStart(2, "0");
export function utcDay(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

// window.Capacitor rather than an import: the runtime injects the global
// on native, and a global read keeps this module import-free for the
// node-environment tests (the deviceBind mock burden, avoided).
function platformName(): string {
  try {
    const cap = (globalThis as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
    const p = cap?.getPlatform?.();
    if (p === "ios" || p === "android") return p;
  } catch { /* best-effort */ }
  return "web";
}

let armed: ArmCtx | null = null;
let days: Record<string, DayTally> = {};
let loaded = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let listenersOn = false;

function now(): number {
  return armed?.nowMs ? armed.nowMs() : Date.now();
}
function rand(): number {
  return armed?.rand ? armed.rand() : Math.random();
}

function load(): void {
  if (loaded) return;
  loaded = true;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Stored;
      if (parsed && parsed.v === 1 && parsed.days && typeof parsed.days === "object") {
        days = parsed.days;
      }
    }
  } catch { /* best-effort */ }
}

// Coalesced: note() fires per tap and per card, and a localStorage write
// per increment would be the event-stream cost model sneaking back in at
// the disk. The pending write flushes on hide — the last callback a
// mobile WebView is guaranteed (the initLive visibility handler's own
// reasoning) — so at most ~2s of taps can be lost to a kill.
function save(): void {
  if (saveTimer) return;
  saveTimer = setTimeout(saveNow, 2000);
}
function saveNow(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ v: 1, days } satisfies Stored));
  } catch { /* best-effort */ }
}

function ensureToday(): DayTally | null {
  const day = utcDay(now());
  let t = days[day];
  if (!t) {
    // The day's coin, drawn once: an unsampled day tallies nothing at
    // all — there is nothing half-collected to explain.
    t = { sampled: rand() < SHARD_SAMPLE_RATE, s: {} };
    days[day] = t;
    save();
    // A new day starting means at least one old one may be owed.
    void flushPast();
  }
  return t.sampled ? t : null;
}

/** Flush every finished, sampled day as one shard each; drop what the
 * rules window would refuse anyway. Local state is cleared as soon as
 * the write is HANDED to the SDK — the offline queue owns it from there,
 * and re-writing on the next boot would double-count a shard the queue
 * already delivered. */
export async function flushPast(): Promise<void> {
  if (!armed) return;
  load();
  const today = utcDay(now());
  const cutoff = utcDay(now() - MAX_SHARD_AGE_DAYS * 86400000);
  let changed = false;
  for (const [day, tally] of Object.entries(days)) {
    if (day >= today) continue;
    delete days[day];
    changed = true;
    if (!tally.sampled || day < cutoff) continue;
    const s: Record<string, number> = {};
    for (const [k, v] of Object.entries(tally.s)) {
      if (S_KEY_SET.has(k) && v > 0) s[k] = bucketize(v);
    }
    const shard: AttentionShard = {
      day,
      build: armed.build,
      platform: platformName(),
      sampled: true,
      rate: SHARD_SAMPLE_RATE,
      s,
    };
    armed.write(shard).catch(() => {
      // A REFUSED write (rules window passed while queued, misconfig) is
      // one lost anonymous tally — logged nowhere on purpose: wiring
      // reportError here would couple every seam's import graph to
      // Sentry's for a loss the design already prices as acceptable.
    });
  }
  if (changed) saveNow();
}

/** The one entry point every seam calls. A no-op until armed, a no-op on
 * an unsampled day, a memory increment otherwise. */
export function note(key: SKey): void {
  if (!armed) return;
  if (!S_KEY_SET.has(key)) return;
  load();
  const t = ensureToday();
  if (!t) return;
  t.s[key] = (t.s[key] || 0) + 1;
  save();
}

/** The vote path's seam (live.ts), with the surface→key mapping held
 * here so it is tested where the vocabulary lives. The two duel halves
 * merge — which duel MODE ran is the reveal fold's fact, not this
 * tally's — and an unknown surface is ignored, never guessed. */
export function noteAnswer(surface: string): void {
  const k: SKey | null =
    surface === "daily" ? "ansDaily"
    : surface === "feed" ? "ansFeed"
    : surface === "test" ? "ansTest"
    : surface === "learn" ? "ansLearn"
    : surface === "pulse" ? "ansPulse"
    : surface === "call" ? "ansCall"
    : surface === "group" || surface === "duo" ? "ansDuel"
    : null;
  if (k) note(k);
}

/** Called by initLive() once the live session exists — never by tests'
 * mounts, never by the demo build, which is the whole inertness story. */
export function arm(ctx: ArmCtx): void {
  armed = ctx;
  load();
  if (!listenersOn && typeof document !== "undefined" && typeof document.addEventListener === "function") {
    listenersOn = true;
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        saveNow();
      } else {
        // A new foreground is an "open", and the cheapest rollover check
        // there is: ensureToday() starts the new day's tally and kicks
        // the flush of the finished one.
        note("opens");
      }
    });
  }
  note("opens");
  // Let boot finish first: the flush is one queued write and can wait
  // out the hydrate burst.
  setTimeout(() => { void flushPast(); }, 8000);
}

// The D51 purge: drop to fresh-boot state and do NOT write the key back —
// a save() here would re-create what purgeLocalTrace just deleted, which
// is the exact resurrection scripts/check-purge-listeners.mjs exists to
// prevent. Registered at module scope (guarded for plain-node tests) so
// the listener exists whether or not the session ever arms.
if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("insight:local-purge", () => {
    days = {};
    loaded = true; // fresh-boot state IS the loaded state now
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
  });
}

/** Test seams — state injection without exporting the mutable internals. */
export function _engagementForTest(): {
  armed: boolean;
  days: Record<string, DayTally>;
  reset: () => void;
  saveNow: () => void;
} {
  return {
    armed: !!armed,
    days,
    reset: () => {
      armed = null;
      days = {};
      loaded = false;
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
    },
    saveNow,
  };
}
