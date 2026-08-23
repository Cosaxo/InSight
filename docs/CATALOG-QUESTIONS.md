# Catalog questions — "favourite X" with a thousand options

**Status: LIVE (D232, 2026-08-23).**
Twenty-three pick cards serve from the live bank —
`content/pick-questions.json`, promoted from the archive through
`npm run promote` — across pokemon, emoji, elements, countries and
dogs; the pokemon six joined the same day the owner cleared the
nominative-use check (see the pilot note below). The sixth domain,
**colors**, was committed the same day from a parallel thread (#261) —
catalogue, keys and archive entries all in place, live cards pending
their own promote run. The seventh, **films**, was committed
2026-08-23 by the D15 operator run (**D255**) — catalogue and keys in
place, cards pending their own promote run. Written 2026-07-30 as a
design sketch, after the v15 UI merge; the same day, steps 1–3 shipped
(Pokédex catalogue, demo `pick` card, canon backend — **D14**) and step
4's machinery followed (QID key sets, domain-aware validation, the
Wikidata generator — **D15**). The load-bearing choices live in those
decision records now; this document keeps the full arguments. What
remains open: **artists**. The same run generated it and D255 refused
it — sitelink fame ranks the person and P106 calls anyone who ever
played or wrote a musician, so ten of the top twenty were Leonardo da
Vinci, Goethe, Chaplin and company. Its key set stays empty until a
curation rule exists that says "famous *for* music", which no Wikidata
property states.

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
- **The long tail shreds itself.** Free text fragments one answer into
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
  poll — likely fine, but it gets a real answer, not an assumption.
  **Answered 2026-08-23: cleared by the owner** — nominative use of the
  names, no artwork (the art refusal in the imagery table below stands
  untouched). The six pokemon cards promoted the same day.)
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

## Entity images — where they could come from, and why launch is text-first

Names and keys are data: CC0 facts (Wikidata) or nominative use in a
"favourite" poll. **Images are creative works with their own copyright**,
so the licensing class changes per domain and there is no single "image
source" to adopt. The honest per-domain map (owner question, 2026-08-01):

| Domain | Image source | Verdict |
| --- | --- | --- |
| Emoji | the character itself | **Solved by construction.** The catalogue stores the glyph in the display name; the platform emoji font renders it. Zero licensing. (Twemoji CC-BY / Noto OFL exist if pixel-identical cross-platform rendering ever matters — it doesn't today.) |
| Pokémon | official art / game sprites | **Refused, the D15 way.** The artwork is Nintendo/Creatures/Game Freak copyright; PokéAPI *hosts* sprites but hosting is not a licence, and reproducing the art in a commercial store app would be the largest IP exposure in the product — against a famously litigious rights-holder, on top of the nominative-use trademark check the names already owe. Silhouettes and fan art are still derivative works. Names stay text; at most, generic decoration (type-coloured chips) that reproduces nothing. |
| Films | posters | **Not at launch; TMDB is the route if ever.** Posters are studio copyright; Wikimedia Commons doesn't host them (Wikipedia's fair-use rationales do not transfer to us). The industry-standard path is TMDB's API (posters + required attribution) — that is a terms review plus a network-surface decision (external image CDN vs the app's Firebase-only egress posture), and it gets its own DECISIONS entry post-launch or not at all. |
| Music artists | Wikidata P18 → Wikimedia Commons | **The one real free-content route.** Many notable artists have CC-licensed portraits on Commons, reachable mechanically: `build-catalog.mjs` already speaks SPARQL, so the build can pull P18 + licence + author per row. Costs that make it post-launch: coverage is partial and uneven (a half-illustrated picker reads as broken), every image needs its attribution shipped in-app, and thumbnails must be rehosted — never hotlinked, never bundled. |
| People in daily/duel prompts (Messi, Tarantino…) | same Commons route | **Out.** The text is the product; likeness/publicity considerations arrive for zero mechanical benefit to a blind-answer card. |

If any domain ever goes visual, the rules (recorded now so it is a
decision, not drift):

1. **Images are sourced at build time by the operator scripts**, with
   per-file licence, author, and source-URL columns beside the key —
   never fetched from third parties at runtime, and **never sourced by
   the farm or any scheduled run** (the D15 "never from model memory"
   rule, applied to media: every image needs a verifiable licence, which
   is a human-verifiable-source problem).
2. **Rehosted on our hosting as sized thumbnails, lazy-loaded** on first
   picker open — never in the JS bundle (`check:bundle`/D27 applies
   verbatim), never hotlinked from Commons or anyone's CDN.
