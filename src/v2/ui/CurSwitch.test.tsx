// @vitest-environment jsdom
// The currency switch — the one control over data/pricing's preference
// (phase 4 of the D287/D288 build; check:panel-suites is why a 30-line
// panel still gets its own suite: the pressed mark moving to the wrong
// button would type-check perfectly). What these cases hold: the offer
// comes from the COMMITTED card's fx table, a tap moves the preference
// and persists it, the purge hands the next account a clean EUR default,
// and a card with no fx renders no control at all rather than a
// one-button "choice".
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { cur } from "../data/pricing";
import { CurSwitch } from "./CurSwitch";

const pressed = (name: string): string | null =>
  screen.getByRole("button", { name }).getAttribute("aria-pressed");

beforeEach(() => {
  cleanup();
  localStorage.clear();
  // The store's own purge listener is the reset: cache dropped, subscribers
  // notified — exactly what a fresh account sees.
  window.dispatchEvent(new Event("insight:local-purge"));
});

describe("the currency switch", () => {
  it("offers every currency on the committed card, EUR pressed by default", () => {
    render(<CurSwitch />);
    expect(
      screen.getAllByRole("button").map((b) => b.getAttribute("aria-label")),
    ).toEqual(["Prices in EUR", "Prices in NOK", "Prices in USD"]);
    expect(pressed("Prices in EUR")).toBe("true");
    expect(pressed("Prices in NOK")).toBe("false");
  });

  it("a tap moves the preference, the pressed mark, and the persisted key", () => {
    render(<CurSwitch />);
    fireEvent.click(screen.getByRole("button", { name: "Prices in NOK" }));
    expect(cur()).toBe("NOK");
    expect(localStorage.getItem("insight.currency.v1")).toBe("NOK");
    expect(pressed("Prices in NOK")).toBe("true");
    expect(pressed("Prices in EUR")).toBe("false");
  });

  it("the purge clears the choice — the next account starts at EUR", () => {
    render(<CurSwitch />);
    fireEvent.click(screen.getByRole("button", { name: "Prices in USD" }));
    expect(cur()).toBe("USD");
    localStorage.clear();
    // fireEvent, not dispatchEvent: the listener bumps a mounted hook, and
    // only fireEvent wraps the dispatch in act() so the re-render flushes.
    fireEvent(window, new Event("insight:local-purge"));
    // The mounted control heard the same event through its subscription —
    // the pressed mark is back on the default without a remount.
    expect(cur()).toBe("EUR");
    expect(pressed("Prices in EUR")).toBe("true");
  });

  it("renders nothing when the card offers a single currency", async () => {
    // A one-button switch is furniture pretending to be a choice; the
    // component hides instead. The committed card always carries fx today,
    // so the branch needs a mocked store to be reachable at all.
    vi.resetModules();
    vi.doMock("../data/pricing", () => ({
      currencies: () => ["EUR"],
      cur: () => "EUR",
      setCur: () => {},
      subscribeCur: () => () => {},
    }));
    const { CurSwitch: Solo } = await import("./CurSwitch");
    const { container } = render(<Solo />);
    expect(container.firstChild).toBeNull();
    vi.doUnmock("../data/pricing");
  });
});
