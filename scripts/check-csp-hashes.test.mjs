// check-csp-hashes.test.mjs — the gate that joins a CSP script hash to the
// page it covers.
//
// The property under test is not "does it read JSON". It is that the gate
// fails in both directions, because the outage looks identical from
// either side: a hash pinned for a script that changed, and a script
// added under a policy that pins nothing, both end with the browser
// refusing the script and the page rendering as a form that does nothing.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inlineScripts, cspHash, hashesIn, pagesIn, checkHashes } from "./check-csp-hashes.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

const PAGE = '<!doctype html><body><p>x</p><script>\nvar a = 1;\n</script></body>';
const BODY = inlineScripts(PAGE)[0];
const rule = (source, hashes) => ({
  source,
  headers: [
    { key: "X-Content-Type-Options", value: "nosniff" },
    {
      key: "Content-Security-Policy",
      value: `default-src 'none'; script-src ${hashes.map((h) => `'${h}'`).join(" ")}; style-src 'unsafe-inline'`,
    },
  ],
});
const run = (rules, pages) =>
  checkHashes({
    rules,
    readPage: (p) => pages[p],
    pageExists: (p) => p in pages,
  });

describe("the hash itself", () => {
  it("reproduces the digest already live in production", () => {
    // The strongest case available: join.html's hash was computed by hand
    // and has been serving for weeks, so if this function disagrees with
    // it, this function is wrong. It also pins the detail that gets a
    // hand-computed hash wrong — the bytes are taken between the tags
    // with no trimming.
    const live = read("firebase.json");
    const hash = cspHash(inlineScripts(read("web/join.html"))[0]);
    expect(live).toContain(`'${hash}'`);
  });

  it("changes when one byte of the script changes", () => {
    expect(cspHash("var a = 1;")).not.toBe(cspHash("var a = 2;"));
  });

  it("does not treat a <script src=…> as inline", () => {
    // An external script carries no hash, so counting it would demand a
    // pin for something that cannot have one.
    expect(inlineScripts('<script src="/x.js"></script><script>a</script>')).toEqual(["a"]);
  });
});

describe("reading the config", () => {
  it("takes every sha256 out of a script-src and ignores the rest of the policy", () => {
    expect(hashesIn(rule("/x.html", ["sha256-AAA=", "sha256-BBB="]))).toEqual(["sha256-AAA=", "sha256-BBB="]);
    expect(hashesIn({ headers: [{ key: "Referrer-Policy", value: "no-referrer" }] })).toEqual([]);
  });

  it("reads both spellings firebase.json uses for a page name", () => {
    expect(pagesIn("/ask{.html,}")).toEqual(["ask.html"]);
    expect(pagesIn("/join{.html,/**}")).toEqual(["join.html"]);
    expect(pagesIn("{/,/home.html,/privacy.html}")).toEqual(["home.html", "privacy.html"]);
  });
});

describe("both directions of the outage", () => {
  it("passes when the pinned hash is the page's own", () => {
    expect(run([rule("/x.html", [cspHash(BODY)])], { "x.html": PAGE })).toEqual([]);
  });

  it("catches a hash left behind by an edit to the page", () => {
    const problems = run([rule("/x.html", ["sha256-stale="])], { "x.html": PAGE });
    // One edit is one failure, reported once with the replacement in it —
    // not the same fact twice from each direction, which sends the reader
    // hunting for a second thing to fix.
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("sha256-stale=");
    // The error has to carry the RIGHT hash, or fixing it is a second
    // hand-computation and the same class of mistake.
    expect(problems[0]).toContain(cspHash(BODY));
  });

  it("catches a script added under a policy that pins nothing", () => {
    const noHash = { source: "/x.html", headers: [{ key: "Content-Security-Policy", value: "default-src 'none'" }] };
    expect(run([noHash], { "x.html": PAGE })[0]).toMatch(/pins no hash/);
  });

  it("catches a second script added beside a pinned one", () => {
    const two = PAGE.replace("</body>", "<script>var b = 2;</script></body>");
    const problems = run([rule("/x.html", [cspHash(BODY)])], { "x.html": two });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/not pinned/);
  });

  it("catches a hash whose page was deleted", () => {
    expect(run([rule("/gone.html", ["sha256-orphan="])], {})[0]).toMatch(/no page this rule names exists/);
  });

  it("says nothing about the pages that have no script at all", () => {
    const plain = '<!doctype html><body><p>legal text</p></body>';
    const noScript = { source: "/p.html", headers: [{ key: "Content-Security-Policy", value: "default-src 'none'" }] };
    expect(run([noScript], { "p.html": plain })).toEqual([]);
  });
});

describe("against the committed config", () => {
  it("the tree is green, and that is the assertion", () => {
    const cfg = JSON.parse(read("firebase.json"));
    const hosting = Array.isArray(cfg.hosting) ? cfg.hosting[0] : cfg.hosting;
    const pages = {};
    for (const r of hosting.headers || []) {
      for (const p of pagesIn(r.source)) {
        try {
          pages[p] = read(join(hosting.public || "web", p));
        } catch {
          /* a rule may name a page that does not exist; the gate reports it */
        }
      }
    }
    expect(checkHashes({ rules: hosting.headers, readPage: (p) => pages[p], pageExists: (p) => p in pages })).toEqual([]);
    // And that it is not vacuously green — there are hashes to check.
    expect((hosting.headers || []).reduce((n, r) => n + hashesIn(r).length, 0)).toBeGreaterThan(1);
  });
});
