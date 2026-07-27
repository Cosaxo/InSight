// The v2 live data layer — the seam between the ported spec UI and
// Firestore. When enabled it exposes `window.LIVE`, a store the daily
// tab reads instead of its demo deck:
//
//   LIVE.enabled      flag: firebase configured AND VITE_V2_LIVE=true
//   LIVE.ready        true once auth + first fetch have settled
//   LIVE.deck()       today's daily questions in the UI's "S" shape;
//                     counts come from the k-floored public aggregates
//                     and EXCLUDE the viewer's own vote (the UI adds
//                     its own +1 for "you", so including it here would
//                     double-count — review finding, Phase 2)
//   LIVE.myVotes()    { [qid]: optionId } — the store's truth, which the
//                     UI reconciles into component state on every notify
//   LIVE.vote(q, id)  optimistic local record + owner-only answer write,
//                     rolled back (and re-notified) if the write fails
//   LIVE.subscribe(f) change notifications (agg snapshots, auth, boot)
//
// Population stats come exclusively from the public aggregate mirror
// (decision D5) — this module never reads another user's documents.
// Comments and who-voted stay OFF for live questions (decision D1).

import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { anonSignIn, firebaseEnabled, getDb } from "../../lib/firebase";

interface LiveOption {
  id: string;
  label: string;
  count: number;
  color: string;
}

interface LiveQuestion {
  id: string;
  cat: string | null;
  text: string;
  dayLabel: string;
  options: LiveOption[];
  comments: never[];
  friends: never[];
  live: true;
  tooSmall: boolean;
  test?: string | null;
}

interface QuestionDoc {
  surface: string;
  seq: number;
  type: string;
  prompt: string;
  options: string[];
  topic: string | null;
  test: string | null;
  active: boolean;
}

// The spec's option palette, cycled by index so live cards look native.
const OPTION_COLORS = [
  "var(--c-around)",
  "var(--c-today)",
  "var(--c-likeness)",
  "var(--c-world)",
  "var(--c-people)",
];

const DECK_DAYS = 7; // today + the recent past, like the demo pager
const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface AggDoc {
  counts?: Record<string, number>;
  total?: number;
  tooSmall?: boolean;
}

const state = {
  ready: false,
  uid: null as string | null,
  questions: [] as Array<QuestionDoc & { id: string }>,
  feedBank: [] as Array<QuestionDoc & { id: string }>,
  deckDay: -1,
  deckIds: [] as string[],
  aggs: {} as Record<string, AggDoc>,
  votes: {} as Record<string, string>, // qid -> option id ("0","1",…)
  optimistic: {} as Record<string, number>, // qid -> optionIdx not yet aggregated
  aggUnsubs: {} as Record<string, () => void>,
  // ── social (groups & duos) ──
  profile: { displayName: "", testResults: {} as Record<string, unknown> },
  groups: [] as Array<Record<string, unknown> & { id: string }>,
  duelBank: [] as Array<QuestionDoc & { id: string }>,
  reveals: {} as Record<string, Record<string, unknown> | null>,
  groupsUnsub: null as null | (() => void),
  revealUnsubs: {} as Record<string, () => void>,
};

function utcDayKey(offsetDays = 0): string {
  return new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);
}

function utcDayIndex(): number {
  return Math.floor(Date.now() / 86400000);
}

function gHash(s: string): number {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 997;
  return h;
}

const listeners = new Set<() => void>();
const notify = () => {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* listener errors must not break the store */
    }
  });
  try {
    window.dispatchEvent(new Event("insight-live-update"));
  } catch {
    /* non-browser env */
  }
};

function dayIndex(): number {
  // Local-midnight day number so "today" rolls over with the user's clock.
  const now = new Date();
  const local = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor(local.getTime() / 86400000);
}

function dayLabel(back: number): string {
  if (back === 0) return "Today";
  if (back === 1) return "Yesterday";
  const d = new Date();
  d.setDate(d.getDate() - back);
  return WEEKDAY[d.getDay()];
}

