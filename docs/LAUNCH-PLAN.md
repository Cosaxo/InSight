# Launch plan — the final stretch

> **The engineering this document planned is done** (PR #60, 2026-08-01);
> what survives it is the human chain. That chain is now an ordered to-do
> list in [`LAUNCH-RUNBOOK.md`](LAUNCH-RUNBOOK.md) — start there. This file
> stays as the record of what was built and why, plus the calendar
> arithmetic at the bottom. Archive it once the app is live.

This is the sequencing overlay for getting InSight submitted to both stores.
It does not replace [`SHIP-CHECKLIST.md`](SHIP-CHECKLIST.md) — that stays the
canonical store checklist and every store step below points into it. What this
document adds is the *engineering* work that still stands between the current
tree and a submittable app, the order it has to happen in, and the arithmetic
behind the estimates. Archive this file once the app is live; the checklist
survives it.

State at time of writing (2026-08-01): the code side is Phase-5 complete per
SHIP-CHECKLIST, the production backend is deployed but **unseeded**, and four
engineering workstreams remain — all of them content-shaped, which is why they
were invisible to the code-completeness gates. Confirmed by audit, not
assumed:

- The generator that produced `functions/src/v2content.ts` from `content/*.json`
  is lost (`scripts/gen-v2content.md` is the tombstone). Every path that grows
  live content runs through recreating it, so it goes first.
- The live daily bank is 30 questions → a hard 30-day repeat cycle, identical
  for every user (`computeDeckIds` is `mod n` over the bank).
- All four personality tests carry exactly 2 items per dimension; big5 and
  attachment have zero reverse-keyed items.
- The logic test is 12 fixed puzzles with the answer key
  (`a: 2,4,3,1,4,2,3,1,3,4,0,3`) shipped in the bundle — same test every
  retake, trivially cheatable.
- Learn's "X% of people got this right" is authored, not measured, and Learn
  has no backend representation at all.

**Update, 2026-08-01 (same day):** every gap below is closed — all four
workstreams merged to main in PR #60 (D30–D33). The workstream sections
stay as the record of what was built and why; the live part of this
document is now the revised calendar at the bottom.

Decisions taken for this stretch (owner-confirmed 2026-08-01):

1. Logic test rebuilds on a **procedural generator** — real Raven's items are
   Pearson-copyrighted, and a generator is the only design where there is no
   answer key to leak.
2. Daily launches at **~90 questions** and keeps growing via the farm, so the
   repeat cycle never catches up with real users.
3. **Learn goes live**: the crowd stat becomes a measured number at launch,
   accepted as roughly +1 week of scope.
4. Everything else in SHIP-CHECKLIST's deferral list stays deferred.

---

## W1 — Content pipeline: recreate the generator, then cross the demo/live gap

### W1.1 The generator and its drift gate (1 session) — everything else waits on this

New `scripts/gen-v2content.mjs`, Node stdlib only (it will sit on the deploy
path; same discipline as `check-deploy-targets`). Reads
`content/{daily-questions,feed-questions,duel-questions,tests,learn-questions}.json`
and emits `functions/src/v2content.ts`. The acceptance test is unforgiving on
purpose: `--check` must reproduce the committed file **byte-for-byte** before
any content changes ride on it — that is the proof the lost generator has
actually been recovered rather than approximated.

The id scheme it must reproduce (recovered from the committed output):
`daily-NNN` / `duo-NNN` / `test-<key>-NN` positional, `feed-<id>` /
`group-<id>` explicit; daily `tone`→`topic`; group `kind`→`topic`; test items
get the fixed 5-point agree scale and `axis` = dimension id; `seq` = per-surface
running index. Two hardenings while we are here:

- **Explicit ids everywhere.** Positional ids re-key every later question on an
  insert, and answers are immutable docs keyed by qid — a re-key silently
  attaches live answers to the wrong prompt with no cleanup path (the same
  failure class D15 refuses for catalogue keys). A one-time `--assign-ids`
  writes the current ids into the positional JSON files; afterwards the
  generator requires and validates ids and never mints one implicitly.
- **`domain` in the seed path.** The aggregate trigger reads
  `qDoc.get("domain")` for catalog answers but `V2SeedQuestion`/`runSeedV2`
  cannot carry it. The emitted interface and seed payload gain
  `domain: string | null` now so W1.4's go-live is not blocked on a generator
  change later.

Gate: `scripts/check-content.mjs` as `npm run check:content` — generator in
check mode plus sanity (unique ids, id format per surface, option counts,
likert exactness, feed topics exist, learn-card rules from W-Learn). It runs in
`backend-checks.yml`'s functions-build job after `check:deploy-targets`:
`v2content.ts` compiles into the deployed seed callable, so drift here is a
statement about production — the `check:pokedex` argument. `ci.yml` inherits
via the reusable call, so one placement guards PRs and deploys both.

Cleanup: `scripts/gen-v2content.md` becomes a pointer to the script;
`content/README.md` names the real pipeline.

### W1.2 Phase B — promotion, daily to 90, and the rotation epoch (1–2 sessions)

This is the gating decision QUESTION-FARM.md names: farm output becomes
eligible for the live seed. Mechanics are all reuse — spec `Q` entries and
`content/daily-questions.json` entries share a shape, so promotion is copying
entries, minting the next ids (`daily-030`+), `--write`, `check:content`, PR,
operator reseed. `runSeedV2` is merge-idempotent, writes `active` only on
create, and — since D34 — writes only the documents whose content changed,
leaving `contentRev` alone; clients page the new questions in against their
`updatedAt` cursor rather than refetching the bank. QUESTION-FARM.md gains a
"Promotion" section: an operator/dev-session job with human review, not a
scheduled Routine — the farm keeps writing the spec layer only.

**Daily to 90.** Promote the ~35 `dqx` archive entries (→ ~65), then ~25
net-new through 2–3 farm cycles (≤12/run) or one to two authoring sessions at
the same review bar. This gates the final reseed, which gates screenshots.

**Never-repeat arithmetic** (goes in the DECISIONS entry): consumption is 7
questions/week; the farm cap is 12/week — net +5/week of headroom while
promotion runs. A 90-question bank alone is ~13 weeks of runway if promotion
stops entirely. Never-repeat holds indefinitely while promotion averages
≥7/week; every promoted question buys one day.

**The rotation epoch fix** (`src/v2/data/deck.ts`). `computeDeckIds` maps day →
`bank[(today − back) mod n]` with `today` an absolute day number (~20,600 —
deep in wrap territory), so *any* change of `n` remaps every visible day,
including the 7-day history pager: a user's answered "Yesterday" card would be
replaced by a different question whose vote state doesn't match, rendering
unanswered — on every weekly reseed. Fix: rebase on a launch-day epoch,
`idx = (today − DECK_EPOCH) mod n`. While `n ≥ days-since-epoch` — which the
arithmetic above guarantees under sustained promotion — the mapping never
wraps, so appending questions changes no past or present day at all: growth
becomes pure extension. The far-future wrap (if promotion lapses past the
runway) is the recorded residual limit. Unit tests in `deck.test.ts`; the
why-comment carries this paragraph. Duels need nothing: reveal docs store the
answered `qid` and the client resolves history by it, so duel-bank growth only
shifts future rotation.

**Bank fetch limit.** `live.ts` fetches the bank with `limit(400)`; the
post-stretch bank is 191 + 96 learn + ~60 daily growth + 22 test ≈ 369 —
inside the limit with less than one quarter's farm headroom. Raise it (one
line + comment) and record the new ceiling with its growth arithmetic.

