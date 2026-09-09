// Unit tests for the arranged-competition pure layer (D390). Plain node —
// the callables' Firestore glue stays thin; everything decidable is
// decided here, the pure.ts discipline.
import { describe, expect, it } from "vitest";
import { mulberry32, generateForm, version as GEN_VERSION } from "./logic-gen";
import {
  BAND, BLIND_SHARE, CONTEST_DEADLINE_MS, CONTEST_ITEMS, CONTEST_WINDOW_MS, EXPOSURE_CAP_POINTS, OFFER_TTL_MS, STAKE_POINTS, START_POINTS,
  applyResult, bookExposure, contestClientItems, drawStake, emptySummary, exposureWithin, isEligible, newContest, outcomeFor,
  pairPlayers, respond, scoreContestPicks, settle, stakesContrast, startSide,
  type ContestAttemptDoc, type ContestDoc, type ContestPlayer,
} from "./contest";

const NOW = Date.UTC(2026, 8, 9, 9, 5, 0);
const player = (uid: string, rating: number | null, over: Partial<ContestPlayer["summary"]> = {}): ContestPlayer => ({
  uid,
  name: uid.toUpperCase(),
  summary: { ...emptySummary(rating), optIn: { v: 1, atMs: NOW - 1 }, ...over },
});

describe("eligibility (paper 8 §6: consent, an anchor, one contest at a time, a cumulative exposure cap)", () => {
  it("needs opt-in, a verified rating, no open contest, and room under the exposure cap", () => {
    expect(isEligible(player("p", 50), NOW)).toBe(true);
    expect(isEligible(player("p", null), NOW)).toBe(false);
    expect(isEligible({ ...player("p", 50), summary: { ...emptySummary(50) } }, NOW)).toBe(false);
    expect(isEligible(player("p", 50, { optIn: { v: 1, atMs: NOW - 5, offMs: NOW - 1 } }), NOW)).toBe(false);
    expect(isEligible(player("p", 50, { openCid: "c1" }), NOW)).toBe(false);
    const nearCap = player("p", 50, { exposure: [{ atMs: NOW - 1000, points: EXPOSURE_CAP_POINTS - Math.max(...STAKE_POINTS) + 1 }] });
    expect(isEligible(nearCap, NOW)).toBe(false);
    const oldExposure = player("p", 50, { exposure: [{ atMs: NOW - 8 * 86_400_000, points: 1000 }] });
    expect(exposureWithin(oldExposure.summary.exposure, NOW)).toBe(0);
    expect(isEligible(oldExposure, NOW)).toBe(true);
  });
});

describe("the matcher records its rule and its realised probability", () => {
  const pool = Array.from({ length: 40 }, (_, i) => player(`u${i}`, (i * 7) % 100));

  it("pairs everyone it can, each pairing carrying rule, pool and 1/pool", () => {
    const { pairs, unpaired } = pairPlayers(pool, mulberry32(11), NOW);
    expect(pairs.length).toBe(20);
    expect(unpaired.length).toBe(0);
    for (const p of pairs) {
      expect(p.match.p).toBeCloseTo(1 / p.match.pool, 12);
      expect(p.match.pool).toBeGreaterThan(0);
      expect(["band", "blind", "band-empty"]).toContain(p.match.rule);
      if (p.match.rule === "band") {
        expect(Math.abs((p.a.summary.rating ?? 0) - (p.b.summary.rating ?? 0))).toBeLessThanOrEqual(BAND);
        expect(p.match.blind).toBe(false);
      } else {
        expect(p.match.blind).toBe(true);
      }
      expect(STAKE_POINTS).toContain(p.stake.points);
    }
  });

  it("draws the blind share at about the stated rate over many sweeps, and two stake levels about equally", () => {
    let blind = 0;
    let total = 0;
    let high = 0;
    for (let s = 0; s < 200; s += 1) {
      const { pairs } = pairPlayers(pool, mulberry32(1000 + s), NOW);
      for (const p of pairs) {
        total += 1;
        if (p.match.rule === "blind") blind += 1;
        if (p.stake.level === 1) high += 1;
      }
    }
    expect(Math.abs(blind / total - BLIND_SHARE)).toBeLessThan(0.05);
    expect(Math.abs(high / total - 0.5)).toBeLessThan(0.05);
  });

  it("is replayable from its seed, and skips the ineligible", () => {
    const withOpen = [...pool, player("busy", 50, { openCid: "x" }), player("noRating", null)];
    const one = pairPlayers(withOpen, mulberry32(3), NOW);
    const two = pairPlayers(withOpen, mulberry32(3), NOW);
    expect(one.pairs.map((p) => [p.a.uid, p.b.uid, p.match.rule, p.stake.level])).toEqual(two.pairs.map((p) => [p.a.uid, p.b.uid, p.match.rule, p.stake.level]));
    const paired = new Set(one.pairs.flatMap((p) => [p.a.uid, p.b.uid]));
    expect(paired.has("busy")).toBe(false);
    expect(paired.has("noRating")).toBe(false);
  });

  it("falls back to a uniform draw, labelled, when nobody is in the band", () => {
    const far = [player("lo", 1), player("hi", 99)];
    const { pairs } = pairPlayers(far, () => 0.9, NOW); // 0.9 > BLIND_SHARE → band → empty → band-empty
    expect(pairs.length).toBe(1);
    expect(pairs[0].match.rule).toBe("band-empty");
    expect(pairs[0].match.blind).toBe(true);
  });

  it("a stake is one of the two levels", () => {
    expect(drawStake(() => 0.1)).toEqual({ level: 0, points: STAKE_POINTS[0] });
    expect(drawStake(() => 0.9)).toEqual({ level: 1, points: STAKE_POINTS[1] });
  });
});

