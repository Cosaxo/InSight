// Unit tests for the pure deck-shaping logic extracted from live.ts.
// Runs in plain node (no browser, no firebase, no mocks): every function
// under test takes explicit inputs.

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildS,
  computeDeckIds,
  computeDeckSeqs,
  countsFor,
  dayIndex,
  dayLabel,
  DECK_DAYS,
  DECK_EPOCH,
  splitBanks,
  duelQFor,
  isRatingRound,
  groupPhase,
  duoKind,
  castText,
  gHash,
  hasPublishedCounts,
  isCore,
  rankCrowdFor,
  OPTION_COLORS,
  utcDayIndex,
} from "./deck";
import type { QuestionDoc, VoteContext } from "./deck";

function qd(id: string, over: Partial<QuestionDoc> = {}): QuestionDoc & { id: string } {
  return {
    id,
    surface: "daily",
    seq: 0,
    type: "vote",
    prompt: "Prompt " + id,
    options: ["A", "B", "C"],
    topic: null,
    test: null,
    active: true,
    ...over,
  };
}

const noVote: VoteContext = { agg: undefined, mine: undefined, pending: false };

// 2026-07-15 is a Wednesday (local-time constructor keeps tests
// timezone-agnostic: dayLabel/dayIndex are local-clock functions).
const WED = new Date(2026, 6, 15, 12, 30);

describe("countsFor (own-vote subtraction)", () => {
  const options = ["A", "B", "C"];

  it("subtracts the viewer's own vote once it is folded in (not pending)", () => {
    const out = countsFor(options, {
      agg: { counts: { "0": 5, "1": 2 } },
      mine: "0",
      pending: false,
    });
    expect(out).toEqual([4, 2, 0]);
  });

  it("does NOT subtract an optimistic (pending) vote", () => {
    const out = countsFor(options, {
      agg: { counts: { "0": 5, "1": 2 } },
      mine: "0",
      pending: true,
    });
    expect(out).toEqual([5, 2, 0]);
  });

  it("subtracts a pending EDIT from the option it moved AWAY from", () => {
    // `pending` means "the published aggregate does not hold this answer
    // yet", which is true of a create and false of a D86 edit: the
    // trigger folded the original, so the crowd already counts this
    // device at the old option. Without this arm the old option kept the
    // viewer's vote while the UI layer added its +1 to the new one — a
    // total one higher than the crowd, and every share on the card drawn
    // over a denominator that does not exist.
    const out = countsFor(options, {
      agg: { counts: { "0": 5, "1": 2 } },
      mine: "1",
      pending: true,
      pendingFrom: "0",
    });
    expect(out).toEqual([4, 2, 0]);
    // The reader's arithmetic, said once: five plus two is what the crowd
    // holds, and after the UI adds the viewer back at their new option the
    // card totals seven — not eight.
    expect(out.reduce((a, b) => a + b, 0) + 1).toBe(7);
  });

  it("…and a pending CREATE still subtracts nothing — the control", () => {
    // The case directly above must not become "always subtract": a first
    // answer is not in the aggregate at all, and taking a vote out of it
    // would show the crowd one short.
    const out = countsFor(options, {
      agg: { counts: { "0": 5, "1": 2 } },
      mine: "1",
      pending: true,
    });
    expect(out).toEqual([5, 2, 0]);
  });

  it("…and an edit whose origin is gone subtracts nothing either", () => {
    // A restored pending answer (D357) comes back with no origin index —
    // the process that knew it died — so the old behaviour stands for it
    // rather than guessing an option to take a vote from.
    const out = countsFor(options, {
      agg: { counts: { "0": 5, "1": 2 } },
      mine: "1",
      pending: true,
      pendingFrom: undefined,
    });
    expect(out).toEqual([5, 2, 0]);
  });

  it("never lets a count go below zero", () => {
    const out = countsFor(options, {
      agg: { counts: { "1": 0 } },
      mine: "1",
      pending: false,
    });
    expect(out).toEqual([0, 0, 0]);
  });

  it("only subtracts from the option the viewer chose", () => {
    const out = countsFor(options, {
      agg: { counts: { "0": 3, "1": 3, "2": 3 } },
      mine: "2",
      pending: false,
    });
    expect(out).toEqual([3, 3, 2]);
  });

  it("handles a missing agg and missing counts as all zeros", () => {
    expect(countsFor(options, noVote)).toEqual([0, 0, 0]);
    expect(countsFor(options, { agg: {}, mine: undefined, pending: false })).toEqual([0, 0, 0]);
  });
});

describe("hasPublishedCounts", () => {
  it("is false when the agg doc is missing or empty", () => {
    expect(hasPublishedCounts(undefined)).toBe(false);
    expect(hasPublishedCounts({})).toBe(false);
    expect(hasPublishedCounts({ total: 0 })).toBe(false);
  });

  it("is true once the aggregate carries a positive total", () => {
    // The one answer that used to be withheld under the k-floor is now
    // the one that switches the counts on (D98).
    expect(hasPublishedCounts({ total: 1, counts: { "0": 1 } })).toBe(true);
    expect(hasPublishedCounts({ total: 42 })).toBe(true);
  });
});

