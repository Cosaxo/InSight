# Rank and catalog go-live — the two feed forms the live bank withholds

**Status: BOTH HALVES BUILT.** §2 (catalog) shipped 2026-08-23 as
[D231](DECISIONS.md#d231--catalog-questions-go-live-seventeen-picks-promoted-through-one-pen);
§3 (rank) shipped the same day as
[D232](DECISIONS.md#d232--rank-questions-live-an-answer-carries-an-order-and-the-exclusion-retires),
which also closes D12. The records carry the as-built deviations —
D231 reversed one planned item (`feed-budget.mjs`, whose regulator
reads only the subject taxonomy — a call D232 then reversed BACK when
rank joined the servable set, since rank questions live in that
taxonomy and pick cards do not) and D232 refined the answer shape (no
optionIdx at all) and closed a rules hole the plan had not seen
(optionIdx on a rank doc). What remains open is inventory, not
machinery: the pokemon tranche cleared and promoted 2026-08-23 (the
owner answered the nominative-use check), leaving only films/artists —
blocked on network policy, not on anyone's machine: the sandbox's
egress proxy answers CONNECT 403 for `query.wikidata.org` (the one
host `build-catalog.mjs` needs), so widening the session environment's
network policy to allow it lets a session run the build itself.
Written 2026-08-22 on the
owner's direction after asking why ranking questions disappeared and
catalogue ("favourite X") questions never appear: both absences are
deliberate and recorded — `rank` was pulled from the live feed at
[D12](DECISIONS.md#d12--rank-questions-are-out-of-the-live-feed-until-answers-can-carry-an-order)
because a pick-one UI was folding wrong-shaped answers into an aggregate
that claimed to be a ranking, and catalog questions were built through
their backend at
[D14](DECISIONS.md#d14--catalog-answers-are-keys-into-a-shipped-catalogue-the-reveal-is-a-canon)/[D15](DECISIONS.md#d15--filmsartists-catalogues-qid-keys-and-generation-is-an-operator-step)/[D17](DECISIONS.md#d17--catalog-breakdowns-each-segment-orders-the-board-never-a-board-of-its-own)
and never seeded live. This document is the path back for both. Each
half ships as **one deliberate change or not at all** — D12's own
discipline, because every step touches the answer-write path — and
building either half graduates to a `DECISIONS.md` record citing this
plan. Catalog shipped first because its backend was finished and tested,
so the change was client + content + gates; rank needs a new answer
shape end to end.

## 1 · Where things actually stand (audited 2026-08-22, not assumed)

**Rank.** The bank seeds 8 `type: "rank"` questions
(`content/feed-questions.json` → `functions/src/v2content.ts`, options
mapped from `items`, authored crowd/votes dropped at the seed). They are
in Firestore and active; the exclusion is one clause in `splitBanks`
(`src/v2/data/deck.ts`, `q.type !== "rank"` on the feed lane,
unit-pinned). The demo feed still renders them —
`tapRank`/`renderRank` in `src/v2/spec/world-feed.jsx` are complete,
and `tapRank` already stores exactly the shape the live answer needs:
`{ order: [itemIdx…] }` in the `WF_LS` mirror. No backend accepts or
folds an order today.

**Catalog.** The backend is **done**, further along than D14's text:
`firestore.rules` admits `entity`-keyed answers on `type == "catalog"`
questions (create-only, device-bound, each branch's `hasOnly` keeping
the other's field out), and `onV2AnswerCreated`
(`functions/src/v2.ts`) validates the key per-domain
(`CATALOG_DOMAINS`: pokemon, elements, emoji, countries, dogs live;
films/artists empty pending the D15 operator step) and publishes the
canon — `{ total, top, rest, by }` to `v2_question_aggs`, exact counts
since D98 retired the k-floor, per-segment board orderings per D17. Six
catalogues are committed under `public/` with drift gates. The client
pick card is complete in the demo (`renderPick`, `PickSearch`,
`pickStore` resolving every domain), and the farm's catalog lane
(D145) appends roughly one card per day to `window.PICK_QS`
(`src/v2/spec/pick-data.js`) — 23 at writing. What does not exist: a
single live `type: "catalog"` question, a content file to seed one
from, an `entity` write path in `src/v2/data/live.ts`, and the `fav`
chip in a live build's channel row (`world-feed-data.js` filters it out
precisely because the bank mapper emits plain votes only).

**What changed since D12/D14 were written: D98.** Both records
reasoned under the old privacy model. Answers are public now, counts
are exact and publish from the first answer, and the canon fold already
dropped its disclosure rules ("`rest` is now simply everything outside
the top N"). So D12's aggregation cost — the careful k-safe cadence —
dissolves to: publish per-item position sums and a total, exactly, per
answer. The one thing that stays out is a full permutation histogram,
now for document-size and honesty-of-display reasons rather than
disclosure ones: the crowd order is the product, `n!` cells are not.

## 2 · Part one — catalog questions live

**Built 2026-08-23 (D231).** The section below is the plan as written;
D231 records the as-built deviations — item 3's `feed-budget` change
was reversed as a no-op (the regulator reads only the subject
taxonomy), and the reveal needed two live COPY divergences the plan did
not price (the demo's floor sentences, false on an exact board). The
order inside this part is deploy order: content and gates first,
client last, so no build ever offers a card the bank cannot serve.

1. **A content file and its seed mapping.** New
   `content/pick-questions.json` (`id: pkNN`, `domain`, `prompt`,
   `cat` — a `WORLD_TOPICS` id, `fav` by convention, D145 §4), mapped
   by `scripts/gen-v2content.mjs` to seed docs with `type: "catalog"`,
   `domain`, `topic`, `options: []`. No `core` flag: an entity answer
   has no option share for the Mirror's cohort folds to read
   (`isCore` in `deck.ts` already reads absent-as-false on feed).
   Document the format in `content/README.md`.
2. **Promotion through the script, not by hand.** Extend
   `scripts/promote-questions.mjs` with the pick archive as a source
   (`window.PICK_QS` in `pick-data.js` → `content/pick-questions.json`),
   byte-for-byte prompts, provenance rows (D97), the D162 review flags —
   the same two-layer archive→seed shape the daily lane has, so the
   farm's daily pick card keeps landing in the archive and a human
   names what goes live. First tranche: a handful of existing `pk`
   cards whose domains have committed catalogues. Refuse a card whose
   domain has no committed catalogue (the QUESTION-FARM rule).
3. **Gates.** `check:quality`'s pick rules learn the content file
   (today they read the demo store); `check:content` regenerates;
   `scripts/feed-budget.mjs` adds `catalog` to `SERVABLE_TYPES` and the
   `check:figures` pins holding QUESTION-FARM's feed numbers get
   regenerated with it.
4. **The bank split.** `splitBanks` (`deck.ts`) needs a catalog
   carve-out on the feed lane — a catalog doc carries no options, so
   `playable()` would drop it — the same shape as the duel lane's
   `topic === "pick"` exception. Pin it in `deck.test.ts`.
5. **The write path.** `LIVE.votePick(qid, entity)` in `live.ts`,
   mirroring `vote()` exactly: create-only guard, optimistic state with
   rollback, `{qid, surface: "feed", entity, answeredAt, anchors}`,
   answers-cache and `WF_LS` mirror in the card's own shape
   (`{ entity }` — what `setPick` already writes), `scheduleAggRefresh`.
   No rules or functions change: both already accept and fold this.
6. **The card's live seam.** `buildFeedGlobals` emits a
   `type: 'pick'` card (`domain`, `cat`, `live: true`, `n` from the
   agg total); the reveal asks the agg instead of the demo store —
   `v2_question_aggs`' `{top, rest, total, by}` is already
   shape-compatible with what `PICKS.canon`/`segs`/`canonSeg` return,
   so this is a thin `q.live` branch, not a rewrite. `setPick`
   dispatches to `LIVE.votePick` on live cards. Un-filter `fav` from
   `WFD_LIVE_BUILD`'s channel row in the same change that seeds stock
   (`places` stays out — rate cards remain demo-only).
7. **Harden every `optionIdx` reader.** Live answer docs without
   `optionIdx` exist for the first time after this ships. Grep the
   answers-cache/`myVotes`/`confirmedVotes` consumers (the Map, the
   mirror archive, streak math) and make entity docs inert where they
   are not rendered — D108's rule: the guard shapes are a list, so read
   every site. `vote.test.ts` re-pins the widened `window.LIVE`
   surface; a smoke leg mounts the live pick card.
8. **Tests and the e2e leg.** Rules cases exist; add the loop leg to
   `firestore-tests/e2e-v2-loop.mjs`: write an entity answer → trigger
   folds → canon published → client shape. Unit: the mapper branch,
   the live canon adapter, `noCountsYet` on an empty board.
9. **Before it ships, two human items** (both already recorded, both
   still open): the nominative-use/trademark posture for "favourite
   Pokémon" (`CATALOG-QUESTIONS.md` — "it gets a real answer, not an
   assumption"), and the operator seed step (`seedContentV2`).

## 3 · Part two — rank questions live

**Built 2026-08-23 (D232).** The section below is the plan as written;
D232 records the as-built refinements — the answer carries `order`
with NO optionIdx (item 1's "alongside" was the sketch, not the ship),
`isWorldAnswer` gained the rank refusal item 1 had not priced, and the
derived crowd subtracts the viewer's own folded order so the first
voter meets "You're first" rather than a mirror.

D12's four numbered costs, updated for D98 and made concrete:

1. **Answer shape and rules.** A new `isRankAnswer()` branch in
   `firestore.rules` beside the catalog one: keys `hasOnly [qid,
   surface, order, answeredAt, anchors]`, `surface == "feed"`, `order`
   a list with `size() >= 2` and `size() ==` the question doc's
   `options.size()` (the same `get()` the catalog and call branches
   already pay), question `type == "rank"` and active, device-bound.
   Rules cannot iterate the list (no forall) — element validation is
   the trigger's, D12's stated trust boundary. The D86 edit arm needs
   no change: its `resource.data.optionIdx is int` guard on the OLD doc
   already keeps order-shaped answers create-only, the same way it
   keeps entity ones out. State that in the rules comment rather than
   leaving it implicit.
2. **The fold.** In `onV2AnswerCreated`, branch on
   `snap.get("order") !== undefined` before the `optionIdx` path (the
   entity branch is the template, ledger and all): read the question
   doc, drop anything that is not a permutation of
   `[0 .. options.size())`, fold per-item position sums into
   `v2_aggs_private` (`pos: number[]`, `total`) and publish
   `{ total, pos }` whole to `v2_question_aggs`. No `by` in v1 — the
   Mirror's cohort lenses read option shares, which an order does not
   have; if a rank-shaped lens ever ships, the breakdown arrives with
   it. `onV2AnswerUpdated` untouched (no rank edits, above). Pure
   arithmetic in `functions/src/pure.ts` with tests: the sums, the
   malformed-permutation drops, idempotent redelivery.
3. **The client.** Remove the one `splitBanks` clause and flip its
   pin. `buildFeedGlobals` emits `type: 'rank'` with `items` from the
   seeded options, `votes` from the agg total, and `crowd` derived from
   mean position (`pos[i] / total`, ascending, ties broken by index —
   deterministic; the demo's `crowd[i]` is already "1-based rank of
   item i", so `renderRank` needs no reshaping). `LIVE.voteRank(qid,
   order)` mirrors `vote()`: optimistic, rollback, cache, `WF_LS`
   already holds `{ order }` from `tapRank` — wire its completion to
   dispatch on live cards. Two live-only states the demo never needed,
   the dial's precedent ("demo cards carry an authored crowd; live
   cards ARE the crowd"): a no-crowd-yet reveal, and `noCountsYet`.
4. **Core flag off.** Flip the 8 seeds to `"core": false` in
   `content/feed-questions.json` (regenerate the seed): a rank
   aggregate carries nothing a cohort fold can read, and a corpus flag
   that can never contribute is a standing lie to the next reader.
   Revisit with a rank lens, in that record.
5. **Gates and tests.** `rank` joins `SERVABLE_TYPES` in
   `feed-budget.mjs` (per-topic servable counts rise — regenerate the
   QUESTION-FARM `check:figures` pins); rules cases for every clause in
   1; fold tests in 2; `vote.test.ts` re-pins `LIVE`; a smoke leg
   mounts the live rank card both unanswered and answered; the e2e
   loop leg writes an order and reads the published sums back.
6. **Deploy order.** Functions first (the fold accepts orders), rules
   second (clients may write them), client last (clients start writing
   them) — no window where a shipped client writes a shape the
   backend refuses or drops. `backend-checks.yml` already guards both
   deploy paths.

## 4 · What this plan deliberately does not do

- **No rank edits.** D86 is one edit shape; an order edit is a new
  delta path through the fold and waits for someone to want it.
- **No permutation histogram, no rank breakdowns, no catalog
  breakdowns beyond D17's boards** — each is a recorded refusal with
  its arithmetic; nothing here reopens them.
- **No films/artists cards.** Their key sets are empty until the D15
  operator step runs on a networked machine; the domain validation
  fail-safe (an unknown domain never aggregates) is already in place.
- **No new farm lane behavior.** The catalog lane keeps writing the
  archive daily; only promotion changes (through the script, human
  gate intact). The scorecard's "catalog surface not scored yet" note
  falls out of date once picks are seeded — update it in the go-live
  record, not here.
