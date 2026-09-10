// @vitest-environment jsdom
//
// `loadRevealHistory` ARMS AND SAYS SO — the one loader that was missed.
//
// A loading flag nobody is told about is not a loading state. Every other
// loader in live.ts calls `notify()` on the line after it sets its flag,
// and `loadVoters` carries the reasoning in as many words: the panel that
// mounts the loader has already painted by the time its effect runs, so
// without the notify its FIRST frame — the one with no data and no flag —
// stands until the query lands.
//
// This one did not. The Mirror's Groups stop mounts on a `[gid]` effect,
// so for the whole of a dynamic Firestore import plus an ordered
// thirty-document read — seconds on a cold mobile path — a room with
// weeks of history rendered "no rounds revealed yet" under its own name,
// which is the exact sentence `revealHistoryLoading` was added to
// prevent (its docstring: "the cold frame told a group with weeks of
// history that nothing had been revealed").
//
// WHY A NEW FILE, AND WHY IT MOCKS SO LITTLE. Both suites that draw this
// state — LiveGroupsMirrorBody's and LiveRolesPanel's — replace
// `revealHistoryLoading` with a settable stub, so they assert what the
// screen does for a given flag and can never see whether the store ever
// sets it where anyone is listening. The property here is about the REAL
// store, and it needs exactly one thing the other harnesses do not give:
// a `getDb` that never resolves, which holds the loader open at its first
// await so the frame in question can be observed at all.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  /** Held open: the loader arms, notifies, and then waits here forever. */
  dbPending: true,
  /** …or fails, which is the other half: the loader must ANSWER that. */
  dbThrows: false,
}));

vi.mock("../../lib/sentry", () => ({ reportError: () => {}, initSentry: () => {} }));

vi.mock("../../lib/firebase", () => ({
  firebaseEnabled: true,
  anonSignIn: () => Promise.resolve("uid_test"),
  getDb: () => (h.dbThrows ? Promise.reject(new Error("permission-denied"))
    : h.dbPending ? new Promise(() => {}) : Promise.resolve({ __db: true, app: {} })),
  getFirestoreApi: () => import("firebase/firestore"),
  getFunctionsApi: () => import("firebase/functions"),
  linkGoogle: () => Promise.resolve(),
  googleSignOut: () => Promise.resolve(),
  subscribeToAuth: (cb: (u: { uid: string } | null) => void) => {
    cb({ uid: "uid_test" });
    return () => {};
  },
}));

const LIVE = (await import("./live")).default;

describe("loadRevealHistory", () => {
  beforeEach(() => { h.dbPending = true; h.dbThrows = false; });
  afterEach(() => { vi.restoreAllMocks(); });

  it("tells its subscribers it armed, before the read lands", async () => {
    const seen: boolean[] = [];
    const off = LIVE.subscribe(() => seen.push(LIVE.social.revealHistoryLoading("g_arm")));
    void LIVE.social.loadRevealHistory("g_arm");
    // One microtask: enough for the loader to reach its first await and
    // no further, since `getDb` never settles.
    await Promise.resolve();
    expect(LIVE.social.revealHistoryLoading("g_arm"), "the flag was never set").toBe(true);
    expect(seen.length, "the flag was set with nobody told — the screen keeps its cold frame").toBeGreaterThan(0);
    // …and what a subscriber woken by it would READ is the armed flag,
    // not a notify that raced ahead of the state it announces.
    expect(seen.some((v) => v === true), "the wake arrived before the flag it announces").toBe(true);
    off?.();
  });

  it("is still idempotent — a second call while the first is open notifies nobody", async () => {
    // The control. A notify on every call would re-render the stop for
    // each of the two panels that ask for the same room, and the early
    // return exists precisely because they do.
    void LIVE.social.loadRevealHistory("g_twice");
    await Promise.resolve();
    let woke = 0;
    const off = LIVE.subscribe(() => { woke += 1; });
    void LIVE.social.loadRevealHistory("g_twice");
    await Promise.resolve();
    expect(woke, "the second call woke the tree for a read it did not start").toBe(0);
    off?.();
  });

  it("ANSWERS a failed read instead of throwing — the word the panel could not get", async () => {
    // The header's promise is that this never throws: two callers `void`
    // it and an unhandled rejection from a history read is not a price a
    // portrait should charge. The consequence went unnoticed — the ONE
    // caller that cares wrapped it in try/catch to mark a room refused,
    // and that catch could never fire, so a room whose read was denied
    // fell through to "nothing revealed yet". It answers now, and the
    // promise is unchanged: this call resolves, it does not reject.
    h.dbThrows = true;
    h.dbPending = false;
    await expect(LIVE.social.loadRevealHistory("g_fail")).resolves.toBe("failed");
    // …and the room is left UNSETTLED so a later call retries, rather
    // than freezing the gap into the session.
    expect(LIVE.social.revealHistory("g_fail")).toEqual([]);
    expect(LIVE.social.revealHistoryLoading("g_fail")).toBe(false);
  });
});

describe("loadNames", () => {
  beforeEach(() => { h.dbPending = true; h.dbThrows = false; });

  it("ANSWERS a failed profile read — the same word, one loader over", () => {
    // The store swallows a name-resolution failure by design: it is not a
    // price a lens should charge. What it did not do was tell the ONE
    // caller that cares — LiveCompareLens flipped its local `reading`
    // flag false on a failure with no scores in hand, and its people
    // basis then said "Nobody here has finished a test yet" about a room
    // where everyone had. Same shape as the reveal history above, same
    // answer, and the promise not to throw is unchanged: this resolves.
    h.dbThrows = true;
    h.dbPending = false;
    return expect(LIVE.loadNames(["u_a", "u_b"])).resolves.toBe(false);
  });

  it("…and a list already in hand is not a read that failed", () => {
    // The control. `loadNames` returns before touching the network when
    // every uid is cached, and "nothing to do" must not read as "the
    // read broke" — that would put the failure copy on every warm open.
    h.dbThrows = true;
    h.dbPending = false;
    return expect(LIVE.loadNames([])).resolves.toBe(true);
  });
});
