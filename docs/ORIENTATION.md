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
   (the spec layer's global scope; five non-interchangeable test runners)
   and a list of things that look like bugs and are not.
2. **This page** — to find the one document your task belongs to.
3. **That document**, plus the decision records it leans on
   (`docs/DECISIONS-INDEX.md` to find them).

Then, before writing: `npm run check:globals && npm run test:unit`. A
green tree is the starting state, and §5 is what holds it.

## 2 · The app in one paragraph

**What it is for:** connecting data and drawing the connections where
they can be read — one answer against another, you against every
population you belong to. The mechanism below serves that; `CLAUDE.md`'s
opening is canonical for it (D334).

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

Three properties to hold in mind before touching anything. The first two
are binding and enforced rather than promised; the third is a rule about
who decides:

- **Answers are public** (D98). Any signed-in user may read any other
  user's answers and profile; counts are exact from the first answer.
  Three things stay closed, none of them answers: the unscored logic
  answer key, flag authorship, and the presence cell. If the UI says
  something about who can see what, `firestore.rules` or a Cloud Function
  has to make it true and a test has to prove it.
- **No fake anything** (D1). Where a live surface shows nothing, the data
  is absent — never withheld, never seeded.
- **A privacy constraint is an ask, not a stop** (D334). Where a privacy
  argument is the only thing stopping something, it goes to the owner
  with the arithmetic rather than being settled in the tree — in either
  direction. `CLAUDE.md`'s privacy section has the four things that are
  outside the ask, and what to bring.

## 3 · Where the code is

| Path | What is there | Read first |
| --- | --- | --- |
| `src/v2/spec/` | The JSX ported verbatim from the frozen prototype — the largest layer here. Shared-global scope, order-sensitive, shrinking under a ratchet. `mirror-*.jsx` and `map-*.js*` are the Mirror tab | `src/v2/README.md`, then `CLAUDE.md` §1 |
| `src/v2/spec-index.js` | Imports every spec module for side effects. **The order is semantic.** Also exports the FOUR lazy groups (`loadWorldFeed`, `loadMapTab`, `loadMirrorTab`, `loadOverlays`) — the Map's since v28 §5 and the Mirror's since D355, each naming one module whose own static imports carry the rest | `src/v2/README.md` |
| `src/v2/data/` | The typed client layer — `live.ts` publishes `window.LIVE`; `cohort.ts`, `similarity.ts` and `compare.ts` are the Mirror's folds; the rest is pure, tested logic | `docs/MIRROR.md` §6 |
| `src/v2/ui/` | The hand-written TSX panels — the live Mirror bodies, the duel, privacy, city and search panels. One test suite each, mutation-checked | `src/v2/README.md` § Panel tests |
| `src/v2/test/` | The mount smoke tests over `src/v2/test/mount-app.jsx`. The only gate that renders the whole app — the spec layer's other three are all name-level | `src/v2/README.md` § Mount tests |
| `src/v2/styles.css` | The design system, verbatim from the spec | — |
| `src/v2/main.jsx` | Styles + spec-index, then renders the imported `App` inside `SignInGate`; the `globalThis.App` publication survives for the mount suites alone (D354) | `src/v2/README.md` |
| `src/lib/` | Firebase init, anonymous-first auth, emulator wiring, Sentry | `docs/LOCAL-TESTING.md` |
| `src/dev/` | `TweaksPanel.jsx`, the host-era design-time panel. Behind `import.meta.env.DEV` and a dynamic import, so a production build has no reference to this directory at all and rolldown drops it whole (D223) | `src/v2/README.md` |
| `functions/src/` | `v2.ts` (seed + aggregates) · `v2social.ts` (groups, duos, reveals, push) · `moderation.ts` · `index.ts` (account deletion) · `exportAccount.ts` (its read-only twin, the data export — D443) · `ops.ts` (**where `setGlobalOptions` lives**) · `pure.ts` (the fold arithmetic) | `functions/README.md`, `docs/SCHEMA-V2.md` |
| `firestore.rules` | The access model. `firestore.rules.v1-archive` is the retired v1 client's rules — reference, NOT deployed | `docs/data-inventory.md` |
| `firestore-tests/` | Rules tests and the three e2e suites against emulated functions | `firestore-tests/README.md` |
| `content/` | The canonical question banks and archetypes — the seed source | `content/README.md`, `docs/QUESTION-FARM.md` |
| `public/` | What Vite serves from the bundle root: the catalogue files answers are keyed into (`public/cities.txt`, `public/pokedex.txt`, `public/elements.txt` and the rest) and the webfonts. Fetched through `BASE_URL` rather than an absolute path — the Capacitor shells serve from a local file root, where a leading slash resolves off the device | `docs/CATALOG-QUESTIONS.md` |
| `scripts/` | Four kinds of file, and the difference matters before you run one: the **gates** (`check-*`, every one of them in §5), the **builders** that regenerate committed artifacts (`build-*`, `gen-*`), the **instruments** that only read and print (cost, pulse, the budget models), and the **operator tools that act on live services** — seeding, aggregate rebuilds, App Store Connect, monitoring policies, test users — and one **prover**, `mutate.mjs`, which plants a deliberate defect in a source file, runs that file's own suite, and reports whether the suite noticed (its first run found a live gap in `typeMix.test.ts`). It is not a `check:*` gate on purpose: it costs minutes and a survivor is a finding to read, not a reason to block a merge, so it runs nightly from `.github/workflows/mutate.yml`. Each script opens with why it exists, and several with what they caught | the script's own header |
| `bigquery/` | The answer log's table schema (`answers.schema.json`, D447 phase A) — one row per ledger entry, the file `functions/src/log.ts`'s row is held to and `scripts/apply-bigquery.mjs` creates the table from; the dataset itself is a click, not a file |
| `monitoring/` | Cloud Monitoring policies, applied by hand rather than by the pipeline, the pulse console's rate card and trail, and the program console's trail (`monitoring/console-trail.jsonl`, one row a day from `console.yml` — D352) | `docs/MONITORING.md` |
| `web/` | The Firebase Hosting root (`firebase.json` → `hosting.public`) — the marketing home, the `/join/**` link target, terms, and `web/.well-known/` for the two app-link association files. **Not the app**: the app is what Vite builds out of `index.html` | `docs/DEPLOYMENT.md` |
| `web/privacy.html` | The one place the long privacy disclosure lives (D183). `check:policy-claims` holds it to the app | `docs/COPY.md` §3 |
| `web/catalog-art/` | The pick tiles' pictures (D421) — one directory per catalogue domain, written only by `scripts/build-catalog-art.mjs`: thumbnails named by catalogue key, and a `credits.tsv` the app's *Image credits* sheet draws. Hosting content, not the app, which is what makes a takedown a commit: `--remove <key>` and the merge deploys. Empty until an operator with network runs the builder | `web/catalog-art/README.md`, then `docs/CATALOG-QUESTIONS.md` § Entity images |
| `android/` · `ios/` | The Capacitor shells, committed so the apps build from a clean clone. `npx cap sync` copies the Vite build in; everything the toolchains generate on top is gitignored | `docs/IOS-RELEASE.md` |
| `design/` | Two different things under one name. The **standalone revisions** are the frozen prototype and its history — read-only reference, and what "do not edit design/" is about. `design/icon/` and `design/store/` are the opposite: live SOURCES that builders rasterise and gates read, and that `asc:push` sends to App Store Connect. A dated directory beside them is an ACCEPTED CANVAS extracted from Claude Design (the `designed` step of `VISUAL-REQUESTS.md`) — the artboards the owner approved, kept because the canvas itself is ephemeral; `design/map-ring-2026-09-11/README.md` is the Map ring's (D464) | `design/README.md`, `design/map-ring-2026-09-11/README.md` |
| `.github/workflows/` | `backend-checks.yml` is called by **both** `ci.yml` and `firebase-deploy.yml`, so what guards a PR guards production | `docs/DEPLOYMENT.md` |
| `.github/scripts/` | `report_audit_issue.py` — the weekly dependency audit's issue writer. A file rather than an inline `run:` block, and hand-written rather than a third-party action: the workflow whose subject is supply-chain hygiene adds no SHA of its own to pin | `.github/workflows/security-audit.yml` |
| `.github/device-screens/` | What `device-screens.yml` needs beside itself: the Maestro flow that walks the iOS simulator (`ios-flow.yaml`) and the publisher both platform jobs share (`publish.sh`), which hands the captures back as one orphan commit on a `screens/*` ref — git, because the night shifts have git and no API (D404) | `.github/workflows/device-screens.yml` |
| `.claude/` | Committed Claude Code project settings: the permission allowlist that keeps the autonomous lanes' sessions from stalling on prompts. Hardening is by omission — no merge tools, no API file writes, no trigger mutation, and no `deny` list, because the file reaches every session in the repo | `docs/AXES-RUNBOOK.md` § the permission paragraph |

## 4 · The documents

**Status** is the column to read first: `tree` describes the app as it
exists, `mixed` is partly built and says which half, `past` is kept for
its method or its record while its conclusion has moved, and `plan` means
**read that page's own Status line before you read its body**. `plan`
used to be glossed as "proposed and not built", and that gloss is now
narrower than the column: `check:docs` rule 7 pins this cell to `plan` for
every page whose own opening lines still call itself a plan, and several
of those were built and kept as the reasoning behind what shipped
(ROUNDS-PLAN, RULES-BUDGET-PLAN, SPONSORED-PLAN and VISION-2026-09-09 are
all built, all still declared plans by their own heads). The rule holds
this column to that declaration in both directions — which is why the
number of such files is not written here: it was "Four" while the gate's
own regex found sixteen.

| Document | What it answers | Status |
| --- | --- | --- |
| [`DECISIONS.md`](DECISIONS.md) | Every binding decision, with the arithmetic that produced it. Binding until an explicitly recorded reversal | tree |
| [`DECISIONS-INDEX.md`](DECISIONS-INDEX.md) | Generated index of the above — one line per record instead of the whole file | tree |
| [`STATE.md`](STATE.md) | Generated — where the project is on one page: the two bills side by side, answers counted, what waits on a person, what is watching. Every figure read from the tree at generation time (`npm run build:state`) | tree |
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
| [`DOC-SWEEP.md`](DOC-SWEEP.md) | The doc sweep lane's contract: what an unattended run may edit versus what it may only report, the three detectors over the commit range, the backlog rotation, and the run log's state block. The subject is the sentence no gate can read — every gate here proves the map's structure, none proves a claim is true | tree |
| [`ROUTINES.md`](ROUTINES.md) | Every scheduled Routine, across all three subscriptions — who owns it, when it fires, which branch it writes and who may merge it. The index over the three per-program inventories, plus the shared clock and branch namespaces none of them can see | tree |
| [`RANK-CATALOG-LIVE.md`](RANK-CATALOG-LIVE.md) | The path back for the two once-withheld feed forms — catalogue picks (D232) and rank (D233), both shipped; kept for the plans' arguments and as-built deviations | tree |
| [`COSTS.md`](COSTS.md) | The bill at five sizes, as a prediction with its inputs written down. Reproduce with `npm run costs` | tree |
| [`FIRESTORE-REGION.md`](FIRESTORE-REGION.md) | The one cost decision with a deadline, and the one that cannot be revisited | tree |
| [`SHIP-CHECKLIST.md`](SHIP-CHECKLIST.md) | The reasoning for every remaining human step to the App Store. Canonical | tree |
| [`LAUNCH-RUNBOOK.md`](LAUNCH-RUNBOOK.md) | The same work as an ordered to-do list. Holds order and status | tree |
| [`IOS-RELEASE.md`](IOS-RELEASE.md) | Producing a signed archive without a Mac | tree |
| [`PLAY-RELEASE.md`](PLAY-RELEASE.md) | What a Play release would take, assessed while it is parked (D42): four code gaps, one missing web page, three owner decisions | mixed |
| [`STORE-FORMS.md`](STORE-FORMS.md) | Apple's privacy and age-rating questionnaires, answered field by field | tree |
| [`SCALE-PLAN.md`](SCALE-PLAN.md) | What an unbounded feed costs, what trips first, and the core/tail split it forces. §1's classification is built; the rest is not | mixed |
| [`SCALE-RUNBOOK.md`](SCALE-RUNBOOK.md) | The same work as an ordered build list — open steps only | plan |
| [`RULES-BUDGET-PLAN.md`](RULES-BUDGET-PLAN.md) | The 1,000-expression ceiling `firestore.rules` is already crossing on every answer refusal (D431): where the expressions go, an instrument to attribute them per clause before anything moves, a four-move restructure with identical verdicts, a live ratchet gate, and the per-surface split priced as the fallback. Phases 0–2 are built and measured (D432, D433): a filler costs ~8 units not 3, the thinnest legal create clears by ~470, refusals by budget went 13 → 0; Phase 3's gate is built and chained into `test:rules` (D438: every probe pinned at its measured headroom, a floor of 50 fillers, a denial by budget a red test); Phase 4's split stays priced and untaken | plan |
| [`CAST-ROLLOUT-PLAN.md`](CAST-ROLLOUT-PLAN.md) | Bringing production's 1v1 and group questions onto the 2026-09-09 design: the three copies of a duel question (bank, Firestore, phone) and why they disagree tonight, eight steps in an order that never refuses a real player twice, the read-only audit that measures the gap and the one `--apply` that closes it, costs and rollback per step | plan |
| [`BANK-DELIVERY.md`](BANK-DELIVERY.md) | How many questions a device can be handed: the bundle, the cache store, the whole-bank fetch — three ceilings, measured, in the order they bite. §2 built at D284, §3 at D312, §4 at D320/D321 (learn, then the feed tail), and the daily's positional fetch at D383 — the file's own Status line is the authority and said so while this row still read "§4 remains" | mixed |
| [`ANSWER-SCALE.md`](ANSWER-SCALE.md) | The answers-side twin: the client caches that grow with every answered question (instrumented and moved to IndexedDB at D312), a life's archive on one device, and the daily's write wall with its post-D98 sharding shape re-derived, shelved on the alert | mixed |
| [`FEATURE-COMPLETE.md`](FEATURE-COMPLETE.md) | Everything open between here and feature-complete — algorithms, question production, scale work, flips — one line each, pointing at the file that owns it | plan |
| [`COST-REDUCTION.md`](COST-REDUCTION.md) | Getting the bill down. The big one was built at D129; the rest is analysis | mixed |
| [`DEVICE-BIND.md`](DEVICE-BIND.md) | D29's activation gate: what ships, what you add, how to flip it on. Rules requirement is shipped **soft** | mixed |
| [`VISION-V28.md`](VISION-V28.md) | The v28 design. Its third tab was adopted on trial (D166 §1), built, unmounted for the v1 release (D217) and is back on a data gate (D265) — the row's own §0 table carries each item's verdict | plan |
| [`VISION-2026-08-24.md`](VISION-2026-08-24.md) | The 2026-08-24 design measured against the tree. The visual passes are built (D287); the remainder is decided (D288 — the board retires, honest crowd labels, the paid mechanism builds ahead of demand) and sequenced in its own §9 runbook: purchase records → the buyer's room → the committed rate card → the door, with the scorecard crowds and the groups "so what" fold alongside. Source extracted to `design/standalone-2026-08-24/` | mixed |
| [`VISION-2026-08-26.md`](VISION-2026-08-26.md) | The 2026-08-26 design measured against the tree. The client passes are built (D310 — the Oracle's "working", the Patterns polish, Play together, the feed's participation pass, and a still-render crash fix); the two big halves still wait on their owner decisions: anonymous answers + private results (the first amendment D98 would notice) and the co-funded seats / catalog window. Source extracted to `design/standalone-2026-08-26/` | mixed |
| [`VISION-2026-09-02.md`](VISION-2026-09-02.md) | The 2026-09-02 design measured against the tree and BUILT (D361 + the six commits its §7 orders): one instrument for the three Patterns lenses (the Map redrawn as a ring, the Oracle in the field, the People lens coloured by agreement), the shell's swipe axis, a serif voice for every prompt, the split ballot, the topic-hued answer rows, the Crossroads tree and the paid door's rate rows. Only §4.2's catalog window waits, on VISION-2026-08-26 §2.2's owner decision. Source extracted to `design/standalone-2026-09-02/` — compiled JSX, the README says why | mixed |
| [`VISION-2026-09-06.md`](VISION-2026-09-06.md) | The 2026-09-06 design measured against the tree — the current vision (D390): ink on paper, a 12px microtype floor, the serif voice reaching further, the lens legends behind one ⓘ, the Patterns dial in the header — and, on the model side, the subscription seat split 08-26 §2.2 has waited on, drawn by the owner's own upload. All six §8 steps are BUILT (D391 steps 1–2, D392 steps 3–6 — the floor, the Patterns instrument, the dial, the feed's ground, the ballot row, the polish pass); its two owner rows stand open. Source extracted to `design/standalone-2026-09-06/` | mixed |
| [`VISION-2026-09-07.md`](VISION-2026-09-07.md) | The 2026-09-07 design measured against the tree — the current vision (D415): the Big Five's thirty facets and the compass's eighteen positions as a second level under the result cards, the first day of Circle and 1v1, the person overlay's record sections on paper — and, on the owner's ask, the plan for how the facets and positions get MEASURED: the item banks (the compass's 36 verbatim; the Big Five's 120 from IPIP-NEO, an owner row), the feed and the in-place flow (the D121 collision, an owner row), the fold and its floors, device-side storage, the suites that prove it. Nothing built; the compass's in-place questions wait on the owner. Source extracted to `design/standalone-2026-09-07/` | plan |
| [`VISION-2026-09-08.md`](VISION-2026-09-08.md) | The 2026-09-08 design measured against the tree — the current vision (D434): the group as a CAST. The owner's `InSight_12` upload, delivered with a ruling (*"they should be more like this … its worst for group as that should mostly be about what role you have in the group"*): role votes in five scenario packs with the members as the options, a rating of the group between two poles every fourth round, the crown and the contested pair, the run's marks, the Mirror's cast and scores, and the group instrument's fourth dim. Step 1 BUILT 2026-09-08 — the content model, the rotation, the card, the fold; steps 2–4 (the tables, the Mirror's cast and scores, the lane and the bank's bundle cap) sequenced with their gates; two owner calls (the room's call on a role vote, the older group questions). Source extracted to `design/standalone-2026-09-08/` | plan |
| [`VISION-2026-09-09.md`](VISION-2026-09-09.md) | **Built (D437, 2026-09-09): steps 1–6 on the owner's eight answers of the same day; the World round not taken (Q1: no).** The 2026-09-09 design measured against the tree — the current vision (D436): how 1v1s and Groups work now. The owner's `InSight_15` upload and brief: the 1v1's rounds by kind with a cast round every fourth, seats on every role, no call, the run as a record, a 48-hour deadline, the Groups stop as Overview · Votes · People · Scores · Compare, the instrument as casts per axis and votes per seat, the person page's Together tab. §0 the table, §6 the eight questions to the owner (World rounds back in the 1v1, the clock, the call, the role changes, the floor), §7 the build order with what needs no answer first | plan |
| [`PEOPLE-MAP.md`](PEOPLE-MAP.md) | The patterns Map transposed: people placed by their answers. The People lens shipped at D214; the plane switch and whole-world variant stay deferred with their arithmetic | mixed |
| [`ALGORITHM-REFLECTION.md`](ALGORITHM-REFLECTION.md) | The Patterns engine, the aggregate fold, the store and the device solves measured against the tree, and what a rebuild would look like. §1 is a measurement: `npm run probe:fit` shows the nightly fit's loadings have not left their hash seeds under the app's create-only regime, and its guesses equal the marginal's. §§2–5 are the proposals with their arithmetic — a baseline on the scorecard, a per-person observation vector as the fit's substrate, a batch engine scored as a candidate before it replaces anything, the corpus widened past two options, nightly voter samples, the breakdown cube's overflow — ordered in §6. Built the same day on the owner's *"apply those"* and *"build the remaining steps too"*, as D394–D401, every step of §6; the table at its foot names the three that differ from their rows and why | tree |
| [`PATTERNS-PLAN.md`](PATTERNS-PLAN.md) | The three Patterns lenses widened — the owner's 2026-09-09 ask: catalogue picks on the Map, the Oracle reading the profile and the tests it never reads today, a fitted link and a meter that says skill, and the walls before they bind (the loadings document's index entries, the ring, the People map's overlap). Six steps in build order with what each costs and what proves it; what is the owner's is on `OWNER-LIST.md`, the one visual is request 13. Steps 1 to 5 are built (D457–D461: the cohort prior, anchors and catalogue picks as items, the slope and the meter and the schedule, the walls); step 0 is the owner's console read | mixed |
| [`ROLES-PLAN.md`](ROLES-PLAN.md) | The 1v1 and group profile measured — the role matcher probed on simulated records (`scripts/roles-probe.mjs`): a fortnight cannot hold a name, the group instrument is one axis wearing three — and redesigned: the pair's reading and your role across pairs as two instruments, a group instrument over four dims that are four, every rate scaled so 50 is luck, a per-member ledger the reveal writes, the 1v1 questions' domain tag carried into the seed, the cast drawn. §5's steps 1–2 are built (D386: the tag in the seed, the fold scored against luck with mirror days apart, the guess on group days); the tables, the ledger and the cast wait on `OWNER-LIST.md`, and the screens are requests 5 and 6 | plan |
| [`ROUNDS-PLAN.md`](ROUNDS-PLAN.md) | 1v1 and group play without the calendar — the follow-through on D419 §5's recorded intention, directed by the owner 2026-09-08. The day is not the seal (two rules clauses are, and neither reads a clock); it is what advances the game when nobody plays, so a ROUND replaces it: a 1v1 reveals on the second answer, a group when all have played or at a deadline, and a late answer is flagged by the rules and scores nothing. Carries the lead-cap reflection (K = 5 recommended), the bank arithmetic that makes 32 questions one evening, world questions as duel content, and the measured bill — 1.35x at eight rounds a day. All eight steps BUILT 2026-09-08 — the round model, the reveal on the completing answer, the deadline scan, history by query, the late answer, the bank burst's regulator, the notifications, and the card from the owner's canvas — and the eighth, world questions as duel content, built and RETIRED the same evening on the owner's ruling (D426's third amendment; §6.2 stays as the record); §0a is the as-built delta, the card's departures from the canvas and the retirement included; the lane's daily cadence the owner re-paced the same day | plan |
| [`NEXT-FUNCTIONALITY.md`](NEXT-FUNCTIONALITY.md) | Six ideas measured against the architecture. Plan notes, not decisions | plan |
| [`AXES-PLAN.md`](AXES-PLAN.md) | The owner's axis frame: every source the app measures as one family, the genetic and body axes it does not have yet, and where their doors go. Nothing new is built | plan |
| [`AXES-RUNBOOK.md`](AXES-RUNBOOK.md) | The axes work as an ordered build list run by scheduled routines — the lanes, their canonical prompts, the learning loop, and the gate each step must pass. The lanes are live (D289); every build step is still open | mixed |
| [`AXIOM-THEORY.md`](AXIOM-THEORY.md) | The theory layer above the axes: twelve recurring lanes on an orphan branch — eleven writing each source's perfect form and their combination, one scoring that work every second night (D346) — and the bridge that is their only path into the product. Live since 2026-08-25 | tree |
| [`AXIOM-EVALUATION.md`](AXIOM-EVALUATION.md) | The theory layer measured rather than described — what ten days and $733 of lane time produced, the bridge queue that has not moved since 2026-08-27, the evidence ladder's single `measured` node, and six findings with the arithmetic to re-run each. Taken 2026-09-03 | tree |
| [`AXIOM-POTENTIAL.md`](AXIOM-POTENTIAL.md) | The potential half of Axiom Theory: what becomes knowable when the axes cross — the compounding map, ability genetics without the education proxy, the neurotype signature, and the loop where each axis lowers the cost of the next. Written 2026-09-03 because ten days of lanes produced constraints and no capability. Nothing here is built | plan |
| [`MEASUREMENT-NOTES.md`](MEASUREMENT-NOTES.md) | What the theory lanes actually produced, extracted 2026-09-03 on the owner's ruling that none of it is axiom theory: measurement method that should govern the app, negative results worth not re-deriving, engineering proposals for the system that exists, and findings about running machine-written work. Useful; not authority, and no gate reads it | tree |
| [`AXIOM-IDEAS.md`](AXIOM-IDEAS.md) | The 129 claims the theory lanes wrote, reduced to one line each and kept as a list to pick from on the owner's 2026-09-03 ruling. A ✦ marks the 34 that reason about an axis's perfect form. Reference only — never a base to extend, and no gate reads it | tree |
| [`OPS-RUNBOOK.md`](OPS-RUNBOOK.md) | The routines that keep the routine program honest — the platform probe, the roll call, the dependency shepherd, the production reader, the release recorder, the pulse responder — and the list worker that finishes `WORKLIST.md`. Contracts, models, canonical prompts and the wiring. Four of the seven Routines exist, all bound to the ops dispatcher; the inventory says which, and why nothing here merges (D385) | mixed |
| [`WORKLIST.md`](WORKLIST.md) | The owner's to-do queue the list worker finishes, one item per PR. Add a line under § Open, or open an issue labelled `worklist` | plan |
| [`PROGRAM-PLAN.md`](PROGRAM-PLAN.md) | The owner's 2026-09-02 ask — run the project from six lists and a console, across three subscriptions — restated against what runs today, one mechanism per list, the new lanes (the axiom builder, the merge shift, a to-do doer per account, the console), the rule every session reads, and the owner's answers (§10). Adopted at D352; the lists and the rule are built, the lanes and the console are not yet | mixed |
| [`PROGRAM-RUNBOOK.md`](PROGRAM-RUNBOOK.md) | The program plan as an ordered build list — the phases with their gates, the seed of each list, the contracts and canonical prompts for the axiom builder, the merge shift, the console and the to-do doers, what the owner creates on the other subscriptions, and the account-side inventory. Phases 1 and 2 are done (D352) and phase 3 all but one Routine; phases 4–6 are open | mixed |
| [`USAGE-REDUCTION.md`](USAGE-REDUCTION.md) | What the routine program spends against this account's usage limit, measured off the sessions' own usage blocks — the context-times-turns mechanism, the cuts taken on 2026-09-03, and the four only the owner can take. Not the Firebase bill; that is COST-REDUCTION.md | mixed |
| [`COST-HUNT.md`](COST-HUNT.md) | The cost hunt's contract: four Opus hunters a night — the device's reads, the server's writes, the data's shape, the bill against the model — each pushing a measured branch, and a Fable reviewer that reviews, adjusts and opens the PRs the owner merges. Designed 2026-09-06 (D403); the five Routines are the owner's to create in a web UI, and this row flips to *tree* when the register carries their ids | plan |
| [`COST-EXPOSURE.md`](COST-EXPOSURE.md) | Where an unexpected Firebase bill could come from, measured 2026-09-08 against production rather than the model: the invoiced dollar the model calls $0, the named database's missing free quota, the one unbounded exposure (direct Firestore reads until App Check is enforced) with its arithmetic, the bounded ones ranked, what already stands, and the ordered clicks and pull requests that close the gaps | mixed |
| [`DATA-EFFICIENCY.md`](DATA-EFFICIENCY.md) | The data structure priced per user-day once there are users, measured 2026-09-08: which documents each read term touches, the three D98 surfaces reading raw answer documents one by one at 74 % of every user's reads, the precomputed shapes that serve the same picture at about a hundredth of the cost, the write side and the daily's contention wall, what looks wasteful and is not, and the build order. Reproduce with `npm run costs:structure` | mixed |
| [`DATA-EFFICIENCY-RUNBOOK.md`](DATA-EFFICIENCY-RUNBOOK.md) | The same work as an ordered build list — six phases from the configuration-sized exemptions through the answer map, the folds that fail before they cost, and the sharded daily, each step with its files, its gate and its size; approved at D446 | plan |
| [`SCALE-ARCHITECTURE.md`](SCALE-ARCHITECTURE.md) | The log-first structure for hundreds of answers a day and millions of users, proposed 2026-09-09 (D447): where the shipped structure dies on the answer axis (the nightly pass's memory near 16,000 users at a hundred a day, the timestamp-index wall near 144,000), the target — batched answer writes, the log in BigQuery, live counters in Redis, a compactor writing the documents the app already reads, the night as SQL — priced beside the shipped one by `npm run costs:target`, what a user sees (the same, two cadences stated), the phases from here, and the owner's asks — adopted 2026-09-09 | plan |
| [`LOG-FIRST-RUNBOOK.md`](LOG-FIRST-RUNBOOK.md) | The log-first structure as an ordered build list — phase A (the ledger's mirror in BigQuery: the trigger's append, the nightly reconcile, the backfill, erasure) built 2026-09-09 with its two owner clicks, then the counters and the compactor, the batches, the night in SQL, the pages, and the ten-million items, each step with its gate and its size; adopted at D447's amendment | plan |
| [`MERGE-LIST.md`](MERGE-LIST.md) | What the automation built, and what the owner approved — every open PR and every branch without one, as rows the console workflow regenerates; the owner's tick is the approval the merge shift acts on (D352) | tree |
| [`PERMISSIONS.md`](PERMISSIONS.md) | Every permission, secret, install or setting that is limiting a routine — what was refused, what it blocks, the exact fix, and its status; the owner grants (D352) | tree |
| [`OWNER-LIST.md`](OWNER-LIST.md) | Only the owner can do these — decisions, clicks, designs, approvals, store and legal — folded daily by the console from their sources and appended by any lane (D352) | tree |
| [`AXIOMS.md`](AXIOMS.md) | The roster of axioms in three statuses — proposed, explored, operational — where the status word is the owner's edit and the axiom builder's licence for what it may build (D352) | tree |
| [`VISUAL-REQUESTS.md`](VISUAL-REQUESTS.md) | What needs a design before it is built — each request written so Claude Design understands it whole, from requested through drafted and designed to built (D352) | tree |
| [`VISUAL-VISION.md`](VISUAL-VISION.md) | The newest Claude Design output the tree is built toward, what it changed, which requests it closed, and the lineage — beside, never instead of, `design/README.md`'s style-diff reference (D352) | tree |
| [`ATTENTION.md`](ATTENTION.md) | "Does anyone like this, and what is this person into." No code exists | plan |
| [`ENGAGEMENT-PLAN.md`](ENGAGEMENT-PLAN.md) | The 2026-08-23 ask — measure what engages and what bores — against the standing analytics refusals: the two-channel design and the record each rung reverses. The adoptable ladder is built — rung 0 at D268, rung 1 at D270, its per-question map at D271, rung 2 at D272; what stays plan is what the plan refuses, §4.3's event-stream rung and everything §4.4 keeps out | mixed |
| [`ENGAGEMENT-RUNBOOK.md`](ENGAGEMENT-RUNBOOK.md) | The same work as an ordered build list — phases per rung, sizes, and the gate that proves each step | plan |
| [`TAGS-PLAN.md`](TAGS-PLAN.md) | Questions carry several topics through one `also` field, and the demand lanes read them without becoming buyable or gameable. Built at D206; §4's tier-2 reading waits on D163 | mixed |
| [`FORESIGHT-CALLS.md`](FORESIGHT-CALLS.md) | The half of Foresight that asserts a fact. Tier A built and retired in service (D194→D196); tier B is the live question | mixed |
| [`EVENT-DISCUSSIONS.md`](EVENT-DISCUSSIONS.md) | Recent events as feed cards, each with a discussion window. The rework of the parked prediction slot; no code exists | plan |
| [`MONETIZATION.md`](MONETIZATION.md) | The revenue paths in one place. Path 2's machinery is built and unsold (D195); the rest is still plan | mixed |
| [`PAID-PLAN.md`](PAID-PLAN.md) | Paid questions with downloadable reports, place-score subscriptions, and cohort pricing by size and demand — the owner's 2026-08-21 ask measured against the standing constraints. §3's edit-flow matrix (D226), §4's logic cut (D227) and §2's report builder (D251) are built; the rest waits on demand evidence | mixed |
| [`STORE-CUT-PLAN.md`](STORE-CUT-PLAN.md) | Where the paid door lives, so Apple and Google take no cut of it. **Shape A adopted 2026-09-05 (D368)**: the funnel leaves the binary, buying moves to a page under `web/`, the app keeps the results room. Taken before submission because both facts that make it cheap — zero sales, never reviewed — expire there | mixed |
| [`SIGNIN-PLAN.md`](SIGNIN-PLAN.md) | The account wall and its three doors — Apple, Google and email/password, all BUILT 2026-09-07 and adopted as D414, on the owner's decision that the app should require an account. Why D219's condition was not met, what Apple guideline 4.8 binds the moment the wall goes up, why address verification stopped being deferrable, and what each of the five steps actually cost | tree |
| [`SPONSORED-PLAN.md`](SPONSORED-PLAN.md) | The paid system remade around one product — the sponsored question with its own places in the feed, a menu price by reach with the per-answer refund as the guarantee, a shareable results page and one reviewed link after answering; the self-serve ad lane retired. Five steps, each sized as a PR, the three decisions it reverses named, and the owner's four calls listed; built in full on the owner's go — §2.1 (D375), §2.3 (D376), §2.2 (D377), §2.4 (D378) and §2.5 (D379); the page stays as the reasoning behind the five records | plan |
| [`COST-COMPARISON.md`](COST-COMPARISON.md) | InSight's bill against other apps'. Superseded in its conclusion by D129, kept for its method | past |
| [`LAUNCH-PLAN.md`](LAUNCH-PLAN.md) | What was built for launch and why. The human chain moved to `LAUNCH-RUNBOOK.md` | past |
| [`../SECURITY.md`](../SECURITY.md) | The security policy, at the repo root rather than in `docs/` because that is where GitHub looks for it — and `web/privacy.html` names it to a user by filename, so it is a live promise, not a courtesy | tree |

And the READMEs, which are documentation of their own directory rather
than of a subject:

| README | What it covers |
| --- | --- |
| `README.md` | The product, top to bottom: what it is, how to run it, the repo map, the gates |
| `src/v2/README.md` | The port, the feed / overlay / Mirror lazy groups, the lint and a11y debt, the mount tests, and the migration procedure off the global bridge. **The longest and most load-bearing of these** |
| `functions/README.md` | The backend's own layout and conventions |
| `firestore-tests/README.md` | How the rules and e2e suites are structured and run |
| `content/README.md` | The question bank formats and how content reaches the seed |
| `design/README.md` | The frozen prototype and its revisions |
| `design/identity-2026-08-26/README.md` | The identity canvas the iris mark ships from (D302), and where each of its cards went |
| `design/ask-2026-09-05/README.md` | The web ask door (D368 shape A), and **the adapter contract the build needs** — the draft was fed a shaped pricing resource, so eight names differ from `content/pricing.json`, and `refundDays` must come from `WINDOW_DAYS` rather than from `trailingDays`, which is a day shorter than the promise |
| `design/front-door-2026-09-07/README.md` | The sign-in screen the account wall needs (visual request 9, `SIGNIN-PLAN.md`), twelve live artboards. **The README is the readable half**: the delivered file is a bundle, so the copy it settled, the three keyboard-and-flight behaviours, and the errors that each name their own way out are written out rather than left in a gzipped asset |
| `design/rounds-card-2026-09-08/README.md` | The 1v1 and group card when a round is the unit (visual request 12, `ROUNDS-PLAN.md` §7.5) — nine states for each surface, light and dark, from the owner's canvas. **The README is the readable half**: the delivered file is a bundle, so every string it settled, the behaviours a static reading loses, and where the tree departs from the canvas are written out rather than left in a gzipped asset |
| `design/standalone-2026-09-08/README.md` | The owner's `InSight_12` upload of 2026-09-08 — the group as a cast: what its 1v1 and group draw, the duel family's modules whole (compiled, pretty-printed), the bundle's own `order.json` and `hashes.json` for the next extraction, what moved and — stated rather than hidden — what this extraction did not diff, and where the tree departs from the design |
| `design/standalone-2026-09-09/README.md` | The owner's `InSight_15` upload of 2026-09-09 — how 1v1s and Groups work now: the ten modules the bundle's own hashes say moved (the duel family, the roles panel, the person page, the explain sheet, the first day), pretty-printed; what moved against the 09-08 record, measured; the brief's README that the bundle does not carry |

## 5 · The gates

There are five test runners, **not interchangeable** — the table is in
`CLAUDE.md` §2, with what each covers and what it needs. One of them,
`test:scripts`, is missing from the gate table below on purpose and rides
the `ci` lint job anyway; §2 has why that hid it for so long. Below is
everything else: the static gates, and where each one runs.

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
| `check:fn-types` | ci | The server half's TEST files, typechecked at last. `functions/tsconfig.json` excludes them (they must not ship to Cloud Functions) and the root `tsc -b` never reaches that directory, so a fake that stops matching the interface it stands in for is invisible to every gate — and only wrong where something reads the part it dropped, which is why the suite stays green. CI only, not deploy: a test file is never deployed, so this cannot say whether a rules fix is safe to ship |
| `check:deploy-targets` | deploy | Every exported function appears in the deploy `--only` list. One missing name builds, tests green, and never deploys |
| `check:content` | deploy | The compiled content matches `content/`, byte for byte, plus the invariants the seed path assumes |
| `check:learn-sample` | deploy | `content/learn-sample.json` — the fixed slice of the learn bank the JS bundle carries (D284) — is what its source generates |
| `check:duel-sample` | deploy | `content/duel-sample.json` — the fixed slice of the duel bank the JS bundle carries (D435, D284's shape one bank over) — is what its source generates |
| `check:seed-fields` | deploy | Every field `gen-v2content` emits is transported by the seed, compared by `SEEDED_FIELDS`, and mirrored in the seed test — or declared untransported with a reason (D285) |
| `check:anchors` | deploy | The profile's `<select>` vocabularies and the trigger's `BREAKDOWN_DIM_VOCAB` hold the same strings, or a level stops counting silently |
| `check:catalogs` | deploy | The committed catalogues and the trigger's compiled-in key sets agree exactly, absence included |
| `check:pokedex` | deploy | The Pokédex catalogue's contiguous keys — stored answers are dex numbers into it, so a gap is an answer resolving to the wrong species |
| `check:elements` | deploy | The same for the elements catalogue, keyed by atomic number |
| `check:logic-sync` | deploy | The logic generator's two byte-identical copies (client + functions, D57). Drift means the server scores forms the client never rendered |
| `check:calls` | deploy | The CALL rubric's two byte-identical copies (D194) **and** a dry run of every authored rubric — twice each, once shaped to come out true and once false. A rubric that can only resolve one way is not a prediction; a drifted copy makes the card contradict the grade it is printing |
| `check:pick-crowds` | ci | Every live pick question has well-formed `CROWD` and `BY` data in `pick-data.js`. The harness that caught pk28 lived in a scratchpad that was wiped, so the contract had no keeper |
| `check:workflows` | ci | Whether GitHub can LOAD each of the 25 workflow files — one question, because it is the one whose failure is silent. A `${{ }}` written as prose inside a `run:` body is still substituted, so an empty expression stops the file parsing: no job, no log, a run named after the file's path rather than the workflow, on every branch at once because the `on:` filters are inside the file GitHub could not read — and, for 31 hours, no deploy (D465). `check:deploy-targets` asks the same of `firebase-deploy.yml` on the deploy path; the other 24 are here and only here, so a prose mistake in a release workflow can never stand between an emergency rules fix and production |
| `check:globals` | ci | The spec layer's shared-global wiring: dangling references, files `spec-index.js` forgot, undefined JSX tags, publications nothing reads, and (**rule 4**) a ratchet on remaining coupling that may only go down |
| `check:docs` | ci | This page's maps, and that `DECISIONS-INDEX.md` is current |
| `check:figures` | ci | Counts quoted in prose, held equal to the tree. Exists because a figure kept current by intention does not stay current |
| `check:answer-shape` | ci | Every answer-creating write still carries `qid`, `answeredAt` and `anchors`, and the rebuild still reads them (D290). An answer without its anchors snapshot can never be re-cohorted — the profile is mutable, so the cohort it was cast in is gone |
| `check:a11y` | ci | Accessibility, as a per-file ratchet, plus the four figures `src/v2/README.md` quotes about its own debt |
| `check:labels` | ci | Every `htmlFor` / `aria-*` reference resolves to an id in the same file. jsx-a11y only checks the attribute is present |
| `check:touch-zoom` | ci | No text field under 16px. One at 15px zooms the whole app on iOS and nothing zooms it back (D105) |
| `check:tap-targets` | ci | No button drawn under 44px without a grown hit box. `jsx-a11y` has no size rule, so `check:a11y` stayed green while every sheet's Close button was 26px |
| `check:panel-suites` | ci | One test suite per hand-written panel in `src/v2/ui/`, as a ratchet. The convention was written down and drifted to nine panels with none, including the on-trial tab's |
| `check:purge` | ci | Every store persisting `insight.*` state hears the local purge. Deleting the keys is half a wipe if the in-memory copy writes itself back |
| `check:bundle` | ci | Seven ceilings — the largest chunk, total JS, the eager graph, the largest EAGER chunk, blocking CSS, total CSS and fonts — of which `MAX_EAGER_KB` is the one to quote for a first-paint claim. It said four here from the day the row was written, which was exact then; D220–D223 added the three asset ceilings one commit later, so a reader consulting this table would not have learned that CSS and fonts are gated at all. Refuses to grade a build not made as the shipping one, and withholds the total-JS ceiling when the Sentry DSN is unset (D191) |
| `check:eager-content` | ci | Question content may not be in the static first-paint graph. Walks static imports from `src/v2/main.jsx` and names the chain, because the edge that mattered was invisible to `check:bundle`: a module inlined into the entry chunk has no chunk of its own to read. Its allowlist is a shrink-only ratchet — a listed module that stops being eager fails too, asking for its line out (`check:globals` rule 4's shape) |
| `check:file-size` | ci | A shrink-only ceiling on the files already too big to change safely — `live.ts`, `world-feed.jsx`, `v2content.ts`, the two largest suites. Not a line limit and no opinion about file size: the only claim is that a watched file does not get bigger by accident. Every other meter here reads a relationship; this reads the simplest property there is, which is why nothing caught `live.ts` going 1,285 → 8,682 lines in 39 days. `check:globals` rule 4's shape (a shrink also fails, asking for the number to come down with it) |
| `check:versions` | ci | Five version numbers that must move together across three files |
| `check:monitoring` | ci | The alert chain from the log line a function emits to the policy that reads it. Every link fails the same silent way |
| `check:data-inventory` | ci | Every collection the rules reach is named in `docs/data-inventory.md` (D130), and — where a read rule is literally `request.auth != null` or `false` — that the row's reader column agrees with it (D257) |
| `check:policy-claims` | ci | A live promise that **vanishes** from `web/privacy.html` — since D183 a claim deleted there is a claim deleted from the product |
| `check:pricing` | deploy | The committed rate card (`content/pricing.json`, PAID-PLAN §6, D288 §3) stays inside its own rules: exact cohorts, idx at or above the floor (no ceiling since D373 — the index measures crowding), 14 real booked ticks and, since D373, 14 crowd counts, no estimate without a campaign with a measured rate behind it — and since D313 the generated `functions/src/pricing.ts` embed matches it byte-for-byte, so the price the server charges and the price the door prints cannot drift. On the DEPLOY path since that second half existed: `priceQuote()` invoices the buyer, and `firebase-deploy.yml` does not wait on `ci.yml`. Since D371 the file's demand fields are the FALLBACK snapshot: the live half is published onto `v2_meta/pricing` by the webhook and the nightly closer (`functions/src/pricingFold.ts`), and the two overlay parsers — server and client — hold that document to the same shape this gate holds the file to |
| `check:ask-pricing` | ci | `web/ask-pricing.json`, the web ask door's price card, still matches `content/pricing.json` and `WINDOW_DAYS`. Generated by `build:ask-pricing` rather than authored: the design was fed a differently-shaped resource, so eight names are adapted — and `refundDays` comes from the function's serving window, never from the card's `trailingDays`, which is a day shorter and a different quantity (D369) |
| `check:ask-places` | ci | `web/ask-places.txt`, the buy door's city picker, still matches `public/cities.txt`. Generated by `build:ask-places` rather than authored, and it is a picker rather than a text box for one reason: a booking carries the catalogue key an answer's anchor holds (`"Oslo, NO"`), so a free-typed city would take the money and reach nobody (D455) |
| `check:public-copy` | ci | The retired pre-D98 privacy vocabulary **reappearing** in copy a user reads |
| `check:store-forms` | ci | The privacy nutrition label, which exists twice on purpose, agreeing with itself |
| `check:quality` | ci | Question form and provenance (D97), the place-scope tripwire, and the id/bank headroom |
| `check:neighbors` | ci | Near-duplicate questions inside each surface's dedup domain, never across them (D63) |
| `check:taxonomy` | ci | A category is written at every site or not at all (D424) — the feed's palette against its wire list, `CAT_META` against `map-branches.js`, hue distinctness, and the proposal ledger |
| `check:cities` | ci | The city catalogue's rows and name lengths — a malformed one is pickable and then absent from every breakdown |
| `check:ios-spm` | ci | The npm alias that keeps the iOS SwiftPM graph resolvable |
| `check:ios-facebook` | ci | That the postinstall actually stripped the Facebook SDK a transitive SPM manifest links in (D16) |
| `check:ios-location` | ci | The iOS location declarations against what the app does. ITMS-90683 is why it exists |
| `check:devicebind` | ci | D29's iOS and Android bridges are registered, not merely present — the failure it guards is silent (D342) |
| `check:account-level` | deploy | firestore.rules' account bar equals `accountLevel.ts`'s `REQUIRED_LEVEL` — they disagree silently both ways (D343) |
| `check:web-headers` | ci | Every page under `web/` is covered by a hosting headers rule — the enumerated `source` lists lost four pages in a week |
| `check:catalog-art` | ci | The pick tiles' pictures (D421): every image under `web/catalog-art/` has its credits row and vice versa, every key is in its catalogue, every licence is one the policy admits, the generated index agrees with the directories both ways, and `firebase.json` serves the path with CORS and an hour's cache — the takedown's other half |
| `check:csp-hashes` | ci | Every `'sha256-…'` in a hosting CSP is the digest of a script that is really in the page it covers, both directions. `check:web-headers` reads header KEYS by design; a hash is not a policy but a checksum of a file in this tree, and a drifted one is silent — the browser refuses the script and the page renders as a form that does nothing |
| `check:web-firebase` | release | That the shipped bundle actually carries the Firebase config |
| `check:store-listing` | release | Marketing copy against both consoles' length limits |
| `check:store-copy` | release | No unfilled placeholders in the store-facing legal pages. Runs on every iOS archive (`ios-release.yml`) and is off CI on purpose |

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
- `window.MapStats` returns **null** for four anchors on purpose (D72) →
  same section. (Five until D328 moved `job` onto its derived `jobField`.)
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
