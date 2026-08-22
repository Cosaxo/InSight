// @vitest-environment jsdom
//
// The daily's pulse card (D139, roster at D203) — one question, sealed
// until you answer it, then the crowd, beside the blind daily. Its trend
// half is `PulseTrends`, which has its own suite; what only THIS file can
// execute is the card's own job.
//
// `data/pulse` is the real module — the README's rule, and here it is the
// point: the card's readings ARE that fold, so mocking it would leave the
// suite asserting that a fixture reaches the screen. What is mocked is the
// store (`../data/live`, which imports Firebase) and the ONE fetch beneath
// it (`lib/firebase`'s `getDb`/`getFirestoreApi`) — the same seam
// `CityPicker.test.tsx` cuts at, so the per-day aggregate docs are ours to
// write and every number on screen is computed by `pulse.ts` from them.
//
// Nine properties, each a way a correct fold reaches the screen as a wrong
// reading:
//
//   1. IT DRAWS THE PULSE IT WAS HANDED. `daily-split` mounts one card per
//      pulse due today, so a card that fell back to `first()` would put
//      five identical questions in a column and record every answer
//      against the pace pulse. The scale's two named ends are the same
//      claim: five growing dots mean nothing except what those two words
//      say, and they must be this bank's own first and last.
//   2. IT IS BLIND UNTIL YOU ANSWER. Same contract as the daily question.
//      Today's aggregate is already loaded when the ask renders — the
//      crowd is one `??` away from the screen at all times.
//   3. THE DOT YOU TAP IS THE ANSWER RECORDED. The step values are 1..5
//      and the wire is optionIdx 0..4 (D86), so an off-by-one here writes
//      a neighbouring answer and then names it back to you correctly,
//      because the same wrong number rounds the whole trip.
//   4. ABSENT IS NOT ZERO. No aggregate for today means nobody has
//      answered yet — "the first answer today" — never "0% of 0". This is
//      the discipline every live surface here holds, and the card is where
//      it is cheapest to lose: `bins` returns five honest zeros and a
//      percentage sign next to one of them is a complete sentence.
//   5. YOUR SHARE IS YOUR OWN STEP'S. `bins[mine - 1]`, out of today's n.
//      A one-off index still prints a plausible percentage.
//   6. THE REVEAL'S BARS ARE THE CROWD, AND YOURS IS MARKED. The bars are
//      the only place the split is drawn rather than said, and the border
//      is the only thing saying which one is you — asserted as style
//      because the encoding IS the claim, the same licence
//      `LiveSimilarityField.test.tsx` takes for its dashed ring.
//   7. THE STRIP IS THIS PULSE'S RUN, IN ASKS. A weekly pulse answered
//      three Sundays running is 3 in a row (D203's fourth honesty rule),
//      and today's mark rings while the question is still open — the whole
//      strip is `aria-hidden`, so that ring is the entire channel.
//   8. THE RHYTHM IS THIS PULSE'S, AND SETTING IT STICKS (D203).
//   9. THE READING IS NOT PAID FOR UNTIL YOU ASK FOR IT. The card is
//      first-screen and the reading is not: the chunk is lazy and the
//      21-day window is fetched on the tap, which is the arithmetic that
//      made a five-pulse roster cheaper per open than one pulse used to be.
//
// TWO DEFECTS ARE RECORDED HERE RATHER THAN FIXED, both in `data/pulse`
// and so outside this panel: the rhythm case named "BUG" asserts what the
// card does today, wrongly; and the reason the missing-question case uses
// an unknown id instead of an empty bank is the second one.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

/** The per-day aggregate doc shape the trigger publishes, as much of it as
 * the card reads: `counts` keyed by optionIdx, `total` for the world cut. */
interface DayAggDoc { counts: Record<string, number>; total: number }

