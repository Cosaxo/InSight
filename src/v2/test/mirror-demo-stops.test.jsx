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
    // GroupsMirrorBody's own line, under the group's name.
    expect(document.body.textContent, "the Groups stop never opened").toMatch(/aligned with you/);
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
    // The stop's own lens row (Answers · People · Compare — no Scores and
    // no Explore, per D190). Compare is the widest of the three bodies.
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
