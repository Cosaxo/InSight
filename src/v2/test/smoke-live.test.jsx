// @vitest-environment jsdom
//
// The demo smoke test's other half: the same screens, mounted with
// `window.LIVE` present and enabled.
//
// WHY A SECOND FILE. `smoke.test.jsx` runs with LIVE undefined, so every
// `if (window.LIVE && window.LIVE.enabled)` branch in the spec layer is
// unreached by the suite. Two of those branches are load-bearing product
// decisions rather than cosmetics:
//
//   D9  live mode drops the Mirror's City stop, because Near IS your city
//       there and two stops resolving to one cohort is how a scale starts
//       lying about what it measures.
//   D11 the feed's argument surfaces — named takes, counter-arguments,
//       "minds moved", crossfire, friend dots — are unreachable from a live
//       card, and a card below the k-floor shows neither the share numeral
//       NOR the fill, because a fill height IS the share in a different
//       alphabet.
//
// D11 records that this was "verified rather than assumed" by forcing a demo
// question live in a browser and looking. That was true once, by hand. The
// cases below make it true on every run.
//
// Same assertion style as the demo file, and for the same reason: app-shell
// wraps every tab and overlay in ErrorBoundary, so a crashed screen still
// returns cleanly from render(). Assert on the boundary, never on a throw.

import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

// 15s per test, not the 5s default: every case here mounts the FULL app in
// jsdom, and the v15 revision roughly doubled the spec layer's feed weight —
// the slowest cases sat at ~4.8s before it and tip over under suite load.
vi.setConfig({ testTimeout: 15000 });
import { FEED_OPTIONS, fixtureSurfaceMismatch, installLive } from "./live-fixture";
import { list as anchorList } from "../spec/map-anchors.js";
import { IS_TEST_RESULTS } from "../spec/test-definitions.js";
import { FRIENDS } from "../spec/follows.js";
import { IS_DATA } from "../spec/sample-data.js";

const BOUNDARY_LOG = "[InSight] boundary caught:";
const BOUNDARY_COPY = /This view hit a snag/i;

let App;
let errorSpy;
let live;

beforeAll(async () => {
  const specIndex = await import("../spec-index.js");
  // The feed is lazy since loadWorldFeed() (spec-index.js) and every D11
  // case below asserts on a feed CARD, so without this they would assert on
  // a tab that never rendered one — the vacuous pass this file's own
  // comments were written about.
  await specIndex.loadWorldFeed();
  App = globalThis.App;
});

afterEach(() => {
  cleanup();
  errorSpy?.mockRestore();
  live?.restore();
  live = undefined;
});

function mountLive(opts) {
  live = installLive(opts);
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  render(<App />);
  return function expectNoBoundary(where) {
    const caught = errorSpy.mock.calls.filter(
      (args) => typeof args[0] === "string" && args[0].includes(BOUNDARY_LOG),
    );
    expect(caught.map((c) => String(c[1])).join(" · "), `${where}: ErrorBoundary caught`).toBe("");
    expect(screen.queryByText(BOUNDARY_COPY), `${where}: boundary fallback rendered`).toBeNull();
  };
}

describe("the fixture tracks the real store", () => {
  it("has exactly the members data/live.ts publishes", () => {
    // If this fails, live.ts gained or lost a member and the fixture did
    // not follow — which would leave the cases below asserting against
    // `undefined` while still passing. data/vote.test.ts pins the same list
    // against the REAL object; this pins it against the stand-in.
    live = installLive();
    const { live: liveDiff, social } = fixtureSurfaceMismatch(live);
    expect({ liveDiff, social }).toEqual({ liveDiff: [], social: [] });
  });
});

