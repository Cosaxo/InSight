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

// ── the Firestore/Functions API, bound rather than imported (D110) ──
//
// These were static imports, and the note here used to explain why: seven
// call sites had ALSO `await import()`ed them, which bought nothing, because
// a module statically imported anywhere in a file is already in that file's
// chunk. That reasoning was right and its conclusion — "static everywhere" —
// was the wrong end to fix it from. live.ts is eager, so the static import
// put the 292 KB Firestore SDK in the FIRST-PAINT graph of every build,
// including one with no `VITE_FIREBASE_*` configured at all. Measured:
// removing these two imports takes entry + every `modulepreload` from
// 1270.2 KB to 943.0 KB — 327 KB, 26% of what a cold start must fetch and
// parse before it can paint. The entry chunk does not move by a byte, which
// is why neither of `check:bundle`'s old ceilings ever said a word.
//
// WHY THE 73 CALL SITES BELOW ARE UNCHANGED, and why that is safe rather
// than lucky. Every Firestore use in this file sits in a scope that holds a
// `db` — checked, all 73, including the eleven that take no db argument
// (`Timestamp.fromMillis`, `serverTimestamp`, `documentId`). A `db` can be
// obtained only from `getDb()`, which awaits lib/firebase's single memoised
// `impl()` promise, which IS the dynamic import of firebaseImpl.ts, which
// statically holds `firebase/firestore`. So binding these names off that
// same promise makes every call site correct by the PROVENANCE of the value
// it already uses — there is no load order to audit, and no site that could
// be missed.
//
// The local `getDb` below is the whole mechanism. It shadows the import
// deliberately: the 25 `await getDb()` sites in this file did not change
// either, and a reader who follows one lands here.
type FsApi = typeof import("firebase/firestore");
type FnsApi = typeof import("firebase/functions");
let clearIndexedDbPersistence!: FsApi["clearIndexedDbPersistence"];
let collection!: FsApi["collection"];
let deleteDoc!: FsApi["deleteDoc"];
let doc!: FsApi["doc"];
let documentId!: FsApi["documentId"];
let getDoc!: FsApi["getDoc"];
let getDocs!: FsApi["getDocs"];
let limit!: FsApi["limit"];
let onSnapshot!: FsApi["onSnapshot"];
let orderBy!: FsApi["orderBy"];
let query!: FsApi["query"];
let serverTimestamp!: FsApi["serverTimestamp"];
let setDoc!: FsApi["setDoc"];
let startAfter!: FsApi["startAfter"];
let terminate!: FsApi["terminate"];
let Timestamp!: FsApi["Timestamp"];
let updateDoc!: FsApi["updateDoc"];
let where!: FsApi["where"];
let getFunctions!: FnsApi["getFunctions"];
let httpsCallable!: FnsApi["httpsCallable"];

import {
  anonSignIn,
  firebaseEnabled,
  getDb as getDbRaw,
  getFirestoreApi,
  getFunctionsApi,
  googleSignOut,
  linkGoogle,
  subscribeToAuth,
} from "../../lib/firebase";
// R2/D270: the anonymous feature tally. Imported, never a global (rule 4
// only moves down); armed in initLive below and a no-op everywhere else.
import * as engagement from "./engagement";

async function getDb(): Promise<import("firebase/firestore").Firestore> {
  // Promise.all, not three awaits: all three resolve from the SAME memoised
  // impl() promise, so this is one load however many callers race here.
  const [db, fs, fns] = await Promise.all([
    getDbRaw(), getFirestoreApi(), getFunctionsApi(),
  ]);
  ({
    clearIndexedDbPersistence, collection, deleteDoc, doc, documentId, getDoc,
    getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc,
    startAfter, terminate, Timestamp, updateDoc, where,
  } = fs);
  ({ getFunctions, httpsCallable } = fns);
  return db;
}
import { reportError, setSentryUser } from "../../lib/sentry";
// No imports of its own, so reading it here closes no cycle back through
// data/cityAnchor — which imports this module.
import { cityIsConfirmed } from "./cityConfirm";
// The cross-user read (D98). Pure helpers + the two queries live there so
// the grouping/sorting can be unit-tested without Firebase.
import { fetchVoters, groupByOption, resolveNames, sortVoters, type Voter } from "./voters";
// Handles and invitations (D122), TYPE-ONLY at module scope and imported
// for real inside the methods that use them — the same shape data/circle
// has below, and for the same measured reason.
//
// Both modules statically import `firebase/firestore`. live.ts is eager,
// so a static import here drags the whole SDK back into the first-paint
// chunk: check:bundle measured the eager graph at 1270 KB with it, against
// a 955 KB ceiling. That is not a near miss — it is precisely the tree as
// it stood before D110, which is the regression that gate was written to
// catch. Every call site is already async and already awaits getDb(), so
// the dynamic import costs no round trip that was not happening anyway.
import type { Invite } from "./invites";
import { passiveResult, passiveTest } from "./passiveProfile";
// @ts-expect-error TS7016 — untyped spec module (the testNorms.ts /
// LiveSimilarityField.tsx pattern). The cast below is pinned rather than
// hopeful: content-parity.test.jsx holds IS_TESTS to exactly this shape.
import { IS_TESTS } from "../spec/test-definitions.js";
import {
  CORE_TEST_KINDS,
  pickKindredQids,
  voteIndices,
  type KindredPerson,
  type ParsedResults,
  type TestDefs,
} from "./similarity";
import {
  AVATAR_MAX_BYTES, avatarPath, shrinkToSquare, tokenFromUrl,
} from "./avatar";
// Pure folds over the published breakdown, and the likeness metric behind
// Kindred. No Firebase in there — this module supplies the documents.
import { agreement, countsSpan, denseCounts, divisiveness, type Agreement } from "./cohort";
// The follow graph (D101), TYPE-ONLY at module scope and imported for
// real inside the two methods that use it.
//
// Dynamic on purpose: live.ts is eager, so a static import would pull
// data/circle.ts into the first-paint chunk for a feature that cannot
// run until the Mirror's third stop is opened — and the entry chunk has
// 3 KB of headroom under MAX_CHUNK_KB by design (see the D100 note in
// scripts/check-bundle.mjs). Both call sites are already async and
// already await getDb(), so the import costs no round trip that was not
// happening anyway.
import type { Member as CircleMember } from "./circle";
// Type-only, so the query module stays behind the dynamic import that
// keeps `firebase/firestore` off the first-paint path (D122).
import type { DirectoryPerson } from "./socialFetch";
// Foresight (D126). Type-only at module scope; the fold and the writer
// are reached through the same dynamic import the circle uses, and for
// the same reason — live.ts is eager and this cannot run until a lens
// nobody has opened is opened.
import type { Verdict as ForesightVerdict } from "./foresight";
// Stated topic preferences (D128). A static import, unlike circle's: this
// is applied on every feed rebuild rather than on a lens nobody opened,
// and the module is a few hundred bytes of localStorage plumbing.
// The passive tests' round-robin (D155). Lives with the feed's other
// interleave arithmetic so both are testable without Firebase.
import { roundRobinBy } from "./feed-interleave";
// The feed's test-card pool. A named publisher rather than a `window`
// cast, because a cast is what let D249 sever this seam in silence.
import { publishTestFeed } from "./testFeed";
// The Learn engine's cards. Published by name for testFeed's reason, and
// because the bundle stopped carrying the bank at D284.
import { publishLearnBank, type LearnCard } from "./learnBank";
// Pure deck-shaping logic lives in ./deck (unit-testable, no firebase);
// this module passes its store state in.
import {
  buildS as buildSPure,
  computeDeckIds,
  countsFor,
  dayIndex as dayIndexPure,
  duelQFor as duelQForPure,
  hasPublishedCounts,
  isCore,
  rankCrowdFor,
  CANON_BOARD_N,
  splitBanks,
  utcDayIndex as utcDayIndexPure,
} from "./deck";
import type { AggDoc, CallOutcome, LiveQuestion, QuestionDoc, VoteContext } from "./deck";
import type { FeedAd } from "./sponsored";
import { nearMode, nearOptedIn, nearUntil, setNearMode, type NearMode } from "./near";
// The device computes its own archetype name for the presence doc (D176).
import { myType } from "./typeMix";
import { patternsEligible, type PatternsSignal } from "./patternsReady";
import { locateCell, locateSupported } from "./locate";
import { scrubPersonaAnchors } from "./personaResidue";
import { FUNCTIONS_REGION } from "../../lib/region";

/**
 * One Crossroads story, folded (D136).
 *
 * `counts` is per-ENDING, in PATH_ENDINGS order — the same order the bank's
 * synthesized `options` are in, which is what makes a stored optionIdx mean
 * an ending. A branch's share is the sum of the endings beneath it over
 * `total`; with `total` at 0 there is no crowd yet and the card says so
 * rather than dividing.
 */
export type LivePathQ = QuestionDoc & { id: string; counts: number[] };

const state = {
  ready: false,
  // Why boot did not attach, in the user's own build. See LIVE.bootError.
  bootError: "",
  // Which await boot is sitting on, "" once attached. Separate from
  // bootError because a hang and a throw are different failures and the
  // first field report could not tell them apart.
  bootStage: "",
  // The render race ended before boot attached. Not itself a failure —
  // boot may still be running — but it is what makes the label appear.
  raceLost: false,
  // Auth session was revoked mid-run. The UI stays on real data (blanking
  // to demo would be a worse lie than a stale-but-true view); this only
  // gates honest copy while a new anonymous session is fetched.
  sessionLost: false,
  uid: null as string | null,
  linked: false,
  questions: [] as Array<QuestionDoc & { id: string }>,
  feedBank: [] as Array<QuestionDoc & { id: string }>,
  // Learn cards (D32) — consumed only through LIVE.learnAnswer/learnAgg;
  // splitBanks fences them out of every other bank.
  learnBank: [] as Array<QuestionDoc & { id: string }>,
  // Foresight CALLs (D194). Their published grades, fetched once per
  // session on the tap that opens the card: qid → outcome, or null for a
  // call the resolver has not graded yet. `null` is a FETCHED ABSENCE and
  // is what the card draws "sealed" from — undefined means nothing has
  // been read, which is a different sentence.
  callBank: [] as Array<QuestionDoc & { id: string }>,
  // The pulse roster, straight off the hydrated bank — see splitBanks.
  pulseBank: [] as Array<QuestionDoc & { id: string }>,
  callOutcomes: null as Record<string, CallOutcome | null> | null,
  // Feed ads (D197). Null while unread, an array once known — the same
  // "could not ask" / "there are none" distinction every other pool here
  // keeps. Read once per session with the feed, which is lazy, so a boot
  // that never opens the feed never pays for it.
  ads: null as FeedAd[] | null,
  // Per-session cache for learn aggregates: null = fetch in flight or
  // found nothing; a doc = the k-floored public agg. On-demand getDoc at
  // reveal time, NOT a standing subscription — 96 snapshots for cards
  // mostly never seen is the wrong cost shape.
  learnAggs: {} as Record<string, AggDoc | null>,
  // First-attempt sends already fired this session (belt to the rules'
  // braces: the create-only rule is the real enforcement).
  learnSent: {} as Record<string, true>,
  // The viewer's OWN first try, and whether the cached aggregate above
  // has absorbed it yet (D157). `learnAnswer` writes the answer and then
  // re-reads the aggregate, and it loses that race far more often than it
  // wins — so the reveal drawn a beat later was the crowd WITHOUT you,
  // one line under a tick saying you got it right. On a card two people
  // have answered that is the difference between "0 people · 0%" and "1
  // person · 50%" beside the option you just tapped.
  learnMine: {} as Record<string, { idx: number; folded: boolean }>,
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
  // qid -> Date.now() of the last ACKED edit (D86). Client mirror of the
  // rules' one-edit-per-answer-per-60s cooldown, so the UI can refuse a
  // doomed write synchronously instead of flipping and bouncing back.
  // In-memory on purpose: after a relaunch the server arm still enforces,
  // and the rollback path already handles that refusal.
  editedAt: {} as Record<string, number>,
  // ── social (groups & duos) ──
  profile: {
    displayName: "",
    testResults: {} as Record<string, unknown>,
    handle: "",
    // The seven rules-validated anchor fields (D8). Snapshotted onto each
    // answer at vote time so an aggregate can slice by them without ever
    // reading a second document — and so a later profile edit cannot
    // retroactively rewrite which cohort a past answer counted in.
    anchors: {} as Record<string, string>,
  },
  // `patterns*` are written by the nightly fit rather than the seed
  // (functions/src/patterns.ts) — the crowd half of the Patterns tab's
  // mount gate (D265), riding the meta read hydrate already pays.
  meta: { latestBuild: 0, minBuild: 0, updateUrl: "", patternsPool: 0, patternsBasis: 0 },
  stats: { bankSource: "none", aggsFetched: 0, answersFetched: 0, callOutcomesFetched: 0 },
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
  // ── circle takes (D1, docs/MODERATION.md) ──
  // gid → the circle's readable takes, newest first. Fetched on demand
  // (a circle's take list is opened, not watched) and held for the
  // session; `takesLoading` is the in-flight guard, same shape as
  // revealHistLoading above.
  takes: {} as Record<string, TakeDoc[]>,
  takesLoading: {} as Record<string, boolean>,
  // takeId → true once this account has flagged it. Flags are create-only
  // and unreadable BY DESIGN (firestore.rules: `allow read: if false` —
  // they are anonymous to the circle and to the moderation run), so this
  // is the only record a client can have of its own report. Session-scoped
  // on purpose: persisting it would be a local claim about a server state
  // nothing can re-read, and a stale "Reported" is a worse lie than a
  // second flag the rules already refuse as a duplicate.
  myFlags: {} as Record<string, true>,
  // ── named who-voted (D98) ──
  // qid → everyone who answered it, newest first, with the cohort frozen
  // on each answer and the author's display name resolved. Fetched on
  // demand and held for the session: this is the app's only cross-user
  // read, it is one collection-group query plus a batched profile read,
  // and a card scrolled past must pay for neither.
  voters: {} as Record<string, Voter[]>,
  votersLoading: {} as Record<string, boolean>,
  // uid → display name ("" for an account that has set none). Shared by
  // every question's voter list, because crowds overlap: without this,
  // opening five questions re-reads the same regulars five times.
  //
  // PERSISTED since D129 (it was session-scoped, and said so here). The
  // same regulars answer the same shared daily every morning, so paying for
  // their profiles again on every cold boot bought nothing. Cross-account
  // leakage — the hazard the old note was really about — is unchanged: the
  // disk copy is uid-stamped, refuses to load under another account, and is
  // swept by purgeLocalTrace. See the PROFILE_LS block for the TTL and the
  // staleness trade it buys.
  names: {} as Record<string, string>,
  // uid → parsed test scores (D112), the `names` cache's sibling: filled
  // by the SAME batched profile read (the web SDK has no field mask, so
  // the whole document was on the wire whenever a name resolved — this
  // keeps what was already paid for). null = fetched, nothing usable.
  scores: {} as Record<string, ParsedResults | null>,
  // The verified logic percentile, third rider on the profile read (D227
  // — the who-voted sheet's Logic cut). Same absent/null doctrine as
  // `scores`: absent = never fetched, null = fetched and untested.
  logicPcts: {} as Record<string, number | null>,
  // uid → Storage download token for their photo, "" for none and for a
  // HIDDEN one (D178). Beside names and scores because it is filled by
  // the same batched read and has exactly their lifetime — a session
  // cache, cleared with the account.
  faces: {} as Record<string, string>,
  // Kindred (D99): no cached ranking, only the flags. The ranking itself
  // is derived on read from `voters` + `votes`, so it cannot go stale
  // against its own inputs.
  kindredLoading: false,
  kindredAt: 0,
  // D278: the city-scoped half of the pool, kept SEPARATE from
  // state.voters rather than merged into it. The who-voted sheet draws
  // state.voters and means "who answered this" — a city-filtered list
  // under that heading would be a different claim wearing the same words.
  // kindredPeople() unions the two; nothing else reads this.
  cityVoters: {} as Record<string, Voter[]>,
  cityVotersAt: "",
  cityKindredLoading: false,
  // Similarity (D112): the constellation fields' one-per-session agg
  // top-up (the bank's core test items) and its in-flight flag.
  similarityLoading: false,
  testAggsLoaded: false,
  // The follow graph's loaded state (D101). null = not asked, or asked
  // and failed; [] = asked, and you follow nobody. The stop says
  // different things for those two.
  circle: null as CircleMember[] | null,
  circleLoading: false,
  // Name-prefix searches already answered this session (D239), keyed by
  // the lowercased prefix. A search box asks the same question on every
  // backspace and the answer cannot have changed between two keystrokes.
  peopleSearch: new Map<string, DirectoryPerson[]>(),
  // The same graph, one query deep (D149). `circle` above is the FOLD —
  // every followed account's answers, one query per member — and it is the
  // right cost for the Circle stop and much too much for a chip on a
  // who-voted sheet, which only needs to know which uids in a list it
  // already holds are friends. Same null/[] convention as `circle`: null is
  // "not asked or failed", [] is "you follow nobody".
  follows: null as string[] | null,
  followsLoading: false,
  // Foresight verdicts, keyed by read id (D126). Loaded once per
  // session on first open of the lens; a verdict is create-only server
  // side, so the local copy can never be stale in a way that matters.
  foresight: null as Record<string, ForesightVerdict> | null,
  foresightLoading: false,
  // Open invitations to this account (D122). An empty array is a real
  // answer here — "nobody has invited you" — so unlike `circle` there is
  // no null state to distinguish from it: the inbox is fetched on the tap
  // that opens a surface showing it, and a failed fetch reports through
  // reportError rather than by making the list ambiguous.
  invites: [] as Invite[],
  invitesLoading: false,
};

// In flight, so two cards opening at once share one query rather than
// racing two. Module-level beside the other loaders' guards rather than in
// `state`, because it is not state anything renders.
let callOutcomesInflight: Promise<void> | null = null;
let adsInflight: Promise<void> | null = null;

/**
 * How many ads one read may return.
 *
 * A ceiling rather than a page: the whole pool has to reach the device
 * for the match to happen there, so a pool that outgrew one read would
 * mean either paging (fine) or server-side selection (not). The number is
 * far above any plausible amount of sold inventory, and if it is ever
 * approached the answer is to page, never to ask the server which ones
 * are mine.
 */
const AD_POOL_CAP = 200;

/**
 * How divisive a question the viewer answered turned out to be, 0..1, or
 * -1 when this device holds no published counts for it (D277 §2).
 *
 * The selection key for loadKindred's twelve. -1 rather than 0 for the
 * unknown case so a question with real counts always outranks one with
 * none, while a brand-new account — which has answered questions whose
 * aggregates have not landed yet — still gets a full twelve rather than an
 * empty pool. `divisiveness` normalises by option count (cohort.ts), so a
 * 2-option daily and a 5-option scale item are comparable.
 */
function divisivenessOf(qid: string): number {
  const counts = state.aggs[qid]?.counts;
  if (!counts) return -1;
  // PUBLISHED COUNTS ARE SPARSE, and the first draft of this walked them
  // as though they were dense — `for i in 0..19, break on the first
  // missing key`. The trigger starts `counts` at `{}` and writes a key
  // only for an option that received a vote (functions/src/v2.ts), and an
  // edit that drives an option back to zero DELETES its key
  // (functions/src/pure.ts). So an option nobody picked is a hole, and a
  // hole ended the vector.
  //
  // It failed hardest exactly where this key matters most. A 5-option item
  // nobody answered with option 0 — counts {"1":50,"2":50,"3":50,"4":50},
  // a near-maximal split and the single best evidence about two people —
  // densified to [] and returned -1, which sorts it BELOW every measured
  // question and out of the twelve. A hole further along truncated
  // instead, and since `divisiveness` normalises by the vector's length,
  // both the leading share and the 1/k baseline came out for the wrong k.
  // Measured: a 5-option scale missing option 2 scored 0.800 against a
  // truth of 0.875.
  //
  // `cellFor` (cohort.ts) had this right from the start — it takes the
  // question's own option count and reads `cell[String(i)] || 0`. The only
  // thing missing here was the option count, and the bank lookup that
  // answers it is the one `storesOptionIdx` already does one function
  // down.
  const n = optionCountOf(qid, counts);
  if (n < 2) return -1;
  return divisiveness(denseCounts(counts, n));
}

/**
 * How many options this question has, for densifying its sparse counts.
 *
 * The banks are the authority and are consulted first. A qid this device
 * cannot resolve falls back to the highest key actually present, which is
 * a floor rather than the truth: an unanswered TOP option is invisible, so
 * a 5-option item whose last two are empty reads as 3. That understates
 * how divisive it is and never truncates it, which is the right direction
 * to be wrong in — the failure being fixed threw the question out of the
 * pool entirely, and `storesOptionIdx` keeps an unresolvable qid for the
 * same reason.
 */
function optionCountOf(qid: string, counts: Record<string, number>): number {
  for (const bank of [
    state.questions, state.feedBank, state.duelBank,
    state.learnBank, state.callBank, state.pulseBank,
  ]) {
    const q = bank.find((x) => x.id === qid);
    if (q) return (q.options || []).length;
  }
  return countsSpan(counts);
}

/**
 * Whether this qid's stored answer is an option index — the only shape the
 * voter fold can read.
 *
 * `state.votes` cannot answer this: every value goes in stringified, so a
 * catalog pick ("1041", a dex number or the numeric part of a QID) looks
 * exactly like an option index. Only the bank knows, which is why
 * pickKindredQids takes this as a predicate rather than guessing from the
 * value.
 *
 * A qid this device cannot resolve is KEPT. The banks are what the device
 * has cached, and a question answered before a bank refresh may be missing
 * from all of them; dropping it would shrink the pool on ignorance, which
 * is a worse failure than the one being fixed.
 */
function storesOptionIdx(qid: string): boolean {
  for (const bank of [
    state.questions, state.feedBank, state.duelBank,
    state.learnBank, state.callBank, state.pulseBank,
  ]) {
    const q = bank.find((x) => x.id === qid);
    if (q) return q.type !== "catalog" && q.type !== "rank";
  }
  return true;
}

// How many of the viewer's own answers the Kindred ranking reads across.
// Twelve shared questions is a legible likeness claim and the cost is
// linear in this number — see loadKindred for why it is bounded at all.
const KINDRED_QUESTIONS = 12;

// How many questions one room fold may ask about (D177). Mirrors
// ROOM_QUESTION_CAP in functions/src/pure.ts, which is what actually
// enforces it — this one only keeps the client from sending a list the
// server will silently truncate, so the tab does not draw a question the
// fold never counted. Hand-matched, like every other client/server pair
// here; the server's cap is the one that binds.
const ROOM_QIDS = 8;

// One take as the circle reads it. `hidden` is always false on anything a
// non-author can list — the read rule is an equality on that boolean, not a
// presence test, and only the equality holds a LIST to the gate (D65).
export interface TakeDoc {
  id: string;
  gid: string;
  authorUid: string;
  qid: string;
  text: string;
  createdAt: number;
  hidden: boolean;
}

// The rule's own ceiling (firestore.rules: `text.size() <= 280`). Kept here
// so the composer can stop the user at the limit instead of letting the
// write fail — the rule is still the enforcement, this is just the label.
export const TAKE_MAX_CHARS = 280;

// The anchor keys firestore.rules accepts, with its per-field length caps
// (isValidV2Anchors). Kept here rather than inline so the client and the
// ruleset can be diffed against each other by eye.
const ANCHOR_FIELDS: Record<string, number> = {
  city: 80, country: 80, ageBand: 20, age: 3, gender: 40,
  profession: 80, education: 80, relationship: 40, heightBand: 20,
};

// The snapshot written onto an answer. A copy, so a later profile edit
// cannot retroactively move a past answer into a different cohort.
/**
 * The anchors an answer freezes at vote time (D8).
 *
 * `rates` is the place the question being answered scores (D187), and it
 * is the one reason this is not a plain copy. **An unconfirmed city does
 * not score the place it names (D205):** if the question rates a city and
 * the device's own location fix has never agreed with the anchor, the city
 * is written EMPTY, so the answer folds into country and world and lands
 * in no city cell.
 *
 * WHY HERE AND NOT AT THE DECK. The obvious fix — stop serving the
 * question — cannot work: all 24 rating questions are in the DAILY bank,
 * the daily deck is positional (`computeDeckIds` indexes by day), and it
 * is the same question for everyone. Filtering it per person would either
 * shift every other day's question or leave some people with no daily at
 * all. Suppressing the CELL instead costs the answerer nothing: they see
 * the same question, answer it normally, and it counts everywhere except
 * the one place it could not honestly count.
 *
 * Empty rather than absent because that is the path already worn smooth —
 * a profile with no city writes exactly this, `isValidV2Anchors` accepts
 * it (`hasOnly`, every key optional), and `breakdownBucket` already
 * declines to mint a bucket for it.
 *
 * FORWARD-ONLY, and the alternative was worse. Answers already given under
 * unconfirmed cities keep their cells; nothing rewrites history, and D5
 * would not allow it if we wanted to.
 */
