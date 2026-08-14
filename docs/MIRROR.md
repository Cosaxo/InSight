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

> **D98 (2026-08-11) changed the answer to "why is this stop dark".**
> Answers, anchors and profiles are readable by any signed-in user, and
> counts are exact from the first answer — no floor, no suppression, no
> political carve-out. Nothing on this tab is withheld any more.
>
> The read path exists as of the same change: `data/voters.ts` does the
> collection-group query on `answers` plus batched uid→name resolution,
> and its consumers are the who-voted sheet's Friends cut
> (`ui/LiveBreakdownPanel.tsx`), the takes panel's side badges and the
> City constellation. Where a surface
> below is still missing, it is missing because **nobody has pointed it
> at that path yet** — a backlog item, not a policy.

## 1 · One answer, and everywhere it goes

Nothing in the app is a separate feature with a separate store. There is
one write — an answer — and the surfaces differ only in how they cut it.

```
  you answer                 what is written                    what reads it
  ──────────                 ───────────────                    ─────────────
  today's daily   ─┐
  a feed card     ─┤   v2_users/{uid}/answers/{qid}   ─┬──────► the MAP ("You")
  a test item     ─┤     optionIdx · anchors snapshot   │        every answer filed
  a learn card    ─┤     public read, owner write (D98)  │        under its question's
  a duel question ─┘     edits: optionIdx only (D86)     │        branch → sub-branch
                                    │                    │
                                    │                    ├──────► NAMED WHO-VOTED
                                    │                    │        data/voters.ts reads
                                    │                    │        these ACROSS users
                                    │                    │
                        the aggregate trigger            ├──────► the four core TESTS
                                    ↓                    │        and the lenses,
                     v2_aggs_private/{qid}               │        filled passively
                       the trigger's working state       │
                       (no readers — a cache,            └──────► your PROFILE, and
                        not a curtain)                            Compare's "you vs them"
                                    ↓
                       published on EVERY answer,
                       exact — no floor, no cadence
                                    ↓
                     v2_question_aggs/{qid}      ──────────────► the MIRROR's
                       counts · by{dim}{bucket}                  City · Country · World
                       any signed-in user                        (any bucket)

  the duel answers above ─►  reveal doc, server-written  ──────► the MIRROR's Groups
   (sealed until then)        next day, world-readable            portrait
```

One more read joined the picture at D112: a completed instrument writes
`testResults` onto the profile doc (`v2_users/{uid}`), world-readable
since D98, and the City stop's constellation reads it ACROSS users — the
person-to-person Compare read the rules comment always promised. The
same fold gives places their profiles with no new write at all: test
items are ordinary `scale` questions, so a city's average axis score is
arithmetic over `by.city` cells that were publishing anyway
(`data/similarity.ts`).

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

**Nothing is withheld (D98).** Every cohort publishes, at every size,
exactly, from its first answer — no `AGG_MIN_N` floor, no `PUBLISH_EVERY`
cadence, no complementary suppression, no `tooSmall`. `v2_aggs_private`
survives as the trigger's working state, holding the same numbers as the
public document: a cache, not a curtain.

An absent cell therefore means **zero**, and the whole
absent-is-not-the-same-as-zero doctrine this file used to carry is gone
with the machinery that made it true.

**Every family slices.** The `test-political-*` items publish their
per-anchor breakdown like everything else. D44 used to exempt them — a
political item cross-tabbed by city and education was treated as Art. 9
exposure — and D98 reversed that along with the general rule it was an
instance of. There is no category of question held back.

## 2 · The seven stops

One telescope, from fully retracted to fully extended. The picker is a
single ruler you can drag along; the stop you pick recolors the whole tab.

| Stop | What it is | Where the numbers come from | Real in live mode? |
| --- | --- | --- | --- |
| **You** | the Map — you, alone, visualized | your own answers, hydrated from Firestore into `DAILYQ` | yes, except the typicality stats (§5), which are mock and refused |
| **Circle** | your close ties | the follow graph (`v2_users/{uid}/following`) + those accounts' answers | yes since D101 — a one-way follow, ranked by likeness |
| **Groups** | your named circles | real reveal history, `groupPortrait.ts` | yes |
| **Near** | who is around you right now — the radius counter (D84), over an anonymous field (D149) | `nearbyCountV2` for the count; the field is the city fold, drawn unnamed. The presence cell stays one of D98's three denies | yes |
| **City** | your city: answers, lenses, and the kindred constellation | `v2_question_aggs.by.city[your city]`; kindred from voter lists + `testResults` (D112) | yes since D111/D112 — its own stop again |
| **Country** | everyone in your country, plus its cities placed by score likeness | `v2_question_aggs.by.country[…]`; city profiles folded from `by.city` (D112) | yes |
| **World** | everyone, plus countries placed by score likeness | `v2_question_aggs.counts`; country profiles from `by.country` (D112) | yes |

