# The account-setup sheet — Claude Design, 2026-09-08

The owner's canvas for [`VISUAL-REQUESTS.md`](../../docs/VISUAL-REQUESTS.md)
request 10, the screen `src/v2/ui/LiveProfileSetup.tsx` draws — the first
thing after the sign-in gate that
[`design/front-door-2026-09-07/`](../front-door-2026-09-07/) settled, and
the arrival those two are read as one of.

`setup-sheet.dc.html` is the file as delivered, with `support.js` — the
canvas runtime it loads, generated and marked do-not-edit — beside it.
Unlike the front door's bundle this one is readable markup, but it is
*templated* markup: the artboards come from one element repeated over a
`states` array in the `<script type="text/x-dc">` block at the foot, so
the strings a build has to match are easier to read here than there.

## The six artboards

iPhone 402 × 874, one canvas, light palette with a `dark` prop that
repaints every one of them.

| | State | What it is for |
| --- | --- | --- |
| 1 | Empty | a new account, nothing filled — the case the screen exists for |
| 2 | Partial | name, year and *city* in; two of the four still missing |
| 3 | Complete | the four are in, the optional four are too |
| 4 | Saving | one write, rows still readable, only the button busy |
| 5 | Handle refused | the rest is written, the sheet stays for the handle alone |
| 6 | Offline | the form still fills; only the save waits |

## What it answers

The request asked one question — **how does a screen earn four honest
answers** — and the canvas answers it with structure rather than with
marks. There are no asterisks anywhere. Two group headings do that work:

- **To start** — display name, year of birth, gender, country
- **If you like** — city, education, work, relationship, handle, with
  *Add or change later in your profile* on the heading

and one sentence above them says what the four buy:

> Your answers are counted with people of your age, gender and country.
> That takes four things.

The required set is the one request 10 proposed, unchanged.

## Two departures from the request, both deliberate

**1 · There is no Skip.** The request's phrasing — the owner's own —
was *"some of them should ve requierd before skiping"*, which the canvas
reads as self-cancelling: a skip you must fill four fields to reach is
not a skip, so the button is **Continue** and it waits. That removes
*Skip for now* from the screen entirely, and with it the counter: the
primary never reads *Save 3 of 7* again. Under a Continue that is not
ready, one line says why — *Fill in the four above to continue.*

This is the half of `LiveProfileSetup.tsx`'s own reasoning that D414
already retired ("never a wall"). The other half — *a required
demographic form is how you teach people to lie to one* — is what the
lead sentence and the two headings are aimed at.

**2 · The birthday is a YEAR, not a date.** The request described the
three-column day/month/year grid; the canvas draws one row, *Year of
birth*, with D155's claim under it at the field where it is earned
rather than in a paragraph at the top:

> Saved as an age group, not a date.

**What that costs, measured, because it is a data change and not only a
visual one:** `calcAge` decrements by one when the birthday has not yet
come round this year, and it can only do that if it has the month. With
the year alone the month test is skipped, so the exact age D155 pairs
with the band runs **up to one year high** for anyone whose birthday
falls later in the calendar year. The band is unaffected except exactly
at a band edge. Day and month stay askable in the profile's Basics card
(`profile-general.jsx`), which is where a person who wants the precise
number can give it — so this is a first-run simplification, not a field
being taken away.

**And one field simply is not drawn:** `heightBand`. It is in
`anchorsFrom` and stays in the profile; the canvas leaves it off the
first screen.

## Every string it settled

Copy verbatim, because D182 governs it and the build has to match.

- **Heading** — *A few things about you*
- **Lead** — *Your answers are counted with people of your age, gender
  and country. That takes four things.*
- **Group headings** — *To start* · *If you like*, the second with *Add
  or change later in your profile*
- **Rows** — *Year of birth* (sub-line *Saved as an age group, not a
  date.*) · *Gender* · *Country* · *City* · *Education* · *Work* ·
  *Relationship*. An unanswered row reads **Choose** in the muted ink.
- **Free text** — placeholder *Display name*; the handle field carries a
  standing *@* and placeholder *handle*
- **Handle claim** — *A handle is claimed once and can't be changed.*
- **Handle refused** — *@{handle} is taken. Everything else is saved.*
  and, under the primary, **Skip the handle for now** — the only skip
  left on the screen, and it skips one field rather than the sheet
- **Primary** — *Continue*, becoming *Save handle* after a refusal and
  *Try again* when offline
- **Not-ready hint** — *Fill in the four above to continue.*
- **Offline banner** — *You're offline. Check your connection, then try
  again.* — the front door's sentence, word for word

## The mechanics a static reading loses

1. **`ready = name && year && gender && country`.** The primary is
   disabled unless that holds, and also while saving or offline; its
   opacity carries the same three-way state (1 · 0.75 saving · 0.45
   not-ready).
2. **Nothing is ever marked wrong for being empty.** Artboard 2 is that
   case drawn: two of the four are missing and no row is red — the
   button is simply not ready yet. The one red thing on the whole canvas
   is a handle that is taken.
3. **A refused handle survives the save.** Everything else is already
   written when that message appears, which is what its second sentence
   says out loud, and the sheet stays open for the one field.
4. **Rows, not eleven stacked controls.** Two rounded cards of picker
   rows with a chevron; only the two genuinely free-text values are
   inputs, and both sit at 16px — `--field-size`'s floor, because a
   smaller field makes iOS zoom the fixed shell.

## What it keeps

The 402-wide frame with `box-sizing: border-box` and 20px of side
padding — the property whose absence started this request — and the
front door's palette, its two type families (Spectral for the heading,
Hanken Grotesk for everything else) and its lockup, so the two screens
read as one arrival.

## Status

`built` 2026-09-08 — D421, which records what the build kept, what it
added back (the political consent and the height band, both missing from
the request rather than dropped by the canvas) and the two places it
departs: the offline banner is reactive and does not disable Continue,
and Country became a real asked anchor rather than only a fold over the
city.
