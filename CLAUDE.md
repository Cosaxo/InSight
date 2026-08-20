# Working in this repo

This file is the conventions and the traps — the things that will surprise
you and cost a day. **[`docs/ORIENTATION.md`](docs/ORIENTATION.md) is the
map**: every document with whether it describes the app or proposes
something, every gate with where it runs, every directory with what to read
first, and [`docs/DECISIONS-INDEX.md`](docs/DECISIONS-INDEX.md) to find a
decision by number. Read this file, then go there for where your task
lives. Both are gated by `check:docs`, so neither can quietly stop being
true.

InSight is a three-tab app (patterns · daily · mirror), the third **on
trial** (D166 §1 — see the patterns note below). The **daily** tab is where you
answer: one blind question a day, a feed under it, and sealed
group/1v1 duels revealed the next day. The feed is finite *today* and the
owner has decided it should not stay that way —
[`docs/SCALE-PLAN.md`](docs/SCALE-PLAN.md) is what an unbounded feed
costs, what trips first, and the core/tail split it forces. Read it
before adding anything that assumes the bank is small: feed questions now
declare `core`, and a question is part of the Mirror's corpus only if it
says so. The **mirror** tab is what those
answers become — seven stops from *you* to *the world*, each reading the
same exact aggregates through a different cut of the anchors an
answer carried when it was written, plus the Map that files every answer
you've given into a constellation. Answering is the smaller half — the
Mirror's modules outweigh the daily's and the feed's put together — and
[`docs/MIRROR.md`](docs/MIRROR.md) is the read path: which stop draws
what, from where, and which parts are still prototype data. Read it
before changing anything on that tab. React 19 + TypeScript + Vite,
Capacitor shells for iOS/Android, Firebase (anonymous-first auth,
Firestore, Cloud Functions).

**The patterns tab is ON TRIAL (D166 §1), shipped 2026-08-19.** Three
lenses over the loading vectors a nightly server fit publishes
(`functions/src/patterns.ts` → `v2_patterns/loadings`): the **Map** places
every core question by how much its answer predicts the others, the
**Oracle** guesses your next answer — sealed before the options render
(pinned in `src/v2/data/patterns.test.ts`), graded in surprisal bits when
the real vote lands through the ordinary vote path — and the **People**
lens (D214, `docs/PEOPLE-MAP.md`) draws the crowd itself in the same
space — world, your country, your circle (D216) — real voters placed by
a device-side solve over the published loadings, exact agreement stated
with its basis, fed only by the bounded lists `live.ts` already caches.
All three wear the 2026-08-20 standalone's shapes (D215,
`design/standalone-2026-08-20/`). Live data only: a
build with no published loadings — the demo included — says so instead of
drawing the prototype's 560 invented people. The tab loads lazily
(`React.lazy` in `app-shell.jsx`), nothing outside it may depend on there
being three (the daily ruler's near-end exit is the one licensed
exception), and reversal — one import site, one `TABS` entry — is a
decision recorded in `docs/DECISIONS.md`, never a silent removal. The
plan was [`docs/VISION-V28.md`](docs/VISION-V28.md); the corpus is core
only (D161), and which questions the fit folds is
`PATTERNS_QIDS` in `functions/src/patterns.ts`.

**Answers are public (D98).** Any signed-in user may read any other
user's answers and profile; population counts are exact and publish from
the first answer. There is no k-anonymity floor, no publish cadence, no
suppressed cells and no special-category carve-out. Showing how one
person's answers link to everyone else's IS the product, and the previous
model — answers owner-only, everything floored — could not draw that
picture, which is why most of the Mirror shipped dark.

What survives from the old lens is the *discipline*, pointed the other
way: if the UI says something about who can see what, `firestore.rules`
or a Cloud Function has to make it true, and a test has to prove it. The
account panel still says plainly that answers are public, because a user
learning that from a stranger quoting their vote would be the same
failure as the reverse — but since D183 that sentence is *all* it says.
The long disclosure lives once, in `web/privacy.html`, and
`check:policy-claims` is what a promise is now proved by. Read that
script before editing the page: three of its claims were already stale
when D183 opened it, because D174, D175 and D177 each updated the app and
not the policy.

Three denies remain, none about answers, each labelled at its own path in
`firestore.rules`: the unscored logic answer key (anti-cheat), flag
authorship (anti-retaliation) and the presence cell (physical safety —
D98 published what people answered, not where their phone is standing).
Duel answers stay sealed until the next-day reveal, enforced as a
`surface` test: that is game timing, not privacy.