DECISIONS entry for all of W1.2: the out-of-scope reversal, rotation/epoch
arithmetic, seq-drift-on-reseed harmlessness (seq only sorts; answers key on
doc id), provenance (human review at both hops), id discipline, limit raise.

### W1.3 Farm contracts for the uncontracted pools (1 session, documentation)

QUESTION-FARM.md gains one section per pool that has none today:

- **Learn cards** — writes `content/learn-questions.json` directly (the
  post–W-Learn single source of truth). This is the farm's one single-gate
  lane — a merged card reaches production on the next reseed — so the review
  bar is production-level: the PR body argues each card's trap `t`
  individually, and states that `p` is the authored cold-start estimate the UI
  shows *labeled* until the measured number clears the floor, never presented
  as measured (D1). ≤8/run; `k` exactly three words; new fields or subjects
  are human decisions proposed in the PR body.
- **Duel questions** — ≤4/run; dedup against both duel banks *and* the daily
  archive; and a duel-specific phrasing bar: the reveal is 2–5 named people,
  so avoid prompts where a minority answer reads as an accusation.
- **Feed questions** — ≤6/run; `cat` must be an existing `WORLD_TOPICS` id; no
  `rank` additions to anything live-bound (D12).
- **Test items — explicitly not a farm lane**, recorded with the reasoning:
  psychometric items need invert balance, non-double-barreled phrasing, and a
  lockstep two-layer change plus a reseed; a scheduled job with a 12-question
  budget is the wrong author. The farm may *propose* items in a PR body; W2 is
  the deliberate path. One paragraph, so it stays a decision instead of drift.

