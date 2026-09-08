// reveal-day.test.ts — the nightly group reveal, executed rather than
// described.
//
// WHY THIS FILE EXISTS. `revealGroupDay` is the product's one daily
// moment: it publishes the day's answers to a circle, moves the streak,
// settles the day and folds the reveal into the cross-group duel
// aggregate. Until this file it had NO fast-runner coverage at all — the
// pure helpers it calls are exhaustively pinned in pure.test.ts, and what
// this function does WITH them was pinned nowhere. The emulator suites
// drive one reveal per group along the happy path, which is precisely the
// path where the two properties below cannot be distinguished from their
// own failure.
//
// TWO PROPERTIES, both invisible to every other runner:
//
//   1. THE PER-ATTEMPT RESET. A Firestore transaction callback may run
//      more than once — this one contends with the answer trigger's own
//      arrayUnion on the same group document, so it really does. Attempt 1
//      can pass every guard, set `didReveal`, and then abort; attempt 2
//      re-reads, finds a concurrent reveal already standing, and commits
//      nothing. Without the reset at the top of the callback, attempt 1's
//      verdict survives into a run that wrote nothing: the day is folded
//      into the duel aggregate a SECOND time on top of the winner's fold,
//      and the circle is sent a second "yesterday's answers are out".
//
//   2. WHICH VOTES ARE FOLDED. The fold must use the qid decided from the
//      TRANSACTION's re-read, not the one decided from the earlier
//      non-transactional read. An answer that lands between the two moves
//      the plurality, and folding the stale choice publishes one circle's
//      votes under another circle's question.
//
// WHAT THE FAKE IS AND IS NOT. Firestore's PLUMBING — refs, getAll, a
// transaction that can be told to retry — not its semantics. Nothing here
// asserts anything about Firestore; the subject is this function's own
// branching.
import { describe, it, expect, vi, beforeEach } from "vitest";

type Doc = Record<string, unknown>;
const store = new Map<string, Doc>();
// Answers as the TRANSACTION re-read sees them, when they differ from the
// first read — the late-answer race, which is the whole point of the
// re-read.
const fresh = new Map<string, Doc>();
// When set, the first transaction attempt is discarded and the callback is
// run a second time, with this document written in between: the concurrent
// winner. Exactly the contention runAggTransaction exists to count.
let contendWith: { path: string; doc: Doc } | null = null;
let attempts = 0;

function ref(path: string) {
  return {
    path,
    id: path.split("/").pop() as string,
    collection: (name: string) => ({ doc: (id: string) => ref(`${path}/${name}/${id}`) }),
    async get() {
      return snapOf(store, path);
    },
  };
}
function snapOf(from: Map<string, Doc>, path: string) {
  const d = from.has(path) ? from.get(path) : store.get(path);
  return { exists: d !== undefined, id: path.split("/").pop(), data: () => d, get: (f: string) => d?.[f] };
}

const fakeDb = {
  doc: (path: string) => ref(path),
  collection: (name: string) => ({ doc: (id: string) => ref(`${name}/${id}`) }),
  // The real getAll takes an optional ReadOptions object as a trailing
  // argument (the profile read passes a fieldMask), so anything without a
  // path is that, not a document.
  async getAll(...refs: Array<{ path?: string }>) {
    return refs.filter((r) => typeof r.path === "string").map((r) => snapOf(store, r.path as string));
  },
  async runTransaction(cb: (tx: unknown) => Promise<unknown>) {
    const run = async (view: Map<string, Doc>) => {
      const writes: Array<[string, Doc]> = [];
      const tx = {
        getAll: async (...refs: { path: string }[]) => refs.map((r) => snapOf(view, r.path)),
        get: async (r: { path: string }) => snapOf(view, r.path),
        create: (r: { path: string }, data: Doc) => { writes.push([r.path, data]); },
        set: (r: { path: string }, data: Doc) => { writes.push([r.path, data]); },
        update: (r: { path: string }, data: Doc) => {
          writes.push([r.path, { ...(store.get(r.path) || {}), ...data }]);
        },
      };
      attempts++;
      await cb(tx);
      return writes;
    };
    // Attempt 1, thrown away — the transaction aborted on contention.
    if (contendWith) {
      await run(fresh);
      store.set(contendWith.path, contendWith.doc);
      contendWith = null;
    }
    for (const [path, data] of await run(fresh)) store.set(path, data);
  },
};

vi.mock("./db", () => ({ db: () => fakeDb, FIRESTORE_DB_ID: "insight" }));
vi.mock("firebase-admin/messaging", () => ({ getMessaging: () => { throw new Error("no push in this harness"); } }));

