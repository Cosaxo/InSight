// check-icons.test.mjs — pins the icon lock's comparison.
//
// The gate exists because D324 found the app icon on no gate's path, and
// every failure it guards is silent by construction: a stale icon renders
// fine, installs fine, and only a person who remembers the mark would
// notice. The comparison is pure so these can hold it without Chromium,
// which is also why the gate itself never renders anything.
import { describe, it, expect } from "vitest";
import { iconLockProblems } from "./check-icons.mjs";

const IOS = "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png";
const XML = '<color name="ic_launcher_background">#1D1914</color>';

function fixture() {
  const outputs = { [IOS]: "ios-hash" };
  for (let i = 0; i < 15; i++) outputs[`android/mipmap-${i}.png`] = `a${i}`;
  const lock = { source: "src-hash", script: "script-hash", ink: "#1d1914", outputs };
  const state = {
    sourceHash: "src-hash",
    scriptHash: "script-hash",
    outputHashes: { ...outputs },
    backgroundXml: XML,
  };
  return { lock, state };
}

describe("iconLockProblems", () => {
  it("is silent when the tree matches the lock", () => {
    const { lock, state } = fixture();
    expect(iconLockProblems(lock, state)).toEqual([]);
  });

  it("demands a lock at all", () => {
    const { state } = fixture();
    expect(iconLockProblems(null, state)).toHaveLength(1);
    expect(iconLockProblems(null, state)[0]).toMatch(/gen-icons/);
  });

  it("flags a changed mark — the stale-icon case D324 describes", () => {
    const { lock, state } = fixture();
    state.sourceHash = "new-mark";
    expect(iconLockProblems(lock, state).some((p) => p.includes("mark.svg changed"))).toBe(true);
  });

  it("flags a changed builder", () => {
    const { lock, state } = fixture();
    state.scriptHash = "new-script";
    expect(iconLockProblems(lock, state).some((p) => p.includes("gen-icons.mjs changed"))).toBe(true);
  });

  it("flags a hand-touched output, and a deleted one", () => {
    const { lock, state } = fixture();
    state.outputHashes[IOS] = "edited";
    state.outputHashes["android/mipmap-3.png"] = null;
    const problems = iconLockProblems(lock, state);
    expect(problems.some((p) => p.includes(IOS) && p.includes("differs"))).toBe(true);
    expect(problems.some((p) => p.includes("mipmap-3") && p.includes("deleted"))).toBe(true);
  });

  it("refuses vacuity: a lock that stopped covering the iOS marketing icon fails green hashes", () => {
    const { lock, state } = fixture();
    delete lock.outputs[IOS];
    expect(iconLockProblems(lock, state).some((p) => p.includes("D324"))).toBe(true);
  });

  it("holds the INK coupling to ic_launcher_background.xml, case-insensitively", () => {
    const { lock, state } = fixture();
    expect(iconLockProblems(lock, state)).toEqual([]); // #1D1914 vs #1d1914 already differ by case
    state.backgroundXml = '<color name="ic_launcher_background">#FAF9F2</color>';
    expect(iconLockProblems(lock, state).some((p) => p.includes("two different grounds"))).toBe(true);
    state.backgroundXml = "<resources></resources>";
    expect(iconLockProblems(lock, state).some((p) => p.includes("no ic_launcher_background"))).toBe(true);
  });
});
