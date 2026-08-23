// @vitest-environment jsdom
//
// The Answers lens's rows (D120) — the default tab of every cohort stop
// and of the Near room, so this list is the most-read reading in the
// Mirror.
//
// The arithmetic underneath is `data/cohort` and is tested there. It is
// NOT mocked here, for the README's reason: stubbing the fold would leave
// these cases proving the panel reads a fixture correctly rather than
// proving it reads cohort correctly. `../data/live` is not mocked either,
// because this panel never asks for it — every number arrives as an
// `AnswerRow` prop, which is what makes the states below (a question with
// zero answers, a cohort of one) writable at all.
//
// Eight properties, each one a way a correct fold reaches the screen as a
// wrong reading:
//
//   1. THE HEADLINE READS BY TYPE. A `rating` leads with its average, a
//      `scale` with how much of the room agrees, everything else with the
//      option that led, named. Dropping `row.type` at the `headlineFor`
//      call compiles, and then every rating in the bank leads with the
//      share of people who happened to pick a 7.
//   2. A QUESTION THIS COHORT HAS NOT ANSWERED STILL DRAWS ITS OPTIONS,
//      each with an explicit zero, and leads with nothing. That is
//      LiveCohortBody's stated property and this is the component that
//      has to keep it: a silent gap reads as "this question does not
//      exist here" rather than "nobody here has answered it".
//   3. YOUR OWN ANSWER IS NAMED, by label, at option zero as readily as
//      anywhere else — and the legend explaining the accent mark appears
//      only when a mark is on screen to explain.
//   4. A SHARE IS PRINTED WHERE IT IS WORTH READING as one: on your bar,
//      or on the leader when you have not answered. Every other bar
//      carries its exact count and nothing else (D98 counts are exact,
//      and 40% of nine is a different fact from 40% of nine thousand).
//   5. EXPANDED, A `rating` IS A HISTOGRAM and everything else is
//      labelled bars — and the histogram's only mark for your own answer
//      is the solid column, so there the visual encoding IS the claim.
//   6. THE STANDING SENTENCE IS SAID EITHER WAY AND IN THE RIGHT
//      DIRECTION, and never as a percentage of ONE answer (D170: "100% of
//      Oslo are with you" is a sample size wearing a percentage).
//   7. THE THREE ORDERINGS ARE THE THREE THEY CLAIM. "Most divisive" is
//      cohort's option-count-normalised measure, so a near-even binary
//      outranks a four-way with a smaller leader; "most agreed" breaks
//      its ties toward the bigger room, so a single answer does not head
//      a list of things everyone agrees on.
//   8. THE BRANCH CHIPS FILTER TO THEIR OWN BRANCH and count it.
//
// Every one of these was mutation-checked — broken in LiveAnswerRows.tsx,
// watched to fail here, reverted. One case below asserts behaviour that is
// WRONG on purpose and says so; see "the sentence cannot tell an empty
// cohort from an unanswered question".
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import LiveAnswerRows, { type AnswerRow } from "./LiveAnswerRows";

afterEach(cleanup);

// ── fixtures ─────────────────────────────────────────────────────────

/**
 * One row in the real `AnswerRow` shape — the type the panel exports and
 * both callers build (LiveCohortBody's archive walk, roomShape's
 * `roomRows`), rather than an invented fixture shape that could drift
 * from it silently.
 *
 * `n` defaults to the counts' own sum because that is what both callers
 * pass; a case that wants them to disagree says so.
 */
function row(qid: string, counts: number[], o: Partial<AnswerRow> = {}): AnswerRow {
  return {
    qid,
    text: `${qid}?`,
    options: counts.map((_, i) => `Opt ${i + 1}`),
    n: counts.reduce((a, b) => a + b, 0),
    mine: -1,
    ...o,
    counts,
  };
}

/** Mounted the way both callers mount it: rows, a cohort noun, a note. */
const show = (rows: AnswerRow[], whom = "Oslo") =>
  render(<LiveAnswerRows rows={rows} whom={whom} emptyNote={<>Nothing here yet.</>} />);

