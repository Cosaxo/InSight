// check-monitoring.test.mjs — rule 9, the emitter end of the alert chain.
//
// Rules 1-8 walk from a committed policy, and each was verified by breaking
// the link it holds. Rule 9 walks the other way — from the `metric: "X"` a
// Cloud Function writes, to the log-based metric that has to select on it —
// and it catches the one direction the other eight structurally cannot see:
// the emit is in the repo, the arming is not, and every gate stays green.
// D323 §3 records that a buyer charged twice is "recorded AND alarmed", and
// the second half has never been true. That is what these cases pin.
//
// THE CONTROL-BYTE CASE IS NOT HYPOTHETICAL. functions/src/taste.ts carried
// a raw NUL byte until the commit these tests land in, so `grep` called the
// file binary and reported none of the names in it — which is how
// `taste_fold` was missing from the first inventory of what this repo emits.
// The byte is gone; the case stays, because what it pins is the parser, and
// the next such byte will not announce itself. A scanner one byte can silence reports
// a smaller debt than the real one, in the direction that flatters, and
// this rule's whole subject is that a name nobody can see is a name nobody
// arms. So the parser takes decoded text, where a control character is just
// a character that matches nothing.
//
// The two baseline directions matter as much as the forward one. A ratchet
// that keeps counting after the code stopped doing the thing reports a debt
// nobody owes (D275), and one that is not brought down when a name is armed
// lets the next unarmed emitter of that name pass silently.
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { emittedMetrics, auditEmitters, opaqueEmits, UNARMED } from "./check-monitoring.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// The house pattern verbatim — `logger.x(message, { metric: "X", … })`, as
// v2.ts and paid.ts write it.
const EMITTER = `
logger.error("[paid] SECOND payment for booking", {
  metric: "paid_duplicate_payment",
  bid,
});
`;

describe("emittedMetrics", () => {
  it("finds a name in a file carrying a control byte", () => {
    // Built from a char code, never pasted: a source file holding a raw NUL
    // is the bug this case is about, and one in the test would spread it.
    const NUL = String.fromCharCode(0);
    const src = `const marker = 1;${NUL}\nlogger.info("taste fold", { metric: "taste_fold" });`;
    const got = emittedMetrics([["functions/src/taste.ts", src]]);
    expect([...got.keys()]).toEqual(["taste_fold"]);
    expect(got.get("taste_fold")).toEqual(["functions/src/taste.ts"]);
  });

  it("attributes each name to the files that emit it, once per file", () => {
    const got = emittedMetrics([
      ["a.ts", `${EMITTER}${EMITTER}`],
      ["b.ts", 'logger.info("x", { metric: "bank_rank" });'],
    ]);
    expect(got.get("paid_duplicate_payment")).toEqual(["a.ts"]);
    expect(got.get("bank_rank")).toEqual(["b.ts"]);
  });

  // paid.ts:612 verbatim in shape. The first version of this rule matched a
  // bare literal only, so BOTH names were emitted, unarmed and unrecorded
  // while the gate printed OK — the inventory said 24 where the tree emits
  // 26. An inventory that misses an emit understates the debt, which is the
  // direction that flatters.
  it("takes both names out of a ternary, and not the condition's own literal", () => {
    const got = emittedMetrics([["paid.ts",
      'logger.info(`review ${bid}`, {\n'
      + '  metric: v.verdict === "approve" ? "paid_review_approved" : "paid_review_declined",\n'
      + "});"]]);
    expect([...got.keys()].sort()).toEqual(["paid_review_approved", "paid_review_declined"]);
  });

  it("does not let a following property's string become a metric name", () => {
    const got = emittedMetrics([["a.ts", 'logger.info("x", { metric: "bank_rank", by: "operator" });']]);
    expect([...got.keys()]).toEqual(["bank_rank"]);
  });
});

