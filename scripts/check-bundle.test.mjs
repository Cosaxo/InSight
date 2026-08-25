// check-bundle.test.mjs — pins the markers that decide WHICH bundle got graded.
//
// check-bundle answers "is this the shipping bundle?" from dist/ rather
// than from its own environment (2026-08-26), because the environment
// answer was false whenever the build and the check ran in separate steps.
// The dist/ answer is only as good as the strings it looks for, and it
// fails silently in one direction: if every marker were renamed, a live
// build would be refused (loud), but if a marker started appearing in a
// DEMO build too, a demo bundle would be graded against the shipping
// ceilings with nothing to say so.
//
// So: the markers must still be strings this app actually writes. They are
// Firestore collection ids on purpose — each has a `match` block in
// firestore.rules, and check:data-inventory refuses to let such a name go
// undocumented or carry a stale exemption — and these assertions are what
// connects the gate to that fact. Parsed out of the script rather than
// imported, because check-bundle.mjs reads dist/ and exits at import.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = readFileSync(join(root, "scripts", "check-bundle.mjs"), "utf8");

const markers = (() => {
  const m = SRC.match(/const LIVE_MARKERS = \[([^\]]*)\]/);
  if (!m) return null;
  return m[1].split(",").map((s) => s.trim().replace(/^["'`]|["'`]$/g, "")).filter(Boolean);
})();

// Every .ts/.tsx/.js/.jsx under src/, read once.
const srcText = (() => {
  const out = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(t|j)sx?$/.test(e.name) && !/\.test\./.test(e.name)) out.push(readFileSync(p, "utf8"));
    }
  };
  walk(join(root, "src"));
  return out.join("\n");
})();

const RULES = readFileSync(join(root, "firestore.rules"), "utf8");

describe("check-bundle's shipping-bundle markers", () => {
  it("still declares a marker list", () => {
    expect(markers, "LIVE_MARKERS is gone or reshaped — the gate's artifact\n"
      + "claim is no longer parseable, so this test cannot vouch for it").toBeTruthy();
    expect(markers.length).toBeGreaterThanOrEqual(2);
  });

  it("requires ALL of them, not any", () => {
    // `.some()` here would let one accidental survivor in a demo build
    // grade demo numbers against the shipping ceilings — the exact bug
    // this gate exists to refuse.
    expect(SRC).toMatch(/liveMarkersSeen\.length === LIVE_MARKERS\.length/);
  });

  it("names only strings the app actually writes", () => {
    for (const m of markers) {
      expect(srcText.includes(m), `check-bundle looks for "${m}" in dist/ to decide the\n`
        + "bundle is the shipping one, and nothing under src/ writes that string any\n"
        + "more. The gate now refuses every live build, or worse, was already\n"
        + "refusing one for a different reason.").toBe(true);
    }
  });

  it("names only collections firestore.rules matches", () => {
    // This is what makes the markers durable. A collection with a `match`
    // block is one check:data-inventory holds: it must be a row in
    // docs/data-inventory.md or an exemption carrying its reason, and that
    // gate also refuses an exemption for a name the rules no longer
    // mention. So a rename cannot happen without somebody being shown the
    // list these markers are drawn from.
    for (const m of markers) {
      expect(RULES.includes(`match /${m}/{`), `"${m}" is a check-bundle marker but has no\n`
        + "match block in firestore.rules, so it is not a name check:data-inventory\n"
        + "holds and nothing stops it being renamed quietly.").toBe(true);
    }
  });
});
