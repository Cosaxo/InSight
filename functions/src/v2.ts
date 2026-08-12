// InSight v2 backend — the daily/mirror core loop.
//
//   seedContentV2       mirrors /content question banks into v2_questions.
//                       Gated: emulator, or an operator uid listed in the
//                       SEED_ADMIN_UIDS env var — with anonymous-first auth
//                       (D3), "any signed-in user" would mean "anyone".
//   onV2AnswerCreated   folds each answer into v2_aggs_private/{qid} and
//                       mirrors an EXACT public copy to
//                       v2_question_aggs/{qid} on every answer.
//                       Idempotent via an event ledger, so at-least-once
//                       delivery and retry-on-failure cannot
//                       double-count. The same ledger carries uid
//                       attribution, which is what keeps the aggregates
//                       CORRECTABLE after a fake-account ring is
//                       discovered (D28).
//
// THERE IS NO K-ANONYMITY FLOOR (D98). There was: counts published only
// at or above AGG_MIN_N, on a PUBLISH_EVERY cadence, with complementary
// suppression hiding a bucket whose neighbour was recoverable by
// subtraction. All of it is gone, and not as a pause — the principle is
// retired. InSight's product is showing how one person's answers link to
// everyone else's, the answers themselves are public (firestore.rules),
// and a floor over public data is a curtain in front of an open window.
//
// The two collections survive as bookkeeping, not as a curtain: the
// private doc is the trigger's working state, the public doc is what
// clients hold an onSnapshot on, and they now carry the same numbers.
//
// Schema and access decisions: docs/SCHEMA-V2.md, docs/DECISIONS.md (D98).

import { getFirestore, FieldValue, type Firestore, type Transaction } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assertOperator, HOT_TRIGGER } from "./ops";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { V2_QUESTIONS } from "./v2content";
import {
  canonBreakdownFor,
  catalogEntityKey,
  foldAnchors,
  foldCanonAnchors,
  canonTopN,
  retargetAnchors,
  retargetCounts,
  seedDocMatches,
  seedOptionConflict,
  describeSeedOptionConflicts,
  type BreakdownCounts,
  type CanonCounts,
  type CatalogSpec,
  type SeedOptionConflict,
} from "./pure";
import { FILM_KEYS, ARTIST_KEYS, EMOJI_KEYS } from "./catalogKeys";

const REGION = "us-central1";

// ── no floor, no cadence (D98) ──────────────────────────────────
//
// AGG_MIN_N and PUBLISH_EVERY used to live here: a k-floor that withheld
// a cohort's counts until it held 5 answers, and a write cadence that
// published only every 5th answer so an onSnapshot could not stream one
// attributable vote per step. D81 had already paused both to 1 because a
// pre-launch userbase made the whole product render as "withheld".
//
// D98 deletes them rather than un-pausing them, because the thing they
// defended is no longer a thing this product does. Answers are readable
// per-user by any signed-in client (firestore.rules) — so a cohort count
// discloses strictly less than the documents it is folded from, and
// batching the increments hides a step whose source is a public read
// away. A floor over public data is theatre with a running cost.
//
// What that means concretely, everywhere below: the public mirror is
// rewritten on EVERY answer, carrying exact counts and the complete
// per-anchor breakdown, with no suppressed cells and no `tooSmall`.
//
// The contention half of the old cadence argument was real and does NOT
// disappear with it: both docs in the trigger's transaction are keyed by
// qid, and Firestore sustains ~1 write/sec/document (D7). Publishing per
// answer restores that pressure. It is accepted knowingly at launch
// volume and the mitigation, when it is needed, is to collapse the two
// documents into one rather than to reintroduce a floor — the private
// doc has no readers at all now (see the header).

