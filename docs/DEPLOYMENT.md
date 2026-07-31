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

> **`prvfire33` is the only project, so merging to `main` IS deploying to
> production.** There is no staging environment; the sole gate is
> `backend-checks`. That is deliberate and recorded in
> [D25](./DECISIONS.md#d25--there-is-one-firebase-project-and-merging-to-main-is-what-deploys-it),
> along with what an emulator gate structurally cannot catch (cold-start
> module loads, IAM, async index builds, `onSchedule` triggers) and the two
> changes that would fix it, cheapest first. Worth knowing before you merge
> a PR that touches `functions/**` — see "Planned: manual production
> deploys, then a staging project" below.

## Pipeline

- **Workflow:** `.github/workflows/firebase-deploy.yml`
- **Triggers:** push to `main` (paths `functions/**`, `firestore.rules`, the
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
  - Firestore rules (`firestore.rules`)
  - v2 functions: `seedContentV2`, `onV2AnswerCreated` (k-floored
    aggregates), `createGroupV2` / `joinGroupV2` / `leaveGroupV2`,
    `registerPushToken`, `scheduledDuelReveals` / `revealDuelsNowV2`
    (reveals + push)
  - `deleteAccount` — the one v1-era function that carries forward, and
    it still wipes the v1 collections (D13)
  - The deploy runs with `--force` — `onV2AnswerCreated` has a retry
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

Two values reach the deployed runtime, both as **variables on the
`production` environment** (GitHub → Settings → Environments → `production`
→ Variables — not secrets, and not committed files):

| Variable | Read by | Effect |
| --- | --- | --- |
| `SEED_ADMIN_UIDS` | `functions/src/ops.ts` → `assertOperator()` | Comma-separated uids allowed to call the operator-only callables (`seedContentV2`, `revealDuelsNowV2`, `rebuild*`). Unset ⇒ **every** operator callable returns `permission-denied`. |
| `APPCHECK_ENFORCE` | `functions/src/ops.ts` → `ENFORCE_APP_CHECK` | Only the exact string `false` disables App Check enforcement, as an incident escape hatch. Unset (the normal state) ⇒ enforced. |

The deploy job writes these to `functions/.env.prvfire33`, which the CLI
bakes into each function's runtime config. The filename is
project-scoped deliberately: a future non-prod project must not inherit
production operator uids. `.env` and `.env.*` are gitignored repo-wide,
so the workflow variable is the only path into production — a deploy with
`SEED_ADMIN_UIDS` unset still succeeds, but logs a `::warning::` and
leaves the question bank unseedable.

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

## Alerting (one alert, deliberately)

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

**Why only one alert.** An alert nobody acts on trains people to ignore
the channel, and at zero users most signals are noise. This is the single
condition where the gap between "broken" and "visibly broken" is measured
in days rather than seconds. The scheduled aggregators
(`scheduledWorldAggregates`, `scheduledCityAggregates`) are the obvious
second and third — they are 24h jobs whose failure delays a surface by a
day and self-heals on the next run, so they can wait until someone is
actually reading the alerts. D7 records the retry-logging threshold that
should trigger revisiting the sharding decision; this alert is how that
signal reaches anyone.

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

## Planned: manual production deploys, then a staging project

Full reasoning and the revisit trigger are in
[D25](./DECISIONS.md#d25--there-is-one-firebase-project-and-merging-to-main-is-what-deploys-it).
Two separable changes, in this order — the first is most of the value:

1. **Stop deploying on merge.** In `firebase-deploy.yml`, drop the
   `push: branches: [main]` trigger and keep `workflow_dispatch`. Merging
   becomes merging; deploying becomes a decision. No new project, no new
   secrets. The `environment: production` block already exists so required
   reviewers or a wait timer can be added without touching the file.
2. **Add a staging project** once there are users to protect. A second
   Firebase project deployed on merge, with production behind the manual
   trigger from step 1. What it needs:
   - a Firebase project (free tier is enough for staging);
   - a second service-account secret and a `staging` GitHub environment,
     with its own `SEED_ADMIN_UIDS` / `MOD_UIDS` — **not** production's;
   - parameterising the project id: `--project prvfire33` is currently
     hardcoded in all three deploy steps (storage rules, rules + functions,
     hosting);
   - one `seedContentV2` call against it to fill the question bank.

   No change is needed to the runtime-env plumbing: the deploy already
   writes `functions/.env.<projectId>`, which is why the section above says
   a future non-prod project must not inherit production operator uids.

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
