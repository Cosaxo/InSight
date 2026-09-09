// The one Firestore handle every operator script uses.
//
// WHY THIS EXISTS. `getFirestore()` with no argument binds to the
// `(default)` database. This app does not live there: every function goes
// through `functions/src/db.ts`'s `getFirestore(FIRESTORE_DB_ID)`, the
// rules and indexes are deployed against `insight` (`firebase.json`), and
// the web client passes the same id as its third argument. All four
// admin-SDK scripts in this directory called the bare form, so every one
// of them read and wrote a database the app never touches — the operator
// levers, the purchase ledger's pen, and the rate card's own source.
//
// It is the defect D333 found in runbook 5.1 the day before, in a gcloud
// command that "named no `--database`, which defaults to `(default)`" and
// "had it been run as written it would have exited 0, configured nothing
// that matters, and left the promise looking kept." Same mistake, one
// layer over, four times, and the same shape of consequence: a command
// that succeeds and does nothing.
//
// `(default)` has since been deleted, so the bare form now fails
// NOT_FOUND rather than succeeding against the wrong data. That is
// better — but it means these scripts were broken outright, not merely
// pointed elsewhere.
//
// scripts/admin-db.test.mjs refuses a bare `getFirestore()` anywhere in
// this directory, so a fifth script cannot repeat it.
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

/** The database the app actually serves from. Mirrors functions/src/db.ts. */
export const FIRESTORE_DB_ID = process.env.FIRESTORE_DB_ID || "insight";

/**
 * Initialise the admin app and return a handle on the RIGHT database.
 *
 * `emulator` mirrors what each script already did: point
 * FIRESTORE_EMULATOR_HOST at the local emulator if the caller has not,
 * and skip the credential, which firebase-admin refuses to combine with
 * an emulator host.
 */
export function adminDb({ projectId, emulator = false } = {}) {
  if (emulator && !process.env.FIRESTORE_EMULATOR_HOST) {
    process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
  }
  initializeApp(emulator ? { projectId } : { credential: applicationDefault(), projectId });
  return getFirestore(FIRESTORE_DB_ID);
}

/**
 * The Auth handle, for the operator scripts that read account state rather
 * than documents. Init lives here for the same reason `adminDb` does: one
 * place that decides how this process authenticates, so a second script
 * cannot quietly pick a different answer.
 *
 * No database id involved — Auth is project-scoped, so the `(default)`
 * trap above does not apply here.
 */
export function adminAuth({ projectId, emulator = false } = {}) {
  if (emulator && !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
  }
  initializeApp(emulator ? { projectId } : { credential: applicationDefault(), projectId });
  return getAuth();
}