/**
 * Every question row's control, in the order the list draws them.
 *
 * `aria-expanded` is what separates a row from the chips and the sort
 * band (those carry `aria-pressed`), and it is also the thing a screen
 * reader uses to tell them apart — so the ordering assertions below read
 * the same structure a user does.
 */
const rowControls = (): HTMLElement[] =>
  screen.getAllByRole("button").filter((b) => b.hasAttribute("aria-expanded"));

/** The question each row leads with — the first span in its control. */
const titles = (): string[] =>
  rowControls().map((b) => b.querySelector("span")?.textContent ?? "");

/** The block the open row reveals: the element right after its control. */
const opened = (): HTMLElement =>
  screen.getByRole("button", { expanded: true }).nextElementSibling as HTMLElement;

/**
 * One expanded bar, as text: its option label followed by whatever
 * numbers that bar carries ("Dogs30% · 3", or "Cats5").
 *
 * The label span's parent is the bar row, so this reads the share and the
 * count together — which is the point, since the panel deliberately gives
 * only some rows both.
 */
const barText = (exp: HTMLElement, label: string): string =>
  within(exp).getByText(label).parentElement?.textContent ?? "";

// ── 1 · the headline reads by type (D120) ────────────────────────────

describe("the headline reads by type", () => {
  it("leads a rating with its average, out of its own scale", () => {
    // Two answers, a 7 and an 8, so the mean is a number no share could
    // be mistaken for.
    show([row("q", [0, 0, 0, 0, 0, 0, 1, 1, 0, 0], { type: "rating", text: "How was it?" })]);
    const head = rowControls()[0].textContent ?? "";
    expect(head).toMatch(/7\.5\/10 average/);
    // A rating that leads with a percentage is the "dropped the type"
    // failure: it would print "50% Opt 7" — true of the counts, and a
    // wrong reading of the question.
    expect(head).not.toMatch(/%/);
  });

  it("leads a scale with the share that agrees", () => {
    // The top two points of a five-point Likert, summed off pctFor's own
    // output so the headline cannot contradict the bars beneath it.
    show([row("q", [1, 1, 2, 3, 5], { type: "scale", text: "Agree?" })]);
    expect(rowControls()[0].textContent).toMatch(/67% agree/);
  });

  it("leads everything else with the option that led, by name", () => {
    // A share with no noun beside it is not a reading — "70%" of what.
    show([row("q", [3, 7], { options: ["Coffee", "Tea"], text: "Which?" })]);
    expect(rowControls()[0].textContent).toMatch(/70% Tea/);
  });
});

// ── 2 · a question this cohort has not answered ──────────────────────
//
// Reachable today from the Near room: roomShape keeps a question the
// server folded no counts for, with zeroes, because dropping the row
// would make an unanswered question look like one that was never asked.

describe("a question nobody here has answered", () => {
  const unanswered = () =>
    show([row("q", [0, 0], { options: ["Yes", "No"], text: "Is this asked here?", mine: 0 })]);

  it("leads with nothing rather than with a 0%", () => {
    unanswered();
    // "0% Yes" would be a claim about a room that has said nothing.
    expect(rowControls()[0].textContent).not.toMatch(/%/);
  });

  it("still names every option and prints its zero", () => {
    unanswered();
    expect(barText(opened(), "No")).toBe("No0");
    expect(barText(opened(), "Yes")).toMatch(/0$/);
  });

  it("tells an empty cohort from a question you skipped (D234)", () => {
    // WAS A FLAGGED DEFECT, now the fix. `standingIn` refuses for two
    // different reasons and `standText` rendered both as the second one,
    // so this row said "You have not answered this one." under a chip
    // naming your own pick two lines above it.
    unanswered();
    expect(rowControls()[0].textContent, "the chip should still name your pick").toMatch(/Yes/);
    expect(screen.queryByText("You have not answered this one."), "the row contradicted its own chip").toBeNull();
    expect(screen.getByText("Your answer is not in this count yet.")).toBeTruthy();
  });

  it("still says you have not answered when you have not", () => {
    // The half the fix must not swallow: with no pick of your own, the
    // sentence is about YOU, whatever the cohort has done. Both nulls
    // reaching the same branch is exactly how the two got confused.
    show([row("q", [0, 0], { options: ["Yes", "No"], text: "Is this asked here?" })]);
    expect(screen.getByText("You have not answered this one.")).toBeTruthy();
  });
});