describe("spec layer mounts in live mode", () => {
  it("renders the daily tab without tripping the boundary", () => {
    const expectNoBoundary = mountLive();
    expectNoBoundary("daily/live");
  });

  it("renders the mirror tab without tripping the boundary", () => {
    const expectNoBoundary = mountLive();
    fireEvent.click(screen.getByRole("button", { name: /^mirror$/i }));
    expectNoBoundary("mirror/live");
    expect(screen.getByRole("button", { name: /^mirror$/i }).className).toContain("is-active");
  });

  it("opens the profile overlay without tripping the boundary", () => {
    const expectNoBoundary = mountLive();
    fireEvent.click(screen.getByRole("button", { name: /^profile$/i }));
    expectNoBoundary("profile/live");
  });

  it("shows the real follow list in the live profile, none of the demo field", () => {
    // The General tab used to embed MirrorFieldBody pop="groups" — the
    // scenes orbit with invented populations ("5.6k people" / "22k
    // people"), the closer-means-more-like-you distances, "Who's in your
    // circles · 138 members" and "What they answered", all sample data. A
    // release device showed the lot to a real user. Live mode now renders
    // LiveScenesCard instead: the follow store's own list, no populations,
    // no likeness claims. The demo smoke suite asserts the demo field
    // still renders with LIVE off, so the pair pins the swap both ways.
    mountLive();
    fireEvent.click(screen.getByRole("button", { name: /^profile$/i }));
    expect(screen.getByText(/Scenes you follow/i)).toBeTruthy();
    expect(screen.queryByText(/closer = members more like you/i)).toBeNull();
    expect(screen.queryByText(/in your circles/i)).toBeNull();
    expect(screen.queryByText(/22k people/i)).toBeNull();
  });

  it("opens the search overlay without tripping the boundary", () => {
    const expectNoBoundary = mountLive();
    fireEvent.click(screen.getByRole("button", { name: /^search$/i }));
    expectNoBoundary("search/live");
  });

  it("shows no sample people in the search overlay", () => {
    // The overlay's Friends rows are sample-data personas wearing invented
    // relationships ("sister · since birth · 86% match"). Live mode has no
    // person graph at all (D3), so a live build listing them is a D1
    // fabrication — and it shipped: the release build offered five seeded
    // strangers as the user's oldest friends. The demo smoke case asserts
    // the same rows DO render with LIVE off, so this pair pins the gate in
    // both directions.
    mountLive();
    fireEvent.click(screen.getByRole("button", { name: /^search$/i }));
    const seed = FRIENDS.list()
      .map((id) => (IS_DATA.people || []).find((p) => p.id === id))
      .find((p) => p && p.name && !p.anon);
    expect(seed, "sample data has no named seed friend — the control is asserting on nothing").toBeTruthy();
    expect(screen.queryByText(seed.name)).toBeNull();
    expect(screen.queryByText(/% match/)).toBeNull();
  });

  it("renders a below-the-floor deck without tripping the boundary", () => {
    // The k-floored path is a different render: aggFor returns
    // `{ tooSmall: true }` with no counts at all, so anything reading
    // `agg.counts[i]` without a guard throws here and nowhere else.
    const expectNoBoundary = mountLive({ tooSmall: true });
    expectNoBoundary("daily/live/tooSmall");
    fireEvent.click(screen.getByRole("button", { name: /^mirror$/i }));
    expectNoBoundary("mirror/live/tooSmall");
  });

  it("renders the demoInProd fallback without tripping the boundary", () => {
    // A live build that could not attach and fell back to mock data. Its own
    // branch again — and the one where D11 suppresses the most.
    const expectNoBoundary = mountLive({ demoInProd: true });
    expectNoBoundary("daily/demoInProd");
  });

  it("hides the boot reason until the pill is tapped, then shows it", async () => {
    // The label alone said a real user was on demo content and not why, and
    // an iPhone has no console to ask — so the first device this app ever
    // ran on failed here and the reason needed a Mac to reach, which is the
    // one dependency ios-release.yml exists to remove.
    //
    // Both halves are asserted because both are deliberate: the reason is
    // NOT on screen by default (a stranger on a train should read
    // "reconnecting…", not a Firebase error code), and it IS one tap away.
    const expectNoBoundary = mountLive({ demoInProd: true });
    const pill = screen.getByRole("button", { name: /sample questions/i });
    expect(screen.queryByText(/auth\/network-request-failed/)).toBeNull();
    fireEvent.click(pill);
    expect(await screen.findByText(/auth\/network-request-failed/)).toBeTruthy();
    expectNoBoundary("daily/demoInProd/reason");
  });

  it("never shows the boot reason on a healthy live boot", () => {
    // bootError is "" once attached, and nothing should render an empty
    // reason box. Guards the direction the fixture makes easy to get wrong.
    const expectNoBoundary = mountLive();
    expect(screen.queryByRole("button", { name: /sample questions/i })).toBeNull();
    expectNoBoundary("daily/live/no-reason");
  });

  it("renders a profile that has not picked a city", () => {
    // D9: a pre-D9 profile holds free text that does not parse, so myCity is
    // "" and Near must ask the user to re-pick rather than guessing or
    // blanking. Exercised because "" is the branch, not the happy path.
    const expectNoBoundary = mountLive({ myCity: "" });
    fireEvent.click(screen.getByRole("button", { name: /^mirror$/i }));
    expectNoBoundary("mirror/live/no-city");
  });
});

