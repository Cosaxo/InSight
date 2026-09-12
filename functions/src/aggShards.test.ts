// aggShards.test.ts — the daily lane sharded (phase B, D467): the shard a
// person lands in, the blind writes a first answer and an edit make, the
// sum over shards, the cap over the union, the base a published document
// becomes, and the compactor's run.
import { describe, expect, it } from "vitest";
import { FieldValue } from "firebase-admin/firestore";
import {
  AGG_SHARDS, BASE_SHARD, COMPACT_DIRTY_CAP, SHARDED_QIDS,
  baseFrom, capBreakdown, isShardedQid, publishedFrom, runAggCompaction, shardEditIncrements, shardIncrements, shardOf, sumShards,
  type AggCompactStore, type Published, type ShardDoc,
} from "./aggShards";
import { BREAKDOWN_MAX_BUCKETS, OVERFLOW_SHARDS, breakdownBucket, foldAnchors, overflowShard, type BreakdownCounts } from "./pure";
import { V2_QUESTIONS } from "./v2content";

const quiet = { info: () => {}, warn: () => {} };
type Line = { level: "info" | "warn"; msg: string; fields: Record<string, unknown> };
function recorder() {
  const lines: Line[] = [];
  const take = (level: Line["level"]) => (msg: unknown, fields?: unknown) => { lines.push({ level, msg: String(msg), fields: (fields ?? {}) as Record<string, unknown> }); };
  return { lines, log: { info: take("info"), warn: take("warn") } };
}

/** Deep keys of an object, sorted — what an increment write TOUCHES. */
const keysOf = (o: unknown, prefix = ""): string[] => {
  if (!o || typeof o !== "object" || o instanceof FieldValue) return [prefix];
  return Object.keys(o as object).sort().flatMap((k) => keysOf((o as Record<string, unknown>)[k], prefix ? `${prefix}.${k}` : k));
};

describe("which questions shard, and where a person lands", () => {
  it("shards exactly the daily bank, off the compiled content", () => {
    const daily = V2_QUESTIONS.filter((q) => q.surface === "daily").map((q) => q.id);
    expect(daily.length).toBeGreaterThan(0);
    for (const id of daily) expect(isShardedQid(id)).toBe(true);
    for (const q of V2_QUESTIONS.filter((q) => q.surface !== "daily")) expect(isShardedQid(q.id), q.id).toBe(false);
    expect(SHARDED_QIDS.size).toBe(daily.length);
  });
  it("hashes a person to a shard in range, the same one every time", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const s = shardOf(`uid-${i}`);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThan(AGG_SHARDS);
      expect(shardOf(`uid-${i}`)).toBe(s);
      seen.add(s);
    }
    // Two thousand people reach every shard — a hash that clumped would
    // put the wall back one shard at a time.
    expect(seen.size).toBe(AGG_SHARDS);
  });
});

describe("the blind writes", () => {
  const anchors = { ageBand: "25-34", country: "NO", city: "Oslo, NO", gender: "?" };
  it("a first answer touches the option, the total, and one cell per dimension the chips name — nothing else", () => {
    const w = shardIncrements("daily-x", 3, 1, anchors, 1234);
    const want = ["qid", "s", "dirtyAt", "counts.1", "total"];
    for (const dim of ["ageBand", "country", "city", "gender"] as const) {
      const bucket = breakdownBucket(anchors[dim], dim);
      if (bucket !== null) want.push(`by.${dim}.${bucket}.1`);
    }
    expect(keysOf(w)).toEqual(want.sort());
    expect((w.counts as Record<string, FieldValue>)["1"].isEqual(FieldValue.increment(1))).toBe(true);
    expect((w.total as FieldValue).isEqual(FieldValue.increment(1))).toBe(true);
    expect(w).toMatchObject({ qid: "daily-x", s: 3, dirtyAt: 1234 });
    // No chips: the option and the total, and no `by` key at all.
    expect(keysOf(shardIncrements("daily-x", 0, 2, {}, 1))).toEqual(["counts.2", "dirtyAt", "qid", "s", "total"]);
  });
  it("an edit moves -old/+new on the option and every cell, leaves the total, and counts the crossing", () => {
    const w = shardEditIncrements("daily-x", 3, 0, 2, { country: "NO" }, 99);
    expect(keysOf(w)).toEqual(["by.country.NO.0", "by.country.NO.2", "counts.0", "counts.2", "dirtyAt", "edits.0.2", "qid", "s"]);
    const counts = w.counts as Record<string, FieldValue>;
    expect(counts["0"].isEqual(FieldValue.increment(-1))).toBe(true);
    expect(counts["2"].isEqual(FieldValue.increment(1))).toBe(true);
    expect("total" in w).toBe(false);
  });
});

