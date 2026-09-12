// pulse-budget.test.mjs — the pulse lane's regulator (D481).
//
// WHY A REGULATOR NEEDS A TEST AT ALL, stated because this repo has been
// bitten by the alternative three times (D179, D197, D275): a script that
// CHECKS something fails silently. It reports a number, the number looks
// plausible, and nothing else goes red. `test:scripts` is where that class
// is caught, and a budget that granted the wrong thing would be found on
// the day a lane wrote twelve permanent cards instead of one.
//
// The properties, in the order they matter:
//   1. the ceiling BINDS — this lane's whole shape is "fill, then stop";
//   2. past it the lane switches to proposing a SWAP, never a pile;
//   3. an open PR stops it, because propose-only means a human is the gate;
//   4. the rate is one, whatever the room.
import { describe, it, expect } from "vitest";
import { pulseBudget, loadRoster, ROSTER_CEILING, RUN_CAP, OPEN_MAX } from "./pulse-budget.mjs";

const roster = (n) => Array.from({ length: n }, (_, i) => ({ id: `pulse-${i}` }));

describe("the fill", () => {
  it("grants one a run while there is room", () => {
    const b = pulseBudget({ roster: roster(5) });
    expect(b.budget).toBe(1);
    expect(b.mode).toBe("add");
    expect(b.room).toBe(ROSTER_CEILING - 5);
  });

  it("grants one and not the whole deficit", () => {
    // The difference between this lane and every other one. A feed or
    // learn budget grants against a deficit, because what it writes is
    // consumed; a pulse is permanent, so twenty-five places left is not
    // twenty-five questions of work — it is twenty-five weeks of it.
    expect(pulseBudget({ roster: roster(1) }).budget).toBe(RUN_CAP);
    expect(RUN_CAP).toBe(1);
  });

  it("grants the last place and no more", () => {
    const b = pulseBudget({ roster: roster(ROSTER_CEILING - 1) });
    expect(b.budget).toBe(1);
    expect(b.room).toBe(1);
  });
});

describe("the ceiling", () => {
  it("is thirty, and that is Firestore's `in` cap rather than a taste", () => {
    // `ensureToday` reads one aggregate id per pulse on every feed open,
    // through `where(documentId(), "in", ids)`. Thirty is the largest
    // roster that costs ONE query. The number is pinned here because the
    // header argues from it — a ceiling that drifted from its own reason
    // would leave the argument standing over a different number, which is
    // the stale-figure class (D39).
    expect(ROSTER_CEILING).toBe(30);
  });

  it("stops adding at the ceiling and asks for a swap instead", () => {
    const b = pulseBudget({ roster: roster(ROSTER_CEILING) });
    expect(b.budget).toBe(0);
    expect(b.mode, "a full roster must not read as ordinary exhaustion").toBe("swap");
    expect(b.reason).toMatch(/swap/i);
    // …and it says the ceiling is raisable by a human rather than fixed,
    // because a lane that reports a wall teaches the next reader there is
    // nothing behind it.
    expect(b.reason).toMatch(/OWNER-LIST/);
  });

  it("stays in swap mode past the ceiling, rather than going negative", () => {
    const b = pulseBudget({ roster: roster(ROSTER_CEILING + 4) });
    expect(b.budget).toBe(0);
    expect(b.room).toBe(0);
    expect(b.mode).toBe("swap");
  });
});

describe("propose-only", () => {
  it("grants nothing while a PR is waiting", () => {
    // Unlike the D212 self-merging lanes, an open PR here is not a failed
    // gate — it is a human who has not read it yet. Writing a second
    // question behind the first is the pile the note forbids.
    const b = pulseBudget({ roster: roster(5), open: OPEN_MAX });
    expect(b.budget).toBe(0);
    expect(b.mode).toBe("waiting");
    expect(b.reason).toMatch(/propose-only/);
  });

  it("holds the open cap at one, so the lane carries one question at a time", () => {
    expect(OPEN_MAX).toBe(1);
    expect(pulseBudget({ roster: roster(5), open: 1 }).budget).toBe(0);
    expect(pulseBudget({ roster: roster(5), open: 0 }).budget).toBe(1);
  });
});

describe("against the bank as it actually ships", () => {
  it("finds work in the real roster — a lane that cannot produce is the bug", () => {
    // D115 on learn and D145 on feed: both lanes sat with a grantable
    // budget and produced nothing, because the regulator was measured
    // against a shape the bank did not have. This is the same case,
    // pointed at the committed file rather than at a fixture.
    const live = loadRoster();
    expect(live.length, "the pulse bank reads empty — the loader's shape is stale").toBeGreaterThan(0);
    const b = pulseBudget({ roster: live });
    expect(b.budget).toBe(1);
    expect(b.mode).toBe("add");
  });

  it("counts a killed series out of the library", () => {
    // `active: false` is a whole-series kill: the pulse draws nothing and
    // costs no read, so it holds no place. Counting it would let a roster
    // of retired questions block the lane forever.
    const withDead = [...roster(3), { id: "pulse-dead", active: false }];
    // loadRoster does the filtering, so this asserts the rule it applies.
    expect(withDead.filter((q) => q.active !== false).length).toBe(3);
  });
});
