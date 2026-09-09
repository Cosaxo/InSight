// engagement.ts — the device half of the engagement ladder: rung 1's
// anonymous feature tally (R2/D270), its per-question map (R4/D271), and
// rung 2's per-person day rollup (R3/D272). docs/ENGAGEMENT-PLAN.md is
// the argument; this file is the whole client surface of all three.
//
// WHAT IT IS. Counters in memory, mirrored to `insight.engagement.v1`,
// and — once a day is OVER — at most two writes per device:
//
//   · the SHARD (v2_attention/{randomId}): bucketed feature counts and,
//     since D271, capped per-question seen/answer/pass/defer buckets —
//     anonymous, sampled, under a fresh random id, no uid anywhere. The
//     nightly fold sums shards into the public day doc and DELETES them.
//   · the ROLLUP (v2_users/{uid}/engagement/{day}): the person channel —
//     sessions, foreground time (bucketed), quiet sessions, dayparts,
//     depth. Uid-keyed by definition, readable by NOBODY (the rules), a
//     90-day TTL, erased with the account by the recursive delete.
//
// THE TWO-CHANNEL RULE, now with all three pieces live: the rollup NEVER
// carries a question id (the rules' hasOnly is the pin), and the qids map
// rides only the anonymous shard. Answers are the standing exception —
// they carry both by design and publish under D98.
//
// THE COST RULE (ATTENTION.md §1): never an event per impression. Seams
// increment memory; the server hears ≤2 writes per device per day, after
// the day ends. Flushing yesterday keeps both docs create-only.
//
// INERT UNTIL ARMED. Importing this module does nothing; every note() is
// a no-op until initLive() calls arm() — which is what keeps the demo
// build, the ui unit tests and the jsdom mounts silent with no test flag.

export const LS_KEY = "insight.engagement.v1";

/** The sampling lever for the SHARD (ATTENTION.md §4) — the rollup is
 * the person channel and is not sampled. 1 for launch; the shard carries
 * the rate so fold estimates rescale server-side when this drops. The
 * cost model reads this constant from source (ATTN_SAMPLE_RATE). */
export const SHARD_SAMPLE_RATE = 1;

/** A finished day older than this is dropped, not flushed: the rules
 * windows refuse it anyway, and a week-dormant phone is a retention fact
 * the digest already sees. */
export const MAX_SHARD_AGE_DAYS = 7;

/** The qids map's key budget, INCLUDING the overflow cell — mirrored in
 * firestore.rules' size cap. Real qids take at most QIDS_CAP − 1 slots;
 * everything past them counts into QID_OTHER, reported rather than
 * silently dropped (the no-silent-caps rule). */
export const QIDS_CAP = 120;
export const QID_OTHER = "_other";

/** A foreground gap longer than this starts a new session — the
 * boundary is about human attention, not listener billing, which is why
 * it is not live.ts's 60 s IDLE_DETACH_MS. */
export const SESSION_GAP_MS = 30 * 60_000;

/** The rollup's TTL horizon (expireAt = day + this) — D28's window: the
 * uid-keyed trail is rolling; the durable history is the anonymous fold. */
export const ROLLUP_TTL_DAYS = 90;

/** Counts leave the device as BUCKETS (0 · 1–2 · 3–5 · 6–10 · 11+ →
 * 0..4): an exact 137 is a fingerprint on the anonymous channel and an
 * over-sharp reading on the identified one. */
export function bucketize(n: number): number {
  if (n <= 0) return 0;
  if (n <= 2) return 1;
  if (n <= 5) return 2;
  if (n <= 10) return 3;
  return 4;
}

/** Foreground minutes, same shape: none · <5 · <15 · <45 · 45+. */
export function bucketizeMinutes(min: number): number {
  if (min < 1) return 0;
  if (min < 5) return 1;
  if (min < 15) return 2;
  if (min < 45) return 3;
  return 4;
}

/** Local daypart of a session's start — the one deliberately LOCAL
 * reading here (when in THEIR day people come): night 0–5, morning 6–11,
 * afternoon 12–17, evening 18–23. */
export function daypartOf(ms: number): number {
  const h = new Date(ms).getHours();
  return h < 6 ? 0 : h < 12 ? 1 : h < 18 ? 2 : 3;
}

/** The shard counter vocabulary — mirrored in the rules' whitelist; a
 * note() with a key off this list is ignored and the pair is pinned by
 * test on both sides. */
