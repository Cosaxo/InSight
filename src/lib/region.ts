// Where this client's callables live (D199).
//
// A zero-import leaf module on purpose. The obvious home was
// `firebaseImpl.ts`, beside `FIRESTORE_DB_ID` — and importing a constant
// from there statically would drag the whole lazily-loaded implementation,
// and the Firebase SDK behind it, back into the first-paint graph. That is
// the D110 regression `firebase.ts`'s header is written about, and it went
// unnoticed for weeks the first time. A file with no imports of its own
// cannot cause it.
//
// ONE CONSTANT, because the alternative already exists in this repo's
// history twice: D165 moved the database and missed 37 call sites, and
// D198 found the location spelled out in eight client files with no single
// place to change it. A region that reaches some call sites and not others
// is worse than one that reaches none — the stragglers call a region
// nothing serves, and a callable in an unserved region is a 404 the SDK
// reports as `internal` with nothing in it to read.
//
// It must equal the region the functions are deployed to
// (`FUNCTIONS_REGION` in `functions/src/ops.ts`). `check:fn-runtime` reads
// this constant and the COMPILED endpoints and fails if they disagree,
// which is the only comparison that survives one side being edited alone.
export const FUNCTIONS_REGION = "europe-west1";