Binding decisions live in [`docs/DECISIONS.md`](docs/DECISIONS.md) (D1–D7)
and stay binding until an explicitly recorded reversal.

## Two conventions that will surprise you

### 1. The spec layer talks through global scope

`src/v2/spec/` is ~22k lines of JSX ported verbatim from a frozen
prototype. Modules do **not** import each other. They assign to
`globalThis`/`window` and look each other up **by name at render time**:

```jsx
// group-daily.jsx defines it…
Object.assign(window, { GroupDailyBody, GDAv });
// …duo-daily.jsx just uses the bare tag, no import
<GDAv p={p} size={38} plain></GDAv>
```

*(This example named `useTweaks` until D210 and was false: `app-shell.jsx`
had long since converted to a real `import`, and the publication beneath it
was the residue that sweep removed. `check:globals` rule 5 could not see
either — see D210 for why, and pick a live pair from its own output if this
one ever converts.)*

`src/v2/spec-index.js` imports every module for side effects, and **the
order is semantic** — later modules read globals set by earlier ones.
Never sort it, never drop an entry. Four of them are deferred past first
paint via `loadWorldFeed()` (D25) — still listed, still in order, just
awaited in sequence instead of imported at the top. The Map's seven defer
too since v28 §5, differently: `loadMapTab()` names only `map-tab.jsx`,
and that file's own static imports carry the other six in order — see the
comment where the eager list used to hold them.

This is deliberate and temporary (see `src/v2/README.md`), but it is
load-bearing today — and "temporary" only became true when something
started measuring it (D39; see **The convention is shrinking** below).

Six modules are already off the bridge: `primitives.jsx`, `sample-data.js`,
`daily-questions.js`, `world-catalogs.js`, `follows.js` and
`result-rose.jsx` are ordinary ESM modules with named exports. They are
still listed in `spec-index.js`, but nothing waits on their side effects —
the line is inertia plus rule 2, not a dependency.

