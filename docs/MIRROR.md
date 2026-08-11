# The Mirror — where the answers add up

Described as "one blind question a day", InSight sounds like a poll with
a streak. Open it and answering is the *smaller* half — a few taps, then
a split — and everything else is the Mirror: one tab, one verb, seven
stops from *you* to *the world*, every one of them reading the same
numbers through a different cut. It is not the small tab either — the
modules behind it outweigh the daily and its feed put together — and for
a long time none of the documentation said so.

This file is the read path. `docs/SCHEMA-V2.md` says what is written and
`docs/data-inventory.md` says who may read it; this one says what those
documents **become** on screen, which stop reads which of them, and —
because it is the question this repo answers first — which parts are real
today and which are still the prototype's furniture.

## 1 · One answer, and everywhere it goes

Nothing in the app is a separate feature with a separate store. There is
one write — an answer — and the surfaces differ only in how they cut it.

```
  you answer                 what is written                    what reads it
  ──────────                 ───────────────                    ─────────────
  today's daily   ─┐
  a feed card     ─┤   v2_users/{uid}/answers/{qid}   ─┬──────► the MAP ("You")
  a test item     ─┤     optionIdx · anchors snapshot   │        every answer filed
  a learn card    ─┤     owner-only (D5) · edits (D86)   │        under its question's
  a duel question ─┘                │                   │        branch → sub-branch
                                    │                   │
                        the aggregate trigger           ├──────► the four core TESTS
                                    ↓                   │        and the lenses,
                     v2_aggs_private/{qid}              │        filled passively
                       counts · by{dim}{bucket}         │
                       exact · server-only              └──────► your PROFILE, and
                                    ↓                            Compare's "you vs them"
                       k-floor (AGG_MIN_N), published
                       once per PUBLISH_EVERY answers
                                    ↓
                     v2_question_aggs/{qid}      ──────────────► the MIRROR's
                       counts · by{dim}{bucket}                  Near · Country · World
                       any signed-in user                        (your own bucket)

  the duel answers above ─►  reveal doc, server-written  ──────► the MIRROR's Groups
   (sealed, same collection)  next day, members only              portrait
```

Three joints hold that picture together, and each is enforced rather than
observed:

**The anchors snapshot is the join.** Every answer carries a copy of the
profile fields it was answered under — `BREAKDOWN_DIMS` in
`functions/src/pure.ts`: age band, gender, city, country, education,
relationship. A *copy*, taken at vote time, so editing your profile
tomorrow cannot move yesterday's answer into a different cohort (D8).
`profession` is deliberately not among them: it is free text, so every
distinct spelling would mint a bucket key forever. That snapshot is the
entire reason the Mirror can say "everyone in your city" without the
server ever reading another user's document.

**The floor is what makes the cut publishable.** The exact counts stay in
a collection no client may read. The public mirror carries a cohort only
once it holds at least `AGG_MIN_N` answers (5 by design; **paused to 1
until launch traction — D81**, so counts currently publish from the first
answer, exactly), updates once per `PUBLISH_EVERY` so no single step is
attributable (also paused to 1), and applies *complementary suppression*:
if hiding the sub-floor buckets would leave exactly one hole, the smallest
surviving bucket goes too, because one hole plus a known total is a
subtraction away from being no floor at all. `publishableBreakdown` in
`pure.ts` owns that, with its own tests.

**One family never slices.** The `test-political-*` items publish their
overall split like anything else and carry **no per-anchor breakdown at
all** (D44) — a political item cross-tabbed by city and education is
the Art. 9 exposure the owner-only test result already refuses. The other
test families do slice, and that is exactly what the Mirror's cohort views
are reading when a Big Five item shows up under "your country".

## 2 · The seven stops

One telescope, from fully retracted to fully extended. The picker is a
single ruler you can drag along; the stop you pick recolors the whole tab.

