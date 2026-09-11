// cost-whovoted.test.mjs — the who-voted sheet's term, held to the shape
// of the loader it prices.
//
// Runbook 2.4 replaced a flat live list of ~200 answer documents with
// "the sample plus a live tail", and the saving is real — on the COLD
// question. The model booked it on both branches: it charged a hot sheet
// `crowd × names` flat, as if the sample document and the tail were only
// read when the sheet turned out cold. `loadVoters` reads them first and
// in that order, every time, and "hot" is precisely the case where they
// did not help — the tail came back at its cap and the loader falls
// through to the live list anyway, having already paid 51 reads.
//
// This is the fan-out defect one term over (07792726): a coefficient that
// reads plausibly and cannot be compared to anything. cost-arith.mjs
// cannot import `live.ts` — it is a node script pricing a browser module
// — so the pin is over the loader's source, in source-pins.test.mjs's
// shape: the ORDER of the calls is the fact, and a re-ordering that made
// the term wrong again fails here.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { stripComments } from "./strip-comments.mjs";
import { SHEET_SAMPLE_READ, socialTerms, VOTER_TAIL_CAP, B } from "./cost-arith.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Comments blanked, and this file of all of them needs it: the loader's
// own comments name every one of these calls while explaining the shape,
// so a raw scan would find them in the wrong order and pass on prose.
const live = stripComments(readFileSync(join(root, "src/v2/data/live.ts"), "utf8"));
const body = live.slice(live.indexOf("async loadVoters(qid: string)"));
const at = (needle) => {
  const i = body.indexOf(needle);
  expect(i, `loadVoters no longer contains ${needle} — the term prices a loader that has moved`).toBeGreaterThan(-1);
  return i;
};

describe("the who-voted term prices what loadVoters reads", () => {
  it("pays the sample, then the tail, then the live list — in that order", () => {
    const sample = at("fetchSampleDoc(");
    const tail = at("fetchVoterTail(");
    const liveList = at("fetchVoters(");
    expect(sample).toBeLessThan(tail);
    expect(tail).toBeLessThan(liveList);
    // The live list is the FALLBACK, reached with the other two already
    // paid — `if (!rows)`, outside the short-tail branch that builds
    // `rows`. That is what makes a hot sheet cost all three.
    // Either spelling of the same guard — the fact is that the fallback
    // is conditioned on `rows` and sits OUTSIDE the short-tail branch,
    // not how the null test is written. A pin that fired on a rename
    // would be noise, and noise is how a tripwire stops being read.
    expect(body.slice(tail, liveList)).toMatch(/if \(\s*(!\s*rows|rows\s*===?\s*null)\s*\)/);
    expect(body.indexOf(`tail.length < ${"VOTER_TAIL_CAP"}`)).toBeGreaterThan(-1);
  });

  it("charges a hot sheet the two reads that failed to avoid the live list", () => {
    const names = 2, dau = 500;
    const crowd = Math.min(200, dau);
    const hot = B.sheetOpensHot;
    const term = socialTerms(dau, true).whoVoted;

    // What the term is now, written out rather than restated from the
    // source: every open pays the sample, a hot open then pays the tail
    // and the live list, a cold one the tail and a profile per row.
    expect(term).toBeCloseTo(B.sheetOpens * (SHEET_SAMPLE_READ
      + hot * (VOTER_TAIL_CAP + crowd * names)
      + (1 - hot) * (VOTER_TAIL_CAP * names)), 9);

    // …and what it was: the live list flat on the hot branch, the sample
    // charged on the cold branch alone. The gap is exactly the sample and
    // the tail on the opens that end up reading the live list anyway.
    const wasCharged = B.sheetOpens * (hot * crowd * names + (1 - hot) * (1 + VOTER_TAIL_CAP * names));
    expect(term - wasCharged).toBeCloseTo(
      B.sheetOpens * hot * (SHEET_SAMPLE_READ + VOTER_TAIL_CAP), 9);
    // Non-vacuous only while some opens are hot, which is the whole
    // subject — say so here rather than passing on a zero.
    expect(hot, "no open is hot — this case proves nothing").toBeGreaterThan(0);
  });

  it("leaves the cold sheet where it was — not a raise for its own sake", () => {
    // The cold branch was already right: the sample, the tail, and a
    // profile per tail row. Recovered by pricing an all-cold sheet, so a
    // fix that had quietly moved it too would fail here.
    const names = 2, dau = 500;
    const crowd = Math.min(200, dau), hot = B.sheetOpensHot;
    // The cold half of the REAL term, recovered by taking the hot half off
    // it, against what the old formula charged a cold open. Equal, which
    // is the point: the sample read moved out of the cold branch and into
    // both, and a cold open pays what it always did.
    const hotHalf = B.sheetOpens * hot * (SHEET_SAMPLE_READ + VOTER_TAIL_CAP + crowd * names);
    const coldHalf = socialTerms(dau, true).whoVoted - hotHalf;
    expect(coldHalf).toBeCloseTo(B.sheetOpens * (1 - hot) * (1 + VOTER_TAIL_CAP * names), 9);
    expect(hot, "every open is hot — this case proves nothing").toBeLessThan(1);
  });
});
