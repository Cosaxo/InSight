// @vitest-environment jsdom
//
// Your role, as a test result — one idea in two settings (D437).
//
// Two things are worth pinning here and they pull in opposite directions.
//
//   · THE FOLD IS REAL. Every dimension is a share over reveal documents
//     the app already fetches, so these cases build history by hand and
//     check the numbers rather than mocking the fold away. A role card
//     claims to be a measurement; if it were not, nothing on screen would
//     look different.
//   · THE INSTRUMENT MUST STAY MATCHABLE. `IS_archScores` assumes three
//     things about a type table — signatures extreme on the dims that
//     define them, shares summing to 100, and a baseline in IS_TEST_AVG
//     with exactly the fold's dim ids. All three are silent when broken:
//     the matcher still returns a type, just the wrong one. The registry
//     cases at the foot are the only thing that would notice.
import { describe, expect, it } from "vitest";
import {
  AXES, SEATS, blendRoles, castOf, duoRole, duoCastCount, groupRole, groupVoteCount, seatFor, seatTally,
  isCastReveal, isRatingReveal, ledgerClearsFloor, ledgerRow, MIN_DUO, MIN_GROUP, type BankLookup,
} from "./roles";
// @ts-expect-error TS7016 — untyped spec module
import { IS_ARCHETYPES, IS_archScores, IS_matchArchetype } from "../spec/archetype-data.js";
// @ts-expect-error TS7016 — untyped spec module
import { IS_TEST_AVG } from "../spec/test-definitions.js";

const ME = "me", THEM = "them";

const CAST = {
  kind: "cast",
  options: ["the one you tell first", "the one who gets you out the door", "the one you ask what to do", "the one who is just always there"],
  them: ["the one {name} tells first", "the one who gets {name} out the door", "the one {name} asks what to do", "the one who is just always there"],
  dims: ["trust", "spark", "judgement", "constancy"],
};
const bank: BankLookup = (qid) => ({
  c1: CAST,
  q1: { kind: "day", options: ["a", "b"] },
  r1: { kind: "pick", options: [], role: { id: "mastermind", label: "the mastermind", seat: "engine" } },
  r2: { kind: "pick", options: [], role: { id: "driver", label: "the getaway driver", seat: "hands" } },
  r3: { kind: "pick", options: [], role: { id: "inside", label: "the inside man", seat: "heart" } },
  p1: { kind: "pick", options: [] },                 // a plain pick: no role, no seat
  s1: { kind: "rate", options: ["Calm", "mostly Calm", "in between", "mostly Chaos", "Chaos"] },
  old: { kind: "pick", options: [], role: { id: "x", label: "the x" } }, // a role vote seeded before the seats
} as Record<string, unknown>)[qid] as ReturnType<BankLookup>;

/** A cast round: what I said they are, what they said I am, my guess. */
const cast = (d: string, mine: number, theirs: number, guess?: number, qid = "c1", extra: Record<string, unknown> = {}) => ({
  day: d, qid,
  votes: {
    [ME]: { optionIdx: mine, ...(guess == null ? {} : { guessIdx: guess }), ...(extra.mineLate ? { late: true } : {}) },
    [THEM]: { optionIdx: theirs, ...(extra.theirQid ? { qid: extra.theirQid as string } : {}) },
  },
});
/** A role vote: who each member named, by snapshot. */
const vote = (d: string, qid: string, named: Record<string, string | null>, extra: Record<string, { late?: boolean; qid?: string }> = {}) => ({
  day: d, qid,
  votes: Object.fromEntries(Object.entries(named).map(([u, who]) => [u, { optionIdx: 0, ...(who ? { pickUid: who } : {}), ...(extra[u] || {}) }])),
  members: [ME, "a", "b", "c"],
});