function buildS(
  q: QuestionDoc & { id: string },
  back: number,
): LiveQuestion {
  const agg = state.aggs[q.id] || {};
  const counts = agg.counts || {};
  const mine = state.votes[q.id];
  const pending = q.id in state.optimistic;
  return {
    id: q.id,
    cat: q.topic,
    text: q.prompt,
    dayLabel: dayLabel(back),
    options: q.options.map((label, i) => {
      let count = counts[String(i)] || 0;
      // Exclude the viewer's own vote: once the trigger has folded it in
      // (optimistic flag cleared), subtract it back out — the UI layer
      // adds its own +1 for the viewer's option.
      if (!pending && mine === String(i) && count > 0) count -= 1;
      return {
        id: String(i),
        label,
        count,
        color: OPTION_COLORS[i % OPTION_COLORS.length],
      };
    }),
    comments: [],
    friends: [],
    live: true,
    tooSmall: agg.tooSmall !== false,
    test: q.test,
  };
}

async function subscribeAggs(): Promise<void> {
  const db = await getDb();
  const wanted = new Set(state.deckIds);
  // drop stale subscriptions (deck rolled over past midnight)
  for (const qid of Object.keys(state.aggUnsubs)) {
    if (!wanted.has(qid)) {
      state.aggUnsubs[qid]();
      delete state.aggUnsubs[qid];
    }
  }
  state.deckIds.forEach((qid) => {
    if (state.aggUnsubs[qid]) return;
    state.aggUnsubs[qid] = onSnapshot(
      doc(db, "v2_question_aggs", qid),
      (snap) => {
        if (snap.exists()) {
          state.aggs[qid] = snap.data() as AggDoc;
          // A post-vote agg snapshot means the trigger has (very likely)
          // folded the vote in; stop double-tracking it. A premature
          // clear self-heals on the next snapshot.
          if (qid in state.optimistic && state.votes[qid]) {
            delete state.optimistic[qid];
          }
        }
        notify();
      },
    );
  });
}

function computeDeck(): void {
  const n = state.questions.length;
  if (!n) return;
  const today = dayIndex();
  state.deckDay = today;
  state.deckIds = Array.from({ length: Math.min(DECK_DAYS, n) }, (_, back) => {
    const idx = (((today - back) % n) + n) % n;
    return state.questions[idx].id;
  });
}

async function hydrate(): Promise<void> {
  const db = await getDb();
  // Single-field query only (no composite index requirement — review
  // finding: the emulator doesn't enforce composite indexes, production
  // does); `active` filtering and seq ordering happen client-side over
  // a ~30-doc bank.
  const qsnap = await getDocs(
    query(
      collection(db, "v2_questions"),
      where("surface", "in", ["daily", "feed", "test"]),
      limit(400),
    ),
  );
  const all = qsnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as QuestionDoc) }))
    .filter((q) => q.active !== false)
    .sort((a, b) => (a.seq || 0) - (b.seq || 0));
  state.questions = all.filter((q) => q.surface === "daily");
  state.feedBank = all.filter((q) => q.surface !== "daily");
  if (!state.questions.length) return; // unseeded project — stay on mocks

  // one shot of every public aggregate — the feed reads these as its
  // counts; the daily deck keeps its live per-doc subscriptions on top
  const aggsnap = await getDocs(query(collection(db, "v2_question_aggs"), limit(500)));
  aggsnap.docs.forEach((d) => {
    state.aggs[d.id] = d.data() as AggDoc;
  });

  computeDeck();

  // my profile (display name + synced test results) — owner-only
  const uid0 = state.uid;
  if (uid0) {
    const { getDoc } = await import("firebase/firestore");
    const prof = await getDoc(doc(db, "v2_users", uid0));
    if (prof.exists()) {
      state.profile.displayName = (prof.get("displayName") as string) || "";
      state.profile.testResults =
        (prof.get("testResults") as Record<string, unknown>) || {};
    }
    // Live mode shows only REAL results: purge the demo's baked test
    // results and rebuild from server + this device's saves.
    try {
      const local = JSON.parse(localStorage.getItem("insight.testResults.v2") || "{}") || {};
      (window as unknown as Record<string, unknown>).IS_TEST_RESULTS = {
        ...state.profile.testResults,
        ...local,
      };
    } catch {
      (window as unknown as Record<string, unknown>).IS_TEST_RESULTS = {
        ...state.profile.testResults,
      };
    }
  }

  // my existing answers (owner-only reads)
  const uid = state.uid;
  if (uid) {
    const asnap = await getDocs(
      query(collection(db, "v2_users", uid, "answers"), limit(400)),
    );
    asnap.docs.forEach((d) => {
      const optionIdx = d.get("optionIdx");
      if (typeof optionIdx === "number") state.votes[d.id] = String(optionIdx);
    });
  }

  await subscribeAggs();

  // Feed vote hydration: the spec's feed keeps its voted-state in
  // localStorage (WF_LS) — mirror the Firestore answers into it so
  // world-feed renders prior votes natively on any device.
  try {
    const WF_LS = "insight.feedVotes.v1";
    const wf = JSON.parse(localStorage.getItem(WF_LS) || "{}") || {};
    state.feedBank.forEach((q) => {
      const v = state.votes[q.id];
      if (v != null && wf[q.id] == null) wf[q.id] = Number(v);
    });
    localStorage.setItem(WF_LS, JSON.stringify(wf));
  } catch {
    /* localStorage unavailable — feed falls back to store votes */
  }

  buildFeedGlobals();
}

