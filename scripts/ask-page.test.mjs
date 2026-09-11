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

// The page reads THREE resources now (D455): the price card, the buy
// door's config, and — only on a place scope — the city list. Answered by
// URL rather than by one catch-all body: a stub that hands the pricing
// object to every caller made `st.cfg` a pricing card, which happens to
// have no apiKey and so happens to read as "door closed". That is the
// right answer arrived at by accident, and it would have gone on being
// the answer after the door opened.
async function mount(P = pricing, opts = {}) {
  document.documentElement.innerHTML = html.replace(/<script>[\s\S]*<\/script>/, "");
  const cfg = opts.cfg === undefined ? null : opts.cfg;
  const places = opts.places === undefined ? "NO\nOslo\nBergen\n" : opts.places;
  vi.stubGlobal("fetch", vi.fn(async (url) => {
    const u = String(url);
    if (u.indexOf("ask-config") >= 0) {
      return cfg ? { ok: true, json: async () => cfg } : { ok: false, json: async () => ({}) };
    }
    if (u.indexOf("ask-places") >= 0) return { ok: true, text: async () => places };
    if (u.indexOf("ask-pricing") >= 0) return { ok: true, json: async () => P };
    return opts.fn ? opts.fn(u) : { ok: true, json: async () => ({}) };
  }));
  // scrollIntoView is not in jsdom; the page calls it on a row tap
  Element.prototype.scrollIntoView = () => {};
  const [body] = inlineScripts(html);
  new Function(body)();
  // THREE TICKS WAS ENOUGH FOR ONE FETCH AND IS NOT ENOUGH FOR THREE.
  // The boot now chains price card, buy-door config and — on a place
  // scope, which is where the ruler starts — the city list, each of them
  // a fetch whose `.json()`/`.text()` is itself a promise. At three ticks
  // the config had not landed yet, so every case below read a page whose
  // door was still closed and passed for the wrong reason.
  for (let i = 0; i < 40; i++) await Promise.resolve();
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

  it("states the refund RULE and forecasts nothing", () => {
    // The line used to work an example off `Math.round(a * 0.67)` and
    // print it as counts — "if it is answered 1 675 times instead of
    // 2 500". The 0.67 was carried from a design draft and exists in no
    // committed file, on the page that takes the money. The server
    // refuses the same thing one step earlier: pricingFold's estimates
    // are withheld until a cohort has a campaign to measure from, and
    // `web/ask-pricing.json` carries no estimates block at all.
    //
    // So this pins the shape rather than the wording: every figure in
    // the sentence is one the panel above it already quotes, and none of
    // them is a prediction.
    $("prompt").value = "Should the harbour bath stay open all winter?";
    $("prompt").dispatchEvent(new Event("input"));
    const opts = document.querySelectorAll("#options input");
    opts[0].value = "Keep it open"; opts[0].dispatchEvent(new Event("input"));
    opts[1].value = "Close for winter"; opts[1].dispatchEvent(new Event("input"));
    $("quoteBtn").click();
    const line = sp($("refundLine").textContent);
    expect(line).toMatch(/every answer it does not get comes back to you/);
    expect(line, "the page forecasts a delivery rate again").not.toMatch(/instead of/);
    // The two numbers it does quote are the panel's own, not new ones.
    const cap = sp($("qCap").textContent);
    const answers = sp($("qAnswers").textContent).replace(/^up to /, "");
    const rate = sp($("qRate").textContent);
    expect(line).toContain("charged " + cap + " now");
    expect(line).toContain("answered up to " + answers + " times");
    expect(line).toContain("comes back to you at " + rate + " an answer");
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
describe("the currency switch and the amount actually charged", () => {
  const toNOK = () => {
    const chips = [...document.querySelectorAll("#currencies button")];
    const nok = chips.find((b) => b.textContent === "NOK");
    expect(nok, "the page offers no NOK chip — the fixture, not the subject").toBeTruthy();
    nok.click();
  };

  const quoteIt = () => {
    $("prompt").value = "Should the harbour bath stay open all winter?";
    $("prompt").dispatchEvent(new Event("input"));
    const opts = document.querySelectorAll("#options input");
    opts[0].value = "Keep it open"; opts[0].dispatchEvent(new Event("input"));
    opts[1].value = "Close for winter"; opts[1].dispatchEvent(new Event("input"));
    $("quoteBtn").click();
  };

  it("names the charge in euro, exactly, whatever currency the page is showing", () => {
    // Stripe charges `Math.round(capEur * 100)` cents in EUR whatever this
    // page displays (paid.ts's checkoutLineItem), so the two sites that
    // name the CHARGE are not conversions. They printed one: with the €5
    // budget in NOK the cap read "58 kr" above a debit of €5.00.
    //
    // 58 IS the true conversion, and saying so matters — the first version of
    // this comment claimed "60 kr", which is wrong: fmtWhole's
    // round-to-ten band starts at 100, so a €5 budget is not rounded at
    // all. The defect is not the rounding. It is that the page named a
    // kroner figure for money debited in euro, which is true at every
    // budget. The rounding is a SECOND error on top of it and shows up
    // higher: €10 is 116 and printed 120 (overstated), €320 is 3712 and
    // printed 3700 (understated) — the same two directions
    // `data/pricing.ts` records for the in-app control.
    //
    // The app settled this one surface over and said why: "converting here
    // would put an approximation on the one number that is exact"
    // (data/pricing.ts's fmtExact). quote-copy.test.mjs pins that for the
    // in-app control and lists no page under web/, which is how the page
    // that takes the money became the one surface not held to the rule.
    toNOK();
    quoteIt();
    expect(sp($("qCap").textContent), "the charge was converted").toBe("€5");
    expect(sp($("refundLine").textContent)).toMatch(/charged €5 now/);
  });

  it("marks every figure the fx table converted, and marks none in euro", () => {
    // The table is committed and dated — a convenience, not the contract —
    // and the page printed converted figures as if they were exact.
    toNOK();
    expect(sp($("scopeRate").textContent), "a converted rate was printed as exact").toMatch(/^≈ /);
    quoteIt();
    expect(sp($("qRate").textContent)).toMatch(/^≈ /);
    // …and the euro path carries no mark at all.
    const eur = [...document.querySelectorAll("#currencies button")].find((b) => b.textContent === "EUR");
    eur.click();
    expect(sp($("scopeRate").textContent), "euro was marked as an approximation").not.toMatch(/≈/);
  });
});

describe("what the quote promises about its own price", () => {
  it("does not call the quote locked before the question is approved", () => {
    // The page prices off the COMMITTED card; the server re-reads demand
    // when the question is approved and locks the quote there. Measured on
    // the shipped fold at six concurrent city campaigns: the door offered
    // 500 answers for €10 where the server locks 166 for the same €10, and
    // the door's refund line promised money back that the server's quote
    // pays at zero. Calling that "price locked" is the one word this page
    // must not use.
    $("prompt").value = "Should the harbour bath stay open all winter?";
    $("prompt").dispatchEvent(new Event("input"));
    const opts = document.querySelectorAll("#options input");
    opts[0].value = "Keep it open"; opts[0].dispatchEvent(new Event("input"));
    opts[1].value = "Close for winter"; opts[1].dispatchEvent(new Event("input"));
    $("quoteBtn").click();
    expect($("panelKicker").textContent, "the quote called itself locked").not.toMatch(/price locked/);
    expect($("panelKicker").textContent).toMatch(/locked when approved/);
    // …and the page says WHY, in its own provenance line rather than only
    // in a kicker somebody may not read.
    expect(sp(text()), "the page never says the rate is confirmed at approval")
      .toMatch(/confirmed when the question is approved/);
  });
});

describe("the pay tap on a deployment with NO keys", () => {
  // Still the honest closed door, and it has to stay reachable: a local
  // checkout, a preview and production-before-runbook-5.14 all land here.
  // What changed at D455 is that "closed" is now a property of the
  // DEPLOYMENT (no ask-config.json) rather than of the code.
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

// ── the door with keys (D455) ──────────────────────────────────────────
//
// The other half of the describe above. Everything here is what a buyer
// on production meets once runbook 5.14 is done, and the assertions are
// mostly about the BOOKING PAYLOAD, because that is where this page can
// fail expensively and silently: a booking whose `dims.city` is not the
// catalogue key an answer's anchor holds is a campaign that charges €320
// and reaches nobody.
//
// D456 took the reCAPTCHA hop out of all of this — the page loads no
// external script at all now, and the two callables are gated on the
// per-account booking budget with the payment as the real filter.
describe("the pay tap with keys", () => {
  const CFG = {
    apiKey: "AIza-test",
    project: "prvfire33", region: "europe-west1", dbId: "insight",
  };

  /** The calls the door makes, in order, keyed by what they are. */
  function wire(over = {}) {
    const calls = [];
    const fn = (u) => {
      calls.push(u);
      if (u.indexOf("accounts:signUp") >= 0) {
        return { ok: true, json: async () => ({ idToken: "ID-TOKEN" }) };
      }
      if (u.indexOf("bookPaidQuestionV2") >= 0) {
        return over.book || { ok: true, json: async () => ({ result: { id: "uid_abc" } }) };
      }
      if (u.indexOf("firestore.googleapis.com") >= 0) {
        return over.verdict || {
          ok: true,
          json: async () => ({ fields: { status: { stringValue: "approved" } } }),
        };
      }
      if (u.indexOf("createPaidCheckoutV2") >= 0) {
        return over.checkout || {
          ok: true,
          json: async () => ({ result: { url: "https://checkout.stripe.com/c/pay/x" } }),
        };
      }
      return { ok: true, json: async () => ({}) };
    };
    return { calls, fn };
  }

  /** Compose a quotable question and open the panel. */
  function compose() {
    $("prompt").value = "Should the harbour bath stay open all winter?";
    $("prompt").dispatchEvent(new Event("input"));
    const opts = document.querySelectorAll("#options input");
    opts[0].value = "Keep it open"; opts[0].dispatchEvent(new Event("input"));
    opts[1].value = "Close for winter"; opts[1].dispatchEvent(new Event("input"));
    $("quoteBtn").click();
  }

  function pickCity(name = "Oslo") {
    $("placeInput").value = name;
    $("placeInput").dispatchEvent(new Event("input"));
  }

  const settle = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };

  it("sends the CATALOGUE KEY as the city, not what was typed", async () => {
    // The expensive-and-silent failure this whole picker exists for. The
    // buyer types "Oslo"; the booking must carry "Oslo, NO", which is
    // placeKey() in src/v2/data/places.ts and what an answer's stored
    // anchor holds. Anything else prices a campaign that reaches nobody.
    const { calls, fn } = wire();
    await mount(pricing, { cfg: CFG, fn });
    pickCity();
    compose();
    $("payBtn").click();
    await settle();
    const book = globalThis.fetch.mock.calls.find((c) => String(c[0]).indexOf("bookPaidQuestionV2") >= 0);
    expect(book, "the door never called bookPaidQuestionV2").toBeTruthy();
    const sent = JSON.parse(book[1].body).data;
    expect(sent.dims.city).toBe("Oslo, NO");
    expect(sent.scope).toBe("city");
    expect(calls.some((u) => u.indexOf("accounts:signUp") >= 0)).toBe(true);
  });

  it("refuses to book a place scope with nothing picked, and calls nobody", async () => {
    const { fn } = wire();
    await mount(pricing, { cfg: CFG, fn });
    compose();
    const before = globalThis.fetch.mock.calls.length;
    $("payBtn").click();
    await settle();
    expect(globalThis.fetch.mock.calls.length, "it booked an ask with no place")
      .toBe(before);
    expect(sp(text())).toMatch(/Pick the city first/);
  });

  it("shows the reviewer's own words on a decline, and never reaches checkout", async () => {
    const { fn } = wire({
      verdict: {
        ok: true,
        json: async () => ({
          fields: {
            status: { stringValue: "declined" },
            declineReason: { stringValue: "Questions about named private people aren't sold here." },
          },
        }),
      },
    });
    await mount(pricing, { cfg: CFG, fn });
    pickCity();
    compose();
    $("payBtn").click();
    await settle();
    expect(sp(text())).toMatch(/named private people/);
    const paid = globalThis.fetch.mock.calls.some((c) => String(c[0]).indexOf("createPaidCheckoutV2") >= 0);
    expect(paid, "a declined booking was sent to checkout anyway").toBe(false);
  });

  it("carries the booking id to checkout, with its own token", async () => {
    const { fn } = wire();
    await mount(pricing, { cfg: CFG, fn });
    pickCity();
    compose();
    $("payBtn").click();
    await settle();
    const co = globalThis.fetch.mock.calls.find((c) => String(c[0]).indexOf("createPaidCheckoutV2") >= 0);
    expect(co, "the door never reached checkout").toBeTruthy();
    const sent = JSON.parse(co[1].body).data;
    expect(sent.id).toBe("uid_abc");
  });

  it("drops NO honest note when the door is open", async () => {
    // The closed-door sentence is true of a keyless deployment and a lie
    // on this one. A page that says "payment is not open yet" above a
    // button that opens Stripe is the page contradicting itself.
    const { fn } = wire();
    await mount(pricing, { cfg: CFG, fn });
    pickCity();
    compose();
    expect($("payNote").textContent).not.toMatch(/not open yet/i);
  });

  it("surfaces a refusal from the server rather than a status code", async () => {
    const { fn } = wire({
      book: {
        ok: false,
        json: async () => ({ error: { status: "PERMISSION_DENIED", message: "the human check did not pass" } }),
      },
    });
    await mount(pricing, { cfg: CFG, fn });
    pickCity();
    compose();
    $("payBtn").click();
    await settle();
    expect($("payNote").textContent).toMatch(/human check did not pass/);
  });
});
