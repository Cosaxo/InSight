// profileStamp.test.ts — the server's copy of the device's profile parse,
// held to the original.
//
// The stamp on a ledger entry becomes the name and scores on a sample row,
// and a sample row is what the phone now reads INSTEAD of the profile
// (DATA-EFFICIENCY-RUNBOOK 2.3). So the server's parse and the device's
// parse have to agree on every input, or the same person ranks one way
// from a sample and another from a live read. The two packages do not
// share a build, which is why this is a copy — and why the pin below runs
// the ORIGINAL rather than a fixture of it: a fixture would be a third
// copy, and D197 is what three copies cost.
import { describe, expect, it } from "vitest";
import {
  CORE_TEST_KINDS as CORE_TEST_KINDS_DEVICE,
  parseLogicPct as parseLogicPctDevice,
  parseTestResults as parseTestResultsDevice,
} from "../../src/v2/data/similarity";
import {
  CORE_TEST_KINDS, displayNameOf, parseLogicPct, parseTestResults, profileStamp, sameStamp,
} from "./profileStamp";

/** Every shape a hostile or broken client has stored, or could. */
const CORPUS: unknown[] = [
  null, undefined, "junk", 42, [], {},
  { big5: { dims: "junk" } },
  { big5: { dims: [{ id: "O", value: 78.4 }, { id: "C", value: 4e9 }, { id: "E", value: -3 }, { id: "N", value: "not a number" }] } },
  { big5: { dims: [{ id: "", value: 50 }, { value: 50 }, null, "x", { id: "A", value: "51.5" }] } },
  { hostile: { dims: [{ id: "x", value: 50 }] } },
  { political: { dims: [{ id: "econ", value: 12 }, { id: "auth", value: 88 }] }, values: { dims: [{ id: "beauty", value: 0.4 }] } },
  { attachment: { dims: [{ id: "anx", value: 33 }, { id: "avoid", value: 66 }] }, logic: { pctile: 71.6 } },
  { big5: { dims: Array.from({ length: 1000 }, (_, i) => ({ id: `d${i}`, value: 50 })) } },
  { logic: { pctile: "88" } }, { logic: { pctile: 140 } }, { logic: { pctile: -3 } }, { logic: { pctile: NaN } },
  { logic: "junk" }, { logic: { marks: 7 } },
  { big5: { dims: [{ id: "O", value: Infinity }, { id: "C", value: 49.5 }, { id: "E", value: 50.5 }] } },
];

describe("the server's parse is the device's parse", () => {
  it("names the same instruments", () => {
    expect([...CORE_TEST_KINDS]).toEqual([...CORE_TEST_KINDS_DEVICE]);
  });

  it("reads every corpus entry the same way, scores and logic both", () => {
    // The vacuity guard: at least one entry must parse to something on
    // each side, or an "always null" copy would agree with anything.
    let usable = 0;
    for (const raw of CORPUS) {
      const mine = parseTestResults(raw, CORE_TEST_KINDS);
      const theirs = parseTestResultsDevice(raw, CORE_TEST_KINDS_DEVICE);
      expect(mine, JSON.stringify(raw)).toEqual(theirs);
      expect(parseLogicPct(raw), JSON.stringify(raw)).toBe(parseLogicPctDevice(raw));
      if (mine) usable += 1;
    }
    expect(usable).toBeGreaterThanOrEqual(4);
  });
});

describe("profileStamp", () => {
  it("takes the name the way resolveNames does: trimmed, 60 characters, '' for anything else", () => {
    expect(displayNameOf("  Olaf  ")).toBe("Olaf");
    expect(displayNameOf("x".repeat(80))).toHaveLength(60);
    expect(displayNameOf(42)).toBe("");
    expect(displayNameOf(undefined)).toBe("");
  });

  it("stamps a missing profile as nothing rather than not at all", () => {
    expect(profileStamp(undefined)).toEqual({ n: "", s: null, l: null });
    expect(profileStamp({ displayName: "Ola", testResults: { logic: { pctile: 40 } } }))
      .toEqual({ n: "Ola", s: null, l: 40 });
  });

  it("compares stamps by what they say, not by key order", () => {
    const a = profileStamp({ displayName: "A", testResults: { big5: { dims: [{ id: "O", value: 1 }, { id: "C", value: 2 }] } } });
    const b = profileStamp({ displayName: "A", testResults: { big5: { dims: [{ id: "C", value: 2 }, { id: "O", value: 1 }] } } });
    expect(sameStamp(a, b)).toBe(true);
    expect(sameStamp(a, { ...a, n: "B" })).toBe(false);
    expect(sameStamp(a, { ...a, l: 5 })).toBe(false);
    expect(sameStamp(a, { ...a, s: { big5: { O: 1, C: 3 } } })).toBe(false);
    expect(sameStamp(a, { ...a, s: { big5: { O: 1 } } })).toBe(false);
    expect(sameStamp(a, { ...a, s: null })).toBe(false);
    expect(sameStamp({ n: "", s: null, l: null }, profileStamp({}))).toBe(true);
  });
});
