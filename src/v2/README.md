# InSight v2 — the ported app

This is the frozen spec (`design/InSight_standalone_18.html`) running under
Vite. `index.html` points at `main.jsx`; the journal-era app lives in
git history (decision D4) — `src/legacy/` was deleted after Phase 5 shipped,
and its Firestore rules were retired to `firestore.rules.v1-archive`.

## How the port works

The prototype ran as ~80 `<script type="text/babel">` tags (~65 before
the 2026-07-31 v15 revision added the Learn stack, VOTECUTS, subtopics,
catalogues and map groups) sharing one
global scope — components and data stores reference each other as bare
globals (`MirrorTab`, `window.DUELS`, …). The port preserves those
semantics instead of hand-converting 65 files to ESM at once:

- `spec/*.jsx|js` — the modules, mechanically transformed
  (`import React` prepended; every top-level declaration registered on
  `globalThis` via guarded assignments that skip block-scoped false
  positives).
- `spec-index.js` — imports the modules in the standalone's exact script
  order. **Order is semantic** (later modules read globals set by earlier
  ones); never sort or tree-shake this list. Four of them are loaded
  *after* first paint instead — see **The world feed is lazy** below; the
  order among those four is semantic in exactly the same way, which is why
  they are awaited in sequence rather than in parallel.
- `main.jsx` — styles + spec-index, then renders `globalThis.App`.
- `styles.css` — every style block from the standalone verbatim; font URLs
  point at `/public/fonts/*.woff2` (Hanken Grotesk, bundled — no external
  font hosts).
- `data/` and `ui/` — the typed layer. `data/live.ts` is the live store;
  `data/deck.ts` holds its pure, firebase-free shaping logic (hence
  unit-testable); `ui/` holds the two hand-written TSX panels.

  These are **not** exempt from the globals convention, despite being
  typed: `live.ts` still ends by publishing `window.LIVE` (the mount
  fixtures and one node-safe reader want it there — every spec module
  imports the binding since D354), and until D354's sweep the two `ui/`
  pickers `Object.assign`ed themselves onto `globalThis` because spec
  modules looked them up **by name at render time**. `check-spec-globals.mjs`
  scans `data/` and `ui/` for that reason. What IS different is that their
  internals are typed and `tsc -b` checks them — the spec layer's are not.

  The `window.LIVE` member surface is pinned by a test
  (`data/vote.test.ts`, "window.LIVE public surface"): renaming a member
  there passes tsc, eslint and check:globals, then blanks the Map on a
  device, so the key set is asserted against a checked-in literal.

Regeneration is no longer possible and no longer meaningful: the
extracted prototype modules (`design/spec-modules/`) were deleted once the
port was complete and they had diverged — the `spec/` files ARE the
source now, hand-edits and all. Compare against the prototype with
`scripts/style-diff.mjs`, not by re-porting.

## The world feed is lazy

`spec-index.js` exports `loadWorldFeed()`, which imports
`world-feed-comments.js`, `world-feed-counters.js`, `consequence-beat.jsx`
and `world-feed.jsx` after first paint. `main.jsx` calls it once the root
has rendered. `world-feed.jsx` alone is the largest module in this layer,
and the entry chunk went 947 → 850 KB (282 → 255 KB gzipped) when the group
first deferred; after the v15 2026-07-31 revision the deferred chunk is
~107 KB and the entry sits at ~918 KB under D27's 940 KB ceiling — the
revision's biggest growth landed inside the group, off the first frame.

**Why this group could go first, and what stays.** `daily-split.jsx` line
501 already reads `window.WorldFeed &&` before rendering the feed node, so
an unloaded feed renders as *no feed* — the same frame a user who has not
answered today's question sees. No guard was written for this; the guard
was already the contract, which is what made the feed the honest first
candidate rather than the biggest one.

Two neighbours deliberately stay eager:

- `world-feed-data.js`, because `daily-split.jsx` line 19 reads
  `window.WORLD_TOPICS` at **module scope**. Deferring it swaps the real
  topic set for that line's five-entry fallback — silently, with a wrong
  chip row and no error.
- `feed-read.js`, which is the feed's *memory* rather than the feed: the
  Mirror reads its stats on screens the feed never opens on.

**What no static gate can check here.** `check:globals` rule 2 is satisfied
by the `'./spec/…'` strings inside `import()` exactly as by static imports
(verified by probe, not assumed). Rule 1 is name-level and cannot see load
*order* at all. So neither one would notice if `loadWorldFeed` dropped a
module or stopped resolving — the feed would simply never appear. The mount
tests carry that: `smoke-daily.test.jsx` asserts **both** shapes, the daily
tab with `window.WorldFeed` deleted (the frame before the chunk lands) and
the feed present after `loadWorldFeed()` resolves. Either alone passes while
the other half is broken.

Every mount suite `await`s `loadWorldFeed()` in `beforeAll` — the demo five
through the shared harness (`test/mount-app.jsx`), `smoke-live.test.jsx` in
its own. Without it every D11 case in `smoke-live.test.jsx` would assert on a
tab that never rendered a feed card — a vacuous pass, and the largest module
in the layer would quietly leave the suite. It has to be in the SHARED hook
rather than in the one file that visibly needs it, because vitest's module
cache is per worker: after D108's split no file can assume another already
paid for the load.

## …and so are the five no-button overlays

`loadOverlays()` (D38) defers `test-overlay`, `person-mindmap`,
`person-overlay`, `city-overlay`, `suggestions` and `logic-test` (which
imports `data/logic-gen` directly since D51, pulling it into the same
chunk) — the overlays with no control in the header or tabbar, reached
only through the `window.open*` cross-links. Entry chunk 922 → 837 KB.

**The synchronisation is different from the feed's, and that difference is
the whole design.** The feed needs `main.jsx` to re-render after its chunk
lands, because `daily-split` reads `window.WorldFeed` during a render nothing
would re-trigger. These overlays need no re-render: each is reachable *only*
through an app-shell opener, and the openers `await` the same memoised
promise before setting the state that mounts one.

That ordering is required, not tidy. Guarding the render site alone —
`{ov === 'test' && window.TestOverlay && …}` — and letting `setOv('test')`
run while the chunk is still in flight renders nothing **and schedules
nothing to re-read the global**, so the overlay stays blank until an
unrelated state change. The guards are a second line, for a chunk that never
arrives at all; the await is the mechanism.

**`relmap.jsx` left the eager graph at D200.** This paragraph used to say
it stayed — the one overlay with a first-frame consumer, because
`mirror-field-pops.jsx` read `typeof RelationshipMap === 'function'` on a
render nothing re-triggers. That reason was right when written and expired
at D101 without anything touching it: a live Circle takes `LiveCircleBody`,
so the first-frame read was demo-only, and it kept ~43 KB eager for three
months after its premise ended. D200 replaced the `typeof` probe with a
demo-only `import('./relmap.jsx')` whose arrival is state, and split the
group by consumer — `relmap-lenses.jsx` stays eager for `vote-cuts.js`'s
live Type cut (D146). Both edit sites carry the reasoning inline
(`spec-index.js` at the loadOverlays list, `mirror-field-pops.jsx` at the
import).

**Two gates, and what each does not cover.** `check:bundle`'s per-chunk
ceiling came down 940 → 850 with the win, and its header records exactly
which regressions that catches (measured, not assumed — the smallest single
module can still slip under the headroom). `smoke-overlays.test.jsx` carries
five cases that delete each global and assert the shell degrades to a blank
rather than a `ReferenceError`; those were mutation-checked by restoring the
bare identifiers one at a time. Neither gate can see eager-vs-lazy itself:
re-adding a static import to `spec-index.js` leaves every test green and is
caught only by the ceiling.

**`window.loadOverlays` is published from `spec-index.js`**, not from
`data/` where the house pattern would put it (`back.ts` →
`window.registerBackHandler`). `data/` is TypeScript without `allowJs`, so a
module there cannot import this `.js` file — and the dynamic imports have to
live in `spec-index.js` because that is the file `check:globals` rule 2
matches `'./spec/…'` strings against. The full reasoning, including why
`await import('../spec-index.js')` from app-shell is worse (a permanent
`INEFFECTIVE_DYNAMIC_IMPORT` on every build), is at the foot of
`spec-index.js`.