export const S_KEYS = [
  "opens", "slowBoots", "errors",
  "tabDaily", "tabMirror", "tabPatterns", "overlays",
  "stopYou", "stopNear", "stopCircle", "stopGroups", "stopCity", "stopCountry", "stopWorld",
  "lensPeople", "lensCompare", "lensExplore", "lensScores",
  "feedSeen", "feedPass", "feedDefer",
  "ansDaily", "ansFeed", "ansTest", "ansLearn", "ansPulse", "ansCall", "ansDuel", "edits",
  "revealSeen", "notifOpen",
] as const;
export type SKey = (typeof S_KEYS)[number];
const S_KEY_SET: ReadonlySet<string> = new Set(S_KEYS);

// Shard keys that also feed the person channel's counters — the rollup
// is unsampled, so these tally into `r` whether or not the shard coin
// landed.
const R_MAP: Partial<Record<SKey, keyof RollupCounters>> = {
  feedSeen: "feedSeen",
  lensPeople: "lenses", lensCompare: "lenses", lensExplore: "lenses", lensScores: "lenses",
  stopYou: "stops", stopNear: "stops", stopCircle: "stops", stopGroups: "stops",
  stopCity: "stops", stopCountry: "stops", stopWorld: "stops",
};

export type QidKind = "s" | "a" | "p" | "d"; // seen · answered · passed · deferred

export interface AttentionShard {
  day: string;
  build: number;
  platform: string;
  sampled: true;
  rate: number;
  s: Record<string, number>; // bucket indexes 0..4
  qids?: Record<string, Partial<Record<QidKind, number>>>; // buckets, D271
}

export interface EngagementRollup {
  day: string;
  sessions: number;
  fgMin: number; // bucket 0..4
  quiet: number;
  dayparts: [number, number, number, number];
  answers: number;
  feedB: number; // bucket 0..4 of cards seen
  depthEnd: number; // 0|1 — reached the feed's end
  stops: number;
  lenses: number;
  folded: boolean; // false at create; the fold flips it (admin SDK)
  build: number;
  platform: string;
  expireAt: Date;
}

export interface ArmCtx {
  /** Writes one shard; the SDK's offline queue owns delivery. */
  write(shard: AttentionShard): Promise<void>;
  /** Writes one rollup under the CURRENT session's uid; must throw when
   * there is no session, so the tally is retained for the next boot
   * rather than lost. */
  writeRollup(rollup: EngagementRollup): Promise<void>;
  hasUid(): boolean;
  build: number;
  nowMs?: () => number;
  rand?: () => number;
}

interface RollupCounters {
  sessions: number;
  fgMs: number;
  quiet: number;
  dayparts: [number, number, number, number];
  answers: number;
  feedSeen: number;
  depthEnd: number;
  stops: number;
  lenses: number;
}
interface DayTally {
  sampled: boolean;
  s: Record<string, number>; // exact ints, device-local only
  q: Record<string, Partial<Record<QidKind, number>>>; // exact, device-local
  r: RollupCounters;
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

function emptyR(): RollupCounters {
  return {
    sessions: 0, fgMs: 0, quiet: 0, dayparts: [0, 0, 0, 0],
    answers: 0, feedSeen: 0, depthEnd: 0, stops: 0, lenses: 0,
  };
}
// Older stored blobs (pre-D271/D272) lack q/r — normalized on read
// rather than versioned away: the counters they do hold are still true.
function normalize(t: Partial<DayTally> & { sampled?: boolean }): DayTally {
  return {
    sampled: !!t.sampled,
    s: t.s && typeof t.s === "object" ? t.s : {},
    q: t.q && typeof t.q === "object" ? t.q : {},
    r: t.r && typeof t.r === "object" ? { ...emptyR(), ...t.r } : emptyR(),
  };
}

let armed: ArmCtx | null = null;
let days: Record<string, DayTally> = {};
let loaded = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let listenersOn = false;

// session state (armed only; in-memory — a killed app ends its session)
let visibleSince = 0;
let lastHiddenAt = 0;
let sessionOpen = false;
let sessionHadAnswer = false;
let sessionDay = "";

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
        days = {};
        for (const [day, t] of Object.entries(parsed.days)) days[day] = normalize(t);
      }
    }
  } catch { /* best-effort */ }
}

// Coalesced: note() fires per tap and per card, and a localStorage write
// per increment would be the event-stream cost sneaking back in at the
// disk. The pending write flushes on hide — the last callback a mobile
// WebView is guaranteed — so at most ~2s of taps can be lost to a kill.
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

