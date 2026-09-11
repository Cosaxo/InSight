// nightly.test.ts — the pass's contract: every fold runs whatever the
// others did, each heartbeat vouches only for the fold that completed,
// and a failed night is a red invocation rather than a quiet one.
//
// Driven through thunks (NightlyRunners), so nothing here builds a store:
// the folds' own suites prove the folds; this proves the choreography
// around them, which is the part the old three-function arrangement got
// for free from being three functions and this file has to earn.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { runNightlyPass, PASS_CEILING_MS, PASS_TAIL_MS, type NightlyRunners, type NightlyLog } from "./nightly";
import { ROLLUP_FOLD_BUDGET_MS } from "./engagement";
import { FANOUT_HEAL_SLICE_MS } from "./profileFanout";

type Line = { level: "info" | "warn" | "error"; msg: string; fields: Record<string, unknown> };

function recorder(): { log: NightlyLog; lines: Line[] } {
  const lines: Line[] = [];
  const at = (level: Line["level"]) => (msg: unknown, fields?: unknown) => {
    lines.push({ level, msg: String(msg), fields: (fields ?? {}) as Record<string, unknown> });
  };
  return { lines, log: { info: at("info"), warn: at("warn"), error: at("error") } as unknown as NightlyLog };
}

const metricsOf = (lines: Line[]) => lines.map((l) => l.fields.metric).filter(Boolean);

function healthy(): NightlyRunners & { ran: string[]; deadlines: number[]; deadlineOf: Record<string, number> } {
  const ran: string[] = [];
  const deadlines: number[] = [];
  // …by fold, because there are two time-bounded folds now and "the
  // deadlines in order" cannot say which fold got which.
  const deadlineOf: Record<string, number> = {};
  return {
    ran,
    deadlines,
    deadlineOf,
    digest: async () => { ran.push("digest"); return { days: 1, lastDay: "2026-09-05", actives: 3, votes: 7 }; },
    patterns: async () => {
      ran.push("patterns");
      return {
        days: 1, folded: 5, compacted: 5, samples: 2, citySamples: 1, seeded: 1, users: 3, questions: 10, bits: 0.9, skill: 0.1,
        seedCos: 0.2, engine: "sgd" as const, candidateSkill: 0, streak: 0, crossed: false,
      };
    },
    taste: async () => { ran.push("taste"); return { days: 1, counted: 4, people: 2 }; },
    velocity: async (deadlineAt: number) => {
      ran.push("velocity");
      deadlineOf.velocity = deadlineAt;
      return { entries: 7, uids: 3, volumeFlags: 0, cadenceFlags: 0, clusterFlags: 0, burstFlags: 0, sharedDays: 1, tailRows: 2, authScanned: 3, authTotal: 3 };
    },
    answerMaps: async (deadlineAt: number) => { ran.push("answerMaps"); deadlineOf.answerMaps = deadlineAt; return { day: "2026-09-05", people: 3, healed: 0, entries: 0, stopped: false, unreached: 0 }; },
    // `left` is on both of these because the pass BRANCHES on it — the
    // erasure backlog and the fan-out backlog are each the only signal
    // that a promise was not kept that night. These fakes omitted it,
    // and nothing went red: the functions test files are excluded from
    // the project's tsconfig, so a fake that stops matching its
    // interface is invisible to `tsc` and to the build.
    log: async () => { ran.push("log"); return { day: "2026-09-05", skipped: false, entries: 7, missing: 0, appended: 0, erasures: 0, erased: 0, passes: 0, left: false }; },
    fanout: async (deadlineAt: number) => { ran.push("fanout"); deadlines.push(deadlineAt); deadlineOf.fanout = deadlineAt; return { pending: 0, healed: 0, touched: 0, left: false, stopped: false }; },
    attention: async () => { ran.push("attention"); return { shards: 2, days: 1, capped: false, rate: 1 }; },
    rollup: async (deadlineAt: number) => { ran.push("rollup"); deadlineOf.rollup = deadlineAt; return { rollups: 3, days: 1, capped: false, left: 0 }; },
  };
}

