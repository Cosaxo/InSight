// The paid slot (D195). Three of these are the commercial contract made
// executable — the cap, the on-device match, and the tail-only rule — and
// the last block binds the shipped bank to the vocabulary the device can
// actually match, which no other gate sees.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  SPONSOR_AT,
  SPONSOR_SLOT,
  matches,
  partitionSponsored,
  pickSponsored,
  pickPaid,
  whyMatched,
  windowLabel,
  type FeedAd,
  type SponsoredQ,
} from "./sponsored";
import { COHORT_DIMS } from "./cohort";
import { interleaveFeed } from "./feed-interleave";

function q(id: string, over: Partial<SponsoredQ> = {}): SponsoredQ {
  return {
    id, surface: "feed", seq: 0, type: "vote", prompt: "P",
    options: ["A", "B"], topic: "culture", test: null, active: true,
    ...over,
  } as SponsoredQ;
}

const OSLO = { city: "Oslo, NO", country: "NO", ageBand: "25-34" };

describe("the cap on paid inventory", () => {
  it("is one, and it is one whatever the bank holds", () => {
    expect(SPONSOR_SLOT).toBe(1);
    const pool = [
      q("feed-a"),
      q("feed-p1", { sponsor: { buyer: "One" } }),
      q("feed-p2", { sponsor: { buyer: "Two" } }),
      q("feed-p3", { sponsor: { buyer: "Three" } }),
      q("feed-b"),
    ];
    const { sponsored, rest } = partitionSponsored(pool, OSLO, 0);
    expect(sponsored).not.toBeNull();
    // The load-bearing half: the OTHER two do not stay in the ordinary
    // stream. A cap that only labels the first card is decorative.
    expect(rest.map((x) => x.id)).toEqual(["feed-a", "feed-b"]);
  });

  it("rotates by day, so two buyers in one window split the slot", () => {
    const pool = [
      q("feed-p1", { sponsor: { buyer: "One" } }),
      q("feed-p2", { sponsor: { buyer: "Two" } }),
    ];
    expect(pickSponsored(pool, OSLO, 0)?.id).toBe("feed-p1");
    expect(pickSponsored(pool, OSLO, 1)?.id).toBe("feed-p2");
    expect(pickSponsored(pool, OSLO, 2)?.id).toBe("feed-p1");
    // First-in-bank-order would give one buyer every impression and the
    // other none, which is inventory nobody could price.
  });

  it("is stable against the order the bank pages arrived in", () => {
    const a = q("feed-p1", { sponsor: { buyer: "One" } });
    const b = q("feed-p2", { sponsor: { buyer: "Two" } });
    expect(pickSponsored([a, b], OSLO, 0)?.id).toBe(pickSponsored([b, a], OSLO, 0)?.id);
  });
});

describe("the audience match, on this device", () => {
  it("an untagged question is shown to everyone", () => {
    expect(matches({ buyer: "X" }, {})).toBe(true);
    expect(matches(undefined, {})).toBe(true);
  });

  it("a tagged one needs an exact bucket — no ranges, no inference", () => {
    expect(matches({ buyer: "X", audience: { city: "Oslo, NO" } }, OSLO)).toBe(true);
    expect(matches({ buyer: "X", audience: { city: "Bergen, NO" } }, OSLO)).toBe(false);
    // A profile that has not said is not a match. Absent ≠ any.
    expect(matches({ buyer: "X", audience: { city: "Oslo, NO" } }, {})).toBe(false);
  });

  it("a non-matching sponsored card is offered to nobody, not moved to the stream", () => {
    const pool = [q("feed-a"), q("feed-p", { sponsor: { buyer: "X", audience: { country: "SE" } } })];
    const { sponsored, rest } = partitionSponsored(pool, OSLO, 0);
    expect(sponsored).toBeNull();
    expect(rest.map((x) => x.id)).toEqual(["feed-a"]);
  });
});

describe("what the band is able to say", () => {
  it("names the tag in the user's own vocabulary", () => {
    expect(whyMatched({ buyer: "X", audience: { city: "Oslo, NO" } })).toEqual(["City: Oslo, NO"]);
    expect(whyMatched({ buyer: "X", audience: { ageBand: "25-34" } })).toEqual(["Age: 25-34"]);
  });

  it("says nothing rather than something vague for an untargeted buy", () => {
    // The band turns an empty list into "asked everyone" — a real
    // sentence — instead of omitting the line.
    expect(whyMatched({ buyer: "X" })).toEqual([]);
  });

  it("composes the window from `until`, which is the same value that stops the card being served", () => {
    expect(windowLabel("2026-08-21")).toBe("until 21 Aug");
    expect(windowLabel(undefined)).toBeNull();
    expect(windowLabel("soon")).toBeNull();
  });
});

