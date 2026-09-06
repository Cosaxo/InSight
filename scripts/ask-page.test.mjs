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
    expect($("menuNote").textContent).toMatch(/One card in 6 in the feed is paid/);
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
