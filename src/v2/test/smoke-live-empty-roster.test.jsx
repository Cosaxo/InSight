// @vitest-environment jsdom
//
// The shipping build's roster, which no other suite mounts.
//
// WHY THIS FILE EXISTS. `sample-data.js` gates its payload on the BUILD flag
// (`VITE_V2_LIVE`) since 2026-08-17: a shipping build gets `IS_DATA_EMPTY` —
// every key present, every value empty — and rolldown drops the demo roster
// from the bundle. Nothing else in the suite exercises that object. Every
// other file, `smoke-live.test.jsx` included, enters live mode by installing
// `window.LIVE` at RUNTIME and leaves the build flag unset, so all of them
// run against the full demo roster. That is deliberate there (smoke-live's
// controls read `IS_DATA.people` to find a name and then assert it is absent
// from the screen — an empty roster would turn those into assertions about
// nothing, which the file says at its own line 151), and it leaves exactly
// one hole: the shape that actually ships is the shape nothing renders.
//
// The hole is not theoretical. Consumers read one level down without
// guarding — `IS_DATA.cities.some` (mirror-field.jsx), and the several
// `const me = IS_DATA.me` sites that then read `me.x`. Those survive an
// empty ARRAY and an empty OBJECT and would crash on a bare `{}`, which is
// why IS_DATA_EMPTY keeps the keys. This file is what proves the keys are
// enough, on a render, rather than by reading the list and agreeing with it.
//
// Assert on the ErrorBoundary, never on a throw: app-shell wraps every tab
// and overlay, so a crashed screen still returns cleanly from render().
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

// 15s per test for the reason smoke-live records: every case here mounts the
// FULL app in jsdom.
vi.setConfig({ testTimeout: 15000 });

// The build flag cannot be stubbed into effect here — `IS_DATA` is resolved
// once at module evaluation, so `vi.stubEnv` after the fact would change
// nothing. Swapping the export IS the simulation, and it uses the module's
// own IS_DATA_EMPTY rather than a copy so this cannot drift from what ships.
vi.mock("../spec/sample-data.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, IS_DATA: actual.IS_DATA_EMPTY };
});

import { installLive } from "./live-fixture";
import { openVia } from "./mount-app";
import { IS_DATA } from "../spec/sample-data.js";

const BOUNDARY_LOG = "[InSight] boundary caught:";
const BOUNDARY_COPY = /This view hit a snag/i;

let App;
let errorSpy;
let live;