const { revealGroupDay } = await import("./v2social");

const GID = "grp1";
const DAY = "2026-09-05";
const groupRef = ref(`v2_groups/${GID}`);
const group = {
  id: GID,
  ref: groupRef,
  get: (f: string) => store.get(`v2_groups/${GID}`)?.[f],
};

const answer = (uid: string, qid: string, optionIdx: number, over: Doc = {}) =>
  [`v2_users/${uid}/answers/g_${GID}_${DAY}`, { qid, optionIdx, ...over }] as const;

beforeEach(() => {
  store.clear();
  fresh.clear();
  contendWith = null;
  attempts = 0;
  store.set(`v2_groups/${GID}`, { mode: "group", memberUids: ["u1", "u2"], pendingDays: [DAY], streak: 0 });
  store.set("v2_questions/qA", { options: ["a", "b", "c"] });
  store.set("v2_questions/qB", { options: ["a", "b", "c"] });
});

describe("a reveal that lost the race", () => {
  it("folds nothing, because a retried attempt must not inherit the first's verdict", async () => {
    store.set(...answer("u1", "qA", 0));
    store.set(...answer("u2", "qA", 1));
    // Attempt 1 passes every guard and sets the verdict; then the
    // concurrent reveal lands and attempt 2 bails on `existing.exists`.
    contendWith = { path: `v2_groups/${GID}/reveals/${DAY}`, doc: { day: DAY, qid: "qA" } };

    const revealed = await revealGroupDay(
      group as unknown as FirebaseFirestore.QueryDocumentSnapshot,
      DAY,
    );

    expect(attempts, "the harness did not actually retry the transaction").toBe(2);
    expect(revealed, "a run that committed nothing reported a reveal").toBe(false);
    // The reader-visible consequence: without the reset this day is folded
    // into the cross-group aggregate on top of the winner's fold, so the
    // question's play count and person count both read one reveal too high
    // — permanently, since nothing ever recounts them.
    expect(
      store.has("v2_question_aggs/duel-qA"),
      "the lost attempt folded its votes into the duel aggregate anyway",
    ).toBe(false);
  });

  it("…and the same reveal, uncontended, DOES fold", async () => {
    // The control. Without it, "folds nothing" would also be what a
    // function that folds nothing ever looks like.
    store.set(...answer("u1", "qA", 0));
    store.set(...answer("u2", "qA", 1));
    const revealed = await revealGroupDay(
      group as unknown as FirebaseFirestore.QueryDocumentSnapshot,
      DAY,
    );
    expect(revealed).toBe(true);
    expect(store.get("v2_question_aggs/duel-qA")).toMatchObject({ plays: 1, total: 2 });
    expect(store.get(`v2_groups/${GID}/reveals/${DAY}`)).toBeTruthy();
  });
});

describe("an answer that lands between the two reads", () => {
  it("is folded under the question the RE-READ decided, with only its own votes", async () => {
    // First read: one vote, on qB. The transaction's re-read finds two
    // more that landed since, both on qA — so the plurality moves, and the
    // fold must follow it. Folding the first read's choice would publish
    // u3's vote under a question nobody but u3 answered.
    store.set(`v2_groups/${GID}`, {
      mode: "group", memberUids: ["u1", "u2", "u3"], pendingDays: [DAY], streak: 0,
    });
    store.set(...answer("u3", "qB", 2));
    fresh.set(...answer("u1", "qA", 0));
    fresh.set(...answer("u2", "qA", 1));
    fresh.set(...answer("u3", "qB", 2));

    expect(
      await revealGroupDay(group as unknown as FirebaseFirestore.QueryDocumentSnapshot, DAY),
    ).toBe(true);

    const agg = store.get("v2_question_aggs/duel-qA");
    expect(agg, "the fold used the pre-transaction question").toBeTruthy();
    // TWO people, not three: the vote cast on the other question is
    // published in the reveal but is not an answer to this one.
    expect(agg!.total).toBe(2);
    expect(agg!.counts).toEqual({ "0": 1, "1": 1 });
    expect(store.has("v2_question_aggs/duel-qB"), "the odd vote got its own aggregate").toBe(false);
  });
});

