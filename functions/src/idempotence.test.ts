// idempotence.test.ts — the ledger guard, executed rather than described.
//
// WHY THIS FILE EXISTS. `onV2AnswerCreated` and `onV2AnswerUpdated` are
// declared `retry: true`, which is right: a fold that dies must come back.
// The price is that Eventarc delivers AT LEAST ONCE, so every arm reads a
// per-event ledger doc first and returns if it is already there. Four
// `if (seen.exists) return;` lines carry the whole property.
//
// All four could be DELETED with the entire suite still green. Nothing
// executed them: replay.test.ts transcribes the fold and compares
// accumulation strategies, contention.test.ts stubs runAggTransaction
// away, and the emulator suites deliver each event once because that is
// what a healthy emulator does. A second delivery is exactly the thing no
// test could produce — and a lost guard is not a crash, it is a public
// vote count that quietly reads one too many, on the retry path that only
// runs when something already went wrong.
//
// WHAT THE FAKE IS AND IS NOT. It stands in for Firestore's PLUMBING —
// refs, a transaction, getAll, set/update — not for its semantics, and
// nothing here asserts anything about Firestore. The property under test
// is this file's own branching: read the ledger, return, or fold and mark.
// The vacuity guards below are what keep that honest: every arm must count
// TWICE under two different event ids, or "counted once" would also be
// what a handler that never ran looks like.
import { describe, it, expect, vi, beforeEach } from "vitest";

type Doc = Record<string, unknown>;
const store = new Map<string, Doc>();

function ref(path: string): { path: string; id: string; collection: (sub: string) => { doc: (id: string) => ReturnType<typeof ref> } } {
  return {
    path,
    id: path.split("/").pop() as string,
    // A document's subcollection, for the answer map under the person's
    // document (v2_users/{uid}/public/answers — DATA-EFFICIENCY-RUNBOOK
    // 3.2), which the trigger now reaches through the ref it already has.
    collection: (sub: string) => ({ doc: (id: string) => ref(`${path}/${sub}/${id}`) }),
  };
}

const fakeDb = {
  collection(name: string) {
    return { doc: (id: string) => ref(`${name}/${id}`) };
  },
  async runTransaction(cb: (tx: unknown) => Promise<unknown>) {
    const snap = (r: { path: string }) => ({
      exists: store.has(r.path),
      get: (f: string) => store.get(r.path)?.[f],
    });
    const tx = {
      getAll: async (...refs: { path: string }[]) => refs.map(snap),
      get: async (r: { path: string }) => snap(r),
      // A merge merges MAPS a level down too, as Firestore's does: the
      // answer map's `a` (DATA-EFFICIENCY-RUNBOOK 3.2) gains a key per
      // answer, and a fake that replaced `a` whole would pass a write
      // that wiped every earlier answer — the plumbing being thinner
      // than the thing it stands in for, which this file's header names.
      set: (r: { path: string }, data: Doc, opts?: { merge?: boolean; mergeFields?: string[] }) => {
        // …and `mergeFields` replaces the NAMED top-level fields whole,
        // leaving the rest, which is the difference the honest-anchor
        // correction turns on: `merge` masks leaf paths and therefore
        // cannot remove a key the write does not carry, while naming the
        // field replaces the map. A fake that treated this option as
        // "not a merge" would model `merge: false` and wipe the document
        // — the repair the code's own comment says is the wrong one.
        if (opts?.mergeFields) {
          const prev = store.get(r.path) || {};
          const next: Doc = { ...prev };
          for (const f of opts.mergeFields) next[f] = data[f];
          store.set(r.path, next);
          return;
        }
        if (!opts?.merge) { store.set(r.path, data); return; }
        const prev = store.get(r.path) || {};
        const next: Doc = { ...prev };
        for (const [k, v] of Object.entries(data)) {
          const old = prev[k];
          next[k] = v && typeof v === "object" && !Array.isArray(v) && old && typeof old === "object" && !Array.isArray(old)
            ? { ...(old as Doc), ...(v as Doc) }
            : v;
        }
        store.set(r.path, next);
      },
      update: (r: { path: string }, data: Doc) => {
        store.set(r.path, { ...(store.get(r.path) || {}), ...data });
      },
    };
    return cb(tx);
  },
};

vi.mock("./db", () => ({ db: () => fakeDb, FIRESTORE_DB_ID: "insight" }));

const { onV2AnswerCreated, onV2AnswerUpdated } = await import("./v2");
const { setLogWriterForTest } = await import("./log");
type LogRowT = import("./log").LogRow;

/** The answer log's writer, injected: one row per COMMITTED ledger entry,
 *  none on the redelivery the ledger mark turns away (log.ts, D447). */
function fakeLog() {
  const rows: LogRowT[] = [];
  setLogWriterForTest({ enabled: true, rows: undefined, async append(r: readonly LogRowT[]) { rows.push(...r); }, async presentIds() { return new Set<string>(); }, async deleteUsers() { return "done" as const; }, async tableBytes() { return null; }, async rowsFor() { return null; }, async shadowRows() { return null; }, async shadowFold() { return null; } } as never);
  return rows;
}

const QID = "daily-2026-08-24";
const AGG = `v2_question_aggs/${QID}`;
const PRIV = `v2_aggs_private/${QID}`;

