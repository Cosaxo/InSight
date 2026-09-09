// The pages a buyer lands on after paying, and the promise each one makes.
//
// Stripe's success_url is where commerce hands the buyer back (D313).
// From D315 to D375 there were two products and two pages, because the
// question's page — your question is going live, it starts serving
// tomorrow, everything it collects lands in Asked by you, the unserved
// part refunds at close — was false of an ad in every sentence, and for a
// while both products landed on it. D375 retired the ad lane; there is
// one product and one page again, and what this file pins is that the
// page still says the things that are true of a question, and that every
// url the checkout hands Stripe is a file this repo ships. A typo in
// either is a 404 after a successful payment — the worst place in the
// app to find one.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PAID = readFileSync(join(root, "functions", "src", "paid.ts"), "utf8");

/** Every checkout landing url in paid.ts, as its `web/` filename. */
const landingPages = () => [...PAID.matchAll(/https:\/\/[a-z0-9.-]+\/(paid-[a-z-]+\.html)/g)]
  .map((m) => m[1]);

describe("the checkout's landing pages", () => {
  const pages = landingPages();

  it("names a success page and a cancel page", () => {
    expect(pages.length, "no landing urls found — the regex or the urls moved").toBeGreaterThanOrEqual(2);
    expect(pages).toContain("paid-done.html");
    expect(pages).toContain("paid-cancel.html");
  });

  it("ships every page it sends a paying buyer to", () => {
    for (const p of pages) {
      expect(existsSync(join(root, "web", p)), `paid.ts sends a paid buyer to web/${p}, which does not exist`).toBe(true);
    }
  });

  it("no longer ships or names the ad's landing page (D375)", () => {
    expect(pages).not.toContain("paid-done-ad.html");
    expect(existsSync(join(root, "web", "paid-done-ad.html")), "web/paid-done-ad.html is back — the ad lane is retired").toBe(false);
  });

  it("tells a QUESTION buyer the things that are true of a question", () => {
    const q = readFileSync(join(root, "web", "paid-done.html"), "utf8");
    expect(q).toMatch(/refunds? to your card/i);
    expect(q).toMatch(/Asked&nbsp;by&nbsp;you|Asked by you/i);
  });
});
