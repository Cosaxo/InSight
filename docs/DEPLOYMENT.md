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
    where required reviewers or a wait timer would attach.
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
  - v2 functions: `seedContentV2`, `onV2AnswerCreated` (k-floored
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
  - The main apply runs with `--force` — `onV2AnswerCreated` has a retry
    policy, which the CLI refuses non-interactively otherwise

### One-off cleanup still owed in production (D13)

Dropping a function from the `--only` list stops **deploying** it; it does
not **delete** the deployed copy. The nine v1 functions removed in D13 are
still live in `prvfire33` until someone runs, once:

```bash
npx firebase functions:delete rebuildAreaAggregates scheduledAreaAggregates \
  rebuildWorldAggregates scheduledWorldAggregates rebuildCityAggregates \
  scheduledCityAggregates sendInboundImpression seedTaxonomies \
  scheduledTaxonomies --project prvfire33 --region us-central1 --force
```

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
accounts, the k-floor and publish cadence hide small distortions, and D28
records why no mechanism can make it complete. What the system guarantees
instead is that the published numbers stay **correctable**: answers are
immutable (D5), exact counts live server-side in `v2_aggs_private`, and
every counted answer leaves a `v2_agg_events` entry `{ qid, uid, at }`
for `LEDGER_RETENTION_DAYS` (90). This runbook is the procedure that
cashes that guarantee in. Write nothing here during an incident that this
section didn't already say while the system was calm.

**What this runbook does NOT do is find the ring.** Identification is
investigative — Auth creation-time clusters, App Check token metadata in
the function logs, answer velocity across `v2_agg_events` timestamps.
What is guaranteed is mechanical once you HAVE a uid list: attribution,
subtraction, republication, in that order.

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
3. **Subtract, in a transaction per qid.** In `v2_aggs_private/{qid}`:
   decrement `counts[optionIdx]` (or `ent[entity]`) and `total` per
   attributed answer, and the `by`/`entBy` cells for the anchors on that
   answer doc — the snapshot-at-vote-time rule (D8) is what makes this
   subtraction exact rather than approximate.
4. **Republish through the same floors.** Rewrite
   `v2_question_aggs/{qid}` from the corrected private doc exactly as the
   trigger would: `tooSmall: true` below `AGG_MIN_N`, else counts +
   `publishableBreakdown(by, AGG_MIN_N)`. A hand-written public doc that
   skips the floors is a worse incident than the one being corrected.
5. **Then delete the accounts** (admin SDK), which removes their answer
   docs and — via the uid sweep — their ledger entries.

Bounds, so nobody discovers them mid-incident: entries older than 90 days
have expired, so a ring dormant longer than the window is subtractable
only for its last 90 days of activity. An account erased via
`deleteAccount` took its attribution with it — right-to-erasure wins over
forensics by design (D28 records the trade). No correction script ships
in this repo: the first real incident should shape one against its actual
form, not inherit an untested one; what must not be improvised is the
order of operations above.

## Alerting (two alerts, deliberately)

Everything above assumes somebody already knows something is wrong. Until
this was added, nothing told them: detection was a human choosing to run
`functions:log`, and the failure this runbook calls the urgent case is
exactly the one that looks like nothing from the outside — the app keeps
serving, the Mirror just stops moving while Eventarc piles up redeliveries
for ~7 days.

`monitoring/onV2AnswerCreated-errors.json` is a Cloud Monitoring policy
that fires on any `severity>=ERROR` from that trigger. It is **not applied
by the pipeline** — the deploy service account has no monitoring role, and
widening it for one policy is a worse trade than applying this by hand
once. Apply it with:

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

**Why only these two.** An alert nobody acts on trains people to ignore
the channel, and at zero users most signals are noise. These are the two
conditions where the gap between "broken" and "visibly broken" is measured
in days: a crashing trigger that accumulates redeliveries, and a ceiling
that arrives as latency rather than as an error. The scheduled aggregators
(`scheduledWorldAggregates`, `scheduledCityAggregates`) are the obvious
next — they are 24h jobs whose failure delays a surface by a day and
self-heals on the next run, so they can wait until someone is actually
reading the alerts.

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