describe("the live gates hold in the DOM, not just in the source", () => {
  // D9. The Mirror's axis is seven stops in demo mode and six in live mode,
  // because Near IS your city there. Both directions are asserted: a test
  // that only checked the live side would pass against an axis that had lost
  // the stop everywhere.
  // The stops are role="tab" on one tablist, not loose buttons — query them
  // as the axis they are, so a same-named control elsewhere on the screen
  // cannot satisfy or break this.
  const stopLabels = () =>
    screen.getAllByRole("tab").map((el) => el.getAttribute("aria-label"));

  it("drops the Mirror's City stop in live mode and keeps it in demo", () => {
    mountLive();
    fireEvent.click(screen.getByRole("button", { name: /^mirror$/i }));
    const liveAxis = stopLabels();
    expect(liveAxis, "live mode still offers a City stop").not.toContain("City");
    // Near and Country are the stops City resolves between. Asserting they
    // survive is what stops the line above passing because the axis broke —
    // the first draft of this test looked for buttons and "found" no City by
    // finding nothing at all.
    expect(liveAxis).toContain("Near");
    expect(liveAxis).toContain("Country");

    cleanup();
    live.restore();
    live = undefined;
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /^mirror$/i }));
    expect(
      stopLabels(),
      "demo mode lost the City stop — the live gate is now unconditional",
    ).toContain("City");
  });

  // D11 + D83. The engage block below renderEngage's `if (q.live)` early
  // return is the DEMO's — seeded named takes, counter-arguments,
  // minds-moved, friend dots — and none of it may reach a live card. What
  // a live card gets instead is the k-floored who-voted button and, since
  // D83, the ANONYMOUS world-takes toggle (LiveTakesPanel, gid "world").
  // The two takes controls are distinguishable by accessible name: the
  // demo sheet button is `${n} takes` (a count), the live toggle is the
  // bare word "Takes".
  //
  // Two things this test needs that the first draft of it did not have, both
  // found by watching it pass against a deliberately broken gate:
  //
  //   1. renderEngage only renders once the card is ANSWERED, and then only
  //      after the reveal animation clears `state.beat`. Asserting on an
  //      unvoted card asserts on a block that was never going to be there.
  //   2. The demo assertion has to be the takes BUTTON, not the word
  //      "takes". Its aria-label is `${n} takes`, and with
  //      WORLD_FEED_COMMENTS empty n is 0 — so the gate leaking shows up as
  //      a "0 takes" control, which no text search for a seeded string
  //      would ever find.
  // The card's way into the who-voted sheet, whichever one it is offering.
  //
  // A live card with a cohort breakdown renders the SURPRISE LINE ("25-34
  // leans Yes · 62%") and deliberately drops the bar-chart button with it
  // — world-feed.jsx gates the button on `!ins`, because the line is
  // already a door to the same sheet and two doors to one room is a bug.
  // Both are buttons and both call openSheet(q, T, "stats").
  //
  // This helper exists because the fixture's aggregate used to carry
  // `by: {}`, so the insight line could never render and every case here
  // silently tested the button-only branch — the branch a real user with
  // real data sees LEAST often. Giving the fixture a real breakdown (for
  // the Mirror, D100) flipped these cases onto the line, which is the
  // path worth asserting; accepting either is what keeps both covered.
  const openWhoVoted = () =>
    screen.queryByRole("button", { name: /who voted/i })
    ?? screen.queryByRole("button", { name: /leans|flips|disagree/i });

  const voteFeedCardAndSettle = async () => {
    fireEvent.click(screen.getByRole("button", { name: FEED_OPTIONS[0] }));
    // The reveal animation clears `beat` from its own onDone; until it does,
    // the engage row is not mounted for either branch.
    await act(async () => { await new Promise((r) => setTimeout(r, 1200)); });
  };

  it("gives a live card who-voted and the named takes toggle — never the demo sheet", async () => {
    mountLive();
    await voteFeedCardAndSettle();
    expect(
      openWhoVoted(),
      "the live engage row did not render at all — this test is now vacuous",
    ).not.toBeNull();
    // The demo's seeded-takes sheet stays off live cards (D11)…
    expect(
      screen.queryByRole("button", { name: /\d+ takes$/i }),
      "a live card rendered the demo takes sheet — D11's gate is open",
    ).toBeNull();
    // …while the D83 world surface is present, collapsed, and — since
    // D98 — opens into a panel that signs what people say rather than
    // one that hides it.
    const toggle = screen.queryByRole("button", { name: /^Takes$/ });
    expect(toggle, "the live card lost its world-takes toggle (D83)").not.toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByText(/posted under your name/i)).toBeTruthy();
    expect(screen.getByText(/No takes yet/i)).toBeTruthy();
  });

  // D99's lens row, mounted on the Mirror's geographic stops. The row has
  // its own suite; this is the wiring — that it reaches the real shell,
  // through the spec layer's own render path, on the live body that
  // replaced the demo field.
  it("brings the lens row back to a live Mirror stop", async () => {
    localStorage.clear();
    mountLive();
    fireEvent.click(screen.getByRole("button", { name: /^mirror$/i }));
    // The Mirror opens on You (the Map), which is not a population — the
    // lens row belongs to the geographic stops, so walk the ruler to Near.
    fireEvent.click(screen.getByRole("tab", { name: "Near" }));
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    // All four lenses. Scores joined the row at D100 — it was absent
    // while this test read "the bank ships no `rate` questions", which
    // was true of the prototype's place scorecard and not of the lens:
    // the bank's `rating` and `scale` items are ordinal and average fine.
    //
    // findBy, not getBy: the row is a React.lazy chunk since D101, so it
    // arrives a tick after the panel it hangs under. Awaiting the FIRST
    // button is what makes the three getBy calls below safe.
    expect(await screen.findByRole("button", { name: "People" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Compare" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Scores" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Explore" })).toBeTruthy();
    // Foresight (D102) — v19's own feature, and the last of the row.
    expect(screen.getByRole("button", { name: "Foresight" })).toBeTruthy();
    // Collapsed until asked for — the cost gate, on the real mount.
    expect(screen.queryByText(/most like you/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "People" }));
    expect(screen.getByText(/most like you/i)).toBeTruthy();
  });

  // The Answers lens's own depth (D100), on the real mount. The panel
  // suite covers the orderings; what this covers is that the controls
  // reach the screen at all — they are gated on `rows.length > 1` and on
  // more than one branch being present, and both of those are computed
  // from a source (LIVE.aggregated) that did not exist before D100.
  it("gives the Mirror's answer rows a subject filter, a sort and an expander", async () => {
    localStorage.clear();
    mountLive();
    fireEvent.click(screen.getByRole("button", { name: /^mirror$/i }));
    fireEvent.click(screen.getByRole("tab", { name: "Near" }));
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });

    // The fixture's two questions sit in different branches, so the chip
    // row offers both plus All.
    expect(screen.getByRole("button", { name: /^All 2$/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Mind 1$/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Most divisive" })).toBeTruthy();

    // Expanding a row names the viewer's own answer rather than only
    // tinting it — the assertion that would fail if the row rendered but
    // the expander did nothing.
    const row = screen.getByRole("button", { name: /Would you rather know/ });
    expect(row.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(row);
    expect(row.getAttribute("aria-expanded")).toBe("true");

    // Filtering to one subject drops the other question's row.
    fireEvent.click(screen.getByRole("button", { name: /^Morals 1$/ }));
    expect(screen.queryByRole("button", { name: /Would you rather know/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Is a promise still binding/ })).toBeTruthy();
  });

  // Foresight (D102), on the real mount. The lens suite covers the clock
  // and the scoring; what this covers is that the game is REACHABLE —
  // it hangs off a React.lazy chunk inside another React.lazy chunk
  // (LiveMirrorLenses inside LiveCohortBody), which is exactly the kind
  // of nesting that renders nothing and throws nowhere.
  it("reaches the Foresight game through two lazy boundaries", async () => {
    localStorage.clear();
    mountLive();
    fireEvent.click(screen.getByRole("button", { name: /^mirror$/i }));
    fireEvent.click(screen.getByRole("tab", { name: "Near" }));
    fireEvent.click(await screen.findByRole("button", { name: "Foresight" }));
    // The fixture's breakdown carries several readable slices, so the
    // game deals a card rather than its not-enough-answers arm. Which
    // slice comes first is the engine's ranking and belongs to its own
    // suite — what matters here is that a real card is on screen.
    expect(await screen.findByText(/Ten seconds a card/i)).toBeTruthy();
    // The slice line: "<Dim> · <bucket> · N answers". getAllBy because
    // the answer rows above the lens carry their own counts.
    expect(screen.getAllByText(/·.+·.+answers$/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/fair read/i)).toBeNull();
    // And answering it scores, through the real store.
    fireEvent.click(screen.getAllByRole("button", { name: "Yes" })[0]);
    expect(screen.getByText(/Read it\.|Missed\./)).toBeTruthy();
  });

  // The Circle stop (D101). This one is worth a mount test more than most
  // of the row: the stop rendered an "isn't built yet" note for the whole
  // life of live mode, so "Circle shows something" and "Circle shows the
  // OLD something" look identical to any test that only checks it did not
  // crash. Both halves are asserted — the people, and the fold over them.
  it("draws the Circle stop from the follow graph, not the not-built note", async () => {
    localStorage.clear();
    mountLive();
    fireEvent.click(screen.getByRole("button", { name: /^mirror$/i }));
    fireEvent.click(screen.getByRole("tab", { name: "Circle" }));
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });

    // The retired empty state, gone.
    expect(screen.queryByText(/aren.t built yet/i)).toBeNull();
    // The member, named, with the mutual mark and the likeness metric.
    expect(screen.getByText(/Ada/)).toBeTruthy();
    // The row's own mark, not the header's "1 of them follows you back".
    expect(screen.getByText(/^· follows you$/)).toBeTruthy();
    expect(screen.getByText("50%")).toBeTruthy();
    // And the fold: where the circle splits, counted over answerers.
    expect(screen.getByText(/Where your circle splits/i)).toBeTruthy();
  });

  // D98's payoff, in the only test that executes a render of it inside the
  // real app rather than in isolation. The panel test next to the
  // component covers its states; what this covers is that it is WIRED —
  // mounted from the who-voted sheet of a live card, on the real shell,
  // through the spec layer's own render path.
  //
  // The previous version of this file could not have caught the panel
  // being absent: nothing outside the sheet mentions it.
  it("names the people who answered, in the who-voted sheet of a live card", async () => {
    // The feed persists its votes to localStorage, and installLive() does
    // not clear it — so the case above has already answered this card by
    // the time this one runs, and voteFeedCardAndSettle finds no option
    // button. Passes alone, fails in the file; cleared here rather than in
    // a shared beforeEach so the neighbouring cases keep the state they
    // were written against.
    localStorage.clear();
    mountLive();
    await voteFeedCardAndSettle();
    const whoVoted = openWhoVoted();
    expect(whoVoted, "the live engage row did not render — this test is vacuous").not.toBeNull();
    fireEvent.click(whoVoted);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    // The fixture serves one named voter and one unnamed, on opposite
    // options — both label paths, in one assertion each.
    expect(screen.getByText(/who answered/i)).toBeTruthy();
    expect(screen.getByText("You")).toBeTruthy();
    expect(screen.getByText("Someone")).toBeTruthy();
    // And the cohort chip comes off the answer's frozen snapshot (D8).
    expect(screen.getByText(/25-34 · Oslo, NO/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/could not load who answered/i);
  });

  // The control for the case above. Without it, that assertion passes for
  // any reason the engage row fails to render — a broken fixture included —
  // and stops being a statement about the gate at all.
  const voteFirstDemoCard = async () => {
    const opt = screen.queryAllByRole("button", { name: /^(Yes|No|Agree|Disagree)$/i })[0];
    expect(opt, "no demo feed card to vote on").toBeDefined();
    fireEvent.click(opt);
    await act(async () => { await new Promise((r) => setTimeout(r, 1200)); });
  };

  it("still renders the takes button on a demo card", async () => {
    render(<App />);
    await voteFirstDemoCard();
    expect(
      screen.queryByRole("button", { name: /\d+ takes$/i }),
      "demo mode lost the takes button — the live gate is now unconditional",
    ).not.toBeNull();
  });

  // The third branch, and the one most easily left untested: a real user in
  // a live build whose boot did not attach. The feed falls back to demo
  // cards, so `q.live` is false on all of them and the ONLY thing keeping
  // seeded takes and fake named people off a real user's screen is
  // renderEngage's demoInProd check. The whole row goes, who-voted included.
  it("suppresses the entire engage row in the demoInProd fallback", async () => {
    mountLive({ demoInProd: true });
    await voteFirstDemoCard();
    expect(
      screen.queryByRole("button", { name: /\btakes$/i }),
      "demoInProd showed seeded takes to a real user",
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /who voted/i }),
      "demoInProd showed a who-voted panel built from mock data",
    ).toBeNull();
  });

  it("renders no seeded take data in live mode at all", () => {
    // D11's second layer, underneath the render gate: live.ts sets
    // WORLD_FEED_COMMENTS to {}, so even a removed gate would have nothing
    // to draw. Asserting the layer exists, not just that the gate does.
    mountLive();
    expect(window.WORLD_FEED_COMMENTS).toEqual({});
  });

  // D96. The add sheet used to list the demo's communities — "Swimming ·
  // 3.2K people · fjord swims, no excuses", members and match invented —
  // and the demo subtopic leaves as "Tennis · Sport · 0 questions", both
  // with Follow buttons, on a real device. The stores now refuse to
  // ADVERTISE either (SCENES.offers / SUBTOPICS.offers); what remains in
  // the sheet is real: the Learn dial and fields, and the suggest door.
  // smoke.test.jsx holds the demo control — the same sheet with both
  // sections present.
  it("the add sheet offers no demo communities and no unstocked leaves — Learn stays", () => {
    const expectNoBoundary = mountLive();
    fireEvent.click(screen.getByRole("button", { name: /add a topic/i }));
    expect(
      screen.queryByText("Communities"),
      "the live sheet advertised the sample communities",
    ).toBeNull();
    expect(screen.queryByText(/fjord swims/), "a sample community row leaked").toBeNull();
    expect(
      screen.queryByText("Topics"),
      "the live sheet advertised leaves the live bank does not stock",
    ).toBeNull();
    expect(screen.queryByText(/0 questions/), "an empty room was offered").toBeNull();
    expect(screen.getByText("Learn")).not.toBeNull();
    expect(screen.getByRole("button", { name: "lots" })).not.toBeNull();
    expect(screen.getByRole("button", { name: /suggest a question/i })).not.toBeNull();
    expectNoBoundary("live add sheet");
  });

  it("renders no suggested-scene card in the live feed", () => {
    // The feed-side twin of the same offer — a dashed card proposing a
    // fabricated community one flick into a real feed.
    const expectNoBoundary = mountLive({ feedCards: 4 });
    expect(screen.queryByText(/suggested scene/)).toBeNull();
    expectNoBoundary("live feed, no suggestion card");
  });

  // D91, reversing D50's device-only half. A lens question woven into a
  // LIVE feed against a SEEDED bank is an ordinary live card: the answer
  // goes through LIVE.vote (owner-only doc → k-floored aggregate) AND
  // still records to the on-device instrument, and the card renders the
  // measured split plus the same engage row every live card gets — the
  // anonymous world-takes toggle included.
  it("a seeded live lens card votes, records locally, and shows the crowd", async () => {
    // Nine world cards: the weave inserts the first lens card after the
    // ninth. The live pool starts at qi 0 (lens-live.test.ts pins that), so
    // the first lens card on screen is the first lens's first question.
    const expectNoBoundary = mountLive({ feedCards: 9 });
    const lens = window.IS_LENSES[0];
    const q0 = lens.questions[0].q;
    // The prompt div is a direct child of the card root, so its parent
    // scopes every query to THIS card — nine world cards share their two
    // option labels, and 'Strongly agree' repeats on later lens cards.
    const card = screen.getByText(q0).parentElement;
    try {
      fireEvent.click(within(card).getByRole("button", { name: "Strongly agree" }));
      // A live lens card plays the consequence beat like any live card, so
      // wait it out before asserting on the answered state.
      await act(async () => { await new Promise((r) => setTimeout(r, 1200)); });
      // 1. The vote left the device: LIVE.vote heard the lens card, under
      //    its own id, as option "0".
      expect(live.votes).toEqual({ [`lq-${lens.id}-0`]: "0" });
      // 2. …and the instrument STILL recorded it, inverted: the feed scale
      //    runs agree→disagree while the store runs disagree→agree, so
      //    option 0 stores value 4 — which, on an uninverted item, scores
      //    100 on its dimension in live mode (no prior to dilute it).
      expect(window.LENSES.done(lens.id)).toBe(1);
      expect(window.LENSES.score(lens.id)[lens.questions[0].d]).toBe(
        lens.questions[0].invert ? 0 : 100,
      );
      // 3. The measured split renders — a share numeral and the votes
      //    count — and the D50 acknowledgment is gone with the flag.
      expect(card.textContent).toMatch(/\d\s*%/);
      expect(card.textContent).not.toContain(`Saved to your ${lens.title} lens`);
      // 4. The live engage row is present: the anonymous takes toggle
      //    (D83) reaches lens cards now.
      expect(within(card).queryByRole("button", { name: /^Takes$/ })).not.toBeNull();
      expectNoBoundary("live lens card (seeded)");
    } finally {
      // The lens store persists to localStorage and lives for the module —
      // leave it as the next case expects to find it. The feed's own vote
      // memory goes too, or the NEXT case finds lq-<lens>-0 already
      // answered and parked behind the expander.
      window.LENSES.reset();
      localStorage.removeItem("insight.lenses.v1");
      localStorage.removeItem("insight.feedVotes.v1");
    }
  });

  // D50's half that SURVIVES D91: against a bank with no lens rows (an
  // unseeded or pre-D91 backend, modelled by lensAgg → null), the card's
  // counts are authored rather than measured, so the selfOnly treatment
  // stays — no split, no engage row, the acknowledgment instead — and
  // nothing reaches LIVE.vote, whose write the rules would refuse anyway
  // (no question doc to validate against).
  it("an unseeded live lens card records locally and shows no invented crowd", () => {
    const expectNoBoundary = mountLive({ feedCards: 9, lensBank: false });
    const lens = window.IS_LENSES[0];
    const card = screen.getByText(lens.questions[0].q).parentElement;
    try {
      fireEvent.click(within(card).getByRole("button", { name: "Strongly agree" }));
      // selfOnly cards skip the consequence beat, so the answered state is
      // already on screen — no settle wait.
      expect(window.LENSES.done(lens.id)).toBe(1);
      expect(live.votes).toEqual({});
      // No split, no votes count — the acknowledgment instead. Both halves
      // matter: the numeral/fill suppression AND the note, so a broken
      // gate and a vacuous render both fail here.
      expect(card.textContent).not.toMatch(/\d\s*%/);
      expect(card.textContent).not.toMatch(/votes/i);
      expect(card.textContent).toContain(`Saved to your ${lens.title} lens`);
      expect(within(card).queryByRole("button", { name: /takes$/i })).toBeNull();
      expect(within(card).queryByRole("button", { name: /who voted/i })).toBeNull();
      expectNoBoundary("live lens card (unseeded fallback)");
    } finally {
      window.LENSES.reset();
      localStorage.removeItem("insight.lenses.v1");
      localStorage.removeItem("insight.feedVotes.v1");
    }
  });

  // D51. The module stores' purge listeners are covered in
  // purge-wipe.test.ts; this is the COMPONENT half: the feed stays mounted
  // across a uid change and persists four of its maps by spreading state
  // back to the purged keys, so the event must reach component state too.
  // Asserted through the DOM — an answered card's exact-label option
  // buttons are gone (the result tiles carry the share in their name), and
  // the purge brings them back: the new account meets a fresh card.
  // daily-split.jsx carries the same listener shape; the scan
  // (check:purge) holds both registered.
  const removeInsightKeys = () => {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith("insight.")) localStorage.removeItem(k);
    }
  };

  it("the mounted feed drops its answered state when the purge announces", async () => {
    // Earlier cases voted this same fixture card, and the feed seeds its
    // votes from insight.feedVotes.v1 at mount — start from clean keys or
    // the card mounts already answered and there is nothing to click.
    removeInsightKeys();
    const expectNoBoundary = mountLive();
    fireEvent.click(screen.getByRole("button", { name: FEED_OPTIONS[0] }));
    await act(async () => { await new Promise((r) => setTimeout(r, 1200)); });
    expect(
      screen.queryByRole("button", { name: FEED_OPTIONS[1] }),
      "the fixture card did not reach its answered state",
    ).toBeNull();
    act(() => {
      // exactly purgeLocalTrace's behaviour: keys first, then the announcement
      removeInsightKeys();
      window.dispatchEvent(new Event("insight:local-purge"));
    });
    expect(
      screen.queryByRole("button", { name: FEED_OPTIONS[1] }),
      "the purge did not clear the feed's vote state",
    ).not.toBeNull();
    expectNoBoundary("feed after purge");
  });
});

