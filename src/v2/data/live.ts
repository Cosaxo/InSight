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

// All three of these were ALSO imported dynamically further down, at
// seven call sites, which bought exactly nothing: a module that is
// statically imported anywhere in a file is already in that file's chunk,
// so `await import()` of it cannot defer a byte. Rollup said so for
// lib/firebase every build (INEFFECTIVE_DYNAMIC_IMPORT); the other two
// were the same shape without the warning. Static everywhere now — the
// awaits implied a lazy boundary that did not exist.
import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  anonSignIn,
  firebaseEnabled,
  getDb,
  googleSignOut,
  linkGoogle,
  subscribeToAuth,
} from "../../lib/firebase";
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
  splitBanks,
  utcDayIndex as utcDayIndexPure,
} from "./deck";
import type { AggDoc, LiveQuestion, QuestionDoc, VoteContext } from "./deck";

const state = {
  ready: false,
  // Auth session was revoked mid-run. The UI stays on real data (blanking
  // to demo would be a worse lie than a stale-but-true view); this only
  // gates honest copy while a new anonymous session is fetched.
  sessionLost: false,
  uid: null as string | null,
  questions: [] as Array<QuestionDoc & { id: string }>,
  feedBank: [] as Array<QuestionDoc & { id: string }>,
  // Learn cards (D32) — consumed only through LIVE.learnAnswer/learnAgg;
  // splitBanks fences them out of every other bank.
  learnBank: [] as Array<QuestionDoc & { id: string }>,
  // Per-session cache for learn aggregates: null = fetch in flight or
  // found nothing; a doc = the k-floored public agg. On-demand getDoc at
  // reveal time, NOT a standing subscription — 96 snapshots for cards
  // mostly never seen is the wrong cost shape.
  learnAggs: {} as Record<string, AggDoc | null>,
  // First-attempt sends already fired this session (belt to the rules'
  // braces: the create-only rule is the real enforcement).
  learnSent: {} as Record<string, true>,
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
  profile: {
    displayName: "",
    testResults: {} as Record<string, unknown>,
    // The seven rules-validated anchor fields (D8). Snapshotted onto each
    // answer at vote time so an aggregate can slice by them without ever
    // reading a second document — and so a later profile edit cannot
    // retroactively rewrite which cohort a past answer counted in.
    anchors: {} as Record<string, string>,
  },
  meta: { latestBuild: 0, minBuild: 0, updateUrl: "" },
  stats: { bankSource: "none", aggsFetched: 0, answersFetched: 0 },
  groups: [] as Array<Record<string, unknown> & { id: string }>,
  duelBank: [] as Array<QuestionDoc & { id: string }>,
  reveals: {} as Record<string, Record<string, unknown> | null>,
  groupsUnsub: null as null | (() => void),
  revealUnsubs: {} as Record<string, () => void>,
  revealDay: "",
  // Reveal HISTORY, fetched on demand for the Mirror's Groups portrait —
  // gid → day → doc, or null for a day that has no readable reveal
  // (skipped day, or one revealed before this user joined; the rules
  // return permission-denied for the latter and that is the rule working).
  // In-memory only: ≤ REVEAL_HIST_DAYS doc reads per group per session,
  // paid only when the portrait is opened, never at boot.
  revealHist: {} as Record<string, Record<string, Record<string, unknown> | null>>,
  revealHistLoading: {} as Record<string, boolean>,
};

// The anchor keys firestore.rules accepts, with its per-field length caps
// (isValidV2Anchors). Kept here rather than inline so the client and the
// ruleset can be diffed against each other by eye.
const ANCHOR_FIELDS: Record<string, number> = {
  city: 80, country: 80, ageBand: 20, gender: 40,
  profession: 80, education: 80, relationship: 40,
};

// The snapshot written onto an answer. A copy, so a later profile edit
// cannot retroactively move a past answer into a different cohort.
function answerAnchors(): Record<string, string> {
  return { ...state.profile.anchors };
}

function utcDayKey(offsetDays = 0): string {
  return new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);
}