describe("the production thunks", () => {
  // A SOURCE SCAN, because nothing else here can see this. The runners
  // are an inline object literal inside `onSchedule`, so no test can
  // call them; every case in the file below drives FAKES, which take the
  // parameter faithfully and prove nothing about the real wiring. And
  // TypeScript accepts a zero-argument function where
  // `(deadlineAt: number) => …` is declared — a narrower signature is
  // assignable — so `tsc` and `check:fn-types` are green on a fold that
  // silently never receives its deadline.
  //
  // That is not hypothetical: the rollup drain shipped exactly that way
  // for a night. Its bound was the one the whole time-budget argument was
  // written about — it runs LAST, so a fold-local 300 seconds can end
  // past the invocation's kill and take the pass's tail with it — and the
  // production thunk passed nothing, so the fold fell back to counting
  // from its own first line while the pass computed a deadline and threw
  // it away. The three folds beside it were wired; the one the commit was
  // about was not.
  //
  // The list is derived from the INTERFACE rather than typed out, so a
  // fifth fold that gains a bound is covered the day it gains it.
  const src = readFileSync(new URL("./nightly.ts", import.meta.url), "utf8");

  it("hands every bounded runner its deadline", () => {
    const iface = src.slice(src.indexOf("export interface NightlyRunners"));
    const bounded = [...iface.slice(0, iface.indexOf("\n}")).matchAll(/^\s{2}(\w+): \(deadlineAt: number\)/gm)]
      .map((m) => m[1]);
    expect(bounded.length, "no bounded runner found — the interface was reshaped and this scan is vacuous")
      .toBeGreaterThan(2);

    const at = src.indexOf("await runNightlyPass({");
    expect(at, "the production call was renamed or reshaped").toBeGreaterThan(0);
    const thunks = src.slice(at, src.indexOf("\n    });", at));
    for (const name of bounded) {
      expect(thunks, `${name} takes a deadline and the production thunk does not pass one`)
        .toMatch(new RegExp(`${name}: \\(deadlineAt\\)`));
    }
  });
});

