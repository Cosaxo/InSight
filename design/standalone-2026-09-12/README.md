# The 2026-09-12 standalone — Doxa: a name, a friends list, and a Map with a trail

The owner's `InSight_19.html` upload of 2026-09-12 (a `__bundler`
standalone in a new *standalone bundle* shape — two generated bundles, a
core of 94 modules and a *late* one of 18, built 2026-09-12T15:41Z; 112
modules in 1.0 MB, titled **Doxa**; sixteen and seventeen were never
uploaded here, like eleven, thirteen and fourteen — eighteen arrived the
same day in the naming session, carried the name alone, and is the
last section of this file), delivered with one
line: *"new visuals and functionality plan how to add the new features
and visuals."* The plan built on this record — every item measured
against the tree, the three owner questions, the build order — is
[`docs/VISION-2026-09-12.md`](../../docs/VISION-2026-09-12.md). The
upload is ephemeral; this directory is the durable record, per the
family's standing rule (`design/README.md`).

`design/InSight_standalone_18.html` **stays the committed reference**
until a full sync moves it (`design/README.md`'s rule). This directory,
like its siblings, does not re-point it. `docs/VISUAL-VISION.md` names
this directory as the current vision (D361's standing rule: the owner's
upload moves the vision). D-2026-09-12d records the arrival.

## What the design does, in one paragraph

**The app has a name to choose, friends have a handshake, and the Map
has a trail.** The shell carries three names — *Doxa* (`Do·x·a`, in DM
Serif Display, the default), *Endoxa* and *inSight* — behind a Tweaks
radio remembered on the device; the wordmark, the boot splash, the tab
title and *Who's on Doxa in Oslo* follow the pick. `follows.js` is
`insight.friends.v2`: beside friends and invited it keeps *requests* and
*dismissed*, so a person is `none · invited · requested · friends`, an
invite to someone who already asked is an accept, and the person page's
button reads *Add friend* → *Invited · waiting* → *Friends ✓*, or *Accept
request*. A new **Your friends** overlay (`friends-overlay.jsx`) lists
Requests (Accept · ignore), Suggested with a reason each (*through
Henrik* · *a few streets away · 88 affinity*; Add · dismiss; *Show N
more*), Invited (*waiting for them to accept* · Cancel) and Friends
(relation · last seen; ⋯ opens *Remove Henrik?* — *You'll stop comparing
answers, and any 1v1 you have together ends. Henrik isn't told.*), and
opens from the New-1v1 sheet's *Find more friends →*, search's *Manage
→*, a friends button with a pending dot in the profile header, and the
person page. On the You stop's Map the chip row becomes a **trail** (*‹
You › Everyday*, the way back in the first crumb, the group's hue on the
last), a glass turns the rail into **Find** (*Find an answer…*, *This
week*, *Rare takes*; matches lit with a double ring; a results card —
*12 matches lit on the map*, prompt · when · your answer), the card
**resizes** on a grab bar (peek · half · full) and steps **prev/next**
through siblings (*‹ 3 of 7 · Everyday ›*), two **coach hints** show
once (*Pinch to zoom · tap a branch to open it*; *‹ You in the trail
steps back out*), the root card carries a **legend** (near the centre ·
far out · halo · hollow), hubs wear badges, and the Map takes an
`onExit` from the Mirror. Smaller: the person page's receipts lead splits
into a sentence and a tappable tail (*Same answer 7 times out of 9.*
**Two splits ›**), its Match slides get a lead (*Closest on Values,
least on Politics.*), its hero line says *since 2009*; overlays leave
with a 200 ms slide (`ov-host`); six sub-44px controls get their slack
from a pseudo-element; form controls inherit the page face; the
profile's sub-tabs swipe (`useSubSwipe`); four D182 deletions; and the
daily's modes are labelled *Groups · 1v1s*. The paid rows (*Asked for
Oslo*, *+ Author a metric*), the header's ask door and the paid overlays
are gone from the bundle, as D288 and D368 took them from the tree. The
duel family is byte-for-byte the 09-09 design.

## The files here