const h = vi.hoisted(() => ({
  /** The hydrated pulse bank, per test — emptied by the no-bank case. */
  bank: [] as { id: string; prompt: string; options: string[] }[],
  /** Your own answers, day key → optionIdx, exactly as `LIVE.pulseVotes`
   * hands them over. */
  votes: {} as Record<string, Record<string, number>>,
  /** `v2_question_aggs` by doc id (`${pid}_${dayKey}`). A missing id is a
   * day nobody answered — the whole of property 4. */
  aggs: {} as Record<string, DayAggDoc>,
  /** Every id list `getDocs` was asked for, in order. The reading's cost
   * claim (property 9) is a statement about exactly this. */
  queries: [] as string[][],
}));

const LIVE = vi.hoisted(() => ({
  enabled: true,
  pulseQs: () => h.bank,
  pulseVotes: (pid: string): Record<string, number> => h.votes[pid] ?? {},
  // The real store mirrors your vote locally before the server confirms
  // it, which is what makes the reveal appear under your finger; the mock
  // has to do the same or every answer case would be asserting on a store
  // that is still one poll behind.
  votePulse: vi.fn((pid: string, idx: number) => {
    (h.votes[pid] ??= {})[dayKey(0)] = idx;
    return Promise.resolve();
  }),
  anchors: () => ({ city: "Oslo, NO", country: "Norway" }),
  subscribe: () => () => {},
}));
vi.mock("../data/live", () => ({ default: LIVE, LIVE }));

// The one fetch under `data/pulse`, stubbed at the Firebase boundary so
// the fold above it stays real. `query`/`where`/`collection` only have to
// carry the id list through to `getDocs`.
vi.mock("../../lib/firebase", () => ({
  getDb: () => Promise.resolve({}),
  getFirestoreApi: () => Promise.resolve({
    collection: (_db: unknown, path: string) => path,
    documentId: () => "__name__",
    where: (_field: unknown, _op: string, ids: string[]) => ids,
    query: (_coll: unknown, ids: string[]) => ids,
    getDocs: (ids: string[]) => {
      h.queries.push(ids);
      return Promise.resolve({
        docs: ids.filter((id) => id in h.aggs).map((id) => ({ id, data: (): DayAggDoc => h.aggs[id] })),
      });
    },
  }),
}));

const { default: PulseCard } = await import("./PulseCard");
const PULSE = await import("../data/pulse");

// UTC, because every key the store writes and reads is UTC (a local-midnight
// fixture would answer into tomorrow's row for anyone east of Greenwich, on
// some runs and not others).
const pad = (n: number) => String(n).padStart(2, "0");
function dayKey(back: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - back);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
/** The three Sundays in the 21-day window — always exactly three, whatever
 * weekday the suite runs on, which is what lets the weekly-cadence case be
 * written without pinning the clock. */
function sundays(): string[] {
  const out: string[] = [];
  for (let back = 0; back < 21; back++) {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - back);
    if (d.getUTCDay() === 0) out.push(dayKey(back));
  }
  return out;
}

const PACE = ["Crawling", "Dragging", "Steady", "Brisk", "Flying"];
const SLEEP = ["Badly", "Patchy", "OK", "Well", "Deeply"];

beforeEach(() => {
  h.bank = [
    // Default cadences come from the roster in `data/pulse`: pace is daily
    // and is `first()`; sleep is weekly. Two pulses with different rhythms
    // is what makes "this card's pulse" falsifiable at all.
    { id: "pulse-pace", prompt: "What pace was today?", options: PACE },
    { id: "pulse-sleep", prompt: "How did you sleep?", options: SLEEP },
  ];
  h.votes = {};
  h.aggs = {};
  h.queries = [];
  LIVE.votePulse.mockClear();
  localStorage.clear();
  // `data/pulse` caches today's aggregates and every fetched window at
  // module scope, and the module is imported once for the whole file. The
  // purge is the store's own reset (D51) rather than a reach into its
  // internals — without it the first test's cache answers the rest.
  window.dispatchEvent(new Event("insight:local-purge"));
});
afterEach(cleanup);

/** One macrotask, inside `act` — long enough for the card's effect to
 * fetch today's aggregates and re-render, since the whole chain under
 * `ensureToday` is promises with no timers in it. */
const settle = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };

const text = () => document.body.textContent ?? "";
/** The ask's five dots, in DOM order. Everything else on the card that is
 * a button announces itself. */