// ── THE STREAK'S PRESENT TENSE, at both call sites ──────────────────
//
// `movesPresentState` is exhaustively pinned as a pure function in
// pure.test.ts, and NEITHER PLACE THAT USES IT was executed by anything.
// Measured: deleting the guard at the reveal site, deleting the clause at
// the settle site, and doing both, each left the functions suite at
// 794/794.
//
// It is the hot path, not an operator lever. `scheduledDuelReveals` runs
// every 120 minutes and `scanDays()` walks six days NEWEST-FIRST, so a run
// routinely reaches days that sit behind the last reveal.
//
// What each guard is holding back:
//
//   · the reveal site — a run that revealed yesterday and then reaches an
//     older still-pending day would write `lastRevealDay` BACKWARDS, and
//     `nextStreak` reads that as a gap: a 40-day streak becomes 1 for
//     having a hole filled in. pure.ts's own docstring records a user
//     watching exactly that happen.
//
//   · the settle site — the COMMON case, since most scanned group-days do
//     not reveal. Without it a stale day one partner never played zeroes a
//     live duo streak on an ordinary two-hourly scan.
//
// The emulator suite cannot stand in: e2e-v2-loop asserts `streak === 1`
// on a FIRST reveal, which is what both mutations produce anyway.
describe("a day behind the last reveal cannot move the present", () => {
  /** A group mid-streak whose last reveal is NEWER than the day being scanned. */
  const midStreak = (over: Doc = {}) => {
    store.set(`v2_groups/${GID}`, {
      mode: "group", memberUids: ["u1", "u2"],
      pendingDays: [DAY], streak: 40, lastRevealDay: "2026-09-06",
      ...over,
    });
  };

  it("keeps a 40-day streak when an older pending day is filled in", async () => {
    midStreak();
    store.set(...answer("u1", "qA", 0));
    store.set(...answer("u2", "qA", 1));

    expect(
      await revealGroupDay(group as unknown as FirebaseFirestore.QueryDocumentSnapshot, DAY),
    ).toBe(true);

    const g = store.get(`v2_groups/${GID}`)!;
    expect(g.streak, "a filled-in gap reset the streak").toBe(40);
    expect(
      g.lastRevealDay,
      "the present tense walked backwards to the day being back-filled",
    ).toBe("2026-09-06");
    // The reveal itself still happens — this guard is about the group's
    // present tense, never about whether the day publishes.
    expect(store.get(`v2_groups/${GID}/reveals/${DAY}`), "the back-filled day did not publish").toBeTruthy();
  });

  it("…and a NEWER day still moves it, which is what the guard is for", async () => {
    // THE CONTROL. Everything above asserts that a number did not change,
    // which is also what a reveal that stopped touching the streak looks
    // like. Same group, one day forward from its last reveal: the streak
    // must advance and the day must become the present.
    store.set(`v2_groups/${GID}`, {
      mode: "group", memberUids: ["u1", "u2"],
      pendingDays: ["2026-09-07"], streak: 40, lastRevealDay: "2026-09-06",
    });
    store.set(`v2_users/u1/answers/g_${GID}_2026-09-07`, { qid: "qA", optionIdx: 0 });
    store.set(`v2_users/u2/answers/g_${GID}_2026-09-07`, { qid: "qA", optionIdx: 1 });

    expect(
      await revealGroupDay(group as unknown as FirebaseFirestore.QueryDocumentSnapshot, "2026-09-07"),
    ).toBe(true);

    const g = store.get(`v2_groups/${GID}`)!;
    expect(g.streak, "a consecutive day did not extend the streak").toBe(41);
    expect(g.lastRevealDay).toBe("2026-09-07");
  });

  it("does not zero a live duo streak when a stale unplayed day settles", async () => {
    // The settle path: a duo day that CANNOT reveal (one partner never
    // answered) still gets settled, and settling is where the streak is
    // broken. This day is older than the last reveal, so breaking it here
    // would be the two-hourly scan destroying a streak that is standing.
    store.set(`v2_groups/${GID}`, {
      mode: "duo", memberUids: ["u1", "u2"],
      pendingDays: [DAY], streak: 40, lastRevealDay: "2026-09-06",
    });
    store.set(...answer("u1", "qA", 0));   // u2 never played

    expect(
      await revealGroupDay(group as unknown as FirebaseFirestore.QueryDocumentSnapshot, DAY),
    ).toBe(false);
    expect(
      store.get(`v2_groups/${GID}`)!.streak,
      "settling a day older than the last reveal zeroed a live streak",
    ).toBe(40);
  });

  it("…and DOES break the streak when the stale day is the present one", async () => {
    // The control for the settle path. A duo day at or ahead of the last
    // reveal that nobody completed is a real miss, and the streak breaking
    // is the product working.
    store.set(`v2_groups/${GID}`, {
      mode: "duo", memberUids: ["u1", "u2"],
      pendingDays: [DAY], streak: 40, lastRevealDay: "2026-09-04",
    });
    store.set(...answer("u1", "qA", 0));

    expect(
      await revealGroupDay(group as unknown as FirebaseFirestore.QueryDocumentSnapshot, DAY),
    ).toBe(false);
    expect(
      store.get(`v2_groups/${GID}`)!.streak,
      "a genuinely missed day left the streak standing",
    ).toBe(0);
  });
});