function ensureToday(): DayTally {
  const day = utcDay(now());
  let t = days[day];
  if (!t) {
    // The shard's coin, drawn once per day; the rollup side is never
    // sampled — it is the person channel and one write regardless.
    t = { sampled: rand() < SHARD_SAMPLE_RATE, s: {}, q: {}, r: emptyR() };
    days[day] = t;
    save();
    void flushPast();
  }
  return t;
}

/** Flush every finished day: one shard (if that day was sampled, and
 * young enough for the rules window) and one rollup (if a session
 * exists to own it — otherwise the rollup half is RETAINED for the next
 * boot, since it is uid-keyed and loses nothing by waiting). Local
 * state clears as soon as a write is HANDED to the SDK: the offline
 * queue owns delivery, and re-writing next boot would double-count. */
export async function flushPast(): Promise<void> {
  if (!armed) return;
  load();
  const today = utcDay(now());
  const cutoff = utcDay(now() - MAX_SHARD_AGE_DAYS * 86400000);
  let changed = false;
  for (const [day, tally] of Object.entries(days)) {
    if (day >= today) continue;

    // ── the anonymous shard ─────────────────────────────────
    if (tally.sampled && day >= cutoff) {
      const s: Record<string, number> = {};
      for (const [k, v] of Object.entries(tally.s)) {
        if (S_KEY_SET.has(k) && v > 0) s[k] = bucketize(v);
      }
      const qids: AttentionShard["qids"] = {};
      for (const [qid, kinds] of Object.entries(tally.q)) {
        const out: Partial<Record<QidKind, number>> = {};
        for (const kind of ["s", "a", "p", "d"] as const) {
          const v = kinds[kind] || 0;
          if (v > 0) out[kind] = bucketize(v);
        }
        if (Object.keys(out).length) qids[qid] = out;
      }
      const shard: AttentionShard = {
        day,
        build: armed.build,
        platform: platformName(),
        sampled: true,
        rate: SHARD_SAMPLE_RATE,
        s,
        ...(Object.keys(qids).length ? { qids } : {}),
      };
      armed.write(shard).catch(() => {
        // One lost anonymous tally — priced as acceptable; see D270.
      });
    }
    tally.sampled = false; // never re-shard this day
    tally.s = {};
    tally.q = {};
    changed = true;

    // ── the person rollup ───────────────────────────────────
    const r = tally.r;
    const hasRollup =
      r.sessions > 0 || r.answers > 0 || r.feedSeen > 0 || r.stops > 0 || r.lenses > 0;
    if (!hasRollup || day < cutoff) {
      delete days[day];
      continue;
    }
    if (!armed.hasUid()) continue; // retained — retried next flush
    const rollup: EngagementRollup = {
      day,
      sessions: r.sessions,
      fgMin: bucketizeMinutes(r.fgMs / 60000),
      quiet: r.quiet,
      dayparts: [...r.dayparts] as [number, number, number, number],
      answers: r.answers,
      feedB: bucketize(r.feedSeen),
      depthEnd: r.depthEnd,
      stops: r.stops,
      lenses: r.lenses,
      folded: false,
      build: armed.build,
      platform: platformName(),
      expireAt: new Date(Date.parse(`${day}T00:00:00Z`) + ROLLUP_TTL_DAYS * 86400000),
    };
    delete days[day];
    armed.writeRollup(rollup).catch(() => {
      // A refused rollup create usually means a previous hand-off
      // already landed (create-only) — either way, not retried: the
      // local copy is gone and the queue or the earlier write owns it.
    });
  }
  if (changed) saveNow();
}

/** The one entry point most seams call. A no-op until armed; the shard
 * half honours the day's coin, the rollup-mapped half tallies always. */
export function note(key: SKey): void {
  if (!armed) return;
  if (!S_KEY_SET.has(key)) return;
  load();
  const t = ensureToday();
  if (t.sampled) t.s[key] = (t.s[key] || 0) + 1;
  const rKey = R_MAP[key];
  if (rKey) (t.r[rKey] as number)++;
  save();
}

/** The per-question map (R4/D271) — the anonymous shard's, NEVER the
 * rollup's (the two-channel rule). Capped with an overflow cell so the
 * shard can never outgrow the rules' size cap. */
export function noteQid(qid: string, kind: QidKind): void {
  if (!armed || !qid) return;
  load();
  const t = ensureToday();
  if (!t.sampled) return;
  let key = qid;
  if (!(key in t.q) && Object.keys(t.q).length >= QIDS_CAP - 1) key = QID_OTHER;
  const kinds = t.q[key] || (t.q[key] = {});
  kinds[kind] = (kinds[kind] || 0) + 1;
  save();
}

