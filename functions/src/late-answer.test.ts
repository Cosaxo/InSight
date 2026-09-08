// late-answer.test.ts — the answer trigger's duel branch under rounds
// (ROUNDS-PLAN §§3.1, 4; D420), executed rather than described.
//
// Two paths, one branch. A BLIND answer to the open round marks who played
// and starts the round's clock on its first answer; a LATE answer — to a
// round that has already revealed, admitted by the rules only flagged and
// guessless — joins the reveal marked late, with the member added to the
// reveal's `members` and `names`, and touches nothing on the group: no
// `played`, no clock, no completion. The e2e pins the same two facts
// against the real emulator; this pins them in the fast runner, where the
// branching is visible without Eventarc in the way.
//
// The fake is Firestore's plumbing, not its semantics: writes are stored as
// the update map the trigger issued, so an arrayUnion or a serverTimestamp
// lands as the sentinel the real SDK would resolve. What is asserted is
// WHICH keys the trigger wrote, which is what the branch decides.
import { describe, it, expect, vi, beforeEach } from "vitest";

type Doc = Record<string, unknown>;
const store = new Map<string, Doc>();

function ref(path: string) {
  return {
    path,
    id: path.split("/").pop() as string,
    collection: (name: string) => ({ doc: (id: string) => ref(`${path}/${name}/${id}`) }),
    async get() { return snap(this); },
  };
}
const snap = (r: { path: string }) => ({
  exists: store.has(r.path),
  get: (f: string) => store.get(r.path)?.[f],
});
const fakeDb = {
  collection(name: string) {
    return { doc: (id: string) => ref(`${name}/${id}`) };
  },
  doc: (path: string) => ref(path),
  async runTransaction(cb: (tx: unknown) => Promise<unknown>) {
    const tx = {
      getAll: async (...refs: { path: string }[]) => refs.map(snap),
      get: async (r: { path: string }) => snap(r),
      set: (r: { path: string }, data: Doc) => { store.set(r.path, data); },
      update: (r: { path: string }, data: Doc) => {
        store.set(r.path, { ...(store.get(r.path) || {}), ...data });
      },
    };
    return cb(tx);
  },
};

vi.mock("./db", () => ({ db: () => fakeDb, FIRESTORE_DB_ID: "insight" }));
// The reveal-on-completion is v2social's; here the subject is the mark.
vi.mock("./v2social", () => ({ revealDueRounds: vi.fn(async () => 0) }));

const { onV2AnswerCreated } = await import("./v2");
const { revealDueRounds } = await import("./v2social");

const GID = "grp1";
async function deliver(uid: string, aid: string, data: Doc) {
  await (onV2AnswerCreated as unknown as { run: (e: unknown) => Promise<void> }).run({
    id: `evt-${aid}`,
    params: { uid, qid: aid },
    data: { exists: true, ref: ref(`v2_users/${uid}/answers/${aid}`), get: (f: string) => data[f] },
  });
}

beforeEach(() => {
  store.clear();
  vi.mocked(revealDueRounds).mockClear();
  store.set(`v2_groups/${GID}`, { mode: "duo", memberUids: ["u1", "u2"], round: 2, played: {} });
  store.set(`v2_groups/${GID}/reveals/r1`, {
    round: 1, day: "2026-09-07", qid: "duo-001",
    votes: { u2: { optionIdx: 1, guessIdx: 0 } }, names: { u2: "Ada" }, members: ["u2"],
  });
  store.set("v2_users/u1", { displayName: "Bo" });
});