/** One create delivery. `id` is the Eventarc event id — the ledger key. */
async function deliver(id: string, data: Doc) {
  await (onV2AnswerCreated as unknown as { run: (e: unknown) => Promise<void> }).run({
    id,
    params: { uid: "u1", qid: QID },
    // `ref` because a real DocumentSnapshot carries one and the honest-anchor
    // correction (D410) writes through it. The fake had no ref at all, which
    // is the harness being thinner than the thing it stands in for — the
    // trigger is not guarded against a missing ref on purpose, so a snapshot
    // without one is a test-fixture bug and should read as one.
    data: { exists: true, ref: ref(`v2_users/u1/answers/${QID}`), get: (f: string) => data[f] },
  });
}

/** One update delivery: the same answer doc, optionIdx moved. */
async function deliverEdit(id: string, from: number, to: number, anchors?: Doc) {
  const doc = (optionIdx: number) => ({
    exists: true,
    // The anchors snapshot is FROZEN by rules, so the real edit event
    // carries the same one the create did — the CLAIM, which is not the
    // same thing as the honest set. This comment used to stop at "and the
    // breakdown retarget reads it off the `after` document", which was
    // true and was the bug: the create trigger corrects the stored anchors
    // (D410) and an event payload is a point-in-time snapshot, so an edit
    // written before that correction landed carries a cohort the create
    // already threw away. The retarget re-reads the document now. Optional
    // here so the cases that are only about counts stay as small as they
    // were.
    get: (f: string) => ({ surface: "daily", optionIdx, ...(anchors ? { anchors } : {}) } as Doc)[f],
  });
  await (onV2AnswerUpdated as unknown as { run: (e: unknown) => Promise<void> }).run({
    id,
    params: { uid: "u1", qid: QID },
    data: { before: doc(from), after: doc(to) },
  });
}

const vote = { surface: "daily", optionIdx: 1, anchors: { ageBand: "25-34", country: "NO" } };
const rank = { surface: "daily", order: [2, 0, 1], anchors: {} };
const pick = { surface: "daily", entity: 25, anchors: {} };

beforeEach(() => {
  store.clear();
  // The author's profile, which the create fold now reads (D410) to check
  // the answer's cohort is the author's own. Every real answer follows a
  // profile write — `saveAnchors` writes the profile, and Firestore keeps a
  // client's writes in order — so a fixture without one was describing a
  // state the app cannot produce. The anchors here match what `vote` claims,
  // so these cases stay about idempotence and nothing else.
  store.set("v2_users/u1", { anchors: { ageBand: "25-34", country: "NO" } });
});