describe("buildS", () => {
  it("shapes a question into the UI's S form", () => {
    const q = qd("q1", { topic: "culture", test: "big5" });
    const s = buildS(q, 0, {
      agg: { counts: { "0": 4, "2": 1 }, total: 5 },
      mine: "0",
      pending: false,
    }, WED);
    expect(s).toEqual({
      id: "q1",
      cat: "culture",
      text: "Prompt q1",
      dayLabel: "Today",
      options: [
        { id: "0", label: "A", count: 3, color: OPTION_COLORS[0] },
        { id: "1", label: "B", count: 0, color: OPTION_COLORS[1] },
        { id: "2", label: "C", count: 1, color: OPTION_COLORS[2] },
      ],
      comments: [],
      friends: [],
      live: true,
      noCountsYet: false,
      test: "big5",
      // Resolved by isCore at build time (D161): this fixture is not a
      // feed question, so it is core by construction.
      coreCorpus: true,
      // D100's bank fields, carried through so the Mirror can group by
      // subject and tell an ordinal question from a categorical one.
      // Undefined here because `qd` builds a pre-D100 doc — which is also
      // the shape every question seeded before D100 still has in
      // Firestore, so this is the real absent case rather than a gap in
      // the fixture.
      branch: undefined,
      sub: undefined,
      type: "vote",
    });
  });

  it("carries the background paragraph when the doc has one (D306)", () => {
    // The field was seeded (D281) and the feed read it while this deck
    // dropped it — so the daily's About sheet could never lead with it.
    const q = qd("q1", { bg: "Background the sheet leads with." });
    const s = buildS(q, 0, { agg: undefined, mine: undefined, pending: false }, WED);
    expect(s.bg).toBe("Background the sheet leads with.");
  });

  it("carries the bank's subject path and type when the doc has them", () => {
    // The other half of the case above: a doc seeded since D100. Asserted
    // separately because `toEqual` treats an absent key and an undefined
    // one as equal, so the case above cannot tell "not carried" from
    // "carried as undefined" — and this one would fail if buildS simply
    // stopped copying the fields.
    const s = buildS(
      qd("q9", { topic: "deep", branch: "Mind", sub: "Outlook", type: "rating" }),
      2,
      { agg: undefined, mine: undefined, pending: false },
      WED,
    );
    expect(s.branch).toBe("Mind");
    expect(s.sub).toBe("Outlook");
    expect(s.type).toBe("rating");
  });

  it("leaves the day label blank for a question off the pager", () => {
    // The Mirror's archive (LIVE.aggregated) reaches any day, and nothing
    // it holds dates an answer — so `back: null` means "no label" rather
    // than defaulting to Today, which would be a claim.
    const s = buildS(qd("q1", {}), null, { agg: undefined, mine: undefined, pending: false }, WED);
    expect(s.dayLabel).toBe("");
  });

  it("keeps a pending optimistic vote in the counts", () => {
    const q = qd("q1");
    const s = buildS(q, 0, {
      agg: { counts: { "1": 7 } },
      mine: "1",
      pending: true,
    }, WED);
    expect(s.options.map((o) => o.count)).toEqual([0, 7, 0]);
  });

  it("marks noCountsYet when the agg is absent", () => {
    const s = buildS(qd("q1"), 0, noVote, WED);
    expect(s.noCountsYet).toBe(true);
  });

  it("cycles the option palette past its length", () => {
    const q = qd("q1", { options: ["a", "b", "c", "d", "e", "f", "g"] });
    const s = buildS(q, 0, noVote, WED);
    expect(s.options[5].color).toBe(OPTION_COLORS[0]);
    expect(s.options[6].color).toBe(OPTION_COLORS[1]);
  });

  it("labels cards by how many days back they sit", () => {
    expect(buildS(qd("q"), 1, noVote, WED).dayLabel).toBe("Yesterday");
    expect(buildS(qd("q"), 2, noVote, WED).dayLabel).toBe("Mon");
  });
});

describe("splitBanks (per-surface allowlists)", () => {
  it("a learn card lands in the learn bank and nowhere else (D32 fencing)", () => {
    // A learn card leaking into daily/feed would render as an opinion vote
    // with a secretly right answer; the allowlists make that structurally
    // impossible, and this case is what notices if one of them widens.
    const banks = splitBanks([
      qd("daily-000"),
      qd("feed-f01", { surface: "feed" }),
      qd("test-big5-00", { surface: "test" }),
      qd("group-gu0", { surface: "group" }),
      qd("group-gp0", { surface: "group", type: "pick", topic: "pick", options: [] }),
      qd("duo-000", { surface: "duo" }),
      qd("learn-cell1", { surface: "learn", options: ["a", "b", "c", "d"] }),
      // D12's exclusion, RETIRED at D233: an answer can carry an order now,
      // so a rank doc rides the feed lane like any playable question. The
      // pin flipped with the pipeline — this line failing again would mean
      // the exclusion quietly returned.
      qd("feed-f03", { surface: "feed", type: "rank" }),
      qd("daily-bad", { options: [] }), // unplayable — dropped
      // D14 gone live: a catalog doc carries NO options (the catalogue is
      // its answer space), so it rides the feed lane through the same kind
      // of carve-out the duel lane gives "pick" days. Remove the exception
      // and this drops out of the feed — which is the regression this line
      // exists to catch.
      qd("pick-pk04", { surface: "feed", type: "catalog", domain: "emoji", options: [] }),
    ]);
    expect(banks.learn.map((x) => x.id)).toEqual(["learn-cell1"]);
    expect(banks.daily.map((x) => x.id)).toEqual(["daily-000"]);
    expect(banks.feed.map((x) => x.id)).toEqual(["feed-f01", "test-big5-00", "feed-f03", "pick-pk04"]);
    expect(banks.duel.map((x) => x.id)).toEqual(["group-gu0", "group-gp0", "duo-000"]);
  });

  it("a catalog doc is feed-only — the carve-out widens no other lane", () => {
    // The exception is options-shaped, so the thing to check is that it
    // stays INSIDE the feed allowlist: a catalog doc on another surface
    // must still be dropped as unplayable, not adopted. The test surface
    // is the load-bearing row: the feed lane ADMITS test-surface docs, so
    // the first cut of the carve-out quietly took a test-surface catalog
    // doc with it — the review fix narrowed catalog to surface "feed"
    // exactly, and this is the line that keeps it narrowed.
    const banks = splitBanks([
      qd("pick-x", { surface: "daily", type: "catalog", options: [] }),
      qd("pick-y", { surface: "learn", type: "catalog", options: [] }),
      qd("pick-z", { surface: "test", type: "catalog", options: [] }),
    ]);
    expect(banks.daily).toEqual([]);
    expect(banks.learn).toEqual([]);
    expect(banks.feed).toEqual([]);
  });
});

