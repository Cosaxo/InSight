# The 2026-08-24 standalone — the paid door, the buyer's room, and five smaller moves

The owner's `InSight_3.html` upload of 2026-08-24 (a full `__bundler`
standalone, 185 assets), the third in the numbered series after
`InSight_1` (→ `standalone-2026-08-20/`) and `InSight_2`
(→ `standalone-2026-08-22/`). The upload is ephemeral; this directory is
the durable record, per the family's standing rule (`design/README.md`).
The plan built on it — every item measured against the tree, with its
backend half named — is
[`docs/VISION-2026-08-24.md`](../../docs/VISION-2026-08-24.md).

`design/InSight_standalone_18.html` **stays the committed reference**
until a full sync moves it (`design/README.md`'s rule). This directory,
like its siblings, does not re-point it.

## How this was extracted, and what it was measured against

The bundle's `ext_resources` map names 122 assets (the component layer
and its builds); **63 more assets are referenced only by the template's
own script tags** — the data modules, fonts and vendor React — and were
recovered from the manifest and identified by their header comments.
The 2026-08-20 extraction did not have that second class; a future
extractor should expect it.

Every module was diffed against the **latest recorded state of the same
module**, not against v18: v18 + `standalone-v28/changes/` patches where
those exist, `standalone-v28/`'s whole files, then the
v24 / v25 / 2026-08-20 / 2026-08-22 extractions where those supersede.
Against that baseline the build is **quiet where it looks loud**: 44 of
53 data modules and 43 of 59 components are byte-identical, the embedded
Hanken Grotesk faces are packaging for a font the app already ships
(`src/v2/styles.css`), and the shell's bottom bar, five-stop Mirror and
tweak-teardown state are all v28's, already recorded and planned. What
follows is only what actually moved.

## The files here, and where each would land

