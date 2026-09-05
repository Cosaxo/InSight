// @vitest-environment jsdom
// The buyer's room (PAID-PLAN §7, D288, runbook phase 2). What these
// cases hold: the card's meter is arithmetic over the doc and the public
// counts (never a number of its own), the empty room says so instead of
// drawing, a subscription row is a stated contract and never the design's
// mocked series (D167), and the shelf offers no download it cannot honour
// — "delivered by the contract channel" is the only fulfilment that
// exists (D251 builds reports by hand).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Purchase } from "../data/purchases";
import { sharePcts } from "../data/pct";

const STORE = vi.hoisted(() => ({
  rows: null as Purchase[] | null,
  failed: false,
}));
vi.mock("../data/live", () => ({ default: { enabled: true } }));
vi.mock("../data/purchases", () => ({
  mine: () => STORE.rows,
  mineFailed: () => STORE.failed,
  loadMine: async () => STORE.rows ?? [],
  subscribePurchases: () => () => {},
}));

const { default: AskedByYouOverlay } = await import("./AskedByYouOverlay");

const PURCHASE: Purchase = {
  id: "u1_pd01",
  kind: "question",
  qid: "pd01",
  advertiser: "",
  headline: "",
  adBody: "",
  priceEur: 0,
  prompt: "Should the night buses run all night?",
  options: ["All night", "The hours are fine"],
  scope: "city",
  place: "Oslo",
  dims: ["city:Oslo"],
  win: { start: "2026-08-01", until: "2026-09-21" },
  cadence: "once",
  budget: { cap: 4000, capEur: 640, ratePerAnswer: 0.16 },
  state: "running",
  reports: [
    { label: "July report", ready: true },
    { label: "Final report", ready: false, note: "at close" },
  ],
  counts: [1840, 1160],
};

beforeEach(() => {
  cleanup();
  localStorage.clear();
  STORE.rows = null;
  STORE.failed = false;
});

