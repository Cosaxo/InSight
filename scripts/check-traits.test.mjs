// check-traits.test.mjs — pins the trait vocabulary gate's four rules.
//
// This suite exists because of the fifth runner (D179/D197/D275): what
// breaks in `test:scripts` is always a script that CHECKS something, so
// nothing else in CI goes red when it stops working. Every rule below is
// asserted to FIRE on a mutated input, because a gate that has never
// failed is not evidence that it can.
import { describe, it, expect } from "vitest";
import {
  intConst, orderProblems, rejectClass, staleProblems, treeVocab, vocabProblems,
} from "./check-traits.mjs";

const LIMITS = { maxBuckets: 24, maxLabel: 40, reject: /[./[\]*~]/ };
const ok = () => ({
  big5: ["The Reader", "The Planner", "untested"],
  big5_O: ["b0", "b1", "b2", "b3", "b4", "untested"],
  political: ["Centrist", "untested"],
  political_econ: ["b0", "b1", "b2", "b3", "b4", "untested"],
  values: ["Seeker", "untested"],
  values_future: ["b0", "b1", "b2", "b3", "b4", "untested"],
  attachment: ["The warm one", "untested"],
  attachment_warm: ["b0", "b1", "b2", "b3", "b4", "untested"],
  logic: ["top", "upper", "lower", "bottom", "untested"],
  extra: ["a", "b"],
});

describe("rule 1 · the generated file is a fresh generation", () => {
  it("is silent when the file matches", () => {
    expect(staleProblems("same", "same")).toEqual([]);
  });
  it("fires when the file drifts from the generator", () => {
    const p = staleProblems("hand edited", "generated");
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/npm run build:traits/);
  });
});

describe("rules 2 and 3 · the vocabularies are closed and legal", () => {
  it("is silent on the real tree", async () => {
    expect(vocabProblems(await treeVocab(), LIMITS)).toEqual([]);
  });

  it("is silent on a healthy fixture", () => {
    expect(vocabProblems(ok(), LIMITS)).toEqual([]);
  });

  it("fires when a vocabulary reaches the bucket cap", () => {
    const v = ok();
    v.big5 = Array.from({ length: 24 }, (_, i) => `t${i}`);
    const p = vocabProblems(v, LIMITS);
    expect(p.join("\n")).toMatch(/BREAKDOWN_MAX_BUCKETS=24/);
  });

  it("fires on a bucket carrying a rejected character", () => {
    const v = ok();
    v.big5 = ["The Reader", "a/b", "untested"];
    expect(vocabProblems(v, LIMITS).join("\n")).toMatch(/breakdownBucket refuses/);
  });

  it("fires on a bucket past the label cap", () => {
    const v = ok();
    v.big5 = ["x".repeat(41), "untested"];
    expect(vocabProblems(v, LIMITS).join("\n")).toMatch(/BREAKDOWN_MAX_LABEL=40/);
  });

  it("fires on a bucket that is a key on Object.prototype", () => {
    // pure.ts measured what this costs: the fold's assignment writes the
    // prototype chain instead of a field, and unrelated questions then
    // publish counts nobody cast.
    for (const key of ["__proto__", "constructor", "toString"]) {
      const v = ok();
      v.big5 = ["The Reader", key, "untested"];
      expect(vocabProblems(v, LIMITS).join("\n"), key).toMatch(/Object\.prototype/);
    }
  });

  it("fires on a duplicate bucket within one dim", () => {
    const v = ok();
    v.big5 = ["The Reader", "The Reader", "untested"];
    expect(vocabProblems(v, LIMITS).join("\n")).toMatch(/appears twice/);
  });

  it("fires on an empty or missing bucket list", () => {
    const v = ok();
    v.big5 = [];
    expect(vocabProblems(v, LIMITS).join("\n")).toMatch(/no buckets at all/);
    const v2 = ok();
    v2.big5 = ["", "untested"];
    expect(vocabProblems(v2, LIMITS).join("\n")).toMatch(/empty bucket key/);
  });

  it("refuses to pass on an empty parse — a silent gate is the failure it guards", () => {
    expect(vocabProblems({}, LIMITS).join("\n")).toMatch(/the gate is broken, not the tree/);
  });

  it("reports unreadable limits rather than skipping the checks", () => {
    const p = vocabProblems(ok(), { maxBuckets: null, maxLabel: null, reject: null });
    expect(p.join("\n")).toMatch(/BREAKDOWN_MAX_BUCKETS/);
    expect(p.join("\n")).toMatch(/BREAKDOWN_MAX_LABEL/);
    expect(p.join("\n")).toMatch(/rejected character class/);
  });
});

describe("the constants are read out of pure.ts, not restated", () => {
  it("reads an int constant and the reject class", () => {
    const src = "export const BREAKDOWN_MAX_BUCKETS = 24;\n"
      + "  if (/[./[\\]*~]/.test(v)) return null;\n";
    expect(intConst(src, "BREAKDOWN_MAX_BUCKETS")).toBe(24);
    const re = rejectClass(src);
    expect(re).toBeTruthy();
    expect(re.test("a/b")).toBe(true);
    expect(re.test("The Reader")).toBe(false);
  });
  it("returns null when the constant is gone, so the caller can report it", () => {
    expect(intConst("nothing here", "BREAKDOWN_MAX_BUCKETS")).toBeNull();
    expect(rejectClass("nothing here")).toBeNull();
  });
});

describe("rule 4 · client and server agree on the instruments and their order", () => {
  const KINDS = ["big5", "political", "values", "attachment"];
  const src = (order) => order.map((k) => `"${k}"`).join(" ");

  it("is silent when both sides list the same instruments in the same order", () => {
    expect(orderProblems(src(KINDS), src(KINDS), KINDS)).toEqual([]);
  });

  it("fires when the ORDER differs — the chip would draw the wrong rows", () => {
    const flipped = ["political", "big5", "values", "attachment"];
    expect(orderProblems(src(KINDS), src(flipped), KINDS).join("\n")).toMatch(/order/);
  });

  it("fires when one side drops an instrument", () => {
    const short = ["big5", "values", "attachment"];
    expect(orderProblems(src(KINDS), src(short), KINDS).join("\n")).toMatch(/disagree/);
  });

  it("refuses to pass when it can see nothing on a side", () => {
    expect(orderProblems(src(KINDS), "no instruments here", KINDS).join("\n"))
      .toMatch(/treat as broken, not as passing/);
  });
});
