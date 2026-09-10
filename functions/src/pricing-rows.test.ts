// pricing-rows.test.ts — the pricing fold reads the rows it is about.
//
// `publishPricing` asks for every purchase whose window ended inside the
// lookback or has not ended yet, and caps the read so a scheduled job
// cannot grow an unbounded one. There was no `orderBy`, and an inequality
// forces Firestore's implicit ordering: ASCENDING on the inequality
// field. So the rows kept were the OLDEST-ENDING ones and the first
// dropped were those ending furthest out — which is every campaign still
// running.
//
// Those are the rows the demand index is made of: `foldPricing` filters
// `state === "running"` and asks which of the next fourteen days each one
// covers. Truncated away, the crowd comes back all-zero and the index
// collapses to the floor — the door prints a free, floor-priced fortnight
// over a sold-out rotation, and the quote a buyer locks is taken off that
// card. The bound is also below the file's own stated maximum: at one
// slot per scope per day over the 366-day lookback, three scopes reach
// ~1098 rows before a single second booking.
//
// THE FAKE MODELS THE ORDERING, which is the whole point — a fake that
// hands back its rows in insertion order proves nothing about a query
// whose bug IS the order. It sorts ascending on the inequality field when
// no orderBy is given, exactly as Firestore does, and by the explicit
// orderBy when there is one.
import { describe, expect, it, vi } from "vitest";

vi.mock("firebase-functions", () => ({
  logger: { info: () => {}, warn: () => {}, error: () => {} },
}));
vi.mock("firebase-admin/firestore", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  FieldValue: { serverTimestamp: () => "T" },
}));

const { publishPricing, PRICING_ROWS_MAX, PRICING_ROWS_DAYS } = await import("./paid");

type Row = { kind: string; scope: string; state: string; qid?: string; window: { start: string; until: string } };

const day = (n: number): string => {
  const d = new Date(Date.UTC(2026, 8, 10) + n * 86400000);
  return d.toISOString().slice(0, 10);
};

/** Enough running campaigns to move the index off its floor: the card
 *  gives the first `crowdFree` (3) away, so a difference needs more. */
const RUNNING = 6;

function fakeDb(rows: Row[]) {
  const published: Record<string, unknown>[] = [];
  const q = (where: [string, string, string][], order: [string, string] | null, lim: number | null) => ({
    where: (f: string, op: string, v: string) => q([...where, [f, op, v]], order, lim),
    orderBy: (f: string, dir = "asc") => q(where, [f, dir], lim),
    limit: (n: number) => q(where, order, n),
    async get() {
      let out = rows.filter((r) => where.every(([f, op, v]) => {
        const got = f === "window.until" ? r.window.until : String((r as Record<string, unknown>)[f] ?? "");
        return op === ">=" ? got >= v : op === "<=" ? got <= v : got === v;
      }));
      // Firestore's rule: an inequality forces an implicit ascending sort
      // on its own field unless an explicit orderBy says otherwise.
      const [f, dir] = order ?? [where.find(([, op]) => op !== "==")?.[0] ?? "", "asc"];
      const key = (r: Row) => (f === "window.until" ? r.window.until : String((r as Record<string, unknown>)[f] ?? ""));
      out = [...out].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
      if (dir === "desc") out.reverse();
      if (lim != null) out = out.slice(0, lim);
      return { size: out.length, docs: out.map((r) => ({ data: () => r, exists: true, get: () => null })) };
    },
  });
  const db = {
    collection: (name: string) => {
      if (name === "v2_purchases") return q([], null, null);
      if (name === "v2_meta") return { doc: () => ({ set: async (v: Record<string, unknown>) => { published.push(v); } }) };
      return { doc: () => ({ get: async () => ({ exists: false, get: () => null }) }) };
    },
  };
  return { db, published };
}

/** A ledger where the running campaigns end FURTHEST OUT, which is what
 *  running means, and the closed ones fill the cap. */
function ledger(): Row[] {
  const closed: Row[] = [];
  for (let i = 0; i < PRICING_ROWS_MAX; i++) {
    // Ended inside the lookback, so every one of these is in range.
    closed.push({ kind: "question", scope: "world", state: "closed", window: { start: day(-360 + (i % 300)), until: day(-300 + (i % 200)) } });
  }
  const running: Row[] = [];
  for (let i = 0; i < RUNNING; i++) {
    running.push({ kind: "question", scope: "world", state: "running", qid: `q${i}`, window: { start: day(-1), until: day(20 + i) } });
  }
  return [...closed, ...running];
}

describe("publishPricing reads the rows the index is made of", () => {
  it("keeps the running campaigns when the ledger is over the cap", async () => {
    const { db, published } = fakeDb(ledger());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await publishPricing(db as any, day(0))).toBe(true);
    const live = published[0] as { cohorts: Record<string, { idx: number; crowd: number[] }> };
    const world = live.cohorts.world;
    // Every day of the fortnight is covered by all six, so the crowd is
    // six deep and the index has climbed off its floor. Ascending
    // truncation drops all six and gives zeros at the floor price.
    expect(world.crowd.every((n) => n === RUNNING), `the rotation read as ${JSON.stringify(world.crowd)}`).toBe(true);
    expect(world.idx).toBeGreaterThan(1);
  });

  it("…and the fake really does cap, keeping the newest-ending rows", async () => {
    // ASKED OF THE FAKE DIRECTLY, because the fake is the thing under
    // suspicion. This used to assert only that the fixture exceeded the
    // cap and that a small ledger priced the same — and neither of those
    // fails when the cap is removed from the fake, because the closed
    // rows contribute nothing to the index either way. So the case named
    // a failure mode ("a fake that quietly returned everything") that it
    // could not detect, inside the commit whose whole subject is that
    // class. Measured: deleting the slice left both cases green.
    const rows = ledger();
    expect(rows.length).toBeGreaterThan(PRICING_ROWS_MAX);
    const { db } = fakeDb(rows);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const snap = await (db as any).collection("v2_purchases")
      .where("window.until", ">=", day(-PRICING_ROWS_DAYS))
      .orderBy("window.until", "desc")
      .limit(PRICING_ROWS_MAX)
      .get();
    expect(snap.docs.length, "the fake did not cap — the case above proves nothing about a cap")
      .toBe(PRICING_ROWS_MAX);
    // …and the rows it kept are the newest-ending ones, which is the
    // half the ordering is for: all six running campaigns survive.
    const kept = snap.docs.map((d: { data: () => Row }) => d.data());
    expect(kept.filter((r: Row) => r.state === "running"),
      "the cap dropped a running campaign — the defect itself").toHaveLength(RUNNING);

    // A ledger UNDER the cap prices identically, so the first case is
    // about the cap rather than about the fixture being large.
    const few = fakeDb(rows.slice(PRICING_ROWS_MAX));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await publishPricing(few.db as any, day(0));
    const big = fakeDb(rows);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await publishPricing(big.db as any, day(0));
    const idx = (p: Record<string, unknown>[]) =>
      (p[0] as { cohorts: Record<string, { idx: number }> }).cohorts.world.idx;
    expect(idx(few.published)).toBe(idx(big.published));
  });
});
