// The voter samples' arithmetic (D397), pinned:
//   1. one row per person — an edit or a replayed day moves the row, it
//      never adds one;
//   2. the cap keeps the newest, in a total order a re-run reproduces;
//   3. the frozen chips ride the row, and an entry without any carries {};
//   4. the additions group by question in a deterministic order.
import { describe, expect, it } from "vitest";
import {
  PATTERNS_SAMPLE_CAP, PATTERNS_SEED_PER_RUN, emptySample, mergeSample, needsSeed, sampleAdditions, sampleOrder, seedAddition, seedSample,
  type SampleAddition,
} from "./patternsSamples";

describe("mergeSample", () => {
  it("keeps one row per person and lets the newest answer win", () => {
    const s1 = mergeSample(null, "q", [
      { uid: "u1", optionIdx: 0, anchors: { city: "Oslo, NO" }, day: "2026-09-01" },
      { uid: "u2", optionIdx: 1, day: "2026-09-01" },
    ]);
    expect(s1.n).toBe(2);
    expect(s1.rows.u1).toEqual({ o: 0, a: { city: "Oslo, NO" }, d: "2026-09-01" });
    expect(s1.rows.u2.a, "an entry without chips carries an empty map").toEqual({});
    // an edit on a later day moves the person, adds nobody
    const s2 = mergeSample(s1, "q", [{ uid: "u1", optionIdx: 1, day: "2026-09-03" }]);
    expect(s2.n).toBe(2);
    expect(s2.rows.u1).toEqual({ o: 1, a: {}, d: "2026-09-03" });
    // an OLDER day replayed after the fact does not roll a person back
    const s3 = mergeSample(s2, "q", [{ uid: "u1", optionIdx: 0, day: "2026-09-02" }]);
    expect(s3.rows.u1.o).toBe(1);
    // within one day the later entry — the edit — wins
    const s4 = mergeSample(null, "q", [
      { uid: "u1", optionIdx: 0, day: "2026-09-05" },
      { uid: "u1", optionIdx: 1, day: "2026-09-05" },
    ]);
    expect(s4.rows.u1.o).toBe(1);
    expect(s4.n).toBe(1);
    // a malformed addition is skipped rather than minted
    expect(mergeSample(null, "q", [{ uid: "", optionIdx: 0, day: "d" }, { uid: "u", optionIdx: -1, day: "d" }]).n).toBe(0);
  });

  it("caps at the newest, oldest days out, and reproduces the same set from any order", () => {
    const adds: SampleAddition[] = [];
    for (let i = 0; i < PATTERNS_SAMPLE_CAP + 30; i++) {
      adds.push({ uid: `u${String(i).padStart(3, "0")}`, optionIdx: i % 2, day: `2026-08-${String(1 + (i % 28)).padStart(2, "0")}` });
    }
    const a = mergeSample(null, "q", adds);
    const b = mergeSample(null, "q", [...adds].reverse());
    expect(a.n).toBe(PATTERNS_SAMPLE_CAP);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    // the earliest day present is the one that lost rows
    const days = Object.values(a.rows).map((r) => r.d).sort();
    expect(days[0] >= "2026-08-01").toBe(true);
    const dropped = adds.filter((x) => !a.rows[x.uid]);
    const kept = Object.values(a.rows);
    expect(Math.max(...dropped.map((x) => x.day.localeCompare("")))).toBeDefined();
    for (const d of dropped) for (const k of kept) expect(d.day <= k.d).toBe(true);
    // merging in two steps lands where one step does
    const half = mergeSample(null, "q", adds.slice(0, 100));
    const whole = mergeSample(half, "q", adds.slice(100));
    expect(JSON.stringify(whole)).toBe(JSON.stringify(a));
  });

  it("orders newest first, then by uid, as a total order", () => {
    const rows: [string, { o: number; a: Record<string, string>; d: string }][] = [
      ["b", { o: 0, a: {}, d: "2026-09-01" }],
      ["a", { o: 0, a: {}, d: "2026-09-02" }],
      ["c", { o: 0, a: {}, d: "2026-09-02" }],
    ];
    expect([...rows].sort(sampleOrder).map((r) => r[0])).toEqual(["a", "c", "b"]);
    expect(emptySample("x")).toEqual({ qid: "x", rows: {}, n: 0 });
  });
});

describe("sampleAdditions", () => {
  it("groups a day's compacted answers by question, people in uid order, chips attached where the entry had them", () => {
    const byUid = new Map([
      ["u2", { qa: 1, qb: 0 }],
      ["u1", { qa: 0 }],
    ]);
    const anchors = new Map([["u1", { qa: { city: "Oslo, NO" } }]]);
    const adds = sampleAdditions("2026-09-05", byUid, anchors);
    expect([...adds.keys()].sort()).toEqual(["qa", "qb"]);
    expect(adds.get("qa")).toEqual([
      { uid: "u1", optionIdx: 0, anchors: { city: "Oslo, NO" }, day: "2026-09-05" },
      { uid: "u2", optionIdx: 1, anchors: undefined, day: "2026-09-05" },
    ]);
    expect(adds.get("qb")).toEqual([{ uid: "u2", optionIdx: 0, anchors: undefined, day: "2026-09-05" }]);
  });
});

