# The frozen design spec

**`InSight_standalone_23.html` is the vision** — supplied by the owner on
2026-08-13 and now committed. **`InSight_standalone_18.html` is still what
`scripts/style-diff.mjs` compares against**, and the two are different jobs:
v23 says where the product is going, v18 is the target the tree is currently
measured to. Re-pointing style-diff is a sync, not a file swap, so it happens
when the work lands rather than the day the file arrives.

A v20 standalone was **partially** synced: D113 took its two continuum feed
forms (`dial`/`field`) and the redrawn compare rose (D114 made the forms
live). A partial sync must not re-point the style-diff target, or style-diff
and the next sync both aim at something that half-describes the tree.

## How to read these files — they are bundles, not source

Both are ~2 MB with 397 lines: a `<script type="__bundler/manifest">` holding
every module gzipped and base64'd. Grepping the raw HTML finds almost nothing
and reading it whole is hopeless. Unpack it instead — the manifest is JSON of
`{uuid: {mime, compressed, data}}`, so base64-decode each `data`, gunzip when
`compressed`, and each module arrives with its filename in the first comment
line (`// mirror-field.jsx — …`). v23 unpacks to **109** modules, v18 to 99.
UUIDs are regenerated per bundle, so diff by module NAME, never by uuid.

## What v23 changes over v18, measured

Twelve modules are new: `patterns-core.js` + `patterns-tab.jsx` (three lenses
over one population), `predict-data.js` + `predict-cards.jsx` and
`map-fore-card.jsx` (Predictions/Foresight), `paths-data.js` +
`paths-card.jsx` (CROSSROADS branching stories), `trait-links.js` +
`trait-web.jsx` (cross-test threads), `nature-data.js` (Born-or-built), and
two `RelationshipMap` splits.

Nine changed, and one dominates: `world-feed.jsx` **+24 KB**, almost all of it
the dial/field continuum breakdowns (`dialBreakdown`, `fieldBreakdown`,
`renderCutChips`) — *"bar = that group's typical answer, hairline = yours,
same grammar as the rate breakdown."* Then `result-card.jsx` (+3.3 KB),
`world-feed-data.js` (+1.8 KB), the map constellation (+2.3 KB),
`map-groups.js`, `compare-breakdown.jsx`, `duo-daily.jsx`, `General.jsx`,
`personmindmap`.

**`mirror-field.jsx`, `mirror-field-pops.jsx`, `mirror-tab.jsx`,
`place-stats.jsx` and `votecuts` are byte-identical between v18 and v23.**
That is worth knowing before blaming a missing file for a wrong screen: where
the live Mirror stops or the who-voted cuts diverge from the vision, they
diverge from the committed v18 reference too, and have since the port.

The earlier v9 prototype and the extracted `spec-modules/`
directory were deleted on 2026-07-29, v14 on 2026-07-30, v15 on
2026-08-04 when v17 superseded it, and v17 on 2026-08-07 when v18 did:
the port is complete, keeping superseded references around is how this
file came to name the wrong target for a full day of "the visuals are
wrong". Git history has them if archaeology ever calls.

It is a self-contained prototype (React + Babel compiled in-browser, all
data mocked): open it in a browser and it runs. Treat it as **read-only**
— design iteration ended with this file, and changes from here happen in
the real codebase.

## What v18 adds over v17

Fourteen of the 93 modules moved, plus the page styles — a revision, not a
redesign. The synced changes, and where each landed in the app:

**Explore, rebuilt around type.** The World's Explore lens drops the
track-and-lozenge bars for typographic rows — quiet question, answer as
real type, a solid rule whose length is the share — and every test you
have taken becomes a slice axis with your own pole marked, plus a
"like me" shortcut. The picker collapses to one line until tapped
(`segment-explorer.jsx`).

**The circle map becomes the control.** Drag a person into another circle
and that IS how you know them (persisted by name, snap-back otherwise, a
dashed ring aims the gesture); circles rename in place, and the add-circle
affordance goes — six wedges are the map's geometry. Hit targets roughly
double (`relmap.jsx`).

**Duels grow a mirror.** A fourth domain — 'mirror', *how they see you* —
replaces "what's ahead" for friend pairs (romantic keeps it): ten new
them-voiced questions interleave the ladder, and the weak-lens callout
compares miss *rates*, not counts (`duels-data.js`,
`content/duel-questions.json`).

**The palette gate solves the gamut.** The 21-row measured tables give way
to solving the sRGB boundary exactly (cached per hue), `wash()` becomes
the one way a hue turns into a tint (never `color-mix` toward
transparent), and `var(--token)` hue sources resolve off the cascade
instead of silently skipping the gate (`world-palette.js`; consumers in
the feed, scenes, suggestions and the mirror field route through it).

**Type marks state their claim.** The result banner leads with the rule —
"very curious + warm →" — measured against population averages with
moderation named ("even on money"), then the type name
(`archetype-data.js`, `result-card.jsx`).

**Smaller things.** The Map's anchor card carries the ring as a chip row
so switching anchors stops meaning closing the card, and the ring stage
fits between the hidden branch rail and the card; the passive rings wear
the standing type's two-tone split; the person overlay's map crop gains a
same/differ key and a soft mask; and a Tweaks → Accents radio ships two
accent-ramp experiments (`daily`, `family`) next to the shipping set.

