// duel-signal.test.ts — the cross-group duel aggregate, executed rather
// than described.
//
// WHY THIS FILE EXISTS. `foldDuelSignal` is what writes
// `v2_question_aggs/duel-{qid}`: the per-option split and the 1v1
// guess-match rate for every duel question in the bank. Until this file it
// was executed by NO test in the repository — the four pure helpers it
// calls are exhaustively covered in pure.test.ts, and WHAT THIS FUNCTION
// PASSES THEM was covered nowhere. Measured: replacing the question doc's
// option count with a literal 0 left the whole functions suite, `tsc -b`
// and test:scripts green, while every duel question in the bank published
// `{plays, total}` with `counts`, `guessTotal` and `guessMatches`
// permanently absent.
//
// That is not a cosmetic loss. `scripts/question-scorecard.mjs` is the
// only consumer, and it grades the duel bank off exactly those fields —
// `deadDuels` (a question everyone guesses right) and `noisyDuels`. With
// the fields gone both lists silently empty and the bank reads healthy,
// so the retirement proposals a duel lane's PR is built on stop being
// made at all.
//
// The e2e cannot stand in for this: its duel fixture has both members
// answering the SAME qid, so the two branches of the qid choice coincide
// there by construction, and no file under firestore-tests/ ever reads a
// `duel-` document.
//
// WHAT THE FAKE IS AND IS NOT. Firestore's PLUMBING — refs, a
// transaction, getAll, set — not its semantics. Nothing here asserts
// anything about Firestore; the property under test is this function's own
// branching and the arguments it hands the pure layer.
import { describe, it, expect, vi, beforeEach } from "vitest";

type Doc = Record<string, unknown>;
const store = new Map<string, Doc>();

function ref(path: string) {
  return { path, id: path.split("/").pop() as string };
}

const fakeDb = {
  collection(name: string) {
    return { doc: (id: string) => ref(`${name}/${id}`) };
  },
  async runTransaction(cb: (tx: unknown) => Promise<unknown>) {
    const snap = (r: { path: string }) => ({
      exists: store.has(r.path),
      data: () => store.get(r.path),
      get: (f: string) => store.get(r.path)?.[f],
    });
    const tx = {
      getAll: async (...refs: { path: string }[]) => refs.map(snap),
      set: (r: { path: string }, data: Doc) => { store.set(r.path, data); },
    };
    return cb(tx);
  },
};

vi.mock("./db", () => ({ db: () => fakeDb, FIRESTORE_DB_ID: "insight" }));

const { foldDuelSignal } = await import("./v2social");

const QID = "duel-q1";
const AGG = `v2_question_aggs/duel-${QID}`;
const fold = (mode: string, qid: string | null, votes: Array<{ optionIdx: number; guessIdx?: number }>) =>
  foldDuelSignal(fakeDb as unknown as FirebaseFirestore.Firestore, mode, qid, votes);

beforeEach(() => {
  store.clear();
  store.set(`v2_questions/${QID}`, { options: ["a", "b", "c"] });
});

describe("the cross-group duel aggregate", () => {
  it("publishes the per-option split, keyed by the question", async () => {
    await fold("group", QID, [{ optionIdx: 0 }, { optionIdx: 2 }, { optionIdx: 2 }]);
    const agg = store.get(AGG);
    expect(agg, "nothing was published at all").toBeTruthy();
    expect(agg!.plays).toBe(1);
    expect(agg!.total).toBe(3);
    // THE ASSERTION THE ZEROED OPTION COUNT BREAKS. Without the question
    // doc's real option count no vote is ever in range, so `counts` is
    // dropped from the published doc entirely and the scorecard's
    // evenness grade has nothing to read.
    expect(agg!.counts, "the option split was not published").toEqual({ "0": 1, "2": 2 });
  });

  it("counts an option the QUESTION does not have as out of range", async () => {
    // The other direction, so "publish the split" cannot be satisfied by
    // ignoring the question doc and trusting the vote. Three options, so
    // index 7 is a vote against a bank the group no longer agrees with.
    await fold("group", QID, [{ optionIdx: 0 }, { optionIdx: 7 }]);
    const agg = store.get(AGG);
    expect(agg!.total, "an out-of-range vote stopped being a person").toBe(2);
    expect(agg!.counts).toEqual({ "0": 1 });
  });

  it("folds a second reveal onto the first", async () => {
    await fold("group", QID, [{ optionIdx: 1 }]);
    await fold("group", QID, [{ optionIdx: 1 }, { optionIdx: 0 }]);
    const agg = store.get(AGG);
    expect(agg!.plays, "the second reveal replaced the first instead of folding onto it").toBe(2);
    expect(agg!.total).toBe(3);
    expect(agg!.counts).toEqual({ "0": 1, "1": 2 });
  });

  it("publishes the guess-match rate — a 1v1's at the partner, a group's at the room", async () => {
    // Positional pairing: each partner's guess is checked against the
    // OTHER's actual pick. One right, one wrong.
    await fold("duo", QID, [
      { optionIdx: 0, guessIdx: 1 },
      { optionIdx: 1, guessIdx: 1 },
    ]);
    expect(store.get(AGG)!.guessTotal).toBe(2);
    expect(store.get(AGG)!.guessMatches).toBe(1);

    // A group reveal carrying guesses publishes the rate too since D386
    // (until then the field only meant anything for a pair): each guess
    // is read against the option the room landed on. Here the room split
    // 1–1, so both options tied for the top and both calls on option 1
    // landed.
    store.clear();
    store.set(`v2_questions/${QID}`, { options: ["a", "b", "c"] });
    await fold("group", QID, [
      { optionIdx: 0, guessIdx: 1 },
      { optionIdx: 1, guessIdx: 1 },
    ]);
    expect(store.get(AGG)!.guessTotal).toBe(2);
    expect(store.get(AGG)!.guessMatches).toBe(2);
  });

  it("mints nothing for a question an operator has deleted", async () => {
    // Rules admit a duel answer only against a bank qid, so a missing
    // question doc means the question went away since — and an aggregate
    // keyed by a ghost would be a row nothing can ever grade or retire.
    store.delete(`v2_questions/${QID}`);
    await fold("group", QID, [{ optionIdx: 0 }]);
    expect(store.has(AGG), "an aggregate was minted for a deleted question").toBe(false);
  });

  it("writes nothing when there is no question or no vote", async () => {
    await fold("group", null, [{ optionIdx: 0 }]);
    await fold("group", QID, []);
    expect([...store.keys()].some((k) => k.startsWith("v2_question_aggs/"))).toBe(false);
  });
});
