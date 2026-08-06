// Pins the near-duplicate detector (question-neighbors.mjs, D58): the
// normalization that makes the metric see through phrasing, the id
// mapping the ALLOW list keys on, and the live corpus staying under the
// gate. The corpus assertion runs here as well as in check:neighbors on
// purpose — test:scripts is on CI's lint job, so the gate holds even for
// a change that never ran the check script locally.
import { describe, it, expect } from "vitest";
import {
  tokensOf,
  similarity,
  dailyIdOf,
  buildDomains,
  scanDomain,
  GATE,
} from "./question-neighbors.mjs";

const sim = (a, b) => similarity(tokensOf(a), tokensOf(b));

describe("similarity", () => {
  it("sees through phrasing: the suggestion-board twins score as dupes", () => {
    // The two deliberate fixtures that motivated the metric. Without
    // stopword dropping and the plural fold these score well under GATE.
    expect(sim("Money can buy happiness.", "Money buys happiness.")).toBe(1);
    expect(
      sim(
        "Would you take a pill that removed the need for sleep?",
        "A pill that ends your need for sleep. Take it?",
      ),
    ).toBeGreaterThanOrEqual(GATE);
  });

  it("ignores word order", () => {
    expect(sim("Messi or Ronaldo?", "Ronaldo or Messi?")).toBe(1);
  });

  it("folds diacritics and plurals, keeps -ss words intact", () => {
    expect(tokensOf("Pokémon")).toEqual(new Set(["pokemon"]));
    expect(tokensOf("dogs cats")).toEqual(new Set(["dog", "cat"]));
    expect(tokensOf("chess")).toEqual(new Set(["chess"]));
  });

  it("scores genuinely different questions low", () => {
    expect(sim("Mountains or sea?", "Lyrics or melody?")).toBe(0);
  });
});

describe("daily id mapping", () => {
  // The ALLOW list and every failure message key on these ids; the formula
  // must match daily-questions.js (ids are positional off DQ_BASE).
  it("matches the archive's positional dq/dqx series", () => {
    expect(dailyIdOf(0, 30)).toBe("dq30");
    expect(dailyIdOf(29, 30)).toBe("dq01");
    expect(dailyIdOf(30, 30)).toBe("dqx01");
    expect(dailyIdOf(41, 30)).toBe("dqx12");
  });
});

describe("the live corpus", () => {
  const domains = buildDomains();

  it("loads every domain non-empty, with prompts and ids", () => {
    for (const name of ["daily", "feed", "duel", "pick", "suggestions"]) {
      expect(domains[name].length).toBeGreaterThan(0);
      for (const e of domains[name]) {
        expect(e.id).toBeTruthy();
        expect(e.prompt).toBeTruthy();
      }
    }
    // Q[0] is the newest original daily; if this drifts, the bracket
    // extraction or the id formula broke, not the content.
    expect(domains.daily[0].id).toBe("dq30");
  });

  it("holds every gated domain under GATE", () => {
    for (const name of ["daily", "feed", "duel", "pick"]) {
      const { hits } = scanDomain(domains[name]);
      expect(
        hits.map((h) => `${h.key} @ ${h.s.toFixed(3)}`),
        `${name}: near-duplicate pair — rewrite/drop one, or ALLOW it with a reason`,
      ).toEqual([]);
    }
  });

  it("still sees the ungated suggestion twins (the detector is alive)", () => {
    // If a rewrite ever removes both fixtures this pin goes stale loudly,
    // which is the moment to find a new sentinel pair — a detector nothing
    // exercises is the check:globals lesson all over again.
    const money = domains.suggestions.find((e) => e.id === "sg07");
    const best = Math.max(
      ...domains.daily.map((d) => similarity(money.tokens, d.tokens)),
    );
    expect(best).toBe(1);
  });
});