## …and so is the Mirror (D355)

`loadMirrorTab()` defers the thirteen modules behind the app's second tab —
`compare-pop.js`, `demographics.js`, `compare-breakdown.jsx`,
`lens-defs.js`, `lens-cards.jsx`, `demographics.jsx`, `mirror-answers.jsx`,
`mirror-field.jsx`, `mirror-field-pops.jsx`, `group-role-map.jsx`,
`group-mirror.jsx`, `segment-explorer.jsx` and `mirror-tab.jsx` — the Map's
shape: the loader names only `mirror-tab.jsx`, and that file's static
side-effect imports carry the other twelve in the order the eager list
held. Measured at the commit: **eager 761 → 633 KB** (−128, the largest
single drop since D110 took the Firestore SDK out of first paint), entry
chunk 243 → 133 KB, total unchanged within 3 KB — a relocation, which is
what every honest move here has been. `check:bundle`'s `MAX_EAGER_KB` came
down 880 → 645 with it.

**Why it could go, and what had kept it.** The app never opens ON the
Mirror: `TWEAK_DEFAULTS.tab` is `'track'` and nothing persists a tab
across launches, so the tab is always one tap away and never the first
frame. What kept ~130 KB of it eager was one JSX tag — `app-shell.jsx`
rendered `<MirrorTab>` by name — and one honest worry, recorded in
`check:bundle`'s header as "it needs a guard the overlays did not". The
overlays can afford an empty frame while their chunk lands, because an
opener awaits the load before mounting; a *tab* that flashed empty on
every tap would be a worse trade than the bytes.

**The guard is a handoff, not a render guard.** `app-shell` mounts the tab
through `MirrorSlot` — state plus an import, `MapSlot`'s shape, because a
`React.lazy` caches a rejection and the tab boundary is keyed per tab —
but the slot's *initial* state reads `data/mirrorChunk`, where the
loader remembers the resolved namespace. ESM has no synchronous read of
the module cache; that module is one. So once the prewarm has landed
(`main.jsx` starts it right behind the feed), opening the Mirror renders
in the tap's own tick with no blank frame between, and the effect exists
only for a tap that beats the prewarm or a prewarm that failed.
`test/mirror-slot.test.jsx` holds all three cases against the real
handoff, plus a source pin on the shell's shape; the existing
`smoke-mirror` case — click the tab, read the ruler in the same breath,
no `await` — is the same-tick claim asserted on the whole app.

**Three overlays read Mirror globals at render** — `profile-general`'s
`MirrorFieldBody` and `LENSES`, `profile-overlay`'s `LensesPanel`,
`person-overlay`'s `CompareCarousel` — so `loadOverlays()` awaits
`loadMirrorTab()` first: memoised, so that is the prewarm's own promise
when `main.jsx` got there first and the fetch itself when a tap did. The
reader audit that found those three (and nothing eager) is the
transpose-the-meter script this file keeps recommending, run over the
thirteen: every reader of a Mirror global outside the group was in the
overlays group or was the mount site itself. Read the graph, not the
paragraph, before moving anything else — `MapStats`, `GDAv` and
`relmap-lenses.jsx` looked like members and are not: eager modules read
them on first-paint surfaces.

Every mount suite `await`s `loadMirrorTab()` in `beforeAll` beside the
other three loaders, for the reason the feed paragraph gives — and one
more that is this group's own: the slot is same-tick *only* once the
handoff has happened, so a suite that skipped the await would click the
tab and assert against the empty frame.

## Lint suppressions

21 files in `spec/` used to open with a bare `/* eslint-disable */`,
covering 7,743 of the layer's 18,553 lines — including the five largest
components. That is the opposite of what CLAUDE.md asks for, and it was
load-bearing in the worst way: a blanket directive also turns off
`no-undef`, the rule that exists here because two `ReferenceError`s
shipped, and `--report-unused-disable-directives` structurally cannot
flag a file-level disable, so `npm run lint` going green said nothing
about 42% of the layer.

They are gone. Removing them turned out **not** to disturb the
shared-global convention at all — `no-undef` reports zero problems across
all 21 files, because `scripts/spec-globals.mjs` already seeds every
legitimate global into both the checker and the eslint config. What the
blankets were actually hiding was 60 React findings.

18 of those were fixed outright: three conditional-hook calls in
`person-overlay.jsx` (hooks hoisted above an early return), 14 empty
`catch` blocks (now carrying the reason they are empty), and one bare
U+2004 in JSX text.

The remaining ones carry a targeted `eslint-disable-next-line` naming the
one rule, so each is individually visible and greppable:

```bash
git grep -c "eslint-disable-next-line" -- src/v2/spec   # the live count
```

That count is **28 across 11 files**. It is quoted here rather than left to
the reader because this section previously claimed 42 long after the number
had moved — a stale figure in the one paragraph whose job is to size the
debt.

Then it went stale a second time, sitting at 27 after the tree reached 30.
Twice is enough evidence: a figure maintained by hand in prose goes stale,
however loudly the paragraph around it says not to let that happen. So
`npm run check:a11y` now recomputes this sentence's numbers and fails if
they disagree with the tree — which is why there is no longer an "as of"
date on it. It is current or CI is red.

**The count went UP with D108, and that is the finding rather than a
regression.** Converting `DUELS` off the bridge retired four
`exhaustive-deps` suppressions for free — an imported binding is a stable
dep where `window.DUELS` was an expression eslint could not prove stable —
and then surfaced six `refs` findings that had never been reported at all.
The React Compiler cannot resolve a value that arrives through global scope,
so it had been bailing out of `DuoBody` and `GroupDailyBody` entirely.
Verified rather than inferred: the two files at the previous commit lint
clean, and the only change to either is the import. So the global bridge was
not merely costing coupling, it was **suppressing the measurement of this
debt** — 31 was an understatement, and every remaining conversion should be
expected to raise this number before it lowers it.

They are **deferred, not judged correct**. They are React Compiler
findings — `exhaustive-deps`, `refs`, `purity`,
`preserve-manual-memoization` — in JSX ported verbatim from the frozen
prototype. Changing effect re-run timing blind is a worse trade than
recording the debt. The exception is `react-hooks/purity` in
`person-mindmap.jsx`, which is a false positive with a specific note at
each site: those are `performance.now()` calls inside pointer and rAF
handlers, not render.

Do not reintroduce a file-level disable to quiet a new finding; that is
the failure mode this section exists to prevent.

## Mount tests

Five files over one harness (`test/mount-app.jsx`), which together mount
`App` in jsdom and walk the surfaces the header and tabbar reach — both tabs,
the profile overlay, the search overlay — plus the six with **no button at
all**: `test`, `relmap`, `logic`, `suggest`, `person` and `city`, which other
components open by calling `window.openTest()` /
`window.openOverlay('relmap')` / … and which consequently nothing executed.
That was the largest unmounted block left in this layer: ~130 KB of the
shipped bundle, including the two biggest single components after the feed.
`test/setup-dom.ts` stubs the browser APIs jsdom lacks (`matchMedia`, the two
observers, `scrollTo`, canvas contexts).

| file | what it owns |
| --- | --- |
| `smoke-daily.test.jsx` | `App` exists; the daily tab; the feed's two shapes (before and after its chunk) |
| `smoke-topics.test.jsx` | the add-a-topic sheet — demo furniture, the channel list, and a mute reaching the chip row |
| `smoke-mirror.test.jsx` | the mirror tab, the Explore lens, the two header overlays, and three demo controls for `smoke-live` |
| `smoke-nav.test.jsx` | the v17 ruler-as-nav (D43) and the surfaces that own their own drag |
| `smoke-overlays.test.jsx` | the six cross-link overlays, the five degrade-on-missing-chunk cases, and the retired Thinking test (D103) |

**Why five and not one (D108).** It was one file with 32 cases. Vitest
schedules a FILE to a worker, so a single file is a hard serial floor however
many cores the runner has — and that one was **90.2 s of a 92.2 s `test:unit`
wall clock**, with the other fifty files finishing inside it. Split, the
longest mount file is 32.7 s and the suite's longest file is
`smoke-live.test.jsx` at 34.8 s, which was never the bottleneck before.

