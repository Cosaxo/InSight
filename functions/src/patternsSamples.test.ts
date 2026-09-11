// The voter samples' arithmetic (D397), pinned:
//   1. one row per person — an edit or a replayed day moves the row, it
//      never adds one;
//   2. the cap keeps the newest, in a total order a re-run reproduces;
//   3. the frozen chips ride the row, and an entry without any carries {};
//   4. the additions group by question in a deterministic order;
//   5. (DATA-EFFICIENCY-RUNBOOK 2.2) the person's stamp — name, scores,
//      logic — rides the row, an edit keeps its create's, and the day's
//      stamp refreshes the day's OWN rows and no others (it used to reach
//      every row, which republished what the fan-out had corrected);
//   6. (runbook 2.5) the per-city pairs, hottest first, cut to the budget.
import { describe, expect, it } from "vitest";
import {
  CITY_SAMPLE_PAIRS_PER_NIGHT, PATTERNS_SAMPLE_CAP, PATTERNS_SEED_PER_RUN, citySampleAdditions, citySampleId, emptySample,
  mergeSample, needsSeed, sampleAdditions, sampleOrder, seedAddition, seedSample, worldSampleId, type SampleAddition,
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

  it("trims a day's additions to the cap before merging, exactly as the sort after would", () => {
    // The daily question's additions are the day's whole crowd. The
    // pre-trim must not change what the cap keeps: a prior sample of an
    // older day plus a flood of today's additions lands on the same rows
    // whichever way it is computed — and the same person twice within the
    // day (an edit after a create) is still one row, the later one.
    const prev = mergeSample(null, "q", [{ uid: "old1", optionIdx: 0, day: "2026-08-30" }, { uid: "old2", optionIdx: 1, day: "2026-08-30" }]);
    const flood: SampleAddition[] = [];
    for (let i = 0; i < PATTERNS_SAMPLE_CAP + 40; i++) flood.push({ uid: `u${String(i).padStart(3, "0")}`, optionIdx: 0, day: "2026-09-01" });
    flood.push({ uid: "u001", optionIdx: 1, day: "2026-09-01" }); // the edit, later in the day
    const merged = mergeSample(prev, "q", flood);
    expect(merged.n).toBe(PATTERNS_SAMPLE_CAP);
    expect(merged.rows.old1, "an older day's row survived a full day of newer ones").toBeUndefined();
    expect(merged.rows.u001.o, "the later entry within the day did not win").toBe(1);
    const uids = Object.keys(merged.rows).sort();
    expect(uids[0]).toBe("u000");
    expect(uids[uids.length - 1]).toBe(`u${String(PATTERNS_SAMPLE_CAP - 1).padStart(3, "0")}`);
  });

  it("orders newest first, then by uid, as a total order", () => {
    const rows: [string, { o: number; a: Record<string, string>; d: string }][] = [
      ["b", { o: 0, a: {}, d: "2026-09-01" }],
      ["a", { o: 0, a: {}, d: "2026-09-02" }],
      ["c", { o: 0, a: {}, d: "2026-09-02" }],
    ];
    expect([...rows].sort(sampleOrder).map((r) => r[0])).toEqual(["a", "c", "b"]);
    expect(emptySample("x")).toEqual({ qid: "x", rows: {}, n: 0 });
    expect(emptySample("x", "Oslo, NO")).toEqual({ qid: "x", rows: {}, n: 0, city: "Oslo, NO" });
  });
});