describe("a redelivered event folds once (retry: true is at-least-once)", () => {
  it("the vote arm", async () => {
    await deliver("evt-1", vote);
    await deliver("evt-1", vote);
    expect(store.get(AGG)?.total).toBe(1);
    expect((store.get(AGG)?.counts as Doc)["1"]).toBe(1);
  });

  it("the vote arm still counts two DIFFERENT events", async () => {
    // The vacuity guard. Without it, an arm that returned before doing
    // anything at all would pass the test above.
    await deliver("evt-1", vote);
    await deliver("evt-2", vote);
    expect(store.get(AGG)?.total).toBe(2);
  });

  it("the rank arm", async () => {
    store.set(`v2_questions/${QID}`, { options: ["a", "b", "c"] });
    await deliver("evt-1", rank);
    const once = store.get(AGG)?.pos;
    await deliver("evt-1", rank);
    expect(store.get(AGG)?.pos).toEqual(once);
    expect(store.get(AGG)?.total).toBe(1);
  });

  it("the rank arm still counts two DIFFERENT events", async () => {
    store.set(`v2_questions/${QID}`, { options: ["a", "b", "c"] });
    await deliver("evt-1", rank);
    await deliver("evt-2", rank);
    expect(store.get(AGG)?.total).toBe(2);
  });

  it("the catalog arm", async () => {
    store.set(`v2_questions/${QID}`, { domain: "pokemon" });
    await deliver("evt-1", pick);
    await deliver("evt-1", pick);
    expect(store.get(PRIV)?.total).toBe(1);
    expect((store.get(PRIV)?.ent as Doc)["25"]).toBe(1);
  });

  it("the catalog arm still counts two DIFFERENT events", async () => {
    store.set(`v2_questions/${QID}`, { domain: "pokemon" });
    await deliver("evt-1", pick);
    await deliver("evt-2", pick);
    expect(store.get(PRIV)?.total).toBe(2);
  });

  it("the edit arm, where a second fold would move the vote twice", async () => {
    // The one arm where a lost guard does not merely inflate: the edit
    // moves a vote from one option to another, so folding it twice takes
    // a second vote off the old option — one it may not have.
    await deliver("evt-1", vote);
    await deliver("evt-2", { ...vote, optionIdx: 1 });
    await deliverEdit("edit-1", 1, 0);
    await deliverEdit("edit-1", 1, 0);
    const counts = store.get(AGG)?.counts as Doc;
    expect(counts["0"]).toBe(1);
    expect(counts["1"]).toBe(1);
  });

  it("the edit arm still applies two DIFFERENT events", async () => {
    await deliver("evt-1", vote);
    await deliver("evt-2", { ...vote, optionIdx: 1 });
    await deliverEdit("edit-1", 1, 0);
    await deliverEdit("edit-2", 1, 0);
    const counts = store.get(AGG)?.counts as Doc;
    expect(counts["0"]).toBe(2);
    // Emptied, not zeroed — retargetCounts deletes a key it takes to zero,
    // because the create path never mints one (pure.ts).
    expect(counts["1"]).toBeUndefined();
  });

  it("an edit's ledger entry records what it moved FROM", async () => {
    // Not idempotence, but the same file's reach: this harness is the only
    // place the real edit trigger runs, and `fromIdx` is what lets a
    // reader tell a D86 edit from a first answer. The nightly patterns fit
    // is built on that distinction — without the field it counts one
    // person twice and publishes a basis that reads healthy and is not.
    // Removing the argument from the write left the whole functions suite
    // green, which is why this case exists.
    await deliver("evt-1", vote);
    await deliverEdit("edit-1", 1, 0);
    const entry = store.get("v2_agg_events/edit-1");
    expect(entry, "the edit wrote no ledger entry at all").toBeTruthy();
    expect(entry!.fromIdx).toBe(1);
    expect(entry!.optionIdx).toBe(0);
    // …and a CREATE carries none: its absence is the marker.
    expect(store.get("v2_agg_events/evt-1")).not.toHaveProperty("fromIdx");
  });

  it("the answer map gains the entry in the create's own transaction, moves on an edit, and a redelivery changes nothing (DATA-EFFICIENCY-RUNBOOK 3.2)", async () => {
    const MAP = "v2_users/u1/public/answers";
    await deliver("evt-1", vote);
    const first = store.get(MAP) as { a?: Record<string, number> } | undefined;
    expect(first?.a, "the create wrote no map entry").toEqual({ [QID]: 1 });
    // a second question adds a key and keeps the first — the merge is the
    // whole contract, since the map is rewritten on every answer
    await (onV2AnswerCreated as unknown as { run: (e: unknown) => Promise<void> }).run({
      id: "evt-other",
      params: { uid: "u1", qid: "daily-2026-08-25" },
      data: { exists: true, ref: ref("v2_users/u1/answers/daily-2026-08-25"), get: (f: string) => vote[f as keyof typeof vote] },
    });
    expect((store.get(MAP) as { a: Record<string, number> }).a).toEqual({ [QID]: 1, "daily-2026-08-25": 1 });
    // the same event again: the ledger returns before the map write
    store.set(MAP, { a: { [QID]: 1, "daily-2026-08-25": 1 }, at: "then" });
    await deliver("evt-1", { ...vote, optionIdx: 0 });
    expect((store.get(MAP) as { a: Record<string, number>; at: unknown }).a[QID], "a redelivered create rewrote the map").toBe(1);
    expect((store.get(MAP) as { at: unknown }).at, "a redelivered create touched the map at all").toBe("then");
    // an edit moves the entry, once, on the delivery that moves the count
    await deliverEdit("edit-1", 1, 0);
    expect((store.get(MAP) as { a: Record<string, number> }).a).toEqual({ [QID]: 0, "daily-2026-08-25": 1 });
    await deliverEdit("edit-1", 1, 0);
    expect((store.get(MAP) as { a: Record<string, number> }).a[QID]).toBe(0);
  });

  it("a create's ledger entry carries the profile's stamp; an edit's carries none (DATA-EFFICIENCY-RUNBOOK 2.1)", async () => {
    // The sample row the nightly builds from this entry is what the device
    // reads instead of the profile, so the name and scores have to be ON
    // the entry — and the edit path reads no profile, so its entry must
    // not pretend to a stamp it never took (the row keeps its create's).
    store.set("v2_users/u1", {
      anchors: { ageBand: "25-34", country: "NO" },
      displayName: "  Olaf ",
      testResults: { big5: { dims: [{ id: "O", value: 70.4 }] }, logic: { pctile: 55 } },
    });
    await deliver("evt-1", vote);
    const entry = store.get("v2_agg_events/evt-1") as Record<string, unknown>;
    expect(entry.n).toBe("Olaf");
    expect(entry.s).toEqual({ big5: { O: 70 } });
    expect(entry.l).toBe(55);
    await deliverEdit("edit-1", 1, 0);
    const edit = store.get("v2_agg_events/edit-1") as Record<string, unknown>;
    expect(edit).not.toHaveProperty("n");
    expect(edit).not.toHaveProperty("s");
    expect(edit).not.toHaveProperty("l");
    // A profile with no name and no results stamps as nothing — still a
    // stamp, so the row can say "no name" rather than "unknown".
    store.set("v2_users/u1", { anchors: { ageBand: "25-34", country: "NO" } });
    await deliver("evt-2", vote);
    const bare = store.get("v2_agg_events/evt-2") as Record<string, unknown>;
    expect(bare.n).toBe("");
    expect(bare.s).toBeNull();
    expect(bare.l).toBeNull();
  });

  it("an edit that arrives before its create THROWS, so Eventarc redelivers", async () => {
    // Eventarc orders nothing between a document's create and update
    // deliveries, so the edit can land first. `retargetCounts` refuses
    // (the old option holds no votes) and the trigger throws, which under
    // `retry: true` is the whole recovery: the edit comes back after the
    // create folded.
    //
    // Returning instead would be SILENT and permanent — Eventarc marks the
    // delivery done, and that voter's option never moves on any question,
    // for as long as the app runs. Swapping the throw for a `return` left
    // the whole functions suite, tsc and test:scripts green, and the
    // emulator cannot reach it: a healthy emulator never delivers out of
    // order.
    await expect(
      deliverEdit("edit-1", 1, 0),
      "an edit before its create was accepted and dropped",
    ).rejects.toThrow(/before its create/);
    // …and nothing was written, so the redelivery is a clean replay
    // rather than one guarded by a ledger entry for a fold that never was.
    expect(store.has("v2_agg_events/edit-1")).toBe(false);
    expect(store.has(AGG)).toBe(false);
  });

  it("an editedAt-only rewrite folds nothing at all", async () => {
    // Same option to the same option: a stamp, not a move. The early
    // return is what keeps it out of the published edit matrix — without
    // it the fold writes a DIAGONAL cell, the one shape pure.ts states
    // cannot occur, into a matrix readers take as "people who changed
    // their mind". Green everywhere when removed; the e2e only ever edits
    // to a different index.
    await deliver("evt-1", vote);
    await deliverEdit("edit-1", 1, 1);
    expect(store.has("v2_agg_events/edit-1"), "a stamp was folded as a move").toBe(false);
    const edits = (store.get(AGG)?.edits as Doc) || {};
    expect(Object.keys(edits), "an editedAt-only rewrite reached the edit matrix").toEqual([]);
    // The counts are untouched, which is the reader-visible half.
    expect((store.get(AGG)?.counts as Doc)["1"]).toBe(1);
  });

  // ── the D86 invariants, moved off the emulator ──────────────────────
  //
  // These four are not about idempotence; they are the edit arm's core
  // promises, and until now the ONLY thing that executed them was
  // `firestore-tests/e2e-v2-loop.mjs` — Java 21, a full emulator boot and
  // several minutes. Each one mutated green in the fast runner, in a file
  // that already builds exactly the state each needs. One line each.
  it("an edit does not add a person to the question's population", async () => {
    // The D86 headline: an edit MOVES a vote. If `total` climbed with it,
    // every "N people answered" on the question would drift upward every
    // time somebody changed their mind, and no recount exists.
    await deliver("evt-1", vote);
    await deliver("evt-2", { ...vote, optionIdx: 1 });
    await deliverEdit("edit-1", 1, 0);
    expect(store.get(AGG)?.total, "an edit was counted as a new answer").toBe(2);
  });

  it("an edit moves inside the breakdown cells too, not just the totals", async () => {
    // The anchors an answer snapshots are frozen, so an edit lands in
    // exactly the cells the create folded into. Without the retarget the
    // headline number moves and every cut of it — by age, by country —
    // keeps the old option: the same question reads two different ways
    // depending on which lens you open.
    await deliver("evt-1", vote); // optionIdx 1, country NO, ageBand 25-34
    await deliverEdit("edit-1", 1, 0, vote.anchors);
    const by = store.get(AGG)?.by as Record<string, Record<string, Record<string, number>>>;
    expect(by?.country?.NO?.["0"], "the country cut kept the old option").toBe(1);
    expect(by?.country?.NO?.["1"]).toBeUndefined();
  });

  it("the create after an edit keeps the published edit matrix", async () => {
    // The create arm republishes the whole document, so it has to carry
    // the edits matrix forward — otherwise the next person to answer wipes
    // the record of everyone who ever changed their mind.
    await deliver("evt-1", vote);
    await deliverEdit("edit-1", 1, 0);
    expect(store.get(AGG)?.edits, "the edit matrix was not published").toBeTruthy();
    await deliver("evt-2", vote);
    expect(
      store.get(AGG)?.edits,
      "a later answer erased the whole edit matrix",
    ).toBeTruthy();
  });

  it("the rank arm accumulates positions rather than republishing the last answer's", async () => {
    // `pos` is a running sum the client turns into the crowd's order. If
    // each answer overwrote it, the published order would be whatever the
    // most recent person happened to say, while the count beside it
    // climbed — a crowd order with one voter in it, labelled with the
    // crowd's size.
    store.set(`v2_questions/${QID}`, { options: ["a", "b", "c"] });
    await deliver("evt-1", rank);
    await deliver("evt-2", rank);
    expect(store.get(AGG)?.total).toBe(2);
    const pos = store.get(AGG)?.pos as number[];
    expect(pos.reduce((a, b) => a + b, 0), "positions stopped accumulating").toBe(
      2 * (0 + 1 + 2),
    );
  });

  it("marks the ledger in the same transaction as the fold", async () => {
    // The other half of the property: a fold that lands without its ledger
    // entry is a fold that will land again on the next delivery.
    await deliver("evt-1", vote);
    expect(store.has("v2_agg_events/evt-1")).toBe(true);
  });
});

