// @vitest-environment jsdom
//
// THE CONSEQUENCE BEAT REPLAYED A SPLIT THAT DOES NOT EXIST YET.
//
// A live card whose aggregate has not landed carries `noCountsYet`, and
// every shape on the card reads it: the tiles suppress their percentages,
// the bars degrade, the dial refuses its curve, `renderVote` takes the
// bars path. The BEAT never asked. So voting on a fresh live question ran
// the reveal animation off `q.options.map(o => o.count)` — all zero, plus
// your own vote — and said "100% chose Yes · you're with them", on the one
// card in the app that has nobody to be with.
//
// daily-split.jsx has gated its own beat on this since it had one
// (`!(S.live && S.noCountsYet)`). The feed is the copy that never got
// written, which is the whole reason the flag now has ONE reader in this
// file instead of three hand-written spellings of the same two terms.
//
// A SOURCE-SHAPE TEST, deliberately, and the same instrument
// feed-near-tie.test.jsx uses on this file for the same reason: the beat
// gate lives inside a setState updater in a class the feed only reaches
// through a full deferred mount with live questions, and the property
// worth holding is not one card's pixels but that no FOURTH copy of the
// condition appears. What it cannot see is a consumer that stops asking
// altogether — so it counts the consumers too.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(resolve(here, "../spec/world-feed.jsx"), "utf8");
const daily = readFileSync(resolve(here, "../spec/daily-split.jsx"), "utf8");

describe("the feed's no-crowd flag has one reader", () => {
  it("defines the predicate, and it means NOBODY BUT ME", () => {
    // The `every(o => !o.count)` half is load-bearing and was added after
    // this file already existed. `noCountsYet` alone is `agg.total > 0`
    // (data/deck.ts) — a population that INCLUDES the viewer — while
    // every `o.count` the card draws has the viewer subtracted back out
    // by `countsFor`. So on a question only you have answered, the fold
    // landing flipped the floor off and the card printed 100% over a
    // crowd of nobody, a couple of seconds after the write, on screen.
    //
    // Pinned as source text for the same reason the rest of this file is:
    // the condition is hand-written at four sites and the whole point is
    // that it stays one definition.
    expect(src).toContain("q.noCountsYet || (q.options || []).every((o) => !o.count)");
    expect(src).toContain("function wfNoCrowd(q) {");
    // The daily writes its own copy (a different local shape, same rule),
    // and it is the site the original beat forgot — so it is pinned too.
    expect(daily).toContain("S.noCountsYet || S.options.every((o) => !o.count)");
  });

  it("reads `noCountsYet` in that one place and nowhere else", () => {
    // THE RATCHET. Three hand-written copies is how the fourth came to be
    // missing: the condition was something you remembered to write, not
    // something the file already knew. A new site that spells it out again
    // fails here and should — call the predicate.
    const spelled = [...src.matchAll(/q\.noCountsYet/g)];
    expect(spelled.length, "a second spelling of the flag appeared — call wfNoCrowd(q)").toBe(1);
  });

  it("has every consumer still asking, so the count above is not zero-by-deletion", () => {
    // The failure this file could otherwise pass through: delete every
    // guard and the assertion above goes green with one match left in the
    // helper nobody calls.
    // Lookbehind so the declaration itself is not counted as a caller —
    // which is exactly the vacuity this case exists to rule out.
    const calls = [...src.matchAll(/(?<!function )wfNoCrowd\(q\)/g)];
    expect(calls.length).toBe(6);
  });

  it("gates the beat on it", () => {
    // The defect itself. `!selfOnly` was there — an authored-count lens
    // card has no measurement either — and the live half was not.
    const gate = /const beat = \(!editing && this\.props\.beats !== false && !selfOnly && !wfNoCrowd\(q\)\) \? id : s\.beat;/;
    expect(src).toMatch(gate);
  });

  it("matches the daily, which had the guard all along", () => {
    // The precedent, pinned so the two surfaces cannot drift apart again
    // in the other direction — and both now carry the WIDER predicate.
    //
    // The beat's gate is the one that mattered most and was fixed last:
    // its entire payload is the crowd claim, so on a question whose only
    // answer is your own it said "100% chose Yes — you're with them" with
    // nobody to be with. Fixing the ballot's floor first was not enough,
    // which is how this site was found — the mount test still printed the
    // sentence after the numerals were gone.
    expect(daily).toContain("!(S.live && (S.noCountsYet || S.options.every((o) => !o.count)))");
    expect(daily).toMatch(/beat: \(moved && this\.props\.beats !== false/);
  });
});

describe("the bars drew the split they were suppressing", () => {
  // The second defect the one-name-two-meanings collision was hiding. The
  // bars method's local `noCrowd` meant `q.selfOnly`; the file's other
  // `noCrowd` means "no aggregate yet". The fill asked the first and the
  // numeral asked the second, so a fresh live card printed no percentage
  // and drew the bar to that percentage's width — the split published
  // geometrically while being withheld numerically. Its own comment had
  // said for as long as it existed that the two are one gate: "the fill
  // width IS the share in a different alphabet … so it is gated together
  // with the numeral."
  it("gates the fill and the numeral on the same value", () => {
    expect(src).toContain("const noSplit = selfOnly || wfNoCrowd(q);");
    expect(src).toContain("width: (noSplit ? 0 : p[i]) + '%'");
    expect(src).toContain("{c[i] === maxN && !noSplit &&");
  });

  it("leaves no second meaning of `noCrowd` in the file", () => {
    // One name, one meaning. The remaining one is the dial's, which is
    // the no-aggregate sense and reads the predicate.
    const decls = [...src.matchAll(/const noCrowd = (.+);/g)].map((m) => m[1]);
    expect(decls).toEqual(["wfNoCrowd(q)"]);
  });
});

describe("a majority needs somebody in it besides you", () => {
  // The third instance of the same claim in this file, and the one small
  // enough to look harmless. `wfPcts` counts the viewer, so a total of 1
  // is the viewer's own vote and nothing else — and the meta line under
  // the card said "1 vote · with the majority". There is no side to be on.
  it("drops the side-claim at a total of one, keeping the scale", () => {
    expect(src).toContain("const alone = total <= 1;");
    expect(src).toContain("(alone ? '' : (c[mine] === maxN ? ' \u00b7 with the majority' : ' \u00b7 you picked the underdog'))");
  });

  it("still claims a side once there is a crowd", () => {
    // The control: the clause survives, it is only gated. If the whole
    // sentence had gone, the case above would still pass.
    expect(src).toContain("' \u00b7 with the majority'");
    expect(src).toContain("' \u00b7 you picked the underdog'");
  });

  it("reads the COUNTS for it, which is what D-near-tie fixed", () => {
    // Guard against the gate being added by rewriting the expression off
    // the rounded shares — the defect feed-near-tie.test.jsx exists for.
    expect(src).toMatch(/const maxN = Math\.max\(\.\.\.c\);\n {4}const alone/);
  });
});