Two things that measurement did **not** buy, recorded so nobody re-derives
them: on a 4-core runner (which is what `ubuntu-latest` gives) the wall clock
went 87 → 71 s rather than to the ~35 s the single-file floor suggested,
because with the floor gone it is the aggregate that binds, not any one file;
and per-TEST durations are unchanged (slowest 9.0 s either way), so this does
**not** relax the reason `test:coverage` was scoped to `src/v2/data` — that
constraint is the 15 s per-test timeout under v8 instrumentation, which a file
split cannot move.

*(What did move it: one test, not the split. `learn-reserve`'s D95 case spent
~10 s of its 15 s budget inside a `growFeed` loop that could not converge —
see **the feed's mounted window** in `test/mount-app.jsx`. With that fixed the
instrumented run completes, and `test:coverage` runs the whole of `--dir src`
as of 2026-08-24. The per-test constraint was real; it just had a single
owner.)*

They exist because **this layer's characteristic bug is invisible to every
other gate.** A global that is defined but undefined *at render time* —
load order in `spec-index.js` is semantic, and a renamed member passes
name-level checks — throws only when the component paints. Verified, not
assumed: injecting `window.FEEDREAD.statsTypo()` into `MirrorTab` leaves
`check:globals`, `eslint` and `tsc -b` all green, and fails the mirror case
in `smoke-mirror.test.jsx` with `TypeError: window.FEEDREAD.statsTypo is not
a function`.

Two things to know before extending them:

- **Assert on the boundary, not on a thrown error.** `app-shell` wraps
  both tabs and every overlay in `ErrorBoundary`, so a crashed screen
  still returns cleanly from `render()`. The helper checks the boundary's
  `componentDidCatch` log and its fallback copy. A test that only caught
  exceptions would have passed on both `ReferenceError`s this repo shipped.
- **A no-button overlay needs a second assertion, or it passes empty.**
  `window.openTest` and friends are installed by an effect, so a rename or
  a teardown bug turns the call into a silent no-op — and `expectNoBoundary`
  then happily asserts on the tab underneath. Every cross-link case
  therefore also matches copy only that overlay renders. Both halves are
  mutation-checked: neutering the opener fails all six on the copy
  assertion, and injecting `window.NOPE.boom()` into each of the six
  components fails exactly its own case on the boundary.
- **Put a new case in the file that already loads its screen**, and add a
  file only when one crosses ~30 s. Every file pays its own `spec-index`
  import (the module cache is per worker), so five files cost ~14 s more
  total work than one did — worth it to delete a 90 s serial floor, not worth
  it per case.
- **They are smoke tests.** They prove the screens mount, not that they are
  right. For the spec layer that is still all there is; the hand-written
  panels now have their own suites (below), and the
  `eslint-disable-next-line` list above remains the work queue for the
  ported half — those findings stay deferred until a test can catch a
  re-run-timing regression. `smoke-live.test.jsx` still walks only the
  header-reachable surfaces, so these six are covered in demo mode only —
  which costs nothing today, because **none of the six contains a
  `window.LIVE` branch.** Only six spec modules gate on live mode at all
  (`app-shell`, `daily-split`, `mirror-tab`, `world-feed`,
  `profile-general`, `profile-overlay`) and `smoke-live` already reaches
  every one. Checked rather than assumed, and worth re-checking before
  adding a live gate to any overlay in this group: it would land with no
  live-mode mount behind it.

## Panel tests — `ui/*.test.tsx`

One suite per hand-written panel, because these are the components that
render **real user data** and each can lie in its own way. Mounting them
inside the app (the two smoke files) proves they do not crash; these assert
what they claim.

That was a CONVENTION until 2026-08-20, and it drifted the way conventions
do: an audit found nine panels with no suite at all — including
`PatternsTab`, the entire shipped product of the on-trial third tab, at
4.71% branch coverage, where one flipped ternary tells every user they
answered the opposite of what they did. `npm run check:panel-suites` holds
it now, as a ratchet: the panels still owed one are listed by name in that
script and the count may only go down, and DELETING a suite fails it too.
Run it for the live figure rather than quoting one here (D39,
`check:figures`).

