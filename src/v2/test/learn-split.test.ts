// @vitest-environment jsdom
//
// The LEARN_SPLIT source seam (D32), as D149 left it.
//
// The seam used to have three states — demo, live-but-cold, live-with-data
// — and the middle one drew the AUTHORED estimate with a label under it
// saying so. Honest, and still the wrong thing on screen: `card.p` is a
// difficulty hint a writer typed while writing the card, and drawing it as
// bars makes it look like a reading of a crowd however the footer is
// worded. A reader reads the bars.
//
// So in a live build there are two states, and these cases pin them: a
// measurement, or nothing. LEARN_SPLIT returns null and LEARN_RATE returns
// a null `pct` rather than falling back — null rather than 0 for the D72
// reason, so a caller that forgets the check draws something obviously
// broken instead of quietly claiming nobody gets the card right. The demo
// build keeps the authored model, because there the fabricated crowd IS
// the content and there is no aggregate to replace it.
//
// LEARN_COUNTS is the other half: the reveal shows HOW MANY people picked
// each option, so the raw counts are carried rather than recovered from a
// percentage.
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
// Named imports from an untyped .js spec module (D109) — the suppressions are
// scoped to exactly that (TS7016), the purge-wipe precedent.
// @ts-expect-error TS7016 — untyped spec module
import { LEARN_CARDS, LEARN_COUNTS as countsAny, LEARN_ORDER as orderAny, LEARN_RATE as rateAny, LEARN_SPLIT as splitAny, LEARN_SPLIT_SRC } from "../spec/learn-data.js";
import LIVE from "../data/live";

interface LearnCard {
  id: string;
  c: number;
  p: number;
  a: string[];
}
// `W.LIVE = {…}` is the seam these cases drive, and since D354 it installs
// the stand-in's members ONTO the imported store singleton rather than
// assigning a second object to `window.LIVE`: learn-data.js imports the
// binding now, so an object on the global would reach nobody and every
// live case here would assert against `enabled: false` — the demo path —
// which is the vacuous pass test/live-fixture.ts's header describes. The
// setter keeps the seventeen call sites reading as they always did; the
// afterEach puts the real descriptors back, so the un-booted store is
// exactly what the demo cases see. A member a stand-in omits is therefore
// the REAL member, not an absent one (see "no learnMine" below).
type Store = Record<string, unknown>;
const store = LIVE as unknown as Store;
const realDescriptors = new Map<string, PropertyDescriptor | undefined>();
function restoreLive() {
  for (const [k, d] of realDescriptors) {
    if (d) Object.defineProperty(store, k, d);
    else delete store[k];
  }
  realDescriptors.clear();
}
function installLive(members: Store) {
  restoreLive();
  for (const [k, v] of Object.entries(members)) {
    realDescriptors.set(k, Object.getOwnPropertyDescriptor(store, k));
    Object.defineProperty(store, k, { value: v, configurable: true, writable: true, enumerable: true });
  }
}
const W = { set LIVE(members: Store) { installLive(members); } };

const card = (LEARN_CARDS as LearnCard[])[0]; // cell1 — correct index 0, 4 options

// The module is untyped, so its export arrives as `any` and every
// `.reduce((a, b) => …)` below would infer implicit-any parameters. Named once
// here rather than annotated at each call site.
const LEARN_SPLIT: (c: LearnCard) => number[] | null = splitAny;
const LEARN_ORDER: (c: LearnCard) => number[] = orderAny;
const LEARN_RATE: (c: LearnCard) => { pct: number | null; src: string } = rateAny;
const LEARN_COUNTS: (c: LearnCard) => { counts: number[]; total: number } | null = countsAny;
const ALL_CARDS = LEARN_CARDS as LearnCard[];

afterEach(() => {
  restoreLive();
});

