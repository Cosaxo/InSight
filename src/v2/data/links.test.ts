// The parser is the security boundary of the invite link: whatever it
// returns gets prefilled into a join form, so it must accept exactly the
// server's code shape and nothing else — however the URL was mangled in
// transit by a chat app, a QR scanner, or a hostile hand.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { inviteLinkFor, parseJoinCode, resultsLinkFor } from "./links";

describe("resultsLinkFor — the results page's address (D379)", () => {
  it("is the site's /q/{qid} rewrite, the id escaped", () => {
    expect(resultsLinkFor("paidq-abc_1")).toBe("https://prvfire33.web.app/q/paidq-abc_1");
    expect(resultsLinkFor("a b")).toBe("https://prvfire33.web.app/q/a%20b");
  });
});

describe("parseJoinCode", () => {
  it("round-trips the link the app itself shares", () => {
    expect(parseJoinCode(inviteLinkFor("ABCD2345"))).toBe("ABCD2345");
  });

  it("accepts the shapes a join URL arrives in", () => {
    expect(parseJoinCode("https://prvfire33.web.app/join/QRSTUVWX")).toBe("QRSTUVWX");
    expect(parseJoinCode("https://prvfire33.web.app/join.html?c=QRSTUVWX")).toBe("QRSTUVWX");
    expect(parseJoinCode("/join/QRSTUVWX")).toBe("QRSTUVWX"); // relative (web boot)
    expect(parseJoinCode("insight://join/QRSTUVWX")).toBe("QRSTUVWX"); // custom scheme
    expect(parseJoinCode("https://prvfire33.web.app/join/qrstuvwx")).toBe("QRSTUVWX"); // case-folded
    expect(parseJoinCode("https://prvfire33.web.app/join/QRSTUVWX?utm_source=x")).toBe("QRSTUVWX");
  });

  it("rejects everything that is not a code", () => {
    expect(parseJoinCode("https://prvfire33.web.app/")).toBeNull();
    expect(parseJoinCode("https://prvfire33.web.app/privacy.html")).toBeNull();
    expect(parseJoinCode("https://prvfire33.web.app/join/")).toBeNull();
    // charset: 0/O/1/I/L are never minted (CODE_ALPHABET)
    expect(parseJoinCode("https://prvfire33.web.app/join/ABCD01IL")).toBeNull();
    // length bounds
    expect(parseJoinCode("https://prvfire33.web.app/join/ABC")).toBeNull();
    expect(parseJoinCode("https://prvfire33.web.app/join/" + "A".repeat(13))).toBeNull();
    // injection-shaped garbage stays out of the form
    expect(parseJoinCode("https://prvfire33.web.app/join/%3Cscript%3E")).toBeNull();
    expect(parseJoinCode("not a url at all \u0000")).toBeNull();
  });
});

// ── the custom scheme is the route that needs no fingerprint (D238) ──
//
// It was parsed here long before either platform registered it, so these
// pin what web/join.html's one button now depends on. `insight://join/X`
// puts "join" in the HOSTNAME rather than the path, which is why the
// matcher runs over host+path — and is why the Android filter declares
// android:host="join" rather than a pathPrefix.
describe("parseJoinCode · the insight:// scheme", () => {
  it("reads the code out of the authority-plus-path form", () => {
    expect(parseJoinCode("insight://join/ABCD2345")).toBe("ABCD2345");
  });

  it("folds case, the way a typed or forwarded link arrives", () => {
    expect(parseJoinCode("insight://join/abcd2345")).toBe("ABCD2345");
  });

  it("refuses a scheme URL whose token is not a code", () => {
    // The alphabet excludes 0/O/1/I/L, so these are mistyped or hostile
    // rather than merely unknown — and a token the app would refuse is
    // better refused before it becomes a callable round trip.
    expect(parseJoinCode("insight://join/ABC0O1IL")).toBeNull();
    expect(parseJoinCode("insight://join/")).toBeNull();
    expect(parseJoinCode("insight://somethingelse/ABCD2345")).toBeNull();
  });
});

