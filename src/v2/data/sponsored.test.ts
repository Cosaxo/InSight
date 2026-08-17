// The paid slot (D194). Three of these are the commercial contract made
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
  whyMatched,
  windowLabel,
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
