// @vitest-environment jsdom
//
// The demo smoke test's other half: the same screens, mounted with
// `window.LIVE` present and enabled.
//
// WHY A SEPARATE FILE. The demo suites (`smoke-daily`, `smoke-topics`,
// `smoke-mirror`, `smoke-nav`, `smoke-overlays`) run with LIVE undefined, so every
// `if (window.LIVE && window.LIVE.enabled)` branch in the spec layer is
// unreached by the suite. Two of those branches are load-bearing product
// decisions rather than cosmetics:
//
//   D111 the Mirror's Near and City stops are two different questions —
//       presence vs the city cohort — and the live axis carries both.
//       (From D9 to D111 live mode dropped City because Near WAS the
//       city; the un-fold is asserted in both directions below.)
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
import { BG_TEXT, DAILY_BG_TEXT, DAILY_COUNTS, FEED_OPTIONS, FEED_PROMPT, LEARN_CARD_OPTIONS, LEARN_CARD_PROMPT, PATH_TITLE, PICK_PROMPT, RANK_PROMPT, TEST_ITEM_OPTIONS, TEST_ITEM_PROMPT, fixtureSurfaceMismatch, installLive } from "./live-fixture";
import NAV from "../data/nav";
import { PATTERNS_EARNED_KEY, PATTERNS_MIN_BASIS, PATTERNS_MIN_MINE, PATTERNS_MIN_POOL } from "../data/patternsReady";
import { TYPE_SMALL } from "../data/typeMix";
import { awaitText, growFeed, openHeaderOverlay, settleBeat, swipeDaily } from "./mount-app";
import { list as anchorList } from "../spec/map-anchors.js";
import { IS_TESTS, IS_TEST_RESULTS } from "../spec/test-definitions.js";
// The demo test pool, imported so the D280 case can bind on the actual
// cards that must not appear rather than on a copy of their wording.
import { TEST_FEED_QS } from "../spec/test-feed-data.js";
// The bundled demo SAMPLE (D284) — imported so the live cases can assert
// on the actual cards that must not appear, rather than on a copy.
import { LEARN_CARDS } from "../spec/learn-data.js";
import { PASSIVE } from "../spec/passive-progress.js";
import { IS_ARCHETYPES } from "../spec/archetype-data.js";
import { resetNormCache } from "../data/testNorms";
import { FRIENDS } from "../spec/follows.js";
import { IS_DATA } from "../spec/sample-data.js";

// The fixture daily's published option counts — IMPORTED, not copied. A
// case below asserts an absolute total built from them, and the guard on
// that total was `12 + 8 + 5 === 25` while this was a hand-copied literal:
// a constant compared with itself, which stays green for any fixture and
// leaves the real assertion to fail with the wrong diagnosis.
const FIXTURE_DAILY_COUNTS = DAILY_COUNTS;
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
  // The Mirror is lazy since D355 and rendered through a slot that is
  // same-tick only once the prewarm has remembered its module — every
  // Mirror case below clicks the tab and asserts in the same breath.
  await specIndex.loadMirrorTab();
  // The Map's family is lazy since v28 §5 and two cases below render
  // window.MTAnswerCard directly — without this await the global is
  // simply absent and both would fail on `undefined`, not on the gate
  // they pin.
  await specIndex.loadMapTab();
  App = globalThis.App;
});

afterEach(() => {
  // The Patterns gate is remembered per device (D265), so a case that
  // opens it would hand the next one an app that has already earned the
  // third tab — including the cases that assert there are two.
  localStorage.removeItem(PATTERNS_EARNED_KEY);
  cleanup();
  errorSpy?.mockRestore();
  live?.restore();
  live = undefined;
});

// `prep` runs between installLive and render — the seam for a case that
// must shape the fixture's globals (an extra feed card, a pre-existing
// store vote) before the first paint reads them.
function mountLive(opts, prep) {
  live = installLive(opts);
  if (prep) prep(live);
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
    // ALL THREE diffs, not two. `near` was computed and dropped on the
    // floor here until 2026-08-24, which left exactly the failure the
    // paragraph above describes live for every `LIVE.near` member: the
    // fixture could gain or lose one and the cases below would keep
    // passing against `undefined`.
    expect(fixtureSurfaceMismatch(live)).toEqual({ live: [], social: [], near: [] });
  });
});

