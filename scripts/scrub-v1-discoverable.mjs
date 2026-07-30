// One-time operator cleanup of the retired v1 `insight_discoverable`
// collection.
//
//   node scripts/scrub-v1-discoverable.mjs --project prvfire33            # report
//   node scripts/scrub-v1-discoverable.mjs --project prvfire33 --apply    # delete
//
// Needs admin credentials: GOOGLE_APPLICATION_CREDENTIALS pointing at a
// service-account key, or `gcloud auth application-default login`.
// firebase-admin is a root devDependency, so `npm ci` is enough.
//
// ── Why this deletes rather than truncates ──────────────────────────
//
// docs/SHIP-CHECKLIST.md asked for a scrub that "truncates
// location.geohash to 5 chars and deletes location.geopoint", on the
// stated grounds that "rules now cap insight_discoverable writes to a
// bare geohash5 cell". That was true when written and is not true now,
// and the change makes truncation the wrong operation:
//
//   - The cap it refers to is `isValidDiscoverableWrite()`, which lives
//     in firestore.rules.v1-archive — UNdeployed. The live
//     firestore.rules has no insight_discoverable block at all: D4
//     retired the whole v1 client surface, and rules.test.ts pins read
//     AND write as denied, to owner and stranger alike.
//   - Nothing writes the collection (D4 deleted the v1 client that did).
//     Nothing reads it (D13 deleted the three aggregator families that
//     were its only readers). deleteAccount's per-uid delete is the sole
//     remaining reference in the tree.
//   - Truncating the geohash leaves the rest of the document standing:
//     `personality` (Big Five vector), `political` (econ/social
//     coordinates — special-category data under GDPR Art. 9), `age`,
//     `bio`, `role`, `displayName`. docs/data-inventory.md is explicit
//     that "the honest scope is the whole document, not just its
//     location field", and gates the store privacy answers on this
//     having run.
//
// So the collection is: no writer, no reader, backing a feature removed
// in D4, holding Art. 9 data. Truncating one field of it would satisfy
// the letter of the old checklist line and leave the actual exposure —
// a psychometric and political profile keyed by uid — sitting in
// production indefinitely. Deleting the documents is both the smaller
// operation and the honest one.
//
// This is deliberately NOT a Cloud Function. It runs once, by hand, with
// a human reading the dry-run output first; a deployed callable that can
// empty a collection is a standing risk in exchange for nothing.
//
// ── Not covered here ────────────────────────────────────────────────
//
// The other inert v1 residue — `aggregates_by_geohash5` / `_world` /
// `_city` / `_media` and `taxonomies` — is k-floored anonymous rollups
// and static taxonomy rows carrying no per-user provenance. Nothing
// reads them either, and they are worth dropping, but they are not
// personal data and the console handles them in a click. D13 tracks
// them; docs/DEPLOYMENT.md has the functions:delete command that goes
// with them.

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const COLLECTION = "insight_discoverable";
const BATCH = 400; // Firestore's batch limit is 500; headroom, as in deleteAccount.

// Field names from the archived write rule (firestore.rules.v1-archive
// :437-490). Grouped by why they matter, because the dry-run report is
// the thing a human reads before authorising a delete.
const FIELD_GROUPS = [
  ["special category (GDPR Art. 9)", ["political"]],
  ["psychometric", ["personality"]],
  ["identifying / free text", ["displayName", "bio", "role", "age", "photoColor"]],
];

const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const projectId = (() => {
  const i = argv.indexOf("--project");
  return i >= 0 ? argv[i + 1] : undefined;
})();

// Required rather than inferred from the environment. The whole point of
// this script is that it empties a collection; picking the project up
// from an ambient GCLOUD_PROJECT is how it gets pointed at the wrong one.
if (!projectId) {
  console.error(
    "scrub-v1-discoverable: --project is required.\n\n" +
      "  node scripts/scrub-v1-discoverable.mjs --project prvfire33\n\n" +
      "It is not inferred from the environment on purpose — this script\n" +
      "deletes documents, and an ambient GCLOUD_PROJECT is how that lands\n" +
      "on the wrong project.",
  );
  process.exit(1);
}

