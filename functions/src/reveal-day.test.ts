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
