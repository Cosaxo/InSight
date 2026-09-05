# Ask InSight — the web door, designed 2026-09-05

Claude Design's draft for `VISUAL-REQUESTS.md` item 0, accepted by the
owner and extracted here. The request is D365's shape A: the €320
purchase funnel leaves the app binary, and this page is where it lands.

- `ask-insight.html` — the page as designed (Claude Design template).
- `ask-insight.logic.js` — its `Component`, which is the useful half: it
  models the states and the arithmetic rather than illustrating them.

The published bundle is **not** kept. It inlines React and the font
faces to 648 KB, all of it reproducible, and this folder's siblings keep
extracted source rather than bundles.

## What the design got right, and it is the part that is hard

**The state order is D365's amendment, not the plan's default.**
`state.st` starts at `composing`, and `signIn` returns to `composing`
rather than gating it — so a visitor composes and is quoted before any
account is asked for, and a decline costs them nothing. The panel states
are `quoted · paying · declined · held`, and `held` is drawn as its own
thing rather than as a failure, which is what `paid.ts` actually does:
an API outage holds a booking and never declines it.

**The refund is drawn, not described.** `exampleRefund` computes
`(answers − served) × rate` at the selected scope, beside the cap. That
sentence is the reason the product cannot be sold through a store at all
(D365), so a page that merely asserted it would have missed the brief.

**The decline reason is a real rule.** Place-scoped civic questions are
editorial and never sold — `QUESTION-FARM.md` hard rule 6 — and the
copy says so in a way a buyer can act on, offering the rephrase.

## The adapter is the build's actual work

**The design was fed a SHAPED pricing resource, not `content/pricing.json`.**
Every value is right; eight names and two structures are not. Whoever
builds this writes an adapter and does not rename the committed file —
`scripts/build-pricing.mjs` computes it and `check:pricing` holds it.

| the design reads | the committed file has |
| --- | --- |
| `P.perAnswerBaseEur` | `base` — 0.16, same value |
| `P.adBaseEur` | `adBase` — 320 |
| `P.floorIndex` / `P.ceilingIndex` | `floorX` / `ceilX` — 0.9 / 2.5 |
| `P.cohorts` as `[{label, index}]` | `cohorts` as an OBJECT keyed `city` / `country` / `world` |
| `P.fx[cur]` as `{sym, rate, pre}` | `fx` as bare rates, `{NOK: 11.6, USD: 1.08}` — no EUR row, no symbol, no placement |
| `P.source` / `P.committed` | absent |

**And one that is not a rename — it is a promise.** The design reads
`P.refundDays` and draws **29 days**. The committed file's nearest field
is `trailingDays: 28`, which is a different quantity entirely: the
demand-measurement lookback `build-pricing.mjs` divides by. The 29 is
`WINDOW_DAYS` in `functions/src/paid.ts`, the fixed serving window.

Wiring `refundDays` to `trailingDays` would draw **28** — a page
silently making a payment promise one day shorter than the closer keeps.
It is the kind of substitution that reads as correct in review, so the
adapter takes the window from the function's constant and never from
the pricing file.