**Rule 2 asks whether a file LOADS, not whether `spec-index.js` names it.**
A spec module imported by another spec module satisfies it through the ESM
graph (`world-feed.jsx` → `world-feed-math.js` is the long-standing case;
`world-feed.jsx` → `paths-card.jsx` → `paths-data.js` is D136's). So a NEW
ESM module does not need a line here at all, and adding one to the eager
list would drag it into the entry chunk — which for anything reached past
first paint is the opposite of what you want. Add the line only when the
module is a side effect nothing imports.

Four guards make the rest survivable, and all four exist because something
real slipped through:

- `npm run check:globals` — dangling `window.X` references, files
  `spec-index.js` forgot, **undefined JSX tags**, and **publications
  nothing reads**. The tags rule found a live `ReferenceError` on the
  Mirror tab the day it was added; the publications rule (rule 5) swept 17
  dead `globalThis.X = X` lines the day it was added (D137) — the residue
  of conversions that exported the name and never went back for the line.
- `no-undef` is **ON** for the spec layer, seeded from that same scanner
  (`scripts/spec-globals.mjs`, shared by the checker and `eslint.config.js`).
  It was off for a long time, which is how two `ReferenceError`s shipped.
  **If it fires on a legitimate global, fix the scanner — do not add an
  eslint exception.** A name eslint cannot see is one the checker cannot
  see either, and that is the actual bug.
- `src/v2/data/vote.test.ts` pins the `window.LIVE` member surface, because
  renaming a member there passes tsc (consumers are `.jsx`), eslint and
  check:globals — then blanks the Map on a device.
- `src/v2/test/smoke-*.test.jsx` (five files over one harness,
  `test/mount-app.jsx`) mount `App` in jsdom and walk both tabs and every
  overlay. The three guards above are all **name**-level; these are the only
  ones that execute a render. Measured, not assumed: injecting
  `window.FEEDREAD.statsTypo()` into `MirrorTab` leaves check:globals,
  eslint and `tsc -b` green, and fails only here.
  **Assert on the `ErrorBoundary`, not on a thrown error** — `app-shell`
  wraps every tab and overlay, so a crashed screen still returns cleanly
  from `render()`.

`src/v2/data/` and `src/v2/ui/` are typed and checked by `tsc -b`, but they
are **not** exempt from the convention: `live.ts` publishes `window.LIVE`
and both `ui/` panels `Object.assign` onto `globalThis` on purpose.

**The convention is shrinking, and there is a number for it.** Those four
guards make the bridge safe, which also made it comfortable enough to keep
forever — the migration section in `src/v2/README.md` sat there unmeasured
from the port until D39. `check:globals` **rule 4** is the counterweight:
it counts every cross-module shared-global reference, per file, and the
count may only go **down**. New coupling fails CI; converting a module
lowers the number and also fails, asking for the baseline to come down with
it. Run `npm run check:globals` for the live figure — it is deliberately
not quoted in prose here, because a hand-maintained figure is the one
documentation error this repo keeps re-committing (D39, `check:figures`).

Two rules for working with it:

- **Convert on touch, and transpose the meter before you plan.** This
  paragraph twice claimed the cheap seam was exhausted and was twice wrong
  (D39's follow-ups, then D108) — both times because rule 4 reports per
  **consumer**, which is the right shape for a ratchet and the wrong shape
  for planning. Build the provider view out of `spec-globals.mjs`'s own
  `definedBy`/`referenced` maps and the remaining single-writer providers
  fall out sorted. `src/v2/README.md` has the procedure and the traps.
- **A conversion removes the load-order condition, never the data one.**
  `(window.X || {})`, `X?.`, `if (X)` and `X && …` around a converted
  module are dead — an imported binding cannot be unset. So is
  `X.member ? X.member() : fallback` on a member the object literal always
  defines, and so is a local fallback that recomputes the store's own
  default (D108 found six of the first and two of the second). The inner
  `|| []` on `.people` is not; that guards missing data. The guard shapes
  are a list, not a pattern, so grep the name and read every site.
- **Expect a conversion to RAISE the suppression count before it lowers
  it.** The React Compiler cannot resolve a value arriving through global
  scope, so it bails out of the component — which means the bridge has been
  hiding `react-hooks` findings, not just costing coupling (D108, verified
  by linting the pre-change files).

### 2. There are four test runners, and they are not interchangeable

| Command | What it covers | Needs |
| --- | --- | --- |
| `npm run test:unit` | client store, pure deck logic, spec-layer mount tests | nothing |
| `npm run test --prefix functions` | aggregate fold, reveal, streak math | nothing |
| `npm run test:rules` | Firestore **and** Storage rules | Java 21 |
| `npm run test:e2e` / `:erasure` / `:moderation` | full loop, erasure, moderation transport — real emulated functions | Java 21 |

Plus the non-test gates: `check:globals`, `check:labels`, `check:quality`
(question form + provenance, D97), `check:public-copy` (the retired
pre-D98 privacy vocabulary, in copy a user reads — D116),
`check:data-inventory` (every collection the rules reach is named in
`docs/data-inventory.md`, which the store privacy label derives from —
D130), `check:versions`,
`check:bundle`, `check:deploy-targets`, `check:fn-runtime`,
`check:appcheck`, and the
catalogue drift gates `check:cities`, `check:pokedex`, `check:catalogs` —
the last two also run on the deploy path, because the aggregate trigger
validates answer keys against the committed catalogues (D14–D17;
docs/CATALOG-QUESTIONS.md).

`check:appcheck` is on the deploy path too: every callable must demand App
Check attestation or be named in the script's exemption list with the
reason it cannot (D36). Omitting `enforceAppCheck` is silent — the function
builds, deploys, passes every test and serves any caller on the internet.

`backend-checks.yml` is a reusable workflow called by **both** `ci.yml` and
`firebase-deploy.yml`, so what guards a PR is exactly what guards
production. Keep client-only checks and the `npm audit` **off** that path —
none of them says anything about backend correctness, and each could block
an emergency rules fix.

## Things that look like bugs but are not

- **`functions/src/ops.ts` sets `setGlobalOptions`, not `index.ts`.**
  `export { x } from "./v2"` is a hoisted re-export, so v2's functions are
  defined before any statement in index's body runs. Options set there
  would silently miss every v2 function. `check:fn-runtime` guards it.
- **Answers are create-only, with ONE update shape (D86).** D5's
  immutability was amended 2026-08-10: an `optionIdx`-only edit (plus an
  `editedAt` stamp) is legal on daily/feed/test answers, and
  `onV2AnswerUpdated` folds the -old/+new delta through the same ledger.
  Everything else stays frozen — anchors, answeredAt, learn, duels,
  catalog — and the counts stay honest because the trigger moves them,
  not because the doc cannot change. Do not widen the edit surface.
- **A live Mirror stop carries all five lenses (D99/D100) and, since
  D112, its constellation.** Answers · People · Compare · Explore are
  pure folds over `agg.by` (`src/v2/data/cohort.ts`) plus the D98 voter
  lists; Scores joined at D100 over the bank's ordinal questions and
  became the *place* scorecard it is named for at D187 — a question now
  declares what it rates (`rates: city | country | world`) and the lens
  draws only what names its stop. The old "no `rate` questions" refusal
  was right about the content and D100 read it as being about the lens:
  averaging by TYPE gave the City stop a card led by "Breakfast is the
  best meal of the day", which is a correct average of Oslo and not a
  fact about Oslo. Every gate was green while it shipped. The similarity fields
  (`src/v2/data/similarity.ts`, `ui/LiveSimilarityField.tsx`) are the
  permanent head of the City/Country/World stops: your city's people ranked primarily by
  test-score match, cities and countries placed by their real
  average-score profiles — all folded from data that already publishes,
  with zero extra reads for candidate scores (they ride the voter
  lists' name resolution). Near is presence-only since D111; the city
  cohort is the City stop's. Since D119 the row is the stop's TAB BAR
  rather than a strip under the answer rows, and **D136 reshaped it to
  Answers · People · Compare · Explore · Scores**: the field left the row
  to draw ABOVE it always (D119 made it a tab, D135 made it the landing
  tab, D136 finished the move — the field is the sentence the Mirror
  exists to say, and a tab is something you can be looking away from),
  and Foresight left the Mirror altogether because a row of readings is
  the wrong home for a game. Its engine and rules stand, unplaced. An
  empty field offers the Answers tab rather than ceding the screen. The
  cost gate the old collapsed-by-default strip carried is still
  structural for the rest: a tab body exists only while its tab is open,
  so Kindred runs on the tap that asks for it. The field's own fold is
  the exception and runs on arrival — free on re-entry
  (`state.testAggsLoaded`), and since it no longer unmounts, row
  navigation costs nothing; both pinned. The fields load behind one
  bounded, session-cached loader (docs/MIRROR.md §2–3). **Circle and
  Groups carry a row too since D190** — `Answers · People · Compare`, the
  three the prototype gives both, folded out of what each stop already
  computes and drawn even when the stop is empty. Scores and Explore are
  not theirs: one needs questions that rate a place, the other needs
  "everyone" as a baseline, and a circle of nine has neither.
- **`window.MapStats` is real for two anchors and refuses for five, and
  the split is structural.** `age` and `edu` are breakdown dims, so since
  D99 `dist`/`mode` compute from the published cells. `job` is
  profession — deliberately never a dim (D8) — and the four test anchors
  are results nothing aggregates per cohort, so those return **null**,
  as does `dimVal` everywhere. Null rather than a gate at each call site
  (D72), so a consumer that forgets the check fails a test instead of
  quietly fabricating — which is exactly what made the two fixable ones
  findable. `groupLabel` answers in both modes: it is a noun for the
  cohort, not a claim about it.
- **`src/v2/spec/` is the only copy of the spec layer.** The extracted
  prototype modules (`design/spec-modules/`) were deleted 2026-07-29 once
  the port was complete and they had diverged — they live in git history.
  Ported files still cite them in header comments as provenance.
- **The e2e in a sandbox that blocks `firebase-public.firebaseio.com`
  needs `HTTPS_PROXY` unset, not a policy change.** The functions
  emulator will not start with the variable set: firebase-tools parses
  the proxy's 403 body as JSON and dies registering the Firestore
  trigger, naming neither the host nor the proxy. Unset it and the same
  fetch fails as a connection error, which firebase-tools tolerates —
  all three suites pass. Environmental, not a broken test, and **not a
  reason to widen an egress allowlist** before trying the variable.
  docs/LOCAL-TESTING.md § Sandbox/CI note has the failure text.

## House style

- Comments explain **why**, especially for anything that looks wrong. Most
  of the non-obvious code here carries the reasoning that produced it;
  match that rather than stripping it.
- Prefer the smallest change that closes the problem. This tree is green;
  keep it that way at every commit.
- Verify rather than assume, and say which it was. Several bugs here were
  found by running a probe instead of reasoning about it — XML that would
  not parse, an ESM export shape, a module evaluation order.
- When you defer something, record it in `docs/DECISIONS.md` with the
  arithmetic. A known limit is survivable; a surprise is not.
- **Copy follows `visual > word > sentence > sentences`** (the owner's
  rule, D182). A caption explaining a shape the reader is looking at, a
  noun the ruler and the tab bar already say, a clause restating its own
  first clause, an instruction for the control directly underneath — all
  four are deletions, and all four grow back.
  [`docs/COPY.md`](docs/COPY.md) names them, and names what the rule does
  **not** license: a consent notice, an honesty qualifier and the blunt
  public-answers sentence are claims, not word counts. Read §3 before
  shortening anything that promises something.
