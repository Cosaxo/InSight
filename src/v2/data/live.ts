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
  deckDay: -1,
  deckIds: [] as string[],
  aggs: {} as Record<string, AggDoc>,
  votes: {} as Record<string, string>, // qid -> option id ("0","1",…)
  optimistic: {} as Record<string, number>, // qid -> optionIdx not yet aggregated
  aggUnsubs: {} as Record<string, () => void>,
};

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
      where("surface", "==", "daily"),
      limit(400),
    ),
  );
  state.questions = qsnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as QuestionDoc) }))
    .filter((q) => q.active !== false)
    .sort((a, b) => (a.seq || 0) - (b.seq || 0));
  if (!state.questions.length) return; // unseeded project — stay on mocks

  computeDeck();

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
}

const LIVE = {
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
        const q = state.questions.find((x) => x.id === qid);
        await setDoc(doc(db, "v2_users", uid, "answers", qid), {
          qid,
          surface: q?.surface ?? "daily",
          optionIdx,
          answeredAt: serverTimestamp(),
          anchors: {},
        });
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
    state.ready = true;
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