/** The vote path's seam (live.ts). The two duel halves merge; an unknown
 * surface is ignored, never guessed. Also feeds the person channel's
 * answer count and marks the session non-quiet. */
export function noteAnswer(surface: string): void {
  if (!armed) return;
  const k: SKey | null =
    surface === "daily" ? "ansDaily"
    : surface === "feed" ? "ansFeed"
    : surface === "test" ? "ansTest"
    : surface === "learn" ? "ansLearn"
    : surface === "pulse" ? "ansPulse"
    : surface === "call" ? "ansCall"
    : surface === "group" || surface === "duo" ? "ansDuel"
    : null;
  if (!k) return;
  note(k);
  const t = ensureToday();
  t.r.answers++;
  sessionHadAnswer = true;
  save();
}

/** The feed's end reached — a day-level bit, not a counter. */
export function markDepthEnd(): void {
  if (!armed) return;
  load();
  ensureToday().r.depthEnd = 1;
  save();
}

// ── sessions (R3/D272) ────────────────────────────────────────────
//
// A session is a foreground episode; a gap over SESSION_GAP_MS starts a
// new one. Quiet (no answer) is decided when the session CLOSES — at the
// next session's start — and lands on the day the session STARTED. Two
// honest edges, priced rather than engineered away: a session still open
// when its day flushes never gets its quiet verdict (the day is gone),
// and foreground time spanning midnight lands on the day the app went
// hidden. Both are minutes-level noise on a bucketed field.

function closeSession(): void {
  if (!sessionOpen) return;
  sessionOpen = false;
  if (!sessionHadAnswer && sessionDay && days[sessionDay]) {
    days[sessionDay].r.quiet++;
    save();
  }
}

function startSession(atMs: number): void {
  closeSession();
  const t = ensureToday();
  t.r.sessions++;
  t.r.dayparts[daypartOf(atMs)]++;
  sessionOpen = true;
  sessionHadAnswer = false;
  sessionDay = utcDay(atMs);
  save();
}

function onVisible(): void {
  const ms = now();
  if (!sessionOpen || ms - lastHiddenAt > SESSION_GAP_MS) startSession(ms);
  visibleSince = ms;
  note("opens");
}

function onHidden(): void {
  const ms = now();
  if (visibleSince) {
    ensureToday().r.fgMs += Math.max(0, ms - visibleSince);
    visibleSince = 0;
  }
  lastHiddenAt = ms;
  saveNow();
}

/** Called by initLive() once the live session exists — never by tests'
 * mounts, never by the demo build, which is the whole inertness story. */
export function arm(ctx: ArmCtx): void {
  armed = ctx;
  load();
  if (!listenersOn && typeof document !== "undefined" && typeof document.addEventListener === "function") {
    listenersOn = true;
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) onHidden();
      else onVisible();
    });
  }
  onVisible();
  // Let boot finish first: the flush is at most two queued writes and
  // can wait out the hydrate burst.
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
    sessionOpen = false;
    sessionHadAnswer = false;
    sessionDay = "";
    // THE CLOCK IS STILL RUNNING, and it was running under the account that
    // just went away. `visibleSince` is the moment the app came to the
    // foreground; there is no reload behind an account change, so nothing
    // else re-stamps it — and the next `onHidden` did
    // `ensureToday().r.fgMs += ms - visibleSince`, seeding the NEW account's
    // day with the previous one's minutes. Forty minutes signed in as A,
    // delete the account, one minute as B, background the app, and B's
    // first rollup ships forty-one. Measured, not reasoned.
    //
    // RE-STAMPED rather than zeroed: the app IS in the foreground at this
    // instant, so zeroing would throw away the new account's time until the
    // next visibility change. From the purge forward, the minutes are
    // theirs. `now()` is safe unarmed — it falls back to Date.now(), and an
    // unarmed `visibleSince` is already 0, so this stays a no-op in a
    // never-armed session.
    visibleSince = visibleSince ? now() : 0;
    // The other half of the same fresh-boot pair. Hygiene rather than a
    // second bug: `onVisible`'s session-gap branch already restarts because
    // `sessionOpen` is false above.
    lastHiddenAt = 0;
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
  visibility: (hidden: boolean) => void;
} {
  return {
    armed: !!armed,
    days,
    reset: () => {
      armed = null;
      days = {};
      loaded = false;
      visibleSince = 0;
      lastHiddenAt = 0;
      sessionOpen = false;
      sessionHadAnswer = false;
      sessionDay = "";
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
    },
    saveNow,
    visibility: (hidden) => { if (hidden) onHidden(); else onVisible(); },
  };
}