const options = () => screen.getAllByRole("button")
  .map((b) => b.getAttribute("aria-label") ?? "")
  .filter((n) => n && !n.startsWith("Your last 14 asks") && !n.startsWith("How often"));
const strip = () => screen.getByRole("button", { name: /Your last 14 asks/ });
/** The strip's marks: the ticks are the only spans nested inside the
 * button's `aria-hidden` wrapper (the run digit is a direct child). */
const ticks = () => Array.from(strip().querySelectorAll<HTMLElement>("span span"));
const styleOf = (el: Element | undefined) => el?.getAttribute("style") ?? "";
/** The reveal's five bars, found by the title that names them. */
const bar = (label: string) => Array.from(document.querySelectorAll<HTMLElement>("div[title]"))
  .find((b) => b.title.startsWith(label + " "));
const barHeight = (label: string) => parseFloat(
  (bar(label)?.firstElementChild?.getAttribute("style") ?? "").replace(/.*height: ([\d.]+)px.*/s, "$1"),
);

describe("PulseCard · which pulse it draws", () => {
  it("asks the pulse it was handed, with that pulse's own five steps", async () => {
    render(<PulseCard pid="pulse-sleep" />);
    await settle();

    expect(screen.getByText("How did you sleep?")).toBeTruthy();
    expect(document.querySelector(".kicker")?.textContent).toBe("sleep pulse");
    // In the bank's order: the dot sizes grow left to right, so a reordered
    // scale is a wrong reading with nothing on screen admitting it.
    expect(options()).toEqual(SLEEP);
    expect(text(), "the default pulse leaked into a card asking a different one")
      .not.toMatch(/What pace was today/);
  });

  it("names the two ends of THIS scale", async () => {
    // The only key the five dots get. `steps[0]` and `steps[last]`,
    // lowercased — nothing else on the card says what "big dot" means.
    render(<PulseCard pid="pulse-sleep" />);
    await settle();
    expect(screen.getByText("badly")).toBeTruthy();
    expect(screen.getByText("deeply")).toBeTruthy();
  });

  it("draws nothing when the pulse it was handed is not in the bank", async () => {
    // A card with no question is worse than no card: the ask, the strip and
    // the rhythm control would all still draw, tappable, over nothing. The
    // pulse arriving late (`ready()`) and the pulse not existing (`q`) are
    // the same frame for the reader and the same two guards in the source.
    //
    // Written as an unknown id rather than an empty bank ON PURPOSE: an
    // empty roster takes `ensureToday`'s `!ids.length` path, which leaves
    // `loadingToday` latched on a settled promise for the life of the
    // module (the `finally` runs before the assignment), and every later
    // case in this file would then render against a store that can no
    // longer fetch. Reported with the suite, not worked around silently.
    const { container } = render(<PulseCard pid="pulse-nope" />);
    await settle();
    expect(container.innerHTML).toBe("");
  });
});

describe("PulseCard · blind until you answer", () => {
  it("shows no crowd while the question is still open", async () => {
    // Today's aggregate is loaded and sitting in the store — the ask is
    // what keeps it off the screen, not the absence of data.
    h.aggs[`pulse-pace_${dayKey(0)}`] = { counts: { "0": 5, "1": 10, "2": 20, "3": 38, "4": 27 }, total: 100 };
    render(<PulseCard />);
    await settle();

    expect(options()).toEqual(PACE);
    expect(text(), "the crowd was on screen before the answer was given").not.toMatch(/%/);
    expect(text()).not.toMatch(/answers today/);
    expect(text()).not.toMatch(/you ·/);
  });

  it("records the dot you tapped, and names it back", async () => {
    render(<PulseCard />);
    await settle();
    fireEvent.click(screen.getByRole("button", { name: "Brisk" }));
    await settle();

    // The wire value, not the step: steps are 1..5 and answers carry
    // optionIdx 0..4 (D86). An index passed where a value belongs writes
    // the neighbouring answer and then reads it back consistently, so the
    // written value has to be asserted on its own.
    expect(LIVE.votePulse).toHaveBeenCalledWith("pulse-pace", 3);
    expect(screen.getByText("you · Brisk")).toBeTruthy();
  });
});

