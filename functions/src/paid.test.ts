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
  AD_ADVERTISER_MAX,
  BOOKINGS_PER_DAY,
  AD_AUDIENCE_MAX,
  AD_BODY_MAX,
  AD_HEADLINE_MAX,
  AD_URL_RE,
  AUDIENCE_DIMS_MAX,
  LIKERT,
  adPriceQuote,
  checkoutLineItem,
  adStartDay,
  adAudiencesOverlap,
  dayPlus,
  paidAdDoc,
  paidAdPurchaseDoc,
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
  reviewBooking,
  reviewGates,
  reviewSubject,
  validatePaidBooking,
  type PaidBookingPayload,
} from "./paid";
// One name, one meaning: the day-key helpers live in pure.ts now.
import { utcDayKey } from "./pure";

const BOOKING: PaidBookingPayload = {
  kind: "question",
  prompt: "Should the night buses run all night?",
  type: "binary",
  options: ["All night", "The hours are fine"],
  topic: "culture",
  advertiser: null,
  headline: null,
  body: null,
  scope: "city",
  dims: { city: "Oslo, NO" },
  wearName: true,
};

const AD: PaidBookingPayload = {
  kind: "ad",
  prompt: "",
  type: "ad",
  options: [],
  topic: null,
  advertiser: "Harbour Sauna",
  headline: "The water is warmer than you think",
  body: "Open every morning from six, all winter.",
  scope: "city",
  dims: { city: "Oslo, NO" },
  wearName: true,
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

  it("holds for an ad", () => {
    const { ok, again } = round(AD);
    expect(again).toEqual(ok);
  });

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

describe("validatePaidBooking — kind ad", () => {
  it("accepts an honest ad and normalizes it", () => {
    const r = validatePaidBooking({
      kind: "ad",
      advertiser: "  Harbour Sauna ",
      headline: "The water is warmer than you think",
      body: "Open every morning from six, all winter.",
      scope: "city",
      dims: { city: "Oslo, NO" },
    });
    if ("error" in r) throw new Error(r.error);
    expect(r.ok).toEqual(AD);
  });

  it("demands all three text fields — the card IS the ad", () => {
    expect(validatePaidBooking({ ...AD, advertiser: "" })).toHaveProperty("error");
    expect(validatePaidBooking({ ...AD, headline: " " })).toHaveProperty("error");
    expect(validatePaidBooking({ ...AD, body: "" })).toHaveProperty("error");
  });

  // THREE BOUNDS ON BOUGHT COPY, AND NOTHING EXERCISED THEM.
  //
  // `validateAdBooking` is the only server-side length gate on an ad
  // somebody paid for, and the booking is written straight into the ads
  // pool every client downloads whole. Measured: disabling all three at
  // once — advertiser, headline and body — left all 593 functions tests
  // green, as did raising the three constants to 100000.
  //
  // The URL nose directly below and the question path's identical length
  // bound are both pinned, so this was a specific hole between two
  // covered arms rather than a blanket absence.
  it("bounds the three fields a bought ad card is made of", () => {
    expect(validatePaidBooking({ ...AD, advertiser: "a".repeat(AD_ADVERTISER_MAX + 1) }),
      "the advertiser name has no ceiling").toHaveProperty("error");
    expect(validatePaidBooking({ ...AD, headline: "h".repeat(AD_HEADLINE_MAX + 1) }),
      "the headline has no ceiling").toHaveProperty("error");
    expect(validatePaidBooking({ ...AD, body: "b".repeat(AD_BODY_MAX + 1) }),
      "the ad's text has no ceiling").toHaveProperty("error");
    // …and the bound is a bound, not a refusal of everything: exactly at
    // the limit is accepted, or "always errors" would pass the three above.
    expect(validatePaidBooking({
      ...AD,
      advertiser: "a".repeat(AD_ADVERTISER_MAX),
      headline: "h".repeat(AD_HEADLINE_MAX),
      body: "b".repeat(AD_BODY_MAX),
    }), "a card exactly at the limit was refused").not.toHaveProperty("error");
  });

  it("carries the same three caps the content gate holds hand-written ads to", () => {
    // `paid.ts` says these are "mirrored by value from
    // scripts/check-content.mjs's ad rules (advertiser 40 · headline 70 ·
    // body 140)" — the runtime-import constraint every mirrored figure in
    // that file carries. Nothing held them equal, and a bought ad never
    // passes through that script: it is created at runtime.
    //
    // So the two could drift and the pool would carry cards longer than
    // any hand-written one is allowed to be, with both gates green.
    const gate = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), "../../scripts/check-content.mjs"), "utf8");
    const m = /\[\s*\["advertiser",\s*(\d+)\],\s*\["headline",\s*(\d+)\],\s*\["body",\s*(\d+)\]\s*\]/.exec(gate);
    expect(m, "the content gate's ad caps could not be found — this case lost its target").toBeTruthy();
    expect([Number(m![1]), Number(m![2]), Number(m![3])],
      "the runtime bounds and the content gate's have drifted apart")
      .toEqual([AD_ADVERTISER_MAX, AD_HEADLINE_MAX, AD_BODY_MAX]);
  });

  it("refuses a web address in any field — no tap-through means no typed-out link either", () => {
    expect(validatePaidBooking({ ...AD, body: "Visit https://sauna.example today" })).toHaveProperty("error");
    expect(validatePaidBooking({ ...AD, headline: "www.sauna street's finest" })).toHaveProperty("error");
    expect(validatePaidBooking({ ...AD, advertiser: "sauna.no" })).toHaveProperty("error");
    // the regex is check-content's own — hold the mirror to the mirror
    expect(AD_URL_RE.test("plain words about mornings")).toBe(false);
  });

  it("wears at most ONE audience tag (D197 rule 4), the place counting as it", () => {
    expect(validatePaidBooking({ ...AD, dims: { city: "Oslo, NO", ageBand: "25-34" } }))
      .toHaveProperty("error");
    const world = validatePaidBooking({ ...AD, scope: "world", dims: { ageBand: "25-34" } });
    expect("error" in world).toBe(false);
    expect(AD_AUDIENCE_MAX).toBe(1);
  });

  it("welds the scope to its place dim like the question path", () => {
    expect(validatePaidBooking({ ...AD, dims: {} })).toHaveProperty("error");
    expect(validatePaidBooking({ ...AD, scope: "world", dims: { city: "Oslo, NO" } }))
      .toHaveProperty("error");
  });
});

