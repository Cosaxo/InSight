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
  return {
    path,
    id: path.split("/").pop() as string,
    // A plain read outside a transaction — what the practice callable does
    // to the public norms mirror, and the only non-transactional read here.
    get: async () => ({ exists: store.has(path), data: () => store.get(path) }),
  };
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
      // FIRESTORE'S MERGE, not a spread. `{merge:true}` merges nested
      // maps LEAF BY LEAF — a key omitted from a nested object is left
      // standing, which is the whole defect this fake could not show: a
      // shallow spread replaces `testResults` wholesale and makes an
      // omitted `n` vanish for free. `mergeFields` is the other half:
      // it writes exactly the named paths, replacing each subtree.
      set: (r: { path: string }, data: Doc, opts?: { merge?: boolean; mergeFields?: string[] }) => {
        const deep = (into: Doc, from: Doc): Doc => {
          const out: Doc = { ...into };
          for (const [k, v] of Object.entries(from)) {
            const prev = out[k];
            out[k] = v && typeof v === "object" && !Array.isArray(v)
              && prev && typeof prev === "object" && !Array.isArray(prev)
              ? deep(prev as Doc, v as Doc)
              : v;
          }
          return out;
        };
        const at = (obj: Doc, path: string): unknown =>
          path.split(".").reduce<unknown>((o, k) => (o as Doc | undefined)?.[k], obj);
        const put = (into: Doc, path: string, v: unknown): Doc => {
          const [head, ...rest] = path.split(".");
          const out: Doc = { ...into };
          out[head] = rest.length
            ? put((out[head] as Doc) || {}, rest.join("."), v)
            : v;
          return out;
        };
        const cur = (store.get(r.path) || {}) as Doc;
        if (opts?.mergeFields) {
          let next = cur;
          for (const f of opts.mergeFields) next = put(next, f, at(data, f));
          store.set(r.path, next);
        } else {
          store.set(r.path, opts?.merge ? deep(cur, data) : data);
        }
      },
    };
    return cb(tx);
  },
};

vi.mock("./db", () => ({ db: () => fakeDb, FIRESTORE_DB_ID: "insight" }));

const { logicSubmitV2, logicPracticeV2, logicNextV2, mintAttempt, OMIB_SELECTION, LOGIC_DEADLINE_MS, LOGIC_ITEMS, LOGIC_MIN_MS_PER_ITEM, clientItems } =
  await import("./logic");