// ── every question slices (D98 reverses D44) ────────────────────
//
// There used to be a carve-out here: the political items were treated as
// Art. 9 special-category data and published their overall split with NO
// per-anchor breakdown at all, so nobody could read "how did 25-34s in
// Oslo answer this political question".
//
// D98 removes it. The carve-out was one instance of the general rule this
// reversal retires — that some answers are too revealing to link — and
// keeping it would leave the app with a category of question whose
// cross-tab is missing for no reason a user could see, which is worse
// than either consistent answer. Political items now fold into the
// per-anchor breakdown exactly like every other question.
//
// POLITICAL_QIDS is kept, and deliberately: the marker still identifies
// which items came from the political test and which ordinary feed cards
// carry a political opinion. It is no longer consulted by the fold path.
// Removing the set entirely would delete the only machine-readable record
// of which questions those are, which is a thing a future decision may
// want back — but nothing reads it today, so treat it as documentation.
//
// Two markers, one set (D52). `test === "political"` is the political
// TEST's own items. `political === true` is the same judgement applied to
// ordinary opinion cards — a feed question like "Should voting be
// mandatory?" — which cannot reuse the `test` marker: PASSIVE.record and
// the feed's test-kicker key off `q.test`, so marking a feed card
// "political" that way would silently count it toward the political
// test's progress rings.
export const POLITICAL_QIDS: ReadonlySet<string> = new Set(
  V2_QUESTIONS.filter((q) => q.test === "political" || q.political === true).map((q) => q.id),
);

/**
 * The per-anchor breakdown this answer leaves behind.
 *
 * Since D98 there is no question type that declines to slice, so this is
 * a straight fold. It stays a named function rather than being inlined
 * because the trigger, the edit path and the catalog path all want the
 * same one, and three copies is how they drift.
 */
export function breakdownFor(
  _qid: string,
  storedBy: BreakdownCounts | null | undefined,
  anchors: unknown,
  optionIdx: number,
): BreakdownCounts {
  const by: BreakdownCounts = storedBy || {};
  foldAnchors(by, anchors, optionIdx);
  return by;
}

// How long a ledger entry lives (expireAt powers the Firestore TTL policy —
// SHIP-CHECKLIST §5). Two jobs with very different horizons share the doc:
//
//   Dedup needs ~7 days — Eventarc redelivers for at most that long, so any
//   window covering it prevents double counts.
//
//   Attribution needs longer. The ledger is what lets an operator subtract a
//   discovered ring of fake accounts from v2_aggs_private and republish
//   (docs/DEPLOYMENT.md, "Correcting aggregates"); prevention cannot be made
//   complete (D28), so the fallback is that the record stays correctable.
//   That only works while the ring's entries still exist, and an attack is
//   noticed on a human timescale — weeks after the fact, not days. 90 days
//   is notice + investigation headroom; the storage arithmetic is in D28.
//
// deleteAccount erases a uid's entries with the account, so retention here
// never outlives the account it attributes (index.ts phase 4c).
export const LEDGER_RETENTION_DAYS = 90;

// One shape for both write sites (vote and catalog), so the forensic fields
// cannot drift apart. `uid` is the attribution: qid alone dedups fine, but
// leaves no way to identify — and unwind — a fake account's contributions
// after the fact.
function ledgerEntry(uid: string, qid: string) {
  return {
    qid,
    uid,
    at: FieldValue.serverTimestamp(),
    expireAt: new Date(Date.now() + LEDGER_RETENTION_DAYS * 86400000),
  };
}

// ── contention, made observable ─────────────────────────────────
//
// D7 records the per-question write ceiling — Firestore sustains roughly
// one write per second per document, and both documents these
// transactions touch are single docs keyed by qid — and then names the
// condition for revisiting it: "when onV2AnswerCreated starts logging
// transaction retries". It never logged them. The condition was written
// as though the instrument existed, so the first evidence of the ceiling
// would have been a Mirror that stopped moving and nobody able to say why.
//
// Firestore's SDK retries an ABORTED transaction inside runTransaction, so
// a retry leaves no trace outside unless the callback counts its own
// invocations. One attempt is the normal case and two is ordinary
// interleaving; three is the ceiling arriving, which is why that is where
// this logs. A line per contended answer, not per answer.
//
// WHY THIS STILL MEASURES SOMETHING AFTER D98. The old publish cadence cut
// writes to pubRef by ~80%, and it was tempting to read that as headroom.
// It never was: privRef is written on EVERY answer inside the same
// transaction, and a transaction is bounded by its most contended
// document. Removing the cadence therefore did not move the ceiling — it
// only removed the illusion of margin. The ceiling is exactly where D7's
// arithmetic puts it. This measures it; sharding, or collapsing the two
// documents into one, is what would move it.
const CONTENTION_ATTEMPTS = 3;