/** A numeric shard as Firestore would hold it after the increments —
 *  the same keys the blind writes touch, applied. */
function foldNumeric(shards: ShardDoc[], s: number, optionIdx: number, anchors: Record<string, string>, from?: number): void {
  const d = (shards[s] ||= { qid: "q", s, counts: {}, total: 0, by: {}, edits: {} });
  const k = String(optionIdx);
  const bump = (m: Record<string, number>, key: string, n: number) => { m[key] = (m[key] || 0) + n; };
  bump(d.counts!, k, 1);
  if (from === undefined) d.total! += 1; else bump(d.counts!, String(from), -1);
  for (const [dim, v] of Object.entries(anchors)) {
    const bucket = breakdownBucket(v, dim as never);
    if (bucket === null) continue;
    const byDim = (d.by![dim] ||= {});
    const cell = (byDim[bucket] ||= {});
    bump(cell, k, 1);
    if (from !== undefined) bump(cell, String(from), -1);
  }
  if (from !== undefined) bump((d.edits![String(from)] ||= {}), k, 1);
}

describe("the sum and the cap", () => {
  it("the compacted document equals the trigger's own fold on the same answers, under the cap", () => {
    // The runbook's gate for B.2. Forty answers, three cities, two ages,
    // spread over the shards by person: the hot fold (foldAnchors, what
    // the unsharded trigger writes) and the sum of the shards must be one
    // document.
    const shards: ShardDoc[] = [];
    const hot: BreakdownCounts = {};
    const counts: Record<string, number> = {};
    for (let i = 0; i < 40; i++) {
      const anchors = { ageBand: i % 2 ? "25-34" : "35-44", city: ["Oslo, NO", "Bergen, NO", "Tromsø, NO"][i % 3], country: "NO" };
      const opt = i % 3 === 0 ? 0 : 1;
      foldNumeric(shards, shardOf(`u${i}`), opt, anchors);
      foldAnchors(hot, anchors, opt);
      counts[String(opt)] = (counts[String(opt)] || 0) + 1;
    }
    const out = publishedFrom(shards.filter(Boolean));
    expect(out.pub).toEqual({ counts, total: 40, by: hot });
    expect(out.overCap).toBe(false);
    expect(out.tails).toEqual({});
    expect(out.negatives).toBe(0);
  });

  it("an edit delivered before its create sums to the create's final state — increments commute", () => {
    const shards: ShardDoc[] = [];
    foldNumeric(shards, 0, 2, { country: "NO" }, 0); // the edit lands first: -0, +2
    foldNumeric(shards, 5, 0, { country: "NO" });   // the create, on another shard after AGG_SHARDS moved
    const out = publishedFrom(shards.filter(Boolean));
    expect(out.pub).toEqual({ counts: { "2": 1 }, total: 1, by: { country: { NO: { "2": 1 } } }, edits: { "0": { "2": 1 } } });
    expect(out.negatives).toBe(0);
  });

  it("a sum below zero is dropped and counted, never published as a debt", () => {
    const out = sumShards([{ counts: { "0": -1, "1": 2 }, total: -1, by: { country: { NO: { "0": -1 } } } }]);
    expect(out.counts).toEqual({ "1": 2 });
    expect(out.total).toBe(0);
    expect(out.by).toEqual({});
    expect(out.negatives).toBe(3);
  });

  it("keeps the biggest buckets hot and sends the rest to the tail shard their name hashes to", () => {
    const by: BreakdownCounts = { city: {} };
    for (let i = 0; i < BREAKDOWN_MAX_BUCKETS + 5; i++) by.city[`City${String(i).padStart(2, "0")}, NO`] = { "0": i + 1 };
    const { hot, tails, overCap } = capBreakdown(by);
    expect(overCap).toBe(true);
    expect(Object.keys(hot.city)).toHaveLength(BREAKDOWN_MAX_BUCKETS);
    // The five smallest are the tail, each in the shard the client computes.
    for (let i = 0; i < 5; i++) {
      const name = `City${String(i).padStart(2, "0")}, NO`;
      expect(hot.city[name]).toBeUndefined();
      expect(tails[String(overflowShard(name))].city[name]).toEqual({ "0": i + 1 });
    }
    // Every bucket lives in exactly one of the two.
    const inTails = Object.values(tails).flatMap((t) => Object.keys(t.city ?? {}));
    expect(inTails).toHaveLength(5);
    expect(inTails.every((b) => !(b in hot.city))).toBe(true);
    expect(Object.keys(tails).every((s) => Number(s) >= 0 && Number(s) < OVERFLOW_SHARDS)).toBe(true);
  });

  it("ties by name, so two runs over the same shards publish the same document", () => {
    const by: BreakdownCounts = { country: {} };
    for (let i = 0; i < BREAKDOWN_MAX_BUCKETS + 2; i++) by.country[`C${String(i).padStart(2, "0")}`] = { "0": 1 };
    const a = capBreakdown(by);
    const b = capBreakdown(JSON.parse(JSON.stringify(by)));
    expect(a).toEqual(b);
    expect(Object.keys(a.hot.country)).toEqual(Object.keys(by.country).sort().slice(0, BREAKDOWN_MAX_BUCKETS));
  });

  it("the base is the published document and its tail as one uncapped map", () => {
    const pub: ShardDoc = { counts: { "0": 5 }, total: 5, by: { city: { "Oslo, NO": { "0": 3 } } }, edits: { "1": { "0": 1 } } };
    const tails = [null, { city: { "Bergen, NO": { "0": 2 } } }, null];
    const base = baseFrom("q", pub, tails, 42);
    expect(base).toEqual({
      qid: "q", s: BASE_SHARD, counts: { "0": 5 }, total: 5,
      by: { city: { "Oslo, NO": { "0": 3 }, "Bergen, NO": { "0": 2 } } }, edits: { "1": { "0": 1 } }, dirtyAt: 42, migrated: true,
    });
    expect(baseFrom("q", null, [], 1)).toMatchObject({ counts: {}, total: 0, by: {}, migrated: true });
    expect("edits" in baseFrom("q", null, [], 1)).toBe(false);
  });
});

