// The database this backend talks to (D165).
//
// WHY THIS FILE EXISTS. Every function used to call bare `getFirestore()`,
// which binds to `(default)` — 37 call sites across seven files. D165 moves
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
// variable silently keeps writing to the database D165 is migrating off,
// which is the failure this file exists to prevent.

import { getFirestore } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";

export const FIRESTORE_DB_ID = process.env.FIRESTORE_DB_ID || "insight";

/**
 * WHERE that database is, which is a price as much as a place (D198).
 *
 * Not read by any function — the region a function runs in is its own
 * `setGlobalOptions` setting and is deliberately not this. It is here
 * because this file is already the one place the database's identity may
 * be wrong, and until D198 the region was in NO machine-readable place at
 * all: `firebase.json` names the database, this file named the id, and the
 * region existed only in prose. So `scripts/cost-arith.mjs` went on
 * pricing `nam5` for three days after D165 moved production to a single
 * region, publishing a bill roughly twice the real one through the pulse
 * console every morning, and no gate could see it because the region was a
 * model INPUT rather than a quoted figure.
 *
 * A single region halves every Firestore line (docs/COSTS.md), so the
 * split below is the whole reason this constant is a string rather than a
 * boolean: multi-region locations are the two bare names, and every real
 * region has a `-` in it. Change this one string on a migration and the
 * cost model, the pulse and the docs all move with it.
 */
export const FIRESTORE_LOCATION = "europe-west1";

/** True when FIRESTORE_LOCATION is a single region rather than a multi-region. */
export const FIRESTORE_REGIONAL = FIRESTORE_LOCATION.includes("-");

/** The one Firestore handle every function uses. */
export function db(): Firestore {
  return getFirestore(FIRESTORE_DB_ID);
}
