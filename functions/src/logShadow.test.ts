// logShadow.test.ts — the answer log's nightly shadow (LOG-FIRST-RUNBOOK
// A.7): the ledger day folded the folds' own way, the log's rows matched
// by id across the midnight seam, the three phase-D queries' results
// compared, and one line that says clean or names what is not.
import { describe, expect, it } from "vitest";
import { LOG_SHADOW_ID_CHUNK, type ShadowFold, type ShadowRow } from "./log";
import { LOG_SHADOW_EXAMPLES, diffFolds, foldLedgerDay, runLogShadow, type LogShadowStore } from "./logShadow";
import type { LedgerDayEntry } from "./ledger";
import { PATTERNS_SAMPLE_CAP } from "./patternsSamples";

const DAY = "2026-09-08";
const NOW = Date.UTC(2026, 8, 9, 2, 23);
const at = (h: number, m = 0, s = 0) => Date.UTC(2026, 8, 8, h, m, s);
const entry = (id: string, uid: string, qid: string, optionIdx: number | undefined, atMs: number, fromIdx?: number): LedgerDayEntry => ({
  id, uid, qid, at: atMs,
  ...(optionIdx === undefined ? {} : { optionIdx }),
  ...(fromIdx === undefined ? {} : { fromIdx }),
});
const quiet = { info: () => {}, warn: () => {} };

type Line = { level: "info" | "warn"; msg: string; fields: Record<string, unknown> };
function recorder(): { lines: Line[]; log: { info: (m: unknown, f?: unknown) => void; warn: (m: unknown, f?: unknown) => void } } {
  const lines: Line[] = [];
  const take = (level: Line["level"]) => (msg: unknown, fields?: unknown) => { lines.push({ level, msg: String(msg), fields: (fields ?? {}) as Record<string, unknown> }); };
  return { lines, log: { info: take("info"), warn: take("warn") } };
}

/** The log as a faithful mirror of the ledger day: what a clean night's
 *  exact half sees (a row per entry, on the ledger's day, the option
 *  nulled past the row's usable range as `logRow` nulls it). */
const mirrorRows = (entries: readonly LedgerDayEntry[]): ShadowRow[] =>
  entries.map((e) => ({ id: e.id, uid: e.uid, qid: e.qid, o: typeof e.optionIdx === "number" && Number.isInteger(e.optionIdx) && e.optionIdx >= 0 && e.optionIdx <= 19 ? e.optionIdx : null, day: DAY }));

function fakeStore(o: { entries: LedgerDayEntry[]; rows?: ShadowRow[] | null; fold?: ShadowFold | null }) {
  const asked: string[][] = [];
  let ledgerReads = 0;
  const store: LogShadowStore = {
    async ledgerDay(day) { ledgerReads += 1; return day === DAY ? o.entries : []; },
    async shadowRows(_day, ids) {
      asked.push([...ids]);
      if (o.rows === null) return null;
      const rows = o.rows ?? mirrorRows(o.entries);
      const want = new Set(ids);
      return rows.filter((r) => want.has(r.id));
    },
    async shadowFold() { return o.fold === undefined ? foldLedgerDay(DAY, o.entries) : o.fold; },
  };
  return { store, asked, ledgerReads: () => ledgerReads };
}

