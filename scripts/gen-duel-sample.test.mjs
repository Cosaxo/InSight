// gen-duel-sample.test.mjs — pins the properties of the duel sample (D435,
// D284's shape one bank over).
//
// The property under test is the one the cap could not give: that the
// bundle's slice of the duel bank does not move when the lane appends. A
// one-off trim would have bought a few months and left the same trap
// armed; a slice that is stable under append means the daily burst can
// write ten thousand questions and the demo build's weight never notices.
// The other properties are what make the slice a DEMO rather than a
// prefix: every kind and every domain the demo draws is in it, the packs
// are exactly the ones its votes name, and a retirement — the one edit
// that does move it — moves it in the direction the demo needs.
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import {
  PER_KIND,
  PER_DOMAIN,
  buildSample,
  generate,
  sampleKind,
} from "./gen-duel-sample.mjs";

const bank = JSON.parse(
  readFileSync(new URL("../content/duel-questions.json", import.meta.url), "utf8"),
);
const ids = (list) => list.map((q) => q.id);
const clone = (v) => JSON.parse(JSON.stringify(v));

describe("the duel sample (D435)", () => {
  it("takes the first PER_KIND served questions of each group kind, in bank order", () => {
    const s = buildSample(bank);
    const served = bank.group.filter((q) => q.active !== false);
    for (const [kind, n] of Object.entries(PER_KIND)) {
      const want = ids(served.filter((q) => sampleKind(q) === kind)).slice(0, n);
      const have = ids(s.group.filter((q) => sampleKind(q) === kind));
      expect(have, `kind ${kind}`).toEqual(want);
      expect(have.length, `the bank holds fewer than ${n} served ${kind} questions`).toBe(n);
    }
    // Bank order survives — the group pool's interleaving IS the demo's
    // rotation order, so a sorted sample would reorder every group's week.
    const pos = new Map(ids(bank.group).map((id, i) => [id, i]));
    const order = s.group.map((q) => pos.get(q.id));
    expect(order).toEqual(order.slice().sort((a, b) => a - b));
    expect(s.group.some((q) => q.active === false), "a retired question is in the sample").toBe(false);
  });

  it("takes the first PER_DOMAIN of each domain in both 1v1 pools, flags and all", () => {
    const s = buildSample(bank);
    for (const pool of ["oneVsOne", "romantic"]) {
      const domains = [...new Set(bank[pool].map((q) => q.d))];
      for (const d of domains) {
        const want = ids(bank[pool].filter((q) => q.d === d)).slice(0, PER_DOMAIN);
        expect(ids(s[pool].filter((q) => q.d === d)), `${pool} · ${d}`).toEqual(want);
      }
      // …and a domain the bank holds fewer of than PER_DOMAIN — the cast
      // round, one a pool (D437) — is taken whole, never padded.
      expect(s[pool].length).toBe(
        domains.reduce((n, d) => n + Math.min(PER_DOMAIN, bank[pool].filter((q) => q.d === d).length), 0),
      );
    }
    // The romantic pool ships dark on live (D40 part 4) and the demo draws
    // it regardless, so its flags ride along untouched — a slice, never a
    // transformation.
    expect(s.romantic.every((q) => q.active === false)).toBe(
      bank.romantic.every((q) => q.active === false),
    );
  });

  it("carries only the packs its role votes name, in source order", () => {
    const s = buildSample(bank);
    const named = new Set(s.group.filter((q) => q.scen != null).map((q) => q.scen));
    expect(ids(s.scenarios)).toEqual(ids(bank.scenarios.filter((p) => named.has(p.id))));
    expect(s.scenarios.length).toBeGreaterThan(1);
    for (const q of s.group.filter((q) => q.scen != null)) {
      expect(named.has(q.scen)).toBe(true);
    }
  });

  it("does not move when every pool is appended to — the lane's write never reaches the bundle", () => {
    const before = generate(bank);
    const after = clone(bank);
    after.scenarios.push({ id: "moon", label: "Moon Base", hue: 300 });
    after.group.push(
      { id: "gu99", kind: "us", prompt: "Late on purpose?", options: ["Always", "Never"] },
      { id: "gp99", kind: "pick", prompt: "Who brings the snacks?" },
      { id: "gd99", kind: "classic", prompt: "Window or aisle?", options: ["Window", "Aisle"] },
      { id: "gr99", kind: "pick", scen: "moon", role: { id: "pilot", label: "the pilot" }, prompt: "Who flies it?" },
      { id: "gs99", kind: "rate", dim: "gravity", prompt: "This group's gravity?", poles: ["Light", "Heavy"] },
    );
    after.oneVsOne.push({ id: "998", d: "day", prompt: "Coffee first?", options: ["Yes", "No"] });
    after.romantic.push({ id: "999", d: "ahead", prompt: "Move abroad?", options: ["Yes", "No"], active: false });
    expect(generate(after)).toBe(before);
  });

  it("moves on a retirement, and in the demo's direction: the next of that kind slides in", () => {
    const s0 = buildSample(bank);
    const gone = s0.group.find((q) => sampleKind(q) === "us");
    const retired = clone(bank);
    retired.group.find((q) => q.id === gone.id).active = false;
    const s1 = buildSample(retired);
    const us0 = ids(s0.group.filter((q) => sampleKind(q) === "us"));
    const us1 = ids(s1.group.filter((q) => sampleKind(q) === "us"));
    expect(us1).not.toContain(gone.id);
    expect(us1.length).toBe(us0.length);
    const nextInBank = bank.group
      .filter((q) => q.active !== false && sampleKind(q) === "us" && !us0.includes(q.id))[0];
    expect(us1).toContain(nextInBank.id);
  });

  it("refuses a group kind it has no count for", () => {
    const odd = clone(bank);
    odd.group.push({ id: "gx0", kind: "quiz", prompt: "?", options: ["a", "b"] });
    expect(() => buildSample(odd)).toThrow(/PER_KIND/);
  });
});