function answerAnchors(rates?: string): Record<string, string> {
  const a = { ...state.profile.anchors };
  if (rates === "city" && !cityIsConfirmed(a.city)) a.city = "";
  return a;
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

// `stored` is the answer's value in the cache's own string form: an
// optionIdx or entity as digits, a rank order as the joined "2,0,1,3"
// (D233) — exactly what hydrate's fold would re-derive from the doc.
function cacheVote(aid: string, stored: number | string): void {
  if (torndown) return;
  try {
    const ANS_LS = "insight.answersCache.v1";
    const cached = JSON.parse(localStorage.getItem(ANS_LS) || "null") || { uid: state.uid, votes: {}, maxTs: 0 };
    if (cached.uid !== state.uid) return;
    cached.votes[aid] = String(stored);
    localStorage.setItem(ANS_LS, JSON.stringify(cached));
  } catch {
    /* best-effort */
  }
}

// ── the profile cache, on disk (D129) ────────────────────────────
//
// `state.names`/`state.scores` used to die with the session, and its
// declaration said so: "held only to save reads, and nothing about it
// should outlive the session that fetched it." That sentence conflated two
// properties which are separable, and separating them is this block:
//
//   CROSS-ACCOUNT leakage is the real hazard, and it still cannot happen.
//   The payload is stamped with the uid that fetched it and refuses to load
//   under any other, `resetForNewUid` still empties the in-memory maps, and
//   `purgeLocalTrace` sweeps every `insight.*` key including this one.
//
//   DURABILITY WITHIN ONE ACCOUNT was never a hazard, only an assumption.
//   The names are public (D98) and the same regulars answer the same daily
//   question every morning, so re-reading their profiles on every cold boot
//   bought nothing. COSTS.md's `social` term is the second-largest read
//   source below 10 k DAU and name resolution is half of it.
//
// BOTH halves are persisted, not just names, and that is load-bearing:
// `fetchVoters` passes `scores` to `resolveNames`, whose `missing` filter
// requires a uid to be present in BOTH maps. Persisting names alone would
// leave every profile read exactly where it was and save nothing — the
// cache would look like it was working while the reads continued.
//
// THE TRADE, stated because it is real: a display name is a snapshot, so an
// account that renames shows its old name on other people's screens until
// the entry expires. PROFILE_TTL_MS is that window, and it is the whole
// reason there is a TTL rather than an unbounded cache.
const PROFILE_LS = "insight.profileCache.v1";
const PROFILE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ── your own name, mirrored on this device (D190) ────────────────────
//
// The profile document is the source of truth; this is the copy the app
// can read before hydration finishes, which is exactly when the create-a-
// circle screen needs it. It was a bare string literal in two components
// and a third was about to copy it — one owner instead, next to the store
// that writes it, so a rename reaches every reader.
//
// Swept by purgeLocalTrace like every other `insight.` key, so a uid
// change cannot leave the previous account's name behind (D51).
const NAME_LS = "insight.displayName.v1";

/** This device's copy of your display name, or "" if it has none. */
export function localName(): string {
  try { return localStorage.getItem(NAME_LS) || ""; } catch { return ""; }
}

function saveLocalName(name: string): void {
  try { localStorage.setItem(NAME_LS, name); } catch { /* private mode */ }
}
// Entries kept, newest first. A voter list is capped at VOTER_FETCH_CAP and
// a curious user opens many, so this map is the one client cache with no
// natural ceiling — localStorage quota is ~5 MB and a blown quota throws on
// EVERY key, not just this one.
const PROFILE_CACHE_CAP = 800;
let profileCacheTimer: ReturnType<typeof setTimeout> | null = null;
// uid → when this device first learned the name. Module-level rather than in
// `state`, because it is bookkeeping for the disk format and nothing renders
// from it. Seeded on load so a returning entry keeps its original age and
// actually expires.
const profileSeen = new Map<string, number>();

function loadProfileCache(): void {
  try {
    const raw = JSON.parse(localStorage.getItem(PROFILE_LS) || "null");
    if (!raw || raw.owner !== state.uid || !raw.e) return;
    const now = Date.now();
    for (const [uid, v] of Object.entries(raw.e as Record<string, {
      n?: string; s?: Record<string, Record<string, number>> | null; t?: number;
      l?: number | null;
    }>)) {
      if (!v || typeof v.t !== "number" || now - v.t > PROFILE_TTL_MS) continue;
      state.names[uid] = typeof v.n === "string" ? v.n : "";
      // `undefined` and `null` mean different things here: absent = never
      // fetched (so resolveNames must ask), null = fetched and this account
      // has no usable results. Only the second is cacheable.
      if (v.s !== undefined) state.scores[uid] = v.s;
      // Same doctrine for the logic percentile (D227). An entry written
      // before D227 simply lacks the key, which leaves the uid absent from
      // `logicPcts` — resolveNames then refetches that profile once and
      // the cache self-heals.
      if (v.l !== undefined) state.logicPcts[uid] = typeof v.l === "number" ? v.l : null;
      // THE FACE IS DELIBERATELY NOT CACHED ACROSS SESSIONS (D178). A
      // token held past a remove verdict would go on drawing a face
      // moderation took down, for as long as the TTL — which is the one
      // thing the whole report loop exists to prevent. Faces are refetched
      // per session by the same batched read; the extra query is the price
      // of a removal being immediate everywhere.
      profileSeen.set(uid, v.t);
    }
  } catch {
    /* corrupt or unavailable — treat as empty */
  }
}

function writeProfileCache(): void {
  if (torndown || !state.uid) return;
  try {
    const now = Date.now();
    const uids = Object.keys(state.names)
      .filter((u) => now - (profileSeen.get(u) ?? now) <= PROFILE_TTL_MS)
      .sort((a, b) => (profileSeen.get(b) ?? 0) - (profileSeen.get(a) ?? 0))
      .slice(0, PROFILE_CACHE_CAP);
    const e: Record<string, unknown> = {};
    for (const u of uids) {
      // `l: undefined` serializes away, so a uid absent from `logicPcts`
      // stays absent on disk — the absent/null line survives the round trip.
      e[u] = { n: state.names[u], s: state.scores[u], l: state.logicPcts[u], t: profileSeen.get(u) ?? now };
    }
    localStorage.setItem(PROFILE_LS, JSON.stringify({ owner: state.uid, e }));
  } catch {
    /* best-effort: quota, private mode, no storage */
  }
}

// Coalesced on the same reasoning as the agg cache below: `resolveNames`
// fills the map in batches of 30 and three surfaces call it in a row, so an
// eager write would serialise the whole map several times per sheet open.
function saveProfileCache(): void {
  const now = Date.now();
  for (const u of Object.keys(state.names)) {
    if (!profileSeen.has(u)) profileSeen.set(u, now);
  }
  if (torndown || profileCacheTimer) return;
  profileCacheTimer = setTimeout(() => {
    profileCacheTimer = null;
    writeProfileCache();
  }, AGG_CACHE_MS);
}

// How long a burst of agg snapshots is allowed to coalesce into one write.
// Long enough to collapse a publish storm, short enough that a user who
// backgrounds the app a second after voting still keeps the count.
const AGG_CACHE_MS = 1000;
let aggCacheTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * How many aggregates persist to disk, newest-touched first.
 *
 * THE SIBLING CACHE 80 LINES UP HAS CARRIED THIS SINCE IT WAS WRITTEN, and
 * spells out the hazard in full — "this map is the one client cache with
 * no natural ceiling — localStorage quota is ~5 MB and a blown quota
 * throws on EVERY key, not just this one". The far larger per-entry cache
 * never got one. Nothing evicted here: every answered question minted a
 * permanent entry, including per-day pulse ids that mint a fresh one
 * forever, and each carries the whole `by` breakdown — 7 dims × up to
 * BREAKDOWN_MAX_BUCKETS buckets × option counts.
 *
 * Measured entry sizes against pure.ts's own BREAKDOWN_DIMS with a
 * fully-populated `by`: 1,658 bytes for a 2-option question, 3,038 for a
 * 5-option one. At COSTS.md's stated 4 answers/day that key reached
 * 0.57 MB in 90 days, 2.31 MB in a year and 4.62 MB in two — on its own,
 * before the bank cache, the answers cache and ~28 other `insight.` keys.
 * And every consequence is silent, because every `setItem` in this file is
 * wrapped in a swallowing catch: the answers cache stops advancing its
 * watermark so every boot re-runs a warm delta from a frozen cursor, the
 * 6 h agg memo stops persisting so the boot top-up re-asks up to
 * AGG_ID_CAP aggregates every time, and a reseed makes the bank cache
 * unwritable so every boot pays the full bank fetch — which is exactly
 * BANK-DELIVERY.md §3's cliff, reached by aggregates rather than by bank
 * growth.
 *
 * 200 × ~1.7 KB ≈ 330 KB typical, ≈ 610 KB with five-option questions
 * throughout. Deliberately above AGG_ID_CAP (120) so a boot's whole
 * top-up set fits and nothing it just fetched is evicted before the next
 * write.
 */
const AGG_CACHE_CAP = 200;

// qid → when this device last touched that aggregate. Module-level rather
// than in `state` for the same reason `profileSeen` is: it is bookkeeping
// for the disk format and nothing renders from it. Persisted alongside the
// entries so a returning entry keeps its age instead of being reborn on
// every boot, which would make the cap evict by accident of load order.
const aggSeen = new Map<string, number>();

/** The one way an aggregate enters the map, so nothing can be cached
 * without also being dated. Four call sites had the assignment inline. */
function setAgg(qid: string, doc: AggDoc): void {
  state.aggs[qid] = doc;
  aggSeen.set(qid, Date.now());
}

function writeAggCache(): void {
  if (torndown) return;
  try {
    const now = Date.now();
    const keep = Object.keys(state.aggs)
      .sort((a, b) => (aggSeen.get(b) ?? 0) - (aggSeen.get(a) ?? 0))
      .slice(0, AGG_CACHE_CAP);
    const e: Record<string, AggDoc> = {};
    const t: Record<string, number> = {};
    for (const qid of keep) {
      e[qid] = state.aggs[qid];
      t[qid] = aggSeen.get(qid) ?? now;
    }
    // `v: 2` under the SAME key. A new key would leave the old one on disk
    // holding the megabytes this cap exists to stop — swept only by a
    // purge, which is not something a fix for a quota problem may wait for.
    // The reader below still accepts the flat v1 map.
    localStorage.setItem("insight.aggsCache.v1", JSON.stringify({ v: 2, e, t }));
  } catch {
    /* best-effort */
  }
}

/**
 * Parse whatever this device has on disk into entries + ages.
 *
 * Both shapes, because the format changed under the same key: v2 is
 * `{ v, e, t }`, v1 was the bare `{qid: doc}` map. A v1 device loses its
 * ages once — every entry dates from the boot that read it — and the cap
 * then evicts by real recency from the next write onward, rather than by
 * accident of key order.
 */
function parseAggCache(raw: string | null): { entries: Record<string, AggDoc>; ages: Record<string, number> } {
  const empty = { entries: {}, ages: {} };
  let cached: unknown;
  try {
    cached = JSON.parse(raw || "null");
  } catch {
    return empty;
  }
  if (!cached || typeof cached !== "object") return empty;
  const c = cached as { v?: unknown; e?: unknown; t?: unknown };
  const isV2 = c.v === 2 && c.e && typeof c.e === "object";
  const entries = (isV2 ? c.e : cached) as Record<string, AggDoc>;
  const ages = ((isV2 && c.t) || {}) as Record<string, number>;
  const out: Record<string, AggDoc> = {};
  for (const [qid, doc] of Object.entries(entries)) {
    if (doc && typeof doc === "object") out[qid] = doc;
  }
  return { entries: out, ages };
}

// IN MEMORY IT IS NOT CAPPED, and that is deliberate rather than an
// omission. Evicting a live entry can blank a count on a card the viewer
// is looking at, and the growth this fixes is the PERSISTED kind — the map
// accumulating across every session forever. One session's own reach is
// bounded by the session: the boot load is capped here, the top-up at
// AGG_ID_CAP, and the rest is whatever the viewer actually opened.

// Coalesced, because the caller is the agg snapshot handler and the thing
// being written is the WHOLE aggs map. The daily question is globally
// shared, so every publish on it fans out to every listening client
// (docs/COSTS.md finding 2) — at the fan-out rates that document already
// predicts, an immediate write is ~0.7 full JSON.stringify/sec of the
// entire map at 50k DAU and ~6.9/sec at 500k, synchronously on the main
// thread inside the handler. The map itself is never pruned, so the cost
// per serialisation grows with the session too.
//
// Leading-schedule/trailing-write rather than a restarting debounce: a
// steady stream of publishes must still reach disk about once a second,
// where a restarting timer would starve and write nothing until the burst
// ended. State is read at write time, so nothing in the window is lost.
function saveAggCache(): void {
  if (torndown || aggCacheTimer) return;
  aggCacheTimer = setTimeout(() => {
    aggCacheTimer = null;
    writeAggCache();
  }, AGG_CACHE_MS);
}

// One delayed re-read of a question's public aggregate, so the paint after
// a vote (or a D86 edit) shows the folded-in count. Shared by both write
// paths — it was inline in vote() until the edit path needed the identical
// block.
const AGG_REFRESH_MS = 2500;
// The qids answered since the last drain, and the one timer that drains
// them. COALESCED, because the caller is a vote and votes arrive in
// bursts: a feed sitting is ten to thirty answers, and this used to arm a
// separate timer per answer, each firing its own single-document round
// trip, its own complete `buildFeedGlobals()` (which filters and maps the
// whole feed bank twice, per card) and its own `notify()` — which re-runs
// every subscriber's fold. Thirty answers bought thirty of each.
//
// One trailing timer instead, drained through the `in` query `refreshAggs`
// already uses, so a burst costs one round trip per thirty questions and
// exactly one rebuild and one notify.
//
// Leading-schedule/trailing-drain, the shape `saveAggCache` uses and for
// the same reason: a restarting debounce would starve under a steady
// stream of answers and refresh nothing until the user stopped. The set is
// read at drain time, so nothing answered inside the window is lost.
const pendingAggRefresh = new Set<string>();
let aggRefreshTimer: ReturnType<typeof setTimeout> | null = null;

async function drainAggRefresh(db: Awaited<ReturnType<typeof getDb>>): Promise<void> {
  const qids = [...pendingAggRefresh];
  pendingAggRefresh.clear();
  if (torndown || !qids.length) return;
  let got = false;
  // Firestore's `in` takes 30 keys, so a sitting longer than that pays a
  // second query rather than being truncated. Concurrent, not sequential:
  // they are independent reads of the same collection.
  const chunks: string[][] = [];
  for (let i = 0; i < qids.length; i += 30) chunks.push(qids.slice(i, i + 30));
  const snaps = await Promise.all(chunks.map((c) => getDocs(query(
    collection(db, "v2_question_aggs"),
    where(documentId(), "in", c),
  ))));
  for (const snap of snaps) {
    for (const d of snap.docs) {
      setAgg(d.id, d.data() as AggDoc);
      got = true;
      // Clear the display flag only for an ACKED write — a
      // still-inflight one cannot be in the agg we just read, and
      // clearing would subtract a vote that isn't there. (Defensive:
      // today this drain is only armed after the ack, so inflight
      // is already clear.)
      if (d.id in state.unaggregated && !(d.id in state.inflight)) {
        delete state.unaggregated[d.id];
      }
    }
    state.stats.aggsFetched += snap.size;
  }
  // Once for the whole burst, and only if something came back — the old
  // per-qid path was equally careful not to rebuild on an absent document.
  if (!got) return;
  saveAggCache();
  buildFeedGlobals();
  notify();
}

function scheduleAggRefresh(db: Awaited<ReturnType<typeof getDb>>, qid: string): void {
  pendingAggRefresh.add(qid);
  if (torndown || aggRefreshTimer) return;
  aggRefreshTimer = setTimeout(() => {
    aggRefreshTimer = null;
    void drainAggRefresh(db).catch(() => {
      /* refresh is best-effort — the next answer, or the poll, tries again */
    });
  }, AGG_REFRESH_MS);
}

// Drops a queued write. Hygiene rather than a leak fix, and it is worth
// being exact about which: on the uid-change path `resetForNewUid` empties
// `state.aggs` BEFORE it calls purgeLocalTrace, so the worst a surviving
// timer writes is `{}` — no previous account's aggregate can ride it — and
// deleteAccount is covered by `torndown` anyway. What this buys is one
// fewer pointless write and no timer holding the old map alive.
//
// Measured, because the comment that used to sit here claimed more: with
// this cancel removed, no test in the tree fails. The uid-change case in
// vote.test.ts pins the contract that matters (nothing of the old account
// survives) and that contract holds either way, because the new session
// legitimately re-creates the key empty a moment later.
function cancelAggCache(): void {
  if (aggCacheTimer) {
    clearTimeout(aggCacheTimer);
    aggCacheTimer = null;
  }
}

const listeners = new Set<() => void>();
// ── derived-on-read, folded once per change (D169) ───────────────────
//
// Several getters below are whole-store folds, and every one of them
// carries the same note: derived on read rather than cached, so a
// ranking cannot go stale against its own inputs. That reasoning is
// right and it was being paid for on every render rather than on every
// change. `kindredPeople()` walks every cached voter list and has six
// call sites (LiveSimilarityField ×2, LiveMirrorLenses, typeMix ×2,
// testNorms); each of those is inside a component that re-renders on
// every notify(), and none of them memoises. So one Mirror stop folded
// the same voter cache four to six times per render — 14 ms a fold in
// node at 120 cached questions × 200 voters, which is not 14 ms on a
// phone.
//
// `rev` closes that without weakening the staleness argument, because
// notify() is the ONLY way a store change reaches a renderer. A value
// computed at rev N is correct for every read until the next notify(),
// by construction rather than by hoping. A component re-rendering on its
// own useState — a tab, a picked node, a text field — does not bump it
// and gets the fold it already paid for.
//
// THE CONDITION, stated because it is the one that could break silently:
// a memoised getter hands every caller the SAME array, where it used to
// hand each one a fresh one. That is safe only while no consumer mutates
// what it gets back, so only folds whose consumers were checked go
// through here — and `myVotes()`/`confirmedVotes()` deliberately do NOT,
// because their defensive copy is the point of them. `.filter()`/`.map()`
// before a `.sort()` copies, which is what every current consumer does;
// a future one that sorts the returned array in place would reorder
// everybody else's, so sort a copy.
let rev = 0;

function perRev<T>(compute: () => T): () => T {
  let at = -1;
  let val: T;
  return () => {
    if (at !== rev) {
      val = compute();
      at = rev;
    }
    return val;
  };
}

/**
 * A qid → question index over one of the banks, rebuilt only when that
 * bank is REASSIGNED.
 *
 * Keyed on array identity rather than on `rev`, because the banks are the
 * one piece of store state that does not move with a notify: they are
 * written once in hydrate() and never mutated in place (no push, splice
 * or sort touches them anywhere in this file). So identity is exact where
 * `rev` would be merely safe — a perRev index would rebuild the whole Map
 * on every agg publish, which for the bank that grows without bound is
 * the cost this is removing.
 *
 * WHAT IT REPLACES. Seven `bank.find((x) => x.id === qid)` scans, the
 * worst of them `lensAgg` — whose caller (spec/lens-defs.js's
 * LENS_FEED_QS) is deliberately unmemoised in live mode and walks fifty
 * lens rows per render of the world feed, which itself re-renders on
 * every notify(). Fifty full scans of `feedBank` per render is survivable
 * at today's bank and is exactly the shape docs/SCALE-PLAN.md says not to
 * leave lying around, since D161 makes `feedBank` the collection with no
 * upper bound.
 */
function indexById<T extends { id: string }>(): (bank: readonly T[]) => Map<string, T> {
  let at: readonly T[] | null = null;
  let map = new Map<string, T>();
  return (bank) => {
    if (at !== bank) {
      map = new Map(bank.map((q) => [q.id, q]));
      at = bank;
    }
    return map;
  };
}
const feedIndex = indexById<QuestionDoc & { id: string }>();
const dailyIndex = indexById<QuestionDoc & { id: string }>();
/** The feed bank as a lookup. See `indexById`. */
const feedById = (qid: string) => feedIndex(state.feedBank).get(qid);
/** The daily bank as a lookup. See `indexById`. */
const dailyById = (qid: string) => dailyIndex(state.questions).get(qid);

const notify = () => {
  rev++;
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

// ── deck aggregates: polled, not streamed (D129) ─────────────────
//
// This was seven `onSnapshot` listeners, one per deck day, and it was the
// single most expensive thing in the app. The daily question is globally
// SHARED (computeDeckIds takes no uid), which is what makes a cohort fill
// at ten users — and it also meant every answer anyone gave published a new
// aggregate that fanned out to every client currently watching, each
// delivery a billed read. COSTS.md finding 2: reads ≈ DAU²/80, 94% of the
// bill at 500 k DAU, and the only term in the model that grew superlinearly.
//
// WHAT THIS COSTS THE PRODUCT, stated plainly because it is a real trade
// and not a free win: other people's votes no longer land on the card while
// you are looking at it. They arrive on the next poll instead. Your OWN
// vote is unaffected — `scheduleAggRefresh` below already re-read the
// aggregate 2.5 s after the write acked and cleared `unaggregated`, on both
// the vote and the D86 edit path, so the vote → counted transition never
// depended on the listener at all. The snapshot's own clear was a second,
// redundant route.
//
// WHY ONLY TODAY IS POLLED. `computeDeckIds` returns today plus six back
// days and all seven are answerable, so the older aggregates do move — just
// rarely, and nobody is watching a four-day-old card for a live tick. The
// full deck is refreshed on boot and on every foreground; the repeating
// timer asks about today alone. That is 1 document per poll rather than 7,
// which is what keeps the replacement genuinely cheap rather than merely
// cheaper.
const AGG_POLL_MS = 60_000;
let aggPollTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Read the given aggregates once and fold them into the store.
 *
 * Batched through a single `documentId() in` query: Firestore bills per
 * document either way, so this buys latency rather than reads — but the
 * deck is 7 ids and the `in` limit is 30, so the whole deck is one round
 * trip. Best-effort by design; a failed refresh leaves the cached counts
 * in place and the next tick tries again, which is the same degradation
 * the listener had on error.
 */
async function refreshAggs(qids: readonly string[]): Promise<void> {
  if (torndown || !qids.length) return;
  try {
    const db = await getDb();
    const snap = await getDocs(query(
      collection(db, "v2_question_aggs"),
      where(documentId(), "in", qids.slice(0, 30)),
    ));
    snap.docs.forEach((d) => {
      setAgg(d.id, d.data() as AggDoc);
      // Same rule the snapshot handler applied: a fresh aggregate means the
      // trigger has (very likely) folded the vote in, so stop
      // double-counting it. A premature clear self-heals on the next read.
      if (d.id in state.unaggregated && state.votes[d.id]) {
        delete state.unaggregated[d.id];
      }
    });
    state.stats.aggsFetched += snap.size;
    saveAggCache();
    notify();
  } catch (err) {
    reportError(err, { where: "refreshAggs" });
  }
}

function stopAggPoll(): void {
  if (aggPollTimer) {
    clearInterval(aggPollTimer);
    aggPollTimer = null;
  }
}

/**
 * Refresh the whole deck now, then keep today's aggregate fresh on a timer.
 *
 * Idempotent, because every caller of the old `subscribeAggs` was: boot,
 * the midnight rollover, and every foreground. The interval is cleared and
 * re-armed rather than left running, so a rollover repoints the poll at the
 * new day's question without leaking the old timer.
 *
 * Unlike a listener, a timer costs nothing to drop and nothing to restore —
 * so this stops IMMEDIATELY on hide rather than after a grace period. The
 * grace in IDLE_DETACH_MS exists because re-attaching an `onSnapshot`
 * re-delivers the document; re-arming a `setInterval` reads nothing until
 * it next fires.
 */
async function startAggPoll(): Promise<void> {
  // `torndown` only. NOT `state.ready` — this runs from inside hydrate(),
  // and `ready` does not flip until hydrate AND hydrateSocial have both
  // returned, so guarding on it makes the boot call a silent no-op and the
  // deck renders with no counts until the first foreground. The old
  // `subscribeAggs` had no readiness guard for the same reason;
  // `resubscribeForToday` keeps one because it is a re-entry point.
  if (torndown) return;
  stopAggPoll();
  await refreshAggs(state.deckIds);
  if (torndown) return;
  aggPollTimer = setInterval(() => {
    // Today only — deckIds[0] is back=0 by computeDeckIds' construction.
    // Guarded on visibility as well as on the hide handler, because a tab
    // that is hidden without firing visibilitychange (some WebViews on
    // resume-from-kill) would otherwise poll unseen.
    if (torndown || (typeof document !== "undefined" && document.hidden)) return;
    void refreshAggs(state.deckIds.slice(0, 1));
  }, AGG_POLL_MS);
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

  // The viewer's own profile, STARTED HERE and awaited where it is read,
  // some six round trips down.
  //
  // It depends on `db` and `state.uid` and on nothing else in this
  // function — not the meta document, not `contentRev`, not the bank — so
  // every trip between here and its `await` was the boot race waiting on
  // work that had no reason to be behind them. `initLive` gives that race
  // 2500 ms, and losing it puts a real user on the demo deck under a
  // "still connecting" label; on a 200 ms mobile RTT this is most of a
  // fifth of the budget, spent for nothing. No extra read either way.
  //
  // Rejections are captured to null rather than left floating: an
  // in-flight promise nobody is awaiting yet would raise
  // `unhandledrejection` on the way to its own catch. Null lands in the
  // same branch a failed read already took — a missing display name is a
  // cosmetic loss, not a reason to spend the session on demo data — and
  // the reporting stays at the read site.
  const uidEarly = state.uid;
  const profileP = uidEarly
    ? getDoc(doc(db, "v2_users", uidEarly)).catch((err) => {
      reportError(err, { where: "hydrate.profile" });
      return null;
    })
    : null;

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
      state.meta.patternsPool = Number(meta.get("patternsPool") || 0);
      state.meta.patternsBasis = Number(meta.get("patternsBasis") || 0);
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
  // PAGE SIZE, not a ceiling — D161, and the difference is the whole point.
  //
  // This was `BANK_LIMIT = 1500`, a cap on one unpaginated fetch, with
  // D30's rule recorded beside it: approach it with pagination, never
  // another raise. The feed is going unbounded, so the approach happened
  // and this is the pagination. The rule it existed to enforce is gone
  // because the failure it guarded is gone: a query that hits its limit
  // returns a short page and NO error, so a bank over the old cap served
  // a truncated corpus with nothing failing anywhere.
  //
  // Round trips, not reads, are what the size trades. Firestore bills per
  // document however they are paged, so a bigger page is fewer round trips
  // at identical cost; 1000 is one round trip for any bank this app has,
  // and a handful for one it might grow.
  const BANK_PAGE = 1000;
  // A loop bound, not a content limit. Nothing should ever reach it — but
  // an unbounded `while` in the boot path is one cursor bug away from
  // hanging the app before first paint, and the whole reason this code
  // changed is that the previous failure mode was silent. If this trips,
  // the bank is 100k documents (implausible) or the cursor stopped
  // advancing (a bug), and BOTH are reported rather than truncated
  // quietly.
  const BANK_MAX_PAGES = 100;
  // EVERY surface splitBanks can return, and that is the invariant rather
  // than a list to extend by habit — this constant decides what the bank
  // IS, and a lane missing here is a lane whose questions do not exist as
  // far as the live app is concerned. `pulse` and `call` were absent from
  // the day this fetch was written: splitBanks routed both, the seed
  // shipped both (5 + 3 documents), the rules admitted both, and neither
  // ever reached a device — LIVE.pulseQs() and LIVE.callQs() returned []
  // for every live user while the demo build drew them from its own
  // fixtures, which is why nothing looked broken anywhere it was looked
  // at. Pinned in bank-cache.test.ts, on the query as well as the output.
  //
  // Firestore's `in` takes up to 30 values, so the ceiling is not near.
  const BANK_SURFACES = ["daily", "feed", "test", "group", "duo", "learn", "pulse", "call"];
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
          limit(BANK_PAGE),
        ),
      );
      if (dsnap.size >= BANK_PAGE) {
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
    // ── the full fetch, paged (D161) ──
    //
    // Ordered by document id because the cursor has to be on the ordering
    // key and `__name__` is the one field every document is guaranteed to
    // have. `seq` would read more naturally and is not safe: it is
    // per-surface and contiguous, so it repeats across surfaces, and a
    // cursor on a non-unique key can skip or repeat rows at a page
    // boundary. The bank is sorted by `seq` a few lines below anyway, so
    // fetch order costs nothing.
    //
    // TERMINATION IS ON A SHORT PAGE, never on a document count this code
    // believes in advance. That is the entire correctness argument: the
    // bug being designed out is a full page read as a complete result, so
    // "fewer rows came back than I asked for" is the only signal that
    // means the end, and any count-based check would reintroduce it.
    const rows: BankEntry[] = [];
    // The page's last DocumentSnapshot, handed straight back to startAfter.
    let after: unknown = null;
    let pages = 0;
    let maxCursor = 0;
    for (;;) {
      const page = await getDocs(
        query(
          collection(db, "v2_questions"),
          where("surface", "in", BANK_SURFACES),
          orderBy(documentId()),
          ...(after ? [startAfter(after)] : []),
          limit(BANK_PAGE),
        ),
      );
      rows.push(...rowsOf(page));
      maxCursor = Math.max(maxCursor, cursorOf(page));
      pages += 1;
      if (page.size < BANK_PAGE) break;
      if (pages >= BANK_MAX_PAGES) {
        // Loud, because this is the exact shape of the failure the paging
        // replaced. Serving what we have is still better than serving
        // nothing — but it must never be indistinguishable from success.
        reportError(new Error(
          `bank paging hit BANK_MAX_PAGES (${BANK_MAX_PAGES} x ${BANK_PAGE}) — truncated at ${rows.length} questions`,
        ), { where: "hydrate.bankPaging" });
        break;
      }
      after = page.docs[page.docs.length - 1];
    }
    all = rows;
    cursor = maxCursor;
    state.stats.bankSource = "network";
  }
  try {
    localStorage.setItem(BANK_LS, JSON.stringify({ rev: contentRev, cursor, questions: all }));
  } catch {
    /* cache is best-effort */
  }
  const sorted = all.slice().sort((a, b) => (a.seq || 0) - (b.seq || 0));
  // `until` is the current-events serving window (docs/NEXT-FUNCTIONALITY
  // §1): a feed entry past its UTC day stops being OFFERED — the answers
  // and the aggregate persist, the archive is the product. Feed-only by
  // the gates (check:content), so the daily tombstone note below is
  // untouched; `active: false` remains the hard, server-enforced kill.
  const today = utcDayKey(0);
  // Both ends, so `from` is a real serving boundary and not just the ring's
  // start: an editor can write next week's question this week and have it
  // appear on the day, rather than having to be awake to merge it. Day keys
  // are zero-padded, so string order is date order.
  const fresh = (q: { from?: string; until?: string }) =>
    (!q.until || q.until >= today) && (!q.from || q.from <= today);
  const active = sorted.filter((q) => q.active !== false && fresh(q));

  // Allowlist split per surface — pure and unit-tested in deck.ts
  // (splitBanks carries the why-comments: playability, the catalog
  // carve-out, and the D32 learn fencing).
  const banks = splitBanks(active);
  // THE DAILY LANE KEEPS ITS RETIRED QUESTIONS, as tombstones. Every other
  // surface iterates its bank, so dropping an inactive question there simply
  // stops offering it — but the daily deck is POSITIONAL: computeDeckIds
  // indexes `questionIds[(today - epoch - back) % n]`, so removing any
  // element below the current window shifts every visible day. Probe, bank
  // of 90 at DECK_EPOCH+30: retiring one question changes 7 of 7 pager
  // cards, six answered history cards render as unanswered, and today's card
  // silently swaps. Appending changes none, which is why D30 scopes its
  // invariant to appends and did not catch this.
  //
  // The trigger is the intended ops workflow, not an accident:
  // docs/QUESTION-FARM.md has the scorecard propose `active: false` for
  // high-volume landslides — questions that have, by definition, already
  // been served — and D34's remedy (seedContentV2 with bumpRev) forces the
  // refetch that materialises it.
  //
  // So the kill switch moves to the DISPLAY (deck() below), where it still
  // does its job: a retired question stops being offered, and the days
  // around it keep their questions. The cost is one wasted agg listener per
  // retired card until it ages out of the 7-day window.
  state.questions = splitBanks(sorted).daily;
  state.feedBank = banks.feed;
  state.duelBank = banks.duel;
  state.learnBank = banks.learn;
  // The Learn bank (D284). Published HERE, beside the split, and not in
  // buildFeedGlobals: that function opens `if (!state.feedBank.length)
  // return`, so a bank with learn cards and no feed questions would have
  // served none of them — Learn does not depend on the feed existing and
  // must not start doing so. Caught by vote.test.ts's first learn case,
  // which is exactly the bank that shape describes.
  //
  // Translated from the bank's vocabulary into the
  // engine's — `learn-cell1`/`prompt`/`options`/`topic` become
  // `cell1`/`q`/`a`/`f` — because the two spellings are real and the
  // translation belongs at one end rather than at nine call sites.
  //
  // Costs no read: `state.learnBank` is the slice `splitBanks` already cut
  // out of the bank `hydrate()` fetched. What it replaces is the whole of
  // `content/learn-questions.json` being compiled into the app.
  //
  // A doc seeded before D284 carries no `c`, and a card with no correct
  // answer is unanswerable rather than merely thin — so those are dropped
  // rather than defaulted. On a bank seeded before the change that empties
  // Learn until the next seed run, which is the honest failure: the
  // alternative is `c ?? 0`, which would mark option one correct on every
  // card in the bank and teach the wrong answer, silently, on a surface
  // whose entire promise is that there is a right one.
  publishLearnBank(
    state.learnBank.flatMap((q): LearnCard[] => {
      if (typeof q.c !== "number" || typeof q.t !== "number") return [];
      return [{
        id: q.id.startsWith("learn-") ? q.id.slice(6) : q.id,
        f: q.topic || "",
        q: q.prompt,
        a: q.options,
        c: q.c,
        t: q.t,
        p: typeof q.p === "number" ? q.p : 50,
        k: q.k || "",
        ...(q.w ? { w: q.w } : {}),
      }];
    }),
  );

  state.callBank = banks.call;
  state.pulseBank = banks.pulse;
  // A completely unseeded project is a real failure: throw so boot leaves
  // LIVE disabled and the mock deck renders. Returning here used to let
  // boot flip enabled=true on an empty deck, which pins the user on
  // "Fetching today's question…" forever with neither honesty banner up.
  if (!state.questions.length && !state.feedBank.length && !state.duelBank.length) {
    throw new Error("live bank is empty — project not seeded");
  }
  // A bank with content but no *daily* question is different: the rest of
  // the app works, so stay live and let the daily surface say so.

  // ── my answers: cached + incremental (created docs never refetch) ──
  const ANS_LS = "insight.answersCache.v1";
  const uidA = state.uid;
  let maxTs = 0;
  let maxEditTs = 0;
  if (uidA) {
    try {
      const cached = JSON.parse(localStorage.getItem(ANS_LS) || "null");
      if (cached && cached.uid === uidA && cached.votes) {
        Object.assign(state.votes, cached.votes);
        maxTs = Number(cached.maxTs || 0);
        maxEditTs = Number(cached.maxEditTs || 0);
      }
    } catch {
      /* refetch below */
    }
    const fold = (d: { id: string; get: (f: string) => unknown }) => {
      const optionIdx = d.get("optionIdx");
      if (typeof optionIdx === "number") state.votes[d.id] = String(optionIdx);
      // Catalog answers carry `entity` and rank answers carry `order` —
      // never `optionIdx` (D14/D233). Both join the same map in string
      // form (the entity's digits; the order joined with commas) —
      // votes[] is "what did I answer", and every consumer that
      // INTERPRETS the value goes through the question's type
      // (mirrorVoteValue, buildFeedGlobals) — so skipping either here
      // would re-offer the card on a fresh device and the create-only
      // rule would then refuse the re-answer.
      else {
        const entity = d.get("entity");
        if (typeof entity === "number") state.votes[d.id] = String(entity);
        else {
          const order = d.get("order");
          if (Array.isArray(order)) state.votes[d.id] = order.join(",");
        }
      }
      const at = d.get("answeredAt") as { toMillis?: () => number } | undefined;
      if (at && typeof at.toMillis === "function") maxTs = Math.max(maxTs, at.toMillis());
      const et = d.get("editedAt") as { toMillis?: () => number } | undefined;
      if (et && typeof et.toMillis === "function") maxEditTs = Math.max(maxEditTs, et.toMillis());
    };
    // Deliberately UNGUARDED, unlike the reads below. Answers are not
    // decoration: proceeding with a partial vote set makes the app offer
    // questions the user already answered, and the create-only rule then
    // refuses every one of those re-votes. Better to fail boot and render
    // the honest mock deck than to look live and reject the user's taps.
    //
    // …which is exactly what the COLD path used to do anyway. It was one
    // `orderBy("answeredAt","desc") limit(1000)` — the silent truncation
    // D161 designed out of the bank fetch above, with a worse ending.
    // `fold` raises maxTs to the newest answeredAt it sees, and the warm
    // query below asks for `answeredAt >` that; on a DESCENDING page the
    // watermark therefore jumps straight to the newest answer, so
    // everything past the 1000th was sealed out of that device
    // permanently, not merely deferred to the next boot.
    //
    // Reachable well before any scale story: duel (`g_{gid}_{day}`) and
    // pulse (`{qid}_{day}`) answers mint a document per day forever, so
    // an engaged account passes 1000 inside a year — and those day-docs,
    // being the newest, are exactly the ones that crowd the static world
    // answers out of the page.
    //
    // Ordered by document id for D161's reason: a cursor has to sit on the
    // ordering key, and `__name__` is the one field every document is
    // guaranteed to have. Termination is on a SHORT PAGE, never on a count
    // this code believes in advance — a count-based check is the bug.
    //
    // The warm path keeps its single bounded read. It truncates too, but
    // it self-heals across boots: its sort is the inequality's, ascending,
    // so the watermark advances to the OLDEST unread answer rather than
    // past everything.
    let fetched = 0;
    if (maxTs > 0) {
      const asnap = await getDocs(query(
        collection(db, "v2_users", uidA, "answers"),
        where("answeredAt", ">", Timestamp.fromMillis(maxTs)),
        limit(400),
      ));
      asnap.docs.forEach(fold);
      fetched = asnap.size;
    } else {
      const ANS_PAGE = 1000;
      // A loop bound, not a content limit, and loud if it trips — the same
      // shape and the same argument as BANK_MAX_PAGES above.
      const ANS_MAX_PAGES = 100;
      let after: unknown = null;
      let pages = 0;
      for (;;) {
        const page = await getDocs(query(
          collection(db, "v2_users", uidA, "answers"),
          orderBy(documentId()),
          ...(after ? [startAfter(after)] : []),
          limit(ANS_PAGE),
        ));
        page.docs.forEach(fold);
        fetched += page.size;
        pages += 1;
        if (page.size < ANS_PAGE) break;
        if (pages >= ANS_MAX_PAGES) {
          reportError(new Error(
            `answer paging hit ANS_MAX_PAGES (${ANS_MAX_PAGES} x ${ANS_PAGE}) — truncated at ${fetched} answers`,
          ), { where: "hydrate.answerPaging" });
          break;
        }
        after = page.docs[page.docs.length - 1];
      }
    }
    state.stats.answersFetched = fetched;
    // D86 made one field mutable, so the incremental pull gained a second
    // cursor: an edit moves optionIdx WITHOUT moving answeredAt (the
    // cohort stamp is frozen), so a cache warmed before the edit would
    // hold the old option forever. On the editing device cacheVote()
    // repairs it at ack time; a second signed-in device has only this
    // query to hear about it. The watermarks stay per-field on purpose —
    // folding editedAt into maxTs would let an edit's timestamp leap past
    // a concurrent create the answeredAt query has not read yet, and that
    // answer would then never be fetched. Warm boots only: the cold-cache
    // full pull above already reads every doc's current optionIdx (and
    // seeds this cursor through fold()).
    if (maxTs > 0) {
      const esnap = await getDocs(query(
        collection(db, "v2_users", uidA, "answers"),
        where("editedAt", ">", Timestamp.fromMillis(maxEditTs)),
        limit(400),
      ));
      state.stats.answersFetched += esnap.size;
      esnap.docs.forEach(fold);
    }
    try {
      localStorage.setItem(ANS_LS, JSON.stringify({ uid: uidA, votes: state.votes, maxTs, maxEditTs }));
    } catch {
      /* best-effort */
    }
  }

  // ── aggregates: cached; fetch answered questions' aggs that are
  // missing OR still cached as too-small ──
  // Feed cards are blind pre-vote (counts show only after answering), so
  // the old whole-collection scan bought nothing. Deck docs get live
  // snapshots below; everything else refreshes on vote. A cached agg with
  // no counts yet is treated as missing here: feed questions have no live
  // listener, so a first voter's empty snapshot would otherwise be frozen
  // forever. Since D98 that window is one answer wide rather than the
  // whole climb to a k-floor, so this re-reads far less than it used to.
  const AGG_LS = "insight.aggsCache.v1";
  try {
    const { entries, ages } = parseAggCache(localStorage.getItem(AGG_LS));
    const now = Date.now();
    for (const [qid, doc] of Object.entries(entries)) {
      state.aggs[qid] = doc;
      aggSeen.set(qid, typeof ages[qid] === "number" ? ages[qid] : now);
    }
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
      .filter((id) => !id.startsWith("g_") && !hasPublishedCounts(state.aggs[id]))
      // Re-check each at most every 6h. Cheaper than it was — a question
      // acquires counts on its first answer now, not on its fifth.
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
        setAgg(d.id, d.data() as AggDoc);
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
      // Started at the top of hydrate — see the note there. Re-read here
      // only if the uid changed under us between then and now, which the
      // auth flip can do.
      const prof = uid0 === uidEarly && profileP
        ? await profileP
        : await getDoc(doc(db, "v2_users", uid0));
      if (prof && prof.exists()) {
        state.profile.displayName = (prof.get("displayName") as string) || "";
        state.profile.handle = (prof.get("handle") as string) || "";
        state.profile.testResults =
          (prof.get("testResults") as Record<string, unknown>) || {};
        state.profile.anchors =
          (prof.get("anchors") as Record<string, string>) || {};
        // A doc a pre-fix build polluted with the sample persona's job and
        // education (the baseFor merge leak — personaResidue.ts has the
        // history) heals HERE, not only on the next profile open: the Map's
        // anchor ring reads these back as "from your profile", and
        // answerAnchors() stamps them onto every immutable answer until
        // someone repairs the doc. saveAnchors writes the cleaned map back,
        // so the repair is durable rather than per-boot.
        const scrubbed = scrubPersonaAnchors(state.profile.anchors);
        if (scrubbed) LIVE.saveAnchors(scrubbed);
      }
    } catch (err) {
      reportError(err, { where: "hydrate.profile" });
    }
    // Live mode shows only REAL results: purge the demo's baked test
    // results and rebuild from server + this device's saves.
    publishTestResults();
    // …and then publish anything the viewer's own answers have already
    // earned (D277). Fire-and-forget: an account that has answered enough
    // test cards should not have to answer one MORE to get a stored
    // result, which is what hanging this on the vote path alone would
    // mean for every user who already cleared the threshold. state.feedBank
    // is loaded well before this point, so the fold has its items.
    LIVE.syncPassiveResults();
  }

  // Other people's names and scores, from this account's previous sessions
  // (D129). After the profile block because it is keyed on state.uid, and
  // before the deck poll only because nothing here depends on the order.
  loadProfileCache();

  await startAggPoll();

  // Feed vote hydration: the spec's feed keeps its voted-state in
  // localStorage (WF_LS) — mirror the Firestore answers into it so
  // world-feed renders prior votes natively on any device.
  try {
    const WF_LS = "insight.feedVotes.v1";
    const wf = JSON.parse(localStorage.getItem(WF_LS) || "{}") || {};
    state.feedBank.forEach((q) => {
      const v = state.votes[q.id];
      if (v == null || wf[q.id] != null) return;
      const mv = mirrorVoteValue(q, v);
      if (mv != null) wf[q.id] = mv;
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

// The WF_LS mirror's value for one stored answer. The mirror holds the
// CONTROL's units, not the store's: a vote-shaped entry is the option
// index, but a dial entry is a value on lo..hi and a field entry a point
// {x,y}, while the answer doc's optionIdx for both is the 12-bucket index
// (deck.ts — "a position on this range"). Mirroring the raw index
// rendered it as the value — "0 cups" standing on a 1–10 card (D218) —
// so a continuum answer mirrors as its bucket's midpoint instead, the
// same read world-feed's dialVal/fieldVal derive when only the store
// knows. The midpoint math duplicates dialBucketMid/fieldCellMid
// (world-feed.jsx) because data/ cannot import the spec layer;
// vote.test.ts pins the values so the twins cannot drift apart silently.
// A rank answer's stored form is its order joined with commas ("2,0,1,3"
// — D233), the one non-numeric value the votes map holds. Parsed back
// strictly: anything that is not a clean integer list reads as null, and
// a null never reaches the mirror.
function storedOrder(v: string | undefined): number[] | null {
  if (typeof v !== "string" || !v.includes(",")) return null;
  const order = v.split(",").map(Number);
  return order.every((x) => Number.isInteger(x) && x >= 0) ? order : null;
}

function mirrorVoteValue(
  q: QuestionDoc,
  stored: string,
): number | { x: number; y: number } | { entity: number } | { order: number[] } | null {
  // A rank answer mirrors as the card's own shape ({ order }, tapRank's
  // write) — the stored string is the joined order, not an index at all.
  if (q.type === "rank") {
    const order = storedOrder(stored);
    return order ? { order } : null;
  }
  const idx = Number(stored);
  if (Number.isNaN(idx)) return null;
  if (q.type === "dial") {
    const lo = q.lo ?? 0;
    const hi = q.hi ?? 100;
    return lo + ((idx + 0.5) / 12) * (hi - lo);
  }
  if (q.type === "field") {
    return { x: ((idx % 4) + 0.5) * 25, y: (Math.floor(idx / 4) + 0.5) * (100 / 3) };
  }
  // A catalog answer's stored value IS the entity key (D14) — the control's
  // unit and the store's coincide — but the card keeps it wrapped
  // ({ entity }, setPick's own shape) so the feed can never mistake a dex
  // number for an option index.
  if (q.type === "catalog") return { entity: idx };
  return idx;
}

// Replace the demo feed globals with live-shaped cards: real questions,
// real exact counts, no seeded comments (D1 — renderEngage is also
// gated off for q.live cards). Every live card renders through the
// options path — EXCEPT the forms that keep their bank type because
// their answer space is not an option row: the continuum pair
// (dial/field, D114, synthesized bucket/cell labels whose counts ARE
// the crowd's distribution), catalogue picks (D14/D232, the board from
// the published canon) and rankings (D233, the crowd order derived
// from the published position sums).
function buildFeedGlobals(): void {
  if (!state.feedBank.length) return;
  // Crossroads (D136) is a feed question but NOT a feed card: its reveal is
  // a tree rather than a split, so none of renderCard's apparatus — option
  // rows, who-voted, takes, the insight line — applies to it, and the
  // prototype pins it at the head of the list rather than dealing it into
  // the stream. It rides its own accessor below; everything else about it
  // is ordinary (real options, real counts, the same fold and ledger).
  const feed = state.feedBank
    .filter((q) => q.surface === "feed" && q.type !== "path"
      && ((q.options || []).length >= 2 || q.type === "catalog"))
    .map((q) => {
      // Catalogue picks (D14 gone live) keep their own card shape: no
      // options — the catalogue is the answer space — so none of the
      // option-counts apparatus below applies. The board itself is not
      // here either: the reveal reads LIVE.pickCanon at render time, the
      // pathQs() precedent, because the canon re-sorts as votes land and
      // a snapshot baked into the pool would go stale between rebuilds.
      // `n` is the one number the collapsed card prints.
      if (q.type === "catalog") {
        return {
          id: q.id,
          cat: q.topic || "fav",
          type: "pick",
          domain: q.domain,
          prompt: q.prompt,
          n: state.aggs[q.id]?.total ?? 0,
          ...(q.also && q.also.length ? { also: q.also } : {}),
          live: true,
          noCountsYet: !hasPublishedCounts(state.aggs[q.id]),
        };
      }
      // Rank cards (D12 → D233) keep their own shape too: `items` are the
      // seeded options, `crowd` is DERIVED from the published position
      // sums — 1-based rank per item, the demo's exact contract — with
      // the viewer's own folded order subtracted first (rankCrowdFor),
      // and null while nobody ELSE has ranked, which is the card's
      // first-voter state. Mapping a rank doc through the generic vote
      // arm below is precisely the wrong-shaped card D12 pulled.
      if (q.type === "rank") {
        const agg = state.aggs[q.id];
        return {
          id: q.id,
          cat: q.topic || "culture",
          type: "rank",
          prompt: q.prompt,
          items: q.options,
          crowd: rankCrowdFor(agg, storedOrder(state.votes[q.id]), q.id in state.unaggregated),
          votes: agg?.total ?? 0,
          ...(q.also && q.also.length ? { also: q.also } : {}),
          live: true,
          noCountsYet: !hasPublishedCounts(agg),
        };
      }
      // Hoisted: feedCounts walks the whole option list, so calling it
      // inside the per-option map made this O(n^2) per card — and it
      // re-runs after every vote.
      const counts = feedCounts(q);
      const continuum = q.type === "dial" || q.type === "field";
      return {
        id: q.id,
        cat: q.topic || "culture",
        type: continuum ? q.type : "vote",
        prompt: q.prompt,
        options: q.options.map((label, i) => ({ label, count: counts[i] })),
        // the range/plane copy the card renders from, plus the footer's
        // answer count — agg total, so it includes the viewer once folded
        ...(continuum
          ? {
              lo: q.lo, hi: q.hi, unit: q.unit, ends: q.ends, ax: q.ax, ay: q.ay,
              n: state.aggs[q.id]?.total ?? 0,
            }
          : {}),
        // Sponsored questions (D195): the disclosure travels with the card
        // and `until` travels with it, because the band composes its window
        // label from that one value. Emit-when-set, so an ordinary card is
        // byte-for-byte what it was.
        ...(q.sponsor ? { sponsor: q.sponsor, until: q.until } : {}),
        // The ask window (D231): a current-events card draws its own
        // deadline as a draining ring, which needs both ends. Not for a
        // sponsored card — that one already states its window in the PAID
        // band, and the same fact in two shapes on one card reads as two
        // facts.
        ...(!q.sponsor && q.from && q.until ? { from: q.from, until: q.until } : {}),
        // The background the card's `i` opens (D281). Emit-when-set: the
        // feed reads `q.bg` first and falls back to the demo pool's map,
        // so a card without one keeps exactly the sheet it had.
        ...(q.bg ? { bg: q.bg } : {}),
        // Doors (docs/TAGS-PLAN.md §2): the topics this card also belongs
        // to. The feed's filter, stock and search read cat ∪ also; nothing
        // that PLACES the card does. Emit-when-set, same rule as sponsor.
        ...(q.also && q.also.length ? { also: q.also } : {}),
        live: true,
        noCountsYet: !hasPublishedCounts(state.aggs[q.id]),
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
        // Carried for the same reason every other mapping above carries it,
        // and it was the one mapping that did not: below the floor there is
        // no split to draw, and `renderVote` reads exactly this flag to
        // decide between the tiles (whose height IS the share) and the bars
        // that degrade honestly. Without it a test item nobody has answered
        // drew a five-way stack of zeroes as though that were a measurement.
        noCountsYet: !hasPublishedCounts(state.aggs[q.id]),
      };
    });
  // The feed pool, in bank order (D173 retired D128's stated weights).
  // The ORDERING that replaces them is D163's on-device interest model —
  // owner's direction: how much of a subject you see is the algorithm's
  // job, not a lever's. Until that ships the pool is unweighted, which is
  // what it effectively was at this bank size anyway. Muting a topic
  // outright is untouched and lives in the feed's own topic sheet.
  (window as unknown as Record<string, unknown>).WORLD_FEED_QS = feed;
  // Round-robined across the four instruments (D155), not served in bank
  // order. `content/tests.json` is keyed BY instrument, so bank order is
  // 25 Big Five, then 30 Politics, then 30 Values, then 25 Social — and a
  // real account filled one bar while three sat at zero. The demo pool
  // never had this: spec/test-feed-data.js interleaves as it builds.
  //
  // PUBLISHED BY NAME, not onto `window` (D280). This write was a cast the
  // shared-global scanner cannot see, so when D249 converted the feed's
  // reader to a static import of the DEMO pool the two ends stopped
  // meeting and every gate stayed green — see data/testFeed.ts for what
  // that shipped.
  publishTestFeed(roundRobinBy(tests, (q) => String(q.test || "")));
  // WORLD_FEED_COMMENTS was blanked here as D11's second layer — no take
  // data behind the render gate, in case the gate ever opened. D249 took
  // its last reader off the bridge too, so this write has had no effect
  // since; a no-op that reads as a safeguard is worse than no safeguard,
  // because it is the safeguard people stop checking. The layer that
  // actually holds is `renderEngage`'s `if (q.live)` early return, and it
  // holds for test cards now that they arrive carrying the flag —
  // asserted in the DOM by smoke-live rather than argued for here.
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
  const fns = getFunctions(db.app, FUNCTIONS_REGION);
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
    // NOW the reveal push has something to notify about, so now is when it
    // is fair to ask. After the call, not before: a prompt on top of a
    // creation that then failed would be asking for nothing.
    pushEarned();
    return out;
  },
  /**
   * Ask to join by invite code — what a tapped link now does (D240).
   *
   * `status` is the whole return: `joined` when the circle had already
   * invited them (their side of the consent was on record, so the link
   * completes it), `requested` when a member has to approve, `waiting`
   * when they had already asked, `member` when they were already in.
   *
   * `pushEarned()` fires on a REQUEST too, not only on a join — the
   * notification this account most needs next is "you're in", and it
   * cannot arrive without a token. Asking is the moment that earns the
   * prompt for exactly the same reason joining is.
   */
  async requestJoin(code: string, displayName?: string) {
    const out = await callable<{
      gid: string; name: string; status: "member" | "joined" | "requested" | "waiting";
    }>("requestJoinV2", { code, displayName });
    pushEarned();
    return out;
  },
  /** Let somebody in who asked (D240). Members only, enforced server-side. */
  async approveJoin(gid: string, uid: string) {
    return callable<{ ok: boolean }>("approveJoinV2", { gid, uid });
  },
  /** Turn somebody down. Tells them nothing — the row simply stops being there. */
  async declineJoin(gid: string, uid: string) {
    return callable<{ ok: boolean }>("declineJoinV2", { gid, uid });
  },
  // ── handles and invitations (D122) ──
  //
  // The uid-addressed way into a circle. joinGroup above survives for the
  // share link — the only path that reaches someone with no account yet —
  // but a code is no longer something a person types.
  //
  // `whoIs` reads the registry directly rather than through a callable:
  // uniqueness is the document id, so the lookup is one getDoc against a
  // rule that grants read and nothing else. A callable would add a cold
  // start to a keystroke.
  async whoIs(handle: string): Promise<string | null> {
    const [db, mod] = await Promise.all([getDb(), import("./socialFetch")]);
    return mod.uidForHandle(db, handle);
  },
  /**
   * People whose display name starts with what was typed (D239).
   *
   * The other half of `whoIs`, and the reason it is a different call
   * rather than a smarter one: a handle is an exact address and a name
   * is a prefix over a directory, so one is a document read and the
   * other a bounded query. Merging them is the caller's job — see
   * `ui/peopleSearch.ts`, which is what every surface that finds people
   * actually uses.
   *
   * Session-cached per key, because a search box asks the same question
   * on every backspace and the answer cannot have changed between two
   * keystrokes.
   */
  async searchPeople(raw: string): Promise<DirectoryPerson[]> {
    const key = raw.trim().toLowerCase();
    if (!key) return [];
    const hit = state.peopleSearch.get(key);
    if (hit) return hit;
    const [db, mod] = await Promise.all([getDb(), import("./socialFetch")]);
    const rows = await mod.searchPeopleByName(db, key);
    // Bounded so a long session cannot grow one entry per keystroke ever
    // typed. Oldest out first — a Map iterates in insertion order, which
    // is the whole mechanism.
    if (state.peopleSearch.size >= 40) {
      const oldest = state.peopleSearch.keys().next().value;
      if (oldest !== undefined) state.peopleSearch.delete(oldest);
    }
    state.peopleSearch.set(key, rows);
    return rows;
  },
  async claimHandle(handle: string) {
    const out = await callable<{ handle: string }>("claimHandleV2", { handle });
    state.profile.handle = out.handle;
    notify();
    return out;
  },
  /**
   * Invite one account, or a whole selection (D236).
   *
   * The array is sent as an ARRAY rather than looped here: the server's
   * per-hour budget charges per recipient, so a client-side loop would be
   * N round trips against a cap that already counts them — and a partial
   * failure halfway through would leave the picker with no honest way to
   * say who got asked. `invited`/`skipped` come back for that.
   */
  async inviteToGroup(gid: string, to: string | readonly string[]) {
    return callable<{ ok: boolean; invited?: string[]; skipped?: string[] }>("inviteToGroupV2", {
      gid, to: Array.isArray(to) ? [...to] : to, displayName: state.profile.displayName,
    });
  },
  async acceptInvite(gid: string) {
    const out = await callable<{ gid: string; name: string }>("acceptGroupInviteV2", {
      gid, displayName: state.profile.displayName,
    });
    // THE THIRD MOMENT THAT EARNS THE PROMPT (D236). createGroup and
    // joinGroup have always called this; accepting an invitation is the
    // same act by a different door and was the one that did not, so a
    // person whose entire path into the app was "a friend invited me"
    // could be in a circle and never once be asked. That is exactly the
    // account an invitation push most needs to reach next time.
    pushEarned();
    await this.loadInvites();
    return out;
  },
  async declineInvite(gid: string) {
    const out = await callable<{ ok: boolean }>("declineGroupInviteV2", { gid });
    await this.loadInvites();
    return out;
  },
  invites(): Invite[] {
    return state.invites;
  },
  invitesLoading(): boolean {
    return state.invitesLoading;
  },
  // Fetched on demand, not subscribed. An invitation is not time-critical
  // — the surfaces that show one are opened, not watched — and a live
  // listener on a collection-group query anyone may write into is a bill
  // a stranger controls.
  async loadInvites(): Promise<void> {
    if (!LIVE.enabled || !state.uid || state.invitesLoading) return;
    state.invitesLoading = true;
    notify();
    try {
      const [db, mod] = await Promise.all([getDb(), import("./socialFetch")]);
      state.invites = await mod.fetchInvites(db, state.uid);
    } catch (err) {
      reportError(err, { where: "loadInvites" });
    } finally {
      state.invitesLoading = false;
      notify();
    }
  },
  async leaveGroup(gid: string) {
    return callable<{ gid: string; deleted: boolean }>("leaveGroupV2", { gid });
  },
  // The pair's pool choice (D40 part 4) — the one client-written field on a
  // group doc, and a direct doc update rather than a callable because the
  // rule can express the whole invariant (member + duo doc + closed enum +
  // that field alone; firestore.rules carries the argument). The groups
  // snapshot listener echoes the change back to BOTH partners, so the pool
  // swap lands on each device the same way every other group change does.
  async setDuoMode(gid: string, duoMode: "friends" | "romantic") {
    const db = await getDb();
    await updateDoc(doc(db, "v2_groups", gid), { duoMode });
  },
  // Whether a flip to romantic can land somewhere: the pool seeds dark
  // (active: false, D40 part 4) and the bank is active-filtered, so this
  // stays false fleet-wide until the operator lights the pool up — and the
  // picker (LiveDuelPanel) does not render for a pair it would strand.
  romanticPoolReady(): boolean {
    return state.duelBank.some((q) => q.surface === "duo" && q.mode === "romantic");
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
        // A "pick" day's options ARE the members, in THIS client's roster
        // order — so an index alone goes stale the moment the roster
        // changes, silently remapping every historical pick (the hazard
        // D204 priced). The answer therefore snapshots WHO the index
        // meant at the moment of voting (D224); the reveal carries it,
        // and any later fold reads the uid, never the index.
        if (q.kind === "pick") {
          const pickUid = ((g.memberUids || []) as string[])[optionIdx];
          if (typeof pickUid === "string" && pickUid) payload.pickUid = pickUid;
        }
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

  // ── takes: circle-scoped (D1) and, since D83, anonymous world scope ──
  //
  // Circle takes exist among people who mutually added each other; every
  // circle gate resolves membership through `v2_groups/{gid}.memberUids`.
  // D78 part 2 proposed widening that to world scale without author names,
  // and D83 adopted it: the sentinel gid "world" carries per-question
  // takes readable by any signed-in user, one per person per question
  // (the doc id is `qid_uid`, so the bound is structural, like flag ids).
  // The surface is the same five members — scope is an argument, not a
  // second API.
  //
  // This is the "live takes surface" docs/MODERATION.md named as the thing
  // the client report control was waiting on. The moderation chain above
  // it — flags, queue, verdicts — has been deployed since 2026-07-31, and
  // enforces (MOD_ADVISORY=false) since world scope shipped.

  // The `where("hidden", "==", false)` below is NOT a client-side courtesy
  // layered over a server guarantee. It is the condition the read rule
  // holds the QUERY to: Firestore refuses a list it cannot compare against
  // the rule, so dropping that line does not return more takes, it returns
  // permission-denied (D65). The filter is a consequence of the rule, not
  // a promise beside it.
  //
  // For a CIRCLE, `qid` is filtered in memory rather than as a fourth
  // `where` — the (gid, hidden, createdAt) index serves a list that is one
  // circle big. For WORLD the query carries qid: "every world take ever"
  // is unbounded, so the (gid, qid, hidden, createdAt) index exists for
  // exactly this list and the cache keys per question.
  async loadTakes(gid: string, qid?: string): Promise<void> {
    const key = takeScopeKey(gid, qid);
    // Cache guard as well as in-flight guard — same omission, same effect
    // as loadVoters above: LiveTakesPanel loads on a `[gid, qid]` effect,
    // so without this every return to the panel re-ran the query. The
    // failure path still leaves the key absent on purpose (a cached empty
    // list reads exactly like a circle that never wrote a take), so a
    // transient failure retries and a real empty result is kept.
    if (key == null || state.takesLoading[key] || state.takes[key]) return;
    state.takesLoading[key] = true;
    try {
      const db = await getDb();
      const snap = await getDocs(
        gid === "world"
          ? query(
            collection(db, "v2_takes"),
            where("gid", "==", "world"),
            where("qid", "==", qid),
            where("hidden", "==", false),
            orderBy("createdAt", "desc"),
            limit(TAKE_FETCH_CAP),
          )
          : query(
            collection(db, "v2_takes"),
            where("gid", "==", gid),
            where("hidden", "==", false),
            orderBy("createdAt", "desc"),
            limit(TAKE_GROUP_FETCH_CAP),
          ),
      );
      state.takes[key] = snap.docs.map((d) => takeFromDoc(d.id, d.data() as Record<string, unknown>));
    } catch (err) {
      // Leave the key absent rather than caching an empty list: a
      // transient failure that freezes "no takes" into the session reads
      // exactly like a circle that never wrote any.
      reportError(err, { where: "loadTakes", gid });
    } finally {
      state.takesLoading[key] = false;
      notify();
    }
  },
  takes(gid: string, qid?: string): TakeDoc[] {
    const key = takeScopeKey(gid, qid);
    if (key == null) return [];
    const all = state.takes[key] || [];
    return gid !== "world" && qid ? all.filter((t) => t.qid === qid) : [...all];
  },
  async postTake(gid: string, qid: string, text: string): Promise<string | null> {
    const uid = state.uid;
    const body = text.trim().slice(0, TAKE_MAX_CHARS);
    if (!uid || !body) return null;
    const db = await getDb();
    // Client-chosen id, because that is what the moderation queue keys on
    // (buildModQueue writes v2_mod_queue one doc per takeId). For a circle,
    // doc() on the collection mints one without touching the network. For
    // WORLD the id is `qid_uid` — the create rule checks it literally, and
    // that determinism is the one-take-per-person-per-question bound: a
    // second post is an update, and updates are denied.
    const key = takeScopeKey(gid, qid);
    if (key == null) return null;
    const ref = gid === "world"
      ? doc(db, "v2_takes", `${qid}_${uid}`)
      : doc(collection(db, "v2_takes"));
    const list = (state.takes[key] = state.takes[key] || []);
    list.unshift({
      id: ref.id,
      gid,
      authorUid: uid,
      qid,
      text: body,
      // The local clock, and only until the next loadTakes replaces it
      // with the server's. It orders this session's own post against takes
      // already on screen; it is not a claim about anyone else's timing.
      createdAt: Date.now(),
      hidden: false,
    });
    notify();
    try {
      // Exactly the six keys `hasOnly` permits, and `hidden: false` is
      // written rather than omitted: the read rule is an equality, so a
      // take created without the field could never be read back — not by
      // the circle, and not by its own author.
      await setDoc(ref, {
        gid,
        authorUid: uid,
        qid,
        text: body,
        createdAt: serverTimestamp(),
        hidden: false,
      });
    } catch (err) {
      // Roll the echo back. A take left on screen that the audience never
      // received is the one failure mode worth spending a re-render on.
      state.takes[key] = (state.takes[key] || []).filter((t) => t.id !== ref.id);
      notify();
      reportError(err, { where: "postTake", gid });
      throw err;
    }
    return ref.id;
  },
  // "Your speech stays yours to withdraw" — the delete rule gates on
  // authorUid, so this succeeds for your own take and nobody else's. There
  // is deliberately no edit path: an edited take invalidates the flags
  // already cast on what it used to say. (For a world take, delete-and-
  // repost is also the only rewrite, since the deterministic id makes an
  // in-place second post an update the rules deny.)
  async deleteTake(gid: string, takeId: string): Promise<void> {
    // The scope no longer picks the cache key (see the loop below), but the
    // parameter stays: it is part of the pinned surface (live-surface.ts)
    // and every call site reads naturally with it.
    void gid;
    const db = await getDb();
    await deleteDoc(doc(db, "v2_takes", takeId));
    // Every scope key, not state.takes[gid]: world lists live under
    // `world:{qid}` keys, and filtering all of them is cheaper than
    // threading qid through a call that already knows the doc id.
    for (const k of Object.keys(state.takes)) {
      state.takes[k] = state.takes[k].filter((t) => t.id !== takeId);
    }
    notify();
  },
  // The report control's write half — the piece docs/MODERATION.md listed
  // as still ahead. One flag per (take, account): the doc id pins that and
  // the rules deny updates, so a second report from the same account is
  // refused rather than counted twice. Nobody reads flags; they reach the
  // moderation run only as a server-folded count, which is what keeps a
  // moderation system from becoming a surveillance one.
  async flagTake(gid: string, takeId: string): Promise<void> {
    const uid = state.uid;
    if (!uid || state.myFlags[takeId]) return;
    const db = await getDb();
    // The id shape the rule checks literally: `takeId + "_" + uid`.
    const fid = `${takeId}_${uid}`;
    state.myFlags[takeId] = true;
    notify();
    try {
      await setDoc(doc(db, "v2_flags", fid), { takeId, gid, uid, at: serverTimestamp() });
    } catch (err) {
      delete state.myFlags[takeId];
      notify();
      reportError(err, { where: "flagTake", gid });
      throw err;
    }
  },
  flagged(takeId: string): boolean {
    return !!state.myFlags[takeId];
  },
};

// The takes cache key for a scope. A circle caches per gid (one circle is
// one small list); world caches per question, because "all world takes
// ever" is unbounded and no surface reads it. Null means the caller asked
// for a world scope without naming the question — an impossible list, so
// the store refuses it instead of minting a `world:undefined` key that
// would alias every such mistake onto one phantom question.
// ── the takes read bounds ────────────────────────────────────────
//
// Both `loadTakes` branches shipped with no `limit()` at all, which made
// them the last unbounded read in the app — the shape D102 capped in
// `fetchVoters` and did not look for anywhere else. They get two different
// numbers because they are two different crowds, the same way
// VOTER_FETCH_CAP and CIRCLE_ANSWER_CAP are.
//
// WORLD is the dangerous one and the reason this is not deferred. The
// daily question is globally shared (`computeDeckIds` takes no uid), so
// "takes on today's world question" is roughly everyone who spoke today —
// the query returned ~DAU documents per open and grew linearly forever.
// 100 is a display cap: a screen of talk, newest first, which is what the
// panel renders anyway.
const TAKE_FETCH_CAP = 100;

// A GROUP's crowd is its own history, not the population, so this is a
// ceiling rather than a display cap — high enough that no real circle
// reaches it, low enough that the query cannot run away. It is deliberately
// NOT 100: `takes()` filters this list by qid IN MEMORY (the group branch
// keys on gid alone, and the D65 query-shape tests call loadTakes with no
// qid), so a tight cap here would silently hide an older question's takes
// behind newer chatter — a correctness bug bought with a rounding error.
//
// The better fix is to move `qid` into the group query and key on
// `gid:qid`; the composite index for it is already committed
// (firestore.indexes.json, v2_takes gid+qid+hidden+createdAt). That is a
// behaviour change to a documented query shape rather than a bound, so it
// is recorded here and not taken in a cost pass.
const TAKE_GROUP_FETCH_CAP = 500;

function takeScopeKey(gid: string, qid?: string): string | null {
  if (gid !== "world") return gid;
  return qid ? `world:${qid}` : null;
}

// ── Near by radius: the presence loop (D84) ─────────────────────────
//
// While the viewer has opted in AND the app is foreground, this writes
// their ~200 m grid cell to v2_presence/{uid} every PRESENCE_BEAT_MS and
// asks nearbyCountV2 how many other fresh phones share the 3×3
// neighborhood. The cell comes from locateCell() — the coordinate is
// folded and discarded inside data/locate.ts, so nothing here ever holds
// one — and presence docs are unreadable to every client, so the count in
// nearState is the only thing that ever comes back.
//
// The opt-in flag lives in data/near.ts (its own purge listener — an
// opt-in must not survive onto the next account); the loop stops on uid
// change via stopPresence() in resetForNewUid.
const PRESENCE_BEAT_MS = 4 * 60_000; // far inside the linger, so a foreground app never lapses
// How long a position outlives the beat that wrote it (D174). Mirrors
// PRESENCE_LINGER_MIN in functions/src/pure.ts, and firestore.rules caps
// any `until` at the same 180 minutes — three copies of one number,
// because rules cannot import and the server must not trust the client.
const PRESENCE_LINGER_MS = 180 * 60_000;

const nearState = {
  count: null as number | null,   // null = never fetched this session
  tooFew: false,                  // vestigial since D98 — the server
                                  // no longer withholds a small count, so
                                  // this never becomes true. Kept because
                                  // it is a pinned LIVE member (live-surface.ts)
                                  // and removing it is a three-file change
                                  // with no user-visible effect.
  updatedAt: 0,
  lastError: null as string | null,
  timer: null as ReturnType<typeof setInterval> | null,
  mix: null as { top: string[]; n: number; capped?: boolean } | null,
  inFlight: null as Promise<void> | null,
  // The cell the last successful beat counted (D177). Held so the room
  // fold asks about the SAME neighbourhood the number on screen describes,
  // rather than resolving a second fix that could land a cell away and
  // quietly describe a different room.
  cell: "",
  // The room, from nearbyRoomV2 — loaded on a tab tap, never on the beat.
  // `roomCell` is what it was loaded FOR, so walking to the next cell
  // re-folds instead of showing the room you left.
  room: null as RoomRead | null,
  roomCell: "",
  roomLoading: false,
};

/**
 * What the Near stop's tabs read (D177).
 *
 * `people` is the roster with the archetype each phone wrote for itself
 * (D176's `type`), the caller already removed. `qs` is per-question option
 * counts in the aggregate's own `{ "0": 3 }` shape, folded over exactly
 * those people — one sample, two readings, so People and Compare cannot
 * describe different crowds.
 */
export interface RoomRead {
  people: Array<{ uid: string; type?: string }>;
  qs: Record<string, Record<string, number>>;
}

// One beat. `cell` lets a caller that ALREADY holds a fresh fix hand it over
// instead of paying for a second one: enable() has just resolved a cell to
// decide whether the opt-in could succeed at all, and asking the OS again one
// tick later is a second round trip that can fail on its own — leaving the
// switch ON, the count null, and the card reading "Counting…" with nothing
// behind it. That is the shape the field reported: Near never connects.
async function runBeat(cell?: string): Promise<void> {
  try {
    const fix = cell ? ({ ok: true, cell } as const) : await locateCell();
    if (!fix.ok) {
      // A failed beat does not un-opt-in: permission was granted at opt-in,
      // so this is usually indoors/transient. It is NOT quiet, though —
      // lastError is what the card reads to say why the count is missing or
      // old, rather than counting forever.
      nearState.lastError = fix.reason;
      return;
    }
    const uid = state.uid;
    // No session, no write and no count — and saying so beats clearing the
    // error and then stalling with nothing to explain it.
    if (!uid) { nearState.lastError = "unavailable"; return; }
    const db = await getDb();
    // `until` is when this position stops counting (D174). The linger is
    // what makes the feature work at all — a phone in a pocket has to keep
    // standing in the room — and the session's deadline is what keeps the
    // timed option honest: clamped here, so closing the app just before it
    // cannot leave the position up for a further linger. firestore.rules
    // caps how far out this may be pushed, so the promise does not rest on
    // the client being ours.
    const deadline = nearUntil();
    const lingerTo = Date.now() + PRESENCE_LINGER_MS;
    // `type` is the viewer's OWN Big Five archetype name (D176), and the
    // device is what computes it — the archetype table lives here, so
    // writing the NAME means the server never joins a profile and never
    // carries a copy of the table. Omitted entirely when there is no
    // result: an untyped phone is counted in the room and absent from its
    // mix, which is the honest shape.
    const myArchetype = myType();
    await setDoc(doc(db, "v2_presence", uid), {
      cell: fix.cell,
      at: serverTimestamp(),
      until: new Date(deadline ? Math.min(lingerTo, deadline) : lingerTo),
      ...(myArchetype ? { type: myArchetype } : {}),
    });
    const res = await callable<{
      n?: number; tooFew?: boolean;
      mix?: { top?: string[]; n?: number; capped?: boolean } | null;
    }>("nearbyCountV2", { cell: fix.cell });
    nearState.tooFew = res.tooFew === true;
    nearState.count = typeof res.n === "number" ? res.n : nearState.tooFew ? null : 0;
    // The room's composition, or null when the neighbourhood is under the
    // floor. Defensive about the shape for the same reason similarity.ts
    // is about profiles: this crosses a wire, and a malformed payload must
    // read as "no mix" rather than as an empty room.
    const mix = res.mix;
    nearState.mix = mix && Array.isArray(mix.top) && typeof mix.n === "number" && mix.top.length
      ? {
        top: mix.top.filter((t): t is string => typeof t === "string").slice(0, 3),
        n: mix.n,
        // `n` is a floor rather than a size when the server's sample hit
        // its cap — the card renders "60+", because a truncation shown as
        // the room is the failure D102 fixed on the who-voted sheet.
        capped: mix.capped === true,
      }
      : null;
    nearState.updatedAt = Date.now();
    // The room the number is about (D177). Set only on a settled beat, so
    // a failed round leaves the previous cell standing rather than
    // blanking the tabs' idea of where they are.
    nearState.cell = fix.cell;
    // Cleared only once a count is actually in hand: clearing it beside the
    // fix (where it used to sit) marked the round healthy before the two
    // calls that most often fail had run.
    nearState.lastError = null;
  } catch (err) {
    nearState.lastError = "unavailable";
    reportError(err, { where: "presenceBeat" });
  }
}

// A beat already in flight IS this beat, so a second caller gets the same
// promise rather than an instantly-resolved one. That is what lets the
// card's "Try again" stop when there is an answer instead of one tick after
// the tap.
function presenceBeat(cell?: string): Promise<void> {
  // An expired session is OFF, and finding that out here is the point:
  // `nearMode` re-reads the deadline at the moment of use, so an app that
  // was shut for three hours comes back already expired rather than
  // beating once more before a timer notices. Tear the loop down and
  // delete the doc — "stop being visible" must not wait for the server's
  // own expiry to catch up.
  // deleteAccount sets `torndown` as its first statement, and the server
  // deletes v2_presence/{uid} as part of the sweep. Without this guard a
  // beat already scheduled — the interval, or a visibilitychange — can
  // land after that delete and WRITE THE CELL BACK, for an account that no
  // longer exists. Every other queued writer in this file already checks
  // it; presence was the one that did not.
  if (torndown) return Promise.resolve();
  if (nearMode() === "off" && nearState.timer) { void LIVE.near.disable(); return Promise.resolve(); }
  if (!nearOptedIn() || !LIVE.enabled) return Promise.resolve();
  if (typeof document !== "undefined" && document.hidden) return Promise.resolve();
  if (nearState.inFlight) return nearState.inFlight;
  const run = runBeat(cell).finally(() => { nearState.inFlight = null; notify(); });
  nearState.inFlight = run;
  return run;
}

// Returns the first beat so a caller can wait for it — enable() does, and
// that is the difference between a switch that flips to a number and one
// that flips to "Counting…". Beating even when the loop is already running
// is deliberate and cheap: the in-flight guard collapses a duplicate, and
// the only caller that can hit it is a reconnect, where a fresh count is
// what you want anyway.
function startPresence(cell?: string): Promise<void> {
  if (!nearState.timer) {
    nearState.timer = setInterval(() => { void presenceBeat(); }, PRESENCE_BEAT_MS);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", presenceOnVisible);
    }
  }
  return presenceBeat(cell);
}

function presenceOnVisible(): void {
  if (typeof document !== "undefined" && !document.hidden) void presenceBeat();
}

function stopPresence(): void {
  if (nearState.timer) { clearInterval(nearState.timer); nearState.timer = null; }
  if (typeof document !== "undefined") {
    document.removeEventListener("visibilitychange", presenceOnVisible);
  }
  nearState.count = null;
  nearState.mix = null;
  nearState.tooFew = false;
  nearState.updatedAt = 0;
  nearState.lastError = null;
  // The room goes with the opt-in (D177). Leaving a roster in memory after
  // "stop sharing" would keep a list of who was around you on a screen you
  // just told the app to stop populating — and it is the one piece of
  // Near's state that is about OTHER people.
  nearState.cell = "";
  nearState.room = null;
  nearState.roomCell = "";
}

const NEAR = {
  supported(): boolean {
    return locateSupported();
  },
  on(): boolean {
    return nearOptedIn();
  },
  /** Which of the three states is set (D174) — `off` once a session ends. */
  mode(): NearMode {
    return nearMode();
  },
  /** Epoch ms the session ends, 0 when there is no deadline. */
  until(): number {
    return nearUntil();
  },
  // The count of OTHER fresh phones in the neighborhood: null when never
  // fetched, a number otherwise. `tooFew` used to distinguish
  // "withheld by the floor" from "never fetched" so the UI can say "a few
  // people" honestly when the design floor returns (D81 revert).
  count(): number | null {
    return nearState.count;
  },
  tooFew(): boolean {
    return nearState.tooFew;
  },
  /**
   * The room's composition (D176) — type names in order, and the count of
   * phones that carried a type. Null below the floor, and null is the
   * common case in a quiet street.
   *
   * `capped` says the server's sample hit ROOM_SAMPLE_CAP, so `n` is a
   * floor rather than a size and the card must print it as "60+".
   */
  mix(): { top: string[]; n: number; capped?: boolean } | null {
    return nearState.mix;
  },
  /**
   * The room's roster and answers (D177) — null until a tab asks for it.
   *
   * Null is not "empty room": `roomLoading` and this being null together
   * mean a fold is in flight, and null after one has settled means the
   * call failed. An empty `people` array is the empty room. Same three
   * states LiveCircleBody keeps apart, for the same reason — telling
   * someone at a full party that nobody is here is a lie about the room
   * they are looking at.
   */
  room(): RoomRead | null {
    return nearState.room;
  },
  roomLoading(): boolean {
    return nearState.roomLoading;
  },
  /**
   * Fold the room, for the questions the caller names.
   *
   * ON A TAB TAP, never on the beat — the same cost gate the Mirror's
   * lens bodies keep (D119): the fold reads a document per person per
   * question on a cache miss, and nobody should pay that for a stop they
   * only scrolled past.
   *
   * Session-cached per CELL. Re-entering the tabs is free; walking into
   * the next cell re-folds, because the room you left is not the room you
   * are in. `qids` are appended to the cache key by way of the store's
   * own `qs` map — a second call for a question already folded returns
   * from the server's own per-cell cache at one read.
   */
  async loadRoom(qids: readonly string[]): Promise<void> {
    const cell = nearState.cell;
    // No cell means no settled beat, so there is no room to be in. Silent
    // rather than an error: the tab is open under a card that is already
    // saying why the count is missing.
    if (!cell || nearState.roomLoading) return;
    // Cached, unless the question set has grown past what is held. The
    // second test matters on the day the deck rolls over: same cell, one
    // new qid, and without it the tab would show yesterday's questions
    // until someone walked to another block.
    const held = nearState.room;
    if (held && nearState.roomCell === cell && qids.every((q) => q in held.qs)) return;
    nearState.roomLoading = true;
    notify();
    try {
      const res = await callable<{
        people?: Array<{ uid?: unknown; type?: unknown }>;
        qs?: Record<string, Record<string, number>>;
      }>("nearbyRoomV2", { cell, qids: qids.slice(0, ROOM_QIDS) });
      // Defensive about the shape for the same reason the mix is: this
      // crosses a wire, and a malformed payload has to read as "no room"
      // rather than as an empty one.
      const people = Array.isArray(res.people)
        ? res.people
          .filter((p): p is { uid: string; type?: string } =>
            !!p && typeof p.uid === "string" && !!p.uid)
          .map((p) => (typeof p.type === "string" && p.type
            ? { uid: p.uid, type: p.type } : { uid: p.uid }))
        : [];
      const qs = res.qs && typeof res.qs === "object" ? res.qs : {};
      nearState.room = { people, qs };
      nearState.roomCell = cell;
    } catch (err) {
      // Left null, which the UI reads as a failed fold rather than as an
      // empty room.
      nearState.room = null;
      nearState.roomCell = "";
      reportError(err, { where: "loadRoom" });
    } finally {
      nearState.roomLoading = false;
      notify();
    }
  },
  updatedAt(): number {
    return nearState.updatedAt;
  },
  lastError(): string | null {
    return nearState.lastError;
  },
  // Opt in: one explicit tap. The first fix runs immediately, so the tap
  // also carries the OS permission prompt (D9's rule — location is never
  // requested until asked for).
  async enable(mode: Exclude<NearMode, "off"> = "session"): Promise<{ ok: boolean; reason?: string }> {
    const fix = await locateCell();
    if (!fix.ok) return { ok: false, reason: fix.reason };
    setNearMode(mode);
    // The fix just resolved goes straight into the first beat — see
    // presenceBeat's `cell` — and the tap WAITS for it. The button is
    // already spinning through the location fix; carrying it through the
    // count is what makes the switch and the number appear together
    // instead of flipping to "Counting…" and hoping.
    //
    // Still {ok:true} if that beat fails: the opt-in itself succeeded and
    // presence IS being shared, so reverting the switch would be a lie
    // about what the phone is doing. The card's stall row owns the
    // explanation from here.
    await startPresence(fix.cell);
    return { ok: true };
  },
  // Opt out: stop the loop AND delete the doc — "stop sharing" must not
  // wait for a freshness window to expire.
  async disable(): Promise<void> {
    setNearMode("off");
    stopPresence();
    notify();
    try {
      const uid = state.uid;
      if (!uid) return;
      const db = await getDb();
      await deleteDoc(doc(db, "v2_presence", uid));
    } catch (err) {
      reportError(err, { where: "presenceDisable" });
    }
  },
  // Awaitable, so the card's "Try again" can show a pending state and stop
  // when the beat actually settles. Fire-and-forget callers are unaffected —
  // an ignored promise is the old behaviour.
  refresh(): Promise<void> {
    return presenceBeat();
  },
};

// Firestore Timestamp → millis, tolerating the two shapes a read can hand
// back: a real Timestamp, or null for a serverTimestamp() echoed from the
// local cache before the server has acked it. 0 sorts an unacked take last
// rather than throwing on `.toMillis` of null.
function takeFromDoc(id: string, d: Record<string, unknown>): TakeDoc {
  const ts = d.createdAt as { toMillis?: () => number } | null | undefined;
  return {
    id,
    gid: String(d.gid ?? ""),
    authorUid: String(d.authorUid ?? ""),
    qid: String(d.qid ?? ""),
    text: String(d.text ?? ""),
    createdAt: typeof ts?.toMillis === "function" ? ts.toMillis() : 0,
    hidden: d.hidden === true,
  };
}

declare const __APP_BUILD__: number;

/**
 * The viewer's own answers among the questions the nightly fit folds —
 * the second half of D265's gate.
 *
 * perRev, and the reason is which users pay for it. `usePatternsTab`
 * (spec/app-shell.jsx) subscribes to the store ONLY while the gate is
 * shut and drops the subscription the moment it opens, so this walk runs
 * on every notify() for exactly the people who have not earned the tab
 * yet — new accounts, the ones for whom the app should feel fastest —
 * and never again afterwards. Two whole banks per notify (the daily bank
 * plus `feedBank`, which docs/SCALE-PLAN.md makes the collection that
 * grows without bound) to recompute a number that cannot have moved
 * without a notify().
 *
 * Same argument as `testFeedItems` and `kindredPeople` above: notify() is
 * the only way a store change reaches a renderer, so a value computed at
 * rev N is correct until the next one by construction. Returns a number,
 * so the shared-array condition in the perRev block does not apply.
 */
const patternsMine = perRev((): number => {
  let mine = 0;
  for (const q of state.questions) {
    if (state.votes[q.id] !== undefined && patternsEligible(q)) mine += 1;
  }
  for (const q of state.feedBank) {
    if (state.votes[q.id] !== undefined && patternsEligible(q)) mine += 1;
  }
  return mine;
});

const LIVE = {
  social: SOCIAL,
  near: NEAR,
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
  /** This account's handle, or "" before one is claimed (D122). */
  get handle(): string {
    return state.profile.handle;
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
    // The directory row (D239), written beside the profile rather than
    // derived from it by a trigger: a trigger would be a function
    // invocation per profile write for a two-field copy, and the rules
    // already force `nameKey` to equal `name`, so the client cannot
    // publish a name it is not also found by.
    //
    // A SECOND WRITE, deliberately not awaited into the same failure. If
    // the directory write throws, the name is still saved and the
    // account is merely not findable yet — the next save fixes it, and
    // the boot heal below catches the case where there is no next save.
    try {
      const mod = await import("./socialFetch");
      await mod.writeDirectoryRow(db, uid, name);
    } catch (err) {
      reportError(err, { where: "writeDirectoryRow" });
    }
    state.profile.displayName = name;
    saveLocalName(name);
    notify();
  },
  // The viewer's own anchors, as a plain map — the same seven keys an
  // answer snapshots (D8), read back. Empty until the Basics card is
  // filled in, and that emptiness is load-bearing: the Map's anchor ring
  // (spec/map-anchors.js) renders a row per anchor, so a missing value has
  // to read as "no anchor" rather than fall through to a default. The
  // prototype's defaults were the sample persona's, which is how a live
  // build put "age 34 · Editor · MA Literature" at the centre of a
  // stranger's map.
  anchors(): Record<string, string> {
    return answerAnchors();
  },
  // The live half of a lens card (D91, reversing D50's device-only
  // posture): exact counts for a lens question the seeded bank carries,
  // own vote excluded like every feed count (the UI adds its +1).
  // Returns null when the bank has no such row — an unseeded or pre-D91
  // backend — and the caller (lens-defs.js LENS_FEED_QS) falls back to
  // the selfOnly acknowledgment rather than fabricating a crowd. That
  // fallback is about ABSENT data, not withheld data, so D98 leaves it.
  // ── named who-voted (D98) ─────────────────────────────────────
  //
  // The read the whole reversal was for. Everything else in this store
  // reads the viewer's own documents or a public aggregate; this reaches
  // across users, which no rule permitted before D98 and no client here
  // attempted.
  //
  // Load-on-demand, exactly like loadTakes: the caller is a panel that
  // mounts when someone opens the who-voted sheet, so a feed of fifty
  // cards costs nothing until one is asked about.
  async loadVoters(qid: string): Promise<void> {
    // `state.voters[qid]` is the CACHE guard and `votersLoading` the
    // in-flight one, and for a while only the second existed — so the
    // declaration's "fetched on demand and held for the session" described
    // an intent the code beside it did not implement, and every remount of
    // the sheet re-ran the whole fetch. LiveVotersPanel loads on a
    // `[qid]` effect, so that is once per open, not once per session:
    // ≤200 answers plus name resolution, charged again on every tab
    // return. Absent still means "we could not ask" and still retries —
    // the error path deliberately leaves the key unset — while an empty
    // array now means "nobody answered" and is kept, which is what
    // distinguishing those two states was for.
    if (!qid || state.votersLoading[qid] || state.voters[qid]) return;
    state.votersLoading[qid] = true;
    try {
      const db = await getDb();
      // SORTED HERE, once, rather than on every read. Both keys the
      // comparator uses — `isMe` and the resolved `name` — are fixed when
      // the rows are built and never revised afterwards, so the order the
      // list will ever have is knowable now.
      state.voters[qid] = sortVoters(
        await fetchVoters(db, qid, state.uid, state.names, state.scores, state.logicPcts),
      );
      saveProfileCache();
    } catch (err) {
      // Leave the key ABSENT rather than caching an empty list. The two
      // states render differently and must not be confused: absent is
      // "we could not ask", empty is "nobody answered". Freezing a
      // failure into the session as "nobody" is the same class of lie
      // the old floor's silent gaps were.
      reportError(err, { where: "loadVoters", qid });
    } finally {
      state.votersLoading[qid] = false;
      notify();
    }
  },
  // uid → display name, from the shared session cache. Synchronous and
  // best-effort: "" means either "no name set" or "not fetched yet", and
  // the caller renders the same fallback for both because from the screen
  // they are the same thing. Pair it with loadNames when the uids are
  // known ahead of the render (world takes do this).
  nameFor(uid: string): string {
    return state.names[uid] || "";
  },
  /**
   * A uid's parsed test results from the shared profile cache, or null.
   *
   * The read half of `loadNames`, which has always fetched scores beside
   * names into the same cache — every consumer so far reached them
   * through a list (`kindredPeople`, `voters`), and D177's room roster is
   * the first that has uids and nothing else. Null means "not cached or
   * has none", which the caller must render as no match rather than as a
   * bad one.
   */
  scoresFor(uid: string): ParsedResults | null {
    return state.scores[uid] ?? null;
  },
  /**
   * A uid's Storage download token for their photo, or "" (D178).
   *
   * "" covers three different situations on purpose, because all three
   * draw the same thing — initials: not fetched yet, no photo set, and a
   * photo a moderator REMOVED. The third is why the filter lives in
   * `resolveNames` rather than at each call site: one place turns a
   * document into a picture, so one place has to check `hidden`.
   */
  faceFor(uid: string): string {
    return state.faces[uid] || "";
  },
  /** Your own token, so the profile can show what everyone else sees. */
  myFace(): string {
    return state.uid ? (state.faces[state.uid] || "") : "";
  },
  /**
   * Set your photo (D178): shrink on the device, upload, record the token.
   *
   * THE ORDER IS THE CORRECTNESS. The object goes up first and the
   * document second, so the only way to fail halfway is an object with no
   * document pointing at it — invisible, overwritten by the next attempt,
   * and swept by `deleteAccount` like any other. The reverse order would
   * leave a token naming bytes that were never stored, which every surface
   * would draw as a broken face.
   *
   * `firebase/storage` is imported HERE and nowhere else: drawing a face
   * needs an `<img>` and a URL, so an account that never sets one never
   * pays for the SDK.
   */
  async setAvatar(file: Blob): Promise<{ ok: boolean; reason?: string }> {
    const uid = state.uid;
    if (!uid) return { ok: false, reason: "unavailable" };
    try {
      const small = await shrinkToSquare(file);
      // Checked here as well as in the rules so an oversized result fails
      // with a sentence rather than a permission error. It should be
      // unreachable — the shrink produces ~20 KB — which is exactly why
      // reaching it is worth reporting rather than swallowing.
      if (small.size > AVATAR_MAX_BYTES) return { ok: false, reason: "too-big" };
      const [{ getStorage, ref, uploadBytes, getDownloadURL }, db] = await Promise.all([
        import("firebase/storage"),
        getDb(),
      ]);
      const objectRef = ref(getStorage(), avatarPath(uid));
      await uploadBytes(objectRef, small, { contentType: "image/jpeg" });
      const token = tokenFromUrl(await getDownloadURL(objectRef));
      if (!token) return { ok: false, reason: "unavailable" };
      await setDoc(doc(db, "v2_avatars", uid), {
        token, at: serverTimestamp(), hidden: false,
      });
      state.faces[uid] = token;
      notify();
      return { ok: true };
    } catch (err) {
      reportError(err, { where: "setAvatar" });
      // A rules refusal on the document is the one failure with a specific
      // cause worth naming: it means this face was REMOVED by moderation,
      // and the document is frozen against exactly this write. Saying
      // "try again" to that would be a loop with no exit.
      const code = (err as { code?: string } | null)?.code || "";
      return { ok: false, reason: code.includes("permission") ? "removed" : "unavailable" };
    }
  },
  /**
   * Report somebody's photo (D178).
   *
   * The same collection, the same one-per-person pin and the same queue a
   * take's report uses — reusing it is what gives a face the anonymity
   * deny, the flag threshold and the verdict log without a second set of
   * all four. `av_{uid}` namespaces the target so it cannot collide with a
   * take id; `target` carries the uid so the rule can reach the avatar
   * document without doing string surgery on an id.
   *
   * Optimistic like `flagTake`, and rolled back the same way: a report
   * that failed must not leave the control saying it went through.
   */
  async flagAvatar(target: string): Promise<void> {
    const uid = state.uid;
    const takeId = `av_${target}`;
    if (!uid || !target || target === uid || state.myFlags[takeId]) return;
    const db = await getDb();
    state.myFlags[takeId] = true;
    notify();
    try {
      await setDoc(doc(db, "v2_flags", `${takeId}_${uid}`), {
        takeId, gid: "avatar", uid, target, at: serverTimestamp(),
      });
    } catch (err) {
      delete state.myFlags[takeId];
      notify();
      reportError(err, { where: "flagAvatar" });
      throw err;
    }
  },
  /** Whether you have already reported this face. */
  flaggedAvatar(target: string): boolean {
    return !!state.myFlags[`av_${target}`];
  },
  /** Take your photo down. Deletes the document and the bytes. */
  async removeAvatar(): Promise<void> {
    const uid = state.uid;
    if (!uid) return;
    try {
      const [{ getStorage, ref, deleteObject }, db] = await Promise.all([
        import("firebase/storage"),
        getDb(),
      ]);
      await deleteDoc(doc(db, "v2_avatars", uid));
      // Best-effort, and AFTER the document: with the document gone
      // nothing draws the face, so a failed object delete is a stray
      // object rather than a picture still on screen. `deleteAccount`
      // sweeps it either way.
      try {
        await deleteObject(ref(getStorage(), avatarPath(uid)));
      } catch { /* already gone, or unreachable */ }
      state.faces[uid] = "";
      notify();
    } catch (err) {
      reportError(err, { where: "removeAvatar" });
    }
  },
  // Batched uid → name fetch into the shared cache. Used by any surface
  // that has uids but no names — world takes carry `authorUid` and no
  // author name, so this is what turns them from "Someone" into people.
  // A no-op once every uid is cached, which is the common case after the
  // first surface on a question has resolved them.
  async loadNames(uids: readonly string[]): Promise<void> {
    const want = uids.filter((u) => u
      && (!(u in state.names) || !(u in state.scores) || !(u in state.faces)
        || !(u in state.logicPcts)));
    if (!want.length) return;
    try {
      const db = await getDb();
      await resolveNames(db, want, state.names, state.scores, state.faces, state.logicPcts);
      saveProfileCache();
    } catch (err) {
      reportError(err, { where: "loadNames" });
    } finally {
      notify();
    }
  },
  // ── Kindred: the people most like you (D99) ───────────────────
  //
  // The People lens's hard half. The mix is a fold over one aggregate;
  // this needs OTHER PEOPLE'S ANSWERS, question by question, and then a
  // comparison against your own.
  //
  // Built on the voter lists rather than beside them, which is the whole
  // reason it is affordable: `loadVoters` already caches one
  // collection-group query per question for the who-voted sheet, so a
  // question whose sheet has been opened costs nothing here, and the
  // names are resolved once into the shared cache for both surfaces.
  //
  // Bounded at KINDRED_QUESTIONS of the viewer's own answers, CHOSEN
  // rather than inherited (D277 §2). The bound itself is the affordable
  // part and is not what changed: likeness over 12 shared questions is a
  // legible claim, and an unbounded version would fan out over every
  // question the account has ever answered, on a screen opened casually.
  //
  // WHICH TWELVE was the bug. This read
  //
  //     Object.keys(state.votes).filter(…).slice(0, KINDRED_QUESTIONS)
  //
  // under a comment claiming "the viewer's OWN most recent answers", and
  // D112 recorded the pool as recency-biased on the same belief. Neither
  // was true: Object.keys is insertion order, hydrate assigns the
  // persisted cache FIRST (the answers-cache block above), the warm delta
  // query carries an inequality with no orderBy, and new votes append at
  // the tail — and re-assigning a key that already exists does not move
  // it. So the twelve froze at whatever the first cold boot happened to
  // put first and never moved again, and the two boot paths disagree, so
  // the same account ranked strangers differently on a second device.
  //
  // Recency is not the replacement either, and cannot be: the vote map
  // carries no timestamps. peopleMap.ts:124-130 already reached this
  // conclusion for the sibling surface — "Recency would match Kindred's
  // choice but the client vote map carries no timestamps" — while this
  // file's comment claimed the recency it could not have.
  //
  // DIVISIVENESS is the honest choice and a better one than recency ever
  // was. Agreeing on a question 95% of people answer the same way is
  // nearly no evidence; agreeing on a 50/50 split is a lot. cohort.ts has
  // measured that as `divisiveness` since D99 and nothing has ever used
  // it to pick anything. Every input is already resident — hydrate tops up
  // aggregates for answered questions (AGG_ID_CAP 120) — so this costs one
  // sort and no read.
  //
  // Non-integer votes are dropped in the same pass. A catalog answer
  // stores an entity id and a rank answer a joined order (see the fold in
  // hydrate), both on `surface: "feed"`, which IS in WORLD_ANSWER_SURFACES
  // — so those qids issued a collection-group query, got documents back,
  // and voters.ts discarded every row for want of a numeric optionIdx.
  // Up to a quarter of the twelve slots bought an empty list.
  async loadKindred(): Promise<void> {
    if (state.kindredLoading) return;
    state.kindredLoading = true;
    try {
      const qids = pickKindredQids(state.votes, divisivenessOf, KINDRED_QUESTIONS, storesOptionIdx);
      // Sequential rather than parallel on purpose: each call is a
      // collection-group query, most of them are cache hits after the
      // first surface has run, and firing twelve at once at boot-adjacent
      // moments is the shape that gets a client rate-limited.
      for (const qid of qids) {
        if (!state.voters[qid]) await this.loadVoters(qid);
      }
      // Counted from what actually LANDED, not from what was asked for:
      // loadVoters swallows its own failure (reportError, then the list
      // stays unset), so the old line reported twelve to the caption after
      // twelve failed queries.
      state.kindredAt = qids.filter((id) => state.voters[id]).length;
    } catch (err) {
      reportError(err, { where: "loadKindred" });
    } finally {
      state.kindredLoading = false;
      notify();
    }
  },
  // Everyone who overlaps with you, most alike first. Derived on read
  // rather than stored: the inputs are already in the store, and a cached
  // ranking would go stale against its own source the moment another
  // question's voters load.
  //
  // Returns [] rather than null when nothing has loaded — this is a
  // ranking over whatever is known, and "known nothing yet" and "nobody
  // overlaps" are the same empty list to a reader. The loading flag is
  // what distinguishes them for the UI.
  kindred(minShared = 2): Array<{ uid: string; name: string; like: Agreement }> {
    const mine: Record<string, number> = {};
    for (const [qid, opt] of Object.entries(state.votes)) {
      if (qid.startsWith("g_")) continue;
      const n = Number(opt);
      if (Number.isFinite(n)) mine[qid] = n;
    }
    // uid -> their answers, assembled from the cached voter lists.
    const theirs: Record<string, Record<string, number>> = {};
    for (const [qid, rows] of Object.entries(state.voters)) {
      for (const r of rows) {
        if (r.uid === state.uid) continue;
        (theirs[r.uid] || (theirs[r.uid] = {}))[qid] = r.optionIdx;
      }
    }
    return Object.keys(theirs)
      .map((uid) => ({ uid, name: state.names[uid] || "", like: agreement(mine, theirs[uid]) }))
      .filter((p) => p.like.shared >= minShared)
      // Most alike first, on the confidence-bounded rate rather than the
      // raw percentage (D277 §2). The old comment here had the reasoning
      // right — "a 100% over two questions is a weaker claim than 80% over
      // ten" — and the wrong key: with pct FIRST, `shared` only ever broke
      // a tie between two people who already had the same percentage, so
      // the 100%-of-two still headed the list. `rate` is what makes the
      // sentence true. `pct` is still what gets printed.
      .sort((a, b) => b.like.rate - a.like.rate
        || b.like.shared - a.like.shared
        || a.uid.localeCompare(b.uid));
  },
  kindredLoading(): boolean {
    return state.kindredLoading || state.cityKindredLoading;
  },
  // ── the city half of the pool (D278) ──────────────────────────────
  //
  // THE BUG THIS CLOSES is recall, and it is the one D112 recorded as
  // known limit 1 and priced only for cost. `loadKindred` asks each
  // question for the newest VOTER_FETCH_CAP answers from ANYWHERE, and
  // the City constellation then filters them to your city on the device.
  // With a city holding 2% of active users, ~4 of every 200 rows survive
  // that filter — and because the cap binds BEFORE the filter, the number
  // of reachable city-mates saturates around 50 however large the city
  // gets. Modelled: at 100k users the ring is choosing its twelve from
  // 2.6% of your city, and the chance the single closest person is even a
  // candidate is 23%.
  //
  // The city is already ON the answer (`anchors.city`, frozen at vote
  // time, D8 — the same field the aggregate folds and `kindredPeople`
  // reads back), so the fix is to ask for it rather than to ask for more:
  // same twelve questions, same 200-row cap, same rows read, ~50× the
  // usable rows. Modelled at the same 100k: reachable city-mates 51 →
  // 1,387, top-1 recall 23% → 90%.
  //
  // AN ADDITIONAL PASS, not a replacement, and that is the cost. The
  // People lens ranks strangers from anywhere (it takes a `scope` and
  // does not filter on it), so narrowing the shared pool would silently
  // turn "everyone" into "everyone in your city". So this is a second
  // read: +12 collection-group queries of ≤200 rows, once per session,
  // and only for a viewer who has a city and opened the stop that draws
  // it. Name and score resolution is mostly free on top — the same faces
  // recur across a city's twelve lists and the profile cache is
  // disk-backed (D129).
  //
  // Not paging, deliberately (the D101 rule is satisfied, not bypassed):
  // the cap is unchanged and no cursor is walked. What changes is WHICH
  // 200, which is a different lever from HOW MANY — and it is the lever
  // that pays, because paging is linear in reads while this is free.
  async loadCityKindred(): Promise<void> {
    const city = this.myCity;
    if (!this.enabled || !city || state.cityKindredLoading) return;
    // The anchor can change (a move, a corrected city). Keyed rather than
    // guarded by a boolean so the pool refetches for the new city instead
    // of serving the old one forever.
    if (state.cityVotersAt === city) return;
    state.cityKindredLoading = true;
    notify();
    try {
      const db = await getDb();
      const qids = pickKindredQids(state.votes, divisivenessOf, KINDRED_QUESTIONS, storesOptionIdx);
      const next: Record<string, Voter[]> = {};
      // Sequential, for the reason loadKindred is: twelve collection-group
      // queries fired at once is the shape that gets a client rate-limited.
      for (const qid of qids) {
        try {
          next[qid] = await fetchVoters(db, qid, state.uid, state.names, state.scores, state.logicPcts, city);
        } catch (err) {
          // One question failing must not cost the other eleven. Absent
          // rather than empty, the loadVoters rule.
          reportError(err, { where: "loadCityKindred", qid });
        }
      }
      state.cityVoters = next;
      state.cityVotersAt = city;
      saveProfileCache();
    } catch (err) {
      reportError(err, { where: "loadCityKindred" });
    } finally {
      state.cityKindredLoading = false;
      notify();
    }
  },

  // ── the follow graph and the Circle stop (D101) ──
  //
  // Kindred above ranks STRANGERS, off voter lists another surface
  // already paid for. Circle is the set you chose, and it is the only
  // place in the app that reads a named individual's whole answer set —
  // so unlike Kindred it costs a query per member and is loaded only
  // when the stop is opened.
  async loadCircle(force = false): Promise<void> {
    const me = state.uid;
    // The most expensive of the three: one query PER MEMBER, up to
    // FOLLOW_CAP members x CIRCLE_ANSWER_CAP answers each. LiveCircleBody
    // mounts it on an empty-dep effect, so before the cache guard every
    // remount of the stop paid that again.
    //
    // `force` exists for exactly one caller: setFollowing, which changes
    // the membership the fold is over and therefore genuinely needs the
    // refetch it asks for. Making it a parameter rather than clearing
    // state.circle keeps the "who may invalidate this" list to one site.
    if (!this.enabled || !me || state.circleLoading) return;
    if (!force && state.circle) return;
    state.circleLoading = true;
    notify();
    try {
      const [db, circleMod] = await Promise.all([getDb(), import("./circle")]);
      const mine: Record<string, number> = {};
      for (const [qid, opt] of Object.entries(state.votes)) {
        if (qid.startsWith("g_")) continue;
        const n = Number(opt);
        if (Number.isFinite(n)) mine[qid] = n;
      }
      const members = await circleMod.loadCircle(db, me, mine, (u) => state.names[u] || "");
      // Names for anyone the shared cache did not already hold. Batched,
      // and after the fold rather than before it — the likeness is
      // computed from answers and does not wait on a display name.
      const missing = members.filter((m) => !m.name).map((m) => m.uid);
      if (missing.length) {
        await this.loadNames(missing);
        for (const m of members) m.name = state.names[m.uid] || "";
      }
      state.circle = members;
      // The fold already knows the membership, so the cheap view rides
      // along for free — a Friends chip opened after the Circle stop pays
      // no read at all.
      state.follows = members.map((m) => m.uid);
    } catch (err) {
      reportError(err, { where: "loadCircle" });
      // null, not [] — "could not ask" and "you follow nobody" are
      // different sentences and the stop renders them differently. The
      // same rule voters() follows.
      state.circle = null;
    } finally {
      state.circleLoading = false;
      notify();
    }
  },
  /** The circle, or null while unfetched or failed. */
  circle(): CircleMember[] | null {
    return state.circle;
  },
  circleLoading(): boolean {
    return state.circleLoading;
  },
  /**
   * Just the uids you follow — one query, no fan-out (D149).
   *
   * The who-voted sheet's Friends cut needs the SET, not the fold: it
   * intersects it with a voter list it already has in hand, so a friend's
   * side costs nothing beyond this one read. Calling loadCircle for that
   * would be up to FOLLOW_CAP queries to answer a membership test.
   *
   * Kept in step with loadCircle rather than beside it: both are views of
   * one graph, so the fold fills this cache too and setFollowing clears
   * both. Two caches that can disagree about who your friends are is the
   * bug this note exists to prevent.
   */
  async loadFollows(): Promise<void> {
    const me = state.uid;
    if (!this.enabled || !me || state.followsLoading) return;
    if (state.follows) return;
    state.followsLoading = true;
    try {
      const [db, circleMod] = await Promise.all([getDb(), import("./circle")]);
      state.follows = circleMod.capFollows(await circleMod.fetchFollowing(db, me));
    } catch (err) {
      // Left null, like circle's catch: "could not ask" must not render as
      // "you follow nobody".
      reportError(err, { where: "loadFollows" });
    } finally {
      state.followsLoading = false;
      notify();
    }
  },
  /** The uids you follow, or null while unfetched or failed. */
  follows(): string[] | null {
    return state.follows;
  },
  followsLoading(): boolean {
    return state.followsLoading;
  },
  // ── Foresight (D126) ──
  //
  // The log, not the score. `recordOf`/`byDim` are pure folds the UI
  // runs on what this returns, so the store never holds a derived
  // number that could disagree with the rows it came from.
  async loadForesight(): Promise<void> {
    const me = state.uid;
    if (!this.enabled || !me || state.foresightLoading || state.foresight) return;
    state.foresightLoading = true;
    notify();
    try {
      const db = await getDb();
      const snap = await getDocs(collection(db, "v2_users", me, "foresight"));
      const out: Record<string, ForesightVerdict> = {};
      snap.docs.forEach((d) => {
        const v = d.data();
        const guess = Number(v.guess);
        const answerIdx = Number(v.answerIdx);
        out[d.id] = {
          id: d.id,
          qid: String(v.qid || ""),
          dim: String(v.dim || ""),
          bucket: String(v.bucket || ""),
          guess,
          // DERIVED here, never read from the document — the rules do not
          // allow it to be stored, precisely so it cannot be asserted.
          correct: guess >= 0 && guess === answerIdx,
          // Same tolerance takeFromDoc needs: a serverTimestamp echoed
          // from the local cache before the server acks reads back null,
          // and 0 sorts it first rather than throwing on .toMillis.
          at: (v.at as { toMillis?: () => number } | null)?.toMillis?.() || 0,
        };
      });
      state.foresight = out;
    } catch (err) {
      reportError(err, { where: "loadForesight" });
      // null keeps "could not ask" distinct from "nothing played" — the
      // same rule voters() and circle() follow.
      state.foresight = null;
    } finally {
      state.foresightLoading = false;
      notify();
    }
  },
  foresightLog(): Record<string, ForesightVerdict> | null {
    return state.foresight;
  },
  foresightLoading(): boolean {
    return state.foresightLoading;
  },
  /**
   * Record one read. Create-only server-side, so a second call for the
   * same slice is refused by the rules rather than overwriting — the
   * local guard below is a courtesy, not the enforcement.
   */
  async scoreForesight(
    readId: string, qid: string, dim: string, bucket: string,
    guess: number, answerIdx: number, n: number,
  ): Promise<void> {
    const me = state.uid;
    if (!this.enabled || !me || !readId) return;
    if (state.foresight && readId in state.foresight) return;
    // Optimistic: the verdict is already decided by data the client
    // holds, so waiting on the write to reveal the answer would add a
    // round trip to a screen whose whole point is a ten-second clock.
    const local: ForesightVerdict = {
      id: readId, qid, dim, bucket, guess,
      correct: guess >= 0 && guess === answerIdx,
      at: Date.now(),
    };
    state.foresight = { ...(state.foresight || {}), [readId]: local };
    notify();
    try {
      const db = await getDb();
      await setDoc(doc(db, "v2_users", me, "foresight", readId), {
        qid, dim, bucket, guess, answerIdx, n, at: serverTimestamp(),
      });
    } catch (err) {
      // The row stays in the local log. A verdict that failed to persist
      // is still a verdict the player saw scored, and dropping it from
      // the screen would look like the miss never happened.
      reportError(err, { where: "scoreForesight" });
    }
  },

  /** Whether the viewer follows `uid` — answered from the loaded list. */
  isFollowing(uid: string): boolean {
    return !!state.circle?.some((m) => m.uid === uid);
  },
  /**
   * Follow or unfollow, then reload. Optimism is deliberately NOT applied
   * here: a Circle row carries a likeness computed from a fetch, so a
   * locally-inserted member would render with 0% until the read landed
   * and look like a real reading of a real person.
   */
  async setFollowing(uid: string, on: boolean): Promise<void> {
    const me = state.uid;
    if (!this.enabled || !me || !uid || uid === me) return;
    try {
      const [db, circleMod] = await Promise.all([getDb(), import("./circle")]);
      if (on) {
        if ((state.circle?.length || 0) >= circleMod.FOLLOW_CAP) return;
        await circleMod.follow(db, me, uid);
      } else {
        await circleMod.unfollow(db, me, uid);
      }
      // Dropped before the refetch, not after: loadCircle rewrites it from
      // the fold it is about to run, and leaving the old list standing in
      // between is how a just-followed friend fails to appear on a Friends
      // cut that re-rendered mid-flight.
      state.follows = null;
      await this.loadCircle(true);
    } catch (err) {
      reportError(err, { where: "setFollowing" });
    }
  },
  /** How many of the viewer's questions the ranking has been able to read. */
  kindredDepth(): number {
    return state.kindredAt;
  },

  // ── Similarity: you against people and places, by scores (D112) ──
  //
  // The constellation fields' loader. Two ensures, both bounded and both
  // session-cached:
  //   1. aggregates for every core test item the bank carries — the cells
  //      the place profiles fold. ≤110 docs in ≤4 batched `in` queries,
  //      once per session, and only the ones the deck/archive has not
  //      already cached.
  //   2. the Kindred voter lists (loadKindred, its own bounds — D102).
  // Candidate scores cost nothing here: they rode along with the voter
  // lists' name resolution, because the profile document was already on
  // the wire (see resolveNames).
  async loadSimilarity(): Promise<void> {
    if (!this.enabled || state.similarityLoading) return;
    state.similarityLoading = true;
    notify();
    try {
      if (!state.testAggsLoaded) {
        const db = await getDb();
        const missing = state.feedBank
          .filter((q) => q.surface === "test" && q.test && !state.aggs[q.id])
          .map((q) => q.id);
        // Chunks IN PARALLEL, the shape hydrate.aggs and loadLearnAggs
        // already use (D169). This awaited each `in` query in turn, and
        // the four are independent: same documents, same billed reads,
        // but four serial round trips instead of one. 110 core test items
        // over the 30-id `in` limit is always ~4 chunks, so on a mobile
        // RTT that was most of a second of "Reading the score profiles…"
        // bought by nothing — the fields land on the FIRST open of City,
        // Country and World, which is the moment it was spent.
        const chunks: string[][] = [];
        for (let i = 0; i < missing.length; i += 30) chunks.push(missing.slice(i, i + 30));
        // Each chunk folds ITSELF, inside its own `.then`, rather than the
        // barrier folding an array of snapshots afterwards. That is not a
        // style preference: the serial loop this replaced kept the chunks
        // it had already read when a later one threw, and folding after
        // `Promise.all` would have quietly dropped them — a partial
        // failure would go from "three quarters of the place profiles" to
        // "none". Folding per chunk keeps the old partial-progress
        // behaviour AND the parallelism; the rejection still reaches the
        // catch below, and the sibling call sites' `Promise.all` shape is
        // unchanged.
        await Promise.all(chunks.map((chunk) =>
          getDocs(query(collection(db, "v2_question_aggs"), where(documentId(), "in", chunk)))
            .then((snap) => {
              snap.docs.forEach((d) => {
                setAgg(d.id, d.data() as AggDoc);
              });
              // Counted, which it was not before — the other three agg
              // reads all increment this and these are the largest batch
              // of the four. An uncounted read in the one file
              // docs/COSTS.md is derived against is a diagnostic that
              // under-reports exactly where it matters most.
              state.stats.aggsFetched += snap.size;
            })));
        // Set even when some docs came back absent: absent means no
        // answers yet (D98), which re-asking this session cannot change.
        state.testAggsLoaded = true;
      }
      await this.loadKindred();
    } catch (err) {
      reportError(err, { where: "loadSimilarity" });
    } finally {
      state.similarityLoading = false;
      notify();
    }
  },
  similarityLoading(): boolean {
    return state.similarityLoading;
  },
  // The bank's core test items — the same filter that publishes
  // TEST_FEED_QS for the feed, exposed so the typed layer can join them
  // to IS_TESTS for scoring metadata without a bridge read.
  //
  // perRev because the bank only changes at hydrate and this has five
  // render-path callers (SimilaritySection, PlacesField, testNorms,
  // result-card ×2), each feeding it straight into testItemMeta — and
  // because docs/SCALE-PLAN.md makes `feedBank` the collection that grows
  // without bound, so a per-call filter over it is the wrong shape to
  // leave lying around.
  testFeedItems: perRev((): Array<QuestionDoc & { id: string }> =>
    state.feedBank.filter((q) => q.surface === "test" && !!q.test)),
  // The viewer's own completed instruments — the same server+device merge
  // publishTestResults dispatches, computed on read so a result saved a
  // moment ago is already in it.
  myTestResults(): Record<string, unknown> {
    try {
      const local = JSON.parse(localStorage.getItem("insight.testResults.v2") || "{}") || {};
      return { ...state.profile.testResults, ...local };
    } catch {
      return { ...state.profile.testResults };
    }
  },
  // Everyone the cached voter lists know — name, frozen city, answers
  // overlap and parsed scores — the raw material data/similarity.ts's
  // rankKindred sorts. Derived on read like kindred(), for the same
  // staleness reason. The city is the anchor snapshot from their most
  // recent cached answer, never their live profile (D8: reading the
  // profile would re-cohort history and disagree with the aggregate).
  //
  // perRev (D169): this is the app's heaviest fold and its six callers
  // all sit in components that re-render on every notify(). See the perRev
  // block above — the cached array is shared, so a consumer must copy
  // before sorting (they all do).
  kindredPeople: perRev((): KindredPerson[] => {
    const mine: Record<string, number> = {};
    for (const [qid, opt] of Object.entries(state.votes)) {
      if (qid.startsWith("g_")) continue;
      const n = Number(opt);
      if (Number.isFinite(n)) mine[qid] = n;
    }
    const theirs: Record<string, Record<string, number>> = {};
    const anchors: Record<string, Record<string, string>> = {};
    // Both halves of the pool (D278). The city pass and the unscoped pass
    // overlap heavily — a city-mate near the top of a question's newest
    // 200 is in both — and the inner loop is idempotent per (uid, qid), so
    // the union needs no dedupe of its own.
    const pools = [...Object.entries(state.voters), ...Object.entries(state.cityVoters)];
    for (const [qid, rows] of pools) {
      for (const r of rows) {
        if (r.uid === state.uid) continue;
        (theirs[r.uid] || (theirs[r.uid] = {}))[qid] = r.optionIdx;
        // Lists are newest-first, so the first snapshot seen is the
        // freshest this session holds for them. Kept WHOLE since D152 —
        // the People lens says who someone is (profession, age band) and
        // not only how alike they are, and every field it needs is already
        // on the row that was fetched for the ranking. Merged rather than
        // replaced, because a newer answer can carry fewer anchors than an
        // older one (a user who cleared a field), and dropping a fact the
        // session already holds would make the card flicker between
        // renders for no reason a reader could see.
        const a = anchors[r.uid] || (anchors[r.uid] = {});
        for (const [k, v] of Object.entries(r.anchors || {})) if (v && !a[k]) a[k] = v;
      }
    }
    return Object.keys(theirs).map((uid) => ({
      uid,
      name: state.names[uid] || "",
      city: anchors[uid]?.city || "",
      like: agreement(mine, theirs[uid]),
      results: state.scores[uid] ?? null,
      anchors: anchors[uid] || {},
    }));
  }),

  // null while unfetched or failed; an array (possibly empty) once known.
  voters(qid: string): Voter[] | null {
    // The STORED array, already ordered (loadVoters sorts once). This used
    // to copy and re-sort on every read, and the comparator reaches
    // `localeCompare` for the common pair, so the cost is not nominal:
    // `PatternsPeople` asks for all PEOPLE_QUESTIONS lists inside a memo
    // that re-runs on every notify, and `foldPeople` is order-independent,
    // so every one of those sorts was thrown away.
    //
    // A shared array, so the perRev block's condition applies: safe only
    // while no consumer mutates what it gets back. The three live callers
    // — LiveTakesPanel's `sideOf` fold, LiveBreakdownPanel, and
    // PatternsPeople (which takes it as `readonly`) — all read only, and
    // `votersByOption` below re-sorts fresh arrays out of `groupByOption`.
    // A future caller that sorts in place would reorder everybody else's,
    // so sort a copy.
    //
    // The stable identity is a second win rather than an accident:
    // LiveTakesPanel memoises `sideOf` on this value, and a fresh array per
    // render meant that memo could never hit.
    return state.voters[qid] || null;
  },
  // The same list, split into one column per option. optionCount comes
  // from the question rather than the data, so an option nobody picked
  // still gets an (empty) column.
  votersByOption(qid: string, optionCount: number): Voter[][] | null {
    const rows = this.voters(qid);
    return rows ? groupByOption(rows, optionCount).map(sortVoters) : null;
  },
  votersLoading(qid: string): boolean {
    return !!state.votersLoading[qid];
  },
  // The same list joined to the scores the SAME profile read already
  // parsed (D112) — what data/typeSplit.ts folds into a per-type reading
  // of the question. A join and nothing else: the arithmetic is pure and
  // lives one module over, so the store never becomes a second place
  // where a type is decided.
  //
  // The uid rides along because the roster under the split has to be
  // filterable to exactly the people the bars counted; a type is not an
  // anchor, so the dim/bucket scoping every other cut uses cannot reach
  // it (LiveVotersPanel's `uids`).
  voterScores(qid: string): { uid: string; optionIdx: number; results: ParsedResults | null; logic: number | null }[] | null {
    const rows = state.voters[qid];
    if (!rows) return null;
    return rows.map((r) => ({
      uid: r.uid,
      optionIdx: r.optionIdx,
      results: state.scores[r.uid] ?? null,
      // The verified logic percentile (D227), joined the same way — the
      // Logic cut's fold lives in data/logicSplit.ts, one module over.
      logic: state.logicPcts[r.uid] ?? null,
    }));
  },

  lensAgg(qid: string): { counts: number[]; noCountsYet: boolean } | null {
    const q = feedById(qid);
    if (!q || q.surface !== "test") return null;
    return { counts: feedCounts(q), noCountsYet: !hasPublishedCounts(state.aggs[qid]) };
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
  // ── the passive fold, persisted (D277) ────────────────────────────
  //
  // D112 recorded as known limit 2 that a person's own passive feed
  // answers never reach their STORED result, and sidestepped it by
  // folding the viewer's answers directly wherever the viewer's own vector
  // was needed. D121 then deleted the sit-down flow — the only writer
  // `testResults` ever had — and the limit quietly became a hole: with
  // nothing writing the four core keys, `state.scores[uid]` parses to
  // null for EVERY candidate, `rankKindred`'s score tier can never fire,
  // and the City ring that D112 specified as "ranked primarily by test
  // scores" ranks entirely on answer agreement instead. Two comments in
  // the tree already say the writer is gone (passive-meter.jsx,
  // passiveProfile.ts); neither noticed that the person-to-person half of
  // D112 went with it.
  //
  // NOTHING NEW IS COMPUTED HERE. `passiveResult` already emits the shape
  // the sit-down flow wrote — `dims: [{ id, label, value }]`, which is
  // exactly what `parseTestResults` reads back off a stranger profile —
  // and already refuses an instrument with any axis under MIN_AXIS_ITEMS.
  // So what publishes is precisely what D121 decided had earned the right
  // to be called a result; this only stops throwing it away.
  //
  // A STORED RESULT ALWAYS WINS. A pre-D121 sit-down result is a finished
  // instrument and this fold is an estimate of the same thing from fewer
  // answers, so only an absent key — or one this fold wrote before, which
  // `passive: true` marks — is ever moved. result-card.jsx's `ownResult`
  // makes the same call for the same reason.
  //
  // STATIC IMPORTS, and that is measured rather than assumed. The worry
  // was the entry graph — check:bundle records MAX_EAGER_KB as having no
  // headroom — but both modules are already in it: `test-definitions.js`
  // arrives through `daily-split.jsx`, which spec-index.js imports eagerly
  // (line 113, above the loadWorldFeed deferrals), and `passiveProfile.ts`
  // pulls only `similarity.ts`, which `voters.ts` already imports
  // statically for parseTestResults. So the honest cost here is this
  // module's own body and nothing else.
  syncPassiveResults(): void {
    if (!this.enabled || !state.uid) return;
    try {
      const defs = IS_TESTS as TestDefs;
      const items = this.testFeedItems();
      const votes = voteIndices(state.votes);
      let wrote = false;
      for (const kind of CORE_TEST_KINDS) {
        const def = defs[kind];
        if (!def) continue;
        const stored = state.profile.testResults[kind] as { passive?: boolean } | undefined;
        if (stored && !stored.passive) continue;
        const next = passiveResult(
          passiveTest(kind, def, items, defs, votes),
          def.title || kind,
        );
        if (!next) continue;
        // The fold re-runs on every test answer and most answers do not
        // move a rounded axis value, so an unchanged result must not buy a
        // profile write. Comparing the serialised doc is the cheap version
        // of "did anything a reader could see change".
        if (stored && JSON.stringify(stored) === JSON.stringify(next)) continue;
        this.saveTestResult(kind, next);
        wrote = true;
      }
      // Only when something moved: publishTestResults dispatches to every
      // consumer holding the results object, and an event that changes
      // nothing is a re-render nobody asked for.
      if (wrote) publishTestResults();
    } catch (err) {
      reportError(err, { where: "syncPassiveResults" });
    }
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
    // Latched BEFORE the call, deliberately — see `torndown` above: work
    // already in flight must not re-create an `insight.*` key while the wipe
    // runs.
    torndown = true;
    // …and UNLATCHED when the wipe does not happen, which is an expected
    // outcome rather than an exceptional one: index.ts refuses the auth
    // delete whenever ANY wipe phase failed, and every network timeout lands
    // here too, while LivePrivacyPanel deliberately keeps the user in the app
    // afterwards.
    //
    // Left latched, that session was permanently deaf and nothing said so.
    // refreshLive() and wake() no-op, so it can never reconnect after going
    // offline — days, on mobile. resubscribeForToday() no-ops, so the
    // midnight rollover renders a new deck while the previous day's agg and
    // reveal listeners stay attached and billed. subscribeToAuth's handler
    // bails, which disables the uid-change guard whose own comment says it
    // exists to stop one person's answers being shown to another. vote() is
    // not gated, so writes kept flowing the whole time. Only a restart
    // cleared it.
    const db = await getDb().catch((err) => { torndown = false; throw err; });
    await httpsCallable(getFunctions(db.app, FUNCTIONS_REGION), "deleteAccount")({})
      .catch((err) => { torndown = false; throw err; });
    // The account is gone: stop the uid-scoped groups listener before
    // the purge/reload — left running it would only error
    // (permission-denied) against the deleted account's query.
    try {
      state.groupsUnsub?.();
      // The reveal listeners are uid-scoped too, and their handlers write
      // the caches the purge below is about to clear. The deck aggregates
      // are polled rather than streamed (D129), so there is a timer to stop
      // here instead of a listener to unsubscribe.
      stopAggPoll();
      Object.values(state.revealUnsubs).forEach((u) => { try { u(); } catch { /* best-effort */ } });
    } catch {
      /* best-effort */
    }
    state.groupsUnsub = null;
    state.revealUnsubs = {};
    // The offline mirror, which localStorage is not. firebaseImpl.ts enables
    // persistentLocalCache() unconditionally, and hydrate reads the whole
    // answers subcollection plus the profile — so every vote the account
    // ever cast and its full anchors map sit in IndexedDB. Nothing removed
    // them: hydrate is a one-shot getDocs rather than a listener, so the
    // server-side delete produces no remove event, and the cache outlived
    // the account on a device the user may go on to sell.
    //
    // Not a nicety. web/privacy.html — the document both stores require —
    // states that this clears the app's data on the device it ran from, and
    // docs/data-inventory.md repeats it; D6 already treats this same cache
    // as sensitive, which is why Android backup is off. The claim was true
    // of `insight.*` and of nothing else.
    //
    // terminate() first: clearIndexedDbPersistence refuses a live instance.
    // Both best-effort, and both before the purge — clearIndexedDbPersistence
    // also rejects while another tab holds the lease, and a device that
    // cannot clear its cache must still finish signing out and reload.
    try {
      await terminate(db);
      await clearIndexedDbPersistence(db);
    } catch (err) {
      reportError(err, { where: "deleteAccount.clearCache" });
    }
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
  /**
   * Every daily question this device holds a published aggregate for —
   * the seven-day deck plus everything the user has ever answered
   * (hydrate tops those up, capped at AGG_ID_CAP).
   *
   * The Mirror's Answers and Scores lenses read this rather than deck()
   * (D100), and the difference is what makes them worth having. Over a
   * deck of seven, "filter by branch" offers fourteen subjects holding
   * one row each and a sort is a re-ordering of half a screen; over a
   * returning user's archive both become the point. Scores could not
   * exist on the deck at all — the bank holds five `rating` questions in
   * ninety, so a given week usually serves none.
   *
   * No new read. Every aggregate here was already fetched and cached for
   * the card that displayed it; this is the same map, walked rather than
   * indexed.
   *
   * perRev (D169), because the walk is not free and every caller is on a
   * render path: it builds a whole `LiveQuestion` per surviving question,
   * each with its own mapped `options` array. `LiveCohortBody` folds it
   * twice per render of a Mirror stop, `LiveCircleBody` and `LiveReadGame`
   * once each, and `PATTERNS.pool()` (data/patterns.ts) two to four times
   * per render of the Patterns tab — while `patternsSignal()`'s note below
   * cites exactly this cost as the reason IT walks the banks directly.
   *
   * `now` is captured per fold, and freezing it across a revision changes
   * nothing: `back` is null here, so `buildS` never reaches `dayLabel` and
   * the date is unused. The shared-array condition applies as ever — the
   * four callers `.filter()`, `.map()`, spread or iterate, none mutate.
   */
  aggregated: perRev((): LiveQuestion[] => {
    const now = new Date();
    return state.questions
      .filter((q) => q.active !== false && hasPublishedCounts(state.aggs[q.id]))
      // No `back`, so no day label: these come from any day and a pager
      // label on them would be a guess (deck.ts's buildS takes null).
      .map((q) => buildSPure(q, null, voteCtx(q.id), now));
  }),
  /**
   * The core feed questions with a published aggregate, as the same view
   * models — the Patterns pool's other half (the nightly fit folds
   * two-option daily + core feed, functions/src/patterns.ts). Core only
   * for D161's reason: who answers a tail question is interest-selected,
   * so a correlation over tail answers reports the selection rather than
   * the population — the client must not offer to draw what the fit
   * refuses to fold. Two-option only, the fit's own rule (±1 encoding).
   * Same walk as aggregated(): every aggregate here is already cached for
   * the feed card that displayed it, so this is no new read.
   */
  coreFeedAggregated: perRev((): LiveQuestion[] => {
    const now = new Date();
    return state.feedBank
      .filter((q) => q.surface === "feed" && isCore(q) && q.active !== false
        && (q.options || []).length === 2 && hasPublishedCounts(state.aggs[q.id]))
      .map((q) => buildSPure(q, null, voteCtx(q.id), now));
  }),
  /**
   * What the Patterns tab's mount gate reads (D265) — the crowd's number
   * as the nightly fit published it, and the viewer's own answers among
   * the questions that fit folds.
   *
   * NO NEW READ, either half. The crowd number rides the `v2_meta/app`
   * document `hydrate()` already fetches for contentRev; the viewer's
   * count is a walk of two banks the device is holding anyway, and votes
   * come out of the same map `myVotes()` copies. The verdict itself is
   * `data/patternsReady.ts` — pure, so the numbers can be pinned without
   * a store.
   *
   * The banks, not the view models: `aggregated()`/`coreFeedAggregated()`
   * are the same walk plus a `buildSPure` per question, and this runs on
   * every render of the shell. It also deliberately does NOT require a
   * published aggregate the way those two do — a question you answered is
   * evidence about you whether or not its crowd counts have landed on
   * this device yet.
   *
   * Empty in a demo build, which is the honest answer: the tab draws live
   * data only (D166 §1), so a build with no fit behind it has no gate to
   * open.
   */
  patternsSignal(): PatternsSignal {
    if (!this.enabled) return {};
    return { pool: state.meta.patternsPool, basis: state.meta.patternsBasis, mine: patternsMine() };
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
    // The count this option carried BEFORE the write, so the re-read
    // below can tell "the trigger folded my answer" from "someone else
    // answered while I was writing". Read here rather than inside the
    // async block: the cached doc must be the pre-write one.
    const wasAt = Number((state.learnAggs[qid]?.counts || {})[String(optionIdx)] || 0);
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
        // The answer is on the server now, so it is part of this card's
        // crowd whether or not the aggregate says so yet.
        state.learnMine[qid] = { idx: optionIdx, folded: false };
        // Your own answer joins the count you are about to be shown (D125)
        // — one re-read, once, after the write lands. REPLACE rather than
        // invalidate: dropping the entry would make the next render fall
        // back to a thinner reading while the re-read is in flight, which
        // is the reveal you are looking at changing to the WORSE source.
        // The old value stands until a newer one exists.
        //
        // It races the aggregate trigger and USUALLY LOSES — a Firestore
        // trigger is not going to fire, transact and commit inside one
        // client round-trip. D125 called that fine because "one answer
        // does not move the split", which is true of a crowd of two
        // hundred and false of a crowd of one: at launch scale the answer
        // it drops is a large fraction of the reading, and it is always
        // the reader's own. So the race is now RECORDED rather than
        // tolerated — `folded` says whether the doc below already counts
        // this answer, and LEARN_COUNTS adds it in when it does not.
        const fresh = await getDoc(doc(db, "v2_question_aggs", qid));
        if (fresh.exists()) {
          const data = fresh.data() as AggDoc;
          state.learnAggs[qid] = data;
          // Strictly greater: a concurrent stranger picking the same
          // option could raise this without our answer being in it, and
          // erring toward "not folded" would then double-count us. Erring
          // the other way undercounts by one against a settled aggregate,
          // which is the direction the published document is right in.
          const now = Number((data.counts || {})[String(optionIdx)] || 0);
          state.learnMine[qid] = { idx: optionIdx, folded: now > wasAt };
        }
        notify();
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
  //
  // THE FIRST CALL RETURNING NULL IS WHY loadLearnAggs EXISTS (D125). This
  // is a read-through cache with no way to await it, and until D125 the
  // ONLY caller was LEARN_SPLIT — which runs inside LEARN.answer(), i.e.
  // at the instant of the tap. So the first call for every card was always
  // the one deciding that card's reveal, always returned null, and every
  // learn split the app has ever drawn was therefore the authored
  // estimate, at any crowd size. The fix is to warm the cache before the
  // tap rather than to make this function await.
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
  /**
   * The viewer's own first try on this card, and whether the cached
   * aggregate above already counts it — null when this session did not
   * write one (a card answered on another day, or in another install, is
   * the aggregate's business and not this cache's).
   *
   * Synchronous and cache-only on purpose: `LEARN_COUNTS` reads it inside
   * a render path, right next to `learnAgg`, and the two have to answer
   * from the same instant.
   */
  learnMine(cardId: string): { idx: number; folded: boolean } | null {
    return state.learnMine["learn-" + cardId] || null;
  },
  // Warm the cache for a whole serve plan, batched (D125).
  //
  // Called when the feed PLANS its learn cards, which is the one moment
  // that happens before any of them can be tapped. One `in` query per 30
  // cards — the same shape hydrate uses for world aggregates — against one
  // getDoc per card if learnAgg were kicked in a loop.
  //
  // Cards already in the cache are skipped, so a re-plan inside a sitting
  // costs nothing and the per-session read budget is unchanged: still at
  // most one read per distinct card, just paid earlier and in bulk.
  //
  // Resolves when the cache is settled so the caller can re-render — the
  // notify() below covers subscribers, and the promise covers the feed,
  // which deliberately does not re-render on every store notify.
  async loadLearnAggs(cardIds: readonly string[]): Promise<void> {
    if (!this.enabled) return;
    const want = [...new Set(cardIds.map((id) => "learn-" + id))]
      .filter((qid) => !(qid in state.learnAggs));
    if (!want.length) return;
    // Claimed before the await so a second plan build in the same tick
    // does not re-request the same ids.
    for (const qid of want) state.learnAggs[qid] = null;
    try {
      const db = await getDb();
      const chunks: string[][] = [];
      for (let i = 0; i < want.length; i += 30) chunks.push(want.slice(i, i + 30));
      const snaps = await Promise.all(chunks.map((chunk) =>
        getDocs(query(collection(db, "v2_question_aggs"), where(documentId(), "in", chunk)))));
      let found = 0;
      for (const snap of snaps) {
        for (const d of snap.docs) {
          state.learnAggs[d.id] = d.data() as AggDoc;
          found++;
        }
        state.stats.aggsFetched += snap.size;
      }
      if (found) notify();
    } catch (err) {
      // The null entries stand: the estimate renders, labeled as one.
      reportError(err, { where: "loadLearnAggs" });
    }
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
  // WHY boot's reason is a value and not just a console line. `demoInProd`
  // says a real user is looking at demo content; it does not say why, and
  // on a phone nobody can ask. The reason went to console.warn and to
  // Sentry, and the first device this app ever ran on failed exactly here
  // with neither reachable: an iPhone's console needs a Mac — the one
  // dependency ios-release.yml exists to remove — and the build on that
  // phone predated D76, so telemetry was still opt-in and off.
  //
  // D76 fixes the Sentry half going forward and this is still worth having,
  // because the two fail differently. Sentry needs a DSN configured, a
  // network that works well enough to send, and someone at a dashboard;
  // this needs none of those and answers in one tap. A boot failure whose
  // cause IS the network is precisely the case where the remote path is
  // least likely to arrive.
  //
  // Empty string rather than null while boot is still in flight, so the UI
  // can tell "no reason yet" from "failed for this reason" without a second
  // flag. Not cleared on a late success: `enabled` flipping true is what
  // hides the label, and keeping the text lets a reconnect still show what
  // the first attempt hit.
  get bootError(): string {
    if (state.bootError) return state.bootError;
    // Composed at read time so the label tracks the stage instead of
    // freezing at whatever was true when the render race ended.
    if (state.raceLost) {
      return state.bootStage
        ? `still connecting — ${state.bootStage}`
        : "still connecting";
    }
    return "";
  },
  get ready() {
    return state.ready;
  },
  get uid() {
    return state.uid;
  },
  // True once the anonymous session has been upgraded (D3). Read by the
  // privacy panel and the profile overlay, both of which used to state the
  // opposite unconditionally.
  get linked() {
    return state.linked;
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
        const q = dailyById(qid);
        // `active` is checked HERE, not when the bank is split — see the
        // tombstone note in hydrate(). A retired question drops out of the
        // pager without moving the days around it.
        return q && q.active !== false ? buildS(q, back) : null;
      })
      .filter((s): s is LiveQuestion => !!s);
  },
  myVotes(): Record<string, string> {
    return { ...state.votes };
  },
  /**
   * Crossroads' stories with their folded ending counts (D136), or an empty
   * list in a demo build — which is the signal spec/paths-card.jsx reads to
   * fall back to its own authored pool.
   *
   * Folded ON CALL rather than precomputed into state by buildFeedGlobals,
   * which is where it started. The precomputed version cost ~1 KB of the
   * EAGER graph — this file is in the first-paint chunk — and check:bundle
   * refused it, correctly: MAX_EAGER_KB has no headroom and is the constant
   * keeping the Firestore SDK out of first paint, so it is not raiseable.
   * There is one caller and it renders once per feed render, so the fold is
   * cheaper here than the bytes were there.
   */
  pathQs(): LivePathQ[] {
    return state.feedBank
      .filter((q) => q.surface === "feed" && q.type === "path")
      .map((q) => ({ ...q, counts: feedCounts(q) }));
  },
  /**
   * The live pick card's board (D14 gone live): the published canon — the
   * CANON_TOP_N biggest entities plus everything else summed into `rest` —
   * in exactly the shape the demo store returns (spec/pick-data.js
   * PICKS.canon), so the card switches source on q.live and reshapes
   * nothing. Your own UNFOLDED pick joins at read time, the store's own
   * convention: once the trigger folds it the published doc already counts
   * it, so only `unaggregated` adds here. Entity 0 ("Not listed") joins
   * the total and thereby `rest`, never the board — counted, not
   * enumerated. `restEntities`/`restBelowFloor` are the DEMO fold's two
   * tail scalars: the server publishes neither (post-D98 there is no
   * floor and the tail is simply everything outside the top N), so they
   * read empty here and the card's fold-note copy stays silent.
   */
  pickCanon(qid: string): {
    top: Array<{ entity: number; count: number }>;
    rest: number;
    total: number;
    restEntities: number;
    restBelowFloor: boolean;
  } {
    const agg = state.aggs[qid];
    const counts: Record<string, number> = { ...(agg?.top || {}) };
    let total = agg?.total ?? 0;
    if (qid in state.unaggregated) {
      total += 1;
      const k = String(state.unaggregated[qid]);
      if (k !== "0") counts[k] = (counts[k] || 0) + 1;
    }
    const rows = Object.keys(counts)
      .map((k) => ({ entity: Number(k), count: counts[k] }))
      .sort((a, b) => b.count - a.count || a.entity - b.entity);
    // The board size the fold publishes — the pending join above can push
    // the list to N+1 for the seconds before the trigger folds, and the
    // card's spots copy assumes the cap. CANON_BOARD_N is the pinned twin
    // of the server's CANON_TOP_N (deck.ts has the why).
    const top = rows.slice(0, CANON_BOARD_N);
    const shown = top.reduce((a, r) => a + r.count, 0);
    return { top, rest: total - shown, total, restEntities: 0, restBelowFloor: false };
  },
  /**
   * The segment chips a live pick card offers — flattened from the
   * published `by` (D17), in the doc's own order. PICKS.segs' shape.
   */
  pickSegs(qid: string): Array<{ dim: string; bucket: string }> {
    const by = state.aggs[qid]?.by;
    if (!by) return [];
    const out: Array<{ dim: string; bucket: string }> = [];
    for (const dim of Object.keys(by)) {
      for (const bucket of Object.keys(by[dim] || {})) out.push({ dim, bucket });
    }
    return out;
  },
  /**
   * One segment's ordering of the global board (D17): rows are the
   * published cell — already cut to the board's own entities server-side —
   * and `cohort` is the SHOWN total, the deliberately conservative "as N
   * of them see it" number D17 records. Null when the question holds no
   * slice for that segment. PICKS.canonSeg's contract.
   */
  pickSeg(
    qid: string,
    dim: string,
    bucket: string,
  ): { rows: Array<{ entity: number; count: number }>; cohort: number } | null {
    const cell = state.aggs[qid]?.by?.[dim]?.[bucket];
    if (!cell) return null;
    const rows = Object.keys(cell)
      .map((k) => ({ entity: Number(k), count: cell[k] }))
      .sort((a, b) => b.count - a.count || a.entity - b.entity);
    return { rows, cohort: rows.reduce((a, r) => a + r.count, 0) };
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
  // ── feed ads (D197) ─────────────────────────────────────────────
  //
  // NOT sponsored questions. An ad takes no answer and folds into no
  // aggregate, so it has its own collection and its own accessor — and
  // nothing that reads the question bank has to learn to skip it.
  feedAds(): FeedAd[] | null {
    return state.ads;
  },
  /**
   * One bounded read per session, on the tap that opens the feed.
   *
   * The whole pool, unfiltered by anything the server could learn from:
   * every device downloads every live ad and decides locally which one it
   * matches (data/sponsored.ts). Asking the server for "my" ads is the
   * moment a behavioural profile exists, whatever the intentions.
   *
   * A query returning nothing still costs one read, and today it always
   * returns nothing — the pool is deliberately empty. One read per
   * session for an empty collection is the price of the path existing.
   */
  loadAds(): Promise<void> {
    if (!LIVE.enabled || state.ads) return Promise.resolve();
    if (adsInflight) return adsInflight;
    adsInflight = (async () => {
      try {
        const db = await getDb();
        const snap = await getDocs(query(collection(db, "v2_ads"), limit(AD_POOL_CAP)));
        state.ads = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FeedAd, "id">) }));
        notify();
      } catch (err) {
        // Left null: the feed draws no ad rather than an empty pool it
        // would then stop trying to fill.
        reportError(err, { where: "loadAds" });
      } finally {
        adsInflight = null;
      }
    })();
    return adsInflight;
  },

  // ── Foresight CALL, tier A (D194) ───────────────────────────────
  //
  // The calls in the bank, with their published counts — how the crowd
  // itself called each one, which is an ordinary aggregate over ordinary
  // answers. The GRADE is a second document and is not fetched here; see
  // loadCallOutcomes below, which the card asks for when it opens.
  callQs(): Array<QuestionDoc & { id: string; counts: number[] }> {
    return state.callBank.map((q) => ({ ...q, counts: feedCounts(q) }));
  },
  /**
   * The published grades, or null while nothing has been read.
   *
   * The distinction the card depends on: `null` here means "not fetched",
   * an ENTRY of null means "fetched, the resolver has not graded it" —
   * which is a sealed call, and a real thing to draw. Collapsing the two
   * would make every call look sealed for a frame after boot, including
   * the ones already graded.
   */
  callOutcomes(): Record<string, CallOutcome | null> | null {
    return state.callOutcomes;
  },
  /**
   * One bounded fetch per session for every call's grade.
   *
   * D124/D129 discipline: poll, never stream, and only on the tap that
   * asks. The bank's calls are a handful, so this is one `documentId() in`
   * query — the same shape data/pulse.ts uses for its per-day docs, capped
   * at Firestore's 30-clause limit. An absent document is stored as null
   * rather than skipped, so a second open does not refetch what it already
   * knows is ungraded.
   *
   * `force` exists for one caller: the card after a vote, which wants to
   * know whether the grade landed while it was open. Everything else takes
   * the cache.
   */
  loadCallOutcomes(force = false): Promise<void> {
    if (!LIVE.enabled || !state.callBank.length) return Promise.resolve();
    if (state.callOutcomes && !force) return Promise.resolve();
    if (callOutcomesInflight) return callOutcomesInflight;
    callOutcomesInflight = (async () => {
      try {
        const db = await getDb();
        const ids = state.callBank.slice(0, 30).map((q) => q.id);
        const snap = await getDocs(
          query(collection(db, "v2_call_outcomes"), where(documentId(), "in", ids)),
        );
        const got = new Map(snap.docs.map((d) => [d.id, d.data() as CallOutcome]));
        const next: Record<string, CallOutcome | null> = {};
        for (const id of ids) next[id] = got.get(id) ?? null;
        state.callOutcomes = next;
        state.stats.callOutcomesFetched = snap.size;
        notify();
      } catch (err) {
        // A failed read leaves state.callOutcomes as it was — the card
        // draws "not read yet" rather than inventing a sealed state for a
        // call that may well be graded.
        reportError(err, { where: "loadCallOutcomes" });
      } finally {
        callOutcomesInflight = null;
      }
    })();
    return callOutcomesInflight;
  },

  // ── the daily pulse (D139) ──────────────────────────────────────
  // One answer per day, id {baseQid}_{day} — the duel answers' shape on
  // a world-public surface. Create-only mirrors the rules: no re-pick
  // today, and the doc id is the discipline.
  votePulse(baseQid: string, optionIdx: number): Promise<void> {
    const uid = state.uid;
    if (!uid || !Number.isInteger(optionIdx) || optionIdx < 0) return Promise.resolve();
    const day = utcDayKey(0);
    const aid = `${baseQid}_${day}`;
    if (state.votes[aid]) return Promise.resolve();
    state.votes[aid] = String(optionIdx);
    notify();
    return (async () => {
      try {
        const db = await getDb();
        await setDoc(doc(db, "v2_users", uid, "answers", aid), {
          qid: aid,
          baseQid,
          day,
          surface: "pulse",
          optionIdx,
          answeredAt: serverTimestamp(),
          anchors: answerAnchors(),
        });
        cacheVote(aid, optionIdx);
      } catch (err) {
        delete state.votes[aid];
        notify();
        reportError(err, { where: "votePulse", qid: aid });
      }
    })();
  },
  /** Every pulse day this device knows it answered: day → optionIdx.
   * Derived from the hydrated vote mirror, so a second device's answers
   * arrive with ordinary hydration and no extra read. */
  pulseVotes(baseQid: string): Record<string, number> {
    const out: Record<string, number> = {};
    const prefix = `${baseQid}_`;
    for (const [aid, v] of Object.entries(state.votes)) {
      if (aid.startsWith(prefix)) out[aid.slice(prefix.length)] = Number(v);
    }
    return out;
  },
  /**
   * The live pulse roster, in bank order — id, prompt and the five steps.
   *
   * This is the whole of what `data/pulse` needs to render, and it is
   * already on the device: `hydrate()` downloads the entire question bank
   * and `splitBanks` now keeps a pulse lane out of it. Before D203 the
   * pulse paid its own `getDoc` for a document it had already cached, five
   * times over once the roster shipped — and read only `prompt`/`options`
   * from it, so a pulse flipped to `active: false` still drew a tappable
   * card whose every write the rules refused. Reading the bank fixes both:
   * `active` is filtered upstream, so an inactive pulse is simply not in
   * this list.
   */
  pulseQs(): Array<{ id: string; prompt: string; options: string[] }> {
    return state.pulseBank.map((q) => ({
      id: q.id,
      prompt: String(q.prompt ?? ""),
      options: Array.isArray(q.options) ? q.options.map(String) : [],
    }));
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
          dailyById(qid) ||
          feedById(qid) ||
          // A call is voted through this same path (its answer doc has the
          // world shape), so it has to be findable here or the write would
          // claim `surface: "daily"` and rules would refuse it.
          state.callBank.find((x) => x.id === qid);
        await setDoc(doc(db, "v2_users", uid, "answers", qid), {
          qid,
          surface: q?.surface ?? "daily",
          optionIdx,
          answeredAt: serverTimestamp(),
          // `q.rates` is why this is the one anchor site that passes an
          // argument (D205): a question that scores a city must not take a
          // city cell from someone the device has never placed there.
          anchors: answerAnchors(q?.rates),
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
        // Counted on the ACK, not the tap: a refused create rolls the
        // optimistic state back below, and the tally should agree with
        // the server about what was answered (R2/D270).
        engagement.noteAnswer(q?.surface ?? "daily");
        // …and the per-question map (R4/D271), for the feed-rendered
        // surfaces only: the seen denominator comes from feed cards, so
        // the answered numerator matches its population. The daily is
        // not a feed card, duels never ride this path, and a pulse
        // answers through votePulse — none of them belongs here.
        {
          const s = q?.surface ?? "daily";
          if (s === "feed" || s === "test" || s === "learn" || s === "call") {
            engagement.noteQid(qid, "a");
          }
        }
        // A test answer can move an axis, and an axis can cross
        // MIN_AXIS_ITEMS (D277). On the ACK rather than the tap, like the
        // two counters above: a refused create must not publish a result
        // built on an answer the server rejected.
        if (q?.surface === "test") LIVE.syncPassiveResults();
        notify(); // confirmedVotes() changed — let persistent records (the Map) pick it up
        scheduleAggRefresh(db, qid);
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
  /**
   * One favourite from a shipped catalogue (D14): `entity` is the
   * catalogue key — never a string, never an option index — and the doc
   * carries it in optionIdx's place, which is what routes it down the
   * trigger's canon fold. vote()'s shape otherwise: create-only (no edit
   * path exists for picks, and the rules' edit arm cannot admit one),
   * optimistic with rollback, cached on server ack only. The outer bound
   * mirrors the rules' sanity ceiling; the real validation is the
   * trigger's, against the committed catalogue the question's domain
   * names — an unknown key never aggregates.
   */
  votePick(qid: string, entity: number): void {
    if (state.votes[qid]) return; // one answer per question, mirroring rules
    if (!Number.isInteger(entity) || entity < 0 || entity >= 1_000_000_000) return;
    state.votes[qid] = String(entity);
    state.inflight[qid] = true;
    state.unaggregated[qid] = entity;
    notify();
    void (async () => {
      try {
        const db = await getDb();
        const uid = state.uid;
        if (!uid) throw new Error("no session");
        const q = feedById(qid);
        await setDoc(doc(db, "v2_users", uid, "answers", qid), {
          qid,
          surface: q?.surface ?? "feed",
          entity,
          answeredAt: serverTimestamp(),
          anchors: answerAnchors(q?.rates),
        });
        // Server ack only — the same answers-cache doctrine as vote():
        // caching optimistically would let a refused write resurrect a
        // phantom pick on every future boot.
        delete state.inflight[qid];
        cacheVote(qid, entity);
        notify();
        scheduleAggRefresh(db, qid);
      } catch (err) {
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
        reportError(err, { where: "votePick", qid });
      }
    })();
  },
  /**
   * A ranking (D233): `order` is the item indexes in the answerer's
   * sequence — an ORDER, never an index — and the doc carries it in
   * optionIdx's place, which routes it down the trigger's position-sum
   * fold. vote()'s shape otherwise: create-only (no edit path exists,
   * and the rules' edit arm cannot admit one), optimistic with rollback,
   * cached on server ack only. The bounds here mirror what rules can
   * check (length against the bank doc's own item count) plus what only
   * the trigger re-checks (a clean permutation) — a doomed write spared
   * client-side is the same mirror editVote keeps.
   */
  voteRank(qid: string, order: number[]): void {
    if (state.votes[qid]) return; // one answer per question, mirroring rules
    const q = feedById(qid);
    if (q?.type !== "rank") return;
    const n = q.options.length;
    if (!Array.isArray(order) || order.length !== n || n < 2) return;
    if (order.some((v) => !Number.isInteger(v) || v < 0 || v >= n)) return;
    if (new Set(order).size !== n) return;
    state.votes[qid] = order.join(",");
    state.inflight[qid] = true;
    // The value is unread for ranks (nothing subtracts an order from a
    // counts array) — the KEY is the pending flag rankCrowdFor and the
    // agg refresh both key on, same lifecycle as every other vote.
    state.unaggregated[qid] = 0;
    notify();
    void (async () => {
      try {
        const db = await getDb();
        const uid = state.uid;
        if (!uid) throw new Error("no session");
        await setDoc(doc(db, "v2_users", uid, "answers", qid), {
          qid,
          surface: q.surface,
          order,
          answeredAt: serverTimestamp(),
          anchors: answerAnchors(q.rates),
        });
        delete state.inflight[qid];
        cacheVote(qid, order.join(","));
        notify();
        scheduleAggRefresh(db, qid);
      } catch (err) {
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
        reportError(err, { where: "voteRank", qid });
      }
    })();
  },
  // D86: move an EXISTING answer to a different option — the one
  // repeatable answer write (vote() above is create-only and no-ops on an
  // answered question, mirroring the rules). Daily, feed and test cards
  // only; learn, duels and catalog picks are refused server-side and never
  // offered this affordance.
  //
  // Returns synchronously whether anything was sent, so a caller can keep
  // its result view instead of flipping to a vote that will bounce: false
  // means no prior vote, same option, an unacked write in flight, or
  // inside the 60s per-answer cooldown the rules enforce (the client
  // mirror spares a doomed write; the rules arm is the enforcement).
  editVote(qid: string, optionId: string): boolean {
    const prev = state.votes[qid];
    if (!prev || prev === optionId) return false;
    if (qid in state.inflight) return false;
    // Catalog picks and rank answers are create-only (D14/D233): the
    // rules' edit arm keys on the OLD doc carrying optionIdx, which an
    // entity or order answer never does, so the write below is doomed for
    // both. Neither card offers an edit affordance — this mirror spares
    // the round-trip if a future surface calls in anyway.
    const editType = feedById(qid)?.type;
    if (editType === "catalog" || editType === "rank") return false;
    const optionIdx = Number(optionId);
    if (!Number.isInteger(optionIdx) || optionIdx < 0) return false;
    if (Date.now() - (state.editedAt[qid] || 0) < 60_000) return false;
    state.votes[qid] = optionId;
    state.inflight[qid] = true;
    // The new option is not in the public agg yet — same display flag as a
    // create. The old option briefly reads one high (my old vote is still
    // in the counts, no longer marked mine); the delayed refresh below
    // pulls the moved counts and settles it.
    state.unaggregated[qid] = optionIdx;
    notify();
    void (async () => {
      try {
        const db = await getDb();
        const uid = state.uid;
        if (!uid) throw new Error("no session");
        await updateDoc(doc(db, "v2_users", uid, "answers", qid), {
          optionIdx,
          // request.time, per the rules arm — the edit's own audit stamp,
          // leaving answeredAt (and the anchors snapshot) frozen.
          editedAt: serverTimestamp(),
        });
        delete state.inflight[qid];
        state.editedAt[qid] = Date.now();
        cacheVote(qid, optionIdx); // keep the answers-cache mirror true to the doc
        engagement.note("edits"); // acked, same rule as the create's count
        notify();
        scheduleAggRefresh(db, qid);
      } catch (err) {
        // Refused (rules cooldown raced another device, network): restore
        // the previous option everywhere the optimistic flip reached. The
        // answers cache was never touched — it still mirrors the doc.
        state.votes[qid] = prev;
        delete state.inflight[qid];
        delete state.unaggregated[qid];
        try {
          const WF_LS = "insight.feedVotes.v1";
          const wf = JSON.parse(localStorage.getItem(WF_LS) || "{}") || {};
          if (qid in wf) {
            // Through mirrorVoteValue, not Number(prev) directly: a dial's
            // mirror entry is a VALUE, and restoring the bucket index here
            // was D218's rarest door in. The raw drag the mirror held is
            // gone (only the feed ever knew it) — the standing bucket's
            // midpoint is the closest the doc can testify to.
            const q = feedById(qid);
            const mv = q ? mirrorVoteValue(q, prev) : null;
            wf[qid] = mv != null ? mv : Number(prev);
            localStorage.setItem(WF_LS, JSON.stringify(wf));
          }
        } catch {
          /* best-effort */
        }
        notify();
        reportError(err, { where: "editVote", qid });
      }
    })();
    return true;
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
  // A detach armed under the OLD uid must not fire against the new one's
  // listeners: it would drop them with nothing to re-attach until the next
  // wake, which reads on screen as a deck that stopped updating.
  cancelIdleDetach();
  try {
    state.groupsUnsub?.();
    stopAggPoll();
    Object.values(state.revealUnsubs).forEach((u) => { try { u(); } catch { /* best-effort */ } });
  } catch {
    /* best-effort */
  }
  state.groupsUnsub = null;
  state.revealUnsubs = {};
  state.votes = {};
  state.inflight = {};
  state.unaggregated = {};
  state.editedAt = {};
  state.aggs = {};
  aggSeen.clear();
  state.groups = [];
  state.reveals = {};
  state.revealHist = {};
  state.revealHistLoading = {};
  // Circle takes are member-gated, so a cached list is the previous
  // account's circle — which the new one may not even be in. And a
  // surviving myFlags marks takes "Reported" that this account never
  // reported, against a collection nothing can re-read to correct it
  // (flags are `allow read: if false` by design).
  state.takes = {};
  state.takesLoading = {};
  state.myFlags = {};
  // The voter lists carry an `isMe` flag computed against the OLD uid, so
  // a survivor would mark a stranger's answer as this account's own. The
  // name cache is dropped with them: it is other people's display names,
  // held only to save reads, and nothing about it should outlive the
  // session that fetched it.
  state.voters = {};
  state.votersLoading = {};
  state.names = {};
  // Scores ride the name cache (D112) and carry the same reasoning: other
  // people's data, held to save reads. The logic percentiles (D227) are
  // the same rider one field over.
  state.scores = {};
  state.logicPcts = {};
  state.faces = {};
  // Both are about WHO ANSWERED, so both belong to the outgoing account:
  // a surviving `learnSent` would suppress the new account's first-attempt
  // sends for every card the old one answered, and a surviving `learnMine`
  // would add the old account's pick to the new one's reveal. The
  // aggregate cache beside them is public and stays — it is the same
  // crowd whoever is signed in.
  state.learnSent = {};
  state.learnMine = {};
  // The disk copy is swept by purgeLocalTrace below (it removes every
  // `insight.*` key), but the age map is module state that no sweep
  // reaches — and a survivor would hand the NEXT account's entries the
  // previous one's timestamps, so they would expire early or late by an
  // arbitrary amount. Cancel the queued write for the same reason
  // cancelAggCache is called: it would re-create the key just removed.
  profileSeen.clear();
  if (profileCacheTimer) {
    clearTimeout(profileCacheTimer);
    profileCacheTimer = null;
  }
  state.kindredLoading = false;
  state.kindredAt = 0;
  state.cityVoters = {};
  state.cityVotersAt = "";
  state.cityKindredLoading = false;
  state.similarityLoading = false;
  // state.aggs was dropped above, so the test-item top-up has to run
  // again for the new account.
  state.testAggsLoaded = false;
  state.circle = null;
  state.circleLoading = false;
  // The follow cache is the same graph one view over, and it is dropped
  // for the same reason `setFollowing` drops it before a refetch: a stale
  // list is answered "yes, a friend" about strangers. It needs saying
  // separately because `loadFollows` early-returns on a non-null cache
  // (`if (state.follows) return`), so unlike most of the state above this
  // one would not be corrected by the next load — it would stand for the
  // whole session, putting the previous account's friends on the Friends
  // cut of every who-voted sheet.
  state.follows = null;
  state.followsLoading = false;
  // A verdict is about the PREVIOUS account's reads, and the log is
  // keyed by slice rather than by uid, so leaving it would credit the
  // new account with someone else's record.
  state.foresight = null;
  state.foresightLoading = false;
  // The inbox is per-account by definition — leaving it would show the
  // previous account's invitations under the new one, which is the same
  // class of leak resetForNewUid exists for.
  state.invites = [];
  state.invitesLoading = false;
  state.profile = { displayName: "", handle: "", testResults: {}, anchors: {} };
  state.deckIds = [];
  state.deckDay = -1;
  state.ready = false;
  state.sessionLost = false;
  state.uid = uid;
  purgeLocalTrace();
  // AFTER purgeLocalTrace: it reads the on-disk copy, which the purge has
  // just removed, so this publishes the empty state rather than re-seeding
  // the old account's saves.
  publishTestResults();
  // Both flags are per-uid on the callee side (deviceBind.ts, push.ts) but
  // were module-scoped here, so an in-process uid change left the new
  // account's push token unwritten until the next cold boot — no reveal
  // pushes in between.
  pushRegisteredFor = null;
  deviceBindAttemptedFor = null;
  // The presence loop is the old account's opt-in (D84); the flag store's
  // purge listener clears the choice, this clears the machinery.
  stopPresence();
  // The DOCUMENT is deliberately not deleted here, and that is a limit
  // rather than an oversight — worth writing down, because the obvious
  // fix is the one that does not work.
  //
  // The cell really does outlive the switch: it keeps the outgoing account
  // in its ~200 m grid square for up to PRESENCE_LINGER_MS, counted by
  // nearbyCountV2 and listed with its archetype by nearbyRoomV2. So
  // `deleteDoc(v2_presence/{prevUid})` from here reads like the same move
  // NEAR.disable() makes under "stop sharing must not wait for a freshness
  // window to expire".
  //
  // It cannot be. This function runs from the subscribeToAuth callback,
  // which fires AFTER the SDK has switched currentUser to the incoming
  // account — so the write is signed by the new uid, and
  // /v2_presence/{uid} is `allow delete: if request.auth.uid == uid`. The
  // rules refuse it. Measured on the emulator: the outgoing account
  // deleting its own cell succeeds, the incoming account deleting the
  // outgoing one's is denied. Issuing it anyway buys nothing and costs a
  // permission-denied report on every switch.
  //
  // Nor is there a moment to do it earlier: every path that changes the
  // uid in-process (a lost anonymous session, a Google link that resolves
  // to an existing account) has already lost the outgoing credentials by
  // the time anything here observes the change. A real fix is server-side.
  // What bounds the exposure meanwhile is `until`, capped at
  // PRESENCE_LINGER_MIN in the rules and honoured by nearbyCountV2 — and
  // account DELETION, the case that matters most, is swept by
  // deleteAccount rather than left to this path at all.
  setSentryUser(uid);
  notify();
  void refreshLive().catch((err) => reportError(err, { where: "refreshLive.uidChange" }));
}

// The viewer's test results, rebuilt from the store plus this device's
// saves and announced to spec/test-definitions.js, which owns the copy the
// UI renders.
//
// A FUNCTION, called from both hydrate() and resetForNewUid(), because the
// two drifted: reset nulled `state.profile`, purged the on-disk copy and
// called notify() — re-rendering with the PREVIOUS account's Big Five,
// attachment and politics scores still on screen. Around twenty spec
// modules read those results at render time (profile-general.jsx,
// profile-test-viz.jsx, compare-breakdown.jsx, …), so the wrong person's
// results were up until the new uid's hydrate reached this line — and two
// paths mean it might not: the unguarded getDocs in hydrate can reject
// outright, and refreshInFlight can hand back the OLD run's promise so
// hydrate never re-executes.
//
// resetForNewUid's own header states the contract this broke: "Everything
// derived from the old uid has to go — in-memory AND on disk."
//
// AN EVENT, not `window.IS_TEST_RESULTS = …`, because that assignment had
// stopped reaching anybody. test-definitions.js was converted off the
// shared-global bridge (D39, #85) and now EXPORTS `IS_TEST_RESULTS`; all
// fifteen consumers import that binding. Rebinding the global therefore
// wrote a name with no readers, and every effect above was silently
// undone: the demo persona's baked results stayed on screen for a fresh
// live account, and a result earned on another device never arrived.
// Announcing it is the same shape as the purge (D51) — the module that
// owns the object mutates it IN PLACE, so the consumers holding a
// reference to it see the change.
//
// The payload REPLACES rather than merges, which is the half that removes
// the demo seed: a key absent from the store and from disk means the user
// has not taken that test, and the honest render of that is nothing.
function publishTestResults(): void {
  let next: Record<string, unknown>;
  try {
    const local = JSON.parse(localStorage.getItem("insight.testResults.v2") || "{}") || {};
    next = { ...state.profile.testResults, ...local };
  } catch {
    next = { ...state.profile.testResults };
  }
  try {
    window.dispatchEvent(new CustomEvent("insight:test-results", { detail: next }));
  } catch {
    /* non-browser env */
  }
}

// Remove every `insight.*` key. Used by deleteAccount and by the
// uid-change path — NOT a hand-listed subset: there are ~29 such keys
// (feed votes, daily answers, test results and progress, replies, takes,
// likes, friends, duels, scenes, suggestions, caches…) and none is
// uid-keyed, so any one left behind shows the previous account's data
// under the new one. Enumerating by prefix is the only version that stays
// correct when a new key is added.
function purgeLocalTrace(): void {
  // A queued agg-cache write would otherwise land after the sweep below and
  // re-create the key it just removed. See cancelAggCache for why that is
  // tidiness rather than a leak — the map it would write is already empty.
  cancelAggCache();
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
// startAggPoll refreshes the whole deck and re-arms the timer on the new
// day's question, so a rollover needs no separate teardown.
async function resubscribeForToday(): Promise<void> {
  if (torndown || !state.ready) return;
  try {
    if (state.questions.length && state.deckDay !== dayIndex()) {
      computeDeck();
      notify();
    }
    await startAggPoll();
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
// Which uid these one-shots have run for, not WHETHER they have run. Both
// callees are explicitly per-uid (deviceBind.ts memoizes per uid, push.ts
// writes the token onto that uid's profile), but these were process-scoped
// booleans that resetForNewUid did not clear — so after an in-process uid
// change the new account's token was never written to its own document and
// it received no reveal pushes until the next cold boot.
let pushRegisteredFor: string | null = null;

/**
 * Ask for notification permission, at a moment that has earned it.
 *
 * Called after joining or creating a circle or a 1v1 — the acts that make a
 * reveal possible, and therefore the first moments at which "your reveal is
 * out" means anything. Boot deliberately does not call this (see initLive);
 * push.ts has the iOS reasoning, which is that the decline is permanent.
 *
 * Fire-and-forget and idempotent: `registerPush` memoizes the
 * token write per (uid, token), and the OS shows one prompt per install
 * however many times it is asked. `pushRegisteredFor` is NOT consulted here
 * — boot sets it after a silent registration, and this call is the one that
 * may actually prompt, so gating on it would mean the prompt never happens.
 */
function pushEarned(): void {
  const forUid = state.uid;
  if (!forUid) return;
  void import("./push")
    .then((m) => m.registerPush(forUid, { ask: true }))
    .catch(() => { /* native bridge absent, or the user said no */ });
}
let deviceBindAttemptedFor: string | null = null;

export function refreshLive(): Promise<void> {
  if (torndown) return Promise.resolve();
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    // WHICH STEP, not merely that one is outstanding. The first field
    // report said "still connecting after 3s" and that was the whole
    // signal: nothing had thrown, so boot was HANGING rather than failing,
    // and three awaits in a row are three different bugs. Firebase's own
    // calls have no deadline worth relying on — signInAnonymously against
    // a stalled connection and a Firestore getDoc under
    // persistentLocalCache can both sit indefinitely rather than reject —
    // so a hang here is the expected shape of a network fault, not an
    // exotic one. Each stage is published before it is awaited.
    state.bootStage = "signing in";
    notify();
    state.uid = await anonSignIn();
    // uid-only (never email/name) — matches sentry.ts's PII stance.
    setSentryUser(state.uid);
    state.bootStage = "loading questions";
    notify();
    await hydrate();
    state.bootStage = "loading groups";
    notify();
    await hydrateSocial();
    state.bootStage = "";
    state.ready = true;
    // fire-and-forget: reveal notifications on real devices (no-op on web).
    // Once per UID — re-registering on every reconnect would churn the
    // token array for no gain, but a new account needs its own.
    //
    // NO PROMPT HERE (`ask` defaults false). Boot only re-registers a device
    // that has already granted permission; asking is deferred to the moments
    // that make a reveal possible — see pushEarned() below and push.ts for
    // why a boot-time prompt was costing the feature outright on iOS.
    if (pushRegisteredFor !== state.uid) {
      const forUid = state.uid as string;
      pushRegisteredFor = forUid;
      void import("./push")
        .then((m) => m.registerPush(forUid))
        .catch(() => { if (pushRegisteredFor === forUid) pushRegisteredFor = null; });
    }
    // The directory row for an account that already had a name (D239),
    // fire-and-forget and once per (uid, name) per device.
    //
    // THE BACKFILL, and it is why this is here rather than left to
    // `saveDisplayName`. Every account that existed before the directory
    // did has a display name and no row, so without this they are
    // findable by handle and invisible by name until they happen to
    // rename themselves — which most people never do. The localStorage
    // memo is what keeps it from being a write on every boot: the value
    // is the name, so it re-writes exactly when the name changed on
    // another device and not otherwise.
    void (async () => {
      const forUid = state.uid;
      const name = (state.profile.displayName || "").trim();
      if (!forUid || !name) return;
      const KEY = "insight.directoryRow.v1";
      try {
        const seen = JSON.parse(localStorage.getItem(KEY) || "null");
        if (seen && seen.uid === forUid && seen.name === name) return;
      } catch { /* unreadable cache — write and move on */ }
      try {
        const [db, mod] = await Promise.all([getDb(), import("./socialFetch")]);
        await mod.writeDirectoryRow(db, forUid, name);
        localStorage.setItem(KEY, JSON.stringify({ uid: forUid, name }));
      } catch (err) {
        reportError(err, { where: "directoryHeal" });
      }
    })();
    // fire-and-forget, same shape: the D29 device-binding activation.
    // Once per uid; ensureDeviceBound() itself memoizes per uid in
    // localStorage, handles the missing native bridge, and never surfaces
    // UI — see src/v2/data/deviceBind.ts.
    if (deviceBindAttemptedFor !== state.uid) {
      const forUid = state.uid as string;
      deviceBindAttemptedFor = forUid;
      void import("./deviceBind")
        .then((m) => m.ensureDeviceBound(forUid))
        .catch(() => { if (deviceBindAttemptedFor === forUid) deviceBindAttemptedFor = null; });
    }
    LIVE.enabled = true;
    // Resume the presence loop for an already-opted-in account (D84) —
    // the opt-in is a standing choice, the loop is per-session machinery.
    if (nearOptedIn()) startPresence();
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
  cancelIdleDetach();
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  if (!state.ready) {
    void refreshLive().catch((err) => reportError(err, { where: "refreshLive.wake" }));
    return;
  }
  // Attaches listeners for the new day's deck if the date rolled over
  // while the app was backgrounded — and, since the idle detach below,
  // re-attaches whatever that dropped. Still a no-op for a session that
  // never went idle.
  void resubscribeForToday();
}

// ── the idle detach (COSTS.md, the listener fan-out) ─────────────
//
// Backgrounding used to leave every snapshot listener attached. Nothing in
// this file tore one down outside `resetForNewUid` and account deletion, so
// a Capacitor WebView the OS keeps resident went on receiving — and being
// billed for — every publish to today's aggregate for as long as it lived.
//
// That is not a small correction to the bill, because it is the input the
// whole fan-out term is linear in. The cost model calls the input
// `onlineMin` and glosses it "minutes with the app actually open"
// (scripts/cost-arith.mjs), which is the number a person would estimate at
// 3. What the fan-out actually charges for is minutes with a LISTENER
// ATTACHED, and until this block those two were only equal by luck. At
// `onlineMin` 60 the modelled bill at 50 k DAU goes from $1,224/mo to
// $16,689, and the crossover where the fan-out overtakes every flat read
// source moves from ~30,800 DAU to ~1,540 — under D7's write-contention
// wall at 14,400, inverting the ordering COSTS.md names as the property
// worth keeping (break technically before the invoice surprises anyone).
//
// WHY A GRACE PERIOD AND NOT AN IMMEDIATE DETACH. Re-attaching is not
// free: an `onSnapshot` attach delivers the document once, so coming back
// costs a read per listener. `wake()` above is written around the ten-
// second app swap, and detaching on every hide would charge that swap 7
// fresh deck reads to save a few seconds of fan-out. The break-even is the
// ratio of the two: re-attach is ~7 reads flat, while staying attached
// costs the publish rate on the shared daily, which is ~21 reads/minute at
// 5,000 DAU and ~2 at 500. So a minute is comfortably the right order —
// it makes the common swap free at every size, and it converts an
// unbounded tail into a bounded 60 seconds.
const IDLE_DETACH_MS = 60_000;
let idleDetachTimer: ReturnType<typeof setTimeout> | null = null;

function cancelIdleDetach(): void {
  if (idleDetachTimer) {
    clearTimeout(idleDetachTimer);
    idleDetachTimer = null;
  }
}

// Exactly the set `resubscribeForToday()` restores, which since D129 is the
// reveal listeners alone — the deck aggregates are polled, and the poll is
// stopped on hide by the visibility handler rather than waiting out the
// grace period. `groupsUnsub` is deliberately NOT dropped: nothing
// re-attaches it short of a full `refreshLive()`, and it is one listener on
// a membership query that publishes when a group changes, not on the hot
// shared daily.
//
// The grace period still earns its keep for reveals, for the reason it
// always did: re-attaching an `onSnapshot` re-delivers the document, so
// dropping them on the ten-second app swap `wake()` is written around would
// cost more than it saves. The poll needs no such care — re-arming a timer
// reads nothing until it fires — which is why the two are handled
// differently here rather than uniformly.
function detachIdleListeners(): void {
  Object.values(state.revealUnsubs).forEach((u) => { try { u(); } catch { /* best-effort */ } });
  state.revealUnsubs = {};
}

// Exported for the test, for the same reason `_idleDetachForTest` is: a
// timer that is still armed looks identical to one that is not until
// something asks. `tick()` runs exactly what the interval body runs, so a
// test drives the real refresh path rather than a re-implementation of it.
export function _aggPollForTest(): { running: boolean; tick: () => Promise<void> } {
  return {
    running: aggPollTimer !== null,
    tick: () => refreshAggs(state.deckIds.slice(0, 1)),
  };
}

// Exported for the test, for the same reason `_aggPollForTest` is: the
// whole claim of the post-vote coalescing is that a burst arms ONE timer
// and drains ONE set, and an armed timer looks identical to an unarmed one
// until something asks. `drain()` runs exactly what the timer body runs.
export function _aggRefreshForTest(): {
  armed: boolean;
  pending: string[];
  drain: (db: Parameters<typeof drainAggRefresh>[0]) => Promise<void>;
} {
  return {
    armed: aggRefreshTimer !== null,
    pending: [...pendingAggRefresh],
    drain: (db) => drainAggRefresh(db),
  };
}

// Exported for the test, which is the only way to prove this: a listener
// that is still attached looks identical to one that is not until
// something counts them.
// Exported for the test, for the same reason `_aggPollForTest` is: the
// cap and the on-disk format are the whole of D291's fix, and neither is
// reachable from the public surface. `_seedAggsForTest` dates its entries
// oldest-first so a case can assert WHICH survive rather than only how
// many.
export { AGG_CACHE_CAP };
export function _seedAggsForTest(n: number): void {
  const base = Date.now() - n;
  for (let i = 0; i < n; i++) {
    const qid = `seed_${i}`;
    state.aggs[qid] = { counts: { "0": 1 }, total: 1 } as AggDoc;
    aggSeen.set(qid, base + i);
  }
}
export function _readAggCacheForTest(raw: string): Record<string, AggDoc> {
  return parseAggCache(raw).entries;
}

export function _idleDetachForTest(): { pending: boolean; run: () => void } {
  return {
    pending: idleDetachTimer !== null,
    run: () => { cancelIdleDetach(); detachIdleListeners(); },
  };
}

export async function initLive(timeoutMs = 2500): Promise<void> {
  const flag = import.meta.env.VITE_V2_LIVE === "true";
  if (!flag || !firebaseEnabled) return;
  const boot = refreshLive();

  // R2/D270: arm the anonymous feature tally. The writer is the ordinary
  // SDK path — offline queue included, so a shard written on a dead train
  // arrives when the phone wakes — and the shard carries no uid: the
  // session matters only for the signed-in create the rules demand.
  // Armed HERE and nowhere else, which is the tally's whole inertness
  // story: jsdom mounts and the demo build never run initLive.
  engagement.arm({
    write: async (shard) => {
      const db = await getDb();
      await setDoc(doc(db, "v2_attention", crypto.randomUUID()), shard);
    },
    // R3/D272: the person rollup rides the same queue but under the
    // session's own uid — throwing on a missing session is the contract
    // (engagement retains the tally and retries next boot), not an error.
    writeRollup: async (rollup) => {
      const db = await getDb();
      const uid = state.uid;
      if (!uid) throw new Error("no session");
      await setDoc(doc(db, "v2_users", uid, "engagement", rollup.day), rollup);
    },
    hasUid: () => !!state.uid,
    build: typeof __APP_BUILD__ === "number" ? __APP_BUILD__ : 0,
  });
  // A slow first paint is a boredom input like any other. Measured from
  // the arm rather than inside hydrate(): same tick as the boot's start,
  // and it keeps the timing out of the code path it times.
  const armT0 = Date.now();
  void boot.then(
    () => { if (Date.now() - armT0 > 4000) engagement.note("slowBoots"); },
    // A failed boot is the error path's fact, not a slow-boot one — and a
    // bare .finally here would mint a second, unhandled rejection chain
    // off a promise the caller below already races and handles.
    () => { /* counted nowhere */ },
  );

  // Observe auth for the rest of the session. state.uid used to be sampled
  // once and never watched, so if the session changed underneath us — a
  // revoked token, an account deleted on another device, or linkGoogle
  // falling back to a full sign-in when there was no currentUser — the
  // store kept the PREVIOUS account's votes in memory and rendered them as
  // the new account's. On a shared uid-agnostic localStorage, that is one
  // person's answers displayed to another.
  subscribeToAuth((user) => {
    if (torndown) return;
    // Whether this session is an upgraded account or still the anonymous one
    // (D3). Derived here because it is the only place the app sees the auth
    // user; LivePrivacyPanel used to keep it as local state seeded to false,
    // so a Google-linked user was told "You're on an anonymous session" and
    // offered "Link Google", which then painted auth/provider-already-linked
    // into the panel. Fail-safe (it could only under-claim), but wrong on
    // screen, and profile-overlay.jsx hardcodes the same sentence with no
    // check at all.
    //
    // …and ANNOUNCE it when it changes (D134). The anonymous → Google
    // upgrade keeps the uid, so this callback set `linked` and then fell
    // past every branch below without a notify(): the flag was correct and
    // no subscriber was told. LivePrivacyPanel papered over it with a local
    // `linkedNow` set after its own await, which works exactly where the
    // link was started; a boot gate elsewhere on screen would have waited
    // forever. Only on a CHANGE — this callback also fires for token
    // refreshes, and a notify per refresh is a re-render per refresh.
    const wasLinked = state.linked;
    state.linked = !!user && user.isAnonymous === false;
    const linkedChanged = state.linked !== wasLinked;
    const next = user?.uid || null;
    if (next && state.uid && next !== state.uid) {
      resetForNewUid(next);
      return;
    }
    if (next && !state.uid) {
      state.uid = next;
      if (linkedChanged) notify();
      return;
    }
    if (linkedChanged) notify();
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
      if (!document.hidden) {
        wake();
        return;
      }
      // Hiding is the last callback a mobile WebView is guaranteed to get
      // before the OS may kill it, and saveAggCache is coalesced now — so
      // flush the pending write here rather than lose up to AGG_CACHE_MS
      // of counts. Cancel first: writeAggCache is the timer's own body,
      // and leaving the timer armed would write the same map twice.
      if (aggCacheTimer) {
        cancelAggCache();
        writeAggCache();
      }
      // The deck poll stops NOW, not after the grace period: a timer costs
      // nothing to drop and nothing to re-arm, so there is no swap to
      // protect. `startAggPoll()` on the next foreground restores it.
      stopAggPoll();
      // …and stop paying for deliveries nobody is looking at. Armed rather
      // than run, so the ten-second app swap this file is otherwise written
      // around stays free — see IDLE_DETACH_MS.
      cancelIdleDetach();
      idleDetachTimer = setTimeout(() => {
        idleDetachTimer = null;
        if (torndown) return;
        detachIdleListeners();
      }, IDLE_DETACH_MS);
    });
  }
  // Whether boot loses the race (slow network) or fails outright, the
  // app must render on the mock deck; a late successful boot attaches
  // via notify() and the UI reconciles.
  boot.catch((err) => {
    console.warn("[LIVE] boot failed — mock mode:", err);
    // Readable on the device, where console.warn is not. Firebase's
    // `code` is the actionable half — auth/network-request-failed and
    // permission-denied are different problems with the same message —
    // so it is kept when present.
    const code = (err as { code?: string })?.code;
    state.bootError = `${code ? `${code} — ` : ""}${(err as Error)?.message || String(err)}`;
    notify();
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
  // The race above only decides when to RENDER — boot keeps running, and
  // may still be running now. Say so rather than leaving the label blank:
  // "still connecting" and "failed" look identical on screen otherwise,
  // and they are the two cases a person is trying to tell apart.
  //
  // No longer a frozen snapshot. The first version wrote the string here
  // and never revised it, so a device stuck for two minutes still read
  // "after 3s" — a number about when we stopped waiting to render, which
  // every reader takes for how long it has been stuck. `bootError` now
  // composes the live stage at read time; this only records that the race
  // was lost.
  if (!LIVE.enabled && !state.bootError) {
    state.raceLost = true;
    notify();
  }
}

declare global {
  interface Window {
    LIVE?: typeof LIVE;
  }
}

window.LIVE = LIVE;

export default LIVE;
