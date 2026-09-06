// @vitest-environment jsdom
// ask-page.test.mjs — the web ask door, driven (D369; the menu, the
// budget, the room and the link joined it at D376–D378).
//
// The page is static and framework-free with one inline script, so the
// only way to test what a buyer reads is to load it the way a browser
// does: the HTML into a document, the script evaluated, the price
// resource answered by a stubbed fetch. What is pinned is what the
// in-app door's smoke cases pinned before it left the binary (D368):
// the committed card prints as the menu's three prices with what each
// buys, a row opens the composer at that budget, the crowding is said as
// room, and the link composes into the quote as its bare domain.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { inlineScripts } from "./check-csp-hashes.mjs";
import { ROOT, TARGET } from "./build-ask-pricing.mjs";

const html = readFileSync(join(ROOT, "web/ask.html"), "utf8");
const pricing = JSON.parse(readFileSync(join(ROOT, TARGET), "utf8"));

async function mount(P = pricing) {
  document.documentElement.innerHTML = html.replace(/<script>[\s\S]*<\/script>/, "");
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => P })));
  // scrollIntoView is not in jsdom; the page calls it on a row tap
  Element.prototype.scrollIntoView = () => {};
  const [body] = inlineScripts(html);
  new Function(body)();
  // the boot fetch resolves on a microtask; two ticks is enough
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
}
const $ = (id) => document.getElementById(id);
const text = () => document.body.textContent.replace(/\s+/g, " ");
const sp = (s) => String(s).replace(/\p{Zs}/gu, " ");

