# Improvement ideas — what one reviewer would change, remove or add with full creative control

**Status: plan only. No code changes here.** Written 2026-09-05 on the
owner's ask (*"go through this project and make a list of the things
you would improve, change, remove or add if you had full creative
control"*). Every figure below was measured on this tree or read from
a file the tree carries, and the file is named beside it so the next
reader can re-run it. Nothing in this page is a decision; the owner
picks from it. Where an item collides with a standing record, the record
is named and the collision is the point.

---

## 0 · Where the project actually stands

Read `monitoring/pulse-trail.jsonl`'s last row before anything else.

| Measured 2026-09-05 | Value |
| --- | ---: |
| Daily active users | **0** |
| Measured actives (lifetime) | 2 |
| Answers counted (lifetime) | 59 |
| Revenue | $0 |
| Seeded questions | 847 |
| Deployed Cloud Functions | 42 |
| App + functions code (lines) | ~166,000 |
| `docs/` (lines) | 69,361 across 65 files |
| `docs/DECISIONS.md` | 38,288 lines, 366 records |
| `check:*` gates | 42 |
| Metered Claude spend 2026-08-17 → 09-03 (`USAGE-REDUCTION.md` §1) | **$7,011**, $390 a day, half of it routines |
| App Store review submitted (`LAUNCH-RUNBOOK.md` 6.2) | **No** |

The build-to-usage ratio is the central fact about this repository, and
no document in it leads with that. Everything below follows from it.

**What is genuinely good, so the cuts do not read as contempt.** The
daily loop (blind vote, then the exact split) is a real product and the
demo build looks like a finished app: the type, the oklch token ramp in
`src/v2/styles.css:229`, the Map constellation, the duel reveal. The
honesty architecture (D1, D98) is enforced in the build, not promised.
`backend-checks.yml` guarding a PR and production identically is the
best structural decision in the repo. `functions/src/pure.ts` with its
2,093-line test is the best backend file. `check:globals` rule 4 took
cross-module coupling from 799 to 32 and is a mechanism worth copying.
Every `ci.yml` step names the incident that produced it. The night
shift's `firestore.rules` expression-ceiling finding on
`OWNER-LIST.md` is excellent engineering. None of that is in question.

---

## 1 · Product

### Change

1. **Ship.** Build 29 is in TestFlight; step 6.2 has never been ticked.
   Nothing below matters more than a real reviewer and a real stranger
   answering a question. Budget the one rejection round the runbook
   already budgets and submit this week.
2. **Design the cold start as the product, not as an empty state.**
   D1 forbids seeded activity and D98 removed every floor, so the first
   thousand users answer and see *count: 1 — you*. The Mirror, which
   the docs say is the point, is empty for them, and eight surfaces
   say a variant of "nothing yet" (`PatternsTab.tsx:276`,
   `PatternsPeople.tsx:159`, `NearLiveBody.tsx:302`,
   `AskedByYouOverlay.tsx:140`, `PulseTrends.tsx:162` among them).
   Three honest options that break no decision: (a) the World stop
   draws from the first answer and every other stop stays hidden until
   its cohort has a floor of *interest*, not privacy (D265's shape, one
   stop over); (b) a first-week arc where the daily's reveal is against
   the whole app rather than a cohort; (c) invite-first, so a new user
   arrives with a circle. Pick one and design it in Claude Design per
   D352 before the submission, because a reviewer will see the empty
   version.
3. **Resolve the positioning contradiction.** `README.md` says
   answering is the smaller half; a user's first month is entirely the
   daily. Lead the store listing and the first session with the daily
   and let the Mirror be the reward that appears, rather than the
   headline that is dark.
4. **Fix the privacy-page contradiction before submission.**
   `web/privacy.html:233` says *"We never ask for your religion, health
   or ethnicity — there is no field for any of them"*; `STORE-FORMS.md`
   line 86 answers Apple's Health row **Yes** for the sleep and energy
   pulse questions (D203). Two store-facing legal artefacts disagree and
   `check:policy-claims` cannot see a semantic contradiction. One
   sentence on the page fixes it; page first (D183).
