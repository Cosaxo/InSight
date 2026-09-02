# Backend Deployment & CI/CD

How the InSight backend — Firestore security rules and Cloud Functions — is
deployed, and how the GitHub Actions pipeline is wired up.

For running the same backend locally (no deploy required) against your own
machine for development and testing, see
[`docs/LOCAL-TESTING.md`](./LOCAL-TESTING.md).

## Overview

Backend deploys are automated. Any push to `main` that changes
`functions/**`, `firestore.rules`, or the workflow file deploys to the
Firebase project `prvfire33`. Routine backend changes need no manual deploy.

## Pipeline

- **Workflow:** `.github/workflows/firebase-deploy.yml`
- **Triggers:** push to `main` (paths `functions/**`, `firestore.rules`,
  `firestore.indexes.json`, `storage.rules`, `web/**`, `firebase.json`, the
  workflow file) and manual `workflow_dispatch`.
- **Steps:** checkout -> set up Node 22 -> install & build `functions` ->
  write `functions/.env.prvfire33` -> authenticate to Google Cloud ->
  `firebase deploy`.
- **Safety properties** (all three are load-bearing; don't drop them):
  - `needs: test` — where `test` calls
    [`backend-checks.yml`](../.github/workflows/backend-checks.yml), the
    same reusable workflow `ci.yml` runs on every PR: the functions build
    **and its unit tests**, the Firestore + Storage rules suites, the v2
    core-loop e2e and the erasure e2e. What guards a PR is exactly what
    guards production.

    This used to be the rules suite alone, so a push that broke
    `meetsKFloor`, the duel-reveal path or account deletion deployed while
    CI went red in parallel.

    Deliberately **not** on this path: lint, the bundle budget, the
    Android build and the `npm audit`. None of them says anything about
    backend correctness, and each could block an emergency rules fix — the
    audit especially, since it is a live registry call whose result
    changes without the code changing.
  - `environment: production` — scopes the secret and variables, and is
    where required reviewers or a wait timer attach (**Protection rules**
    below).
  - `concurrency: cancel-in-progress: false` — a queued push waits for the
    in-flight deploy instead of cancelling it mid-apply.
- **Deployed resources:**
  - Firestore rules (`firestore.rules`) + indexes
  - Storage rules (`storage.rules`) — its **own step**, before the main
    apply, and `continue-on-error` so a project with no bucket cannot
    abort a rules/functions deploy. The flag is `--only storage`, NOT
    `--only storage:rules`: the colon form names a *deploy target* (the
    multi-bucket feature, unconfigured here) and errors with "Could not
    find rules for the following storage targets". That exact error ran
    silently under `continue-on-error` on **every** deploy until
    2026-07-31 (PR #51) — check the step's log, not its checkmark,
    before assuming the rules are live. First real release: run
    30644637683.
  - v2 functions: `seedContentV2`, `onV2AnswerCreated` (exact
    aggregates), `createGroupV2` / `joinGroupV2` / `leaveGroupV2`,
    `registerPushToken`, `scheduledDuelReveals` / `revealDuelsNowV2`
    (reveals + push)
  - Moderation functions (docs/MODERATION.md, D22): `buildModQueue`
    (scheduled) / `buildModQueueNow`, `fetchModQueue`,
    `submitModVerdict`
  - `deleteAccount` — the one v1-era function that carries forward, and
    it still wipes the v1 collections (D13)
  - Hosting (`web/` — the legal pages), as the **last** step and
    `continue-on-error` for the same reason as storage
  - The apply is **two steps, and the split is load-bearing.** Rules and
    indexes go first with no `--force`; functions follow with it.
    `onV2AnswerCreated` has a retry policy, which the CLI refuses
    non-interactively without the flag — but `--force` is deploy-wide, not
    a functions option. `firebase-tools` reads it as
    `shouldDeleteIndexes`/`shouldDeleteFields` (`lib/firestore/api.js`), so
    while the two shared one command, every deploy deleted whatever indexes
    and field overrides production held that `firestore.indexes.json` does
    not name — and that file names exactly one index (the `v2_takes` list
    composite, D65). The two the runbook tells an operator to create by
    hand are exactly that shape: the
    `v2_agg_events.expireAt` TTL (LAUNCH-RUNBOOK §5.1, the 90-day bound D28
    rests on) and the composite index `v2social.ts` names if the duel scan
    throws `FAILED_PRECONDITION`. Both were being reverted silently, green.
    Without `--force`, a non-interactive deploy logs the would-be deletions
    and continues. `npm run check:deploy-targets` fails the build if the
    two are ever recombined.

### One-off cleanup still owed in production (D13)

> **PAID 2026-08-27 (D333).** The command below ran as written, all nine
> confirmed 2nd Gen as they went, and their four Cloud Scheduler jobs went
> with them — `us-central1` now holds zero functions and zero scheduler
> jobs, verified by `npm run observe`. The inert `aggregates_*` and
> `taxonomies` documents they kept rewriting went the same day, with the
> whole `(default)` database (FIRESTORE-REGION step 5). Kept below as the
> record of what was owed and why the region in it was right.

Dropping a function from the `--only` list stops **deploying** it; it does
not **delete** the deployed copy. The nine v1 functions removed in D13 are
still live in `prvfire33` until someone runs, once:

```bash
npx firebase functions:delete rebuildAreaAggregates scheduledAreaAggregates \
  rebuildWorldAggregates scheduledWorldAggregates rebuildCityAggregates \
  scheduledCityAggregates sendInboundImpression seedTaxonomies \
  scheduledTaxonomies --project prvfire33 --region us-central1 --force
```

**`us-central1` in that command is correct and must not be "fixed" to
match D201.** Those nine functions were deployed before the move and are
still sitting in the old region.

Naming the new region **fails loudly**, which is better news than this
paragraph gave it credit for until 2026-08-26: it said the wrong region
"would delete nothing and report success", and in firebase-tools 15.24.0
`functions:delete` throws `The specified filters do not match any existing
functions in project prvfire33` and exits non-zero
(`lib/commands/functions-delete.js:56`). Nothing is touched. Worth stating
accurately, because "silently does nothing" and "hard error" send an
operator to two different places. It is the one place in this repo where the old region
is the right answer — everywhere else it is a stale copy.

Until that runs, three schedules keep firing against empty collections —
harmless and near-free, but it is billed work that produces nothing. The
inert `aggregates_*` and `taxonomies` documents they leave behind can be
dropped from the console at the same time; nothing reads them.

## Authentication

The pipeline authenticates with a service-account key stored as the GitHub
Actions secret `FIREBASE_SERVICE_ACCOUNT`.

- The workflow writes the secret to a temp file and sets
  `GOOGLE_APPLICATION_CREDENTIALS` to its path; the Firebase CLI reads it
  automatically. (We deliberately do **not** use the
  `google-github-actions/auth` action — its tarball repeatedly failed to
  download on the runner.)
- The key belongs to the project's `firebase-adminsdk` service account.
  (Its full address is in Firebase Console → Project settings → Service
  accounts — not written down here, so this doc can be shared freely.)
- That service account currently holds the `Editor` + `Firebase Admin` IAM
  roles, which together cover deploying rules and (gen-2) functions. This can
  be narrowed to least-privilege later.

## Protection rules on the `production` environment

**Decided (D87) — this is the required configuration, not a proposal.**
Unattended production writes are not an accepted state for this project.

**Applied: ☐ not yet.** These are settings in GitHub's UI, not files in
this repo, so nothing here takes effect until someone clicks them —
which is exactly why the box is here and unticked. Tick it in the same
commit as applying, and record the date.

That checkbox is doing the same job as the seed step's in
`SHIP-CHECKLIST §0.1`: a decision that lives only in a conversation gets
made twice and done never, which is the failure
`.github/workflows/seed-content.yml`'s header records happening to the
seed instruction two separate times.

**What the environment gates.** Five jobs — verified rather than assumed,
by grepping `environment: production` across every workflow. It said "two
jobs, and only two" for as long as there were four: `rebuild-aggregate.yml`
joined at D290 and `monitoring.yml` at D303, and neither author re-read a
sentence in a different document that had counted them. (`budget.yml`
joined at D332, and this sentence moved in the same commit because
`check:figures` now holds the count — the gate that grew out of exactly
this paragraph's history.)

| Workflow | Job | What a gate would hold |
| --- | --- | --- |
| `firebase-deploy.yml` | `deploy` | rules, indexes, functions, hosted legal pages |
| `seed-content.yml` | `seed` | `seedContentV2` writing `v2_questions` |
| `rebuild-aggregate.yml` | `rebuild` | `rebuildAggregateV2` overwriting a published aggregate |
| `monitoring.yml` | `arm` | creating the notification channel, log-based metrics and alert policies |
| `budget.yml` | `arm` | creating or retuning the Cloud Billing budget |

`ios-release.yml` uses a different environment and is unaffected.

### The settings

GitHub → Settings → Environments → `production`.

| Setting | Value | Why |
| --- | --- | --- |
| **Required reviewers** | ON — the repo owner | The gate. The job pauses *before* `FIREBASE_SERVICE_ACCOUNT` is exposed to the runner, so an unattended or unintended run never reaches production credentials. |
| **Prevent self-review** | **OFF** | Load-bearing, not an oversight — see below. |
| **Wait timer** | **0 minutes** | A timer delays without adding a decision. The approval *is* the gate, and the one path this repo protects hardest is the emergency rules fix. |
| **Allow administrators to bypass configured protection rules** | **OFF** | GitHub ticks this by default. Left on, it cancels the gate for exactly the person the gate exists to slow down — see below. |
| **Deployment branches and tags** | Selected → `main` only | The half that holds without a human. |

### Three of those need their reasoning recorded

**Admin bypass must be OFF, and this is the setting the whole thing turns
on.** GitHub ticks it by default, and it was missed when this section was
first written (2026-08-10) — caught while the settings were actually
being applied, which is the only place it could have been caught, because
nothing in this repo can see it.

Read it against the threat D87 names. The reason for the gate is that
granting an agent session workflow-dispatch rights means granting the
`workflow` scope on **the owner's account**, and the owner is a repo
admin. With bypass on, a run dispatched with that token skips the
approval — the gate stands aside for precisely the caller it was built
to stop, and the audit log records a protection rule that never fired.
Required reviewers with admin bypass on is not a weaker gate; against
this threat it is not a gate.

It also costs nothing to turn off here. Bypass exists so an admin can
push past a rule in an emergency, but the emergency path is already one
tap: the owner IS the required reviewer, and **prevent self-review is
OFF**, so they approve their own run. Bypass would only save the click,
and the click is the entire feature.

**Prevent self-review must stay OFF, and this is a consequence of
"Operator continuity" below, not an independent choice.** `SEED_ADMIN_UIDS`
and `MOD_UIDS` hold one uid, and it is the same person who owns the repo.
With self-review prevented, the only human who can approve a production
run is the one who triggered it — so **every deploy and every seed would
block forever**, including the emergency rules fix. Turning it on is
correct the day there is a second maintainer, and wrong until then. If
that day comes, turn it on in the same change that adds the second uid.

**The branch restriction is the part that does not depend on judgement.**
Required reviewers ask a human to be careful; `main`-only is enforcement.
A `workflow_dispatch` on any other ref cannot read the environment's
secrets at all — GitHub refuses to grant them to a run on a
non-permitted ref, so a compromised or over-broad token cannot seed or
deploy from an unreviewed branch. It costs nothing here: `firebase-deploy`
already triggers only on push to `main`, and a seed should only ever
carry merged content.

### What changes the day this is applied

Today a backend merge deploys unattended. After, it queues and waits: the
run sits in **Review pending**, GitHub notifies, and one approval
releases it. The same for a seed.

That is a real cost against the emergency rules fix — the path
`firebase-deploy.yml` deliberately keeps lint, the bundle budget, the
Android build and the `npm audit` off, because each could block it. An
approval is a much smaller tax than any of those (no registry call, no
build, no way to fail on its own) but it is not zero, and it is the
reason the wait timer is 0 rather than "a few minutes to think".

**The trade being made:** unattended production writes stop being
possible, at the price of one tap per backend merge. Accepted (D87) — the
tap is bounded and the exposure it removes is not.

### How to apply it

GitHub → Settings → Environments → `production`. Four fields, one save.
Then tick the box at the top of this section with the date.

Verify it took, rather than assuming — trigger anything on this path (a
backend merge, or Actions → Seed content) and confirm the run sits at
**Review pending** instead of proceeding. A protection rule that was
saved into a different environment name looks identical in the settings
list and gates nothing.

### What this does not cover, recorded rather than left to be discovered

**Nothing in CI verifies that these settings are still in place.** They
live in GitHub's UI, no file in this repo describes them, and a rule
removed by hand leaves no trace here — this document would keep asserting
a gate that no longer exists. That is a weaker guarantee than the rest of
this project: `firestore.rules` claims are proven by
`firestore-tests/`, and this claim is proven by nothing.

It is recorded as a limit rather than closed because the obvious closure
is worse than the hole. A `check:env-protection` gate would need a token
with `administration: read` on every run, and would red the tree for any
contributor without it — the failure mode `scripts/check-labels.mjs`'s
header warns about, where a gate that fires on a guess is one people
learn to skip.

**The honest scope of the gate:** it stops *unattended* production
writes. It does not stop a careless approval, and an approver who always
clicks approve is strictly worse than no reviewer, because the audit log
then shows a gate that was never really closed.

## Runtime environment for the functions

These values reach the deployed runtime via the `production` environment
(GitHub → Settings → Environments → `production`). All are **Variables**
except `DC_PRIVATE_KEY`, which is a **Secret** — it is a signing key.
None are committed files:

| Variable | Read by | Effect |
| --- | --- | --- |
| `SEED_ADMIN_UIDS` | `functions/src/ops.ts` → `assertOperator()` | Comma-separated uids allowed to call the operator-only callables (`seedContentV2`, `revealDuelsNowV2`, `rebuild*`). Unset ⇒ **every** operator callable returns `permission-denied`. Set 2026-07-31 to the maintainer's uid (same account as `MOD_UIDS` — the roles are separate, the person currently is not). |
| `MOD_UIDS` | `functions/src/moderation.ts` → `assertModerator()` | Comma-separated uids allowed to call the moderation callables (`buildModQueueNow`, `fetchModQueue`, `submitModVerdict`). **Deliberately separate** from `SEED_ADMIN_UIDS` — a moderator identity can moderate and do nothing else (docs/MODERATION.md, D22). Unset ⇒ both callables deny everyone, which is fail-safe. Set 2026-07-31 to the maintainer's uid. |
| `APPCHECK_ENFORCE` | `functions/src/ops.ts` → `ENFORCE_APP_CHECK` | Only the exact string `false` disables App Check enforcement, as an incident escape hatch. Unset (the normal state) ⇒ enforced. |
| `DC_TEAM_ID`, `DC_KEY_ID` | `functions/src/deviceBind.ts` | Apple team id and DeviceCheck key id for `activateDeviceV2`'s iOS verifier (D29, docs/DEVICE-BIND.md). Unset ⇒ iOS activation fails `failed-precondition` — fail-safe while rules enforcement is soft. |
| `DC_PRIVATE_KEY` *(secret, not a variable)* | `functions/src/deviceBind.ts` | The DeviceCheck `.p8` contents. Stored as a GitHub **secret**; the deploy step \n-escapes it into the dotenv, the function unescapes. |
| `DC_ENV` | `functions/src/deviceBind.ts` | Set to `development` only when probing with development-signed builds — Apple routes dev-signed device tokens to the development endpoint. Unset ⇒ production endpoint. |
| `PLAY_PACKAGE_NAME` | `functions/src/deviceBind.ts` | Android package for Play Integrity decode/recall. Unset ⇒ `com.cosaxo.insight`, which is correct; exists so a future flavor/id change is one variable. |
| `STRIPE_SECRET_KEY` *(secret)* | `functions/src/paid.ts` | The Stripe API key (`sk_live_…`, or `sk_test_…` while rehearsing) for the self-serve paid-question loop (D313): checkout sessions and the closer's refunds. Unset ⇒ `createPaidCheckoutV2` answers `unavailable` and the closer records refund arithmetic without executing it — bookings and reviews still run. |
| `STRIPE_WEBHOOK_SECRET` *(secret)* | `functions/src/paid.ts` | The signing secret (`whsec_…`) of the Stripe webhook endpoint pointed at `stripeWebhookV2` (see below). Unset ⇒ the webhook answers 503 and no payment can go live. |
| `ANTHROPIC_API_KEY` *(secret)* | `functions/src/paid.ts` | The Claude API key the automated paid-question review calls (`claude-opus-5` against `REVIEW_GUIDELINES`). Unset ⇒ reviews decide on the deterministic gates alone, logged as `paid_review_gates_only` — fail-open ONLY past the gates, and the deploy warning names it. |

**Stripe webhook, one-time setup (D313):** in the Stripe dashboard add a
webhook endpoint for **three** events — `checkout.session.completed`,
`checkout.session.async_payment_succeeded` and
`checkout.session.async_payment_failed` — pointed at
`stripeWebhookV2`'s HTTPS URL (printed by the deploy;
`https://stripewebhookv2-<hash>-ew.a.run.app` shape, or
`gcloud functions describe stripeWebhookV2 --gen2 --region europe-west1
--format="value(serviceConfig.uri)"`), then store its signing secret as
`STRIPE_WEBHOOK_SECRET` and re-run the deploy so the dotenv carries it.

The last two matter because the checkout is created without
`payment_method_types`, so Stripe's dynamic methods apply — and EUR's
delayed ones (SEPA Direct Debit, bank transfer) deliver
`checkout.session.completed` with `payment_status: "unpaid"` and settle
hours or days later. The handler goes live only on a completion that says
paid, so subscribing to `completed` alone would leave every delayed-method
buyer stuck at approved, having paid.
Deliberately the dotenv mechanism, not `defineSecret()` — a Secret
Manager entry that does not exist makes `firebase deploy` refuse, and
the paid loop must never be able to block an emergency rules fix.

The deploy job writes these to `functions/.env.prvfire33`, which the CLI
bakes into each function's runtime config. The filename is
project-scoped deliberately: a future non-prod project must not inherit
production operator uids. `.env` and `.env.*` are gitignored repo-wide,
so the workflow variable is the only path into production — a deploy with
`SEED_ADMIN_UIDS` or `MOD_UIDS` unset still succeeds, but logs a
`::warning::` and leaves the affected callables denying everyone.
Changing a variable does nothing by itself: the value only reaches the
runtime on the next deploy, so re-run **Deploy Firebase backend** via
`workflow_dispatch` after setting one, and check the "Write functions
runtime env" step's log to confirm the value arrived.

### Operator continuity — one account is a single point of failure

`SEED_ADMIN_UIDS` and `MOD_UIDS` both hold exactly one uid today, and it is
the same person's. The roles are separated correctly in code (D22, D36) and
not yet in people, which the table above already notes. What it does not
say is what that costs, so:

**Everything operator-gated is reachable only by signing in as that
account.** There is no second factor at the function boundary (D36) and no
second holder. If that Google account is lost — recovery failure, a
forgotten device, anything — the following stop being possible, with no
in-repo path to restore them:

- seeding or re-seeding the question bank (`seedContentV2`), including
  `bumpRev` after a hand-edited `active` flag
- forcing a duel reveal during an incident (`revealDuelsNowV2`)
- every moderation instrument (`buildModQueueNow`, `fetchModQueue`,
  `submitModVerdict`)

Nothing *breaks* — the scheduled twins keep running and rules keep
enforcing, because the allowlist gates the manual levers, not the app. The
loss is the ability to intervene, discovered at the moment intervention is
wanted.

A second holder is also the precondition for **Prevent self-review** on
the `production` environment (see Protection rules above) — that setting
is off today precisely because one person cannot approve their own only
run.

**The fix is free and is config, not code.** Both variables are
comma-separated and already parsed that way; adding a second uid is one
edit per variable plus a re-run of **Deploy Firebase backend** (the value
only reaches the runtime on a deploy — see above). Do it **before** launch
rather than after: afterwards it competes with whatever incident made it
urgent.

Two things to keep right when adding one:

- **Keep the lists disjoint.** A second moderator should go in `MOD_UIDS`
  only. `assertOperator` and `assertModerator` are deliberately separate so
  a leaked moderator credential cannot seed content (D22) — one person
  currently holding both is a fact about staffing, not a licence to merge
  the lists.
- **Verify by failure, not by success.** After the deploy, confirm the *new*
  uid can call the instrument it should and gets `permission-denied` on the
  one it should not. A uid that was silently dropped from the parse looks
  identical to one that was never added, and the fail-safe direction here
  means the error is silence.

What this does not solve, and is worth naming: the Firebase service-account
secret, the Apple Developer account and the Play Console account are all
single-holder too, and none of them is a comma-separated variable. Those are
account-level delegation (Play has user management; Apple has App Store
Connect roles), and they belong on the pre-launch list for the same reason.

## Moving the functions to another region (D201)

The code half is done: `FUNCTIONS_REGION` in
`functions/src/ops.ts` and `src/lib/region.ts` both read `europe-west1`,
every function compiles to it, and `check:fn-runtime` fails if the two
sides ever disagree or if a call site starts spelling a region out again.
**The deploy half is an operator action, and it is the one deploy in this
repo that can corrupt data.** Read this section before running it.

### Why it is not an ordinary deploy

**A function's region is part of its identity.** Deploying the new region
does not move anything — it CREATES `europe-west1/onV2AnswerCreated` and
leaves `us-central1/onV2AnswerCreated` exactly where it is. While both
exist, both are subscribed to the same document path, and **every answer
folds twice**.

**The event-ledger dedup does not save you, and it looks like it should.**
`functions/src/v2.ts` opens each aggregate transaction with
`const seen = await tx.get(eventRef); if (seen.exists) return;`, keyed on
the CloudEvent id. That makes a RETRY of one trigger idempotent, which is
what it was written for (`retry: true` on both triggers). Two independent
Eventarc subscriptions deliver two events with two ids for the same write,
so each writes its own ledger row and folds again. The counts end up
double and nothing errors.

The deploy step in `firebase-deploy.yml` passes `--force` with an
id-only `--only functions:<name>` filter, which is the combination that
lets firebase-tools plan the old-region function as a deletion rather than
prompting. **Expected, not verified** — no region move has been run
against this project — so step 3 below is a check rather than a formality.

### The procedure

1. **Pick a quiet moment and do not answer anything while it runs.** At
   the current install base this is trivially satisfiable; it stops being
   trivial the day there are users, which is most of why this is being
   done before launch rather than after.
2. **Merge to `main` and let *Deploy Firebase backend* run**, or dispatch
   it. It deploys all 28 functions to `europe-west1`.
3. **Verify nothing survives in the old region — this is the step that
   matters:**
   ```bash
   gcloud functions list --project prvfire33 --regions us-central1
   ```
   Anything listed that is not one of D13's nine v1 leftovers is a live
   duplicate. Delete it before the next answer is written:
   ```bash
   npx firebase functions:delete <name> --project prvfire33 \
     --region us-central1 --force
   ```
   The two Firestore triggers are the urgent ones; a duplicated *callable*
   is harmless (nothing routes to it) and still worth removing.
4. **Confirm the fold still runs.** Answer one question and watch the
   count move — `onV2AnswerCreated` is the only function whose silence
   looks exactly like success. The `scheduledDuelReveals-silent` alert
   covers the reveal scan, not this.
5. **Ship a client build.** Every installed client calls the region its
   own bundle names, so every build shipped before this deploy — 21 and
   earlier — keeps calling `us-central1`
   and get a 404 the app reports as `internal` on every callable —
   account deletion, push registration, the logic test, circles and
   duels, device activation, suggestions. The daily and the Mirror keep
   working, because those read Firestore directly and never go through a
   callable. Bump the build and release before anyone is on the old one.

### If it goes wrong

The rollback is the same operation in reverse — flip both constants back,
deploy, delete the `europe-west1` copies — with the same double-fold
window. Aggregates already double-counted are NOT self-healing: the
ledger says the work was done. `## Correcting aggregates after a
fake-account ring (D28)` below is the closest thing to a repair path, and
it is a rebuild rather than an undo.

## Rolling back a bad deploy

Rules, indexes and functions roll back by different mechanics — a rules
rollback touches neither indexes nor functions.

**Rules** (fastest, no pipeline): Firebase Console → Firestore → Rules →
**History** → pick the last good ruleset → Restore. Takes effect in
seconds. Re-running the pipeline on a `git revert` also works but is
slower and re-deploys functions you may not want to move. Whichever you
use, land the revert in `main` afterwards or the next deploy re-applies
the bad ruleset.

**Functions**: there is no console "previous version" restore for gen-2.
Revert the commit and let the pipeline redeploy, or deploy a known-good
tree locally with the `--only` list from the workflow.

**A misbehaving `onV2AnswerCreated` is the urgent case.** It has
`retry: true`, so Eventarc keeps redelivering failures for up to ~7 days
— a crashing trigger does not drain, it accumulates. Fastest containment
is deploying a no-op body (return immediately) so deliveries are
acknowledged, *then* fixing forward. Reverting alone still leaves the
backlog to replay against the old code.

**Do not invoke a `rebuild*` callable inside its schedule window.** The
operator rebuilds and their scheduled twins are separate Cloud Run
services, so `maxInstances: 1` does not serialize them — running both at
once doubles peak memory and read spend for an identical result. The
schedules are: area every 6h, world 02:00 UTC, city 04:00 UTC, taxonomies
06:00 UTC. This is a cost concern rather than a correctness one (the
orphan-delete path is safe under interleaving); D7 records why no lock was
built.

Check what is actually happening first:

```bash
npx firebase functions:log --project prvfire33
npx firebase functions:log --project prvfire33 --only onV2AnswerCreated
```

The aggregate ledger makes replay safe: `v2_agg_events/{eventId}` is
checked inside the same transaction that increments counts, so
redelivered events are no-ops rather than double counts.

## Correcting aggregates after a fake-account ring (D28)

Fake-account prevention is deliberately partial — App Check prices
accounts, and since D98 nothing hides a small distortion — D28
records why no mechanism can make it complete. What the system guarantees
instead is that the published numbers stay **correctable**: answers are
immutable (D5), the exact counts are server-written and client-unwritable
(`v2_question_aggs` is `allow write: if false`, so the trigger is its only
writer and a correction cannot be raced), and
every counted answer leaves a `v2_agg_events` entry `{ qid, uid, at }`
for `LEDGER_RETENTION_DAYS` (90). This runbook is the procedure that
cashes that guarantee in. Write nothing here during an incident that this
section didn't already say while the system was calm.

**What this runbook does NOT do is find the ring.** Identification is
investigative — Auth creation-time clusters, App Check token metadata in
the function logs, answer velocity across `v2_agg_events` timestamps.
Since D54 the first pass of that investigation runs on a clock:
`ledgerVelocityScan` reads the ledger daily and logs `velocity_flag`
lines ("Reading the velocity scan" below). A flag is this runbook's
INPUT, not a verdict — honest crowds trip the same signals on their best
days. What is guaranteed is mechanical once you HAVE a uid list:
attribution, subtraction, republication, in that order.

1. **Correct before you delete.** The ring's answer docs
   (`v2_users/{uid}/answers/{qid}`) hold the option each fake picked and
   the anchors it claimed; the ledger holds which (uid, qid) pairs were
   actually counted. Deleting the accounts first destroys both. Ban ≠
   erase: disable the Auth users if you need the ring stopped while you
   work.
2. **Attribute.** For each uid: `v2_agg_events where uid == X` → the
   (qid, at) pairs that reached the counts. Use the ledger, not the
   answer docs alone — an answer whose trigger never completed was never
   counted, and subtracting it would corrupt the tally in the other
   direction.
3. **Subtract, in a transaction per qid — in the published document.**
   Which document depends on the question's shape, and there are only two
   cases:

   **Vote, edit and rank questions — one document.** Correct
   `v2_question_aggs/{qid}` directly: decrement `counts[optionIdx]` and
   `total` per attributed answer, and the `by` cells for the anchors on
   that answer doc — the snapshot-at-vote-time rule (D8) is what makes
   this subtraction exact rather than approximate. If the uid's ledger
   entries show more than one `optionIdx` for a qid, the extras are D86
   edits: each consecutive pair (ordered by `at`) is one cell of the
   `edits` matrix (D226) — decrement `edits[from][to]` per pair, so the
   ring's second thoughts leave with its votes. For a rank question the
   fields are `pos[]` and `total`: subtract the ring's positions per item.

   There is no republication step for these, and that is the point: this
   IS the published document, so the correction and the publication are
   one write and cannot disagree. Step 4 below used to exist because they
   were two documents.

   **Catalogue questions (`type: "catalog"`) — two documents, in order.**
   The accumulator is still `v2_aggs_private/{qid}`: decrement
   `ent[entity]`, `total`, and the `entBy` cells for the answer's anchors.
   Then recompute the board from the corrected accumulator exactly as the
   trigger does — `canonTopN(ent, CANON_TOP_N)` for `top`/`rest`, and
   `canonBreakdownFor(entBy, canon.top)` for `by` — and write that to
   `v2_question_aggs/{qid}` in the same transaction. Do not hand-edit the
   board: `top` and `rest` are a projection with an invariant (`rest` is
   everything outside the top N), and editing one without the other leaves
   a board whose numbers do not sum to its own total.
4. **Publish nothing by hand that the trigger would compute.** Since D98
   there is no floor, no `tooSmall` and no suppression to reproduce, so
   for a vote, edit or rank question step 3 has already published. For a
   catalogue, the only correct public doc is the one `canonTopN` produces
   from the corrected accumulator. A hand-written public doc that
   invents a projection is a worse incident than the one being corrected.
5. **Then delete the accounts** (admin SDK), which removes their answer
   docs and — via the uid sweep — their ledger entries.

Bounds, so nobody discovers them mid-incident: entries older than 90 days
have expired, so a ring dormant longer than the window is subtractable
only for its last 90 days of activity. An account erased via
`deleteAccount` took its attribution with it — right-to-erasure wins over
forensics by design (D28 records the trade). 

**Steps 3 and 4 now have a tool, and this paragraph used to say they did
not** — it read "No correction script ships in this repo" until
2026-08-25. D290 shipped one and never came back for the sentence, which
is D183's failure repeating. `rebuildAggregateV2` rebuilds a question's
aggregate from the answers that made it, and `--exclude` is exactly this
runbook's subtraction: **Actions → Rebuild aggregate**, or
`npm run rebuild:agg -- --qid <id> --exclude uidA,uidB` locally. It
replays every arm — vote, rank and catalog, the last writing both
documents in the order step 3 describes — so a rebuild cannot invent a
projection the way a hand-written board can.

Three things it does not change. **Attribution is still steps 1 and 2**,
and still investigative: the tool takes a uid list, it does not find one.
**The `edits` matrix (D226) is carried forward, not recomputed** — an
answer records where it landed and never where it came from — so a ring's
second thoughts still need the hand-subtraction step 3 describes. And it
is **dry by default**: read the drift before passing `--apply`.

Read `scanned` before you believe the drift. A scan that matched nothing
agrees with an empty aggregate trivially, so the tool says `nothing to
compare` rather than `drift: none` there, and refuses `--apply` outright
if the aggregate is not empty (D295). A zero scan is more often a query
that did not work — a composite index still building after a deploy, a
qid that does not match the answers — than a question whose answers are
gone.

What must not be improvised is the order of operations above.

### Reading the velocity scan (D54)

`ledgerVelocityScan` runs daily at 03:47 UTC over the ledger entries
since its last run (72h catch-up cap) and emits two kinds of line —
a heartbeat per run, and a warning per finding:

```bash
# The heartbeat — one per day; a silent week means the scan is not running:
gcloud logging read 'resource.type="cloud_run_revision"
  resource.labels.service_name="ledgervelocityscan"
  jsonPayload.metric="velocity_scan"' \
  --project prvfire33 --limit 7 --format="value(timestamp,jsonPayload.message)"

# The flags, newest first — kind is volume | cadence | cluster | burst:
gcloud logging read 'resource.type="cloud_run_revision"
  jsonPayload.metric="velocity_flag"' \
  --project prvfire33 --limit 50 \
  --format="value(timestamp,jsonPayload.kind,jsonPayload.message)"
```

(The log-field shapes follow the existing policies' filters; as with the
D37 queries, expect to adjust the resource labels on first real use —
the outcome strings are read from source, the labels are not.)

What each kind means, and the honest false positive it carries:

- `volume` — a uid with more window entries than the aggregate-feeding
  bank has questions. No honest client can do this (answers are
  create-only per question); it is a dedup failure or forged writes
  either way, so this one is the closest thing to a verdict.
- `cadence` — inter-answer gaps too regular or too fast to be a person
  reading questions. False positive: the closest honest shape is the
  backlog binge, which passes on its gap variance; thresholds in
  `functions/src/velocity.ts` (`CADENCE_*`).
- `cluster` — 5+ of the window's voting accounts created within 10
  minutes of each other. False positive: a launch spike, a press
  mention, a classroom. This is why flags feed review, not denial.
- `burst` — a question with an established quiet baseline suddenly
  taking 4× its trailing mean. False positive: a question going
  organically viral. Promoted questions' debut days deliberately cannot
  flag (no baseline yet).

A flag worth acting on becomes a uid list, and the uid list enters the
correction procedure above — attribute, subtract, republish, then
delete. Deliberately NO alert policy ships for these (this section's own
"applied by hand, once, deliberately" reasoning): the flags are a daily
read during calm, an hourly one during an incident. If evidence ever
justifies standing eyes, the `metric: velocity_flag` field is what a
log-based metric selects on — the plumbing is in the line already.

## Alerting (nine policies, seven log-based metrics)

Everything above assumes somebody already knows something is wrong. Until
this was added, nothing told them: detection was a human choosing to run
`functions:log`, and the failure this runbook calls the urgent case is
exactly the one that looks like nothing from the outside — the app keeps
serving, the Mirror just stops moving while Eventarc piles up redeliveries
for ~7 days.

> **One dispatch applies all of this**, idempotently and dry-run by
> default: the **Arm monitoring** workflow (`.github/workflows/monitoring.yml`),
> `apply` off to report and on to create. It runs behind the `production`
> environment gate, on `FIREBASE_SERVICE_ACCOUNT` — no local tooling, no
> login. Locally it is the same script:
>
> ```bash
> npm run monitoring:apply -- --email you@example.com           # report
> npm run monitoring:apply -- --email you@example.com --apply   # do it
> ```
>
> It creates the channel, then every log-based metric, then every policy —
> in that order, skipping whatever already exists. Then confirm with the
> instrument rather than by eye: `npm run observe` reads the project back
> and `armed` is the answer.
>
> **It used to need `gcloud`, and that is why none of this existed.** The
> script shelled out to an interactively-authenticated CLI nobody had logged
> in with, so it never ran — and on 2026-08-26 the observer found zero
> policies and zero metrics in the project, two days after the script was
> written to create every one of them (D300, D303). The manual steps below
> stay written out because the reason each object exists is the useful part,
> but they are no longer the way to do it: `gcloud alpha monitoring` needs
> the same login, and the same nobody has it.

`monitoring/onV2AnswerCreated-errors.json` is a Cloud Monitoring policy
that fires on any `severity>=ERROR` from that trigger. It is **not applied
by the pipeline**, for two reasons — neither of them the one this paragraph
used to give.

> **Correction (2026-08-04, D47).** It said "the deploy service account has
> no monitoring role". It has `Editor` + `Firebase Admin` (see the IAM note
> above), and `Editor` includes `monitoring.alertPolicies.create`. The
> permission was never the obstacle. The conclusion survives on better
> ground, which is what is written below.

A policy is useless without a notification channel id, and that id is not in
this repo and should not be — it is an email address or a Slack hook, per
operator, per project. And a pipeline that can rewrite an alert policy can
delete one, silently, in a deploy that was about something else; the
blast radius of getting that wrong is "you stop being told when the Mirror
stops moving". Applied by hand, once, deliberately. `npm run pulse` reports
policies as *committed*, never as *deployed*, because the repo cannot know
which. Apply it with:

```bash
# 1. Create a notification channel once (email; use --type=sms|slack etc. as preferred)
gcloud alpha monitoring channels create --project prvfire33 \
  --display-name="InSight oncall" --type=email \
  --channel-labels=email_address=YOU@EXAMPLE.COM

# 2. Note the returned channel id, then apply the policy with it attached
gcloud alpha monitoring policies create --project prvfire33 \
  --policy-from-file=monitoring/onV2AnswerCreated-errors.json \
  --notification-channels=projects/prvfire33/notificationChannels/CHANNEL_ID
```

Verify it: `gcloud alpha monitoring policies list --project prvfire33`.

### The second alert: aggregate contention

`monitoring/onV2AnswerCreated-contention.json` watches D7's per-question
write ceiling. It needs a log-based metric first, because what it counts
is a log line rather than a built-in signal:

```bash
# 1. The metric: one data point per contended aggregate write
gcloud logging metrics create agg_contention --project prvfire33 \
  --description="onV2AnswerCreated transaction attempts >= 3 (D7 write ceiling)" \
  --log-filter='severity>=WARNING AND jsonPayload.metric="agg_contention"'

# 2. The policy, with the same channel as above
gcloud alpha monitoring policies create --project prvfire33 \
  --policy-from-file=monitoring/onV2AnswerCreated-contention.json \
  --notification-channels=projects/prvfire33/notificationChannels/CHANNEL_ID
```

**This paragraph used to claim the error alert already carried this
signal**, and it did not — which is worth recording, because the mistake
is the kind that survives review. Contention is not an error: Firestore's
SDK retries an ABORTED transaction inside `runTransaction`, the write
commits, and nothing is ever logged above INFO. A policy filtering
`severity>=ERROR` cannot match that condition however severe it gets. So
D7's stated revisit trigger ("when `onV2AnswerCreated` starts logging
transaction retries") named an instrument that did not exist, and the
sentence here asserting the signal reached someone was describing a path
with no source at either end.

`runAggTransaction` (`functions/src/v2.ts`) now counts its own callback
invocations and logs at three attempts, which is the source; the metric
and policy above are the path.

### The third alert: the reveal scan going quiet

`monitoring/scheduledDuelReveals-silent.json` watches the duel reveal loop.
It is the first policy here that alerts on **absence** rather than on a
signal, and the difference is the point: the other two watch a trigger that
runs when a user acts, so an outage produces log lines. This watches a
cron, whose characteristic failure is not throwing but **not running** —
Cloud Scheduler stops firing, the function falls out of a deploy's `--only`
list, the revision fails to start. Nothing executes, so nothing logs, and a
`severity>=ERROR` policy stays green for the entire outage.

```bash
# 1. The metric: one data point per completed SCHEDULED scan.
#    The mode filter is load-bearing — see below.
gcloud logging metrics create duel_reveal_run --project prvfire33 \
  --description="scheduledDuelReveals completed a scheduled (indexed) scan" \
  --log-filter='jsonPayload.metric="duel_reveal_run" AND jsonPayload.mode="indexed"'

# 2. The policy, with the same channel as above
gcloud alpha monitoring policies create --project prvfire33 \
  --policy-from-file=monitoring/scheduledDuelReveals-silent.json \
  --notification-channels=projects/prvfire33/notificationChannels/CHANNEL_ID
```

**Why the metric filters on `mode`.** `runDuelReveals` is shared by the
schedule (`"indexed"`) and by `revealDuelsNowV2`'s manual lever, which
defaults to `"full"`. Both emit the heartbeat. Without the filter, an
operator running the lever during an incident — the first thing this
policy's own runbook tells them to do — would reset the absence timer and
silence the alert for the outage they are working on.

**Why this one does not wait for "someone is actually reading the alerts",
unlike the aggregators below.** A missed reveal does **not** self-heal.
`runDuelReveals` computes `const yester = dayKey || utcDayKey(-1)`, and the
schedule passes no `dayKey` — so every run handles *yesterday and only
yesterday*. A three-day outage does not resolve into a catch-up run; it
leaves two days permanently unrevealed, because no later scheduled run ever
looks at them again. Recovering them needs a manual `revealDuelsNowV2` with
an explicit `day`, which needs someone to know which days to name. The
detection gap and the data loss are the same window.

**Known limit, recorded rather than discovered later.** A metric-absence
condition needs a time series that has existed at least once; against a
metric with no points it does not fire. So this policy is blind to "the
scheduled reveal never worked at all" and only ever proves "it worked and
then stopped." Apply it, then confirm a first run actually landed —
confirm a first run actually landed with `gcloud logging read
'jsonPayload.metric="duel_reveal_run"' --limit 1 --project prvfire33`, or it
sits green meaning nothing. **Not `npm run observe`** — the observer reads
metric DEFINITIONS (`projects.metrics.list`), never log entries or a time
series, so it lists `duel_reveal_run` from the moment arming creates it,
whether or not a scan has ever run. This paragraph said `observe` for one
commit, which is the paragraph's own warning happening to the paragraph.

**Why these three came first.** An alert nobody acts on trains people to ignore
the channel, and at zero users most signals are noise. These are the
conditions where the gap between "broken" and "visibly broken" is measured
in days: a crashing trigger that accumulates redeliveries, a ceiling that
arrives as latency rather than as an error, and a cron whose silence is
indistinguishable from health. The scheduled aggregators
(`scheduledWorldAggregates`, `scheduledCityAggregates`) are the obvious
next — they are 24h jobs whose failure delays a surface by a day and
self-heals on the next run, so they can wait until someone is actually
reading the alerts. That "self-heals" is doing real work in this paragraph:
it is exactly what is NOT true of the reveal scan, which is why that one
did not wait.

## Running a deploy manually

- **From GitHub:** Actions -> "Deploy Firebase backend" -> "Run workflow"
  (or open a past run -> "Re-run all jobs").
- **Locally:** `firebase deploy --project prvfire33 --only "firestore:rules,functions"`

## Rotating / updating the credential

1. Firebase Console -> Project settings -> Service accounts -> **Generate new
   private key**.
2. Confirm the downloaded JSON's `client_email` is the project's
   `firebase-adminsdk` account (Project settings → Service accounts).
3. GitHub -> Settings -> Secrets and variables -> Actions -> edit
   `FIREBASE_SERVICE_ACCOUNT` and paste the **entire** JSON.

## Branch layout

The repo was consolidated to a single default branch, **`main`**, holding the
full app, the backend, and the CI workflow. Earlier scratch branches (the
temporary `main` and `project-startup-analysis`) were merged in and removed.

## Planned: Workload Identity Federation (drop the long-lived key)

The `FIREBASE_SERVICE_ACCOUNT` secret is a long-lived key written to
disk on every deploy run — the classic leak-shaped credential. GitHub
OIDC + Workload Identity Federation replaces it with short-lived tokens
minted per run. Console-side setup (one-time, needs a GCP admin):

1. `gcloud iam workload-identity-pools create github --project prvfire33
   --location global`
2. Create a provider in that pool for `https://token.actions.githubusercontent.com`
   with an attribute condition pinning this repo
   (`assertion.repository == 'Cosaxo/InSight'`).
3. Grant the `firebase-adminsdk` service account the
   `roles/iam.workloadIdentityUser` binding for that provider.
4. In `firebase-deploy.yml`: add `permissions: id-token: write`, swap
   the "Write service account key" step for `google-github-actions/auth@…`
   (SHA-pinned) with `workload_identity_provider` + `service_account`,
   and delete the secret.

**Cut over in this order.** Do WIF *first*, and keep the
`FIREBASE_SERVICE_ACCOUNT` secret and its key-writing step in place as a
fallback until WIF has completed one real deploy. Delete the secret only
afterwards. Reversing that order means discovering a misconfigured
provider with no way to ship.

### Narrowing the IAM roles is a separate change

Do not fold role narrowing into the WIF cutover — two variables, one
deploy, and a failure tells you nothing about which. Schedule it
separately and validate against a throwaway project first, because a
deploy that fails on a missing permission fails *partway through*.

Two things worth knowing before it is attempted:

- **Dropping `Editor` is not a data-access reduction on its own.** The
  account also holds `Firebase Admin`, which carries Firestore data
  access. Removing `Editor` while keeping `Firebase Admin` narrows what
  the credential can do to the *project*, not to the *data*. If the goal
  is "a leaked deploy key cannot read every answer", `firebase.admin` has
  to go too — and then the deploy needs a rules/functions-specific set
  instead.
- **The gen-2 minimum is wider than it looks.** Deploying gen-2 functions
  touches Cloud Run, Eventarc, Cloud Scheduler, Pub/Sub, Cloud Build,
  Artifact Registry and the runtime service account. A role list assembled
  from "it deploys rules and functions" will be missing several of these,
  and the failure surfaces mid-apply.

Until both land the key stays — rotate it periodically and re-check the
key/role mismatch trap below.

## Troubleshooting notes (issues hit during setup)

- **`An action could not be found at the URI ... auth/tar.gz` / download 403**
  — a flaky external action failed to download on the runner. Fixed by
  dropping `google-github-actions/auth` and authenticating via
  `GOOGLE_APPLICATION_CREDENTIALS`.
- **`firebaserules.googleapis.com ... HTTP Error: 403, The caller does not
  have permission`** — the deploying service account lacked IAM roles. Fixed
  by granting `Editor` + `Firebase Admin`.
- **403 persisted after granting roles** — the `FIREBASE_SERVICE_ACCOUNT`
  secret held a key for a *different* service account than the one granted
  roles. Fixed by re-issuing the key from that service account and
  updating the secret. (When auth succeeds but a specific API 403s, suspect a
  key/role mismatch.)
- **`Could not find rules for the following storage targets: rules`** —
  `--only storage:rules` treats `rules` as a deploy-target name, and this
  project configures no storage targets. Use `--only storage`. This one
  deserves its place here: it failed on every deploy for the workflow's
  whole life, invisibly, because the step is `continue-on-error` — a
  green run with a silently failed step. The general lesson: for any
  `continue-on-error` step, an audit means reading the step's log, not
  its checkmark.
