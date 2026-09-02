// @vitest-environment jsdom
// The dates the Map prints beside an answer, and what they mean once the
// answers are real.
//
// `daily-questions.js` carries its own demo calendar — a constant morning
// in May 2026, each question dated one day earlier than the last — and
// `liveSync` fills in the account's REAL Firestore votes by prompt match
// without touching either the label or the position. So on a live build
// the Map's answer card captioned a vote cast this morning with a date
// from the prototype, every date on the map sat in May 2026 or earlier,
// and the is-today ring landed on whichever demo question happened to sit
// at position 0.
//
// A synthetic date presented as the day you answered is the shape D1
// refuses. These pin the absence.
import { describe, it, expect, beforeEach, vi } from "vitest";

const BANK = [
  { id: "daily-001", prompt: null },
];

// A fresh module registry per case, and the stand-in defined ONTO the
// fresh store singleton rather than assigned to `window.LIVE`:
// daily-questions.js imports the binding (D354), so a second object on the
// global would reach nobody (test/live-fixture.ts's header). `ready` is a
// getter on the store's literal, hence defineProperty rather than
// assignment — and the un-booted singleton is inert, so no case here
// needs to undo anything: the next resetModules() starts from zero.
async function loadStore(live) {
  vi.resetModules();
  const store = (await import("../data/live")).default;
  for (const [k, v] of Object.entries(live || {})) {
    Object.defineProperty(store, k, { value: v, configurable: true, writable: true, enumerable: true });
  }
  const mod = await import("../spec/daily-questions.js");
  return mod.DAILYQ;
}

describe("the Map's answer dates", () => {
  beforeEach(() => { localStorage.clear(); });

  it("prints the demo calendar's date in a demo build — it is demo data there", async () => {
    const D = await loadStore(null);
    const q = D.questions[0];
    expect(D.datesAreReal()).toBe(true);
    expect(D.dateOf(q)).toBe(q.dateLabel);
    expect(D.dateOf(q), "the demo label went missing").toBeTruthy();
  });

  it("prints NO date once the answers are the account's own", async () => {
    // The join is by prompt, so the fixture bank borrows a real demo
    // prompt — that is what makes liveSync do its work rather than
    // bail on an empty match.
    const D0 = await loadStore(null);
    BANK[0].prompt = D0.questions[0].prompt;
    const D = await loadStore({
      enabled: true, ready: true,
      dailyBank: () => BANK,
      confirmedVotes: () => ({ "daily-001": 0 }),
      aggFor: () => null,
    });
    const q = D.questions[0];
    expect(D.datesAreReal(), "the demo calendar still claims to describe live answers").toBe(false);
    expect(
      D.dateOf(q),
      "the Map captioned a real answer with the prototype's date",
    ).toBeNull();
    // The label itself is untouched — this is about what is PRINTED, and
    // a demo build one import later must still have it.
    expect(q.dateLabel).toBeTruthy();
  });
});
