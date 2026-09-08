// @vitest-environment jsdom
//
// `dq()` and `duels()` in daily-split.jsx hand ONE dynamic import to
// several callers, and until this file nothing in the tree exercised
// either function. Measured, not assumed: instrumenting both with a
// console.log and running the whole unit suite — 192 files, 2874 tests —
// logged zero calls.
//
// What that hid was two bugs in a hand-rolled `if (pending) return DQ`
// memo. It registered only the FIRST caller's `onReady`, and there are two
// callers a tick apart: `mapBranch` asks during render, `syncToMap` asks
// on the vote. The vote's callback was dropped AND it got `null` back, so
// `if (dq(write)) write()` read the null as "not ready yet" and nothing
// ever called `write` — the demo's map-sync answer was simply lost. And
// there was no `.catch`, so a failed chunk latched the flag true for the
// rest of the session and left an unhandled rejection behind.
//
// Both loaders go through retryable() (data/lazy.ts) now, which is the
// helper main.jsx's four loaders already use and which exists because a
// hand-rolled memo cached a REJECTED promise once before
// (spec-index.js's note at loadWorldFeed).
//
// The first two cases are behavioural and drive the real functions. The
// third is textual, and says so: `duels()` is only reachable through
// componentDidMount, whose body wants a mounted component, so what is
// pinned there is that it shares the same mechanism rather than a second
// hand-rolled memo. mirror-slot.test.jsx pins loadMirrorTab the same way.

import { describe, expect, it, vi, beforeEach } from "vitest";
// The module's own text, through vite rather than through `fs`: these
// files lint against a browser global set, so neither `__dirname` nor
// `process.cwd()` is available here (feed-map-promise.test.jsx says the
// same at its own ?raw import).
import dailySplitSrc from "../spec/daily-split.jsx?raw";

// `s1` is the one id DAILYSPLIT_DQ_SYNC carries, and 'Pineapple on pizza?'
// is the prompt it maps into the archive.
const S1 = { id: "s1" };
const PROMPT = "Pineapple on pizza?";

describe("daily-split's chunk loaders serve every caller", () => {
  beforeEach(() => { vi.resetModules(); });

  it("a second dq() caller arriving while the import is in flight still runs", async () => {
    // Imported BEFORE the calls on purpose: it warms the module cache but
    // does not set daily-split's own `DQ`, which only its loader's `.then`
    // assigns — so the race the two call sites hit on a device is intact,
    // and the pre-state below is readable.
    const { DAILYQ } = await import("../spec/daily-questions.js");
    const { DailySplit } = await import("../spec/daily-split.jsx");
    const q = DAILYQ.questions.find((x) => x.prompt === PROMPT);
    expect(q, `the demo prompt DAILYSPLIT_DQ_SYNC maps ("${PROMPT}") is gone from the archive`).toBeDefined();
    // Pick the option the archive is NOT already sitting on, so the
    // assertion cannot pass on a baked answer.
    const before = DAILYQ.myAnswer(q);
    const optId = before === 0 ? "no" : "yes";
    const want = optId === "no" ? 1 : 0;
    expect(before, "both mapped options are already the current answer — the case below would be vacuous").not.toBe(want);

    const inst = Object.create(DailySplit.prototype);
    let forced = 0;
    inst.forceUpdate = () => { forced += 1; };

    // Caller one, during render. It starts the load and gets null back.
    const branch = inst.mapBranch(S1);
    expect(branch, "mapBranch resolved the archive synchronously, so the two calls below are not racing the import at all").toBe("Interests");
    // Caller two, in the SAME tick — the vote. This is the one the old memo
    // dropped.
    inst.syncToMap(S1, optId);

    await vi.waitFor(() => expect(forced, "the first caller's callback never ran").toBeGreaterThan(0));
    expect(
      DAILYQ.myAnswer(q),
      "the vote that arrived while the chunk was still loading was dropped — this is the +1 the second caller never got",
    ).toBe(want);
  });

  it("a failed chunk does not latch: the next caller re-attempts", async () => {
    let attempts = 0;
    vi.doMock("../spec/daily-questions.js", async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("probe: chunk unavailable");
      return await vi.importActual("../spec/daily-questions.js");
    });
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { DailySplit } = await import("../spec/daily-split.jsx");
      const inst = Object.create(DailySplit.prototype);
      let first = 0; let second = 0;
      inst.forceUpdate = () => { first += 1; };
      inst.mapBranch(S1);
      await vi.waitFor(() => expect(err, "the failed chunk was never reported").toHaveBeenCalled());
      expect(first, "a callback ran even though the chunk failed").toBe(0);

      // The next render. Under the old memo `dqPending` was still true and
      // this returned null forever.
      inst.forceUpdate = () => { second += 1; };
      inst.mapBranch(S1);
      await vi.waitFor(() => expect(second, "the loader latched after one failure and never retried").toBeGreaterThan(0));
      expect(attempts, "the retry did not reach the module again").toBe(2);
    } finally {
      err.mockRestore();
      vi.doUnmock("../spec/daily-questions.js");
    }
  });

  it("duels() shares that mechanism rather than a second hand-rolled memo", () => {
    // Textual, and the reason is in the header: duels() is reachable only
    // through componentDidMount. Both loaders had the same defect and were
    // fixed the same way, so what has to hold is that neither grows its own
    // pending flag back.
    expect(dailySplitSrc, "daily-questions is no longer loaded through retryable()").toMatch(
      /const loadDQ = retryable\(\(\) => import\('\.\/daily-questions\.js'\)/,
    );
    expect(dailySplitSrc, "duels-data is no longer loaded through retryable()").toMatch(
      /const loadDuels = retryable\(\(\) => import\('\.\/duels-data\.js'\)/,
    );
    expect(dailySplitSrc, "a hand-rolled pending flag is back in daily-split.jsx — that is the memo both loaders were converted away from").not.toMatch(
      /\b(dqPending|duelsPending)\b/,
    );
  });
});
