# Catalog questions — "favourite X" with a thousand options

**Status: LIVE (D232, 2026-08-23).**
Twenty-four pick cards serve from the live bank —
`content/pick-questions.json`, promoted from the archive through
`npm run promote` — across pokemon, emoji, elements, countries and
dogs; the pokemon six joined the same day the owner cleared the
nominative-use check (see the pilot note below). The sixth domain,
**colors**, was committed the same day from a parallel thread (#261) —
catalogue, keys and archive entries all in place, live cards pending
their own promote run. The seventh, **films**, was committed
2026-08-23 by the D15 operator run (**D266**) — catalogue and keys in
place, cards pending their own promote run. Written 2026-07-30 as a
design sketch, after the v15 UI merge; the same day, steps 1–3 shipped
(Pokédex catalogue, demo `pick` card, canon backend — **D14**) and step
4's machinery followed (QID key sets, domain-aware validation, the
Wikidata generator — **D15**). The eighth domain, **athletes**, was
committed 2026-08-26 (**D308**): 640 sitelink-ranked entries under the
artists' ratio rule (≥⅓ of occupations athletic, checked against the
P279* closure under Q2066131) with `content/athlete-review.json` as its
reviewed-exceptions file — the D267 machinery, one domain over — plus
its own live card (`pick-pk28`) and the browse-tiles row the pick ask
carries — for the sitelink-ranked domains at D308, and for every domain
in its file's own order, paged eight tiles at a time, since **D389**
(2026-09-06). **Videogames** was
committed 2026-09-06 by the Sunday domain slot: 1,000 sitelink-ranked
games under the films shape exactly (direct `P31 Q7889`, QID keys, year
disambiguation, no curation rule needed — a game's class membership
does not lie the way a person's P106 does), with two measured deltas
recorded in the builder: a floor of 15 (40 returns only 176 rows) and
`"en,mul"` label fallback (plain `"en"` returned Minecraft, Tetris and
Fortnite as bare QIDs — the Messi failure, one domain over). The
load-bearing choices
live in those decision records now; this document keeps the full
arguments. What remains open: **artists**. The same run generated it and D266 refused
it — sitelink fame ranks the person and P106 calls anyone who ever
played or wrote a musician, so ten of the top twenty were Leonardo da
Vinci, Goethe, Chaplin and company. **D267 built what it waits on**: a
mechanical rule (at least a third of an entry's occupations musical,
groups exempt) plus `content/artist-review.json` for the names no rule
reaches, because no Wikidata property states "famous *for* music" and
the measurements say none can be made to. The key set stays empty until
someone rules on the candidates — `node scripts/build-catalog.mjs
artists --review-list 300` prints them — and then runs the build.

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

## Entity images — where they come from, and what the owner ruled

**Status: BUILT AND PICTURED (D421, 2026-09-07; every domain at D422 and
the run itself at D423, 2026-09-08).** Every routed domain has its
pictures in the tree — 3,676 files, 22.3 MB, counts per domain in
D423 § 1. Films are the one still on their fallback: no `TMDB_API_KEY`,
so their 731 are Commons' free posters rather than TMDB's, and the key
is the owner's row on `OWNER-LIST.md`.
The owner's ruling, on being told the copyright map below: *"why is it
limeted by copyright wikipedia uses images cant we use them as well"*,
then *"i feel if letterbox can do it so can we i think we can atemt it
and if we recive a complain we take it down."* That is the policy —
**attempt, and take down on complaint** — and the build is shaped by its
second half: a picture is a committed file on our own hosting
(`web/catalog-art/<domain>/<key>.<ext>`, served from `SITE_ORIGIN`),
so a takedown is `node scripts/build-catalog-art.mjs <domain> --remove
<key>`, a commit, and the hosting deploy the merge triggers — never an
app-store release. A device stops drawing the picture within
Cache-Control's hour, and `check:catalog-art` holds that hour. The
tree carries the whole pipeline and every domain's pictures. The
Pokémon landed first, at D422: PokéAPI's GitHub host was the one the
building session could reach, and the other five needed Wikidata,
Commons and its thumbnail host, which it could not (D15's reason, one
artifact over). D423 is the run that fetched them from a session whose
network policy allowed those hosts — and its § 2 is the part to read
before the next refresh, because three things stood in the way that no
amount of correct code avoids: a SEVENTH host nobody had written down
(`thumb.wikimedia.org`, where Commons now serves thumbnails — D422 § 4
names `upload.wikimedia.org` and is wrong), Node's `fetch` ignoring
`HTTPS_PROXY` unless `NODE_USE_ENV_PROXY=1`, and a shared cloud IP
being rate-limited to about one Commons API call a minute. The builder
now waits a rate limit out instead of dying on it. On 2026-09-08 the owner extended the
ruling to Pokémon and every other domain (*"i think we do the same
system for pokemon and all the other"*), and asked whether it would be
expensive on Firebase; D422 § 3 has the arithmetic (hosting egress
only, no Firestore read or write, cents at a thousand daily users).

Names and keys are data: CC0 facts (Wikidata) or nominative use in a
"favourite" poll. **Images are creative works with their own copyright**,
so the licensing class changes per domain and there is no single "image
source" to adopt. The honest per-domain map (owner question, 2026-08-01;
the third column is what D421 made of each row):

| Domain | Image source | Standing after D421 |
| --- | --- | --- |
| Emoji | the character itself | **Solved by construction, drawn since D308.** The catalogue stores the glyph in the display name; the platform emoji font renders it. Zero licensing. |
| Colours | the key itself | **Solved by construction, drawn since D308.** The key is the hex plus one, so the tile wears the colour. |
| Elements | the symbol, in the name | Nothing to picture. |
| Countries | Wikidata P41 → the flag on Commons | **Free, the builder's `countries` route** (ISO numeric → P299 → P41). Flags are public domain almost without exception; the thumbnail is a PNG render of the SVG. |
| Athletes · Artists · Video games | Wikidata P18 → Wikimedia Commons (video games also P154, the logo) | **The free-content route, built.** The builder pulls the P18 file, reads its licence and author from Commons' own metadata, admits only what `licenceAllowed` admits (CC0, public domain, CC BY, CC BY-SA, FAL — never NC, ND, GFDL-only or anything unrecognised), and writes the credit beside the key. Coverage is partial and uneven, which is why the generated face stays underneath (D308's pattern is the permanent fallback, the way initials are under a profile photo). One question is not copyright and is recorded rather than decided: Norwegian law protects a person's picture separately (åndsverkloven § 104) and wants consent unless the picture has current and general interest — a famous athlete on a favourite-athlete card is very likely inside that exception, but it is the same judgement D178 made about faces and it is the owner's. |
| Films | posters | **The tolerated route, built as TMDB.** Posters are studio copyright; Commons does not host them, and Wikipedia's own copies sit under a fair-use rationale its policy confines to one article each — a grid of a thousand posters is the gallery use Wikipedia forbids itself. What the owner's Letterboxd comparison names is the industry route: TMDB's API serves posters with attribution, free for non-commercial use and under a commercial licence otherwise, and studios treat posters as the marketing they are. Tolerance is not a licence, and the terms page names Norway, where there is no general fair-use rule to fall back on — so this row runs under the take-down policy on the record, and the key and the licence question are the owner's (`OWNER-LIST.md` § Decisions). |
| Video games (covers) | publisher cover art | Same class as posters; the API route is IGDB (a Twitch developer registration), for which the builder has no route yet. The P18 route above catches what Commons has, which for games is mostly logos. |
| Pokémon | PokéAPI's official artwork, by dex number | **On the pipeline by the owner's word, 2026-09-08 (D422).** The owner cleared the NAMES on 2026-08-23 with the art refusal standing; the 2026-09-07 ruling was about posters, and the session put Pokémon back to the owner with the recommendation to leave it, because Nintendo is the rights-holder in this table whose first letter is not a request. The owner's answer was *"the same system for pokemon and all the other"*, so the `pokeapi` route fetches the 475 px artwork and `toThumb` makes it a 184 px WebP with its transparency kept, credited to Nintendo / Creatures Inc. / GAME FREAK inc. under the tag `PokeAPI` — a ruled source, not a licence, and the credits sheet says whose it is. The refusal that stood in this row for a year is kept as the record of the exposure, and the takedown is the same one command. |
| Dogs | Commons, found by NAME | **Routed at D422.** A minted key has no entity behind it, but the names are Wikipedia's (`build-dogs.mjs`), so the builder matches each name against Wikidata's English label or alias among the dog-breed classes (Q39367, Q1418384, Q25409459) and takes that item's P18. A miss keeps its face. |
| Languages · Elements | — | No route on purpose, and the builder says why: a language has no picture, and a photograph of an element is a photograph of a jar. |
| People in daily/duel prompts (Messi, Tarantino…) | same Commons route | **Out, unchanged.** The text is the product; likeness considerations arrive for zero mechanical benefit to a blind-answer card. |

