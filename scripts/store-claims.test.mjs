// store-claims.test.mjs — the sentences the store filing makes about
// controls the app either has or does not have.
//
// WHY THIS EXISTS. `design/store/app-privacy.json` is an ATTESTATION: its
// own `$comment` says so, and an operator transcribes it into App Store
// Connect. Beside every machine-readable row it carries a `$why` in prose,
// and that prose is what a future reviewer checks the row against.
// `check:store-forms` deliberately does not read it — the file says so at
// its own rule 6 — so it is the one column that can go quietly false.
//
// It did. The Crash Data row said "On by default with an opt-out in the
// privacy panel (D76)" long after D211 removed the toggle. Three other
// surfaces had it right — the privacy panel's own comment ("the toggle is
// gone and reporting is on"), web/privacy.html ("there is no in-app
// switch") and docs/STORE-FORMS.md ("the in-app switch left at D211") — so
// the file that is an attestation was the only one that was wrong.
//
// ONE CLAIM, NOT A CLASS, and that is deliberate. The general rule — no
// `$why` may promise a control the app does not render — needs a reliable
// reading of which rows the privacy panel draws, and the panel is JSX with
// its rows built from several sources. A pin that could be satisfied by a
// bad parse would be worse than this one. If a second claim goes stale the
// same way, add it here rather than generalising on a guess.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => readFileSync(join(root, ...p), "utf8");

const filing = JSON.parse(read("design", "store", "app-privacy.json"));
const crash = (filing.collected ?? filing.dataTypes ?? [])
  .find((r) => r.type === "CRASH_DATA" || r.category === "DIAGNOSTICS");

describe("crash reporting: four surfaces, one claim", () => {
  it("finds the row at all — vacuous otherwise", () => {
    expect(crash, "no CRASH_DATA row in app-privacy.json — has the file's shape changed?").toBeTruthy();
    expect(typeof crash.$why, "the CRASH_DATA row lost its $why, which is the thing this file is about").toBe("string");
  });

  it("the app really has no crash toggle", () => {
    // The ground truth the other three describe. Asserted first so a case
    // below cannot pass by agreeing with a panel that quietly grew one
    // back — at which point every sentence here needs rewriting, not this
    // rule relaxing.
    const panel = read("src", "v2", "ui", "LivePrivacyPanel.tsx");
    expect(panel, "the privacy panel no longer says the crash toggle is gone — if it came back, these claims all need rewriting")
      .toMatch(/Crash reports — the toggle is gone/);
  });

  it("the attestation does not promise one", () => {
    expect(crash.$why, "app-privacy.json promises an in-app crash opt-out again — the toggle went at D211")
      .not.toMatch(/opt-out in the privacy panel|toggle|switch it off|turn it off/i);
    // …and it still says the honest half, which is what makes the row
    // defensible rather than merely silent: a choice recorded before the
    // toggle was removed is still obeyed.
    expect(crash.$why, "app-privacy.json no longer records that an older build's opt-out is still honoured")
      .toMatch(/still honoured/i);
  });

  it("the page and the runbook agree with it", () => {
    expect(read("web", "privacy.html"), "web/privacy.html no longer states there is no in-app crash switch")
      .toMatch(/there is no in-app switch/i);
    expect(read("docs", "STORE-FORMS.md"), "docs/STORE-FORMS.md no longer records that the crash switch left at D211")
      .toMatch(/in-app switch left at D211/i);
  });
});