// ── WHOSE NAME THE REVEAL CARRIES ───────────────────────────────────
//
// The reveal document's `names` map is narrowed to `revealMembersFor(...)`
// — the roster minus anyone who joined after the day ended and did not
// play. Reverting that loop to the whole roster left the functions suite
// at 794/794.
//
// It matters because `names` is a DISPLAY NAME in a document every signed
// -in user may read, and `deleteAccount` sweeps reveals by walking
// `members`. So a person named in a reveal whose `members` array does not
// carry them is a person erasure never reaches: they ask to be deleted and
// their name stays, permanently, in a world-readable document. The code's
// own comment records the fix being "confirmed against the real callable
// in the emulator, not reasoned: the name survived the erasure" — and
// nothing was added to hold it.
//
// The erasure e2e cannot stand in. It SEEDS reveal documents by hand and
// never produces one through `revealGroupDay`, so this line is executed by
// no runner in the repository.
describe("the reveal names only the people its members array carries", () => {
  const DAY_END = Date.parse(`${DAY}T00:00:00Z`) + 86400000;
  // A Firestore Timestamp, near enough: `joinedAtMs` reads `toMillis()` and
  // DROPS anything without it, and a dropped join time means "unknown",
  // which keeps the member. A fixture of raw numbers would therefore keep
  // everybody and pass whatever the narrowing did — the first draft of this
  // case did exactly that, and looked like a real failure.
  const at = (ms: number) => ({ toMillis: () => ms });

  it("leaves out someone who joined after the day ended and did not play", async () => {
    store.set(`v2_groups/${GID}`, {
      mode: "group", memberUids: ["u1", "u2", "u3"], pendingDays: [DAY], streak: 0,
      // u3 arrived the day after — they were not in the room for this one.
      memberJoinedAt: { u1: at(DAY_END - 86400000), u2: at(DAY_END - 86400000), u3: at(DAY_END + 3600000) },
    });
    store.set("v2_users/u1", { displayName: "Ada" });
    store.set("v2_users/u2", { displayName: "Bo" });
    store.set("v2_users/u3", { displayName: "Cai" });
    store.set(...answer("u1", "qA", 0));
    store.set(...answer("u2", "qA", 1));

    expect(
      await revealGroupDay(group as unknown as FirebaseFirestore.QueryDocumentSnapshot, DAY),
    ).toBe(true);

    const reveal = store.get(`v2_groups/${GID}/reveals/${DAY}`)!;
    expect(Object.keys(reveal.names as Doc).sort(), "the reveal names a non-member").toEqual(["u1", "u2"]);
    // The two must agree, and THIS is the reason: erasure walks `members`,
    // so a name outside it is a name erasure cannot find.
    expect((reveal.members as string[]).slice().sort()).toEqual(["u1", "u2"]);
    expect(
      JSON.stringify(reveal.names),
      "a display name is in a world-readable document that erasure will never sweep",
    ).not.toContain("Cai");
  });

  it("…and DOES name a late joiner who actually played", async () => {
    // THE CONTROL, and the narrowing's own rule: playing puts you in the
    // room whatever the timestamps say. Without this the case above passes
    // the day the map is narrowed to nothing at all.
    store.set(`v2_groups/${GID}`, {
      mode: "group", memberUids: ["u1", "u2", "u3"], pendingDays: [DAY], streak: 0,
      memberJoinedAt: { u1: at(DAY_END - 86400000), u2: at(DAY_END - 86400000), u3: at(DAY_END + 3600000) },
    });
    store.set("v2_users/u1", { displayName: "Ada" });
    store.set("v2_users/u2", { displayName: "Bo" });
    store.set("v2_users/u3", { displayName: "Cai" });
    store.set(...answer("u1", "qA", 0));
    store.set(...answer("u2", "qA", 1));
    store.set(...answer("u3", "qA", 2));

    expect(
      await revealGroupDay(group as unknown as FirebaseFirestore.QueryDocumentSnapshot, DAY),
    ).toBe(true);

    const reveal = store.get(`v2_groups/${GID}/reveals/${DAY}`)!;
    expect(
      Object.keys(reveal.names as Doc).sort(),
      "a late joiner who answered was left out of their own reveal",
    ).toEqual(["u1", "u2", "u3"]);
    expect(JSON.stringify(reveal.names)).toContain("Cai");
  });
});