describe("spec layer mounts in live mode", () => {
  it("renders the daily tab without tripping the boundary", () => {
    const expectNoBoundary = mountLive();
    expectNoBoundary("daily/live");
  });

  // An empty live deck is the SLOW BOOT, not just an unseeded day:
  // `daily-split`'s `get data` returns [] for the whole window where
  // `LIVE.enabled` is true and `LIVE.ready` is not, so this is the first
  // frame of every live launch. It reached the tree returning a bare
  // element from `renderVals()` while `render()` destructured
  // `{ rootRef, screen }` off it — both undefined, so the tab painted an
  // empty div: no loading card, no ruler, and no root ref, which also
  // means `setupGestures` never ran.
  //
  // The ErrorBoundary cannot see this: destructuring absent keys off a
  // React element throws nothing, so the crash is silent and the smoke
  // tests above pass on a blank screen. Assert on the card's own words.
  it("renders the loading card, not a blank tab, on an empty live deck", () => {
    const expectNoBoundary = mountLive({}, (l) => {
      l.LIVE.deck = () => [];
    });
    expectNoBoundary("daily/live/empty-deck");
    expect(screen.getByText(/Fetching today’s question/i)).toBeTruthy();
    // The blank tab and the loading card both trip no boundary and both
    // render a div, so the screen root has to be asserted non-empty too —
    // that is the half `getByText` alone would keep passing without.
    const root = document.querySelector('[data-screen-label="Split daily v2"]');
    expect(root, "daily screen root missing").toBeTruthy();
    expect(root.childElementCount).toBeGreaterThan(0);
  });

  it("renders the mirror tab without tripping the boundary", () => {
    const expectNoBoundary = mountLive();
    fireEvent.click(screen.getByRole("button", { name: /^mirror$/i }));
    expectNoBoundary("mirror/live");
    expect(screen.getByRole("button", { name: /^mirror$/i }).className).toContain("is-active");
  });

  it("opens the profile overlay without tripping the boundary", async () => {
    const expectNoBoundary = mountLive();
    await openHeaderOverlay("profile");
    expectNoBoundary("profile/live");
  });

  // D344: Account & privacy left the General tab for the gear in the
  // profile's corner. Three halves worth pinning, because each fails
  // silently: the General tab no longer mounts the panel (a re-added
  // inline render would draw the settings twice with every gate green);
  // the gear's sheet holds the whole panel — the public-answers sentence
  // and the delete control stay one tap away rather than gone; and Escape
  // closes the SHEET alone. useDialog's stopPropagation is what keeps the
  // press off the profile dialog underneath — losing it would throw the
  // reader out of the profile for asking to leave settings. The demo half
  // (no gear at all — the panel renders nothing without an account) is in
  // smoke-overlays, where LIVE is undefined.
  it("hides Account & privacy behind the corner gear, and the sheet peels alone (D344)", async () => {
    const expectNoBoundary = mountLive();
    await openHeaderOverlay("profile");
    await act(async () => {});
    expect(
      screen.queryByText("Delete everything"),
      "the account panel is still inline on the General tab",
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Account & privacy" }));
    const sheet = screen.getByRole("dialog", { name: "Account & privacy" });
    expect(within(sheet).getByText("Delete everything")).toBeTruthy();
    // The bluntest sentence in the app rides the panel wherever it lives
    // (D183; LivePrivacyPanel.test pins it open-on-arrival inside).
    expect(within(sheet).getByText(/Your answers are public/)).toBeTruthy();
    fireEvent.keyDown(sheet, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Account & privacy" })).toBeNull();
    expect(
      screen.getByRole("dialog", { name: "Your profile" }),
      "closing the account sheet closed the profile under it",
    ).toBeTruthy();
    expectNoBoundary("profile/live gear sheet");
  });

  // The identity row's sub-line, both branches (D344 amendment). It was one
  // hardcoded sentence for every live session — "anonymous session — link
  // Google below to keep it" — wrong twice: a Google-linked account was
  // told it was anonymous (live.ts's auth observer had this exact site on
  // record), and "below" pointed at the Sign-in row D211 removed. D343
  // then revived that row inside the account sheet, so the nudge is true
  // again and only the location claim stays dead. The fixture is
  // anonymous-first, so the default mount pins that branch; the second
  // flips `linked` and claims a handle to pin the other.
  it("keeps the sign-in nudge, minus the dead location, while anonymous", async () => {
    const expectNoBoundary = mountLive();
    await openHeaderOverlay("profile");
    expect(screen.getByText("anonymous session — sign in to keep it")).toBeTruthy();
    // The location claim must not come back: the Sign-in row is behind
    // the gear (D344), not "below" on the tab this line sits on.
    expect(document.body.textContent).not.toMatch(/link Google below/i);
    expectNoBoundary("profile/live identity row, anonymous");
  });

  it("shows the handle, not the anonymous line, once the account is linked", async () => {
    const expectNoBoundary = mountLive({}, (l) => {
      l.LIVE.linked = true;
      l.LIVE.handle = "fixture";
    });
    await openHeaderOverlay("profile");
    expect(screen.queryByText(/anonymous session/)).toBeNull();
    expect(screen.getByText("@fixture")).toBeTruthy();
    expectNoBoundary("profile/live identity row, linked");
  });

  // ── the patterns tab's mount gate, both sides (D265) ────────────────
  //
  // The tab is absent until the nightly fit has published enough to draw
  // and the viewer has answered enough to be drawn in it. smoke-nav owns
  // the closed half against a demo build; these two own the half that
  // needs a published signal, because only the fixture can supply one.

  it("stays out of the bar on a live build the fit has not reached", () => {
    // A live app is not a sufficient condition, and this is the case that
    // says so: LIVE is on, boot has run, and the fit has published
    // nothing — so the bar is still the two tabs v1 ships.
    const expectNoBoundary = mountLive();
    expect(screen.queryByRole("button", { name: /^patterns$/i })).toBeNull();
    expect(document.querySelectorAll(".tabbar .tab-btn").length).toBe(2);
    expectNoBoundary("patterns below the gate/live");
  });

  it("appears once the fit has published enough, and draws no invented people (D166 §1, D167)", async () => {
    // Above both floors: a fit that published PATTERNS_MIN_POOL questions
    // at PATTERNS_MIN_BASIS, and a viewer with PATTERNS_MIN_MINE answers
    // among the ones it folds.
    const expectNoBoundary = mountLive({
      patterns: { pool: PATTERNS_MIN_POOL, basis: PATTERNS_MIN_BASIS, mine: PATTERNS_MIN_MINE },
    });
    expect(document.querySelectorAll(".tabbar .tab-btn").length).toBe(3);
    const btn = screen.getByRole("button", { name: /^patterns$/i });
    // The tab body is a lazy chunk — the click alone renders nothing, so
    // awaitText lets the import resolve before asserting. In jsdom the
    // loadings fetch cannot resolve, so the honest state here is the
    // waiting card; what this pins is that a LIVE mount never falls back
    // to the prototype's synthetic crowd (560 people, fabricated
    // "78% pick that" lines) and never trips the boundary.
    fireEvent.click(btn);
    await awaitText(/pattern fit|No patterns yet/i);
    expect(document.querySelector(".app").getAttribute("data-view")).toBe("patterns");
    expect(document.body.textContent).toMatch(/pattern fit|No patterns yet/i);
    expectNoBoundary("patterns above the gate/live");
    // WHAT THIS CASE CANNOT SEE, stated so nobody reads more into it. In
    // jsdom the loadings fetch never resolves, so the body renders the
    // waiting card and no lens ever mounts: an assertion here about the
    // prototype's 560 invented people, or about the demo-only sentence,
    // would be guarding a branch this mount cannot reach — the vacuous
    // pass this file's own header warns about. Those two live where the
    // branches do, in ui/PatternsTab.test.tsx. What this case owns is the
    // MOUNT: the tab is in the bar, it opens, the chunk arrives, and the
    // shell keys its scroll memory on it.
  });

  it("puts the tab in the bar mid-session, without a reload", async () => {
    // THE TRANSITION, which the case above cannot see: it mounts with the
    // signal already published, so only `useState`'s first read runs. This
    // is the path that matters for the feature as asked for — the app is
    // open, boot lands the fit's number, and the tab appears. Without the
    // subscription the tab would wait for the next launch, which is a
    // different (and much quieter) product.
    const expectNoBoundary = mountLive();
    expect(document.querySelectorAll(".tabbar .tab-btn").length).toBe(2);
    act(() => {
      live.LIVE.patternsSignal = () => ({
        pool: PATTERNS_MIN_POOL, basis: PATTERNS_MIN_BASIS, mine: PATTERNS_MIN_MINE,
      });
      live.LIVE.vote("daily-000", "1");           // …and the store notifies
    });
    expect(document.querySelectorAll(".tabbar .tab-btn").length).toBe(3);
    const btn = screen.getByRole("button", { name: /^patterns$/i });
    fireEvent.click(btn);
    await awaitText(/pattern fit|No patterns yet/i);
    expect(document.querySelector(".app").getAttribute("data-view")).toBe("patterns");
    expectNoBoundary("patterns gate opening mid-session/live");
  });

  it("the daily's near end walks into the tab once the gate is open", async () => {
    // The other half of smoke-nav's spring-back case: the same gesture,
    // above the gate. `goNav` answering true is what lets daily-split
    // leave the card where the navigation took it instead of springing
    // it — and the exit D166 §1 licensed is the whole reason the near end
    // is reachable at all.
    const expectNoBoundary = mountLive({
      patterns: { pool: PATTERNS_MIN_POOL, basis: PATTERNS_MIN_BASIS, mine: PATTERNS_MIN_MINE },
    });
    expect(document.querySelector(".app").getAttribute("data-view")).toBe("track:world");
    swipeDaily(1);
    expect(document.querySelector(".app").getAttribute("data-tab")).toBe("patterns");
    await awaitText(/pattern fit|No patterns yet/i);
    expectNoBoundary("near-end swipe above the gate/live");
  });

  it("takes the tab back when the account changes under it", () => {
    // The one case that closes the gate: purgeLocalTrace fires
    // `insight:local-purge` on deletion and on a uid change, with no
    // reload behind it. The latch has to hear that, or the next account
    // inherits a tab it has not earned — and a viewer standing on the tab
    // has to be moved, or they are left on one the bar no longer carries.
    const expectNoBoundary = mountLive({
      patterns: { pool: PATTERNS_MIN_POOL, basis: PATTERNS_MIN_BASIS, mine: PATTERNS_MIN_MINE },
    });
    act(() => { NAV.goNav("patterns"); });
    expect(document.querySelector(".app").getAttribute("data-tab")).toBe("patterns");
    act(() => {
      live.LIVE.patternsSignal = () => ({});      // a fresh account: nothing answered
      window.dispatchEvent(new Event("insight:local-purge"));
    });
    expect(document.querySelectorAll(".tabbar .tab-btn").length).toBe(2);
    expect(screen.queryByRole("button", { name: /^patterns$/i })).toBeNull();
    expect(document.querySelector(".app").getAttribute("data-tab")).toBe("track");
    expectNoBoundary("patterns gate after a purge/live");
  });

  it("the gate does not close under someone standing on the tab", () => {
    // Monotone within a session. Both inputs can only grow in life — a
    // published basis never shrinks, answers never un-happen — but a
    // store that answered differently for any reason would take the bar
    // out from under a viewer, leaving `tab` set to one TABS no longer
    // carries: a bar with nothing marked current over a body nothing
    // mounts.
    //
    // MEASURED, so nobody trims this as belt-and-braces without knowing
    // what it holds: two things keep the property — the latch that drops
    // the subscription once open, and a check that only ever sets true —
    // so removing EITHER alone still passes here. What fails is removing
    // both, which is exactly the shape the regression would take: the
    // hook rewritten as a plain derived boolean.
    const expectNoBoundary = mountLive({
      patterns: { pool: PATTERNS_MIN_POOL, basis: PATTERNS_MIN_BASIS, mine: PATTERNS_MIN_MINE },
    });
    act(() => { NAV.goNav("patterns"); });
    expect(document.querySelector(".app").getAttribute("data-tab")).toBe("patterns");
    act(() => {
      // The store forgets, and then notifies through the ordinary path.
      // Writable by construction — installLive defines its members with
      // `writable: true` and restores the real descriptors after.
      live.LIVE.patternsSignal = () => ({});
      live.LIVE.vote("daily-000", "1");
    });
    expect(document.querySelectorAll(".tabbar .tab-btn").length).toBe(3);
    expect(document.querySelector(".app").getAttribute("data-tab")).toBe("patterns");
    expectNoBoundary("patterns gate latched/live");
  });

  it("shows the real follow list in the live profile, none of the demo field", async () => {
    // The General tab used to embed MirrorFieldBody pop="groups" — the
    // scenes orbit with invented populations ("5.6k people" / "22k
    // people"), the closer-means-more-like-you distances, "Who's in your
    // circles · 138 members" and "What they answered", all sample data. A
    // release device showed the lot to a real user. Live mode now renders
    // LiveScenesCard instead: the follow store's own list, no populations,
    // no likeness claims. The demo smoke suite asserts the demo field
    // still renders with LIVE off, so the pair pins the swap both ways.
    mountLive();
    await openHeaderOverlay("profile");
    expect(screen.getByText(/Scenes you follow/i)).toBeTruthy();
    expect(screen.queryByText(/closer = members more like you/i)).toBeNull();
    expect(screen.queryByText(/in your circles/i)).toBeNull();
    expect(screen.queryByText(/22k people/i)).toBeNull();
  });

  // D282 — the report that came back twice: "when you click add interest
  // on the general info you are navigated to the feed."
  //
  // D190 fixed where that jump LANDED (the list opens, instead of dropping
  // you in the feed to go looking for it) and left the jump, which is the
  // half a reader actually feels. The list can open where they are
  // standing: the feed's sheet portals to the app frame at z-index 40 and
  // `.overlay` sits at 20, so a feed mounted behind the profile answers
  // and the sheet draws on top of it.
  //
  // The assertion that matters is the SECOND one. The sheet opening proves
  // the ask was answered; the profile still being there proves it was
  // answered where the reader was, which is the whole report.
  it("opens the topic list over the profile, without leaving it (D282)", async () => {
    // An empty follow list, which is what a real live build boots with and
    // what puts the field's door on screen at all. These suites are a DEMO
    // build as far as `import.meta.env` is concerned (scenes.js reads the
    // flag at module scope), so SCENES seeds the prototype's joined
    // groups and the card renders chips instead — the purge is how the
    // store is told to re-read, and it is the same event a uid change
    // fires.
    localStorage.clear();
    localStorage.setItem("insight.scenes.v1", "[]");
    window.dispatchEvent(new Event("insight:local-purge"));
    try {
      await runIt();
    } finally {
      // Hand the follow list back. SCENES caches its set in module scope
      // and `cleanup()` does not reach it, so an empty one outlives this
      // case — and fifteen later cases in this file assert on
      // scene-attached feed cards that then are not there. Measured, not
      // guessed: that is exactly what the first draft of this case did.
      localStorage.removeItem("insight.scenes.v1");
      window.dispatchEvent(new Event("insight:local-purge"));
    }
  });

  async function runIt() {
    const expectNoBoundary = mountLive();
    await openHeaderOverlay("profile");
    expect(screen.getByText(/Scenes you follow/i), "the scenes card is not on screen — this case is vacuous").toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Pick topics/i }));
    // Bound on the sheet's own title and its last row rather than on
    // "Your topics": that header needs a channel the FIXTURE's cards
    // stock, and they carry `culture`, which is not one of the demo
    // build's six. What is being pinned here is where the list opened,
    // not what the fixture happens to put in it.
    expect(screen.getByText("Add a topic"), "the topic list never opened").toBeTruthy();
    // INVERTED at D368: shape A took the purchase funnel out of the binary,
    // so the app must carry NO ask-a-question call to action. This asserted
    // the door was present until the decision; it now pins its absence,
    // which is the property App Review reads the app for.
    expect(
      screen.queryAllByRole("button", { name: /ask a question/i }),
      "an ask-a-question door is still in the binary (D368 removed all five)",
    ).toHaveLength(0);
    expect(
      screen.queryByText(/Scenes you follow/i),
      "the door still threw the reader out of the profile to show them a list",
    ).toBeTruthy();
    // D211's lift is measured off the tab bar, which `.overlay` covers —
    // so over the profile the sheet takes full cover instead of leaving a
    // strip of the panel showing where the navigation should be.
    const scrim = document.querySelector(".wf-scrim");
    expect(scrim, "no sheet scrim at all").not.toBeNull();
    expect(scrim.style.bottom || "", "the sheet lifted for a tab bar nobody can see").toBe("");
    expectNoBoundary("topic list over the live profile");
  }

  it("opens the search overlay without tripping the boundary", async () => {
    const expectNoBoundary = mountLive();
    await openHeaderOverlay("search");
    expectNoBoundary("search/live");
  });

  it("shows no sample people in the search overlay", async () => {
    // The overlay's Friends rows are sample-data personas wearing invented
    // relationships ("sister · since birth · 86% match"). Live mode has no
    // person graph at all (D3), so a live build listing them is a D1
    // fabrication — and it shipped: the release build offered five seeded
    // strangers as the user's oldest friends. The demo smoke case asserts
    // the same rows DO render with LIVE off, so this pair pins the gate in
    // both directions.
    mountLive();
    await openHeaderOverlay("search");
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
    // …and not the last-sync pill either (D356): an attached session has
    // nothing to reconnect to.
    expect(screen.queryByRole("button", { name: /last sync/i })).toBeNull();
    expectNoBoundary("daily/live/no-reason");
  });

  it("a warm paint whose reconcile failed shows the last-sync pill, with the reason one tap away", async () => {
    // D356: the deck on screen is real — this device's caches — so the
    // sample-questions pill would be a lie; but the counts are as of the
    // last sync and the server has not been heard from, and that is a
    // fact the person deserves in the same shape as the demo banner: a
    // pill, and the reason behind a tap.
    const expectNoBoundary = mountLive({ stale: true });
    expect(screen.queryByRole("button", { name: /sample questions/i })).toBeNull();
    const pill = screen.getByRole("button", { name: /last sync/i });
    expect(screen.queryByText(/auth\/network-request-failed/)).toBeNull();
    fireEvent.click(pill);
    expect(await screen.findByText(/auth\/network-request-failed/)).toBeTruthy();
    expectNoBoundary("daily/live/stale");
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
  // D111. The Mirror's axis is the same seven stops in both modes — the
  // live ruler dropped City from D9 to D111 (Near WAS your city), and the
  // un-fold is asserted in both directions: City is back, and Near really
  // did become presence-only rather than a second door to the city cohort.
  // The stops are role="tab" on one tablist, not loose buttons — query them
  // as the axis they are, so a same-named control elsewhere on the screen
  // cannot satisfy or break this.
  const stopLabels = () =>
    screen.getAllByRole("tab").map((el) => el.getAttribute("aria-label"));

  // Wait for the City stop's body to actually be on screen.
  //
  // This was a fixed `setTimeout(50)` in four cases and stopped being safe
  // at D119, when LiveCohortBody joined Circle behind a React.lazy: 50 ms
  // is a guess about how long a dynamic import takes, and under a loaded
  // runner it lost — one of these four failed in a full `test:unit` and
  // passed on its own, which is the signature. findByText polls until the
  // body's own first line is there, so it waits exactly as long as it has
  // to and no case that follows it can race the import.
  // The stop's kicker, since D172 removed the explanatory line this used
  // to poll for. Still the City body's own first text, and still unique —
  // Near's kicker is "Around you".
  const openCity = () => screen.findByText(/^Your city$/i);

  it("keeps the City stop on the live ruler, and Near is presence-only (D111)", async () => {
    mountLive();
    fireEvent.click(screen.getByRole("button", { name: /^mirror$/i }));
    const liveAxis = stopLabels();
    expect(liveAxis, "live mode lost the City stop — D9's drop is back").toContain("City");
    expect(liveAxis).toContain("Near");
    expect(liveAxis).toContain("Country");

    // Near: the counter, and NOT the city cohort — the un-fold's other half.
    fireEvent.click(screen.getByRole("tab", { name: "Near" }));
    expect(screen.getByText(/Around you/i)).toBeTruthy();
    expect(screen.queryByText(/^Your city$/i)).toBeNull();

    // City: the cohort, and NOT the counter.
    fireEvent.click(screen.getByRole("tab", { name: "City" }));
    await openCity();
    expect(screen.queryByText(/Around you/i)).toBeNull();

    cleanup();
    live.restore();
    live = undefined;
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /^mirror$/i }));
    expect(
      stopLabels(),
      "demo mode lost the City stop — the axis broke somewhere",
    ).toContain("City");
  });

  // D112. The City stop's constellation, on the real mount: the fixture
  // carries one scored city-mate (Ada), so the field must render her as a
  // positioned node — real name, score-based match — and none of the demo
  // cast may ride along. The demo field this replaces invented "Anders K.
  // · 92%" from constants; the assertion that no such name appears is the
  // same one the search overlay and result cards already carry.
  it("draws the City constellation from real people, never the demo cast", async () => {
    const expectNoBoundary = mountLive();
    fireEvent.click(screen.getByRole("button", { name: /^mirror$/i }));
    fireEvent.click(screen.getByRole("tab", { name: "City" }));
    await openCity();
    // The constellation is no longer a tab at all (D136): it is the head of
    // the stop and draws on arrival. The click this case used to make —
    // first a real navigation, then a deliberate no-op through D135 — is
    // gone with the tab, which is why the tab order has stopped being able
    // to break this case at all. What is left measures the field itself.
    // The field is a lazy chunk — await its caption, then the node.
    expect(await screen.findByText(/Oslo · closer = more like you/i)).toBeTruthy();
    const node = screen.getByRole("button", { name: /Ada · \d+% like you/ });
    expect(node).toBeTruthy();
    // Tapping the node opens the score comparison, basis named.
    fireEvent.click(node);
    expect(screen.getByText(/aligned with yours/i)).toBeTruthy();
    // The prototype's sample people stay in the prototype.
    for (const ghost of [/Anders/, /Ingrid/, /Petter V/, /Sigrid/]) {
      expect(document.body.textContent).not.toMatch(ghost);
    }
    expectNoBoundary("mirror/live/city-constellation");
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

  const voteFeedCardAndSettle = () => {
    fireEvent.click(screen.getByRole("button", { name: FEED_OPTIONS[0] }));
    // The reveal animation clears `beat` from its own onDone; until it does,
    // the engage row is not mounted for either branch. Skipped rather than
    // outwaited — see settleBeat in mount-app.jsx.
    settleBeat();
  };

  // Crossroads on a LIVE feed (D136): the story comes from the bank and
  // every number on it is folded from real answers. What this case is
  // really guarding is that the card reads the LIVE source rather than its
  // demo pool — the two render identically apart from the words, so a card
  // that quietly fell back to `paths-data.js` would look perfectly fine and
  // be showing authored crowd figures to a live user, which is D1's case.
  // Binding on the fixture's own story title is what tells them apart.
  //
  // Since D341 a story is a MEMBER of the feed pool — the fixture pushes
  // it into WORLD_FEED_QS the way buildFeedGlobals emits it — so finding
  // the title here also pins the live dispatch: the stream dealt the card,
  // nothing reserved it a slot. (The membership shape itself — several at
  // once, parking when finished — is pinned on the demo mount.)
  it("draws Crossroads from the bank on a live feed, never the demo pool", () => {
    const expectNoBoundary = mountLive();
    expect(
      screen.getByText(PATH_TITLE),
      "the live Crossroads card is missing, or fell back to the demo story",
    ).toBeTruthy();
    // The demo pool's stories stay in the demo pool.
    expect(screen.queryByText("The Wallet")).toBeNull();
    expect(screen.queryByText("The Wrong Text")).toBeNull();
    expectNoBoundary("live feed, crossroads from the bank");
  });

  // The empty arm, which is the one a real launch actually opens on: a
  // story in the bank that nobody has finished. There is no crowd to draw,
  // and drawing one anyway — eight branches at zero width — would say
  // "nobody went anywhere" rather than "nobody has been here yet".
  it("says so when a live story has no finished walks yet", () => {
    const expectNoBoundary = mountLive({ tooSmall: true });
    expect(screen.getByText(PATH_TITLE)).toBeTruthy();
    // No share chips: with a total of zero there is no share to state.
    expect(screen.queryByText(/ended here$/)).toBeNull();
    expect(screen.queryByText(/walks your road$/)).toBeNull();
    expectNoBoundary("live feed, crossroads with no walks");
  });

  // THE FRONT DOOR SAID 100% AND, ONE LINE LOWER, THAT NOBODY HAD BEEN
  // COUNTED.
  //
  // `counts` is the published aggregate plus your own vote, so before the
  // fold has landed anything it is [1, 0, 0] and the shares are [100, 0, 0].
  // The result stage printed a 25px "100%" over your side, the tiles drew
  // the same split as geometry, the consequence beat had already animated
  // the crowd into your camp — and `resultNote` underneath said "You're
  // first — the count lands in a moment". This is the first voter after
  // every UTC rotation, on the app's landing screen.
  //
  // The feed had already ruled on the identical state three times
  // (world-feed routes a floored card off the tiles, suppresses the
  // numeral, and gates a duel's shares). The daily was the one answer
  // surface with no gate.
  it("draws no split on the daily before the crowd has published one", async () => {
    const expectNoBoundary = mountLive({ tooSmall: true });
    fireEvent.click(screen.getByRole("button", { name: /^Yes$/ }));
    await act(async () => { await new Promise((r) => setTimeout(r, 250)); });

    const body = document.body.textContent;
    // The line that was always right, and is now the only claim on screen.
    expect(body, "the first-voter note is missing — the case is testing nothing")
      .toMatch(/the count lands in a moment/);
    // …and the four readings that contradicted it.
    expect(body, "the result stage still prints a share").not.toMatch(/100%/);
    expect(body, "the result stage still prints a zero share").not.toMatch(/\b0%/);
    expect(body, "the consequence beat still announces the crowd").not.toMatch(/you.re with them/i);
    expectNoBoundary("live daily, first voter");
  });

  // The control, and it is the half that keeps the gate from being "never
  // draw a split": the same ballot with a published crowd still states one.
  it("still draws the split once the crowd has published — the control", async () => {
    const expectNoBoundary = mountLive();
    fireEvent.click(screen.getByRole("button", { name: /^Yes$/ }));
    await act(async () => { await new Promise((r) => setTimeout(r, 250)); });
    expect(document.body.textContent, "a published crowd stopped being drawn").toMatch(/%/);
    expectNoBoundary("live daily, published crowd");
  });

  // Catalogue picks on a LIVE feed (D14 gone live): the card comes from
  // the bank mapper — an optionless doc the old playable() gate would have
  // dropped — and unanswered it offers the catalogue search.
  it("serves the bank's pick card on a live feed", async () => {
    const expectNoBoundary = mountLive({ pickCard: true });
    await awaitText(/Fixture pick card/);
    expect(
      screen.getByText(PICK_PROMPT),
      "the live pick card is missing — the mapper dropped the optionless doc",
    ).toBeTruthy();
    expectNoBoundary("live feed, pick card unanswered");
  });

  // The answered reveal draws the PUBLISHED canon — pickCanon's board,
  // never the demo store's baked crowd — and wears the live copy: since
  // D98 a spot needs one vote, so the demo's "needs 5 votes" clause would
  // be a false claim about an exact number (COPY.md §3). The store knows
  // the answer, WF_LS does not — the fresh-device path, which is also what
  // exercises pickVal's myVotes fallback.
  it("reveals the published board with the live copy, not the demo floor's", async () => {
    const expectNoBoundary = mountLive({ pickCard: true }, (l) => {
      l.votes["pick-fixture"] = "128514";
    });
    // An answered card parks behind the Answered expander at the stream's
    // end (D133) — stock the tail, open the expander, then expand the
    // collapsed row itself to reach the reveal.
    await growFeed();
    fireEvent.click(screen.getByRole("button", { name: /^Answered · 1$/ }));
    await awaitText(/Fixture pick card/);
    fireEvent.click(screen.getByText(PICK_PROMPT));
    await awaitText(/of 10 spots on the board claimed/);
    // the fixture canon: two rows on the board, three folded
    expect(screen.getByText(/everyone else · 3/)).toBeTruthy();
    expect(screen.getByText(/2 of 10 spots on the board claimed/)).toBeTruthy();
    expect(
      screen.queryByText(/a spot needs 5 votes/),
      "a live board printed the demo floor's clause — D98 made counts exact",
    ).toBeNull();
    // D17's segment chips ride the published `by`
    expect(screen.getByRole("button", { name: "everyone" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "18-24" })).toBeTruthy();
    expectNoBoundary("live feed, pick card answered");
  });

  it("says a pick outside the board is not on it, never that it is below a floor", async () => {
    // The board is ten rows over catalogues of a thousand entries, so a
    // pick outside it is the ORDINARY case, and the tile said "below the
    // floor" — while the ghost row on the same card said "counted with
    // everyone else — not on the board yet". Post-D98 the live board has
    // no floor; the pick is counted exactly, it is simply outside the top
    // ten. One card, two contradictory statements about the same pick.
    const expectNoBoundary = mountLive({ pickCard: true }, (l) => {
      l.votes["pick-fixture"] = "9731"; // not on the fixture's board
    });
    await growFeed();
    fireEvent.click(screen.getByRole("button", { name: /^Answered · 1$/ }));
    await awaitText(/Fixture pick card/);
    fireEvent.click(screen.getByText(PICK_PROMPT));
    await awaitText(/of 10 spots on the board claimed/);
    expect(
      screen.queryByText(/below the floor/i),
      "a live pick said it was below a floor the live board does not have",
    ).toBeNull();
    // Anchored: the ghost row's longer sentence also contains the phrase,
    // and this is about the TILE.
    expect(screen.getByText(/^not on the board$/)).toBeTruthy();
    // …and the card still says the true thing it always said, so this is
    // not one absence traded for another.
    expect(screen.getByText(/counted with everyone else — not on the board yet/)).toBeTruthy();
    expectNoBoundary("live feed, pick outside the board");
  });

  // Rank on a LIVE feed (D233): the whole loop through the real card —
  // tap the four items into an order, watch the completed ranking reach
  // the store, and read the reveal against the DERIVED crowd. The demo's
  // arrow into renderRankStats (a fabricated friends cohort) must be gone.
  it("ranks a live card by tapping, and reveals the derived crowd comparison", async () => {
    const expectNoBoundary = mountLive({ rankCard: true });
    await awaitText(/Fixture rank card/);
    for (const name of ["Alpha", "Gamma", "Beta", "Delta"]) {
      fireEvent.click(screen.getByRole("button", { name }));
    }
    // tapRank's completion dispatched LIVE.voteRank — the store holds the
    // joined order (fixture voteRank mirrors the real create-only write)
    expect(live.votes["rank-fixture"]).toBe("0,2,1,3");
    await awaitText(/You matched the crowd on/);
    // fixture crowd [1,3,2,4] against 0,2,1,3 — every position agrees
    expect(screen.getByText(/You matched the crowd on 4 of 4/)).toBeTruthy();
    // …AND WHICH CROWD. This was the only answered live card with no count
    // anywhere on it, so "the crowd" could have been one stranger. The
    // fixture aggregate holds 9 rankings and the viewer's own has just
    // been folded into it, so the crowd the order rests on is 8 — the
    // number `rankCrowd` computes and used to discard, not `agg.total`.
    expect(
      screen.getByText(/from 8 other rankings/),
      "the live rank card stated a match against a crowd it never sized",
    ).toBeTruthy();
    expect(
      screen.queryByText(/from 9 other rankings/),
      "the basis counted the viewer's own ranking as part of the crowd",
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /You matched the crowd/ }),
      "a live rank card offered the demo's stats sheet — its cohorts are fabricated",
    ).toBeNull();
    expectNoBoundary("live feed, rank card answered by tapping");
  });

  it("tells the first ranker they are first, instead of a crowd that is only them", async () => {
    const expectNoBoundary = mountLive({ rankCard: true, tooSmall: true }, (l) => {
      l.votes["rank-fixture"] = "3,2,1,0"; // answered on another device
    });
    await growFeed();
    fireEvent.click(screen.getByRole("button", { name: /^Answered · 1$/ }));
    await awaitText(/Fixture rank card/);
    fireEvent.click(screen.getByText(RANK_PROMPT));
    await awaitText(/order builds from here/);
    expect(screen.getByText(/You’re first — the crowd’s order builds from here/)).toBeTruthy();
    expect(screen.queryByText(/You matched the crowd on/)).toBeNull();
    expectNoBoundary("live feed, rank card first voter");
  });

  it("gives a live card who-voted and the named takes toggle — never the demo sheet", async () => {
    mountLive();
    voteFeedCardAndSettle();
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

  // D281 — the `i` on every feed card, and the slot behind it that was
  // empty in every live build.
  //
  // The button has always been there and has always opened a sheet; what
  // it had to say on a live card was the three rows (Asked in, Answers, On
  // your map), because the only source of a background paragraph was
  // `WORLD_BG` — a map keyed by DEMO question ids. So the two arms are
  // both worth pinning: with a background the button promotes itself and
  // the sheet leads with the paragraph, and without one the sheet is
  // exactly what it was, which is what stops this from becoming a field
  // every card has to carry.
  const openTheI = () => {
    const btns = screen.queryAllByRole("button", { name: /What you need to know/i });
    expect(btns.length, "no card offered the stronger `i` — the background never reached one").toBeGreaterThan(0);
    fireEvent.click(btns[0]);
  };

  it("opens a live card's background from the i, under its own heading", async () => {
    // The feed persists its votes to localStorage and this suite does not
    // clear it between cases, so an earlier case's vote parks this card
    // behind the Answered expander and the `i` is off screen — which fails
    // here as "the background never reached one" and, in the absence
    // assertions below, would pass vacuously instead.
    localStorage.clear();
    const expectNoBoundary = mountLive({ background: true });
    await growFeed();
    openTheI();
    expect(
      screen.getByText(BG_TEXT),
      "the sheet opened without the paragraph it exists to carry",
    ).toBeTruthy();
    // The heading is the promise the stronger ring makes — "About this
    // question" is the other arm, and a card with facts behind it must not
    // wear the label of one without.
    expect(screen.getAllByText(/What you need to know/i).length).toBeGreaterThan(0);
    expectNoBoundary("live feed, background sheet");
  });

  it("leaves a card with no background exactly as it was", async () => {
    localStorage.clear();
    const expectNoBoundary = mountLive();
    await growFeed();
    expect(
      screen.queryByRole("button", { name: /What you need to know/i }),
      "a card with no background wore the promoted `i`",
    ).toBeNull();
    const about = screen.queryAllByRole("button", { name: /About this question/i });
    expect(about.length, "the ordinary `i` went missing").toBeGreaterThan(0);
    fireEvent.click(about[0]);
    // The rows the sheet has always carried, and no paragraph above them.
    expect(screen.getByText(/^On your map$/)).toBeTruthy();
    expect(screen.queryByText(BG_TEXT)).toBeNull();
    expectNoBoundary("live feed, no background");
  });

  // THE VALUE, not just the label. The two assertions above have been green
  // this whole time and say only that a row headed "On your map" exists —
  // which stayed true while the value beside it was the constant
  // "Interests" for every live daily, whatever the subject.
  //
  // Why it was constant: the row read `S.region`, and `buildS` emits no
  // `region` at all on a live question — it is a field of the DEMO deck
  // literal in daily-split.jsx and of nothing else. `|| 'Interests'` then
  // fired for all 130 daily questions. 'Interests' is not a vague
  // catch-all either: it is one of the fourteen CAT_META branches, home to
  // 8 of the bank's questions, so the sheet named a real branch the answer
  // was not filed under.
  //
  // Same class as D296's `agg.tooSmall === false` — a reader testing a
  // field the live writer stopped producing (or never produced), failing
  // quietly into a plausible constant.
  it("names the branch the answer is actually filed under, not a constant", async () => {
    localStorage.clear();
    const expectNoBoundary = mountLive();
    await growFeed();
    fireEvent.click(screen.queryAllByRole("button", { name: /About this question/i })[0]);

    // nextElementSibling, not parentElement. The rows are flat key/value
    // spans in one grid, so a row's `parentElement` is the WHOLE sheet body
    // — written that way first, and the mutation run showed it: the failure
    // quoted "Asked inCultureAnswers25On your mapInterests", i.e. both
    // assertions were really asking "does the sheet contain Mind
    // anywhere". That still caught this bug and would miss the value
    // landing in the wrong row, which is the next mistake along.
    const valueOf = (label) =>
      screen.getByText(new RegExp(`^${label}$`)).nextElementSibling?.textContent || "";

    // The fixture's daily-000 carries branch "Mind" (live-fixture.ts).
    // Asserted as the REAL value rather than "not Interests", so a future
    // fixture change fails loudly instead of passing vacuously.
    const onMap = valueOf("On your map");
    expect(onMap, `"On your map" said "${onMap}"`).toBe("Mind");
    expectNoBoundary("live daily, About sheet branch");
  });

  // D306 — the daily's `i` carries the same background slot the feed's
  // got at D281, through buildS's bg carry (the field was seeded and the
  // feed read it while the daily deck dropped it). The no-background arm
  // is already pinned above: "leaves a card with no background" opens
  // this same sheet on the default fixture and finds only the rows.
  it("leads the daily's About sheet with its background when the question carries one", async () => {
    localStorage.clear();
    const expectNoBoundary = mountLive({ dailyBg: true });
    await growFeed();
    // The button promotes itself — D281's promise, kept here too: a card
    // with facts behind it must not wear the label of one without…
    fireEvent.click(screen.getAllByRole("button", { name: /What you need to know/i })[0]);
    // …and the sheet leads with the paragraph, the rows beneath it.
    expect(screen.getByText(DAILY_BG_TEXT)).toBeTruthy();
    expect(screen.getByText(/^On your map$/)).toBeTruthy();
    expectNoBoundary("live daily, background sheet");
  });

  // D284 — the learn bank left the JavaScript, and this is what proves the
  // live path picked it up.
  //
  // `spec/learn-data.js` used to import the whole of
  // content/learn-questions.json, so every card was compiled into the app
  // and a live build served them whatever the backend held. It carries a
  // fixed demo sample now and the live engine reads the seeded bank — so
  // the two arms below are the whole change: a live build serves the bank
  // it was given, and a live build given none serves none.
  //
  // Binding on the SAMPLE itself rather than a copied prompt, the D280
  // rule: the sample is generated from the bank, so a prompt transcribed
  // into this file would be a second copy to keep in step.
  const sampleLearnPrompts = () => LEARN_CARDS.map((c) => c.q);

  it("serves the bank's learn cards on a live feed, never the compiled-in sample", async () => {
    localStorage.clear();
    const expectNoBoundary = mountLive({ learnCard: true, feedCards: 24 });
    await growFeed();
    await awaitText(/Fixture learn card/);
    expect(screen.getByText(LEARN_CARD_PROMPT)).toBeTruthy();
    const body = document.body.textContent || "";
    const leaked = sampleLearnPrompts().filter((q) => q && body.includes(q));
    expect(
      leaked.slice(0, 3),
      "the live feed drew cards from the bundled demo sample",
    ).toEqual([]);
    expectNoBoundary("live feed, bank learn cards");
  });

  it("serves no learn card at all when the bank has none", async () => {
    // A project seeded before D284 carries learn documents with no answer
    // key, so the store drops every one and publishes an empty bank. Empty
    // has to mean empty: falling back to the sample would put sixty demo
    // cards on a real device, each with a "% got this right" line drawn
    // from an aggregate that does not exist.
    localStorage.clear();
    const expectNoBoundary = mountLive({ feedCards: 24 });
    await growFeed();
    const body = document.body.textContent || "";
    expect(
      sampleLearnPrompts().filter((q) => q && body.includes(q)).slice(0, 3),
      "an empty live learn bank fell through to the bundled sample",
    ).toEqual([]);
    expectNoBoundary("live feed, no learn bank");
  });

  // D280 — the defect this whole suite was supposed to make impossible,
  // and did not.
  //
  // The feed weaves each core test's own items in as marked cards. The
  // DEMO pool of those (spec/test-feed-data.js) carries option counts
  // synthesized from a hash of the question id, so a card totals somewhere
  // near ten thousand votes nobody cast. `buildFeedGlobals` replaced that
  // pool with the bank's items — until D249 converted the feed's read of
  // `window.TEST_FEED_QS` to a static import of the demo array and the
  // store's write became a cast nothing read. A live device then drew
  // invented splits under "politics test", and reported them.
  //
  // BINDING ON THE DEMO POOL ITSELF rather than on a hardcoded prompt: the
  // pool is derived from IS_TESTS at module load, so a prompt copied into
  // this file would be a second transcription to keep in step. The
  // assertion is the honest one either way — none of those cards may be on
  // a live screen, whichever instrument they came from.
  const demoTestPrompts = () => TEST_FEED_QS.map((q) => q.prompt);

  // feedCards: 24 rather than the default 1, and that number is the case
  // rather than a detail. The test stream fires on WORLD indices, so a
  // one-card feed has no slot to weave into and the assertion passes
  // against a feed that was never long enough to hold the defect. At 24 the
  // pre-fix tree leaks six, the first of them the item the owner
  // photographed ("Adults should be free to harm themselves if they
  // choose."). Measured in both directions before this was written down.
  it("serves no demo test card on a live feed, whatever the bank holds", async () => {
    // Cleared for this case's own sake: this asserts an ABSENCE, and a
    // leftover vote that parks cards behind the Answered expander would
    // satisfy it without the fix.
    localStorage.clear();
    const expectNoBoundary = mountLive({ feedCards: 24 });
    await growFeed();
    const body = document.body.textContent || "";
    const leaked = demoTestPrompts().filter((p) => p && body.includes(p));
    expect(
      leaked.slice(0, 3),
      "the live feed drew demo test cards — their counts are a hash of the question id (D1)",
    ).toEqual([]);
    expectNoBoundary("live feed, no demo test cards");
  });

  it("weaves the bank's own test item in, with the counts the aggregate published", async () => {
    localStorage.clear();
    const expectNoBoundary = mountLive({ testCard: true, feedCards: 24 });
    await growFeed();
    await awaitText(/Fixture test item/);
    const card = screen.getByText(TEST_ITEM_PROMPT).closest("div");
    expect(card, "the live test item never reached the feed").not.toBeNull();
    // Its five options, and no others — the demo pool's items share this
    // Likert set, so the prompt above is what tells them apart.
    TEST_ITEM_OPTIONS.forEach((label) => {
      expect(screen.getAllByText(label).length, `${label} missing from the live test card`).toBeGreaterThan(0);
    });
    expect(demoTestPrompts().filter((p) => p && (document.body.textContent || "").includes(p))).toEqual([]);
    expectNoBoundary("live feed, bank test item");
  });

  // The other half, and the one a launch actually opens on: a bank test
  // item nobody has answered. `noCountsYet` was the one field the test
  // mapping did not carry, so the card took the tiles path — a five-way
  // stack of zeroes, drawn as though the shares had been measured.
  it("draws no split on a bank test item nobody has answered yet", async () => {
    localStorage.clear();
    const expectNoBoundary = mountLive({ testCard: true, tooSmall: true, feedCards: 24 });
    await growFeed();
    await awaitText(/Fixture test item/);
    const card = screen.getByText(TEST_ITEM_PROMPT).closest("article, section, div");
    expect(within(card).queryByText(/\d+%/), "a zero-count test item published a share").toBeNull();
    expectNoBoundary("live feed, unanswered bank test item");
  });

  // D99's lens row, mounted on the Mirror's geographic stops — and since
  // D119 the row IS the stop's navigation, with Answers a peer tab rather
  // than the page the lenses hang under. D135 moved the landing tab to
  // Overview; D136 took the field out of the row entirely, so the row is
  // Answers plus the four lenses and the field draws above it. The row and
  // the lens bodies have their own suites; this is the wiring — that they
  // reach the real shell, through the spec layer's own render path, on
  // the live body that replaced the demo field.
  it("gives a live Mirror stop its lens tabs, closed until tapped", async () => {
    localStorage.clear();
    mountLive();
    fireEvent.click(screen.getByRole("button", { name: /^mirror$/i }));
    // The Mirror opens on You (the Map), which is not a population — the
    // lens row belongs to the geographic stops, so walk the ruler to City
    // (Near is presence-only since D111 and carries no lenses).
    fireEvent.click(screen.getByRole("tab", { name: "City" }));
    await openCity();
    // Five tabs. The row is static since D119 — the LENS BODIES are still
    // the lazy chunk, so unlike the old collapsed strip the navigation
    // itself is on screen from the first frame and getBy is safe.
    //
    // Scores joined at D100 — it was absent while this test read "the
    // bank ships no `rate` questions", which was true of the prototype's
    // place scorecard and not of the lens: the bank's `rating` and
    // `scale` items are ordinal and average fine.
    for (const name of ["Answers", "People", "Compare", "Scores"]) {
      expect(screen.getByRole("tab", { name }), `the row is missing its ${name} tab`).toBeTruthy();
    }
    // Explore is the WORLD's lens and this is the City stop (D152). Its
    // reading needs "everyone" as its baseline; at City it would compare a
    // slice of one city against that city. Asserted on the real mount for
    // the same reason the removals below are — the row is assembled from
    // two lists in two modules.
    expect(screen.queryByRole("tab", { name: "Explore" })).toBeNull();
    // Nothing is open at rest since D155 — the row is pinned to the bottom
    // and opens on a tap, which is the prototype's own behaviour.
    expect(screen.getByRole("tab", { name: "Answers" }).getAttribute("aria-selected")).toBe("false");
    // Neither of D136's two removals may come back as a tab: Overview is
    // the region above the row now, and Foresight left the Mirror. Asserted
    // on the real mount because the row is assembled from two lists in two
    // modules, and the unit suite only sees one of them at a time.
    expect(screen.queryByRole("tab", { name: "Overview" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "Foresight" })).toBeNull();
    // …and the field itself IS on screen, above the row, without a tap.
    expect(screen.getByRole("region", { name: "Overview" })).toBeTruthy();
    // Nothing loaded for a tab nobody opened — the cost gate, on the real
    // mount. People is the one that still carries it; the field's own fold
    // runs on arrival, which is D135's accepted price and D136 leaves
    // unchanged. Then the lens body arrives on the tap (findBy: its chunk).
    // "Kindred" since D152 — the section was headed "Most like you" while
    // it was a list of names; the prototype's name came back with the
    // prototype's shape.
    expect(screen.queryByText(/who answers most like you/i)).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "People" }));
    expect(await screen.findByText(/who answers most like you/i)).toBeTruthy();
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
    fireEvent.click(screen.getByRole("tab", { name: "City" }));
    await openCity();
    // Answers is a peer tab and no longer the landing one (D135).
    fireEvent.click(screen.getByRole("tab", { name: "Answers" }));

    // The fixture's two questions sit in different branches, so the chip
    // row offers both plus All.
    expect(screen.getByRole("button", { name: /^All 2$/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Mind 1$/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Most divisive" })).toBeTruthy();

    // The expander, both ways. Since D120 the FIRST row opens by default
    // (the prototype's behaviour — a tab that opens onto a closed list
    // reads as a table of contents), so this collapses it and re-opens it
    // rather than assuming a closed start. Asserting only that a click
    // sets aria-expanded=true would now pass against a row that was
    // already open and whose toggle does nothing.
    const row = screen.getByRole("button", { name: /Would you rather know/ });
    expect(row.getAttribute("aria-expanded"), "the first row did not open by default").toBe("true");
    fireEvent.click(row);
    expect(row.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(row);
    expect(row.getAttribute("aria-expanded")).toBe("true");

    // Filtering to one subject drops the other question's row.
    fireEvent.click(screen.getByRole("button", { name: /^Morals 1$/ }));
    expect(screen.queryByRole("button", { name: /Would you rather know/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Is a promise still binding/ })).toBeTruthy();
  });

  // Foresight's reachability case stood here from D126 until D136 took the
  // lens off the Mirror. It is DELETED rather than skipped, because what it
  // asserted was the one thing that is no longer true: that the game hangs
  // off a React.lazy inside another React.lazy and can be reached by
  // tapping a tab. There is no tab, so there is no path for a mount test to
  // walk, and a skipped case would read as a temporarily-broken feature
  // instead of a removed surface.
  //
  // What did NOT go with it: the engine (data/foresight.ts, its own suite),
  // the lens body (LiveForesightLens.test.tsx, which renders it directly and
  // still covers the clock and the scoring), and the verdict rules. The
  // moment Foresight gets its next placement — the feed, which is where the
  // prototype puts it and which D126 named as the open follow-on — this
  // case comes back pointed at that surface.

  // The Circle stop (D101). This one is worth a mount test more than most
  // of the row: the stop rendered an "isn't built yet" note for the whole
  // life of live mode, so "Circle shows something" and "Circle shows the
  // OLD something" look identical to any test that only checks it did not
  // crash. Both halves are asserted — the people, and the fold over them.
  it("draws the field, not a paragraph, on an empty Groups (D172)", async () => {
    // Every other stop draws its rings when it has nobody to place (D160).
    // Groups and Circle answered with a card of prose — and they are the
    // two a new account meets first, so they were the wordiest screens in
    // the app at exactly the moment it had least to say. Circle's own
    // empty arm is pinned in ui/LiveCircleBody.test.tsx, where the member
    // list can be emptied without fighting the app fixture (which ships a
    // circle of one on purpose).
    const expectNoBoundary = mountLive();
    fireEvent.click(screen.getByRole("button", { name: /^mirror$/i }));
    fireEvent.click(screen.getByRole("tab", { name: "Groups" }));
    await act(async () => { for (let i = 0; i < 60; i++) await Promise.resolve(); });
    // findBy, not getBy: this body became a React.lazy chunk at D190 (the
    // eager graph was 2 KB off its ceiling), so "the tab is open" and "the
    // body has rendered" are separated by a dynamic import whose duration
    // is the machine's — the same race Circle's case below documents, and
    // the same fix.
    expect(await screen.findByText(/revealed with names the morning after/i, {}, { timeout: 3000 })).toBeTruthy();
    expect(screen.queryByText(/No groups yet/i),
      "Groups still answers an empty stop with a headline").toBeNull();
    // The one action a field cannot fill by itself survives the trim.
    expect(screen.getByRole("button", { name: /Start a group/i })).toBeTruthy();
    expectNoBoundary("empty Groups");
  });

  it("draws the Circle stop from the follow graph, not the not-built note", async () => {
    localStorage.clear();
    mountLive();
    fireEvent.click(screen.getByRole("button", { name: /^mirror$/i }));
    fireEvent.click(screen.getByRole("tab", { name: "Circle" }));

    // The member, named — awaited, not slept for. The body is a
    // React.lazy chunk behind a null Suspense fallback (D101's bundle
    // deferral), so "the tab is open" and "the body has rendered" are
    // separated by a dynamic import whose duration is the machine's, not
    // the test's: a fixed 50 ms lost that race on CI while passing every
    // local run. findByText polls until the row exists or 3 s passes.
    // getAllBy: since D152 the stop draws its constellation above the
    // list, so a member with a likeness appears twice — once as a node,
    // once as a row. Both are her, and that IS the fix.
    expect((await screen.findAllByText(/Ada/, {}, { timeout: 3000 })).length).toBeGreaterThan(0);
    // The retired empty state, gone. AFTER the positive anchor on
    // purpose: against the null fallback this assertion is vacuously
    // true, so it only says something once the real body is in the DOM.
    expect(screen.queryByText(/aren.t built yet/i)).toBeNull();
    // THE READINGS ARE BEHIND THE STOP'S OWN ROW SINCE D190, which is what
    // every other Mirror stop does — so this walks the row rather than
    // reading a page. The tabs themselves are the first assertion: a stop
    // whose row failed to render would fail here rather than at a missing
    // percentage twenty lines on.
    expect(screen.getAllByRole("tab").map((t) => t.textContent))
      .toEqual(expect.arrayContaining(["Answers", "People", "Compare"]));

    fireEvent.click(screen.getByRole("tab", { name: "People" }));
    // The row's own mark, not the header's "1 of them follows you back".
    expect(screen.getByText(/^· follows you$/)).toBeTruthy();
    expect(screen.getByText("50%")).toBeTruthy();

    // And the fold: where the circle splits, counted over answerers. With
    // one member there is no split to draw — two answers is the floor for
    // one to mean anything — so the tab says which floor it is waiting on,
    // which is the same sentence the section used to carry under its
    // heading.
    fireEvent.click(screen.getByRole("tab", { name: "Answers" }));
    expect(screen.getByText(/Fills in once two of them answer the same question/i)).toBeTruthy();
  });

  // D98's payoff, in the only test that executes a render of it inside the
  // real app rather than in isolation. The panel test next to the
  // component covers its states; what this covers is that it is WIRED —
  // mounted from the who-voted sheet of a live card, on the real shell,
  // through the spec layer's own render path.
  //
  // D149 moved WHERE the names are. The sheet used to list every voter
  // under every cohort, "Everyone" included, with their age and city
  // printed beside them; it now answers cohorts in percentages and names
  // people on one cut — Friends. So this walks to that cut, which is also
  // the stricter path: it exercises the follow SET, the voter list and the
  // intersection of the two.
  it("names the friends who answered, in the who-voted sheet of a live card", async () => {
    // The feed persists its votes to localStorage, and installLive() does
    // not clear it — so the case above has already answered this card by
    // the time this one runs, and voteFeedCardAndSettle finds no option
    // button. Passes alone, fails in the file; cleared here rather than in
    // a shared beforeEach so the neighbouring cases keep the state they
    // were written against.
    localStorage.clear();
    mountLive();
    voteFeedCardAndSettle();
    const whoVoted = openWhoVoted();
    expect(whoVoted, "the live engage row did not render — this test is vacuous").not.toBeNull();
    fireEvent.click(whoVoted);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });

    // The cohort the sheet opens on names nobody. This is the D149 line
    // executed rather than asserted in source: the fixture's voters are
    // right there in the store, and the Everyone body must still be a
    // split rather than a directory of them.
    expect(screen.queryByText("Someone")).toBeNull();
    expect(document.body.textContent).not.toMatch(/25-34 · Oslo, NO/);

    // One tap to the cut where "who" is the question. The fixture follows
    // u_other, who answered — and does NOT follow the other voter, so the
    // intersection is doing real work here.
    const friends = screen.getByRole("button", { name: "Friends" });
    fireEvent.click(friends);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    // u_other has no display name in the fixture: "Someone" is the absence
    // of a name, not a pseudonym (D1), and it is the label that proves the
    // row rendered from a real uid.
    expect(screen.getByText("Someone")).toBeTruthy();
    expect(document.body.textContent).toMatch(/friend/i);
    expect(document.body.textContent).not.toMatch(/could not load how your friends answered/i);
  });

  // The control for the case above. Without it, that assertion passes for
  // any reason the engage row fails to render — a broken fixture included —
  // and stops being a statement about the gate at all.
  const voteFirstDemoCard = () => {
    const opt = screen.queryAllByRole("button", { name: /^(Yes|No|Agree|Disagree)$/i })[0];
    expect(opt, "no demo feed card to vote on").toBeDefined();
    fireEvent.click(opt);
    settleBeat();
  };

  it("offers no fabricated cut sheet on the live daily", async () => {
    // The daily's who-voted sheet builds every group row from
    // `this.hash(question + group + option)` (spec/daily-split.jsx) — the
    // prototype's deterministic mock, plausible and stable and entirely
    // invented — over cut chips (Job, Education, Where, four test cuts)
    // that no published aggregate carries.
    //
    // It is unreachable live, and this pins the reason rather than the
    // symptom: the whole engage row is gated on `!S.live`, so ungating it
    // to "give the daily a breakdown" without swapping in the LIVE panel
    // would ship fiction on the app's front door. The demo control below
    // is what stops this passing because the row stopped rendering.
    const expectNoBoundary = mountLive();
    const opts = await screen.findAllByRole("button", { name: /^(Yes|No|Both)$/ });
    fireEvent.click(opts[0]);
    await act(async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); });
    // Skip the consequence beat — the engage row renders only once it is
    // done (`st.beat !== S.id`), so asserting before this passes against a
    // screen that is still animating and proves nothing. Found by
    // mutation: ungating `!S.live` did NOT fail this case until the beat
    // was dismissed here.
    // settleBeat, not `if (beat)`. The harness's own note says why: a
    // conditional click degrades to a no-op the day the beat stops
    // mounting, and the assertions below then run against a screen that is
    // still animating — which is what this click exists to prevent, so the
    // case would pass while proving nothing.
    settleBeat();
    await act(async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); });
    // The DEMO row is what must stay gated. Its two markers: seeded
    // Comments, and the hash-built sheet's cut chips. "Who voted what" is
    // no longer one of them — since D171 that button exists live and opens
    // the real panel, which the case above pins.
    expect(screen.queryByRole("button", { name: "Comments" }),
      "the daily's seeded comments are reachable in live mode").toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Who voted what" }));
    await act(async () => { for (let i = 0; i < 60; i++) await Promise.resolve(); });
    // The markers are the chips the LIVE panel can never legitimately
    // grow: Where (live says City/Country) and Job (`profession` is free
    // text, deliberately not a dim — D8). Education stopped being one at
    // D304, when the live panel began offering every closed-vocabulary
    // dim as its whole scale.
    expect(screen.queryByRole("button", { name: /^Where$/ }),
      "a hash-built cut chip is reachable in live mode").toBeNull();
    expect(screen.queryByRole("button", { name: /^Job$/ }),
      "a hash-built cut chip is reachable in live mode").toBeNull();
    expectNoBoundary("live daily engage row");
  });

  it("gives the live daily the real breakdown, cohort-first", async () => {
    // D171. The daily had no breakdown at all in live mode while every
    // feed card under it had D125's — because its own sheet is the
    // prototype's hash-built mock and was suppressed rather than
    // replaced. It now opens ui/LiveBreakdownPanel, the same component
    // the feed uses, over the same aggregate the card already fetched.
    const expectNoBoundary = mountLive();
    const opts = await screen.findAllByRole("button", { name: /^(Yes|No|Both)$/ });
    const myLabel = opts[0].textContent.trim();
    fireEvent.click(opts[0]);
    await act(async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); });
    // settleBeat, not `if (beat)`. The harness's own note says why: a
    // conditional click degrades to a no-op the day the beat stops
    // mounting, and the assertions below then run against a screen that is
    // still animating — which is what this click exists to prevent, so the
    // case would pass while proving nothing.
    settleBeat();
    await act(async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); });

    const who = screen.getByRole("button", { name: "Who voted what" });
    fireEvent.click(who);
    await act(async () => { for (let i = 0; i < 60; i++) await Promise.resolve(); });

    // "Everyone" is the live panel's default cohort and its own word — the
    // demo sheet has no such chip, so this distinguishes the two rather
    // than merely proving something opened.
    expect(await screen.findByRole("button", { name: /Everyone/i })).toBeTruthy();
    // Your own pick is marked, and on the RIGHT side. This is the
    // end-to-end check on the `mine` prop: the daily passes an index into
    // its own options while the feed passes the store's numeric vote, and
    // the two agree only because a live question's option ids are
    // String(i) (data/deck.ts buildSPure). An off-by-one would mark the
    // other side and no type could catch it — so the row carrying "· you"
    // has to be the row for the option actually clicked.
    const marked = [...document.querySelectorAll("div")].filter(
      (d) => /· you/.test(d.textContent || "") && d.children.length <= 4,
    ).pop();
    expect(marked, "no option row carries the your-pick marker").toBeTruthy();
    expect(marked.textContent, "the your-pick marker sits on the wrong option")
      .toContain(myLabel);
    // And none of the demo cut chips, which name no published dim.
    expect(screen.queryByRole("button", { name: /^Where$/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Job$/ })).toBeNull();
    expectNoBoundary("live daily breakdown");
  });

  it("still renders the takes button on a demo card", async () => {
    render(<App />);
    voteFirstDemoCard();
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
    voteFirstDemoCard();
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
  // smoke-topics.test.jsx holds the demo control — the same sheet with both
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
    // Any population claim, not just the one string that shipped. The
    // sheet grew a channel list on 2026-08-12 (the other half of D96 — see
    // world-feed.jsx's renderAdd), and the whole point of that list is that
    // every number on it is counted rather than claimed, so the assertion
    // that used to be about one leaked row now covers the section too.
    expect(screen.queryByText(/\d+ people/), "a fabricated population came back").toBeNull();
    expect(screen.getByText("Learn")).not.toBeNull();
    expect(screen.getByRole("button", { name: "lots" })).not.toBeNull();
    // "Ask a question" since D288 §1 — the sheet's proposal path is the
    // paid door, and the button wears the door's own name. The header's
    // compose icon answers to the same accessible name, so the assertion
    // keys on the visible label: the sheet's door is the one with text.
    // INVERTED at D368, same reason as the profile case above.
    expect(
      screen.queryAllByRole("button", { name: /ask a question/i }),
      "the sheet still offers a purchase door",
    ).toHaveLength(0);
    expectNoBoundary("live add sheet");
  });

  // D167 rule 4 for Roles (D204). The tab is LIVE ONLY — it reads reveal
  // documents and the demo room has none — so the case that matters is
  // the one that proves the subtab exists at all in a live build, and
  // that it refuses rather than inventing when nothing clears the floor.
  //
  // The refusal IS the assertion here. Every other smoke-live case guards
  // against the demo cast reaching a live screen; this one guards against
  // the opposite failure, which Roles is uniquely exposed to: a role is
  // four numbers about a person, and four numbers are trivially
  // computable from one revealed day. The floor is the only thing
  // stopping a coin flip being drawn with a name on it.
  it("offers the Roles tab live, and refuses under the floor", async () => {
    const expectNoBoundary = mountLive({ feedCards: 2 });
    await growFeed();
    await openHeaderOverlay("profile");
    await act(async () => {});
    const roles = screen.queryByRole("button", { name: "Roles" })
      || screen.queryByText("Roles");
    expect(roles, "the Roles subtab is missing in a live build").not.toBeNull();
    fireEvent.click(roles);
    // The panel is behind a React.lazy boundary (profile-overlay is eager
    // and the eager budget had 4 KB left), so the assertion has to wait
    // for the chunk rather than for a render.
    await screen.findByText(/No 1v1 has 3 days you both guessed yet/);
    // The fixture has no rooms at all, so both instruments refuse — with
    // their floors named in the floor's own unit (days both guessed / days
    // you played, not "revealed days"), not with an empty rose.
    expect(screen.getByText(/No 1v1 has 3 days you both guessed yet/)).not.toBeNull();
    expect(screen.getByText(/No group has 2 revealed days you played yet/)).not.toBeNull();
    expectNoBoundary();
    // `window.__profileSub` remembers the last-visited subtab so returning
    // from a tracker lands back on it — and it lives on `window`, which
    // `localStorage.clear()` does not touch. Leaving it on "roles" put
    // every later case that opens the profile on this tab instead of
    // General; two of the D55 vitals cases failed exactly that way when
    // this was written. Cases that change it put it back.
    delete window.__profileSub;
  });

  // D167 rule 4 for the pulse roster (D203): mount live and assert the
  // real thing renders and the demo cast does not.
  //
  // The two failure modes this catches are both silent. (1) The roster is
  // read from `LIVE.pulseQs()` — the hydrated bank — so a regression that
  // went back to the demo furniture would draw "What pace was today?"
  // from DEMO_ROSTER and look identical until you read the prompt beside
  // it. The fixture's bank deliberately differs from the demo room. (2) A
  // pulse whose cadence does not ask today must not be on screen at all;
  // the fixture ships one daily and one weekly for exactly that contrast.
  it("draws the pulses the live bank offers, and only the ones due", async () => {
    const expectNoBoundary = mountLive({ feedCards: 2, anchors: { city: "Oslo, NO" } });
    await growFeed();
    // pace is daily — always due, always drawn, and its prompt comes from
    // the bank rather than from the demo roster.
    expect(screen.getByText("What pace was today?")).not.toBeNull();
    // sleep is weekly (Sundays). On any other day it must be absent —
    // no tray, no placeholder, nothing announcing what is not being asked.
    const sunday = new Date().getUTCDay() === 0;
    if (sunday) expect(screen.getByText("How did you sleep?")).not.toBeNull();
    else expect(screen.queryByText("How did you sleep?")).toBeNull();
    // The demo room's other three pulses are not in the live bank at all.
    expect(screen.queryByText("How clear was your head today?")).toBeNull();
    expect(screen.queryByText("How connected did you feel today?")).toBeNull();
    expectNoBoundary();
  });

  // D195: a paid question is an ordinary question wearing a disclosure it
  // cannot take off. The band is what the whole commercial path rests on,
  // so this asserts the two halves of it that a refactor could quietly
  // undo — the mark is THERE, and the topic chip it replaces is NOT.
  it("a sponsored live card wears the PAID band instead of its topic chip", async () => {
    const expectNoBoundary = mountLive({ feedCards: 4, sponsored: true, anchors: { city: "Oslo, NO" } });
    await growFeed();
    const band = screen.getByRole("button", { name: /^Paid, by Fixture Transit/ });
    expect(band).not.toBeNull();
    expect(within(band).getByText("PAID")).not.toBeNull();
    // The window is composed from `until`, so it is on screen unasked.
    expect(within(band).getByText(/until 1 Jan/)).not.toBeNull();
    // …and the card it sits on carries no topic chip — a paid card wearing
    // a topic hue reads as house content with a note attached.
    const card = band.closest("div").parentElement;
    expect(within(card).queryByText("culture")).toBeNull();
    // Why you got it, in the reader's own vocabulary, and what the buyer
    // gets — the post-D98 truth rather than the prototype's retired line.
    fireEvent.click(within(band).getByText("PAID"));
    expect(screen.getByText(/asked for City: Oslo, NO/)).not.toBeNull();
    expect(screen.getByText(/the same public numbers you do/)).not.toBeNull();
    expectNoBoundary("live feed, sponsored card");
  });

  it("a sponsored card whose tag does not match is not served at all", async () => {
    // The match runs on the DEVICE, against anchors the device already
    // holds — so a profile that does not carry the bought bucket never
    // sees the card, and the server was never asked who should. A profile
    // that has said NOTHING is a non-match too: absent is not "any".
    const expectNoBoundary = mountLive({ feedCards: 4, sponsored: true, anchors: { city: "Bergen, NO" } });
    await growFeed();
    expect(screen.queryByText("PAID")).toBeNull();
    // …and it does not fall back into the ordinary stream wearing a topic
    // chip, which would be the worst of both: delivered, and undisclosed.
    expect(screen.queryByText(/Fixture Transit/)).toBeNull();
    expectNoBoundary("live feed, unmatched sponsored card");
  });

  // D231: a current-events card wears its own deadline. The ring is the
  // one on-screen claim the window makes, so this pins both halves a
  // refactor could undo — the real one is drawn, and the decorative one
  // that reads the wall clock is not drawn on the same card.
  it("a windowed live card wears its ask window, and not the decorative clock", async () => {
    const expectNoBoundary = mountLive({ feedCards: 4, windowed: true });
    await growFeed();
    // Opens today, closes in three: four days left, whatever day this runs.
    const mark = screen.getByTitle("4 of 4 days left to answer");
    expect(mark).not.toBeNull();
    expect(within(mark).getByText("4d")).not.toBeNull();
    // …and the card keeps its topic chip, unlike a paid one — a window is
    // a fact about the question, not a disclosure that replaces it.
    const card = mark.closest("div").parentElement;
    expect(within(card).getByText(/^culture$/i)).not.toBeNull();
    // The decorative ring reads the wall clock, so it would print hours.
    expect(within(card).queryByText(/^\d+h$/)).toBeNull();
    expectNoBoundary("live feed, windowed card");
  });

  // D196: the reading game is gated on there being enough fair reads to
  // keep a record worth believing. The fixture's two questions are nowhere
  // near it, which is exactly the state a real launch is in — so the live
  // feed must show no game and no placeholder for one.
  it("shows no reading game while the corpus is too thin to score one", async () => {
    const expectNoBoundary = mountLive({ feedCards: 4 });
    await growFeed();
    expect(screen.queryByText("read the room")).toBeNull();
    expect(screen.queryByText(/Slices of everyone who answered/)).toBeNull();
    expectNoBoundary("live feed, reading game below the gate");
  });

  // The feed's ⓘ against the card it opens from. 08d48e5b fixed the
  // DAILY's sheet and its message said the feed's twin was already right;
  // that was true of the zero-guard half and not of the off-by-one.
  it("the feed's info sheet prints the same total as the card above it", async () => {
    // The feed persists its votes to localStorage and this suite does not
    // clear it between cases, so an earlier case has already answered this
    // card by the time this one runs — it parks behind the Answered
    // expander and the option button is gone. Passes alone, fails in the
    // file; cleared here rather than in a shared beforeEach so the
    // neighbouring cases keep the state they were written against.
    localStorage.clear();
    const expectNoBoundary = mountLive({});
    await awaitText(/Fixture feed card/);
    // Answer it here rather than seeding the vote: an already-answered
    // card parks behind the Answered expander, and the disagreement is
    // about the card you are looking at right after you vote.
    fireEvent.click(screen.getByText(FEED_OPTIONS[0]));
    await awaitText(/ votes/);
    const shown = /(\d[\d.K]*) votes/.exec(document.body.textContent);
    expect(shown, "the card is not printing a vote count — fixture changed").toBeTruthy();
    // [0] is the daily's, above the feed; [1] is the first feed card's —
    // the one just answered.
    fireEvent.click(screen.getAllByRole("button", { name: /About this question/i })[1]);
    expectNoBoundary("live feed, ctx sheet");
    expect(screen.getByText("Answers"), "the feed's info sheet did not open").toBeTruthy();
    expect(
      document.body.textContent,
      `the card says ${shown[1]} votes and its own info sheet disagrees`,
    ).toMatch(new RegExp("Answers\\s*" + shown[1].replace(".", "\\.")));
  });

  // D197: an ad is not a sponsored question. It rides the same single paid
  // slot and wears the same disclosure, and it must render as a CARD —
  // never through renderCard's question apparatus, which has nothing to
  // say about something that asks nothing.
  it("a live ad renders as a card, disclosed, with nothing to answer", async () => {
    const expectNoBoundary = mountLive({ feedCards: 4, adCard: true, anchors: { city: "Oslo, NO" } });
    await growFeed();
    const band = screen.getByRole("button", { name: /^Paid, by Fixture Transit/ });
    expect(band).not.toBeNull();
    expect(screen.getByText("Night buses now run until three.")).not.toBeNull();
    // No options, no vote — the question apparatus never ran on it.
    const card = band.closest("[data-screen-label='Ad']");
    expect(card).not.toBeNull();
    expect(within(card).queryByText("Gate holds")).toBeNull();
    expectNoBoundary("live feed, ad card");
  });

  it("an ad whose tag does not match is not served at all", async () => {
    const expectNoBoundary = mountLive({ feedCards: 4, adCard: true, anchors: { city: "Bergen, NO" } });
    await growFeed();
    expect(screen.queryByText("Night buses now run until three.")).toBeNull();
    expect(screen.queryByText("PAID")).toBeNull();
    expectNoBoundary("live feed, unmatched ad");
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
    // Past the feed's first mounted page (D136) — let the window finish.
    await growFeed();
    const lens = window.IS_LENSES[0];
    const q0 = lens.questions[0].q;
    // The prompt div is a direct child of the card root, so its parent
    // scopes every query to THIS card — nine world cards share their two
    // option labels, and 'Strongly agree' repeats on later lens cards.
    const card = screen.getByText(q0).parentElement;
    try {
      fireEvent.click(within(card).getByRole("button", { name: "Strongly agree" }));
      // A live lens card plays the consequence beat like any live card.
      //
      // OUTWAITED HERE AND SKIPPED EVERYWHERE ELSE, on purpose: this is the
      // one case that drives the rAF loop all the way to its own T5 and
      // lands `onDone` without a tap, so the animation's exit path keeps a
      // mount behind it. The other five click Skip (mount-app.jsx), which is
      // both faster and not a race.
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
  it("an unseeded live lens card records locally and shows no invented crowd", async () => {
    const expectNoBoundary = mountLive({ feedCards: 9, lensBank: false });
    // The lens card is interleaved past the feed's first mounted page
    // (D136), so let the window finish before reaching for it — the subject
    // here is the card, not the window.
    await growFeed();
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
    settleBeat();
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

// The feed dial's unit contract (D218), on the real mount. The store holds
// the 12-bucket INDEX for a continuum answer; the feed's local state holds
// the drag's own VALUE. The reconcile in componentDidMount used to copy
// the index over the value on every store notify — so a card answered
// "1 cups" on a 1–10 dial stood at "0 cups", off its own axis, and the
// mirror then persisted it. One case per door: the in-session clobber,
// the store-only fallback, and the residue a corrupted mirror still holds.
describe("the feed dial keeps the value you slid (D218)", () => {
  const DIAL_ID = "feed-fixture-dial";
  const DIAL_PROMPT = "How many fixture cups is too many?";
  const dialCard = () => ({
    id: DIAL_ID,
    cat: "culture",
    type: "dial",
    prompt: DIAL_PROMPT,
    lo: 1, hi: 10, unit: "cups",
    // live shape, as buildFeedGlobals emits it: 12 synthesized buckets
    // whose counts ARE the crowd — empty here, the viewer's own bucket
    // rides back in through dialDist
    options: Array.from({ length: 12 }, (_, i) => ({ label: `b${i}`, count: 0 })),
    n: 0,
    live: true,
  });
  const addDial = (prep) => (handle) => {
    window.WORLD_FEED_QS.push(dialCard());
    if (prep) prep(handle);
  };
  // jsdom's localStorage is shared across this file and the feed both
  // seeds from and persists to insight.feedVotes.v1 — start clean so no
  // earlier case decides what the dial (or the notify-by-voting card 0)
  // mounts as, and leave clean for the same reason.
  beforeEach(() => { localStorage.clear(); });
  afterEach(() => { localStorage.removeItem("insight.feedVotes.v1"); });

  it("the committed value survives the store's next notify", async () => {
    const expectNoBoundary = mountLive({}, addDial());
    await growFeed();
    const card = screen.getByText(DIAL_PROMPT).parentElement;
    const slider = within(card).getByRole("slider");
    // keyboard commit, because it is deterministic in jsdom: one step from
    // the middle is frac 0.5 + 1/9 → value 7 of 1–10, which quantizes to
    // bucket 8 — a pair the copy loop cannot tell apart from an edit.
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    fireEvent.keyDown(slider, { key: "Enter" });
    expect(within(card).getAllByText("7 cups").length).toBeGreaterThan(0);
    // Any later notify replays the reconcile — voting another card is the
    // cheapest real one. The old copy loop flipped the answer to "8 cups"
    // here: the bucket index wearing the value's clothes.
    act(() => { window.LIVE.vote("feed-fixture-0", "1"); });
    expect(within(card).getAllByText("7 cups").length).toBeGreaterThan(0);
    expect(within(card).queryByText("8 cups")).toBeNull();
    expectNoBoundary("feed dial after notify");
  });

  it("a store-only answer renders as its bucket's value, never its index", async () => {
    // Another device answered "1 cups" → optionIdx "0". This device has no
    // raw value, so the card claims bucket 0's midpoint (≈1.4 → "1 cups").
    // The pre-D218 reconcile copied the 0 in and the card said "0 cups" —
    // a value the 1–10 axis cannot even hold.
    const expectNoBoundary = mountLive({}, addDial((h) => { h.votes[DIAL_ID] = "0"; }));
    await growFeed();
    // A store notify replays the reconcile — without one this case passes
    // on the fallback alone and pins nothing about the copy loop, which is
    // exactly the door the cross-device report would come through.
    act(() => { window.LIVE.vote("feed-fixture-0", "1"); });
    // answered before this mount ever saw it, so the card parks behind the
    // Answered expander (D133) — open it to reach the render
    fireEvent.click(screen.getByRole("button", { name: /^Answered · 1$/ }));
    const card = screen.getByText(DIAL_PROMPT).parentElement;
    const you = within(card).getByText("you");
    expect(you.previousSibling.textContent).toBe("1 cups");
    expect(within(card).queryByText("0 cups")).toBeNull();
    expectNoBoundary("feed dial from store");
  });

  it("heals the residue a pre-D218 mirror still holds", async () => {
    // The reported device's exact state: the mirror kept the copied index
    // (0), the store holds bucket "0". The card must read the store, not
    // the residue — range is the tell, since 0 is off a 1–10 dial.
    const expectNoBoundary = mountLive({}, addDial((h) => {
      h.votes[DIAL_ID] = "0";
      localStorage.setItem("insight.feedVotes.v1", JSON.stringify({ [DIAL_ID]: 0 }));
    }));
    await growFeed();
    fireEvent.click(screen.getByRole("button", { name: /^Answered · 1$/ }));
    const card = screen.getByText(DIAL_PROMPT).parentElement;
    const you = within(card).getByText("you");
    expect(you.previousSibling.textContent).toBe("1 cups");
    expect(within(card).queryByText("0 cups")).toBeNull();
    expectNoBoundary("feed dial healed");
  });

  // D86 ON A CONTINUUM (2026-09-06). The store has taken a moved bucket
  // since D218 (setDial routes a repeat through editVote), but the
  // answered card drew only the curve and the "Change" door excluded dials
  // by name — so the owner, on a real device, could not change an answer
  // the rules already allowed them to. The door is the whole fix, and
  // these two cases are its two halves: the slider comes back at the
  // value you hold and letting go moves the bucket; a refused move snaps
  // back to the standing answer and says why.
  it("Change re-opens the slider at the answer you hold, and letting go moves it", async () => {
    // bucket 6 of a 1–10 dial shows as "6 cups" (dial-bucket.test.jsx
    // pins that the shown value re-buckets to 6)
    const expectNoBoundary = mountLive({}, addDial((h) => { h.votes[DIAL_ID] = "6"; }));
    await growFeed();
    fireEvent.click(screen.getByRole("button", { name: /^Answered · 1$/ }));
    const card = screen.getByText(DIAL_PROMPT).parentElement;
    // answered: the curve stands, the slider does not, and the door is there
    expect(within(card).queryByRole("slider")).toBeNull();
    fireEvent.click(within(card).getByRole("button", { name: "Change" }));
    const slider = within(card).getByRole("slider");
    // seeded at the standing answer, not at the middle of the range
    expect(slider.getAttribute("aria-valuenow")).toBe("6");
    expect(within(card).getByText("slide · let go to change")).toBeTruthy();
    // one step right of 6 on 1–10 is 7 (the step floors at one whole unit)
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    fireEvent.keyDown(slider, { key: "Enter" });
    // the bucket moved in the store — through editVote, since vote() is
    // create-only and would have left "6" standing
    const bucketOf7 = String(globalThis.WorldFeed.prototype.dialBucket(dialCard(), 7));
    expect(bucketOf7).not.toBe("6");
    expect(window.LIVE.myVotes()[DIAL_ID]).toBe(bucketOf7);
    // …and the card shows the new value as yours, slider gone, door back
    expect(within(card).queryByRole("slider")).toBeNull();
    expect(within(card).getByText("you").previousSibling.textContent).toBe("7 cups");
    expect(within(card).getByRole("button", { name: "Change" })).toBeTruthy();
    expectNoBoundary("feed dial changed");
  });

  it("a refused change snaps back to the answer that stands, and says why", async () => {
    const expectNoBoundary = mountLive({}, addDial((h) => { h.votes[DIAL_ID] = "6"; }));
    await growFeed();
    // the cooldown, as the store reports it: false, nothing sent
    const refuse = vi.spyOn(window.LIVE, "editVote").mockReturnValue(false);
    try {
      fireEvent.click(screen.getByRole("button", { name: /^Answered · 1$/ }));
      const card = screen.getByText(DIAL_PROMPT).parentElement;
      fireEvent.click(within(card).getByRole("button", { name: "Change" }));
      const slider = within(card).getByRole("slider");
      fireEvent.keyDown(slider, { key: "ArrowRight" });
      fireEvent.keyDown(slider, { key: "Enter" });
      expect(refuse).toHaveBeenCalledTimes(1);
      expect(window.LIVE.myVotes()[DIAL_ID]).toBe("6");
      // the standing answer, not the one the server never heard — and the
      // reason, in the slot the slider's instruction used
      expect(within(card).getByText("you").previousSibling.textContent).toBe("6 cups");
      expect(within(card).queryByText("7 cups")).toBeNull();
      expect(within(card).getByText("One change a minute — try again shortly.")).toBeTruthy();
      expectNoBoundary("feed dial refused");
    } finally {
      refuse.mockRestore();
    }
  });
});

// The field's door — the other half of D86 ON A CONTINUUM (2026-09-06).
// PR #413 opened "Change" for the dial and the field in one change and
// pinned the dial above; the owner's next report was the field ("Your
// phone — place it", answered, Takes beside it and no Change), from a
// build older than that merge. The field half had no case of its own, so
// this is it, in the dial's two halves: the plane takes a tap again with
// the dot you hold still drawn, and placing moves the cell through
// editVote; a refused move snaps the dot back to the standing cell's
// midpoint and says why. Keyboard placement, because it is deterministic
// in jsdom — a pointer tap divides by a zero-width rect.
describe("the feed field can be changed (D86 on a continuum)", () => {
  const FIELD_ID = "feed-fixture-field";
  const FIELD_PROMPT = "Fixture phone — place it";
  const fieldCard = () => ({
    id: FIELD_ID,
    cat: "culture",
    type: "field",
    prompt: FIELD_PROMPT,
    ax: ["a tool", "a limb"],
    ay: ["serves you", "runs you"],
    // live shape, as buildFeedGlobals emits it: 12 cells (4 across, 3
    // down) whose counts ARE the crowd — empty here, so the plane draws
    // no crowd dots and the only dots on it are the ones these cases place
    options: Array.from({ length: 12 }, (_, i) => ({ label: `c${i}`, count: 0 })),
    n: 0,
    live: true,
  });
  const addField = (prep) => (handle) => {
    window.WORLD_FEED_QS.push(fieldCard());
    if (prep) prep(handle);
  };
  beforeEach(() => { localStorage.clear(); });
  afterEach(() => { localStorage.removeItem("insight.feedVotes.v1"); });

  // the plane's accessible name carries its state: "— answered" while it
  // stands, the aim-and-place instruction while it takes a tap
  const plane = (card) => within(card).getByRole("button", { name: new RegExp("^" + FIELD_PROMPT) });
  // a dot is a span positioned in the plane's own percent units
  const dotAt = (card, x, y) => [...card.querySelectorAll("span")].find((s) => s.style.left === x + "%" && s.style.top === y + "%");

  it("Change re-opens the plane with your dot still drawn, and placing moves the cell", async () => {
    // cell 5 of 12 — second row, second column — stands at its midpoint
    // (37.5, 50): what a device with no raw point claims (fieldVal)
    const expectNoBoundary = mountLive({}, addField((h) => { h.votes[FIELD_ID] = "5"; }));
    await growFeed();
    fireEvent.click(screen.getByRole("button", { name: /^Answered · 1$/ }));
    const card = screen.getByText(FIELD_PROMPT).parentElement;
    expect(plane(card).getAttribute("aria-label")).toMatch(/answered$/);
    expect(dotAt(card, 37.5, 50), "the standing dot is not at its cell's midpoint").toBeTruthy();
    fireEvent.click(within(card).getByRole("button", { name: "Change" }));
    const p = plane(card);
    expect(p.getAttribute("aria-label")).toMatch(/Arrow keys to aim/);
    // what you are moving stays on screen while you move it
    expect(dotAt(card, 37.5, 50)).toBeTruthy();
    // aim one step right of centre and place: (54, 50) is cell 6
    fireEvent.keyDown(p, { key: "ArrowRight" });
    fireEvent.keyDown(p, { key: "Enter" });
    // the cell moved in the store — through editVote, since vote() is
    // create-only and would have left "5" standing
    expect(window.LIVE.myVotes()[FIELD_ID]).toBe("6");
    expect(dotAt(card, 54, 50), "the dot did not move to where it was placed").toBeTruthy();
    expect(dotAt(card, 37.5, 50)).toBeUndefined();
    // …and the card stands again: plane answered, door back, no complaint
    expect(plane(card).getAttribute("aria-label")).toMatch(/answered$/);
    expect(within(card).getByRole("button", { name: "Change" })).toBeTruthy();
    expect(within(card).queryByText("One change a minute — try again shortly.")).toBeNull();
    expectNoBoundary("feed field changed");
  });

  it("a refused change snaps the dot back to the cell that stands, and says why", async () => {
    const expectNoBoundary = mountLive({}, addField((h) => { h.votes[FIELD_ID] = "5"; }));
    await growFeed();
    // the cooldown, as the store reports it: false, nothing sent
    const refuse = vi.spyOn(window.LIVE, "editVote").mockReturnValue(false);
    try {
      fireEvent.click(screen.getByRole("button", { name: /^Answered · 1$/ }));
      const card = screen.getByText(FIELD_PROMPT).parentElement;
      fireEvent.click(within(card).getByRole("button", { name: "Change" }));
      const p = plane(card);
      fireEvent.keyDown(p, { key: "ArrowRight" });
      fireEvent.keyDown(p, { key: "Enter" });
      expect(refuse).toHaveBeenCalledTimes(1);
      expect(window.LIVE.myVotes()[FIELD_ID]).toBe("5");
      // the standing cell's midpoint, not the point the server never heard
      expect(dotAt(card, 37.5, 50), "the refused point stood instead of the standing cell").toBeTruthy();
      expect(dotAt(card, 54, 50)).toBeUndefined();
      expect(plane(card).getAttribute("aria-label")).toMatch(/answered$/);
      expect(within(card).getByText("One change a minute — try again shortly.")).toBeTruthy();
      expectNoBoundary("feed field refused");
    } finally {
      refuse.mockRestore();
    }
  });
});

// The learn reveal's crowd share is a BAR under the label, never a lit
// row (2026-09-06). Each wrong option carried the crowd's share as a wash
// filling the row's height to the share's width — which at a share near
// 100% is a filled row with no edge showing. The owner's device drew
// "Zanzibar City" filled edge to edge beside the Dodoma they had answered
// correctly, and read it as having answered wrong: a filled row beside a
// solid correct one is a verdict, not a bar. The share is a strip along
// the row's bottom edge now, so a share of 100% is a full-width bar and
// the row keeps its surface.
describe("the learn reveal draws the crowd's share as a strip, not a lit row", () => {
  beforeEach(() => { localStorage.clear(); });

  it("a wrong option holding the whole crowd is a bar under its label, with no mark", async () => {
    const expectNoBoundary = mountLive({ learnCard: true, feedCards: 24 }, (h) => {
      // Every fixture card's crowd: one first try, on the option AFTER the
      // correct one (the fixture authors c = i % 4) — the owner's shape,
      // one card at a time. Defined onto the fixture's store the way the
      // fixture defines its own members, so restore() puts the real
      // descriptor back.
      Object.defineProperty(h.LIVE, "learnAgg", {
        value: (id) => {
          const m = /^fixlearn(\d+)$/.exec(id);
          if (!m) return null;
          const c = (Number(m[1]) - 1) % LEARN_CARD_OPTIONS.length;
          return { tooSmall: false, total: 1, counts: { [String((c + 1) % LEARN_CARD_OPTIONS.length)]: 1 } };
        },
        writable: true, configurable: true, enumerable: true,
      });
    });
    await growFeed();
    await awaitText(/Fixture learn card/);
    // whichever fixture card the scheduler served first: its number says
    // which option is authored correct and how its labels are suffixed
    const prompt = screen.getAllByText(/^Fixture learn card/)[0];
    const n = Number((/\((\d+)\)$/.exec(prompt.textContent || "") || [0, "1"])[1]);
    const c = (n - 1) % LEARN_CARD_OPTIONS.length;
    const label = (i) => LEARN_CARD_OPTIONS[i] + (n > 1 ? ` ${n}` : "");
    const card = prompt.parentElement;
    fireEvent.click(within(card).getByRole("button", { name: label(c) }));
    // answered right: the tick is on the row you tapped, and that row
    // carries no share bar — its number says it
    const right = within(card).getByRole("button", { name: new RegExp("^" + label(c)) });
    expect(right.textContent).toContain("\u2713");
    expect(right.querySelector("[data-know-share]")).toBeNull();
    // the crowd's option carries its share as a strip along the bottom
    // edge — full width, a few pixels tall, the row's own height untouched
    const wrong = within(card).getByRole("button", { name: label((c + 1) % LEARN_CARD_OPTIONS.length) });
    const share = wrong.querySelector("[data-know-share]");
    expect(share, "the crowd's share is not drawn on the option they picked").toBeTruthy();
    expect(share.style.width).toBe("100%");
    expect(share.style.bottom).toBe("0px");
    expect(share.style.top, "the share fills the row — a lit row beside a correct one reads as a wrong pick").toBe("");
    expect(parseFloat(share.style.height)).toBeGreaterThan(0);
    expect(parseFloat(share.style.height)).toBeLessThanOrEqual(6);
    // …and no verdict mark on it: the cross is yours alone
    expect(wrong.textContent).not.toContain("\u2715");
    expectNoBoundary("live learn reveal, the crowd on a wrong option");
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

  async function openProfile() {
    await openHeaderOverlay("profile");
  }

  // jsdom's localStorage is shared across cases in this file, and the panel
  // persists on mount — so without this, case order decides what case two
  // reads. (Case two failed exactly that way when it was written.)
  beforeEach(() => { localStorage.clear(); });

  it("shows no demo vitals on a reopened profile, and anchors none", async () => {
    const saved = [];
    live = installLive();
    window.LIVE.saveAnchors = (a) => { saved.push(a); };
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // First open — writes the localStorage record that used to poison the
    // second one.
    const first = render(<App />);
    await openProfile();
    expect(screen.queryByDisplayValue(DEMO_JOB)).toBeNull();
    first.unmount();

    // Second open, same device, same storage.
    render(<App />);
    await openProfile();
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

  it("drops the v1 record's demo values but keeps what the user changed", async () => {
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
    await openProfile();

    expect(saved.length, "the anchors effect never ran — assertion is vacuous")
      .toBeGreaterThan(0);
    const last = saved[saved.length - 1];
    expect(last.profession, "the migration dropped a value the user had changed").toBe("Baker");
    expect(last.education, "a demo value survived the migration").toBe("");
    // The old key is retired, so the migration cannot run a second time and
    // re-seed what the user has since cleared.
    expect(localStorage.getItem("insight.profileGeneral.v1")).toBeNull();
  });

  // ── the same write, pointed at a SECOND device ──
  //
  // The two cases above are about a demo persona reaching a live account.
  // These two are the reverse and were live for as long: the live branch of
  // `baseFor` returned `{ vitals: {} }`, which is not "no opinion" but a
  // complete profile whose every field is blank, and the effect above writes
  // the map derived from it WHOLESALE. So opening the profile on a phone
  // that had never seen the panel erased the anchors the laptop wrote — and
  // because answers are create-only (D5), every answer written after that
  // carried no cohort and none of them can be corrected.
  const ACCOUNT = {
    age: "29", ageBand: "25-34", gender: "Woman",
    city: "Oslo, NO", country: "NO",
    education: "MA Literature", profession: "Baker", jobField: "Food & hospitality",
    relationship: "Single", heightBand: "170–179 cm",
  };

  it("seeds a fresh device from the account's own anchors instead of blanking them", async () => {
    const saved = [];
    live = installLive({ anchors: ACCOUNT });
    window.LIVE.saveAnchors = (a) => { saved.push(a); };
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // No local blob at all — a device that has never opened the panel. This
    // is the ordinary second-device path, not a race.
    render(<App />);
    await openProfile();

    expect(saved.length, "the anchors effect never ran — assertion is vacuous")
      .toBeGreaterThan(0);
    const last = saved[saved.length - 1];
    expect(last.profession, "a second device erased the account's profession").toBe("Baker");
    expect(last.education, "a second device erased the account's education").toBe("MA Literature");
    expect(last.city, "a second device erased the account's city").toBe("Oslo, NO");
    expect(last.ageBand, "a second device erased the account's age band").toBe("25-34");
  });

  it("refuses the wholesale write while the profile doc is still hydrating", async () => {
    // The seed above cannot close this one: `useState(loadGen)` runs exactly
    // once, so a panel that mounts before `v2_users/{uid}` has landed seeds
    // from an empty map however good the seeding rule is.
    //
    // KEYED ON THE PANEL'S OWN READ, not on call order. The first version of
    // this case answered {} to the first `anchors()` read and the account map
    // to the rest — and it PASSED WITH THE GUARD REMOVED, which is how the
    // stack sniff below earned its ugliness. Three other consumers read the
    // anchors before the profile panel does (WorldFeed thrice), so a counter
    // hands `baseFor` the hydrated map and the race window is never entered.
    // Naming `baseFor` says exactly what is being reproduced: the doc has not
    // landed when the panel seeds, and has by the time the effect runs one
    // commit later — which is what hydrating a microtask late looks like from
    // here. It fails loudly if `baseFor` stops reading the anchors, which is
    // the right way for it to break.
    const saved = [];
    live = installLive({ anchors: ACCOUNT });
    let seeded = false;
    window.LIVE.anchors = () => {
      if ((new Error().stack || "").includes("baseFor")) { seeded = true; return {}; }
      return { ...ACCOUNT };
    };
    window.LIVE.saveAnchors = (a) => { saved.push(a); };
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<App />);
    await openProfile();

    expect(seeded, "the panel never seeded from an empty map — the race is not reproduced")
      .toBe(true);
    const blanked = saved.filter((a) => Object.values(a).every((v) => !v));
    expect(blanked.length, "the hydrate race blanked the account's anchors").toBe(0);
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
    // the demo suites do not inherit an emptied object.
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

  it("gives Work the cohort's own value beside the profile's, and falls back where there is none", () => {
    // D328 made the Work dim the derived `jobField`, so the sentence that
    // carries a number about "people in your line of work" must name the
    // FIELD — naming the profession reads as a cohort of carpenters. The
    // row keeps the profession as the value it headlines, which claims no
    // cohort, and carries the field as `self` for the sentence that does.
    live = installLive({ anchors: { profession: "Carpenter", jobField: "Trades, construction & manufacturing" } });
    hydrateTestResults({});
    const job = anchorList().find((r) => r.id === "job");
    expect(job, "the Work anchor vanished").toBeTruthy();
    expect(job.value).toBe("Carpenter");
    expect(job.self).toBe("Trades, construction & manufacturing");

    // …and a profile written before D328 has no derived field at all, so
    // the row falls back to the profession rather than to an empty "you:".
    live.restore();
    live = installLive({ anchors: { profession: "Carpenter" } });
    hydrateTestResults({});
    const old = anchorList().find((r) => r.id === "job");
    expect(old.self, "a pre-D328 profile lost its side of the sentence").toBe("Carpenter");
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
    // 7: age/job/education plus one row per test, and the demo persona has
    // a result for all four. It was 8 for the two days `cognitive` had both
    // a bank and an anchor row — D103 retired the test, and the anchor went
    // with it rather than lingering as a row whose value is always ''.
    expect(ring.length).toBe(7);
    for (const demo of DEMO_RING) {
      expect(ring.some((r) => r.value === demo || r.value.startsWith(demo)))
        .toBe(true);
    }
  });

  it("hides the profile's map card while the ring is empty", async () => {
    // The wiring half: list() is only correct if what renders reads it.
    // MapThumbCard returns null on a zero-length ring.
    live = installLive();
    hydrateTestResults({});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<App />);
    await openProfile();
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

  // The OTHER half of the same gate. `age` refuses because the viewer's
  // age band cannot answer for a cohort that has not answered; 'all' is
  // not a cohort at all — it is everyone, and the question's own published
  // counts are exactly that.
  //
  // It used to fall through to the anchor lookup, find no 'all' in
  // MAP_ANCHOR_DIM and return null, and the Map's constellation builder
  // substituted `typ = 0.5` and `maj = true` for EVERY answer. So on a
  // live build every dot sat at the same radius from you and the "rare
  // take" mark could never render for anybody — the fabrication D72's null
  // exists to prevent, done by the consumer instead of the source.
  it("answers for EVERYONE from the published counts, and still refuses a cohort", () => {
    live = installLive();
    // The fixture publishes counts { 0: 12, 1: 8, 2: 5 } — 25 answers.
    const all = window.MapStats.dist("daily-000", "all", 3, 0);
    expect(all, "'all' still refuses — every Map dot is fabricated").not.toBeNull();
    expect(all.reduce((a, b) => a + b, 0)).toBe(100);
    // Real, and in the counts' own order: 12 > 8 > 5.
    expect(all[0]).toBeGreaterThan(all[1]);
    expect(all[1]).toBeGreaterThan(all[2]);
    // The mode reads off the same array, so it is real too.
    expect(window.MapStats.mode("daily-000", "all", 3, 0)).toBe(0);
    // …and the cohort anchor still refuses, which is the half that must
    // not have been widened by this.
    expect(window.MapStats.dist("daily-000", "age", 3, 0), "the cohort gate was widened too")
      .toBeNull();
  });

  // WHICH OPTION THE GROUP CHOSE, off the counts rather than off the
  // rounded percentages.
  //
  // sharePcts guarantees no inversion — a smaller count never draws larger
  // — and the ridge's bar heights rest on that. It does not guarantee
  // distinctness: two different counts can print the same integer, and
  // `indexOf(max)` then breaks the real tie by INDEX. That decided the Map
  // card's "most chose N" and its "you're with the majority" / "a minority
  // take" verdict — the same defect the feed's own line had.
  it("the daily's vote count includes YOUR vote — the one add-back nothing held", async () => {
    // countsFor (data/deck) subtracts the viewer's own vote out of the
    // published aggregate and delegates the add-back to a single line in
    // daily-split.jsx, saying so: "the UI layer adds its own +1 for you".
    // Nothing pinned that line. Neutering it — `count + 0 * (…)` — leaves
    // the whole unit suite green while the card, its split and its
    // Answers row each drop a vote, which is the reader's own.
    //
    // Absolute, not self-consistent: the sibling case that opens the info
    // sheet asserts the card and the sheet AGREE, and they agree just as
    // well when both are one low.
    mountLive();
    act(() => { live.LIVE.vote("daily-000", "1"); });
    await awaitText(/ votes/);
    const shown = /(\d+) votes/.exec(document.body.textContent);
    expect(shown, "the daily is not printing a vote count — fixture changed").toBeTruthy();
    // The fixture's daily publishes 12 + 8 + 5 = 25, none of them yours,
    // so the card must read 26. Checked against the fixture's own numbers
    // rather than a literal 26 alone, so a fixture change moves the
    // expectation with it instead of silently making the case vacuous.
    const published = FIXTURE_DAILY_COUNTS.reduce((a, b) => a + b, 0);
    expect(published, "the fixture's daily counts changed").toBe(25);
    expect(Number(shown[1]), "the viewer's own vote is missing from the count")
      .toBe(published + 1);
  });

  it("the group's mode follows the votes, not the rounding", () => {
    live = installLive({
      aggCounts: { 0: 449, 1: 451, 2: 100 },
    });
    const all = window.MapStats.dist("daily-000", "all", 3, 0);
    // Both leaders draw the SAME integer — this is the case that used to
    // decide by index. If the fixture ever stops producing it, the
    // assertion below stops proving anything, so it is checked.
    expect(all[0], "the fixture no longer produces a rounding tie").toBe(all[1]);
    // …and the answer is still the one with more votes.
    expect(window.MapStats.mode("daily-000", "all", 3, 0)).toBe(1);
  });

  // The Map DOT's own reading of the same tie. `dc099bd7` taught MapStats
  // to answer 'all', which is what put a real number behind every dot —
  // and in doing so it brought a line that had been dead to life with the
  // rounding-tie defect still in it: while 'all' refused, `gd` was always
  // null there and `maj` was hard-coded true. So the fix activated the
  // bug, in the block it edited.
  //
  // `maj` decides `is-rare` on the dot and "a rare take" in the card, so
  // on a tie the person who picked the option with MORE votes had their
  // answer marked as the rare one.
  it("the Map dot's majority reading follows the votes, not the rounding", () => {
    live = installLive({ aggCounts: { 0: 449, 1: 451, 2: 100 } });
    const d = window.MapStats.dist("daily-000", "all", 3, 1);
    // The rounding tie is really there — otherwise the case proves nothing.
    expect(d[0], "the fixture no longer produces a rounding tie").toBe(d[1]);
    // Reading it the way the constellation used to.
    expect(d.indexOf(Math.max(...d))).toBe(0);
    // …and the way it reads now: option 1 has 451 votes.
    expect(window.MapStats.mode("daily-000", "all", 3, 1)).toBe(1);
  });

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

  // The daily's ⓘ sheet, which opens BEFORE you answer — that is what it is
  // for. It summed the raw option counts on its own, without the viewer's
  // own vote that the card a tap behind it includes, and it pushed the
  // Answers row unconditionally. So the first person to answer today saw
  // "1 vote" on the card and "Answers 0" in the sheet: a false zero on a
  // live surface, contradicting the card it opened from. The feed's twin
  // has always guarded the same row.
  it("the daily's info sheet omits the answer count rather than printing a zero", () => {
    const expectNoBoundary = mountLive({}, (l) => {
      // A live question nobody has answered yet: the deck is real, the
      // aggregate holds nothing.
      l.LIVE.deck = () => [{
        id: "daily-000", cat: "culture", text: "Would you rather know, or be known?",
        options: [{ id: "a", label: "Know", count: 0 }, { id: "b", label: "Be known", count: 0 }],
        comments: [], friends: [],
      }];
    });
    // The daily card's own ⓘ is the FIRST — the feed below has one per card.
    fireEvent.click(screen.getAllByRole("button", { name: /About this question/i })[0]);
    expectNoBoundary("daily/live/ctx-sheet");
    // The sheet's own rows are the proof it opened — "On your map" is the
    // one that always draws, whatever the counts say.
    expect(screen.getByText("On your map"), "the info sheet did not open").toBeTruthy();
    expect(screen.getByText("Asked in")).toBeTruthy();
    expect(
      document.body.textContent,
      "a live question with no answers printed a zero count",
    ).not.toMatch(/Answers\s*0(?!\d)/);
  });

  // The card's `self` — "you: …" — had two shapes reaching it and handled
  // one. map-anchors.js builds the demo row as `age {n}` ("age 34") and the
  // LIVE row as `age {ageBand}` ("age 25-34"); mtAnchorSelf stripped every
  // non-digit and parsed the rest as a single number, so a band came out as
  // parseInt("2534") → "2530–2539". A decade nobody is in, on the default
  // anchor of the card, which is the first thing a tapped answer says.
  //
  // Rendered in DEMO mode deliberately: live mode refuses the whole verdict
  // (D72), so the string under test only draws here — which is exactly why
  // the two cases above could both pass while it was wrong.
  it("prints the age band the profile holds, not a decade built from its digits", () => {
    const { container } = render(
      <window.MTAnswerCard node={ANSWER_NODE} cat={null}
        anchors={[{ id: "age", label: "Age", hue: 265, value: "age 25-34" }]}
        activeA="age" onFilter={() => {}} />,
    );
    expect(container.textContent, "the band the profile actually holds is missing")
      .toMatch(/25-34/);
    expect(container.textContent, "a decade was invented out of the band's digits")
      .not.toMatch(/2[0-9]{3}\s*–/);
  });

  // The anchor card's own empty state. `noCohort` is `rows.some(...)`,
  // which is FALSE on an empty list, so a map with no answers on it fell
  // through to the arithmetic and drew "0% of your answers match people
  // your age" — plus, because `diffs` was empty too, "You answered like
  // most of them on every question." Two claims that contradict each
  // other, about somebody who has answered nothing.
  //
  // Reachable on a fresh live account that set an age in Basics: the
  // anchor ring is laid out independently of the answer nodes, so the card
  // opens with `items` empty.
  it("says nothing about matching when there is nothing on the map", () => {
    const { container } = render(
      <window.MTAnchorCard
        anchor={{ id: "age", label: "Age", hue: 265, value: "age 25-34" }}
        items={[]} onPick={() => {}}
        anchors={[{ id: "age", label: "Age", hue: 265, value: "age 25-34" }]}
        onAnchor={() => {}} />,
    );
    expect(container.textContent, "a percentage was drawn for an empty map")
      .not.toMatch(/\d+\s*%\s*of your answers/);
    expect(container.querySelector(".mmt-matchbar"), "the match bar was drawn")
      .toBeNull();
    expect(container.textContent, "an empty map claimed you agreed on everything")
      .not.toMatch(/like most of them on every question/);
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

  it("fetches the people its percentiles count over, on a live build only", async () => {
    // The card's counted numbers — the percentile line, the rarity field —
    // are folds over LIVE.kindredPeople(), and nothing else on this screen
    // fills that pool. It arrived as a side effect of any place stop's
    // loadSimilarity until 2026-08-31 scoped that fan-out to the surfaces
    // that read it and missed this one, so a viewer who opened World but
    // never City lost the numbers with nothing said.
    live = installLive();
    hydrateTestResults(BIG5_RESULT);
    const asked = vi.fn(async () => {});
    live.LIVE.loadKindred = asked;
    render(<window.ResultProfileCard testKey="big5" />);
    await act(async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); });
    expect(asked, "the card counts over people it never asked for").toHaveBeenCalled();
  });

  it("asks for nobody in demo mode, where the numbers are authored", async () => {
    // The control, and it is the half that keeps the case above honest: an
    // effect with no gate would also satisfy that one. The demo build's
    // rarity and percentile come from the authored curve, so a fetch here
    // would be a bill for a number it does not use.
    //
    // THROUGH THE HANDLE, not through `window.LIVE`. Written as
    // `window.LIVE = { ...window.LIVE, enabled: false }` this case passed
    // with the gate deleted — result-card.jsx does `import LIVE from
    // '../data/live'`, so replacing the global leaves the binding the
    // component actually reads untouched. installLive redefines members on
    // the REAL store, which is why setting them on `live.LIVE` reaches it.
    live = installLive();
    hydrateTestResults(BIG5_RESULT);
    const asked = vi.fn(async () => {});
    live.LIVE.loadKindred = asked;
    live.LIVE.enabled = false;
    render(<window.ResultProfileCard testKey="big5" />);
    await act(async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); });
    expect(asked, "the demo build paid for a crowd it does not count over").not.toHaveBeenCalled();
  });

  // ── the same effect, under the shell that re-renders on its notify (D364) ──
  //
  // The fetch the case above pins is also a hazard. The real loadKindred
  // notifies in its `finally`, app-shell re-renders on every notify
  // (`liveTick`), and the profile overlay re-renders with it — so the card
  // has to ride that re-render as an UPDATE. Until 2026-09-05 the overlay
  // defined its four result panels inside its own render body (`const
  // Big5Panel = () => <ResultProfileCard …/>`), which is a new component
  // type on every render, which React treats as an unmount and a fresh
  // mount. The mount effect re-ran, notified, and re-ran. Every reveal
  // animation on the card restarted on each pass — a restarted petal sits
  // at its `from` frame, scale 0.12 and opacity 0, so the rose drew EMPTY
  // while it shook — paced by the network while the voter lists landed,
  // then as fast as React could commit once they were cached and the
  // loader ran synchronously, until the WebView died. Reported from a
  // device on the Big 5 and Politics tabs as "the bars and charts vibrate
  // faster and faster, then the app crashes".
  //
  // Mounted through the WHOLE app, because the loop needs the shell's
  // subscriber: the card rendered alone (the cases above) has no parent to
  // re-render it, so it cannot see this.
  describe("survives the notify its own loader sends (D364)", () => {
    afterEach(() => { delete window.__profileSub; });

    it("mounts the card once under a shell that re-renders on every notify", async () => {
      // The loader as the real one behaves: it notifies when it lands.
      // Through the fixture's `vote`, which is its notify path (each call
      // fans out to every subscriber, liveTick included), on a fresh qid
      // each time because vote() is one answer per question. CAPPED, so
      // the failure mode is a count and not a hung suite — measured on the
      // pre-fix overlay: nine calls, one per cap-bounded remount.
      let n = 0;
      const asked = vi.fn(async () => { if (n < 8) live.LIVE.vote(`d364-${n++}`, "1"); });
      const expectNoBoundary = mountLive({}, (l) => {
        hydrateTestResults(BIG5_RESULT);
        l.LIVE.loadKindred = asked;
        // The subtab is remembered on `window`, and reading it is how the
        // overlay opens anywhere but General.
        window.__profileSub = "big5";
      });
      await openHeaderOverlay("profile");
      await act(async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); });
      const rose = screen.getByRole("img", { name: /Trait scores as petals/ });
      expect(asked, "the card re-mounted on its own loader's notify").toHaveBeenCalledTimes(1);
      // And a notify from anywhere else — an aggregate landing, a vote —
      // must leave the card's DOM in place: a remount is a new <svg>, and
      // a new <svg> is every petal animation starting over.
      act(() => { live.LIVE.vote("d364-elsewhere", "1"); });
      expect(screen.getByRole("img", { name: /Trait scores as petals/ }), "a store notify rebuilt the rose")
        .toBe(rose);
      expect(asked, "a store notify re-ran the card's mount effect").toHaveBeenCalledTimes(1);
      expectNoBoundary("profile/big5 under a store notify");
    });
  });

  it("keeps the persona's same-type friends in demo mode", () => {
    // The control again, and it is load-bearing: `sameType` returning [] for
    // everyone would satisfy the case above without a live gate existing.
    const { container } = render(<window.ResultProfileCard testKey="big5" />);
    expect(initialsIn(container).length, "the demo friends are gone too")
      .toBeGreaterThan(0);
  });

  // ── the crowd half of the same card (D157) ──
  //
  // `IS_TEST_AVG` is five constants per instrument, and until now they WERE
  // the hollow "most people" ring on every axis and the line above it
  // reading "higher than 9 in 10 members" — this app's population, named,
  // from a number a writer typed. Same class as the sample people above,
  // one section further down the same card, and invisible in a way they
  // were not: a plausible ring in a plausible place looks exactly like a
  // measurement.
  //
  // Mounted rather than asserted at the fold, because the fold returning an
  // empty map is only half the fix — a card that then drew `pos(undefined)`
  // would stack every ring at the left edge and still show a legend naming
  // it. The `no crowd average yet` line is the assertion that the card
  // noticed.
  const BIG5_DIMS = IS_TESTS.big5.questions;
  /** n straight (non-reversed) items of one axis, as the bank serves them. */
  const testBank = (dim, n) => BIG5_DIMS
    .filter((q) => q.d === dim && !q.invert)
    .slice(0, n)
    .map((q, i) => ({ id: `t-${dim}-${i}`, prompt: q.q, test: "big5", surface: "test", options: ["", "", "", "", ""] }));

  /** Publish `answers` answers on option `opt` for each of those items. */
  function publishTestAggs(items, opt, answers) {
    const byQid = {};
    items.forEach((q) => { byQid[q.id] = { counts: { [String(opt)]: answers }, total: answers }; });
    Object.defineProperty(window.LIVE, "testFeedItems", { value: () => items, writable: true, configurable: true });
    Object.defineProperty(window.LIVE, "aggFor", { value: (qid) => byQid[qid] || null, writable: true, configurable: true });
    resetNormCache();
  }

  it("draws no crowd average on a live card with nothing measured", () => {
    live = installLive();
    resetNormCache();
    hydrateTestResults(BIG5_RESULT);

    const { container } = render(<window.ResultProfileCard testKey="big5" />);
    expect(container.textContent, "the card did not render — test is vacuous")
      .toMatch(/Openness/);
    // The legend named a mark. With no baseline there is no mark, so
    // naming it would be furniture describing nothing.
    expect(container.textContent, "the authored ring is still legended")
      .not.toMatch(/most people/);
    expect(container.textContent, "the percentile survived without a crowd")
      .not.toMatch(/in 10/);
    expect(container.textContent).toMatch(/no crowd average yet/);
    // The ring itself, not just its label: a fill can be a claim in a
    // different alphabet (D11's own lesson).
    expect(container.textContent, "a NaN position leaked into the markup")
      .not.toMatch(/NaN/);
  });

  it("draws it again once the population has answered enough", () => {
    live = installLive();
    // Option 4 on straight items is full agreement, so Openness averages
    // 100 — a number no constant in IS_TEST_AVG carries, which is what
    // makes this case prove the ring is the MEASUREMENT and not the
    // fallback quietly coming back.
    publishTestAggs(testBank("O", 3), 4, 40);
    hydrateTestResults(BIG5_RESULT);

    const { container } = render(<window.ResultProfileCard testKey="big5" />);
    expect(container.textContent).toMatch(/most people/);
    expect(container.textContent).not.toMatch(/no crowd average yet/);
  });

  it("keeps the authored baseline in demo mode", () => {
    // The control. Demo is a shipped surface — `npm run dev`, and the store
    // screenshots are taken on it — and every assertion above would pass if
    // the section had simply stopped rendering.
    resetNormCache();
    const { container } = render(<window.ResultProfileCard testKey="big5" />);
    expect(container.textContent).toMatch(/most people/);
    expect(container.textContent).not.toMatch(/no crowd average yet/);
  });

  // The same defect, on the sheet reached from this card's "All 13 types"
  // button: `IS_ARCHETYPES[].share` drawn as a bar chart under the heading
  // "bar = how common". The sheet portals into `.app`, so the host has to
  // exist before it renders.
  function renderTypeSheet(testKey = "big5") {
    const host = document.createElement("div");
    host.className = "app";
    document.body.appendChild(host);
    render(<window.TypeIndexSheet testKey={testKey} onClose={() => {}} />);
    return host;
  }
  // The authored shares, read off the module rather than written out: they
  // are content and they move.
  const AUTHORED_SHARES = new RegExp(
    "(" + IS_ARCHETYPES.big5.list.map((t) => t.share).join("|") + ")\\s*%",
  );

  it("prints no authored type frequency in the live type index", () => {
    live = installLive();
    // Nobody counted yet — the state the release was reported in, and the
    // one where the authored bars were most obviously not a measurement.
    Object.defineProperty(window.LIVE, "kindredPeople", { value: () => [], writable: true, configurable: true });
    resetNormCache();
    const host = renderTypeSheet();
    try {
      expect(host.textContent, "the sheet did not render — test is vacuous")
        .toMatch(/The Quiet One/);
      expect(host.textContent, "an authored share survived in live mode")
        .not.toMatch(/\d+\s*%/);
      expect(host.textContent).not.toMatch(/bar = how common/);
      expect(host.textContent).toMatch(/who-voted sheet and this fills in/);
    } finally {
      host.remove();
    }
  });

  it("counts the sample it has, and says what it counted", () => {
    // The fixture holds one scored person, so the sheet has a measurement
    // — one that no authored share happens to equal.
    live = installLive();
    resetNormCache();
    const host = renderTypeSheet();
    try {
      expect(host.textContent).toMatch(/of 1 person counted/);
      // A COUNT, not a share. This asserted "1 · 100%" — a percentage over
      // a basis of one — until the floor below was applied. The card built
      // on this same fold has always refused shares under TYPE_SMALL, and
      // typeMix.ts states it as the constant's contract.
      expect(host.textContent).toMatch(/\b1\b/);
      expect(host.textContent, "a share was printed over a basis of one")
        .not.toMatch(/1\s*·\s*100\s*%/);
      // Every other type is a measured zero, drawn as an absence rather
      // than as a share rounding to nothing.
      expect(host.textContent).toMatch(/none/);
      expect(host.textContent, "an authored share is still on screen")
        .not.toMatch(AUTHORED_SHARES);
    } finally {
      host.remove();
    }
  });

  it("prints counts, not shares, until the basis reaches the card's floor", () => {
    // Two taps from the card that just named the reader's own type, on a
    // row marked YOU, this sheet printed "2 · 67%" over three people. The
    // card built on the same fold refuses shares below TYPE_SMALL and says
    // why; the sheet counted from one typed person upward.
    live = installLive();
    const one = window.LIVE.kindredPeople()[0];
    const sample = (n) => Array.from({ length: n }, (_, i) => ({ ...one, uid: `u${i}` }));
    Object.defineProperty(window.LIVE, "kindredPeople",
      { value: () => sample(TYPE_SMALL - 1), writable: true, configurable: true });
    resetNormCache();
    const host = renderTypeSheet();
    try {
      expect(host.textContent, "the sheet did not render — test is vacuous")
        .toMatch(/The Quiet One/);
      expect(host.textContent, `a share was printed over a basis of ${TYPE_SMALL - 1}`)
        .not.toMatch(/\d+\s*·\s*\d+\s*%/);
      // …and the basis is still stated, which is what makes the bare count
      // readable at all.
      expect(host.textContent).toMatch(new RegExp(`of ${TYPE_SMALL - 1} people counted`));
    } finally {
      host.remove();
    }
  });

  it("starts printing shares once the basis reaches the floor", () => {
    // THE CONTROL. Without it the case above is satisfied by a sheet that
    // never prints a share at all, which would lose the number on every
    // basis large enough to carry it.
    live = installLive();
    const one = window.LIVE.kindredPeople()[0];
    Object.defineProperty(window.LIVE, "kindredPeople", {
      value: () => Array.from({ length: TYPE_SMALL }, (_, i) => ({ ...one, uid: `u${i}` })),
      writable: true, configurable: true,
    });
    resetNormCache();
    const host = renderTypeSheet();
    try {
      expect(host.textContent, "the floor swallowed a basis that is over it")
        .toMatch(/\d+\s*·\s*\d+\s*%/);
    } finally {
      host.remove();
    }
  });

  it("measures politics frequencies too, and measures them (D202)", () => {
    // The inverse of the case it replaces. Until D202 this asserted that
    // the politics sheet lost its numbers rather than keeping fabricated
    // ones — the Art. 9 scope D157 §4 held. D202 reversed that on the
    // owner's call, so the assertion flips to the thing that still
    // matters: the number on screen is a COUNT of real typed people, and
    // no authored share came back with the reversal.
    live = installLive();
    resetNormCache();
    const host = renderTypeSheet("political");
    try {
      expect(host.textContent, "the sheet did not render — test is vacuous")
        .toMatch(/Liberal Centrist/);
      expect(host.textContent, "the pre-D202 refusal copy is still on screen")
        .not.toMatch(/only counted for the Big Five/);
      // The fixture's one scored person carries a Big Five result and no
      // politics one, so the honest answer here is a measured ZERO with
      // its basis stated — which is the better demonstration of the two:
      // the widening reached the instrument without inventing a number for
      // it. `typedN` 0 is a real answer and not the same as null.
      expect(host.textContent).toMatch(/\d+ counted so far, none with a result yet/);
      // The authored `share` field still exists and still feeds the
      // matcher's commonness prior — it must not reach the screen.
      expect(host.textContent, "an authored politics share is on screen")
        .not.toMatch(
          new RegExp("(" + IS_ARCHETYPES.political.list.map((t) => t.share).join("|") + ")\\s*%"),
        );
    } finally {
      host.remove();
    }
  });

  it("keeps the authored type frequencies in demo mode", () => {
    resetNormCache();
    const host = renderTypeSheet();
    try {
      expect(host.textContent).toMatch(/bar = how common/);
      expect(host.textContent).toMatch(AUTHORED_SHARES);
    } finally {
      host.remove();
    }
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

// ── the colour an instrument wears before it has a type (D230) ────────
//
// `TestProgress` (profile-overlay.jsx) is the card that stands where a
// result would be, and it is LIVE-ONLY BY CONSTRUCTION: `ownProgress`
// returns null without a live store, so every demo smoke mount walks past
// this branch without executing a line of it. It draws the two-tone split
// now — deep base, the runner-up axis' lighter tone laid on its right —
// and that is a SHAPE, which is the class of thing check:globals, eslint
// and tsc are all blind to and only a render can see. The hues themselves
// are pinned at the fold (test/passive-fold-live.test.jsx); what is pinned
// here is that the second tone reaches the DOM, and that it is absent when
// there is nothing behind it.
describe("the filling-in card wears where you stand (D230)", () => {
  // Politics' items pair up by axis — 0,1 econ · 2,3 auth — so extremes on
  // the first pair and dead centre on the second give the split a dominant
  // hue and a runner-up. Built from the definition, so it cannot drift.
  const polBank = () => IS_TESTS.political.questions.map((q, i) => ({
    id: `t-pol-${String(i).padStart(2, "0")}`,
    prompt: q.q,
    test: "political",
    surface: "test",
    options: ["", "", "", "", ""],
  }));

  /** Mount live on the Politics profile tab, with `picks` already answered. */
  async function openPolitics(picks) {
    const bank = polBank();
    const expectNoBoundary = mountLive({}, (l) => {
      Object.defineProperty(window.LIVE, "testFeedItems", {
        value: () => bank, writable: true, configurable: true,
      });
      for (const [i, v] of Object.entries(picks)) l.votes[bank[i].id] = String(v);
      // A live account that has taken no sit-down test — otherwise the demo
      // persona's stored Politics result answers first and the fold path
      // this case exists for is never reached.
      window.dispatchEvent(new CustomEvent("insight:test-results", { detail: {} }));
      // passive-meter.jsx holds the fold behind the store's notify, and the
      // fixture's `subscribe` never reaches that listener. PASSIVE's does.
      PASSIVE.poke();
      // The subtab is remembered on `window`, and reading it is how the
      // overlay opens anywhere but General.
      window.__profileSub = "politics";
    });
    await openHeaderOverlay("profile");
    await act(async () => {});
    return expectNoBoundary;
  }

  /** The filled part of the card's progress bar. */
  function fillOf() {
    const card = screen.getByText(/of 30 answered/).closest(".card");
    expect(card, "the filling-in card did not render — test is vacuous").not.toBeNull();
    return card.firstElementChild.firstElementChild;
  }

  afterEach(() => {
    delete window.__profileSub;
    // Put the demo seed back: it is module state in test-definitions.js and
    // this block empties it.
    window.dispatchEvent(new Event("insight:local-purge"));
  });

  it("lays the runner-up's tone over the bar, from four answers", async () => {
    const expectNoBoundary = await openPolitics({ 0: 4, 1: 0, 2: 2, 3: 2 });
    expect(fillOf().children.length, "the bar drew one flat tone").toBe(1);
    expectNoBoundary("profile/politics");
  });

  it("draws one tone while nothing has been answered", async () => {
    // The control, and it is load-bearing twice over: a card that always
    // appended the second span would pass the case above, and a card that
    // crashed on an empty fold would fail here rather than in production.
    const expectNoBoundary = await openPolitics({});
    expect(fillOf().children.length, "a second tone appeared out of no answers").toBe(0);
    expectNoBoundary("profile/politics/empty");
  });
});