describe("runAggCompaction", () => {
  function fakeStore(o: { dirty?: string[]; capped?: boolean; shards: Record<string, ShardDoc[]>; pub?: Record<string, ShardDoc> }) {
    const published: Array<[string, Published]> = [];
    const bases: string[] = [];
    const dirtyAsked: Array<[number, number]> = [];
    const store: AggCompactStore = {
      async dirtyQids(sinceMs, cap) { dirtyAsked.push([sinceMs, cap]); return { qids: o.dirty ?? [], capped: !!o.capped }; },
      async shardsOf(qid) { return [...(o.shards[qid] ?? [])]; },
      async ensureBase(qid, nowMs) {
        if ((o.shards[qid] ?? []).some((d) => d.s === BASE_SHARD)) return null;
        bases.push(qid);
        const base = baseFrom(qid, o.pub?.[qid] ?? null, [], nowMs);
        (o.shards[qid] ||= []).push(base);
        return base;
      },
      async publish(qid, out) { published.push([qid, out]); },
    };
    return { store, published, bases, dirtyAsked: () => dirtyAsked };
  }
  const NOW = 10_000_000;

  it("publishes every dirty question from every shard, migrating a question without a base once", async () => {
    const f = fakeStore({
      dirty: ["daily-b", "daily-a"],
      shards: { "daily-a": [{ qid: "daily-a", s: 0, counts: { "1": 2 }, total: 2 }], "daily-b": [{ qid: "daily-b", s: BASE_SHARD, counts: { "0": 7 }, total: 7 }, { qid: "daily-b", s: 3, counts: { "0": 1 }, total: 1 }] },
      pub: { "daily-a": { counts: { "1": 10, "0": 4 }, total: 14 } },
    });
    const { log, lines } = recorder();
    const out = await runAggCompaction(f.store, NOW, log);
    expect(f.dirtyAsked()[0][0]).toBe(NOW - 15 * 60_000);
    expect(f.bases).toEqual(["daily-a"]);
    expect(f.published.map(([q, p]) => [q, p.pub])).toEqual([
      ["daily-a", { counts: { "0": 4, "1": 12 }, total: 16, by: {} }],
      ["daily-b", { counts: { "0": 8 }, total: 8, by: {} }],
    ]);
    expect(out).toEqual({ qids: 2, shards: 4, published: 2, migrated: 1, negatives: 0, capped: false, stopped: false, clean: true });
    expect(lines).toHaveLength(1);
    expect(lines[0].level).toBe("info");
    expect(lines[0].fields).toMatchObject({ metric: "agg_compact", published: 2, migrated: 1 });
  });

  it("an idle minute still beats — the silence policy needs the line", async () => {
    const f = fakeStore({ shards: {} });
    const { log, lines } = recorder();
    const out = await runAggCompaction(f.store, NOW, log);
    expect(out).toMatchObject({ qids: 0, published: 0, clean: true });
    expect(lines.map((l) => [l.level, l.fields.metric])).toEqual([["info", "agg_compact"]]);
  });

  it("a full dirty page and a run the clock ends are both said out loud, and neither is clean", async () => {
    const capped = fakeStore({ dirty: ["daily-a"], capped: true, shards: { "daily-a": [{ qid: "daily-a", s: BASE_SHARD }] } });
    const c = recorder();
    expect((await runAggCompaction(capped.store, NOW, c.log)).clean).toBe(false);
    expect(c.lines[0].level).toBe("warn");
    expect(c.lines[0].msg).toMatch(new RegExp(`MORE than ${COMPACT_DIRTY_CAP} shards`));
    // The clock: under the deadline for the first question, past it for the second.
    let t = 0;
    const clock = () => (t += 1000);
    const late = fakeStore({ dirty: ["daily-a", "daily-b"], shards: { "daily-a": [{ qid: "daily-a", s: BASE_SHARD }], "daily-b": [{ qid: "daily-b", s: BASE_SHARD }] } });
    const l = recorder();
    const out = await runAggCompaction(late.store, NOW, l.log, { deadlineAt: 1500, clock });
    expect(late.published.map(([q]) => q)).toEqual(["daily-a"]);
    expect(out).toMatchObject({ qids: 2, published: 1, stopped: true, clean: false });
    expect(l.lines[0].msg).toMatch(/STOPPED on the clock/);
  });

  it("a named question skips the dirty query, and a negative sum is a warning", async () => {
    const f = fakeStore({ dirty: ["never-asked"], shards: { "daily-z": [{ qid: "daily-z", s: BASE_SHARD, counts: { "0": -2 }, total: 0 }] } });
    const { log, lines } = recorder();
    const out = await runAggCompaction(f.store, NOW, log, { qids: ["daily-z", "daily-z"] });
    expect(f.dirtyAsked()).toEqual([]);
    expect(f.published.map(([q]) => q)).toEqual(["daily-z"]);
    expect(out).toMatchObject({ qids: 1, negatives: 1, clean: true });
    expect(lines[0].level).toBe("warn");
    expect(lines[0].msg).toMatch(/1 cell\(s\) summed below zero/);
    await runAggCompaction(f.store, NOW, quiet, { qids: ["daily-z"] });
  });
});
