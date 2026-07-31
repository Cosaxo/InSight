# Working in this repo

InSight is a two-tab app (daily · mirror): one blind question a day, then
how everyone split; plus sealed group/1v1 duels revealed the next day.
React 19 + TypeScript + Vite, Capacitor shells for iOS/Android, Firebase
(anonymous-first auth, Firestore, Cloud Functions).

The product's claim is that its privacy guarantees are **enforced**, not
promised. That is the lens for most decisions here: if the UI says
something about who can see what, `firestore.rules` or a Cloud Function
has to make it true, and a test has to prove it.

Binding decisions live in [`docs/DECISIONS.md`](docs/DECISIONS.md) (D1–D7)
and stay binding until an explicitly recorded reversal.

## Two conventions that will surprise you

### 1. The spec layer talks through global scope

`src/v2/spec/` is ~18.5k lines of JSX ported verbatim from a frozen
prototype. Modules do **not** import each other. They assign to
`globalThis`/`window` and look each other up **by name at render time**:

```jsx
// tweaks-panel.jsx defines it…
globalThis.useTweaks = useTweaks;
// …app-shell.jsx just uses the bare name, no import
const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
```

`src/v2/spec-index.js` imports every module for side effects, and **the
order is semantic** — later modules read globals set by earlier ones.
Never sort it, never drop an entry.

This is deliberate and temporary (see `src/v2/README.md`), but it is
load-bearing today. Four guards make it survivable, and all four exist
because something real slipped through:

- `npm run check:globals` — dangling `window.X` references, files
  `spec-index.js` forgot, **and undefined JSX tags**. That last rule found
  a live `ReferenceError` on the Mirror tab the day it was added.
- `no-undef` is **ON** for the spec layer, seeded from that same scanner
  (`scripts/spec-globals.mjs`, shared by the checker and `eslint.config.js`).
  It was off for a long time, which is how two `ReferenceError`s shipped.
  **If it fires on a legitimate global, fix the scanner — do not add an
  eslint exception.** A name eslint cannot see is one the checker cannot
  see either, and that is the actual bug.
- `src/v2/data/vote.test.ts` pins the `window.LIVE` member surface, because
  renaming a member there passes tsc (consumers are `.jsx`), eslint and
  check:globals — then blanks the Map on a device.
- `src/v2/test/smoke.test.jsx` mounts `App` in jsdom and walks both tabs
  and two overlays. The three guards above are all **name**-level; this is
  the only one that executes a render. Measured, not assumed: injecting
  `window.FEEDREAD.statsTypo()` into `MirrorTab` leaves check:globals,
  eslint and `tsc -b` green, and fails only here.
  **Assert on the `ErrorBoundary`, not on a thrown error** — `app-shell`
  wraps every tab and overlay, so a crashed screen still returns cleanly
  from `render()`.

`src/v2/data/` and `src/v2/ui/` are typed and checked by `tsc -b`, but they
are **not** exempt from the convention: `live.ts` publishes `window.LIVE`
and both `ui/` panels `Object.assign` onto `globalThis` on purpose.

### 2. There are four test runners, and they are not interchangeable

| Command | What it covers | Needs |
| --- | --- | --- |
| `npm run test:unit` | client store, pure deck logic, spec-layer mount tests | nothing |
| `npm run test --prefix functions` | k-anon floor, reveal, streak math | nothing |
| `npm run test:rules` | Firestore **and** Storage rules | Java 21 |
| `npm run test:e2e` / `test:e2e:erasure` | full loop, real emulated functions | Java 21 |

Plus the non-test gates: `check:globals`, `check:versions`,
`check:bundle`, `check:deploy-targets`, `check:fn-runtime`, and the
catalogue drift gates `check:cities`, `check:pokedex`, `check:catalogs`
— the last two also run on the deploy path, because the aggregate
trigger validates answer keys against the committed catalogues
(D14–D17; docs/CATALOG-QUESTIONS.md).

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
- **Answers are create-only and immutable.** Not an oversight — it is what
  makes the counts honest (D5). Do not add an update path.
- **`src/v2/spec/` is the only copy of the spec layer.** The extracted
  prototype modules (`design/spec-modules/`) were deleted 2026-07-29 once
  the port was complete and they had diverged — they live in git history.
  Ported files still cite them in header comments as provenance.
- **The e2e cannot run in a sandbox that blocks
  `firebase-public.firebaseio.com`** — the functions emulator will not
  start. That is environmental, not a broken test.

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
