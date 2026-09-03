# Working in this repo

This file is the conventions and the traps — the things that will surprise
you and cost a day. **[`docs/ORIENTATION.md`](docs/ORIENTATION.md) is the
map**: every document with whether it describes the app or proposes
something, every gate with where it runs, every directory with what to read
first, and [`docs/DECISIONS-INDEX.md`](docs/DECISIONS-INDEX.md) to find a
decision by number. Read this file, then go there for where your task
lives. Both are gated by `check:docs`, so neither can quietly stop being
true.

**What the app is FOR: connecting data, and drawing the connection
where someone can read it.** Answers are the raw material, not the
product — the product is what one answer says about another, what yours
say about you, and what a population's say about it. That is the
sentence D98 retired the entire privacy model for (*"that's the whole
point of the app"*), and it is the test to put to a proposal before its
cost arithmetic: does it create a link between data that did not exist,
or draw an existing one somewhere it can be read? A surface that
collects without joining is unfinished, and so is a join nothing draws.
Where the choice is between hiding a link and drawing it, drawing it is
the default — and if a privacy argument is what would hide it, that is
an ASK, not a stop (D334, below). The ratio in the next paragraph — the
Mirror's modules outweighing the daily's and the feed's put together —
is that focus measured, not an accident of what got built first.

InSight ships v1 as a two-tab app (daily · mirror) **until the data can
carry a third**: **patterns** is built, and it puts itself in the bar
when the nightly fit has published enough to draw and you have answered
enough to be drawn in it (D265 — see the patterns note below). Nobody
flips a flag. The **daily** tab is where you
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

**The patterns tab is MOUNTED ON THE DATA (D265, 2026-08-23).** Built and
shipped to main 2026-08-19 under D166 §1's trial, unmounted for the v1
release at D217, and back — on a condition rather than on a flag. The
gate is `src/v2/data/patternsReady.ts` and it is D196's shape one feature
over: three numbers with their reasoning, not a boolean somebody flips.
It needs **24 questions fitted on 8 answers or more** (the crowd's half,
published by the fit onto `v2_meta/app`, so reading it costs no extra
Firestore read) **and 8 of your own answers** among the questions it
folds (the ridge solve is 8-dimensional; below that "you" is the origin).
Below the gate the tab is not there at all — no third button, no teaser,
no tab that opens onto "No patterns yet" — and a demo build never offers
it, because the signal is empty when `LIVE.enabled` is false. **Crossing
is remembered** (one `insight.*` key, swept by the purge): the device
count can FALL when a question is retired, and a tab that comes and goes
is worse than one that arrives late. The purge is the only thing that
closes the gate, and it has to — otherwise the next account inherits a
tab it has not earned. It is not a
privacy floor: nothing is withheld from anybody, only the TAB, until what
it draws can be believed. The trial is still a trial; D265 resumes it
rather than verdicting it. Three
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
drawing the prototype's 560 invented people. The joints D166 priced are
where all of this lives — the `React.lazy` import site and the `TABS`
entry in `app-shell.jsx`, plus the daily ruler's near-end exit, its one
licensed external dependence (`daily-split.jsx`, which asks the shell
rather than learning the condition: `NAV.goNav` answers whether it
navigated, and a refusal springs the card back). D217 and D265 record the
two directions between them; a silent change to either would be the
failure D166 forbade. The plan was [`docs/VISION-V28.md`](docs/VISION-V28.md); the
corpus is core only (D161), and which questions the fit folds is
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

**A privacy constraint is an ASK, not a stop (D334).** Where a privacy
argument is the only thing standing between a proposal and the tree — a
lens that would name someone, a field that would join two things, a
number that would be exact, a refusal already written down — it goes to
the owner with the arithmetic, and the owner rules. Do not quietly drop
the feature, narrow it to the safe half, or leave a constraint standing
because it is written somewhere. This has cost the app three times that
are on the record: under the pre-D98 model most of the Mirror shipped
dark, and one owner sentence retired the model whole; D269 wrote seven
refusals as a single bullet and D329 lifted three of them the moment the
owner read it (*"i think this can be removed dont understand why it is
here"*), the finding under that record being that a preference stated as
a rule reads as a rule; and D330's politics exclusion had an option
nobody had put to the owner — ask for the consent at the start — which
took one sentence to choose.

The ask goes **both ways**, and that is what keeps it cheap: shipping
past a constraint silently is the same failure pointed the other way, so
the rule is *the owner decides*, not *the answer is yes*. Four things
stay outside the ask because they are not preferences — the three denies
above; a promise `web/privacy.html` makes in writing (that page moves
first, `check:policy-claims`); the store forms (`check:store-forms`); and
a consent requirement in law, which is satisfied by BUILDING the consent
rather than by deciding it away (D8, D329's line — *"owner preference
does not reach a consent requirement"* — and D330/D331, which built it).
What to bring when you ask: what would be exposed, to whom, which of
those four it touches if any, the smallest shape that still gets the
value (consent · coarsen · aggregate · defer), and what each costs.

**Axiom power first (the owner, 2026-09-02 — D352).** What the axes
can measure and connect is the project's first priority, and a
limitation — privacy, the database, cost, a schema, a store form, a
refusal already written down — is a design problem to be solved AROUND
that power, never a reason to shrink it. The question to put to a
constraint is *how is it made to work with the axiom*, not *how is the
axiom cut to fit it*. **Nothing blocks axiom functionality on its own:
where a limit would block something, the block goes to the owner first
and needs their approval** — the owner's words: *"as long as they dont
limit functionality then it has to be approved that it can be blocked
because of a limit."* D334's ask is how the owner is told what a way
through costs, and the ask is worded as a way through, never as a
permission slip; a routine that meets such a block builds what does not
depend on the answer and puts the block on `docs/OWNER-LIST.md`. What
does not bend is met by building rather than by deciding away: a
consent requirement in law is satisfied by BUILDING the consent (D8,
D330, D331), D1's honesty holds, and the three denies above stand at
their paths — none of them is about answers. The privacy page and the
store forms move with the feature, page first (D183).

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

32 modules are already off the bridge — they export and publish nothing,
so they are ordinary ESM with named exports. They are still listed in
`spec-index.js`, but nothing waits on their side effects: the line is
inertia plus rule 2, not a dependency. `primitives.jsx`, `sample-data.js`
and `archetype-data.js` (D253 — the conversion that also lets the report
builder run the matcher under node) are the ones cited most often below.

That figure is `check:figures`'s, computed off the tree, and it said
**seven** in prose for long enough to understate the migration by 25
modules — in the paragraph directly above the one warning that a
hand-maintained figure is the documentation error this repo keeps
re-committing. Run `npm run check:figures` rather than trusting this
sentence; it is the sentence the gate now holds.

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
  `spec-index.js` forgot, **undefined JSX tags**, **publications
  nothing reads**, and **a publication whose consumers all import**. The
  tags rule found a live `ReferenceError` on the
  Mirror tab the day it was added; the publications rule (rule 5) swept 17
  dead `globalThis.X = X` lines the day it was added (D137) — the residue
  of conversions that exported the name and never went back for the line.
  **Rule 6 (D280) is the one to read before converting anything**: rule 5
  is deliberately over-generous — it asks whether the name appears
  *anywhere* outside its publisher — so a name written to `window` by
  `data/live.ts` and read by `import { X }` in the spec layer satisfies it
  and reaches nobody. That is not hypothetical: it shipped fabricated vote
  counts to a release build for a day. **Before taking a name off the
  bridge, check who else writes it** — and note that a `window` write from
  the typed layer is a cast, which the scanner could not read at all until
  the same fix.
- `no-undef` is **ON** for the spec layer, seeded from that same scanner
  (`scripts/spec-globals.mjs`, shared by the checker and `eslint.config.js`).
  It was off for a long time, which is how two `ReferenceError`s shipped.
  **If it fires on a legitimate global, fix the scanner — do not add an
  eslint exception.** A name eslint cannot see is one the checker cannot
  see either, and that is the actual bug.
- `src/v2/data/vote.test.ts` pins the `window.LIVE` member surface, because
  renaming a member there passes tsc (consumers are `.jsx`), eslint and
  check:globals — then blanks the Map on a device.
- `src/v2/test/mount-app.jsx` is the harness, and **eight** suites mount
  the whole `App` through it: five of the **six** `smoke-*.test.jsx`, which
  walk both tabs and every overlay, and three that go PAST first paint into
  screens no smoke case reaches — the Map's measured body, the daily's
  Circle and 1v1 modes, and the demo Mirror's stops past World. (The sixth
  smoke file, `smoke-live`, mounts `App` too, through its own live fixture.
  More suites than these import the harness — `dialog` and the feed's
  direct-mount files take its helpers without mounting the app.) The three
  guards above are all **name**-level; these are the ones that mount the
  whole `App` and execute a render. Other suites
  render a component directly — `person-mindmap-still` is the one to read,
  because it found this class first. Measured, not assumed: injecting
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

### 2. There are five test runners, and they are not interchangeable

| Command | What it covers | Needs |
| --- | --- | --- |
| `npm run test:unit` | client store, pure deck logic, spec-layer mount tests | nothing |
| `npm run test --prefix functions` | aggregate fold, reveal, streak math | nothing |
| `npm run test:scripts` | the gates and the regulators themselves — their parsers, their budget arithmetic, their tripwires | nothing |
| `npm run test:rules` | Firestore **and** Storage rules | Java 21 |
| `npm run test:e2e` / `:erasure` / `:moderation` | full loop, erasure, moderation transport — real emulated functions | Java 21 |

**The fifth one hides, and that has shipped breakage three times.**
`test:scripts` runs in CI's **lint** job, beside `check:globals` and
`check:figures`, so it reads as a static gate rather than as a suite. But
`npm run lint` locally is eslint alone and says nothing about it, and
`check:docs` rule 4 reads only `check:*` names, so no gate could see it
missing from the table above either — which is how the table stayed at
four until D279. What breaks is always a script that CHECKS something, so
nothing else goes red: **D179** (a billed-read tripwire and a store-form
assertion, both stale — and the record that first wrote down that
`npm run lint` is eslint alone, so running it and calling it "lint
passes" is how these get through), **D197** (one bank parser in three copies; the copy
with a `try/catch` reported an invented wire size instead of failing),
**D275**'s branch (a read tripwire counting `tx.get(` after the code moved
to `tx.getAll(`, so it counted zero and called it a regression). Run it
before you push. Both the count in that heading and the number of rows in
the table are `check:figures`'s now, off package.json — D279 has what it
does and does not decide is a runner.

Plus the non-test gates: `check:globals`, `check:labels`, `check:quality`
(question form + provenance, D97), `check:public-copy` (the retired
pre-D98 privacy vocabulary, in copy a user reads — D116),
`check:data-inventory` (every collection the rules reach is named in
`docs/data-inventory.md`, which the store privacy label derives from —
D130, plus D257's reader column held to the two read rules a script may
read literally), `check:versions`,
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
  Answers · People · Scores · Compare**, Explore at World alone (D152) and
  Compare last of all (D184): the field left the row
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
- **`window.MapStats` is real for three anchors and refuses for four, and
  the split is structural.** `age` and `edu` are breakdown dims, so since
  D99 `dist`/`mode` compute from the published cells. `job` joined them
  at **D328**, through the profession's derived `jobField` — the pick is
  a 31-option list and growing, which is longer than
  `BREAKDOWN_MAX_BUCKETS`, so the dim is a closed field of 20 derived
  from it (the `age`/`ageBand` pair, one anchor over). Its stated reason
  for refusing had been "profession is free text" long after the profile
  became a `<select>`. The four test anchors
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
- **A deferral on privacy grounds is the one you may not take alone.**
  Record the arithmetic as above, then ask the owner rather than writing
  it down as settled — D334, and the privacy section has what to bring.
- **Visuals are designed in Claude Design before they are built** (the
  owner's rule, 2026-09-02 — D352). A new screen, module, lens, card
  family, overlay or visual language is a request in
  [`docs/VISUAL-REQUESTS.md`](docs/VISUAL-REQUESTS.md) — written so
  Claude Design understands it whole, planned, drafted by a routine
  only after its plan, refined by the owner, extracted into `design/`,
  and only then built. [`docs/VISUAL-VISION.md`](docs/VISUAL-VISION.md)
  names the design the tree is built toward. A control added to a
  surface that exists — a button, a toggle, a row — is not a visual in
  this sense and needs no request.
- **The lists are how the owner runs the program** (D352). Six files:
  [`docs/MERGE-LIST.md`](docs/MERGE-LIST.md) (tick a row to approve a
  PR), [`docs/WORKLIST.md`](docs/WORKLIST.md) (items tagged by account),
  [`docs/PERMISSIONS.md`](docs/PERMISSIONS.md),
  [`docs/OWNER-LIST.md`](docs/OWNER-LIST.md),
  [`docs/AXIOMS.md`](docs/AXIOMS.md) (the status word licenses what may
  be built) and [`docs/VISUAL-REQUESTS.md`](docs/VISUAL-REQUESTS.md). A
  routine writes to them through the PR it is already opening, or a
  run-log line the console folds in; it never edits a tick, a status
  word or another account's tag — those are the owner's.
  [`docs/PROGRAM-PLAN.md`](docs/PROGRAM-PLAN.md) is why,
  [`docs/PROGRAM-RUNBOOK.md`](docs/PROGRAM-RUNBOOK.md) is the contract
  every program lane defers to, and
  [`docs/RECREATE.md`](docs/RECREATE.md) is how any session, on any of
  the three subscriptions, puts a missing Routine back — the Routines
  are the one part of the program that does not live in git.
- **Copy follows `visual > word > sentence > sentences`** (the owner's
  rule, D182). A caption explaining a shape the reader is looking at, a
  noun the ruler and the tab bar already say, a clause restating its own
  first clause, an instruction for the control directly underneath — all
  four are deletions, and all four grow back.
  [`docs/COPY.md`](docs/COPY.md) names them, and names what the rule does
  **not** license: a consent notice, an honesty qualifier and the blunt
  public-answers sentence are claims, not word counts. Read §3 before
  shortening anything that promises something.
