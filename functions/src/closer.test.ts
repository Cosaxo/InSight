// closer.test.ts — the nightly campaign closer, walked past its first page.
//
// WHY THIS FILE EXISTS. `closePaidCampaignsV2` had no test of any kind,
// and it took ONE page of 200 running purchases. A purchase leaves
// "running" only when this job closes it, so past 200 concurrent
// campaigns the same first 200 by document id came back every night and
// anything beyond the cut was never looked at: window over, refund owed,
// nothing ever paid, and no log line saying the closer had run out of
// page. The buyer's side of that is a campaign that never settles.
//
// WHAT THE FAKE IS AND IS NOT. It stands in for Firestore's query
// plumbing — an equality filter, id ordering, limit, startAfter — because
// the property under test is the closer's own control flow: does it ask
// for a second page, does a full page of still-serving campaigns stop the
// walk, does the bound announce itself. Nothing here asserts anything
// about Firestore. The assertions are all about which purchases the
// closer actually closed.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { logger } from "firebase-functions";

type Rec = { id: string; data: Record<string, unknown> };

const purchases: Rec[] = [];
/** Every purchase query the closer issued, so "asks once" is countable. */
const queries: Array<{ after: string | null }> = [];
const aggs = new Map<string, Record<string, number>>();
const deletedAds: string[] = [];
/** Every v2_meta write the run made — the rate card republish (D371). */
const published: Array<{ id: string; data: Record<string, unknown> }> = [];

function snapOf(r: Rec) {
  return {
    id: r.id,
    exists: true,
    get: (f: string) => r.data[f],
    ref: {
      update: async (d: Record<string, unknown>) => {
        r.data = { ...r.data, ...d };
      },
    },
  };
}

function purchaseQuery() {
  let eq: unknown = null;
  let untilFrom: string | null = null;
  let cap = Infinity;
  let after: string | null = null;
  const q = {
    // The field and the operator are ASSERTED, not ignored. A fake that
    // takes any `where` would keep passing if the closer started filtering
    // on the wrong field — real Firestore would return nothing and the
    // test would still be green, which is the failure this whole file
    // exists to prevent one level up.
    where: (f: string, op: string, v: unknown) => {
      // Two shapes reach this fake since D371: the closer's own
      // `state == running` walk, and the pricing fold's `window.until >=`
      // range at the end of the run. Anything else is the wrong field.
      if (f === "window.until" && op === ">=") { untilFrom = String(v); return q; }
      expect([f, op]).toEqual(["state", "=="]);
      eq = v;
      return q;
    },
    orderBy: (f: unknown) => {
      // Likewise the order: `startAfter` is only meaningful against it.
      expect(String(f)).toBe("__name__");
      return q;
    },
    limit: (n: number) => { cap = n; return q; },
    startAfter: (s: { id: string }) => { after = s.id; return q; },
    get: async () => {
      if (untilFrom !== null) {
        // The fold's read: every row whose window ended on or after the
        // cutoff. Not counted in `queries` — those are the closer's pages.
        const docs = purchases
          .filter((r) => String((r.data.window as { until?: string })?.until ?? "") >= (untilFrom as string))
          .slice(0, cap)
          .map((r) => ({ ...snapOf(r), data: () => r.data }));
        return { docs, empty: docs.length === 0, size: docs.length };
      }
      queries.push({ after });
      // Evaluated live, like the real query: docs this run has already
      // closed have left the "running" set. Safe because the cursor only
      // ever moves forward by id.
      let rows = purchases
        .filter((r) => r.data.state === eq)
        .sort((a, b) => a.id.localeCompare(b.id));
      if (after !== null) rows = rows.filter((r) => r.id > (after as string));
      const docs = rows.slice(0, cap).map(snapOf);
      return { docs, empty: docs.length === 0, size: docs.length };
    },
  };
  return q;
}

const fakeDb = {
  collection(name: string) {
    if (name === "v2_purchases") return purchaseQuery();
    if (name === "v2_question_aggs") {
      return {
        doc: (id: string) => ({
          get: async () => ({
            exists: aggs.has(id),
            get: (f: string) => (f === "counts" ? aggs.get(id) : undefined),
          }),
        }),
      };
    }
    if (name === "v2_ads") {
      return { doc: (id: string) => ({ delete: async () => { deletedAds.push(id); } }) };
    }
    if (name === "v2_meta") {
      // The nightly republish (D371) lands here; what was written is
      // what the door will print tomorrow.
      return { doc: (id: string) => ({ set: async (d: Record<string, unknown>) => { published.push({ id, data: d }); } }) };
    }
    throw new Error(`unexpected collection ${name}`);
  },
};