| suite | the property it exists for |
| --- | --- |
| `LiveCohortBody` | an absent breakdown cell means ZERO and is still counted and named in words, because a silent gap reads as "this question doesn't exist here"; a question with no aggregate at all is a different state from an empty cohort and is not counted as either; nothing consults a `tooSmall` field (D98 — the row exists to catch its return) |
| `LiveGroupsMirrorBody` | nobody is named on fewer than `MIN_SHARED` days; duos are excluded; alignment counts days *played*, not days revealed |
| `LiveDuelPanel` | before a reveal only your own pick is on screen; the duo card states the both-play condition rather than promising a reveal |
| `CityPicker` | every emitted value matches the server's own city shape; all five location failures land somewhere usable; a located city is suggested, never applied |
| `PickSearch` | the id handed up is the catalogue key, not the row position; each domain searches its own store; "not listed" stays a distinct answer |
| `LivePrivacyPanel` | deleting an account takes two deliberate taps, and a refused delete is shown rather than swallowed |
| `LiveSimilarityField` | the radius is likeness INVERTED, so a better match sits nearer the centre the aria-label promises; no two nodes stack at any cap the app ships (D225 — the de-overlap pass was not circular and failed at all three); a likeness ranked from answers rather than scores says so; Near draws no name, no initials and no tab stop; a place below `MIN_PLACE_AXES` is listed and never positioned; an empty field still draws the ring (D160) |
| `LiveAnswerRows` | the headline reads BY TYPE (a rating leads with its average, a scale with how much of the room agrees) — dropping `row.type` compiles and then every rating leads with the share who picked a 7; a question this cohort has not answered still draws its options at an explicit zero; a share is printed only where it reads as one, every other bar carries its exact count (D98); the standing sentence is never a percentage of ONE answer (D170); and "most divisive" and "most agreed" are the two orderings they claim |
| `profileSetup` | the GATE, not the screen — the persistence contract `LiveProfileSetup.test.tsx` never touches (it does not import these two functions at all): the fact is on the DEVICE, re-read per call, so a boot-time snapshot would pass every other test in this tree; the key sits inside the `insight.*` namespace D51's purge sweeps, or it survives an account deletion and the next account on that device is never asked; and seen beats every reason to ask |
| `duelMarks` | a mark is coloured by an ID and never by the name printed beside it — two members called Ada are two people, and `markHue(name || uid)` compiles, reads tidier, and gives two strangers one colour; shape is KIND (round is a person, a rounded square a circle) at every size; each mark reads its OWN initials rule, a swap tsc cannot see; and nothing is invented from an id — no name means a dot, because an initial made out of a uid is a name we made up and showed to the person it is about |
| `Avatar` | each face is its OWN (a captured uid dresses a whole list in one stranger's photo — the only defect here that looking twice does not correct); the branch is on the URL, not the token, so a build with no bucket does not get `<img src="">` on every face; a failed load falls back to initials keyed by UID rather than by slot, since Near re-orders under a mounted component and React keeps state at the POSITION; the photo is named and the initials are silent; and `initialsOf` is executed, never stubbed — this is the only suite that runs it |
| `EmptyField` | the licensed copy stays a copy — the geometry is compared against `LiveSimilarityField`'s original rather than pinned to literals, because neither tsc nor check:globals can see the two drift; the drawing comes first and alone, `aria-hidden`, with the sentence as the readable half; and `prime` runs BEFORE the nav jump (D190), the ordering the door depends on |
| `LiveCompareLens` | attribution — two people's numbers inside one picture, so each score keeps its own side axis for axis (swap either and every card reads as its mirror image with every number on it still correct); an instrument only ONE of you has draws no card, and an axis their side lost to its floor leaves the rose rather than sitting at a neutral 50; the three emptinesses stay apart; your side folds through `voteIndices`, because the store's option ids are STRINGS and a raw `myVotes()` folds to nothing while looking reasonable in the diff (D132) |
| `MirrorLensTabs` | the row is the list it was handed, in that order (Explore is the World's alone, Compare ends the row); exactly one tab reports `aria-selected`, and it is the caller's; CLOSED is closed — a stop opens with nothing open and an `open` that is not in `tabs` must read as nothing rather than as the first tab; a tap on the already-open tab still goes up as that tab's id, which is how all four callers close a stop; and the size ladder steps down as the row widens, the row being unscrollable |
| `PulseCard` | the card draws the pulse it was HANDED, not the roster's first — five identical columns all recording against one pulse is the failure; it is blind until you answer; the dot you tap is the optionIdx recorded (the 1..5 step vs 0..4 wire is where an off-by-one names itself back to you correctly); absent is not zero; the reading's 21-day window is fetched on the tap, never on the open |
| `SignInGate` | a build that will not show the wall never fetches the screen chunk (the split is the whole reason it is two files, and only a bundle ceiling can otherwise see it); off, it renders no element of its own; behind the wall the app is not merely hidden but unmounted; and the wall COMES DOWN — `linked` flips on the store's auth observer, so dropping the subscription strands a user who signed in successfully |

Each of those rows was **mutation-checked**: the property was broken in the
component, the suite was watched to fail, and the change reverted. A
component test that passes against a broken component is worse than none,
and these are exactly the assertions where that is easy to write by accident
(three of the first drafts did — see the comments in
`LiveDuelPanel.test.tsx` and `CityPicker.test.tsx` for what they missed).

Two conventions worth copying if you add another:

- **Mock `../data/live`, not Firebase.** What a panel consumes from the
  store is a handful of getters; `vi.hoisted` + `vi.mock` gives you exact
  control over states the real store cannot be asked for — "the partner has
  voted but the reveal has not landed" is precisely the window the seal
  covers.
- **Do not mock the pure modules.** `CityPicker` uses the real
  `data/places`, stubbing only the catalogue *fetch*, which is what makes
  "the picker emits a key the server accepts" a statement about the real
  vocabulary rather than about a fixture.

### …and `test/smoke-live.test.jsx`, the other half

The `smoke-*.test.jsx` set runs with `window.LIVE` **undefined**, so every
`if (window.LIVE && window.LIVE.enabled)` branch in this layer was
unexercised by the suite. Those branches are where D9 drops the Mirror's
City stop and where D11 keeps takes, counter-arguments and friend dots off
world-scale cards — decisions whose only evidence was a browser probe run
once by hand.

`test/live-fixture.ts` installs a stand-in `window.LIVE` plus the feed
globals `buildFeedGlobals()` publishes, and `smoke-live.test.jsx` walks the
same surfaces with it, in six shapes: the happy path, an aggregate with no
counts on it (`aggFor` returns `{ tooSmall: true }` and **no** counts — the
fixture keeps the retired flag deliberately, so the suite proves a stray
`tooSmall` changes nothing and the render is driven by the absence of
counts alone), the `demoInProd` fallback, and a profile with no city.

Three things learned by making it, all now load-bearing:

- **The fixture is built from the same checked-in member list the real
  surface pin uses** (`test/live-surface.ts`, shared with
  `data/vote.test.ts`). Without that, a member added to `live.ts` leaves the
  fixture behind and the live tests keep passing against `undefined`.
- **A key-name pin cannot catch a signature.** The first fixture had
  `vote(question, optionId)`; the real one is `vote(qid, optionId)`. Both
  have the key `vote`, so every guard was happy while the tests recorded
  votes under `undefined`.
- **`renderEngage` only mounts after the card is answered AND the reveal
  animation clears `state.beat`.** A gate assertion on an unvoted card
  asserts on a block that was never going to render — which is how the first
  version passed against a deliberately opened gate.

All three gate cases were mutation-checked: opening `q.live`, deleting the
`demoInProd` return, and making the Mirror axis unconditional each fail
exactly one case, and all pass again on revert.

## Accessibility

`npm run check:a11y` (`scripts/check-a11y.mjs`, `eslint.a11y.config.js`) is a
**ratchet**, not a pass/fail sweep: the current findings are recorded per
file and it fails when a file gains one.

It is separate from `npm run lint` because that script carries
`--max-warnings 0`, which is deliberate and worth keeping — so there is no
"warn" tier to hold existing debt, and the alternative would be the blanket
disable this file's Lint suppressions section exists to prevent.

The baseline is **7**: 4 in `spec/`, plus three elsewhere. Every one of the
seven is a deliberate keep (D250), each with its reason recorded beside it
in `BASELINE`. It opened at 69 and came down in four steps — D23
turned the mouse-only controls into buttons, D24 made every overlay and
sheet a real modal dialog, D35 gave the Basics editor's selects explicit
`htmlFor`/`id` pairs, which cleared `label-has-associated-control` entirely
and uncovered a real defect on the way (the label wrapping `CityPicker` was
winning the accessible-name computation, so the chosen city never reached a
screen reader), and D49 made the post-vote beat's Skip control a real
button.

What is left is **six `no-autofocus` findings** and **one
`no-static-element-interactions`** in `src/dev/TweaksPanel.jsx`, the host-era debug
panel rather than a user surface — which is behind a build-time flag, so a
production build has no import of it at all. (The v18 sync retired one more autofocus
with the relmap add-circle input it replaced by rename-in-place.)

That sentence used to say "six `no-autofocus` findings and three
div-with-onClick sites", and both halves were wrong in a way worth naming,
because `check:a11y` did not catch either: it holds the TOTAL and the
per-file counts, not the breakdown by rule. There were eight autofocus
findings, not six. And the three were not three sites — they were three
rules firing on **one** element (`click-events-have-key-events`,
`interactive-supports-focus`, `no-static-element-interactions`), so the
work described as three deferred fixes was one, and it took an afternoon.
A count kept by hand drifts even inside a paragraph whose own file is
gate-enforced; prefer "run the gate" to a number, and where a number is
load-bearing, make the gate own it.

**That sentence has now been wrong twice, and D250 is the second
correction.** It read: "the remaining autofocus findings stay deferred for
the reason the React Compiler ones do — changing focus behaviour in ported
components no test asserts the interaction of is the blind change that
trade refuses. Fix them behind interaction tests, not ahead of them."

The trade was real and the conclusion was not, because nobody had looked at
the sites. When D250 did, six of the seven turned out to be the SAME case
the two pickers were already excused for: a control the reader has just
asked for — a search rendered only when `searchOpen`, a reply box rendered
only when `replyTo` names that take, the name field of a sheet they opened.
Moving focus there is correct behaviour, and `no-autofocus` is a heuristic
against focus moving on LOAD. Deleting those props to lower a number would
make the app worse, so they are recorded as decisions instead.

**The seventh was a real defect, and it was hiding behind a justification
that happened to be true.** app-shell's update-required blocker is the one
dialog here that is NOT user-initiated, and focus SHOULD enter a modal when
it opens — so its `autoFocus` read as correct, and stopped anyone looking
further. What the prop could not do is keep focus there: the blocker had
role, aria-modal and a label written by hand and no focus trap, so Tab
walked out into the app behind it, which is still in the DOM under an
absolutely positioned overlay. Containment is runtime behaviour, so no
linter reported it. It goes through `useDialog` now — the hook D24 gave the
other eight overlays — which traps Tab, restores focus on unmount and
focuses the button itself, so the prop went with it.
`test/dialog.test.jsx` holds both halves.

The React Compiler suppressions are a different matter and DO stay
deferred: 28 of them, all `react-hooks/exhaustive-deps` and
`react-hooks/refs` on ported effects, where changing re-run timing blind is
exactly the trade this file refuses. That refusal survives D250 unchanged —
it was only ever the autofocus half that had been filed under it by
association.

Per file, not a total, so a fix in one file cannot pay for a regression in
another. Lowering it is the script's own output: fix something, run it, and
it prints the replacement literal.

**Both numbers in the paragraph above are gate-enforced**, along with the
suppression count under Lint suppressions. `check-a11y.mjs` recomputes all
four and fails on a mismatch, naming the sentence to correct. The 2026-08-03
pass is why: it lowered the baseline from 19 to 11 in the script and left
this file saying 19, which is the same failure the suppression paragraph had
already recorded once. A number that lives in two places needs something
holding them equal, and a paragraph explaining that it must not go stale is
not that something.

## Migration path (Phase 2+)

Modules migrate off the global-scope bridge incrementally: when a module
gets real data or typing, convert it to proper imports/exports and remove
it from `spec-index.js`'s implicit dependency web. The mock data stores
(`sample-data.js`, `duels-data.js`, `daily-questions.js`, `passive-progress.js`,
`scenes.js`, `follows.js`) are the seams where Firestore plugs in — each
already funnels all reads/writes through one `window.*` API object.

### …and it now has a meter

That paragraph has been here since the port, and until 2026-08-03 nothing
measured whether any of it was happening. It was not. A migration with no
meter does not run — it gets described, which is a comfortable place for it
to sit given that rules 1-3 of `check:globals` make the convention
survivable enough to live with indefinitely.

**Rule 5** is the one that keeps the meter honest, and it was added late
(D137) after 17 dead publications had accumulated where nothing was
looking. A conversion's honest shape leaves `globalThis.X = X` beneath the
new export for the consumers that have not moved — so when the last one
moves, the line is residue. Rule 4 cannot see it: rule 4 counts *reads*,
and a publication nobody reads has none. Rule 5 asks the mirror of rule 1
— an assignment whose references went away — so what is on the bridge is
what is still crossing it.

**And it could not fire for its first eight months (D210).** Two reasons,
both structural. The footer idiom
`;globalThis.X = typeof X === 'undefined' ? globalThis.X : X;` **reads the
name it publishes**, so every name written that way put itself in
`referenced` — 176 of them. And rule 5 was asking rule 1's question ("is
there a `window.X` read?") when its own is broader: a bare cross-module
call resolving through global scope is a real consumer this scanner cannot
see, so that question reports live wiring as dead. Rule 5 now blanks the
idiom out of a line before scanning it, and asks the conservative question
instead — does the name appear **anywhere** in `src/`, outside the file
that publishes it. It found **123** on the tree it landed against, taking
the published count from 259 to 136 in one commit; `npm run check:globals`
prints the live figure, which is the number to quote. Deliberately
over-generous: a false positive here deletes live wiring, a false negative
leaves one line of residue — so five publications that are strictly
redundant (ESM-exported *and* imported by name) survive it on purpose.

**It earned itself within the hour.** Merging the v28 Patterns work
(D207) on top removed the last consumer of `TweakToggle`, and the gate
failed on its publication — a dead line introduced by a merge neither
side could see, caught before it landed.

**Rule 6** (D280) is the case that generosity has to let through, and it
cost a live D1 violation before anything asked about it. Rule 5 is
satisfied by the name appearing *anywhere*, so a name published to
`window` by one file and reached by `import { X }` from another passes —
mentioned all over the tree, reaching nobody, because an imported binding
cannot be reassigned from outside its own module. That is what D249 left
when it converted `world-feed.jsx`'s read of `window.TEST_FEED_QS` into a
static import of the DEMO pool while `data/live.ts` went on publishing
the LIVE one: a release build drew hash-invented vote counts on real
test cards for a build, with every gate green.

So rule 6 asks the narrow version — published to global scope, **exported
by a different file**, imported from that file somewhere, and read
through `window.` by nobody outside the publisher. The third clause is
what makes it usable rather than noisy: without it the rule also reports
the redundant-publication class the paragraph above says survives on
purpose (nine of them today, up from five), where the export and the
publication are one binding and the line is only residue. Against the
commit the defect was photographed on, rule 6 reports exactly two names,
and both were severed by D249 on the same afternoon.

The other half of the same fix is in `spec-globals.mjs`: `DEFINE_RES`
matched `window.X = …` and not
`(window as unknown as Record<string, unknown>).X = …`, which is the form
the typed layer has to use. `data/` was scanned all along — the
publication was simply unreadable, in both directions, which is why no
rule could have fired.

**Rule 4** counts every site where one file reads a name another file
assigns to global scope, per file, and the number may only go down. The
baseline is in `scripts/check-spec-globals.mjs`; `npm run check:globals`
prints the current total on every run. The count today is **30 across 8
files**, down from 799 when the ratchet landed.

The mechanism needs no bookkeeping, which is what makes it usable. The
scanner already suppresses a JSX reference when the file declares the name
locally, and `import { Chip } from './primitives.jsx'` is a local
declaration — so converting a consumer takes its sites to zero by itself.

### `primitives.jsx` is converted — what it cost, and what it taught

The first module off the bridge, chosen because it has the most consumers
(22 by the ratchet's count) and depends on nothing itself. Its eleven names
are plain named exports; **it publishes nothing to `globalThis` at all**,
because all 24 consumers moved in the same change. 799 → 755.

The plan here said to leave a `globalThis.X = X` compat line beneath the
exports so unconverted consumers keep working. That was not needed once it
turned out the consumer set was closed — 24 files, all in `spec/`, with the
only other mentions of these names being three comments. **Check for that
before assuming a compat line is required**: a provider whose consumers all
fit in one change is cheaper to finish than to bridge, and a compat line
nobody needs is dead code with a deletion ticket attached.

Three things worth knowing before converting the next one:

- **`window.X` sites do not convert themselves.** `result-card.jsx` held
  `{window.Av ? … <window.Av /> …}` — a defensive guard that existed only
  because load order could leave the global unset. An import cannot be
  unset, so the guard went with the conversion rather than being rewritten
  as `{Av ? …}`.
- **Two different gates catch a missed consumer, and neither catches both
  cases.** A JSX reference (`<Sheet/>`) is invisible to eslint — base
  `no-undef` does not treat JSX tag names as identifier references — and is
  caught by `check:globals` rule 1. A bare call (`useDialog(…)`) is the
  reverse: rule 1 never sees it, `no-undef` reports it. Both were verified
  by deleting an import and watching the right gate fail.
- **`h(Foo, …)` was invisible to both the checker and the ratchet** until
  this change added a rule for it. `daily-split.jsx` renders
  `h(Sheet, {…})`, which is a cross-module reference written through a
  createElement alias. One site layer-wide, but it was a hole in a ratchet
  whose whole job is that the number cannot be gamed.

### `sample-data.js` is converted too

The second, and the largest data module in the layer (719 lines).
`IS_DATA` and `fmtPop` are exports; nothing assigns to `window` here
either. 755 → 726, and `scenes.js` became the first file in the layer with
**no cross-module global references at all**.

Two things differed from `primitives.jsx`, both worth expecting again:

- **The consumer set was NOT closed.** The mount suites read
  `IS_DATA` to pick a real person and city for the overlay cases, so the
  conversion reached into `test/` as well as `spec/`. Check `ui/`, `data/`,
  `test/` and `main.jsx` before assuming a provider's consumers all live in
  `spec/` — the grep is cheap and the answer decides whether a compat line
  is needed.
- **Every reference was `window.IS_DATA`, not a bare name**, so nine of
  them carried `(window.IS_DATA || {})` or `window.IS_DATA?.` — the same
  might-not-be-loaded guard `result-card.jsx` had around `Av`. Those are
  gone: an imported const cannot be unset, and `sample-data.js` depends on
  nothing so no cycle can put it in TDZ. The **inner** `|| []` / `|| {}` on
  `.groups`, `.people` and `.me` stayed — those guard missing *data*, which
  is a real condition and nothing to do with module loading.

**One bundle effect worth not misreading.** The entry chunk went 853 → 818
KB, and that is not 35 KB saved: `sample-data` became its own chunk that
first paint still preloads, because `app-shell` imports it eagerly. Total
JS is unchanged at 1529 KB. `check:bundle` asserts a total precisely so a
split cannot read as a win — see its header.

**And the general form of that is now measured, and gated (D109, D110).**
It is not a quirk of this one conversion: across D108 and D109 the entry
chunk fell 728.5 → 685.2 KB while **entry + every `modulepreload` fell
1271.1 → 1270.2** — 43 KB off the gated number, 0.9 KB off first paint.
Neither of `check:bundle`'s original two ceilings is the eager graph: the
per-chunk one is improved by relocating bytes into another preloaded
chunk, and the total counts Sentry, the world-feed group and the overlays,
which first paint never fetches.

`check:bundle` holds **four** numbers now, and `MAX_EAGER_KB` is the one
to quote for a first-paint claim — the script prints it on every run.
The fourth is D144's `MAX_EAGER_CHUNK_KB`, which says the same thing as
`MAX_EAGER_KB` in a form that cannot be raised away: no member of the
eager set except the entry may be library-sized. `MAX_EAGER_KB` protects
first paint only while nobody raises it, and it was raised four times in
four days.
D110 was the first thing it found: 292 KB of Firestore SDK had been
preloaded on every cold start, in every build, including ones with no
Firebase config at all. The eager graph is **944 KB**, down from 1270.2.

### `daily-questions.js` — the first one that was not a pure provider

726 → 708, and `mirror-answers.jsx` joins `scenes.js` at zero. Two new
shapes here, both of which will recur:

- **It is wrapped in an IIFE**, so `api` was not reachable at module top
  level to export. The wrapper is vestigial — an ESM module already has its
  own scope, and it is what this file needed when every module shared one —
  but unwrapping re-indents 480 lines and would bury four real edits in a
  whitespace diff. The binding is hoisted instead: `export let DAILYQ;`
  above the IIFE, assigned inside it. ESM exports are live and the module
  finishes evaluating before any importer's body runs, so consumers always
  see the object. Unwrap it in its own commit if it is ever worth doing.
- **It reads `window.LIVE` itself**, so unlike the first two it is not a
  pure provider — it has 3 outgoing references of its own, which stay.
  Converting what a module *provides* is independent of what it *consumes*;
  do not wait for a module to be a leaf before exporting from it.

**This is the conversion that removed a real fragility rather than just
syntax.** `map-branches.js` reads `DAILYQ.EMERGENT_CATS` at
module-evaluation time — not inside a component, not on an event. It worked
only because `spec-index.js` lists `daily-questions.js` (5th) before
`map-branches.js` (11th); reordering those two lines would have silently
dropped seven map categories, with no error anywhere. That ordering is now
a module-graph guarantee. Verified by probe rather than assumed: all seven
(`top-sport`, `top-film`, `top-food`, `top-travel`, `top-mind`,
`top-morals`, `top-music`) still merge after the change.

### `world-catalogs.js` — half of it converts, and the meter had a bug

708 → 691, in two independent parts.

**The module owns two names and only one of them is its export.**
`WF_CATALOGS` is a plain data object with a single writer, and it converted
like the others (6 sites in `world-feed.jsx`, all of them the same
`(window.WF_CATALOGS || {})` load-order guard). `WORLD_FEED_QS` did **not**,
and deliberately: `world-feed-data.js` creates the pool, this file and
`world-subtopics.js` append to it, and `data/live.ts` replaces it wholesale
in live mode. Four writers and a live/demo boundary is a design change —
an owning module with an add/replace API — not a mechanical conversion.

*Still true, and one writer fewer since.* This file's append moved out of
module scope when the demo catalogue pool was deferred: it exports
`WF_CATALOG_QS` and `loadWorldFeed()` hands it to `joinDemoStock()`
(world-feed-data.js) past a `LIVE.enabled` guard. That is the mechanical
half — a writer handing its array to the one function that appends —
not the design change above, which nobody has done. `world-subtopics.js`
moved the same way a step later — it appends IN PLACE (`pool.push`) and
retags a question, so its `installSubtopicStock()` is that treatment applied
to a mutation rather than a concat. Four writers hand their stock over now —
`place-stats.js`'s rate cards were the last, and their departure took
`place-stats.jsx` (the demo Mirror's Scores lens) off the eager graph with
them. `world-feed-data.js` still assigns the pool at module scope, and
stays eager partly for that reason.

**And it exposed a real defect in the ratchet.** `definedBy` was a
first-assignment-wins map, so a multi-writer global got one arbitrary owner
picked by readdir order. `world-catalogs.js` sorts before
`world-feed-data.js`, so it was recorded as owning `WORLD_FEED_QS` — and
`world-feed-data.js`'s five reads of **the global it creates itself** were
counted as coupling to a file that only appends to it. The map is a
`Map<name, Set<file>>` now and rule 4 asks "does this file assign the
name?", which is a question with an answer when several do. That correction
alone removed **11 false positives**, so part of this change's drop is the
meter getting more honest rather than the tree getting better — worth
separating, because a ratchet that miscounts in the flattering direction is
the one failure it cannot report itself.

### `follows.js` — and the guard shape the previous conversions missed

691 → 673. `FRIENDS` is IIFE-wrapped like `DAILYQ` and got the same hoisted
`export let`. Its 18 sites across four consumers were dense in presence
guards — six of them — including one more module-scope read:
`duels-data.js` ends with `FRIENDS.subscribe(fire)` so circle changes ripple
into duos and groups, and it was written `if (window.FRIENDS)
window.FRIENDS.subscribe(fire)`. A reorder of `spec-index.js` would have
dropped that subscription silently, exactly like `map-branches.js`.
Probed rather than assumed: inviting a friend still fires the DUELS
listeners.

**A miss from the `sample-data.js` conversion, fixed here.** That change
removed the `(window.IS_DATA || {})` and `window.IS_DATA?.` guard shapes by
explicit rewrite, and then renamed everything else in bulk — which left four
sites reading `(IS_DATA && IS_DATA.people) || []`. Dead in exactly the same
way, and invisible to every gate, because a redundant `&&` is valid code
that does the right thing.

The lesson for the next conversion is that the guard shapes are a list, not
a pattern: `(X || {})`, `X?.`, `X ? … : …`, `!X || …`, `X && …`, and
`if (X) …`. Grep for the name and read every site; do not assume the bulk
rename caught the guards.

### `result-rose.jsx` — the last pure provider, and where this stops

673 → 657. Four exports (`RP_TESTS`, `RoseMini`, `PoleRows`, `TestRose`)
and all seven `(window.RP_TESTS || {})` guards gone.

**Four of its eight globals had no consumers at all.** `RosePetals`,
`rpPetal`, `rpDeep` and `rpDot` were published because the porter
registered every top-level declaration, not because anything wanted them.
As a real module they are simply private, so the conversion removed eight
names from the global namespace to export four. Expect that ratio again —
the bridge published everything, so a converted module usually exports
fewer names than it used to publish.

**This was called the end of the cheap seam**, on the reading that the six
converted modules were pure providers and everything left was a consumer
whose own providers sat in an import cycle. The second half of that was
wrong — see the next section.

### `test-definitions.js` + `passive-progress.js` — and a cycle that was not one

657 → 540, the largest single drop since the ratchet landed, across 18
consumer files. Both modules had been named in this file as the ones
**not** to start with, on the grounds that they formed import cycles:
`test-definitions.js ↔ daily-split.jsx`, and a six-hop loop through
`app-shell.jsx → passive-meter.jsx → passive-progress.js →
test-definitions.js → daily-split.jsx → world-feed.jsx → app-shell.jsx`.

**Neither cycle existed.** Checked by building the reference graph out of
`spec-globals.mjs`'s own `definedBy`/`referenced` maps — the same data
rule 4 counts — rather than by reading the paragraph again:

- `test-definitions.js` had **no outgoing reference into `daily-split.jsx`
  at all**, and only one outgoing edge of any kind: `window.LIVE`. It was a
  pure provider with 17 consumers the whole time. The claimed edge back to
  `daily-split.jsx` was never there.
- `passive-progress.js` did produce a real edge, and it was an artifact of
  the same multi-writer attribution that `world-catalogs.js` exposed once
  already. It read `IS_TEST_RESULTS`; `test-definitions.js` creates that
  object, and `daily-split.jsx` **also assigned it** — in an `else` branch
  that ran only when `test-definitions.js` had not loaded. `definedBy` is a
  `Set`, so the graph drew an edge to both writers, and the second one
  closed a loop.

So the fallback was the cycle. Converting `test-definitions.js` made
`persistTestResult` always present, which made that `else` unreachable;
deleting it removed `daily-split.jsx` as a writer of the name, and the loop
with it. The lesson is the one the `WORLD_FEED_QS` correction already
taught, arriving from the other direction: **a multi-writer global does not
just miscount the meter, it can invent a dependency that no code has.**
Verify a cycle against the graph before planning around it — this one had
been load-bearing in the docs for long enough to defer its own fix.

Two shapes worth expecting again:

- **A defensive fallback is a second writer.** `daily-split.jsx`'s
  `else { window.IS_TEST_RESULTS = window.IS_TEST_RESULTS || {}; … }` was
  the same class of thing as `result-card.jsx`'s `{window.Av ? …}` — a
  guard that existed only because a global could be unset. It read as
  robustness and behaved as coupling.
- **`window.X` and the exported name need not match.** Consumers reached
  the persist function as `window.IS_persistTestResult`; the function is
  `persistTestResult` and exports under that name. The bridge let a
  publisher rename what it published, so do not assume the global's
  spelling is the export's.

What remains at 540 is genuinely consumer-side: `world-feed.jsx` (155),
`app-shell.jsx` (43), `profile-overlay.jsx` (28), `profile-general.jsx`
(22), `result-card.jsx` (17). `daily-split.jsx` and `test-overlay.jsx`,
which this change took to 0 and 2, are no longer on that list.

**These two are still worth moving to `data/` eventually** — as typed,
tested modules, the way `deck.ts` and `groupPortrait.ts` were extracted.
`passive-progress.js` in particular is pure arithmetic over a store
(`pct`, `done`, `passiveDone`, `prefill`) with no JSX and no test. That is
now an ordinary refactor rather than a cycle-breaking prerequisite, which
is the whole difference this change made.

**What NOT to start with.** The layer still has reference cycles, and they
are still where the global bridge is load-bearing rather than merely
legacy: ESM handles cyclic value bindings badly, and the failure is a
temporal-dead-zone error that appears only at render, which is this layer's
worst class of bug. What is deliberately **not** written here is which
files, or how many. That is a question for the graph, and a hand-maintained
answer in this paragraph is what deferred these two modules for the whole
life of the port. Build the edges from `collectSpecGlobals()`'s
`definedBy`/`referenced` maps and read the answer off the tree.

Two things that probe cheaply and are worth doing before planning around a
cycle at all: a global-reference cycle is not an ESM import cycle (`spec/`
currently has none of the latter), and a name with more than one writer can
manufacture an edge that no code actually has.

### `result-card.jsx` — the guard list, run as a sweep instead of per module

386 → 379 on the branch this was written on, landing alongside D246–D249's
own sweep of the same meter — the two together take `result-card.jsx` to
**zero** and the tree to 244. The interesting part is not the seven. Every conversion
above ended by grepping its own name for the guard shapes; `follows.js`'s
section says so in as many words ("the guard shapes are a list, not a
pattern"). What nothing had done was ask the same question of the tree at
once — *which imported binding is still read behind a load-order guard,
anywhere* — and the answer was eleven sites across six files that four
separate conversions had each left behind:

| File | Binding | Shape |
| --- | --- | --- |
| `daily-split.jsx` ×6 | `VOTECUTS` | `X ? X.m() : fallback`, `X && X.m()` |
| `mirror-tab.jsx` ×2 | `HAPTIC` | `if (X) X.m()` |
| `person-overlay.jsx` | `FRIENDS` | `X ? X.subscribe(f) : undefined` |
| `duels-data.js` | `FRIENDS` | `X ? X.list() : IDS` |
| `passive-meter.jsx` | `TypeMark` | `{X ? <X/> : null}` |
| `result-card.jsx` | `TestRose` | `X ? <X/> : null` |

None of them cost anything at runtime and none of them could fail — which
is exactly why they survived. They are dead in the sense the whole
migration section means: an imported binding cannot be unset, so the false
branch is unreachable. **The scan is four lines of node** — collect the
named imports from relative specifiers per file, then look for the six
shapes around each name — and it is worth re-running after any conversion
rather than trusting the grep that conversion did of its own name.

**One real conversion came out of the same pass.** `result-card.jsx` was
reading `window.TypeMark` and `window.TypeIndexSheet`, both defined in
`type-marks.jsx` (which already exported `TypeMark`; `TypeIndexSheet`
needed the keyword). No cycle — checked against the import graph, not
assumed, per the paragraph above: `type-marks.jsx` reaches 33 modules and
`result-card.jsx` is not among them. It took the file 17 → 10; the
parallel pass recorded in D246–D249 took the remainder, so the entry is
gone from the baseline entirely rather than merely smaller.

The guards went with it rather than being rewritten as `{TypeMark ? …}`,
which is the rule `primitives.jsx` set with `window.Av`. Two pieces of dead
code fell out and are worth naming, because both read as features:

- **A fallback renderer.** `{window.TypeMark ? <window.TypeMark/> : (RoseMini
  ? <RoseMini/> : null)}` had a whole second emblem behind it. It could only
  ever have drawn in the frame where the global was unset, and there is no
  such frame — `type-marks.jsx` is eager. `sigDims`, its only caller's only
  caller, went too.
- **A caption's guard on its own subject.** `hero` became unconditional when
  `TestRose ?` went, so `{hero ? <caption/> : null}` underneath it did too.

`RoseMini` keeps its one real consumer — `ui/LiveRolesPanel.tsx` draws it
at size 34 — so only the import here went. Worth checking rather than
assuming: the sentence above this one said "imported by nothing" until a
grep said otherwise, and dropping the export on that reading would have
broken a panel every gate here is blind to.

### `LIVE` — the store itself leaves the bridge (D354)

234 → 160 in one change, the largest single drop since `test-definitions.js`
and `passive-progress.js` (657 → 540), and the cheapest per site: `LIVE` was
**79 of the 234** remaining sites — a third of the whole meter — and
`data/live.ts` had exported the singleton since the port. Seventeen spec
modules already imported it (`lens-defs.js`, `map-anchors.js`,
`result-card.jsx`, `app-shell.jsx` and `daily-split.jsx` among them) while
reading `window.LIVE` in the same file a few hundred lines down, so for six
of the thirteen consumers the conversion added no import edge at all, only
replaced the spelling. Provider view first, as this section keeps saying:
the per-name transpose of rule 4's own `definedBy`/`referenced` maps put
`LIVE` at the top by a factor of six over the next name (`GDAv`, 13).

What it cost and what it taught, in the order they were met:

- **Cycle safety is a module-scope question, and both directions were
  read before the import went in.** `live.ts` imports
  `test-definitions.js` (for `IS_TESTS`), so any spec module that imports
  `live.ts` and is itself reachable from `test-definitions.js` closes a
  loop — and the loop is harmless exactly when neither side reads the
  other's bindings while evaluating. `live.ts` touches `IS_TESTS` only
  inside `syncPassiveResults`; `daily-questions.js`, the earliest new
  importer (4th in `spec-index.js`), reads `LIVE` only inside `myAnswer`
  and `liveSync`. Checked by reading the module scopes, then proved by
  the six mount suites, which boot the whole graph.
- **One reader stays, for a reason the scanner cannot see.**
  `test-definitions.js` keeps its four `window.LIVE` sites because
  `scripts/report-lib.mjs` imports that module under plain node (and
  `archetype-data.js` imports `IS_TEST_AVG` from it), where `live.ts`
  cannot follow: it publishes `window.LIVE` at module scope and binds the
  Firebase SDK. The baseline entry carries the reason. The honest fix is a
  node-safe seam for the store's write half — `persistTestResult`'s
  callers are all in-app — and it is an ordinary refactor now, not a
  prerequisite.
- **Three tests had hand-rolled the D280 trap.** `feed-insight-round.test.js`,
  `map-dates.test.js` and `learn-split.test.ts` each assigned their own
  object to `window.LIVE` (the third through a `W` alias, which is why the
  first grep for the shape found two) and asserted against a module that,
  after this change, imports the binding — so the stand-in reached nobody.
  The full suite said so: 17 failures in `learn-split`, every live case
  reading `enabled: false` and reporting the demo estimate. The other two
  were found by reading rather than by failing, and one of them would have
  passed vacuously (`map-dates`' demo path IS `enabled: false`). All three
  now define their members ONTO the imported singleton, which is what
  `test/live-fixture.ts` has done since its header was written;
  `map-dates` and `learn-split` need `defineProperty` because `ready` is a
  getter on the store's literal and the real descriptors have to go back.
- **The guard list gained a shape.** Beside the six load-order shapes
  `follows.js` and `result-card.jsx` recorded, this layer had grown
  *member-existence* guards on the store — `L.myVotes ? L.myVotes()[id] :
  null`, `L.editVote && L.editVote(…)`, `!L.dailyBank`, `L.confirmedVotes ?
  … : L.myVotes()`, `L.aggFor && L.aggFor(…)`. Every one of those members
  is on the object literal and pinned by `data/vote.test.ts`'s surface
  test, so the false branch was unreachable in the app and reachable only
  from a hand-built stand-in that omitted the member. They went with the
  bridge reads; the data conditions beside them — `.enabled`, `.ready`,
  `.demoInProd`, `.feedReady` — stayed, because those are false for the
  whole of mock mode and that is a real branch.
- **A comment had outlived its premise, again.** `daily-split.jsx` said its
  `demoInProd` read was a window read *deliberately*, "because the smoke
  fixtures drive this branch through the window stand-in" — true when the
  fixture assigned a second object to the global, and false since it began
  installing onto the singleton. The corrected comment names the failure
  that taught the fixture, rather than re-asserting the old reason.
- **The suppression count did not move.** D108 predicted every conversion
  would raise it before lowering it, because the React Compiler bails out
  of a component that reads a value through global scope. Not here:
  `app-shell.jsx`, `daily-split.jsx` and `world-feed.jsx` already held the
  import for other reads, so the compiler had never been bailing out on
  `LIVE`'s account. `npm run lint` is unchanged at zero.

What remained at 160 was `mirror-field-pops.jsx` (23), `app-shell.jsx` (22),
`map-tab.jsx` (17), `world-feed.jsx` (16), `daily-split.jsx` (12) and
`group-mirror.jsx` (11), and the provider view said what those were made of:
`GDAv` (13, from `group-daily.jsx`), `LMStreak` (8), `MapStats` (7), and a
long tail of one- and two-site component tags between Mirror modules. None
of them was the store any more — which is what made the sweep below
possible in one pass.

### The sweep: 160 → 32, twenty-three providers at once

Every remaining provider whose consumers could import it without a cycle
or an eager-graph cost was converted in one change — the provider view
made the list, and the import graph (built from the tree, not the
paragraph, per the section above) cleared every edge before any was
added. Twenty-three providers, forty-seven files, 128 sites:

| Provider | Names | Where it went |
| --- | --- | --- |
| `group-daily.jsx` | `GDAv`, `GroupDailyBody` | duo-daily, group-mirror, group-role-map, daily-split |
| `passive-meter.jsx` | `PassiveTag`, `PassiveMeter` | daily-split, world-feed, app-shell |
| `mirror-field.jsx` | the `MF*` family, `MirrorLenses` | mirror-field-pops, group-mirror |
| `map-bottom-card.jsx` · `map-people.jsx` · `map-learn-card.jsx` | the `MT*` cards | map-tab, mirror-field-pops |
| `map-group-stats.js` · `map-branches.js` | `MapStats`, `MapLens` | map-tab, map-bottom-card, person-mindmap |
| `compare-breakdown.jsx` · `compare-pop.js` | `CompareBreakdown`, `CompareCarousel`, `IS_COMPARE_POP` | group-mirror, mirror-field-pops, person-overlay |
| `feed-read.js` · `world-feed-data.js` · `world-feed-report.js` | `FEEDREAD`, `WORLD_TOPICS`, `WF_REPORT` | app-shell, mirror-field-pops, daily-split, search-overlay, world-feed |
| `learn-bits.jsx` · `learn-social.js` | `LMStreak`, `LMFriends`, `LEARN_SOCIAL` | world-feed, map-learn-card, learn-bits |
| `lens-defs.js` · `lens-cards.jsx` · `logic-test.jsx` | `LENSES`, `LensesPanel`, `LOGIC` | lens-cards, profile-general, profile-overlay |
| `demographics.js` · `demographics.jsx` · `segment-explorer.jsx` · `mirror-answers.jsx` · `group-role-map.jsx` · `group-mirror.jsx` · `mirror-field-pops.jsx` | one component or store each | the Mirror's own modules, mirror-tab, profile-general |
| `relmap-lenses.jsx` · `viz-primitives.jsx` · `iOS.jsx` · `daily-split.jsx` · `app-shell.jsx` · `profile-general.jsx` | `RMLenses`, `Donut`/`RadarChart`, `IOSDevice`, `DailySplit`, `App`, `GeneralPanel` | relmap, vote-cuts, city-overlay, app-shell, main.jsx, profile-overlay |
| `data/places.ts` · `ui/CityPicker` · `ui/PickSearch` | the typed layer's three remaining publications | feed-read, profile-general, world-feed |

Four shapes recurred, and each is worth knowing before the next one:

- **A provider declared inside an IIFE cannot `export` by keyword.** Eight
  of these (`group-daily`, `group-mirror`, `group-role-map`,
  `segment-explorer`, `mirror-answers`, `lens-cards`, `map-people`,
  `profile-general`) declare their components inside the porter's wrapper
  and close over its state. The DAILYQ hoist (`export let X;` assigned
  inside) works when the inner name differs; when the export IS the inner
  function's name it shadows the hoisted `let`, so these hand the
  bindings out through a `const EXPORTS = {}` filled where the
  `Object.assign(window, …)` used to be, and `export const { … } = EXPORTS`
  after the wrapper. The IIFE runs before the export line, and no consumer
  reads the binding while evaluating — the same condition every
  conversion here has had to meet.
- **A publication a test reads is a publication with a reader.** Five
  window copies survive on purpose, each beside its export: `MapStats` and
  `LENSES` (`smoke-live` reads them to pin the cohort gate and the lens
  scores), `WORLD_TOPICS` (`world-channels.test`), `MTAnchorCard` and
  `MTAnswerCard` (`smoke-live` renders them directly), `PlaceStatsCard`
  (`feed-pool-wiring` asserts it landed), `ConsequenceBeat` (`smoke-daily`
  deletes and restores it, and daily-split still reads it — below), and
  `App` (every mount suite takes `globalThis.App`). The two the sweep
  deleted that a test DID read — `FEEDREAD` and `WF_REPORT`, through a
  `window as any` handle in `purge-wipe.test.ts` that the first grep for
  window readers could not see — failed the suite and moved to imports;
  the same lesson `learn-split` taught in the D354 section.
- **The eager/lazy boundary decides direction, not the ratchet.** Three
  reads stay on the bridge because an import would cross it the wrong way:
  daily-split's three `ConsequenceBeat` sites and its two `WorldFeed`
  sites read modules in the feed's lazy group from the eager side (an
  import would drag them into first paint, and the `window.X &&` there is
  the documented contract for the frame before the chunk lands), and
  mirror-field-pops' `RMCore` read is a demo-only header on a ~20 KB module
  that only the relationship map needs. Two cross-group imports were
  taken the other way on purpose: `CircleReadCard` (the Map's) and
  `PlaceStatsCard` (the feed's) now ride the Mirror's chunk, because their
  only guard was the frame in which they might not have landed, and an
  import removes that frame.
- **A fallback renderer is a second implementation.** `person-overlay`
  carried a whole "What makes the number" card for the frame in which
  `compare-breakdown.jsx` had not loaded; `daily-split` had a five-topic
  stand-in for `WORLD_TOPICS` at module scope, the fragility the feed
  paragraph at the top of this file names; `map-learn-card` and
  `map-tab` rendered `null` where a card's module might be missing. All
  of those frames were unreachable already — every provider evaluates
  before its consumer — and each went with the read. The README's
  guard-shape list gains two entries from this pass: `typeof window.X ===
  'function' &&` and a whole `if (!window.X) return <fallback/>` block.

What is left at **32** is structural, and the provider view says so in
one screen: the seven overlay tags `app-shell` mounts by name after
awaiting `loadOverlays()` plus that loader itself (the lazy-mount
contract, D38/D223 — converting those means holding the overlay
namespaces the way `MirrorSlot` holds the Mirror's, a design change
rather than a mechanical one), `WorldFeed` and `ConsequenceBeat` from the
eager side, `DuoBody` for the same reason, `MAP_OPEN_GROUP` (world-feed →
map-tab, across two lazy groups), `registerBackHandler` (a seam
`dialog.test` stubs on the window), `RMCore`, `WORLD_FEED_QS` (four
writers — the design change `world-catalogs.js`'s section describes), and
`test-definitions.js`'s four `LIVE` reads. Each has its reason written
beside it; none is a name a mechanical pass can take.