describe("an invented cohort is corrected, not folded (D410)", () => {
  // firestore.rules can only check an answer's anchors are PLAUSIBLE — ten
  // strings of sane length — never that they are the author's. A rule that
  // compared them to the profile was built and measured, and it refuses two
  // correct writes: the city the app blanks on purpose, and every answer
  // from a second device holding a stale profile mirror (which `wake()` does
  // not refresh, so the window is a whole session). So the check lives here.
  it("folds the profile's cohort, not the claimed one", async () => {
    store.set("v2_users/u1", { anchors: { ageBand: "25-34", country: "NO" } });
    await deliver("e-lie", {
      surface: "daily", optionIdx: 1,
      anchors: { ageBand: "55-64", country: "JP" },
    });
    const by = store.get(AGG)?.by as Record<string, Record<string, Record<string, number>>>;
    expect(by.ageBand["25-34"], "the profile's band took the vote").toEqual({ "1": 1 });
    expect(by.ageBand["55-64"], "the claimed band got a cell anyway").toBeUndefined();
    expect(by.country.NO).toEqual({ "1": 1 });
    expect(by.country.JP).toBeUndefined();

    // …AND THE DOCUMENT, in the same case because beforeEach clears the
    // store between them. The fold alone is not enough: live.ts's voter
    // fold reads other users' anchors off their answer ROWS to say who
    // someone is, so an invented cohort left on the document would stay on
    // the screen even with the aggregate corrected.
    const a = store.get(`v2_users/u1/answers/${QID}`) as Doc | undefined;
    expect(a?.anchors, "the answer kept the cohort it invented")
      .toEqual({ ageBand: "25-34", country: "NO" });
  });

  // THE SAME LIE, ONE ARM UP. The catalog arm folds `entBy` — per-entity
  // anchor slices — and that map is projected into the public `by` the
  // Mirror draws. It had no honest-anchor check of any kind until
  // 2026-09-10, so every `type: "catalog"` question was this hole with a
  // different noun, and `rebuildAggregateV2` re-folded the same
  // uncorrected document, which means a repair reproduced it.
  it("folds the profile's cohort on a CATALOG pick too, and corrects that answer", async () => {
    store.clear();
    store.set("v2_users/u1", { anchors: { ageBand: "25-34", country: "NO" } });
    store.set(`v2_questions/${QID}`, { domain: "pokemon" });
    await deliver("e-cat-lie", {
      surface: "feed", entity: 25,
      anchors: { ageBand: "55-64", country: "JP" },
    });
    const entBy = store.get(PRIV)?.entBy as Record<string, Record<string, Record<string, number>>>;
    expect(entBy.ageBand["25-34"], "the profile's band took the pick").toEqual({ "25": 1 });
    expect(entBy.ageBand["55-64"], "the claimed band got a cell anyway").toBeUndefined();
    expect(entBy.country.NO).toEqual({ "25": 1 });
    expect(entBy.country.JP).toBeUndefined();
    // …and what a reader actually gets, which is the projection of it.
    const by = store.get(AGG)?.by as Record<string, Record<string, Record<string, number>>> | undefined;
    expect(by?.ageBand?.["55-64"], "the public board published the invented cohort").toBeUndefined();
    // …and the answer row, which the People lens reads to say who someone is.
    const a = store.get(`v2_users/u1/answers/${QID}`) as Doc | undefined;
    expect(a?.anchors, "the catalog answer kept the cohort it invented")
      .toEqual({ ageBand: "25-34", country: "NO" });
  });

  // THE KEY THE PROFILE DOES NOT CARRY AT ALL, which is the half the two
  // cases above could not see: both claim a WRONG value for a key the
  // profile also has, so the honest set carries that key and the write's
  // mask reaches it. `honestAnchors` DROPS a key the profile lacks
  // instead of blanking it — and a `merge: true` write masks only the
  // leaf paths it carries, so the dropped key was never in the mask and
  // stayed on the row for good. The correction's own comment says a fold
  // that ignored an invented cohort "would leave the invention on the
  // screen", and the People lens reads these rows to say who someone is.
  it("REMOVES a cohort key the profile does not carry, rather than leaving it", async () => {
    store.clear();
    // A profile with a band and no city — the ordinary state of an
    // account that has never named where it is.
    store.set("v2_users/u1", { anchors: { ageBand: "25-34" } });
    // AND THE ANSWER ROW AS THE CLIENT WROTE IT. Without this the store
    // has no document for the correction to correct, the write creates
    // one from the honest set, and the case passes for a reason that has
    // nothing to do with the mask — which is how it passed under the old
    // `merge: true` the first time it was run.
    const claimed = { ageBand: "25-34", city: "Oslo, NO" };
    store.set(`v2_users/u1/answers/${QID}`, { surface: "daily", optionIdx: 1, anchors: claimed });
    await deliver("e-invented-key", { surface: "daily", optionIdx: 1, anchors: claimed });
    const a = store.get(`v2_users/u1/answers/${QID}`) as Doc | undefined;
    expect(a?.anchors, "the invented city survived the correction that exists to remove it")
      .toEqual({ ageBand: "25-34" });
    // …and the board never carried it either.
    const by = store.get(AGG)?.by as Record<string, Record<string, Record<string, number>>> | undefined;
    expect(by?.city, "the public board published a city the profile does not claim").toBeUndefined();
    // The vacuity guard: the honest key is still there, so this is not
    // passing on a write that wiped the map.
    expect(by?.ageBand?.["25-34"]).toEqual({ "1": 1 });
  });

  it("retargets an EDIT into the profile's cohort, not the one the event carries", async () => {
    // THE HOLE THIS CLOSES. The create arm corrects an invented cohort and
    // rewrites the document; the edit arm then moved the -old/+new delta
    // using the anchors on its own EVENT PAYLOAD, which is a snapshot from
    // before that correction. So a second account could claim a stranger's
    // band, answer, and immediately edit — and the move landed in the
    // claimed band, taking a cell that belongs to someone else with it.
    //
    // Measured on the emulator with live triggers before the fix: an honest
    // voter in 55-64 on option 0 and a liar from 25-34 editing 0→1 produced
    //     {"ageBand":{"55-64":{"1":1},"25-34":{"0":1}}}
    // where the truth is {"55-64":{"0":1},"25-34":{"1":1}} — both cells
    // wrong on a world-readable document.
    store.clear();
    store.set("v2_users/u1", { anchors: { ageBand: "25-34", country: "NO" } });
    // The create, with the lie. D410 folds it honestly and corrects the row.
    await deliver("e-edit-lie-create", {
      surface: "daily", optionIdx: 0,
      anchors: { ageBand: "55-64", country: "JP" },
    });
    const after0 = store.get(AGG)?.by as Record<string, Record<string, Record<string, number>>>;
    expect(after0.ageBand["25-34"], "the create did not fold honestly — this case rests on it").toEqual({ "0": 1 });

    // The edit, whose payload still carries the claim — which is exactly
    // what a real Eventarc delivery looks like in that window.
    await deliverEdit("e-edit-lie-update", 0, 1, { ageBand: "55-64", country: "JP" });

    const by = store.get(AGG)?.by as Record<string, Record<string, Record<string, number>>>;
    expect(by.ageBand["25-34"], "the edit moved a band that is not the author's").toEqual({ "1": 1 });
    expect(by.ageBand["55-64"], "the claimed band took the move anyway").toBeUndefined();
    expect(by.country.NO).toEqual({ "1": 1 });
    expect(by.country.JP, "the claimed country took the move anyway").toBeUndefined();
    // …and the ledger row the nightly sample reads, which carried the
    // invention onward.
    const led = store.get("v2_agg_events/e-edit-lie-update") as Doc | undefined;
    expect(led?.anchors, "the ledger published the invented cohort").toEqual({ ageBand: "25-34", country: "NO" });
  });

  it("folds the profile's cohort on a RANK answer too, and corrects that answer", async () => {
    // THE THIRD ARM, and the one that had no check at all. A rank answer
    // folds position sums with no `by` map, so there is no aggregate to
    // corrupt — but the ROW is world-readable (D98) and the People lens
    // reads other users' anchors off answer rows to say who someone is.
    // The vote arm's own comment gives that as the reason it corrects the
    // document and not only the fold; rank was the arm that did neither.
    store.clear();
    store.set("v2_users/u1", { anchors: { ageBand: "25-34", country: "NO" } });
    store.set(`v2_questions/${QID}`, { options: ["a", "b", "c"] });
    await deliver("e-rank-lie", {
      surface: "daily", order: [2, 0, 1],
      anchors: { ageBand: "55-64", country: "JP" },
    });
    // The rank fold itself is unchanged — this is not a behaviour change
    // to what publishes, and asserting it keeps the case honest about that.
    expect(store.get(AGG)?.total, "the rank fold stopped working").toBe(1);
    const a = store.get(`v2_users/u1/answers/${QID}`) as Doc | undefined;
    expect(a?.anchors, "the rank answer kept the cohort it invented")
      .toEqual({ ageBand: "25-34", country: "NO" });
  });

  it("writes NOTHING to an honest RANK answer either", async () => {
    store.clear();
    store.set("v2_users/u1", { anchors: { ageBand: "25-34", country: "NO" } });
    store.set(`v2_questions/${QID}`, { options: ["a", "b", "c"] });
    await deliver("e-rank-true", {
      surface: "daily", order: [2, 0, 1], anchors: { ageBand: "25-34", country: "NO" },
    });
    expect(store.has(`v2_users/u1/answers/${QID}`),
      "an honest rank answer was rewritten for nothing").toBe(false);
  });

  it("writes NOTHING to an honest CATALOG answer either", async () => {
    store.clear();
    store.set("v2_users/u1", { anchors: { ageBand: "25-34", country: "NO" } });
    store.set(`v2_questions/${QID}`, { domain: "pokemon" });
    await deliver("e-cat-true", {
      surface: "feed", entity: 25, anchors: { ageBand: "25-34", country: "NO" },
    });
    expect(store.has(`v2_users/u1/answers/${QID}`),
      "an honest catalog answer was rewritten for nothing").toBe(false);
  });

  it("writes NOTHING to the answer when the claim is honest", async () => {
    // The cost shape: an honest client — every client this repo ships —
    // pays one extra read and no write. The write is the liar's cost.
    store.clear();
    store.set("v2_users/u1", { anchors: { ageBand: "25-34", country: "NO" } });
    await deliver("e-true", vote);
    expect(store.has(`v2_users/u1/answers/${QID}`),
      "an honest answer was rewritten for nothing").toBe(false);
  });

  // ── the CATALOG arm, which had none of this until 2026-09-09 ──────────
  //
  // The three cases above are the vote arm's, and for as long as they have
  // existed the catalog arm folded `snap.get("anchors")` — the raw claim —
  // straight into `entBy`, published it as `by`, and never read the profile
  // at all. D410 binds "the fold … which builds the published aggregate
  // every Mirror cut is drawn from" and never scoped this arm out; it was
  // simply a second fold nobody went back for, on 24 shipped pick questions.
  //
  // It is not an invisible cell either: `pickSegs`/`pickSeg` in live.ts read
  // this `by` map to draw the pick card's segment chips and that segment's
  // ordering of the board, so an invented city was a chip and a ranking.
  it("folds the profile's cohort on the CATALOG arm too", async () => {
    store.clear();
    store.set("v2_users/u1", { anchors: { ageBand: "25-34", country: "NO" } });
    store.set(`v2_questions/${QID}`, { domain: "pokemon" });
    await deliver("e-pick-lie", {
      surface: "daily", entity: 25,
      anchors: { ageBand: "55-64", country: "JP" },
    });
    const by = store.get(AGG)?.by as Record<string, Record<string, Record<string, number>>>;
    expect(by.country.NO, "the profile's country took the pick").toEqual({ "25": 1 });
    expect(by.country.JP, "the claimed country got a segment anyway").toBeUndefined();
    expect(by.ageBand["25-34"]).toEqual({ "25": 1 });
    expect(by.ageBand["55-64"]).toBeUndefined();
    // …and the row, for the reason the vote arm's case gives: answers are
    // public, so the invention stays readable until the document moves.
    const a = store.get(`v2_users/u1/answers/${QID}`) as Doc | undefined;
    expect(a?.anchors, "the catalog answer kept the cohort it invented")
      .toEqual({ ageBand: "25-34", country: "NO" });
  });

  it("writes nothing on the CATALOG arm when the claim is honest", async () => {
    store.clear();
    store.set("v2_users/u1", { anchors: { ageBand: "25-34", country: "NO" } });
    store.set(`v2_questions/${QID}`, { domain: "pokemon" });
    await deliver("e-pick-true", {
      surface: "daily", entity: 25,
      anchors: { ageBand: "25-34", country: "NO" },
    });
    expect(store.has(`v2_users/u1/answers/${QID}`),
      "an honest pick was rewritten for nothing").toBe(false);
    // The vacuity guard: the fold has to have HAPPENED for the absence of a
    // correction to mean anything.
    const by = store.get(AGG)?.by as Record<string, Record<string, Record<string, number>>>;
    expect(by.country.NO).toEqual({ "25": 1 });
  });

  it("keeps a WITHHELD anchor withheld rather than filling it in", async () => {
    // answerAnchors(rates) blanks the city on a question that rates one when
    // the city is unconfirmed. Filling it back in from the profile would
    // rate a place on the unconfirmed claim that blanking exists to stop.
    store.clear();
    store.set("v2_users/u1", { anchors: { city: "Oslo", country: "NO" } });
    await deliver("e-blank", {
      surface: "daily", optionIdx: 0, anchors: { city: "", country: "NO" },
    });
    expect(store.has(`v2_users/u1/answers/${QID}`),
      "a withheld city was overwritten from the profile").toBe(false);
    const by = store.get(AGG)?.by as Record<string, Record<string, unknown>>;
    expect(by.city, "a blanked city still folded into a city cell").toBeUndefined();
  });
});