// How far back the Groups portrait reads. 14 days ≈ the window a weekly
// group actually remembers, and its cost ceiling is 13 doc reads per group
// per session (yesterday rides the existing reveal listener) — paid only
// when the portrait is opened.
const REVEAL_HIST_DAYS = 14;

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
  // Ceiling, not a target: 213 seeded post-W2, ~248 after the D30 archive
  // promotion, ~344 with the planned learn surface — and the promotion
  // pipeline adds up to 12/week, ≈600/year. 1500 is about two years of
  // headroom; if the bank ever approaches it, paginate rather than raise
  // again (a silent cap here serves users a truncated bank with no error
  // anywhere).
  const BANK_LIMIT = 1500;
  const BANK_SURFACES = ["daily", "feed", "test", "group", "duo", "learn"];
  let all: BankEntry[] | null = null;
  // v2: the entry gained an `updatedAt` cursor. A v1 payload simply misses
  // and pays one full refetch, which is the correct upgrade cost.
  const BANK_LS = "insight.bankCache.v2";
  let cursor = 0;
  try {
    const cached = JSON.parse(localStorage.getItem(BANK_LS) || "null");
    if (cached && cached.rev === contentRev && Array.isArray(cached.questions) && cached.questions.length) {
      all = cached.questions as BankEntry[];
      cursor = Number(cached.cursor || 0);
      state.stats.bankSource = "cache";
    }
  } catch {
    /* corrupt cache — refetch below */
  }
  // Rows are stored without `updatedAt`: it is a transport field, and a
  // Timestamp does not survive JSON round-tripping as a Timestamp. Keeping
  // it would leave a plain {seconds,nanoseconds} object on the cache path
  // and a real Timestamp on the network path — the kind of difference that
  // only shows up in whichever branch nobody tested.
  const rowsOf = (snap: Awaited<ReturnType<typeof getDocs>>): BankEntry[] =>
    snap.docs
      .map((d) => {
        // data() hands back a fresh object per call, so dropping the field
        // in place is safe and keeps the cached row shape identical on both
        // the delta and full-fetch paths.
        const row = d.data() as QuestionDoc & { updatedAt?: unknown };
        delete row.updatedAt;
        return { id: d.id, ...row };
      })
      .filter((q) => BANK_SURFACES.includes(q.surface));
  const cursorOf = (snap: Awaited<ReturnType<typeof getDocs>>): number =>
    snap.docs.reduce((mx, d) => {
      const u = d.get("updatedAt");
      return u && typeof u.toMillis === "function" ? Math.max(mx, u.toMillis()) : mx;
    }, 0);

  // ── the incremental path ──
  // A weekly promotion changes ~7 documents out of 369. Re-reading the
  // whole bank for that was the single largest read cost in the system
  // (docs/COSTS.md): 369 reads per returning device per reseed, charged
  // against monthly users, not daily ones. The seed now moves `updatedAt`
  // only on documents it actually rewrote, so the delta is fetchable.
  //
  // The 5s rewind is not superstition: a batch commit stamps every doc in
  // it with one server timestamp, so a strict `>` against the highest one
  // we have seen can step over a doc committed in the same instant by a
  // later batch. Re-reading a handful of rows we already hold is the
  // cheaper mistake by far.
  if (all && cursor > 0) {
    try {
      const dsnap = await getDocs(
        query(
          collection(db, "v2_questions"),
          where("updatedAt", ">", Timestamp.fromMillis(cursor - 5000)),
          limit(BANK_LIMIT),
        ),
      );
      if (dsnap.size >= BANK_LIMIT) {
        // A delta that fills the page is not a delta. Fall through to the
        // full fetch rather than silently serving a truncated bank.
        all = null;
      } else {
        const byId = new Map(all.map((q) => [q.id, q]));
        for (const row of rowsOf(dsnap)) byId.set(row.id, row);
        all = [...byId.values()];
        cursor = Math.max(cursor, cursorOf(dsnap));
        if (dsnap.size) state.stats.bankSource = "delta";
      }
    } catch (err) {
      // A failed delta must not cost the session: fall back to the cached
      // bank we already have. Worst case the user is one promotion behind
      // until the next boot, which is invisible — the deck rotates over
      // questions they already hold (D30's epoch makes growth pure
      // extension).
      reportError(err, { where: "hydrate.bankDelta" });
    }
  }
  if (!all) {
    const qsnap = await getDocs(
      query(
        collection(db, "v2_questions"),
        where("surface", "in", BANK_SURFACES),
        limit(BANK_LIMIT),
      ),
    );
    all = rowsOf(qsnap);
    cursor = cursorOf(qsnap);
    state.stats.bankSource = "network";
  }
  try {
    localStorage.setItem(BANK_LS, JSON.stringify({ rev: contentRev, cursor, questions: all }));
  } catch {
    /* cache is best-effort */
  }
  const active = all
    .filter((q) => q.active !== false)
    .sort((a, b) => (a.seq || 0) - (b.seq || 0));

  // Allowlist split per surface — pure and unit-tested in deck.ts
  // (splitBanks carries the why-comments: playability, the D12 rank
  // exclusion, and the D32 learn fencing).
  const banks = splitBanks(active);
  state.questions = banks.daily;
  state.feedBank = banks.feed;
  state.duelBank = banks.duel;
  state.learnBank = banks.learn;
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
      const prof = await getDoc(doc(db, "v2_users", uid0));
      if (prof.exists()) {
        state.profile.displayName = (prof.get("displayName") as string) || "";
        state.profile.testResults =
          (prof.get("testResults") as Record<string, unknown>) || {};
        state.profile.anchors =
          (prof.get("anchors") as Record<string, string>) || {};
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
        // permission-denied here is the RULE WORKING, not a fault: reveal
        // reads gate on the reveal's own members snapshot, so a member who
        // joined after this day was revealed is denied by design. It is the
        // ordinary state of every late joiner's first day in a group, so
        // reporting it would bury real listener faults in Sentry.
        //
        // Deliberately keeps the unsub entry rather than deleting it. The
        // denial is permanent for this (group, day) pair — re-attaching
        // would fail identically forever — and the midnight rollover above
        // tears down every entry on dayChanged, so tomorrow still retries.
        if ((err as { code?: string }).code === "permission-denied") {
          state.reveals[g.id] = null;
          notify();
          return;
        }
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
  // ── reveal history — the Groups portrait's data source ──
  // Direct doc gets by day key, never a collection query: the reveal read
  // rule gates on each doc's own `members` snapshot, which a list query
  // cannot prove, so a query would be denied wholesale while per-doc gets
  // succeed exactly for the days this user played.
  async loadRevealHistory(gid: string, days = REVEAL_HIST_DAYS): Promise<void> {
    if (state.revealHistLoading[gid]) return;
    const have = (state.revealHist[gid] = state.revealHist[gid] || {});
    const wanted: string[] = [];
    // -2 backwards: yesterday (-1) already has a live listener (reveals),
    // and revealHistory() below merges it in — fetching it twice would
    // just double the read.
    for (let i = 2; i <= days; i++) {
      const key = utcDayKey(-i);
      if (!(key in have)) wanted.push(key);
    }
    if (!wanted.length) return;
    state.revealHistLoading[gid] = true;
    try {
      const db = await getDb();
      await Promise.all(
        wanted.map(async (key) => {
          try {
            const snap = await getDoc(doc(db, "v2_groups", gid, "reveals", key));
            have[key] = snap.exists() ? (snap.data() as Record<string, unknown>) : null;
          } catch (err) {
            // permission-denied = a day revealed before this user joined;
            // the doc will never become readable, so cache the null.
            if ((err as { code?: string }).code === "permission-denied") {
              have[key] = null;
              return;
            }
            // transient (offline, deadline): leave the key absent so a
            // later call retries it rather than freezing a gap into the
            // portrait for the rest of the session
            reportError(err, { where: "revealHistory", gid });
          }
        }),
      );
    } finally {
      state.revealHistLoading[gid] = false;
      notify();
    }
  },
  // Every readable reveal for this group, newest first — the cached
  // history plus yesterday's live listener doc. Shape matches what
  // groupPortrait.ts consumes.
  revealHistory(gid: string): Array<Record<string, unknown> & { day: string }> {
    const out: Array<Record<string, unknown> & { day: string }> = [];
    const yesterday = state.reveals[gid];
    if (yesterday) out.push({ day: state.revealDay, ...yesterday } as Record<string, unknown> & { day: string });
    const hist = state.revealHist[gid] || {};
    for (const [day, docData] of Object.entries(hist)) {
      if (docData) out.push({ day, ...docData } as Record<string, unknown> & { day: string });
    }
    out.sort((a, b) => (a.day < b.day ? 1 : -1));
    return out;
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
          anchors: answerAnchors(),
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
  // The viewer's own city anchor ("Oslo, NO"), or "" if they have not
  // picked one. Mirror's Near reads it to find its own bucket inside the
  // public, k-floored city breakdown — it never reads anyone else's
  // profile to do so (D5). Empty for a pre-D9 profile holding free text,
  // which is why Near asks those users to re-pick rather than guessing.
  get myCity(): string {
    const city = state.profile.anchors.city || "";
    return /^.+, [A-Z]{2}$/.test(city) ? city : "";
  },
  async saveDisplayName(name: string): Promise<void> {
    const db = await getDb();
    const uid = state.uid;
    if (!uid) throw new Error("no session");
    await setDoc(doc(db, "v2_users", uid), { displayName: name }, { merge: true });
    state.profile.displayName = name;
    notify();
  },
  // The anchors the profile has collected, as a plain map. Empty until the
  // user fills the Basics card in — an answer with no anchors simply folds
  // into no breakdown cell (D8).
  saveAnchors(next: Record<string, string>): void {
    const clean: Record<string, string> = {};
    // Only the seven keys firestore.rules validates, trimmed and capped to
    // its per-field lengths. Sending anything else fails the whole write,
    // so the client must not rely on the server to reject the extras.
    for (const [k, max] of Object.entries(ANCHOR_FIELDS)) {
      const v = next[k];
      if (typeof v !== "string") continue;
      const t = v.trim();
      if (t) clean[k] = t.slice(0, max);
    }
    state.profile.anchors = clean;
    void (async () => {
      try {
        const db = await getDb();
        const uid = state.uid;
        if (!uid) return;
        // merge:false on the nested map would drop the other profile
        // fields, so the anchors map is replaced wholesale under a merge.
        await setDoc(doc(db, "v2_users", uid), { anchors: clean }, { merge: true });
      } catch (err) {
        reportError(err, { where: "saveAnchors" });
      }
    })();
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
    return linkGoogle();
  },
  // The operator seed, reachable from a browser console.
  //
  // WHY THIS EXISTS AT ALL. SHIP-CHECKLIST §1 step 3 — the one remaining
  // step between a deployed backend and an app with questions in it — is
  // written around a console call, and the command it gave
  // (`firebase.functions().httpsCallable("seedContentV2")()`) is v8
  // namespaced syntax. This app is on the modular SDK and publishes no
  // global `firebase`, so that line threw `ReferenceError` on a project
  // nobody could seed. The private `callable()` above did the right thing
  // and had no way in.
  //
  // WHY IT IS SAFE TO SHIP IN EVERY BUNDLE. The control was never this
  // handle: `assertOperator` refuses any uid outside SEED_ADMIN_UIDS
  // (functions/src/ops.ts), and D3 means "signed in" is not a control at
  // all — anonymous auth makes every install an identity. Exposing the
  // call adds no privilege; withholding it only hid the instrument from
  // the operator, since anyone else could always POST the endpoint
  // directly.
  //
  // WHY IT IS SEED-SHAPED RATHER THAN A GENERIC callFn(name, data). A
  // console lever that invokes any callable by name is a debugging tool
  // that outlives its reason and gets reached for from spec-layer code;
  // this one names its function and cannot become that.
  async seedContent(bumpRev = false): Promise<unknown> {
    return callable("seedContentV2", { bumpRev: bumpRev === true });
  },
  async deleteAccount(): Promise<void> {
    torndown = true;
    const db = await getDb();
    await httpsCallable(getFunctions(db.app, "us-central1"), "deleteAccount")({});
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
    purgeLocalTrace();
    try {
      sessionStorage.clear();
    } catch {
      /* best-effort */
    }
    try {
      await googleSignOut();
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
  // ── Learn (D32) ──
  // The first attempt on a learn card is a plain world answer; the
  // scheduler's spaced retries stay device-local and the create-only rule
  // refuses them anyway. Fire-and-forget: a failed write costs one crowd
  // datum, never the local mastery flow.
  learnAnswer(cardId: string, optionIdx: number): void {
    if (!this.enabled) return;
    const qid = "learn-" + cardId;
    if (state.learnSent[qid]) return;
    // Only cards the seeded bank actually carries — a demo-only card (or a
    // farm card ahead of its reseed) has no question doc, so a write would
    // just bounce off the rules' question lookup.
    const q = state.learnBank.find((x) => x.id === qid);
    if (!q) return;
    if (!Number.isInteger(optionIdx) || optionIdx < 0 || optionIdx >= q.options.length) return;
    state.learnSent[qid] = true;
    void (async () => {
      try {
        const db = await getDb();
        const uid = state.uid;
        if (!uid) return;
        await setDoc(doc(db, "v2_users", uid, "answers", qid), {
          qid,
          surface: "learn",
          optionIdx,
          answeredAt: serverTimestamp(),
          // No anchors on learn answers: the crowd stat is one global
          // number, and starting without segments means nothing to
          // suppress and nothing to re-argue under D8's floors.
          anchors: {},
        });
      } catch (err) {
        reportError(err, { where: "learnAnswer" });
      }
    })();
  },
  // Synchronous cached read with a one-shot background fetch: LEARN_SPLIT
  // calls this in a render path, so it can never await. First call for a
  // card returns null (the authored estimate renders, labeled) and kicks
  // one getDoc; if a published agg exists, notify() re-renders subscribers
  // with the measured split. One read per distinct card per session.
  learnAgg(cardId: string): AggDoc | null {
    const qid = "learn-" + cardId;
    if (qid in state.learnAggs) return state.learnAggs[qid];
    state.learnAggs[qid] = null;
    void (async () => {
      try {
        const db = await getDb();
        const snap = await getDoc(doc(db, "v2_question_aggs", qid));
        if (snap.exists()) {
          state.learnAggs[qid] = snap.data() as AggDoc;
          notify();
        }
      } catch (err) {
        // Leave the null cache entry: the estimate stays up, labeled.
        reportError(err, { where: "learnAgg", qid });
      }
    })();
    return null;
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
    // Midnight rollover under a long-lived session. computeDeck stays here
    // and stays synchronous: this getter is called during render, and the
    // first paint after midnight has to show the new day's questions.
    //
    // The Firestore subscriptions that follow from a rollover do NOT
    // belong in a render path — they now run from the wake handler
    // (resubscribeForToday). Worst case between a rollover and the next
    // wake is a deck rendered without live count updates, which the next
    // foreground fixes.
    if (state.questions.length && state.deckDay !== dayIndex()) {
      computeDeck();
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
          anchors: answerAnchors(),
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
// Guards the one-shot anonymous re-sign-in after a lost session, so a
// server that keeps revoking cannot spin here.
let sessionRecoveryTried = false;

// Hard reset to a different account. Everything derived from the old uid
// has to go — in-memory AND on disk — before anything is fetched for the
// new one, or the two interleave and one account's answers render as the
// other's.
function resetForNewUid(uid: string): void {
  try {
    state.groupsUnsub?.();
    Object.values(state.aggUnsubs).forEach((u) => { try { u(); } catch { /* best-effort */ } });
    Object.values(state.revealUnsubs).forEach((u) => { try { u(); } catch { /* best-effort */ } });
  } catch {
    /* best-effort */
  }
  state.groupsUnsub = null;
  state.aggUnsubs = {};
  state.revealUnsubs = {};
  state.votes = {};
  state.inflight = {};
  state.unaggregated = {};
  state.aggs = {};
  state.groups = [];
  state.reveals = {};
  state.revealHist = {};
  state.revealHistLoading = {};
  state.profile = { displayName: "", testResults: {}, anchors: {} };
  state.deckIds = [];
  state.deckDay = -1;
  state.ready = false;
  state.sessionLost = false;
  state.uid = uid;
  purgeLocalTrace();
  setSentryUser(uid);
  notify();
  void refreshLive().catch((err) => reportError(err, { where: "refreshLive.uidChange" }));
}

// Remove every `insight.*` key. Used by deleteAccount and by the
// uid-change path — NOT a hand-listed subset: there are ~29 such keys
// (feed votes, daily answers, test results and progress, replies, takes,
// likes, friends, duels, scenes, suggestions, caches…) and none is
// uid-keyed, so any one left behind shows the previous account's data
// under the new one. Enumerating by prefix is the only version that stays
// correct when a new key is added.
function purgeLocalTrace(): void {
  try {
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("insight.")) doomed.push(k);
    }
    doomed.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* best-effort */
  }
  // Announce it. Spec-layer stores (lens-defs today) keep an in-memory
  // copy of what was just removed, and the uid-change path has no reload
  // behind it — without this, the store's next save() writes the previous
  // account's data straight back under the new uid. An event rather than
  // hand-wired calls, for this function's own reason: a hand-listed
  // subset of stores goes stale the day a new store is added.
  try {
    window.dispatchEvent(new Event("insight:local-purge"));
  } catch {
    /* best-effort: no window in plain-node tests */
  }
}

// Re-attach the day's listeners after a rollover. Called from the wake
// handler rather than from deck(), so that a render never triggers
// network work. Cheap and idempotent when the day has not changed:
// subscribeAggs drops listeners for questions no longer in the deck and
// skips ones already attached.
async function resubscribeForToday(): Promise<void> {
  if (torndown || !state.ready) return;
  try {
    if (state.questions.length && state.deckDay !== dayIndex()) {
      computeDeck();
      notify();
    }
    await subscribeAggs();
    const db = await getDb();
    subscribeReveals(db);
  } catch (err) {
    reportError(err, { where: "resubscribeForToday" });
  }
}

// The whole live attach, made re-entrant so it can run again on a
// reconnect instead of only once at boot. Two banners in the UI say
// "reconnecting…" (mirror-tab.jsx, daily-split.jsx) and until now nothing
// in the codebase ever did — a boot that lost the race or failed left
// LIVE disabled for the life of the process, which on mobile can be days.
//
// Concurrency: a single in-flight promise is shared, so an `online` event
// arriving in the middle of a visibilitychange refresh joins that run
// rather than starting a second one.
let refreshInFlight: Promise<void> | null = null;
let pushRegistered = false;
let deviceBindAttempted = false;

export function refreshLive(): Promise<void> {
  if (torndown) return Promise.resolve();
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    state.uid = await anonSignIn();
    // uid-only (never email/name) — matches sentry.ts's PII stance.
    setSentryUser(state.uid);
    await hydrate();
    await hydrateSocial();
    state.ready = true;
    // fire-and-forget: reveal notifications on real devices (no-op on web).
    // Once per process — re-registering on every reconnect would churn the
    // token array for no gain.
    if (!pushRegistered) {
      pushRegistered = true;
      void import("./push")
        .then((m) => m.registerPushForReveals(state.uid as string))
        .catch(() => { pushRegistered = false; });
    }
    // fire-and-forget, same shape: the D29 device-binding activation.
    // Once per process; ensureDeviceBound() itself memoizes per uid in
    // localStorage, handles the missing native bridge, and never surfaces
    // UI — see src/v2/data/deviceBind.ts.
    if (!deviceBindAttempted) {
      deviceBindAttempted = true;
      void import("./deviceBind")
        .then((m) => m.ensureDeviceBound(state.uid as string))
        .catch(() => { deviceBindAttempted = false; });
    }
    LIVE.enabled = true;
    notify();
  })().finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}

// Wake handlers. A healthy wake must stay cheap — the common case is a
// user swapping apps for ten seconds — so a ready session only does the
// midnight-rollover check, and a full refresh runs when the session never
// attached or the deck has aged out.
function wake(): void {
  if (torndown) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  if (!state.ready) {
    void refreshLive().catch((err) => reportError(err, { where: "refreshLive.wake" }));
    return;
  }
  // Attaches listeners for the new day's deck if the date rolled over
  // while the app was backgrounded; no-op otherwise.
  void resubscribeForToday();
}

export async function initLive(timeoutMs = 2500): Promise<void> {
  const flag = import.meta.env.VITE_V2_LIVE === "true";
  if (!flag || !firebaseEnabled) return;
  const boot = refreshLive();

  // Observe auth for the rest of the session. state.uid used to be sampled
  // once and never watched, so if the session changed underneath us — a
  // revoked token, an account deleted on another device, or linkGoogle
  // falling back to a full sign-in when there was no currentUser — the
  // store kept the PREVIOUS account's votes in memory and rendered them as
  // the new account's. On a shared uid-agnostic localStorage, that is one
  // person's answers displayed to another.
  subscribeToAuth((user) => {
    if (torndown) return;
    const next = user?.uid || null;
    if (next && state.uid && next !== state.uid) {
      resetForNewUid(next);
      return;
    }
    if (next && !state.uid) {
      state.uid = next;
      return;
    }
    if (!next && state.uid) {
      // Session lost. Deliberately do NOT flip enabled=false: the deck and
      // the bank on screen are still valid, and blanking to demo data is a
      // worse lie than a stale-but-true view. Anonymous-first means we can
      // usually just get a new session (D3).
      state.sessionLost = true;
      notify();
      if (!sessionRecoveryTried) {
        sessionRecoveryTried = true;
        void anonSignIn()
          .then((uid) => {
            state.sessionLost = false;
            if (uid !== state.uid) resetForNewUid(uid);
            else notify();
          })
          .catch((err) => reportError(err, { where: "auth.recover" }));
      }
    }
  });

  // Guarded for the node-environment unit tests, which run without a DOM.
  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("online", wake);
  }
  if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) wake();
    });
  }
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