// ── the seed (D442) ────────────────────────────────────────────────────
//
//   5. the seed stamp survives every merge — it is the seed's whole
//      idempotence, and the merged document replaces the old one;
//   6. the seed's projection lands a row exactly where the ledger would
//      have put it: the edit day over the answer day, string chips only,
//      a catalog row or an unclocked one refused rather than minted;
//   7. the seed folds and caps exactly as a day does, then stamps;
//   8. the per-run bound is the owner's 25, and its arithmetic holds.
describe("the seed (D442)", () => {
  const TS = (ms: number) => ({ toMillis: () => ms });

  it("carries the stamp across a merge, and needsSeed reads exactly that", () => {
    expect(needsSeed(null)).toBe(true);
    expect(needsSeed(emptySample("q"))).toBe(true);
    const seeded = seedSample(null, "q", [{ uid: "u1", optionIdx: 0, day: "2026-09-01" }], "2026-09-10");
    expect(seeded.seeded).toBe("2026-09-10");
    expect(needsSeed(seeded)).toBe(false);
    const merged = mergeSample(seeded, "q", [{ uid: "u2", optionIdx: 1, day: "2026-09-11" }]);
    expect(merged.seeded, "a nightly merge dropped the stamp — the query would run again forever").toBe("2026-09-10");
    expect(merged.n).toBe(2);
    // a document that was never seeded stays unstamped through a merge
    expect(mergeSample(null, "q", [{ uid: "u1", optionIdx: 0, day: "d" }]).seeded).toBeUndefined();
  });

  it("projects an answer document to the addition the ledger would have written", () => {
    const answeredAt = TS(Date.UTC(2026, 8, 1, 23, 59));
    const editedAt = TS(Date.UTC(2026, 8, 4, 8, 0));
    expect(seedAddition("u1", { optionIdx: 1, anchors: { city: "Oslo, NO", ageBand: "25-34" }, answeredAt })).toEqual({
      uid: "u1", optionIdx: 1, anchors: { city: "Oslo, NO", ageBand: "25-34" }, day: "2026-09-01",
    });
    // the edit day over the answer day — where mergeSample moved the row
    expect(seedAddition("u1", { optionIdx: 0, answeredAt, editedAt })).toEqual({ uid: "u1", optionIdx: 0, day: "2026-09-04" });
    // string chips only, ledgerAnchors' own rule; none at all means none
    expect(seedAddition("u1", { optionIdx: 0, anchors: { city: "Oslo, NO", n: 3, long: "x".repeat(81) }, answeredAt })?.anchors).toEqual({ city: "Oslo, NO" });
    expect(seedAddition("u1", { optionIdx: 0, anchors: {}, answeredAt })).toEqual({ uid: "u1", optionIdx: 0, day: "2026-09-01" });
    // refused, never minted: a catalog answer, a bad option, no uid, no clock
    expect(seedAddition("u1", { entity: 42, answeredAt } as Record<string, unknown>)).toBeNull();
    expect(seedAddition("u1", { optionIdx: -1, answeredAt })).toBeNull();
    expect(seedAddition("u1", { optionIdx: 1.5, answeredAt })).toBeNull();
    expect(seedAddition("", { optionIdx: 0, answeredAt })).toBeNull();
    expect(seedAddition("u1", { optionIdx: 0 })).toBeNull();
    expect(seedAddition("u1", { optionIdx: 0, answeredAt: "2026-09-01" })).toBeNull();
  });

  it("folds and caps exactly as a day does, then stamps", () => {
    const adds: SampleAddition[] = [];
    for (let i = 0; i < PATTERNS_SAMPLE_CAP + 30; i++) {
      adds.push({ uid: `u${String(i).padStart(3, "0")}`, optionIdx: i % 2, day: `2026-08-${String(1 + (i % 28)).padStart(2, "0")}` });
    }
    const viaSeed = seedSample(null, "q", adds, "2026-09-10");
    const viaDay = mergeSample(null, "q", adds);
    expect(viaSeed.n).toBe(PATTERNS_SAMPLE_CAP);
    expect(JSON.stringify(viaSeed.rows)).toBe(JSON.stringify(viaDay.rows));
    expect(viaSeed.seeded).toBe("2026-09-10");
    // seeding into a sample the ledger already fed keeps one row per person
    const prev = mergeSample(null, "q", [{ uid: "u000", optionIdx: 1, day: "2026-09-05" }]);
    const s = seedSample(prev, "q", adds.slice(0, 3), "2026-09-10");
    expect(s.n).toBe(3);
    expect(s.rows.u000.o, "the seed's older copy rolled a ledgered row back").toBe(1);
  });

  it("bounds a run at the owner's 25, which is 5,000 reads on a seeding night", () => {
    expect(PATTERNS_SEED_PER_RUN).toBe(25);
    expect(PATTERNS_SEED_PER_RUN * PATTERNS_SAMPLE_CAP).toBe(5000);
  });
});
