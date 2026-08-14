// The persona-residue scrub (personaResidue.ts): what makes an exact-match
// scrub SAFE is two facts about the strings, and both are pinned here
// because either drifting silently turns the scrub into data loss —
//
//   1. the constants really are the sample persona's values (a drifted
//      copy scrubs nothing while the map shows the leak), and
//   2. the profile's fixed vocabularies cannot produce them (if either
//      string ever became a real <select> option, an exact match would
//      start deleting a real person's answer).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
// @ts-expect-error TS7016 — untyped spec module
import { IS_DATA } from "../spec/sample-data.js";
import { PERSONA_EDU, PERSONA_JOB, scrubPersonaAnchors } from "./personaResidue";

const FULL = {
  ageBand: "30-34",
  profession: PERSONA_JOB,
  education: PERSONA_EDU,
  city: "Oslo, NO",
  country: "NO",
  gender: "Woman",
};

describe("the signature strings", () => {
  it("are the sample persona's, verbatim", () => {
    const me = (IS_DATA as { me: { job: string; education: string } }).me;
    expect(PERSONA_JOB).toBe(me.job);
    expect(PERSONA_EDU).toBe(me.education);
  });

  it("cannot be produced by the profile's own selects", () => {
    // JOB_OPTS and EDU_OPTS are closed vocabularies (D8) inside
    // profile-general.jsx, and neither persona string may appear anywhere
    // in that file — not in the vocabularies, and not as a reintroduced
    // default (the original leak was exactly a default).
    const src = readFileSync(
      resolve(__dirname, "../spec/profile-general.jsx"),
      "utf8",
    );
    expect(src).not.toContain(PERSONA_JOB);
    expect(src).not.toContain(PERSONA_EDU);
  });
});

describe("scrubPersonaAnchors", () => {
  it("drops the full triple when both signature strings match", () => {
    expect(scrubPersonaAnchors(FULL)).toEqual({
      city: "Oslo, NO",
      country: "NO",
      gender: "Woman",
    });
  });

  it("drops only the matching field when the signature is partial", () => {
    // A user who already fixed their job keeps their (real) ageBand — the
    // band is not distinctive enough to scrub on one match.
    const partial = { ...FULL, profession: "Media & publishing" };
    expect(scrubPersonaAnchors(partial)).toEqual({
      ageBand: "30-34",
      profession: "Media & publishing",
      city: "Oslo, NO",
      country: "NO",
      gender: "Woman",
    });
  });

  it("answers null for a clean profile — the no-write signal", () => {
    expect(scrubPersonaAnchors({ profession: "Science", ageBand: "30-34" })).toBeNull();
    expect(scrubPersonaAnchors({})).toBeNull();
  });

  it("does not mutate its input", () => {
    const input = { ...FULL };
    scrubPersonaAnchors(input);
    expect(input).toEqual(FULL);
  });
});
