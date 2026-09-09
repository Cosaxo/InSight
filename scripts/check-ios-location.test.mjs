// check-ios-location.test.mjs — the consent rule's own tripwires.
//
// check:ios-location had NO test file until 2026-09-04, which is how the
// defect below survived a night whose other shift edited this very gate. Its
// other rules read Info.plist and the installed Capacitor plugin's Swift
// sources under node_modules, so they still are not exercised here; what is
// pinned is the one rule that decides whether the prompt iOS shows a person
// before they consent matches what the app actually does.
import { describe, it, expect } from "vitest";
import { locationLoopRuns, nearConsentMismatch } from "./near-consent-rule.mjs";

// The shape of the real thing, cut down: the constant, the prose that names
// it two hundred lines above the timer, the timer, and the location read.
const LIVE = `
// … writes their ~200 m grid cell to v2_presence/{uid} every PRESENCE_BEAT_MS
const PRESENCE_BEAT_MS = 4 * 60_000;
async function presenceBeat() { const c = await locateCell(); }
    nearState.timer = setInterval(() => { void presenceBeat(); }, PRESENCE_BEAT_MS);
`;
const NEAR = "Used to show how many people are Near you, as a ~200 m square.";
const NO_NEAR = "Used once to work out your city on this device.";

const comment = (src) =>
  src.replace(/^(\s*)(nearState\.timer = setInterval)/m, "$1// $2");
const blockComment = (src) =>
  src.replace(/^(\s*)(nearState\.timer = setInterval.*)$/m, "$1/* $2 */");
const remove = (src) => src.replace(/^.*nearState\.timer = setInterval.*$/m, "");

describe("locationLoopRuns", () => {
  it("sees a running loop", () => {
    expect(locationLoopRuns(LIVE)).toBe(true);
  });

  // THE DEFECT. The match is a regex over raw source, so a commented-out
  // timer answered yes to "does the loop run?". Measured on the real tree
  // 2026-09-04: deleting the line failed check:ios-location correctly, and
  // commenting the same line out left it green — the plist could go on
  // promising a Near loop that no longer ran. Commenting a line out is how a
  // feature is parked during a refactor; deleting it is not the common case.
  it("does NOT see a line-commented loop", () => {
    expect(locationLoopRuns(comment(LIVE))).toBe(false);
  });
  it("does NOT see a block-commented loop", () => {
    expect(locationLoopRuns(blockComment(LIVE))).toBe(false);
  });

  it("does not see a deleted loop", () => {
    expect(locationLoopRuns(remove(LIVE))).toBe(false);
  });

  // The reason the rule matches the CALL and not the identifier: the constant
  // and the prose naming it both survive the timer's removal, and a bare name
  // test kept answering "the loop is here".
  it("is not fooled by the constant and the prose that name it", () => {
    const noTimer = remove(LIVE);
    expect(noTimer).toMatch(/PRESENCE_BEAT_MS/);
    expect(locationLoopRuns(noTimer)).toBe(false);
  });

  // Either half alone is not the behaviour the purpose string describes.
  it("needs the location read as well as the timer", () => {
    expect(locationLoopRuns(LIVE.replace("await locateCell()", "0"))).toBe(false);
  });
});

describe("nearConsentMismatch", () => {
  it("agrees when the loop runs and the string says Near", () => {
    expect(nearConsentMismatch(LIVE, NEAR)).toBe(null);
  });
  it("agrees when there is no loop and no claim", () => {
    expect(nearConsentMismatch(remove(LIVE), NO_NEAR)).toBe(null);
  });

  // D107: the string said "used once, on this device" while live.ts re-read
  // location every four minutes.
  it("catches a loop the string does not describe", () => {
    expect(nearConsentMismatch(LIVE, NO_NEAR)).toBe("under");
  });

  // The mirror, and the one the comment defect reached: a string describing a
  // loop that is gone asks for more than the app needs.
  it("catches a claim whose loop is gone", () => {
    expect(nearConsentMismatch(remove(LIVE), NEAR)).toBe("over");
  });

  // The two together are the whole finding: a parked loop must read as
  // over-describing, exactly as a deleted one does.
  it("treats a commented-out loop the same as a deleted one", () => {
    expect(nearConsentMismatch(comment(LIVE), NEAR)).toBe("over");
    expect(nearConsentMismatch(remove(LIVE), NEAR)).toBe("over");
  });

  it("treats a missing purpose string as making no claim", () => {
    expect(nearConsentMismatch(remove(LIVE), undefined)).toBe(null);
    expect(nearConsentMismatch(LIVE, undefined)).toBe("under");
  });
});