// Counts shown by the feed exclude the viewer's own vote (wfPcts adds
// its +1), mirroring the daily deck's convention.
function feedCounts(q: QuestionDoc & { id: string }): number[] {
  const agg = state.aggs[q.id] || {};
  const counts = agg.counts || {};
  const mine = state.votes[q.id];
  return q.options.map((_, i) => {
    let n = counts[String(i)] || 0;
    if (mine === String(i) && n > 0) n -= 1;
    return n;
  });
}

// Replace the demo feed globals with live-shaped cards: real questions,
// real k-floored counts, no seeded comments (D1 — renderEngage is also
// gated off for q.live cards). Rankings/scales are deferred; every live
// card renders through the options path.
function buildFeedGlobals(): void {
  if (!state.feedBank.length) return;
  const feed = state.feedBank
    .filter((q) => q.surface === "feed" && (q.options || []).length >= 2)
    .map((q) => ({
      id: q.id,
      cat: q.topic || "culture",
      type: "vote",
      prompt: q.prompt,
      options: q.options.map((label, i) => ({ label, count: feedCounts(q)[i] })),
      live: true,
      tooSmall: (state.aggs[q.id] || {}).tooSmall !== false,
    }));
  const tests = state.feedBank
    .filter((q) => q.surface === "test" && q.test)
    .map((q) => ({
      id: q.id,
      cat: "test",
      type: "vote",
      test: q.test,
      prompt: q.prompt,
      options: q.options.map((label, i) => ({ label, count: feedCounts(q)[i] })),
      live: true,
    }));
  (window as unknown as Record<string, unknown>).WORLD_FEED_QS = feed;
  (window as unknown as Record<string, unknown>).TEST_FEED_QS = tests;
  (window as unknown as Record<string, unknown>).WORLD_FEED_COMMENTS = {};
  LIVE.feedReady = true;
}

async function hydrateSocial(): Promise<void> {
  const db = await getDb();
  const uid = state.uid;
  if (!uid) return;
  // the group/duo question banks (seeded, small)
  const bank = await getDocs(
    query(collection(db, "v2_questions"), where("surface", "in", ["group", "duo"]), limit(200)),
  );
  state.duelBank = bank.docs
    .map((d) => ({ id: d.id, ...(d.data() as QuestionDoc) }))
    .filter((q) => q.active !== false)
    .sort((a, b) => (a.seq || 0) - (b.seq || 0));
  // my groups, live — and yesterday's reveal per group
  state.groupsUnsub = onSnapshot(
    query(collection(db, "v2_groups"), where("memberUids", "array-contains", uid)),
    (snap) => {
      state.groups = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const yester = utcDayKey(-1);
      const want = new Set(state.groups.map((g) => g.id));
      for (const gid of Object.keys(state.revealUnsubs)) {
        if (!want.has(gid)) {
          state.revealUnsubs[gid]();
          delete state.revealUnsubs[gid];
          delete state.reveals[gid];
        }
      }
      state.groups.forEach((g) => {
        if (state.revealUnsubs[g.id]) return;
        state.revealUnsubs[g.id] = onSnapshot(
          doc(db, "v2_groups", g.id, "reveals", yester),
          (rs) => {
            state.reveals[g.id] = rs.exists() ? (rs.data() as Record<string, unknown>) : null;
            notify();
          },
        );
      });
      notify();
    },
  );
}

