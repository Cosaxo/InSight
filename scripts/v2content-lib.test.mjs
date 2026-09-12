// v2content-lib.test.mjs — the generated bank is emitted in slices, and
// this pins the two halves of that against each other.
//
// WHY THIS EXISTS. `functions/src/v2content.ts` used to be one array
// literal, and `tsc` type-checks such a literal by forming the union of its
// element types. V2SeedQuestion has ~45 optional members, so that union
// grows with the bank: at 1085 questions `npm run build --prefix functions`
// passed and at 1145 it failed with TS2590, "expression produces a union
// type that is too complex to represent", pointing at the `= [` and naming
// no question. Nothing else went red — the client typecheck, eslint, both
// vitest runners and every check gate were green, because none of them
// builds the functions package.
//
// The fix slices the bank. That makes the file's DATA live in
// `const BANK_0`, `BANK_1`, … while the export is JavaScript
// (`[...BANK_0, ...BANK_1]`), which is not JSON — so the one helper that
// reads this file back as data had to move with the generator. Its own
// comment already warned what happens when the file's shape changes and
// the helper does not: three callers failed three different ways, and the
// worst of them reported an invented number instead of failing (D197).
//
// So the round trip is the test: what the generator writes, the parser must
// read back exactly, and no slice may exceed the bound the compiler limit
// is being kept under.
import { describe, it, expect } from "vitest";
import { generate, buildEntries, loadContent, BANK_SLICE } from "./gen-v2content.mjs";
import { bankArray } from "./v2content-lib.mjs";

const generated = generate();

describe("the sliced bank round-trips through its parser", () => {
  it("reads back exactly what the generator wrote, in order", () => {
    // Not a length check: the whole bank, entry for entry. A parser that
    // dropped a slice, or read one twice, or lost the order the seq fields
    // depend on, passes a count and fails this.
    expect(bankArray(generated)).toEqual(buildEntries());
  });

  it("emits the bank as slices, not as one literal", () => {
    // The property the compiler limit actually needs. If someone puts the
    // single literal back, this fails here rather than in the functions
    // build, which is the runner nobody runs locally.
    const slices = [...generated.matchAll(/^const BANK_(\d+): V2SeedQuestion\[\] = \[/gm)];
    expect(slices.length, "the bank is not sliced any more").toBeGreaterThan(1);
    expect(slices.map((m) => Number(m[1]))).toEqual(slices.map((_, i) => i));
    expect(generated).toContain(
      `export const V2_QUESTIONS: V2SeedQuestion[] = [${
        slices.map((_, i) => `...BANK_${i}`).join(", ")
      }];`,
    );
  });

  it("keeps every slice under the bound, however big the bank gets", () => {
    // BANK_SLICE is 200 against a measured ceiling somewhere above 573, so
    // this is not close. It is here because the failure it guards is
    // invisible: growth moves the bank, never the slice size, and the day
    // the two get confused the error names a `= [` and no question.
    const counts = bankArray(generated).length;
    const sliced = [...generated.matchAll(/^const BANK_\d+: V2SeedQuestion\[\] = /gm)].length;
    expect(sliced).toBe(Math.ceil(counts / BANK_SLICE));
    expect(BANK_SLICE).toBeLessThanOrEqual(500);
  });
});

describe("the parser refuses a shape it cannot read", () => {
  it("throws rather than returning a short bank when the slices are gone", () => {
    // The D197 failure mode, pointed at this shape: a helper that returns
    // something plausible from a file it no longer understands is worse
    // than one that stops.
    expect(() => bankArray("export const V2_QUESTIONS: V2SeedQuestion[] = [];\n")).toThrow(
      /no `const BANK_0/,
    );
  });

  it("throws when a slice is missing from the middle", () => {
    const withoutFirst = generated.replace(/^const BANK_0: V2SeedQuestion\[\] = /m, "const GONE = ");
    expect(() => bankArray(withoutFirst)).toThrow(/out of order/);
  });
});

// ── a pulse's window start reaches the device ─────────────────────────
//
// `since` is the only input to `asksOn` (src/v2/data/pulse.ts), which is
// what stops a 21-day reading from counting the days before a pulse
// existed as misses — and `check:quality` hard-fails any NEW pulse that
// does not carry one. The emitter built each pulse doc from a closed
// field list that had no `since` in it, so a lane could author the field,
// satisfy the gate, and have it dropped here on the way to
// `v2_questions`: `startedOn` null, `asksOn` true for all 21 days, and
// the pre-history drawn as a broken streak. The producer in the middle is
// the half no gate was looking at.
//
// Driven through a SYNTHETIC pulse rather than the shipped five, which
// carry no `since` and correctly never will — a pin off the real content
// would pass by having nothing to carry.
describe("a pulse's window start survives the emitter", () => {
  const withPulse = (q) => {
    const real = loadContent();
    return { ...real, pulse: { ...(real.pulse || {}), questions: [q] } };
  };
  const PULSE = {
    id: "probe", prompt: "How did the probe go?",
    options: [{ id: "a", label: "Badly" }, { id: "b", label: "Well" }],
    since: "2026-09-20",
  };

  it("emits `since` on a pulse that carries one", () => {
    const entry = buildEntries(withPulse(PULSE)).find((e) => e.id === "pulse-probe");
    expect(entry, "the synthetic pulse never reached the bank — this case is pinning nothing").toBeTruthy();
    expect(entry.since, "the day the pulse starts asking was dropped between the file and the device").toBe("2026-09-20");
  });

  it("emits no `since` key at all for a pulse without one", () => {
    // The other half, and the reason for the conditional spread: the five
    // shipped pulses predate any window that can be drawn, and the drift
    // gate compares bytes.
    const { since: _drop, ...bare } = PULSE;
    const entry = buildEntries(withPulse(bare)).find((e) => e.id === "pulse-probe");
    expect(Object.prototype.hasOwnProperty.call(entry, "since"),
      "an empty `since` was emitted, which moves every shipped pulse's bytes").toBe(false);
  });
});
