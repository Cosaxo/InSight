// pulse.test.mjs — the pieces of the console that can be wrong quietly.
//
// WHAT THIS IS FOR. Everything load-bearing in this repo has a test and
// this did not, which was the gap. But "test the dashboard" is not a useful
// goal — most of it is markup. What earns a test here is the handful of
// places where a wrong answer LOOKS like a right answer:
//
//   - the archive prompt join, which already produced a convincing false
//     positive once (6 phantom orphans, all of them apostrophes);
//   - the trail's same-day replacement, because the alternative failure is
//     a duplicate row per run and nobody reads a JSONL by eye;
//   - the runway arithmetic, which is the one number whose neglect breaks
//     the product rather than an estimate;
//   - the scorecard block, which has NEVER EXECUTED — there is no scorecard
//     yet, so its first run is launch day, which is the worst possible time
//     to discover a bug in it. Synthetic fixtures here mean launch day is
//     its second run, not its first.
//
// Run: npm run test:scripts
import { describe, it, expect } from "vitest";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

import {
  collect, collectArchive, bucketEvenness, addressablePlaces, isoDay, ROOT,
} from "./pulse-collect.mjs";
import { renderPulse } from "./pulse-render.mjs";
import {
  costModel, DECK_DAYS, AGG_CAP, PUBLISH_EVERY, TRIG, B, writesPerSec, CONTENTION_DAU,
} from "./cost-arith.mjs";

const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

describe("cost-arith reads its constants from source, not from memory", () => {
  // The whole point of D47's fix: these used to be retyped, and the model
  // spent two days disagreeing with the code because nothing compared them.
  // If someone re-hardcodes a value, these fail.
  it("DECK_DAYS matches src/v2/data/deck.ts", () => {
    expect(DECK_DAYS).toBe(Number(read("src/v2/data/deck.ts").match(/DECK_DAYS = (\d+)/)[1]));
  });

  it("AGG_CAP matches live.ts's AGG_ID_CAP", () => {
    expect(AGG_CAP).toBe(Number(read("src/v2/data/live.ts").match(/AGG_ID_CAP = (\d+)/)[1]));
  });

  it("PUBLISH_EVERY matches functions/src/v2.ts", () => {
    expect(PUBLISH_EVERY).toBe(Number(read("functions/src/v2.ts").match(/PUBLISH_EVERY = (\d+)/)[1]));
  });

  it("TRIG matches HOT_TRIGGER's deployed footprint", () => {
    const ops = read("functions/src/ops.ts");
    const hot = ops.slice(ops.indexOf("export const HOT_TRIGGER"));
    expect(TRIG.mem).toBe(Number(hot.match(/memory: "(\d+)MiB"/)[1]) / 1024);
    expect(TRIG.cpu).toBe(Number(hot.match(/cpu: (\d+)/)[1]));
    expect(TRIG.conc).toBe(Number(hot.match(/concurrency: (\d+)/)[1]));
  });

  it("the reseed line reflects D34 — the delta, not the whole bank", () => {
    // The defect D47 found, pinned so it cannot come back: a returning user
    // pays for the questions a promotion CHANGED, not for the bank.
    const { model, bank } = costModel({});
    const { r } = model(5000, true);
    expect(r.reseed).toBeCloseTo((B.changedPerReseed * B.reseedsPerMonth * B.mauMultiple) / 30, 6);
    expect(r.reseed).toBeLessThan(10);
    // and the pre-D34 arithmetic is still reachable, because it is what
    // COSTS.md finding 1 documents.
    expect((bank * B.reseedsPerMonth * B.mauMultiple) / 30).toBeGreaterThan(100);
  });

  it("staticBank means the UNBUILT hosting fix — zero, not the delta", () => {
    const { model } = costModel({});
    expect(model(5000, true, { staticBank: true }).r.reseed).toBe(0);
  });

  it("the D7 contention wall is where COSTS.md says it is", () => {
    expect(writesPerSec(CONTENTION_DAU)).toBeCloseTo(1, 6);
    expect(writesPerSec(CONTENTION_DAU - 1)).toBeLessThan(1);
  });
});

