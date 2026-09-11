// duel-live-audit.test.mjs — the pure half of the production audit.
//
// The IO half reads production and is not run here; what is pinned is the
// reading of the bank (which pool writes which id) and the four shapes of
// disagreement, because a wrong shape here is a flip on the wrong question
// in production — the one place a test is cheaper than the mistake.

import { describe, expect, it } from "vitest";
import { ageDays, bankIds, diffBank } from "./duel-live-audit.mjs";

const BANK = {
  scenarios: [{ id: "heist", label: "Bank Heist", hue: 25 }],
  group: [
    { id: "gr0", prompt: "?", options: [], role: { seat: "engine" }, scen: "heist" },
    { id: "gu3", prompt: "?", options: [], active: false },
    { id: "gp8", prompt: "?", options: [], active: false },
  ],
  oneVsOne: [{ id: "001", d: 1, prompt: "?", options: ["a", "b"] }, { id: "900", d: 1, prompt: "?", options: ["a", "b"], kind: "cast" }],
  romantic: [{ id: "020", d: 1, prompt: "?", options: ["a", "b"], active: false }],
};

describe("bankIds", () => {
  it("writes each pool under the seed's prefix, and a scenario is not a question", () => {
    const ids = bankIds(BANK);
    expect([...ids.keys()]).toEqual(["group-gr0", "group-gu3", "group-gp8", "duo-001", "duo-900", "duo-020"]);
    expect(ids.get("group-gu3")).toEqual({ pool: "group", active: false, kind: "choice" });
    expect(ids.get("duo-900").kind).toBe("cast");
    expect(ids.has("group-heist")).toBe(false);
  });
});

describe("diffBank", () => {
  const live = new Map([
    ["group-gr0", { active: true }],
    ["group-gu3", { active: true }],      // retired in the bank, still dealt
    ["duo-001", { active: false }],       // killed by hand
    ["duo-020", { active: false }],       // retired, and off — agreed
    ["group-zz9", { active: true }],      // not in the bank at all
  ]);

  it("names the four disagreements and leaves agreement alone", () => {
    const d = diffBank(bankIds(BANK), live);
    expect(d.retiredButLive).toEqual(["group-gu3"]);
    expect(d.liveButOff).toEqual(["duo-001"]);
    expect(d.missingActive).toEqual(["duo-900"]);
    expect(d.missingRetired).toEqual(["group-gp8"]);
    expect(d.extra).toEqual(["group-zz9"]);
  });

  it("counts per pool: what the bank holds, what it still serves, what production has", () => {
    const d = diffBank(bankIds(BANK), live);
    expect(d.byPool.group).toEqual({ bank: 3, active: 1, seeded: 2 });
    expect(d.byPool.oneVsOne).toEqual({ bank: 2, active: 2, seeded: 1 });
    expect(d.byPool.romantic).toEqual({ bank: 1, active: 0, seeded: 1 });
  });

  it("a production that matches the bank reports nothing to do", () => {
    const agreed = new Map([...bankIds(BANK)].map(([id, b]) => [id, { active: b.active }]));
    const d = diffBank(bankIds(BANK), agreed);
    for (const k of ["retiredButLive", "liveButOff", "missingActive", "missingRetired", "extra"]) expect(d[k]).toEqual([]);
  });

  it("a document with no active field at all counts as served — the seed's create path writes true", () => {
    const d = diffBank(bankIds(BANK), new Map([["group-gu3", {}]]));
    expect(d.retiredButLive).toEqual(["group-gu3"]);
  });
});

describe("ageDays", () => {
  it("reads a Firestore timestamp, a millisecond number, or nothing", () => {
    const now = Date.UTC(2026, 8, 9);
    expect(ageDays({ toMillis: () => now - 3 * 86_400_000 }, now)).toBe("3");
    expect(ageDays(now - 86_400_000 * 24.5, now)).toBe("24");
    expect(ageDays(undefined, now)).toBe("never");
  });
});
