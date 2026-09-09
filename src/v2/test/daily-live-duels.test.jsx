// @vitest-environment jsdom
//
// A LIVE build has no use for the demo duel store, and said so in its own
// comment — "on live this module is never needed at all" — while
// componentDidMount asked for it on every daily mount.
//
// `duels-data.js` pulled `content/duel-questions.json`, the duel lane's
// whole bank (16.7 KB then; since D430 it carries the bank's fixed sample,
// `content/duel-sample.json`), which is exactly why it is loaded on demand
// instead of imported. The pending-count read far below is gated
// (`liveDuels ? null : duels(…)`); the subscribe in componentDidMount was
// not, so the gate held on one of the two call sites and the module
// arrived anyway.
//
// `check:eager-content` cannot see this: it reads the STATIC first-paint
// graph, and a dynamic import from a mounted component is not in it. What
// can see it is a mount, which is what this file is.
//
// The signal is `DUELS.subscribe`, not the import itself. Importing the
// module here to hold the spy puts it in the registry — so the pre-fix
// path would resolve instantly rather than not at all — but `subscribe` is
// reached only through daily-split's own `sub()`, which runs only when
// `duels()` was called. Both directions are asserted, because a fix that
// silenced the live build by breaking the demo would be worse than the
// defect.

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import React from "react";
import { cleanup, render } from "@testing-library/react";
import { installLive } from "./live-fixture";
import { DUELS } from "../spec/duels-data.js";

// The full app in jsdom, like every other mount suite here.
vi.setConfig({ testTimeout: 15000 });

let App;
let live;
let errorSpy;
let sub;

beforeAll(async () => {
  await import("../spec-index.js");
  App = globalThis.App;
});

afterEach(() => {
  cleanup();
  sub?.mockRestore();
  errorSpy?.mockRestore();
  live?.restore();
  live = undefined;
});

describe("the daily's duel store is a demo dependency only", () => {
  it("a live build never reaches for it", async () => {
    sub = vi.spyOn(DUELS, "subscribe");
    live = installLive();
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<App />);
    // The loader settles on a microtask; give it more turns than it needs
    // so a pass here means "never", not "not yet".
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
    await new Promise((r) => { setTimeout(r, 0); });
    await new Promise((r) => { setTimeout(r, 0); });
    expect(
      sub,
      "a live build subscribed to the demo duel store — which means it fetched content/duel-sample.json for a store nothing live reads",
    ).not.toHaveBeenCalled();
  });

  it("a demo build still does", async () => {
    // The control, and the reason it is here: silencing the live build by
    // breaking the demo's subscribe would take the duel badges with it —
    // the counts on the daily ruler stop updating and nothing says so.
    sub = vi.spyOn(DUELS, "subscribe");
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<App />);
    await vi.waitFor(
      () => expect(sub, "the demo build stopped subscribing to the duel store").toHaveBeenCalled(),
      { timeout: 4000 },
    );
  });
});