describe("the archive join", () => {
  const daily = JSON.parse(read("content/daily-questions.json"));

  it("finds no orphans in the shipped tree", () => {
    // liveSync joins the seeded bank to the archive by prompt equality and
    // warns on orphans; a non-zero count here means the client is warning.
    const a = collectArchive(daily);
    expect(a.orphans).toBe(0);
    expect(a.orphanIds).toEqual([]);
  });

  it("counts an archive entry for every live daily question", () => {
    const a = collectArchive(daily);
    expect(a.archiveEntries).toBe(daily.length);
    expect(a.unpromoted).toBe(0);
  });

  it("does not mistake a double-quoted prompt for an orphan", () => {
    // THE REGRESSION THIS FILE EXISTS FOR. Six of the archive's prompts
    // contain an apostrophe and are double-quoted; the rest are
    // single-quoted. A single-quote-only scan reports those six as missing,
    // which is indistinguishable from real drift by eye — it took reading
    // the actual prompts to tell the difference.
    const quoted = daily.filter((q) => q.prompt.includes("'"));
    expect(quoted.length).toBeGreaterThan(0);
    const a = collectArchive(daily);
    for (const q of quoted) expect(a.orphanIds).not.toContain(q.id);
  });

  it("reports a question that really is missing from the archive", () => {
    const a = collectArchive([...daily, { id: "zzz-not-real", prompt: "Nothing wrote this." }]);
    expect(a.orphans).toBe(1);
    expect(a.orphanIds).toEqual(["zzz-not-real"]);
  });
});

describe("evenness buckets", () => {
  // Never exercised in production yet — there is no scorecard. These are
  // the boundaries, because "splits, not landslides" is read off this shape.
  it("puts each score in exactly one bucket, and 1.0 in 'even'", () => {
    // Edges are [0, .2, .4, .6, .8, 1.0001] — five equal fifths, each
    // half-open, with 1.0 caught by the top bucket rather than falling out.
    // Written down here because getting them wrong is easy: the first draft
    // of this test put 0.79 in "leaning" (it is "split"), and the test was
    // the thing that was wrong, not the code.
    const b = bucketEvenness([
      { evenness: 0.0 }, { evenness: 0.19 },     // landslide  [0,   .2)
      { evenness: 0.2 },                          // lopsided   [.2,  .4)
      { evenness: 0.55 },                         // leaning    [.4,  .6)
      { evenness: 0.79 },                         // split      [.6,  .8)
      { evenness: 0.8 }, { evenness: 1.0 },       // even       [.8, 1.0]
    ]);
    const by = Object.fromEntries(b.map((x) => [x.label, x.count]));
    expect(by).toEqual({ landslide: 2, lopsided: 1, leaning: 1, split: 1, even: 2 });
    expect(b.reduce((a, x) => a + x.count, 0)).toBe(7);
  });

  it("ignores rows with no evenness rather than bucketing them as zero", () => {
    // A question under the k-floor publishes nothing; scoring it as a
    // landslide would invent a landslide that nobody voted in.
    const b = bucketEvenness([{ total: 3 }, { evenness: null }, { evenness: 0.5 }]);
    expect(b.reduce((a, x) => a + x.count, 0)).toBe(1);
  });
});