5. **Bring the D98 exposure arithmetic to the owner as a launch-blocking
   ask (D334), with a specific proposal.** A named answer with city, age
   band, gender, education, relationship and height band in a Norwegian
   city cohort of one is an identification, and thirteen of the feed's
   questions are political. The consent record D331 built covers the
   derived compass, not the raw political answers. This is not a request
   to restore the old model; it is a request for a decision on the
   smallest shape that survives GDPR Art. 9 review: consent at the
   political question itself (D330's own move, one question over), or
   the anonymous-answer option `VISION-2026-08-26.md` §1 already draws.
   Decide before a European reviewer does.

### Remove or park

6. **Foresight calls.** All three are `active: false` in
   `content/call-questions.json`; D196 says predicting the app's own
   numbers is the wrong game. Delete the bank, the resolver and the
   card. The engine's rules can live in git history.
7. **The romantic duo pool** (24 questions, `active: false`), **rank
   questions** (8), and the **catalog pick pipeline** with its Wikidata
   builds and `athlete-review.json` exceptions. These are content-ops
   machinery for a volume the app does not have. Park behind a record,
   not a plan note.
8. **Feed ads, sponsored questions, paid reports and cohort
   subscriptions.** `content/ads.json` ships empty, zero of 267 feed
   questions carry a sponsor, `pricing.json` reports zero estimates, and
   revenue is $0. Keep the one paid path that is built and honest
   (`paid.ts`, the buyer's own question) and move it out of the binary
   per `STORE-CUT-PLAN.md` before Apple reads it as 3.1.1. Park the rest.
9. **The engagement telemetry ladder** (rungs 0–2, D268–D272). It
   instruments zero users. Keep the code path, switch it off until DAU
   is a number, and stop extending it.
10. **The genetic and body axes** (`AXES-PLAN.md`, `AXES-RUNBOOK.md`).
    Brain scans, smartwatches and *"the most comprehensive database of
    how genes connect to traits"* for an app with two users is scope
    with no evidence under it. Park with an explicit record and a
    re-entry condition (a DAU figure), and stop the lanes that build
    toward it.
11. **The Patterns tab as a build target.** The gate is right and will
    not open for a long time (24 questions at 8 answers each, and 8 of
    yours). Stop polishing it until it can appear.

### Add

12. **An acquisition plan.** There is none in the repo beyond ten
    TestFlight testers. Ten paragraphs on who the first 500 users are
    and where they come from is worth more than the next 10,000 lines
    of anything.
13. **Onboarding.** One `firstRun` flag in `app-shell.jsx` and a duel
    explainer are all there is. A three-screen first session that ends
    on the day's reveal, designed per D352.
14. **A human at the desk for content.** D212 lets scheduled runs write,
    review and merge their own questions to `main`, and `paid.ts:471`
    lets a model approve a stranger's paid question. One bad question is
    a store removal. Put one human tick between the farm and the bank
    until there is a moderation history to trust.

---

## 2 · Client code

### Change

15. **Split `src/v2/data/live.ts`** (7,531 lines; the `LIVE` literal
    alone runs 2,471 lines from line 4246; `hydrate()` is 784 lines).
    The seams are already named regions with their own storage keys:
    pending answers, caches, bank, feed, social, near, presence. Eight
    modules behind a thin façade that still publishes `window.LIVE`.
    `vote.test.ts` (3,523 lines) splits along the same seams.
16. **Split `world-feed.jsx`** (4,439 lines, 628 top-level
    declarations, 13 direct `localStorage` calls, 47 `demo` mentions).
    Storage, palette math, animation primitives and every card variant
    live in one file. The globals ratchet is done (32 sites, at floor),
    so the next ratchet is file size.
17. **Add `data/storage.ts`.** Twenty-four spec files touch
    `localStorage` directly. A typed `insight.*` key store makes the
    purge (`check:purge`) structural instead of grep-enforced.
18. **Ratchet inline styles onto the tokens.** There are 1,891
    `style={{…}}` objects in the spec layer and a token system that
    reaches perhaps a third of the surface. Rule 4's mechanism, per
    file, downward only.
19. **Retire the demo path once live is the product.** `demoInProd` and
    the demo pools are a second implementation of every card that only
    tests exercise. Keep mock mode for design work; delete the
    in-product demo branches.

### Remove

20. The `window.X &&` render-site guards in `app-shell.jsx:800-827`; the
    file's own comments say the memoised promise is the mechanism.
21. `test-definitions.js`'s four `window.LIVE` reads, twelve percent of
    the remaining rule-4 count, kept only so a script can run it under
    node. A `liveOrNull()` shim injected by the caller removes them.
22. `@capacitor/status-bar`: no import in `src/`, named only in a comment
    in `capacitor.config.ts`. Verify against the shells, then drop.
23. The 953 comment lines in `scripts/check-bundle.mjs`, a changelog
    inside a gate. Keep the four constants and their current reasoning;
    the history is in `DECISIONS.md` already.

### Add

24. A `check:figures` row for the spec layer's line count. `CLAUDE.md`
    says ~22k and `src/v2/README.md` says 18.5k; the tree says 32,163.
    This is the exact failure the gate exists for, on the one number it
    does not compute.

---

## 3 · Backend

### Change

25. **Shard `v2_question_aggs`.** `functions/src/v2.ts:827-880` folds
    every vote for a question into one document in one transaction, and
    the comment at `v2.ts:81` names Firestore's one-write-per-second
    ceiling and says the remedy is sharding. No shard exists. One blind
    daily question answered by everyone at the same morning hour is the
    exact pattern that trips it. `replay.ts` already proves the
    aggregate is a rebuildable projection, which is the property that
    makes N shard docs plus a merge safe. Do it before the first push
    notification goes out.
26. **Split the functions codebase.** All 42 functions deploy as one
    unit and every container parses the 312 KB generated
    `v2content.ts` plus `stripe` and `@anthropic-ai/sdk` on cold start,
    including `nearbyCountV2` and `registerPushToken`. Three codebases:
    core (answers, aggregates, reveals), paid, ops.
27. **Invert the function options default.** `ops.ts` sets 512 MiB and
    concurrency 1 globally and opts individual functions down; its own
    comment says the reason (D13's full-scan aggregators) is gone. Cheap
    default, explicit opt-up. Three scheduled functions currently
    inherit the expensive default by omission (`paid.ts:807`,
    `paid.ts:1413`, `v2social.ts:1281`).
28. **Fix the `firestore.rules` expression ceiling** the night shift
    found (`OWNER-LIST.md`, Decisions): a `set` over an existing answer
    evaluates `allow create` and `allow update` together and exceeds
    Firestore's 1000-expression budget, so eleven e2e cases that assert a
    refusal assert nothing. 1,282 of the file's 1,937 lines are comments;
    the fix is a cheaper rule shape, and the comments move to
    `data-inventory.md`.
29. **Make the operator/moderator split real.** `ops.ts:26-45` says
    `SEED_ADMIN_UIDS` and `MOD_UIDS` are the same single uid in
    production. One env var and a second human.

### Remove

30. `sweepPaidReviewsV2` every thirty minutes at 512 MiB for a path
    whose Stripe keys may be unset. Hourly, or event-driven off booking
    age.
31. `POLITICAL_QIDS` in `v2.ts`; the comment says nothing reads it.
32. `v2_aggs_private` if only the catalog and duel paths still write it.

### Add

33. A load test that drives real concurrent writes at one question
    through the emulator. Everything about D7's ceiling is prose and a
    mocked transaction.
34. A cold-start and bundle-size gate for `functions/`, the twin of
    `check:bundle`.
35. Rate limiting on the answer write path. `v2_ratelimits` covers
    joins, invites, suggestions and bookings; answers, the one write
    that costs a trigger and a hot-document transaction, are limited by
    rules shape and App Check only.

---

## 4 · Process, automation and spend

This is where full creative control changes the most, and the repo's
own evaluations (`USAGE-REDUCTION.md`, `AXIOM-EVALUATION.md`, D366)
already make the case. The failure is not self-awareness; it is that
each finding became another document instead of a deletion.

### Change

36. **Cap routine spend with a gate, not a document.** $390 a day for a
    product with zero DAU, and the axiom dispatcher's own rate-limit
    status reads `rejected`. A weekly workflow that reads the sessions'
    usage blocks and goes red above a committed ceiling puts the bill
    where CI already puts a 12 KB bundle regression.
37. **Rotate the night worker.** One session, alive since 2026-08-24,
    has metered $2,326 against 969M cache-read tokens because every
    firing re-reads a 497k-token history. A fresh session per night does
    the same work off a prefix twenty-five times smaller. The owner row
    exists; it should not need a row.
38. **Run one night shift, not two.** Two accounts audit the same tree
    the same night at roughly $297 a night, and the collision machinery
    (D360, D363, D365 are each a night spent merging the two) is a cost
    of running both. Merge the briefs and keep one.
39. **Stop `console.yml` committing on every push to `main`.** 38 of the
    last 50 commits are workflow commits. Keep the two-hourly cron and
    the label events; drop the unfiltered push trigger.
40. **Parallelise the `lint` job.** 32 serial `npm run` steps in one
    runner; a stale README number blocks the same job as
    `check:devicebind`. Three or four shards.

### Remove

41. **The twelve theory lanes.** $733 over eight days, 129 claims, one
    node at `measured`, two crossings into the product on day two and
    none since, and the owner's ruling at D366 that none of it is axiom
    theory. `MEASUREMENT-NOTES.md` and `AXIOM-IDEAS.md` have salvaged
    what was worth keeping. Stop the lanes; re-create one, later, with a
    product question in front of it.
42. **The ops dispatcher.** $70.68 metered while relaying nothing over
    seventeen firings. `pr-shepherd.yml` and `console.yml` already
    proved that a workflow does the job a Routine could not.
43. **The doc sweep lane.** One aborted run, a 450-line contract.
44. **The axes build, retro and skeptic lanes** until item 10 is
    reversed by evidence.

### Add

45. **One human review per merged PR**, at least until launch. The
    shepherd merges on a label the owner ticks in `MERGE-LIST.md`, which
    is good, but the night shifts push 13–35 commits a night as branches
    without PRs and the review that composes them is itself a routine.
46. **A real git history.** The clone is shallow, so `git log` cannot
    answer when a convention began, which is why so much history has
    been retyped into prose.

---

## 5 · Documentation

The governance layer is bigger than what it governs: `PROGRAM-PLAN.md`,
`PROGRAM-RUNBOOK.md`, `OPS-RUNBOOK.md`, `ROUTINES.md`,
`USAGE-REDUCTION.md` and `DOC-SWEEP.md` are 4,113 lines describing six
lists that total 605. Thirty-four of `ORIENTATION.md`'s 66 rows are
`plan`, `mixed` or `past`. And the map already has a defect its gate
cannot see: `USAGE-REDUCTION.md` appears twice in §4 with two different
descriptions, and `check:docs` is green.

### Change

47. **Cut `CLAUDE.md` to the 150 lines that are traps:** the spec
    layer's globals, the five runners, `setGlobalOptions` in `ops.ts`,
    the `HTTPS_PROXY` failure, `LIVE.ready` versus `attached`. Everything
    else, including the D265 paragraph with its eight citations and the
    privacy history, moves to `ORIENTATION.md` or the record it cites. A
    newcomer's first file should not litigate.
48. **Cap a decision record at a screen.** D364 through D366 run 60 to
    200 lines each before stating what changed. Keep the arithmetic;
    lead with the decision in three lines, then the reasoning, then the
    history, and let the index carry the rest.
49. **Archive `DECISIONS.md`.** 38,288 lines in one file. D1–D200 to
    `docs/decisions/archive-2026-08.md`; the generated index still
    resolves every link.

### Remove or fold

50. `PROGRAM-PLAN.md` + `PROGRAM-RUNBOOK.md` + `OPS-RUNBOOK.md` into one
    ops document. `ORIENTATION.md` already describes them as three views
    of one thing.
51. `DOC-SWEEP.md` into a paragraph of `ORIENTATION.md`.
52. `VISUAL-REQUESTS.md` (171 lines, three requests) into `WORKLIST.md`.
53. `LAUNCH-PLAN.md`, `LAUNCH-RUNBOOK.md` and `SHIP-CHECKLIST.md` into
    one launch document; today each names another as stale.
54. The five prose-agreement gates (`check:store-copy`,
    `check:store-listing`, `check:store-forms`, `check:policy-claims`,
    `check:public-copy`) into one script with five rule sets.

### Add

55. A one-doc-one-row rule in `scripts/doc-index.mjs`. It would have
    caught the live duplicate above.

---

## 6 · If I ran the next thirty days

Week one: items 1, 4, 5, 28, 36–39, 41–43. Ship, fix the two legal
contradictions, stop the spend. Week two: items 2, 13 designed; item 25
built; item 14 in place. Weeks three and four: items 47–49, 15, 26, and
the first ten real users' answers read every morning by a person. The
build is ahead of the evidence by a year. The cheapest way to make the
next 366 decisions good ones is to have users generating the arithmetic
instead of routines.
