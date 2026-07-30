# Catalog questions — "favourite X" with a thousand options

**Status: design sketch.** Nothing here is built, and nothing here is a
decision record — if this ships, the load-bearing choices below (canonical
keys, the leaderboard reveal, the breakdown deferral) graduate into
`DECISIONS.md` at that point. Written 2026-07-30, after the v15 UI merge.

## The question class

"Favourite Pokémon." "Favourite film." "Favourite artist." The daily's
existing types can't carry these: `binary`/`choice` cap out at four options
and the drama of a blind 52/48; `rank` orders a handful of given items;
`rate` scores a fixed subject. A favourite is one pick from a domain of
hundreds to thousands — a different shape with a different reveal.

## The one rule: an answer is a catalogue key, never a string

Free text is ruled out, for reasons that are each individually sufficient:

- **Dedup is entity resolution.** "Beyoncé" / "beyonce" / "Queen B" is a
  research problem, not a cleanup task, and it is never finished — the
  counts stop being honest the moment normalization merges or splits
  entities behind the scenes.
- **The k-floor shreds the long tail.** Free text fragments one answer into
  many sub-floor buckets. This repo has already lived it: the pre-D9 profile
  stored free-text places, and "Norway"/"norway"/"NO" became three cohorts,
  none publishable (see the history note in `functions/src/pure.ts`).
- **Free text at world scale is the moderation surface D1 exists to avoid**,
  and answers are create-only and immutable (D5), so there is no edit path
  to clean up abuse or PII after the fact. That immutability is a feature;
  free text would make it a liability.

The cure is the same one D9 applied to cities: the user picks from a
**shipped canonical catalogue**, and the stored answer is the entry's key.
Duplicates become impossible by construction rather than repaired after the
fact. `public/cities.txt` (10,929 places, generated + committed + drift-
checked by `check-cities.mjs`, searched client-side by `CityPicker`) is the
working precedent for every part of this: the artifact, the gate, and the
picker UX.

## Per-domain catalogues

| Domain | Size | Source | Key |
| --- | --- | --- | --- |
| Pokémon | ~1,025, closed | pointer list (PokéAPI data, CC0-ish facts) | dex number |
| Films | curated top ~1,000 | Wikidata (CC0) | Wikidata QID |
| Music artists | curated top ~1,000 | Wikidata (CC0) | Wikidata QID |

- **Pokémon is the pilot.** The set is closed, small, and stable; the
  catalogue is a few tens of KB; there is no freshness problem. (One check
  before shipping: name/trademark posture for a nominative "favourite"
  poll — likely fine, but it gets a real answer, not an assumption.)
- **Films and artists are open-ended, so the catalogue is curated, not
  complete.** A generated top-N list (Wikidata sitelink/popularity ranked),
  refreshed by re-running the build script, plus an explicit **"Not
  listed"** option — an honest bucket, never a free-text escape hatch.
  Wikidata QIDs give stable canonical keys and CC0 licensing; rows carry
  display name plus search aliases ("The Godfather" / "Godfather"), and the
  aliases exist only for search — storage is always the key.
- Each catalogue is a generated, committed static asset with a
  `check-*` drift gate, exactly like cities: fetched lazily on first open of
  the picker, shipped inside the native package, never parsed on cold start
  (the `check:bundle` argument in `scripts/build-cities.mjs` applies
  verbatim).

## The card: a new `pick` type

Feed card shape mirrors `rate` (the v15 precedent for a type that feeds its
own surface): `{ id, cat, type: 'pick', domain: 'pokemon', prompt }`.
Unanswered, the card is a search field over the catalogue (the `CityPicker`
interaction, restyled to the feed) plus "Not listed". The answer written is
`{ entity: <key> }` — create-only, owner-only, same as every other answer
(D5 unchanged).

Server-side validation cannot live in `firestore.rules` (a thousand-entry
`in` list is not a rules construct); the aggregate trigger validates the key
against the same generated key set the client shipped, and an unknown key
simply never aggregates. The invalid answer still exists as the owner's own
create-only doc — worthless to the aggregate, harmless to everyone else.

## The reveal: a canon, not a split

A favourite-of-1,000 has no 52/48 to stage. The reveal is a **leaderboard**:

- Publish the **top N entities (N = 10)** whose counts clear the per-bucket
  floor (`AGG_MIN_N = 5`), rewritten every `PUBLISH_EVERY = 5` answers —
  the existing D7 cadence, unchanged.
- Everything else folds into one **"everyone else" bucket** = total −
  published. The subtraction-leak rule already in `pure.ts` applies: if
  exactly one entity sits below the floor, its count would be recoverable
  from the remainder, so the fold must cover at least two suppressed
  entities or publish nothing finer than the total. This is the same
  complementary-suppression argument, pointed at entities instead of
  demographic cells.
- Capping at N bounds the public doc size regardless of catalogue size, and
  keeps the reveal readable. Ties at the boundary fold into the bucket.
- **Your own pick always shows to you** — it is your own answer, no floor
  applies (the `feed-read.js` argument). When it is below the floor the
  copy says so honestly: "You: Mudkip — too few Mudkip picks yet to count."

## What is deferred, with the arithmetic

**Per-anchor breakdowns (`agg.by`) do not apply to `pick` questions in v1.**
The existing breakdown floor is per cell. A split of 1,000 entities across
6 dimensions × ~4 buckets each needs a cell of ≥ 5 *per entity per bucket*:
even a question with 10,000 answers spread over a realistic favourite
distribution leaves all but the top handful of (entity × bucket) cells below
the floor, and the suppression bookkeeping across ~24,000 cells buys almost
nothing visible. If demand appears, the viable form is breakdowns **for the
published top-N only** — 10 entities × 6 dims is the same cell count a vote
question already handles. Until then, `pick` publishes totals and the
leaderboard, nothing sliced.

**"Not listed" is a real bucket but never enumerated** — it publishes as a
count only. The moment it dominates a domain, that is the signal the curated
catalogue is stale, not a prompt to collect strings.

## Where it lands in the app

- The card lives in the World feed under its topic (`Games`, `Film`,
  `Music` — Music's map anchor shipped with v15).
- The answer lands on the Mirror/Map like any daily answer, labeled with the
  entity's display name resolved from the catalogue at render time (the
  `PLACES.countryName` pattern: store the key, display the name).
- A possible later surface, in the place-scorecard mold: "the crowd's
  canon" — the standing top-10 per domain. Out of scope for v1.

## Order of work, if picked up

1. `scripts/build-pokedex.mjs` + `public/pokedex.txt` + drift gate — the
   closed-set pilot, no licensing/freshness questions to answer first.
2. `pick` card in the spec layer (search UI on the CityPicker pattern),
   demo-only data, behind the existing demo/live seam.
3. Aggregate trigger: per-entity buckets, top-N + fold, the two floors
   above; rules test asserting a `pick` answer doc is create-only and
   owner-only like every other answer; a `pure.ts` test for the fold's
   subtraction rule that **fails without the change**.
4. Films/artists catalogues from Wikidata, only after the Pokémon pilot
   proves the reveal is worth reading.
