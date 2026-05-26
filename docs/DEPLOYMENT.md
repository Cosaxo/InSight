# Backend Deployment & CI/CD

How the InSight backend — Firestore security rules and Cloud Functions — is
deployed, and how the GitHub Actions pipeline is wired up.

## Overview

Backend deploys are automated. Any push to `main` that changes
`functions/**`, `firestore.rules`, or the workflow file deploys to the
Firebase project `prvfire33`. Routine backend changes need no manual deploy.

## Pipeline

- **Workflow:** `.github/workflows/firebase-deploy.yml`
- **Triggers:** push to `main` (paths `functions/**`, `firestore.rules`, the
  workflow file) and manual `workflow_dispatch`.
- **Steps:** checkout -> set up Node 20 -> install & build `functions` ->
  authenticate to Google Cloud -> `firebase deploy`.
- **Deployed resources:**
  - Firestore rules (`firestore.rules`)
  - Cloud Functions: `rebuildAreaAggregates`, `scheduledAreaAggregates`,
    `rebuildWorldAggregates`, `scheduledWorldAggregates`,
    `rebuildCityAggregates`, `scheduledCityAggregates`,
    `sendInboundImpression`, `deleteAccount`, `seedTaxonomies`,
    `scheduledTaxonomies`

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
