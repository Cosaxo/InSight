// Pins the near-duplicate detector (question-neighbors.mjs, D63): the
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
  batchEntryOf,
  scanBatch,
  foldWord,
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

// ── D122: the two rewrite classes the metric used to score near zero ──
describe("the folder", () => {
  // Every pair here was measured against the live corpus before the rule that
  // merges it was added; the collisions in the second block are the ones the
  // measurement found, and are why KEEP and the length guards exist.
  it("lands every form of a word on one stem", () => {
    for (const [a, b] of [
      ["move", "moving"],
      ["move", "moved"],
      ["get", "getting"], // doubling undone, no 'e' restored
      ["ask", "asked"], // 'e' NOT restored: "ask" is not CVC
      ["dabble", "dabbling"],
      ["master", "mastering"], // only equal because folding runs to a fixpoint
      ["kind", "kindness"],
      ["kind", "kinder"],
      ["happy", "happiness"],
      ["lonely", "lonelier"],
      ["act", "action"],
      ["read", "reading"],
      ["child", "childhood"],
      ["friend", "friendship"],
    ]) {
      expect(foldWord(a), `${a} / ${b} should fold together`).toBe(foldWord(b));
    }
  });

  it("keeps the measured collisions apart", () => {
    for (const [a, b] of [
      ["mean", "meaning"], // unkind vs significance — both live in the corpus
      ["everest", "every"],
      ["care", "car"],
      ["mention", "men"],
      ["chess", "chest"],
      ["part", "party"],
      ["milk", "milky"],
    ]) {
      expect(foldWord(a), `${a} / ${b} must stay distinct`).not.toBe(foldWord(b));
    }
  });

  it("catches a morphological rewrite the old metric scored 0.143", () => {
    expect(
      sim(
        "Master one thing, or dabble in many?",
        "Mastering one skill, or dabbling in many?",
      ),
    ).toBeGreaterThanOrEqual(GATE);
  });
});

describe("the concept lexicon", () => {
  it("catches a synonym rewrite the old metric scored 0.000", () => {
    expect(sim("Money buys happiness.", "Can wealth make you happy?")).toBeGreaterThanOrEqual(GATE);
  });

  it("catches the synonyms the corpus actually reaches for", () => {
    for (const [a, b] of [
      ["Mountains or sea?", "Mountains or the ocean?"],
      ["One cuisine, forever?", "One food, forever?"],
      ["Technology is making us lonelier.", "Tech is making people more alone."],
    ]) {
      expect(sim(a, b), `${a} ~ ${b}`).toBeGreaterThanOrEqual(GATE);
    }
  });

  it("still cannot see a paraphrase the lexicon does not pair", () => {
    // The honest limit, pinned so the header's claim stays true and nobody
    // retires the writing rule on the strength of the gate (D63, D122).
    expect(
      sim("Are people getting kinder, or meaner?", "Is kindness rising or falling?"),
    ).toBeLessThan(GATE);
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

  it("keeps a measured margin under GATE, and names the pair that spends it", () => {
    // D122 bought recall with headroom: the closest legitimate pair went
    // 0.333 → 0.400 when morphology and synonyms started counting. This pins
    // the margin so the NEXT change to the metric has to look at what it
    // costs rather than discovering it on a farm run — and if a legitimate
    // pair ever does cross, the fix is an ALLOW entry with a reason, not a
    // quieter metric.
    const worst = ["daily", "feed", "duel", "pick", "learn"]
      .map((name) => ({ name, ...scanDomain(domains[name]).closest }))
      .sort((a, b) => b.s - a.s)[0];
    expect(
      `${worst.name} ${worst.a.id}~${worst.b.id} @ ${worst.s.toFixed(3)}`,
      "the closest legitimate pair moved — re-read it, then re-pin this",
    ).toBe("duel gp2~047 @ 0.400");
    expect(worst.s).toBeLessThan(GATE);
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

// ── D122: the batch pre-flight ──
// The gap this closes is sibling-vs-sibling. --candidate run eight times
// scores eight questions against the corpus and never against each other,
// and every lane's budget is now bigger than one (D97, D115).
describe("batch pre-flight", () => {
  const domains = buildDomains();
  const scan = (batch) => scanBatch(batch.map(batchEntryOf), domains);

  it("catches two candidates in one batch restating each other", () => {
    const [a, b] = scan([
      { prompt: "Can wealth make you happy?", options: ["Yes", "No"] },
      { prompt: "Does money buy happiness?", options: ["Yes", "No"] },
    ]);
    expect(a.siblingHits.length, "sibling twins must be reported both ways").toBe(1);
    expect(b.siblingHits.length).toBe(1);
    expect(a.siblingHits[0].s).toBeGreaterThanOrEqual(GATE);
  });

  it("leaves genuinely different candidates alone", () => {
    const scanned = scan([
      { prompt: "Would you move to another city for a job you loved?", options: ["Go", "Stay"] },
      { prompt: "Best seat on a long train ride?", options: ["Window", "Aisle"] },
    ]);
    for (const r of scanned) expect(r.siblingHits).toEqual([]);
  });

  it("reports a near-twin sibling under GATE instead of staying silent", () => {
    // The measured case: two ways of asking for a seat preference on a train,
    // 0.455 apart. Not a failure — but a writer told nothing at all would
    // read that as "unrelated", which is the opposite of true.
    const [a] = scan([
      { prompt: "Best seat on a long train ride?", options: ["Window", "Aisle", "Table"] },
      { prompt: "Best place to sit on a long train journey?", options: ["By the window", "On the aisle"] },
    ]);
    expect(a.siblingHits).toEqual([]); // does not fail the pre-flight
    expect(a.siblings[0].s).toBeGreaterThan(0.4); // but is reported
  });

  it("scores each candidate against ITS OWN domain", () => {
    const [daily, feed] = scan([
      { surface: "daily", prompt: "Mountains or sea?", options: ["Mountains", "Sea"] },
      { surface: "feed", prompt: "Rank the potato formats", options: ["Chips", "Mash"] },
    ]);
    expect(daily.c.domain).toBe("daily");
    expect(feed.c.domain).toBe("feed");
    // Each landed on a real neighbour from its own bank, not the other's.
    expect(daily.near[0].e.id).toMatch(/^(dq|dqx|sg)/);
    expect(feed.near[0].e.id).not.toMatch(/^(dq|dqx|sg)/);
  });

  it("reads a learn card in its native shape, on prompt + correct answer", () => {
    // The `f`/`q`/`a`/`c` tell, so one candidates file pre-flights both this
    // gate and check:quality — a second file shape is a step to forget.
    const [r] = scan([
      { f: "cell", q: "Where does an animal cell keep its DNA?", a: ["Nucleus", "Ribosome"], c: 0 },
    ]);
    expect(r.c.domain).toBe("learn");
    expect(r.near[0].s).toBeGreaterThanOrEqual(GATE); // cell4 asks exactly this
  });

  it("flags an unknown domain instead of silently scoring nothing", () => {
    const [r] = scan([{ surface: "nonsense", prompt: "Anything at all?" }]);
    expect(r.unknown).toBe(true);
  });
});
