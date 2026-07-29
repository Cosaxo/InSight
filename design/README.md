# The frozen design spec

**`InSight_standalone_14.html` is the reference design** — the version the
product is built to, and the file `scripts/style-diff.mjs` compares the
app against. The earlier v9 prototype and the extracted `spec-modules/`
directory were deleted on 2026-07-29: the port is complete, both had
diverged from the live code, and keeping superseded references around is
how this file came to name the wrong target for a full day of "the
visuals are wrong". Git history has them if archaeology ever calls.

It is a self-contained prototype (React + Babel compiled in-browser, all
data mocked): open it in a browser and it runs. Treat it as **read-only**
— design iteration ended with this file, and changes from here happen in
the real codebase.

What v14 specifies: two tabs (**daily** · **mirror**), the daily's three
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