vi.mock("./db", () => ({ db: () => fakeDb, FIRESTORE_DB_ID: "insight" }));

// The refund side, as thin as the db fake and for the same reason: what is
// under test is the closer's control flow around the money, not Stripe.
// `refunds.list` answers what has already been paid back on an intent,
// which is the question the closer has to ask before it pays.
const stripeCalls = {
  created: [] as Array<{ intent: string; amount: number; key: string | undefined }>,
  listed: [] as string[],
};
// `amount` in CENTS and `status`, because the closer now reads both: it
// records what actually went back rather than what was owed, and a failed
// or canceled refund is not money returned.
const refundsByIntent = new Map<string, Array<{ id: string; amount: number; status?: string }>>();
vi.mock("stripe", () => ({
  default: class {
    refunds = {
      list: async ({ payment_intent: pi }: { payment_intent: string }) => {
        stripeCalls.listed.push(pi);
        return { data: refundsByIntent.get(pi) ?? [] };
      },
      create: async (
        body: { payment_intent: string; amount: number },
        opts?: { idempotencyKey?: string },
      ) => {
        stripeCalls.created.push({
          intent: body.payment_intent, amount: body.amount, key: opts?.idempotencyKey,
        });
        const made = { id: `re_${stripeCalls.created.length}`, amount: body.amount, status: "succeeded" };
        refundsByIntent.set(body.payment_intent, [...(refundsByIntent.get(body.payment_intent) ?? []), made]);
        return made;
      },
    };
  },
}));

const { closePaidCampaignsV2, CLOSER_PAGE, CLOSER_MAX_PAGES } = await import("./paid");
// The committed card the closer's fold reads its clamps from — the
// expectations below are arithmetic over it, not today's numbers.
const { PRICING_CARD } = await import("./pricing");

const YESTERDAY = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const NEXT_YEAR = "2099-01-01";

function purchase(id: string, until: string) {
  return {
    id,
    data: {
      state: "running",
      kind: "question",
      qid: `q_${id}`,
      window: { until },
      budget: { cap: 0, capEur: 0, ratePerAnswer: 0 },
    } as Record<string, unknown>,
  };
}

/** Ids sort the way Firestore sorts them: lexicographically, so pad. */
const idAt = (n: number) => `p${String(n).padStart(5, "0")}`;

async function runCloser() {
  await (closePaidCampaignsV2 as unknown as { run: (e: unknown) => Promise<void> })
    .run({ scheduleTime: new Date().toISOString() });
}

const stateOf = (id: string) => purchases.find((r) => r.id === id)?.data.state;

beforeEach(() => {
  purchases.length = 0;
  queries.length = 0;
  deletedAds.length = 0;
  published.length = 0;
  aggs.clear();
  stripeCalls.created.length = 0;
  stripeCalls.listed.length = 0;
  refundsByIntent.clear();
  delete process.env.STRIPE_SECRET_KEY;
});