describe("the offer: randomized offer, chosen acceptance, recorded per side", () => {
  const a = player("a", 40);
  const b = player("b", 50);
  const c = newContest(a, b, { rule: "band", pool: 3, band: BAND, p: 1 / 3, blind: false }, { level: 1, points: 50 }, NOW);

  it("a fresh contest is offered, prior-informed when the band read the score, with its expiry", () => {
    expect(c.status).toBe("offered");
    expect(c.role).toBe("prior-informed");
    expect(c.offerExpiresAtMs).toBe(NOW + OFFER_TTL_MS);
    expect(newContest(a, b, { rule: "blind", pool: 3, band: BAND, p: 1 / 3, blind: true }, { level: 0, points: 10 }, NOW).role).toBe("blind");
  });

  it("opens only when both accept, closes on either decline, refuses strangers, repeats and expiry", () => {
    const r1 = respond(c, "a", true, NOW + 1);
    expect(r1.ok && r1.value.status).toBe("offered");
    const r2 = respond((r1 as { ok: true; value: ContestDoc }).value, "b", true, NOW + 2);
    expect(r2.ok && r2.value.status).toBe("open");
    expect(r2.ok && r2.value.windowEndsMs).toBe(NOW + 2 + CONTEST_WINDOW_MS);
    const d = respond(c, "b", false, NOW + 1);
    expect(d.ok && d.value.status).toBe("declined");
    expect(respond(c, "stranger", true, NOW).ok).toBe(false);
    expect(respond((r1 as { ok: true; value: ContestDoc }).value, "a", true, NOW + 3).ok).toBe(false);
    expect(respond(c, "a", true, NOW + OFFER_TTL_MS + 1).ok).toBe(false);
  });
});

describe("the sitting and the scoring", () => {
  it("a side starts once, keeps its deadline on resume, never past the window, and cannot start twice scored", () => {
    const w = NOW + CONTEST_WINDOW_MS;
    const s = startSide({}, NOW, w);
    expect(s.ok && s.value.resumed).toBe(false);
    expect(s.ok && s.value.side.deadlineMs).toBe(NOW + CONTEST_DEADLINE_MS);
    const late = startSide({}, w - 1000, w);
    expect(late.ok && late.value.side.deadlineMs).toBe(w);
    const resumed = startSide({ startedAtMs: NOW, deadlineMs: NOW + CONTEST_DEADLINE_MS }, NOW + 5000, w);
    expect(resumed.ok && resumed.value.resumed).toBe(true);
    expect(startSide({ startedAtMs: NOW, deadlineMs: NOW + 10 }, NOW + 20, w).ok).toBe(false);
    expect(startSide({ scoredAtMs: NOW }, NOW, w).ok).toBe(false);
    expect(startSide({}, w + 1, w).ok).toBe(false);
  });

  it("scores the first twelve items of the same form the seed yields, and discloses no answer index", () => {
    const seed = 123456;
    const form = generateForm(seed, GEN_VERSION);
    const perfect = form.items.slice(0, CONTEST_ITEMS).map((it) => it.a);
    expect(scoreContestPicks(seed, GEN_VERSION, perfect).score).toBe(CONTEST_ITEMS);
    expect(scoreContestPicks(seed, GEN_VERSION, perfect.map(() => -1)).score).toBe(0);
    const items = contestClientItems(seed, GEN_VERSION);
    expect(items.length).toBe(CONTEST_ITEMS);
    for (const it of items) expect(Object.keys(it).sort()).toEqual(["cells", "diff", "opts"]);
  });
});