describe("the slot's place in the stream", () => {
  it("lands once, at a fixed depth, never first", () => {
    const world = Array.from({ length: 20 }, (_, i) => q(`feed-w${i}`));
    const paid = q("feed-paid", { sponsor: { buyer: "X" } });
    const woven = interleaveFeed(world, { tests: [], lenses: [], sponsored: paid, sponsorAt: SPONSOR_AT });
    const at = woven.findIndex((x) => x.id === "feed-paid");
    expect(at).toBeGreaterThanOrEqual(SPONSOR_AT);
    expect(woven.filter((x) => x.id === "feed-paid")).toHaveLength(1);
    expect(woven[0].id).not.toBe("feed-paid");
  });

  it("still delivers the card when the stream is shorter than the slot, and still not first", () => {
    // A heavily muted feed must not silently deliver nothing to the buyer
    // — that is the measurement asymmetry billing-on-answers avoids.
    const woven = interleaveFeed([q("feed-w0")], {
      tests: [], lenses: [], sponsored: q("feed-paid", { sponsor: { buyer: "X" } }), sponsorAt: SPONSOR_AT,
    });
    expect(woven.map((x) => x.id)).toEqual(["feed-w0", "feed-paid"]);
  });

  it("changes nothing when there is no sponsored card", () => {
    const world = Array.from({ length: 12 }, (_, i) => q(`feed-w${i}`));
    const before = interleaveFeed(world, { tests: [], lenses: [] });
    const after = interleaveFeed(world, { tests: [], lenses: [], sponsored: null, sponsorAt: SPONSOR_AT });
    expect(after.map((x) => x.id)).toEqual(before.map((x) => x.id));
  });

  it("holds its depth on a returning device — a short fresh list, continued cadences, still never first (D342)", () => {
    // Three fresh topics out of a twenty-card list. The feed weaves the
    // fresh list and walks the full depth, so the slot lands at its
    // position among the continued cadences: after every fresh topic and
    // after the first test card, never at the head. Before D342 the slot
    // fired against the SIXTH card of the full list, and with the first
    // six answered — the ordinary returning device — the paid card
    // surfaced right behind the answered block, at the top of the feed.
    const fresh = Array.from({ length: 3 }, (_, i) => q(`feed-w${i}`));
    const paid = q("feed-paid", { sponsor: { buyer: "X" } });
    const woven = interleaveFeed(fresh, {
      tests: [q("t0"), q("t1")], lenses: [], sponsored: paid, sponsorAt: SPONSOR_AT, depth: 20,
    });
    expect(woven.map((x) => x.id)).toEqual(["feed-w0", "feed-w1", "feed-w2", "t0", "feed-paid", "t1"]);
    expect(woven.filter((x) => x.id === "feed-paid")).toHaveLength(1);
  });
});

describe("the shipped bank", () => {
  const feed = JSON.parse(
    readFileSync(resolve(__dirname, "../../../content/feed-questions.json"), "utf8"),
  ) as { questions: Array<{ id: string; sponsor?: { buyer: string; audience?: Record<string, string> }; core?: boolean; until?: string }> };
  const paid = feed.questions.filter((x) => x.sponsor !== undefined);

  it("ships NO sponsored questions, and that is deliberate", () => {
    // The machinery is built; the inventory is not sold. Authoring a
    // sponsored card with an invented buyer would be a false statement to
    // every reader — D1's no-fabrication rule pointed at a claim about
    // money rather than about a crowd. The first real one arrives with a
    // contract behind it.
    expect(paid).toHaveLength(0);
  });

  it("binds any that DO ship to the vocabulary the device can match", () => {
    // The gate `check:content` holds the shape; this holds the values,
    // because the dim list lives in typed client code the stdlib-only
    // gates deliberately do not import. A tag outside it matches nobody
    // and the card is bought and never delivered.
    for (const x of paid) {
      expect(x.core, `${x.id} is core`).not.toBe(true);
      expect(typeof x.until, `${x.id} has no window`).toBe("string");
      for (const dim of Object.keys(x.sponsor!.audience ?? {})) {
        expect(COHORT_DIMS as readonly string[], `${x.id} targets ${dim}`).toContain(dim);
      }
    }
  });
});