let db;
try {
  initializeApp({ credential: applicationDefault(), projectId });
  db = getFirestore();
} catch (err) {
  console.error(
    `scrub-v1-discoverable: could not initialise the admin SDK.\n${err.message}\n\n` +
      "Set GOOGLE_APPLICATION_CREDENTIALS to a service-account key, or run\n" +
      "`gcloud auth application-default login`.",
  );
  process.exit(1);
}

const col = db.collection(COLLECTION);

// ── Pass 1: report ──────────────────────────────────────────────────
//
// Counts field PRESENCE and never prints a value. The report exists to
// justify a delete, and echoing someone's political coordinates into a
// terminal — and from there into a scrollback, a CI log or a screenshot
// — would be its own disclosure. Uid document IDs are not printed for
// the same reason.

const present = new Map(); // field name → count of docs carrying it
let total = 0;
let withGeopoint = 0;
let withLongGeohash = 0;

let cursor = null;
for (;;) {
  let q = col.orderBy("__name__").limit(BATCH);
  if (cursor) q = q.startAfter(cursor);
  const snap = await q.get();
  if (snap.empty) break;

  for (const doc of snap.docs) {
    total++;
    const d = doc.data();
    for (const [, fields] of FIELD_GROUPS) {
      for (const f of fields) {
        if (d[f] !== undefined && d[f] !== null) {
          present.set(f, (present.get(f) ?? 0) + 1);
        }
      }
    }
    const loc = d.location;
    if (loc && typeof loc === "object") {
      if (loc.geopoint !== undefined && loc.geopoint !== null) withGeopoint++;
      if (typeof loc.geohash === "string" && loc.geohash.length > 5) withLongGeohash++;
    }
  }

  cursor = snap.docs[snap.docs.length - 1];
  if (snap.docs.length < BATCH) break;
}

console.log(`\n${COLLECTION} on project ${projectId}\n`);

if (total === 0) {
  console.log(
    "  0 documents — nothing to do.\n\n" +
      "  If this project has served real users, that is the expected end\n" +
      "  state and docs/data-inventory.md's precondition is met: the store\n" +
      "  privacy answers can treat the v1 discoverable data as gone.\n",
  );
  process.exit(0);
}

console.log(`  ${total} document(s)\n`);
for (const [label, fields] of FIELD_GROUPS) {
  const rows = fields
    .map((f) => [f, present.get(f) ?? 0])
    .filter(([, n]) => n > 0);
  if (!rows.length) continue;
  console.log(`  ${label}:`);
  for (const [f, n] of rows) console.log(`    ${f.padEnd(14)} ${n}`);
}
if (withGeopoint || withLongGeohash) {
  console.log("  location:");
  if (withGeopoint) console.log(`    ${"geopoint".padEnd(14)} ${withGeopoint}  (exact coordinates)`);
  if (withLongGeohash) console.log(`    ${"geohash >5".padEnd(14)} ${withLongGeohash}  (finer than the ~5km cell)`);
}

if (!apply) {
  console.log(
    `\n  Dry run — nothing was changed. Re-run with --apply to delete all\n` +
      `  ${total} document(s).\n\n` +
      `  Deleting is the recorded remedy (see the header of this file for\n` +
      `  why, and D13 in docs/DECISIONS.md): the collection has no writer\n` +
      `  and no reader, and erasure requests have no other path to it.\n`,
  );
  process.exit(0);
}

// ── Pass 2: delete ──────────────────────────────────────────────────
//
// Re-queries from the top each round rather than paging with a cursor:
// the documents are being removed as we go, so a cursor into a shrinking
// collection is the classic way to skip a page.

let deleted = 0;
for (;;) {
  const snap = await col.limit(BATCH).get();
  if (snap.empty) break;
  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  deleted += snap.docs.length;
  console.log(`  deleted ${deleted}/${total}…`);
  if (snap.docs.length < BATCH) break;
}

console.log(
  `\n  Done — ${deleted} document(s) deleted from ${COLLECTION}.\n\n` +
    `  Next: docs/data-inventory.md gates the store privacy answers on\n` +
    `  this scrub. With the collection empty, the v1 special-category and\n` +
    `  location data it described is gone; answer the forms from the v2\n` +
    `  surface only (docs/SHIP-CHECKLIST.md §3 has the table).\n`,
);
