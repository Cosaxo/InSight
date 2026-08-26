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
  collectEngagement, engagementFromDays,
} from "./pulse-collect.mjs";
import { renderPulse } from "./pulse-render.mjs";
import { PEN_TARGET } from "./farm-budget.mjs";
import {
  costModel, DECK_DAYS, AGG_CAP, PUBLISH_EVERY, TRIG, B, writesPerSec, CONTENTION_DAU,
  VOTER_FETCH_CAP, KINDRED_QUESTIONS, FOLLOW_CAP, CIRCLE_ANSWER_CAP, IDLE_DETACH_MS,
  AGG_POLL_MS, POLL_DOCS, LOCATION, LOCATION_LABEL, REGIONAL, priceSheet,
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

  it("the price sheet follows the database's own region, not a default", () => {
    // D200's gate, and it is a different shape from its four neighbours.
    // Those pin a number the model RETYPED; this pins a premise the model
    // ASSUMED. `costModel({ regional = false })` was correct arithmetic on a
    // false input for the three days after D165 moved production to a single
    // region, and no gate could see it: check:figures compares quoted
    // figures against the tree, and this was never quoted anywhere.
    const declared = read("functions/src/db.ts").match(/FIRESTORE_LOCATION = "([^"]+)"/)[1];
    expect(LOCATION).toBe(declared);
    // The rule that turns a place into a price: GCP multi-regions are bare
    // names (nam5, eur3) and every real region carries a hyphen.
    expect(REGIONAL).toBe(declared.includes("-"));
    // And the sheet actually moves with it — the assertion that would have
    // failed on 2026-08-15.
    const single = priceSheet(true);
    const multi = priceSheet(false);
    // The three OPERATION prices are exactly half. Storage is not, and the
    // first draft of this test asserted it was: $0.108/GiB against $0.18 is
    // 60%, not 50%. Worth keeping the distinction rather than loosening the
    // whole check to "cheaper", because "a single region halves every
    // Firestore line" is the sentence docs/COSTS.md leads with and it is
    // true of the three lines the bill actually consists of.
    for (const k of ["read", "write", "del"]) {
      expect(single[k], `${k} is not half the multi-region price`).toBeCloseTo(multi[k] / 2, 12);
    }
    expect(single.store).toBeLessThan(multi.store);
    expect(priceSheet(REGIONAL)).toEqual(REGIONAL ? single : multi);
    // THE DEFAULT ITSELF, because that is the line that was wrong and every
    // caller passes the flag explicitly — so a first draft of this test
    // watched `costModel({ regional = REGIONAL })` revert to `= false` and
    // reported green. Called with no arguments is how the default is
    // reachable at all, and it is the shape any new caller will use.
    expect(costModel().P).toEqual(priceSheet(REGIONAL));
    expect(costModel().P).not.toEqual(priceSheet(!REGIONAL));
  });

  it("the pulse publishes the region it priced", () => {
    // The console prints a `region` line beside its burn figures, and it
    // used to be a second hardcoded copy of the same premise ("nam5
    // multi-region") sitting next to numbers computed from the flag. Two
    // copies of one fact is how the label kept agreeing with itself while
    // both halves were wrong.
    expect(collect().cost.region).toBe(LOCATION_LABEL);
    expect(LOCATION_LABEL).toContain(LOCATION);
  });

  it("the fan-out's bound is still in live.ts, and the app still detaches", () => {
    // Two assertions, because the constant surviving is not the same claim
    // as the behaviour surviving. `onlineMin` is the input the fan-out term
    // is linear in, and it is an estimate of human attention being used as
    // a statement about how long a listener stays attached. That is only
    // true while something detaches on hide — before the idle detach it was
    // false, and the model went on quoting a bill that assumed it.
    const live = read("src/v2/data/live.ts");
    expect(IDLE_DETACH_MS).toBe(
      Number(live.match(/IDLE_DETACH_MS = ([\d_]+)/)[1].replace(/_/g, "")));
    // A constant nothing reads is a comment. This pins the call site too,
    // so deleting the arming while leaving the declaration fails here
    // rather than in six months on an invoice.
    expect(live).toMatch(/idleDetachTimer = setTimeout\(/);
    // Bounded, and bounded at a sane order: long enough that the ten-second
    // app swap wake() is written around does not pay to re-attach, short
    // enough that a backgrounded phone is not a standing charge.
    expect(IDLE_DETACH_MS).toBeGreaterThanOrEqual(10_000);
    expect(IDLE_DETACH_MS).toBeLessThanOrEqual(15 * 60_000);
  });

  it("AGG_POLL_MS matches live.ts, and the poll is actually armed", () => {
    const live = read("src/v2/data/live.ts");
    expect(AGG_POLL_MS).toBe(
      Number(live.match(/AGG_POLL_MS = ([\d_]+)/)[1].replace(/_/g, "")));
    // Same rule as the detach above: a constant nothing reads is a comment.
    expect(live).toMatch(/aggPollTimer = setInterval\(/);
    // And the thing that makes the polled term cheap — one document per
    // tick, not the whole deck. If the slice widens, POLL_DOCS must move
    // with it or the model understates the replacement's own cost.
    expect(live).toMatch(/refreshAggs\(state\.deckIds\.slice\(0, 1\)\)/);
    expect(POLL_DOCS).toBe(1);
  });

  it("polling is charged as a real cost, not as zero (D129)", () => {
    // THE REGRESSION THIS PINS, twice over. `pollAggs` set fanOut and
    // reattach to 0 — it modelled the fix for the fan-out as free, which is
    // the D67 failure aimed at our own remedy. And polling is now the
    // DEFAULT rather than an option, because it is what ships; a model whose
    // default still streamed would describe an app that no longer exists,
    // which is the D47 failure. `streamAggs` recovers the pre-D129
    // arithmetic, because that is what COSTS.md finding 2 documents.
    const { readsPerUser } = costModel({});
    const polled = readsPerUser(50_000, { mature: true });
    expect(polled.fanOut).toBeGreaterThan(0);
    expect(polled.reattach).toBeGreaterThan(0);
    // Flat in DAU is the property that matters — nobody else's behaviour
    // appears in a polled client's read count. Streamed, these differ by
    // a factor of ten.
    expect(readsPerUser(500_000, { mature: true }).fanOut)
      .toBeCloseTo(polled.fanOut, 10);
    // …and still far cheaper than streaming, which is the point.
    expect(polled.fanOut)
      .toBeLessThan(readsPerUser(50_000, { mature: true, streamAggs: true }).fanOut / 10);
  });

  it("the D98-surface bounds match their sources (D102)", () => {
    // The four caps are what make the `social` term finite. readNum already
    // throws on a RENAME; these hold the VALUES equal so a retuned cap
    // re-derives the model on the next run instead of drifting from it.
    expect(VOTER_FETCH_CAP).toBe(
      Number(read("src/v2/data/voters.ts").match(/VOTER_FETCH_CAP = (\d+)/)[1]));
    expect(KINDRED_QUESTIONS).toBe(
      Number(read("src/v2/data/live.ts").match(/KINDRED_QUESTIONS = (\d+)/)[1]));
    expect(FOLLOW_CAP).toBe(
      Number(read("src/v2/data/circle.ts").match(/FOLLOW_CAP = (\d+)/)[1]));
    expect(CIRCLE_ANSWER_CAP).toBe(
      Number(read("src/v2/data/circle.ts").match(/CIRCLE_ANSWER_CAP = (\d+)/)[1]));
  });

  it("readsPerUser's key set is exactly what the consumers draw (D102)", () => {
    // The decomposition's keys are load-bearing beyond the model: pulse's
    // stacked bar (READ_SERIES, pulse-render.mjs) names each one, and
    // COSTS.md's "Where the reads actually go" table has a column per key.
    // cost-model.mjs derives its printer and its flat-sum from the keys, so
    // those cannot drift — but a series list with a MISSING key draws a bar
    // that no longer sums to its own total, silently. If this fails, a key
    // was added or renamed: update READ_SERIES, COSTS.md's table, and this
    // list, in that order of harm.
    const { readsPerUser } = costModel({});
    expect(Object.keys(readsPerUser(5000, { mature: true })))
      .toEqual(["boot", "topUp", "reseed", "fanOut", "reattach", "rules", "server", "social"]);
    const series = read("scripts/pulse-render.mjs").match(/key: "(\w+)"/g)
      .map((s) => s.slice(6, -1));
    expect(series).toEqual(["boot", "topUp", "reseed", "fanOut", "reattach", "rules", "server", "social"]);
  });

  it("the social term is flat above the voter cap, and only above it", () => {
    // min(VOTER_FETCH_CAP, dau) is the crowd factor: below the cap the
    // surfaces read the whole room, above it the cap is the whole point.
    // If this fails, either the cap stopped binding (the unbounded read
    // came back) or the term stopped scaling at small sizes (it would
    // overcharge a TestFlight cohort by ~40x).
    const { readsPerUser } = costModel({});
    const at = (dau) => readsPerUser(dau, { mature: true }).social;
    expect(at(50)).toBeLessThan(at(VOTER_FETCH_CAP));
    expect(at(VOTER_FETCH_CAP)).toBeCloseTo(at(500_000), 10);
    expect(at(50)).toBeGreaterThan(0);
  });

  it("PUBLISH_EVERY is a constant 1, and the server has no such literal", () => {
    // Inverted at D98. This used to hold the model's copy equal to the
    // server's PUBLISH_EVERY literal; that literal is gone, because the
    // publish cadence was a disclosure control and the whole principle
    // was retired. The mirror is rewritten on every answer.
    //
    // Asserting the ABSENCE too, not just the value: if a cadence ever
    // comes back as a performance measure, this fails and makes someone
    // re-derive the cost model rather than leaving it quietly wrong.
    expect(PUBLISH_EVERY).toBe(1);
    expect(read("functions/src/v2.ts")).not.toMatch(/const PUBLISH_EVERY = \d+/);
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

  // ── tripwires on the hand-counted read sources (D67) ──────────────
  //
  // RULE_READS, TRIGGER_READS and revealReadsPerMember are counts of call
  // SITES across a branchy rules file and three functions. A regex that
  // tried to derive them would be a second, silently-wrong implementation
  // of Firestore's evaluator, so cost-arith counts them by hand — and hand
  // counts rot. These do not re-derive the model's numbers; they watch the
  // things the counting was done over, so that ADDING a document access
  // fails here with a pointer to the block that needs recounting.
  //
  // Deliberately totals rather than per-path counts: a total is what a new
  // access moves no matter which rule it lands in, and a per-path regex
  // would have to understand the branch structure, which is the thing this
  // is avoiding.
  it("the number of document accesses in firestore.rules has not moved", () => {
    const rules = read("firestore.rules");
    const gets = rules.match(/get\(\/databases\//g) || [];
    const exists = rules.match(/exists\(\/databases\//g) || [];
    expect(
      { gets: gets.length, exists: exists.length },
      "A rule gained or lost a document access. Every get()/exists() in a "
      + "rule is a BILLED READ — recount RULE_READS in scripts/cost-arith.mjs "
      + "(the answer-create paths are what the model charges) and update this "
      + "tripwire with the new totals.",
      // 17 → 15 at D98: the takes READ gate and the flags CREATE gate each
      // dropped a membership get() on v2_groups when reading stopped being
      // membership-scoped. RULE_READS is deliberately unchanged — it
      // charges the answer-create paths, and neither of those two sites
      // was on one.
      // 15 → 18 at D139: the pulse arm's template check — three get() sites
      // (surface, active, options.size()) on ONE /v2_questions document, so
      // a pulse create bills 1 read exactly like a world create. Charged
      // through worldAnswers, which the pulse moved 3 → 4.
      // 18 → 19 at D178: the flag rule's avatar arm reads
      // /v2_avatars/{target} to refuse a report on a face already removed —
      // the same shape the take arm's `hidden == false` get() has. RULE_READS
      // is deliberately unchanged, for the reason the D98 note above gives:
      // it charges the ANSWER-create paths, and reporting a photo is not one.
      // The read is billed to whoever files a report, at most once per person
      // per face (the doc id pins it), which is not a path worth modelling.
      // 19 → 22 gets and 2 → 3 exists at D194: isCallAnswer's three get()
      // sites (options.size(), active, surface) on ONE /v2_questions
      // document — 1 billed read, the same shape as the world and pulse
      // arms — PLUS an exists() on /v2_call_outcomes/{aid}, a genuinely
      // second document, which is what makes a call answer cost 2 where a
      // world answer costs 1. That exists() is the clause that closes a
      // call once it is graded, so the extra read is the feature rather
      // than an accident of the rule's shape.
      //
      // RULE_READS gains `call: 2` and the model does NOT charge it, for
      // a reason narrower than the D98 and D178 notes above: this IS an
      // answer-create path, so it would be charged — except that every
      // call in the bank is `active: false` (D196), so the path cannot be
      // reached and charging it would model traffic that cannot exist.
      // The number is recorded rather than omitted so that re-enabling the
      // surface is one term, not a recount.
      //
      // 22 → 23 gets: isTakeFlag() gained the self-flag refusal the avatar
      // arm has had since D178 — you cannot report your own take. It reads
      // `authorUid` off /v2_takes/{takeId}, which is the SAME document the
      // arm's other two get() sites already read, so this is the D139 and
      // D194 shape exactly: three sites, one document, one billed read.
      // The site count moves; the cost does not.
      //
      // RULE_READS is deliberately unchanged, for the D98 and D178 reason:
      // it charges the ANSWER-create paths, and flagging a take is not one.
      //
      // 23 → 25 gets at D224: isDuelAnswer's pickUid arm — one get() on
      // /v2_questions (only a pick question, empty bank options, may carry
      // the snapshot) and one on /v2_groups (the snapshot must name a
      // current member). Both are documents the SAME evaluation already
      // reads — the question via exists() and duelIndexSpace(), the group
      // via the membership clause — so this is the D139 and D194 shape
      // twice over: the site count moves, the billed cost does not, and
      // RULE_READS.duel stays 3.
      //
      // 25 → 30 gets at D233: isWorldAnswer gained the type != "rank"
      // clause (one site, the same /v2_questions doc its two existing
      // get()s read — deduped, cost unchanged), and isRankAnswer arrived
      // with four sites on that same one document, so a rank answer's
      // create bills the SAME single question-doc read the world path
      // does. RULE_READS.world stays 1 and covers the rank path with it.
      //
      // 30 → 32 gets: isDuelAnswer gained the kill switch and the surface
      // comparison every sibling answer shape already had. Both sites read
      // /v2_questions/{qid} — the SAME document that arm's exists() and
      // duelIndexSpace() already read — so this is the D224 shape exactly:
      // the site count moves, the billed cost does not, and RULE_READS.duel
      // stays 3.
    ).toEqual({ gets: 32, exists: 3 });
  });

  it("the answer trigger's transaction still issues the reads the model charges", () => {
    const body = read("functions/src/v2.ts")
      .match(/export const onV2AnswerCreated[\s\S]*?\n\);/)[0];
    // DOCUMENTS, not call sites. This counted `tx.get(` occurrences until
    // the three branches batched their reads into one `tx.getAll(a, b, c)`
    // each — at which point it counted ZERO and said the trigger had
    // stopped reading, because `tx.getAll(` does not match `tx.get\(`.
    // The shape changed; the read count did not. What the model charges is
    // documents, so that is what this has to count.
    const singles = (body.match(/tx\.get\(/g) || []).length;
    const batched = [...body.matchAll(/tx\.getAll\(([^)]*)\)/g)]
      .reduce((n, m) => n + m[1].split(",").length, 0);
    expect(
      singles + batched,
      "onV2AnswerCreated changed how many documents it reads. TRIGGER_READS "
      + "in scripts/cost-arith.mjs charges the VOTE path (2: ledger event + "
      + "the published aggregate, which is the fold's working document since "
      + "D275 collapsed the private mirror into it); the catalog (D232) and "
      + "rank (D233) branches each read one more — the question doc — which "
      + "the model deliberately absorbs into the vote rate (see the "
      + "constant's comment). Recount before changing the constant.",
    ).toBe(8);
  });

  it("the velocity scan still walks the ledger once per entry", () => {
    // VELOCITY_READS_PER_LEDGER_ENTRY = 1 rests on this being a paged query
    // over the window rather than a counter or an aggregation query.
    const v = read("functions/src/velocity.ts");
    expect(v).toMatch(/collection\("v2_agg_events"\)/);
    expect(v).toMatch(/\.select\("uid", "qid", "at"\)/);
    expect(v, "select() narrows egress, not reads — one billed read per entry")
      .not.toMatch(/\.count\(\)/);
  });

  it("the reveal pipeline's per-member read count still has its five parts", () => {
    // revealReadsPerMember(m) = (4 + 3m)/m — the page read, revealRef.get(),
    // getAll(answers), getAll(profiles), and the committing tx.getAll.
    const s = read("functions/src/v2social.ts");
    const fn = s.match(/async function revealGroupDay[\s\S]*?\n\}/)[0];
    expect((fn.match(/getAll\(/g) || []).length).toBeGreaterThanOrEqual(3);
    expect(fn).toMatch(/revealRef\.get\(\)/);
  });

  it("egress and index storage are billed, not assumed free", () => {
    // The model charged neither until D67, and "not modelled" reads as zero.
    const { model } = costModel({});
    const m = model(500_000, true);
    expect(m.cost.egress).toBeGreaterThan(0);
    expect(m.storeGiB).toBeGreaterThan(m.docGiB);
    // …and the band is a band: the low end must be materially cheaper.
    const lo = model(500_000, true, { aggBytes: "aggDocLow" }).cost.egress;
    expect(lo).toBeLessThan(m.cost.egress);
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

  it("is the live bank plus the pen, and the pen is inside its target", () => {
    // THE PEN IS SUPPOSED TO HAVE STOCK IN IT. This asserted
    // `unpromoted === 0` until 2026-08-19, which is not an invariant — it
    // is what an empty pen looks like. It passed for as long as the archive
    // and the bank happened to be the same list, and went red the first
    // time the farm did its job: PR #195 appended eight archive-only
    // questions ("nothing reaches the live seed until promotion"), exactly
    // as D30 asks.
    //
    // Two other parts of this same tooling already said so, which is how
    // the direction of the fix is known rather than chosen:
    // `farm-budget.mjs` calls the unpromoted archive **the pen** and sizes
    // it at PEN_TARGET, and `pulse-render.mjs` draws a non-empty one with
    // status "good" — already written is cheaper than still to write.
    //
    // #232 reached the same identity independently, from the other side —
    // it promoted the batch and rewrote this as
    // `archiveEntries - unpromoted === daily.length`, which is the same
    // equation rearranged. Kept in this form, with the second assertion
    // BOUNDED: `unpromoted >= 0` cannot fail (it is a `.length`), and the
    // regulator's ceiling can.
    //
    // So what is true is the identity and the ceiling. The identity is a
    // bijection given `orphans === 0` above: every live prompt is in the
    // archive, and the archive holds exactly one entry for each, so a
    // duplicated archive prompt fails here. The ceiling is the regulator's
    // own — a pen over target means generation kept running after the tap
    // should have closed.
    const a = collectArchive(daily);
    expect(a.archiveEntries).toBe(daily.length + a.unpromoted);
    expect(a.unpromoted).toBeLessThanOrEqual(PEN_TARGET);
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

  it("counts a function a policy WATCHES, not one its runbook merely names", () => {
    // The two halves of the scope this is computed over, each pinned by the
    // case that broke when the other was used alone.
    const { functions } = p.instrumentation;
    const named = (n) => functions.find((f) => f.name === n);

    // 1. displayName is required. scheduledDuelReveals-silent.json's
    //    condition names the LOG METRIC (duel_reveal_run) and never the
    //    function, so a conditions-only scope reported it unalerted — a
    //    real alert dropped, which reads as a coverage gap that is not one.
    expect(named("scheduledDuelReveals").alerted).toBe(true);

    // 2. documentation must be excluded. That same policy's runbook tells
    //    the operator to run revealDuelsNowV2 as the first response.
    //    Scanning the raw file counted the callable as alerted — coverage
    //    rising because someone wrote a better runbook, which is the
    //    flattering direction this survey exists not to miscount in.
    expect(named("revealDuelsNowV2").alerted).toBe(false);
    expect(read("monitoring/scheduledDuelReveals-silent.json")).toContain("revealDuelsNowV2");
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
      coverage: { ...real.coverage, scored: 3, unserved: 80 },
      retireProposals: [{ qid: "daily-000" }, { qid: "daily-001" }],
      perQuestion: real.perQuestion.map((q, i) =>
        i < 3 ? { ...q, served: true, total: 1400 + i, evenness: [0.12, 0.51, 0.93][i] }
          // Neutralize every row this test does NOT doctor. The committed
          // artifact stopped being all-zeros on 2026-08-15 — the first
          // post-launch refresh carries real answers — and any live total
          // or evenness left in place moves the exact sums below on every
          // scorecard refresh (this test's first red was +5 real answers).
          : { ...q, served: true, total: 0, evenness: null, optionShares: null, signal: "no-answers" }),
    };
    const sc = { ...p.pipeline.scorecard };
    // Re-run the collector's own arithmetic over the doctored artifact.
    sc.scoredQuestions = withAnswers.coverage.scored;
    sc.unserved = withAnswers.coverage.unserved;
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
    // …and the scorecard's empty state must step aside. Tracked to the
    // CURRENT wording: this searched for "nothing has cleared the floor
    // yet" until 2026-08-26, and D296 rewrote that sentence in the same
    // commit — leaving an assertion that could no longer fail. A
    // not.toContain against a string the code cannot emit is a test that
    // passes for the wrong reason, which is what D296 was about.
    expect(html).not.toContain("no question has been answered yet");
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

describe("the engagement panel (R1/D268)", () => {
  // FLIPPED 2026-08-26, exactly as the case it replaces said to. It read:
  //
  //   "The digest has not deployed, so the TREE holds no committed trail —
  //    and the collector must say so rather than inventing zeros. The day
  //    the first monitoring/engagement.json is committed, this case flips
  //    to asserting the present shape against the real artifact, the
  //    collectScorecard lesson: a fixture you wrote yourself proves
  //    nothing."
  //
  // That day is today. `npm run scorecard -- --fetch` wrote the first
  // trail, and it answered a question the tree could not: digestEngagementV2
  // HAS been running — eight consecutive day documents, 2026-08-18 to
  // 08-25, three of them with real activity.
  it("reads the REAL committed trail rather than a fixture", () => {
    const e = collectEngagement();
    expect(e.present).toBe(true);
    // Asserted as shape and bounds, not as today's numbers: the artifact is
    // refreshed by a person running --fetch, so pinning `actives: 6` here
    // makes this test fail on the next honest refresh. What must hold is
    // that the collector reads it and folds it null-aware.
    expect(e.days).toBeGreaterThan(0);
    expect(e.lastDay).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(e.note).toBeUndefined();
  });

  it("renders the trail rather than the honest-absence banner", () => {
    const html = renderPulse(collect(), []);
    expect(html).toContain("Engagement — the digest trail");
    expect(html).not.toContain("No trail yet");
  });

  it("still says so honestly when the trail is ABSENT", () => {
    // The behaviour the two flipped cases used to cover, kept — it is the
    // state any fresh clone or new project is in, and "invent zeros" is
    // the failure it guards. Driven by the collector's own fold rather
    // than by deleting the committed file.
    const e = { present: false, note: "no committed monitoring/engagement.json — `npm run scorecard -- --fetch` writes it once digestEngagementV2 has run" };
    const html = renderPulse({ ...collect(), engagement: e }, []);
    expect(html).toContain("No trail yet");
  });

  const DAYS = [
    { day: "2026-08-20", actives: 10, firstTime: 10, votes: 30, events: 31,
      bySurface: { daily: 10, feed: 20 },
      returned: { d1: { returned: 0, of: null }, d7: { returned: 0, of: null }, d30: { returned: 0, of: null } },
      streaksBroken: 0 },
    // 08-21 deliberately missing — a day the digest never folded
    { day: "2026-08-22", actives: 6, firstTime: 2, votes: 12, events: 12,
      bySurface: { daily: 6, feed: 6 },
      returned: { d1: { returned: 0, of: 0 }, d7: { returned: 3, of: 10 }, d30: { returned: 0, of: null } },
      streaksBroken: 1 },
  ];

  it("folds the day docs null-aware: unknown cohorts stay unknown, empty ones stay empty", () => {
    const e = engagementFromDays(DAYS);
    expect(e).toMatchObject({ days: 2, gaps: 1, lastDay: "2026-08-22" });
    expect(e.latest).toMatchObject({ actives: 6, firstTime: 2, streaksBroken: 1 });
    // of: 10 → a real rate; of: 0 → known-empty cohort, rate null; of:
    // null → cohort day never folded, rate null. The render tells the
    // last two apart, so the fold must keep them apart.
    expect(e.returned.d7).toEqual({ returned: 3, of: 10, rate: 0.3 });
    expect(e.returned.d1).toEqual({ returned: 0, of: 0, rate: null });
    expect(e.returned.d30).toEqual({ returned: 0, of: null, rate: null });
    expect(e.weekMeanActives).toBe(8);
  });

  it("renders a populated trail with rates and the unknown-cohort wording", () => {
    const p = collect();
    const e = { present: true, fetchedOn: "2026-08-23", ...engagementFromDays(DAYS) };
    const html = renderPulse({ ...p, engagement: e }, []);
    expect(html).not.toContain("No trail yet");
    expect(html).toContain("30%");
    expect(html).toContain("empty cohort");
    expect(html).toContain("cohort day never folded");
    expect(html).toContain("1 gap(s)");
  });

  it("an empty trail file folds to zero days, not to an invented reading", () => {
    expect(engagementFromDays([])).toEqual({ days: 0 });
    expect(engagementFromDays(undefined)).toEqual({ days: 0 });
  });
});

describe("the attention section (R2/D270)", () => {
  it("carries the newest attn block and keeps attn-only strays out of the digest counts", () => {
    const withAttn = [
      // late shards for a day the digest never folded: attention only, no
      // `actives` — it must not read as a zero-actives digest day
      { day: "2026-08-10", attn: { devices: 2, s: { feedSeen: { reach: 2, est: 8 } } } },
      { day: "2026-08-20", actives: 10, firstTime: 10, votes: 30, events: 31,
        bySurface: { daily: 10 },
        returned: { d1: { returned: 0, of: null }, d7: { returned: 0, of: null }, d30: { returned: 0, of: null } },
        streaksBroken: 0 },
      { day: "2026-08-22", actives: 6, firstTime: 2, votes: 12, events: 12,
        bySurface: { daily: 6 },
        returned: { d1: { returned: 0, of: 0 }, d7: { returned: 3, of: 10 }, d30: { returned: 0, of: null } },
        streaksBroken: 1,
        attn: { devices: 5, s: { feedSeen: { reach: 5, est: 30 }, lensPeople: { reach: 1, est: 1.5 } } } },
    ];
    const e = engagementFromDays(withAttn);
    expect(e.days).toBe(2); // the stray is not a digest day
    expect(e.latest.day).toBe("2026-08-22");
    expect(e.attn.day).toBe("2026-08-22");
    expect(e.attn.devices).toBe(5);
    expect(e.attn.features[0]).toEqual({ key: "feedSeen", reach: 5, est: 30 });
    const html = renderPulse({ ...collect(), engagement: { present: true, fetchedOn: "2026-08-23", ...e } }, []);
    expect(html).toContain("est. uses");
    expect(html).toContain("feedSeen");
    expect(html).toContain("bucketing cannot distort it");
  });

  it("an attn-only trail still renders the attention table under the no-digest banner logic", () => {
    const e = engagementFromDays([
      { day: "2026-08-10", attn: { devices: 2, s: { opens: { reach: 2, est: 3 } } } },
    ]);
    expect(e.days).toBe(0);
    expect(e.attn.devices).toBe(2);
  });
});

describe("the person channel in the console (R3/D272)", () => {
  it("passes the newest people fold through with a null-safe quiet share", () => {
    const e = engagementFromDays([
      { day: "2026-08-22", actives: 6, firstTime: 2, votes: 12, events: 12,
        bySurface: { daily: 6 },
        returned: { d1: { returned: 0, of: 0 }, d7: { returned: 0, of: null }, d30: { returned: 0, of: null } },
        streaksBroken: 0,
        attn: { devices: 5, s: { opens: { reach: 5, est: 8 } }, q: { "feed-001": { s: { reach: 2, est: 4 } } } },
        people: { rollups: 4, sessions: 10, quiet: 3, fading: 1, depthEnd: 2 } },
    ]);
    expect(e.people).toMatchObject({ rollups: 4, sessions: 10, quietShare: 0.3, fading: 1, reachedEnd: 2 });
    expect(e.attn.qidCount).toBe(1);
    const html = renderPulse({ ...collect(), engagement: { present: true, fetchedOn: "2026-08-24", ...e } }, []);
    expect(html).toContain("quiet-session share");
    expect(html).toContain("fading people");
    expect(html).toContain("Per-question attention");
  });

  it("zero sessions reads as an unknown share, never a divide-by-zero", () => {
    const e = engagementFromDays([
      { day: "2026-08-22", actives: 1, firstTime: 0, votes: 1, events: 1, bySurface: {},
        returned: { d1: { returned: 0, of: null }, d7: { returned: 0, of: null }, d30: { returned: 0, of: null } },
        streaksBroken: 0,
        people: { rollups: 0, sessions: 0, quiet: 0, fading: 0, depthEnd: 0 } },
    ]);
    expect(e.people.quietShare).toBeNull();
  });
});
