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
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { anonSignIn, firebaseEnabled, getDb } from "../../lib/firebase";
import { reportError, setSentryUser } from "../../lib/sentry";
// Pure deck-shaping logic lives in ./deck (unit-testable, no firebase);
// this module passes its store state in.
import {
  buildS as buildSPure,
  computeDeckIds,
  countsFor,
  dayIndex as dayIndexPure,
  duelQFor as duelQForPure,
  isTooSmall,
  utcDayIndex as utcDayIndexPure,
} from "./deck";
import type { AggDoc, LiveQuestion, QuestionDoc, VoteContext } from "./deck";

const state = {
  ready: false,
  uid: null as string | null,
  questions: [] as Array<QuestionDoc & { id: string }>,
  feedBank: [] as Array<QuestionDoc & { id: string }>,
  deckDay: -1,
  deckIds: [] as string[],
  aggs: {} as Record<string, AggDoc>,
  votes: {} as Record<string, string>, // qid -> option id ("0","1",…)
  // Optimistic-vote tracking, split in two because the flags clear at
  // different moments (conflating them let a stranger's vote folding
  // into the agg mid-flight "confirm" a write the server had not yet
  // acknowledged — and possibly would refuse):
  //   inflight      qid -> true while the answer setDoc has NOT been
  //                 acknowledged by the server. With persistentLocalCache
  //                 the promise resolves only on SERVER ack — offline it
  //                 stays pending indefinitely. Drives confirmedVotes().
  //   unaggregated  qid -> optionIdx while the vote is not yet folded
  //                 into the public aggregate. Drives the own-vote
  //                 subtraction (VoteContext.pending); cleared by agg
  //                 snapshots and the post-vote delayed refresh.
  inflight: {} as Record<string, true>,
  unaggregated: {} as Record<string, number>,
  aggUnsubs: {} as Record<string, () => void>,
  // ── social (groups & duos) ──
  profile: { displayName: "", testResults: {} as Record<string, unknown> },
  meta: { latestBuild: 0, minBuild: 0, updateUrl: "" },
  stats: { bankSource: "none", aggsFetched: 0, answersFetched: 0 },
  groups: [] as Array<Record<string, unknown> & { id: string }>,
  duelBank: [] as Array<QuestionDoc & { id: string }>,
  reveals: {} as Record<string, Record<string, unknown> | null>,
  groupsUnsub: null as null | (() => void),
  revealUnsubs: {} as Record<string, () => void>,
  revealDay: "",
};

function utcDayKey(offsetDays = 0): string {
  return new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);
}

// Set as deleteAccount's FIRST statement. "There is no undo" has to hold
// against work already in flight: the post-vote refresh timer, the agg and
// reveal snapshot handlers, and any queued write can all still fire after
// the purge and re-create an `insight.*` key for a deleted account.
// Clearing the timer alone would not close the snapshot writers.
let torndown = false;

function cacheVote(aid: string, optionIdx: number): void {
  if (torndown) return;
  try {
    const ANS_LS = "insight.answersCache.v1";
    const cached = JSON.parse(localStorage.getItem(ANS_LS) || "null") || { uid: state.uid, votes: {}, maxTs: 0 };
    if (cached.uid !== state.uid) return;
    cached.votes[aid] = String(optionIdx);
    localStorage.setItem(ANS_LS, JSON.stringify(cached));
  } catch {
    /* best-effort */
  }
}

function saveAggCache(): void {
  if (torndown) return;
  try {
    localStorage.setItem("insight.aggsCache.v1", JSON.stringify(state.aggs));
  } catch {
    /* best-effort */
  }
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
  return dayIndexPure(new Date());
}

// The store-state slice buildS/countsFor need for one question.
function voteCtx(qid: string): VoteContext {
  return {
    agg: state.aggs[qid],
    mine: state.votes[qid],
    pending: qid in state.unaggregated,
  };
}