describe("adPriceQuote", () => {
  const card = {
    base: 0.16, floorX: 0.9, ceilX: 2.5, capEur: 320, adBase: 320, floorWeek: 500,
    generated: "2026-08-24", currency: "EUR", fx: {}, trailingDays: 28,
    cohorts: {
      city: { idx: 0.9, booked: [], nextOpen: null },
      country: { idx: 3, booked: [], nextOpen: null },
      world: { idx: 1.5, booked: [], nextOpen: null },
    },
    estimates: {},
  };
  it("is one flat figure — adBase × the clamped idx — and the window", () => {
    expect(adPriceQuote("city", card)).toEqual({ flatEur: 288, windowDays: WINDOW_DAYS });
    expect(adPriceQuote("world", card).flatEur).toBe(480);
    expect(adPriceQuote("country", card).flatEur).toBe(800); // idx 3 clamps to 2.5
  });
});

describe("adStartDay — ads queue, never overlap (D315)", () => {
  const NOW = Date.UTC(2026, 7, 26, 12);
  it("starts tomorrow in an empty scope", () => {
    expect(adStartDay([], NOW)).toBe("2026-08-27");
  });
  it("queues the day after the running ad's window", () => {
    expect(adStartDay([{ until: "2026-09-10" }], NOW)).toBe("2026-09-11");
  });
  it("takes the LATEST running window when several queue", () => {
    expect(adStartDay([{ until: "2026-09-10" }, { until: "2026-10-01" }], NOW)).toBe("2026-10-02");
  });
  it("ignores windows already over — an ended campaign holds no day", () => {
    expect(adStartDay([{ until: "2026-08-01" }], NOW)).toBe("2026-08-27");
  });
  it("dayPlus speaks the same grain", () => {
    expect(dayPlus("2026-08-27", WINDOW_DAYS - 1)).toBe("2026-09-24");
    expect(dayPlus("not-a-day", 3)).toBe("not-a-day");
  });
});

