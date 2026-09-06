// production-reader.test.mjs — the reader that replaced a scheduled session.
//
// What this suite is FOR: the reader's whole value is that an absence
// announces itself. A renderer that quietly prints a healthy-looking page
// when the probe never ran, or when a signal has been zero for a week, is
// D296 committed a second time with a fresh timestamp — so every case here
// is an absence, a zero, or a staleness, and the last one pins the
// invariant that the one-line summary can never disagree with the sections
// above it.

import { describe, it, expect } from "vitest";
import { render, parseTrail } from "./production-reader.mjs";

const TODAY = "2026-09-03";

const okRun = (day = TODAY, name = "observe") => ({
  status: "completed",
  conclusion: "success",
  created_at: `${day}T06:11:00Z`,
  html_url: `https://github.com/Cosaxo/InSight/actions/runs/${name}`,
});

const observePayload = (over = {}) => ({
  project: "prvfire33",
  reachable: ["alertPolicies", "logMetrics", "functions", "billing"],
  blocked: [],
  readings: {
    alertPolicies: { name: "alertPolicies", status: "ok", armed: true, committed: 9, liveCount: 9, enabledCount: 9, missing: [] },
    logMetrics: { name: "logMetrics", status: "ok", count: 4 },
    functions: { name: "functions", status: "ok", count: 42, byRegion: { "europe-west1": 42 }, strayCount: 0, canonicalRegion: "europe-west1" },
    billing: { name: "billing", status: "ok", enabled: true, account: "billingAccounts/X" },
  },
  ...over,
});

// A moving trail: three rows where the live signals differ, so nothing is
// "unchanged" and nothing is zero.
const healthyTrail = [
  { on: "2026-09-01", runwayDays: 99, functionsAlerted: 5, functionCount: 42, scorecardAgeDays: 1, totalQuestions: 700, unpromoted: 0, dau: 3, answersCounted: 40, measuredActives: 2, retD7: 0.2, revenueUsd: 1 },
  { on: "2026-09-02", runwayDays: 98, functionsAlerted: 5, functionCount: 42, scorecardAgeDays: 2, totalQuestions: 758, unpromoted: 0, dau: 4, answersCounted: 42, measuredActives: 3, retD7: 0.25, revenueUsd: 2 },
  { on: TODAY, runwayDays: 97, functionsAlerted: 5, functionCount: 42, scorecardAgeDays: 0, totalQuestions: 831, unpromoted: 8, dau: 5, answersCounted: 59, measuredActives: 4, retD7: 0.3, revenueUsd: 3 },
].map((r) => JSON.stringify(r)).join("\n");

const flagCount = (md) => {
  const m = /\*\*(\d+) thing\(s\) to look at:\*\*/.exec(md);
  return m ? Number(m[1]) : 0;
};

describe("the healthy page", () => {
  it("says there is nothing to look at only when every reading is present, non-zero and moving", () => {
    const md = render({
      observe: observePayload(),
      observeRun: okRun(),
      pulseRun: okRun(TODAY, "pulse"),
      trail: healthyTrail,
      today: TODAY,
    });
    expect(md).toContain("Nothing to look at");
    expect(md).toContain("all 9 committed policies armed");
    expect(md).toContain("**42 deployed**");
    expect(md).toContain("**97 days**");
  });
});

describe("an absence is the headline", () => {
  it("names a probe that has no run at all", () => {
    const md = render({ observeRun: null, trail: healthyTrail, today: TODAY });
    expect(md).toContain("**Headline: the observe probe has no run.**");
    expect(md).toContain("no run found");
  });

  it("names a probe that ran and failed", () => {
    const md = render({
      observeRun: { status: "completed", conclusion: "failure", created_at: `${TODAY}T06:11:00Z` },
      trail: healthyTrail,
      today: TODAY,
    });
    expect(md).toContain("did not succeed");
    expect(md).toContain("**failure**");
  });

  it("names a probe whose newest run is not today", () => {
    const md = render({ observe: observePayload(), observeRun: okRun("2026-08-30"), trail: healthyTrail, today: TODAY });
    expect(md).toContain("newest observe run is from 2026-08-30, not today");
  });

  it("names a green probe that published no machine-readable reading", () => {
    const md = render({ observe: null, observeRun: okRun(), trail: healthyTrail, today: TODAY });
    expect(md).toContain("published no machine-readable reading");
    expect(md).toContain("observe-json");
  });

  it("names an empty trail rather than drawing an empty section", () => {
    const md = render({ observe: observePayload(), observeRun: okRun(), trail: "", today: TODAY });
    expect(md).toContain("**No trail rows.**");
    expect(flagCount(md)).toBeGreaterThan(0);
  });

  it("names a trail whose newest row is not today", () => {
    const md = render({ observe: observePayload(), observeRun: okRun(), trail: healthyTrail, today: "2026-09-05" });
    expect(md).toContain("newest trail row is 2026-09-03, not today");
  });
});