describe("PulseCard · absent is not zero", () => {
  it("says you are the first rather than reporting an empty crowd", async () => {
    h.votes["pulse-pace"] = { [dayKey(0)]: 0 };
    render(<PulseCard />);
    await settle();

    // The day WAS asked for and came back with no doc — which is the state
    // this property is about, so it is asserted rather than assumed.
    expect(h.queries.length).toBe(1);
    expect(screen.getByText("the first answer today")).toBeTruthy();
    expect(text(), "an absent aggregate was printed as a real share").not.toMatch(/%/);
    expect(text()).not.toMatch(/0 answers today/);
  });

  it("states your share of today's answers, and it is your own step's", async () => {
    // Five distinct shares, so an index off by one prints a wrong number
    // rather than the same one.
    h.aggs[`pulse-pace_${dayKey(0)}`] = { counts: { "0": 5, "1": 10, "2": 20, "3": 38, "4": 27 }, total: 100 };
    h.votes["pulse-pace"] = { [dayKey(0)]: 3 }; // Brisk, step 4 → bins[3]
    render(<PulseCard />);
    await settle();

    expect(screen.getByText("38% of 100 answers today")).toBeTruthy();
  });

  it("counts one answer as one answer", async () => {
    // n === 1 is the boundary the absent case sits next to: you have
    // answered, the fold has counted you, and there is nobody else.
    h.aggs[`pulse-pace_${dayKey(0)}`] = { counts: { "3": 1 }, total: 1 };
    h.votes["pulse-pace"] = { [dayKey(0)]: 3 };
    render(<PulseCard />);
    await settle();

    expect(screen.getByText("100% of 1 answer today")).toBeTruthy();
  });
});

describe("PulseCard · the reveal draws the crowd it names", () => {
  beforeEach(() => {
    h.aggs[`pulse-pace_${dayKey(0)}`] = { counts: { "0": 5, "1": 10, "2": 20, "3": 38, "4": 27 }, total: 100 };
    h.votes["pulse-pace"] = { [dayKey(0)]: 3 };
  });

  it("marks the bar you picked, and only that one", async () => {
    // Asserted on the border because the border IS the sentence: the words
    // beside the chart say "you · Brisk" and the chart says which of five
    // bars that is. The two can disagree, and only one of them is looked at.
    render(<PulseCard />);
    await settle();

    expect(styleOf(bar("Brisk")), "your own answer was not marked on the chart")
      .toContain("border: 1.5px solid var(--pulse)");
    for (const other of ["Crawling", "Dragging", "Steady", "Flying"]) {
      expect(styleOf(bar(other)), `${other} was marked as your answer`)
        .toContain("border: 1px solid transparent");
    }
  });

  it("gives the largest share the tallest bar", async () => {
    render(<PulseCard />);
    await settle();

    // Heights are the only drawing of the split; the percentages ride in
    // the titles. An inverted scale draws the crowd upside down under a
    // caption that still reads correctly.
    const heights = PACE.map(barHeight);
    // THE WHOLE RANKING, not just its ends. max===Brisk and min===Crawling
    // are both true of a chart with no shape at all — a constant array
    // satisfies both — so a flattened scale passed this case for as long
    // as it existed. The five bars ordered against the five bins
    // (5·10·20·38·27) is the assertion a flat chart cannot survive.
    expect([...PACE].sort((a, b) => barHeight(b) - barHeight(a)))
      .toEqual(["Brisk", "Flying", "Steady", "Dragging", "Crawling"]);
    expect(new Set(heights).size, "every bar the same height is not a distribution").toBeGreaterThan(1);
    expect(Math.max(...heights)).toBe(barHeight("Brisk"));   // 38%, the largest
    expect(Math.min(...heights)).toBe(barHeight("Crawling")); // 5%, the smallest
  });
});