describe("rankCrowdFor (D233): the crowd order, minus you", () => {
  it("ranks items by ascending position sum, ties broken by index", () => {
    // Three strangers folded to sums [4, 5, 3, 6]: item 2 leads, then 0,
    // 1, 3 — so the per-item 1-based ranks come back as [2, 3, 1, 4].
    expect(rankCrowdFor({ pos: [4, 5, 3, 6], total: 3 }, null, false)).toEqual([2, 3, 1, 4]);
    // A dead tie resolves by item index, so equal sums render identically
    // on every device rather than flickering with sort stability.
    expect(rankCrowdFor({ pos: [5, 5, 5], total: 3 }, null, false)).toEqual([1, 2, 3]);
  });

  it("subtracts the viewer's own folded order before ranking", () => {
    // Two answers: mine [0,1,2,3] and one stranger's exact reverse.
    // Summed they tie everything at 3 — a crowd that includes you says
    // nothing. With mine back out, the crowd IS the stranger: [4,3,2,1].
    expect(rankCrowdFor({ pos: [3, 3, 3, 3], total: 2 }, [0, 1, 2, 3], false)).toEqual([4, 3, 2, 1]);
  });

  it("is null when nobody ELSE has ranked — absent agg, or a crowd of only you", () => {
    expect(rankCrowdFor(undefined, null, false)).toBeNull();
    expect(rankCrowdFor({ pos: [0, 1], total: 0 }, null, false)).toBeNull();
    // sole folded voter: the total is you, and a mirror is not a crowd
    expect(rankCrowdFor({ pos: [0, 1], total: 1 }, [0, 1], false)).toBeNull();
    // …but PENDING, the same total 1 is a stranger and ranks normally
    expect(rankCrowdFor({ pos: [0, 1], total: 1 }, [0, 1], true)).toEqual([1, 2]);
  });

  it("leaves the sums whole when the stored order cannot be yours", () => {
    // a length mismatch (bank options changed shape — D52 says they
    // cannot, so this is corruption) skips the subtraction rather than
    // corrupting the remainder
    expect(rankCrowdFor({ pos: [0, 1, 2], total: 1 }, [0, 1], false)).toEqual([1, 2, 3]);
  });
});

describe("computeDeckSeqs (the paged deck, D383)", () => {
  // THE PIN THAT MATTERS. A device holding the bank uses computeDeckIds; a
  // device holding only the published length uses computeDeckSeqs and
  // fetches those positions. If the two ever disagree, two users answer
  // different questions on the same day and every cohort reading built on
  // "we all answered this" quietly stops being true — with no error
  // anywhere. So they are checked against each other, over a span, rather
  // than each against a hand-written expectation.
  it("agrees with computeDeckIds on every day of a year, at several bank sizes", () => {
    for (const n of [1, 2, 7, 13, 130, 849]) {
      const ids = Array.from({ length: n }, (_, i) => `q${i}`);
      for (let d = DECK_EPOCH - 400; d < DECK_EPOCH + 400; d += 7) {
        const bySeq = computeDeckSeqs(n, d).map((seq) => `q${seq}`);
        expect(bySeq).toEqual(computeDeckIds(ids, d));
      }
    }
  });

  it("returns nothing for an empty or unusable bank, rather than a position", () => {
    // The boot reads a published number; a missing or malformed document
    // must degrade to "no deck", never to seq 0 for everyone.
    expect(computeDeckSeqs(0, DECK_EPOCH)).toEqual([]);
    expect(computeDeckSeqs(-3, DECK_EPOCH)).toEqual([]);
    expect(computeDeckSeqs(NaN, DECK_EPOCH)).toEqual([]);
  });

  it("never asks for more positions than the bank holds", () => {
    expect(computeDeckSeqs(3, DECK_EPOCH)).toHaveLength(3);
    expect(computeDeckSeqs(30, DECK_EPOCH)).toHaveLength(DECK_DAYS);
  });

  it("stays in range on days far below the epoch", () => {
    // The modulo is written twice in this repo and JS's % is signed; a
    // negative position would read past the array and blank the deck.
    for (let d = DECK_EPOCH - 1000; d < DECK_EPOCH; d += 37) {
      for (const seq of computeDeckSeqs(130, d)) {
        expect(seq).toBeGreaterThanOrEqual(0);
        expect(seq).toBeLessThan(130);
      }
    }
  });
});

