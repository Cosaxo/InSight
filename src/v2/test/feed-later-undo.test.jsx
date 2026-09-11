// @vitest-environment jsdom
//
// "LATER" DELETED THE CARD UNDER THE THUMB, AND ITS UNDO ROW COULD NEVER
// RENDER.
//
// `render()` filters the woven streams with
// `!isDeferred(this.state.deferred, q.id, heldNow)` — read LIVE. So
// `setDefer(id, true)`, which writes `now + 20h`, made the predicate true
// on the very next render and the card left the stream immediately.
// Freezing `heldNow` did nothing: the timestamp was never what moved.
//
// Two comments in that file described the behaviour that did not happen —
// "the tap that says 'later' does not vanish the row under the thumb", and
// `renderCard`'s "Both stay tappable in THIS sitting so an accidental skip
// costs one tap to undo". The `held === 'defer'` branch those describe,
// the slim "later · undo" row, was unreachable: nothing deferred was ever
// still in the list to reach it.
//
// The button sits centred directly under the ballot on every test and lens
// card, so one mis-tap removed the question for twenty hours, the list
// jumped, and there was no way back.
//
// WHY THE SKIP CASE IS HERE TOO. `skip` and `later` are the same control
// on two card families and share the slim row; skip never had the bug,
// because `passed` is not filtered out of the stream. It is the contrast
// that proves this file is asserting about the mechanism rather than about
// a row that happens to be missing.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { installLive } from "./live-fixture";
import { growUntil } from "./mount-app";

vi.setConfig({ testTimeout: 15000 });

const WF_LS = "insight.feedVotes.v1";
const DEFER_LS = "insight.feedDefer.v1";

let WorldFeed;
let live;

beforeAll(async () => {
  const specIndex = await import("../spec-index.js");
  await specIndex.loadWorldFeed();
  WorldFeed = window.WorldFeed;
});

afterEach(() => {
  cleanup();
  live?.restore();
  live = undefined;
  localStorage.removeItem(WF_LS);
  localStorage.removeItem(DEFER_LS);
});

const mount = async (label) => {
  live = installLive({ feedCards: 24, testCard: true, learnCard: true });
  // `cats`/`onToggle`/`beats` are the shell's props; the feed reads `cats`
  // at render, so mounting bare throws before it draws anything.
  render(<WorldFeed cats={{}} onToggle={() => {}} beats={false} />);
  // queryAll, not query: the feed weaves several cards offering the same
  // control, and the single-element query throws on more than one.
  await growUntil(() => screen.queryAllByRole("button", { name: label }).length > 0,
    `a card offering "${label}"`);
};

describe("a card you said later to", () => {
  it("stays in this sitting as its own undo row", async () => {
    await mount("later");
    const prompt = screen.getAllByRole("button", { name: "later" })[0]
      .closest("[data-qid]")?.getAttribute("data-qid") || null;
    fireEvent.click(screen.getAllByRole("button", { name: "later" })[0]);
    // The row it becomes says so in its own words, and it is a button:
    // one tap undoes the mis-tap, which is the whole promise.
    const undo = await screen.findByRole("button", { name: /later · undo/i });
    expect(undo, "the deferred card vanished instead of becoming its undo row").toBeTruthy();
    if (prompt) {
      expect(undo.closest("[data-qid]")?.getAttribute("data-qid"),
        "the undo row belongs to a different card").toBe(prompt);
    }
  });

  it("…and undoing it puts the card back", async () => {
    await mount("later");
    fireEvent.click(screen.getAllByRole("button", { name: "later" })[0]);
    fireEvent.click(await screen.findByRole("button", { name: /later · undo/i }));
    expect(screen.queryByRole("button", { name: /later · undo/i }),
      "undo left the slim row on screen").toBeNull();
    expect(screen.getAllByRole("button", { name: "later" }).length,
      "the card did not come back").toBeGreaterThan(0);
  });

  it("skip already behaved this way — the contrast", async () => {
    // `passed` was never filtered out of the stream, so this half always
    // worked. If this case ever fails, the fix above has broken the
    // control rather than the subject.
    await mount("skip");
    fireEvent.click(screen.getAllByRole("button", { name: "skip" })[0]);
    // Not anchored: the slim row's accessible name is the prompt plus the
    // word, so the assertion is about the word being there at all.
    expect(await screen.findByRole("button", { name: /\bundo\b/i })).toBeTruthy();
  });
});
