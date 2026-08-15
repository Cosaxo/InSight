// The pure half of the cross-user read (D98). The two queries need an
// emulator and are covered there — rules.test.ts proves the
// collection-group grant works and that the surface filter is mandatory,
// and e2e-v2-loop drives the real trigger. What is worth pinning HERE is
// the shaping: chunking, grouping and ordering, all of which are silent
// when they are wrong.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  chunkUids,
  groupByOption,
  sortVoters,
  uidFromAnswerPath,
  UID_CHUNK,
  VOTER_FETCH_CAP,
  WORLD_ANSWER_SURFACES,
  KINDRED_CANDIDATE_CAP,
  type Voter,
} from "./voters";

const v = (over: Partial<Voter> = {}): Voter => ({
  uid: "u1", optionIdx: 0, anchors: {}, name: "", isMe: false, ...over,
});

describe("chunkUids", () => {
  it("dedupes, preserves order, and splits at the `in` ceiling", () => {
    const uids = Array.from({ length: 71 }, (_, i) => "u" + i);
    const out = chunkUids(uids);
    expect(out.map((c) => c.length)).toEqual([30, 30, 11]);
    expect(out[0][0]).toBe("u0");
    expect(out[2][10]).toBe("u70");
  });

  it("drops duplicates and empties before chunking", () => {
    // Crowds overlap, so the same uid arrives repeatedly across a voter
    // list. Chunking before deduping would spend `in` slots on repeats
    // and could push a 30-name batch into two round trips.
    expect(chunkUids(["a", "b", "a", "", "b", "c"])).toEqual([["a", "b", "c"]]);
    expect(chunkUids([])).toEqual([]);
  });

  it("never exceeds Firestore's `in` limit", () => {
    // A chunk over the limit is rejected by the SDK at call time, which
    // surfaces as "who answered" failing entirely for popular questions
    // and working for quiet ones.
    for (const c of chunkUids(Array.from({ length: 200 }, (_, i) => "u" + i))) {
      expect(c.length).toBeLessThanOrEqual(UID_CHUNK);
    }
  });
});

describe("groupByOption", () => {
  it("keeps a column for an option nobody picked", () => {
    // Dense, not sparse: a missing column renders as a missing OPTION,
    // and "nobody picked this" is a result worth showing.
    const cols = groupByOption([v({ optionIdx: 0 }), v({ uid: "u2", optionIdx: 2 })], 3);
    expect(cols.map((c) => c.length)).toEqual([1, 0, 1]);
  });

  it("drops a vote for an option the question does not have", () => {
    // Defensive rather than theoretical: the bank is operator-editable, so
    // a question can lose options after people have answered it. Dropping
    // beats throwing inside a render.
    const cols = groupByOption([v({ optionIdx: 7 }), v({ uid: "u2", optionIdx: 1 })], 2);
    expect(cols.map((c) => c.length)).toEqual([0, 1]);
  });

  it("returns nothing for a question with no options", () => {
    expect(groupByOption([v()], 0)).toEqual([]);
  });
});

describe("sortVoters", () => {
  it("puts you first, then names, then the unnamed", () => {
    const out = sortVoters([
      v({ uid: "c", name: "" }),
      v({ uid: "b", name: "Bea" }),
      v({ uid: "me", name: "Mira", isMe: true }),
      v({ uid: "a", name: "Ada" }),
    ]);
    expect(out.map((x) => x.uid)).toEqual(["me", "a", "b", "c"]);
  });

  it("is stable for two unnamed accounts", () => {
    // Falls through to uid, so the list does not reshuffle between
    // renders — a voter list that reorders on every notify reads as a
    // live feed of people changing their minds.
    const out = sortVoters([v({ uid: "z" }), v({ uid: "y" })]);
    expect(out.map((x) => x.uid)).toEqual(["y", "z"]);
  });

  it("does not mutate its input", () => {
    const rows = [v({ uid: "b", name: "Bea" }), v({ uid: "a", name: "Ada" })];
    sortVoters(rows);
    expect(rows.map((x) => x.uid)).toEqual(["b", "a"]);
  });
});

