// cost-fanout.test.mjs — the cost model's profile fan-out term, held to
// what functions/src/profileFanout.ts actually does.
//
// The term is per-answer arithmetic over a quantity, and every one of its
// three factors had drifted from the code it prices:
//
//   · the samples an answer names. `sampleIdsFor` adds the WORLD sample
//     and, when the answer's frozen chips carry a city, the per-city one
//     (runbook 2.5). The model counted one, so it charged one read and
//     one write where the code pays two of each.
//   · the read of the answer document itself, which the model folded
//     into the same "two reads per answer" as the sample read.
//   · the quantity. The term sized an account's answers with
//     `memberAnswers` — CIRCLE_ANSWER_CAP, a bound on what circle.ts's
//     QUERY returns to a reader. The fan-out is not a reader: it pages
//     the whole subcollection. At today's rate the cap binds, so the
//     model was charging for 300 of an account's 360 answers.
//
// None of that is visible from cost-arith.mjs, which is exactly why it
// stayed wrong: a model that states its coefficients as bare numbers
// cannot be compared to anything. So this file runs the real function's
// real id builder rather than re-asserting a number, and the model's
// constants are what the assertions are about.
import { describe, expect, it } from "vitest";
import { sampleIdsFor } from "../functions/src/profileFanout";
import {
  accountAnswers,
  B,
  CIRCLE_ANSWER_CAP,
  FANOUT_READS_PER_ANSWER,
  FANOUT_SAMPLES_PER_ANSWER,
  FANOUT_WRITES_PER_ANSWER,
  memberAnswers,
  profileFanoutReads,
  profileFanoutWrites,
} from "./cost-arith.mjs";

describe("the profile fan-out term prices what the fan-out does", () => {
  it("charges one sample document per id the real function names", () => {
    const qids = ["q1", "q2", "q3"];
    const eligible = new Set(qids);
    const withCity = sampleIdsFor(qids.map((qid) => ({ qid, city: "Oslo, NO" })), eligible);
    // The ceiling: a world sample and a city sample each. This is the
    // assertion the model was wrong about — it read as one.
    expect(withCity.length).toBe(qids.length * FANOUT_SAMPLES_PER_ANSWER);
    expect(FANOUT_SAMPLES_PER_ANSWER).toBe(2);

    // The floor, and the control: without a city the answer names one,
    // so the constant is the CEILING and not a coincidence of the
    // fixture. A model charging the floor would be the old bug back.
    const noCity = sampleIdsFor(qids.map((qid) => ({ qid })), eligible);
    expect(noCity.length).toBe(qids.length);
    expect(FANOUT_SAMPLES_PER_ANSWER).toBeGreaterThan(noCity.length / qids.length);
  });

  it("pays for the answer document too — the read the samples' read is not", () => {
    // The paged `.select("qid","anchors")` query over the account's own
    // answers is a read per answer before any sample is touched.
    expect(FANOUT_READS_PER_ANSWER).toBe(1 + FANOUT_SAMPLES_PER_ANSWER);
    // …and nothing is written back to the answer, so writes are the
    // samples alone. Reads exceed writes by exactly that one.
    expect(FANOUT_WRITES_PER_ANSWER).toBe(FANOUT_SAMPLES_PER_ANSWER);
    expect(FANOUT_READS_PER_ANSWER - FANOUT_WRITES_PER_ANSWER).toBe(1);
  });

  it("sizes the account's answers, not what a Circle reader is shown", () => {
    // A mature account has answered more than the display cap returns, so
    // the two quantities differ TODAY — if they ever agree this case goes
    // vacuous and says so here rather than passing quietly.
    expect(accountAnswers(true), "the cap no longer binds — this case proves nothing")
      .toBeGreaterThan(CIRCLE_ANSWER_CAP);
    expect(memberAnswers(true)).toBe(CIRCLE_ANSWER_CAP);
    expect(accountAnswers(true)).toBe(B.worldAnswers * 90);

    const perChange = 365 / B.stampChanges;
    expect(profileFanoutReads(true) * perChange).toBeCloseTo(FANOUT_READS_PER_ANSWER * accountAnswers(true), 9);
    expect(profileFanoutWrites(true) * perChange).toBeCloseTo(FANOUT_WRITES_PER_ANSWER * accountAnswers(true), 9);
    // The term is not the capped one. Stated as an inequality because the
    // fix is "uncapped", not "360": the day the rate changes, this holds
    // and an equality against a number would not.
    expect(profileFanoutWrites(true)).toBeGreaterThan(
      (B.stampChanges / 365) * FANOUT_WRITES_PER_ANSWER * memberAnswers(true));
  });

  it("a young account is under the cap, where both quantities agree", () => {
    // The other control: the correction is about which quantity is right,
    // not about making every figure bigger. Ten days in, the cap is not
    // near and the two expressions are the same number.
    expect(accountAnswers(false)).toBe(memberAnswers(false));
    expect(profileFanoutReads(false)).toBeLessThan(profileFanoutReads(true));
  });
});
