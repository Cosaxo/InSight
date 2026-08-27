// The profession → jobField derivation (D317).
//
// WHY THIS EXISTS, given that check:anchors already holds JOB_FIELDS equal
// to BREAKDOWN_DIM_VOCAB and proves every JOB_OPTS entry maps into it.
// That gate reads SOURCE — two array literals and an object literal. It
// cannot see whether `anchorsFrom` actually calls the derivation, and that
// is the half that reaches Firestore. A profile that emits `profession`
// and no `jobField` writes an answer the trigger folds into every
// dimension except the new one: nothing red anywhere, the dim simply never
// fills. The same silence D258 and D285 are records of.
//
// So the gate holds the vocabularies and this holds the WIRING.
import { describe, expect, it } from "vitest";

// @ts-expect-error TS7016 — untyped spec module (the cohortVocab pattern)
import { JOB_OPTS, JOB_FIELDS, jobFieldOf, anchorsFrom } from "../spec/profile-vitals.js";

const opts = JOB_OPTS as readonly string[];
const fields = JOB_FIELDS as readonly string[];
const fieldOf = jobFieldOf as (job: string) => string;
const anchors = anchorsFrom as (v: Record<string, string>) => Record<string, string>;

describe("jobFieldOf", () => {
  it("maps every pick to a declared field", () => {
    for (const job of opts) {
      const f = fieldOf(job);
      expect(f, `${job} mapped to ${JSON.stringify(f)}`).not.toBe("");
      expect(fields, `${job} → ${f}`).toContain(f);
    }
  });

  it("returns '' for a value it does not claim to have grouped", () => {
    // NOT "Other". A profile written before D317 holds a string this map
    // never saw — the seeded persona's "Editor · independent press" is a
    // real one in the tree — and filing it under Other would report a
    // cohort membership nobody chose. '' folds to no bucket, which is what
    // "not measured" looks like in every other dimension.
    expect(fieldOf("Editor · independent press")).toBe("");
    expect(fieldOf("")).toBe("");
    expect(fieldOf("Carpenter")).toBe("");
  });

  it("collapses the pick that could never have been a bucket", () => {
    // The slash is in breakdownBucket's rejected character class, so this
    // option would fold into nothing if the pick were the dim — the
    // `Vocational / trade` bug, still shipped in the pick list because a
    // pick is the user's word. The derivation is where it gets fixed.
    expect(fieldOf("Entrepreneur / self-employed")).toBe("Self-employed");
  });
});

describe("anchorsFrom", () => {
  it("emits the derived field beside the pick", () => {
    const a = anchors({ job: "Retail" });
    expect(a.profession).toBe("Retail");
    expect(a.jobField).toBe("Service & hospitality");
  });

  it("emits an empty field rather than omitting the key", () => {
    // Consistent with every other anchor here: the map's shape does not
    // depend on what the user filled in, so `isValidV2Anchors` sees the
    // same key set either way and a missing value is distinguishable from
    // a key the client forgot to send.
    const a = anchors({});
    expect(a.profession).toBe("");
    expect(a.jobField).toBe("");
  });

  it("never lets the pick reach the aggregate as its own bucket", () => {
    // The property the whole design rests on: whatever a person picks,
    // what lands in `jobField` is one of the twenty. A regression that
    // passed the pick straight through would be caught here rather than by
    // a dimension that quietly grew a 21st bucket in production.
    for (const job of opts) {
      expect(fields).toContain(anchors({ job }).jobField);
    }
  });
});
