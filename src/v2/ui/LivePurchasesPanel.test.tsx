// @vitest-environment jsdom
//
// The buyer's room (D230). The property that matters most is the one
// nobody will ever screenshot: for the near-universal non-buyer — and
// for a failed load — the panel renders NOTHING. A card announcing "you
// have bought nothing" on every profile would be the feature charging
// everyone rent for one buyer's convenience. The rest is the room
// telling a buyer the truth: what they bought, whether it runs, the same
// public count everyone reads, and where reports come from.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { PurchaseRow } from "../data/live";

const LIVE = vi.hoisted(() => ({
  enabled: true,
  subscribe: () => () => {},
  loadPurchases: vi.fn(async () => {}),
  purchases: () => null as PurchaseRow[] | null,
  aggFor: (qid: string) => {
    void qid;
    return null as { total?: number } | null;
  },
}));
vi.mock("../data/live", () => ({ default: LIVE }));

const { default: LivePurchasesPanel } = await import("./LivePurchasesPanel");

const row = (over: Partial<PurchaseRow> = {}): PurchaseRow => ({
  id: "o1", qid: "q_paid", kind: "question", status: "active",
  prompt: "Should Oslo ban cars downtown?", until: "2026-11-22",
  boughtAtMs: 1, ...over,
});

beforeEach(() => {
  LIVE.enabled = true;
  LIVE.loadPurchases = vi.fn(async () => {});
  LIVE.purchases = () => null;
  LIVE.aggFor = () => ({ total: 41 });
});
afterEach(cleanup);

describe("who sees the room at all", () => {
  it("renders nothing while unfetched or failed — null is not an empty state", () => {
    const { container } = render(<LivePurchasesPanel />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing for a non-buyer, which is every account today", () => {
    LIVE.purchases = () => [];
    const { container } = render(<LivePurchasesPanel />);
    expect(container.innerHTML).toBe("");
  });

  it("asks the store on mount, so a buyer's first open fills the room", () => {
    render(<LivePurchasesPanel />);
    expect(LIVE.loadPurchases).toHaveBeenCalled();
  });
});

describe("what a buyer reads", () => {
  it("names the question, its kind, its window and the live public count", () => {
    LIVE.purchases = () => [row()];
    render(<LivePurchasesPanel />);
    expect(screen.getByText("Asked by you")).toBeTruthy();
    expect(screen.getByText("Should Oslo ban cars downtown?")).toBeTruthy();
    expect(screen.getByText(/Paid question · runs until 2026-11-22 · 41 answers so far/)).toBeTruthy();
  });

  it("labels a subscription and an ended order for what they are", () => {
    LIVE.purchases = () => [
      row({ id: "o2", kind: "subscription", status: "ended", until: undefined, prompt: "How safe does Oslo feel at night?" }),
    ];
    render(<LivePurchasesPanel />);
    expect(screen.getByText(/Score subscription · ended/)).toBeTruthy();
  });

  it("falls back to the qid when the operator wrote no prompt", () => {
    LIVE.purchases = () => [row({ prompt: "" })];
    render(<LivePurchasesPanel />);
    expect(screen.getByText("q_paid")).toBeTruthy();
  });

  it("states the packaging promise — public numbers, contract delivery", () => {
    // The room's one sentence of posture (D225/D229): the count is the
    // public one and the report packages it. If this line goes, the room
    // starts reading like a private dashboard.
    LIVE.purchases = () => [row()];
    render(<LivePurchasesPanel />);
    expect(screen.getByText(/same public numbers everyone sees/)).toBeTruthy();
    expect(screen.getByText(/delivered per your contract/)).toBeTruthy();
  });

  it("survives a question with no aggregate yet — zero, honestly", () => {
    LIVE.aggFor = () => null;
    LIVE.purchases = () => [row()];
    render(<LivePurchasesPanel />);
    expect(screen.getByText(/0 answers so far/)).toBeTruthy();
  });
});
