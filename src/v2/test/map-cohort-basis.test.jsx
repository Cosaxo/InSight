// @vitest-environment jsdom
//
// "100% · YOU'RE WITH THE MAJORITY" OVER A CROWD OF ONE.
//
// `MapStats.cohortN` was written so this could not happen. D99 added it
// "so the Map can say 'of 6'", and docs/MIRROR.md §509 says it exists "so
// a 50% drawn from two people is not presented as a finding". Then
// `grep -rn cohortN src/` found its definition, its entry in the published
// object, and NO CALL SITE — in `spec/` or `ui/`, ever. `typicality()` has
// no floor of its own, so one answer published as a percentage.
//
// One answer is normally the reader's own: a vote is folded with its
// anchors snapshot, so it lands in the reader's own age cell. On the You
// stop — the one Mirror stop that wears no Preview tag — that read "100% ·
// You're with the majority · of people your age chose the same", over a
// full-width bar, about nobody.
//
// `check:globals` rule 5 cannot see this class: `cohortN` is a MEMBER of a
// published object, not a global of its own, so "nothing reads it" is
// invisible to the scanner. That is why this file asserts on the rendered
// card rather than on the export.
//
// The stub goes through the MODULE, not through `window` — map-group-stats.js
// does `import LIVE from '../data/live'`, the D280 trap CLAUDE.md names and
// the one map-live-qid.test.jsx fell into first.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

vi.setConfig({ testTimeout: 15000 });

const STUB = vi.hoisted(() => ({ live: null }));
vi.mock("../data/live", async (importOriginal) => {
  const real = await importOriginal();
  return { get default() { return STUB.live ?? real.default; } };
});

const QID = "daily-cohort-probe";
let MapStats;
let realLive;

beforeAll(async () => {
  const specIndex = await import("../spec-index.js");
  await specIndex.loadWorldFeed();
  await specIndex.loadMapTab();
  MapStats = window.MapStats;
  realLive = window.LIVE;
});

afterEach(() => {
  window.LIVE = realLive;
  STUB.live = null;
  cleanup();
});

/**
 * A live store whose age cell holds exactly `inCell` answers, all of them
 * on option 0 — so the reading is 100% either way and only the DENOMINATOR
 * separates the two cases.
 */
function installCell(inCell) {
  const agg = {
    total: 900,
    counts: { 0: 700, 1: 200 },
    by: { ageBand: { "25-34": { 0: inCell } } },
  };
  STUB.live = {
    enabled: true,
    ready: true,
    dailyBank: () => [{ id: QID, prompt: "Probe?" }],
    confirmedVotes: () => ({ [QID]: 0 }),
    myVotes: () => ({ [QID]: 0 }),
    aggFor: (qid) => (qid === QID ? agg : null),
    anchors: () => ({ ageBand: "25-34" }),
  };
  window.LIVE = STUB.live;
  window.dispatchEvent(new Event("insight-live-update"));
}

const card = (inCell) => {
  installCell(inCell);
  const Card = window.MTAnswerCard;
  expect(Card, "MTAnswerCard is not published — this file lost its target").toBeTruthy();
  const node = { id: "n1", qid: QID, aidx: 0, qtype: "binary", opts: ["Know", "Be known"], prompt: "Probe?", note: null };
  const anchors = [{ id: "age", value: "25-34" }];
  const { container } = render(
    <Card node={node} cat={null} anchors={anchors} activeA="age" onFilter={() => {}}></Card>,
  );
  return container.textContent || "";
};

describe("the Map's cohort verdict states what it rests on", () => {
  it("refuses to call one answer a majority", () => {
    // The reading is arithmetically 100%. It is also the reader's own vote
    // and nothing else, which is not a finding about anybody.
    const text = card(1);
    expect(text, "a crowd of one was presented as a majority").not.toMatch(/with the majority/i);
    expect(text).toMatch(/only answer here yet/i);
  });

  it("names the number once there is a cohort — the control", () => {
    // Without this, "never draws a verdict" would pass the case above and
    // be a worse bug: the Map's whole reading, gone.
    const text = card(6);
    expect(text).toMatch(/with the majority/i);
    // D146: the basis is IN the sentence, which is the half `cohortN` was
    // added for and the half that had no reader.
    expect(text, "the verdict still does not say how many answers it rests on").toMatch(/6 people your age/);
  });

  it("and cohortN really is what moves it, not the percentage", () => {
    // Both cases above draw a 100% reading — same counts, same option,
    // same anchor. Only the denominator differs, so nothing here can be
    // passing on the share.
    installCell(1);
    expect(MapStats.dist(QID, "age", 2, 0)[0]).toBe(100);
    expect(MapStats.cohortN(QID, "age", 2, 0)).toBe(1);
    installCell(6);
    expect(MapStats.dist(QID, "age", 2, 0)[0]).toBe(100);
    expect(MapStats.cohortN(QID, "age", 2, 0)).toBe(6);
  });
});

// ── THE OTHER HALF OF THE SAME DEFECT, one component down in the same file ──
//
// The fix above reached `MTVerdict`, which is the ANSWER card's reading.
// `MTAnchorCard` — the anchor card's match headline, the big "N% of your
// answers match people your age" with a bar under it — computes its own
// percentage from `MapStats.mode()` and never asks `cohortN` at all. Same
// floorless `typicality()` underneath, same You stop, same crowd of one.
//
// `noCohort` in that component is `rows.some((r) => r.gmode == null)`, which
// catches a cohort that is EMPTY. It cannot catch one that is THIN, because
// a cell holding a single answer returns a perfectly good mode — normally
// the reader's own vote, folded into the reader's own age cell.
const anchorCard = (inCell) => {
  installCell(inCell);
  const Card = window.MTAnchorCard;
  expect(Card, "MTAnchorCard is not published — this file lost its target").toBeTruthy();
  const items = [{ id: "n1", qid: QID, aidx: 0, qtype: "binary", opts: ["Know", "Be known"], prompt: "Probe?", note: null, daily: true }];
  const anchor = { id: "age", value: "25-34", hue: 200, label: "Age" };
  const { container } = render(
    <Card anchor={anchor} items={items} onPick={() => {}} anchors={[anchor]} onAnchor={null}></Card>,
  );
  return container.textContent || "";
};

describe("the Map's anchor card states what its match headline rests on", () => {
  it("does not print a match percentage over a cohort of one", () => {
    // Arithmetically 100%, and the 100 is the reader's own vote and nothing
    // else. On the You stop this reads "100% of your answers match people
    // your age" over a full-width bar, about nobody.
    const text = anchorCard(1);
    expect(text, "a crowd of one was presented as a match percentage").not.toMatch(/100% ?of your answers match/i);
  });

  it("still draws the headline once there is a cohort — the control", () => {
    // Without this, "never draws a headline" would satisfy the case above
    // and cost the anchor card its entire reading, which is worse.
    const text = anchorCard(6);
    expect(text, "the control lost the match headline entirely").toMatch(/of your answers match/i);
    expect(text).toMatch(/100%/);
  });

  it("and it is the denominator that moves it, not the share", () => {
    // Both cases draw a 100% reading off the same counts, same option, same
    // anchor. Only the basis differs, so neither case can be passing on the
    // percentage.
    installCell(1);
    expect(MapStats.mode(QID, "age", 2, 0)).toBe(0);
    expect(MapStats.cohortN(QID, "age", 2, 0)).toBe(1);
    installCell(6);
    expect(MapStats.mode(QID, "age", 2, 0)).toBe(0);
    expect(MapStats.cohortN(QID, "age", 2, 0)).toBe(6);
  });
});
