// The paid places (D195, D372). Three of these are the commercial
// contract made executable — the density, the on-device match, and the
// tail-only rule — and the last block binds the shipped bank to the
// vocabulary the device can actually match, which no other gate sees.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  SPONSOR_EVERY,
  matches,
  orderPaid,
  orderSponsored,
  partitionSponsored,
  pickSponsored,
  pickPaid,
  whyMatched,
  windowLabel,
  linkDomain,
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

describe("the places for paid cards (D372)", () => {
  it("is one in six, and every sponsored card leaves the ordinary stream for them", () => {
    expect(SPONSOR_EVERY).toBe(6);
    const pool = [
      q("feed-a"),
      q("feed-p1", { sponsor: { buyer: "One" } }),
      q("feed-p2", { sponsor: { buyer: "Two" } }),
      q("feed-p3", { sponsor: { buyer: "Three" } }),
      q("feed-b"),
    ];
    const { paid, rest } = partitionSponsored(pool, OSLO, 0);
    // All three come back, each once, in the day's order — the places
    // are theirs. Until D372 one came back and two were held for other
    // days: inventory that did not grow with the app.
    expect(paid.map((p) => (p.kind === "question" ? p.question.id : p.ad.id))).toEqual(["feed-p1", "feed-p2", "feed-p3"]);
    // The load-bearing half: NONE of them stays in the ordinary stream. A
    // paid card in an unpaid place is what the places exist to prevent.
    expect(rest.map((x) => x.id)).toEqual(["feed-a", "feed-b"]);
  });

  it("rotates which comes first by day, so two buyers in one window share the first place", () => {
    const pool = [
      q("feed-p1", { sponsor: { buyer: "One" } }),
      q("feed-p2", { sponsor: { buyer: "Two" } }),
    ];
    expect(orderSponsored(pool, OSLO, 0).map((x) => x.id)).toEqual(["feed-p1", "feed-p2"]);
    expect(orderSponsored(pool, OSLO, 1).map((x) => x.id)).toEqual(["feed-p2", "feed-p1"]);
    expect(pickSponsored(pool, OSLO, 2)?.id).toBe("feed-p1");
    // First-in-bank-order would give one buyer every first impression
    // and the other none, which is inventory nobody could price.
  });

  it("is stable against the order the bank pages arrived in", () => {
    const a = q("feed-p1", { sponsor: { buyer: "One" } });
    const b = q("feed-p2", { sponsor: { buyer: "Two" } });
    expect(orderSponsored([a, b], OSLO, 0).map((x) => x.id)).toEqual(orderSponsored([b, a], OSLO, 0).map((x) => x.id));
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
    const { paid, rest } = partitionSponsored(pool, OSLO, 0);
    expect(paid).toEqual([]);
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

  it("prints a link as its bare domain, and a non-https one as nothing (D373)", () => {
    // Whose page it is, not where on it — the full address on a card is
    // the click-out the ad rules refused.
    expect(linkDomain("https://www.harboursauna.no/winter?utm=x")).toBe("harboursauna.no");
    expect(linkDomain("https://Example.NO")).toBe("example.no");
    expect(linkDomain(undefined)).toBeNull();
    expect(linkDomain("http://harboursauna.no")).toBeNull();
    expect(linkDomain("harboursauna.no")).toBeNull();
    expect(linkDomain("javascript:alert(1)")).toBeNull();
  });
});

describe("the paid places in the stream", () => {
  it("land after every sixth world card, each card once, never first", () => {
    const world = Array.from({ length: 20 }, (_, i) => q(`feed-w${i}`));
    const paid = ["feed-paid-a", "feed-paid-b", "feed-paid-c"].map((id) => q(id, { sponsor: { buyer: "X" } }));
    const woven = interleaveFeed(world, { tests: [], lenses: [], paid, paidEvery: SPONSOR_EVERY });
    const ids = woven.map((x) => x.id);
    // Six world cards, a paid one, six more, the next — positions 6, 12,
    // 18 counted in world cards, which is the rhythm the door prints.
    expect(ids.indexOf("feed-paid-a")).toBe(SPONSOR_EVERY);
    expect(ids.indexOf("feed-paid-b")).toBe(2 * SPONSOR_EVERY + 1);
    expect(ids.indexOf("feed-paid-c")).toBe(3 * SPONSOR_EVERY + 2);
    for (const p of paid) expect(ids.filter((x) => x === p.id)).toHaveLength(1);
    expect(ids[0]).not.toMatch(/paid/);
    expect(ids).toHaveLength(23);
  });

  it("carries only as many as the pool holds — the density is a ceiling, not a quota", () => {
    const world = Array.from({ length: 30 }, (_, i) => q(`feed-w${i}`));
    const woven = interleaveFeed(world, { tests: [], lenses: [], paid: [q("feed-paid", { sponsor: { buyer: "X" } })], paidEvery: SPONSOR_EVERY });
    expect(woven.filter((x) => x.id === "feed-paid")).toHaveLength(1);
    expect(woven).toHaveLength(31);
  });

  it("still delivers every card when the stream is shorter than the rhythm, and still not first", () => {
    // A heavily muted feed must not silently deliver nothing to a buyer
    // — that is the measurement asymmetry billing-on-answers avoids.
    const woven = interleaveFeed([q("feed-w0")], {
      tests: [], lenses: [], paidEvery: SPONSOR_EVERY,
      paid: [q("feed-paid-a", { sponsor: { buyer: "X" } }), q("feed-paid-b", { sponsor: { buyer: "Y" } })],
    });
    expect(woven.map((x) => x.id)).toEqual(["feed-w0", "feed-paid-a", "feed-paid-b"]);
  });

  it("changes nothing when there is no paid card", () => {
    const world = Array.from({ length: 12 }, (_, i) => q(`feed-w${i}`));
    const before = interleaveFeed(world, { tests: [], lenses: [] });
    const after = interleaveFeed(world, { tests: [], lenses: [], paid: [], paidEvery: SPONSOR_EVERY });
    expect(after.map((x) => x.id)).toEqual(before.map((x) => x.id));
  });

  it("holds its depth on a returning device — a short fresh list, continued cadences, still never first (D348)", () => {
    // Three fresh topics out of a twenty-card list. The feed weaves the
    // fresh list and walks the full depth, so the first place lands at
    // its position among the continued cadences: after every fresh topic
    // and after the first test card, never at the head. Before D348 the
    // slot fired against the SIXTH card of the full list, and with the
    // first six answered — the ordinary returning device — the paid card
    // surfaced right behind the answered block, at the top of the feed.
    const fresh = Array.from({ length: 3 }, (_, i) => q(`feed-w${i}`));
    const paid = [q("feed-paid", { sponsor: { buyer: "X" } }), q("feed-paid-2", { sponsor: { buyer: "Y" } })];
    const woven = interleaveFeed(fresh, {
      tests: [q("t0"), q("t1")], lenses: [], paid, paidEvery: SPONSOR_EVERY, depth: 20,
    });
    expect(woven.map((x) => x.id)).toEqual(["feed-w0", "feed-w1", "feed-w2", "t0", "feed-paid", "t1", "feed-paid-2"]);
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

describe("the paid places take both kinds (D197, D372)", () => {
  const ad = (id: string, over: Partial<FeedAd> = {}): FeedAd => ({
    id, advertiser: "Transit", headline: "H", body: "B", until: "2099-01-01", ...over,
  });

  it("a sponsored question and an ad share the same order, and alternate which comes first", () => {
    const qs = [q("feed-p", { sponsor: { buyer: "One" } })];
    const ads = [ad("ad-a")];
    // Two paid things bought for the same window both come back every
    // day; what rotates is the FIRST place, the one most readers reach.
    const day0 = orderPaid(qs, ads, OSLO, 0);
    const day1 = orderPaid(qs, ads, OSLO, 1);
    expect(day0.map((p) => p.kind)).toEqual(["ad", "question"]);
    expect(day1.map((p) => p.kind)).toEqual(["question", "ad"]);
    expect([pickPaid(qs, ads, OSLO, 0)?.kind, pickPaid(qs, ads, OSLO, 1)?.kind].sort()).toEqual(["ad", "question"]);
  });

  it("returns each once, whatever the pool holds", () => {
    const qs = [q("feed-p1", { sponsor: { buyer: "One" } }), q("feed-p2", { sponsor: { buyer: "Two" } })];
    const ads = [ad("ad-a"), ad("ad-b")];
    for (let d = 0; d < 8; d++) {
      const order = orderPaid(qs, ads, OSLO, d);
      expect(order).toHaveLength(4);
      const ids = order.map((p) => (p.kind === "ad" ? p.ad.id : p.question.id));
      expect(new Set(ids).size).toBe(4);
      // A union, so a third kind is not even expressible — what IS worth
      // asserting is that each item is one of the two the union names.
      for (const p of order) expect(["ad", "question"]).toContain(p.kind);
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

  it("partitionSponsored carries the ad in the day's order and still strips every paid question", () => {
    const pool = [q("feed-a"), q("feed-p", { sponsor: { buyer: "One" } })];
    const days = [0, 1].map((d) => partitionSponsored(pool, OSLO, d, [ad("ad-a")], "2026-08-17"));
    for (const r of days) {
      expect(r.rest.map((x) => x.id)).toEqual(["feed-a"]);
      // Both paid things, every day, each once.
      expect(r.paid.map((p) => p.kind).sort()).toEqual(["ad", "question"]);
    }
    // …and over the two days each kind comes first once, so the order is
    // actually exercised on both branches rather than twice on one.
    expect(days.filter((r) => r.paid[0].kind === "ad").length).toBe(1);
    expect(days.filter((r) => r.paid[0].kind === "question").length).toBe(1);
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