describe("the stamp on a row (DATA-EFFICIENCY-RUNBOOK 2.2)", () => {
  const stamp = { n: "Olaf", s: { big5: { O: 70 } }, l: 55 };
  const later = { n: "Olaf T", s: { big5: { O: 71 } }, l: null };

  it("rides the row from the addition, and a row without one carries no stamp keys at all", () => {
    const s = mergeSample(null, "q", [
      { uid: "u1", optionIdx: 0, day: "2026-09-01", stamp },
      { uid: "u2", optionIdx: 1, day: "2026-09-01" },
    ]);
    expect(s.rows.u1).toEqual({ o: 0, a: {}, d: "2026-09-01", n: "Olaf", s: { big5: { O: 70 } }, l: 55 });
    expect(s.rows.u2).toEqual({ o: 1, a: {}, d: "2026-09-01" });
    expect(Object.keys(s.rows.u2)).not.toContain("n");
  });

  it("an edit keeps what its create wrote — name, scores and logic — while the answer moves", () => {
    const s1 = mergeSample(null, "q", [{ uid: "u1", optionIdx: 0, day: "2026-09-01", stamp }]);
    const s2 = mergeSample(s1, "q", [{ uid: "u1", optionIdx: 1, day: "2026-09-03" }]);
    expect(s2.rows.u1).toEqual({ o: 1, a: {}, d: "2026-09-03", n: "Olaf", s: { big5: { O: 70 } }, l: 55 });
    // a stamped-with-nothing create is still a stamp: "" and nulls land
    const bare = { n: "", s: null, l: null };
    const s3 = mergeSample(s2, "q", [{ uid: "u1", optionIdx: 0, day: "2026-09-04", stamp: bare }]);
    expect(s3.rows.u1).toEqual({ o: 0, a: {}, d: "2026-09-04", n: "", s: null, l: null });
  });

  // WHAT THIS CASE USED TO PIN, and why the pin was the bug.
  //
  // It read: "the day's stamps refresh every row the merge rewrites,
  // additions or not" — u1 answered this question weeks ago, answered
  // something ELSE today with a new name, and "u1's row takes the newer
  // stamp for free". The word doing the damage is NEWER. The day's stamp
  // map is built from the day's LEDGER entries, so it is the profile as it
  // stood when they answered; `profileFanout.restampSamples` writes the
  // same three fields with the profile as it stands NOW. Against a row the
  // fan-out has already corrected, the ledger's copy is OLDER, and this
  // loop wrote it back — every night, on a document every signed-in device
  // reads, for every question the person had ever answered.
  //
  // The case below is the one that makes it concrete rather than abstract.
  it("leaves a row the day did not touch alone — the fan-out owns those", () => {
    const prev = mergeSample(null, "q", [{ uid: "u1", optionIdx: 0, day: "2026-08-01", stamp }]);
    const stamps = new Map([["u1", later]]);
    const s = mergeSample(prev, "q", [{ uid: "u2", optionIdx: 1, day: "2026-09-01" }], undefined, stamps);
    // u1 did not answer THIS question today. Their row keeps what it had.
    expect(s.rows.u1).toEqual({ o: 0, a: {}, d: "2026-08-01", n: "Olaf", s: { big5: { O: 70 } }, l: 55 });
    expect(s.rows.u2).toEqual({ o: 1, a: {}, d: "2026-09-01" });
  });

  it("…and a withdrawn political coordinate is not republished by tonight's pass", () => {
    // The regression in the shape a reader will recognise. The row already
    // carries what the fan-out wrote after the withdrawal — the new name,
    // and scores with no `political` key. The person is in tonight's stamp
    // map because they answered SOMETHING today, and the ledger's copy of
    // their profile predates the withdrawal.
    const afterWithdrawal = { n: "New Name", s: { big5: { O: 70 } }, l: null };
    const asOfAnswer = { n: "Old Name", s: { big5: { O: 70 }, political: { x: 3, y: -7 } }, l: null };
    const prev = mergeSample(null, "q", [
      { uid: "u1", optionIdx: 0, day: "2026-08-01", stamp: afterWithdrawal },
    ]);
    const s = mergeSample(prev, "q", [{ uid: "u2", optionIdx: 1, day: "2026-09-01" }],
      undefined, new Map([["u1", asOfAnswer]]));
    expect(s.rows.u1.n, "the pass reverted a rename").toBe("New Name");
    expect((s.rows.u1.s as Record<string, unknown> | null)?.political,
      "a withdrawn political coordinate was republished").toBeUndefined();
  });

  it("still stamps the day's OWN addition — the edit case this loop is for", () => {
    // The control, and the reason the loop survives at all: an addition
    // without a stamp is an edit's, and the day's map is what supplies one.
    // Narrowing the loop must not take this with it.
    const prev = mergeSample(null, "q", [{ uid: "u1", optionIdx: 0, day: "2026-08-01" }]);
    const s = mergeSample(prev, "q", [{ uid: "u1", optionIdx: 1, day: "2026-09-01" }],
      undefined, new Map([["u1", later]]));
    expect(s.rows.u1).toEqual({ o: 1, a: {}, d: "2026-09-01", n: "Olaf T", s: { big5: { O: 71 } }, l: null });
  });
});