// ── 3 · your own answer, marked and named ────────────────────────────

describe("your own answer", () => {
  it("names your pick on the collapsed row, option zero included", () => {
    // mine = 0 on purpose: `>= 0` is the only thing separating "you
    // picked the first option" from "you have not answered", and it is
    // one character from being wrong.
    show([row("q", [3, 7], { options: ["Coffee", "Tea"], mine: 0 })]);
    expect(rowControls()[0].textContent).toMatch(/Coffee/);
  });

  it("draws the collapsed bar in the shape of the split, and marks your segment", () => {
    // `ArStack` — the mini-bar on EVERY collapsed row, and it had no
    // assertion anywhere in this suite. `flexGrow: v` mutated to
    // `flexGrow: 1` draws every question as five equal segments, whatever
    // the split, and 25 cases stayed green: the one drawing of the
    // distribution a reader sees without opening a row was unheld.
    show([row("q", [60, 30, 10], { options: ["Cats", "Dogs", "Neither"], mine: 1 })]);
    const segs = [...rowControls()[0].querySelectorAll("div > span")]
      .filter((el) => (el.getAttribute("style") || "").includes("flex-grow"));
    const grow = segs.map((el) => parseFloat(/flex-grow:\s*([\d.]+)/.exec(el.getAttribute("style") || "")?.[1] ?? "0"));
    expect(grow, "the three segments are not in the 60/30/10 proportion").toHaveLength(3);
    expect(grow[0]).toBeGreaterThan(grow[1]);
    expect(grow[1]).toBeGreaterThan(grow[2]);
    // …and your own segment carries the floor that keeps a 1% answer of
    // yours findable, which no other segment gets.
    const mineStyle = segs[1].getAttribute("style") || "";
    expect(mineStyle).toMatch(/min-width:\s*8px/);
    expect(segs[0].getAttribute("style") || "").toMatch(/min-width:\s*0/);
  });

  it("explains the accent mark only when a mark is on screen", () => {
    show([row("a", [3, 7], { mine: 0 }), row("b", [1, 1])]);
    expect(screen.getByText("you")).toBeTruthy();
    cleanup();
    // Nothing of yours in the list: the legend would be naming a colour
    // that appears nowhere.
    show([row("a", [3, 7]), row("b", [1, 1])]);
    expect(screen.queryByText("you")).toBeNull();
  });

  it("prints the share on your bar, and on the leader when you have none", () => {
    const opts = ["Cats", "Dogs", "Neither"];
    show([row("q", [5, 3, 2], { options: opts, mine: 1 })]);
    // Yours carries both readings; the others carry the exact count only.
    expect(barText(opened(), "Dogs")).toMatch(/30%/);
    expect(barText(opened(), "Cats")).toBe("Cats5");
    cleanup();

    show([row("q", [5, 3, 2], { options: opts })]);
    // With no answer of yours the leader takes the percentage — dropping
    // that branch leaves an unanswered question with no share printed
    // anywhere in its expanded view.
    expect(barText(opened(), "Cats")).toMatch(/50%/);
    expect(barText(opened(), "Dogs")).toBe("Dogs3");
  });
});

// ── 4 · rating draws a histogram, everything else draws bars ─────────

