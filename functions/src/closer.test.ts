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
  let cap = Infinity;
  let after: string | null = null;
  const q = {
    // The field and the operator are ASSERTED, not ignored. A fake that
    // takes any `where` would keep passing if the closer started filtering
    // on the wrong field — real Firestore would return nothing and the
    // test would still be green, which is the failure this whole file
    // exists to prevent one level up.
    where: (f: string, op: string, v: unknown) => {
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
const refundsByIntent = new Map<string, Array<{ id: string }>>();
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
        const made = { id: `re_${stripeCalls.created.length}` };
        refundsByIntent.set(body.payment_intent, [...(refundsByIntent.get(body.payment_intent) ?? []), made]);
        return made;
      },
    };
  },
}));

const { closePaidCampaignsV2, CLOSER_PAGE, CLOSER_MAX_PAGES } = await import("./paid");

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
    refundsByIntent.set("pi_p2", [{ id: "re_from_the_dead_run" }]);
    purchases.push(owed("p2"));
    await runCloser();
    expect(stripeCalls.created, "the buyer was refunded twice").toHaveLength(0);
    expect(stateOf("p2")).toBe("closed");
    const closed = purchases.find((r) => r.id === "p2")!.data.closed as { refundId?: string };
    expect(closed.refundId, "the refund that really happened was not recorded").toBe("re_from_the_dead_run");
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