describe("sampleAdditions", () => {
  it("groups a day's compacted answers by question, people in uid order, chips attached where the entry had them", () => {
    // ANNOTATED, because inference reads the two literals as different
    // shapes and the union it builds is not an AnswerMap — `qb` comes out
    // optional, which is the one thing a map of qid → optionIdx may not
    // be. The fold reads every value as a number; a fixture whose type
    // says "possibly undefined" is a fixture the real caller could never
    // hand it.
    const byUid = new Map<string, Record<string, number>>([
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

  it("attaches the person's stamp for the day to every addition of theirs", () => {
    const stamp = { n: "Ola", s: null, l: 12 };
    // picks fourth since D456, stamps fifth
    const adds = sampleAdditions("2026-09-05", new Map([["u1", { qa: 0, qb: 1 }]]), new Map(), new Map(), new Map([["u1", stamp]]));
    expect(adds.get("qa")![0].stamp).toEqual(stamp);
    expect(adds.get("qb")![0].stamp).toEqual(stamp);
  });
});

describe("citySampleAdditions (runbook 2.5)", () => {
  const add = (uid: string, city?: string): SampleAddition => ({ uid, optionIdx: 0, day: "2026-09-05", ...(city ? { anchors: { city } } : {}) });

  it("groups by (question, city), hottest pair first, and skips additions with no city", () => {
    const adds = new Map<string, SampleAddition[]>([
      ["qa", [add("u1", "Oslo, NO"), add("u2", "Oslo, NO"), add("u3", "Bergen, NO"), add("u4"), add("u5", " ")]],
      ["qb", [add("u1", "Oslo, NO")]],
    ]);
    const pairs = citySampleAdditions(adds);
    expect(pairs.map((p) => [p.qid, p.city, p.adds.length])).toEqual([
      ["qa", "Oslo, NO", 2],
      ["qa", "Bergen, NO", 1],
      ["qb", "Oslo, NO", 1],
    ]);
  });

  it("cuts to the night's budget, and the budget is a real number", () => {
    const adds = new Map<string, SampleAddition[]>([["qa", [add("u1", "A"), add("u2", "B"), add("u3", "B"), add("u4", "C")]]]);
    expect(citySampleAdditions(adds, 2).map((p) => p.city)).toEqual(["B", "A"]);
    expect(citySampleAdditions(adds, 0)).toEqual([]);
    expect(CITY_SAMPLE_PAIRS_PER_NIGHT).toBeGreaterThanOrEqual(10_000);
  });

  it("names documents the device can build: a URI-encoded chip after a tilde, apart from the world prefix", () => {
    expect(worldSampleId("daily-000")).toBe("sample-daily-000");
    expect(citySampleId("daily-000", "Oslo, NO")).toBe("city-daily-000~Oslo%2C%20NO");
    expect(citySampleId("q", "a/b")).not.toContain("/");
    // the erasure arm's id range for world samples must not reach a city document
    expect("city-x~y" < "sample-").toBe(true);
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