**You — the Map.** The one stop that is not a population at all. Every
daily answer becomes a dot, filed under its question's branch and
sub-branch, so the shape you accumulate is a constellation rather than a
list: how far a dot sits from the centre is how *unusual* your answer was,
a sub-branch with one answer collapses into the answer itself, and
mastered Learn facts land on the same canvas under their subject and
field. Cards still in the spaced-repetition queue stay off it — a map you
cannot trust is furniture.

**Circle.** Live mode still never shows the named people
`relmap-core.js` invents — but since D101 it shows real ones. A follow is
a **bookmark, not a permission grant**: D98 already made every answer and
profile readable, so following conveys no access and needs no request,
acceptance or notification. One-way, like a subscription; mutual follows
are a reading the client derives, not a state the server keeps.

The stop draws the accounts you follow ranked by likeness, and under them
the questions your circle is most split on (`circleSplit`, which counts
members only — the opposite of the Map's `typicality`, and §5 says why).
Follows start in exactly two places: a question's who-voted sheet, and
the People lens's Kindred rows. Both are screens where a uid has already
become a person with a reading attached.

**Groups.** The alignment ring, the answer rows and the per-member
likeness are all computed from `v2_groups/{gid}/reveals/{day}` documents
the viewer can already read, over the last fortnight
(`REVEAL_HIST_DAYS`) — every number is one the user could recompute from
the reveals themselves. Duos are excluded on purpose: with two voters,
"with the majority" is always true and the ring would read 100% forever.
What the demo body showed and this one does not — trait axes, compare
populations, "how they see you" crowns — is unbuilt rather than refused
since D98: the members' answers and test results are all readable now.

**Near.** The Right-now radius counter (D84) — how many opted-in phones
are within a couple of kilometres, as a count the server computes from a
cell no user can read — and, since D149, the field around it. It stopped
being "your city" at D111: that fold (D9) put a presence question and a
cohort question behind one stop.

D111's body said the counter was all this stop would ever draw, and D149
records why that was half right. The presence cell really is unreadable
and always will be; what did not follow is that the SCREEN had nothing
else true to show. The people of your city ranked by score likeness are
real and were already drawn one stop over, so Near draws them too —
**anonymously**. `kind: "anon"` in `LiveSimilarityField` is a node with no
initials, no label, no role and no pick handler: the shape of a crowd,
with no way into it. A field you can tap a person out of is a directory,
which is the one thing this stop must not become.

Two numbers, each captioned by what it counts (honesty rule 2 below): the
figure is phones near you *right now*, the ring is people in your *city*.
One caption spanning both is how a screen starts claiming it knows who is
standing next to you.

**City / Country / World.** One question at three radii, one renderer
(`LiveCohortBody`): three renderers would eventually disagree about what
an empty cell means. They draw counts — an absent cell is zero and the
panel says so, because since D98 nothing is held back at any size.

Each also carries its **constellation** (D112): you at the centre,
distance = unlikeness, computed rather than invented. City arranges the
people of your city, ranked primarily by test-score match (answer
agreement as the named fallback); Country arranges your country's cities
and World the countries, each by the distance between your axis scores
and the place's real averages. Tapping a place opens its profile — the
average score per instrument axis, your own tick on every bar, and the
answer count behind each number.

**Since D119 the stop is a tab row, not a scroll** (§3): `Answers ·
People · Compare · Scores`, plus **Explore at the World stop only**
(D151 — see the lens list below for why it is the globe's), one open at a
time, the prototype's nav v2. It used to be the constellation on top, the answer rows under it,
and a collapsed lens strip at the bottom — so Answers was the page and
everything else was a drawer.

**The field is not in that row.** D119 made it a tab, D135 made it the
landing tab, and **D136 took it out of the row entirely** — it draws
above the tabs and stays drawn whatever is open, which is the
prototype's own layout (MFHeader → field → row). D135's reasoning is
what carried it: the field is the stop's identity, and a tab is
something you can be looking away from. The reason D119 led with Answers
still holds and is why Answers now leads the row and is what a stop
opens on — the rows publish from the first answer (D98) while the
constellation waits on completed test scores, and a closed row above an
empty field would be a blank stop. Every empty arm of the field still
offers *"See what they answered"*.

**D136 also removed Foresight from the row** — the lens row is where a
population gets *read*, and Foresight was the only entry that was a
game. Its engine, rules and lens body are all still in the tree; only
the placement is withdrawn, and the feed (where the prototype puts it,
and which D126 named as the open follow-on) is where it goes next.

The similarity fold runs on arrival at every cohort stop — unchanged by
D136, since a stop already opened on the field — and it is free on
re-entry
(`state.testAggsLoaded`), and `LiveCohortBody.test.tsx` pins that.

The stop also leads with a **figure** now, the prototype's MFHeader shape:
the largest single-question count from the cohort, which is a headcount
rather than an answer count because one person answers a question at most
once (D5 create-only; D86's edit moves a vote rather than adding one). It
is a floor, and its unit says "have answered here" — never the
prototype's "12.6k in Oslo", which is a residents count the app has never
had (LiveSimilarityField honesty rule 2, amended at D135 rather than
dropped).

Since D100 they draw the **archive** rather than the week:
`LIVE.aggregated()` is every question this device holds an aggregate for,
which is the deck plus everything the user has answered. That is what
makes the Answers lens's filter and sort worth having, and it is the only
reason Scores can find a rating question at all — the bank holds five in
ninety, so a given week's deck usually serves none.

## 3 · The lens row — the designed shape, and what live mode ships

The prototype's Mirror is two levels: **who** (the ruler) and **what** (a
row of lenses under it). Each stop keeps one grammar — you at the centre,
them arranged around you, distance = unlikeness — and hangs whichever of
these lenses its population can support:

- **Answers** — the daily record: every question, answered by the
  population this stop reflects. Filter by branch, sort by newest / most
  divisive / most agreed, expand a row into the full distribution with
  your own answer marked. Present at every stop. **Live since D100**,
  minus "newest" — the archive spans any day the rotation has reached and
  nothing the client holds dates an answer, so that one ordering is
  refused rather than faked.
- **People** — who is in this population, in two registers (D151 gave the
  live lens the prototype's shape, which it had shipped without): a
  **Who's here** card — size, the age distribution as a histogram with
  your own band filled, the gender split — over **Kindred**, the ranked
  strangers drawn as cards with a match ring, a "Ceramicist · 25-34"
  headline off their frozen answer anchors, their type as a badge and the
  remaining anchors as chips. Its two refusals are the interesting part:
  no tenure split (nothing publishes a join date) and no shared-interest
  chips (stated interests are local and the viewer's own — D128 names the
  Mirror as a surface that may not read them).
- **Compare** — you against them across every assessment, in the results
  profile's own visual language: the petal is solid as far as you *both*
  reach and pale for the distance between you, so agreement looks like a
  whole shape.
- **Scores** — the place-rating scorecard, fed by rate questions in the
  feed. World stop only, at each of its three zooms. **Live since D100**,
  as a scorecard over the bank's *ordinal* questions (five 1-10 `rating`
  items, sixteen 5-point `scale` ones) rather than over place ratings the
  bank does not carry — it filters on question type, so place ratings
  join it the day they are written.
- **Explore** — pick trait chips (age, gender, place, and — since the v18
  sync — a pole of any test you have taken, with your own pole marked and
  a "like me" shortcut) and see what that slice believes, led by where it
  *differs* from everyone. **The globe only**, and the live row offered it
  at every scope until D151. Not a data question: the reading needs
  "everyone" as its baseline, and at City it silently compares a slice of
  one city against that city.
- **Foresight** — *off the row since D136.* v19's own addition and the
  row's only game: ten seconds to say which option a slice picked, scored
  against the published cell. Went live at D126 as the READ half only
  (what CALL is waiting on is in that decision), placed here rather than
  in the feed because a read is scoped to the population the ruler names.
  D136 withdrew that placement — a row of readings is the wrong home for
  a game — without touching the engine, the verdict rules or the lens
  body, all of which are still in the tree and still tested. It has no
  surface today; the feed is the next one.

**Read that as the design, not as today's live build — and read the
reason carefully, because it changed.** The lens row lives inside the demo
field bodies (`mirror-field-pops.jsx`, `group-mirror.jsx`). Every stop
with a live source replaces the whole body with a single panel —
`LiveCohortBody` for City/Country/World, `NearLiveBody` for Near,
`LiveGroupsMirrorBody` for Groups, the Map for You — so live mode used to
ship the ruler and not the lenses.

Until D98 the reason was that four of the five lenses needed data the
privacy model forbade reading: Kindred strangers, the demographic mix,
the trait-slice splits, and Compare's second person. **That reason is
gone, and as of D99 so is most of the gap** — the geographic stops carry
a lens row again:

| Lens | State | Source |
| --- | --- | --- |
| **Answers** | **live**, a peer tab since D119, the prototype's row since D120 | `ui/LiveAnswerRows.tsx` — headline + thin stack + your answer, expanding into labelled option bars (or a histogram for a `rating`) and a where-you-sit sentence. Readings from `cohort.headlineFor` / `cohort.standingIn`. Still no "newest": nothing the client holds dates an answer, so the row prints the answer count where the prototype prints a date |
| **People** | **live** | the mix is `mixFor` over the deck's aggregates; Kindred is `agreement` over the cached voter lists, bounded at 12 of your own answers × the latest 200 voters each (D102) |
| **Compare** | **live** | `pctFor` on your own option, ranked least-typical first — no new read |
| **Explore** | **live** | `divergence` across the six breakdown dims. The v18 test-pole axis is the one part with no source, since test results are not a dim. Its chips and its sentences printed the raw bucket KEY until D125 — a country row read "NO" — and now resolve through `ui/cohortLabels.ts`, the same one a feed card's breakdown sheet uses |
| **Scores** | **live since D100** | `meanScore` over the bank's ordinal questions (`rating` + `scale`), your own score ticked onto each bar. The prototype's *place* scorecard joins the day `rate` questions are written — the lens filters on type |
| **the field itself** | **live since D112**; a tab from D119, the stop's permanent head since D136 | `LiveSimilarityField` — the constellation the demo bodies drew from constants, now computed: kindred by scores on City, place profiles on Country/World. Outside the tab conditional, so it never unmounts and row navigation costs nothing |

The row is the stop's navigation (`ui/MirrorLensTabs`, the prototype's
`MirrorLensRow` ported to TSX over the same CSS), and the cost gate the
collapsed strip used to carry survives the move for free: a tab body
exists only while its tab is open, so Kindred and the similarity fold —
the two readings that can cost a query the app has not already made —
each run on the tap that asks for them and never because the stop was
opened. The bodies behind the row are lazy chunks; the row itself is
not, because a suspense gap where the navigation should be is a stop
that looks broken.

## 4 · The passive half: tests that fill themselves

The four core instruments — Big Five, politics, values, social — and the
minor lenses beside them (`IS_LENSES`) have no test flow to sit down for.
Their items ship as ordinary feed cards (`surface: "test"`), so answering
the feed fills them in the background, and because they are ordinary
cards their option counts publish like any other question's. (True of
the minor lenses only since D91 — under D50 their answers were
device-local self-reports with nothing aggregated; against a bank with
no lens rows a lens card still degrades to that acknowledgment rather
than inventing a crowd.)