describe("foldLedgerDay — the folds' own arithmetic over a ledger day", () => {
  it("one addition per person per question, the newest answer of the day (an edit is the later entry)", () => {
    const entries = [
      entry("e1", "u1", "q1", 0, at(9)),
      entry("e2", "u1", "q1", 2, at(9, 5), 0), // the edit, sixty seconds on
      entry("e3", "u2", "q1", 1, at(10)),
      entry("e4", "u2", "q2", 3, at(11), 1), // an edit-only day for this pair: the new option counts
    ];
    const f = foldLedgerDay(DAY, entries);
    expect(f.entries).toBe(4);
    expect(f.actives).toBe(2);
    expect(f.additions.get("q1")).toEqual([{ uid: "u1", o: 2 }, { uid: "u2", o: 1 }]);
    expect(f.additions.get("q2")).toEqual([{ uid: "u2", o: 3 }]);
  });

  it("an entry with no option (a catalogue pick) is an entry and a person, not an addition; an empty uid is no one", () => {
    const entries = [
      entry("e1", "u1", "pick-1", undefined, at(9)),
      entry("e2", "", "q1", 0, at(9)),
      entry("e3", "u2", "q1", -1, at(9)),
    ];
    const f = foldLedgerDay(DAY, entries);
    expect(f.entries).toBe(3);
    expect(f.actives).toBe(2);
    expect(f.additions.size).toBe(0);
  });

  it("cuts a question's additions to the samples' cap in uid order — trimAdditions, the fold's own trim", () => {
    const n = PATTERNS_SAMPLE_CAP + 1;
    const entries = Array.from({ length: n }, (_, i) => entry(`e${i}`, `u${String(n - i).padStart(4, "0")}`, "q1", i % 2, at(9, 0, i % 60)));
    const adds = foldLedgerDay(DAY, entries).additions.get("q1")!;
    expect(adds).toHaveLength(PATTERNS_SAMPLE_CAP);
    expect(adds[0].uid).toBe("u0001");
    expect(adds[adds.length - 1].uid).toBe(`u${String(PATTERNS_SAMPLE_CAP).padStart(4, "0")}`);
    expect(adds.map((a) => a.uid)).toEqual([...adds.map((a) => a.uid)].sort());
  });
});

describe("diffFolds", () => {
  const fold = (adds: Record<string, Array<[string, number]>>): ShadowFold => ({
    entries: 0, actives: 0,
    additions: new Map(Object.entries(adds).map(([qid, l]) => [qid, l.map(([uid, o]) => ({ uid, o }))])),
  });
  it("names a question whose list differs in an option, in a person, or in existing at all — and no other", () => {
    const a = fold({ q1: [["u1", 0], ["u2", 1]], q2: [["u1", 2]], q3: [["u1", 0]], q4: [["u1", 0], ["u2", 0]] });
    const b = fold({ q1: [["u1", 0], ["u2", 2]], q2: [["u3", 2]], q3: [["u1", 0]], q5: [["u1", 0]] });
    expect(diffFolds(a, b)).toEqual({ questions: 5, differing: 4, examples: ["q1", "q2", "q4", "q5"] });
    expect(diffFolds(a, a)).toEqual({ questions: 4, differing: 0, examples: [] });
  });
  it("prints a handful of examples, not the corpus", () => {
    const many = Object.fromEntries(Array.from({ length: LOG_SHADOW_EXAMPLES + 3 }, (_, i) => [`q${i}`, [["u1", 0]] as Array<[string, number]>]));
    const d = diffFolds(fold(many), fold({}));
    expect(d.differing).toBe(LOG_SHADOW_EXAMPLES + 3);
    expect(d.examples).toHaveLength(LOG_SHADOW_EXAMPLES);
  });
});

