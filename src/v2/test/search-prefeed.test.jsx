// @vitest-environment jsdom
//
// The search overlay BEFORE the world-feed chunk lands.
//
// WHY THIS FILE IS NOT A CASE IN `smoke-overlays.test.jsx`. The shared
// harness awaits both lazy groups in its `beforeAll` (mount-app.jsx —
// `loadWorldFeed()` then `loadOverlays()`), deliberately, so every smoke
// case runs against a fully loaded layer. That makes the state this file
// tests UNREACHABLE from any of the five suites: by the time a smoke case
// clicks anything, `window.WorldFeed` is defined. So the file that pins the
// race has to be the one that does not await the feed — the shape
// `dialog.test.jsx` already has, for the same reason in reverse.
//
// WHAT THE RACE IS. main.jsx starts `loadWorldFeed()` and `loadOverlays()`
// in the same tick and awaits neither before the header goes live. The
// search overlay is in the SMALLER group, and it lists question rows out of
// `window.WORLD_FEED_QS` — which world-feed-data.js publishes EAGERLY, so
// the rows are on screen and tappable while `window.WorldFeed` is still
// undefined. Tapping one used to render `<window.WorldFeed …>`, i.e.
// `React.createElement(undefined)`, which app-shell's ErrorBoundary catches
// — replacing the WHOLE overlay with the snag card rather than failing the
// one row. And it is permanent, not transient, whenever the feed chunk's
// fetch simply fails, which spec-index's own contract sentence ("a failed
// chunk costs the feed, not the app") says must stay survivable.
//
// The order the cases are written in is the order the user lives it: tap
// early, get a row that has not opened yet; the chunk lands, the row opens
// itself, because `openQ` was remembered rather than refused.

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { awaitNode } from "./mount-app.jsx";

let App;
let specIndex;
let errorSpy;

beforeAll(async () => {
  // spec-index for the eager layer only. NOT loadWorldFeed() — that is the
  // whole subject. Not loadOverlays() either: the header button awaits it
  // itself, so letting the click pay for it is the app's real sequencing.
  specIndex = await import("../spec-index.js");
  App = globalThis.App;
});

afterEach(() => {
  cleanup();
  errorSpy?.mockRestore();
});

// app-shell's componentDidCatch log, and the copy it renders in place of the
// crashed subtree — the same pair mount-app.jsx asserts on, and for the
// reason recorded there: the boundary means `render()` returns happily while
// the screen underneath is the snag card, so a test that only watched for a
// thrown error passes on exactly this bug.
const BOUNDARY_LOG = "[InSight] boundary caught:";
const BOUNDARY_COPY = /This view hit a snag/i;

function expectNoBoundary(where) {
  const caught = errorSpy.mock.calls.filter(
    (args) => typeof args[0] === "string" && args[0].includes(BOUNDARY_LOG),
  );
  expect(caught.map((c) => String(c[1])).join(" · "), `${where}: ErrorBoundary caught`).toBe("");
  expect(screen.queryByText(BOUNDARY_COPY), `${where}: boundary fallback rendered`).toBeNull();
}

// Open search from the header and hand back the first question row.
//
// The first `button.search-hit` IS a question row: the overlay renders the
// questions group first, then the daily archive, topics and people. Rather
// than trust that ordering silently, the caller checks the row's text against
// the pool — a friend row picked up by mistake would otherwise make every
// assertion below vacuous.
async function openSearch() {
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  const view = render(<App />);
  fireEvent.click(screen.getByRole("button", { name: /^search$/i }));
  const dialog = await awaitNode('[role="dialog"]');
  return { view, dialog };
}

function firstQuestionRow(dialog) {
  const row = dialog.querySelector("button.search-hit");
  expect(row, "the search overlay listed no rows at all").toBeTruthy();
  const text = row.querySelector(".hit-t")?.textContent || "";
  const prompts = (window.WORLD_FEED_QS || []).map((x) => x.prompt);
  expect(prompts, "no eager question pool — the case is asserting on nothing")
    .not.toHaveLength(0);
  expect(prompts, `first row is not a question row (“${text}”)`).toContain(text);
  return row;
}

describe("search overlay survives the pre-feed window", () => {
  it("does not have the feed yet — the control for both cases below", async () => {
    // If this ever fails, the feed became eager (or the harness started
    // awaiting it) and the two cases below stopped testing the race rather
    // than starting to pass. Better to hear it here than to keep two green
    // tests that mean nothing.
    await openSearch();
    expect(window.WorldFeed, "window.WorldFeed is already defined").toBeUndefined();
  });

  it("keeps the overlay when a question is tapped before the chunk lands", async () => {
    const { dialog } = await openSearch();
    act(() => { fireEvent.click(firstQuestionRow(dialog)); });
    expectNoBoundary("search overlay · question tapped pre-feed");
    // …and specifically the overlay is STILL THERE. The boundary check alone
    // would pass if the row simply stopped rendering; what the bug destroyed
    // was the whole dialog.
    expect(document.querySelector('[role="dialog"]'), "the overlay went away").toBeTruthy();
    expect(dialog.querySelector("button.search-hit"), "the rows went away").toBeTruthy();
    // The row has not expanded — that is the visible cost, and it is the
    // cost this fix chooses.
    expect(dialog.querySelector("[data-openq]"), "expanded without a feed to expand into").toBeNull();
  });

  it("opens the tapped question by itself once the chunk lands", async () => {
    // The tap is REMEMBERED, not refused: `openQ` is set either way, so the
    // re-render main.jsx does when loadWorldFeed() resolves (its own comment:
    // "the re-render is not decoration") finds the row already asked for.
    const { view, dialog } = await openSearch();
    act(() => { fireEvent.click(firstQuestionRow(dialog)); });
    await act(async () => { await specIndex.loadWorldFeed(); });
    expect(window.WorldFeed, "loadWorldFeed() resolved without publishing WorldFeed").toBeTruthy();
    // main.jsx re-renders the SAME element type at the root, so App keeps its
    // state — which is what `rerender` does here.
    await act(async () => { view.rerender(<App />); });
    expect(document.querySelector("[data-openq]"), "the remembered tap never opened").toBeTruthy();
    expectNoBoundary("search overlay · question opened post-feed");
  });
});