3. **Attribution renders in-app** wherever the images do.
4. `check:catalogs` extends to bind image and licence columns the same
   both-directions way it binds keys.
5. One DECISIONS entry per domain that goes visual.

## The card: a new `pick` type

Feed card shape mirrors `rate` (the v15 precedent for a type that feeds its
own surface): `{ id, cat, type: 'pick', domain: 'pokemon', prompt }`.
Unanswered, the card is a search field over the catalogue (the `CityPicker`
interaction, restyled to the feed) plus "Not listed". The answer written is
`{ entity: <key> }` — create-only, owner-written and world-readable, same as every other answer
(D5 unchanged).

Server-side validation cannot live in `firestore.rules` (a thousand-entry
`in` list is not a rules construct); the aggregate trigger validates the key
against the same generated key set the client shipped, and an unknown key
simply never aggregates. The invalid answer still exists as the owner's own
create-only doc — worthless to the aggregate, harmless to everyone else.

## The reveal: a canon, not a split

A favourite-of-1,000 has no 52/48 to stage. The reveal is a **leaderboard**:

- Publish the **top N entities (N = 10)** whose counts clear the per-bucket
  board (`canonTopN`, a display cap — no floor since D98), rewritten on every answer —
  the existing D7 cadence, unchanged.
- Everything else folds into one **"everyone else" bucket** = total −
  published, and `rest` now means exactly what a reader always assumed:
  the tail outside the top N. **D98 deleted the three disclosure rules
  this bullet used to carry** — the below-floor drop, the boundary
  tie-group fold, and the complementary suppression that folded one extra
  row when a single hidden entity would have been recoverable as
  `total - published`. Every one of them was protecting a count against a
  reader who can now read the answers themselves. `canonTopN` keeps the
  code comment recording what it stopped doing.
- Capping at N bounds the public doc size regardless of catalogue size, and
  keeps the reveal readable — the **only** reason the cap survives, now
  that it is not also a disclosure control. Ties at the boundary are
  ranked, not folded: entities with equal counts sort by key so equal
  inputs give equal outputs, and the client re-sorts anyway.
- The published document is `{ total, top, rest, by }` and nothing else.
  An earlier version of this section described two extra scalars — how
  many distinct entries the tail covered, and whether all of them were
  still below the floor — feeding tail copy like "47 votes across 30+
  other films — none with 5 yet". Neither field exists; both were shapes
  of the floor, and the honest tail line is now just `rest` against
  `total`.
- **An entity with one vote is as publishable as one with a thousand**,
  so your own pick shows on the board like anyone else's rather than
  needing the "it is your own answer" carve-out the `feed-read.js`
  argument used to supply.

**The demo store has not followed, and that is a known divergence rather
than a second opinion.** `pick-data.js` `canon()` still filters on its own
`AGG_MIN_N` and still returns `restEntities` / `restBelowFloor`, so a mock
build hides tail entities the live app would draw and computes two scalars
the live document does not carry. It is prototype furniture on the demo
path only — no live surface reads it — but a reader comparing the two
stores should know which one is current. Converting it is a behaviour
change to mock mode, so it is left for whoever next touches that file.

## What is deferred, with the arithmetic

**Per-anchor breakdowns (`agg.by`) do not apply to `pick` questions in v1.**
As first written this was a floor argument: a split of 1,000 entities across
6 dimensions × ~4 buckets each needed a cell of ≥ 5 *per entity per bucket*,
so all but the top handful of (entity × bucket) cells sat below the floor
and the suppression bookkeeping across ~24,000 cells bought almost nothing
visible. If demand appeared, the viable form was breakdowns **for the
published top-N only** — 10 entities × 6 dims, the same cell count a vote
question already handles. *(Demand appeared the same day this shipped; the
top-N-only form is now built — D17.)*

**D98 removed the floor half of that argument and left the arithmetic
standing.** Every cell publishes now, so nothing is suppressed and there is
no bookkeeping — but 24,000 cells in one document is a **size** problem
against Firestore's 1 MiB limit, and 24,000 cells on one screen is a
legibility problem. Top-N-only remains the shipped form for those two
reasons, which were always the durable ones.

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
   owner-written like every other answer; a `pure.ts` test for the fold's
   subtraction rule that **fails without the change**.
4. Films/artists catalogues from Wikidata, only after the Pokémon pilot
   proves the reveal is worth reading. *(Films: done 2026-08-23, D255.
   Artists: generated the same day and refused on content — the query
   is honest and the catalogue it produces is not a music catalogue.)*