**Passive for real since D121.** Until then the feed filled the progress
RING and nothing else: the only writer of a result was a sit-down flow, so
an account that had answered forty test cards still opened its profile on
an empty tab with a "Take this test →" button. That flow is gone —
`test-overlay.jsx`, `window.openTest`, the daily's fast path — and
`data/passiveProfile.ts` scores the instrument from your own feed answers
instead, publishing a result once **every axis has at least two** behind
it. Below that the tab draws its own progress and names the thin axes
rather than a type, because the card draws an archetype and a rarity
percentile and one answer per axis can produce both. Test and lens cards
also gained **"later"** (`data/deferQueue.ts`): a deferral, not a pass —
the card leaves the feed and returns in 20 hours, and keeps returning
until it is answered.

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
a **Preview · sample people** tag; the live bodies (Groups, Near, City,
Country, World) deliberately do not, because carrying nothing fabricated
is the point of them.

The biggest former resident of this section moved out at D112: the
similarity constellations. `mirror-field-pops.jsx` still holds the
invented rosters — "Anders K. · Torshov · 92%", the city `match`
constants under "closer = a city more like you" — but they render only in
demo mode now. The live fields compute the same grammar from real data
(`data/similarity.ts`), and they inherit three of D1's rules where the
prototype cheated: no decorative mist-people, no invented headline count
("12.6k in Oslo" never had an honest source), and thin data is listed
with its reason rather than positioned.

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

  **D99 took the two that had a counterpart.** `age` and `edu` are
  breakdown dims, so `dist`/`mode` now compute from the published cells
  (`data/cohort.ts` `typicality`), and `cohortN` says how many answers
  the reading rests on so a 50% drawn from two people is not presented as
  a finding.

  The other five still refuse, structurally: `job` is profession,
  deliberately never a breakdown dim (D8), and the four test anchors are
  RESULTS with no cohort aggregate anywhere. (Six and five until D103
  retired the Thinking test — one fewer refusal, not one more answer.) `dimVal` refuses at every
  anchor for that same reason. The refusal keeps D72's mechanism — null
  at the source, not a gate at each call site — which is precisely what
  made this fix findable: the null marked which readings were invented
  rather than merely unbuilt.
