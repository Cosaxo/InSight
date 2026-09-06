// paid.test.ts — the pure half of the self-serve paid-question loop
// (paid.ts, D313): what a booking must look like to get in, what the
// quote arithmetic locks, what the review holds, and — the part a green
// emulator cannot prove — that the question doc the webhook writes wears
// exactly the shape the client's bank fetch and the answer rules expect.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SUGGEST_PER_DAY } from "./suggestions";
import {
  BOOKINGS_PER_DAY,
  AUDIENCE_DIMS_MAX,
  LIKERT,
  PAID_OPTIONS_MAX,
  PAID_PROMPT_MAX,
  MAX_REVIEW_ATTEMPTS,
  RATING,
  REVIEW_GUIDELINES,
  SWEEP_MAX_PAGES,
  heldPageFrom,
  SWEEP_PAGE,
  WINDOW_DAYS,
  runReviewSweep,
  paidPurchaseDoc,
  paidQuestionDoc,
  parseVerdict,
  priceQuote,
  refundEurFor,
  reviewGates,
  reviewSubject,
  validatePaidBooking,
  type PaidBookingPayload,
  validatePaidLink,
  PAID_LINK_MAX,
} from "./paid";
// One name, one meaning: the day-key helpers live in pure.ts now.
import { utcDayKey } from "./pure";
import { PRICING_CARD } from "./pricing";

const BOOKING: PaidBookingPayload = {
  kind: "question",
  prompt: "Should the night buses run all night?",
  type: "binary",
  options: ["All night", "The hours are fine"],
  topic: "culture",
  scope: "city",
  dims: { city: "Oslo, NO" },
  wearName: true,
  budgetEur: null,
  link: null,
};

