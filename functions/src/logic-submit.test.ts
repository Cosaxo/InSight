// logic-submit.test.ts — the two gates on submitting a logic test.
//
// WHY THIS FILE EXISTS. `logicSubmitV2` is the only way a verified logic
// score is ever written, and the verified score is what every "sharper
// than X% of N verified players" sentence rests on. The four RANKING
// decisions were extracted to `rankAndFold` and are pinned in
// logic.test.ts; the two GATES on the attempt itself stayed inside the
// callable, where nothing reached them:
//
//   - the DEADLINE. The whole meaning of a verified score is that it was
//     produced inside a bounded window; without the check an attempt can
//     be left open indefinitely and submitted at leisure, and the result
//     is still stamped `verified: true`.
//   - ALREADY SCORED. Submitting twice against one open attempt would
//     score the same seed twice.
//
// The emulator leg cannot reach either: it starts an attempt and submits
// immediately, which is the one path where both guards are satisfied by
// the fixture rather than by the code.
//
// WHAT THE FAKE IS AND IS NOT. Firestore's PLUMBING — refs, a
// transaction, get/set — not its semantics. The subject is this
// callable's own branching.
import { describe, it, expect, vi, beforeEach } from "vitest";

type Doc = Record<string, unknown>;
const store = new Map<string, Doc>();

function ref(path: string) {
  return { path, id: path.split("/").pop() as string };
}
const fakeDb = {
  collection: (name: string) => ({ doc: (id: string) => ref(`${name}/${id}`) }),
  async runTransaction(cb: (tx: unknown) => Promise<unknown>) {
    const tx = {
      get: async (r: { path: string }) => ({
        exists: store.has(r.path),
        data: () => store.get(r.path),
        get: (f: string) => store.get(r.path)?.[f],
      }),
      set: (r: { path: string }, data: Doc, opts?: { merge?: boolean }) => {
        store.set(r.path, opts?.merge ? { ...(store.get(r.path) || {}), ...data } : data);
      },
    };
    return cb(tx);
  },
};

vi.mock("./db", () => ({ db: () => fakeDb, FIRESTORE_DB_ID: "insight" }));

const { logicSubmitV2, LOGIC_DEADLINE_MS, LOGIC_ITEMS, LOGIC_MIN_MS_PER_ITEM, clientItems } = await import("./logic");
const { version: GEN_VERSION } = await import("./logic-gen");

const UID = "u1";
const ATTEMPT = `v2_logic_attempts/${UID}`;
// Any well-formed answer sheet; these cases are about the gates, not the
// marking, so what matters is that the picks are VALID — an invalid sheet
// would be refused one guard further down and prove nothing.
const picks = () => new Array(LOGIC_ITEMS).fill(0);

const submit = () =>
  (logicSubmitV2 as unknown as { run: (r: unknown) => Promise<unknown> }).run({
    auth: { uid: UID },
    data: { picks: picks() },
  });

const openAttempt = (over: Doc = {}) => {
  const now = Date.now();
  store.set(ATTEMPT, {
    seed: 7,
    gv: GEN_VERSION,
    status: "open",
    startedAtMs: now,
    deadlineMs: now + LOGIC_DEADLINE_MS,
    dayKey: "2026-09-06",
    startsToday: 1,
    normsCounted: false,
    ...over,
  });
};

beforeEach(() => {
  store.clear();
});

describe("submitting a logic test", () => {
  it("refuses an attempt whose deadline has passed", async () => {
    // Opened long enough ago that the window is spent. Nothing else about
    // it is wrong — this is the honest case of a test left open.
    openAttempt({ startedAtMs: Date.now() - LOGIC_DEADLINE_MS * 3, deadlineMs: Date.now() - 1000 });
    await expect(submit(), "an expired attempt was scored as verified")
      .rejects.toThrow(/expired/);
    expect(store.get(ATTEMPT)?.status, "the expired attempt was written as scored").toBe("open");
    expect(store.has(`v2_users/${UID}`), "an expired attempt wrote a verified result").toBe(false);
  });

  it("…and scores the same attempt inside its window", async () => {
    // The control, so "refuses" cannot be satisfied by refusing
    // everything. Same picks, same seed, only the clock differs.
    openAttempt();
    await submit();
    expect(store.get(ATTEMPT)?.status).toBe("scored");
    const result = (store.get(`v2_users/${UID}`)?.testResults as Doc)?.logic as Doc;
    expect(result?.verified, "a valid submit wrote no verified result").toBe(true);
    expect(typeof result?.pctile).toBe("number");
  });

  it("counts a sitting that took real time, and never a click-through (D394)", async () => {
    // The fake's open attempt is submitted the instant it opens, which is
    // exactly the click-through the effort floor exists for: scored, the
    // result written, but the histogram untouched and the account still
    // uncounted — so its next verified attempt is its first counted one.
    openAttempt();
    await submit();
    const rushed = (store.get(`v2_users/${UID}`)?.testResults as Doc)?.logic as Doc;
    expect(rushed?.verified).toBe(true);
    expect(store.has("v2_logic_norms_private/global"), "a click-through fed the norms").toBe(false);
    expect(store.get(ATTEMPT)?.normsCounted, "a click-through marked the account as counted").toBe(false);

    // The control: the same attempt opened long enough ago counts once.
    store.clear();
    openAttempt({ startedAtMs: Date.now() - LOGIC_ITEMS * LOGIC_MIN_MS_PER_ITEM - 1000 });
    await submit();
    const norms = store.get("v2_logic_norms_private/global") as Doc;
    expect(norms?.n, "a real sitting did not feed the norms").toBe(1);
    expect(norms?.gv, "the histogram is not stamped with the generator era").toBe(GEN_VERSION);
    expect(norms?.items).toBe(LOGIC_ITEMS);
    expect(store.get(ATTEMPT)?.normsCounted).toBe(true);
    expect(store.get("v2_logic_norms/global"), "the public mirror was not rewritten").toBeTruthy();
    const counted = (store.get(`v2_users/${UID}`)?.testResults as Doc)?.logic as Doc;
    // the likely range travels with the number, on the result as on the wire
    expect(Array.isArray(counted?.band)).toBe(true);
    expect((counted?.band as number[])[0]).toBeLessThanOrEqual(counted?.pctile as number);
    expect((counted?.band as number[])[1]).toBeGreaterThanOrEqual(counted?.pctile as number);
  });

  it("refuses a second submit against one attempt", async () => {
    openAttempt();
    await submit();
    await expect(submit(), "the same attempt was scored twice")
      .rejects.toThrow(/already scored/);
  });

  it("refuses when there is no attempt at all", async () => {
    await expect(submit()).rejects.toThrow(/no open attempt/);
  });

  it("refuses a signed-out caller before touching the store", async () => {
    await expect(
      (logicSubmitV2 as unknown as { run: (r: unknown) => Promise<unknown> }).run({
        auth: null, data: { picks: picks() },
      }),
    ).rejects.toThrow(/signed in/);
    expect(store.size).toBe(0);
  });

  it("refuses an answer sheet of the wrong length", async () => {
    openAttempt();
    await expect(
      (logicSubmitV2 as unknown as { run: (r: unknown) => Promise<unknown> }).run({
        auth: { uid: UID }, data: { picks: [0, 1, 2] },
      }),
    ).rejects.toThrow(/integers/);
    // The form the client was handed is the length the submit must be.
    expect(clientItems(7, GEN_VERSION).length).toBe(LOGIC_ITEMS);
  });
});