// Exported for its test only — nothing outside this module calls it. The
// test drives a fake `runTransaction` that invokes the callback N times,
// which is the one thing worth pinning here: the threshold, and that a
// body's failure still propagates rather than being swallowed by the
// counter. Whether Firestore re-invokes the callback on ABORTED is its
// contract, not something a unit test can establish.
export async function runAggTransaction(
  db: Firestore,
  qid: string,
  body: (tx: Transaction) => Promise<void>,
): Promise<void> {
  let attempts = 0;
  await db.runTransaction(async (tx) => {
    attempts += 1;
    await body(tx);
  });
  // Structured fields as well as the message: the message is what a human
  // greps, the fields are what a log-based metric groups by. Both, because
  // monitoring/onV2AnswerCreated-contention.json counts these and an
  // operator then wants to know WHICH question.
  if (attempts >= CONTENTION_ATTEMPTS) {
    logger.warn(`[v2] aggregate contention on ${qid} — ${attempts} attempts`, {
      metric: "agg_contention",
      qid,
      attempts,
    });
  }
}

// Catalog questions (docs/CATALOG-QUESTIONS.md): the reveal's leaderboard
// cap, and the per-domain key spaces. CATALOG_MAX_ENTITY must equal the
// species count in public/pokedex.txt — scripts/check-pokedex.mjs
// cross-checks this line against the committed catalogue, so regenerating
// a grown catalogue fails CI until this number moves with it. The QID
// domains carry generated key sets instead (catalogKeys.ts, agreement
// enforced by scripts/check-catalogs.mjs); while a set is empty its
// domain simply never aggregates — fail-safe until the catalogue is
// generated and committed (D15).
const CANON_TOP_N = 10;
export const CATALOG_MAX_ENTITY = 1025;
const CATALOG_DOMAINS: Record<string, CatalogSpec> = {
  pokemon: { max: CATALOG_MAX_ENTITY },
  films: { keys: FILM_KEYS },
  artists: { keys: ARTIST_KEYS },
  // Unicode codepoints — sparse like QIDs, stable by Unicode policy.
  emoji: { keys: EMOJI_KEYS },
};

// ── content seed ────────────────────────────────────────────────

/**
 * Exported and db-injected for the same reason runAggTransaction is: the
 * refusal below (D58) is a guarantee about what this function REFUSES to
 * write, and a guarantee nothing executes is a comment. `getFirestore()`
 * inside the body would have made the enforcement untestable without an
 * emulator — which is exactly the gap that let the invariant go unenforced
 * for as long as it did. seed.test.ts drives it with a stand-in.
 */
