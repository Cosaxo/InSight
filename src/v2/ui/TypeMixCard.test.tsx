// @vitest-environment jsdom
//
// The v28 §8 system switch, and the line it must not cross. Four
// properties:
//
//   1. The remembered instrument survives a remount (insight.typemix.sys)
//      and a foreign stored value falls back to the default test rather
//      than selecting a system the archetype module does not define.
//   2. The purge event snaps the mounted card back to the default WITHOUT
//      rewriting the key — writing it back would undo purgeLocalTrace's
//      sweep for the next account (check:purge's contract).
//   3. The three non-Big-Five positions state the type-index sheet's
//      refusal and never a type name or a share — the Art. 9 scope
//      data/typeMix.test.ts pins means those mixes are never measured,
//      and D167 means they are never faked.
//   4. The switch stays reachable on the empty branch, or a reader parked
//      on an empty position could never switch away.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { TypeRow } from "../data/typeMix";

const MIX: {
  typedN: number; sampleN: number;
  ranked: TypeRow[]; thin: TypeRow[]; absent: TypeRow[];
} = {
  typedN: 42,
  sampleN: 60,
  ranked: [
    { name: "The Quiet One", n: 30 },
    { name: "The Host", n: 12 },
  ],
  thin: [],
  absent: [],
};

vi.mock("../data/typeMix", () => ({
  TYPE_TEST: "big5",
  TYPE_SMALL: 40,
  typeMixFor: vi.fn(() => MIX),
  myType: vi.fn(() => "The Quiet One"),
}));
vi.mock("../data/live", () => ({ default: { anchors: () => ({}) } }));
// The mark is SVG arithmetic exercised by its own surface's tests; here it
// would only add noise to queries that ask about words.
vi.mock("../spec/type-marks.jsx", () => ({ TypeMark: () => null }));

import TypeMixCard from "./TypeMixCard";

const KEY = "insight.typemix.sys";
const selected = (label: string) =>
  screen.getByRole("tab", { name: label, selected: true });

beforeEach(() => localStorage.removeItem(KEY));
afterEach(cleanup);

describe("the remembered instrument", () => {
  it("mounts on the stored system", () => {
    localStorage.setItem(KEY, "political");
    render(<TypeMixCard scope="city" />);
    expect(selected("Politics")).toBeTruthy();
    expect(screen.getByText("Shares are only counted for the Big Five.")).toBeTruthy();
  });

  it("falls back to Personality on a value no instrument owns", () => {
    localStorage.setItem(KEY, "zodiac");
    render(<TypeMixCard scope="city" />);
    expect(selected("Personality")).toBeTruthy();
    // The measured Big Five body, not the refusal.
    expect(screen.getByText("The Quiet One")).toBeTruthy();
  });

  it("remembers a pick", () => {
    render(<TypeMixCard scope="city" />);
    fireEvent.click(screen.getByRole("tab", { name: "Values" }));
    expect(localStorage.getItem(KEY)).toBe("values");
    expect(selected("Values")).toBeTruthy();
  });
});

describe("the purge", () => {
  it("drops the mounted choice and does not write the key back", () => {
    localStorage.setItem(KEY, "attachment");
    render(<TypeMixCard scope="city" />);
    expect(selected("Social")).toBeTruthy();
    // purgeLocalTrace has already swept the key when the event fires.
    localStorage.removeItem(KEY);
    fireEvent(window, new Event("insight:local-purge"));
    expect(selected("Personality")).toBeTruthy();
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});

describe("the three refusing positions", () => {
  it("state the refusal and never a type name or a share", () => {
    localStorage.setItem(KEY, "values");
    render(<TypeMixCard scope="city" />);
    expect(screen.getByText("Shares are only counted for the Big Five.")).toBeTruthy();
    expect(screen.queryByText("The Quiet One")).toBeNull();
    expect(screen.queryByText(/%/)).toBeNull();
    // And no basis count: "42 typed" is a Big Five measurement.
    expect(screen.queryByText(/typed in/)).toBeNull();
  });
});

describe("the empty branch", () => {
  it("keeps the switch reachable when nothing is typed", () => {
    MIX.typedN = 0;
    MIX.sampleN = 0;
    try {
      render(<TypeMixCard scope="city" />);
      expect(screen.getByText("Open a question's who-voted sheet and this fills in.")).toBeTruthy();
      expect(screen.getAllByRole("tab")).toHaveLength(4);
    } finally {
      MIX.typedN = 42;
      MIX.sampleN = 60;
    }
  });
});
