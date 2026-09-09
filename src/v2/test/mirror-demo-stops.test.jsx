// @vitest-environment jsdom
//
// THE DEMO MIRROR'S STOPS PAST WORLD RENDERED IN NO TEST.
//
// `smoke-mirror` clicks Mirror, lands on You, and walks to World for the
// Explore and Compare lenses. Nothing ever selected Groups, and nothing
// tapped the Answers or Scores lens on a place stop. So four modules drew
// only their preamble: group-mirror.jsx 5.6% of statements,
// group-role-map.jsx 4.5%, mirror-answers.jsx 7.1%, place-stats.jsx 6.9%
// — measured off `--coverage.include='src/v2/spec/**'`, which the repo's
// coverage config excludes on purpose, which is also why the hole was
// invisible.
//
// These are DEMO bodies. Live mode replaces the Groups stop with
// ui/LiveGroupsMirrorBody and the place lenses with their Live* panels,
// each with its own suite — which is exactly why nobody noticed the demo
// half had none. It is the half a demo build and the screenshots workflow
// draw.
//
// EVERY CASE NAMES CONTENT BEFORE IT CHECKS THE BOUNDARY. A stop that
// failed to open leaves the previous stop on screen, and a lens tap that
// opened nothing leaves the lens underneath — `expectNoBoundary` passes
// against both. That is the vacuous shape mount-app.jsx's cross-link rule
// exists to close, and it applies to a lens tab for the same reason.
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, within } from "@testing-library/react";
import { mountApp, registerSmokeHooks, SMOKE_TIMEOUT_MS } from "./mount-app.jsx";
import { DUELS } from "../spec/duels-data.js";

vi.setConfig({ testTimeout: SMOKE_TIMEOUT_MS });
registerSmokeHooks();

async function toStop(name) {
  fireEvent.click(screen.getByRole("button", { name: /^mirror$/i }));
  const ruler = screen.getByRole("tablist", { name: /how far the mirror reaches/i });
  fireEvent.click(within(ruler).getByRole("tab", { name }));
  await act(async () => { await new Promise((r) => setTimeout(r, 250)); });
}

async function toLens(name) {
  fireEvent.click(screen.getByRole("tab", { name }));
  await act(async () => { await new Promise((r) => setTimeout(r, 200)); });
}

describe("the demo Mirror's Groups stop", () => {
  it("draws the group, its role field, and the Compare lens under it", async () => {
    const expectNoBoundary = mountApp();
    await toStop("Groups");
    // GroupsMirrorBody's own line, under the group's name: roles cast and
    // scores, the two things a room has since D432.
    expect(document.body.textContent, "the Groups stop never opened").toMatch(/roles cast · \d+ scores?/);
    // The role field is GroupRoleMap's, and this is how you tell the two
    // apart: it mints a `grWash-<gid>` gradient per group, and no other
    // module in the tree does. Asserting on `.mf-canvaswrap` would not —
    // mirror-field.jsx draws one too.
    expect(
      document.querySelectorAll('[id^="grWash-"]').length,
      "the group role field did not render",
    ).toBe(1);
    // …and it placed real members in it, rather than an empty constellation.
    const placed = [...document.querySelectorAll(".mf-canvaswrap text")].map((t) => t.textContent);
    expect(placed, "the role field drew nobody").toContain("Henrik");
    expect(placed, "the role field left you out of your own group").toContain("you");
    // The stop's own lens row (Votes · People · Scores · Compare since
    // D432 — no Explore, per D190). Compare is the widest of the bodies.
    await toLens("Compare");
    expect(document.body.textContent, "the Compare lens opened nothing").toMatch(/six axes/);
    expectNoBoundary("mirror · groups");
  });
});