## What v17 added over v15

**Navigation.** The daily's three modes stop being a switcher in the header
and become a *ruler* in flow — World · Circle · 1v1, the same graduated
axis the Mirror wears, because it is the same kind of choice: how far this
answer reaches. Scroll past it and it docks into the header, crossfading
with the wordmark. Two alternatives ship alongside it behind the Tweaks
panel (`navMode`): the original header `pill`, and a flat `bar` of four —
daily · groups · 1v1 · mirror — with new glyphs for the middle two. The
axis runs off its far end into the Mirror, and the Mirror swipes back onto
1v1. The Mirror's own ruler gains drag-to-scrub with a velocity throw.

**Colour.** Every accent drops from `oklch(0.55 …)` to `0.52` (gold to
`0.53`), `--ink-3` from `0.55` to `0.51`, and two new tokens appear —
`--ochre-ink` and `--accent-ink` — for hues that carry text rather than
fill. World's many topic hues now run through a **palette gate**
(`world-palette.js`): a per-hue lightness/chroma ramp measured against the
real sRGB boundary, so gold stops reading brown and teal stops being
clipped.

**Motion.** One stagger constant, `--rv-step`, that every reveal in the app
is a multiple of.

**Type marks.** A mark is now the type's *signature* rather than an
assigned motif: two axes, each owning a hue and a clock position, drawn as
a two-tone slice (or a ring, or the dot plot, per tweak).

**One ⓘ, everywhere.** `explain-sheet.jsx` — one sheet that says what each
instrument measures and what every mark on it means, opened from the tests,
the lens readings and the result cards.

**App feel.** Haptics, Escape-closes-a-sheet, drag-to-dismiss on the sheet
handle, per-view scroll memory, and rails that fade only on the side that
actually has more to show.

**Smaller things.** A test opens its saved result instead of restarting;
the picker card carries a per-question tick strip; the compare rose draws
the *gap* between two people in one hue instead of overlaying an outline;
duel tiles take real photography and the share numeral rides its own water
line; 1v1 records split by domain (everyday / under pressure / what's
ahead); `ReadRun` picks its own resolution from the span of a run; the
circle map scales past ~72 people by collapsing circles into drillable
discs.

## What v15 specified

Type marks (a drawn badge per archetype, plus the all-types sheet), place
scorecards fed by `rate` cards in the feed, a redesigned result card
(signature emblem banner, 100-dot rarity field, "Where you stand"), a
redesigned test-question screen, a deeper daily archive, member-framed
demographics, a FLIP-animated rank card, and the removal of the
predict/guess stage and the pattern beat.

Its 2026-07-31 revision added: Learn (knowledge cards run as a stream in
the World feed with spaced three-in-a-row mastery); VOTECUTS (one shared
cut list behind every who-voted breakdown); world subtopics; catalogue pick
cards with search-and-pick reveal; a per-take report flow; the map's
over-category ladder; a rebuilt search overlay; the chrome-free Lenses
redesign; the "About this question" context sheet; a quiet-ground surface
treatment; and a slimmed person overlay.

## What v14 specified

Two tabs (**daily** · **mirror**), the daily's three modes (World blind-vote
/ Group / 1v1 duels with sealed next-day reveals) switched from a row that
lives *in the app header*, the question feed with passive test and lens
cards on bare card grounds, the Mirror telescope as one graduated seven-stop
axis (You · Circle · Groups · Near · City · Country · World), archetype
result cards, scenes, the profile, and the full visual language (tokens,
type, per-population accents).

## Checking the app against it

Do not do this by eye. Several rounds of screenshot-comparison missed a
30px headline rendering at 26px, a chip carrying a chevron the prototype
does not have, and — the one that mattered — five feed cards that never
rendered at all. `scripts/style-diff.mjs` walks both builds and reports
every element whose typography, colour or geometry disagrees, plus every
string the prototype renders and the app does not:

```
npm run dev                      # in another shell
npm i --no-save playwright       # not a repo dependency, on purpose
node scripts/style-diff.mjs
```

The script's header lists the divergences that are deliberate. Everything
else it reports is a miss.

## Where the app is allowed to differ

The prototype has no backend, so it never faces the k-anonymity floor, and
some of what it draws would be a disclosure here. Those divergences are
recorded as decisions, not left to taste — see `docs/DECISIONS.md`, in
particular D1 (takes and named who-voted are circle-scoped), D9 (the city
as the unit; its "Near is your city" fold was undone by D111, and D112
made this prototype's similarity fields real), D11 (which prototype
features are demo-only, and why they are unreachable rather than merely
switched off) and D43 (what the v17 sync kept from this repo rather than
from the prototype).

## Where the extracted modules went

`spec-modules/` — the prototype's ~80 modules, extracted and given
readable names for the port — was deleted once the port completed and the
copies had diverged. `src/v2/spec/` is the only spec layer now; the
ported files cite their original module in a header comment, and git
history holds the originals.

Canonical launch content (question banks, archetypes, scenes) is extracted to
[`/content`](../content/) — edit it there, not here.

Binding product decisions, including what is deliberately *not* in v1, live
in [`docs/DECISIONS.md`](../docs/DECISIONS.md).
