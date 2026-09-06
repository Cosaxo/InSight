// @vitest-environment jsdom
//
// LiveCircleBody's empty and failed arms (D172).
//
// The stop has three states that look alike from the outside and mean
// different things, and the file's own comment says why conflating two of
// them would be the worst bug it could have: `circle()` returning null
// after a settled load is a FAILED READ, not an empty circle, and saying
// "you follow nobody" to someone with thirty follows is a lie about their
// own account.
//
// D172 changed what EMPTY looks like — the field, not a paragraph — which
// makes it worth pinning that the change did not leak into the other two.
// A drawing where the failure notice goes would be the same class of
// mistake pointed the other way.
//
// Mounted directly rather than through the app: the live fixture ships a
// circle of one on purpose (it exercises the filled shape), and emptying
// it from outside is fighting the fixture to test a component.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

const LIVE = vi.hoisted(() => ({
  enabled: true,
  testAggsState: () => "ready" as "loading" | "ready" | "failed",
  // Its people twin — every surface that mounts a similarity field
  // reads it now, so the stub belongs beside its sibling.
  kindredState: (): "loading" | "ready" | "failed" => "ready",
  uid: "u_me",
  subscribe: () => () => {},
  loadCircle: async () => {},
  circle: () => [] as Array<Record<string, unknown>> | null,
  circleLoading: () => false as boolean,
  // The follow list, which is the circle's SIZE — the fold below drops
  // anyone whose answers read was refused, so `circle()` is the survivors
  // and this is who you actually follow. Null is "no follow cache", where
  // the header falls back to what it can see.
  follows: () => null as string[] | null,
  budgetPaused: false as boolean,
  aggregated: () => [] as Array<Record<string, unknown>>,
  aggFor: () => null,
  myVotes: () => ({}) as Record<string, string>,
  // Compare's fold since D193 — the circle's own answers to the bank's
  // test items, and your side of the comparison.
  testFeedItems: () => [] as Array<Record<string, unknown>>,
  myTestResults: () => ({}) as Record<string, unknown>,
  loadNames: vi.fn(async () => {}),
  scoresFor: () => null as Record<string, Record<string, number>> | null,
}));
vi.mock("../data/live", () => ({ default: LIVE }));

const { default: LiveCircleBody } = await import("./LiveCircleBody");
// The instrument definitions the fold joins the bank to. Read rather than
// invented: the join matches on PROMPT TEXT, so a made-up prompt would
// score nothing and the case would pass by drawing an empty state.
// @ts-expect-error TS7016 — untyped spec module (the LiveSimilarityField pattern)
const { IS_TESTS } = await import("../spec/test-definitions.js");

// A member as the fold hands one over — only the fields the header and
// the field read. Local to these cases: the richer helper further down
// belongs to the tab-row block and carries its own answers.
const placed = (uid: string) => ({
  uid, name: uid, mutual: false, like: { pct: 50, same: 5, shared: 10 }, answers: {},
});