async function callable<T>(name: string, data: unknown): Promise<T> {
  const db = await getDb();
  const fns = getFunctions(db.app, "us-central1");
  const res = await httpsCallable(fns, name)(data);
  return res.data as T;
}

// The client mirrors the server's deterministic rotation: the day's
// question for a group is bank[(hash(gid) + utcDay) % len] over the
// matching-surface bank. "pick" questions take the members as options.
function duelQFor(g: Record<string, unknown> & { id: string }, dayOffset = 0) {
  const mode = g.mode === "duo" ? "duo" : "group";
  const bank = state.duelBank.filter((q) => q.surface === mode);
  if (!bank.length) return null;
  const q = bank[(gHash(g.id) + utcDayIndex() + dayOffset + bank.length * 1000) % bank.length];
  const names = (g.memberNames || {}) as Record<string, string>;
  const memberUids = (g.memberUids || []) as string[];
  const options =
    q.topic === "pick"
      ? memberUids.map((u) => names[u] || "Member")
      : q.options;
  return { id: q.id, prompt: q.prompt, options, kind: q.topic || "classic" };
}

const SOCIAL = {
  todayKey: () => utcDayKey(0),
  bankQ(qid: string) {
    const q = state.duelBank.find((x) => x.id === qid);
    return q ? { id: q.id, prompt: q.prompt, options: q.options, kind: q.topic || "classic" } : null;
  },
  groups(mode?: string) {
    return mode ? state.groups.filter((g) => (g.mode || "group") === mode) : [...state.groups];
  },
  todayQ(gid: string) {
    const g = state.groups.find((x) => x.id === gid);
    return g ? duelQFor(g) : null;
  },
  myDuelVote(gid: string): { optionIdx: number } | null {
    const v = state.votes[`g_${gid}_${utcDayKey(0)}`];
    return v != null ? { optionIdx: Number(v) } : null;
  },
  revealFor(gid: string) {
    return state.reveals[gid] || null;
  },
  async createGroup(name: string, mode: string, displayName?: string) {
    const out = await callable<{ gid: string; inviteCode: string }>("createGroupV2", { name, mode, displayName });
    return out;
  },
  async joinGroup(code: string, displayName?: string) {
    return callable<{ gid: string; name: string }>("joinGroupV2", { code, displayName });
  },
  async leaveGroup(gid: string) {
    return callable<{ gid: string; deleted: boolean }>("leaveGroupV2", { gid });
  },
  voteDuel(gid: string, optionIdx: number, guessIdx?: number): void {
    const g = state.groups.find((x) => x.id === gid);
    const q = g && duelQFor(g);
    const uid = state.uid;
    if (!g || !q || !uid) return;
    const day = utcDayKey(0);
    const aid = `g_${gid}_${day}`;
    if (state.votes[aid]) return;
    state.votes[aid] = String(optionIdx);
    notify();
    void (async () => {
      try {
        const db = await getDb();
        const payload: Record<string, unknown> = {
          qid: q.id,
          surface: g.mode === "duo" ? "duo" : "group",
          optionIdx,
          gid,
          day,
          answeredAt: serverTimestamp(),
          anchors: {},
        };
        if (typeof guessIdx === "number") payload.guessIdx = guessIdx;
        await setDoc(doc(db, "v2_users", uid, "answers", aid), payload);
      } catch (err) {
        delete state.votes[aid];
        notify();
        console.warn("[LIVE] duel vote failed:", err);
      }
    })();
  },
};