describe("LEARN_SPLIT source seam (D32, as D149 left it)", () => {
  it("demo mode: the authored model, reported as an estimate", () => {
    // Unchanged. The demo has no aggregate and its whole population is
    // authored, so the model is the content rather than a stand-in for a
    // measurement that could arrive.
    expect(LEARN_SPLIT_SRC(card)).toBe("estimate");
    const split = LEARN_SPLIT(card)!;
    expect(split[card.c]).toBe(card.p);
    expect(split.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("live with a published agg: the measured split, normalised to 100", () => {
    W.LIVE = {
      enabled: true,
      learnAgg: () => ({ tooSmall: false, total: 9, counts: { "0": 6, "1": 3 } }),
    };
    expect(LEARN_SPLIT_SRC(card)).toBe("measured");
    const split = LEARN_SPLIT(card)!;
    expect(split.reduce((a, b) => a + b, 0)).toBe(100);
    // 6/9 and 3/9 → floors 66/33, remainder point to the first option
    expect(split).toEqual([67, 33, 0, 0]);
  });

  it("never prints a smaller count at a larger percentage", () => {
    // The rule here used to floor each share and hand the leftover points
    // out round-robin FROM INDEX 0 — the extra points went to whichever
    // options came first rather than to the ones closest to their next
    // whole point. [203, 368, 305, 369] came out [17, 30, 24, 29], so 368
    // people read as 30% beside 369 people at 29%, next to the true counts
    // on the same row. Same defect the daily split carried until
    // 2026-08-25; same fix, the one rounding rule in data/pct.ts.
    W.LIVE = {
      enabled: true,
      learnAgg: () => ({
        tooSmall: false, total: 1245,
        counts: { "0": 203, "1": 368, "2": 305, "3": 369 },
      }),
    };
    const split = LEARN_SPLIT(card)!;
    expect(split.reduce((a, b) => a + b, 0)).toBe(100);
    // The option with the most answers must carry the largest share, and
    // no pair may be inverted.
    expect(split[3]).toBeGreaterThanOrEqual(split[1]);
    const counts = [203, 368, 305, 369];
    for (let i = 0; i < counts.length; i++) {
      for (let j = 0; j < counts.length; j++) {
        if (counts[i] > counts[j]) {
          expect(split[i], `${counts[i]} drawn below ${counts[j]}`).toBeGreaterThanOrEqual(split[j]);
        }
      }
    }
  });

  it("live and cold: nothing, never the authored estimate (D149)", () => {
    // The three ways a live card can have no measurement. Each used to
    // hand back `card.p` shaped like crowd data; each now hands back
    // nothing, and the reveal says nobody has answered yet.
    for (const learnAgg of [
      () => ({ tooSmall: true }),
      () => null,
      // a published-shape doc with zeroed counts must not divide by zero
      () => ({ tooSmall: false, counts: {} }),
    ]) {
      W.LIVE = { enabled: true, learnAgg };
      expect(LEARN_SPLIT_SRC(card)).toBe("none");
      expect(LEARN_SPLIT(card)).toBeNull();
      expect(LEARN_RATE(card).pct).toBeNull();
      expect(LEARN_COUNTS(card)).toBeNull();
    }
  });

  it("never reports an estimate in a live build", () => {
    // The label is not just unused there — it would describe something
    // that is not on screen. Held across the whole bank so a card with an
    // unusual shape cannot slip back to the old path.
    W.LIVE = { enabled: true, learnAgg: () => null };
    for (const c of ALL_CARDS) {
      expect(LEARN_SPLIT_SRC(c), `${c.id} still offers an estimate live`).toBe("none");
    }
  });
});

describe("LEARN_COUNTS — how many actually picked each option (D149)", () => {
  it("hands back the raw counts and their total, not shares", () => {
    // The reveal leads with the count because the count is the fact: "31
    // people picked this" survives being read alone, where "62%" of an
    // unstated denominator is the shape the authored estimate wore.
    W.LIVE = {
      enabled: true,
      learnAgg: () => ({ total: 9, counts: { "0": 6, "1": 3 } }),
    };
    expect(LEARN_COUNTS(card)).toEqual({ counts: [6, 3, 0, 0], total: 9 });
  });

  it("counts the options the card has, keyed the way answers are stored", () => {
    // The aggregate's cells are keyed by AUTHORED index — LEARN_ORDER
    // permutes on the way to the screen only — so a dense array of the
    // card's own length is the right shape and an option nobody picked is
    // a real zero rather than a gap.
    W.LIVE = { enabled: true, learnAgg: () => ({ total: 2, counts: { "3": 2 } }) };
    const m = LEARN_COUNTS(card)!;
    expect(m.counts).toHaveLength(card.a.length);
    expect(m.counts[3]).toBe(2);
    expect(m.total).toBe(2);
  });

  it("is null in the demo, where there is nothing measured to count", () => {
    expect(LEARN_COUNTS(card)).toBeNull();
  });
});

// ── your own answer is in the number you are shown (D157) ───────────
//
// `learnAnswer` writes the answer and re-reads the aggregate in the same
// breath; a Firestore trigger cannot fold, transact and commit inside one
// client round-trip, so it loses. That was called acceptable when the
// crowd was assumed to be large — "one answer does not move the split" —
// and it is exactly wrong at the size a launched app actually starts at.
// The reported symptom: a tick on the option the reader chose, with
// "0 people · 0%" beside it.
describe("LEARN_COUNTS folds in the answer the trigger has not caught yet", () => {
  const withMine = (agg: unknown, mine: unknown) =>
    ({ enabled: true, learnAgg: () => agg, learnMine: () => mine });

  it("adds your pick when the published doc does not have it yet", () => {
    // One stranger, on the wrong option. Before this, the correct answer
    // read "0 people · 0%" one line under "One more and it's yours".
    W.LIVE = withMine({ total: 1, counts: { "1": 1 } }, { idx: 0, folded: false });
    expect(LEARN_COUNTS(card)).toEqual({ counts: [1, 1, 0, 0], total: 2 });
  });

  it("does not add it twice once the trigger has folded it", () => {
    W.LIVE = withMine({ total: 2, counts: { "0": 1, "1": 1 } }, { idx: 0, folded: true });
    expect(LEARN_COUNTS(card)).toEqual({ counts: [1, 1, 0, 0], total: 2 });
  });

  it("leaves a card this session did not answer alone", () => {
    W.LIVE = withMine({ total: 4, counts: { "0": 3, "2": 1 } }, null);
    expect(LEARN_COUNTS(card)).toEqual({ counts: [3, 0, 1, 0], total: 4 });
  });

  it("still refuses a card with no published aggregate at all", () => {
    // "You're the first" is the true and better sentence there, and a
    // one-answer split of your own answer would be a bar chart of you.
    W.LIVE = withMine(null, { idx: 0, folded: false });
    expect(LEARN_COUNTS(card)).toBeNull();
    expect(LEARN_SPLIT_SRC(card)).toBe("none");
  });

  it("survives a store with no learnMine at all", () => {
    // This case used to justify a defensive `L.learnMine ? … : null` read
    // with "an older shell is a real deployment" — but the store and the
    // spec layer ship in one bundle, so there is no version to skew, and
    // D354 dropped the guard with the bridge read. What the case pins now
    // is the honest version of the same sentence: a stand-in that omits
    // `learnMine` leaves the REAL member in place, and the un-booted store
    // has recorded no first try, so it answers null and adds nothing.
    W.LIVE = { enabled: true, learnAgg: () => ({ total: 1, counts: { "1": 1 } }) };
    expect(LEARN_COUNTS(card)).toEqual({ counts: [0, 1, 0, 0], total: 1 });
  });

  it("moves the split with the count, so bars and numbers agree", () => {
    W.LIVE = withMine({ total: 1, counts: { "1": 1 } }, { idx: 0, folded: false });
    expect(LEARN_SPLIT(card)).toEqual([50, 50, 0, 0]);
    expect(LEARN_RATE(card)).toEqual({ pct: 50, src: "measured" });
  });
});

describe("LEARN_ORDER breaks the positional tell", () => {
  const cards = LEARN_CARDS as LearnCard[];

  it("returns a permutation of the card's own option indices, stably", () => {
    for (const c of cards) {
      const order = LEARN_ORDER(c);
      expect(order.slice().sort(), `${c.id} is not a permutation`).toEqual(
        c.a.map((_, i) => i),
      );
      expect(LEARN_ORDER(c), `${c.id} is not stable`).toEqual(order);
    }
  });

  it("no display slot is the answer across the bank", () => {
    // The defect this exists for: the bank's first 96 cards all authored the
    // correct answer at index 0, so before the permutation the first button
    // was right 96 times out of 96 and Learn scored reading position. Cards
    // written since vary `c` too, but the permutation is the guarantee and
    // this case is what holds it — a bank drifting back to one authored index
    // must stay harmless rather than become a tell again. Bounded rather
    // than pinned to today's counts — the guarantee is "no slot pays", not a
    // particular histogram, and a bank that grows moves the numbers.
    const slots = new Map<number, number>();
    for (const c of cards) {
      const slot = LEARN_ORDER(c).indexOf(c.c);
      slots.set(slot, (slots.get(slot) ?? 0) + 1);
    }
    const worst = Math.max(...slots.values());
    expect(
      worst / cards.length,
      `the best single guess wins ${worst}/${cards.length} — a positional strategy pays again`,
    ).toBeLessThan(0.5);
  });

  it("keeps the authored index as the recorded one", () => {
    // The half a permutation could get wrong in the direction that matters:
    // renderKnow must hand setKnow the AUTHORED index, never the slot, or
    // every stored answer and every learn-<id> aggregate cell is re-keyed
    // against a bank nobody edited. Source-pinned like the D89/D95 cases
    // below — learn-reserve.test.jsx drives the behaviour (it clicks the
    // button by its correct-answer LABEL and asserts the streak credits),
    // and this names the line that has to stay true for that to keep working.
    const src = readFileSync(resolve(__dirname, "../spec/world-feed.jsx"), "utf8");
    const start = src.indexOf("LEARN_ORDER(card).map(");
    expect(start, "renderKnow no longer maps a display order — repoint this pin").toBeGreaterThan(-1);
    const block = src.slice(start, src.indexOf("</button>", start));
    expect(block).toMatch(/onClick=\{\(\) => this\.setKnow\(q, ai\)\}/);
    expect(block).toMatch(/const isC = !!r && ai === r\.correct;/);
    expect(block).toMatch(/const pct = split \? split\[ai\] : 0;/);
  });
});

describe("the reveal reads its split and its label together (D125)", () => {
  // The defect: LEARN.answer() evaluates LEARN_SPLIT once, at the instant
  // of the tap, and renderKnow used to render `r.split` — a frozen copy —
  // while the footer below it re-evaluated LEARN_SPLIT_SRC on every
  // render. One aggregate arriving late and the two disagreed: authored
  // bars under the sentence "Real answers from N+ players", which is
  // precisely the fabrication D32's seam exists to prevent.
  //
  // Source-pinned rather than mounted, like the D89/D95 cases above: the
  // behaviour IS which expression the two readings come from, and driving
  // it through a mount would need a live store notify mid-reveal.
  const src = readFileSync(resolve(__dirname, "../spec/world-feed.jsx"), "utf8");
  const body = src.slice(
    src.indexOf("renderKnow(q, T, big) {"),
    src.indexOf("renderPick(q, T, big) {"),
  );

  it("both readings are render-time locals, computed side by side", () => {
    expect(body, "renderKnow moved — repoint this pin").toBeTruthy();
    expect(body).toMatch(/const split = r \? LEARN_SPLIT\(card\) : null;/);
    expect(body).toMatch(/const src = r \? LEARN_SPLIT_SRC\(card\) : null;/);
  });

  it("neither the bars nor the footer re-reads the frozen answer result", () => {
    // The answer result still CARRIES its split (same arithmetic, and
    // callers outside the feed may want it); what must not come back is
    // this renderer indexing into it, or the footer calling
    // LEARN_SPLIT_SRC a second time on its own.
    expect(body).not.toMatch(/r\.split\[/);
    expect(body.match(/LEARN_SPLIT_SRC\(/g) || []).toHaveLength(1);
  });
});

describe("the measured split is reachable at all (D125)", () => {
  // The bug this half fixes was not in the arithmetic — the cases at the
  // top of this file prove learnMeasured folds a published agg correctly.
  // It was in the plumbing: LIVE.learnAgg is a read-through cache whose
  // first call for a card ALWAYS returns null, and its only caller ran
  // inside LEARN.answer() at the instant of the tap. So the first call for
  // every card was the one deciding that card's reveal, and every learn
  // split the app drew was the authored estimate whatever the crowd had
  // answered.
  it("a cold cache draws nothing, and warms into a measurement", () => {
    // The real cache contract: learnAgg returns null — repeatedly, not
    // once — until its background fetch lands, then the data. So a cold
    // read has no numbers at all no matter how big the crowd is, and the
    // SAME card flips to measured once something has warmed it.
    //
    // This is also the exact instant the old renderer went wrong: it froze
    // the estimate into the answer result before the flip and re-read the
    // label after it. Since D149 there is no estimate to freeze, which
    // removes the failure rather than only guarding it.
    const agg = { tooSmall: false, total: 40, counts: { "0": 30, "1": 10 } };
    let landed = false;
    W.LIVE = { enabled: true, learnAgg: () => (landed ? agg : null) };

    expect(LEARN_SPLIT_SRC(card)).toBe("none");
    expect(LEARN_SPLIT(card)).toBeNull();

    landed = true;
    expect(LEARN_SPLIT_SRC(card)).toBe("measured");
    expect(LEARN_SPLIT(card)).toEqual([75, 25, 0, 0]);
    expect(LEARN_COUNTS(card)).toEqual({ counts: [30, 10, 0, 0], total: 40 });
  });

  it("both readings agree at every instant, so one render can trust them", () => {
    // The property renderKnow depends on: at any single moment the source
    // label and the numbers describe the same thing. Nothing here can hold
    // that for a renderer that samples them at two different moments,
    // which is why the pin above exists as well.
    const agg = { tooSmall: false, total: 40, counts: { "0": 30, "1": 10 } };
    let landed = false;
    W.LIVE = { enabled: true, learnAgg: () => (landed ? agg : null) };
    for (const expected of [false, true]) {
      landed = expected;
      const measured = LEARN_SPLIT_SRC(card) === "measured";
      const split = LEARN_SPLIT(card);
      expect(measured).toBe(expected);
      expect(split === null).toBe(!expected);
    }
  });

  it("the feed warms the plan it just built, not the card it is drawing", () => {
    // Warming per-card at render would be one read per card per render and
    // would still lose the race with the tap. knowQs is the one moment
    // that is guaranteed to precede every tap in the sitting.
    const src = readFileSync(resolve(__dirname, "../spec/world-feed.jsx"), "utf8");
    const start = src.indexOf("knowQs(n, cats) {");
    expect(start, "knowQs moved — repoint this pin").toBeGreaterThan(-1);
    const block = src.slice(start, src.indexOf("\n  }", start));
    expect(block).toMatch(/loadLearnAggs\(ids\)/);
    // Inside the re-plan branch: a plan that did not change must not
    // re-request, and the guard is the `_kqSig` comparison above it.
    expect(block.indexOf("this._kqSig = sig")).toBeLessThan(block.indexOf("loadLearnAggs"));
  });
});

describe("the knows-best row is demo furniture (D89)", () => {
  // The reveal's estimate/measured label above covers the SPLIT; the
  // "<group> knows this best" row under it is ranked on hash noise over the
  // demo cut groups and has no live counterpart, so live mode must refuse
  // it at the source (the D72 shape) rather than headline "BEd knows this
  // best" to a real user.
  it("renderKnowInsight opens with the live gate, before any ranking", () => {
    // A last-hop source pin, same style as LiveCohortBody's floor pin:
    // mounting the whole feed to reveal a learn card would exercise the
    // fixture more than the gate, and the behaviour IS this one line.
    const src = readFileSync(resolve(__dirname, "../spec/world-feed.jsx"), "utf8");
    const start = src.indexOf("renderKnowInsight(q, T) {");
    expect(start, "renderKnowInsight moved — repoint this pin").toBeGreaterThan(-1);
    const beforeRanking = src.slice(start, src.indexOf("WF_CUTS", start));
    // The imported LIVE binding (D39 meter), not the window surface.
    expect(beforeRanking).toMatch(/if \(LIVE\.enabled\) return null;/);
  });
});

describe("the LIVE reconcile leaves lrn- votes alone (D95)", () => {
  // Behaviourally this needs a live snapshot notify while a know reveal is
  // on screen — the one piece learn-reserve.test.jsx's demo harness cannot
  // drive — so it gets the same last-hop pin as D89 above. A learn answer
  // is never in myVotes, and the WF_LS mirror deliberately drops lrn- keys
  // (D95), so without the skip "absent from both store and mirror" is true
  // of every know reveal on screen and each notify would wipe the one the
  // user is watching.
  it("the rollback loop skips lrn- ids before testing absence", () => {
    const src = readFileSync(resolve(__dirname, "../spec/world-feed.jsx"), "utf8");
    const start = src.indexOf("this._unsubLive");
    expect(start, "the LIVE reconcile moved — repoint this pin").toBeGreaterThan(-1);
    const block = src.slice(start, src.indexOf("this._unsubSubs", start));
    expect(block).toMatch(/if \(id\.indexOf\('lrn-'\) === 0\) continue;/);
  });
});

describe("LEARN_RATE — one crowd rate, and where it came from (D133)", () => {
  // D32's label seam covered the reveal's SPLIT and nothing else. Three
  // other surfaces printed the authored `p` — a content-authoring
  // difficulty hint — as a finished measurement about people: the Map's
  // knowledge node, the ⓘ sheet's Crowd row, and the "who knows this"
  // headline. So one card said "our estimate" in the feed and stated a
  // measurement two taps away, and the number wearing the authority was
  // the invented one.
  it("demo: the authored rate, reported as an estimate", () => {
    expect(LEARN_RATE(card)).toEqual({ pct: card.p, src: "estimate" });
  });

  it("live with a published agg: the measured first-attempt rate", () => {
    // 6 of 9 got it right, and `c` is the AUTHORED correct index — which is
    // the index the aggregate is keyed on, because LEARN_ORDER permutes on
    // the way to the screen and the buttons map back before recording.
    W.LIVE = {
      enabled: true,
      learnAgg: () => ({ tooSmall: false, total: 9, counts: { "0": 6, "1": 3 } }),
    };
    expect(LEARN_RATE(card)).toEqual({ pct: 67, src: "measured" });
  });

  it("live but cold: no rate at all, never the authored one (D149)", () => {
    // `pct: null`, not `pct: 0`. The D72 shape: a caller that forgets to
    // check draws something obviously broken and fails a test, rather than
    // rendering a confident bar at zero — "nobody gets this right" is a
    // much worse lie than the estimate this replaced.
    W.LIVE = { enabled: true, learnAgg: () => null, learnAggLoading: () => false };
    expect(LEARN_RATE(card)).toEqual({ pct: null, src: "none" });
  });

  // …AND THE STATE THAT IS NOT A STATEMENT ABOUT THE CARD.
  //
  // `learnAgg` returns null on a cold read too, and the case above cannot
  // tell that apart from "nobody has answered". Two surfaces read the null
  // and printed "Nobody else has answered this one yet" — the Map's
  // knowledge node and the feed's reveal — so on every learn card's first
  // paint the app made a claim about a question thousands may have
  // answered, then replaced it with a number a beat later.
  it("live and still reading: a fourth source, and not an empty card", () => {
    W.LIVE = { enabled: true, learnAgg: () => null, learnAggLoading: () => true };
    expect(LEARN_RATE(card)).toEqual({ pct: null, src: "loading" });
    expect(LEARN_SPLIT_SRC(card)).toBe("loading");
  });

  it("a store too old to answer still says 'none', not 'loading'", () => {
    // The member is optional on purpose: `learn-data.js` is read by the
    // demo build and by any live store that predates this, and a missing
    // member must degrade to the old sentence rather than leaving a card
    // saying "Counting…" forever.
    W.LIVE = { enabled: true, learnAgg: () => null };
    expect(LEARN_RATE(card)).toEqual({ pct: null, src: "none" });
  });

  it("agrees with LEARN_SPLIT on every card in the bank", () => {
    // The two must never disagree about the same card: the reveal draws the
    // distribution and these surfaces draw one bar of it, and a user who
    // reads both in one session is comparing them. Including when both are
    // absent — a rate without a split behind it is the disagreement this
    // case exists to catch.
    for (const c of ALL_CARDS) {
      const split = LEARN_SPLIT(c);
      expect(LEARN_RATE(c).pct, `${c.id}`).toBe(split ? split[c.c] : null);
      expect(LEARN_RATE(c).src, `${c.id}`).toBe(LEARN_SPLIT_SRC(c));
    }
  });

  it("carries the same absence through a live build, card for card", () => {
    W.LIVE = { enabled: true, learnAgg: () => null };
    for (const c of ALL_CARDS) {
      expect(LEARN_RATE(c).pct, `${c.id} still prints an authored rate`).toBeNull();
      expect(LEARN_SPLIT(c), `${c.id} still draws an authored split`).toBeNull();
    }
  });
});

describe("the who-knows-this cuts are demo furniture too (D133)", () => {
  // D89 refused the "<group> knows this best" HEADLINE on a live device and
  // left the sheet it opened into, which draws the same fabrication as a
  // full distribution: every row is wfKnowRate — a hash of (card, cohort) —
  // against a baseline nobody measured either. Same source-pin style as the
  // D89 case above, for the same reason: the behaviour IS the gate.
  const src = readFileSync(resolve(__dirname, "../spec/world-feed.jsx"), "utf8");
  const start = src.indexOf("renderKnowStats(q, T) {");
  const block = src.slice(start, src.indexOf("renderKnowInsight(q, T) {", start));

  it("forces the friends cut and hides the chips in live mode", () => {
    expect(start, "renderKnowStats moved — repoint this pin").toBeGreaterThan(-1);
    expect(block).toMatch(/const live = LIVE\.enabled;/);
    // The dim is decided before anything ranks, so no live path can reach
    // WF_GRP at all — the rows are computed from `dim`.
    expect(block).toMatch(/const dim = live \? 'friends' :/);
    expect(block).toMatch(/\{live \? null : this\.renderCutChips\(/);
  });

  it("draws its headline from LEARN_RATE, not the authored p", () => {
    expect(block).toMatch(/const rate = LEARN_RATE\(card\);/);
    expect(block).toMatch(/const p = rate\.pct;/);
    expect(block).toMatch(/rate\.src === 'estimate'/);
    // …and reads the fourth source BEFORE the null. `p == null` is true
    // while the read is in the air as well as when nobody has answered,
    // so an arm that tests the number first prints the wrong sentence
    // whatever the source says.
    expect(block, "the reveal states an empty card before its read comes back")
      .toMatch(/rate\.src === 'loading' \? '[^']+' : p == null/);
  });

  it("the reveal footer reads the fourth source too", () => {
    // THE LINE `1afcbe1f`'s MESSAGE NAMED AND ITS DIFF DID NOT TOUCH. That
    // commit gave the who-knows-this sheet and the Map's learn card their
    // 'loading' arm and said it had fixed "the feed's learn reveal". The
    // reveal footer — the line under the answer you just tapped — still
    // branched on 'measured' alone, so a crowd read in the air fell into
    // the same arm as a card nobody had answered and it said "You're the
    // first." about a card thousands have answered.
    //
    // A source assertion, like the three above it and for the same reason:
    // this footer is inside a method that renders only mid-reveal, and the
    // suite that mounts the feed cannot reach it. Reverting the arm reds
    // this, which is the property that matters.
    const src = readFileSync(resolve(__dirname, "../spec/world-feed.jsx"), "utf8");
    expect(src, "the reveal footer states an empty card before its read comes back")
      .toMatch(/\{src === 'loading'\s*\n\s*\? 'Counting/);
    // …and it is asked BEFORE 'measured', so the three sources stay three.
    // Bounded to the footer's own ternary: searching the rest of the file
    // finds `kr.src === 'measured'` several hundred lines away and passes
    // whatever the footer does.
    const start = src.indexOf("{src === 'loading'");
    const foot = src.slice(start, start + 700);
    expect(foot.indexOf("src === 'measured'"), "the fourth source is asked after the second, which makes it unreachable")
      .toBeGreaterThan(0);
    expect(foot, "the footer's ternary is no longer inside the slice — widen it").toContain("You\u2019re the first.");
  });

  it("says what it cannot show instead of leaving an empty sheet", () => {
    expect(block).toMatch(/don&apos;t publish per-group cuts yet/);
  });
});