describe("the room", () => {
  it("says the honest empty state instead of drawing anything", () => {
    STORE.rows = [];
    render(<AskedByYouOverlay onClose={() => {}} />);
    expect(screen.getByText(/Nothing bought from this account yet/)).toBeTruthy();
  });

  it("draws a purchase as arithmetic over the doc and the public counts", () => {
    STORE.rows = [PURCHASE];
    render(<AskedByYouOverlay onClose={() => {}} />);
    // the split: 1840 of 3000 → 61%, and the total with its unit
    expect(screen.getByText(/61% All night/)).toBeTruthy();
    expect(screen.getByText(/3 000 answers/)).toBeTruthy();
    // the meter: 3000 of 4000 = 75%, billed per answer at the LOCKED rate
    expect(screen.getByText(/of 4 000 budget · 75%/)).toBeTruthy();
    expect(screen.getByText(/bills per answer at €0.16, stops at the cap/)).toBeTruthy();
    // the dims are printed — every one, D228's own rule
    expect(screen.getByText("city:Oslo")).toBeTruthy();
  });

  it("rounds the split by the app's rule, not by its own", () => {
    // The buyer's room and the public feed card draw the SAME published
    // counts vector, and the feed rounds it with `sharePcts` — the
    // largest-remainder rule pct.ts exists to be the only one of. This
    // site used `Math.round` per option, which disagrees on about one
    // cell in eleven at three and four options, always by a point: the
    // buyer read a headline share one off the one everyone else was
    // reading for the buyer's own question.
    //
    // [8, 7, 6, 12] is such a cell: 12/33 is 36.36…, which rounds to 36
    // on its own and takes the last remainder to 37 in the vector.
    const counts = [8, 7, 6, 12];
    expect(Math.round((12 / 33) * 100), "fixture no longer separates the rules").toBe(36);
    expect(sharePcts(counts)[3]).toBe(37);
    STORE.rows = [{ ...PURCHASE, counts, options: ["A", "B", "C", "D"] }];
    render(<AskedByYouOverlay onClose={() => {}} />);
    expect(screen.getByText(/37% D/)).toBeTruthy();
  });

  it("counts the last serving day as a day — `until` is inclusive", () => {
    // The card read `until` as exclusive and measured against wall-clock
    // now, so on the contract's final serving day it printed "0 of N days
    // left" with the hairline full — beside a chip still saying running,
    // while live.ts's `fresh()` (`q.until >= today`) was still serving the
    // question. Every other reader treats both ends as inclusive.
    const today = new Date().toISOString().slice(0, 10);
    const back = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
    STORE.rows = [{ ...PURCHASE, win: { start: today, until: today } }];
    render(<AskedByYouOverlay onClose={() => {}} />);
    // A window opened and closed on one day serves for one day, not zero.
    expect(screen.getByText(/days left/).textContent).toBe("1 of 1 days left");
    cleanup();
    STORE.rows = [{ ...PURCHASE, win: { start: back(2), until: today } }];
    render(<AskedByYouOverlay onClose={() => {}} />);
    expect(screen.getByText(/days left/).textContent).toBe("1 of 3 days left");
  });

  it("caps the spend line at the cap — billing stops there", () => {
    STORE.rows = [{ ...PURCHASE, counts: [9000, 1000] }];
    render(<AskedByYouOverlay onClose={() => {}} />);
    // 10000 answers × 0.16 = 1600, capped to 640
    expect(screen.getByText(/€640 of €640 cap/)).toBeTruthy();
  });

  it("states a no-answers purchase rather than implying a zero split", () => {
    STORE.rows = [{ ...PURCHASE, counts: null }];
    render(<AskedByYouOverlay onClose={() => {}} />);
    expect(screen.getByText(/No answers yet — the split appears with the first one/)).toBeTruthy();
  });

  it("offers no download — the shelf states milestones and the channel", () => {
    STORE.rows = [PURCHASE];
    const { container } = render(<AskedByYouOverlay onClose={() => {}} />);
    expect(screen.getByText(/ready — delivered by the contract channel/)).toBeTruthy();
    expect(screen.getByText("at close")).toBeTruthy();
    expect(container.textContent).not.toMatch(/HTML|CSV|download/i);
  });

  it("renders a subscription as the contract stated, never the mocked series", () => {
    STORE.rows = [{ ...PURCHASE, id: "u1_sub1", kind: "subscription", prompt: "How safe does the city feel after dark?" }];
    const { container } = render(<AskedByYouOverlay onClose={() => {}} />);
    expect(screen.getByText(/lands with the score-subscription build/)).toBeTruthy();
    // no series bars, no invented per-day figures
    expect(container.textContent).not.toMatch(/n 44|this month/);
  });

  // THREE STATES BEHIND ONE NULL. `mine()` answers null both before the
  // read lands and after it fails, and the room drew "Reading your
  // contracts…" for both — a spinner with nothing behind it, no error and
  // no way back, for the life of the session. Settling the cache to an
  // empty list instead would have traded the hang for a lie: "Nothing
  // bought from this account yet", said to a buyer whose read failed.
  it("says it is reading while the read is in flight", () => {
    render(<AskedByYouOverlay onClose={() => {}} />);
    expect(screen.getByText(/Reading your contracts/)).toBeTruthy();
    expect(screen.queryByText(/Couldn’t read/)).toBeNull();
  });

  it("…and says the read failed once it has", () => {
    STORE.failed = true;
    render(<AskedByYouOverlay onClose={() => {}} />);
    expect(screen.getByText(/Couldn’t read your contracts/)).toBeTruthy();
    expect(screen.queryByText(/Reading your contracts/)).toBeNull();
    // …and never the empty state, which would be a claim about the
    // account rather than about the read.
    expect(screen.queryByText(/Nothing bought from this account yet/)).toBeNull();
  });

  it("keeps the room's one honesty line in its foot", () => {
    STORE.rows = [];
    render(<AskedByYouOverlay onClose={() => {}} />);
    expect(screen.getByText(/this room has no other source/)).toBeTruthy();
  });
});

describe("the results page's address, in the buyer's room (D379)", () => {
  it("offers to copy the public page's link on a question row", () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    STORE.rows = [PURCHASE];
    STORE.failed = false;
    render(<AskedByYouOverlay onClose={() => {}} />);
    const b = screen.getByRole("button", { name: /results page/i });
    fireEvent.click(b);
    expect(writeText).toHaveBeenCalledWith("https://prvfire33.web.app/q/pd01");
    expect(screen.getByText(/A public page of these results/)).toBeTruthy();
  });
});