describe("the answer log mirrors the ledger, once per commit (D447 phase A)", () => {
  it("a vote, redelivered, is one row; its edit is a second row that says what it moved from", async () => {
    const rows = fakeLog();
    try {
      await deliver("evt-a", vote);
      await deliver("evt-a", vote);
      expect(rows.map((r) => r.id)).toEqual(["evt-a"]);
      expect(rows[0]).toMatchObject({ uid: "u1", qid: QID, surface: "daily", option_idx: 1, from_idx: null, anchors: JSON.stringify({ ageBand: "25-34", country: "NO" }) });
      await deliverEdit("edit-1", 1, 0, vote.anchors);
      await deliverEdit("edit-1", 1, 0, vote.anchors);
      expect(rows.map((r) => r.id)).toEqual(["evt-a", "edit-1"]);
      expect(rows[1]).toMatchObject({ option_idx: 0, from_idx: 1 });
    } finally {
      setLogWriterForTest(null);
    }
  });

  it("the rank and catalog arms row too, without an option", async () => {
    const rows = fakeLog();
    store.set(`v2_questions/${QID}`, { options: ["a", "b", "c"], domain: "pokemon" });
    try {
      await deliver("evt-r", rank);
      await deliver("evt-p", pick);
      expect(rows.map((r) => [r.id, r.option_idx])).toEqual([["evt-r", null], ["evt-p", null]]);
    } finally {
      setLogWriterForTest(null);
    }
  });
});