describe("uidFromAnswerPath", () => {
  it("reads the owner out of the document path", () => {
    // The answer doc carries no uid field — the path IS the attribution,
    // which is what makes named who-voted possible without denormalising
    // a uid onto every answer (and widening the create rule to admit it).
    expect(uidFromAnswerPath("v2_users/abc123/answers/daily-000")).toBe("abc123");
  });

  it("returns null for a path that is not an answer", () => {
    expect(uidFromAnswerPath("v2_takes/t1")).toBeNull();
    expect(uidFromAnswerPath("v2_users")).toBeNull();
  });
});

describe("the fetch cap (D102)", () => {
  // The cap is on the QUERY, not applied to the result after the fact —
  // slicing a returned array would still bill every document in the
  // crowd, which is the entire cost this bound exists to remove.
  // Source-scanned because the query needs an emulator to run; the same
  // trade the surface-filter's rules case below takes.
  it("fetchVoters carries the cap inside the query", () => {
    const src = readFileSync(resolve(__dirname, "./voters.ts"), "utf8");
    const q = src.match(/collectionGroup\(db, "answers"\)[\s\S]*?\)\);/);
    expect(q, "fetchVoters' collection-group query was not found").not.toBeNull();
    expect(q![0]).toMatch(/fsLimit\(VOTER_FETCH_CAP\)/);
    // Newest-first is what makes a capped page mean "the latest N" rather
    // than an arbitrary N — the ordering and the cap only work as a pair.
    expect(q![0]).toMatch(/orderBy\("answeredAt", "desc"\)/);
    expect(VOTER_FETCH_CAP).toBeGreaterThan(0);
  });
});

