# The frozen design spec

**`InSight_standalone_15.html` is the reference design** — the version the
product is built to, and the file `scripts/style-diff.mjs` compares the
app against. The earlier v9 prototype and the extracted `spec-modules/`
directory were deleted on 2026-07-29, and v14 on 2026-07-30 when v15
superseded it: the port is complete, keeping superseded references around
is how this file came to name the wrong target for a full day of "the
visuals are wrong". Git history has them if archaeology ever calls.

It is a self-contained prototype (React + Babel compiled in-browser, all
data mocked): open it in a browser and it runs. Treat it as **read-only**
— design iteration ended with this file, and changes from here happen in
the real codebase.

What v15 adds over v14: type marks (a drawn badge per archetype, plus the
all-types sheet), place scorecards fed by `rate` cards in the feed (a
Places channel; City / Country / World Scores lens), a redesigned result
card (signature emblem banner, 100-dot rarity field, full "Where you
stand" breakdown), a redesigned test-question screen, a deeper daily
archive (Music topic, `dqx` id series), member-framed demographics, a
FLIP-animated rank card, and the removal of the predict/guess stage, the
pattern beat, and the legacy non-field Mirror bodies
(tab-area / legacy-tabs / city-world-extras are gone).

The 2026-07-31 revision of v15 (synced into `src/v2` the same day) adds:
Learn — knowledge cards with a right answer, a trap option and crowd
rates, run as a stream in the World feed with spaced three-in-a-row
mastery (`learn-*.js`, `learn-bits.jsx`); VOTECUTS — one shared cut list
(demographics, then the four tests with their axes) behind every
who-voted breakdown, with job/education facet rows; world subtopics and
background-knowledge notes (`world-subtopics.js`); catalogue pick cards
with search-and-pick reveal and a Favourites format channel (`fav`
replaces the repo's `games`); a per-take report flow
(`world-feed-report.js`); the map's over-category ladder (You → group →
branch → sub, `map-groups.js`, `map-learn-card.jsx`); a rebuilt search
overlay that answers with questions, topics and people and can open a
feed card in place (focus mode); the chrome-free Lenses redesign with one
Sharpen queue and a provisional-colour tier; the "About this question"
context sheet on daily and feed cards; a quiet-ground surface treatment
replacing the dark-mode switch; and a slimmed person overlay (the zodiac
Sign row is gone).

What v14 specified: two tabs (**daily** · **mirror**), the daily's three
modes (World blind-vote / Group / 1v1 duels with sealed next-day reveals)
switched from a row that lives *in the app header*, the question feed with
passive test and lens cards on bare card grounds, the Mirror telescope as
one graduated seven-stop axis (You · Circle · Groups · Near · City ·
Country · World), archetype result cards, scenes, the profile, and the full
visual language (tokens, type, per-population accents).

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
particular D1 (takes and named who-voted are circle-scoped), D9 (Near is
your city, so live mode drops the City stop) and D11 (which prototype
features are demo-only, and why they are unreachable rather than merely
switched off).

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