describe("settlement (paper 8 §6: a forfeit is an outcome; a stake is never a debt)", () => {
  const base: ContestDoc = { ...newContest(player("a", 40), player("b", 50), { rule: "blind", pool: 2, band: BAND, p: 0.5, blind: true }, { level: 1, points: 50 }, NOW), status: "open", openedAtMs: NOW, windowEndsMs: NOW + CONTEST_WINDOW_MS };
  const att = (a: Partial<ContestAttemptDoc["a"]>, b: Partial<ContestAttemptDoc["b"]>): ContestAttemptDoc => ({ cid: "c", seed: 1, gv: GEN_VERSION, items: CONTEST_ITEMS, a, b });

  it("both scored: the higher score wins the stake, a tie moves nothing", () => {
    expect(settle(base, att({ scoredAtMs: 1, score: 9 }, { scoredAtMs: 2, score: 4 }), { a: 500, b: 500 }, NOW + 10)).toEqual({ outcome: "a", transfer: 50, settledAtMs: NOW + 10 });
    expect(settle(base, att({ scoredAtMs: 1, score: 3 }, { scoredAtMs: 2, score: 4 }), { a: 500, b: 500 }, NOW + 10)?.outcome).toBe("b");
    expect(settle(base, att({ scoredAtMs: 1, score: 4 }, { scoredAtMs: 2, score: 4 }), { a: 500, b: 500 }, NOW + 10)).toEqual({ outcome: "tie", transfer: 0, settledAtMs: NOW + 10 });
  });

  it("one scored inside the window: not settleable yet; after the window the other forfeits", () => {
    expect(settle(base, att({ scoredAtMs: 1, score: 9 }, {}), { a: 500, b: 500 }, NOW + 10)).toBeNull();
    const after = NOW + CONTEST_WINDOW_MS + 1;
    expect(settle(base, att({ scoredAtMs: 1, score: 9 }, {}), { a: 500, b: 500 }, after)?.outcome).toBe("forfeit-b");
    expect(settle(base, att({}, { scoredAtMs: 1, score: 2 }), { a: 500, b: 500 }, after)?.outcome).toBe("forfeit-a");
    expect(settle(base, att({}, {}), { a: 500, b: 500 }, after)).toEqual({ outcome: "none", transfer: 0, settledAtMs: after });
  });

  it("the transfer is capped by the loser's balance", () => {
    expect(settle(base, att({ scoredAtMs: 1, score: 9 }, { scoredAtMs: 2, score: 4 }), { a: 500, b: 30 }, NOW + 10)?.transfer).toBe(30);
    expect(settle(base, att({ scoredAtMs: 1, score: 9 }, { scoredAtMs: 2, score: 4 }), { a: 500, b: 0 }, NOW + 10)?.transfer).toBe(0);
  });

  it("folds into both summaries, clears the open contest, and reads correctly from each side", () => {
    const r = { outcome: "a" as const, transfer: 50, settledAtMs: NOW };
    const sa = bookExposure(emptySummary(40), base.stake, "c", NOW);
    const sb = bookExposure(emptySummary(50), base.stake, "c", NOW);
    expect(sa.openCid).toBe("c");
    expect(exposureWithin(sa.exposure, NOW + 1)).toBe(50);
    const { a, b } = applyResult(sa, sb, r);
    expect(a.points).toBe(START_POINTS + 50);
    expect(b.points).toBe(START_POINTS - 50);
    expect([a.n, a.w, a.l, a.t]).toEqual([1, 1, 0, 0]);
    expect([b.n, b.w, b.l, b.t]).toEqual([1, 0, 1, 0]);
    expect(a.openCid).toBeNull();
    expect(outcomeFor(r, "a")).toBe("win");
    expect(outcomeFor(r, "b")).toBe("loss");
    expect(outcomeFor({ outcome: "forfeit-b", transfer: 50, settledAtMs: NOW }, "b")).toBe("forfeited");
    expect(outcomeFor({ outcome: "forfeit-b", transfer: 50, settledAtMs: NOW }, "a")).toBe("walkover");
    const none = applyResult(sa, sb, { outcome: "none", transfer: 0, settledAtMs: NOW });
    expect([none.a.n, none.a.points]).toEqual([0, START_POINTS]);
  });
});

describe("the first reading: the stakes contrast per person (paper 8 §4.1)", () => {
  it("is null until each level has two contests, then a mean difference with its standard error", () => {
    expect(stakesContrast([{ level: 0, score: 5, items: 12 }, { level: 1, score: 7, items: 12 }])).toBeNull();
    const r = stakesContrast([
      { level: 0, score: 5, items: 12 }, { level: 0, score: 7, items: 12 },
      { level: 1, score: 8, items: 12 }, { level: 1, score: 10, items: 12 },
    ]);
    expect(r).not.toBeNull();
    expect(r!.contrast).toBeCloseTo(3 / 12, 10);
    expect(r!.se).toBeGreaterThan(0);
    expect(r!.low.n).toBe(2);
    expect(r!.high.n).toBe(2);
  });
});