| Stop | What it is | Where the numbers come from | Real in live mode? |
| --- | --- | --- | --- |
| **You** | the Map — you, alone, visualized | your own answers, hydrated from Firestore into `DAILYQ` | yes, except the typicality stats (§5) |
| **Circle** | your close ties | nothing: v2 has no person-to-person graph | no — live shows an honest empty state |
| **Groups** | your named circles | real reveal history, `groupPortrait.ts` | yes |
| **Near** | your city's answers + the Right-now radius counter (D84) | `v2_question_aggs.by.city[your city]`; `nearbyCountV2` for the live headcount | yes |
| **City** | — | folded into Near (D9) | dropped from the ruler in live mode |
| **Country** | everyone in your country | `v2_question_aggs.by.country[…]` | yes |
| **World** | everyone | `v2_question_aggs.counts` | yes |

**You — the Map.** The one stop that is not a population at all. Every
daily answer becomes a dot, filed under its question's branch and
sub-branch, so the shape you accumulate is a constellation rather than a
list: how far a dot sits from the centre is how *unusual* your answer was,
a sub-branch with one answer collapses into the answer itself, and
mastered Learn facts land on the same canvas under their subject and
field. Cards still in the spaced-repetition queue stay off it — a map you
cannot trust is furniture.

**Circle.** Live mode says what is missing instead of showing the named
people `relmap-core.js` invents behind a badge. There is no mutual-follow
graph in v2; groups joined by an invite code are the only real connection
the app can make (D3), and the empty state says so and points at them.

**Groups.** The alignment ring, the answer rows and the per-member
likeness are all computed from `v2_groups/{gid}/reveals/{day}` documents
the viewer can already read, over the last fortnight
(`REVEAL_HIST_DAYS`) — every number is one the user could recompute from
the reveals themselves. Duos are excluded on purpose: with two voters,
"with the majority" is always true and the ring would read 100% forever.
What the demo body showed and this one does not — trait axes, compare
populations, "how they see you" crowns — has no real source yet, and
returns when something feeds it.

**Near / Country / World.** After D9 these are one question at three
radii, which is why one renderer serves all three: three renderers would
eventually disagree about what a withheld cell means. They draw counts,
never people — no names, no avatars, no "someone near you also said". A
missing cell is labelled as *withheld*, never drawn as zero, and the
number of withheld questions is stated on the screen.

## 3 · The lens row — the designed shape, and what live mode ships

The prototype's Mirror is two levels: **who** (the ruler) and **what** (a
row of lenses under it). Each stop keeps one grammar — you at the centre,
them arranged around you, distance = unlikeness — and hangs whichever of
these lenses its population can support:

- **Answers** — the daily record: every question, answered by the
  population this stop reflects. Filter by branch, sort by newest / most
  divisive / most agreed, expand a row into the full distribution with
  your own answer marked. Present at every stop.
- **People** — who is in this population, arranged by likeness (Kindred
  on the geographic stops, the demographic mix where there is one, the
  read-run on Circle).
- **Compare** — you against them across every assessment, in the results
  profile's own visual language: the petal is solid as far as you *both*
  reach and pale for the distance between you, so agreement looks like a
  whole shape.
- **Scores** — the place-rating scorecard, fed by rate questions in the
  feed. World stop only, at each of its three zooms.
- **Explore** — pick trait chips (age, gender, place, and — since the v18
  sync — a pole of any test you have taken, with your own pole marked and
  a "like me" shortcut) and see what that slice believes, led by where it
  *differs* from everyone. The globe only.

**Read that as the design, not as today's live build.** The lens row lives
inside the demo field bodies (`mirror-field-pops.jsx`,
`group-mirror.jsx`). Every stop that has a live source replaces the whole
body with a single panel — `LiveCohortBody` for Near/Country/World,
`LiveGroupsMirrorBody` for Groups, the Map for You — so in live mode the
ruler is there and the lens row is not. That is a consequence of the
replacements being honest rather than an oversight: four of the five
lenses need a data source live mode does not have yet (Kindred strangers,
the demographic mix, the trait-slice splits, and Compare's second person),
and the fifth, Answers, is the panel the live bodies already are. Lenses
come back a source at a time, which is the same rule the Groups portrait
followed.

## 4 · The passive half: tests that fill themselves

The four core instruments — Big Five, politics, values, social — and the
minor lenses beside them (`IS_LENSES`) have no test flow to sit down for.
Their items ship as ordinary feed cards (`surface: "test"`), so answering
the feed fills them in the background, and because they are ordinary
cards their option counts publish like any other question's. (True of
the minor lenses only since D89 — under D50 their answers were
device-local self-reports with nothing aggregated; against a bank with
no lens rows a lens card still degrades to that acknowledgment rather
than inventing a crowd.)

