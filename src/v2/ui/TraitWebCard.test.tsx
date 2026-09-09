// @vitest-environment jsdom
//
// The trait web card's honesty rules (v28 §13):
//
//   1. LIVE values come from the viewer's own stored results and ONLY
//      from them — the demo persona's numbers must never leak into a
//      live render (the D66 class: someone else's psyche shown as yours).
//   2. Under four resolvable pairs the card renders NOTHING — one taken
//      instrument has no cross-test thread to draw.
//   3. Demo renders the design's persona in full, headline included —
//      the shipped demo surface, same as every sibling card.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

const live = vi.hoisted(() => ({
  enabled: false,
  myTestResults: vi.fn((): Record<string, unknown> => ({})),
  subscribe: vi.fn(() => () => {}),
}));
vi.mock("../data/live", () => ({ default: live }));

import TraitWebCard from "./TraitWebCard";

// Stored results in the shape publishTestResults keeps: dims arrays, the
// same one parseTestResults reads everywhere else.
const stored = (kind: string, vals: Record<string, number>) => ({
  [kind]: { dims: Object.entries(vals).map(([id, value]) => ({ id, value })) },
});

beforeEach(() => {
  live.enabled = false;
  live.myTestResults.mockReturnValue({});
});
afterEach(() => cleanup());

describe("TraitWebCard", () => {
  it("demo: draws the persona's web with its headline", () => {
    const { container } = render(<TraitWebCard />);
    expect(container.textContent).toContain("What moves together");
    // the demo persona (O 78, auth 24…) resolves every link — 8 rows shown
    expect(container.textContent).toMatch(/Openness/);
  });

  it("live: refuses to render under four resolvable pairs", () => {
    live.enabled = true;
    // one instrument taken — every link crosses tests, nothing resolves
    live.myTestResults.mockReturnValue(stored("big5", { O: 80, C: 60, E: 40, A: 70, N: 30 }));
    const { container } = render(<TraitWebCard />);
    expect(container.firstChild).toBeNull();
  });

  it("live: draws from the viewer's own results, never the persona's", () => {
    live.enabled = true;
    live.myTestResults.mockReturnValue({
      ...stored("big5", { O: 10, C: 50, E: 50, A: 50, N: 50 }),
      ...stored("political", { auth: 90, foreign: 90, econ: 50 }),
      ...stored("values", { beauty: 90, hedonism: 50, future: 50 }),
      ...stored("attachment", { warm: 50, play: 50, easy: 50, open: 50 }),
    });
    const { container } = render(<TraitWebCard />);
    // O 10 vs auth 90 (sign −1 → rail 10): dots together, holds; but
    // O 10 vs beauty 90 (sign +1): gap 80, beauty 40 off middle → break,
    // and the strongest one — its authored line is the headline
    expect(container.textContent).toContain("openness without the eye for beauty");
    // the persona's Openness (78) would have broken DIFFERENT rules; its
    // signature line must be absent
    expect(container.textContent).not.toContain("a curious mind that keeps the chain of command");
  });
});