const LIVE = {
  social: SOCIAL,
  feedReady: false,
  get displayName(): string {
    return state.profile.displayName;
  },
  async saveDisplayName(name: string): Promise<void> {
    const db = await getDb();
    const uid = state.uid;
    if (!uid) throw new Error("no session");
    await setDoc(doc(db, "v2_users", uid), { displayName: name }, { merge: true });
    state.profile.displayName = name;
    notify();
  },
  // Test results survive devices: mirrored onto the owner-only profile
  // doc whenever the local persistence runs (test-definitions.js).
  saveTestResult(kind: string, result: unknown): void {
    state.profile.testResults[kind] = result;
    void (async () => {
      try {
        const db = await getDb();
        const uid = state.uid;
        if (!uid) return;
        await setDoc(
          doc(db, "v2_users", uid),
          { testResults: { [kind]: result } },
          { merge: true },
        );
      } catch (err) {
        console.warn("[LIVE] test-result sync failed:", err);
      }
    })();
  },
  async linkGoogle(): Promise<void> {
    const m = await import("../../lib/firebase");
    return m.linkGoogle();
  },
  async deleteAccount(): Promise<void> {
    const db = await getDb();
    const { getFunctions: gf, httpsCallable: hc } = await import("firebase/functions");
    await hc(gf(db.app, "us-central1"), "deleteAccount")({});
  },
  // read-only views for the Map/Mirror hydration (daily-questions.js)
  dailyBank(): Array<{ id: string; prompt: string }> {
    return state.questions.map((q) => ({ id: q.id, prompt: q.prompt }));
  },
  aggFor(qid: string): AggDoc | null {
    return state.aggs[qid] || null;
  },
  enabled: false,
  get ready() {
    return state.ready;
  },
  get uid() {
    return state.uid;
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  deck(): LiveQuestion[] {
    // Midnight rollover: recompute the deck (and agg subscriptions) when
    // the local day changes under a long-lived session.
    if (state.questions.length && state.deckDay !== dayIndex()) {
      computeDeck();
      void subscribeAggs();
    }
    return state.deckIds
      .map((qid, back) => {
        const q = state.questions.find((x) => x.id === qid);
        return q ? buildS(q, back) : null;
      })
      .filter((s): s is LiveQuestion => !!s);
  },
  myVotes(): Record<string, string> {
    return { ...state.votes };
  },
  vote(qid: string, optionId: string): void {
    if (state.votes[qid]) return; // one answer per question, mirroring rules
    const optionIdx = Number(optionId);
    if (!Number.isInteger(optionIdx) || optionIdx < 0) return;
    state.votes[qid] = optionId;
    state.optimistic[qid] = optionIdx;
    notify();
    void (async () => {
      try {
        const db = await getDb();
        const uid = state.uid;
        if (!uid) throw new Error("no session");
        const q =
          state.questions.find((x) => x.id === qid) ||
          state.feedBank.find((x) => x.id === qid);
        await setDoc(doc(db, "v2_users", uid, "answers", qid), {
          qid,
          surface: q?.surface ?? "daily",
          optionIdx,
          answeredAt: serverTimestamp(),
          anchors: {},
        });
        // one delayed refresh so the next paint has the folded-in count
        setTimeout(() => {
          void (async () => {
            try {
              const { getDoc } = await import("firebase/firestore");
              const snap = await getDoc(doc(db, "v2_question_aggs", qid));
              if (snap.exists()) {
                state.aggs[qid] = snap.data() as AggDoc;
                if (qid in state.optimistic) delete state.optimistic[qid];
                buildFeedGlobals();
                notify();
              }
            } catch {
              /* refresh is best-effort */
            }
          })();
        }, 2500);
      } catch (err) {
        // Write refused (rules/network): roll the optimistic state back.
        // Subscribers reconcile from myVotes(), so the UI un-votes too.
        delete state.votes[qid];
        delete state.optimistic[qid];
        notify();
        console.warn("[LIVE] vote failed:", err);
      }
    })();
  },
};

export async function initLive(timeoutMs = 5000): Promise<void> {
  const flag = import.meta.env.VITE_V2_LIVE === "true";
  if (!flag || !firebaseEnabled) return;
  const boot = (async () => {
    state.uid = await anonSignIn();
    await hydrate();
    await hydrateSocial();
    state.ready = true;
    // fire-and-forget: reveal notifications on real devices (no-op on web)
    void import("./push").then((m) => m.registerPushForReveals(state.uid as string)).catch(() => {});
    LIVE.enabled = true;
    notify();
  })();
  // Whether boot loses the race (slow network) or fails outright, the
  // app must render on the mock deck; a late successful boot attaches
  // via notify() and the UI reconciles.
  boot.catch((err) => console.warn("[LIVE] boot failed — mock mode:", err));
  try {
    await Promise.race([
      boot,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("live init timeout")), timeoutMs),
      ),
    ]);
  } catch {
    /* logged above; timeout case logs here via the race rejection */
  }
}

declare global {
  interface Window {
    LIVE?: typeof LIVE;
  }
}

window.LIVE = LIVE;

export default LIVE;
