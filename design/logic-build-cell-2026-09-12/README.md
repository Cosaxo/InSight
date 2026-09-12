# Build the missing cell — the logic test's answer screen (2026-09-12)

The owner's `InSight_Logic_Test_-_Build_the_Cell.html` upload of
2026-09-12, answering **visual request 13** (D451): the Open Matrices
Item Bank is answered by CONSTRUCTING the missing cell out of twenty
shapes, not by tapping one of six finished tiles, so the item screen is
a new interaction rather than a new control. The upload is ephemeral;
this directory is the durable record, per `design/README.md`'s standing
rule. Like every sibling it does **not** re-point
`design/InSight_standalone_18.html`.

This is the first **Claude Design canvas** filed here rather than an
InSight standalone, so the extraction differs from the numbered series
— see below.

**Built 2026-09-12 (D453)**, the same day: `src/v2/spec/logic-test.jsx` is
the screen, `src/v2/data/omib-shapes.ts` its twenty shapes, and
`logic-overlay.test.jsx` its eleven cases. What the artboard decided is
what was built, with the two corrections below honoured; what it drew
and the web overlay cannot do yet — the graded haptics — is named in
`docs/VISUAL-REQUESTS.md` § Built rather than pretended.

## What the upload holds

A `__bundler` page whose manifest carries nine gzip+base64 assets. Four
are vendor (React 18.3.1, ReactDOM, Babel, two Hanken Grotesk faces) and
are not kept. The three that are the design:

| File | What it is |
| --- | --- |
| `LogicPhone.dc.html` | The artboard — one 402 × 874 phone screen, driven by props, with the twenty shapes, three real puzzles and both themes inline. This is the design. |
| `ios-frame.jsx` | The device frame the artboard mounts inside. |
| `support.js` | The canvas runtime that resolves `{{ }}`, `<sc-if>`, `<sc-for>` and `<x-import>`. Kept so the artboard renders from this directory. |

Two byte-different copies of the artboard were in the manifest; they
differ by one inlined `@font-face` line and the complete one is kept.

## What it decides

Everything the request left open, and it left the hard parts open on
purpose:

- **Tap to toggle, not drag.** Tap a palette tile and the shape springs
  into the cell (scale 0.5 → 1, 300 ms); tap the lit tile again and it
  shrinks out in 180 ms. **Clear** appears at the cell's right edge only
  once something is placed. Haptics are graded — place light, remove
  softer, Done medium, and a time-out commit gives **none**, because "it
  should not feel like a tap you made".
- **The palette is the alphabet, laid out as one.** Five columns, one
  per family, the four members down each column, every tile drawn in the
  same frame the grid cells use. Palette and cell share the one accent,
  so the link between what you tapped and what appeared needs no arrow.
- **Complete is never inferred.** *"The screen cannot tell complete from
  partial, so it never pretends to"* — the cell keeps its building frame
  until Done is pressed, and nothing auto-advances. On a time-out the
  cell commits as it stands: a partial build is the answer, an empty one
  is a miss.
- **Two clocks, one home.** A per-item segment drains in the progress
  strip; the whole-test remainder is a small figure in the header.
  Neither is bigger than a shape.
- **Both themes**, as tokens rather than as a second drawing — light ink
  `oklch(0.216 0.011 70)` on `oklch(0.994 0.0025 80)`, accent
  `oklch(0.52 0.14 195)`; dark lifts the accent to
  `oklch(0.74 0.11 195)` and sits cells one step above the ground.
- **The worked example is the same screen with two substitutions**: the
  kicker replaces the strip, Start replaces Done and is always live, and
  there is no clock. That is request 8 answered in the same pass, which
  is what kept it from teaching a screen that no longer exists.

## Two things the artboard got wrong — both measured, both now fixed in it

The artboard redrew the twenty shapes in the app's own 72 × 72 frame —
which was a gift, because it meant the port was already done. But its
shape ARRAY INDEX was not OMIB's element id, and a build that assumed it
was would have rendered every item wrong while looking entirely plausible.

**1 · The order differed in twelve of twenty places.** Compared
geometrically (centroid, and apex direction for the triangles) rather
than by eye:

| Family | OMIB's ids 0→3 | The upload's array 0→3 |
| --- | --- | --- |
| corner | TL · BL · BR · TR | TL · TR · BL · BR |
| line | upper-left · lower-left · lower-right · upper-right | UL · UR · LL · LR |
| box | top · left · bottom · right | top · left · right · bottom |
| centre | filled sq · outline sq · filled circle · outline circle | identical ✓ |
| arrow | top · left · bottom · right | top · left · right · bottom |