describe("runNightlyPass", () => {
  it("hands each time-bounded fold an INSTANT, not a stopwatch of its own", async () => {
    // The distinction is the whole shape. A fold-local stopwatch answers
    // "how long may THIS fold run", which lets it start late and finish
    // past the invocation's own ceiling — the rollup's 300 seconds
    // counted from t=250 ends at t=550 against a 480-second timeout, and
    // the check can never fire before the kill. An absolute instant on
    // the pass's clock cannot drift that way.
    //
    // On a night with time to spare each fold gets its own slice from
    // where it actually starts. The clock here does not move, so "from
    // where it starts" and "from the pass's start" are the same instant
    // — which is exactly why this case cannot be the only one; the two
    // below move the clock and separate the shapes.
    const r = healthy();
    const start = 1_000_000;
    await runNightlyPass(r, recorder().log, () => start);
    expect(r.deadlineOf.fanout).toBe(start + FANOUT_HEAL_SLICE_MS);
    expect(r.deadlineOf.rollup, "the last fold ran with no clock at all")
      .toBe(start + ROLLUP_FOLD_BUDGET_MS);
  });

  it("a late-starting fold keeps its slice — it is not zeroed by the folds ahead of it", async () => {
    // The first version of this measured the fan-out's mark from the
    // pass's START: "by 150 seconds in, stop starting accounts". That
    // reads as a partition of the 480 and only works if the six folds
    // ahead cost nothing. Here they cost 200 seconds, and a fixed mark
    // would hand the fan-out an instant 50 SECONDS IN ITS OWN PAST — it
    // would heal nobody while a third of the invocation went unspent.
    const r = healthy();
    const start = 1_000_000;
    let now = start;
    const base = r.velocity;
    r.velocity = async (deadlineAt: number) => { now += 200_000; return base(deadlineAt); };
    await runNightlyPass(r, recorder().log, () => now);
    expect(r.deadlineOf.fanout, "a late start erased the fold's slice").toBe(now + FANOUT_HEAL_SLICE_MS);
    expect(r.deadlineOf.fanout).toBeGreaterThan(now);
  });

  it("…and no fold's instant reaches past the invocation, whatever its slice says", async () => {
    // The other direction, and the one that kills the pass rather than a
    // fold: 300 seconds of rollup counted from t=300 ends at t=600
    // against a 480-second timeout, so the fold is killed mid-tail and
    // the heartbeat the silence monitor watches for never logs. The
    // ceiling is read from the deployed setting, less what the tail
    // needs.
    const r = healthy();
    const start = 1_000_000;
    let now = start;
    const base = r.velocity;
    r.velocity = async (deadlineAt: number) => { now += 300_000; return base(deadlineAt); };
    await runNightlyPass(r, recorder().log, () => now);
    const ceiling = start + PASS_CEILING_MS - PASS_TAIL_MS;
    expect(r.deadlineOf.rollup, "the last fold was allowed past the kill").toBe(ceiling);
    expect(r.deadlineOf.rollup).toBeLessThan(start + PASS_CEILING_MS);
    // …and the fan-out, which starts earlier, still had room for its own
    // slice: the ceiling binds the fold that needs it, not every fold.
    expect(r.deadlineOf.fanout).toBe(now + FANOUT_HEAL_SLICE_MS);
  });


  it("says so when the birth-cluster scan saw only part of the population", async () => {
    // The other three velocity signals fold a ledger this pass already
    // read; this one asks Admin Auth about every active account, one
    // round trip per hundred. Stopping there does not leave work undone
    // the way a heal does — it changes what the fold's own output MEANS,
    // because "no clusters" computed over whoever sorted first is not
    // the sentence the heartbeat is read as saying.
    const r = healthy();
    r.velocity = async () => ({
      entries: 7, uids: 900, volumeFlags: 0, cadenceFlags: 0, clusterFlags: 0, burstFlags: 0,
      sharedDays: 1, tailRows: 2, authScanned: 300, authTotal: 900,
    });
    const { log, lines } = recorder();
    await runNightlyPass(r, log);
    const line = lines.find((l) => l.fields.metric === "velocity_auth_partial");
    expect(line, "a partial cluster scan passed for a clean one").toBeTruthy();
    expect(line!.level).toBe("warn");
    expect(line!.msg).toMatch(/300 of 900 active accounts/);
  });

  it("…and says nothing when it saw everyone — the control", async () => {
    const r = healthy();
    const { log, lines } = recorder();
    await runNightlyPass(r, log);
    expect(lines.some((l) => l.fields.metric === "velocity_auth_partial"),
      "an ordinary night warned about a scan that finished").toBe(false);
  });

  it("says so when the map heal stops on the clock, even though it healed nothing", async () => {
    // The heal's own log line speaks only when it HEALED — in steady
    // state the trigger wrote every entry live, so a line every night
    // would be a heartbeat for the absence of work. A stop is the one
    // outcome that rule cannot report, and it is the one that must never
    // be silent: this fold reads YESTERDAY, so the people it did not
    // reach are not first in tomorrow's queue. Tomorrow heals tomorrow's
    // day.
    const r = healthy();
    r.answerMaps = async () => ({ day: "2026-09-05", people: 900, healed: 0, entries: 0, stopped: true, unreached: 600 });
    const { log, lines } = recorder();
    await runNightlyPass(r, log);
    const line = lines.find((l) => l.fields.metric === "answer_map_heal_stopped");
    expect(line, "a partial heal left no trace at all").toBeTruthy();
    expect(line!.level).toBe("warn");
    expect(line!.msg).toMatch(/300 of 900 people/);
    expect(line!.msg).toMatch(/600 unread/);
  });

  it("runs the five in order and beats every heartbeat on a clean night", async () => {
    const r = healthy();
    const { log, lines } = recorder();
    const out = await runNightlyPass(r, log);
    expect(r.ran).toEqual(["digest", "patterns", "taste", "velocity", "answerMaps", "log", "fanout", "attention", "rollup"]);
    expect(out.failed).toEqual([]);
    expect(metricsOf(lines)).toEqual(["patterns_fit", "taste_fold", "engagement_digest"]);
    // The digest heartbeat carries the whole engagement pipeline's numbers,
    // as the one-function version did — the pulse console reads them.
    const beat = lines.find((l) => l.fields.metric === "engagement_digest")!;
    expect(beat.fields).toMatchObject({ days: 1, lastDay: "2026-09-05", actives: 3, votes: 7, shards: 2, rollups: 3 });
  });

  it("a failing fit costs nothing but its own heartbeat, and the night is still red", async () => {
    const r = healthy();
    r.patterns = async () => { r.ran.push("patterns"); throw new Error("ALS diverged"); };
    const { log, lines } = recorder();
    await expect(runNightlyPass(r, log)).rejects.toThrow(/patterns failed — Error: ALS diverged/);
    // Everything after the fit still ran…
    expect(r.ran).toEqual(["digest", "patterns", "taste", "velocity", "answerMaps", "log", "fanout", "attention", "rollup"]);
    // …the fit's heartbeat is the one missing, so fitPatternsV2-silent
    // fires for exactly the fold that went quiet…
    expect(metricsOf(lines)).toEqual(["nightly_fold_failed", "taste_fold", "engagement_digest"]);
    // …and the error line names the fold, at ERROR.
    const err = lines.find((l) => l.fields.metric === "nightly_fold_failed")!;
    expect(err.level).toBe("error");
    expect(err.fields).toMatchObject({ fold: "patterns" });
  });

  it("the engagement heartbeat vouches for the whole pipeline: a dead rollup fold silences it even when the digest ran", async () => {
    const r = healthy();
    r.rollup = async () => { throw new Error("batch too large"); };
    const { log, lines } = recorder();
    await expect(runNightlyPass(r, log)).rejects.toThrow(/rollup failed/);
    expect(metricsOf(lines)).toEqual(["patterns_fit", "taste_fold", "nightly_fold_failed"]);
  });

  it("a night with nothing owed still beats for the fit (days counts), and a fold with no days stays quiet for taste", async () => {
    const r = healthy();
    r.patterns = async () => ({
      days: 1, folded: 0, compacted: 0, samples: 0, citySamples: 0, seeded: 0, users: 0, questions: 10, bits: 0, skill: 0,
      seedCos: 0, engine: "sgd" as const, candidateSkill: 0, streak: 0, crossed: false,
    });
    r.taste = async () => ({ days: 0, counted: 0, people: 0 });
    const { log, lines } = recorder();
    await runNightlyPass(r, log);
    expect(metricsOf(lines)).toEqual(["patterns_fit", "engagement_digest"]);
  });

  it("names every failed fold when more than one dies, first error first", async () => {
    const r = healthy();
    r.digest = async () => { throw new Error("no meta"); };
    r.taste = async () => { throw new Error("no profile"); };
    const { log } = recorder();
    await expect(runNightlyPass(r, log)).rejects.toThrow(/digest, taste failed — Error: no meta/);
  });
});