describe("the Friends cut asks your follows, not the window", () => {
  // Source-scanned for the same reason the cap case above is: the query
  // needs an emulator to run, and what is worth pinning is its SHAPE.
  const src = readFileSync(resolve(__dirname, "./voters.ts"), "utf8");
  // Bounded by the NEXT export rather than by fetchVoters: a third
  // function landed between them (fetchKindredCandidates) and silently
  // widened this slice, which made the no-limit assertion below read that
  // function's cap instead. Cheap to get wrong, so it is named here.
  const fn = src.slice(
    src.indexOf("export async function fetchFriendVoters"),
    src.indexOf("export const KINDRED_CANDIDATE_CAP"),
  );

  it("scopes each query to one follow's own subcollection", () => {
    // The whole change, in one assertion. A collectionGroup here would
    // mean it was back to reading the population and filtering — which is
    // the bug: at scale the newest VOTER_FETCH_CAP answers are whoever
    // was online, so a friend who answered this morning drops out and the
    // panel reports that nobody you follow answered.
    expect(fn).toMatch(/fsCollection\(db, "v2_users", uid, "answers"\)/);
    expect(fn).not.toMatch(/collectionGroup/);
    // No cap and no ordering, deliberately: the result is bounded by YOUR
    // follow list (FOLLOW_CAP) rather than by the population, so there is
    // nothing left to truncate. A limit here would reintroduce exactly
    // the silent-omission bug in a smaller window.
    expect(fn).not.toMatch(/fsLimit|limit\(/);
  });

  it("carries the surface value test the list rule needs (D65)", () => {
    // A collection-group read is refused wholesale without a matching
    // `where`, and so is this one — the grant is a value test on
    // `surface` either way. It is also the duel seal: a sealed g_/duo
    // answer must not reach the Friends cut before its reveal.
    expect(fn).toMatch(/where\("surface", "in", \[\.\.\.WORLD_ANSWER_SURFACES\]\)/);
    expect(fn).toMatch(/where\("qid", "==", qid\)/);
    expect(WORLD_ANSWER_SURFACES).not.toContain("group");
    expect(WORLD_ANSWER_SURFACES).not.toContain("duo");
  });

  it("reads no answers at all when you follow nobody", () => {
    // The empty-follows guard lives in the fetch rather than in the
    // panel, so a second caller inherits it. Cheap to pin and easy to
    // lose to a refactor that "simplifies" the early return away.
    expect(fn).toMatch(/if \(!qid \|\| !followUids\.length\) return \[\];/);
  });
});

describe("Kindred queries people, not answers", () => {
  const src = readFileSync(resolve(__dirname, "./voters.ts"), "utf8");
  const fn = src.slice(
    src.indexOf("export async function fetchKindredCandidates"),
    src.indexOf("export async function fetchVoters"),
  );

  it("asks v2_users by city, and reads no answer documents", () => {
    // The change: the pool used to come from ~2,400 answer reads across
    // twelve who-voted queries, and was then ranked on profile scores
    // those answers had nothing to do with. Now it asks for the people.
    expect(fn).toMatch(/fsCollection\(db, "v2_users"\)/);
    expect(fn).toMatch(/where\("anchors\.city", "==", city\)/);
    expect(fn).not.toMatch(/collectionGroup|"answers"/);
  });

  it("is bounded, and by a constant the cost model reads", () => {
    // scripts/cost-arith.mjs pins KINDRED_CANDIDATE_CAP by regex and
    // scripts/pulse.test.mjs holds the value equal to this file, so an
    // unbounded pool cannot ship without the model noticing.
    expect(fn).toMatch(/fsLimit\(KINDRED_CANDIDATE_CAP\)/);
    expect(KINDRED_CANDIDATE_CAP).toBeGreaterThan(0);
  });

  it("fills both caches from the one profile read", () => {
    // A candidate must cost ONE document, not one to learn they exist and
    // another for the scores that rank them — the same property
    // resolveNames has carried since D112.
    expect(fn).toMatch(/names\[d\.id\] =/);
    expect(fn).toMatch(/scores\[d\.id\] = parseTestResults\(/);
  });

  it("never returns the viewer to their own lens", () => {
    expect(fn).toMatch(/if \(d\.id === myUid\) continue;/);
  });

  it("reads nothing when the viewer has no city", () => {
    // The pool is a city cohort, so no city means no query rather than an
    // unfiltered scan of v2_users — which is the shape that would be
    // expensive AND wrong.
    expect(fn).toMatch(/if \(!city\) return \[\];/);
  });
});

describe("the surface filter", () => {
  it("lists exactly the world surfaces, and never a duel one", () => {
    expect([...WORLD_ANSWER_SURFACES]).toEqual(["daily", "feed", "test", "learn", "pulse"]);
    // Duel surfaces must NOT appear: they are sealed until the reveal,
    // and the rule refuses them anyway — but a query that asks for them
    // is refused WHOLESALE, so adding one here would break every voter
    // list rather than leaking a sealed answer.
    expect(WORLD_ANSWER_SURFACES).not.toContain("group");
    expect(WORLD_ANSWER_SURFACES).not.toContain("duo");
  });

  // A cross-file drift guard, the same shape the floor constants used to
  // carry: the client list and the rules list are in different languages
  // with no compiler between them, and they must be identical.
  //
  // This is not cosmetic. firestore.rules grants the collection-group read
  // as a VALUE test on `surface`, and Firestore refuses a list query
  // outright unless the query's own filter matches (D65). So a value the
  // rule does not list breaks the entire panel — for every question, not
  // just for that surface — and it breaks it as a permission error with
  // no clue pointing here.
  it("matches the surface list in firestore.rules", () => {
    const rules = readFileSync(resolve(__dirname, "../../../firestore.rules"), "utf8");
    const grant = rules.match(
      /match \/\{path=\*\*\}\/answers\/\{aid\}[\s\S]*?resource\.data\.surface in \[([^\]]+)\]/,
    );
    expect(grant, "the collection-group answers grant was not found in firestore.rules").not.toBeNull();
    const fromRules = grant![1].split(",").map((x) => x.trim().replace(/"/g, "")).filter(Boolean);
    expect(fromRules).toEqual([...WORLD_ANSWER_SURFACES]);
  });
});