- **The Circle and its relationship map are prototype-only.** Not for
  want of permission — D98 opened every answer — but because v2 has no
  person-to-person graph at all to draw. `relmap`'s people are invented, and it is the largest module still loaded eagerly
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
| City / Country / World, live | `src/v2/ui/LiveCohortBody.tsx` |
| Near, live — the presence counter and its unnamed field (D111, D149) | `src/v2/ui/NearLiveBody.tsx` |
| the constellations, live (D112) | `src/v2/ui/LiveSimilarityField.tsx` |
| the similarity folds (profiles, matches, ranking) | `src/v2/data/similarity.ts` |
| Groups, live | `src/v2/ui/LiveGroupsMirrorBody.tsx` + `data/groupPortrait.ts` |
| the group as a cast of roles | `src/v2/spec/group-role-map.jsx` |
| Compare | `src/v2/spec/compare-breakdown.jsx` |
| Explore | `src/v2/spec/segment-explorer.jsx` |
| the cut list every breakdown reads | `src/v2/spec/vote-cuts.js` |
| the fold (no floor, no suppression — D98) | `functions/src/pure.ts`, `functions/src/v2.ts` |
| who may read any of it | `firestore.rules` |
| the cross-user read, and the cuts built on it (D148) | `src/v2/data/voters.ts`, `src/v2/ui/LiveBreakdownPanel.tsx` (Friends), `src/v2/ui/LiveTakesPanel.tsx` (sides) |
| a live card's who-voted sheet, cohort-first (D125) | `src/v2/ui/LiveBreakdownPanel.tsx` |
| bucket key → the name a reader sees (D125) | `src/v2/ui/cohortLabels.ts` |
| the cohort folds (mix, slice, divergence, typicality, likeness) | `src/v2/data/cohort.ts` |
| the live lens bodies | `src/v2/ui/LiveMirrorLenses.tsx` |
| the live stop's tab row (D119) | `src/v2/ui/MirrorLensTabs.tsx` + `ui/lensTabs.ts` |
| the live answer rows (D120) | `src/v2/ui/LiveAnswerRows.tsx` (ported from `spec/mirror-answers.jsx`) |
| the passive fold + its threshold (D121) | `src/v2/data/passiveProfile.ts` |
| "later" on a test card (D121) | `src/v2/data/deferQueue.ts` |
| one hue per instrument (D121) | `TEST_HUE` in `src/v2/spec/test-definitions.js` |

## 7 · The decisions this file leans on

**D98 (answers are public; no floor, no suppression, no carve-out)** —
the one this whole file now rests on, and the reversal of D1's
circle-scoping, D5's read arm, D18 and D44.

D1 (no fake anything — the half of D1 that SURVIVES, and now the only
reason anything is ever hidden) · D3 (anonymous-first, groups by invite
code) · D5 (create-only answers, owner-written; the option is editable
since D86, the cohort snapshot is not) · D8 (per-anchor breakdowns and
the snapshot they read) · D9 (the city as the unit — its Near-fold undone
by D111) · D32 (Learn's first attempt only) · D38 (why relmap stays
eager) · D57 (server-scored logic) · D72 (the Map's mock typicality,
refused for being invented rather than private) · D111 (Near is
presence, City is its own stop) · D112 (the similarity surfaces: place
score profiles and kindred by scores, default-on).
