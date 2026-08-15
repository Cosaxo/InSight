// The database this backend talks to (D157).
//
// WHY THIS FILE EXISTS. Every function used to call bare `getFirestore()`,
// which binds to `(default)` — 37 call sites across seven files. D157 moves
// the app to a named regional database, and `docs/FIRESTORE-REGION.md`'s
// procedure listed three edits and missed all 37 of these.
//
// That omission is a THIRD silent failure of the same family as the two
// that document already names, and the worst of the three: with only the
// trigger's `database:` option set, a trigger fires on the new database and
// then writes its aggregate to the old one through this handle. The deploy
// is green, the functions are healthy, every answer writes — and the ledger,
// the private aggregate and the published mirror all land in a database
// nothing reads. Split brain, no error anywhere.
//
// One accessor rather than 37 literal edits, so there is exactly one place
// this can ever be wrong again, and `check:fn-runtime` can assert it.
//
// ENV-OVERRIDABLE, and the default is production. The emulator suites can
// point at whatever database they serve by setting FIRESTORE_DB_ID; nothing
// else should set it. A default of `(default)` would have been the safer
// literal and the wrong choice — it would mean a deploy that forgets the
// variable silently keeps writing to the database D157 is migrating off,
// which is the failure this file exists to prevent.

import { getFirestore } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";

export const FIRESTORE_DB_ID = process.env.FIRESTORE_DB_ID || "insight";

/** The one Firestore handle every function uses. */
export function db(): Firestore {
  return getFirestore(FIRESTORE_DB_ID);
}
