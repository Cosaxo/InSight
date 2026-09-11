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
// cannot be compared to anything. So the samples-per-answer factor is
// pinned against `sampleIdsFor`'s own source, and the model's constants
// are what the rest of the assertions are about.
//
// SOURCE, NOT IMPORT — the sibling term's shape (cost-whovoted.test.mjs),
// and here for a reason that only CI can see. This file imported
// `sampleIdsFor` directly, which is the better pin when it works: it
// resolves `profileFanout.ts`, whose first line is
// `import … from "firebase-functions/v2/firestore"`. `test:scripts` runs
// in CI's LINT job, which installs the root package and never
// `functions/` — so the import is fine locally the moment anything has
// run `npm ci --prefix functions`, and `ERR_MODULE_NOT_FOUND` on a clean
// runner. That is the fifth-runner trap in CLAUDE.md wearing an
// environment instead of a stale assertion: nothing else goes red,
// because the only thing that imports across this boundary is a test
// about a cost model.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { stripComments } from "./strip-comments.mjs";
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

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Comments blanked for the same reason the sibling does it: the builder's
// own comments name both ids while explaining the shape, so a raw scan
// would find them in prose and pass on a body that adds neither.
const fanout = stripComments(readFileSync(join(root, "functions/src/profileFanout.ts"), "utf8"));
const body = fanout.slice(fanout.indexOf("export function sampleIdsFor("));
const builder = body.slice(0, body.indexOf("\n}"));

describe("the profile fan-out term prices what the fan-out does", () => {
  it("charges one sample document per id the real builder names", () => {
    // The ceiling: an answer names a WORLD sample always and a per-city
    // one when its frozen chips carry a city, so two at the ceiling. This
    // is the factor the model was wrong about — it read as one.
    expect(builder, "sampleIdsFor no longer adds the world sample — the term prices a builder that has moved")
      .toMatch(/ids\.add\(worldSampleId\(/);
    expect(builder, "sampleIdsFor no longer adds the city sample — the term is back to charging one")
      .toMatch(/ids\.add\(citySampleId\(/);
    expect(FANOUT_SAMPLES_PER_ANSWER).toBe(2);

    // The floor, and the control: the city id is the CONDITIONAL one, so
    // the constant is a ceiling rather than a flat count. A builder that
    // added it unconditionally would price the same and mean something
    // else, and a model charging the floor would be the old bug back.
    // The guard's spelling is not the fact and a pin that fired on a
    // rewrite would be noise; that the city id is CONDITIONED on the
    // answer carrying one is. Read off the statement that adds it.
    const cityStmt = builder.split("\n").find((l) => l.includes("ids.add(citySampleId("));
    expect(cityStmt, "the city sample is no longer conditional — the ceiling would be a flat count")
      .toMatch(/\bif\s*\(.*\ba\.city\b/);
    expect(FANOUT_SAMPLES_PER_ANSWER).toBeGreaterThan(1);
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