Every `.js`/`.jsx` file here is **Babel's output, normalised** — the
bundle ships compacted modules with no comments, so the files are what
`normalize.mjs` (below) makes of them: parsed, regenerated, double
quotes, one statement a line. Read them as the design. A file is here
whole when it moved by more than a hunk against its latest whole record
or is new; a smaller move is a patch under `changes/`, whose left side
is the record normalised the same way.

| File | What it is | Where it lands |
| --- | --- | --- |
| `friends-overlay.jsx` | **new** — *Your friends*: `recency`, `reasonFor` (a note naming a friend → *through Henrik*; a distance → *a few streets away*; affinity when known), the four groups, the remove sheet as a portal, the empty state | a new `ui/LiveFriendsOverlay.tsx` behind `loadOverlays` — the plan's §2.3, §2.4 |
| `follows.js` | the store: `insight.friends.v2`, `SEED_REQ`, `status` with `requested`, `invite` accepting a pending request, `accept`, `ignore`, `dismiss` / `dismissed` / `isDismissed`, `requests`, the demo's timed auto-accept | `spec/follows.js` (the demo, at this shape) and one `FRIENDS` over D101's rows on live — §2.2 |
| `app.jsx` | the shell: `BRANDS` (`doxa` serif · `endoxa` · `insight`), `brandInit` off `insight.brand.v2`, `window.BRAND_NAME`, `document.title`, the wordmark's `wm-serif` and the `<em>` carrying the daily's accent; `LIVE_OVERLAYS` + `friends`; `useLeaveHold` and the `ov-host` slot; `DAILY_DOTS` labelled *Groups* · *1v1s*; the *Brand* radio, the *Group / 1v1 start* states (`fresh · no follows` is new), *Reset your open rounds*; the paid doors and `goTrends` gone | `spec/app-shell.jsx`, `data/brand.ts` — §1, §2.5, §5 |
| `duo-daily.jsx` | vs 09-09: *Find more friends →* under the invite list and in the everyone-has-one state, both opening the friends overlay | `ui/LiveDuelPanel.tsx` — §2.5 |
| `person-overlay.jsx` | vs 09-09: `receiptLead` returning `{main, tail}` and the hero's lead as a button that switches to Answers and scrolls; `matchLead` over the compare slides (*Closest on X, least on Y.* / *Furthest apart on Y.*); `fPrim` and *Accept request*; `since` in the hero line; the read-each-other marks in the person's hue and `themFade` | `spec/person-overlay.jsx` — §4 |
| `profile-overlay.jsx` | vs 08-24 (+ the 09-06 and 09-07 patches, which it also carries): the friends button in the header with the pending dot and its label; `useSubSwipe` on the body; `profile-ov`; Big5Deep / PoliticsDeep under the result cards (09-07's) | `spec/profile-overlay.jsx` — §2.5, §4 |
| `search-overlay.jsx` | vs v18: *Manage →* beside the *Friends* group; the people row's sub without the distance | `spec/search-overlay.jsx` — §2.5 |
| `demographics.js` | vs v18: `BR` from `BRAND_NAME` or the device key; the three *Who's on …* titles and notes read it | `spec/demographics.js` — §1 |
| `map-find.jsx` | **new** — `MTCardGrab` (the grab bar; 28 px steps; tap toggles half/full), `MTCardNav` (‹ *i of n* · ctx ›), `MTFindCard` (idle · matches · empty; the first forty) | a new `spec/map-find.jsx` — §3 |
| `map-chips.jsx` | vs v18: `crumbs` / `onCrumb`, the trail pill (`‹` on the first crumb when deep, `›` separators, `is-here`, `is-hue`), the row scrolling the active chip or the trail to centre, `findOpen` / `onFind` / `query` / `onQuery` / `fWeek` / `fRare`, the glass, the field with ✕, the two toggles | `spec/map-chiprow.jsx` — §3 |
| `map-card.jsx` | vs v18: the root card's legend (`mmt-legend`, four `mmt-legdot` states) | `spec/map-bottom-card.jsx` — §3 |
| `map-constellation.jsx` | the Map whole (v18's `map-tab.jsx` plus v28's and 09-06's recorded hunks, plus what is new): `crumbs`, `findOpen` / `query` / `fWeek` / `fRare` / the match set and `is-hit`, `cardMode` and `is-peek` / `is-half` / `is-full`, `sibNav`, the two hints under `insight.mapHints.v1`, `c.badge` on hubs, `is-wait`, `onExit`, `mmt-ring` | `spec/map-tab.jsx` — §3 |
| `map-anchors.js` | vs v18: `list()` of anchors with `topDims` — the shape the tree already ported (`spec/map-anchors.js` has `topDims`); here because the v18 record is the older shape and the file is small | nothing new to port |
| `changes/big5-deep.jsx.patch` | vs 09-07: the *tap one to read it* hint deleted | copy — §5.2 |
| `changes/mirror-field-pops.jsx.patch` | vs 08-24: Kindred's sub → *Strangers most like you.*; two 12 px floors (09-06's); the so-what line hidden on Circle | copy — §5.2 |
| `changes/map-fore-card.jsx.patch`, `changes/trait-web.jsx.patch` | vs v28: one caption each, said once | copy — §5.2 |
| `changes/mirror-answers.jsx.patch`, `changes/place-stats.jsx.patch` | vs 09-02 / 08-26: `PlaceAsked` (*Asked for Oslo*) and *+ Author a metric* removed — the paid tail leaving the design as D288 took it from the tree | nothing — already gone |
| `changes/pulse-card.jsx.patch` | vs v28: the card redrawn since that record — the cadence as a quiet link with a chooser (*ask me* · daily · weekly · off), *Not asked — no line drawn.*, the streak as *N days in a row*, the ballot-link class | `ui/PulseCard.tsx` carries the cadence control already (D203); the copy is the plan's §5.2 |
| `changes/*.v18.patch` (19) | the modules whose latest **whole** record is v18, diffed against v18 — **these include the hunks the 08-26, 09-02, 09-06 and 09-07 patches already recorded** (see the limit below): `world-feed.jsx`, `daily-split.jsx`, `sample-data.js` (the people's `last` · `note` · `since`, the `nearby` list), `shared-primitives.jsx` (`useSubSwipe`; `Av`, `AnonAv`, `anonName` the tree has), `compare-breakdown.jsx` (`CompareList`, the `lead`), `relationship-map.jsx`, `relationship-map-panels.jsx`, `person-mind-map.jsx` (`own`; the slim card and `MTSwipeRow`), `mirror-field.jsx` (`anon: true` on a Kindred portrait), `mirror-tab.jsx` (`onExit`), `map-people.jsx` (*your groups named you in N of M votes*), `result-rose.jsx` (`compact`), `feed-read.js` (`strong`), `passive-meter.jsx` (the chip's *profile* label gone), `test-viz.jsx`, `general-tab.jsx`, `world-feed-data.js` (twenty demo questions), `daily-questions.js` (08-26's), `map-groups.js` (v28's) | read with the copy check in the plan's §0 and §5; most of it the tree already has |
| `css/map-wayfinding.css` | the stylesheet's *map wayfinding: trail + find + card nav + coach* section, whole — 36 of the 40 classes new since every recorded stylesheet | `src/v2/styles.css`'s map section — §3 |
| `css/polish-4.css` | the *fourth pass*: the six controls' 44 px slack on `::before`, `:where(.app,.overlay,.wf-sheet) :is(button,input,select,textarea){font-family:inherit}`, `.ov-host` and `ovLeave` | `styles.css` — §5.1 |
| `css/wordmark.css` | the two DM Serif Display `@font-face` rules and `.h-title.wm-serif` | `styles.css`, `public/fonts/` — §1.3 |
| `boot-splash.html` | the template's boot splash (*Do·x·a* in the serif before React runs) and the four-line brand script, verbatim | `index.html` — §1.3 |
| `order.json` · `hashes.json` · `normalize.mjs` | the bundle's load order with each module's bundle (core · late), the per-module hashes, and the recipe that made them — **for the next extraction to diff by** (below) | — |

Not carried: `patterns-core.js` differs from v28 by the `working(qid)`
hunk the 08-26 record holds and D310 built.

## What moved, measured

The 09-09 record diffed by *the bundle's own hashes*; this bundle
carries none (`window.__IS_BUNDLE` is a build stamp and two counts). So
the moved set is an **AST comparison against the latest whole record of
every module**: `normalize.mjs` parses a module, drops comments and every
literal's raw spelling, regenerates with double quotes; a JSX-source
record (v28, 08-24, 08-26, v18) is compiled first with the 09-02 README's
recipe. Two files that normalise identical are the same design; the
diff of two that do not is the change and nothing else. Against 112
modules:

- **2 new**: `friends-overlay.jsx`, `map-find.jsx`. Nothing removed. The
  110 keep the 09-09 load order; 18 of them now run in the *late*
  bundle (the sheet, the test viz, the result card, the trait web,
  search, friends, the test overlay, the lenses, the roles panel, the
  two deep instruments, the profile, the person map, the person page,
  the city overlay, the logic test, the general tab).
- **29 identical to a later whole record**: to 09-09 — `duels-data.js`,
  `explain-sheet.jsx`, `first-day.jsx`, `group-daily.jsx`,
  `group-mirror.jsx`, `group-role-map.jsx`, `role-data.js`,
  `roles-panel.jsx`; to 09-07 — `politics-deep.jsx`; to 09-06 —
  `oracle.jsx`, `paid-data.js`, `patterns-tab.jsx`, `people-lens.jsx`,
  `question-map.jsx`, `result-card.jsx`, `test-overlay.jsx`; to 09-02 —
  `paths-card.jsx`; to 08-26 — `predict-data.js`, `map-tab.js` (the
  08-26 record's `map-layout.js`); to 08-24 — `place-stats.js`; to
  08-20 — `question-map.js`; to v28 — `paths-data.js`,
  `predict-cards.jsx`, `pulse-data.js`, `trait-links.js`, `type-mix.js`,
  `type-mix.jsx`; to v25 — `segment-explorer.jsx`; to v24 —
  `pulse-trends.jsx`.
- **43 identical to v18** (no later whole record, and unchanged since
  the reference): the data and utility modules (`archetype-data`,
  `compare-pop`, `scenes`, `glyph-icons`, `subnav-thumb`,
  `map-branches`, `map-group-stats-mock`, `haptics`, `swipe-back`,
  `sheet-escape`, `sheet-drag`, `scroll-memory`, `edge-fade`,
  `relationship-map-core`, `rm-test-lenses`, `votecuts`,
  `world-palette`, `world-catalogs`, `world-subtopics`,
  `world-feed-comments`, `world-feed-counters`, `world-feed-report`,
  the four `learn-*`, `test-data`, `passive-progress`,
  `test-feed-data`, `lens-defs`) and fifteen components (`iOS`,
  `tweaks-panel`, `viz-primitives`, `type-marks`, `read-run`,
  `learn-bits`, `consequence-beat`, `demographics.jsx`,
  `map-learn-card`, `profile-test-viz`, `lens-cards`, `cityoverlay`,
  `logic-raven`, and the two relationship-map files above).
- **38 moved**: the files above, whole or as patches.

**The limit, recorded as the 09-08 README recorded its own.** For the
modules whose latest whole record is v18, the family's standard is a
baseline of v18 plus every recorded patch (v28, 08-26, 09-02, 09-06,
09-07). That baseline could not be rebuilt byte-exact today: the v28
patches apply to v18's JSX, but a fresh compile of the result no longer
takes the 08-26 patches (Babel's output has drifted since they were
cut — the first hunk fails on `world-feed.jsx`). So the nineteen
`*.v18.patch` files are honest diffs against v18 that **contain** the
recorded hunks, and the plan separates new from recorded by reading
them against the earlier READMEs and by checking every rendered string
against the tree — which is how it found that the feed's and the daily's
moves are almost entirely already in the tree (the anonymous toggle,
the takes composer, the learn streak, the rate scale's ends, the
hold-to-change vote), and that the Map's are not.

**For the next extraction:** run `normalize.mjs` over the next bundle's
modules, hash them the same way (sha256 of the normalised text, first
ten hex digits — `hashes.json`), and compare the maps. Whatever the next
bundle's own build stamps, this is the comparison that does not depend
on it.

## Where the tree departs from the design, and why

Nothing is built from this record yet; these are the departures the plan
already knows it will keep, each with its reason
(`docs/VISION-2026-09-12.md` has the arithmetic).

- **A suggestion never says how far away someone is.** *a few streets
  away* draws the presence cell — the physical-safety deny that survived
  D98 (`CLAUDE.md`'s three denies), and Near is presence-only since
  D111. On live the reason is *in Oslo now*. Not an ask under D334; the
  denies are outside it.
- ***some of it stays private until you are friends*** beside a
  person's map (in the record since 09-09), and the map's *N details
  hidden · friends see everything* (in the tree since the port) describe
  the demo's invented locked nodes; on live nothing is locked (D98, D101).
  The first line is not ported; whether anything should stay private is
  the owner's (`OWNER-LIST.md`, the plan's Q3).
- **The name is not built ahead of the owner's pick**, and the *Brand*
  radio does not ship at all: a product has one name, and the Tweaks
  panel is `import.meta.env.DEV` only (D223).
- **The demo's test banks are v18's ten and twelve questions**
  (`test-data.js` is byte-identical to v18's); the tree's are the real
  banks (D121). Not a change.
- **The World-round copy is still in the 1v1** (`WorldCols`, *already
  answered this in the World feed, so there is no guess this round*) —
  unchanged since 09-09, and not built then either (the owner's *no*,
  VISION-2026-09-09 Q1).
- **`sd-switch`**, the daily's own segmented mode switcher, is in the
  design and rendered nowhere in it (`hideSwitcher` and `ruler` are both
  on, as in the tree); it is not a feature.
- ***Groups · 1v1s*** on the ruler is the owner's to rule (the plan's
  Q2), because ROUNDS-PLAN §9 made the rename its own change.

## Status

`designed` 2026-09-12 (the owner's upload). Nothing built; the three
questions are on `docs/OWNER-LIST.md`, and the six steps on
`docs/WORKLIST.md` — the first four gated on nothing.

## The other upload of the day — `inSight_18`, the name alone (D472)

The owner's `inSight_18.html` arrived in the naming session of the same
date with one sentence, *"I really liked how Doxa looks"*, and then the
decision: *"lets go with Doxa, do the rename"*. Its modules are the
2026-09-09 tree; what it changed is the wordmark, recorded whole in
`wordmark.css` at this directory's root — the header rule, the boot
mark, and the design-time brand switch (`css/wordmark.css` is the same
two rules as `InSight_19` carries them). D472 built it in the same
commit and renamed the shells, the store listing and the web pages with
it; the brand module of `InSight_19` (above) reads the name those
surfaces now say.

### What the upload specifies

- **The name is Doxa.** `<title>Doxa</title>`; the header lockup is
  `Do<em>x</em>a`.
- **The face is DM Serif Display, 400** — "the one serif in the chrome"
  in the upload's own comment — at 25 px in the header and 36 px on the
  boot splash, tracked −0.01em, line-height 1.
- **The x is the accent**, an `<em>` that takes the tab colour exactly
  as `Sight` did in `In<em>Sight</em>`: violet on the Question map,
  the daily sub-mode's colour on the daily.
- **The iris does not change.** Same compact mark beside the word, same
  paper tile (D340).
- The bundle ships DM Serif Display as two Google Fonts subsets, latin
  (24.7 KB) and latin-ext (10.8 KB), under the bundler's asset ids
  `ae63319f-…` and `d18569a3-…`.

## What was built from it (D472, same commit)

- `src/v2/spec/app-shell.jsx` — the lockup, with `.wm-serif` on the
  title; `src/v2/styles.css` — the face and the two rules, scoped with
  `.h-center` so overlay headers stay sans.
- `src/v2/ui/LiveSignInGate.tsx` — the stacked lockup in the same face
  at 36 px; `web/join.html` — its twin in Georgia, because the hosting
  CSP has no `font-src`.
- **The face ships as four glyphs**, not the upload's subset: D, a, o, x,
  1.2 KB from Google Fonts' `text=` endpoint, at
  `public/fonts/dm-serif-display-400-doxa.woff2`. `check:bundle` holds
  fonts to 96 KB and the tree carried 86 KB, so the 24.7 KB latin file
  would not have fit — and the word is the only place the face is used.
- **The boot mark stays in the system stack** and says Doxa. The upload
  draws it in the serif; `index.html`'s own reasoning (no font swap
  mid-boot, on a page whose whole job is to cover the bundle's fetch)
  holds, and this is the one deviation from the upload.
