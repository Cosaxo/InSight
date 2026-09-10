// nightly.test.ts — the pass's contract: every fold runs whatever the
// others did, each heartbeat vouches only for the fold that completed,
// and a failed night is a red invocation rather than a quiet one.
//
// Driven through thunks (NightlyRunners), so nothing here builds a store:
// the folds' own suites prove the folds; this proves the choreography
// around them, which is the part the old three-function arrangement got
// for free from being three functions and this file has to earn.
import { describe, expect, it } from "vitest";
import { runNightlyPass, type NightlyRunners, type NightlyLog } from "./nightly";
import { FANOUT_HEAL_DEADLINE_MS } from "./profileFanout";

type Line = { level: "info" | "warn" | "error"; msg: string; fields: Record<string, unknown> };

function recorder(): { log: NightlyLog; lines: Line[] } {
  const lines: Line[] = [];
  const at = (level: Line["level"]) => (msg: unknown, fields?: unknown) => {
    lines.push({ level, msg: String(msg), fields: (fields ?? {}) as Record<string, unknown> });
  };
  return { lines, log: { info: at("info"), warn: at("warn"), error: at("error") } as unknown as NightlyLog };
}

const metricsOf = (lines: Line[]) => lines.map((l) => l.fields.metric).filter(Boolean);

function healthy(): NightlyRunners & { ran: string[]; deadlines: number[] } {
  const ran: string[] = [];
  const deadlines: number[] = [];
  return {
    ran,
    deadlines,
    digest: async () => { ran.push("digest"); return { days: 1, lastDay: "2026-09-05", actives: 3, votes: 7 }; },
    patterns: async () => {
      ran.push("patterns");
      return {
        days: 1, folded: 5, compacted: 5, samples: 2, citySamples: 1, seeded: 1, users: 3, questions: 10, bits: 0.9, skill: 0.1,
        seedCos: 0.2, engine: "sgd" as const, candidateSkill: 0, streak: 0, crossed: false,
      };
    },
    taste: async () => { ran.push("taste"); return { days: 1, counted: 4, people: 2 }; },
    velocity: async () => {
      ran.push("velocity");
      return { entries: 7, uids: 3, volumeFlags: 0, cadenceFlags: 0, clusterFlags: 0, burstFlags: 0, sharedDays: 1, tailRows: 2 };
    },
    answerMaps: async () => { ran.push("answerMaps"); return { day: "2026-09-05", people: 3, healed: 0, entries: 0 }; },
    // `left` is on both of these because the pass BRANCHES on it — the
    // erasure backlog and the fan-out backlog are each the only signal
    // that a promise was not kept that night. These fakes omitted it,
    // and nothing went red: the functions test files are excluded from
    // the project's tsconfig, so a fake that stops matching its
    // interface is invisible to `tsc` and to the build.
    log: async () => { ran.push("log"); return { day: "2026-09-05", skipped: false, entries: 7, missing: 0, appended: 0, erasures: 0, erased: 0, passes: 0, left: false }; },
    fanout: async (deadlineAt: number) => { ran.push("fanout"); deadlines.push(deadlineAt); return { pending: 0, healed: 0, touched: 0, left: false, stopped: false }; },
    attention: async () => { ran.push("attention"); return { shards: 2, days: 1, capped: false, rate: 1 }; },
    rollup: async () => { ran.push("rollup"); return { rollups: 3, days: 1, capped: false, left: 0 }; },
  };
}

describe("runNightlyPass", () => {
  it("hands the fan-out a deadline measured from the PASS's start, not the fold's", async () => {
    // The distinction is the whole shape. A fold-local stopwatch answers
    // "how long may THIS fold run", which lets it start late and finish
    // past the invocation's own ceiling — the rollup's 300 seconds
    // counted from t=250 ends at t=550 against a 480-second timeout, and
    // the check can never fire before the kill. An absolute instant on
    // the pass's clock cannot drift that way.
    // THE CLOCK MUST ADVANCE, or the case cannot tell the two shapes
    // apart — a constant clock makes "pass start + budget" and "now +
    // budget" the same number, and the first version of this assertion
    // passed against both. It advances a minute per read, so by the time
    // the fan-out runs the fold-local answer is eight minutes later than
    // the pass-relative one.
    const r = healthy();
    const start = 1_000_000;
    let tick = 0;
    await runNightlyPass(r, recorder().log, () => start + 60_000 * tick++);
    expect(r.deadlines, "the deadline moved with the fold's own start")
      .toEqual([start + FANOUT_HEAL_DEADLINE_MS]);
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