const { version: GEN_VERSION } = await import("./logic-gen");
const { OMIB_FORM_ITEMS, OMIB_BANK_VERSION, EMPTY_CELL, omibForm, omibNextItem, replayAdaptive } = await import("./omib");
const { OMIB_KEY } = await import("./omib-bank");

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

  it("does not leave a population size beside a percentile that was not measured", async () => {
    // `n` is written only when the percentile is MEASURED — the code's
    // own comment says it is "the size of the population the claim is
    // about, meaningless for the model". But the write merged leaf by
    // leaf, so omitting the key left the PREVIOUS one standing: an
    // account that verified under an earlier generator era, then
    // re-verified after a bump (which resets the norms, so the percentile
    // falls back to the model until a hundred fresh attempts fold), kept
    // an `n` counted from a population that no longer exists, beside
    // `source: "model"`. World-readable, and in the data export.
    store.set(`v2_users/${UID}`, {
      displayName: "Ada",
      testResults: { logic: { v: 2, verified: true, source: "measured", pctile: 61, n: 400 } },
    });
    openAttempt();
    await submit();
    const result = (store.get(`v2_users/${UID}`)?.testResults as Doc)?.logic as Doc;
    expect(result?.source, "the fixture no longer produces a modelled percentile").toBe("model");
    expect(result?.n, "a modelled percentile kept the measured era's population size").toBeUndefined();
    // …and the rest of the profile is untouched: this writes one subtree,
    // not the document.
    expect(store.get(`v2_users/${UID}`)?.displayName).toBe("Ada");
  });

  it("counts a sitting that took real time, and never a click-through (D402)", async () => {
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

// ── the OMIB bank (D472) ──────────────────────────────────────────────────
// The attempt's own `bank` decides how it is scored, never the constant —
// which is what lets these run with LOGIC_BANK still "generator", and what
// scores an attempt that straddles the flip on the bank it was minted on.
describe("submitting on the OMIB bank", () => {
  const SEED = 7;
  const keyFor = (seed: number) => omibForm(seed).map((i) => OMIB_KEY[i.n]);
  const blanks = () => new Array(OMIB_FORM_ITEMS).fill(EMPTY_CELL) as string[];
  const submitOmib = (picks: unknown) =>
    (logicSubmitV2 as unknown as { run: (r: unknown) => Promise<Doc> }).run({ auth: { uid: UID }, data: { picks } });
  const openOmib = (over: Doc = {}) =>
    openAttempt({ bank: "omib", gv: OMIB_BANK_VERSION, seed: SEED, startedAtMs: Date.now() - OMIB_FORM_ITEMS * LOGIC_MIN_MS_PER_ITEM - 1, ...over });

  it("mints an attempt stamped with its bank and the bank's own version, and hands out codes only", () => {
    const m = mintAttempt(null, Date.now(), SEED, "omib");
    expect(m.attempt.bank).toBe("omib");
    expect(m.attempt.gv).toBe(OMIB_BANK_VERSION);
    expect(m.items).toHaveLength(OMIB_FORM_ITEMS);
    for (const it of m.items as { code: string }[]) {
      expect(Object.keys(it)).toEqual(["code"]);
      expect(it.code.split(",")[8]).toBe(EMPTY_CELL);
    }
    const g = mintAttempt(null, Date.now(), SEED, "generator");
    expect(g.attempt.bank).toBe("generator");
    expect(g.attempt.gv).toBe(GEN_VERSION);
    expect("opts" in (g.items[0] as object)).toBe(true);
  });

  it("scores by θ, writes v:3 with the bank named, and folds a first counted attempt into a θ histogram", async () => {
    openOmib();
    const out = await submitOmib(keyFor(SEED));
    expect(out.score).toBe(OMIB_FORM_ITEMS);
    expect(typeof out.theta).toBe("number");
    expect(typeof out.se).toBe("number");
    expect(out.bank).toBe("omib");
    expect(out.source).toBe("model"); // nobody counted yet → Φ against the calibration sample
    expect(out.n).toBeUndefined();
    const result = (store.get(`v2_users/${UID}`)?.testResults as Doc)?.logic as Doc;
    expect(result.v).toBe(3);
    expect(result.bank).toBe("omib");
    expect(result.verified).toBe(true);
    expect(result.theta).toBe(out.theta);
    expect(result.gv).toBe(OMIB_BANK_VERSION);
    // the histogram is the OMIB era's, one reading in one θ bin
    const norms = store.get("v2_logic_norms_private/global") as Doc;
    expect(norms.bank).toBe("omib");
    expect(norms.n).toBe(1);
    expect(Object.keys(norms).filter((k) => k.startsWith("t"))).toHaveLength(1);
    expect(store.get("v2_logic_norms/global")).toMatchObject({ bank: "omib", n: 1 });
    // …and the ledger is per item, under the same era
    const ledger = store.get("v2_logic_norms_private/families") as Doc;
    expect(ledger.bank).toBe("omib");
    expect(Object.keys(ledger).filter((k) => /^i_\d+_seen$/.test(k))).toHaveLength(OMIB_FORM_ITEMS);
    expect(store.get(ATTEMPT)?.normsCounted).toBe(true);
  });

  it("refuses the generator's pick shape on an OMIB attempt, and vice versa", async () => {
    openOmib();
    await expect(submitOmib(new Array(OMIB_FORM_ITEMS).fill(0))).rejects.toThrow(/twenty-character/);
    expect(store.get(ATTEMPT)?.status).toBe("open");
    store.clear();
    openAttempt(); // a generator attempt (no bank field — a pre-D472 document)
    await expect(submitOmib(blanks())).rejects.toThrow(/integers/);
  });

  it("a blank sheet scores zero, is marked unattempted in the ledger, and still folds", async () => {
    openOmib();
    const out = await submitOmib(blanks());
    expect(out.score).toBe(0);
    expect(out.theta as number).toBeLessThan(0);
    const ledger = store.get("v2_logic_norms_private/families") as Doc;
    expect(Object.keys(ledger).filter((k) => /^i_\d+_blank$/.test(k))).toHaveLength(OMIB_FORM_ITEMS);
    expect(Object.keys(ledger).some((k) => /_solved$/.test(k))).toBe(false);
  });

  it("a click-through is scored and never counted (the effort floor, D402, both banks)", async () => {
    openOmib({ startedAtMs: Date.now() - 1000 });
    await submitOmib(keyFor(SEED));
    expect(store.get(ATTEMPT)?.status).toBe("scored");
    expect(store.get(ATTEMPT)?.normsCounted).toBe(false);
    expect(store.has("v2_logic_norms_private/global")).toBe(false);
  });

  it("never folds a generator-era histogram into the OMIB one — the first OMIB submit starts fresh", async () => {
    store.set("v2_logic_norms_private/global", { items: 25, gv: GEN_VERSION, n: 500, b12: 500 });
    openOmib();
    const out = await submitOmib(keyFor(SEED));
    expect(out.source).toBe("model");
    const norms = store.get("v2_logic_norms_private/global") as Doc;
    expect(norms.n).toBe(1);
    expect(norms.b12).toBeUndefined();
  });
});

describe("practice on the OMIB bank", () => {
  const run = (data: unknown) =>
    (logicPracticeV2 as unknown as { run: (r: unknown) => Promise<Doc> }).run({ auth: { uid: UID }, data });

  it("starts with a seed and codes, writing nothing", async () => {
    const out = await run({});
    expect(typeof out.seed).toBe("number");
    expect(out.items).toHaveLength(OMIB_FORM_ITEMS);
    for (const it of out.items as { code: string }[]) expect(it.code.split(",")[8]).toBe(EMPTY_CELL);
    expect(store.size).toBe(0);
  });

  it("scores the seed it handed out, ranks against the model when nobody is counted, and still writes nothing", async () => {
    const start = await run({});
    const seed = start.seed as number;
    const out = await run({ seed, picks: omibForm(seed).map((i) => OMIB_KEY[i.n]) });
    expect(out.score).toBe(OMIB_FORM_ITEMS);
    expect(out.practice).toBe(true);
    expect(out.source).toBe("model");
    expect(typeof out.theta).toBe("number");
    expect(Array.isArray(out.band)).toBe(true);
    expect(store.size).toBe(0);
  });

  it("ranks against the public mirror once it is measured — the same reading a verified attempt gets", async () => {
    store.set("v2_logic_norms/global", { bank: "omib", items: 25, gv: OMIB_BANK_VERSION, n: 100, t20: 100 });
    const out = await run({ seed: 3, picks: new Array(OMIB_FORM_ITEMS).fill(EMPTY_CELL) });
    expect(out.source).toBe("measured");
    expect(out.n).toBe(100);
    expect(store.size).toBe(1); // read, never written
  });

  it("refuses a malformed seed or sheet", async () => {
    await expect(run({ seed: -1, picks: new Array(OMIB_FORM_ITEMS).fill(EMPTY_CELL) })).rejects.toThrow(/seed/);
    await expect(run({ seed: 3, picks: new Array(OMIB_FORM_ITEMS).fill(0) })).rejects.toThrow(/twenty-character/);
  });
});

// ── an adaptive attempt (D475, docs/OMIB-PLAN.md §3.3) ───────────────────
// DARK behind OMIB_SELECTION, so the emulator cannot mint one; this is
// where the per-item callable's branching is proved — the walk, the hold,
// the repeat, the out-of-step refusal, the lost final answer, and which
// ledger the counts fold into.
describe("an adaptive attempt", () => {
  const SEED = 4242;
  const next = (index: number, pick: unknown) =>
    (logicNextV2 as unknown as { run: (r: unknown) => Promise<Doc> }).run({ auth: { uid: UID }, data: { index, pick } });
  const openAdaptive = (over: Doc = {}) =>
    openAttempt({
      bank: "omib", gv: OMIB_BANK_VERSION, mode: "adaptive", seed: SEED, picks: [],
      startedAtMs: Date.now() - OMIB_FORM_ITEMS * LOGIC_MIN_MS_PER_ITEM - 1,
      ...over,
    });
  const keyOfNext = (picks: string[]) => OMIB_KEY[(replayAdaptive(SEED, picks).next as { n: number }).n];

  it("is minted with its first item only, the selection on the document", () => {
    const a = mintAttempt(null, Date.now(), SEED, "omib", "adaptive");
    expect(a.attempt).toMatchObject({ bank: "omib", mode: "adaptive", gv: OMIB_BANK_VERSION });
    expect(a.attempt.picks).toBeUndefined();
    expect(a.items).toEqual([{ code: omibNextItem(SEED, []).code }]);
    const s = mintAttempt(null, Date.now(), SEED, "omib", "stratified");
    expect(s.attempt.mode).toBe("stratified");
    expect(s.items).toHaveLength(OMIB_FORM_ITEMS);
    expect(mintAttempt(null, Date.now(), SEED, "omib").attempt.mode).toBe(OMIB_SELECTION);
  });

  it("walks the form one pick at a time, holding the picks and no timing, then scores and folds — into its own ledger", async () => {
    openAdaptive();
    const picks: string[] = [];
    for (let k = 0; k < OMIB_FORM_ITEMS - 1; k++) {
      const pick = keyOfNext(picks);
      const out = await next(k, pick);
      picks.push(pick);
      expect(out).toEqual({ items: [{ code: (replayAdaptive(SEED, picks).next as { code: string }).code }], index: k + 1, total: OMIB_FORM_ITEMS });
      const doc = store.get(ATTEMPT) as Doc;
      expect(doc.status).toBe("open");
      expect(doc.picks).toEqual(picks);
      // nothing per item but the cell: no item list, no arrival times
      expect(Object.keys(doc).sort()).toEqual(["bank", "dayKey", "deadlineMs", "gv", "mode", "normsCounted", "picks", "seed", "startedAtMs", "startsToday", "status"]);
      expect(store.has(`v2_users/${UID}`)).toBe(false);
    }
    const out = await next(OMIB_FORM_ITEMS - 1, keyOfNext(picks));
    expect(out).toMatchObject({ score: OMIB_FORM_ITEMS, bank: "omib", mode: "adaptive", seed: SEED, gv: OMIB_BANK_VERSION, source: "model" });
    expect(out.diffs).toHaveLength(OMIB_FORM_ITEMS);
    expect(out.marks).toEqual(new Array(OMIB_FORM_ITEMS).fill(true));
    const doc = store.get(ATTEMPT) as Doc;
    expect(doc.status).toBe("scored");
    expect(doc.picks).toHaveLength(OMIB_FORM_ITEMS);
    expect(doc.normsCounted).toBe(true);
    const result = ((store.get(`v2_users/${UID}`) as Doc).testResults as Doc).logic as Doc;
    expect(result).toMatchObject({ v: 3, verified: true, bank: "omib", mode: "adaptive", seed: SEED, theta: out.theta, se: out.se });
    // the θ histogram counts it like any first attempt…
    expect(store.get("v2_logic_norms_private/global")).toMatchObject({ bank: "omib", n: 1 });
    expect(store.get("v2_logic_norms/global")).toMatchObject({ bank: "omib", n: 1 });
    // …and the item counts go to the ADAPTIVE ledger, never the report's
    expect(store.has("v2_logic_norms_private/families")).toBe(false);
    expect(store.has("v2_logic_norms/families")).toBe(false);
    const ledger = store.get("v2_logic_norms_private/adaptive") as Doc;
    expect(ledger).toMatchObject({ bank: "omib", mode: "adaptive", n: 1 });
    expect(Object.keys(ledger).filter((k) => /^i_\d+_seen$/.test(k))).toHaveLength(OMIB_FORM_ITEMS);
    expect(store.get("v2_logic_norms/adaptive")).toMatchObject({ mode: "adaptive", n: 1 });
  });

  it("says the same thing twice to a client that did not hear it, and refuses one out of step", async () => {
    openAdaptive();
    const first = keyOfNext([]);
    const a = await next(0, first);
    const b = await next(0, first);
    expect(b).toEqual(a);
    expect((store.get(ATTEMPT) as Doc).picks).toEqual([first]);
    await expect(next(0, EMPTY_CELL)).rejects.toThrow(/expected the pick for item 2/);
    await expect(next(5, EMPTY_CELL)).rejects.toThrow(/expected the pick for item 2/);
    await expect(next(1, "1".repeat(19))).rejects.toThrow(/twenty-character/);
    await expect(next(OMIB_FORM_ITEMS, EMPTY_CELL)).rejects.toThrow(/index/);
    await expect(next(-1, EMPTY_CELL)).rejects.toThrow(/index/);
    expect((store.get(ATTEMPT) as Doc).picks).toEqual([first]);
  });

  it("hands the result over again when the final call's answer was lost, and refuses a different final pick", async () => {
    openAdaptive();
    for (let k = 0; k < OMIB_FORM_ITEMS - 1; k++) await next(k, EMPTY_CELL);
    const out = await next(OMIB_FORM_ITEMS - 1, EMPTY_CELL);
    expect(out).toMatchObject({ score: 0, mode: "adaptive" });
    const again = await next(OMIB_FORM_ITEMS - 1, EMPTY_CELL);
    expect(again).toEqual(out);
    await expect(next(OMIB_FORM_ITEMS - 1, "1".repeat(20))).rejects.toThrow(/already scored/);
    await expect(next(3, EMPTY_CELL)).rejects.toThrow(/already scored/);
    expect(store.get("v2_logic_norms_private/global")).toMatchObject({ n: 1 }); // folded once
  });

  it("refuses the one-shot submit on an adaptive attempt, and the per-item call on a stratified one", async () => {
    openAdaptive();
    const submitBlank = () =>
      (logicSubmitV2 as unknown as { run: (r: unknown) => Promise<unknown> }).run({
        auth: { uid: UID }, data: { picks: new Array(OMIB_FORM_ITEMS).fill(EMPTY_CELL) },
      });
    await expect(submitBlank()).rejects.toThrow(/item by item/);
    openAttempt({ bank: "omib", gv: OMIB_BANK_VERSION, mode: "stratified", seed: SEED });
    await expect(next(0, EMPTY_CELL)).rejects.toThrow(/not an adaptive attempt/);
    openAttempt({ bank: "omib", gv: OMIB_BANK_VERSION, seed: SEED }); // a pre-D475 document: stratified
    await expect(next(0, EMPTY_CELL)).rejects.toThrow(/not an adaptive attempt/);
  });

  it("refuses past the deadline, and a signed-out caller before touching the store", async () => {
    openAdaptive({ deadlineMs: Date.now() - 1 });
    await expect(next(0, EMPTY_CELL)).rejects.toThrow(/expired/);
    store.clear();
    await expect(
      (logicNextV2 as unknown as { run: (r: unknown) => Promise<unknown> }).run({ auth: null, data: { index: 0, pick: EMPTY_CELL } }),
    ).rejects.toThrow(/signed in/);
    expect(store.size).toBe(0);
  });
});

describe("adaptive practice", () => {
  const run = (data: unknown) =>
    (logicPracticeV2 as unknown as { run: (r: unknown) => Promise<Doc> }).run({ auth: { uid: UID }, data });

  it("starts with one item when asked for adaptive, and follows the server's selection otherwise", async () => {
    const a = await run({ mode: "adaptive" });
    expect(a).toMatchObject({ mode: "adaptive", total: OMIB_FORM_ITEMS });
    expect(a.items).toEqual([{ code: omibNextItem(a.seed as number, []).code }]);
    const d = await run({});
    expect(d.mode).toBe(OMIB_SELECTION);
    expect(d.items).toHaveLength(OMIB_SELECTION === "adaptive" ? 1 : OMIB_FORM_ITEMS);
    expect(store.size).toBe(0);
  });

  it("replays the picks so far to the next item, and scores at twenty-five — writing nothing", async () => {
    const { seed } = (await run({ mode: "adaptive" })) as { seed: number };
    const picks: string[] = [];
    for (let k = 0; k < OMIB_FORM_ITEMS; k++) {
      const out = await run({ seed, mode: "adaptive", picks });
      const it = replayAdaptive(seed, picks).next as { n: number; code: string };
      expect(out).toEqual({ items: [{ code: it.code }], index: k, total: OMIB_FORM_ITEMS });
      picks.push(OMIB_KEY[it.n]);
    }
    const s = await run({ seed, mode: "adaptive", picks });
    expect(s).toMatchObject({ practice: true, mode: "adaptive", bank: "omib", score: OMIB_FORM_ITEMS, seed, source: "model" });
    expect(store.size).toBe(0);
  });

  it("refuses more picks than the form has items, and a malformed cell", async () => {
    const { seed } = (await run({ mode: "adaptive" })) as { seed: number };
    await expect(run({ seed, mode: "adaptive", picks: new Array(OMIB_FORM_ITEMS + 1).fill(EMPTY_CELL) })).rejects.toThrow(/up to 25/);
    await expect(run({ seed, mode: "adaptive", picks: ["x"] })).rejects.toThrow(/up to 25/);
    await expect(run({ seed, mode: "adaptive", picks: "0".repeat(20) })).rejects.toThrow(/up to 25/);
  });
});