| File | What it is | Where it lands |
| --- | --- | --- |
| `suggestions.jsx` + `suggestions.js` | **"Suggest a question" becomes "Ask a question" — the paid door as the whole page.** The community board and its upvotes are gone; what stands is the rate card (one posted per-answer line per cohort, moved daily by a demand index, floored/ceilinged, locked at booking), the 14-day booked/open ticks per cohort, the scope ruler with prices on the same graduated axis every other instrument uses, audience dim chips (D228's one-to-three, each printed on the band), the what-everyone-sees preview, the contract sheet ("Arranged directly for now — no self-serve yet"), and the your-submissions list with the decline-with-an-offer flow. The store keeps declines, audience/cadence vocab and your own asks; the seeded community board is dead code it no longer renders | `src/v2/spec/suggestions.jsx` / `.js` — an owner decision first, then mostly deletion plus the door; see the plan §1 |
| `asked-by-you.jsx` | **"Asked by you" — the buyer's room** (PAID-PLAN §7, artboard B): every purchase with its PAID band, live public split, budget meter (answers against the cap — billing per answer, D164), window hairline, and the report shelf; place-metric subscriptions with the pulse grammar's honest series (outlined thin days, gapped absent days, a lapse that keeps its history); the €/kr/$ `CurSwitch` every price reads. Its foot states the room's one honesty rule: purchase records plus the same public numbers everyone reads, no other source | New overlay — PAID-PLAN §9.3 named this "the first in-app build"; the demo `SUBS` array never ships (D167) |
| `paid-data.js` | The store behind both: `MARKET` (base × demand index, `expected()`, the 500-a-week floor), `PRICE`, `CURS`/`cur`/`setCur`/`fmt`, per-purchase `budget`/`days`/`reports`/`closed`, and the disclosure line rewritten post-D98 — "the same public numbers you do … there is no private cut" replaces "counts and cuts, never names" | Reference for `data/sponsored.ts` + the future purchase/booking records; the copy correction matches what `ui/SponsorMark.tsx` already shipped |
| `place-stats.jsx` + `place-stats.js` | **The place scorecards hold two crowds**: filled dot = people who live there, ring = people who only visited, the span bar between them as the story; split headline numbers; an "I live here / I'm visiting" role switch that dims the other crowd and decides where your own marks land; your score becomes a tick, not a third dot | `src/v2/spec/place-stats.jsx` / `.js` — with an honesty caveat the plan spells out: live data can distinguish residents from non-residents, not "visitors" |
| `mirror-field-pops.jsx` | **The "so what" line** — one plain-language sentence under the Circle/Groups/City/Country/World fields naming who mirrors you closest/least and which topic you are most/least in step on, folded from what the field already computed | `src/v2/spec/mirror-field-pops.jsx`; the live line states its basis per D146 |
| `patterns-tab.jsx` | Lens labels become **Oracle · Question map · People map**; the retiring explainer notes (`PT_NOTES`, `insight.patterns.used.v1`) are deleted — each lens teaches its own marks; the oracle sub-row carries "N from feed votes" inline instead of as a `title` tooltip | `src/v2/ui/PatternsTab.tsx` (supersedes this file's 2026-08-20 copy; that directory stays the D214–D216 port record) |
| `question-map.jsx` | **The resting constellation**: the ten strongest ties drawn at full voice before any tap, their member dots fully inked; the next-up beacon moves to its own top layer so no neighbour buries it | `src/v2/ui/PatternsMap.tsx` |
| `oracle.jsx` + `oracle.css` | The sealed state reads as a vessel, not an empty box: a dusk aura pools around the disc until you vote, a breath of shade at each tile's foot, a dashed seat where the disc could land (identical both sides — nothing leaks the call); at reveal the un-picked tile wears the topic's muted hue | `src/v2/ui/PatternsOracle.tsx` + `ui/patterns.css` |
| `explain-sheet.jsx` | The 1v1 and group instruments get their ⓘ: `duo` and `group` entries (read/seen/like/steady · own/pull/cast/settle), a per-setting key (`'duo:f1'` explains as its family), and a "yours: …" note row per dim | `src/v2/spec/explain-sheet.jsx`; pairs with the shipped Roles panel (D204) |
| `profile-overlay.jsx` | The Roles subtab in the row (the app shipped it first, D204 — this is the design catching up) and a subnav scroll fix: place the active chip after layout and again on a beat, clamped, because a single smooth `scrollTo` on mount lost the race with the tab re-mount | Subtab: already shipped. The scroll fix: `src/v2/spec/profile-overlay.jsx` if the app shows the same race |
| `app.jsx` | The shell's paid wiring: `openPaidReport` / `openAskedByYou`, the `paidQ` overlay slot, a compose "+" button in the header beside search, and a `friendVotes` (rows / footer / off) tweak-lab control threaded into the feed opts | `src/v2/spec/app-shell.jsx` for the wiring; the tweak control does not port — the app has no tweaks lab, `rows` is the shipped default |

## The changes small enough to carry whole, right here

Nine files moved by a line or a hunk. Recorded verbatim so this
directory stays the full description without shipping nine
mostly-identical copies.

**`general-tab.jsx`** — the buyer's shelf joins the profile
(`PaidMineCard` is in `paid-report.jsx`, 2026-08-22's file):

```diff
@@ -394,2 +394,8 @@
         <LogicCard />
+        {window.PaidMineCard && (
+          <div>
+            <Chapter>You asked</Chapter>
+            <window.PaidMineCard />
+          </div>
+        )}
         {typeof window.MirrorFieldBody === 'function' && (
```

**`paid-report.jsx`** (four hunks against 2026-08-22's copy, which stays
the standing page design): the two disclosure sentences drop "counts and
cuts, never names" for "the same public numbers you do … no private
cut"; the shelf's count label becomes a "the room →" button onto
`openAskedByYou`; and `closed` becomes a data flag instead of a
window-string regex:

```diff
-            …The roll lists public app names and cohorts at vote time — the same who-voted list every card shows. Counts and cuts, never your profile.
+            …The roll lists public app names and cohorts at vote time — the same who-voted list every card shows. The same public numbers, no private cut.
-          <span …>{items.length} paid</span>
+          <button className="press" onClick={() => window.openAskedByYou && window.openAskedByYou()} …>the room →</button>
-          const closed = !/this week/.test((q.paid || {}).window || '');
+          const closed = !!(q.paid || {}).closed;
-          The report is yours alone — voters see the card's disclosure of what it contains: counts and cuts, never names.
+          The report is yours alone — and voters see the card say what it holds: the same public numbers you do. There is no private cut.
```

**`result-rose.jsx`** — the `compact` rose the v28 result card's `brief`
mode already asks for (its `compact={brief && !full}` call site shipped
in the v28 record; the geometry lands here):

```diff
-function RosePetals({ dims, hueOf, subOf, animate }) {
-  const W = 360, H = 330, cx = 180, cy = 168, R = 92, labelR = 106, r0 = 9;
+function RosePetals({ dims, hueOf, subOf, animate, compact }) {
+  const W = 360, H = compact ? 238 : 330, cx = 180, cy = compact ? 121 : 168, R = compact ? 70 : 92, labelR = compact ? 84 : 106, r0 = compact ? 7 : 9;
-function TestRose({ testKey, dims, animate }) {
+function TestRose({ testKey, dims, animate, compact }) {
-  return <RosePetals dims={roseDims} hueOf={hueOf} subOf={subOf} animate={animate} />;
+  return <RosePetals dims={roseDims} hueOf={hueOf} subOf={subOf} animate={animate} compact={compact} />;
```

**`map-fore-card.jsx`** — the Intuition card's key sentence, matching
the layout rollback below:

```diff
-// the groups inside it are the leaves, so the map itself shows WHO you read
-// best — close and solid = sharp, far and hollow = below your average.
+// the groups inside it are the leaves — solid = at or above your average on
+// that cut, hollow = below it; the extremes get callouts.
-          On the map, closer to the hub means you read them better — hollow dots sit below your average.
+          Solid dots sit at or above your average, hollow ones below — the callouts mark your sharpest read and blind spot.
```

**`people-lens.jsx`** — the faint-dot legend swatch was drawn in hue 40
while the dots it explains are hue 250 (a legend that lies), and the
basis line names the crowd, not the mechanism:

```diff
-            <span style={{ … background: 'oklch(0.56 0.09 40)', opacity: 0.5, … }}></span><span>= fewer shared answers</span>
+            <span style={{ … background: 'oklch(0.56 0.09 250)', opacity: 0.5, … }}></span><span>= fewer shared answers</span>
-              Drawn from each question's latest answers.
+              Drawn from the crowd's latest answers.
```

**`search-overlay.jsx`** — the person hit's sub-line drops `p.dist`
(the same direction as v28's "Near stops stating distance at all",
§0.1 of `docs/VISION-V28.md`):

```diff
-            title={anonName(p)} sub={[p.role || p.rel, p.dist || (p.since ? 'since ' + p.since : null), …
+            title={anonName(p)} sub={[p.role || p.rel, p.since ? 'since ' + p.since : null, …
```

**`test-viz.jsx`** — one wheel hue: moss goes berry, so the 8-stop
wheel keeps its spacing without two adjacent greens:

```diff
-  'oklch(0.66 0.110 145)',  // moss
+  'oklch(0.60 0.125 358)', // berry
```

**`tokens.css`** — one token, with its reasoning in the line:

```diff
-  --ink-3: oklch(0.51 0.010 68);
+  --ink-3: oklch(0.472 0.010 68); /* was 0.51 — lifted for AA contrast on the 10-11px captions it carries */
```

**`patterns.css`** — the beacon label joins the tab's own "no type below
10.5px" rule (stated in `patterns-tab.jsx`'s header since 2026-08-20 —
the 10px label was the rule's one violation):

```diff
-.qm-nextlab{font-size:10px;font-weight:800;letter-spacing:.02em;pointer-events:none}
+.qm-nextlab{font-size:10.5px;font-weight:800;letter-spacing:.02em;pointer-events:none}
```

**`feed-read.js`** — the surprise-finder learns restraint: the friends
line only when it is decisive, and a `strong` tier so weak facts wait
their turn in the feed's rhythm:

```diff
-      if (same * 2 < friends.length) return { kind: 'friends', dim: 'friends', same, of: friends.length, sides, mySide };
+      // only when it is decisive. A 4-of-6 split, said in these exact words on
+      // card after card, is furniture — the varied group facts below beat it.
+      if (same === 0) return { kind: 'friends', dim: 'friends', same, of: friends.length, sides, mySide, strong: true };
-    if (flip) return { kind: 'flip', ...flip };
-    if (skew && skew.pct >= 62) return { kind: 'skew', ...skew };
+    // strong = worth interrupting for; weak facts have to wait their turn in
+    // the feed's rhythm (see renderInsight)
+    if (flip) return { kind: 'flip', ...flip, strong: flip.pct >= 68 };
+    if (skew && skew.pct >= 62) return { kind: 'skew', ...skew, strong: false };
```

## Tried and rolled back inside the prototype: the Intuition bullseye

`map-layout.js` gains a `cat.ring` bullseye layout (cuts on rays around
the hub, a dot's radius = its own accuracy) — and `predict-data.js`, in
the same build, **stops declaring `ring: true`** on the one branch that
used it, reverting Intuition to an ordinary branch cloud with
hollow-below-average marks and callouts for the extremes
(`map-fore-card.jsx`'s hunk above says the surviving reading). The
capability ships unused. **Do not port the layout**: it is dead design
until some branch declares `ring` again; this paragraph is its record.

## Verified unchanged — do not re-extract, do not re-plan

Byte-identical to their latest recorded state, checked file by file:
the whole daily (`daily-split`, `group-daily`, `duo-daily`,
`world-feed*`, `duels-data`, `daily-questions`), the whole Map family
(`map-constellation` = map-tab, anchors, branches, groups, chips,
bottom-card, people, learn-card, group-stats), the relationship map
(core, main, panels, lenses), `person-overlay`, `person-mind-map`,
`result-card`, `type-marks`, `type-mix`, `trait-web`, `roles-panel`,
`role-data`, `pulse-card`, `pulse-trends`, `pulse-data`,
`segment-explorer` (v25's deviation view, unchanged), `suggestions`'s
seeded board data (dead code now), `paths-*`, `patterns-core`,
`question-map.js` (the engine — only the `.jsx` moved), `learn-*`,
`lens-defs`, `test-defs`, `test-overlay` (byte-identical to v18 still),
`logic-raven`, `consequence-beat`, `read-run`, `passive-meter`,
`demographics`, `city-overlay`, `search-overlay` (but for the hunk
above), `shared-primitives`, `viz-primitives`, `world-palette`,
`sample-data`, `scenes`, `follows`, `feed-read` (but for the hunk
above), the interaction helpers (haptics, sheets, scroll, swipe,
subnav, edge-fade), `iOS.jsx`, `tokens.css`/`map.css`/`page.css`/
`arena.css` (but for the one token), and the fonts the app already
embeds.

No app code references this directory; it is provenance, like every
other `design/standalone-*`.