describe("the closer never refunds the same campaign twice", () => {
  // The refund moves money and the purchase is marked closed AFTER it. A
  // timeout in that window leaves the row `running` with the money already
  // sent, and `until < today` stays true forever — so the next night
  // recomputes the same amount and pays it again. Under the cap that is a
  // silent second refund; over it, Stripe rejects, the catch holds the
  // purchase open, and the campaign can never close.
  const owed = (id: string) => ({
    id,
    data: {
      state: "running",
      kind: "question",
      qid: `q_${id}`,
      window: { until: YESTERDAY },
      // 100 answers bought at €1, none served: the whole €100 comes back.
      budget: { cap: 100, capEur: 100, ratePerAnswer: 1 },
      stripePaymentIntent: `pi_${id}`,
    } as Record<string, unknown>,
  });

  it("asks what has already been refunded before paying, and pays with a key", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_closer";
    purchases.push(owed("p1"));
    await runCloser();
    expect(stripeCalls.listed, "it paid without asking").toEqual(["pi_p1"]);
    expect(stripeCalls.created).toHaveLength(1);
    expect(stripeCalls.created[0].amount).toBe(10000);
    expect(stripeCalls.created[0].key, "a retry inside 24h would pay twice").toBe("close_p1");
    expect(stateOf("p1")).toBe("closed");
  });

  it("closes without a second transfer when the crash already paid", async () => {
    // The exact survivor of a crash between the transfer and the write:
    // the money is gone, the row still says running.
    process.env.STRIPE_SECRET_KEY = "sk_test_closer";
    refundsByIntent.set("pi_p2", [{ id: "re_from_the_dead_run", amount: 10000, status: "succeeded" }]);
    purchases.push(owed("p2"));
    await runCloser();
    expect(stripeCalls.created, "the buyer was refunded twice").toHaveLength(0);
    expect(stateOf("p2")).toBe("closed");
    const closed = purchases.find((r) => r.id === "p2")!.data.closed as { refundId?: string };
    expect(closed.refundId, "the refund that really happened was not recorded").toBe("re_from_the_dead_run");
  });

  it("records what was SENT, not what was owed, when a hand refund was partial", async () => {
    // The record is what a dispute is read against. This took the FIRST
    // prior refund and then wrote `refundEur` — the amount owed — into
    // `closed`, whatever had actually gone back. An operator issuing a
    // partial refund in the Stripe dashboard therefore closed the campaign
    // with the remainder neither paid nor flagged, and the contract record
    // saying it had been settled in full.
    process.env.STRIPE_SECRET_KEY = "sk_test_closer";
    refundsByIntent.set("pi_p3", [{ id: "re_hand_partial", amount: 4000, status: "succeeded" }]);
    purchases.push(owed("p3"));
    await runCloser();
    expect(stripeCalls.created, "a partial prior refund triggered a second transfer").toHaveLength(0);
    const closed = purchases.find((r) => r.id === "p3")!.data.closed as
      { refundEur: number; refundedEur: number };
    expect(closed.refundEur, "what was owed stopped being recorded").toBe(100);
    expect(closed.refundedEur, "the record claims the full amount went back").toBe(40);
  });

  it("does not count a failed refund as money returned", async () => {
    // The control on the filter. Without it a refund Stripe rejected would
    // read as a prior payment, and the closer would close the campaign
    // having sent nothing at all.
    process.env.STRIPE_SECRET_KEY = "sk_test_closer";
    refundsByIntent.set("pi_p4", [{ id: "re_failed", amount: 10000, status: "failed" }]);
    purchases.push(owed("p4"));
    await runCloser();
    expect(stripeCalls.created, "a failed refund was read as money already returned").toHaveLength(1);
    const closed = purchases.find((r) => r.id === "p4")!.data.closed as { refundedEur: number };
    expect(closed.refundedEur).toBe(100);
  });

  it("adds up several prior refunds rather than reading the first", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_closer";
    refundsByIntent.set("pi_p5", [
      { id: "re_a", amount: 3000, status: "succeeded" },
      { id: "re_b", amount: 7000, status: "succeeded" },
    ]);
    purchases.push(owed("p5"));
    await runCloser();
    expect(stripeCalls.created).toHaveLength(0);
    const closed = purchases.find((r) => r.id === "p5")!.data.closed as { refundedEur: number };
    expect(closed.refundedEur, "only the first of two refunds was counted").toBe(100);
  });
});