describe("computeDeckIds (deck rotation)", () => {
  const ids = ["q0", "q1", "q2", "q3", "q4"];
  // All cases address days relative to the epoch — the rotation's whole
  // point (D30) is that absolute day numbers never touch the modulus.
  const E = DECK_EPOCH;

  it("wraps negative (today - epoch - back) values back into range", () => {
    // epoch+2 with n=5: backs 3 and 4 go negative and must wrap to 4, 3
    expect(computeDeckIds(ids, E + 2)).toEqual(["q2", "q1", "q0", "q4", "q3"]);
    // the epoch day itself: every back > 0 is negative
    expect(computeDeckIds(["a", "b", "c"], E)).toEqual(["a", "c", "b"]);
  });

  it("cycles with period n", () => {
    expect(computeDeckIds(ids, E + 10 + ids.length)).toEqual(computeDeckIds(ids, E + 10));
    expect(computeDeckIds(ids, E + 11)).not.toEqual(computeDeckIds(ids, E + 10));
  });

  it("is stable for the same day", () => {
    expect(computeDeckIds(ids, E + 123)).toEqual(computeDeckIds(ids, E + 123));
  });

  it("advances one card per day (yesterday's today is today's back-1)", () => {
    const yesterday = computeDeckIds(ids, E + 99);
    const today = computeDeckIds(ids, E + 100);
    expect(today.slice(1)).toEqual(yesterday.slice(0, -1));
  });

  it("growing the bank preserves every already-served day's mapping (D30)", () => {
    // The reseed scenario: 40 days after epoch, the bank grows 65 → 77.
    // Every day already served (0..40 back, well past the 7-day pager)
    // must keep its question; only unserved future days may differ.
    const before = Array.from({ length: 65 }, (_, i) => "daily-" + i);
    const after = before.concat(Array.from({ length: 12 }, (_, i) => "new-" + i));
    const today = E + 40;
    expect(computeDeckIds(after, today, 41)).toEqual(computeDeckIds(before, today, 41));
  });

  it("caps the deck at DECK_DAYS and floors it at the bank size", () => {
    const big = Array.from({ length: 12 }, (_, i) => "q" + i);
    expect(computeDeckIds(big, E + 3)).toHaveLength(DECK_DAYS);
    expect(computeDeckIds(["only", "two"], E + 3)).toEqual(["two", "only"]);
    expect(computeDeckIds([], E + 3)).toEqual([]);
  });
});