// ── a malformed escape is a bad link, not an exception ──
//
// The `new URL` guard above catches half of this class; the decode two
// lines under it was outside the try and raised URIError instead of
// returning the null the contract promises. `apply()` in initDeepLinks
// calls straight into the parser, so on the native appUrlOpen path the
// throw escaped into Capacitor's listener: no invite, no message.
describe("parseJoinCode · a malformed percent-escape", () => {
  it("returns null instead of throwing, on every shape the parser accepts", () => {
    for (const url of [
      "insight://join/AB%ZZ",
      "https://prvfire33.web.app/join/100%",
      "https://prvfire33.web.app/join/ABCDEF%",
      "https://prvfire33.web.app/join.html?c=AB%ZZ",
    ]) {
      expect(() => parseJoinCode(url), url).not.toThrow();
      expect(parseJoinCode(url), url).toBeNull();
    }
  });

  it("still decodes a well-formed escape, so the guard did not delete the decode", () => {
    // The half that makes the try the fix rather than dropping the call.
    expect(parseJoinCode("https://prvfire33.web.app/join/%41%42%43%44%45%46")).toBe("ABCDEF");
  });
});

// ── the fallback page, which duplicates the parser on purpose ──
//
// web/join.html ships as static HTML with no bundler — there is no graph
// to import the real parser through, which is why it carries its own copy
// and a comment saying to keep the two in step. Nothing kept them: the
// same unguarded decode was there, and it runs BEFORE the page reads its
// own elements, so a malformed link killed the whole IIFE and left the
// default copy with no button and no explanation.
//
// Run as source with `location` and `document` handed in as parameters —
// the only three globals the IIFE touches — because the alternative is
// asserting on the file's text, which cannot tell you what it does.
const PAGE = readFileSync(join(process.cwd(), "web/join.html"), "utf8");
const SCRIPT = /<script>([\s\S]*?)<\/script>/.exec(PAGE)?.[1] ?? "";

function runJoinPage(url: string) {
  const u = new URL(url);
  const h1 = { textContent: "" };
  const lead = { textContent: "" };
  const open = { href: "", hidden: true };
  const note = { hidden: true };
  const doc = {
    querySelector: () => h1,
    getElementById: (id: string) => (id === "open" ? open : id === "note" ? note : lead),
  };
  // The point is to run the SHIPPED source rather than a copy of it, which
  // is the only way a duplicated parser can be held to the real one.
  new Function("location", "document", "URLSearchParams", SCRIPT)(
    { pathname: u.pathname, search: u.search }, doc, URLSearchParams);
  return { h1, lead, open, note };
}

describe("web/join.html · the copy of the parser", () => {
  it("has a script to run — otherwise every case below is vacuous", () => {
    expect(SCRIPT.length).toBeGreaterThan(200);
  });

  it("opens the app for a good code", () => {
    const r = runJoinPage("https://prvfire33.web.app/join/ABCD2345");
    expect(r.open.href).toBe("insight://join/ABCD2345");
    expect(r.open.hidden).toBe(false);
  });

  it("says the link is incomplete for a malformed escape instead of dying", () => {
    const r = runJoinPage("https://prvfire33.web.app/join/ABCDEF%");
    expect(r.h1.textContent, "the page kept its default copy — the script threw").toBe("That link is incomplete");
    expect(r.open.hidden, "a broken link still offered to open the app").toBe(true);
  });

  it("agrees with the real parser on every case above", () => {
    for (const u of ["https://prvfire33.web.app/join/ABCD2345", "https://prvfire33.web.app/join/ABCDEF%",
      "https://prvfire33.web.app/join/ABCD01IL", "https://prvfire33.web.app/join.html?c=QRSTUVWX"]) {
      const code = parseJoinCode(u);
      const r = runJoinPage(u);
      expect(r.open.hidden, u).toBe(code == null);
      if (code != null) expect(r.open.href, u).toBe("insight://join/" + code);
    }
  });

  it("the CSP hash in firebase.json matches the script it is for", () => {
    // NOTHING ELSE IN THE TREE CHECKS THIS PAIR, and a stale hash fails
    // silently: the browser blocks the one script that renders the "Open
    // in InSight" button, so the page still loads and simply does nothing.
    // Editing the script above without this line is the whole failure.
    //
    // Comparing the SOURCE file is the right comparison, and that is a fact
    // rather than an assumption: firebase.json's `"public": "web"` serves
    // this directory verbatim — there is no build step for it and no
    // dist/join.html — so the bytes hashed here are the bytes the browser
    // hashes. If that ever changes, this case has to hash the built copy
    // instead, and it will go red rather than quiet.
    const want = "sha256-" + createHash("sha256").update(SCRIPT, "utf8").digest("base64");
    const fb = readFileSync(join(process.cwd(), "firebase.json"), "utf8");
    expect(fb, "join.html's inline script changed and firebase.json's script-src hash did not")
      .toContain(want);
  });
});