describe("the demo Mirror's place lenses", () => {
  it("City · Answers reads the bank as the city answered it", async () => {
    const expectNoBoundary = mountApp();
    await toStop("City");
    await toLens("Answers");
    // MirrorAnswers' subtitle, which names the audience it folded over —
    // the one thing that distinguishes this lens from the World copy of it.
    expect(document.body.textContent, "the Answers lens opened nothing").toMatch(/as Oslo answered it/i);
    // …and the rows under it, which are the lens. A subtitle with no
    // question list would be a header that survived an empty fold.
    expect(document.body.textContent, "the Answers lens drew no question rows").toMatch(/Messi or Ronaldo\?/);
    expectNoBoundary("mirror · city · answers");
  });

  it("City · Scores draws the place scorecard, both audiences", async () => {
    const expectNoBoundary = mountApp();
    await toStop("City");
    await toLens("Scores");
    // The scorecard's whole shape is the SPLIT (D187): a place rated by
    // the people who live there against the people who do not. One label
    // without the other would be half a card that still looked fine.
    const body = document.body.textContent;
    expect(body, "the Scores lens is missing the residents' side").toMatch(/live there/);
    expect(body, "the Scores lens is missing the visitors' side").toMatch(/from elsewhere/);
    // An axis, so the assertion is about the rows and not just the legend.
    expect(body, "the scorecard drew no axes").toMatch(/Nature access/);
    expectNoBoundary("mirror · city · scores");
  });
});

// ── a group's history is the group's, not a constant ──
//
// `gHist` in duels-data.js is explicit — "custom groups start now — no
// fake history" — and every fold bounds by it: a room made this morning
// has no revealed rounds, so no roles cast, no votes, no scores. Both
// halves are asserted here: the seeded group keeps its record, so a fix
// that bounded everything to zero fails too.
describe("the demo Mirror's Groups stop · who the room named", () => {
  // Found by walking `.card` rather than by getByText: `Kicker` splits the
  // heading across elements, so a text query on it reports "broken up by
  // multiple elements" and finds nothing.
  const card = () => [...document.querySelectorAll(".card")]
    .find((el) => /Who the room named/i.test(el.textContent || ""));
  /** The role rows are the only aria-expanded buttons in this card. */
  const roleRows = () => [...card().querySelectorAll("button[aria-expanded]")];

  it("draws a seeded group's record and a new group's none", async () => {
    const expectNoBoundary = mountApp();
    await toStop("Groups");
    await toLens("Votes");

    // The positive half FIRST, because a fix that bounded every group to
    // zero would satisfy the negative half on its own.
    expect(document.body.textContent, "the Groups stop never opened").toMatch(/roles cast/);
    expect(card(), "the Votes lens never opened").toBeTruthy();
    expect(roleRows().length, "the seeded group lost its record").toBeGreaterThan(0);
    // …and a row opens onto who voted for whom, the round named
    fireEvent.click(roleRows()[0]);
    expect(card().textContent, "the row did not open onto the vote").toMatch(/· round \d+/);
    expect(card().textContent).toMatch(/by/);

    // …now a group created this morning. `save()` fires the store's
    // listeners, so the picker redraws without a remount.
    const ids = DUELS.members().slice(0, 3).map((p) => p.id);
    expect(ids.length, "the demo circle is empty — the case cannot make a group").toBe(3);
    DUELS.createGroup("Night Crew", ids);
    await act(async () => { await new Promise((r) => setTimeout(r, 120)); });
    fireEvent.click(screen.getByRole("button", { name: /Night Crew/ }));
    await act(async () => { await new Promise((r) => setTimeout(r, 120)); });

    expect(document.body.textContent, "the picker never opened the new group").toMatch(/Night Crew/);
    expect(document.body.textContent, "a group made this morning reported a record").toMatch(/no rounds revealed yet/);
    // MirrorLenses is keyed on the group id, so switching groups remounts
    // it with no lens open — the same reason the place cases tap a lens
    // after every stop.
    await toLens("Votes");
    expect(card(), "the Votes lens never opened for the new group").toBeTruthy();
    expect(roleRows().length, "a group made this morning drew votes nobody cast").toBe(0);
    // …and it says why the card is empty rather than leaving a blank tab.
    expect(card().textContent).toMatch(/No votes revealed yet — the first role is on the table/);
    expectNoBoundary("mirror · groups · votes");
  });
});