describe("duelQFor (duel question rotation)", () => {
  // A group's bank as the cast seeds it (D434): role votes are picks, most
  // of them tagged with a scenario pack and a role; every fourth round is
  // a rating between two poles; the older us/classic questions are in the
  // bank and out of the rotation.
  const scen = { id: "heist", label: "Bank Heist", hue: 25 };
  const bank = [
    qd("gu0", { surface: "group", topic: "us" }),
    qd("gd0", { surface: "group" }),
    qd("gr0", { surface: "group", topic: "pick", options: [], scen, role: { id: "mastermind", label: "the mastermind", seat: "engine" } }),
    qd("gr1", { surface: "group", topic: "pick", options: [], scen, role: { id: "driver", label: "the getaway driver", seat: "hands" } }),
    qd("gr2", { surface: "group", topic: "pick", options: [], scen, role: { id: "inside", label: "the inside man", seat: "heart" } }),
    qd("gp0", { surface: "group", topic: "pick", options: [] }),
    qd("gs0", { surface: "group", topic: "rate", poles: ["Calm", "Chaos"], options: ["Calm", "mostly Calm", "in between", "mostly Chaos", "Chaos"] }),
    qd("gs1", { surface: "group", topic: "rate", poles: ["Gentle", "Brutal"], options: ["Gentle", "mostly Gentle", "in between", "mostly Brutal", "Brutal"] }),
    qd("d0", { surface: "duo" }),
    qd("d1", { surface: "duo" }),
  ];
  // …and the 1v1's cast round (D437), the pool's one `cast` entry
  const CAST = qd("073", {
    surface: "duo", topic: "cast", prompt: "Most days, {name} is…",
    options: ["the one you tell first", "the one who gets you out the door", "the one you ask what to do", "the one who is just always there"],
    them: ["the one {name} tells first", "the one who gets {name} out the door", "the one {name} asks what to do", "the one who is just always there"],
    dims: ["trust", "spark", "judgement", "constancy"],
  });
  const picks = bank.filter((q) => q.surface === "group" && q.topic === "pick");
  const rates = bank.filter((q) => q.surface === "group" && q.topic === "rate");
  const group = { id: "grp_abc", mode: "group", memberUids: ["u1", "u2", "u3"], memberNames: { u1: "Ada", u2: "Bo", u3: "Cy" } };
  // The group's PHASE (D437) is read off its id; the cases below compute
  // it rather than assume zero, so they hold for any id the hash lands on.
  const phase = groupPhase(group.id);
  const ratingsBefore = (r: number) => Math.floor((r - 1 + phase) / 4);
  const DAY = 7; // a round — the rotation walks rounds since ROUNDS-PLAN / D426

  it("is deterministic for a fixed (group, bank, round)", () => {
    expect(duelQFor(group, bank, DAY)).toEqual(duelQFor(group, bank, DAY));
    // and mirrors the documented formula over the role-vote pool, with the
    // rating rounds before this one skipped so votes walk consecutively
    const r = isRatingRound(DAY, phase) ? DAY + 1 : DAY;
    const walked = r - ratingsBefore(r);
    const expected = picks[(gHash(group.id) + walked) % picks.length];
    expect(duelQFor(group, bank, r)!.id).toBe(expected.id);
  });

  it("every fourth round from the phase rates the group, and the ratings walk their own pool in turn", () => {
    expect(isRatingRound(4)).toBe(true);
    expect(isRatingRound(5)).toBe(false);
    expect(isRatingRound(3, 1)).toBe(true);
    expect(isRatingRound(4, 1)).toBe(false);
    for (let r = 1; r <= 12; r++) {
      const q = duelQFor(group, bank, r)!;
      if (isRatingRound(r, phase)) {
        expect(q.kind).toBe("rate");
        expect(q.poles).toEqual(rates[(gHash(group.id) + ratingsBefore(r) + 1) % rates.length].poles);
        expect(q.options).toHaveLength(5);
      } else {
        expect(q.kind).toBe("pick");
        // the members are the options, and a packed role carries its pack
        // and its seat
        expect(q.options).toEqual(["Ada", "Bo", "Cy"]);
        const src = picks.find((p) => p.id === q.id)!;
        expect(q.scen).toEqual(src.scen);
        expect(q.role).toEqual(src.role);
      }
    }
    // two consecutive rating rounds are consecutive ratings, not the same one
    const ratingRounds = Array.from({ length: 12 }, (_, i) => i + 1).filter((r) => isRatingRound(r, phase));
    expect(duelQFor(group, bank, ratingRounds[0])!.id).not.toBe(duelQFor(group, bank, ratingRounds[1])!.id);
  });

  it("the phase is the group's own, three values, and never puts a rating on round 1", () => {
    // Two rooms you are in should not both rate on the same numbers (the
    // owner's 2026-09-09 design seeds phases 0 · 1 · 2); the tree reads the
    // phase off the id, so it is a fact about the room and not a field.
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const ph = groupPhase("room_" + i);
      expect([0, 1, 2]).toContain(ph);
      seen.add(ph);
      expect(isRatingRound(1, ph)).toBe(false);
    }
    expect(seen.size).toBe(3);
    // a phased group's first rating comes early, and its votes still walk
    // consecutively across it
    const early = { id: "room_x", mode: "group", memberUids: ["u1", "u2"] };
    const ph = groupPhase(early.id);
    const firstRating = [1, 2, 3, 4].find((r) => isRatingRound(r, ph))!;
    expect(firstRating).toBe(4 - ph);
    expect(duelQFor(early, bank, firstRating)!.kind).toBe("rate");
  });

  it("role votes are consecutive questions across a rating — no vote is skipped for it", () => {
    // Six consecutive vote rounds (the rating rounds between them left
    // out) walk six consecutive picks of the four: a step across a rating
    // is one step, not two, because that round took no pick.
    const voteRounds = Array.from({ length: 10 }, (_, i) => i + 1).filter((r) => !isRatingRound(r, phase)).slice(0, 6);
    const ids = voteRounds.map((r) => duelQFor(group, bank, r)!.id);
    const start = picks.findIndex((p) => p.id === ids[0]);
    ids.forEach((id, i) => expect(id).toBe(picks[(start + i) % picks.length].id));
  });

  it("the older us/classic group questions are in the bank and out of the rotation", () => {
    const served = new Set(Array.from({ length: 40 }, (_, i) => duelQFor(group, bank, i + 1)!.id));
    expect(served.has("gu0")).toBe(false);
    expect(served.has("gd0")).toBe(false);
    expect([...served].sort()).toEqual([...picks, ...rates].map((q) => q.id).sort());
  });

  it("a bank with no ratings yet plays every round as a role vote — the pre-reseed device", () => {
    const noRates = bank.filter((q) => q.topic !== "rate");
    const served = Array.from({ length: 8 }, (_, i) => duelQFor(group, noRates, i + 1)!);
    served.forEach((q) => expect(q.kind).toBe("pick"));
    // …and consecutive rounds are consecutive picks: with no rating to take
    // a round, the vote walk has nothing to skip. This is the live bank's
    // own shape until the reseed lands the rate docs, and the walk used to
    // subtract the rating rounds such a bank never deals — so round 5
    // re-served round 4's question, and round 9 round 8's (probed
    // 2026-09-09; the assertion above saw only the kind).
    const start = picks.findIndex((p) => p.id === served[0].id);
    served.forEach((q, i) => expect(q.id, `round ${i + 1}`).toBe(picks[(start + i) % picks.length].id));
  });

  it("every fourth 1v1 round is the cast, and the own rounds walk the pool skipping it (D437)", () => {
    const withCast = [...bank, CAST];
    const own = withCast.filter((q) => q.surface === "duo" && q.topic !== "cast");
    const duo = { id: "duo_1", mode: "duo" };
    expect(duoKind(4)).toBe("cast");
    expect(duoKind(5)).toBe("own");
    for (let r = 1; r <= 12; r++) {
      const q = duelQFor(duo, withCast, r)!;
      if (r % 4 === 0) {
        expect(q.id).toBe("073");
        expect(q.kind).toBe("cast");
        expect(q.them).toEqual(CAST.them);
        expect(q.dims).toEqual(["trust", "spark", "judgement", "constancy"]);
        expect(q.options).toHaveLength(4);
      } else {
        expect(q.kind).toBe("classic");
        expect(q.them).toBeUndefined();
        expect(q.id).toBe(own[(gHash(duo.id) + (r - Math.floor(r / 4))) % own.length].id);
      }
    }
    // consecutive own rounds are consecutive questions across the cast
    const ids = [1, 2, 3, 5, 6, 7].map((r) => duelQFor(duo, withCast, r)!.id);
    const start = own.findIndex((p) => p.id === ids[0]);
    ids.forEach((id, i) => expect(id).toBe(own[(start + i) % own.length].id));
  });

  it("a 1v1 pool without a cast entry plays every round as its own, unmoved — the pre-reseed device", () => {
    const duoBank = bank.filter((q) => q.surface === "duo");
    const duo = { id: "duo_1", mode: "duo" };
    for (let r = 1; r <= 8; r++) {
      const q = duelQFor(duo, bank, r)!;
      expect(q.id).toBe(duoBank[(gHash(duo.id) + r) % duoBank.length].id);
      expect(q.kind).toBe("classic");
    }
  });

  it("the cast text puts the name where the bank could not, and never leaves the placeholder", () => {
    expect(castText("Most days, {name} is…", "Liv")).toBe("Most days, Liv is…");
    expect(castText("the one {name} tells first", " Liv ")).toBe("the one Liv tells first");
    expect(castText("Most days, {name} is…", "")).toBe("Most days, your friend is…");
    expect(castText("the one {name} goes home to", null, true)).toBe("the one your partner goes home to");
    expect(castText("the one who is just always there", "Liv")).toBe("the one who is just always there");
  });

  it("a bank with no picks at all falls back to the whole surface — never no question", () => {
    const old = bank.filter((q) => q.surface !== "group" || (q.topic !== "pick" && q.topic !== "rate"));
    const q = duelQFor(group, old, DAY)!;
    expect(q).not.toBeNull();
    expect(["gu0", "gd0"]).toContain(q.id);
  });

  it("round 1 is a question too — the first round a fresh group opens on", () => {
    expect(duelQFor(group, bank, 1)).not.toBeNull();
  });

  it("selects the question from the group id alone — member order is irrelevant", () => {
    const a = { id: "grp_abc", mode: "group", memberUids: ["u1", "u2", "u3"] };
    const b = { id: "grp_abc", mode: "group", memberUids: ["u3", "u1", "u2"] };
    expect(duelQFor(a, bank, DAY)!.id).toBe(duelQFor(b, bank, DAY)!.id);
  });

  it("gives 'pick' questions member names as options, in memberUids order", () => {
    const g = {
      id: "grp_abc",
      mode: "group",
      memberUids: ["u1", "u2", "u3"],
      memberNames: { u1: "Ana", u3: "Cleo" },
    };
    // find the round this group lands on the plain pick gp0 — within four
    // votes, since the role-vote pool has four entries (a bounded search:
    // the fixture id this loop hunts for MUST be in the bank, or it never
    // ends, which is how this file hung the whole suite once)
    let day = DAY;
    while (duelQFor(g, bank, day)!.id !== "gp0") { day++; if (day > DAY + 8) throw new Error("gp0 never served"); }
    const q = duelQFor(g, bank, day)!;
    expect(q.kind).toBe("pick");
    expect(q.options).toEqual(["Ana", "Member 2", "Cleo"]); // name fallback
    const reordered = duelQFor({ ...g, memberUids: ["u3", "u2", "u1"] }, bank, day)!;
    expect(reordered.options).toEqual(["Cleo", "Member 2", "Ana"]); // follows uid order
  });

  it("filters the bank by mode ('duo' vs anything else = 'group')", () => {
    const duo = { id: "grp_abc", mode: "duo" };
    expect(duelQFor(duo, bank, DAY)!.id).toMatch(/^d/);
    expect(duelQFor(group, bank, DAY)!.id).toMatch(/^g/);
    expect(duelQFor({ id: "grp_abc" }, bank, DAY)!.id).toMatch(/^g/); // no mode → group
  });

  it("returns null on an empty (or wrong-surface) bank", () => {
    expect(duelQFor(group, [], DAY)).toBeNull();
    expect(duelQFor({ id: "x", mode: "duo" }, [qd("g0", { surface: "group" })], DAY)).toBeNull();
  });

  describe("duoMode pool selection (D40 part 4)", () => {
    const pooled = [
      ...bank,
      qd("r0", { surface: "duo", mode: "romantic" }),
      qd("r1", { surface: "duo", mode: "romantic" }),
      qd("r2", { surface: "duo", mode: "romantic" }),
    ];
    const duo = { id: "grp_abc", mode: "duo" };

    it("keeps the shared pool romantic-free — and the rotation unmoved", () => {
      for (let d = 0; d < 10; d++) {
        expect(duelQFor(duo, pooled, DAY + d)!.id).toMatch(/^d/);
        // adding the romantic docs must not remap any friend pair's round —
        // the default branch's bank is unchanged (the D30 growth argument)
        expect(duelQFor(duo, pooled, DAY + d)!.id).toBe(duelQFor(duo, bank, DAY + d)!.id);
      }
    });

    it("serves a romantic duo the romantic pool exclusively", () => {
      const rom = { ...duo, duoMode: "romantic" };
      for (let d = 0; d < 10; d++) expect(duelQFor(rom, pooled, DAY + d)!.id).toMatch(/^r/);
    });

    it("ignores duoMode on groups, and unknown modes fall back to shared", () => {
      expect(duelQFor({ ...group, duoMode: "romantic" }, pooled, DAY)!.id).toMatch(/^g/);
      expect(duelQFor({ ...duo, duoMode: "sneaky" }, pooled, DAY)!.id).toMatch(/^d/);
    });

    it("returns null for a romantic duo when no romantic docs exist", () => {
      expect(duelQFor({ ...duo, duoMode: "romantic" }, bank, DAY)).toBeNull();
    });

    it("a romantic duo's cast is the romantic pool's own, and the friends' cast never reaches it", () => {
      const romCast = qd("074", { surface: "duo", mode: "romantic", topic: "cast", prompt: "Most days, {name} is…",
        options: ["a", "b", "c", "d"], them: ["a", "b", "c", "d"], dims: ["trust", "spark", "judgement", "constancy"] });
      const both = [...pooled, CAST, romCast];
      const rom = { ...duo, duoMode: "romantic" };
      expect(duelQFor(rom, both, 4)!.id).toBe("074");
      expect(duelQFor(duo, both, 4)!.id).toBe("073");
      // and a romantic pool with no cast plays round 4 as its own
      expect(duelQFor(rom, [...pooled, CAST], 4)!.id).toMatch(/^r/);
    });
  });

  it("defaults kind to 'classic' when the question has no topic", () => {
    const only = [qd("g0", { surface: "group", topic: null })];
    expect(duelQFor(group, only, DAY)!.kind).toBe("classic");
  });
});