**What "we don't do anything that violates copyright" gets wrong, kept
here so the next reader does not re-derive it:** the right copyright
protects is the right to copy and to show. Putting a poster in the app
makes a copy on our hosting and displays it to the public, which are the
two acts the studio owns, whether or not anything is sold and whether or
not the studio minds. Whether a rights-holder would ever act is a
separate question — risk — from whether the act is licensed — law — and
the owner's ruling is a risk decision, recorded as one. It licenses
nothing and claims nothing about the law; what it decides is who answers
a complaint and how fast: with a takedown, within the hour.

The rules for a domain that goes visual (recorded 2026-08-01, made
concrete by D421 — each is now code, and the gate names the file):

1. **Images are sourced at build time by an operator running
   `scripts/build-catalog-art.mjs`**, with licence, author and
   source-URL columns beside the key in `credits.tsv` — never fetched
   from third parties at runtime, and **never sourced by the farm or any
   scheduled run** (the D15 "never from model memory" rule, applied to
   media: every image needs a verifiable licence, which is a
   human-verifiable-source problem; the source URL is on every row).
2. **Rehosted on our hosting as sized thumbnails** — every picture
   re-encoded on the way in by `toThumb` (fitted inside 184 px, EXIF
   dropped, WebP with alpha, under 64 KB; D422 added the re-encoder
   because PokéAPI's artwork arrives at 475 px and 100–300 KB), under
   `web/catalog-art/` — **lazy-loaded** by the tile that draws
   them — never in the JS bundle (`check:bundle`/D27 applies verbatim;
   `web/` is not the app), never hotlinked from Commons or anyone's
   CDN (the viewer's IP, and a picture that could change after it was
   reported — `avatar.ts`'s third property). Hosting rather than the
   native package because of the policy's second half: a file in the
   package comes down with a release and a review; a file on hosting
   comes down with a commit.
3. **Attribution renders in-app** wherever the images do —
   `ui/PickCredits.tsx`, the *Image credits* door under the browse row
   and under the reveal's two faces, opening into the domain's whole
   credits list fetched from hosting on first open. For a CC BY picture
   that door is the licence's one condition; for TMDB it carries the
   sentence their terms ask for verbatim.
4. **`check:catalog-art`** binds image ↔ credits row ↔ catalogue key ↔
   `src/v2/data/catalogArtIndex.ts` ↔ the hosting headers, both
   directions each, absence included — the same shape `check:catalogs`
   gives keys.
5. One DECISIONS entry per domain that goes visual. D421 is the
   pipeline's and the first run's; Pokémon, if ever, is its own.

**Where a picture draws.** `ui/PickArt.tsx` is the one component: an
`<img>` over the generated face, transparent until decoded and gone on a
failed load, so a half-pictured catalogue reads as a row of faces some of
which are photographs, and a taken-down picture reads as the face it had
before. The browse row's tiles (`ui/PickTiles.tsx`) and the reveal's
"your pick" / "the crowd" faces (`world-feed.jsx`'s `renderPick`) draw
it; the search's result rows do not, and the demo store's invented
catalogues (`q.catalog`) never will. The app asks the generated index
before it asks the network, so a key with no picture never fires a
request, and a domain with none costs nothing at all.

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
- Since D455 the picks feed the Patterns fit: the canonical key rides
  the answer's ledger entry, the nightly compaction keeps each person's
  picks beside their answer map, and every entity at least eight people
  picked — at most `CANON_TOP_N` per card, the board's own size — is an
  item with a vector, which the Oracle reads as the viewer's own
  evidence. Drawing a pick on the Map is `VISUAL-REQUESTS.md` item 13;
  whether the cards should be served as core is an owner-list row.

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
   proves the reveal is worth reading. *(Films: done 2026-08-23, D266.
   Artists: generated the same day and refused on content — the query
   is honest and the catalogue it produces is not a music catalogue.)*