describe("runLogShadow", () => {
  const day = [
    entry("e1", "u1", "q1", 0, at(9)),
    entry("e2", "u1", "q1", 2, at(9, 5), 0),
    entry("e3", "u2", "q1", 1, at(10)),
    entry("e4", "u2", "q2", 3, at(11)),
    entry("e5", "u3", "pick-1", undefined, at(12)),
  ];

  it("skips itself, reading nothing, where there is no BigQuery — and a skip is not clean", async () => {
    const { store, ledgerReads } = fakeStore({ entries: day, fold: null });
    const { log, lines } = recorder();
    const out = await runLogShadow(store, NOW, log);
    expect(out).toMatchObject({ day: DAY, skipped: true, clean: false });
    expect(ledgerReads()).toBe(0);
    expect(lines).toHaveLength(1);
    expect(lines[0].fields).toMatchObject({ metric: "log_shadow", skipped: true });
  });

  it("a log that mirrors the ledger is a clean night: one info line carrying every number", async () => {
    const { store } = fakeStore({ entries: day });
    const { log, lines } = recorder();
    const out = await runLogShadow(store, NOW, log);
    expect(out).toEqual({
      day: DAY, skipped: false, capped: false, entries: 5, checked: 5, missing: 0, mismatched: 0, seam: 0,
      logEntries: 5, actives: 3, logActives: 3, questions: 2, differing: 0, examples: [], clean: true,
    });
    expect(lines).toHaveLength(1);
    expect(lines[0].level).toBe("info");
    expect(lines[0].msg).toMatch(/clean/);
    expect(lines[0].fields).toMatchObject({ metric: "log_shadow", clean: true, entries: 5 });
  });

  it("counts a missing row, a row that carries the wrong answer, and a row filed on another day — each once, at warn", async () => {
    const rows = mirrorRows(day)
      .filter((r) => r.id !== "e4") // the reconcile could not put it back
      .map((r) => (r.id === "e2" ? { ...r, o: 1 } : r)) // the edit's option, wrong in the table
      .map((r) => (r.id === "e3" ? { ...r, day: "2026-09-07" } : r)); // the trigger's clock said yesterday
    const { store } = fakeStore({ entries: day, rows });
    const { log, lines } = recorder();
    const out = await runLogShadow(store, NOW, log);
    expect(out).toMatchObject({ checked: 5, missing: 1, mismatched: 1, seam: 1, clean: false, capped: false });
    expect(lines[0].level).toBe("warn");
    expect(lines[0].msg).toMatch(/1 missing, 1 mismatched, 1 filed on another day, of 5\/5 checked/);
  });

  it("an option the row nulls is compared as null, not as a mismatch", async () => {
    // logRow nulls an index past its usable range; the shadow wants the
    // row the reconcile would write, so the same rule applies on both
    // sides and a legal-but-large index is not a finding.
    const entries = [entry("e1", "u1", "q1", 25, at(9))];
    const { store } = fakeStore({ entries });
    const out = await runLogShadow(store, NOW, quiet);
    expect(out).toMatchObject({ mismatched: 0, clean: true });
  });

  it("a fold query that disagrees with the fold is NOT clean even when every row matched — and it names the question", async () => {
    const fold = foldLedgerDay(DAY, day);
    fold.actives += 1;
    fold.additions.get("q1")![1] = { uid: "u2", o: 0 };
    const { store } = fakeStore({ entries: day, fold });
    const { log, lines } = recorder();
    const out = await runLogShadow(store, NOW, log);
    expect(out).toMatchObject({ missing: 0, mismatched: 0, seam: 0, actives: 3, logActives: 4, differing: 1, examples: ["q1"], clean: false });
    expect(lines[0].level).toBe("warn");
    expect(lines[0].msg).toMatch(/actives 3 vs 4, 1 of 2 questions differ \(q1\)/);
  });

  it("looks the day up in chunks of LOG_SHADOW_ID_CHUNK ids", async () => {
    const n = LOG_SHADOW_ID_CHUNK + 1;
    const entries = Array.from({ length: n }, (_, i) => entry(`e${i}`, `u${i % 7}`, `q${i % 3}`, i % 2, at(9, 0, i % 60)));
    const { store, asked } = fakeStore({ entries });
    const out = await runLogShadow(store, NOW, quiet);
    expect(asked.map((c) => c.length)).toEqual([LOG_SHADOW_ID_CHUNK, 1]);
    expect(out).toMatchObject({ checked: n, missing: 0, clean: true });
  });

  it("stops on the pass's clock before the next chunk, says so, and is never clean when it did", async () => {
    const n = LOG_SHADOW_ID_CHUNK + 1;
    const entries = Array.from({ length: n }, (_, i) => entry(`e${i}`, `u${i % 7}`, `q${i % 3}`, i % 2, at(9, 0, i % 60)));
    // A clock read once before each chunk: under the deadline for the
    // first, past it for the second.
    let t = 0;
    const clock = () => (t += 1000);
    const late = fakeStore({ entries });
    const { log, lines } = recorder();
    const out = await runLogShadow(late.store, NOW, log, { deadlineAt: 1500, clock });
    expect(late.asked.map((c) => c.length)).toEqual([LOG_SHADOW_ID_CHUNK]);
    expect(out).toMatchObject({ capped: true, checked: LOG_SHADOW_ID_CHUNK, clean: false });
    expect(lines[0].level).toBe("warn");
    expect(lines[0].msg).toMatch(/STOPPED on the pass's clock/);
    // …and a deadline already past looks nothing up at all, but still runs
    // the two fold queries, which is what they cost.
    const gone = fakeStore({ entries: day });
    const early = await runLogShadow(gone.store, NOW, quiet, { deadlineAt: 0, clock: () => 1 });
    expect(gone.asked).toEqual([]);
    expect(early).toMatchObject({ capped: true, checked: 0, logEntries: 5, clean: false });
  });
});