describe("dayLabel", () => {
  it("names today and yesterday specially", () => {
    expect(dayLabel(0, WED)).toBe("Today");
    expect(dayLabel(1, WED)).toBe("Yesterday");
  });

  it("uses the weekday name from 2 days back", () => {
    expect(dayLabel(2, WED)).toBe("Mon"); // Jul 13 2026
    expect(dayLabel(3, WED)).toBe("Sun");
    expect(dayLabel(6, WED)).toBe("Thu"); // Jul 9 2026
  });

  it("crosses month boundaries", () => {
    const wedJul1 = new Date(2026, 6, 1, 9, 0);
    expect(dayLabel(2, wedJul1)).toBe("Mon"); // Jun 29 2026
  });

  it("does not mutate the date it is given", () => {
    const now = new Date(2026, 6, 15);
    const before = now.getTime();
    dayLabel(5, now);
    expect(now.getTime()).toBe(before);
  });
});

describe("day indices and gHash", () => {
  it("utcDayIndex floors ms to whole UTC days", () => {
    expect(utcDayIndex(0)).toBe(0);
    expect(utcDayIndex(86400000 - 1)).toBe(0);
    expect(utcDayIndex(86400000 * 20000 + 123)).toBe(20000);
  });

  it("dayIndex is stable within a local day and steps by 1 across midnight", () => {
    const morning = dayIndex(new Date(2026, 6, 15, 0, 0, 1));
    const night = dayIndex(new Date(2026, 6, 15, 23, 59, 59));
    expect(night).toBe(morning);
    expect(dayIndex(new Date(2026, 6, 16, 0, 0, 1))).toBe(morning + 1);
  });

  it("steps by 1 across a DST transition, and anchors the epoch, in a real zone", () => {
    // The regression the two July dates above could not see. `dayIndex` was
    // local midnight as a UTC INSTANT, which leaks the zone's offset into
    // the day number — constant per zone, and therefore invisible, EXCEPT
    // where the offset crosses zero at a transition. Measured before the
    // fix, under Europe/London: 2026-03-29 and 2026-03-30 both gave 20541
    // (no daily question that day, and "Yesterday" pointing at the wrong
    // card), and 2026-10-25 → 20750 with 2026-10-26 → 20752 (a bank
    // question skipped and never served).
    //
    // A CHILD PROCESS, and that is the finding rather than the ceremony:
    // setting process.env.TZ inside the test does NOTHING here. Vitest runs
    // on the threads pool (vite.config.ts explains why), the worker resolved
    // its zone before this file was imported, and a thread does not re-read
    // TZ — every zone reports offset 0. Verified by probing it: the first
    // draft of this test set process.env.TZ, passed, and still passed
    // against the ORIGINAL buggy dayIndex, which is the worst shape a test
    // can take. Only a fresh process gets a real zone.
    //
    // The zone must also be a zero-CROSSING one to reproduce at all: east of
    // UTC and west of it the old formula was merely off by a constant. CI
    // runs UTC, where the bug is invisible by construction.
    const deck = fileURLToPath(new URL("./deck.ts", import.meta.url));
    const probe = (tz: string): Record<string, number> => {
      const out = execFileSync(
        process.execPath,
        ["--experimental-strip-types", "--no-warnings", "-e", `
          import(${JSON.stringify(deck)}).then((m) => {
            const step = (y, mo, d) =>
              m.dayIndex(new Date(y, mo, d + 1, 12)) - m.dayIndex(new Date(y, mo, d, 12));
            console.log(JSON.stringify({
              springForward: step(2026, 2, 29),
              autumnBack: step(2026, 9, 25),
              control: step(2026, 6, 15),
              epoch: m.dayIndex(new Date(2026, 7, 1, 12)),
              offsetJuly: new Date(2026, 6, 1).getTimezoneOffset(),
            }));
          });
        `],
        { env: { ...process.env, TZ: tz }, encoding: "utf8" },
      );
      return JSON.parse(out) as Record<string, number>;
    };

    // 0/+1 — the crossing the bug lived in. offsetJuly asserts the child
    // really got the zone, so this can never quietly become a UTC re-run.
    const london = probe("Europe/London");
    expect(london.offsetJuly).toBe(-60);
    expect(london.springForward).toBe(1);
    expect(london.autumnBack).toBe(1);
    expect(london.control).toBe(1);

    // +1/+2 — east of UTC, never crossed zero, so its days always stepped
    // correctly. What was wrong here is the ANCHOR: the old formula put it
    // one below the constant, so the rotation depended on where you stood.
    const oslo = probe("Europe/Oslo");
    expect(oslo.offsetJuly).toBe(-120);
    expect(oslo.springForward).toBe(1);
    expect(oslo.epoch).toBe(DECK_EPOCH);
    // …and the same anchor at UTC, which is where the constant was derived.
    expect(london.epoch).toBe(DECK_EPOCH);
  });

  it("gHash is deterministic and bounded to [0, 997)", () => {
    expect(gHash("grp_abc")).toBe(gHash("grp_abc"));
    for (const s of ["", "a", "grp_abc", "some-much-longer-group-identifier"]) {
      const h = gHash(s);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(997);
    }
  });
});