describe("expanded, the shape follows the question", () => {
  const TEN = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
  const rating = () =>
    show([row("q", [0, 0, 0, 1, 2, 3, 0, 0, 0, 0], { type: "rating", options: TEN, mine: 4 })]);

  it("gives a scale one labelled bar per option", () => {
    // A scale is ordinal but its points are WORDS, so it reads as bars —
    // treating it as a rating would hide three of these five labels.
    show([row("q", [1, 2, 3, 4, 5], {
      type: "scale",
      options: ["Never", "Rarely", "Sometimes", "Often", "Always"],
    })]);
    for (const o of ["Never", "Rarely", "Sometimes", "Often", "Always"]) {
      expect(within(opened()).getByText(o)).toBeTruthy();
    }
  });

  it("draws a rating as columns with only the ends named", () => {
    rating();
    expect(within(opened()).getByText("1")).toBeTruthy();
    expect(within(opened()).getByText("10")).toBeTruthy();
    // Ten labels under ten columns is the shape the histogram exists to
    // avoid; the scale's ends are what a reader needs.
    expect(within(opened()).queryByText("5")).toBeNull();
  });

  it("leaves your own column solid and every other one faint", () => {
    rating();
    // The one place in this panel where a style value IS the reading:
    // the histogram has no label, no count and no chip on your column —
    // opacity is the entire mark, so an off-by-one here tells you that
    // you rated it a 6.
    const columns = [...(opened().firstElementChild?.firstElementChild?.children ?? [])] as HTMLElement[];
    expect(columns).toHaveLength(10);
    expect(columns.map((c) => c.style.opacity).filter((o) => o === "1")).toHaveLength(1);
    expect(columns[4].style.opacity).toBe("1");
  });
});

// ── 5 · where you stand (D120, D170) ─────────────────────────────────

describe("where you stand", () => {
  it("says how many are with you on a categorical question", () => {
    show([row("q", [3, 7], { mine: 1 })]);
    expect(screen.getByText("70% of Oslo are with you.")).toBeTruthy();
  });

  it("says which way you lean on an ordinal one", () => {
    // The same 90% on both sides of the comparison, deliberately: what
    // separates these two sentences is the DIRECTION, and a test that
    // leaned on the number would pass with the two strings swapped.
    show([row("q", [5, 3, 1, 1, 0], { type: "scale", mine: 3 })]);
    expect(screen.getByText("Further along than 90% of Oslo.")).toBeTruthy();
    cleanup();

    show([row("q", [0, 1, 1, 3, 5], { type: "scale", mine: 1 })]);
    expect(screen.getByText("Less far along than 90% of Oslo.")).toBeTruthy();
  });

  it("says you have not answered rather than saying nothing", () => {
    // Dropping the line made an unanswered row look like an answered one
    // whose sentence failed to render.
    show([row("q", [3, 7])]);
    expect(screen.getByText("You have not answered this one.")).toBeTruthy();
  });

  it("refuses to make a percentage out of one answer", () => {
    // D170, and it shipped: a city with a single answer said "100% of
    // Oslo are with you", which reports the sample size in the costume of
    // a share.
    show([row("q", [1, 0], { mine: 0 })]);
    expect(screen.getByText("One answer from Oslo so far.")).toBeTruthy();
    // Scoped to the SENTENCE, because the bar beside it legitimately says
    // "100% · 1": a share printed next to the headcount it was computed
    // from is not the thing D170 refused. The refusal is a share stated as
    // a fact about the cohort.
    expect(screen.queryByText(/% of Oslo/)).toBeNull();
  });
});

// ── 6 · the three orderings ──────────────────────────────────────────