describe("PulseCard · the strip is this pulse's run, in asks", () => {
  it("counts a weekly pulse's Sundays as a run, not as three days in three weeks", async () => {
    // D203's fourth honesty rule, at the card. Sleep is weekly; answering
    // all three Sundays in the window is a run of 3. Pace — the default
    // pulse, and what a card that forgot its own id would read — has one.
    h.votes["pulse-sleep"] = Object.fromEntries(sundays().map((k) => [k, 3]));
    h.votes["pulse-pace"] = { [dayKey(0)]: 2 };
    render(<PulseCard pid="pulse-sleep" />);
    await settle();

    expect(strip().getAttribute("aria-label")).toMatch(/3 in a row/);
    expect(screen.getByText("3")).toBeTruthy(); // the run, shown from 3 up
  });

  it("rings today's mark while the question is open and fills it once answered", async () => {
    // The strip is aria-hidden in full, so this encoding is its only
    // channel: filled = answered, faint = missed, ring = still open. A
    // ring that survives your answer says the day is still owed.
    render(<PulseCard />);
    await settle();
    const open = ticks()[ticks().length - 1];
    expect(styleOf(open), "today's mark did not read as still open").toContain("box-shadow: inset");
    expect(styleOf(open)).not.toContain("background: var(--pulse)");

    fireEvent.click(screen.getByRole("button", { name: "Steady" }));
    await settle();
    const done = ticks()[ticks().length - 1];
    expect(styleOf(done), "today's mark stayed empty after you answered").toContain("background: var(--pulse)");
    expect(styleOf(done), "an answered day was still ringed as open").toContain("box-shadow: none");
  });
});

describe("PulseCard · the answer is recorded against this pulse", () => {
  it("votes on the pulse it was handed, not on the roster's first", async () => {
    // Property 1's own named failure, and it was not held: mutating
    // `PULSE.answer(id, s.v)` to `PULSE.answer(PULSE.first(), s.v)` passed
    // all 17 cases. Every case that taps an option used the default pulse,
    // where `id` and `first()` are the same string — so the sentence the
    // header opens with ("recording every answer against the pace pulse")
    // described a mutation nothing could catch. Tapping a NON-default
    // pulse is the whole difference.
    render(<PulseCard pid="pulse-sleep" />);
    await settle();
    fireEvent.click(screen.getByRole("button", { name: "Well" }));
    await settle();

    expect(LIVE.votePulse).toHaveBeenCalledTimes(1);
    expect(LIVE.votePulse).toHaveBeenCalledWith("pulse-sleep", 3);
  });
});