describe("castOf — the pair's cast rounds", () => {
  it("counts only cast rounds both answered blind on the same question", () => {
    const hist = [
      cast("2026-09-04", 0, 2, 2),
      { day: "2026-09-05", qid: "q1", votes: { [ME]: { optionIdx: 0, guessIdx: 1 }, [THEM]: { optionIdx: 1, guessIdx: 0 } } }, // an own round
      cast("2026-09-08", 1, 2, 0),
      cast("2026-09-12", 0, 2, 2, "c1", { mineLate: true }),   // late — not blind
      cast("2026-09-16", 0, 3, 3, "c1", { theirQid: "c9" }),   // a split round
      cast("2026-09-20", 0, 2),                                // no guess — still a cast
    ];
    const C = castOf(hist, ME, THEM, bank);
    expect(C.n).toBe(3);
    expect(C.rounds.map((r) => r.day)).toEqual(["2026-09-04", "2026-09-08", "2026-09-20"]);
    // they said I am option 2 three times; I said they are 0 twice, 1 once
    expect(C.theirs).toEqual([0, 0, 3, 0]);
    expect(C.mine).toEqual([2, 1, 0, 0]);
    expect(C.youAre).toEqual({ idx: 2, n: 3 });
    expect(C.theyAre).toEqual({ idx: 0, n: 2 });
    // of the two rounds I guessed, one landed
    expect(C.sawIt).toEqual({ right: 1, total: 2 });
    expect(C.them).toEqual(CAST.them);
  });

  it("names the latest answer on a tie — a person changes, and the newer word wins", () => {
    const hist = [cast("2026-09-04", 0, 0), cast("2026-09-08", 3, 3), cast("2026-09-12", 0, 3)];
    const C = castOf(hist, ME, THEM, bank);
    // they said 0 once and 3 twice → 3; I said 0 twice and 3 once → 0
    expect(C.youAre).toEqual({ idx: 3, n: 2 });
    expect(C.theyAre).toEqual({ idx: 0, n: 2 });
    const tied = castOf([cast("2026-09-04", 0, 0), cast("2026-09-08", 1, 1)], ME, THEM, bank);
    expect(tied.youAre).toEqual({ idx: 1, n: 1 });
  });

  it("reads nothing without a bank — no round can be told to be a cast", () => {
    const C = castOf([cast("2026-09-04", 0, 2, 2)], ME, THEM);
    expect(C.n).toBe(0);
    expect(C.youAre).toBeNull();
    expect(isCastReveal({ qid: "c1" }, bank)).toBe(true);
    expect(isCastReveal({ qid: "q1" }, bank)).toBe(false);
    expect(isRatingReveal({ qid: "s1" }, bank)).toBe(true);
  });
});

describe("duoRole — what you are to them", () => {
  it("refuses under the floor: two casts are not a person (the owner's 'a bit more than two')", () => {
    expect(MIN_DUO).toBe(3);
    const two = [cast("2026-09-04", 0, 0, 0), cast("2026-09-08", 0, 0, 0)];
    expect(duoRole(two, ME, THEM, bank)).toBeNull();
    expect(duoCastCount(two, ME, THEM, bank)).toBe(2);
    expect(duoRole([...two, cast("2026-09-12", 0, 0, 0)], ME, THEM, bank)).not.toBeNull();
  });

  it("reads the four dims as the share of casts THEY named you each thing, with the name in the receipt", () => {
    const hist = [cast("2026-09-04", 1, 0, 0), cast("2026-09-08", 1, 0, 2), cast("2026-09-12", 1, 2, 2), cast("2026-09-16", 1, 0, 0)];
    const r = duoRole(hist, ME, THEM, bank, "Ada")!;
    expect(r.n).toBe(4);
    expect(r.dims.map((d) => d.id)).toEqual(AXES.map((a) => a.id));
    const by = Object.fromEntries(r.dims.map((d) => [d.id, d]));
    expect(by.trust.value).toBe(75);
    expect(by.judgement.value).toBe(25);
    expect(by.spark.value).toBe(0);
    expect(by.trust.note).toBe("they said you are the one Ada tells first in 3 of 4 rounds");
    expect(by.spark.note).toBe("they said you are the one who gets Ada out the door in 0 of 4 rounds");
    // what I said is not a dim of MY role — it is theirs
    expect(r.theyAre).toEqual({ idx: 1, n: 4 });
    expect(r.youAre).toEqual({ idx: 0, n: 3 });
    // and the guesses are a receipt, not a dim
    expect(r.sawIt).toEqual({ right: 3, total: 4 });
    expect(r.dims.some((d) => /read|seen|like|steady/.test(d.id))).toBe(false);
  });

  it("puts the fallback noun where no name was given, and never the placeholder", () => {
    const hist = [cast("2026-09-04", 0, 0, 0), cast("2026-09-08", 0, 0, 0), cast("2026-09-12", 0, 0, 0)];
    const friend = duoRole(hist, ME, THEM, bank)!;
    expect(friend.dims[0].note).toBe("they said you are the one your friend tells first in 3 of 3 rounds");
    const partner = duoRole(hist, ME, THEM, bank, "", true)!;
    expect(partner.dims[0].note).toBe("they said you are the one your partner tells first in 3 of 3 rounds");
    expect(JSON.stringify(friend)).not.toMatch(/\{name\}/);
  });
});