describe("the buyer name is read off a field the profile can actually hold", () => {
  // The defect this pins was invisible in every other way: reading a
  // field that does not exist returns undefined, so "wear your name"
  // simply did nothing — no error, no log, and the composer went on
  // previewing the name to the buyer. It also blinded the reviewer,
  // whose rule 8 is about slurs and impersonation IN THE BUYER NAME.
  //
  // So the assertion is not the string. It reads the field name out of
  // paid.ts and holds it against the key allowlist in firestore.rules —
  // the one place that decides what a v2_users document may contain. A
  // rename on either side reds this.
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const paidSrc = readFileSync(resolve(root, "functions/src/paid.ts"), "utf8");
  const rules = readFileSync(resolve(root, "firestore.rules"), "utf8");

  const allowed = (() => {
    const block = /match \/v2_users\/\{uid\} \{[\s\S]*?hasOnly\(\[([\s\S]*?)\]\)/.exec(rules);
    expect(block, "could not find the v2_users key allowlist in firestore.rules").toBeTruthy();
    return [...block![1].matchAll(/"(\w+)"/g)].map((m) => m[1]);
  })();

  it("reads a key firestore.rules admits on v2_users", () => {
    const read = /collection\("v2_users"\)[\s\S]{0,900}?prof\.get\("(\w+)"\)/.exec(paidSrc);
    expect(read, "could not find the buyer-name profile read in paid.ts").toBeTruthy();
    expect(allowed).toContain(read![1]);
  });

  it("and the allowlist is really the profile's, not an empty match", () => {
    // The vacuity guard: an allowlist this test failed to parse would be
    // an empty array, and `toContain` on an empty array fails loudly —
    // but a WRONG block would not. Anchor it on two keys that are the
    // profile's alone.
    expect(allowed).toEqual(expect.arrayContaining(["displayName", "anchors", "handle"]));
    expect(allowed).not.toContain("name");
  });
});

describe("a validated booking survives being validated again", () => {
  // NOT a tidiness property. The validator runs TWICE on every booking:
  // once on the wire in bookPaidQuestionV2, and again inside reviewGates,
  // which re-reads the STORED doc (`bookingPayloadOf`) before the model
  // is called. So anything the validator normalizes has to be acceptable
  // to the validator, or the booking is declined for the shape the
  // validator itself gave it — and the buyer reads that sentence as the
  // reason their question was refused.
  //
  // It has happened: the option-count bound ran BEFORE the continuum
  // forms had their scales substituted, so "scale" (5 Likert steps) and
  // "rating" (10) passed on the wire with the composer's empty list and
  // were declined on re-read with "at most 4 options". Two of the five
  // forms the composer offers could not be sold at all.
  const round = (input: unknown) => {
    const first = validatePaidBooking(input);
    expect(first, `first pass rejected: ${JSON.stringify(first)}`).not.toHaveProperty("error");
    const ok = (first as { ok: PaidBookingPayload }).ok;
    const second = validatePaidBooking(ok);
    expect(second, `second pass rejected: ${JSON.stringify(second)}`).not.toHaveProperty("error");
    return { ok, again: (second as { ok: PaidBookingPayload }).ok };
  };

  // Every form the paid composer offers, with the wire shape the composer
  // actually sends: the continuum forms send NO options, because the app
  // owns their scales.
  for (const type of ["binary", "choice", "scale", "rating", "dilemma"]) {
    it(`holds for a ${type} question`, () => {
      const wire = type === "scale" || type === "rating"
        ? { ...BOOKING, type, options: [] }
        : { ...BOOKING, type };
      const { ok, again } = round(wire);
      expect(again).toEqual(ok);
    });
  }

  it("and the gates agree with the validator on the stored payload", () => {
    // The path that actually declined people: reviewGates runs the
    // validator first, so a payload the validator rejects is a decline
    // with the validator's own sentence.
    for (const type of ["scale", "rating"]) {
      const first = validatePaidBooking({ ...BOOKING, type, options: [] });
      const stored = (first as { ok: PaidBookingPayload }).ok;
      expect(reviewGates(stored), `${type} was declined by its own gates`).toBeNull();
    }
  });

  it("still refuses five AUTHORED options", () => {
    // The bound did not go away — it moved behind the substitution, so it
    // applies to lists a buyer wrote and not to the ones the app minted.
    expect(validatePaidBooking({ ...BOOKING, type: "choice", options: ["a", "b", "c", "d", "e"] }))
      .toHaveProperty("error");
  });
});

describe("validatePaidBooking", () => {
  it("accepts the composer's happy path and normalizes it", () => {
    const r = validatePaidBooking({
      prompt: "  Should the night buses run all night?  ",
      type: "binary",
      options: ["All night", " The hours are fine ", ""],
      topic: "Culture",
      scope: "city",
      dims: { city: "Oslo, NO" },
      wearName: true,
    });
    if ("error" in r) throw new Error(r.error);
    expect(r.ok).toEqual(BOOKING);
  });

  it("bounds the prompt and the option count", () => {
    expect(validatePaidBooking({ ...BOOKING, prompt: "x".repeat(PAID_PROMPT_MAX + 1) }))
      .toHaveProperty("error");
    expect(validatePaidBooking({ ...BOOKING, options: ["a", "b", "c", "d", "e"] }))
      .toHaveProperty("error");
    expect(PAID_OPTIONS_MAX).toBe(4);
  });

  it("synthesizes the scales and refuses authored options on them", () => {
    // The D52 line: a stored optionIdx is a position on the app's own
    // scale, so a paid scale/rating question must carry EXACTLY the
    // bank's synthesized labels whatever the client sent.
    const scale = validatePaidBooking({ ...BOOKING, type: "scale", options: ["My own", "Labels"] });
    if ("error" in scale) throw new Error(scale.error);
    expect(scale.ok.options).toEqual(LIKERT);
    const rating = validatePaidBooking({ ...BOOKING, type: "rating", options: [] });
    if ("error" in rating) throw new Error(rating.error);
    expect(rating.ok.options).toEqual(RATING);
    expect(LIKERT).toEqual(["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"]);
    expect(RATING).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
  });

  it("holds the audience to the published vocabulary, capped at three dims", () => {
    expect(validatePaidBooking({ ...BOOKING, dims: { city: "Oslo, NO", profession: "chef" } }))
      .toHaveProperty("error"); // profession is deliberately never a dim (D8)
    expect(validatePaidBooking({
      ...BOOKING,
      scope: "world",
      dims: { ageBand: "25-34", gender: "female", education: "MA", relationship: "single" },
    })).toHaveProperty("error"); // four dims — past D228's ceiling
    expect(AUDIENCE_DIMS_MAX).toBe(3);
  });

  it("welds the scope to its place dim, both directions", () => {
    // A "city" ask with no city bucket would match everyone while the
    // band claims a place; a "world" ask carrying one would price world
    // and serve a city. Both are the disclosure lying.
    expect(validatePaidBooking({ ...BOOKING, dims: {} })).toHaveProperty("error");
    expect(validatePaidBooking({ ...BOOKING, scope: "world", dims: { city: "Oslo, NO" } }))
      .toHaveProperty("error");
    const world = validatePaidBooking({ ...BOOKING, scope: "world", dims: { ageBand: "25-34" } });
    expect("error" in world).toBe(false);
  });

  it("keeps unknown topics out rather than minting feed vocabulary", () => {
    const r = validatePaidBooking({ ...BOOKING, topic: "propaganda" });
    if ("error" in r) throw new Error(r.error);
    expect(r.ok.topic).toBeNull();
  });

  it("holds the budget to the card's range in whole euros, and reads a missing one as the cap (D372)", () => {
    const { minEur, capEur } = PRICING_CARD;
    const ok = validatePaidBooking({ ...BOOKING, budgetEur: 20 });
    if ("error" in ok) throw new Error(ok.error);
    expect(ok.ok.budgetEur).toBe(20);
    // Outside the range, either way, and not a whole euro: refused with
    // the range in the sentence, which is what the buyer needs to change.
    for (const bad of [minEur - 1, capEur + 1, 99.5, "100", NaN]) {
      const r = validatePaidBooking({ ...BOOKING, budgetEur: bad });
      expect("error" in r, `budget ${String(bad)} should be refused`).toBe(true);
      if ("error" in r) expect(r.error).toMatch(new RegExp(`€${minEur}.*€${capEur}`));
    }
    // A client from before budgets existed sends none. It showed the cap
    // as the price, so the cap is what it is quoted — never a smaller
    // figure it never displayed.
    const { budgetEur: _b, ...legacy } = BOOKING;
    void _b;
    const r = validatePaidBooking(legacy);
    if ("error" in r) throw new Error(r.error);
    expect(r.ok.budgetEur).toBeNull();
    expect(priceQuote("city", PRICING_CARD, r.ok.budgetEur).capEur).toBe(capEur);
  });
});

describe("priceQuote", () => {
  it("prices off the committed card and locks the arithmetic", () => {
    const q = priceQuote("city", {
      base: 0.16, floorX: 0.9, crowdStep: 0.5, capEur: 320, minEur: 20, budgets: [50, 320], adBase: 320, floorWeek: 500,
      generated: "2026-08-24", currency: "EUR", fx: {},
      cohorts: {
        city: { idx: 0.9, booked: [], nextOpen: null },
        country: { idx: 0.9, booked: [], nextOpen: null },
        world: { idx: 0.9, booked: [], nextOpen: null },
      },
      estimates: {},
    });
    expect(q.ratePerAnswer).toBe(0.144);
    expect(q.capEur).toBe(320);
    expect(q.cap).toBe(Math.floor(320 / 0.144)); // 2222
    expect(q.windowDays).toBe(WINDOW_DAYS);
  });

  it("makes the buyer's budget the cap, and holds it to the card's range (D372)", () => {
    const card = {
      base: 0.1, floorX: 1, crowdStep: 0.5, capEur: 320, minEur: 20, budgets: [50, 100, 200, 320], floorWeek: 500,
      generated: "2026-09-05", currency: "EUR", fx: {}, adBase: 320,
      cohorts: {
        city: { idx: 1, booked: [], nextOpen: null },
        country: { idx: 1.5, booked: [], nextOpen: null },
        world: { idx: 1, booked: [], nextOpen: null },
      },
      estimates: {},
    };
    const q = priceQuote("city", card, 100);
    expect(q.ratePerAnswer).toBe(0.1);
    expect(q.capEur).toBe(100);
    expect(q.cap).toBe(1000);
    // The lifted line buys fewer answers for the same money — the budget
    // is the constant, the count is what the demand index moves.
    expect(priceQuote("country", card, 100).cap).toBe(Math.floor(100 / 0.15));
    // Null is the pre-D372 booking: the card's cap.
    expect(priceQuote("city", card, null).capEur).toBe(320);
    // The clamps hold here too, whatever a stored figure says.
    expect(priceQuote("city", card, 5).capEur).toBe(20);
    expect(priceQuote("city", card, 5000).capEur).toBe(320);
  });

  it("holds a card idx to the floor, and to nothing above it (D373)", () => {
    const card = {
      base: 0.16, floorX: 0.9, crowdStep: 0.5, capEur: 320, minEur: 20, budgets: [50, 320], adBase: 320, floorWeek: 500,
      generated: "2026-08-24", currency: "EUR", fx: {},
      cohorts: {
        city: { idx: 9, booked: [], nextOpen: null },
        country: { idx: 0.1, booked: [], nextOpen: null },
        world: { idx: 1, booked: [], nextOpen: null },
      },
      estimates: {},
    };
    expect(priceQuote("city", card).ratePerAnswer).toBe(1.44); // 0.16 × 9 — crowding has no ceiling
    expect(priceQuote("country", card).ratePerAnswer).toBe(0.144); // 0.16 × 0.9 floor
  });
});

describe("reviewGates", () => {
  it("passes an honest booking through to the model", () => {
    expect(reviewGates(BOOKING)).toBeNull();
  });
  it("declines duplicate options — one answer wearing two indexes", () => {
    expect(reviewGates({ ...BOOKING, options: ["All night", "ALL NIGHT"] })).toMatch(/same thing/);
  });
  it("declines a prompt with no words in it", () => {
    expect(reviewGates({ ...BOOKING, prompt: "??!… –" })).toMatch(/write it out/);
  });
});

describe("validatePaidLink — the buyer's one link, by shape (D378)", () => {
  it("takes a whole https address and nothing else", () => {
    expect(validatePaidLink("https://harboursauna.no/winter")).toEqual({ ok: "https://harboursauna.no/winter" });
    expect(validatePaidLink("  https://Example.NO/a?b=1  ")).toEqual({ ok: "https://example.no/a?b=1" });
    // none is none — the field is optional, and blank is not an error
    expect(validatePaidLink(undefined)).toEqual({ ok: null });
    expect(validatePaidLink("   ")).toEqual({ ok: null });
    expect(validatePaidLink("harboursauna.no")).toHaveProperty("error");
    expect(validatePaidLink("http://harboursauna.no")).toEqual({ error: expect.stringMatching(/https/) });
    expect(validatePaidLink("javascript:alert(1)")).toHaveProperty("error");
    expect(validatePaidLink("https://user:pw@harboursauna.no")).toHaveProperty("error");
    expect(validatePaidLink("https://localhost/x")).toHaveProperty("error");
    expect(validatePaidLink(`https://harboursauna.no/${"x".repeat(PAID_LINK_MAX)}`)).toHaveProperty("error");
  });

  it("rides the booking through the validator, the stored reader and the round trip", () => {
    const withLink = validatePaidBooking({ ...BOOKING, link: "https://harboursauna.no/winter" });
    if ("error" in withLink) throw new Error(withLink.error);
    expect(withLink.ok.link).toBe("https://harboursauna.no/winter");
    const again = validatePaidBooking(withLink.ok);
    if ("error" in again) throw new Error(again.error);
    expect(again.ok).toEqual(withLink.ok);
    expect(validatePaidBooking({ ...BOOKING, link: "ftp://harboursauna.no" })).toHaveProperty("error");
    // and it is on the question doc, as the audience is — or absent
    const doc = paidQuestionDoc(withLink.ok, "Olaf", "2026-08-27", "2026-09-24", 1) as { sponsor: Record<string, unknown> };
    expect(doc.sponsor.link).toBe("https://harboursauna.no/winter");
    const none = paidQuestionDoc(BOOKING, "Olaf", "2026-08-27", "2026-09-24", 1) as { sponsor: Record<string, unknown> };
    expect(none.sponsor).not.toHaveProperty("link");
    // the reviewer reads it
    expect(JSON.parse(reviewSubject(withLink.ok, "Olaf")).link).toBe("https://harboursauna.no/winter");
  });
});

describe("REVIEW_GUIDELINES", () => {
  // The instruction is a constant so these pins can hold the load-bearing
  // rules IN the prompt — a guideline that silently falls out of an
  // edited instruction is the standard failure of prompts under change.
  it("keeps the rules the product depends on", () => {
    expect(REVIEW_GUIDELINES).toMatch(/civic and place-scoped policy questions are allowed/i);
    expect(REVIEW_GUIDELINES).toMatch(/private person/i);
    expect(REVIEW_GUIDELINES).toMatch(/push-polling/i);
    expect(REVIEW_GUIDELINES).toMatch(/buyer name or an audience value/i);
    expect(REVIEW_GUIDELINES).toMatch(/shown to the buyer verbatim/i);
    // The link clause (D378): the reviewer sees the address, not the
    // page, and the prompt still carries none.
    expect(REVIEW_GUIDELINES).toMatch(/one https link[\s\S]{0,200}?after a person has answered/i);
    expect(REVIEW_GUIDELINES).toMatch(/shortener or redirect/i);
  });
  it("serializes the subject with the name only when worn (D228)", () => {
    expect(JSON.parse(reviewSubject(BOOKING, "Olaf")).buyerName).toBe("Olaf");
    expect(JSON.parse(reviewSubject({ ...BOOKING, wearName: false }, "Olaf")).buyerName).toBeNull();
  });
});

describe("parseVerdict", () => {
  it("reads a bare verdict and a fenced one", () => {
    expect(parseVerdict('{"verdict":"approve","reason":null}')).toEqual({ verdict: "approve", reason: null });
    expect(parseVerdict('```json\n{"verdict":"decline","reason":"Name a public figure instead."}\n```'))
      .toEqual({ verdict: "decline", reason: "Name a public figure instead." });
  });
  it("returns null — hold and retry — for anything unusable", () => {
    expect(parseVerdict("I think this is fine")).toBeNull();
    expect(parseVerdict('{"verdict":"maybe"}')).toBeNull();
    // a decline owes the buyer its why; without one it is not a verdict
    expect(parseVerdict('{"verdict":"decline"}')).toBeNull();
  });
});

describe("paidQuestionDoc — the third pen writes the seed's own shape", () => {
  const doc = paidQuestionDoc(BOOKING, "Olaf", "2026-08-27", "2026-09-24", 120000);

  it("is a feed question the client's bank fetch will carry", () => {
    // THIS CASE'S OWN CLAIM STOPPED BEING TRUE the day D316/D321 landed,
    // hours after this file. Its comment used to read "live.ts filters
    // `surface in BANK_SURFACES`" — and the feed came out of that list:
    // the boot fetch now asks for the boot surfaces plus `feed && core`,
    // and everything else on the feed pages behind the order rankBankV2
    // publishes from the COMPILED bank, which a document written here at
    // runtime can never enter. So `surface: "feed"` alone reached nobody,
    // and the case that was supposed to guarantee delivery kept passing.
    //
    // `paid` is the marker the third boot query asks for, paired with the
    // window so the set is the campaigns RUNNING. Asserted together,
    // because either alone is the bug back.
    expect(doc.surface).toBe("feed");
    expect(doc.paid, "nothing marks this as bought — no boot query reaches it").toBe(true);
    // splitBanks demands ≥2 options; the answer rules bound optionIdx by
    // options.size().
    expect((doc.options as string[]).length).toBeGreaterThanOrEqual(2);
    expect(doc.from).toBe("2026-08-27");
    expect(doc.until).toBe("2026-09-24");
    // updatedAt is the delta-fetch key — the whole no-deploy story
    expect(doc.updatedAt).toBeDefined();
  });

  it("is tail, never core, and always disclosed", () => {
    // `core` would be the wrong way to make it reachable: core is the
    // Mirror's corpus (D161), which a bought question must not join.
    expect("core" in doc).toBe(false);
    expect(doc.sponsor).toBeDefined(); // the PAID band renders from presence
    expect((doc.sponsor as { buyer?: string }).buyer).toBe("Olaf");
    expect((doc.sponsor as { audience?: object }).audience).toEqual({ city: "Oslo, NO" });
  });

  it("books namelessly when the name is not worn (D228)", () => {
    const anon = paidQuestionDoc({ ...BOOKING, wearName: false }, "Olaf", "2026-08-27", "2026-09-24", 1);
    expect("buyer" in (anon.sponsor as object)).toBe(false);
    expect(anon.sponsor).toBeDefined(); // still marked PAID
  });

  it("omits the audience entirely for an untargeted world ask", () => {
    const world = paidQuestionDoc(
      { ...BOOKING, scope: "world", dims: {} }, null, "2026-08-27", "2026-09-24", 1,
    );
    expect("audience" in (world.sponsor as object)).toBe(false);
  });
});

describe("paidPurchaseDoc — the room reads exactly this", () => {
  const quote = { ratePerAnswer: 0.144, capEur: 320, cap: 2222, windowDays: 29 };
  const doc = paidPurchaseDoc("u1", "paidq-b1", BOOKING, quote, "2026-08-27", "2026-09-24", "pi_123");

  it("matches the D288 record shape record-purchase.mjs established", () => {
    expect(doc.uid).toBe("u1");
    expect(doc.kind).toBe("question");
    expect(doc.qid).toBe("paidq-b1");
    expect(doc.scope).toBe("city");
    expect(doc.place).toBe("Oslo, NO");
    expect(doc.dims).toEqual(["city:Oslo, NO"]); // the "k:v" string list
    expect(doc.window).toEqual({ start: "2026-08-27", until: "2026-09-24" });
    expect(doc.budget).toEqual({ cap: 2222, capEur: 320, ratePerAnswer: 0.144 });
    expect(doc.state).toBe("running");
    expect(doc.reports).toEqual([]);
    expect(doc.stripePaymentIntent).toBe("pi_123");
  });

  it("carries no place for a world ask", () => {
    const world = paidPurchaseDoc(
      "u1", "q", { ...BOOKING, scope: "world", dims: { ageBand: "25-34" } },
      quote, "2026-08-27", "2026-09-24", null,
    );
    expect(world.place).toBeNull();
    expect("stripePaymentIntent" in world).toBe(false);
  });
});

describe("refundEurFor — the closer's arithmetic", () => {
  it("refunds the unserved answers at the locked rate", () => {
    expect(refundEurFor(2222, 320, 0.144, 1000)).toBe(175.97); // (2222-1000)×0.144
  });
  it("refunds nothing at or past the cap, and never more than was paid", () => {
    expect(refundEurFor(2222, 320, 0.144, 2222)).toBe(0);
    expect(refundEurFor(2222, 320, 0.144, 5000)).toBe(0);
    expect(refundEurFor(2222, 320, 0.144, 0)).toBeLessThanOrEqual(320);
    // The clamp, actually reached. The line above satisfies itself: 2222 ×
    // 0.144 = 319.97, already under the cap, so `Math.min(capEur, …)` could
    // be deleted with the whole suite green — under the name "never more
    // than was paid". These two put the raw product ABOVE the cap.
    expect(refundEurFor(2222, 300, 0.144, 0)).toBe(300);
    expect(refundEurFor(2222, 300, 0.144, 1000)).toBe(175.97); // unclamped, unchanged
  });
  it("treats a negative answer count as zero rather than inventing money", () => {
    expect(refundEurFor(100, 16, 0.16, -5)).toBe(16);
  });
});

describe("utcDayKey", () => {
  it("speaks the bank's YYYY-MM-DD grain, offset in days", () => {
    const t = Date.UTC(2026, 7, 26, 23, 30); // late on the 26th UTC
    expect(utcDayKey(0, t)).toBe("2026-08-26");
    expect(utcDayKey(1, t)).toBe("2026-08-27");
    expect(utcDayKey(WINDOW_DAYS, t)).toBe("2026-09-24");
  });
});

// ── the ad lane (D315) ──────────────────────────────────────────────────

// ── the two ceilings on this file that cost money when they move ────
//
// Both can be set to a million with every suite green. The tests that
// look like they hold them state them RELATIVE to the constant — e.g.
// `{ id: "stuck", attempts: MAX_REVIEW_ATTEMPTS }` — so they move with
// it, and no check gate names either. That is the repo's deliberate
// pattern for a dial an operator may tune, and these two are the
// exception their own docstrings describe: they may be tuned, but not
// SILENTLY, because the direction that costs money is unbounded.
describe("the review budget, held to the arithmetic it states", () => {
  it("keeps the retry ceiling at the value whose reasoning is written down", () => {
    // paid.ts: "Six is three hours at the sweep's half-hour cadence."
    // Above it, what the bound is for: an unreviewable booking otherwise
    // "re-reviewed every thirty minutes forever, each attempt a billed
    // model call". At a million that is a billed call every half hour for
    // about fifty-seven years, on one stuck row.
    expect(MAX_REVIEW_ATTEMPTS,
      "the retry ceiling moved — re-read paid.ts's arithmetic and change this line deliberately").toBe(6);
    // The sentence, executed: six attempts at the scheduled cadence is
    // three hours. A change to the SCHEDULE has to face this too.
    const src = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "paid.ts"), "utf8");
    const every = /schedule: "every (\d+) minutes"/.exec(src);
    expect(every, "the sweep's schedule could not be read — this case lost its target").toBeTruthy();
    expect(MAX_REVIEW_ATTEMPTS * Number(every![1]) / 60,
      "six attempts no longer means three hours — the cadence or the ceiling moved alone").toBe(3);
  });

  it("keeps the daily booking ceiling, and keeps it above the suggestion budget", () => {
    // paid.ts: "Looser than the old suggestion budget's 3 … tighter than
    // unlimited (each booking is a Claude review someone pays for — us)."
    // Both halves of that sentence, executed. It appears in no test at
    // all otherwise.
    expect(BOOKINGS_PER_DAY,
      "the daily booking ceiling moved — each one is a billed review").toBe(5);
    expect(BOOKINGS_PER_DAY,
      "the booking budget is no longer looser than the suggestion budget it was priced against")
      .toBeGreaterThan(SUGGEST_PER_DAY);
  });
});