describe("the pulse artifact", () => {
  const p = collect();

  it("agrees with itself about the bank size, by two independent paths", () => {
    // content/*.json counted here; functions/src/v2content.ts parsed by
    // cost-arith. check:content guarantees these are the same content —
    // this is that guarantee visible from the console's side.
    expect(p.pipeline.totalQuestions).toBe(p.cost.seededBankDocs);
  });

  it("derives the runway as bank minus days elapsed since the epoch", () => {
    const { deck } = p.pipeline;
    const epoch = Number(read("src/v2/data/deck.ts").match(/DECK_EPOCH = (\d+)/)[1]);
    expect(deck.epoch).toBe(epoch);
    expect(deck.runwayDays).toBe(deck.dailyBank - deck.daysElapsed);
    // D30's invariant, stated as the thing the tile is actually claiming.
    expect(deck.wrapsOn).toBe(isoDay(epoch + deck.dailyBank));
  });

  it("models no revenue until the rate card names a price", () => {
    const rates = JSON.parse(read("monitoring/rates.json"));
    const priced = rates.paths.filter((x) => x.assumedUsdPerUnit > 0);
    expect(p.money.revenueUsdPerMonth).toBe(
      priced.reduce((a, x) => a + x.assumedUsdPerUnit * x.assumedUnits, 0));
    // An unpriced path must read as unknown, never as zero units needed.
    for (const path of rates.paths) {
      if (path.assumedUsdPerUnit === 0) {
        expect(p.money.breakEven[2].unitsToBreakEven[path.id]).toBeNull();
      }
    }
  });

  it("never lets the burn come out below the fixed cost", () => {
    for (const b of p.money.breakEven) expect(b.burnUsd).toBeGreaterThanOrEqual(p.money.fixedUsdPerMonth);
  });

  it("counts every deployed function and marks which are alerted", () => {
    const { functions, functionCount, alertedCount } = p.instrumentation;
    expect(functionCount).toBe(functions.length);
    expect(alertedCount).toBe(functions.filter((f) => f.alerted).length);
    // onV2AnswerCreated is the one that fails SILENTLY (retry:true), so it
    // is the one that must never lose its alert.
    const trigger = functions.find((f) => f.name === "onV2AnswerCreated");
    expect(trigger).toBeDefined();
    expect(trigger.alerted).toBe(true);
  });

  it("reads the addressable place count out of the generated catalogue", () => {
    const a = addressablePlaces();
    expect(a.places).toBeGreaterThan(1000);
    expect(read("public/cities.txt")).toContain(`${a.places} places in ${a.countries} countries`);
  });

  it("states pre-launch rather than inventing zeroes", () => {
    // Before launch every live figure must be null, not 0 — a zero reads as
    // a measurement and there has been no measurement.
    if (p.population.state === "pre-launch") {
      for (const x of p.population.live) expect(x.value).toBeNull();
    }
  });

  it("names a decision record for every refused metric", () => {
    expect(p.population.refused.length).toBeGreaterThan(0);
    for (const x of p.population.refused) {
      expect(x.record).toBeTruthy();
      expect(x.why).toBeTruthy();
    }
  });
});