describe("the three orderings", () => {
  it("opens on most answers, and says which ordering is on", () => {
    show([row("small", [2, 3]), row("big", [30, 10]), row("mid", [6, 6])]);
    expect(titles()).toEqual(["big?", "mid?", "small?"]);
    // The list is not self-describing — which sort is on has to be
    // legible, and `aria-pressed` is how a reader who cannot see the
    // underline gets it.
    expect(screen.getByRole("button", { name: "Most answers" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("ranks divisiveness against each question's own even split", () => {
    // The pair that separates cohort's normalised measure from a raw
    // `1 - leadingShare`: the binary is nine tenths of the way to its own
    // even split (55/45), the four-way only four fifths of the way to
    // its (40/20/20/20) — but the four-way's leader is SMALLER, so the
    // raw measure ranks it first. Equal `n`, so the default ordering
    // leaves them in the order given and only the sort can move them.
    show([
      row("four", [40, 20, 20, 20], { text: "four?" }),
      row("binary", [55, 45], { text: "binary?" }),
    ]);
    expect(titles()).toEqual(["four?", "binary?"]);
    fireEvent.click(screen.getByRole("button", { name: "Most divisive" }));
    expect(titles()).toEqual(["binary?", "four?"]);
  });

  it("keeps a single answer off the head of most agreed", () => {
    // A one-answer question is 0 on this scale — unanimous by
    // arithmetic, silent by content — and it is listed first here, so a
    // missing tie-break shows up as the list not moving.
    show([
      row("lone", [1, 0], { text: "lone?" }),
      row("crowd", [200, 0], { text: "crowd?" }),
      row("split", [50, 50], { text: "split?" }),
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Most agreed" }));
    expect(titles()).toEqual(["crowd?", "lone?", "split?"]);
  });
});

// ── 7 · the branch chips ─────────────────────────────────────────────

describe("the branch chips", () => {
  const mixed = () => show([
    row("w1", [3, 1], { branch: "Work", text: "w1?" }),
    row("w2", [2, 2], { branch: "Work", text: "w2?" }),
    row("l1", [5, 1], { branch: "Life", text: "l1?" }),
    row("x1", [1, 1], { text: "x1?" }),
  ]);

  it("filters to one branch and counts it", () => {
    mixed();
    expect(screen.getByRole("button", { name: "All 4" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Work 2" }));
    expect(titles()).toEqual(["w1?", "w2?"]);
  });

  it("draws no chip band when every question is in the same branch", () => {
    // One chip and an "All" beside it is a control with nothing to
    // choose between.
    show([row("a", [3, 1], { branch: "Work" }), row("b", [2, 2], { branch: "Work" })]);
    expect(screen.queryByRole("button", { name: "All 2" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Work 2" })).toBeNull();
  });
});

// ── 8 · seven rows, then the rest ────────────────────────────────────

// Nine questions whose answer counts and whose divisiveness run in
// OPPOSITE directions, so "most answers" and "most agreed" are exact
// reversals of each other and a re-sort visibly moves every row.
const NINE: AnswerRow[] = [
  [10, 0], [19, 1], [27, 3], [34, 6], [40, 10], [45, 15], [49, 21], [52, 28], [54, 36],
].map((c, i) => row(`q${i + 1}`, c, { text: `q${i + 1}?` }));

describe("seven rows, then the rest", () => {
  it("holds the list at seven and says how many are behind the button", () => {
    show(NINE);
    expect(rowControls()).toHaveLength(7);
    fireEvent.click(screen.getByRole("button", { name: "Show 2 more" }));
    expect(rowControls()).toHaveLength(9);
    expect(screen.queryByRole("button", { name: /Show \d+ more/ })).toBeNull();
  });

  it("puts the list back to its first seven, top row open, on a re-sort", () => {
    show(NINE);
    fireEvent.click(screen.getByRole("button", { name: "Show 2 more" }));
    // Open something that will still be in the list afterwards but no
    // longer at the top of it.
    fireEvent.click(rowControls()[2]);
    fireEvent.click(screen.getByRole("button", { name: "Most agreed" }));
    expect(rowControls()).toHaveLength(7);
    // A new ordering with a row open somewhere down it reads as a list
    // that did not re-sort; the reader's eye is at the top.
    expect(titles()[0]).toBe("q1?");
    expect(opened().previousElementSibling).toBe(rowControls()[0]);
  });
});

// ── 9 · one row open at a time ───────────────────────────────────────

describe("one row open at a time", () => {
  const three = () => show([row("a", [3, 1]), row("b", [2, 2]), row("c", [5, 1])]);

  it("opens the first row and lets it close again", () => {
    three();
    // A tab that opens on a closed list reads as a table of contents —
    // and the sentinel that opens the first row is exactly where this
    // panel's one recorded regression lived: comparing `open` against the
    // row's own qid makes the first tap set the state the row was already
    // showing, so the first row could not be closed at all.
    expect(screen.getAllByRole("button", { expanded: true })).toHaveLength(1);
    expect(opened().previousElementSibling).toBe(rowControls()[0]);
    fireEvent.click(rowControls()[0]);
    expect(screen.queryAllByRole("button", { expanded: true })).toHaveLength(0);
  });

  it("closes the open row when another one opens", () => {
    three();
    fireEvent.click(rowControls()[2]);
    const open = screen.getAllByRole("button", { expanded: true });
    expect(open).toHaveLength(1);
    expect(open[0]).toBe(rowControls()[2]);
  });
});