// The ad lane's describes — kind ad, adPriceQuote, paidAdDoc,
// paidAdPurchaseDoc, the guidelines' ad clause — stood here from D315 to
// D375, which retired the self-serve ad: the sponsored question is the
// one paid product. What is pinned now is the refusal.
describe("the ad lane is retired (D375)", () => {
  it("refuses an ad booking by name, in the register the door shows", () => {
    const r = validatePaidBooking({ kind: "ad", advertiser: "Harbour Sauna", headline: "Warm", body: "Open.", scope: "city", dims: { city: "Oslo, NO" } });
    expect("error" in r).toBe(true);
    if ("error" in r) expect(r.error).toMatch(/ask a question instead/);
  });

  it("no longer instructs the reviewer about ads", () => {
    expect(REVIEW_GUIDELINES).not.toMatch(/FEED AD|"kind":"ad"/);
  });
});

describe("runReviewSweep", () => {
  const store = (rows) => {
    const state = { reviewed: [], pages: [] };
    return {
      state,
      store: {
        async heldPage(after, limit) {
          const from = after ? rows.findIndex((r) => r.id === after) + 1 : 0;
          const page = rows.slice(from, from + limit);
          state.pages.push({ after, size: page.length });
          return page;
        },
        async review(bid) { state.reviewed.push(bid); },
      },
    };
  };
  const held = (n, attempts) =>
    Array.from({ length: n }, (_, i) => ({ id: `b${String(i).padStart(4, "0")}`, attempts }));

  it("retries a booking under the ceiling", async () => {
    const { store: st, state } = store(held(3, 0));
    const res = await runReviewSweep(st);
    expect(res).toMatchObject({ scanned: 3, retried: 3, stalled: 0 });
    expect(state.reviewed).toEqual(["b0000", "b0001", "b0002"]);
  });

  it("stops calling for one past the ceiling, and says how many", async () => {
    const { store: st, state } = store([
      { id: "stuck", attempts: MAX_REVIEW_ATTEMPTS },
      { id: "fresh", attempts: 1 },
    ]);
    const res = await runReviewSweep(st);
    expect(res).toMatchObject({ retried: 1, stalled: 1 });
    expect(state.reviewed, "a booking past the ceiling was called for again").toEqual(["fresh"]);
  });

  it("PAGES PAST a full page of stalled bookings to reach a live one", async () => {
    // The starvation itself. One whole page of unsettleable bookings, all
    // older than the one that needs retrying — which is exactly the order
    // the query returns them in.
    const rows = [...held(SWEEP_PAGE, MAX_REVIEW_ATTEMPTS), { id: "zz_real", attempts: 0 }];
    const { store: st, state } = store(rows);
    const res = await runReviewSweep(st);
    expect(state.reviewed, "a real hold behind a page of stalled ones was never retried")
      .toEqual(["zz_real"]);
    expect(res).toMatchObject({ retried: 1, stalled: SWEEP_PAGE });
    // …and it walked, rather than asking for one bigger page.
    expect(state.pages.length).toBeGreaterThan(1);
    expect(state.pages[1].after).toBe(`b${String(SWEEP_PAGE - 1).padStart(4, "0")}`);
  });

  it("is bounded — a scheduled job may not loop forever", async () => {
    const rows = held(SWEEP_PAGE * (SWEEP_MAX_PAGES + 3), MAX_REVIEW_ATTEMPTS);
    const res = await runReviewSweep(store(rows).store);
    expect(res.scanned).toBe(SWEEP_PAGE * SWEEP_MAX_PAGES);
  });

  it("stops on a short page rather than asking for an empty one", async () => {
    const { store: st, state } = store(held(3, 0));
    await runReviewSweep(st);
    expect(state.pages.length).toBe(1);
  });
});

