// reveal-day.test.ts — the round reveal, executed rather than described.
// (The file keeps its name from when a reveal was a day; the subject is
// `revealRound` since ROUNDS-PLAN / D420.)
//
// WHY THIS FILE EXISTS. `revealRound` is the product's moment: it
// publishes a round's answers to a room, opens the next round, moves the
// streak and folds the reveal into the cross-group duel aggregate. Until this file it had NO fast-runner coverage at all — the
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

const { revealRound } = await import("./v2social");

const GID = "grp1";
const ROUND = 3;
const KEY = `r${ROUND}`;
const groupRef = ref(`v2_groups/${GID}`);
// A DocumentSnapshot as revealRound reads one: exists, id, ref, get.
const group = {
  id: GID,
  ref: groupRef,
  exists: true,
  get: (f: string) => store.get(`v2_groups/${GID}`)?.[f],
};
// A due round: the deadline is in the past, so the verdict is "reveal for
// whoever played" — every case here is about what the transaction then
// does, not about whether it should run.
const DUE = { roundDeadlineAt: Date.now() - 1000, roundOpenedAt: Date.now() - 90_000_000 };

const answer = (uid: string, qid: string, optionIdx: number, over: Doc = {}) =>
  [`v2_users/${uid}/answers/g_${GID}_r${ROUND}`, { qid, optionIdx, ...over }] as const;

beforeEach(() => {
  store.clear();
  fresh.clear();
  contendWith = null;
  attempts = 0;
  store.set(`v2_groups/${GID}`, {
    mode: "group", memberUids: ["u1", "u2"], round: ROUND,
    played: { [KEY]: ["u1", "u2"] }, streak: 0, ...DUE,
  });
  store.set("v2_questions/qA", { options: ["a", "b", "c"] });
  store.set("v2_questions/qB", { options: ["a", "b", "c"] });
});

