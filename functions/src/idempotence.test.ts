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

function ref(path: string) {
  return { path, id: path.split("/").pop() as string };
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
      set: (r: { path: string }, data: Doc, opts?: { merge?: boolean }) => {
        store.set(r.path, opts?.merge ? { ...(store.get(r.path) || {}), ...data } : data);
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

const QID = "daily-2026-08-24";
const AGG = `v2_question_aggs/${QID}`;
const PRIV = `v2_aggs_private/${QID}`;

/** One create delivery. `id` is the Eventarc event id — the ledger key. */
async function deliver(id: string, data: Doc) {
  await (onV2AnswerCreated as unknown as { run: (e: unknown) => Promise<void> }).run({
    id,
    params: { uid: "u1", qid: QID },
    // `ref` because a real DocumentSnapshot carries one and the honest-anchor
    // correction (D402) writes through it. The fake had no ref at all, which
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
    // carries the same one the create did — and the breakdown retarget
    // reads it off the `after` document. Optional here so the cases that
    // are only about counts stay as small as they were.
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
  // The author's profile, which the create fold now reads (D402) to check
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

describe("an invented cohort is corrected, not folded (D402)", () => {
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

  it("writes NOTHING to the answer when the claim is honest", async () => {
    // The cost shape: an honest client — every client this repo ships —
    // pays one extra read and no write. The write is the liar's cost.
    store.clear();
    store.set("v2_users/u1", { anchors: { ageBand: "25-34", country: "NO" } });
    await deliver("e-true", vote);
    expect(store.has(`v2_users/u1/answers/${QID}`),
      "an honest answer was rewritten for nothing").toBe(false);
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
