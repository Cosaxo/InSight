// late-answer.test.ts — the answer trigger's duel branch under rounds
// (ROUNDS-PLAN §§3.1, 4; D426), executed rather than described.
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
vi.mock("./v2social", () => ({
  revealDueRounds: vi.fn(async () => 0),
  notifyTurn: vi.fn(async () => {}),
}));

const { onV2AnswerCreated } = await import("./v2");
const { revealDueRounds, notifyTurn } = await import("./v2social");

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
  vi.mocked(notifyTurn).mockClear();
  store.set(`v2_groups/${GID}`, {
    mode: "duo", memberUids: ["u1", "u2"], round: 2, played: {},
    name: "Bo & Ada", memberNames: { u1: "Bo", u2: "Ada" },
  });
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

  it("a later answer to the same round does not push the deadline out", async () => {
    // THE SECOND HALF OF THE GUARD, and it had no test: deleting
    // `&& !g.get("roundDeadlineAt")` left the whole functions suite green.
    // Without it every answer restarts the clock, so a round in a slow
    // room never reaches its deadline — it just keeps moving — and the
    // card's countdown jumps forward whenever anybody answers. Seven
    // sibling mutations in the same commit ARE caught; this one was not.
    //
    // Three members so the second answer does not COMPLETE the round:
    // completion reveals, and a reveal writes its own clock.
    store.set(`v2_groups/${GID}`, {
      mode: "group", memberUids: ["u1", "u2", "u3"], round: 2,
      played: { r2: ["u2"] }, roundDeadlineAt: 1, roundOpenedAt: 1,
    });
    await deliver("u1", `g_${GID}_r2`, { surface: "group", gid: GID, round: 2, optionIdx: 0, guessIdx: 1 });
    const g = store.get(`v2_groups/${GID}`)!;
    expect(g["played.r2"], "the second player was not marked").toBeTruthy();
    expect(revealDueRounds, "two of three is not a complete round").not.toHaveBeenCalled();
    expect(g.roundDeadlineAt, "the second answer restarted the round's clock").toBe(1);
    expect(g.roundOpenedAt, "the second answer restamped when the round opened").toBe(1);
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

// ── the nudge (ROUNDS-PLAN §7.4): decided in the transaction, sent after ──
describe("'your turn' — the volley's other half", () => {
  const G = () => store.get(`v2_groups/${GID}`)!;
  const deleteSentinel = (v: unknown) => (v as { methodName?: string } | undefined)?.methodName === "FieldValue.delete";

  it("a first answer tells the partner it is their turn, once, and stamps them in the same commit", async () => {
    await deliver("u1", `g_${GID}_r2`, { surface: "duo", gid: GID, round: 2, optionIdx: 0, guessIdx: 1 });
    expect(notifyTurn).toHaveBeenCalledTimes(1);
    expect(vi.mocked(notifyTurn).mock.calls[0].slice(1)).toEqual([
      GID, { name: "Bo & Ada", mode: "duo", who: "Bo" }, [{ uid: "u2", waiting: 1 }],
    ]);
    expect(G()["pushAt.u2"], "the partner was told but not stamped").toBeTruthy();
    expect(G()["pushAt.u1"], "the answerer was stamped").toBeUndefined();
  });

  it("a partner already told is not told again — one push per turn, however far the other runs ahead", async () => {
    store.set(`v2_groups/${GID}`, { ...G(), played: { r2: ["u1"] }, pushAt: { u2: 1 } });
    await deliver("u1", `g_${GID}_r3`, { surface: "duo", gid: GID, round: 3, optionIdx: 0, guessIdx: 1 });
    await deliver("u1", `g_${GID}_r4`, { surface: "duo", gid: GID, round: 4, optionIdx: 0, guessIdx: 1 });
    expect(notifyTurn).not.toHaveBeenCalled();
  });

  it("the answerer's own stamp is cleared by their answer, so the next round waiting for them is news again", async () => {
    store.set(`v2_groups/${GID}`, { ...G(), pushAt: { u1: 1 } });
    await deliver("u1", `g_${GID}_r2`, { surface: "duo", gid: GID, round: 2, optionIdx: 0, guessIdx: 1 });
    expect(deleteSentinel(G()["pushAt.u1"]), "the stamp was not cleared").toBe(true);
    expect(notifyTurn).toHaveBeenCalledTimes(1);
  });

  it("the completing answer nudges nobody — the reveal is the carrier", async () => {
    store.set(`v2_groups/${GID}`, { ...G(), played: { r2: ["u2"] }, roundDeadlineAt: 1 });
    await deliver("u1", `g_${GID}_r2`, { surface: "duo", gid: GID, round: 2, optionIdx: 0, guessIdx: 1 });
    expect(notifyTurn).not.toHaveBeenCalled();
    expect(revealDueRounds).toHaveBeenCalledTimes(1);
  });

  it("a late answer nudges nobody and stamps nothing: it is nobody's turn", async () => {
    await deliver("u1", `g_${GID}_r1`, { surface: "duo", gid: GID, round: 1, optionIdx: 0, late: true, qid: "duo-001" });
    expect(notifyTurn).not.toHaveBeenCalled();
    expect(G()["pushAt.u2"]).toBeUndefined();
  });

  it("names the count when more than one round waits", async () => {
    // Ada was never told (no stamp) and Bo has sealed 3 and 4 already; Bo's
    // answer to 2 — the open round — tells her three rounds wait.
    store.set(`v2_groups/${GID}`, { ...G(), played: { r3: ["u1"], r4: ["u1"] } });
    await deliver("u1", `g_${GID}_r2`, { surface: "duo", gid: GID, round: 2, optionIdx: 0, guessIdx: 1 });
    expect(vi.mocked(notifyTurn).mock.calls[0][3]).toEqual([{ uid: "u2", waiting: 3 }]);
  });
});