describe("a reveal that lost the race", () => {
  it("folds nothing, because a retried attempt must not inherit the first's verdict", async () => {
    store.set(...answer("u1", "qA", 0));
    store.set(...answer("u2", "qA", 1));
    // Attempt 1 passes every guard and sets the verdict; then the
    // concurrent reveal lands and attempt 2 bails on `existing.exists`.
    contendWith = { path: `v2_groups/${GID}/reveals/${KEY}`, doc: { round: ROUND, qid: "qA" } };

    const revealed = await revealRound(
      group as unknown as FirebaseFirestore.DocumentSnapshot,
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
    const revealed = await revealRound(
      group as unknown as FirebaseFirestore.DocumentSnapshot,
    );
    expect(revealed).toBe(true);
    expect(store.get("v2_question_aggs/duel-qA")).toMatchObject({ plays: 1, total: 2 });
    const reveal = store.get(`v2_groups/${GID}/reveals/${KEY}`);
    expect(reveal).toMatchObject({ round: ROUND, qid: "qA" });
    expect(typeof reveal!.day).toBe("string");
    // …and the NEXT round opened in the same commit: the revealed round's
    // players are gone from `played`, and with nobody sealed ahead there is
    // no clock on the new round.
    const g = store.get(`v2_groups/${GID}`)!;
    expect(g.round).toBe(ROUND + 1);
    expect(g.played).toEqual({});
    expect(g.streak).toBe(1);
    expect(g.lastRevealDay).toBe(reveal!.day);
  });

  it("opens the next round with its clock running when somebody sealed it ahead", async () => {
    store.set(`v2_groups/${GID}`, {
      mode: "duo", memberUids: ["u1", "u2"], round: ROUND,
      played: { [KEY]: ["u1", "u2"], [`r${ROUND + 1}`]: ["u1"] }, streak: 4,
      lastRevealDay: "2000-01-01", ...DUE,
    });
    store.set(...answer("u1", "qA", 0));
    store.set(...answer("u2", "qA", 1));
    expect(await revealRound(group as unknown as FirebaseFirestore.DocumentSnapshot)).toBe(true);
    const g = store.get(`v2_groups/${GID}`)!;
    expect(g.round).toBe(ROUND + 1);
    expect(g.played).toEqual({ [`r${ROUND + 1}`]: ["u1"] });
    // A Timestamp, not a FieldValue.delete sentinel: the next round has an
    // answer, so its day starts now.
    expect(typeof (g.roundDeadlineAt as { toMillis?: unknown }).toMillis).toBe("function");
    // A gap of years resets the streak to 1 — nextStreak's rule, unchanged.
    expect(g.streak).toBe(1);
    // ROUNDS-PLAN §7.4: the push says "round 4 is waiting for you" to u2
    // alone, and stamps u2 so round 4's first answer does not nudge again;
    // u1 sealed it ahead, so nothing waits for u1 and nothing is stamped.
    expect(g["pushAt.u2"], "the member the next round waits for was not stamped").toBeTruthy();
    expect(g["pushAt.u1"], "a member who ran ahead was stamped").toBeUndefined();
  });

  it("stamps every member the next round waits for, so its first answer nudges nobody twice (ROUNDS-PLAN §7.4)", async () => {
    store.set(...answer("u1", "qA", 0));
    store.set(...answer("u2", "qA", 1));
    expect(await revealRound(group as unknown as FirebaseFirestore.DocumentSnapshot)).toBe(true);
    const g = store.get(`v2_groups/${GID}`)!;
    expect(g["pushAt.u1"]).toBeTruthy();
    expect(g["pushAt.u2"]).toBeTruthy();
  });

  it("does not reveal a round that is neither complete nor due", async () => {
    // A group of two with one answer and a deadline still ahead: nothing
    // happens, and nothing is read past the page snapshot.
    store.set(`v2_groups/${GID}`, {
      mode: "group", memberUids: ["u1", "u2"], round: ROUND,
      played: { [KEY]: ["u1"] }, streak: 0,
      roundDeadlineAt: Date.now() + 3_600_000, roundOpenedAt: Date.now(),
    });
    store.set(...answer("u1", "qA", 0));
    expect(await revealRound(group as unknown as FirebaseFirestore.DocumentSnapshot)).toBe(false);
    expect(attempts, "opened a transaction for a round that could not reveal").toBe(0);
    expect(store.has(`v2_groups/${GID}/reveals/${KEY}`)).toBe(false);
    // …and forced, it reveals for the one who played (the operator's lever).
    expect(await revealRound(group as unknown as FirebaseFirestore.DocumentSnapshot, { force: true })).toBe(true);
    expect(Object.keys(store.get(`v2_groups/${GID}/reveals/${KEY}`)!.votes as object)).toEqual(["u1"]);
  });

  it("a round the page said was open but the re-read says has advanced is left alone", async () => {
    // The trigger's reveal-on-completion and the scan can race on one
    // group. The page snapshot says round 3 is open; by the time the
    // transaction re-reads, the other writer has revealed it and opened 4.
    store.set(...answer("u1", "qA", 0));
    store.set(...answer("u2", "qA", 1));
    fresh.set(`v2_groups/${GID}`, { ...store.get(`v2_groups/${GID}`)!, round: ROUND + 1, played: {} });
    expect(await revealRound(group as unknown as FirebaseFirestore.DocumentSnapshot)).toBe(false);
    expect(store.has("v2_question_aggs/duel-qA")).toBe(false);
  });
});

describe("an answer that lands between the two reads", () => {
  it("is folded under the question the RE-READ decided, with only its own votes", async () => {
    // First read: one vote, on qB. The transaction's re-read finds two
    // more that landed since, both on qA — so the plurality moves, and the
    // fold must follow it. Folding the first read's choice would publish
    // u3's vote under a question nobody but u3 answered.
    store.set(`v2_groups/${GID}`, {
      mode: "group", memberUids: ["u1", "u2", "u3"], round: ROUND,
      played: { [KEY]: ["u3"] }, streak: 0, ...DUE,
    });
    store.set(...answer("u3", "qB", 2));
    fresh.set(...answer("u1", "qA", 0));
    fresh.set(...answer("u2", "qA", 1));
    fresh.set(...answer("u3", "qB", 2));

    expect(
      await revealRound(group as unknown as FirebaseFirestore.DocumentSnapshot),
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
