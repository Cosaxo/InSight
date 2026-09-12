// web-doors.test.mjs — can a buyer get to the door at all?
//
// D368 took the purchase funnel out of the app binary and it was right
// to: a call to action inside the app is what store anti-steering rules
// police. STORE-CUT-PLAN.md phase 4 was the other half — "web/home.html
// … becomes where the door is found" — and it was not built, so from
// D368 (2026-09-05) to 2026-09-12 the only address that reached
// web/ask.html was one sentence inside the terms of service.
//
// Nothing could see that. check:web-headers reads header KEYS,
// check:csp-hashes reads script digests, ask-page.test.mjs drives the
// door itself and cannot ask whether anyone can reach it. A page can be
// perfect and unreachable, and every gate stays green.
//
// So this file tests the ROUTES rather than the pages: every surface that
// is allowed to carry the door does, and the two the app links out to
// lead somewhere rather than dead-ending. It deliberately does NOT assert
// anything about the app binary — smoke-live.test.jsx pins the opposite
// there, and that inversion is the property App Review reads the app for.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

// The canonical address. firebase.json rewrites /ask → /ask.html and
// heads both, so either works; one spelling everywhere means a search for
// the door finds every door.
const ASK = 'href="/ask"';

describe("the web door is reachable", () => {
  it("is offered on the site root, which is where the door is found (phase 4)", () => {
    const home = read("web/home.html");
    expect(home, "web/home.html does not link the ask page — phase 4 is unbuilt again").toContain(ASK);
  });

  it("is named on the terms page, which is what the app links to", () => {
    expect(read("web/terms.html")).toContain(ASK);
  });

  it("is offered on a sponsored question's public results page, and on its 404", () => {
    // The one public surface a prospective buyer reads before they have
    // any reason to look for the door. Asserted against the source rather
    // than a render because the render is functions/src/share.test.ts's.
    const share = read("functions/src/share.ts");
    expect(share).toContain(ASK);
    expect(share).toContain("Ask your own question");
  });
});

describe("the pages the app links out to lead somewhere", () => {
  // LivePrivacyPanel.tsx and LiveSignInGate.tsx link these two and
  // nothing else on the web. They are required links and not purchase
  // calls to action, which makes them the one route out of the binary
  // store rules leave alone — worth nothing if they dead-end.
  for (const page of ["web/privacy.html", "web/terms.html"]) {
    it(`${page} links back to the root`, () => {
      expect(read(page), `${page} is a dead end: nothing on it returns to the site`).toContain('href="/"');
    });
  }
});

describe("no page prints a price the card could move under it", () => {
  // content/pricing.json moves (D371's fold publishes over it, and a
  // re-pricing is a PR). web/ask.html prints figures because
  // check:ask-pricing regenerates web/ask-pricing.json from the card;
  // nothing regenerates these, so a figure typed here goes stale silently.
  for (const page of ["web/home.html", "functions/src/share.ts"]) {
    it(`${page} states no euro figure`, () => {
      const body = read(page).replace(/<!--[\s\S]*?-->/g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
      expect(body, `${page} prints a euro figure nothing regenerates`).not.toMatch(/€\s*\d/);
    });
  }
});