describe("heldPageFrom — the paging the sweep's own tests cannot see", () => {
  // runReviewSweep is proved against an injected ReviewSweepStore, so the
  // adapter that actually talks to Firestore ran under nothing. The bug it
  // was hiding: a cursor document that has gone away (deleteAccount sweeps
  // this collection by uid) fell through to a query with no startAfter —
  // page ONE — so the sweep re-reviewed its own head up to five times,
  // each retry a billed model call, and never reached what was starved
  // behind it.
  const page = (ids: string[]) => ({
    docs: ids.map((id) => ({ id, get: (f: string) => (f === "reviewAttempts" ? 1 : undefined) })),
  });

  /** A query that records whether startAfter was applied. */
  function fakeBase(ids: string[]) {
    const calls: string[] = [];
    const q: Record<string, unknown> = {};
    q.limit = () => q;
    q.startAfter = (cur: { id: string }) => { calls.push(cur.id); return q; };
    q.get = async () => page(ids);
    return { q: q as unknown as FirebaseFirestore.Query, calls };
  }
  const fakeDb = (exists: boolean) => ({
    collection: () => ({ doc: (id: string) => ({ get: async () => ({ id, exists }) }) }),
  }) as unknown as FirebaseFirestore.Firestore;

  it("reads the first page with no cursor", async () => {
    const { q, calls } = fakeBase(["b1", "b2"]);
    const rows = await heldPageFrom(q, fakeDb(true), null, 50);
    expect(rows).toEqual([{ id: "b1", attempts: 1 }, { id: "b2", attempts: 1 }]);
    expect(calls, "a first page asked to start after something").toEqual([]);
  });

  it("advances past the cursor when it is still there", async () => {
    const { q, calls } = fakeBase(["b3"]);
    const rows = await heldPageFrom(q, fakeDb(true), "b2", 50);
    expect(rows.map((r) => r.id)).toEqual(["b3"]);
    expect(calls, "the cursor was not applied").toEqual(["b2"]);
  });

  it("ENDS the run when the cursor booking has been deleted", async () => {
    // Not "starts over". This is the whole finding: the returned page is
    // empty, so runReviewSweep's loop stops and the rest waits for the
    // next scheduled run — minutes — instead of the queue re-reviewing
    // the head it just paid for.
    const { q, calls } = fakeBase(["b1", "b2"]);
    const rows = await heldPageFrom(q, fakeDb(false), "gone", 50);
    expect(rows, "a vanished cursor rewound to page one").toEqual([]);
    expect(calls).toEqual([]);
  });
});