// The half `adStartDay` cannot see: WHICH running ads it should be handed.
//
// The queue exists so a flat-priced ad is not "silently diluted by another
// ad… getting less for the same money". goLive selected the ads to queue
// behind with `scope == b.scope`, and scopes are NESTED audiences, not
// disjoint ones: a world ad matches everybody, and pickPaid gives exactly
// ONE paid slot a day out of a single pool. So a world ad was invisible to
// a city booking's queue and then halved it — 29 days bought, about 14
// served, flat price paid in full.
describe("adAudiencesOverlap — which ads actually compete for the one daily slot", () => {
  const world = { scope: "world", place: null };
  const oslo = { scope: "city", place: "Oslo, NO" };
  const bergen = { scope: "city", place: "Bergen, NO" };
  const norway = { scope: "country", place: "NO" };
  const sweden = { scope: "country", place: "SE" };
  const stockholm = { scope: "city", place: "Stockholm, SE" };

  it("a world ad meets everyone — the case that was invisible", () => {
    expect(adAudiencesOverlap(world, oslo)).toBe(true);
    expect(adAudiencesOverlap(oslo, world)).toBe(true);
    expect(adAudiencesOverlap(world, norway)).toBe(true);
    expect(adAudiencesOverlap(world, world)).toBe(true);
  });

  it("a country ad meets the cities inside it and no others", () => {
    // Derivable exactly: a city place is "<name>, <CC>" and a country
    // place is that same ISO code (pure.ts pins both shapes).
    expect(adAudiencesOverlap(norway, oslo)).toBe(true);
    expect(adAudiencesOverlap(oslo, norway)).toBe(true);
    expect(adAudiencesOverlap(norway, stockholm)).toBe(false);
    expect(adAudiencesOverlap(sweden, stockholm)).toBe(true);
  });

  it("two different cities do not meet, and neither do two different countries", () => {
    // The half that must NOT over-queue: making everything overlap would
    // park a Bergen campaign behind an Oslo one for a month for nothing.
    expect(adAudiencesOverlap(oslo, bergen)).toBe(false);
    expect(adAudiencesOverlap(norway, sweden)).toBe(false);
    expect(adAudiencesOverlap(oslo, oslo)).toBe(true);
    expect(adAudiencesOverlap(norway, norway)).toBe(true);
  });

  it("an unrecognised shape counts as overlapping", () => {
    // The two errors are not equal. Queueing two ads that never meet costs
    // the second buyer TIME; failing to queue two that do costs them half
    // of what they paid for, silently. So a missing place, a malformed
    // city, or a scope this function does not know queues rather than
    // shares.
    expect(adAudiencesOverlap({ scope: "city", place: null }, oslo)).toBe(true);
    expect(adAudiencesOverlap({ scope: "city", place: "Oslo" }, norway)).toBe(true);
    expect(adAudiencesOverlap({ scope: "", place: null }, oslo)).toBe(true);
    expect(adAudiencesOverlap({}, {})).toBe(true);
  });

  it("composed with adStartDay: the world ad now pushes the city booking", () => {
    const NOW = Date.UTC(2026, 7, 26, 12);
    const running = [
      { scope: "world", place: null, window: { until: "2026-09-24" } },
      { scope: "city", place: "Bergen, NO", window: { until: "2026-10-30" } },
    ];
    const mine = oslo;
    const queued = running
      .filter((r) => adAudiencesOverlap(mine, r))
      .map((r) => r.window);
    // The world ad is queued behind; Bergen's later window is NOT, because
    // it never meets an Oslo reader.
    expect(queued).toEqual([{ until: "2026-09-24" }]);
    expect(adStartDay(queued, NOW)).toBe("2026-09-25");
  });
});

describe("paidAdDoc — the webhook writes the ads seed's own shape", () => {
  const doc = paidAdDoc(AD, "2026-08-27", "2026-09-24", 120000);
  it("carries what pickPaid and the band read, and the delta key", () => {
    expect(doc.advertiser).toBe("Harbour Sauna");
    expect(doc.headline).toBe("The water is warmer than you think");
    expect(doc.from).toBe("2026-08-27"); // a queued ad must not serve early
    expect(doc.until).toBe("2026-09-24");
    expect(doc.audience).toEqual({ city: "Oslo, NO" });
    expect(doc.updatedAt).toBeDefined();
  });
  it("omits the audience for an untargeted world ad — emit-when-set", () => {
    const world = paidAdDoc({ ...AD, scope: "world", dims: {} }, "2026-08-27", "2026-09-24", 1);
    expect("audience" in world).toBe(false);
  });
});

describe("paidAdPurchaseDoc — the room reads exactly this", () => {
  const doc = paidAdPurchaseDoc("u1", "paidad-b1", AD, { flatEur: 288, windowDays: 29 }, "2026-08-27", "2026-09-24", "pi_9");
  it("is kind ad with a flat price and no meter fields", () => {
    expect(doc.kind).toBe("ad");
    expect(doc.adId).toBe("paidad-b1");
    expect(doc.priceEur).toBe(288);
    expect(doc.place).toBe("Oslo, NO");
    expect(doc.window).toEqual({ start: "2026-08-27", until: "2026-09-24" });
    expect(doc.state).toBe("running");
    expect("budget" in doc).toBe(false); // nothing to bill against
    expect("reports" in doc).toBe(false); // nothing to report on
    expect(doc.stripePaymentIntent).toBe("pi_9");
  });
});