describe("groupRole — your seat in the room", () => {
  it("refuses under the floor, and counts votes received rather than rounds", () => {
    expect(MIN_GROUP).toBe(2);
    const one = [vote("2026-09-01", "r1", { [ME]: "a", a: "me", b: "a", c: "a" })];
    expect(groupRole(one, ME, bank)).toBeNull();
    expect(groupVoteCount(one, ME, bank)).toBe(1);
  });

  it("reads the dims as the share of votes received per seat, off the snapshots", () => {
    const hist = [
      vote("2026-09-01", "r1", { [ME]: "a", a: "me", b: "me", c: "a" }),   // engine: 2 for me
      vote("2026-09-02", "r2", { [ME]: "a", a: "me", b: "a", c: "a" }),    // hands: 1 for me
      vote("2026-09-03", "r3", { [ME]: "a", a: "b", b: "c", c: "b" }),     // heart: none
      vote("2026-09-04", "s1", { [ME]: "a", a: "me", b: "me", c: "me" }),  // a rating — counts for nothing
      vote("2026-09-05", "p1", { [ME]: "a", a: "me", b: "me", c: "me" }),  // a plain pick — no seat
      vote("2026-09-06", "old", { [ME]: "a", a: "me", b: "me", c: "me" }), // a role without a seat — nothing
    ];
    const r = groupRole(hist, ME, bank)!;
    expect(r.n).toBe(3);
    expect(r.dims.map((d) => d.id)).toEqual(SEATS.map((s) => s.id));
    const by = Object.fromEntries(r.dims.map((d) => [d.id, d]));
    expect(by.engine.value).toBe(67);
    expect(by.hands.value).toBe(33);
    expect(by.heart.value).toBe(0);
    expect(by.engine.note).toBe("2 of 3 votes in the engine roles");
    expect(r.seat.id).toBe("engine");
    expect(r.seat.line).toBe("the one who gets things going");
    expect(r.shares).toEqual({ engine: 2, hands: 1, heart: 0, wild: 0 });
  });

  it("does not count a vote for yourself, a late vote, a vote on another question, or one with no snapshot", () => {
    const hist = [
      vote("2026-09-01", "r1", { [ME]: "me", a: "me", b: "me" }),                       // my own vote for me: out
      vote("2026-09-02", "r2", { [ME]: "a", a: "me", b: "me" }, { a: { late: true } }), // a's late vote: out
      vote("2026-09-03", "r3", { [ME]: "a", a: "me", b: "me" }, { b: { qid: "r9" } }),  // b answered another question: out
      vote("2026-09-04", "r1", { [ME]: "a", a: null, b: "me" }),                        // a's vote has no snapshot: out
    ];
    const T = seatTally(hist, ME, bank);
    expect(T.total).toBe(2 + 1 + 1 + 1);
    expect(T.shares).toEqual({ engine: 3, hands: 1, heart: 1, wild: 0 });
  });

  it("seats a member from the votes they received, and nobody under the floor", () => {
    const hist = [
      vote("2026-09-01", "r1", { [ME]: "a", a: "me", b: "me", c: "a" }),
      vote("2026-09-02", "r2", { [ME]: "a", a: "b", b: "a", c: "b" }),
      vote("2026-09-03", "r3", { [ME]: "a", a: "me", b: "me", c: "b" }),
      vote("2026-09-04", "r1", { [ME]: "b", a: "b", b: "c", c: "b" }),
    ];
    // a member under the floor is nobody's seat yet
    expect(seatFor(hist, "c", bank)).toBeNull();
    expect(seatFor(hist, "b", bank)!.seat.id).toBe("engine");
    // Who HOLDS a role is not this fold's to say — groupCast.roleVotes
    // reads it by the card's rule — so the tally carries no such list.
    expect(Object.keys(seatTally(hist, ME, bank)).sort()).toEqual(["shares", "total"]);
  });

  it("reads nothing without a bank — a vote's seat cannot be told", () => {
    const hist = [vote("2026-09-01", "r1", { [ME]: "a", a: "me", b: "me", c: "me" })];
    expect(groupRole(hist, ME)).toBeNull();
    expect(groupVoteCount(hist, ME)).toBe(0);
  });
});