// ── the sharded lane (aggShards.ts, phase B / D467) ─────────────
//
// A question the daily bank names takes the other path: no read of the
// published document, no write to it — a blind increment on the person's
// counter shard, in the same transaction as the ledger mark and the map,
// so the idempotence above holds for it by the same mark. The qid is a
// REAL daily id off the compiled bank, because that is what decides the
// path (never the answer's own `surface` claim).
const { V2_QUESTIONS } = await import("./v2content");
const { shardOf, AGG_SHARDS_COLLECTION } = await import("./aggShards");
const { FieldValue } = await import("firebase-admin/firestore");
const DAILY = V2_QUESTIONS.find((q) => q.surface === "daily")!.id;
const SHARD = `${AGG_SHARDS_COLLECTION}/${DAILY}-${shardOf("u1")}`;

async function deliverDaily(id: string, data: Doc) {
  await (onV2AnswerCreated as unknown as { run: (e: unknown) => Promise<void> }).run({
    id, params: { uid: "u1", qid: DAILY },
    data: { exists: true, ref: ref(`v2_users/u1/answers/${DAILY}`), get: (f: string) => data[f] },
  });
}
async function deliverDailyEdit(id: string, from: number, to: number, anchors: Doc) {
  const doc = (optionIdx: number) => ({ exists: true, get: (f: string) => ({ surface: "daily", optionIdx, anchors } as Doc)[f] });
  await (onV2AnswerUpdated as unknown as { run: (e: unknown) => Promise<void> }).run({
    id, params: { uid: "u1", qid: DAILY }, data: { before: doc(from), after: doc(to) },
  });
}
const inc = (v: unknown, n: number) => v instanceof FieldValue && v.isEqual(FieldValue.increment(n));