describe("REVIEW_GUIDELINES — the ad clause", () => {
  it("keeps the ad rules in the prompt", () => {
    expect(REVIEW_GUIDELINES).toMatch(/"kind":"ad" is a FEED AD/i);
    expect(REVIEW_GUIDELINES).toMatch(/miracle claim/i);
    expect(REVIEW_GUIDELINES).toMatch(/political campaign ad/i);
  });
  it("serializes the ad subject with its always-printed advertiser", () => {
    const subj = JSON.parse(reviewSubject(AD, null));
    expect(subj.kind).toBe("ad");
    expect(subj.advertiser).toBe("Harbour Sauna");
    expect(subj.headline).toBeDefined();
  });
  it("gates an ad with no words in it", () => {
    expect(reviewGates({ ...AD, headline: "!!", body: "…" })).toMatch(/write it out/);
    expect(reviewGates(AD)).toBeNull();
  });
});

// The retry queue, and what happens to a booking no automatic reviewer
// will ever settle.
//
// A verdict that does not parse throws — deliberately, so a truncated
// answer never decides a booking — and the sweep retried the hold every
// thirty minutes. Forever: `reviewAttempts` was incremented and read by
// nothing. Each attempt is a billed model call, and because the sweep's
// `createdAt <` inequality forces oldest-first order, an unsettleable
// booking held one of fifty slots for good. Fifty of them — ten free
// accounts at the 5/day budget — starved the queue outright, so a booking
// held behind a REAL outage would never be retried at all.
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

// ── the two status guards nothing could see ─────────────────────────────
//
// `reviewBooking` reads the booking, calls the reviewer, then writes the
// verdict inside a transaction that re-reads it. Both reads refuse
// anything that is not still `review`, and BOTH GUARDS WERE DELETABLE WITH
// EVERY RUNNER GREEN: the e2e drives exactly one trigger-fired review per
// booking and never runs the 30-minute sweep, and `runReviewSweep`'s own
// tests inject a store whose `review` is a stub.
//
// What the guards are worth: without them the sweep re-reviews `declined`
// and `live` bookings, so a decline the buyer has already read is
// overwritten by an approve, and a PAID, LIVE booking is written back to
// approved or declined — stranding a campaign whose purchase row and
// question doc already exist.
//
// No mocking is needed to drive it. `runReviewVerdict` returns
// approve-on-gates-only when no model key is configured, which is what a
// test process is, so the verdict is deterministic and no network is
// touched.
describe("reviewBooking only ever moves a booking OUT of review", () => {
  /** The smallest Firestore this function actually uses: one document,
   *  a transaction that re-reads it, and a record of what was written.
   *  `reads` lets a case change the status BETWEEN the outer read and the
   *  transaction's, which is the race the second guard exists for. */
  function fakeDb(statuses: string[]) {
    const writes: Record<string, unknown>[] = [];
    // Reads are counted because the OUTER guard's whole job is to spend
    // nothing on a booking that is not in review: without it the function
    // runs on to the reviewer and the transaction, and the transaction's
    // own guard — the backstop — refuses the write. So the write count
    // cannot see the outer guard at all; the read count can.
    const reads: string[] = [];
    let n = 0;
    const snapFor = () => {
      const status = statuses[Math.min(n++, statuses.length - 1)];
      reads.push(status);
      return {
        exists: true,
        get: (k: string) => (k === "status" ? status : (BOOKING as Record<string, unknown>)[k]),
      };
    };
    const ref = { get: async () => snapFor(), update: async (u: Record<string, unknown>) => { writes.push(u); } };
    return {
      writes,
      reads,
      db: {
        collection: () => ({ doc: () => ref }),
        runTransaction: async (fn: (tx: unknown) => Promise<void>) => fn({
          get: async () => snapFor(),
          update: (_r: unknown, u: Record<string, unknown>) => { writes.push(u); },
        }),
      } as unknown as Parameters<typeof reviewBooking>[0],
    };
  }

  it("writes a verdict for a booking that is still in review — the control", async () => {
    const f = fakeDb(["review", "review"]);
    await reviewBooking(f.db, "b1");
    expect(f.writes, "the ordinary path stopped writing a verdict").toHaveLength(1);
    expect(f.writes[0].status).toBe("approved");
  });

  it("writes nothing for a booking that is already LIVE — it has been paid for", async () => {
    const f = fakeDb(["live"]);
    await reviewBooking(f.db, "b1");
    expect(f.writes, "a paid, live booking was re-reviewed").toEqual([]);
    // …and it stops at the FIRST read, which is the outer guard's whole
    // point: past it the function calls the reviewer, and in production
    // that is a billed model call for a booking already settled.
    expect(f.reads, "the outer guard let it run on to the reviewer").toHaveLength(1);
  });

  it("writes nothing for a booking already DECLINED — the buyer has read it", async () => {
    const f = fakeDb(["declined"]);
    await reviewBooking(f.db, "b1");
    expect(f.writes).toEqual([]);
  });

  it("writes nothing when the booking leaves review DURING the reviewer call", async () => {
    // The second guard, and the only one the first cannot stand in for:
    // in review at the outer read, live by the time the transaction reads
    // it. That window is exactly as long as the model call.
    const f = fakeDb(["review", "live"]);
    await reviewBooking(f.db, "b1");
    expect(f.writes, "the transaction wrote over a booking that went live mid-review").toEqual([]);
  });
});