beforeAll(async () => {
  const specIndex = await import("../spec-index.js");
  // Both deferred groups, because the surfaces this file walks live in
  // them: the feed in loadWorldFeed, and relmap/person/city in loadOverlays.
  await specIndex.loadWorldFeed();
  await specIndex.loadOverlays();
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

describe("the mock is the shape that ships", () => {
  it("hands every consumer an empty value, never a missing key", () => {
    // If this fails the rest of the file is asserting against the demo
    // roster and would pass for the wrong reason — the vacuous pass the
    // smoke suites are written against.
    expect(IS_DATA.people, "the mock did not take").toEqual([]);
    expect(IS_DATA.me).toEqual({});
    // The unguarded reads, named individually: these are the exact shapes
    // mirror-field.jsx and the `const me = IS_DATA.me` sites depend on.
    expect(Array.isArray(IS_DATA.cities), "cities must stay an array").toBe(true);
    expect(typeof IS_DATA.me, "me must stay an object").toBe("object");
    for (const [key, value] of Object.entries(IS_DATA)) {
      expect(value, `${key} is nullish — a consumer reading through it crashes`).not.toBe(undefined);
      expect(value, `${key} is null — same crash`).not.toBe(null);
    }
  });
});

describe("a shipping build renders with no demo roster", () => {
  it("renders the daily tab without tripping the boundary", () => {
    const expectNoBoundary = mountLive();
    expectNoBoundary("daily/empty-roster");
  });

  it("renders the mirror tab without tripping the boundary", () => {
    const expectNoBoundary = mountLive();
    fireEvent.click(screen.getByRole("button", { name: /^mirror$/i }));
    expectNoBoundary("mirror/empty-roster");
  });

  it("renders the Circle stop, which drew the roster's constellation", () => {
    // The stop that had the most to lose: mirror-field-pops.jsx decides
    // between the embedded relationship map and the generic field canvas,
    // and both read people. `openOverlay` with a MIRROR_POP id is app-shell's
    // own way in (it sets mirrorPop and switches tab).
    const expectNoBoundary = mountLive();
    return openVia("openOverlay", "circle").then(() => {
      expectNoBoundary("mirror:circle/empty-roster");
    });
  });

  it("opens the profile overlay without tripping the boundary", () => {
    // profile-general.jsx reads IS_DATA.me and then reads through it.
    const expectNoBoundary = mountLive();
    fireEvent.click(screen.getByRole("button", { name: /^profile$/i }));
    expectNoBoundary("profile/empty-roster");
  });

  it("opens the search overlay without tripping the boundary", () => {
    // search-overlay.jsx reads both IS_DATA and DAILYQ.
    const expectNoBoundary = mountLive();
    fireEvent.click(screen.getByRole("button", { name: /^search$/i }));
    expectNoBoundary("search/empty-roster");
  });

  it("opens the relationship map without tripping the boundary", async () => {
    // relmap-lenses.jsx reads IS_DATA.me; relmap's own people are its
    // module-local demo set, so this is the case that proves the two are
    // independent rather than one crashing the other.
    const expectNoBoundary = mountLive();
    await openVia("openOverlay", "relmap");
    expectNoBoundary("relmap/empty-roster");
  });

  it("survives the cross-link openers finding nobody", async () => {
    // openCity/openPerson resolve their argument against IS_DATA.cities and
    // IS_DATA.people. With both empty the lookup MISSES, and app-shell's
    // openers are written to no-op on a miss (`if (c)` / `if (p)`) rather
    // than open an overlay on undefined. A regression there is a crash on a
    // real device the moment any cross-link fires, so it is asserted rather
    // than assumed.
    const expectNoBoundary = mountLive();
    await openVia("openCity", "Oslo");
    await openVia("openPerson", "anyone");
    expectNoBoundary("cross-links/empty-roster");
    expect(screen.queryByText(BOUNDARY_COPY)).toBeNull();
  });

  it("refuses the person overlay rather than inventing a profile", async () => {
    // PersonOverlay derives a whole profile by mixing the DEMO persona's
    // Big Five and political values with seeded noise, so with no persona it
    // has nothing to derive from. `window.openPerson` takes an OBJECT from
    // four call sites, so a record can reach it without going through the
    // (now empty) roster lookup — this passes one directly, which is the
    // path the empty roster does NOT close.
    const expectNoBoundary = mountLive();
    await openVia("openPerson", { id: "x1", name: "Someone Real", match: 70 });
    expectNoBoundary("person-overlay/empty-roster");
    // Refused, not rendered blank: the name must not reach the screen either.
    expect(document.body.textContent).not.toContain("Someone Real");
  });

  it("names no demo person anywhere in a live render", async () => {
    // The product half of D1, and the reason the roster was gated at all:
    // not merely "does not crash" but "does not appear". Walks the tabs a
    // user reaches from the bar and checks the whole document text.
    mountLive();
    fireEvent.click(screen.getByRole("button", { name: /^mirror$/i }));
    await act(async () => {});
    fireEvent.click(screen.getByRole("button", { name: /^profile$/i }));
    await act(async () => {});
    for (const name of ["Mira Halvorsen", "Henrik Vold", "Sigrid", "Torshov"]) {
      expect(document.body.textContent, `${name} reached a live render`).not.toContain(name);
    }
  });
});
