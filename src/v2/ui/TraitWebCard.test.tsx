// @vitest-environment jsdom
//
// The trait web card's honesty rules (v28 §13, D393):
//
//   1. LIVE values come from the viewer's own stored results and ONLY
//      from them — the demo persona's numbers must never leak into a
//      live render (the D66 class: someone else's psyche shown as yours).
//   2. Under four resolvable pairs the card renders NOTHING — one taken
//      instrument has no cross-test thread to draw.
//   3. Demo renders the design's persona in full, headline included —
//      the shipped demo surface, same as every sibling card.
//   4. LIVE draws no usual pattern it has not measured: with no sample the
//      card is absent whatever the viewer's own results say, and with a
//      sample it fetches its own crowd and names the basis in its key.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import type { TraitSamplePerson } from "../data/traitLinks";

const live = vi.hoisted(() => ({
  enabled: false,
  myTestResults: vi.fn((): Record<string, unknown> => ({})),
  subscribe: vi.fn(() => () => {}),
  kindredPeople: vi.fn((): Array<{ results: TraitSamplePerson | null }> => []),
  loadKindred: vi.fn(async () => {}),
}));
vi.mock("../data/live", () => ({ default: live }));

import TraitWebCard from "./TraitWebCard";

// Stored results in the shape publishTestResults keeps: dims arrays, the
// same one parseTestResults reads everywhere else.
const stored = (kind: string, vals: Record<string, number>) => ({
  [kind]: { dims: Object.entries(vals).map(([id, value]) => ({ id, value })) },
});

// A crowd that follows every authored direction — one latent per person,
// the traitLinks.test.ts generator in the shape kindredPeople returns.
function crowd(n: number): Array<{ results: TraitSamplePerson }> {
  let s = 7;
  const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  const out: Array<{ results: TraitSamplePerson }> = [];
  for (let i = 0; i < n; i++) {
    const x = 10 + rnd() * 80;
    const j = () => (rnd() - 0.5) * 24;
    const c = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
    out.push({ results: {
      big5: { O: c(x + j()), C: c(x + j()), E: c(x + j()), A: c(x + j()), N: c(x + j()) },
      political: { auth: c(100 - x + j()), foreign: c(x + j()), econ: c(100 - x + j()) },
      values: { beauty: c(x + j()), hedonism: c(100 - x + j()), future: c(100 - x + j()) },
      attachment: { warm: c(x + j()), play: c(x + j()), easy: c(100 - x + j()), open: c(x + j()) },
    } });
  }
  return out;
}

const mine = () => ({
  ...stored("big5", { O: 10, C: 50, E: 50, A: 50, N: 50 }),
  ...stored("political", { auth: 90, foreign: 90, econ: 50 }),
  ...stored("values", { beauty: 90, hedonism: 50, future: 50 }),
  ...stored("attachment", { warm: 50, play: 50, easy: 50, open: 50 }),
});

beforeEach(() => {
  live.enabled = false;
  live.myTestResults.mockReturnValue({});
  live.kindredPeople.mockReturnValue([]);
  live.loadKindred.mockClear();
});
afterEach(() => cleanup());

describe("TraitWebCard", () => {
  it("demo: draws the persona's web with its headline, from the authored table", () => {
    const { container } = render(<TraitWebCard />);
    expect(container.textContent).toContain("What moves together");
    // the demo persona (O 78, auth 24…) resolves every link — 8 rows shown
    expect(container.textContent).toMatch(/Openness/);
    // nothing was measured, so the key claims no basis
    expect(container.textContent).not.toMatch(/measured over/);
    expect(live.loadKindred).not.toHaveBeenCalled();
  });

  it("live: refuses to render under four resolvable pairs", () => {
    live.enabled = true;
    live.kindredPeople.mockReturnValue(crowd(40));
    // one instrument taken — every link crosses tests, nothing resolves
    live.myTestResults.mockReturnValue(stored("big5", { O: 80, C: 60, E: 40, A: 70, N: 30 }));
    const { container } = render(<TraitWebCard />);
    expect(container.firstChild).toBeNull();
  });

  it("live: draws no usual pattern it has not measured", () => {
    live.enabled = true;
    live.myTestResults.mockReturnValue(mine());
    // every instrument taken, and NO sample to measure the pattern over:
    // the pre-D393 card drew all eleven authored rules here and called
    // the strongest "the rule you break"
    const { container } = render(<TraitWebCard />);
    expect(container.firstChild, "an authored correlation was drawn as the usual pattern").toBeNull();
    // …and it asked for the crowd it would need, the result card's rule
    expect(live.loadKindred).toHaveBeenCalled();
  });

  it("live: draws from the viewer's own results, never the persona's, over a measured basis", () => {
    live.enabled = true;
    live.kindredPeople.mockReturnValue(crowd(40));
    live.myTestResults.mockReturnValue(mine());
    const { container } = render(<TraitWebCard />);
    // O 10 vs auth 90 (sign −1 → rail 10): dots together, holds; but
    // O 10 vs beauty 90 (sign +1): gap 80, beauty 40 off middle → break,
    // and the strongest one — its authored line is the headline, because
    // the sample measured the direction the line was written for
    expect(container.textContent).toContain("openness without the eye for beauty");
    // the persona's Openness (78) would have broken DIFFERENT rules; its
    // signature line must be absent
    expect(container.textContent).not.toContain("a curious mind that keeps the chain of command");
    // the key names what the pattern was counted over
    expect(container.textContent).toMatch(/measured over the people this session has scores for — at least 40 behind every thread/);
  });

  it("live: a sample below the floor is a card that is not there", () => {
    live.enabled = true;
    live.kindredPeople.mockReturnValue(crowd(12));
    live.myTestResults.mockReturnValue(mine());
    const { container } = render(<TraitWebCard />);
    expect(container.firstChild, "twelve people were drawn as the usual pattern").toBeNull();
  });
});
