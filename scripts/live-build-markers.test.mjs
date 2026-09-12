// live-build-markers.test.mjs — pins the strings that decide WHICH bundle
// two release-path gates just graded.
//
// check-bundle and check-web-firebase both answer "is dist/ the shipping
// bundle?" from the build output rather than from their own environment
// (2026-08-26), because the environment answer was false whenever the build
// and the check ran in separate steps. The dist/ answer is only as good as
// the strings it looks for, and it fails silently in one direction: if every
// marker were renamed, a live build would be refused (loud), but if a marker
// started appearing in a DEMO build too, a demo bundle would be graded
// against the shipping ceilings with nothing to say so.
//
// So the markers must still be strings this app actually writes, both gates
// must ask through this module rather than keeping a copy, and the "all of
// them" rule must survive — a `.some()` here is the whole bug back.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { EMULATOR_MARKERS, LIVE_MARKERS, emulatorMarkersIn, missingLiveMarkers } from "./live-build-markers.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => readFileSync(join(root, ...p), "utf8");
const RULES = read("firestore.rules");

// Every non-test .ts/.tsx/.js/.jsx under src/, read once.
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

describe("the shipping-bundle markers", () => {
  it("names only strings the app actually writes", () => {
    expect(LIVE_MARKERS.length).toBeGreaterThanOrEqual(2);
    for (const m of LIVE_MARKERS) {
      expect(srcText.includes(m), `check-bundle and check-web-firebase look for "${m}"\n`
        + "in dist/ to decide the bundle is the shipping one, and nothing under src/\n"
        + "writes that string any more. Both gates now refuse every live build.").toBe(true);
    }
  });

  it("names only collections firestore.rules matches", () => {
    // This is what makes the markers durable. A collection with a `match`
    // block is one check:data-inventory holds: it must be a row in
    // docs/data-inventory.md or an exemption carrying its reason, and that
    // gate also refuses an exemption for a name the rules no longer mention.
    // So a rename cannot happen without somebody being shown this list.
    for (const m of LIVE_MARKERS) {
      expect(RULES.includes(`match /${m}/{`), `"${m}" is a live-build marker but has no\n`
        + "match block in firestore.rules, so it is not a name check:data-inventory\n"
        + "holds and nothing stops it being renamed quietly.").toBe(true);
    }
  });

  it("requires all of them, not any", () => {
    expect(missingLiveMarkers(LIVE_MARKERS.join(" "))).toEqual([]);
    // One survivor in a demo bundle must not read as the shipping one.
    for (const m of LIVE_MARKERS) {
      expect(missingLiveMarkers(m).length, `a bundle carrying only "${m}" was treated as live`)
        .toBe(LIVE_MARKERS.length - 1);
    }
    expect(missingLiveMarkers("")).toEqual(LIVE_MARKERS);
  });

  it("is the only copy — both gates ask through it", () => {
    // D197's failure class: a list copied into two scripts is a list that
    // will disagree with itself, and the copy that drifted is the one that
    // reports a number instead of failing.
    for (const gate of ["check-bundle.mjs", "check-web-firebase.mjs"]) {
      const src = read("scripts", gate);
      expect(src, `${gate} no longer imports the shared marker list`)
        .toMatch(/from "\.\/live-build-markers\.mjs"/);
      // Not one marker literal of its own: a private copy is how the two
      // gates come to disagree about what a shipping bundle looks like.
      for (const m of LIVE_MARKERS) {
        expect(src.includes(m), `${gate} names "${m}" itself instead of asking the`
          + " module — the point of the module is that there is one list").toBe(false);
      }
    }
  });
});

// ── the other direction: an EMULATOR bundle must never ship ────────────
//
// check-web-firebase refused `VITE_USE_EMULATOR=true` by reading
// `process.env` — the environment of the process running the CHECK, not of
// the one that ran the BUILD — while its own header says that is not
// enough. Vite reads `.env` and `process.env` does not, and the documented
// local flow is `cp .env.emulator .env`, so the gap needs no mistake to
// reach: a build made that way printed "live config inlined" and exited 0.
describe("emulatorMarkersIn — was this bundle built against the emulator", () => {
  it("finds nothing in a bundle that carries none of them", () => {
    expect(emulatorMarkersIn("const a=1;initializeApp(cfg);getAuth(app);")).toEqual([]);
  });

  it("refuses on ANY one of them, not all — the opposite quantifier to the live markers", () => {
    // The direction that must not happen is an emulator bundle on a phone,
    // so one survivor is enough to refuse. `missingLiveMarkers` requires
    // all three for the opposite reason, and the two must not be confused.
    for (const m of EMULATOR_MARKERS) {
      expect(emulatorMarkersIn(`x;${m};y`), `${m} did not refuse on its own`).toEqual([m]);
    }
  });

  it("names only strings a real emulator build actually writes", () => {
    // The same vacuity check the live markers get above: a marker nothing
    // emits refuses nothing. These three are reached only from the
    // `useEmulator` branch in src/lib/firebaseImpl.ts, which is a
    // build-time constant, so an ordinary build folds them away entirely.
    const impl = readFileSync(resolve(root, "src", "lib", "firebaseImpl.ts"), "utf8");
    for (const m of EMULATOR_MARKERS) {
      expect(impl.includes(m), `nothing in firebaseImpl.ts writes "${m}" — this marker refuses nothing`).toBe(true);
    }
  });
});