### W1.4 Catalogue completion (3–4 sessions; the designated deferral candidate)

1. **Operator errand (networked machine):** `node scripts/build-catalog.mjs
   films` and `artists`; commit `public/films.txt`, `public/artists.txt`, and
   the regenerated `functions/src/catalogKeys.ts`. `check:catalogs` is the
   acceptance gate. Never hand-write keys (D15).
2. **Demo cards:** new `PICK_QS` + `CROWD` entries in
   `src/v2/spec/pick-data.js` using real committed keys — delegable to the
   daily catalog Routine once the catalogues exist.
3. **D14 go-live — one deliberate change:** live catalog questions in content;
   the generator emits `surface:"feed", type:"catalog", domain`; `live.ts`
   gains the `entity` vote variant; `buildFeedGlobals` maps catalog cards to
   the pick card with the live canon + D17 segments; an e2e leg proves the
   floor and fold (`publishableCanon`) against real emulated functions. Ships
   whole or not at all, exactly as D14 records.

If the submission date presses, this whole workstream defers past launch — it
is self-contained and nothing else depends on it. Record the deferral if taken.

---

## W2 — Personality tests: 2 → 3 items per dimension (2 sessions; needs W1.1)

> **Superseded 2026-08-10 (D85):** K went to **5**, and a fifth test
> (`cognitive`) gained the question bank it had never had. The mechanics
> below — append at the end, one commit, both layers, regen + reseed — are
> what that change followed, and the parity gate this section introduced is
> what held the two layers together through it.


+22 items: big5 10→15, political 12→18, values 12→18, attachment 10→15
(44→66 test docs). The quality bar, enforced by review plus the parity gate
where mechanical:

