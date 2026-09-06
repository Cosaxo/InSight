// The gate that says every page under web/ carries security headers —
// asserted on the half it did not check.
//
// It read `rule.source` and never opened `rule.headers`, so "covered"
// meant NAMED IN SOME RULE, whatever that rule set. firebase.json has a
// third rule that sets only Content-Type, and the whole file had no
// exported function, so nothing here could reach any of it.
import { describe, it, expect } from "vitest";
import { securedPages, ruleIsSecure, REQUIRED } from "./check-web-headers.mjs";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

const SECURE = (source) => ({
  source,
  headers: [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "no-referrer" },
    { key: "Content-Security-Policy", value: "default-src 'none'" },
  ],
});
// firebase.json's real third rule, verbatim in shape.
const CONTENT_TYPE_ONLY = {
  source: "/.well-known/apple-app-site-association",
  headers: [{ key: "Content-Type", value: "application/json" }],
};

describe("the page walk covers the whole served tree", () => {
  // Hosting serves everything under the public dir; the walk read the top
  // level only. Measured before the fix: `web/legal/tos.html` was served
  // with no CSP, no nosniff and no Referrer-Policy, and the gate did not
  // even count it — this gate's own founding failure, one directory down.
  //
  // The walk itself is inside the run guard, so what is held here is the
  // property that makes it correct: the page list is built recursively,
  // and a nested path is matched against a rule by the same name-reading
  // that matches a top-level one.
  it("is recursive", () => {
    const src = readFileSync(resolve(here, "check-web-headers.mjs"), "utf8");
    expect(src, "the page walk stopped being recursive — a page in a subdirectory would be unseen")
      .toMatch(/readdirSync\([\s\S]{0,60}?recursive:\s*true/);
  });

  it("a nested page is only covered when a rule names it", () => {
    // The two halves the recursion feeds: an uncovered nested page is not
    // in the secured set, and one a rule does name is.
    const rule = SECURE("{/,/legal/tos.html}");
    expect(securedPages([rule]).has("legal/tos.html")).toBe(true);
    expect(securedPages([SECURE("{/,/home.html}")]).has("legal/tos.html")).toBe(false);
  });
});

describe("check:web-headers reads the headers, not just the source list", () => {
  it("counts a page in a rule that sets all three", () => {
    // THE CONTROL, first: without it every case below is satisfied by a
    // function that covers nothing, which is the shape this is easiest to
    // get wrong into.
    const covered = securedPages([SECURE("{/,/home.html,/privacy.html}")], "home.html");
    expect(covered.has("home.html")).toBe(true);
    expect(covered.has("privacy.html")).toBe(true);
  });

  it("reads the split spelling — /join{.html,/**} names join.html", () => {
    expect(securedPages([SECURE("/join{.html,/**}")]).has("join.html")).toBe(true);
  });

  it("resolves the site root through the rewrite, not by assuming home.html", () => {
    expect(securedPages([SECURE("{/,/terms.html}")], "start.html").has("start.html")).toBe(true);
    expect(securedPages([SECURE("{/,/terms.html}")], undefined).has("start.html")).toBe(false);
  });

  it("does NOT count a page whose only rule sets Content-Type", () => {
    // Measured on the real tree before the fix: moving delete-account.html
    // — Play's erasure route — into firebase.json's apple-app-site-
    // association rule passed, exit 0, while the page served with no CSP,
    // no nosniff and no Referrer-Policy.
    const rule = { ...CONTENT_TYPE_ONLY, source: "{/.well-known/apple-app-site-association,/delete-account.html}" };
    expect(securedPages([rule]).has("delete-account.html"),
      "a page named in a Content-Type-only rule counted as secured").toBe(false);
  });

  it("does NOT count a page when the header keys are renamed away", () => {
    // The other measured pass: rename all three keys and every page loses
    // every header, with the source lists untouched. Exit 0 before.
    const renamed = {
      source: "{/,/home.html}",
      headers: [
        { key: "X-Whatever", value: "nosniff" },
        { key: "X-Nope", value: "no-referrer" },
        { key: "X-Nothing", value: "default-src 'none'" },
      ],
    };
    expect(securedPages([renamed], "home.html").size,
      "renaming every security header still counted the pages as secured").toBe(0);
  });

  it("requires each of the three, one at a time", () => {
    // Not one case per header by hand: the loop is the assertion, so a
    // fourth required header added later is covered the day it is added.
    for (const missing of REQUIRED) {
      const rule = SECURE("{/,/home.html}");
      rule.headers = rule.headers.filter((h) => h.key !== missing);
      expect(ruleIsSecure(rule), `a rule missing ${missing} read as secure`).toBe(false);
    }
  });

  it("requires nosniff to actually say nosniff", () => {
    // The one header with exactly one valid value, and the one the gate's
    // error text promises by name. A key present with a wrong value is a
    // header that does nothing.
    const rule = SECURE("{/,/home.html}");
    rule.headers[0].value = "sniff-away";
    expect(ruleIsSecure(rule)).toBe(false);
    rule.headers[0].value = "nosniff";
    expect(ruleIsSecure(rule), "the control: nosniff spelled right is secure").toBe(true);
  });

  it("survives a rule with no headers array at all", () => {
    expect(ruleIsSecure({ source: "/x.html" })).toBe(false);
    expect(securedPages([{ source: "/x.html" }]).size).toBe(0);
  });
});