That is the loop that makes the Mirror worth opening twice: an answer
feeds a result, the result becomes a *cut line* other people's answers can
be read through (`VOTECUTS` — demographics first, then the four tests,
each opening into its own axes), and the cut lines send you back into the
feed. Two rules keep it honest, both divergences from the prototype:
passive progress starts at **zero** in live mode rather than pre-filled,
and a lens's "typical person" baseline is drawn as a reference shape only
— never blended into your own score as a prior, because part of "your"
result being invented is the thing D1 exists to prevent.

The verified logic test is the exception to all of this: it is a sit-down
instrument, procedurally generated, scored on the server, and its result
is written by a callable the rules refuse to let a client mutate (D57).

## 5 · What is still sample data, and how you can tell

The Mirror is where the port's prototype data survives most, and the app
labels it rather than hiding it. Any demo population in a live build wears
a **Preview · sample people** tag; the live bodies (Groups, Near, Country,
World) deliberately do not, because carrying nothing fabricated is the
point of them.

Two gaps are worth stating in prose because no badge covers them:

- **The Map's typicality stats were synthetic, and are now refused
  (D72).** `window.MapStats` is a deterministic mock — plausible, stable
  per question, and fake — and it used to drive how far a dot sits from
  the centre plus every "people who share this trait answered…" line in
  the tapped-answer card, in live mode, on the one stop that shows no
  preview tag (the tag is keyed to population, and the Map is not one).
  `dist`, `mode` and `dimVal` now return **null** when `LIVE.enabled`, so
  live mode draws the honest line instead — *"Your answer is on the map.
  How people your age answered isn't measured yet."* Your own answers and
  their placement were always real and still are: `map-tab.jsx` read
  MapStats through a null guard already, and its fallbacks put every dot
  at one radius with none marked a rare take.

  Two of the eight Map anchors have a real counterpart waiting —
  `v2_question_aggs.by` carries k-floored age and education breakdowns.
  The other six cannot: `job` is profession, deliberately not a
  breakdown dim (D8), and the five test anchors are not dims at all.
- **The Circle and its relationship map are prototype-only.** `relmap`'s
  people are invented, and it is the largest module still loaded eagerly
  — the one overlay excluded from the after-first-paint group, because
  the Mirror reads `RelationshipMap` during a render nothing re-triggers
  to decide whether Circle draws the embedded map or the generic field
  (D38).

## 6 · Where the code is

| Piece | File |
| --- | --- |
| the ruler, the seven stops, live/demo branching | `src/v2/spec/mirror-tab.jsx` |
| the field canvas, detail card, lens row | `src/v2/spec/mirror-field.jsx` |
| the per-population node lists | `src/v2/spec/mirror-field-pops.jsx` |
| the daily record | `src/v2/spec/mirror-answers.jsx` |
| the Map | `src/v2/spec/map-tab.jsx` (+ `map-*.js*`) |
| Near / Country / World, live | `src/v2/ui/LiveCohortBody.tsx` |
| Groups, live | `src/v2/ui/LiveGroupsMirrorBody.tsx` + `data/groupPortrait.ts` |
| the group as a cast of roles | `src/v2/spec/group-role-map.jsx` |
| Compare | `src/v2/spec/compare-breakdown.jsx` |
| Explore | `src/v2/spec/segment-explorer.jsx` |
| the cut list every breakdown reads | `src/v2/spec/vote-cuts.js` |
| the fold, the floor, the suppression | `functions/src/pure.ts`, `functions/src/v2.ts` |
| who may read any of it | `firestore.rules` |

## 7 · The decisions this file leans on

D1 (no fake anything, circle-scoped comments) · D3 (anonymous-first,
groups by invite code) · D5 (owner-only answers; the option is editable
since D86, the cohort snapshot is not) · D8
(per-anchor breakdowns and the snapshot they read) · D9 (Near is your
city) · D18 (the floor bounds cohort size, not the split inside a
cohort) · D32 (Learn's first attempt only) · D38 (why relmap stays
eager) · D44 (political items never slice) · D57 (server-scored logic).