describe("a blind answer to the open round", () => {
  it("marks who played, starts the clock on the first answer, and asks whether the round is complete", async () => {
    await deliver("u1", `g_${GID}_r2`, { surface: "duo", gid: GID, round: 2, optionIdx: 0, guessIdx: 1 });
    const g = store.get(`v2_groups/${GID}`)!;
    expect(g["played.r2"], "the player was not marked").toBeTruthy();
    expect(g.roundDeadlineAt, "the first answer did not start the clock").toBeTruthy();
    // One of two has answered: not complete, so no reveal was asked for.
    expect(revealDueRounds).not.toHaveBeenCalled();
    // The reveal of round 1 is untouched by a round-2 answer.
    expect(Object.keys(store.get(`v2_groups/${GID}/reveals/r1`)!.votes as object)).toEqual(["u2"]);
  });

  it("the completing answer reveals right there", async () => {
    store.set(`v2_groups/${GID}`, { mode: "duo", memberUids: ["u1", "u2"], round: 2, played: { r2: ["u2"] }, roundDeadlineAt: 1 });
    await deliver("u1", `g_${GID}_r2`, { surface: "duo", gid: GID, round: 2, optionIdx: 0, guessIdx: 1 });
    expect(revealDueRounds).toHaveBeenCalledTimes(1);
  });

  it("an answer sealed AHEAD marks its own round and starts no clock", async () => {
    await deliver("u1", `g_${GID}_r4`, { surface: "duo", gid: GID, round: 4, optionIdx: 0, guessIdx: 1 });
    const g = store.get(`v2_groups/${GID}`)!;
    expect(g["played.r4"]).toBeTruthy();
    expect(g.roundDeadlineAt, "a round sealed ahead started the OPEN round's clock").toBeUndefined();
    expect(revealDueRounds).not.toHaveBeenCalled();
  });
});

describe("a LATE answer to a revealed round (ROUNDS-PLAN §4)", () => {
  it("joins the reveal marked late, with the member recorded and named, and touches nothing on the group", async () => {
    await deliver("u1", `g_${GID}_r1`, { surface: "duo", gid: GID, round: 1, optionIdx: 0, late: true, qid: "duo-001" });
    const r = store.get(`v2_groups/${GID}/reveals/r1`)!;
    expect(r["votes.u1"]).toEqual({ optionIdx: 0, late: true });
    expect(r["names.u1"]).toBe("Bo");
    expect(r.members, "the late answerer was named but not recorded as there").toBeTruthy();
    const g = store.get(`v2_groups/${GID}`)!;
    expect(g["played.r1"], "a late answer marked played on a revealed round").toBeUndefined();
    expect(g.roundDeadlineAt, "a late answer started a clock").toBeUndefined();
    expect(g.round).toBe(2);
    expect(revealDueRounds).not.toHaveBeenCalled();
  });

  it("never overwrites a blind vote, and carries a different question's qid (D71)", async () => {
    // u2 already holds a blind vote in r1 — a retried or replayed late
    // answer from u2 changes nothing.
    await deliver("u2", `g_${GID}_r1`, { surface: "duo", gid: GID, round: 1, optionIdx: 0, late: true, qid: "duo-001" });
    const r = store.get(`v2_groups/${GID}/reveals/r1`)!;
    expect(r["votes.u2"]).toBeUndefined();
    expect((r.votes as Doc).u2).toEqual({ optionIdx: 1, guessIdx: 0 });
    // …and a late answer to a DIFFERENT question than the round was
    // published under says which one, the way a blind drifter's does.
    await deliver("u1", `g_${GID}_r1`, { surface: "duo", gid: GID, round: 1, optionIdx: 2, late: true, qid: "duo-009" });
    expect(store.get(`v2_groups/${GID}/reveals/r1`)!["votes.u1"]).toEqual({ optionIdx: 2, late: true, qid: "duo-009" });
  });

  it("a late answer to a round with no reveal to join does nothing", async () => {
    store.delete(`v2_groups/${GID}/reveals/r1`);
    await deliver("u1", `g_${GID}_r1`, { surface: "duo", gid: GID, round: 1, optionIdx: 0, late: true });
    expect(store.has(`v2_groups/${GID}/reveals/r1`)).toBe(false);
    expect(store.get(`v2_groups/${GID}`)!["played.r1"]).toBeUndefined();
  });
});