// ── THE LEDGER (D445, ROLES-PLAN §3.3) ─────────────────────────────
//
// The server keeps the same counts on the group document as each round
// reveals, so the reading outlives the thirty reveals a page can hold.
// Two properties, both refusals: the fold reads the ledger ONLY once it
// clears the floor (below it, and on a room from before the ledger, the
// reveals in hand are the reading — the plan's forward-only catch-up),
// and a ledger that clears the floor is the reading even when the page
// disagrees — because the page is a WINDOW, and the ledger is the record.
describe("the ledger — the record that outlives the window", () => {
  const LEDGER = {
    [ME]: { casts: 5, axes: { trust: 3, spark: 1, judgement: 1 }, saw: { right: 4, total: 5 }, castQid: "c1" },
    [THEM]: { casts: 5, axes: { constancy: 5 }, saw: { right: 1, total: 2 }, castQid: "c1" },
  };
  // A window that says something else — one cast, on the constancy axis.
  const window = [cast("2026-09-04", 0, 3, 3)];

  it("a 1v1 reads its dims, its count and the receipts off the ledger once it clears the floor", () => {
    const r = duoRole(window, ME, THEM, bank, "Liv", false, LEDGER)!;
    expect(r.n).toBe(5);
    expect(r.dims.map((d) => [d.id, d.value])).toEqual([["trust", 60], ["spark", 20], ["judgement", 20], ["constancy", 0]]);
    // the them forms come off the bank by the cast question the row names
    expect(r.dims[0].note).toBe("they said you are the one Liv tells first in 3 of 5 rounds");
    expect(r.sawIt).toEqual({ right: 4, total: 5 });
    expect(duoCastCount(window, ME, THEM, bank, LEDGER)).toBe(5);
    // …and the row is the member's own: the other reads their own axes.
    expect(duoRole(window, THEM, ME, bank, null, false, LEDGER)!.dims[3].value).toBe(100);
  });

  it("…and draws the same reading with NO history at all — the room the device never paged", () => {
    const r = duoRole([], ME, THEM, bank, "Liv", false, LEDGER)!;
    expect(r.n).toBe(5);
    expect(r.dims[0].note).toBe("they said you are the one Liv tells first in 3 of 5 rounds");
    expect(ledgerClearsFloor(LEDGER, ME, "duo")).toBe(true);
  });

  it("below the floor the reveals in hand are the reading — the plan's forward-only catch-up", () => {
    const thin = { [ME]: { casts: 2, axes: { trust: 2 }, saw: { right: 0, total: 0 }, castQid: "c1" } };
    // The window holds three casts, all naming constancy: the reveals win.
    const three = [cast("2026-09-04", 0, 3, 3), cast("2026-09-08", 0, 3), cast("2026-09-12", 1, 3, 1)];
    const r = duoRole(three, ME, THEM, bank, "Liv", false, thin)!;
    expect(r.n).toBe(3);
    expect(r.dims[3].value).toBe(100);
    expect(duoCastCount(three, ME, THEM, bank, thin)).toBe(3);
    expect(ledgerClearsFloor(thin, ME, "duo")).toBe(false);
    // …and with the window under the floor too, nobody is named.
    expect(duoRole(window, ME, THEM, bank, "Liv", false, thin)).toBeNull();
    expect(duoCastCount(window, ME, THEM, bank, thin)).toBe(1);
  });

  it("a group reads its seats and its count off the ledger once it clears the floor", () => {
    const L = { [ME]: { votes: 6, seats: { engine: 4, heart: 2 } }, a: { votes: 1, seats: { wild: 1 } } };
    // The page names ME the hands twice: the ledger is the reading.
    const page = [vote("2026-09-01", "r2", { [ME]: "a", a: "me", b: "me" })];
    const mine = groupRole(page, ME, bank, L)!;
    expect(mine.n).toBe(6);
    expect(mine.seat.id).toBe("engine");
    expect(mine.shares).toEqual({ engine: 4, hands: 0, heart: 2, wild: 0 });
    expect(mine.dims.find((d) => d.id === "engine")!.note).toBe("4 of 6 votes in the engine roles");
    expect(groupVoteCount(page, ME, bank, L)).toBe(6);
    expect(seatFor(page, ME, bank, L)!.seat.id).toBe("engine");
    expect(ledgerClearsFloor(L, ME, "group")).toBe(true);
    // …and a member whose row is under the floor is read off the page,
    // where two votes name them the hands.
    expect(seatFor(page, "a", bank, L)).toBeNull();
    expect(ledgerClearsFloor(L, "a", "group")).toBe(false);
    expect(seatFor([...page, vote("2026-09-02", "r2", { [ME]: "a", b: "a" })], "a", bank, L)!.seat.id).toBe("hands");
  });

  it("no ledger, a ledger that is not a map, and a row that is not a row all read as no ledger — never as zeros", () => {
    const hist = [cast("2026-09-04", 0, 0, 0), cast("2026-09-08", 1, 0, 2), cast("2026-09-12", 0, 2, 2)];
    for (const bad of [undefined, null, 7, "x", [], { [ME]: 3 }, { [ME]: null }]) {
      expect(ledgerRow(bad, ME)).toBeNull();
      expect(duoRole(hist, ME, THEM, bank, null, false, bad)!.n).toBe(3);
      expect(ledgerClearsFloor(bad, ME, "duo")).toBe(false);
    }
    expect(ledgerRow({ [ME]: { casts: 1 } }, null)).toBeNull();
  });
});

