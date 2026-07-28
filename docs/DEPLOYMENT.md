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
- **Triggers:** push to `main` (paths `functions/**`, `firestore.rules`, the
  workflow file) and manual `workflow_dispatch`.
- **Steps:** checkout -> set up Node 22 -> install & build `functions` ->
  write `functions/.env.prvfire33` -> authenticate to Google Cloud ->
  `firebase deploy`.
- **Safety properties** (all three are load-bearing; don't drop them):
  - `needs: test` — the deploy waits on the Firestore rules suite, so a
    rules edit cannot reach production untested.
  - `environment: production` — scopes the secret and variables, and is
    where required reviewers or a wait timer would attach.
  - `concurrency: cancel-in-progress: false` — a queued push waits for the
    in-flight deploy instead of cancelling it mid-apply.
- **Deployed resources:**
  - Firestore rules (`firestore.rules`)
  - v2 functions: `seedContentV2`, `onV2AnswerCreated` (k-floored
    aggregates), `createGroupV2` / `joinGroupV2` / `leaveGroupV2`,
    `scheduledDuelReveals` / `revealDuelsNowV2` (reveals + push)
  - v1-era functions, still deployed: `rebuildAreaAggregates` /
    `scheduledAreaAggregates`, `rebuildWorldAggregates` /
    `scheduledWorldAggregates`, `rebuildCityAggregates` /
    `scheduledCityAggregates`, `sendInboundImpression`,
    `deleteAccount` (extended to wipe v2), `seedTaxonomies` /
    `scheduledTaxonomies`
  - The deploy runs with `--force` — `onV2AnswerCreated` has a retry
    policy, which the CLI refuses non-interactively otherwise

## Authentication

The pipeline authenticates with a service-account key stored as the GitHub
Actions secret `FIREBASE_SERVICE_ACCOUNT`.

- The workflow writes the secret to a temp file and sets
  `GOOGLE_APPLICATION_CREDENTIALS` to its path; the Firebase CLI reads it
  automatically. (We deliberately do **not** use the
  `google-github-actions/auth` action — its tarball repeatedly failed to
  download on the runner.)
- The key belongs to
  `firebase-adminsdk-qdsv5@prvfire33.iam.gserviceaccount.com`.
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

Check what is actually happening first:

```bash
npx firebase functions:log --project prvfire33
npx firebase functions:log --project prvfire33 --only onV2AnswerCreated
```

The aggregate ledger makes replay safe: `v2_agg_events/{eventId}` is
checked inside the same transaction that increments counts, so
redelivered events are no-ops rather than double counts.

## Running a deploy manually

- **From GitHub:** Actions -> "Deploy Firebase backend" -> "Run workflow"
  (or open a past run -> "Re-run all jobs").
- **Locally:** `firebase deploy --project prvfire33 --only "firestore:rules,functions"`

## Rotating / updating the credential

1. Firebase Console -> Project settings -> Service accounts -> **Generate new
   private key**.
2. Confirm the downloaded JSON's `client_email` is
   `firebase-adminsdk-qdsv5@prvfire33.iam.gserviceaccount.com`.
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
3. Grant `firebase-adminsdk-qdsv5@prvfire33.iam.gserviceaccount.com`
   the `roles/iam.workloadIdentityUser` binding for that provider.
4. In `firebase-deploy.yml`: add `permissions: id-token: write`, swap
   the "Write service account key" step for `google-github-actions/auth@…`
   (SHA-pinned) with `workload_identity_provider` + `service_account`,
   and delete the secret.

Until then the key stays — rotate it periodically and re-check the
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
  roles. Fixed by re-issuing the key from `firebase-adminsdk-qdsv5` and
  updating the secret. (When auth succeeds but a specific API 403s, suspect a
  key/role mismatch.)
