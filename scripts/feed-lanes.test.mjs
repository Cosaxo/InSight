// The feed surface's ID LANES, held to the generator that mints them.
//
// WHY THIS EXISTS. `gen-v2content.mjs` emits a feed question as
// `feed-<id>` and a catalogue pick as `pick-<id>`, and picks share the
// FEED SURFACE deliberately (D232 — they run their own seq lane from
// PICK_SEQ_BASE so a feed append cannot renumber the whole pick bank).
// So "is this id on the feed?" is a two-prefix question, and the obvious
// one-prefix version of it is wrong for 24 shipped questions.
//
// It was wrong in the tree: live.ts's feed history heal filtered the
// answered set on `startsWith("feed-")`, so a catalogue pick you had
// answered was never fetched back once it rotated off your cached pages.
// Nothing could see it — the prefix is a string literal, the picks are
// real questions on the real surface, and every suite passed.
//
// The list lives in deck.ts (FEED_ID_LANES) because the fact is about the
// content rather than about any one caller. This test is the half that
// makes it stay true: it asks the GENERATOR for every entry it emits,
// takes the ones whose surface is "feed", and requires each id to match a
// declared lane. A third lane added to the generator fails here on the
// commit that adds it, rather than silently shipping a third excluded set.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildEntries } from "./gen-v2content.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Read out of the source rather than imported, because this file is .mjs
// and deck.ts is TypeScript — the same shape check-anchors.mjs uses to
// read BREAKDOWN_DIMS out of pure.ts. A parse that finds nothing is an
// error, not an empty pass.
const deckSrc = readFileSync(resolve(root, "src/v2/data/deck.ts"), "utf8");
const block = deckSrc.slice(
  deckSrc.indexOf("FEED_ID_LANES = ["),
  deckSrc.indexOf("]", deckSrc.indexOf("FEED_ID_LANES = [")),
);
const lanes = [...block.matchAll(/"([a-z-]+)"/g)].map((m) => m[1]);
// The daily's lanes, read the same way (D371 — the daily pages now, so it
// has the same "which ids are mine?" question the feed does).
const dailyBlock = deckSrc.slice(
  deckSrc.indexOf("DAILY_ID_LANES = ["),
  deckSrc.indexOf("]", deckSrc.indexOf("DAILY_ID_LANES = [")),
);
const dailyLanes = [...dailyBlock.matchAll(/"([a-z-]+)"/g)].map((m) => m[1]);
if (!dailyLanes.length) throw new Error("DAILY_ID_LANES did not parse out of deck.ts");

describe("the feed surface's id lanes", () => {
  it("deck.ts's FEED_ID_LANES parses to a non-empty list", () => {
    expect(lanes.length, "FEED_ID_LANES could not be read out of deck.ts — the "
      + "constant was renamed or reshaped, and this whole file is now vacuous").toBeGreaterThan(0);
  });

  it("every question the generator emits on the feed surface matches a declared lane", () => {
    const entries = buildEntries();
    const feed = entries.filter((e) => e.surface === "feed");
    expect(feed.length, "no feed-surface entries at all — the generator changed shape").toBeGreaterThan(0);
    const orphans = feed
      .map((e) => e.id)
      .filter((id) => !lanes.some((p) => id.startsWith(p)));
    expect(
      orphans,
      `these feed-surface ids match no lane in deck.ts's FEED_ID_LANES `
      + `(${lanes.join(", ")}). Anything filtering the feed by id prefix — `
      + `live.ts's history heal is the one that exists — silently drops them.`,
    ).toEqual([]);
    // Both known lanes are actually populated, so this case cannot pass by
    // one of them having quietly emptied.
    for (const lane of lanes) {
      expect(
        feed.some((e) => e.id.startsWith(lane)),
        `lane "${lane}" is declared in deck.ts but no feed entry uses it — `
        + `either the lane is dead and should go, or the generator stopped `
        + `emitting it and something else is broken`,
      ).toBe(true);
    }
  });

  it("every DAILY-surface id matches a declared daily lane (D371)", () => {
    // The daily pages since D371, so live.ts asks "which of my answers
    // are dailies?" on every boot to heal the ones outside the deck
    // window. A daily id the filter does not recognise is an answer that
    // resolves to no question — the same silent class as the feed's pick
    // lane, one surface over, and worth catching the same way.
    const entries = buildEntries();
    const daily = entries.filter((e) => e.surface === "daily");
    expect(daily.length).toBeGreaterThan(0);
    const orphans = daily
      .filter((e) => !dailyLanes.some((p) => e.id.startsWith(p)))
      .map((e) => e.id);
    expect(
      orphans,
      `these daily-surface ids match no lane in deck.ts's DAILY_ID_LANES `
      + `(${dailyLanes.join(", ")}).`,
    ).toEqual([]);
    const bleed = entries
      .filter((e) => e.surface !== "daily")
      .filter((e) => dailyLanes.some((p) => e.id.startsWith(p)))
      .map((e) => `${e.id} (${e.surface})`);
    expect(bleed, "a non-daily question's id matches a daily lane — the "
      + "heal would pull it into the daily bank").toEqual([]);
  });

  it("a non-feed surface's ids do NOT match a feed lane", () => {
    // The filter has to be wrong in both directions to be wrong: if a
    // daily id passed, the heal would fetch daily questions into the feed
    // bank. Uses the generator's own output rather than an invented id.
    const entries = buildEntries();
    const others = entries.filter((e) => e.surface !== "feed");
    const bleed = others
      .filter((e) => lanes.some((p) => e.id.startsWith(p)))
      .map((e) => `${e.id} (${e.surface})`);
    expect(bleed, "a non-feed question's id matches a feed lane — the heal "
      + "would pull it into the feed bank").toEqual([]);
  });
});