beforeEach(async () => { await mount(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe("the menu (D376)", () => {
  it("prints the committed card as three prices per reach, with what each buys at the line in force", () => {
    const rows = [...document.querySelectorAll("#menu .menu-row")];
    expect(rows.map((r) => r.querySelector(".who").textContent)).toEqual(["Your city", "Your country", "Everyone"]);
    expect(rows.map((r) => r.querySelector(".price").textContent)).toEqual(["€10", "€25", "€50"]);
    // €0.02 a line with nobody in rotation: 500 · 1 250 · 2 500
    expect(rows.map((r) => sp(r.querySelector(".buys").textContent))).toEqual([
      "up to 500 answers · 29 days", "up to 1 250 answers · 29 days", "up to 2 500 answers · 29 days",
    ]);
    // The DENOMINATOR is the claim: the cadence counts ordinary questions,
    // not feed cards, and the feed carries tests, lenses and knowledge
    // cards between them (one in nine or ten of the feed, measured).
    expect($("menuNote").textContent).toMatch(/One paid card after every 6 ordinary questions/);
    expect($("menuNote").textContent, "the old, wrong denominator came back").not.toMatch(/in the feed is paid/);
  });

  it("a row opens the composer on that reach at that budget, the chips still there to adjust", () => {
    // Before: the smallest chip, the city
    expect($("budgets").querySelector('[aria-pressed="true"]').textContent).toBe("€5");
    expect($("budgetHint").textContent).toBe("up to 250 answers · only what arrives is billed");
    [...document.querySelectorAll("#menu .menu-row")][1].click();
    expect($("ruler").getAttribute("aria-valuetext")).toBe("Your country");
    expect($("budgets").querySelector('[aria-pressed="true"]').textContent).toBe("€25");
    expect(sp($("scopeAnswers").textContent)).toBe("1 250");
    expect(sp($("budgetHint").textContent)).toBe("up to 1 250 answers · only what arrives is billed");
    // adjust: the chips are the buyer's
    [...$("budgets").querySelectorAll(".chip")].find((c) => c.textContent === "€50").click();
    expect(sp($("scopeAnswers").textContent)).toBe("2 500");
  });
});

describe("the room (D377)", () => {
  it("says the room while the free places are open, then who is sharing", async () => {
    expect($("scopeRoom").textContent).toBe("room for 3 more");
    expect(text()).not.toMatch(/×1\.0|rises to ×/);
    expect($("flatNote").hidden).toBe(false);
    expect($("flatNote").textContent).toMatch(/3 campaigns in a scope each hold a place/);
    const busy = JSON.parse(JSON.stringify(pricing));
    busy.cohorts[0].index = 1.5; busy.cohorts[0].crowd = Array(14).fill(3);
    busy.cohorts[1].crowd = Array(14).fill(1);
    await mount(busy);
    expect($("scopeRoom").textContent).toBe("3 in rotation · sharing");
    expect([...document.querySelectorAll("#menu .menu-row .room")].map((r) => r.textContent)).toEqual([
      "3 in rotation · sharing", "room for 2 more", "room for 3 more",
    ]);
    // the busy city buys fewer for the same figure: €10 at €0.03
    expect(document.querySelector("#menu .menu-row .buys").textContent).toBe("up to 333 answers · 29 days");
    expect($("flatNote").hidden).toBe(true);
  });
});

describe("the link (D378) and the quote", () => {
  it("composes into the quote as its bare domain, after the answer, and the quote charges the budget", () => {
    $("prompt").value = "Should the harbour bath stay open all winter?";
    $("prompt").dispatchEvent(new Event("input"));
    const opts = document.querySelectorAll("#options input");
    opts[0].value = "Keep it open"; opts[0].dispatchEvent(new Event("input"));
    opts[1].value = "Close for winter"; opts[1].dispatchEvent(new Event("input"));
    $("link").value = "https://www.harboursauna.no/winter";
    $("link").dispatchEvent(new Event("input"));
    expect($("linkHint").textContent).toMatch(/Shows as harboursauna\.no ↗ after the answer/);
    $("quoteBtn").click();
    expect($("panel").hidden).toBe(false);
    expect($("qCap").textContent).toBe("€5");
    expect($("qAnswers").textContent).toBe("up to 250");
    expect($("qLink").hidden).toBe(false);
    expect($("qLink").textContent).toBe("harboursauna.no ↗");
    expect($("refundLine").textContent).toMatch(/charged €5 now/);
    // a non-https address is not a link the page will state
    $("backBtn").click();
    $("link").value = "harboursauna.no";
    $("link").dispatchEvent(new Event("input"));
    expect($("linkHint").textContent).toMatch(/whole https address/);
    $("quoteBtn").click();
    expect($("qLink").hidden).toBe(true);
  });
});

// ── the pay tap, which is a closed door and must say so ─────────────────
//
// The page's own header says "the pay tap reports the door as closed
// rather than throwing a raw 403 at a buyer". It did the opposite: the tap
// moved the panel to "Paying · leaving for stripe", HID the button, ERASED
// the only sentence saying card payment is not open — and made no request
// at all. The page's single fetch is the boot read of the price resource.
//
// Nothing pinned any of it: erasing the notice outright left all of
// test:scripts green, because no case here had ever tapped Pay.
describe("the pay tap (the door is not open)", () => {
  // The options matter: the quote button is disabled until a binary
  // question has two of them, so a case that skipped them would be
  // asserting about a panel that never opened.
  const quote = () => {
    $("prompt").value = "Should the harbour bath stay open all winter?";
    $("prompt").dispatchEvent(new Event("input"));
    const opts = document.querySelectorAll("#options input");
    opts[0].value = "Keep it open"; opts[0].dispatchEvent(new Event("input"));
    opts[1].value = "Close for winter"; opts[1].dispatchEvent(new Event("input"));
    $("quoteBtn").click();
    expect($("panel").hidden, "the quote panel never opened").toBe(false);
  };

  it("says payment is not open, before and after the tap", () => {
    quote();
    expect($("payNote").textContent, "the quote never carried the notice")
      .toMatch(/not open yet/i);
    $("payBtn").click();
    expect($("payNote").textContent, "the tap erased the sentence that says payment is closed")
      .toMatch(/not open yet/i);
  });

  it("does not announce a payment it is not making", () => {
    quote();
    $("payBtn").click();
    const said = sp(text());
    expect(said, "the page announced a payment in progress").not.toMatch(/Paying/);
    expect(said, "the page said it was leaving for the payment provider").not.toMatch(/leaving for stripe/i);
    expect($("panelStatus").textContent).toMatch(/not open yet/i);
  });

  it("makes no request when it is tapped — the fetch is the price read alone", () => {
    quote();
    const before = globalThis.fetch.mock.calls.length;
    $("payBtn").click();
    expect(globalThis.fetch.mock.calls.length, "the tap issued a request it cannot complete")
      .toBe(before);
  });
});