export async function runSeedV2(
  db: Firestore,
  bumpRev = false,
): Promise<{ written: number; skipped: number }> {
  const refs = V2_QUESTIONS.map((q) => db.collection("v2_questions").doc(q.id));
  // `active` is the operational kill switch — the seed must never flip a
  // question ops disabled back on, so it is only written on first create.
  // The full snapshots (not just the id set) are kept because they are also
  // what makes the write skip below possible: getAll has already paid for
  // the read, so diffing is free.
  const stored = new Map<string, Record<string, unknown>>();
  const present = new Set<string>();
  for (const s of await db.getAll(...refs)) {
    if (!s.exists) continue;
    present.add(s.id);
    stored.set(s.id, s.data() as Record<string, unknown>);
  }
  let batch = db.batch();
  let inBatch = 0;
  let written = 0;
  const refused: SeedOptionConflict[] = [];
  for (let i = 0; i < V2_QUESTIONS.length; i++) {
    const q = V2_QUESTIONS[i];
    const payload: Record<string, unknown> = {
      surface: q.surface,
      seq: q.seq,
      type: q.type,
      // The aggregate trigger reads the question doc's `domain` to pick the
      // catalogue an `entity` answer validates against (D14/D15) — the seed
      // must transport it or live catalog questions can never aggregate.
      domain: q.domain,
      prompt: q.prompt,
      options: q.options,
      topic: q.topic,
      axis: q.axis,
      test: q.test,
      // Emitted only when set (like the source's `flags`): adding the key
      // as null to every payload would mismatch every stored doc at
      // once and spend a full-bank rewrite on a field almost nothing
      // carries. `mode` scopes a duel question to a pool — today only
      // "romantic" (D40 part 4), which duelQFor filters on client-side.
      ...(typeof q.mode === "string" ? { mode: q.mode } : {}),
      // The daily bank's subject path (D100). Same emit-when-set rule, and
      // here it matters more than for `mode`: 90 daily entries carry a
      // branch and the other 423 do not, so writing null would rewrite the
      // whole bank to say nothing about four surfaces out of five.
      ...(typeof q.branch === "string" ? { branch: q.branch } : {}),
      ...(typeof q.sub === "string" ? { sub: q.sub } : {}),
    };
    // Unchanged docs are not rewritten. Two things depend on this, and the
    // second is the expensive one: `updatedAt` only means something as an
    // incremental cursor if it moves when the content moves (live.ts reads
    // the bank with `updatedAt > cursor`), and `contentRev` below only
    // bumps when something actually changed.
    if (seedDocMatches(stored.get(q.id), payload)) continue;
    // D52's un-editable invariant, enforced where the edit would land rather
    // than in the reviewer's eye. A changed option set on a LIVE question
    // re-keys every vote already stored against it, silently — so this doc
    // is refused and the rest of the seed proceeds. Refusing per-document
    // rather than aborting the run is deliberate: a batch of legitimate
    // prompt fixes must not be held hostage by one bad edit, and the throw
    // at the end makes sure the refusal cannot be missed either way.
    const conflict = seedOptionConflict(q.id, stored.get(q.id), payload);
    if (conflict) {
      refused.push(conflict);
      continue;
    }
    payload.updatedAt = FieldValue.serverTimestamp();
    // Honor a source-carried `active: false` on FIRST create (it used to be
    // hardcoded true, which silently discarded the flag the content layer's
    // `flags()` emits — the romantic pool ships dark on purpose, D40 part
    // 4). Reseeds still never touch active: the operator's console flip is
    // the kill switch and the seed must not fight it either direction.
    if (!present.has(q.id)) payload.active = q.active !== false;
    batch.set(refs[i], payload, { merge: true });
    written++;
    // Firestore batches cap at 500 ops.
    if (++inBatch === 450) {
      await batch.commit();
      batch = db.batch();
      inBatch = 0;
    }
  }
  if (inBatch > 0) await batch.commit();
  // `contentRev` is the FULL-invalidation lever: it blows away every
  // device's cached bank so the next boot re-reads all of it. That costs
  // one read per bank doc per returning user (docs/COSTS.md), so it is no longer
  // spent on every run — only when this seed created documents, and when
  // an operator asks for it explicitly.
  //
  // Ordinary content growth does NOT need it: new and edited docs carry a
  // fresh `updatedAt`, and clients page them in against their cursor.
  //
  // `bumpRev` exists for the one case the cursor cannot see — an `active`
  // flag flipped by hand in the console, which changes no document the
  // seed writes. Note that a stale client is a cosmetic problem, not a
  // correctness one: firestore.rules re-checks `active` on every answer
  // write, so a killed question that is still on someone's screen is
  // refused server-side rather than silently accepted.
  //
  // NEW questions deliberately do NOT bump it either, which is the whole
  // point: a promotion is exactly the case this exists to make cheap, and
  // creates carry `updatedAt` like every other write, so the cursor pages
  // them in. The only automatic bump left is the first seed of an empty
  // project, which initialises the field.
  const metaRef = db.collection("v2_meta").doc("app");
  const firstEver = (await metaRef.get()).get("contentRev") === undefined;
  const bumped = bumpRev || firstEver;
  if (bumped) {
    await metaRef.set({ contentRev: FieldValue.serverTimestamp() }, { merge: true });
  }
  const skipped = V2_QUESTIONS.length - written - refused.length;
  logger.info(
    `[v2] seeded ${written} questions, ${skipped} unchanged ` +
      `(${present.size} pre-existing, contentRev ${bumped ? "bumped" : "held"})`,
  );
  // Loud, and after the commit. The legitimate writes are already durable —
  // holding them back would punish the rest of the batch for one bad edit —
  // but the run does NOT get to report success, because a silently-skipped
  // question is exactly the outcome D52 exists to prevent. An operator who
  // genuinely means to retire a question has `active: false`; an operator
  // who genuinely means to replace one appends a new qid. Neither path goes
  // through here.
  if (refused.length) {
    const detail = describeSeedOptionConflicts(refused);
    logger.error(
      `[v2] REFUSED ${refused.length} option-set edit(s) to live questions ` +
        `(D52 — answers store optionIdx, so editing options re-keys every ` +
        `vote already cast): ${detail}`,
    );
    throw new HttpsError(
      "failed-precondition",
      `refused ${refused.length} option-set edit(s) to already-seeded questions; ` +
        `shipped option sets are immutable (D52). Retire with active:false or ` +
        `append a new qid instead. ${detail}`,
    );
  }
  return { written, skipped };
}