beforeEach(() => {
  LIVE.circle = () => [];
  LIVE.circleLoading = () => false;
  LIVE.follows = () => null;
  LIVE.budgetPaused = false;
  LIVE.testFeedItems = () => [];
  LIVE.myTestResults = () => ({});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("LiveCircleBody · an empty circle is a field, not a paragraph", () => {
  it("counts the people you FOLLOW, not the ones whose answers could be read", () => {
    // data/circle.ts drops a member whose answers read was refused
    // (`if (!answers) return`). The header drew the survivors, so a circle
    // of four with two refusals read "2 people" — a number with no basis
    // and no hint that anything was missing.
    LIVE.circle = () => [placed("u_a"), placed("u_b")];
    LIVE.follows = () => ["u_a", "u_b", "u_c", "u_d"];
    render(<LiveCircleBody />);
    expect(screen.getByText("4 people")).toBeTruthy();
    expect(screen.queryByText("2 people"), "the survivors drawn as the size").toBeNull();
    expect(screen.getByText(/2 placed · 2 couldn’t be read just now/)).toBeTruthy();
  });

  it("says the reads failed rather than 'Nobody yet' over people you follow", () => {
    // Every answers read refused: the fold returns no members at all, and
    // the header told someone with four follows that they have none. The
    // store's own note says rebuilding the follow cache from the survivors
    // "turned a refused read into an unfollow"; this was the same mistake
    // one layer up, in the sentence.
    LIVE.circle = () => [];
    LIVE.follows = () => ["u_a", "u_b", "u_c", "u_d"];
    render(<LiveCircleBody />);
    expect(screen.getByText("4 people")).toBeTruthy();
    expect(screen.queryByText(/Nobody yet/)).toBeNull();
    expect(screen.getByText(/Couldn’t read anyone’s answers just now/)).toBeTruthy();
  });

  it("still says Nobody yet when you really follow nobody", () => {
    // THE CONTROL. A header that always printed the follow count would
    // pass both cases above and then tell an empty circle it has people in
    // it; one that always said "couldn't read" would tell a new account
    // the app is broken.
    LIVE.circle = () => [];
    LIVE.follows = () => [];
    render(<LiveCircleBody />);
    expect(screen.getByText(/Nobody yet/)).toBeTruthy();
    expect(screen.queryByText(/couldn’t be read/)).toBeNull();
    expect(screen.queryByText(/Couldn’t read anyone/)).toBeNull();
  });

  it("does not say nobody follows you back when the followers read was REFUSED", () => {
    // `mutual: null` is "we could not ask", and the fold sets it that way
    // for the whole circle when fetchFollowersOf rejects. The sentence
    // under the header turns that absence into a claim about other people
    // — and the guard that stops it was added with no case: replacing
    // `mutualsKnown` with `true` left the whole suite green.
    LIVE.circle = () => [
      { ...placed("u_a"), mutual: null },
      { ...placed("u_b"), mutual: null },
    ];
    LIVE.follows = () => ["u_a", "u_b"];
    render(<LiveCircleBody />);
    expect(screen.getByText(/By likeness/)).toBeTruthy();
    expect(screen.queryByText(/nobody is told/)).toBeNull();
  });

  it("…and does say it when the read landed and nobody does", () => {
    // THE CONTROL. A guard that never let the sentence through would pass
    // the case above and silently delete a true thing the stop is there to
    // say.
    LIVE.circle = () => [placed("u_a"), placed("u_b")];
    LIVE.follows = () => ["u_a", "u_b"];
    render(<LiveCircleBody />);
    expect(screen.getByText(/following is one-way, nobody is told/)).toBeTruthy();
  });

  it("draws the rings and you when you follow nobody", () => {
    const { container } = render(<LiveCircleBody />);
    // The drawing is the claim. Before D172 this arm replaced it with a
    // headline, which reads as a stop that was never built rather than one
    // that is empty — and it hides the grammar the whole tab speaks from
    // the reader who has not learned it yet.
    expect(container.querySelector("svg"), "the empty circle lost its field").toBeTruthy();
    // "you" at the centre is the true picture node for node — nothing is
    // fabricated, which is what lets the drawing be here at all.
    expect(screen.getByText("you")).toBeTruthy();
    // The sentence survives; it just sits under the field instead of
    // standing where the field goes.
    expect(screen.getByText(/Follow someone from a who-voted sheet/i)).toBeTruthy();
    // And the retired headline is gone.
    expect(screen.queryByText(/You follow nobody yet/i)).toBeNull();
  });

  it("still says a FAILED read is a failure, and draws no field for it", () => {
    // The distinction this file exists for: null after a settled load
    // means the read broke. Drawing an empty constellation for it would
    // tell someone with thirty follows that they have none — the D172
    // change pointed the wrong way.
    LIVE.circle = () => null;
    const { container } = render(<LiveCircleBody />);
    expect(screen.getByText(/Couldn’t load your circle/i)).toBeTruthy();
    expect(container.querySelector("svg"),
      "a failed read drew a field, which claims the circle is empty").toBeNull();
  });

  it("says nothing at all while the first read is still in flight", () => {
    LIVE.circle = () => null;
    LIVE.circleLoading = () => true;
    render(<LiveCircleBody />);
    expect(screen.getByText(/Loading your circle/i)).toBeTruthy();
    expect(screen.queryByText(/Couldn’t load/i)).toBeNull();
  });

  it("says PAUSED under the read breaker, never 'couldn't load' (D332)", () => {
    // Same null circle as the failed arm — the breaker refused the fetch
    // rather than losing it, and the stop must say which happened:
    // "couldn't load / it retries" promises a retry that will keep
    // refusing until the operator releases the mode.
    LIVE.circle = () => null;
    LIVE.budgetPaused = true;
    render(<LiveCircleBody />);
    expect(screen.getByText(/Paused for now/i)).toBeTruthy();
    expect(screen.getByText(/costs in check/i)).toBeTruthy();
    expect(screen.queryByText(/Couldn’t load/i)).toBeNull();
  });
});

// ── the stop has a tab row now (D190) ────────────────────────────────
//
// D188 measured the row on every stop that had one and recorded that this
// one had none: "a missing feature, not a misplaced one". The stop's three
// readings — who is here, what they split on, you against them — were one
// long scroll; they are Answers · People · Compare now, and the row draws
// on an empty circle too. A row that appears only once there is data is a
// stop that reads as unfinished to exactly the account that has none.
describe("LiveCircleBody · the row is the stop's, not the data's", () => {
  const MEMBER = {
    uid: "u_ada", name: "Ada", mutual: true,
    like: { pct: 80, same: 4, shared: 5, rate: 0.45 },
    answers: {},
  };
  const tabNames = () => screen.getAllByRole("tab").map((t) => t.textContent);
  const openTab = (label: string) =>
    fireEvent.click(screen.getByRole("tab", { name: label }));

  it("draws Answers · People · Compare with people in the circle", () => {
    LIVE.circle = () => [MEMBER];
    render(<LiveCircleBody />);
    expect(tabNames()).toEqual(["Answers", "People", "Compare"]);
  });

  // The "so what" line (2026-08-24): the field's two extremes said once,
  // names only — and quiet below two placeable NAMED members, because
  // "Someone mirrors you closest" reads as a bug and invented names are
  // the D214 refusal.
  it("names the closest and least-alike members under the field — with two placed", () => {
    LIVE.circle = () => [
      MEMBER,
      { uid: "u_bo", name: "Bo", mutual: false, like: { pct: 30, same: 1, shared: 4, rate: 0.07 }, answers: {} },
    ];
    render(<LiveCircleBody />);
    expect(screen.getByText(/mirrors you closest/).textContent).toContain("Ada");
    expect(screen.getByText(/mirrors you closest/).textContent).toContain("Bo");
  });

  it("crowns the deep match over the thin one — the printed pct cannot decide it", () => {
    // The bug D277 §2 named and this site kept: 1 of 1 is 100% and 45 of
    // 50 is 90%, so a pct sort puts the stranger who agreed once at the
    // top — while the People tab beneath, which draws the same list in
    // rankMembers order under "By likeness", puts the other one first.
    // One screen, two answers.
    //
    // A third member carries the OTHER end now. Thin used to fill it, by
    // being last in a sort that pushes small samples down — which printed
    // "mirrors you least" over the one person in the circle who had agreed
    // with everything. The far end is the lowest printed likeness, and Far
    // is it.
    LIVE.circle = () => [
      { uid: "u_thin", name: "Thin", mutual: false, like: { pct: 100, same: 1, shared: 1, rate: 0.21 }, answers: {} },
      { uid: "u_deep", name: "Deep", mutual: false, like: { pct: 90, same: 45, shared: 50, rate: 0.81 }, answers: {} },
      { uid: "u_far", name: "Far", mutual: false, like: { pct: 40, same: 20, shared: 50, rate: 0.27 }, answers: {} },
    ];
    render(<LiveCircleBody />);
    expect(screen.getByText(/mirrors you closest/).textContent).toContain("Deep");
    expect(screen.getByText(/mirrors you least|mirrors you closest/).textContent).toContain("Far");
    expect(screen.getByText(/mirrors you closest/).textContent).not.toContain("Thin");
    // …and the closest is named before the least-alike, which is the
    // direction the sentence reads.
    const line = screen.getByText(/mirrors you closest/).textContent || "";
    expect(line.indexOf("Deep")).toBeLessThan(line.indexOf("Far"));
  });

  it("says nothing at all when the far end is the closest member", () => {
    // Two placed members, one of them a 1-of-1 at 100%: the top is Deep on
    // the bound, and the lowest PRINTED likeness is Deep as well. There is
    // no one further from you than the person being called closest, so the
    // line has nothing true to say and does not say it. It used to name
    // Thin — at 100% — as the one who mirrors you least.
    LIVE.circle = () => [
      { uid: "u_thin", name: "Thin", mutual: false, like: { pct: 100, same: 1, shared: 1, rate: 0.21 }, answers: {} },
      { uid: "u_deep", name: "Deep", mutual: false, like: { pct: 90, same: 45, shared: 50, rate: 0.81 }, answers: {} },
    ];
    render(<LiveCircleBody />);
    expect(screen.queryByText(/mirrors you/)).toBeNull();
  });

  it("says nothing when the circle is flat — nobody is closest on equal numbers", () => {
    LIVE.circle = () => [
      { uid: "u_a", name: "Ann", mutual: false, like: { pct: 60, same: 3, shared: 5, rate: 0.31 }, answers: {} },
      { uid: "u_b", name: "Bea", mutual: false, like: { pct: 60, same: 3, shared: 5, rate: 0.31 }, answers: {} },
    ];
    render(<LiveCircleBody />);
    expect(screen.queryByText(/mirrors you closest/)).toBeNull();
  });

  it("says nothing under the field of one — the picture already says it", () => {
    LIVE.circle = () => [MEMBER];
    render(<LiveCircleBody />);
    expect(screen.queryByText(/mirrors you closest/)).toBeNull();
  });

  it("draws the same row on an empty circle, over the empty field", () => {
    LIVE.circle = () => [];
    const { container } = render(<LiveCircleBody />);
    expect(tabNames()).toEqual(["Answers", "People", "Compare"]);
    expect(container.querySelector("svg"), "the empty circle lost its field").toBeTruthy();
  });

  it("draws NO row for a failed read, where it has nothing to offer", () => {
    // Three readings of a circle nobody could load is three empty states
    // for one failure, and it would hide the retry sentence under them.
    LIVE.circle = () => null;
    render(<LiveCircleBody />);
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
  });

  it("opens on nothing, and a second tap closes what it opened", () => {
    LIVE.circle = () => [MEMBER];
    render(<LiveCircleBody />);
    expect(screen.queryByRole("tabpanel")).toBeNull();
    openTab("People");
    // WITHIN THE PANEL, not the whole document. A bare getByText("Ada")
    // threw "found multiple elements" the moment this case ran after one
    // that had already resolved the constellation's lazy chunk — the field
    // above the row names the same member. Reproduced with
    // `--sequence.shuffle --sequence.seed=4242`.
    //
    // Scoping is also the assertion this case wanted: the claim is that
    // opening People PUTS THE MEMBER IN THE PANEL, and the document-wide
    // query would have been satisfied by the field drawing her while the
    // panel stayed empty.
    expect(within(screen.getByRole("tabpanel")).getByText("Ada")).toBeTruthy();
    openTab("People");
    expect(screen.queryByRole("tabpanel")).toBeNull();
  });

  it("says why a tab is empty rather than drawing nothing", () => {
    LIVE.circle = () => [];
    render(<LiveCircleBody />);
    openTab("People");
    expect(screen.getByRole("tabpanel").textContent).toMatch(/a follow is one tap/i);
    openTab("Answers");
    expect(screen.getByRole("tabpanel").textContent).toMatch(/Fills in once two people you follow/i);
  });
});

// ── Compare is the profile drawing here too (D193) ──────────────────
//
// The circle is the one SET the Mirror can fold from counts: its members'
// answers are already fetched for the Answers tab, so its side of the
// comparison is the same `axisScores` arithmetic a city's is — with a
// sample floor of two rather than thirty, because a circle is not a
// sample of anything. It is the exact set you chose, and its mean is
// that set's mean at any size.
describe("LiveCircleBody · Compare lays two profiles over each other", () => {
  // Every big5 item, in the seeded bank's shape.
  const BIG5 = (IS_TESTS as Record<string, { questions: Array<{ q: string }> }>)
    .big5.questions.map((q, i) => ({
      id: `t_big5_${i}`, prompt: q.q, test: "big5", surface: "test",
      options: ["1", "2", "3", "4", "5"],
    }));
  // The MIDDLE option on every item, which scores every axis at exactly
  // 50 whether the item is reversed or not (`invert ? 4 - 2 : 2` is 2
  // either way) — so the fixture cannot depend on which items carry the
  // flag.
  const answers = Object.fromEntries(BIG5.map((q) => [q.id, 2]));
  const member = (uid: string) => ({
    uid, name: uid, mutual: false, like: { pct: 0, same: 0, shared: 0 }, answers,
  });

  beforeEach(() => {
    LIVE.testFeedItems = () => BIG5;
    LIVE.myTestResults = () => ({
      big5: { dims: [
        { id: "O", value: 70 }, { id: "C", value: 60 }, { id: "E", value: 50 },
        { id: "A", value: 40 }, { id: "N", value: 30 },
      ] },
    });
  });

  it("folds the circle's own answers into a profile", async () => {
    LIVE.circle = () => [member("u_ada"), member("u_bo")];
    render(<LiveCircleBody />);
    fireEvent.click(screen.getByRole("tab", { name: "Compare" }));
    // The circle sits at 50 on all five; your gaps are 20, 10, 0, 10, 20
    // — mean 12, so 88.
    const panel = await screen.findByText(/across 5 axes/);
    expect(panel).toBeTruthy();
    expect(screen.getByRole("tabpanel").textContent).toMatch(/88/);
    expect(screen.getByRole("tabpanel").textContent).toMatch(/your circle/);
  });

  it("draws for a circle of one, because one member IS that circle", async () => {
    // Not a thin sample of a crowd — the whole population, which happens
    // to be one person. The header directly above says "1 person", so the
    // reader is never left guessing how many the mean ran over.
    LIVE.circle = () => [member("u_ada")];
    render(<LiveCircleBody />);
    fireEvent.click(screen.getByRole("tab", { name: "Compare" }));
    expect(await screen.findByText(/across 5 axes/)).toBeTruthy();
  });

  it("refuses an axis the circle has answered one item of", async () => {
    // Two members, one item each — five answers is plenty and one item is
    // not an axis. `minItems` is the floor that binds, and it binds on
    // every population: "an axis is several questions agreeing" is not a
    // claim about sample size.
    const one = { [BIG5[0].id]: 2 };
    LIVE.circle = () => [
      { uid: "u_ada", name: "Ada", mutual: false, like: { pct: 0, same: 0, shared: 0 }, answers: one },
      { uid: "u_bo", name: "Bo", mutual: false, like: { pct: 0, same: 0, shared: 0 }, answers: one },
    ];
    render(<LiveCircleBody />);
    fireEvent.click(screen.getByRole("tab", { name: "Compare" }));
    expect(await screen.findByText(/Fills in as the people you follow answer/i)).toBeTruthy();
  });
});