- **At least one genuinely reverse-keyed item per dimension** — big5 and
  attachment currently have zero, which is an acquiescence-bias gap, not just
  a thinness problem. Reverse-keyed means a real indicator of the low pole
  ("I stick with familiar ideas"), not a negation ("I do not find new ideas
  interesting").
- One claim per item — no double-barreled statements.
- First-person present-tense declaratives matching the existing voice.

Mechanics: append at the **end** of each test's `questions` array in *both*
`content/tests.json` and `IS_TESTS` in `src/v2/spec/test-definitions.js`, one
commit — appending keeps the positional `test-<key>-NN` ids stable and keeps
in-flight `insight.testProgress.v1` answer arrays index-aligned. Update the
"N questions" `tag` copy in both layers. Then regen + reseed: 22 new docs,
`contentRev` bump; the live test-card feed picks them up with no code change.
No consumer hardcodes 2-per-dimension (verified: minutes estimate, passive
progress, archetype sig matching are all count-free).

New gate: `src/v2/test/content-parity.test.jsx` under `test:unit` — asserts
spec `IS_TESTS` ≡ `content/tests.json` (same items, order, dims), K items per
dimension with K defined once, ≥1 invert per dimension. This is what makes the
two-layer coupling unbreakable silently: live mode builds test cards from the
seeded bank while passive progress reads spec counts, and today nothing checks
they agree.

Users with saved results keep them (results are per-dimension 0..100,
item-count-free). A user mid-test sees their progress percentage drop when the
denominator grows — accurate, not a bug.

---

## W3 — Logic test: procedural, seeded, nothing to memorize (4–5 sessions, parallel track)

The rebuild keeps the overlay, the renderers, the five result lenses, and the
whole compat surface (`window.LogicOverlay`, `window.LOGIC.load()/.color`,
`window.openLogicTest`, the `insight.logicTest.v1` key). What changes is where
puzzles come from.

**New typed module `src/v2/data/logic-gen.ts`** — pure, no React, no Firebase;
exports functions for vitest and publishes `window.LOGIC_GEN = { generateForm,
version }` at module scope (the `live.ts` pattern; the globals scanner already
covers `src/v2/data/`). Side-effect import in `spec-index.js` immediately
before `./spec/logic-test.jsx`, with a why-comment — order is semantic.

**Generator design.** Rule families in the Carpenter taxonomy, expressed over
the existing Layer/Cell vocabulary so `Prim` renders generated cells
unchanged: `const-row`, `progression` (size / dot count / ring count),
`add-sub` (figure addition), `dist3` (Latin square), `dist2` (the hard
family). An item is 1–3 (rule, attribute) bindings over disjoint attributes;
difficulty = the sum of family weights, matching the published difficulty
ordering. Distractors are principled corruptions — repetition of a displayed
neighbor, wrong-rule (progression run one step past), incomplete correlate
(exactly one bound attribute mutated), legal perturbation — filtered so no
option canonically equals the answer and all six are pairwise distinct. PRNG
is an inline mulberry32; the attempt seed comes from `crypto.getRandomValues`
at Start/Retake. A form is 12 items on a fixed ramp template (1-rule →
2-rule → hard families), options shuffled per item.

The consequence the whole design exists for: the bundle ships a *generator*,
not an answer key. The fixed `a:` constants are gone, every retake is a fresh
form, and option positions never repeat. (Stated honestly in a comment: any
client-side test is inspectable by a determined user — what this closes is
memorization and the shipped constant, which is the actual complaint.)

**Overlay changes.** Drive runs from `LOGIC_GEN.generateForm(seed)`. Storage
schema v2 at the same key: `{v:2, seed, gv, marks, times, pctile, when,
diffs}` — persist per-item difficulties so lenses never regenerate the form
and a future generator version cannot reinterpret an old seed. v1 payloads
keep rendering (loadResult already back-fills `pctile`; extend the back-fill
for `diffs`). Fix the two latent bugs while here: the `/11` hardcode in
`solveRate`, and QBands/progress mapping over the module `PUZZLES` constant
instead of the saved result. Keep the `logicPctile` logistic exactly as-is,
with the ramp tuned so a median solver lands ~7–8/12 — recalibrating against
no data would be fake precision; the honest-model posture and
`LOGIC_FIELD_NOTE` stay. Positional `aria-label`s on the six option buttons
and the matrix ("Answer N of 6" — no glyph semantics, which would leak rule
structure).

**Tests.** `logic-gen.test.ts` under `test:unit`: determinism (same seed →
deep-equal form); solvability over ~200 seeds via an *independent solver*
(recompute the answer from the bindings, assert it equals `opts[a]` and no
other option matches); distractor uniqueness; shuffle integrity; ramp
monotonicity; renderability (every layer within Prim's vocabulary — the gate
that keeps generated cells from silently drawing nothing); pinned mulberry32
outputs so a refactor cannot quietly change every historic seed's form. Smoke:
existing assertions unchanged, plus a v1-payload-seeded open and a fresh-start
run rendering six option buttons.

**No backend.** The test stays device-local — "this test sends nothing
anywhere" stays literally true, and no store form changes. DECISIONS records
the deferral with the arithmetic: the rules `testResults` cap is ≤8 keys with
4 in use, so a later `logic` key is a client-only change.

---

## W-Learn — Learn goes live: measured crowd stats (≈4 sessions; needs W1.1)

Owner decision: "X% of people got this right" becomes a measured number.

**The crux — spaced retries vs immutable answers — resolves cleanly: the first
attempt counts, and D5 is the enforcement.** A first attempt is a plain world
answer, `v2_users/{uid}/answers/learn-<cardId>` with `{qid, surface:"learn",
optionIdx, answeredAt, anchors:{}}`. The scheduler's retries (GAP/STREAK/
check-in) stay where they already live: device-local state. The create-only
rule denies a second write, so a repeat attempt cannot double-count even by
client bug — the psychometric policy (a people-rate, not an attempt-rate: the
crowd stat must measure first exposure, not the scheduler's own retries) and
the privacy invariant are the same mechanism. A separate collection would need
its own trigger, deploy-allowlist entry, and per-event first-attempt dedup —
which collapses into this design plus overhead.

**Content.** New `content/learn-questions.json` becomes the canonical card
bank (full authored shape `{id, f, q, a[4], c, t, p, k, w?}`);
`learn-data.js` builds `window.LEARN_CARDS` from a static JSON import of it
and keeps publishing the same globals — this kills the dual-source drift class
outright rather than gating it. The *server* docs carry only what rules and
aggregation need: `{id: "learn-<cardId>", surface: "learn", seq, type:
"choice", prompt, options, topic: f}`. Correctness (`c`), the trap, the
estimate, and the fact-label stay client-side — nothing server-side reads
correctness, "% got it right" is `counts[c]/total` computed on the client, and
`c` ships in the bundle today anyway. Nothing server-side enumerates surfaces
(verified), so the blast radius is two rules lines and the client.
`SCHEMA-V2.md` gains the `learn` surface row.

**Aggregation: zero trigger changes** — verified, not assumed. The vote fold
in `onV2AnswerCreated` is surface-agnostic: anything carrying a numeric
`optionIdx` outside group/duo/entity folds into `v2_question_aggs` with the
same exact publish path (D94: no floor, no cadence). Cold start (below the
floor): the UI shows the authored estimate, labeled — "our estimate — becomes
measured once enough people have answered" — and the measured state's footer
uses the established lower-bound phrasing ("from N+ players"). The authored
number is never shown unlabeled and never shown as measured (D1).

**Client.** `live.ts`: add `"learn"` to the bank fetch's surface list, raise
the `limit(400)` (see W1.2), keep a `learnBank`; the existing per-bank
allowlists already fence daily/feed/duels (verified), and a unit test pins
that a learn doc appears in no other bank. `LIVE.learnAnswer(cardId, pick)` —
written only on a true first attempt from a real tap, fire-and-forget; a
failed write costs one crowd datum, never the local mastery flow.
`LIVE.learnAgg(cardId)` — one `getDoc` at reveal time, session-cached; 96
standing listeners for cards mostly never seen is the wrong cost shape. The
display seam is `LEARN_SPLIT` at its single definition site (both callers
verified); a sibling `LEARN_SPLIT_SRC` drives the estimate/measured footer.
**Leveling keeps using the authored `p`** — the measured % is display-only for
now: early percentages swing by whole publish-steps, and "on your level" must
not re-rank between sittings. Recorded deferral with a revisit threshold
(~100 first attempts per card, where one publish step moves the rate ≤5
points). Two demo-honesty leaks become gated in live mode: the unconditional
fake mastered-state seed in `learn-progress.js`, and `learn-social.js`'s
synthetic friends (the D11 structural pattern).

**Rules delta: two words** — add `"learn"` to the two surface lists in
`isWorldAnswer`. The D29 device binding applies automatically, which is
correct: learn answers feed aggregates.

**Tests/gates.** Rules tests: accept; surface-mismatch deny; out-of-range
deny; and **second create on the same qid denied** — pinning first-attempt-only
as a rules-level property so the policy cannot regress without a red test. E2e
leg in the v2 loop: five users answer, every one published
counts at five, duplicate refused. Erasure is free — learn answers live in the
same `answers` subcollection `deleteAccount` recursively deletes — plus a
seeded learn answer and leftover assertions in the erasure e2e.
`data-inventory.md` gains the learn row (no new store-form category — the
existing "answers, test results" row's inventory text names learn answers).
The pinned `window.LIVE` member surface gains `learnAnswer`/`learnAgg` in the
same commit. Rules land before the client (an accepted-but-unsent surface is
inert; the reverse order is permission-denied noise).

---

## Store chain (human/console — runs in parallel; SHIP-CHECKLIST §§1–5 owns every step)

- **Seed production now.** Five minutes, already unblocked (SHIP-CHECKLIST §1
  step 3). Reseeds are merge-idempotent, so seeding today costs nothing later.
  The reason to batch the final reseed is gone on both counts: the epoch fix
  landed (D30), and D34 stopped reseeds from bumping `contentRev` at all, so
  they no longer cost every returning device a full bank refetch. Reseed as
  often as content lands.
- **Start the Apple Developer application on day 1** (~2-day approval) and
  treat the legal-entity values (`web/terms.html` placeholders, gated by
  `check:store-copy`) as the schedule wildcard — they block upload and their
  timeline is outside engineering control.
- In parallel with W1–W3: Firebase config files, `REVERSED_CLIENT_ID`, auth
  providers, APNs key, App Check registration + its 24–48h soak,
  `scrub-v1-discoverable --apply`, assetlinks/AASA fingerprints (all §§2–3, 5).
- **Screenshots after the final reseed and W3** — they must show the real app:
  15-question tests, the rebuilt logic test, a deep daily bank, live Learn.
  Nothing for screenshots/feature graphic/marketing copy exists yet; it is the
  one launch item with no repo material at all. **The imagery plan:**
  1. *Capture harness first (repo work, doable now):* a Playwright script
     against the web build at the store viewports (6.7"/6.5"/5.5" iPhone,
     12.9" iPad if targeted, plus Play phone/tablet sizes), driving the five
     screens worth showing — today's question, a reveal split, the Mirror
     map, a duel reveal, the logic test mid-puzzle. Chromium renders the
     same React tree the shells wrap, so these are honest app pixels;
     device frames and captions are composition on top, not different UI.
  2. *Content state matters more than tooling:* captures happen in LIVE
     mode against seeded production once real answers exist (the TestFlight
     week is the natural moment — ten testers put real splits on
     screen). Demo mode is the fallback and its honesty badges will show —
     which is acceptable for a fallback but is the argument for doing it
     the live way.
  3. *The Play feature graphic (1024×500) is a build artifact, not a
     photoshoot:* generate it from `design/icon/mark.svg` + wordmark +
     one-line tagline the same way `scripts/gen-icons.mjs` rasterises the
     launcher set — deterministic, regenerable, reviewable in a PR.
  4. In-app imagery stays out of scope for launch: questions are
     deliberately text-first (images would add licensing surface, an
     entirely new moderation class if ever user-supplied, and bundle
     weight for zero mechanical benefit to a blind-answer product).
- **Age rating / IARC** — the checklist delta this document adds: nothing in
  the repo has thought about it. The politics test (special-category data,
  already declared in the privacy forms) and user display names in group
  reveals are the answers that need care; likely 12+/Teen. Answer it during
  listing setup, deliberately.
- Do **not** pre-build Sign in with Apple (SHIP-CHECKLIST's recorded stance);
  budget one 4.8 review round instead — the reply is drafted. TestFlight with
  **ten** testers, not five (D7's publish-every-5 makes a group of 6–9 read as
  broken). `check:store-copy` and `check:versions` before every archive —
  the former is deliberately not in CI.
- **`node scripts/style-diff.mjs` once before the first archive.** It walks
  both builds across seven screens and compares typography, colour and
  geometry per rendered string. It is deliberately not in CI (playwright is
  not a dependency here, and some divergence from the prototype is
  intentional — its header lists which), which currently means it runs only
  when someone remembers it exists. On its one run it reported 15
  differences across 700 elements, and after the fixes 0 across 2,891 — and
  it found five whole feed cards that were missing because every lens
  question was being swallowed by an `else if` (D11). Four rounds of
  comparing screenshots by eye had not found any of them. That is worth one
  scheduled run per release rather than a tool nobody invokes.

---

## Sequencing and the calendar — revised 2026-08-01: engineering is done

Every engineering workstream above (W1.1–W1.3, W2, W3, W-Learn, the
daily-90 authoring, plus the D33 scorecard) landed on main in **PR #60**
(squash `08ac631`, 2026-08-01) — the plan's three engineering weeks
collapsed into a day, and the original 5-week table below it is now
history. W1.4 (catalogues) stays the recorded deferral. What remains is
the human chain only, and it splits into two store tracks with
different floors:

- **iOS — ~2–3 weeks.** Apple Developer enrollment (**as an
  individual**: ~1–2 days, no D-U-N-S; convertible to an organization
  later — enrolling as an org first costs 1–2 weeks of entity + D-U-N-S
  verification for nothing launch needs) → console config + the App
  Check 24–48h soak in parallel → Mac signing session + first archive →
  screenshots (imagery plan above) → a few days of TestFlight with ten
  testers (D7 arithmetic) → submit → review, often 24–48h; budget the
  one likely 4.8 round, reply pre-drafted in SHIP-CHECKLIST.
- **Android — ~3–4 weeks, floor set by policy, not effort.** A personal
  Play Console account must run a **closed test with 12+ opted-in
  testers for 14 continuous days** before Google grants production
  access. That clock starts only once the account exists and a signed
  build is uploaded — started in week 1 it runs parallel to everything;
  started late it runs serial after iOS.

The critical path now — nothing in the repo gates any of it:

1. **Day 1:** Apple Developer application + Play Console account
   ($25, ID check); the two owner steps (`seedContentV2` as the
   operator; the farm Routine re-pace to daily — D33, prompt in
   QUESTION-FARM.md); the three `web/terms.html` values as a sole
   trader (`check:store-copy` to zero); Firebase console (Google
   provider on, Anonymous stays — D3, config files downloaded, App
   Check apps registered so the soak starts now).
2. **Day 2–3 (Apple approval lands):** App Store Connect record for
   `com.cosaxo.insight`; APNs key → Firebase Cloud Messaging; Mac/Xcode
   signing + first archive; **upload a signed build to the Play closed
   test immediately** (starts the 14-day clock); recruit ten TestFlight
   + twelve Play testers.
3. **Week 2:** TestFlight soak and fixes; screenshots + feature graphic
   off real content; privacy forms from the SHIP-CHECKLIST §3
   table; the IARC/age-rating questionnaire.
4. **Week 2–3:** iOS submit (+ the possible 4.8 round). **Week 3–4:**
   Play production application once the 14 days complete, then Play
   review.

Non-compressible, no matter the effort: the Play 14-day test, the App
Check soak, and both stores' review queues. Everything else is
initiative. **Best case: iOS live inside ~2 weeks; both stores in
~3–4.** The old ~5 weeks stands only as the outer bound — what
incorporation-first, a second review round, or slow tester recruitment
would cost.

## DECISIONS.md entries this stretch adds

1. Phase B promotion record — rotation/epoch/limit arithmetic, id discipline,
   the test-expansion note rides here (W1.2/W2).
2. Logic-test rebuild record — procedural generation, seeded attempts, storage
   v2 with v1 back-compat, backend-sync deferral with the ≤8-keys arithmetic
   (W3).
3. Learn-live record — first-attempt semantics, the labeled-estimate cold
   start, display-only leveling with its revisit threshold, the
   single-source-of-truth move and the farm's single-gate learn lane (W-Learn).
4. Catalog go-live per D14 — or its dated deferral (W1.4).