describe("a refusal is a result, and it is named", () => {
  it("reports a refused alert-policy reading with its reason", () => {
    const p = observePayload();
    p.readings.alertPolicies = { name: "alertPolicies", status: "denied", why: "grant roles/monitoring.viewer", http: 403 };
    p.blocked = [{ name: "alertPolicies", why: "grant roles/monitoring.viewer", http: 403 }];
    const md = render({ observe: p, observeRun: okRun(), trail: healthyTrail, today: TODAY });
    expect(md).toContain("**Alert policies: refused**");
    expect(md).toContain("roles/monitoring.viewer");
    expect(md).toContain("(403)");
  });

  it("reports unarmed policies with their names — runbook 5.5 undone", () => {
    const p = observePayload();
    p.readings.alertPolicies = { name: "alertPolicies", status: "ok", armed: false, committed: 9, liveCount: 7, enabledCount: 7, missing: ["digestEngagementV2-silent", "fitPatternsV2-silent"] };
    const md = render({ observe: p, observeRun: okRun(), trail: healthyTrail, today: TODAY });
    expect(md).toContain("2 of 9 committed policies NOT armed");
    expect(md).toContain("digestEngagementV2-silent");
  });

  it("reports functions outside the canonical region", () => {
    const p = observePayload();
    p.readings.functions = { name: "functions", status: "ok", count: 44, byRegion: { "europe-west1": 42, "us-central1": 2 }, strayCount: 2, canonicalRegion: "europe-west1" };
    const md = render({ observe: p, observeRun: okRun(), trail: healthyTrail, today: TODAY });
    expect(md).toContain("**2 outside europe-west1**");
  });

  it("names a blocked reading the three headline sections do not cover", () => {
    const p = observePayload();
    p.blocked = [{ name: "logMetrics", why: "grant roles/logging.viewer", http: 403 }];
    const md = render({ observe: p, observeRun: okRun(), trail: healthyTrail, today: TODAY });
    expect(md).toContain("**logMetrics: refused**");
  });
});

describe("the D296 sweep — zero, absent, unchanged", () => {
  const flat = [
    { on: "2026-09-01", runwayDays: 99, dau: 0, answersCounted: 42, measuredActives: 2, retD7: null, revenueUsd: 0 },
    { on: "2026-09-02", runwayDays: 98, dau: 0, answersCounted: 42, measuredActives: 2, retD7: null, revenueUsd: 0 },
    { on: TODAY, runwayDays: 97, dau: 0, answersCounted: 42, measuredActives: 2, retD7: null, revenueUsd: 0 },
  ].map((r) => JSON.stringify(r)).join("\n");

  it("calls a zero a zero, an absence an absence, and a flat line unchanged", () => {
    const md = render({ observe: observePayload(), observeRun: okRun(), trail: flat, today: TODAY });
    expect(md).toContain("daily actives: **0** — zero, unchanged across 3 rows");
    expect(md).toContain("D7 retention: **absent** — absent, unchanged across 3 rows");
    expect(md).toContain("answers counted: **42** — unchanged across 3 rows");
  });

  it("does not cry 'unchanged' on fewer than three rows — the contract says more than two days", () => {
    const two = flat.split("\n").slice(0, 2).join("\n");
    const md = render({ observe: observePayload(), observeRun: okRun(), trail: two, today: "2026-09-02" });
    expect(md).not.toContain("unchanged across");
    // The zero is still a zero on day one.
    expect(md).toContain("daily actives: **0** — zero");
  });

  it("flags a runway under thirty days and a stale scorecard", () => {
    const tight = [{ on: TODAY, runwayDays: 12, scorecardAgeDays: 30, functionsAlerted: 5, functionCount: 42, dau: 1, answersCounted: 1, measuredActives: 1, retD7: 0.1, revenueUsd: 1 }]
      .map((r) => JSON.stringify(r)).join("\n");
    const md = render({ observe: observePayload(), observeRun: okRun(), trail: tight, today: TODAY });
    expect(md).toContain("**12 days** — **under 30**");
    expect(md).toContain("**30 day(s)** — **stale**");
  });
});

describe("the trail parser", () => {
  it("skips a half-written row instead of going silent about the rest", () => {
    const rows = parseTrail('{"on":"2026-09-01"}\n{"on":"2026-09-0\n{"on":"2026-09-03"}\n');
    expect(rows.map((r) => r.on)).toEqual(["2026-09-01", "2026-09-03"]);
  });

  it("treats an empty or missing trail as no rows, not a crash", () => {
    expect(parseTrail("")).toEqual([]);
    expect(parseTrail(undefined)).toEqual([]);
  });
});

describe("the one-line summary cannot disagree with the page", () => {
  it("counts exactly the things the sections flagged", () => {
    const p = observePayload();
    p.readings.billing = { name: "billing", status: "ok", enabled: false, account: null };
    p.readings.functions = { name: "functions", status: "ok", count: 44, byRegion: { "europe-west1": 42, "us-central1": 2 }, strayCount: 2, canonicalRegion: "europe-west1" };
    const flat = [
      { on: "2026-09-01", runwayDays: 99, dau: 0, answersCounted: 1, measuredActives: 1, retD7: 0.1, revenueUsd: 1 },
      { on: "2026-09-02", runwayDays: 98, dau: 0, answersCounted: 2, measuredActives: 2, retD7: 0.2, revenueUsd: 2 },
      { on: TODAY, runwayDays: 97, dau: 0, answersCounted: 3, measuredActives: 3, retD7: 0.3, revenueUsd: 3 },
    ].map((r) => JSON.stringify(r)).join("\n");

    const md = render({ observe: p, observeRun: okRun(), pulseRun: okRun(TODAY, "pulse"), trail: flat, today: TODAY });
    // billing disabled + strays + dau zero-and-unchanged = three.
    expect(flagCount(md)).toBe(3);
    expect(md).toContain("billing reports disabled");
    expect(md).toContain("functions are outside europe-west1");
    expect(md).toContain("daily actives is zero and unchanged across 3 rows");
  });

  it("flags a pulse run that is not green", () => {
    const md = render({
      observe: observePayload(),
      observeRun: okRun(),
      pulseRun: { status: "completed", conclusion: "failure", created_at: `${TODAY}T06:00:00Z` },
      trail: healthyTrail,
      today: TODAY,
    });
    expect(md).toContain("the pulse run is not green");
    expect(flagCount(md)).toBe(1);
  });
});
