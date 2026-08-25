// @vitest-environment jsdom
// The buyer's room (PAID-PLAN §7, D288, runbook phase 2). What these
// cases hold: the card's meter is arithmetic over the doc and the public
// counts (never a number of its own), the empty room says so instead of
// drawing, a subscription row is a stated contract and never the design's
// mocked series (D167), and the shelf offers no download it cannot honour
// — "delivered by the contract channel" is the only fulfilment that
// exists (D251 builds reports by hand).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { Purchase } from "../data/purchases";

const STORE = vi.hoisted(() => ({
  rows: null as Purchase[] | null,
}));
vi.mock("../data/live", () => ({ default: { enabled: true } }));
vi.mock("../data/purchases", () => ({
  mine: () => STORE.rows,
  loadMine: async () => STORE.rows ?? [],
  subscribePurchases: () => () => {},
}));

const { default: AskedByYouOverlay } = await import("./AskedByYouOverlay");

const PURCHASE: Purchase = {
  id: "u1_pd01",
  kind: "question",
  qid: "pd01",
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

  it("keeps the room's one honesty line in its foot", () => {
    STORE.rows = [];
    render(<AskedByYouOverlay onClose={() => {}} />);
    expect(screen.getByText(/this room has no other source/)).toBeTruthy();
  });
});