describe("the campaign closer walks past its first page", () => {
  it("closes an expired campaign that sits beyond the first page", async () => {
    for (let i = 0; i < CLOSER_PAGE + 50; i++) purchases.push(purchase(idAt(i), YESTERDAY));
    await runCloser();
    expect(purchases.every((r) => r.data.state === "closed")).toBe(true);
    // Named explicitly, because "all of them" is the assertion a
    // single-page closer also satisfies when the set is small.
    expect(stateOf(idAt(CLOSER_PAGE))).toBe("closed");
    expect(stateOf(idAt(CLOSER_PAGE + 49))).toBe("closed");
  });

  it("a FULL page of still-serving campaigns does not end the walk", async () => {
    // The starvation shape exactly: the cut is full of campaigns that are
    // skipped rather than closed, so nothing about the first page tells
    // the closer there is no more work. The one expired campaign sits
    // behind all of them.
    for (let i = 0; i < CLOSER_PAGE; i++) purchases.push(purchase(idAt(i), NEXT_YEAR));
    purchases.push(purchase(idAt(CLOSER_PAGE), YESTERDAY));
    await runCloser();
    expect(stateOf(idAt(CLOSER_PAGE))).toBe("closed");
    // …and the ones still serving are untouched, not swept up with it.
    expect(stateOf(idAt(0))).toBe("running");
    expect(purchases.filter((r) => r.data.state === "closed")).toHaveLength(1);
  });

  it("stops at its page bound and SAYS so, rather than capping quietly", async () => {
    // The bound is there so one run cannot walk forever. The single page
    // it replaces was itself a silent cap; this one has to be audible or
    // the same failure returns wearing a bigger number.
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
    try {
      const n = CLOSER_PAGE * CLOSER_MAX_PAGES + 10;
      for (let i = 0; i < n; i++) purchases.push(purchase(idAt(i), NEXT_YEAR));
      await runCloser();
      const capped = warn.mock.calls.find(
        (c) => (c[1] as { metric?: string })?.metric === "paid_closer_page_cap");
      expect(capped).toBeTruthy();
      expect(capped?.[1]).toMatchObject({ pages: CLOSER_MAX_PAGES });
    } finally {
      warn.mockRestore();
    }
  });

  it("an empty collection asks once and stops", async () => {
    // The other end: no running purchases must not loop, and must not read
    // a second page to find that out.
    //
    // COUNTING THE QUERIES, because the assertion this used to make —
    // that the seeded-nothing list is still empty — is a fact `beforeEach`
    // establishes and the closer cannot change. It could not fail, and it
    // stood as claimed coverage for the loop's termination.
    await runCloser();
    expect(queries, "an empty first page must end the walk").toHaveLength(1);
    expect(queries[0].after, "the first query carries no cursor").toBeNull();
    expect(purchases).toHaveLength(0);
  });

  it("stops on a SHORT page too, without asking for the one after it", async () => {
    // The other termination arm, and the one that runs in practice: a page
    // that comes back under the limit is the end of the collection.
    for (let i = 0; i < 3; i++) purchases.push(purchase(idAt(i), YESTERDAY));
    await runCloser();
    expect(queries).toHaveLength(1);
    expect(purchases.every((r) => r.data.state === "closed")).toBe(true);
  });
});

describe("the closer republishes the rate card (D371)", () => {
  // The demand half of the card used to move only when an operator ran
  // scripts/build-pricing.mjs and committed the result — which, once
  // D313 automated the sale, was never. The nightly run is where a window
  // that ended tonight leaves the index and the booked strip rolls a day,
  // so it folds the ledger at the end of every walk, sale or no sale.
  it("publishes v2_meta/pricing at the end of every run, even with nothing to close", async () => {
    await runCloser();
    expect(published.map((p) => p.id)).toEqual(["pricing"]);
    const card = published[0].data as { generated: string; cohorts: Record<string, { idx: number; booked: number[] }> };
    expect(card.generated).toBe(new Date().toISOString().slice(0, 10));
    for (const scope of ["city", "country", "world"]) {
      expect(card.cohorts[scope].idx).toBe(PRICING_CARD.floorX);
      expect(card.cohorts[scope].booked).toHaveLength(14);
    }
  });

  it("folds what it just closed — the campaign leaves the rotation and becomes an estimate's basis", async () => {
    const start = new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10);
    purchases.push({
      id: "p_city", data: {
        state: "running", kind: "question", scope: "city", qid: "q_p_city",
        window: { start, until: YESTERDAY },
        budget: { cap: 100, capEur: 100, ratePerAnswer: 1 },
      },
    });
    aggs.set("q_p_city", { "0": 30, "1": 20 });
    await runCloser();
    expect(stateOf("p_city")).toBe("closed");
    const card = published.at(-1)!.data as {
      cohorts: Record<string, { idx: number; crowd: number[] }>;
      estimates: Record<string, { perDay: number; campaigns: number; days: number }>;
    };
    // Closed tonight, so it is in nobody's rotation tomorrow: the index
    // reads crowding ahead (D373), and this scope has none left.
    const { floorX } = PRICING_CARD;
    expect(card.cohorts.city.idx).toBe(floorX);
    expect(card.cohorts.city.crowd).toEqual(Array(14).fill(0));
    expect(card.cohorts.world.idx).toBe(floorX);
    // …and the campaign it closed tonight is already an estimate's basis,
    // off the answer total the closer itself wrote: 50 answers over the
    // 28 inclusive days of the window (today−28 through yesterday).
    expect(card.estimates.city).toEqual({ perDay: Math.round(50 / 28), campaigns: 1, days: 28 });
  });
});
