// reveal-day.test.ts — the round reveal, executed rather than described.
// (The file keeps its name from when a reveal was a day; the subject is
// `revealRound` since ROUNDS-PLAN / D426.)
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

const { revealRound, ledgerRemoval } = await import("./v2social");

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

  it("clears the clock on a due round nobody is in, instead of leaving it in the scan forever", async () => {
    // THE STUCK GROUP. `playedRemovals` empties `played.r{n}` when the
    // only member who answered leaves or is erased, and nothing clears
    // `roundDeadlineAt`. `roundReveals` is `played >= 1 && …`, so with
    // zero players it is false whatever `force` says — and the branch
    // that clears the clock lives INSIDE the transaction the page gate
    // was returning before it. The deadline scan orders by that field
    // ascending, so a never-moving deadline sorts permanently at the
    // head: at GROUP_SCAN_CAP the run breaks before reaching any live due
    // round, and reveals stop for everybody.
    store.set(`v2_groups/${GID}`, {
      mode: "duo", memberUids: ["u1", "u2"], round: ROUND,
      played: { [KEY]: [] }, streak: 2, ...DUE,
    });
    // no answers staged at all — the round is due and empty

    const revealed = await revealRound(group as unknown as FirebaseFirestore.DocumentSnapshot);

    expect(revealed, "an empty round has nothing to reveal").toBe(false);
    expect(attempts, "the transaction never opened, so nothing could clear the clock").toBe(1);
    const g = store.get(`v2_groups/${GID}`)!;
    // The DELETE SENTINEL by name, not "no longer a Timestamp": the raw
    // fixture value is a plain number, so "not a Timestamp" was also true
    // of a clock nothing had cleared — a test of the fixture wearing the
    // fix's name. `DeleteTransform` is what FieldValue.delete() is.
    expect((g.roundDeadlineAt as object)?.constructor?.name,
      "the clock is still set — the scan will re-read this group forever").toBe("DeleteTransform");
    expect((g.roundOpenedAt as object)?.constructor?.name).toBe("DeleteTransform");
    // …and the round itself is untouched: its question is unburned and it
    // reopens the moment somebody answers.
    expect(g.round).toBe(ROUND);
    expect(g.streak).toBe(2);
    expect(store.has(`v2_groups/${GID}/reveals/${KEY}`), "an empty round published a reveal").toBe(false);
  });

  it("a round that is NOT due and has nobody in it costs no transaction", async () => {
    // The other side of the same gate: the change is "a DUE round always
    // opens the transaction", not "every round does". A future round with
    // nobody in it must still be free.
    store.set(`v2_groups/${GID}`, {
      mode: "duo", memberUids: ["u1", "u2"], round: ROUND,
      played: { [KEY]: [] }, streak: 2,
      roundDeadlineAt: Date.now() + 3_600_000, roundOpenedAt: Date.now(),
    });
    expect(await revealRound(group as unknown as FirebaseFirestore.DocumentSnapshot)).toBe(false);
    expect(attempts, "a round with time left opened a transaction").toBe(0);
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

// ── THE STREAK'S PRESENT TENSE ──────────────────────────────────────
//
// Main's 2026-09-08 night review found `movesPresentState` pinned as a
// pure function and NEITHER of its call sites executed by anything — the
// day model's reveal site and its settle site. Under rounds there is ONE
// site: revealRound's settle. The day's settle path went with
// `pendingDays` (ROUNDS-PLAN §0a); nothing zeroes a streak any more, and
// `nextStreak` alone resets it on a gap. So the guard left to hold is the
// reveal site's: a SECOND reveal on one day — a pair can reveal several
// rounds in a day now — leaves the streak and the present where they are.
describe("a second reveal on the same day cannot move the present", () => {
  const TODAY = Date.UTC(2026, 8, 8, 12);   // 2026-09-08
  it("keeps a 40-day streak when another round reveals the same day", async () => {
    store.set(`v2_groups/${GID}`, {
      mode: "group", memberUids: ["u1", "u2"], round: ROUND,
      played: { [KEY]: ["u1", "u2"] }, streak: 40, lastRevealDay: "2026-09-08", ...DUE,
    });
    store.set(...answer("u1", "qA", 0));
    store.set(...answer("u2", "qA", 1));
    expect(await revealRound(group as unknown as FirebaseFirestore.DocumentSnapshot, { nowMs: TODAY })).toBe(true);
    const g = store.get(`v2_groups/${GID}`)!;
    expect(g.streak, "a second reveal on one day moved the streak").toBe(40);
    expect(g.lastRevealDay, "the present tense moved for a day it was already on").toBe("2026-09-08");
    // The reveal itself still happens — the guard is about the group's
    // present tense, never about whether the round publishes.
    expect(store.get(`v2_groups/${GID}/reveals/${KEY}`), "the round did not publish").toBeTruthy();
  });

  it("…and the next day still moves it, which is what the guard is for", async () => {
    // THE CONTROL. Everything above asserts that a number did not change,
    // which is also what a reveal that stopped touching the streak looks
    // like. Same group, its last reveal yesterday: the streak must advance
    // and today must become the present.
    store.set(`v2_groups/${GID}`, {
      mode: "group", memberUids: ["u1", "u2"], round: ROUND,
      played: { [KEY]: ["u1", "u2"] }, streak: 40, lastRevealDay: "2026-09-07", ...DUE,
    });
    store.set(...answer("u1", "qA", 0));
    store.set(...answer("u2", "qA", 1));
    expect(await revealRound(group as unknown as FirebaseFirestore.DocumentSnapshot, { nowMs: TODAY })).toBe(true);
    const g = store.get(`v2_groups/${GID}`)!;
    expect(g.streak, "a consecutive day did not extend the streak").toBe(41);
    expect(g.lastRevealDay).toBe("2026-09-08");
  });
});

// ── WHOSE NAME THE REVEAL CARRIES ───────────────────────────────────
//
// The reveal document's `names` map is narrowed to `revealMembersFor(...)`
// — the roster minus anyone who joined after the round OPENED and did not
// play. Main's night review found reverting that loop to the whole roster
// left the functions suite green, and it matters because `names` is a
// DISPLAY NAME in a document every signed-in user may read, and
// `deleteAccount` sweeps reveals by walking `members`: a person named in a
// reveal whose `members` array does not carry them is a person erasure
// never reaches. Ported from the day to the round: the seam is
// `roundOpenedAt` now, not the day's end.
describe("the reveal names only the people its members array carries", () => {
  const OPENED = Date.now() - 90_000_000;
  // A Firestore Timestamp, near enough: `joinedAtMs` reads `toMillis()` and
  // DROPS anything without it, and a dropped join time means "unknown",
  // which keeps the member. A fixture of raw numbers would therefore keep
  // everybody and pass whatever the narrowing did.
  const at = (ms: number) => ({ toMillis: () => ms });
  const room = (played: string[]) => {
    store.set(`v2_groups/${GID}`, {
      mode: "group", memberUids: ["u1", "u2", "u3"], round: ROUND, streak: 0,
      played: { [KEY]: played },
      roundOpenedAt: at(OPENED), roundDeadlineAt: at(Date.now() - 1000),
      // u3 arrived after the round opened — they were not in the room for it.
      memberJoinedAt: { u1: at(OPENED - 86400000), u2: at(OPENED - 86400000), u3: at(OPENED + 3600000) },
    });
    store.set("v2_users/u1", { displayName: "Ada" });
    store.set("v2_users/u2", { displayName: "Bo" });
    store.set("v2_users/u3", { displayName: "Cai" });
  };

  it("leaves out someone who joined after the round opened and did not play", async () => {
    room(["u1", "u2"]);
    store.set(...answer("u1", "qA", 0));
    store.set(...answer("u2", "qA", 1));
    expect(await revealRound(group as unknown as FirebaseFirestore.DocumentSnapshot)).toBe(true);
    const reveal = store.get(`v2_groups/${GID}/reveals/${KEY}`)!;
    expect(Object.keys(reveal.names as Doc).sort(), "the reveal names a non-member").toEqual(["u1", "u2"]);
    // The two must agree, and THIS is the reason: erasure walks `members`,
    // so a name outside it is a name erasure cannot find.
    expect((reveal.members as string[]).slice().sort()).toEqual(["u1", "u2"]);
    expect(JSON.stringify(reveal.names), "a display name is in a world-readable document that erasure will never sweep").not.toContain("Cai");
  });

  it("…and DOES name a late joiner who actually played", async () => {
    // THE CONTROL, and the narrowing's own rule: playing puts you in the
    // room whatever the timestamps say. Without this the case above passes
    // the day the map is narrowed to nothing at all.
    room(["u1", "u2", "u3"]);
    store.set(...answer("u1", "qA", 0));
    store.set(...answer("u2", "qA", 1));
    store.set(...answer("u3", "qA", 2));
    expect(await revealRound(group as unknown as FirebaseFirestore.DocumentSnapshot)).toBe(true);
    const reveal = store.get(`v2_groups/${GID}/reveals/${KEY}`)!;
    expect(Object.keys(reveal.names as Doc).sort(), "a late joiner who answered was left out of their own reveal").toEqual(["u1", "u2", "u3"]);
    expect(JSON.stringify(reveal.names)).toContain("Cai");
  });
});

// ── THE ROLE LEDGER (D445, ROLES-PLAN §3.3) ─────────────────────────
//
// The reveal reads the round's question inside its transaction and, when
// the round was a cast or a seated role vote, writes each member's running
// counts onto the group document in the same settle update that advances
// the round. The arithmetic is pure.test.ts's (foldRoleLedger); what is
// pinned here is that the reveal WIRES it — which question it reads, that
// the map rides the settle, that a re-run cannot count a round twice, and
// that a round which moved nothing leaves the field exactly as it was.
describe("the role ledger rides the reveal", () => {
  const CAST = { topic: "cast", options: ["a", "b", "c", "d"], dims: ["trust", "spark", "judgement", "constancy"] };
  const ROLE = { topic: "pick", options: [], role: { id: "mind", label: "the mastermind", seat: "engine" } };

  it("a 1v1's cast round writes both rows — what the other said, and each one's guess", async () => {
    store.set(`v2_groups/${GID}`, {
      mode: "duo", memberUids: ["u1", "u2"], round: ROUND,
      played: { [KEY]: ["u1", "u2"] }, streak: 0, ...DUE,
    });
    store.set("v2_questions/qC", CAST);
    // u1 says u2 is spark and guesses u2 will say trust; u2 says u1 is
    // trust and guesses judgement.
    store.set(...answer("u1", "qC", 1, { guessIdx: 0 }));
    store.set(...answer("u2", "qC", 0, { guessIdx: 2 }));
    expect(await revealRound(group as unknown as FirebaseFirestore.DocumentSnapshot)).toBe(true);
    const g = store.get(`v2_groups/${GID}`)!;
    expect(g.ledger).toEqual({
      u1: { casts: 1, axes: { trust: 1 }, saw: { right: 1, total: 1 }, castQid: "qC" },
      u2: { casts: 1, axes: { spark: 1 }, saw: { right: 0, total: 1 }, castQid: "qC" },
    });
    // …in the SAME update as the advance: one write, not a second.
    expect(g.round).toBe(ROUND + 1);
    // The reveal itself carries no ledger — it is the group document's.
    expect(store.get(`v2_groups/${GID}/reveals/${KEY}`)!.ledger).toBeUndefined();
  });

  it("a group's role vote writes a row for whom the snapshot names, accumulating onto what stood", async () => {
    store.set(`v2_groups/${GID}`, {
      mode: "group", memberUids: ["u1", "u2", "u3"], round: ROUND,
      played: { [KEY]: ["u1", "u2", "u3"] }, streak: 0, ...DUE,
      ledger: { u2: { votes: 1, seats: { hands: 1 } } },
    });
    store.set("v2_questions/qR", ROLE);
    store.set(...answer("u1", "qR", 1, { pickUid: "u2" }));
    store.set(...answer("u2", "qR", 1, { pickUid: "u2" }));   // a vote for yourself
    store.set(...answer("u3", "qR", 0, { pickUid: "u1" }));
    expect(await revealRound(group as unknown as FirebaseFirestore.DocumentSnapshot)).toBe(true);
    expect(store.get(`v2_groups/${GID}`)!.ledger).toEqual({
      u2: { votes: 2, seats: { hands: 1, engine: 1 } },
      u1: { votes: 1, seats: { engine: 1 } },
    });
  });

  it("a re-run that finds the reveal standing counts nothing twice — the create guard is the ledger's too", async () => {
    const before = { u1: { casts: 3, axes: { trust: 3 }, saw: { right: 1, total: 2 }, castQid: "qC" } };
    store.set(`v2_groups/${GID}`, {
      mode: "duo", memberUids: ["u1", "u2"], round: ROUND,
      played: { [KEY]: ["u1", "u2"] }, streak: 0, ...DUE, ledger: before,
    });
    store.set("v2_questions/qC", CAST);
    store.set(...answer("u1", "qC", 1, { guessIdx: 0 }));
    store.set(...answer("u2", "qC", 0, { guessIdx: 2 }));
    // The contended shape: attempt 1 folds and is thrown away, the winner's
    // reveal lands, attempt 2 finds it and writes nothing.
    contendWith = { path: `v2_groups/${GID}/reveals/${KEY}`, doc: { round: ROUND, qid: "qC" } };
    expect(await revealRound(group as unknown as FirebaseFirestore.DocumentSnapshot)).toBe(false);
    expect(attempts).toBe(2);
    expect(store.get(`v2_groups/${GID}`)!.ledger, "a lost attempt's fold reached the document").toEqual(before);
    // …and a plain re-run against the standing reveal, the same.
    expect(await revealRound(group as unknown as FirebaseFirestore.DocumentSnapshot)).toBe(false);
    expect(store.get(`v2_groups/${GID}`)!.ledger).toEqual(before);
  });

  it("a rating round, an own round and a question the operator deleted leave the field untouched", async () => {
    const before = { u1: { votes: 3, seats: { engine: 3 } } };
    const stage = (qid: string, q: Doc | null) => {
      store.set(`v2_groups/${GID}`, {
        mode: "group", memberUids: ["u1", "u2"], round: ROUND,
        played: { [KEY]: ["u1", "u2"] }, streak: 0, ...DUE, ledger: before,
      });
      store.delete(`v2_groups/${GID}/reveals/${KEY}`);
      if (q) store.set(`v2_questions/${qid}`, q); else store.delete(`v2_questions/${qid}`);
      store.set(...answer("u1", qid, 1, { pickUid: "u2" }));
      store.set(...answer("u2", qid, 0, { pickUid: "u1" }));
    };
    stage("qS", { topic: "rate", options: ["Calm", "mostly Calm", "in between", "mostly Chaos", "Chaos"] });
    expect(await revealRound(group as unknown as FirebaseFirestore.DocumentSnapshot)).toBe(true);
    expect(store.get(`v2_groups/${GID}`)!.ledger).toBe(before);   // the very object: never rewritten
    stage("qO", { topic: "classic", options: ["a", "b"] });
    expect(await revealRound(group as unknown as FirebaseFirestore.DocumentSnapshot)).toBe(true);
    expect(store.get(`v2_groups/${GID}`)!.ledger).toBe(before);
    stage("qGone", null);
    expect(await revealRound(group as unknown as FirebaseFirestore.DocumentSnapshot)).toBe(true);
    expect(store.get(`v2_groups/${GID}`)!.ledger).toBe(before);
  });

  it("a member's row leaves with them — the update entry leave and erasure both spread", () => {
    expect(Object.keys(ledgerRemoval({ u1: { casts: 2 }, u2: { casts: 2 } }, "u1"))).toEqual(["ledger.u1"]);
    expect((ledgerRemoval({ u1: { casts: 2 } }, "u1")["ledger.u1"] as object).constructor.name).toBe("DeleteTransform");
    expect(ledgerRemoval({ u2: { casts: 2 } }, "u1")).toEqual({});
    expect(ledgerRemoval(undefined, "u1")).toEqual({});
    expect(ledgerRemoval("nonsense", "u1")).toEqual({});
  });
});
