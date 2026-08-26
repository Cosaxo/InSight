// paid.test.ts — the pure half of the self-serve paid-question loop
// (paid.ts, D304): what a booking must look like to get in, what the
// quote arithmetic locks, what the review holds, and — the part a green
// emulator cannot prove — that the question doc the webhook writes wears
// exactly the shape the client's bank fetch and the answer rules expect.

import { describe, expect, it } from "vitest";
import {
  AUDIENCE_DIMS_MAX,
  LIKERT,
  PAID_OPTIONS_MAX,
  PAID_PROMPT_MAX,
  RATING,
  REVIEW_GUIDELINES,
  WINDOW_DAYS,
  paidPurchaseDoc,
  paidQuestionDoc,
  parseVerdict,
  priceQuote,
  refundEurFor,
  reviewGates,
  reviewSubject,
  utcDayKey,
  validatePaidBooking,
  type PaidBookingPayload,
} from "./paid";

const BOOKING: PaidBookingPayload = {
  prompt: "Should the night buses run all night?",
  type: "binary",
  options: ["All night", "The hours are fine"],
  topic: "culture",
  scope: "city",
  dims: { city: "Oslo, NO" },
  wearName: true,
};

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
});

describe("priceQuote", () => {
  it("prices off the committed card and locks the arithmetic", () => {
    const q = priceQuote("city", {
      base: 0.16, floorX: 0.9, ceilX: 2.5, capEur: 320, floorWeek: 500,
      generated: "2026-08-24", currency: "EUR", fx: {}, trailingDays: 28,
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

  it("clamps a card idx that escaped its own bounds", () => {
    const card = {
      base: 0.16, floorX: 0.9, ceilX: 2.5, capEur: 320, floorWeek: 500,
      generated: "2026-08-24", currency: "EUR", fx: {}, trailingDays: 28,
      cohorts: {
        city: { idx: 9, booked: [], nextOpen: null },
        country: { idx: 0.1, booked: [], nextOpen: null },
        world: { idx: 1, booked: [], nextOpen: null },
      },
      estimates: {},
    };
    expect(priceQuote("city", card).ratePerAnswer).toBe(0.4); // 0.16 × 2.5 ceiling
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
    // live.ts filters `surface in BANK_SURFACES` and splitBanks demands
    // ≥2 options; the answer rules bound optionIdx by options.size().
    expect(doc.surface).toBe("feed");
    expect((doc.options as string[]).length).toBeGreaterThanOrEqual(2);
    expect(doc.from).toBe("2026-08-27");
    expect(doc.until).toBe("2026-09-24");
    // updatedAt is the delta-fetch key — the whole no-deploy story
    expect(doc.updatedAt).toBeDefined();
  });

  it("is tail, never core, and always disclosed", () => {
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