// A name assembled at runtime never appears in the tree as text, so no
// grep, no reviewer and no rule above can find it. Counting such a site as
// zero names is what made the ternary invisible; these fail it instead.
describe("opaqueEmits", () => {
  it("fails a name built by a template literal", () => {
    const got = opaqueEmits([["a.ts", 'logger.info("x", { metric: `paid_review_${v.verdict}` });']]);
    expect(got).toHaveLength(1);
    expect(got[0].file).toBe("a.ts");
  });

  it("fails a name held in a variable", () => {
    expect(opaqueEmits([["a.ts", 'logger.info("x", { metric: chosen });']])).toHaveLength(1);
  });

  it("reports the line, so the fix needs no search", () => {
    const got = opaqueEmits([["a.ts", 'const a = 1;\nconst b = 2;\nlogger.info("x", { metric: v });']]);
    expect(got[0].line).toBe(3);
  });

  it("is silent on both countable shapes", () => {
    expect(opaqueEmits([
      ["a.ts", EMITTER],
      ["b.ts", 'logger.info("x", { metric: c === "y" ? "bank_rank" : "taste_fold" });'],
    ])).toEqual([]);
  });

  it("is silent on the real tree, or the counts above are wrong", () => {
    // The gate fails on any site here, so this is the case that would go red
    // first if somebody writes an uncountable emit into functions/src.
    const files = readdirSync(join(root, "functions/src"))
      .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
      .map((f) => [`functions/src/${f}`, readFileSync(join(root, "functions/src", f), "utf8")]);
    expect(opaqueEmits(files)).toEqual([]);
  });
});

describe("auditEmitters", () => {
  const emitted = emittedMetrics([["a.ts", EMITTER]]);

  it("fails an emitter with no metric and no recorded reason", () => {
    const got = auditEmitters(emitted, ["agg_contention"], {});
    expect(got.unarmed).toEqual(["paid_duplicate_payment"]);
    expect(got.ghosts).toEqual([]);
  });

  it("passes an emitter recorded in the baseline", () => {
    const got = auditEmitters(emitted, ["agg_contention"], {
      paid_duplicate_payment: "recorded, with the reason it is unarmed",
    });
    expect(got).toEqual({ unarmed: [], ghosts: [], armed: [] });
  });

  it("passes an emitter a metric selects on, baseline or none", () => {
    expect(auditEmitters(emitted, ["paid_duplicate_payment"], {}).unarmed).toEqual([]);
  });

  it("fails a baseline entry whose emitter no longer exists", () => {
    // The stale direction. The name was retired, the entry was not, and the
    // debt then reads larger than it is until somebody counts by hand.
    const got = auditEmitters(emitted, [], { paid_refund_offapp: "gone from the code" });
    expect(got.ghosts).toEqual(["paid_refund_offapp"]);
  });

  it("fails a baseline entry that has since been armed", () => {
    const got = auditEmitters(emitted, ["paid_duplicate_payment"], {
      paid_duplicate_payment: "no longer true — a metric selects on it now",
    });
    expect(got.armed).toEqual(["paid_duplicate_payment"]);
  });
});

describe("the shipped baseline, against the tree", () => {
  // Read the way the gate reads: bytes decoded as utf8, so the file with the
  // NUL is scanned like any other. This half keeps working after that byte
  // is fixed — the name has to stay in the inventory either way, and the
  // ghost case below is what notices if a fix takes the emit with it.
  const fnFiles = readdirSync(join(root, "functions/src"))
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .sort()
    .map((f) => [`functions/src/${f}`, readFileSync(join(root, "functions/src", f), "utf8")]);
  const emitted = emittedMetrics(fnFiles);

  it("sees taste.ts's emit, control byte or not", () => {
    expect(emitted.get("taste_fold")).toEqual(["functions/src/taste.ts"]);
  });

  it("records only names something actually emits", () => {
    expect(Object.keys(UNARMED).filter((n) => !emitted.has(n))).toEqual([]);
  });

  it("gives every recorded name a reason of its own", () => {
    // A baseline whose entries are empty strings is a bare list wearing a
    // map's shape. Twenty characters is not a sentence, but it is not "".
    for (const [name, reason] of Object.entries(UNARMED)) {
      expect(typeof reason, name).toBe("string");
      expect(reason.length, name).toBeGreaterThan(20);
    }
  });
});
