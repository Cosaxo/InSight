// The pages a buyer lands on after paying, and the promise each one makes.
//
// Stripe's success_url is where commerce hands the buyer back (D313), and
// for a long time it was ONE url for two products. The question's page
// says the buyer's QUESTION is going live, that it starts serving
// TOMORROW, that everything it collects lands in Asked by you, and that
// the unserved part refunds automatically at close. For an ad every one
// of those is false: an ad queues behind the ad running in its scope, it
// asks nothing, and it has no refund path at all (D315). An advertiser
// was told in writing, at the moment of payment, that they were owed a
// refund nothing would ever issue.
//
// Two things are pinned here, and neither is reachable from a unit test
// of the callable: that each product still has its OWN landing page, and
// that every url the checkout hands Stripe is a file this repo ships. A
// typo in either is a 404 after a successful payment — the worst place in
// the app to find one.
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

  it("names at least a success page per product, and a cancel page", () => {
    expect(pages.length, "no landing urls found — the regex or the urls moved").toBeGreaterThanOrEqual(3);
    expect(pages).toContain("paid-done.html");
    expect(pages).toContain("paid-done-ad.html");
    expect(pages).toContain("paid-cancel.html");
  });

  it("ships every page it sends a paying buyer to", () => {
    for (const p of pages) {
      expect(existsSync(join(root, "web", p)), `paid.ts sends a paid buyer to web/${p}, which does not exist`).toBe(true);
    }
  });

  it("chooses the page by the product, not once for both", () => {
    // The defect was a single `success_url:` with no branch. What makes
    // the branch real is that the ad url is reached only when `isAd`.
    const at = PAID.indexOf("success_url:");
    expect(at, "success_url is gone — this file no longer describes the checkout").toBeGreaterThan(-1);
    const clause = PAID.slice(at, at + 260);
    expect(clause, "success_url does not branch — both products land on one page").toMatch(/isAd\s*\n?\s*\?/);
    expect(clause).toContain("paid-done-ad.html");
    expect(clause).toContain("paid-done.html");
  });

  it("does not promise an ad buyer a refund, a question, or answers", () => {
    // The four sentences that were false. Checked as CLAIMS rather than
    // as strings: any rewording that puts them back trips this.
    const ad = readFileSync(join(root, "web", "paid-done-ad.html"), "utf8");
    const body = ad.slice(ad.indexOf("<body"));
    expect(body, "the ad's landing page promises a refund — ads have none (D315)")
      .not.toMatch(/refunds?\s+(to|automatically)/i);
    expect(body, "the ad's landing page calls the purchase a question")
      .not.toMatch(/your\s+question/i);
    expect(body, "the ad's landing page says it starts serving tomorrow — an ad queues")
      .not.toMatch(/serving\s+tomorrow/i);
    expect(body, "the ad's landing page promises collected answers — an ad asks nothing")
      .not.toMatch(/everything it collects/i);
  });

  it("still tells a QUESTION buyer the things that are true of a question", () => {
    // The other half of the split: fixing the ad page must not quietly
    // strip the question page of what it correctly promises.
    const q = readFileSync(join(root, "web", "paid-done.html"), "utf8");
    expect(q).toMatch(/refunds? to your card/i);
    expect(q).toMatch(/Asked&nbsp;by&nbsp;you|Asked by you/i);
  });
});