// The demo persona must not become a live user's profile — on ANY mount.
//
// GeneralPanel seeds its state from localStorage and writes the whole blob
// back on mount, with no edit made. So the first open persisted a record,
// and every open after that found one and took the merge path — which used
// to spread the sample persona (`age 34 · Editor · independent press · MA
// Literature · Univ. of Oslo`) underneath it. The live-mode guard sat past
// that branch and was unreachable from the second mount onward.
//
// It does not stop at cosmetics: GeneralPanel's other effect maps the same
// vitals onto the seven anchor keys and calls LIVE.saveAnchors, which writes
// them to `v2_users/{uid}`; answerAnchors() then stamps that map onto every
// answer the user creates. Answers are create-only (D5), so a fabricated
// ageBand cannot be corrected after the fact — it is folded into published
// breakdowns as a real cohort.
//
// TWO mounts, not one, because one passes on the code this replaced.
describe("live mode never inherits the sample persona (D55)", () => {
  const DEMO_JOB = "Editor · independent press";
  const DEMO_EDU = "MA Literature · Univ. of Oslo";

  function openProfile() {
    fireEvent.click(screen.getByRole("button", { name: /^profile$/i }));
  }

  // jsdom's localStorage is shared across cases in this file, and the panel
  // persists on mount — so without this, case order decides what case two
  // reads. (Case two failed exactly that way when it was written.)
  beforeEach(() => { localStorage.clear(); });

  it("shows no demo vitals on a reopened profile, and anchors none", () => {
    const saved = [];
    live = installLive();
    window.LIVE.saveAnchors = (a) => { saved.push(a); };
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // First open — writes the localStorage record that used to poison the
    // second one.
    const first = render(<App />);
    openProfile();
    expect(screen.queryByDisplayValue(DEMO_JOB)).toBeNull();
    first.unmount();

    // Second open, same device, same storage.
    render(<App />);
    openProfile();
    expect(
      screen.queryByDisplayValue(DEMO_JOB),
      "the sample persona's job came back on the second mount",
    ).toBeNull();
    expect(
      screen.queryByDisplayValue(DEMO_EDU),
      "the sample persona's education came back on the second mount",
    ).toBeNull();

    // …and nothing derived from it reached the anchors write. This is the
    // half that outlives the session: an anchor lands on immutable answers.
    expect(saved.length, "the anchors effect never ran — assertion is vacuous")
      .toBeGreaterThan(0);
    for (const a of saved) {
      expect(a.profession ?? "").toBe("");
      expect(a.education ?? "").toBe("");
      expect(a.ageBand ?? "").toBe("");
    }
  });

  it("drops the v1 record's demo values but keeps what the user changed", () => {
    // A device that already ran the old build carries the persona on disk as
    // its own properties, by then indistinguishable from typed input. The
    // migration keeps every field that DIFFERS from the seed — only the user
    // could have put those there — and drops the rest.
    //
    // Asserted through the anchors write rather than the DOM, because that
    // is the half that outlives the device: `job` and `education` are two of
    // the seven keys saveAnchors sends to v2_users/{uid}.
    localStorage.setItem("insight.profileGeneral.v1", JSON.stringify({
      vitals: { job: "Baker", education: DEMO_EDU },
      interests: [], likes: [], dislikes: [], heroes: [],
    }));
    const saved = [];
    live = installLive();
    window.LIVE.saveAnchors = (a) => { saved.push(a); };
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<App />);
    openProfile();

    expect(saved.length, "the anchors effect never ran — assertion is vacuous")
      .toBeGreaterThan(0);
    const last = saved[saved.length - 1];
    expect(last.profession, "the migration dropped a value the user had changed").toBe("Baker");
    expect(last.education, "a demo value survived the migration").toBe("");
    // The old key is retired, so the migration cannot run a second time and
    // re-seed what the user has since cleared.
    expect(localStorage.getItem("insight.profileGeneral.v1")).toBeNull();
  });

  // ── the Map's anchor ring, the second place the persona reached ──
  //
  // The profile panel above was fixed; the ring at the centre of Mirror ·
  // You was not, and it is the worse of the two because MirrorPreviewTag
  // returns null for the You stop — sample data there wears no badge at
  // all. Measured before the fix: a live build with a fresh account
  // rendered "age 34 / born 1991", "Editor · independent press", "MA
  // Literature · Univ. of Oslo" and four test results with invented
  // "taken N ago" stamps, because every fallback in list() was a `||`
  // onto IS_DATA.me.
  //
  // hydrate() is what clears the demo test results, and dispatching its
  // event is how this file reaches that without booting live.ts — the
  // event IS the contract between data/live.ts and test-definitions.js.
  const hydrateTestResults = (results) => {
    window.dispatchEvent(
      new CustomEvent("insight:test-results", { detail: results }),
    );
  };
  const DEMO_RING = [
    "age 34", "Editor · independent press", "MA Literature · Univ. of Oslo",
  ];

  afterEach(() => {
    // The demo seed is module state in test-definitions.js and these cases
    // replace it. The purge listener restores it — the same path a uid
    // change takes — so the demo-mode cases in this file and in
    // smoke.test.jsx do not inherit an emptied object.
    window.dispatchEvent(new Event("insight:local-purge"));
  });

  it("anchors nothing at all for an account that has supplied nothing", () => {
    live = installLive();
    hydrateTestResults({});

    const ring = anchorList();
    expect(
      ring,
      `the anchor ring invented ${JSON.stringify(ring.map((r) => r.value))}`,
    ).toEqual([]);
  });

  it("anchors the viewer's own values, and only those", () => {
    live = installLive({
      anchors: { ageBand: "25-34", profession: "Nurse", education: "Bachelor" },
    });
    // One test taken, three not. The three must not fall back to Mira's.
    hydrateTestResults({
      big5: {
        title: "Big Five", taken: "just now",
        dims: [{ id: "O", label: "Openness", value: 51 }],
      },
    });

    const ring = anchorList();
    expect(ring.map((r) => r.id)).toEqual(["age", "job", "edu", "big5"]);
    expect(ring.find((r) => r.id === "age").value).toBe("age 25-34");
    expect(ring.find((r) => r.id === "job").value).toBe("Nurse");
    expect(ring.find((r) => r.id === "edu").value).toBe("Bachelor");
    expect(ring.find((r) => r.id === "big5").value).toBe("Openness 51");

    const rendered = JSON.stringify(ring);
    for (const demo of [...DEMO_RING, "Openness 78", "10 days ago"]) {
      expect(rendered, `the persona's "${demo}" survived`).not.toContain(demo);
    }
  });

  it("keeps the persona's ring in demo mode", () => {
    // The control. Every assertion above passes if list() simply stopped
    // returning anything, and mock mode is a shipped surface (README's
    // `npm run dev`, and the store screenshots are taken on it).
    const ring = anchorList();
    // 8 since the cognitive bank landed: age/job/education plus one row per
    // test, and the demo persona has a result for all five. It was 7 while
    // `cognitive` had a result and no question bank, so map-anchors listed
    // only four test rows.
    expect(ring.length).toBe(8);
    for (const demo of DEMO_RING) {
      expect(ring.some((r) => r.value === demo || r.value.startsWith(demo)))
        .toBe(true);
    }
  });

  it("hides the profile's map card while the ring is empty", () => {
    // The wiring half: list() is only correct if what renders reads it.
    // MapThumbCard returns null on a zero-length ring.
    live = installLive();
    hydrateTestResults({});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<App />);
    openProfile();
    expect(
      screen.queryByText(/^Your map$/),
      "the map card drew a ring with nothing in it",
    ).toBeNull();
  });

  // ── the Map's group stats, the third place the persona reached (D72) ──
  //
  // The ring above was fixed and the numbers BESIDE it were not.
  // map-group-stats.js hashes the question id into a distribution and
  // map-bottom-card.jsx drew it with no live gate at any of its five call
  // sites, on the same badge-less You stop. Measured before the fix, with
  // this fixture: "48% · You're with the majority · of people your age chose
  // the same · you: 30–39 · Know 48% · Be known 32% · Both 20%" — every
  // figure from hash("daily-000|age|0"), beside a real answer and a real
  // age band.
  //
  // Asserted at the component rather than through the app: reaching this
  // card in a mount means answering a question, laying out the constellation
  // and tapping a dot, and a case that walks all that is really testing the
  // walk. The gate is in MapStats and the branch is in this card.
  const ANSWER_NODE = {
    id: "dq-daily-000", qid: "daily-000", aidx: 0, qtype: "choice",
    prompt: "Would you rather know, or be known?", note: "Today",
    opts: ["Know", "Be known", "Both"],
  };
  const AGE_ANCHOR = [{ id: "age", label: "Age", hue: 265, value: "age 30-39" }];

  it("draws no group split on a Map answer in live mode", () => {
    live = installLive();
    expect(window.MapStats.dist("daily-000", "age", 3, 0), "MapStats still fabricates")
      .toBeNull();

    const { container } = render(
      <window.MTAnswerCard node={ANSWER_NODE} cat={null} anchors={AGE_ANCHOR}
        activeA="age" onFilter={() => {}} />,
    );
    // No percentage anywhere, and no verdict. Asserting on the copy alone
    // would pass if the bar rendered underneath it.
    expect(container.textContent, "a percentage survived on the Map card")
      .not.toMatch(/\d+\s*%/);
    expect(container.querySelector(".mmt-verdict"), "the verdict survived")
      .toBeNull();
    expect(container.querySelector(".mmt-dbar"), "the group bar survived")
      .toBeNull();
    expect(container.textContent).toMatch(/isn’t measured yet/);
  });

  it("still draws the group split in demo mode", () => {
    // The control: every assertion above passes if the card stopped
    // rendering. Demo mode is a shipped surface — `npm run dev`, and the
    // store screenshots are taken on it.
    const { container } = render(
      <window.MTAnswerCard node={ANSWER_NODE} cat={null} anchors={AGE_ANCHOR}
        activeA="age" onFilter={() => {}} />,
    );
    expect(container.querySelector(".mmt-dbar"), "the demo bar is gone too")
      .not.toBeNull();
    expect(container.textContent).toMatch(/\d+\s*%/);
  });

  // ── the results card, the fourth (D72) ──
  //
  // sameType filtered IS_DATA.people — the prototype's invented circle —
  // through IS_FRIEND_TYPES and SigEmblem drew up to four of them
  // on the result. data/live.ts replaces the feed globals and has never
  // touched IS_DATA, so this fired for any live account that finished a
  // test, which the passive tests do from ordinary feed answers. Measured
  // before the fix with the payload below: initials HV and IV — Henrik Vold
  // and Ingrid Vold. D1: no seeded fake users, ever.
  const BIG5_RESULT = {
    big5: {
      title: "Big Five", taken: "just now", accent: "var(--c-around)",
      dims: [
        { id: "O", label: "Openness", value: 72, blurb: "curiosity & range" },
        { id: "C", label: "Conscientiousness", value: 44, blurb: "order" },
        { id: "E", label: "Extraversion", value: 30, blurb: "energy" },
        { id: "A", label: "Agreeableness", value: 68, blurb: "warmth" },
        { id: "N", label: "Sensitivity", value: 55, blurb: "steady" },
      ],
    },
  };
  // Derived from the fixture, not a written-out list: the roster grows, and
  // a hardcoded alternation would keep passing while quietly checking only
  // the people who happened to exist the day it was written — the exact
  // vacuous-pass this file is built to refuse. Escaped anyway, since an
  // initials field is data.
  const DEMO_INITIALS = new RegExp(
    "^(" + (IS_DATA.people || [])
      .map((p) => String(p.init || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .filter(Boolean)
      .join("|") + ")$",
  );
  const initialsIn = (container) =>
    Array.from(container.querySelectorAll("*"))
      .map((n) => (n.textContent || "").trim())
      .filter((t) => DEMO_INITIALS.test(t));

  it("puts no sample people on a live result card", () => {
    live = installLive();
    hydrateTestResults(BIG5_RESULT);

    const { container } = render(<window.ResultProfileCard testKey="big5" />);
    expect(container.textContent, "the card did not render — test is vacuous")
      .toMatch(/Openness/);
    expect(initialsIn(container), "invented friends survived on a live result")
      .toEqual([]);
  });

  it("keeps the persona's same-type friends in demo mode", () => {
    // The control again, and it is load-bearing: `sameType` returning [] for
    // everyone would satisfy the case above without a live gate existing.
    const { container } = render(<window.ResultProfileCard testKey="big5" />);
    expect(initialsIn(container).length, "the demo friends are gone too")
      .toBeGreaterThan(0);
  });

  it("replaces the demo test results on hydration rather than merging over them", () => {
    // Fix's other half, at the unit the bug was in: data/live.ts used to
    // rebind `window.IS_TEST_RESULTS`, which no consumer has read since the
    // D39 conversion — so a fresh live account kept the persona's Big Five,
    // politics, values and attachment scores on every profile surface, and
    // a result earned on another device never arrived.
    expect(IS_TEST_RESULTS.big5, "the demo seed is missing — test is vacuous")
      .toBeDefined();

    hydrateTestResults({
      values: { title: "Values", taken: "just now", dims: [] },
    });

    expect(Object.keys(IS_TEST_RESULTS)).toEqual(["values"]);
    expect(IS_TEST_RESULTS.political, "a demo result survived hydration")
      .toBeUndefined();
  });
});