describe("blendRoles", () => {
  it("weights by what is behind each setting, so a thin one cannot swing the portrait", () => {
    const heavy = { n: 12, dims: [{ id: "trust", label: "Trust", value: 100, note: "" }] };
    const thin = { n: 3, dims: [{ id: "trust", label: "Trust", value: 0, note: "" }] };
    expect(blendRoles([heavy, thin])!.dims[0].value).toBe(80);
    expect(blendRoles([heavy, thin])!.n).toBe(15);
  });

  it("drops the receipts, because a count is false of an average", () => {
    const a = { n: 3, dims: [{ id: "trust", label: "Trust", value: 100, note: "3 of 3" }] };
    expect(blendRoles([a, a])!.dims[0].note).toBe("");
  });

  it("returns null with nothing to blend", () => {
    expect(blendRoles([])).toBeNull();
    expect(blendRoles([{ n: 0, dims: [] }])).toBeNull();
  });
});

describe("the matcher refuses a type whose defining dim is absent", () => {
  it("scores it at Infinity and never picks it", () => {
    // The Engine is DEFINED by `engine` (76 against a baseline of 25):
    // hand the matcher dims without it and the type is out of the running.
    const engine = (IS_ARCHETYPES.group.list as { name: string }[]).findIndex((t) => t.name === "The Engine");
    const sc = IS_archScores("group", [{ id: "hands", value: 80 }, { id: "heart", value: 10 }, { id: "wild", value: 10 }]);
    expect(sc[engine].eligible).toBe(false);
    expect(sc[engine].score).toBe(Infinity);
    const m = IS_matchArchetype("group", [{ id: "hands", value: 80 }, { id: "heart", value: 10 }, { id: "wild", value: 10 }]);
    expect(m.list[m.idx].name).not.toBe("The Engine");
  });

  it("matches the pure seat when the votes all fall in it, and the blend when they split", () => {
    const pure = IS_matchArchetype("group", [{ id: "engine", value: 100 }, { id: "hands", value: 0 }, { id: "heart", value: 0 }, { id: "wild", value: 0 }]);
    expect(pure.list[pure.idx].name).toBe("The Engine");
    const blend = IS_matchArchetype("group", [{ id: "engine", value: 50 }, { id: "hands", value: 50 }, { id: "heart", value: 0 }, { id: "wild", value: 0 }]);
    expect(blend.list[blend.idx].name).toBe("The Doer");
    const even = IS_matchArchetype("group", [{ id: "engine", value: 25 }, { id: "hands", value: 25 }, { id: "heart", value: 25 }, { id: "wild", value: 25 }]);
    expect(even.list[even.idx].name).toBe("The Ensemble");
    const confidant = IS_matchArchetype("duo", [{ id: "trust", value: 75 }, { id: "spark", value: 0 }, { id: "judgement", value: 25 }, { id: "constancy", value: 0 }]);
    expect(confidant.list[confidant.idx].name).toBe("The Confidant");
  });
});