// NO enforceAppCheck, deliberately: this is invoked by the *Seed content*
// workflow (scripts/seed-content.mjs) as the last remaining step of
// SHIP-CHECKLIST §1, and by the e2e — neither carries an App Check token.
// assertOperator + SEED_ADMIN_UIDS is the control instead.
//
// This comment said "from a browser console" until 2026-08-06, which was
// the reason given for the exemption and was describing a caller that did
// not exist: hosting serves only web/ (home, join, privacy, terms) and the
// app ships as the native iOS shell, so there is no browser build to open a
// console on. The exemption was right; its stated caller was imaginary.
//
// Held by `npm run check:appcheck`, which also fails if
// adding it would refuse the console call that checklist step is written
// around.
export const seedContentV2 = onCall({ region: REGION }, async (request) => {
  assertOperator(request);
  // bumpRev forces the full cache invalidation the seed no longer spends
  // by default — see runSeedV2. Use it after flipping `active` by hand in
  // the console; ordinary content growth does not need it.
  return runSeedV2(getFirestore(), request.data?.bumpRev === true);
});

// ── answer → aggregate ──────────────────────────────────────────

export const onV2AnswerCreated = onDocumentCreated(
  { ...HOT_TRIGGER, region: REGION, document: "v2_users/{uid}/answers/{qid}", retry: true },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    // Group/duo answers are sealed duel material — they surface through
    // materialized reveals (v2social), never through world aggregates.
    //
    // What this write is for: it flags the group's day as owing a reveal, so
    // the scheduled scan can ask an INDEXED question ("which groups played
    // yesterday?") instead of reading every group document to find the few
    // that did. See prunePendingDays in pure.ts for the field's contract.
    //
    // It also replaces the `lastCheckedDay` skip-marker this branch used to
    // compensate for. That was a read, a value comparison and a conditional
    // delete whose correctness rested on a specific commit ordering between
    // this trigger and the scan. arrayUnion needs none of it: a late answer
    // re-adds its day unconditionally, so the day re-opens whatever order
    // the two writers land in, and the scan's own transaction settles it.
    // One blind write, no read, and one less race to reason about.
    const surface = snap.get("surface");
    if (surface === "group" || surface === "duo") {
      const gid = snap.get("gid");
      const day = snap.get("day");
      if (typeof gid === "string" && typeof day === "string") {
        try {
          const gref = getFirestore().collection("v2_groups").doc(gid);
          // update(), not set(merge): a group deleted between the answer and
          // this trigger must stay deleted, and set() would resurrect it as a
          // doc holding nothing but pendingDays. NOT_FOUND is the expected
          // outcome there, not an error worth logging loudly.
          await gref.update({ pendingDays: FieldValue.arrayUnion(day) });
        } catch (err) {
          const code = (err as { code?: number | string }).code;
          if (code === 5 || code === "not-found") return;
          // RETHROWN, so `retry: true` above actually means something on this
          // branch. It used to warn and return normally, which made the retry
          // policy dead here: the mark is the ONLY thing that puts this day
          // in front of the scheduled scan, so losing it loses the reveal —
          // for a group-day where the single answerer has already played,
          // silently and permanently.
          //
          // D19's stated safety net does not cover it. "The answer never
          // folded into any aggregate — a louder problem, already logged" is
          // true of the vote path; this branch returns before any aggregate
          // work. And the monitoring filter is severity>=ERROR while this
          // logged WARNING, so nothing was watching either.
          //
          // Safe to retry: arrayUnion is idempotent, and the NOT_FOUND case
          // above still returns cleanly rather than retrying against a group
          // that is deliberately gone.
          logger.error(`[v2] pending-day mark failed for ${gid}/${day}:`, err);
          throw err;
        }
      }
      return;
    }
    const qid = event.params.qid;
    // Catalog answers carry `entity`, never `optionIdx` — one pick from the
    // shipped catalogue, admitted by rules only on type=="catalog"
    // questions. Same ledger, same private/public docs, same cadence; what
    // publishes is the canon fold (top-N + one "everyone else" bucket)
    // instead of per-option counts, plus per-segment orderings of that
    // board restricted to its own entities (D17 — the top-N-only form D14
    // said was the viable one; a full 1,000-entity split per segment
    // leaves nearly every cell under the floor).
    if (snap.get("entity") !== undefined) {
      const db = getFirestore();
      const eventRef = db.collection("v2_agg_events").doc(event.id);
      const privRef = db.collection("v2_aggs_private").doc(qid);
      const pubRef = db.collection("v2_question_aggs").doc(qid);
      const qRef = db.collection("v2_questions").doc(qid);
      await runAggTransaction(db, qid, async (tx) => {
        const seen = await tx.get(eventRef);
        if (seen.exists) return;
        // The question's domain decides which key space validates this
        // entity — the trigger's only question-doc read, catalog answers
        // only. A missing or unknown domain never aggregates: with three
        // key spaces (a contiguous range and two sparse QID sets, D15)
        // there is no honest global fallback bound.
        const qDoc = await tx.get(qRef);
        const spec = CATALOG_DOMAINS[qDoc.get("domain") as string];
        if (!spec) {
          logger.warn(`[v2] catalog answer ${event.params.uid}/${qid} on a question with no known domain`);
          return;
        }
        const key = catalogEntityKey(snap.get("entity"), spec);
        if (key === null) {
          logger.warn(`[v2] answer ${event.params.uid}/${qid} has no usable entity key`);
          return; // an unknown key never aggregates; the owner's doc stays, harmless
        }
        const priv = await tx.get(privRef);
        const ent: CanonCounts =
          (priv.exists && (priv.get("ent") as CanonCounts)) || {};
        ent[key] = (ent[key] || 0) + 1;
        const total = ((priv.exists && (priv.get("total") as number)) || 0) + 1;
        // Per-entity anchor slices, transposed foldAnchors with its own
        // per-cell entity cap (pure.ts, D17). Same document, same D7
        // arithmetic as the vote path's `by`.
        //
        // Every catalog question slices too (D98 — see the vote path).
        const entBy: BreakdownCounts =
          (priv.exists && (priv.get("entBy") as BreakdownCounts)) || {};
        foldCanonAnchors(entBy, snap.get("anchors"), key);
        // The leaderboard, cut to a DISPLAY size rather than a floor.
        // canonTopN keeps the N biggest entities and folds the remainder
        // into `rest`; it used to also drop every entity under the
        // k-floor and fold whole tie-groups so a boundary count could not
        // be recovered by subtraction. Both of those were disclosure
        // rules and both are gone — `rest` is now simply "everything
        // outside the top N", which is what a reader assumed it was.
        const canon = canonTopN(ent, CANON_TOP_N);
        tx.set(eventRef, ledgerEntry(event.params.uid, qid));
        // Bounded growth: `ent` is capped by catalogue validation (~1k
        // entries); `entBy` by the bucket cap × its own per-cell entity
        // cap (foldCanonAnchors) — tens of KB against Firestore's 1 MiB
        // limit either way.
        tx.set(privRef, { ent, entBy, total }, { merge: false });
        // Published whole, every answer. The `by` map is cut to the
        // board's own entities purely to bound the document — a segment
        // ordering for an entity nobody can see on the board has nothing
        // to order.
        tx.set(
          pubRef,
          {
            total,
            top: canon.top,
            rest: canon.rest,
            by: canonBreakdownFor(entBy, canon.top),
          },
          { merge: false },
        );
      });
      return;
    }
    const optionIdx = snap.get("optionIdx");
    if (typeof optionIdx !== "number" || optionIdx < 0 || optionIdx > 19) {
      logger.warn(`[v2] answer ${event.params.uid}/${qid} has no usable index`);
      return; // malformed can't pass rules; don't retry-loop on it
    }
    const db = getFirestore();
    const eventRef = db.collection("v2_agg_events").doc(event.id);
    const privRef = db.collection("v2_aggs_private").doc(qid);
    const pubRef = db.collection("v2_question_aggs").doc(qid);
    await runAggTransaction(db, qid, async (tx) => {
      // Idempotency: Eventarc is at-least-once and retry is on — the
      // ledger makes redelivery a no-op instead of a double count.
      const seen = await tx.get(eventRef);
      if (seen.exists) return;
      const priv = await tx.get(privRef);
      const counts: Record<string, number> =
        (priv.exists && (priv.get("counts") as Record<string, number>)) || {};
      counts[String(optionIdx)] = (counts[String(optionIdx)] || 0) + 1;
      const total = ((priv.exists && (priv.get("total") as number)) || 0) + 1;
      // Per-anchor breakdown, in the SAME document as the plain counts.
      // Deliberately not new per-dimension docs: this transaction already
      // writes privRef, so folding the slices in costs no extra document
      // and D7's ~1-write/sec-per-document ceiling is unchanged.
      //
      // Answers written before any anchors are collected simply carry
      // `anchors: {}` and fold to nothing, so this is inert until there is
      // something to slice by — see D8.
      //
      // Every question slices since D98 — there is no political carve-out
      // and no per-cell floor. The breakdown folded here is the breakdown
      // published, whole.
      const by = breakdownFor(
        qid,
        priv.exists ? (priv.get("by") as BreakdownCounts) : null,
        snap.get("anchors"),
        optionIdx,
      );
      tx.set(eventRef, ledgerEntry(event.params.uid, qid));
      tx.set(privRef, { counts, total, by }, { merge: false });
      // The public mirror, written on EVERY answer with exact counts.
      //
      // What used to be here, and why none of it is: a `tooSmall` flag
      // while the question sat under the floor; a `byPub` baseline so a
      // suppressed bucket could be re-emitted unchanged until it had
      // grown by k; a publish cadence so an onSnapshot observer could not
      // attribute one step to one person. All three defended against
      // recovering an individual's answer from a moving aggregate — and
      // since D98 that same reader can simply read the answer.
      //
      // Deliberately still without a fresh timestamp. Not for disclosure:
      // a rewritten `updatedAt` on every answer would wake every client's
      // onSnapshot for a field none of them render.
      //
      // The write-rate cost is real and recorded above: this is now one
      // write per answer to a single document keyed by qid, against
      // Firestore's ~1/sec/document (D7). The fix when it bites is
      // sharding or collapsing the two docs, not a floor.
      tx.set(pubRef, { counts, total, by }, { merge: false });
    });
  },
);