describe("the trail", () => {
  // Exercised through the real CLI in a temp HOME-free copy: the trail's
  // whole job is file I/O, so testing a pure function would test nothing.
  function runIn(dir, args = []) {
    return execFileSync(process.execPath, [join(ROOT, "scripts/pulse.mjs"), ...args],
      { cwd: dir, encoding: "utf8" });
  }

  it("replaces the same day's row instead of appending a duplicate", () => {
    const tmp = mkdtempSync(join(tmpdir(), "pulse-trail-"));
    try {
      const trail = join(ROOT, "monitoring", "pulse-trail.jsonl");
      const before = readFileSync(trail, "utf8");
      try {
        runIn(ROOT);
        const one = readFileSync(trail, "utf8").trim().split("\n");
        runIn(ROOT);
        const two = readFileSync(trail, "utf8").trim().split("\n");
        expect(two.length).toBe(one.length);
        const days = two.map((l) => JSON.parse(l).on);
        expect(new Set(days).size).toBe(days.length);
      } finally {
        writeFileSync(trail, before);
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("keeps rows in date order when an older day is present", () => {
    const trail = join(ROOT, "monitoring", "pulse-trail.jsonl");
    const before = readFileSync(trail, "utf8");
    try {
      const row = JSON.parse(before.trim().split("\n")[0]);
      writeFileSync(trail, JSON.stringify({ ...row, on: "2020-01-01", runwayDays: 999 }) + "\n");
      execFileSync(process.execPath, [join(ROOT, "scripts/pulse.mjs")], { encoding: "utf8" });
      const rows = readFileSync(trail, "utf8").trim().split("\n").map((l) => JSON.parse(l));
      expect(rows.length).toBe(2);
      expect(rows[0].on).toBe("2020-01-01");
      expect(rows.map((r) => r.on)).toEqual([...rows.map((r) => r.on)].sort());
    } finally {
      writeFileSync(trail, before);
    }
  });
});

describe("the rendered page", () => {
  const p = collect();

  it("is self-contained — no external host can be reached", () => {
    const html = renderPulse(p, []);
    // The artifact CSP blocks these outright, and the page has to open from
    // a file:// path with no network at all.
    expect(html).not.toMatch(/<script[^>]+src=/i);
    expect(html).not.toMatch(/<link[^>]+href=/i);
    expect(html).not.toMatch(/https?:\/\/(?!www\.w3\.org)/);
    expect(html).not.toMatch(/@import/);
  });

  it("styles both themes, with the toggle able to beat the OS setting", () => {
    const html = renderPulse(p, []);
    expect(html).toContain("@media (prefers-color-scheme: dark)");
    expect(html).toContain('[data-theme="dark"]');
    expect(html).toContain(':root:not([data-theme="light"])');
  });

  it("shows an honest empty state for a trail of one", () => {
    const html = renderPulse(p, [{ on: "2026-08-04", runwayDays: 87 }]);
    expect(html).toContain("One reading so far");
    expect(html).not.toContain("<path d=\"M");
  });

  it("spaces the sparkline by DATE, so a gap cannot masquerade as a step", () => {
    // The defect this replaced: x was the array index, so a 90-day gap and
    // a 1-day step drew identically.
    const even = renderPulse(p, [
      { on: "2026-01-01", runwayDays: 90 },
      { on: "2026-01-02", runwayDays: 89 },
      { on: "2026-01-03", runwayDays: 88 },
    ]);
    const gappy = renderPulse(p, [
      { on: "2026-01-01", runwayDays: 90 },
      { on: "2026-01-02", runwayDays: 89 },
      { on: "2026-04-01", runwayDays: 88 },   // same three readings, months apart
    ]);
    const pathOf = (h) => h.match(/<path d="(M[^"]+)"/)[1];
    expect(pathOf(even)).not.toBe(pathOf(gappy));
    // and the gap is called out, not merely implied by spacing
    expect(gappy).toContain("days with no reading");
    expect(even).not.toContain("days with no reading");
  });

  it("says nothing about a single skipped day, and draws nothing either", () => {
    // The caption and the hairline used to use different thresholds: the
    // rule drew at two missed days, the caption counted every one. So a
    // single skip — a job queued past midnight — produced a warning-
    // coloured "1 day with no reading" pointing at an unmarked chart.
    const oneSkip = renderPulse(p, [
      { on: "2026-08-04", runwayDays: 87 },
      { on: "2026-08-06", runwayDays: 85 },   // 2026-08-05 missing
    ]);
    expect(oneSkip).not.toContain("with no reading");
    // `stroke="var(--serious)"` is the hairline specifically — the bare
    // token also appears in the population panel's "the catch" lines, so a
    // substring match on it would pass for the wrong reason.
    expect(oneSkip).not.toMatch(/stroke="var\(--serious\)"/);
    // …but the spacing is still honest: two days apart, not two steps.
    expect(oneSkip).toContain("2 readings over 2 days");
  });

  it("counts only the gaps it draws, so caption and chart cannot disagree", () => {
    const mixed = renderPulse(p, [
      { on: "2026-08-01", runwayDays: 90 },
      { on: "2026-08-03", runwayDays: 88 },   // 1 skipped — below the bar
      { on: "2026-08-20", runwayDays: 71 },   // 16 skipped — a real gap
    ]);
    // 16, not 17: the lone skip is deliberately not folded into the total.
    expect(mixed).toContain("16 days with no reading");
    const hairlines = (mixed.match(/stroke="var\(--serious\)"/g) || []).length;
    expect(hairlines).toBe(1);
  });

  it("renders a populated scorecard, built from the REAL artifact's shape", () => {
    // This test used to fixture a shape I invented, because no scorecard
    // existed to look at — and the collector had invented the same shape, so
    // the two agreed and proved nothing. When the first real
    // content/scorecard.json landed, the collector read four fields that do
    // not exist and reported zero. Zero also happened to be the true answer
    // pre-launch, which is exactly why it survived.
    //
    // So the fixture is now DERIVED FROM THE COMMITTED FILE: real field
    // names, with answers pushed in to simulate the post-launch state the
    // collector has still never seen for real.
    const real = JSON.parse(read("content/scorecard.json"));
    expect(Array.isArray(real.perQuestion)).toBe(true);
    expect(real.coverage).toBeDefined();

    const withAnswers = {
      ...real,
      coverage: { ...real.coverage, scored: 3, unserved: 80, belowFloor: 2 },
      retireProposals: [{ qid: "daily-000" }, { qid: "daily-001" }],
      perQuestion: real.perQuestion.map((q, i) =>
        i < 3 ? { ...q, served: true, total: 1400 + i, evenness: [0.12, 0.51, 0.93][i] } : q),
    };
    const sc = { ...p.pipeline.scorecard };
    // Re-run the collector's own arithmetic over the doctored artifact.
    sc.scoredQuestions = withAnswers.coverage.scored;
    sc.unserved = withAnswers.coverage.unserved;
    sc.belowFloor = withAnswers.coverage.belowFloor;
    sc.questionsTracked = withAnswers.coverage.questions;
    sc.totalAnswers = withAnswers.perQuestion.reduce((a, q) => a + (q.total || 0), 0);
    sc.evennessBuckets = bucketEvenness(withAnswers.perQuestion);
    sc.retireProposals = withAnswers.retireProposals.length;

    expect(sc.totalAnswers).toBe(1400 + 1401 + 1402);
    const byLabel = Object.fromEntries(sc.evennessBuckets.map((b) => [b.label, b.count]));
    expect(byLabel).toMatchObject({ landslide: 1, leaning: 1, even: 1 });

    const html = renderPulse({ ...p, pipeline: { ...p.pipeline, scorecard: sc } }, []);
    expect(html).toContain("4,203");
    expect(html).toContain("landslide");
    expect(html).not.toContain("No scorecard yet");
    // and the "nothing has cleared the floor" empty state must step aside
    expect(html).not.toContain("nothing has cleared the floor yet");
    expect(html).not.toContain("undefined");
    expect(html).not.toContain("NaN");
  });

  it("reads the committed scorecard's real field names, not invented ones", () => {
    // The regression guard proper: if collectScorecard goes back to reading
    // fields the artifact does not have, these disagree with the file.
    const real = JSON.parse(read("content/scorecard.json"));
    const sc = p.pipeline.scorecard;
    expect(sc.present).toBe(true);
    expect(sc.questionsTracked).toBe(real.coverage.questions);
    expect(sc.scoredQuestions).toBe(real.coverage.scored);
    expect(sc.unserved).toBe(real.coverage.unserved);
    expect(sc.totalAnswers).toBe(real.perQuestion.reduce((a, q) => a + (q.total || 0), 0));
    expect(sc.retireProposals).toBe(real.retireProposals.length);
    expect(sc.learnCards).toBe(real.learn.coverage.cards);
  });

  it("escapes content rather than letting a prompt close a tag", () => {
    const nasty = {
      ...p,
      pipeline: {
        ...p.pipeline,
        archive: { ...p.pipeline.archive, orphans: 1, orphanIds: ['</script><img src=x>'] },
      },
    };
    const html = renderPulse(nasty, []);
    expect(html).not.toContain("<img src=x>");
    expect(html).toContain("&lt;/script&gt;");
  });
});
