// @vitest-environment jsdom
//
// Mount suite 1 of 5 — the daily tab and the feed under it. The shared harness,
// and the reasoning for all five files, is in ./mount-app.jsx.
//
// What this file owns: that `App` exists at all, that the daily tab paints, and
// that the feed's two renderable shapes both hold — the frame before its
// deferred chunk lands and the frame after.

import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { getApp, mountApp, registerSmokeHooks, SMOKE_TIMEOUT_MS } from "./mount-app.jsx";

vi.setConfig({ testTimeout: SMOKE_TIMEOUT_MS });
registerSmokeHooks();

describe("the daily tab", () => {
  it("exposes App on globalThis once spec-index has loaded", () => {
    // If this fails, spec-index.js lost an entry or app-shell stopped
    // registering — everything below would fail confusingly instead.
    expect(typeof getApp()).toBe("function");
  });

  it("renders the daily tab (the default) without tripping the boundary", () => {
    const expectNoBoundary = mountApp();
    expectNoBoundary("daily");
  });

  // The world feed loads after first paint (loadWorldFeed, spec-index.js),
  // which gives the daily tab a SECOND renderable shape nothing used to
  // exercise: the frame before the chunk lands. daily-split guards on
  // `window.WorldFeed` and renders no feed node without it — these two cases
  // pin both halves of that, because each is invisible to the other.
  it("renders the daily tab before the world feed chunk has landed", () => {
    const WorldFeed = window.WorldFeed;
    const ConsequenceBeat = window.ConsequenceBeat;
    delete window.WorldFeed;
    delete window.ConsequenceBeat;
    try {
      const expectNoBoundary = mountApp();
      expect(
        screen.queryByRole("button", { name: /add a topic/i }),
        "the feed rendered without its module — the guard is not the one being tested",
      ).toBeNull();
      expectNoBoundary("daily, feed not yet loaded");
    } finally {
      window.WorldFeed = WorldFeed;
      window.ConsequenceBeat = ConsequenceBeat;
    }
  });

  it("renders the world feed once its chunk has landed", () => {
    // The other half, and the one that stops the deferral quietly becoming a
    // deletion: if loadWorldFeed stopped resolving, or dropped a module, the
    // case above would still pass and the feed would simply never appear.
    mountApp();
    expect(
      screen.queryByRole("button", { name: /add a topic/i }),
      "the feed did not render after loadWorldFeed resolved",
    ).not.toBeNull();
  });

  it("the demo feed offers a suggested scene", () => {
    const expectNoBoundary = mountApp();
    expect(screen.getByText(/suggested scene/)).not.toBeNull();
    expectNoBoundary("demo suggestion card");
  });

  it("parks a previously answered feed card behind the Answered expander", () => {
    // Release feedback, twice: "I keep seeing things I have answered", then
    // "answered questions shouldn't appear in the feed at all". A card answered
    // in an earlier session leaves the stream and waits behind the expander —
    // the same real card, results and all — so the feed always opens on fresh
    // questions without losing the record.
    try {
      localStorage.setItem("insight.feedVotes.v1", JSON.stringify({ f01: 0 }));
      const expectNoBoundary = mountApp();
      expect(
        screen.queryByText("The better night in front of the TV?"),
        "an answered card still rendered in the stream",
      ).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: /answered · 1/i }));
      expect(
        screen.getByText("The better night in front of the TV?"),
        "the expander did not surface the answered card",
      ).not.toBeNull();
      expectNoBoundary("answered expander");
    } finally {
      localStorage.removeItem("insight.feedVotes.v1");
    }
  });
});