function buildS(
  q: QuestionDoc & { id: string },
  back: number,
): LiveQuestion {
  return buildSPure(q, back, voteCtx(q.id), new Date());
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
          saveAggCache();
          // A post-vote agg snapshot means the trigger has (very likely)
          // folded the vote in; stop double-tracking it. A premature
          // clear self-heals on the next snapshot. (Only the display
          // flag clears here — write acknowledgement is tracked
          // separately in state.inflight.)
          if (qid in state.unaggregated && state.votes[qid]) {
            delete state.unaggregated[qid];
          }
        }
        notify();
      },
      (err) => {
        // An errored listener is dead server-side; leaving its stale
        // unsub in aggUnsubs would make the guard above block any
        // re-listen for the session. Drop it so the next subscribeAggs
        // pass (e.g. midnight rollover in deck()) can re-attach.
        reportError(err, { where: "aggListener", qid });
        delete state.aggUnsubs[qid];
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
  state.deckIds = computeDeckIds(state.questions.map((q) => q.id), today);
}

async function hydrate(): Promise<void> {
  const db = await getDb();
  const { getDoc, Timestamp, documentId } = await import("firebase/firestore");

  // ── one meta read runs the whole cache story ──
  // contentRev invalidates the local question-bank cache; latest/min
  // build drive the in-app update prompts.
  let contentRev = 0;
  try {
    const meta = await getDoc(doc(db, "v2_meta", "app"));
    if (meta.exists()) {
      const rev = meta.get("contentRev");
      contentRev = rev && typeof rev.toMillis === "function" ? rev.toMillis() : 0;
      state.meta.latestBuild = Number(meta.get("latestBuild") || 0);
      state.meta.minBuild = Number(meta.get("minBuild") || 0);
      state.meta.updateUrl = String(meta.get("updateUrl") || "");
    }
  } catch {
    /* meta is best-effort — absence just means no caching/update info */
  }

  // ── question bank: localStorage cache keyed by contentRev ──
  // The bank is static content; a boot should cost 1 meta read, not
  // ~190 bank reads. Single-field query (no composite index).
  interface BankEntry extends QuestionDoc {
    id: string;
  }
  let all: BankEntry[] | null = null;
  const BANK_LS = "insight.bankCache.v1";
  try {
    const cached = JSON.parse(localStorage.getItem(BANK_LS) || "null");
    if (cached && cached.rev === contentRev && Array.isArray(cached.questions) && cached.questions.length) {
      all = cached.questions as BankEntry[];
      state.stats.bankSource = "cache";
    }
  } catch {
    /* corrupt cache — refetch below */
  }
  if (!all) {
    const qsnap = await getDocs(
      query(
        collection(db, "v2_questions"),
        where("surface", "in", ["daily", "feed", "test", "group", "duo"]),
        limit(400),
      ),
    );
    all = qsnap.docs.map((d) => ({ id: d.id, ...(d.data() as QuestionDoc) }));
    state.stats.bankSource = "network";
    try {
      localStorage.setItem(BANK_LS, JSON.stringify({ rev: contentRev, questions: all }));
    } catch {
      /* cache is best-effort */
    }
  }
  const active = all
    .filter((q) => q.active !== false)
    .sort((a, b) => (a.seq || 0) - (b.seq || 0));

  // Bank docs are hand-editable in the console — the kill switch expects
  // an operator in there — and nothing validates them on the way in. A doc
  // missing `options` used to throw inside q.options.map, blanking a whole
  // tab behind the ErrorBoundary. Drop unusable docs instead.
  //
  // Applied per bank rather than once over `active`, so a mistake in one
  // predicate cannot empty a bank it was never meant to touch. "pick"
  // duel questions are the deliberate exception: they carry no bank
  // options because their options ARE the group's members.
  const playable = (q: QuestionDoc & { id: string }) =>
    Array.isArray(q.options) && q.options.length >= 2;
  state.questions = active.filter((q) => q.surface === "daily" && playable(q));
  state.feedBank = active.filter(
    (q) => (q.surface === "feed" || q.surface === "test") && playable(q));
  state.duelBank = active.filter(
    (q) => (q.surface === "group" || q.surface === "duo")
      && (playable(q) || q.topic === "pick"));
  // A completely unseeded project is a real failure: throw so boot leaves
  // LIVE disabled and the mock deck renders. Returning here used to let
  // boot flip enabled=true on an empty deck, which pins the user on
  // "Fetching today's question…" forever with neither honesty banner up.
  if (!state.questions.length && !state.feedBank.length && !state.duelBank.length) {
    throw new Error("live bank is empty — project not seeded");
  }
  // A bank with content but no *daily* question is different: the rest of
  // the app works, so stay live and let the daily surface say so.

  // ── my answers: cached + incremental (immutable docs never refetch) ──
  const ANS_LS = "insight.answersCache.v1";
  const uidA = state.uid;
  let maxTs = 0;
  if (uidA) {
    try {
      const cached = JSON.parse(localStorage.getItem(ANS_LS) || "null");
      if (cached && cached.uid === uidA && cached.votes) {
        Object.assign(state.votes, cached.votes);
        maxTs = Number(cached.maxTs || 0);
      }
    } catch {
      /* refetch below */
    }
    const aq = maxTs > 0
      ? query(
          collection(db, "v2_users", uidA, "answers"),
          where("answeredAt", ">", Timestamp.fromMillis(maxTs)),
          limit(400),
        )
      : query(
          collection(db, "v2_users", uidA, "answers"),
          orderBy("answeredAt", "desc"),
          limit(1000),
        );
    // Deliberately UNGUARDED, unlike the reads below. Answers are not
    // decoration: proceeding with a partial vote set makes the app offer
    // questions the user already answered, and the create-only rule then
    // refuses every one of those re-votes. Better to fail boot and render
    // the honest mock deck than to look live and reject the user's taps.
    const asnap = await getDocs(aq);
    state.stats.answersFetched = asnap.size;
    asnap.docs.forEach((d) => {
      const optionIdx = d.get("optionIdx");
      if (typeof optionIdx === "number") state.votes[d.id] = String(optionIdx);
      const at = d.get("answeredAt");
      if (at && typeof at.toMillis === "function") maxTs = Math.max(maxTs, at.toMillis());
    });
    try {
      localStorage.setItem(ANS_LS, JSON.stringify({ uid: uidA, votes: state.votes, maxTs }));
    } catch {
      /* best-effort */
    }
  }

  // ── aggregates: cached; fetch answered questions' aggs that are
  // missing OR still cached as too-small ──
  // Feed cards are blind pre-vote (counts show only after answering), so
  // the old whole-collection scan bought nothing. Deck docs get live
  // snapshots below; everything else refreshes on vote. A cached agg
  // with tooSmall !== false counts as missing here: feed questions have
  // no live listener, so an early voter's "too small" snapshot would
  // otherwise be frozen forever. Cost: each still-under-the-k-floor agg
  // is re-read once per boot until it crosses the floor (bounded by the
  // number of answered questions, same ceiling as a cold cache).
  const AGG_LS = "insight.aggsCache.v1";
  try {
    const cached = JSON.parse(localStorage.getItem(AGG_LS) || "null");
    if (cached && typeof cached === "object") Object.assign(state.aggs, cached);
  } catch {
    /* best-effort */
  }
  // Aggregate top-up is a DISPLAY nicety — it decorates cards with counts.
  // It used to be unguarded, so one failed chunk query (a transient error,
  // a missing index) threw out of hydrate, rejected boot, and pinned the
  // whole session on demo data even though the bank and the votes had
  // already loaded. Never worth a session for a count.
  //
  // Also: this was serial. A returning user with 150 answered questions
  // still under the k-floor ran 5 round trips one after another inside the
  // 2.5s boot race — and losing that race used to be permanent.
  const AGG_CHECK_LS = "insight.aggCheck.v1";
  const AGG_RECHECK_MS = 6 * 60 * 60 * 1000;
  const AGG_ID_CAP = 120;
  try {
    let checked: Record<string, number> = {};
    try {
      checked = JSON.parse(localStorage.getItem(AGG_CHECK_LS) || "{}") || {};
    } catch {
      /* corrupt — treat as empty */
    }
    const nowMs = Date.now();
    const answeredWorld = Object.keys(state.votes)
      .filter((id) => !id.startsWith("g_") && isTooSmall(state.aggs[id]))
      // A question under the floor stays under it for a while; re-reading
      // every one on every boot is the dominant per-boot cost for an
      // engaged user. Re-check each at most every 6h.
      .filter((id) => nowMs - (checked[id] || 0) > AGG_RECHECK_MS)
      .slice(0, AGG_ID_CAP);

    const chunks: string[][] = [];
    for (let i = 0; i < answeredWorld.length; i += 30) {
      chunks.push(answeredWorld.slice(i, i + 30));
    }
    const snaps = await Promise.all(chunks.map((chunk) =>
      getDocs(query(collection(db, "v2_question_aggs"), where(documentId(), "in", chunk)))));
    snaps.forEach((snap) => {
      snap.docs.forEach((d) => {
        state.aggs[d.id] = d.data() as AggDoc;
      });
      state.stats.aggsFetched += snap.size;
    });
    answeredWorld.forEach((id) => { checked[id] = nowMs; });
    try {
      localStorage.setItem(AGG_CHECK_LS, JSON.stringify(checked));
    } catch {
      /* best-effort */
    }
    saveAggCache();
  } catch (err) {
    reportError(err, { where: "hydrate.aggs" });
  }

  computeDeck();

  // my profile (display name + synced test results) — owner-only.
  // Guarded for the same reason: a missing display name is a cosmetic
  // loss, not a reason to spend the session on demo data.
  const uid0 = state.uid;
  if (uid0) {
    try {
      const { getDoc } = await import("firebase/firestore");
      const prof = await getDoc(doc(db, "v2_users", uid0));
      if (prof.exists()) {
        state.profile.displayName = (prof.get("displayName") as string) || "";
        state.profile.testResults =
          (prof.get("testResults") as Record<string, unknown>) || {};
      }
    } catch (err) {
      reportError(err, { where: "hydrate.profile" });
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
  // subtract own vote only once the trigger has folded it in
  return countsFor(q.options, voteCtx(q.id));
}

// Replace the demo feed globals with live-shaped cards: real questions,
// real k-floored counts, no seeded comments (D1 — renderEngage is also
// gated off for q.live cards). Rankings/scales are deferred; every live
// card renders through the options path.
function buildFeedGlobals(): void {
  if (!state.feedBank.length) return;
  const feed = state.feedBank
    .filter((q) => q.surface === "feed" && (q.options || []).length >= 2)
    .map((q) => {
      // Hoisted: feedCounts walks the whole option list, so calling it
      // inside the per-option map made this O(n^2) per card — and it
      // re-runs after every vote.
      const counts = feedCounts(q);
      return {
        id: q.id,
        cat: q.topic || "culture",
        type: "vote",
        prompt: q.prompt,
        options: q.options.map((label, i) => ({ label, count: counts[i] })),
        live: true,
        tooSmall: isTooSmall(state.aggs[q.id]),
      };
    });
  const tests = state.feedBank
    .filter((q) => q.surface === "test" && q.test)
    .map((q) => {
      const counts = feedCounts(q);
      return {
        id: q.id,
        cat: "test",
        type: "vote",
        test: q.test,
        prompt: q.prompt,
        options: q.options.map((label, i) => ({ label, count: counts[i] })),
        live: true,
      };
    });
  (window as unknown as Record<string, unknown>).WORLD_FEED_QS = feed;
  (window as unknown as Record<string, unknown>).TEST_FEED_QS = tests;
  (window as unknown as Record<string, unknown>).WORLD_FEED_COMMENTS = {};
  LIVE.feedReady = true;
}

// (Re)subscribe every group's reveal doc for the CURRENT yesterday —
// called from the groups snapshot and again on midnight rollover, so a
// long-lived session (the reveal-push case) doesn't stay pinned to the
// day it booted on.
function subscribeReveals(db: import("firebase/firestore").Firestore): void {
  const yester = utcDayKey(-1);
  const dayChanged = state.revealDay !== yester;
  state.revealDay = yester;
  const want = new Set(state.groups.map((g) => g.id));
  for (const gid of Object.keys(state.revealUnsubs)) {
    if (!want.has(gid) || dayChanged) {
      state.revealUnsubs[gid]();
      delete state.revealUnsubs[gid];
      if (!want.has(gid)) delete state.reveals[gid];
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
      (err) => {
        // Dead listener: drop the stale unsub so the next
        // subscribeReveals pass (groups snapshot or midnight rollover)
        // can re-attach instead of being blocked by the guard above.
        reportError(err, { where: "revealListener", gid: g.id });
        delete state.revealUnsubs[g.id];
        notify();
      },
    );
  });
}

async function hydrateSocial(): Promise<void> {
  const db = await getDb();
  const uid = state.uid;
  if (!uid) return;
  // (the group/duo bank is part of the cached bank loaded in hydrate)
  // my groups, live — and yesterday's reveal per group. Re-callable:
  // tear down any previous listener first so calling hydrateSocial
  // again (the re-listen path after an errored listener) never
  // double-subscribes; deleteAccount uses the same handle for teardown.
  state.groupsUnsub?.();
  state.groupsUnsub = onSnapshot(
    query(collection(db, "v2_groups"), where("memberUids", "array-contains", uid)),
    (snap) => {
      state.groups = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      subscribeReveals(db);
      notify();
    },
    (err) => {
      // Dead listener: null the handle so a future hydrateSocial can
      // attach cleanly (and teardown doesn't call a stale unsub).
      reportError(err, { where: "groupsListener" });
      state.groupsUnsub = null;
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

function duelQFor(g: Record<string, unknown> & { id: string }, dayOffset = 0) {
  return duelQForPure(g, state.duelBank, utcDayIndexPure(Date.now()), dayOffset);
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
  voteDuel(gid: string, optionIdx: number, guessIdx?: number): Promise<void> {
    const g = state.groups.find((x) => x.id === gid);
    const q = g && duelQFor(g);
    const uid = state.uid;
    if (!g || !q || !uid) return Promise.resolve();
    const day = utcDayKey(0);
    const aid = `g_${gid}_${day}`;
    if (state.votes[aid]) return Promise.resolve();
    state.votes[aid] = String(optionIdx);
    notify();
    return (async () => {
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
        cacheVote(aid, optionIdx);
      } catch (err) {
        delete state.votes[aid];
        notify();
        reportError(err, { where: "duelVote", gid });
        throw err;
      }
    })();
  },
};

declare const __APP_BUILD__: number;

const LIVE = {
  social: SOCIAL,
  feedReady: false,
  get stats() {
    return { ...state.stats };
  },
  get appBuild(): number {
    return typeof __APP_BUILD__ === "number" ? __APP_BUILD__ : 0;
  },
  get updateAvailable(): boolean {
    return this.appBuild > 0 && state.meta.latestBuild > this.appBuild;
  },
  get updateRequired(): boolean {
    // a build that doesn't know its own number (appBuild 0: tests,
    // exotic bundlers) must never brick itself against server meta
    return this.appBuild > 0 && state.meta.minBuild > this.appBuild;
  },
  get updateUrl(): string {
    return state.meta.updateUrl;
  },
  get latestBuild(): number {
    return state.meta.latestBuild;
  },
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
        reportError(err, { where: "saveTestResult" });
      }
    })();
  },
  async linkGoogle(): Promise<void> {
    const m = await import("../../lib/firebase");
    return m.linkGoogle();
  },
  async deleteAccount(): Promise<void> {
    torndown = true;
    const db = await getDb();
    const { getFunctions: gf, httpsCallable: hc } = await import("firebase/functions");
    await hc(gf(db.app, "us-central1"), "deleteAccount")({});
    // The account is gone: stop the uid-scoped groups listener before
    // the purge/reload — left running it would only error
    // (permission-denied) against the deleted account's query.
    try {
      state.groupsUnsub?.();
      // The agg and reveal snapshot listeners are uid-scoped too, and
      // their handlers write the caches the purge below is about to clear.
      Object.values(state.aggUnsubs).forEach((u) => { try { u(); } catch { /* best-effort */ } });
      Object.values(state.revealUnsubs).forEach((u) => { try { u(); } catch { /* best-effort */ } });
    } catch {
      /* best-effort */
    }
    state.groupsUnsub = null;
    state.aggUnsubs = {};
    state.revealUnsubs = {};
    // "There is no undo" must include THIS device: purge every local
    // trace so the next (fresh anonymous) session doesn't resurrect the
    // deleted account's votes, results, or identity — then drop the
    // now-invalid auth session before the caller reloads.
    try {
      const doomed: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("insight.")) doomed.push(k);
      }
      doomed.forEach((k) => localStorage.removeItem(k));
      sessionStorage.clear();
    } catch {
      /* best-effort */
    }
    try {
      const m = await import("../../lib/firebase");
      await m.googleSignOut();
    } catch {
      /* session may already be invalid — reload handles the rest */
    }
  },
  // read-only views for the Map/Mirror hydration (daily-questions.js)
  dailyBank(): Array<{ id: string; prompt: string }> {
    return state.questions.map((q) => ({ id: q.id, prompt: q.prompt }));
  },
  aggFor(qid: string): AggDoc | null {
    return state.aggs[qid] || null;
  },
  enabled: false,
  // True when this is a LIVE build (VITE_V2_LIVE) whose boot has NOT
  // attached — offline cold start, misconfig, or still hydrating. The
  // UI is showing demo content to a real user; D1 requires labeling
  // it and suppressing the seeded fake people. Reactive via notify():
  // a late successful boot flips enabled and re-renders subscribers.
  get demoInProd(): boolean {
    return import.meta.env.VITE_V2_LIVE === "true" && !this.enabled;
  },
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
      void getDb().then((db) => subscribeReveals(db)).catch(() => {});
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
  // Votes the server has acknowledged (or that hydrate read back) —
  // excludes writes still in flight so permanent records (the Map)
  // never keep a vote whose setDoc may yet be refused. Keyed off
  // state.inflight, NOT the aggregation flag: a stranger's vote folding
  // into the agg mid-flight must not "confirm" our unacked write. With
  // persistentLocalCache the setDoc promise resolves only on SERVER
  // ack, so an offline vote stays out of here (while myVotes()/deck()
  // still show it — optimistic UI) until connectivity returns.
  confirmedVotes(): Record<string, string> {
    const out: Record<string, string> = {};
    Object.keys(state.votes).forEach((k) => {
      if (!(k in state.inflight)) out[k] = state.votes[k];
    });
    return out;
  },
  vote(qid: string, optionId: string): void {
    if (state.votes[qid]) return; // one answer per question, mirroring rules
    const optionIdx = Number(optionId);
    if (!Number.isInteger(optionIdx) || optionIdx < 0) return;
    state.votes[qid] = optionId;
    state.inflight[qid] = true;
    state.unaggregated[qid] = optionIdx;
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
        // Server ack: the write is durable, so the vote may now enter
        // confirmedVotes(). Mirror it into the answers cache only NOW —
        // hydrate() treats insight.answersCache.v1 as a mirror of
        // server-acked answer docs (immutable, never refetched,
        // maxTs-gated), so caching optimistically would let a
        // later-refused write (e.g. a second-device duplicate hitting
        // the create-only rule) resurrect the phantom vote on every
        // future boot with nothing left to reconcile it away.
        delete state.inflight[qid];
        cacheVote(qid, optionIdx);
        notify(); // confirmedVotes() changed — let persistent records (the Map) pick it up
        // one delayed refresh so the next paint has the folded-in count
        setTimeout(() => {
          void (async () => {
            try {
              const { getDoc } = await import("firebase/firestore");
              const snap = await getDoc(doc(db, "v2_question_aggs", qid));
              if (snap.exists()) {
                state.aggs[qid] = snap.data() as AggDoc;
                saveAggCache();
                // Clear the display flag only for an ACKED vote — a
                // still-inflight write cannot be in the agg we just
                // read, and clearing would subtract a vote that isn't
                // there. (Defensive: today this timer is only scheduled
                // after the ack, so inflight is already clear.)
                if (qid in state.unaggregated && !(qid in state.inflight)) {
                  delete state.unaggregated[qid];
                }
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
        delete state.inflight[qid];
        delete state.unaggregated[qid];
        try {
          const WF_LS = "insight.feedVotes.v1";
          const wf = JSON.parse(localStorage.getItem(WF_LS) || "{}") || {};
          if (qid in wf) {
            delete wf[qid];
            localStorage.setItem(WF_LS, JSON.stringify(wf));
          }
        } catch {
          /* best-effort */
        }
        notify();
        reportError(err, { where: "vote", qid });
      }
    })();
  },
};

// 2.5 s budget: warm boots serve the bank from cache well inside it,
// and a slow cold boot renders the mock deck now and attaches live
// later via notify() — better than holding the splash for 5 s.
export async function initLive(timeoutMs = 2500): Promise<void> {
  const flag = import.meta.env.VITE_V2_LIVE === "true";
  if (!flag || !firebaseEnabled) return;
  const boot = (async () => {
    state.uid = await anonSignIn();
    // uid-only (never email/name) — matches sentry.ts's PII stance.
    setSentryUser(state.uid);
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
  boot.catch((err) => {
    console.warn("[LIVE] boot failed — mock mode:", err);
    reportError(err, { where: "boot" });
  });
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
