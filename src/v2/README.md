# InSight v2 — the ported app

This is the frozen spec (`design/InSight_standalone_15.html`) running under
Vite. `index.html` points at `main.jsx`; the journal-era app lives in
git history (decision D4) — `src/legacy/` was deleted after Phase 5 shipped,
and its Firestore rules were retired to `firestore.rules.v1-archive`.

## How the port works

The prototype ran as ~65 `<script type="text/babel">` tags sharing one
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
  typed: `live.ts` ends by publishing `window.LIVE`, and both `ui/` panels
  `Object.assign` themselves onto `globalThis`, because spec modules look
  them up **by name at render time**. `check-spec-globals.mjs` scans them
  for that reason. What IS different is that their internals are typed and
  `tsc -b` checks them — the spec layer's are not.

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
has rendered. That is ~85 KB — `world-feed.jsx` alone is the largest module
in this layer — off the first frame, and the entry chunk went 947 → 850 KB
(282 → 255 KB gzipped).

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
tests carry that: `smoke.test.jsx` asserts **both** shapes, the daily tab
with `window.WorldFeed` deleted (the frame before the chunk lands) and the
feed present after `loadWorldFeed()` resolves. Either alone passes while
the other half is broken.

Both mount suites `await loadWorldFeed()` in `beforeAll`. Without it every
D11 case in `smoke-live.test.jsx` would assert on a tab that never rendered
a feed card — a vacuous pass, and the largest module in the layer would
quietly leave the suite.

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

That count is **27 across 14 files** as of 2026-07-30. It is quoted here
rather than left to the reader because this section previously claimed 42
long after the number had moved — a stale figure in the one paragraph
whose job is to size the debt.

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

`test/smoke.test.jsx` mounts `App` in jsdom and walks the surfaces the
header and tabbar reach — both tabs, the profile overlay, the search
overlay — plus the six with **no button at all**: `test`, `relmap`,
`logic`, `suggest`, `person` and `city`, which other components open by
calling `window.openTest()` / `window.openOverlay('relmap')` / … and which
consequently nothing executed. That was the largest unmounted block left in
this layer: ~130 KB of the shipped bundle, including the two biggest single
components after the feed. `test/setup-dom.ts` stubs the browser APIs jsdom
lacks (`matchMedia`, the two observers, `scrollTo`, canvas contexts).

It exists because **this layer's characteristic bug is invisible to every
other gate.** A global that is defined but undefined *at render time* —
load order in `spec-index.js` is semantic, and a renamed member passes
name-level checks — throws only when the component paints. Verified, not
assumed: injecting `window.FEEDREAD.statsTypo()` into `MirrorTab` leaves
`check:globals`, `eslint` and `tsc -b` all green, and fails the mirror
case here with `TypeError: window.FEEDREAD.statsTypo is not a function`.

Two things to know before extending it:

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
- **It is a smoke test.** It proves the screens mount, not that they are
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

| suite | the property it exists for |
| --- | --- |
| `LiveCohortBody` | an absent breakdown cell is WITHHELD, not zero, and is counted and named; the server's `tooSmall` flag beats any counts on the document; the printed floor equals `AGG_MIN_N` |
| `LiveGroupsMirrorBody` | nobody is named on fewer than `MIN_SHARED` days; duos are excluded; alignment counts days *played*, not days revealed |
| `LiveDuelPanel` | before a reveal only your own pick is on screen; the duo card states the both-play condition rather than promising a reveal |
| `CityPicker` | every emitted value matches the server's own city shape; all five location failures land somewhere usable; a located city is suggested, never applied |
| `PickSearch` | the id handed up is the catalogue key, not the row position; each domain searches its own store; "not listed" stays a distinct answer |
| `LivePrivacyPanel` | deleting an account takes two deliberate taps, and a refused delete is shown rather than swallowed |

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

`smoke.test.jsx` runs with `window.LIVE` **undefined**, so every
`if (window.LIVE && window.LIVE.enabled)` branch in this layer was
unexercised by the suite. Those branches are where D9 drops the Mirror's
City stop and where D11 keeps takes, counter-arguments and friend dots off
world-scale cards — decisions whose only evidence was a browser probe run
once by hand.

`test/live-fixture.ts` installs a stand-in `window.LIVE` plus the feed
globals `buildFeedGlobals()` publishes, and `smoke-live.test.jsx` walks the
same surfaces with it, in six shapes: the happy path, below the k-floor
(`aggFor` returns `{ tooSmall: true }` with **no** counts — its own render),
the `demoInProd` fallback, and a profile with no city.

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

The baseline is **69**: 67 in `spec/`, plus two deliberate `autoFocus` keeps
on picker search fields. The `spec/` findings are deferred for the same
reason as the React Compiler ones — adding key handlers and focus behaviour
to ported components no test asserts the interaction of is the blind change
that trade refuses. Fix them behind interaction tests, not ahead of them.

Per file, not a total, so a fix in one file cannot pay for a regression in
another. Lowering it is the script's own output: fix something, run it, and
it prints the replacement literal.

## Migration path (Phase 2+)

Modules migrate off the global-scope bridge incrementally: when a module
gets real data or typing, convert it to proper imports/exports and remove
it from `spec-index.js`'s implicit dependency web. The mock data stores
(`sample-data.js`, `duels-data.js`, `daily-questions.js`, `passive-progress.js`,
`scenes.js`, `follows.js`) are the seams where Firestore plugs in — each
already funnels all reads/writes through one `window.*` API object.