// ── answer edit → aggregate delta (D86) ─────────────────────────
//
// The update half of the honest-counts guarantee. Rules admit exactly one
// edit shape — optionIdx moves on a daily/feed/test answer, anchors and
// answeredAt frozen — so what reaches here is always a -old/+new move with
// the TOTAL unchanged: the person was counted once and still is, they just
// hold a different option. Same ledger, same transaction discipline as the
// create path; a redelivered edit is a no-op, not a double move.
export const onV2AnswerUpdated = onDocumentUpdated(
  { ...HOT_TRIGGER, region: REGION, document: "v2_users/{uid}/answers/{qid}", retry: true },
  async (event) => {
    const before = event.data?.before;
    const after = event.data?.after;
    if (!before || !after) return;
    // Rules restrict the update arm to plain optionIdx answers, so anything
    // else here — catalog (entity, no optionIdx), duel, learn — is emulator
    // or admin-SDK noise. Return, never retry-loop on it. The guards mirror
    // the create trigger's shape checks rather than trusting rules alone,
    // because the emulator suites write with rules disabled.
    const surface = after.get("surface");
    if (surface !== "daily" && surface !== "feed" && surface !== "test") return;
    const fromIdx = before.get("optionIdx");
    const toIdx = after.get("optionIdx");
    if (typeof fromIdx !== "number" || typeof toIdx !== "number") return;
    if (fromIdx < 0 || fromIdx > 19 || toIdx < 0 || toIdx > 19) return;
    if (fromIdx === toIdx) return; // editedAt-only rewrite: nothing moved
    const qid = event.params.qid;
    const db = getFirestore();
    const eventRef = db.collection("v2_agg_events").doc(event.id);
    const privRef = db.collection("v2_aggs_private").doc(qid);
    const pubRef = db.collection("v2_question_aggs").doc(qid);
    await runAggTransaction(db, qid, async (tx) => {
      const seen = await tx.get(eventRef);
      if (seen.exists) return;
      const priv = await tx.get(privRef);
      const counts: Record<string, number> =
        (priv.exists && (priv.get("counts") as Record<string, number>)) || {};
      if (!retargetCounts(counts, fromIdx, toIdx)) {
        // The old option holds no votes, which means this edit's CREATE
        // event has not folded yet — Eventarc orders nothing between a
        // doc's create and update deliveries. Throw so `retry: true`
        // redelivers the edit after the create lands; the ledger keeps the
        // eventual replay single-shot. (retargetCounts has the argument
        // for why applying blindly would corrupt instead of commute.)
        throw new Error(
          `[v2] edit ${event.params.uid}/${qid} arrived before its create folded; retrying`,
        );
      }
      const total = (priv.exists && (priv.get("total") as number)) || 0;
      const by: BreakdownCounts =
        (priv.exists && (priv.get("by") as BreakdownCounts)) || {};
      // The anchors snapshot is frozen (rules), so this lands in exactly
      // the cells the create folded into — or skips a dimension where cap
      // churn means the old vote is no longer represented (pure.ts has the
      // accounting). Bucket totals never move.
      retargetAnchors(by, after.get("anchors"), fromIdx, toIdx);
      tx.set(eventRef, ledgerEntry(event.params.uid, qid));
      tx.set(privRef, { counts, total, by }, { merge: false });
      // An edit always republishes now. It used to be conditional on
      // EDITS_REPUBLISH — a guard that existed because, under a publish
      // cadence, an edit's -old/+new leaves `total` unmoved, so a lone
      // republish at an unchanged total was visibly one person changing
      // their mind. With no cadence there is no stream to hide in and
      // nothing to hide from: the answer itself is readable.
      tx.set(pubRef, { counts, total, by }, { merge: false });
    });
  },
);
