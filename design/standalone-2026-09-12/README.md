# The 2026-09-12 standalone — the name is Doxa

The owner's `inSight_18.html` upload of 2026-09-12 (a `__bundler`
standalone in the "fast boot v2" shape, 1 MB; sixteen and seventeen
were never uploaded here, like eleven, thirteen and fourteen before
them). It arrived in the naming session with one sentence, *"I really
liked how Doxa looks"*, and then the decision: *"lets go with Doxa, do
the rename"*. The upload is ephemeral; this directory is the durable
record, per the family's standing rule (`design/README.md`).

**This directory is not a module extraction.** The bundle's modules are
the 2026-09-09 tree; what the upload changed is the wordmark, and that
is recorded whole in `wordmark.css` — the header rule, the boot mark,
and the design-time brand switch — because a diff against 09-09 would
show nothing else worth keeping. `docs/VISUAL-VISION.md` gains a row
and does not move: a name is not a vision.

## What the upload specifies

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

## What was built from it (D471, same commit)

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