describe("the sharded lane: a daily answer never touches the published document", () => {
  it("a first answer is one blind increment on the person's shard, with the ledger mark and the map", async () => {
    const rows = fakeLog();
    await deliverDaily("evt-s1", vote);
    expect(store.has(`v2_question_aggs/${DAILY}`), "the published document was written on the hot path").toBe(false);
    const shard = store.get(SHARD)!;
    expect(shard).toMatchObject({ qid: DAILY, s: shardOf("u1") });
    expect(inc(shard.total, 1)).toBe(true);
    expect(inc((shard.counts as Doc)["1"], 1)).toBe(true);
    expect(inc(((shard.by as Doc).ageBand as Doc)["25-34"] && (((shard.by as Doc).ageBand as Doc)["25-34"] as Doc)["1"], 1)).toBe(true);
    expect(typeof shard.dirtyAt).toBe("number");
    expect(store.has("v2_agg_events/evt-s1")).toBe(true);
    expect((store.get("v2_users/u1/public/answers")?.a as Doc)[DAILY]).toBe(1);
    expect(rows.map((r) => r.qid)).toEqual([DAILY]);
  });

  it("a redelivery writes nothing — the ledger mark turns it away before the shard", async () => {
    const rows = fakeLog();
    await deliverDaily("evt-s2", vote);
    const first = JSON.stringify(store.get(SHARD));
    store.set(SHARD, { ...store.get(SHARD)!, total: "sentinel" }); // any second write would replace this
    await deliverDaily("evt-s2", vote);
    expect(store.get(SHARD)!.total).toBe("sentinel");
    expect(rows).toHaveLength(1);
    expect(first).toContain(DAILY);
  });

  it("an edit is -old/+new on the shard with the total untouched, and no refusal when it lands before its create", async () => {
    // No create delivered at all: the hot path would throw and retry
    // (retargetCounts); the shard takes the move and the sum absorbs it.
    await deliverDailyEdit("evt-s3", 1, 0, { country: "NO" });
    const shard = store.get(SHARD)!;
    expect(inc((shard.counts as Doc)["1"], -1)).toBe(true);
    expect(inc((shard.counts as Doc)["0"], 1)).toBe(true);
    expect(inc((((shard.by as Doc).country as Doc).NO as Doc)["0"], 1)).toBe(true);
    expect(inc(((shard.edits as Doc)["1"] as Doc)["0"], 1)).toBe(true);
    expect("total" in shard).toBe(false);
    expect(store.has(`v2_question_aggs/${DAILY}`)).toBe(false);
    expect((store.get("v2_users/u1/public/answers")?.a as Doc)[DAILY]).toBe(0);
  });

  it("retargets an EDIT into the profile's cohort here too, not the one the event carries", async () => {
    // THE HOT PATH'S HOLE, ONE LANE OVER — and this lane is the reachable
    // one, because the daily bank is exactly what shards. The create arm
    // corrects an invented cohort and rewrites the answer row (D410); this
    // lane then moved -old/+new using the anchors on its own EVENT
    // PAYLOAD, a snapshot from before that correction. The hot path's own
    // case cannot see it: that describe's qid is deliberately NOT a daily
    // id, so it never enters this branch. Found composing the 2026-09-12
    // night shifts — the fix landed on the hot path the same night phase B
    // gave this lane a second copy of the line.
    //
    // The row is seeded as the create's correction leaves it — honest —
    // while the edit's payload still carries the claim, which is the whole
    // difference the re-read makes. Only the edit is delivered, as the
    // case above does, because the fake store merges one level deep and a
    // create's own cells would be replaced rather than added to.
    store.set(`v2_users/u1/answers/${DAILY}`, { anchors: { ageBand: "25-34", country: "NO" } });
    await deliverDailyEdit("evt-s5", 0, 1, { ageBand: "55-64", country: "JP" });
    const by = store.get(SHARD)!.by as Doc;
    expect(inc(((by.ageBand as Doc)["25-34"] as Doc)?.["1"], 1),
      "the edit did not land in the author's real band").toBe(true);
    expect((by.ageBand as Doc)["55-64"],
      "the claimed band took a cell on the shard").toBeUndefined();
    expect((by.country as Doc).JP,
      "the claimed country took a cell on the shard").toBeUndefined();
  });

  it("the hot path is untouched for a question the daily bank does not name — the control", async () => {
    await deliver("evt-s4", vote);
    expect(store.get(AGG)?.total).toBe(1);
    expect([...store.keys()].some((k) => k.startsWith(`${AGG_SHARDS_COLLECTION}/`))).toBe(false);
  });
});