// ── what the buyer is actually charged ──────────────────────────────────
//
// Everything from the amount to the sentence describing it is unreachable
// in the emulator: `createPaidCheckoutV2` throws `unavailable` at the
// missing Stripe key one line above, and the e2e asserts exactly that
// refusal. So the whole block ran under nothing — swapping the cap for the
// per-answer rate, or the cents multiplier from 100 to 10, left the
// functions suite and every e2e leg green.
describe("checkoutLineItem — the amount and what the charge says it is for", () => {
  const q = priceQuote("city");
  const ad = adPriceQuote("city");
  const both = { ...q, ...ad } as Parameters<typeof checkoutLineItem>[1];

  it("charges the QUESTION its cap, in cents", () => {
    // The cap, not the per-answer rate: the cap is what is taken, so the
    // unserved part can be refunded at close. Charging the rate would bill
    // €0.14 for a €320 campaign.
    const li = checkoutLineItem(false, both);
    expect(q.capEur).toBe(320);
    expect(li.unit_amount).toBe(32000);
    expect(li.currency).toBe("eur");
  });

  it("charges the AD its flat price, in cents", () => {
    const li = checkoutLineItem(true, both);
    expect(li.unit_amount).toBe(Math.round(ad.flatEur * 100));
    // …and the two are genuinely different numbers, or this case and the
    // one above could not tell the branches apart.
    expect(ad.flatEur).not.toBe(q.capEur);
  });

  it("does not lose or gain a factor of ten on the cents", () => {
    // `* 10` (€3.20) and `* 1000` both leave every other assertion here
    // intact if the amount is only ever compared to itself, so this
    // compares against the euro figure the buyer was quoted.
    for (const isAd of [false, true]) {
      const li = checkoutLineItem(isAd, both);
      const euros = isAd ? ad.flatEur : q.capEur;
      expect(li.unit_amount / 100).toBeCloseTo(euros, 2);
    }
  });

  it("tells the question's buyer the window, the rate and the refund", () => {
    // This sentence is the contract the buyer reads at the moment of
    // paying. Every number in it comes off the locked quote.
    const d = checkoutLineItem(false, both).product_data;
    expect(d.name).toBe("InSight paid question");
    expect(d.description).toContain(`${q.windowDays}-day window`);
    expect(d.description).toContain(`€${q.ratePerAnswer}`);
    expect(d.description).toContain(`up to ${q.cap} answers`);
    expect(d.description).toContain("refunds automatically at close");
  });

  it("tells the ad's buyer a flat price and promises it no refund", () => {
    // The ad has no refund path (D315), so its description must not carry
    // the question's promise — the two products landed on one page once
    // and that is the failure the split exists for.
    const d = checkoutLineItem(true, both).product_data;
    expect(d.name).toBe("InSight feed ad");
    expect(d.description).toContain(`${ad.windowDays}-day window at a flat price`);
    expect(d.description).not.toContain("refunds automatically");
    expect(d.description).not.toContain("per answer");
  });

  it("prints the rate without trailing zeros — it is money, not a float dump", () => {
    const d = checkoutLineItem(false, both).product_data;
    expect(d.description).not.toMatch(/€\d+\.\d*0(\D|$)/);
  });
});