describe("retiring a served question must not re-map the pager", () => {
  // computeDeckIds indexes positionally, so removing any element BELOW the
  // current window shifts every visible day: six answered history cards
  // render as unanswered and today's card silently swaps. The trigger is the
  // intended ops workflow — QUESTION-FARM has the scorecard propose
  // `active: false` for high-volume landslides, i.e. questions already
  // served — so live.ts keeps retired dailies in the array as tombstones and
  // filters them at display instead.
  const bank = (n: number) => Array.from({ length: n }, (_, i) => `daily-${String(i).padStart(3, "0")}`);

  // The tombstone half of this rule USED TO SIT HERE, and could not: it
  // compared `computeDeckIds(ids, today)` with `computeDeckIds(ids, today)`
  // — the same call twice, green for every implementation, and describing
  // an array this layer never builds. Retiring in place is invisible to
  // `computeDeckIds` by construction, so there is nothing here to assert;
  // what has to hold is that live.ts BUILDS the array in place, and that
  // pin now lives beside the code that does it (warm-boot.test.ts,
  // "retiring a served daily"). What is left below is the half this layer
  // really owns.

  it("…and REMOVING it instead moves every one of them", () => {
    // The behaviour this replaced, pinned so the reason the tombstone exists
    // cannot be forgotten and the filter quietly moved back.
    const ids = bank(90);
    const today = DECK_EPOCH + 30;
    const before = computeDeckIds(ids, today);
    const pruned = ids.filter((id) => id !== "daily-012");
    const after = computeDeckIds(pruned, today);
    const moved = before.filter((id, i) => after[i] !== id).length;
    expect(moved, "removing an element left the pager unchanged").toBe(before.length);
  });

  it("appending is still safe, which is why D30's invariant missed this", () => {
    const ids = bank(90);
    const today = DECK_EPOCH + 30;
    const before = computeDeckIds(ids, today);
    expect(computeDeckIds([...ids, "daily-090"], today)).toEqual(before);
  });
});

// ── isCore: which questions a cohort reading may fold (D161) ──
//
// The asymmetry is the whole point and it is easy to get backwards: feed
// questions opt IN, every other surface is core by construction. A reader
// that tested `q.core` directly would empty the Mirror instead of
// filtering it, which is why the predicate exists at all.
describe("isCore", () => {
  it("takes a feed question only when it declares core", () => {
    expect(isCore({ surface: "feed", core: true })).toBe(true);
    expect(isCore({ surface: "feed", core: false })).toBe(false);
    // Absent means TAIL — a question joins the corpus by saying so.
    expect(isCore({ surface: "feed" })).toBe(false);
  });

  it("takes every other surface by construction, flag or no flag", () => {
    for (const surface of ["daily", "test", "group", "duo", "learn", "pulse"]) {
      expect(isCore({ surface })).toBe(true);
    }
  });

  it("does not let a stray core:false demote a surface that has no tail", () => {
    // Defensive rather than hypothetical: the seed emits `core` on feed
    // entries only, so a false on any other surface is corrupt data, and
    // dropping the daily out of every cohort reading would be a far worse
    // failure than honouring a flag that should not be there.
    expect(isCore({ surface: "daily", core: false })).toBe(true);
  });
});
