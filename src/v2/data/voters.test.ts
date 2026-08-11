// The pure half of the cross-user read (D94). The two queries need an
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
  WORLD_ANSWER_SURFACES,
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

describe("the surface filter", () => {
  it("lists exactly the world surfaces, and never a duel one", () => {
    expect([...WORLD_ANSWER_SURFACES]).toEqual(["daily", "feed", "test", "learn"]);
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