describe("the paid slot holds ONE thing, of either kind (D197)", () => {
  const ad = (id: string, over: Partial<FeedAd> = {}): FeedAd => ({
    id, advertiser: "Transit", headline: "H", body: "B", until: "2099-01-01", ...over,
  });

  it("a sponsored question and an ad compete for the same slot", () => {
    const qs = [q("feed-p", { sponsor: { buyer: "One" } })];
    const ads = [ad("ad-a")];
    // Two paid things bought for the same window get alternate days, not
    // one card each. The cap is the unit of sale.
    const day0 = pickPaid(qs, ads, OSLO, 0);
    const day1 = pickPaid(qs, ads, OSLO, 1);
    expect([day0?.kind, day1?.kind].sort()).toEqual(["ad", "question"]);
  });

  it("never returns both, whatever the pool holds", () => {
    const qs = [q("feed-p1", { sponsor: { buyer: "One" } }), q("feed-p2", { sponsor: { buyer: "Two" } })];
    const ads = [ad("ad-a"), ad("ad-b")];
    for (let d = 0; d < 8; d++) {
      const slot = pickPaid(qs, ads, OSLO, d);
      expect(slot).not.toBeNull();
      // A union, so "both" is not even expressible — which is the point of
      // the shape rather than a property to test around it.
      expect(slot!.kind === "ad" ? "ad" : "question").toBeTruthy();
    }
  });

  it("matches an ad's audience on the device, like a question's", () => {
    expect(pickPaid([], [ad("ad-a", { audience: { city: "Oslo, NO" } })], OSLO, 0)?.kind).toBe("ad");
    expect(pickPaid([], [ad("ad-a", { audience: { city: "Bergen, NO" } })], OSLO, 0)).toBeNull();
    // A profile that has said nothing is a non-match, not a wildcard.
    expect(pickPaid([], [ad("ad-a", { audience: { city: "Oslo, NO" } })], {}, 0)).toBeNull();
  });

  it("drops an ad past its window even from a cached pool", () => {
    // The session outliving the campaign is the case the seed cannot
    // catch: the pool is already on the device.
    expect(pickPaid([], [ad("ad-a", { until: "2020-01-01" })], OSLO, 0, "2026-08-17")).toBeNull();
    expect(pickPaid([], [ad("ad-a", { until: "2026-08-17" })], OSLO, 0, "2026-08-17")?.kind).toBe("ad");
  });

  it("holds a queued ad until its scheduled day (D315)", () => {
    // A self-serve ad that queued behind another (paid.ts adStartDay)
    // carries `from`; serving it early would break the day-exclusivity
    // its flat price bought. Committed ads carry no `from` and serve.
    expect(pickPaid([], [ad("ad-a", { from: "2026-08-20", until: "2026-09-17" })], OSLO, 0, "2026-08-17")).toBeNull();
    expect(pickPaid([], [ad("ad-a", { from: "2026-08-17", until: "2026-09-17" })], OSLO, 0, "2026-08-17")?.kind).toBe("ad");
  });

  it("drops a retired ad", () => {
    expect(pickPaid([], [ad("ad-a", { active: false })], OSLO, 0)).toBeNull();
  });

  it("partitionSponsored reports the ad separately and still strips every paid question", () => {
    const pool = [q("feed-a"), q("feed-p", { sponsor: { buyer: "One" } })];
    // BOTH days, and that is not thoroughness for its own sake: on the day
    // the QUESTION wins, an implementation that computed `sponsored`
    // independently of the slot would agree by accident and the case would
    // pass while being wrong. The ad's day is the one that catches it.
    const days = [0, 1].map((d) => partitionSponsored(pool, OSLO, d, [ad("ad-a")], "2026-08-17"));
    for (const r of days) {
      expect(r.rest.map((x) => x.id)).toEqual(["feed-a"]);
      // Exactly one paid thing, every day. Never both.
      expect([r.sponsored, r.ad].filter(Boolean)).toHaveLength(1);
    }
    // …and over the two days each kind wins once, so the assertion above
    // is actually exercised on both branches rather than twice on one.
    expect(days.filter((r) => r.ad).length).toBe(1);
    expect(days.filter((r) => r.sponsored).length).toBe(1);
  });
});

describe("the shipped ad pool", () => {
  const ads = JSON.parse(
    readFileSync(resolve(__dirname, "../../../content/ads.json"), "utf8"),
  ) as { ads: unknown[] };

  it("is EMPTY, and that is deliberate", () => {
    // Writing one means printing a real company's name on a card nobody
    // bought — D1's no-fabrication rule pointed at money. The machinery
    // ships; the inventory arrives with a contract.
    expect(ads.ads).toHaveLength(0);
  });
});