describe("the role instruments are matchable", () => {
  for (const kind of ["duo", "group"]) {
    it(`${kind}: shares sum to 100, so the rarity tax reads a distribution`, () => {
      const list = IS_ARCHETYPES[kind].list as { share: number }[];
      expect(list.reduce((a, t) => a + t.share, 0)).toBe(100);
    });

    it(`${kind}: every signature covers exactly the fold's dims, and the baseline is a quarter each`, () => {
      const want = Object.keys(IS_TEST_AVG[kind]).sort();
      expect(want).toEqual((kind === "duo" ? AXES.map((a) => a.id) : SEATS.map((s) => s.id)).slice().sort());
      for (const id of want) expect(IS_TEST_AVG[kind][id]).toBe(25);
      for (const t of IS_ARCHETYPES[kind].list as { name: string; sig: Record<string, number> }[]) {
        expect(Object.keys(t.sig).sort(), `${t.name} signature`).toEqual(want);
      }
    });

    it(`${kind}: every type is extreme on a dim against the instrument's own baseline, but the one neutral type`, () => {
      // The instruments are shares, so the line a type is extreme against
      // is 25, not 50: a pure seat sits at 76, a blend at 42/42. Exactly
      // one type per table is the neutral — a real place to land when the
      // shares are even — and it is the only one allowed at the baseline.
      const neutral = (IS_ARCHETYPES[kind].list as { name: string; sig: Record<string, number> }[])
        .filter((t) => Object.values(t.sig).every((v) => v === 25));
      expect(neutral.map((t) => t.name)).toEqual([kind === "duo" ? "The Everything" : "The Ensemble"]);
      for (const t of IS_ARCHETYPES[kind].list as { name: string; sig: Record<string, number> }[]) {
        if (neutral.includes(t)) continue;
        const far = Math.max(...Object.values(t.sig).map((v) => Math.abs(v - 25)));
        expect(far, `${t.name} is near-neutral on every dim`).toBeGreaterThanOrEqual(15);
      }
    });

    it(`${kind}: no two types share a signature`, () => {
      const seen = new Set<string>();
      for (const t of IS_ARCHETYPES[kind].list as { name: string; sig: Record<string, number> }[]) {
        const key = JSON.stringify(t.sig);
        expect(seen.has(key), `${t.name} duplicates another signature`).toBe(false);
        seen.add(key);
      }
    });
  }

  it("the tables are the owner's 2026-09-09 design's: ten for a 1v1, eleven for a group", () => {
    expect((IS_ARCHETYPES.duo.list as unknown[]).length).toBe(10);
    expect((IS_ARCHETYPES.group.list as unknown[]).length).toBe(11);
    const names = (IS_ARCHETYPES.group.list as { name: string }[]).map((t) => t.name);
    expect(names).toContain("The Engine");
    expect(names).toContain("The Wildcard");
    expect(names).not.toContain("The Quiet Majority");
  });
});