**OMIB numbers every family counter-clockwise, and that is load-bearing
rather than arbitrary**: `Rotation` is one of the bank's six rules, and
it works by stepping an element through its family's four ids. Under
reading order those four are no longer a rotation, so a rotation item
rendered on an identity mapping would show top → left → right → bottom
and be unsolvable — while every gate stayed green, because nothing
downstream can see a picture.

**2 · The arrows pointed the wrong way.** OMIB's arrows point OUTWARD
(the one at the top points up); the upload's pointed inward. Position
was right, direction inverted, in all four. Unlike the ordering this
was not a rename: it changed what the solver sees, and the 220 difficulty
values were measured on people looking at the outward ones.

**Fixed 2026-09-12, on the owner's word (*"redraw the arrows to point
outward like the real bank"*), and fixed by DERIVATION rather than by
drawing.** `src/v2/data/omib-shapes.ts` is now the source of the twenty:
every path is the bank's own `drawing.js` polygon scaled from its
100-unit cell into the design's 60-unit working area (6..66 of 72), in
OMIB's order, arrows out. So the shapes a solver sees are proportioned
exactly as the shapes 2,572 people were calibrated on — which also
corrected two things the comparison had not been asked about: the
upload's diagonal lines were short ticks where the bank's run
edge-middle to edge-middle, and its centre square was 16 units where the
bank's is a fifth of the cell (12). What is the design's stays the
design's — the 6-unit inset, the round caps, the stroke weights. **The
designer owns the screen; the bank owns the stimuli.**
`omib-shapes.test.ts` parses every path back to points, unscales them,
and holds them to `drawing.js` — with the upload's own inward arrow
pinned as the negative case, so the check is proved to reject what it
exists to reject.

`LogicPhone.dc.html`'s `SHAPES` array is replaced with the same table,
and its three demo puzzles are remapped index-for-index so the SAME
shapes appear under the bank's ids; its `TILE_ORDER` (column = family,
row = member) already reads correctly against OMIB's numbering and is
what `PALETTE_ORDER` in the module reproduces.

Neither was a defect in the design. A designer laying out twenty shapes
has no reason to know a third-party bank's internal numbering, and the
request did not give it to them — that omission was the record's.

## Answered by the owner, 2026-09-12: twenty-five items at ninety seconds

The artboard ran 12 items at 30 s (`ITEM_MS = 30000`, `N_ITEMS = 12`).
The owner's call — *"why not just do it like the normal test with 25 and
90 seconds?"* — is **25 × 90 s**, and it is the right one for three
reasons, none of them taste:

- **90 s is what the bank itself administers.** OMIB's published
  reference ships `timelimit = 90`. Administer under a tighter clock than
  the calibration sample had and the 220 difficulty values stop
  transferring cleanly, which is the entire reason this bank was chosen
  over the generator (D451). (Stated honestly: the reference's 90 is a
  default in the bank's own demo code. Whether the calibration study used
  exactly that is in the paper, which no session here has been able to
  reach — `www.mdpi.com` and `pmc.ncbi.nlm.nih.gov` are both blocked by
  this environment's egress. Matching the number the authors ship is the
  best available answer, not a confirmed one.)
- **More items measure better**, and 25 is what the instrument already
  uses — a shorter form is a noisier one, and the noise lands hardest at
  the ends of the scale where the reading is most interesting.
- **Nothing in the tree moves.** `LOGIC_ITEMS = 25` and
  `LOGIC_ITEM_CAP_MS = 90_000` are already the constants
  (`functions/src/logic.ts`), so the era stamp, the deadline and the
  norms all keep meaning what they mean. A count change would have been
  a fresh era under D61's rule, discarding the histogram.

**Two consequences the design should see.** The progress strip was drawn
for twelve: at 402 px with 18 px gutters and 4 px gaps that is 26.8 px a
segment, and twenty-five segments are **10.8 px** each — drawable, but
thin enough that it stops reading as a row of items and starts reading as
a hairline. Worth a look before it is built; a two-row strip or a plain
`n of 25` are both cheaper than squinting.

And the sitting is longer: 25 × 90 s is **38 minutes worst case**,
against the artboard's 6. That is a CAP, not the expected time — most
items are answered well inside it, and the whole-test deadline already
exists (`LOGIC_DEADLINE_MS`). But the screen was composed around a short
session, and a test someone abandons at item 14 measures nothing, so the
mid-test exit is worth a thought the artboard did not have to give it.
Neither of these reopens the decision.