describe("PulseCard · the rhythm (D203)", () => {
  it("names this pulse's own cadence, and marks it in the group", async () => {
    // Cadence is per pulse — the card reading a global one would tell you
    // your sleep pulse asks every day while it asks on Sundays.
    render(<PulseCard pid="pulse-sleep" />);
    await settle();
    fireEvent.click(screen.getByRole("button", { name: /How often this pulse asks/ }));

    expect(screen.getByRole("radio", { name: "Sundays" }).getAttribute("aria-checked")).toBe("true");
    for (const other of ["every day", "Mon · Wed · Fri", "paused"]) {
      expect(screen.getByRole("radio", { name: other }).getAttribute("aria-checked"), `${other} was marked as current`)
        .toBe("false");
    }
  });

  it("writes the rhythm against THIS pulse, leaving the others alone", async () => {
    // The two WRITE sites are what property 1 is actually about, and this
    // one was unheld: `PULSE.setCadence(id, c)` mutated to
    // `PULSE.setCadence(PULSE.first(), c)` passed the whole suite. Reading
    // the cadence back is not enough — the read is per-pulse and correct
    // either way, so only the neighbour's cadence can tell them apart.
    // Setting your sleep rhythm would silently repoint the pace pulse's.
    render(<PulseCard pid="pulse-sleep" />);
    await settle();
    const paceBefore = PULSE.cadence("pulse-pace");
    fireEvent.click(screen.getByRole("button", { name: /How often this pulse asks/ }));
    fireEvent.click(screen.getByRole("radio", { name: "Mon · Wed · Fri" }));
    await settle();

    expect(PULSE.cadence("pulse-sleep")).toBe("often");
    expect(PULSE.cadence("pulse-pace"), "the neighbouring pulse's rhythm moved").toBe(paceBefore);
  });

  it("takes a new rhythm, says so, and closes the row", async () => {
    render(<PulseCard />);
    await settle();
    fireEvent.click(screen.getByRole("button", { name: /How often this pulse asks/ }));
    fireEvent.click(screen.getByRole("radio", { name: "Mon · Wed · Fri" }));
    await settle();

    expect(screen.getByRole("button", { name: /How often this pulse asks — Mon · Wed · Fri/ }).textContent)
      .toContain("Mon · Wed · Fri");
    // Four chips standing open on every pulse would be more chrome than
    // question — the control states itself and closes again.
    expect(screen.queryByRole("radiogroup"), "the chips stayed open after a choice").toBeNull();
  });

  it("BUG — pausing a pulse hides the answer you already gave today", async () => {
    // FLAGGED, NOT FIXED, and asserted as it behaves today so that fixing
    // it fails here loudly rather than silently.
    //
    // `mineToday` reads `days()`, which nulls every day the cadence did not
    // ask on — right for the trend line (a weekly pulse must not draw a
    // Tuesday it never offered), wrong for today's card: change the rhythm
    // after answering and your own answer leaves the screen and the blind
    // ask comes back, while the vote stays on the server. The reveal
    // returns if you set the cadence back, so nothing is lost except the
    // card's word for what you did. The fix belongs in `data/pulse`
    // (today's answer is not a scheduling question), which is outside this
    // panel.
    h.aggs[`pulse-pace_${dayKey(0)}`] = { counts: { "3": 1 }, total: 1 };
    h.votes["pulse-pace"] = { [dayKey(0)]: 3 };
    render(<PulseCard />);
    await settle();
    expect(screen.getByText("you · Brisk")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /How often this pulse asks/ }));
    fireEvent.click(screen.getByRole("radio", { name: "paused" }));
    await settle();

    expect(text(), "FIXED? — then update this case: pausing no longer hides today's answer")
      .not.toMatch(/you · Brisk/);
    expect(options(), "the blind ask came back over an answer already recorded").toEqual(PACE);
    expect(LIVE.votePulse, "the vote itself was never withdrawn").not.toHaveBeenCalled();
  });
});

describe("PulseCard · the reading is paid for on the tap", () => {
  it("keeps the trend chunk and its 21 days off the open", async () => {
    render(<PulseCard pid="pulse-sleep" />);
    await settle();

    expect(screen.queryByRole("button", { name: /on the Map/ })).toBeNull();
    expect(strip().getAttribute("aria-expanded")).toBe("false");
    // The whole of D203's cost arithmetic: the card's own fetch is today
    // across the roster, and nothing else. A window pulled on mount is
    // five windows on the daily's first frame.
    expect(h.queries.flat().every((id) => id.endsWith(dayKey(0))), "a day other than today was fetched on open")
      .toBe(true);
  });

  it("fetches THIS pulse's window when the reading is opened", async () => {
    render(<PulseCard pid="pulse-sleep" />);
    await settle();
    h.queries = [];
    fireEvent.click(strip());

    // `mapLink` is the card's own flag — the Map's pulse leaf renders the
    // same reading without it — so this is both "the reading opened" and
    // "it opened as the card's reading".
    expect(await screen.findByRole("button", { name: /on the Map/ })).toBeTruthy();
    expect(strip().getAttribute("aria-expanded")).toBe("true");
    // The reading under the sleep card is the sleep pulse's: `PulseTrends`
    // falls back to `first()` on a missing pid, so a dropped one draws
    // three weeks of the pace pulse under this question.
    expect(text(), "the reading drew a different pulse than the card asking it")
      .not.toMatch(/What pace was today/);

    const windows = h.queries.filter((q) => q.length === 21);
    expect(windows.length).toBeGreaterThan(0);
    expect(windows.every((q) => q.every((id) => id.startsWith("pulse-sleep_"))),
      "the card paid for a window it does not draw").toBe(true);
  });
});
