# Orientation — the map

For someone arriving with no context, human or model. `CLAUDE.md` is the
conventions and the traps; this is *where everything is* — every document,
every gate, every directory, one line each, and which of them describe the
app as it exists versus which describe something proposed.

It holds no reasoning of its own. Every row points at the file that is
canonical for its subject, and if this page and that file disagree, the
file is right and this page is stale. `npm run check:docs` is what keeps
the rows from going missing or pointing at something that moved — read
`scripts/doc-index.mjs`'s header for what it can and cannot hold.

## 1 · Read in this order

1. **`CLAUDE.md`** — non-optional. Two conventions that will surprise you
   (the spec layer's global scope; four non-interchangeable test runners)
   and a list of things that look like bugs and are not.
2. **This page** — to find the one document your task belongs to.
3. **That document**, plus the decision records it leans on
   (`docs/DECISIONS-INDEX.md` to find them).

Then, before writing: `npm run check:globals && npm run test:unit`. A
green tree is the starting state, and §5 is what holds it.

## 2 · The app in one paragraph

There is **one write**. Answering anything — the daily question, a feed
card, a test item, a Learn card, a duel — appends one answer document
carrying a *snapshot* of the profile anchors it was written under. A
Firestore trigger folds that snapshot into per-cohort counts and
publishes them exactly, from the first answer. Every surface in the app
is a different cut of that one fold: the daily's split, the Map, the four
core tests, the Mirror's seven stops. Nothing is a separate feature with
a separate store, and the anchors snapshot is the join that lets a cohort
be named without the server ever reading a second user's document.

The diagram of that path, with what reads each hop, is
[`MIRROR.md`](MIRROR.md) §1 — it is not redrawn here, because two copies
of one diagram is how one of them goes wrong. [`SCHEMA-V2.md`](SCHEMA-V2.md)
is what gets written; [`data-inventory.md`](data-inventory.md) is who may
read it; [`MIRROR.md`](MIRROR.md) is what it becomes on screen.

Two properties to hold in mind before touching anything, both binding and
both enforced rather than promised:

- **Answers are public** (D98). Any signed-in user may read any other
  user's answers and profile; counts are exact from the first answer.
  Three things stay closed, none of them answers: the unscored logic
  answer key, flag authorship, and the presence cell. If the UI says
  something about who can see what, `firestore.rules` or a Cloud Function
  has to make it true and a test has to prove it.
- **No fake anything** (D1). Where a live surface shows nothing, the data
  is absent — never withheld, never seeded.

## 3 · Where the code is

| Path | What is there | Read first |
| --- | --- | --- |
| `src/v2/spec/` | The JSX ported verbatim from the frozen prototype — the largest layer here. Shared-global scope, order-sensitive, shrinking under a ratchet. `mirror-*.jsx` and `map-*.js*` are the Mirror tab | `src/v2/README.md`, then `CLAUDE.md` §1 |
| `src/v2/spec-index.js` | Imports every spec module for side effects. **The order is semantic.** Also exports the two lazy groups (`loadWorldFeed`, `loadOverlays`) | `src/v2/README.md` |
| `src/v2/data/` | The typed client layer — `live.ts` publishes `window.LIVE`; `cohort.ts`, `similarity.ts` and `compare.ts` are the Mirror's folds; the rest is pure, tested logic | `docs/MIRROR.md` §6 |
| `src/v2/ui/` | The hand-written TSX panels — the live Mirror bodies, the duel, privacy, city and search panels. One test suite each, mutation-checked | `src/v2/README.md` § Panel tests |
| `src/v2/test/` | The mount smoke tests over `src/v2/test/mount-app.jsx`. The only gate that renders the whole app — the spec layer's other three are all name-level | `src/v2/README.md` § Mount tests |
| `src/v2/styles.css` | The design system, verbatim from the spec | — |
| `src/v2/main.jsx` | Styles + spec-index, then renders `globalThis.App` | `src/v2/README.md` |
| `src/lib/` | Firebase init, anonymous-first auth, emulator wiring, Sentry | `docs/LOCAL-TESTING.md` |
| `functions/src/` | `v2.ts` (seed + aggregates) · `v2social.ts` (groups, duos, reveals, push) · `moderation.ts` · `index.ts` (account deletion) · `ops.ts` (**where `setGlobalOptions` lives**) · `pure.ts` (the fold arithmetic) | `functions/README.md`, `docs/SCHEMA-V2.md` |
| `firestore.rules` | The access model. `firestore.rules.v1-archive` is the retired v1 client's rules — reference, NOT deployed | `docs/data-inventory.md` |
| `firestore-tests/` | Rules tests and the three e2e suites against emulated functions | `firestore-tests/README.md` |
| `content/` | The canonical question banks and archetypes — the seed source | `content/README.md`, `docs/QUESTION-FARM.md` |
| `scripts/` | Every gate and every catalogue builder. Each opens with why it exists, and several with what they caught | the script's own header |
| `monitoring/` | Cloud Monitoring policies, applied by hand rather than by the pipeline, plus the pulse console's rate card | `docs/MONITORING.md` |
| `web/privacy.html` | The one place the long privacy disclosure lives (D183). `check:policy-claims` holds it to the app | `docs/COPY.md` §3 |
| `design/` | The frozen design spec — read-only reference. `design/README.md` maps it; the standalone revisions are the prototype's own history | `design/README.md` |
| `.github/workflows/` | `backend-checks.yml` is called by **both** `ci.yml` and `firebase-deploy.yml`, so what guards a PR guards production | `docs/DEPLOYMENT.md` |

## 4 · The documents

**Status** is the column to read first: `tree` describes the app as it
exists, `plan` is proposed and **not built** — do not read it as a
description — `mixed` is partly built and says which half, and `past` is
kept for its method or its record while its conclusion has moved. Four of
these files declare "plan only" or "plan notes" in their own opening
lines, and `check:docs` holds this column to that declaration in both
directions.

| Document | What it answers | Status |
| --- | --- | --- |
| [`DECISIONS.md`](DECISIONS.md) | Every binding decision, with the arithmetic that produced it. Binding until an explicitly recorded reversal | tree |
| [`DECISIONS-INDEX.md`](DECISIONS-INDEX.md) | Generated index of the above — one line per record instead of the whole file | tree |
| [`MIRROR.md`](MIRROR.md) | The read path: which Mirror stop draws what, from where, and which parts are still prototype furniture | tree |
| [`SCHEMA-V2.md`](SCHEMA-V2.md) | Every collection, field and function in the core loop | tree |
| [`data-inventory.md`](data-inventory.md) | Everything storable, where it lives, who may read it. The store privacy label derives from this | tree |
| [`COPY.md`](COPY.md) | `visual > word > sentence > sentences`, the four shapes that keep growing back, and what the rule does **not** license | tree |
| [`LOCAL-TESTING.md`](LOCAL-TESTING.md) | Mock mode and live mode, one command each. Includes the sandbox `HTTPS_PROXY` failure | tree |
| [`DEPLOYMENT.md`](DEPLOYMENT.md) | How rules and functions reach production, and how the pipeline is wired | tree |
| [`MONITORING.md`](MONITORING.md) | What is watched, what is refused, and the pulse console | tree |
| [`MODERATION.md`](MODERATION.md) | Flagged takes, the scheduled reviewer, confinement. Enforcing since D83 | tree |
| [`CATALOG-QUESTIONS.md`](CATALOG-QUESTIONS.md) | "Favourite X" with a thousand options — how catalogue answers are keyed and validated | tree |
| [`QUESTION-FARM.md`](QUESTION-FARM.md) | The instruction manual for the scheduled autonomous runs that deepen the archive. **If you are one of those runs, this is your brief** | tree |
| [`RANK-CATALOG-LIVE.md`](RANK-CATALOG-LIVE.md) | The path back for the two once-withheld feed forms — catalogue picks (D232) and rank (D233), both shipped; kept for the plans' arguments and as-built deviations | tree |
| [`COSTS.md`](COSTS.md) | The bill at five sizes, as a prediction with its inputs written down. Reproduce with `npm run costs` | tree |
| [`FIRESTORE-REGION.md`](FIRESTORE-REGION.md) | The one cost decision with a deadline, and the one that cannot be revisited | tree |
| [`SHIP-CHECKLIST.md`](SHIP-CHECKLIST.md) | The reasoning for every remaining human step to the App Store. Canonical | tree |
| [`LAUNCH-RUNBOOK.md`](LAUNCH-RUNBOOK.md) | The same work as an ordered to-do list. Holds order and status | tree |
| [`IOS-RELEASE.md`](IOS-RELEASE.md) | Producing a signed archive without a Mac | tree |
| [`STORE-FORMS.md`](STORE-FORMS.md) | Apple's privacy and age-rating questionnaires, answered field by field | tree |
| [`SCALE-PLAN.md`](SCALE-PLAN.md) | What an unbounded feed costs, what trips first, and the core/tail split it forces. §1's classification is built; the rest is not | mixed |
| [`SCALE-RUNBOOK.md`](SCALE-RUNBOOK.md) | The same work as an ordered build list — open steps only | plan |
| [`FEATURE-COMPLETE.md`](FEATURE-COMPLETE.md) | Everything open between here and feature-complete — algorithms, question production, scale work, flips — one line each, pointing at the file that owns it | plan |
| [`COST-REDUCTION.md`](COST-REDUCTION.md) | Getting the bill down. The big one was built at D129; the rest is analysis | mixed |
| [`DEVICE-BIND.md`](DEVICE-BIND.md) | D29's activation gate: what ships, what you add, how to flip it on. Rules requirement is shipped **soft** | mixed |
| [`VISION-V28.md`](VISION-V28.md) | The v28 design. Its third tab was adopted on trial (D166 §1), built, unmounted for the v1 release (D217) and is back on a data gate (D265) — the row's own §0 table carries each item's verdict | plan |
| [`PEOPLE-MAP.md`](PEOPLE-MAP.md) | The patterns Map transposed: people placed by their answers. The People lens shipped at D214; the plane switch and whole-world variant stay deferred with their arithmetic | mixed |
| [`NEXT-FUNCTIONALITY.md`](NEXT-FUNCTIONALITY.md) | Six ideas measured against the architecture. Plan notes, not decisions | plan |
| [`AXES-PLAN.md`](AXES-PLAN.md) | The owner's axis frame: every source the app measures as one family, the genetic and body axes it does not have yet, and where their doors go. Nothing new is built | plan |
| [`ATTENTION.md`](ATTENTION.md) | "Does anyone like this, and what is this person into." No code exists | plan |
| [`ENGAGEMENT-PLAN.md`](ENGAGEMENT-PLAN.md) | The 2026-08-23 ask — measure what engages and what bores — against the standing analytics refusals: the two-channel design and the record each rung reverses. Rung 0 (the digest) is built at D268; rungs 1–2 are not | mixed |
| [`ENGAGEMENT-RUNBOOK.md`](ENGAGEMENT-RUNBOOK.md) | The same work as an ordered build list — phases per rung, sizes, and the gate that proves each step | plan |
| [`TAGS-PLAN.md`](TAGS-PLAN.md) | Questions carry several topics through one `also` field, and the demand lanes read them without becoming buyable or gameable. Built at D206; §4's tier-2 reading waits on D163 | mixed |
| [`FORESIGHT-CALLS.md`](FORESIGHT-CALLS.md) | The half of Foresight that asserts a fact. Tier A built and retired in service (D194→D196); tier B is the live question | mixed |
| [`EVENT-DISCUSSIONS.md`](EVENT-DISCUSSIONS.md) | Recent events as feed cards, each with a discussion window. The rework of the parked prediction slot; no code exists | plan |
| [`MONETIZATION.md`](MONETIZATION.md) | The revenue paths in one place. Path 2's machinery is built and unsold (D195); the rest is still plan | mixed |
| [`PAID-PLAN.md`](PAID-PLAN.md) | Paid questions with downloadable reports, place-score subscriptions, and cohort pricing by size and demand — the owner's 2026-08-21 ask measured against the standing constraints. §3's edit-flow matrix (D226), §4's logic cut (D227) and §2's report builder (D251) are built; the rest waits on demand evidence | mixed |
| [`COST-COMPARISON.md`](COST-COMPARISON.md) | InSight's bill against other apps'. Superseded in its conclusion by D129, kept for its method | past |
| [`LAUNCH-PLAN.md`](LAUNCH-PLAN.md) | What was built for launch and why. The human chain moved to `LAUNCH-RUNBOOK.md` | past |

And the READMEs, which are documentation of their own directory rather
than of a subject:

| README | What it covers |
| --- | --- |
| `README.md` | The product, top to bottom: what it is, how to run it, the repo map, the gates |
| `src/v2/README.md` | The port, the two lazy groups, the lint and a11y debt, the mount tests, and the migration procedure off the global bridge. **The longest and most load-bearing of these** |
| `functions/README.md` | The backend's own layout and conventions |
| `firestore-tests/README.md` | How the rules and e2e suites are structured and run |
| `content/README.md` | The question bank formats and how content reaches the seed |
| `design/README.md` | The frozen prototype and its revisions |

## 5 · The gates

Four test runners, **not interchangeable** — the table is in `CLAUDE.md`
§2, with what each covers and what it needs. Below is everything else:
the static gates, and where each one runs.

**Where** is computed from the workflows, not from this prose, and
`check:docs` fails if a row disagrees with them:

- `deploy` — on `backend-checks.yml`, which `ci.yml` and
  `firebase-deploy.yml` both call. Guards a PR *and* production.
- `ci` — on `ci.yml`'s own jobs. Pull requests only. Client- and
  docs-only checks belong here **deliberately**: nothing they say bears
  on whether a rules fix is safe to deploy, and none of them may be able
  to block an emergency one.
- `release` — on a platform-release or store-metadata workflow.
- `manual` — run by a human, at the moment it applies.

| Gate | Where | What it guards |
| --- | --- | --- |
| `check:appcheck` | deploy | Every callable demands App Check attestation or is named with the reason it cannot (D36). Omitting it is silent: the function builds, deploys, passes every test, and serves any caller on the internet |
| `check:fn-runtime` | deploy | Function memory and timeout, that `setGlobalOptions` lives in `functions/src/ops.ts` where the hoisted re-export cannot miss it, that every trigger watches the database `firebase.json` deploys to (D165), and that the client calls the region the functions are served from — naming it once, never as a literal at a call site (D200, D201) |
| `check:deploy-targets` | deploy | Every exported function appears in the deploy `--only` list. One missing name builds, tests green, and never deploys |
| `check:content` | deploy | The compiled content matches `content/`, byte for byte, plus the invariants the seed path assumes |
| `check:anchors` | deploy | The profile's `<select>` vocabularies and the trigger's `BREAKDOWN_DIM_VOCAB` hold the same strings, or a level stops counting silently |
| `check:catalogs` | deploy | The committed catalogues and the trigger's compiled-in key sets agree exactly, absence included |
| `check:pokedex` | deploy | The Pokédex catalogue's contiguous keys — stored answers are dex numbers into it, so a gap is an answer resolving to the wrong species |
| `check:elements` | deploy | The same for the elements catalogue, keyed by atomic number |
| `check:logic-sync` | deploy | The logic generator's two byte-identical copies (client + functions, D57). Drift means the server scores forms the client never rendered |
| `check:calls` | deploy | The CALL rubric's two byte-identical copies (D194) **and** a dry run of every authored rubric — twice each, once shaped to come out true and once false. A rubric that can only resolve one way is not a prediction; a drifted copy makes the card contradict the grade it is printing |
| `check:globals` | ci | The spec layer's shared-global wiring: dangling references, files `spec-index.js` forgot, undefined JSX tags, publications nothing reads, and (**rule 4**) a ratchet on remaining coupling that may only go down |
| `check:docs` | ci | This page's maps, and that `DECISIONS-INDEX.md` is current |
| `check:figures` | ci | Counts quoted in prose, held equal to the tree. Exists because a figure kept current by intention does not stay current |
| `check:a11y` | ci | Accessibility, as a per-file ratchet, plus the four figures `src/v2/README.md` quotes about its own debt |
| `check:labels` | ci | Every `htmlFor` / `aria-*` reference resolves to an id in the same file. jsx-a11y only checks the attribute is present |
| `check:touch-zoom` | ci | No text field under 16px. One at 15px zooms the whole app on iOS and nothing zooms it back (D105) |
| `check:tap-targets` | ci | No button drawn under 44px without a grown hit box. `jsx-a11y` has no size rule, so `check:a11y` stayed green while every sheet's Close button was 26px |
| `check:panel-suites` | ci | One test suite per hand-written panel in `src/v2/ui/`, as a ratchet. The convention was written down and drifted to nine panels with none, including the on-trial tab's |
| `check:purge` | ci | Every store persisting `insight.*` state hears the local purge. Deleting the keys is half a wipe if the in-memory copy writes itself back |
| `check:bundle` | ci | Four ceilings, of which `MAX_EAGER_KB` is the one to quote for a first-paint claim. Refuses to grade a build not made as the shipping one, and withholds the total-JS ceiling when the Sentry DSN is unset (D191) |
| `check:versions` | ci | Five version numbers that must move together across three files |
| `check:monitoring` | ci | The alert chain from the log line a function emits to the policy that reads it. Every link fails the same silent way |
| `check:data-inventory` | ci | Every collection the rules reach is named in `docs/data-inventory.md` (D130), and — where a read rule is literally `request.auth != null` or `false` — that the row's reader column agrees with it (D257) |
| `check:policy-claims` | ci | A live promise that **vanishes** from `web/privacy.html` — since D183 a claim deleted there is a claim deleted from the product |
| `check:public-copy` | ci | The retired pre-D98 privacy vocabulary **reappearing** in copy a user reads |
| `check:store-forms` | ci | The privacy nutrition label, which exists twice on purpose, agreeing with itself |
| `check:quality` | ci | Question form and provenance (D97), the place-scope tripwire, and the id/bank headroom |
| `check:neighbors` | ci | Near-duplicate questions across the banks (D63) |
| `check:cities` | ci | The city catalogue's rows and name lengths — a malformed one is pickable and then absent from every breakdown |
| `check:ios-spm` | ci | The npm alias that keeps the iOS SwiftPM graph resolvable |
| `check:ios-facebook` | ci | That the postinstall actually stripped the Facebook SDK a transitive SPM manifest links in (D16) |
| `check:ios-location` | ci | The iOS location declarations against what the app does. ITMS-90683 is why it exists |
| `check:web-firebase` | release | That the shipped bundle actually carries the Firebase config |
| `check:store-listing` | release | Marketing copy against both consoles' length limits |
| `check:store-copy` | manual | No unfilled placeholders in the store-facing legal pages. A pre-submission gate, and off CI on purpose |

## 6 · Finding the decision that governs something

Decisions are cited by number everywhere, and the number is the only
handle — so start from [`DECISIONS-INDEX.md`](DECISIONS-INDEX.md), which
is one line per record with a link and a line number.

**Read the newest citer before trusting a record.** The index's *Cited
later by* column is there for one failure that has already happened: this
repo's own `README.md` described the Mirror per **D9** ("Near *is* your
city") after **D111** reversed it, 102 records below — still there when
this page was written. A record with a much newer citer is one to read
from the bottom up.

The column is citations, not reversals. Supersession is marked three
inconsistent ways in that file, so the index does not claim to detect it;
what it can say is where to look next.

Two more things about `DECISIONS.md` worth knowing before you use it:

- **Its arithmetic is a snapshot, deliberately.** A figure in a decision
  record is the state at the moment the decision was taken, so one going
  "stale" is the record working. This is why `check:figures` covers live
  documentation and explicitly not that file.
- **A record whose Status line says *Proposed* binds nothing.** Adoption
  is an explicit act by the owner, not a side effect of the text
  existing.

## 7 · The traps, and where they are written down

Not repeated here — each is one line and a pointer, because the reasoning
belongs with the code it is about:

- The spec layer talks through **global scope**, and `spec-index.js`'s
  order is semantic → `CLAUDE.md` §1, `src/v2/README.md`.
- A conversion off that bridge removes the load-order condition, **never
  the data one**, and should be expected to *raise* the lint-suppression
  count before it lowers it → `src/v2/README.md` § Migration path.
- `setGlobalOptions` belongs in `functions/src/ops.ts`, not `index.ts` →
  `CLAUDE.md` § Things that look like bugs but are not.
- Answers are create-only with **one** update shape (D86) → same section.
- `window.MapStats` returns **null** for five anchors on purpose (D72) →
  same section.
- The e2e suites in a sandbox need `HTTPS_PROXY` **unset**, not a wider
  egress allowlist → `docs/LOCAL-TESTING.md` § Sandbox/CI note.
- A root `npm install` leaves the backend's `node_modules` empty, and the
  functions suite then fails as a missing *package* rather than as a
  missing install → `docs/LOCAL-TESTING.md` § Test suites.
- A live Mirror stop carries five lenses and its constellation, and which
  stop gets which is structural → `docs/MIRROR.md` §3.
- The feed is finite *today* and the owner has decided it should not stay
  that way; a question is in the Mirror's corpus only if it declares
  `core` → `docs/SCALE-PLAN.md` §1.

And the house rule that produced most of this page: **verify rather than
assume, and say which it was.** Several bugs here were found by running a
probe instead of reasoning about it.
