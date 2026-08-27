// The order deleteAccount's phases run in, where the order is the fix.
//
// The nightly folds — the interest profile, the patterns state, the
// engagement rollup — READ the agg-events ledger and WRITE per-uid
// documents under `v2_users/{uid}` from what they find. The ledger wipe
// used to run a dozen phases AFTER the subtree wipe, so a fold that
// started while an erasure was in flight saw the account's rows and wrote
// its profile back under a subtree that had just been deleted. Nothing
// removes it afterwards: the auth user is gone and deleteAccount can
// never run for that uid again, while docs/data-inventory.md promises the
// opposite in as many words.
//
// Two properties hold the fix, and NEITHER IS OBSERVABLE FROM THE
// OUTSIDE — the race is a timing window inside one call, so the erasure
// e2e cannot drive it. What can be pinned is the shape: the ledger goes
// first, and the subtree is swept again at the end. Both are one edit
// away from silently reverting, and a reverted one looks exactly like a
// working one until somebody deletes their account during a fold.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = readFileSync(join(root, "functions", "src", "index.ts"), "utf8");

/** Where deleteAccount's body starts — everything below is inside it. */
const bodyAt = () => {
  const at = SRC.indexOf("export const deleteAccount = onCall(");
  expect(at, "the deleteAccount callable is gone — this file no longer describes erasure").toBeGreaterThan(-1);
  return at;
};

describe("deleteAccount's phase order", () => {
  const body = () => SRC.slice(bodyAt());

  it("wipes the agg-events ledger BEFORE the v2 subtree", () => {
    const b = body();
    const ledger = b.indexOf('db.collection("v2_agg_events").where("uid", "==", uid)');
    const subtree = b.indexOf('db.recursiveDelete(db.collection("v2_users").doc(uid))');
    expect(ledger, "the agg-events wipe is gone").toBeGreaterThan(-1);
    expect(subtree, "the v2 subtree wipe is gone").toBeGreaterThan(-1);
    expect(
      ledger,
      "the ledger is wiped AFTER the subtree again — a nightly fold starting mid-erasure "
        + "will read the account's rows and write its per-uid documents back under a subtree "
        + "that has just been deleted, permanently",
    ).toBeLessThan(subtree);
  });

  it("sweeps the subtree AGAIN after the last phase", () => {
    const b = body();
    const sweeps = [...b.matchAll(/db\.recursiveDelete\(db\.collection\("v2_users"\)\.doc\(uid\)\)/g)];
    expect(
      sweeps.length,
      "the closing subtree sweep is gone — anything a fold commits during the erasure's "
        + "own phases survives it",
    ).toBeGreaterThanOrEqual(2);
    // …and the second one is after every other wipe, which is what makes
    // it a sweep rather than a repeat.
    const last = sweeps[sweeps.length - 1].index;
    const lastOtherWipe = Math.max(
      b.lastIndexOf('db.collection("v2_paid_bookings").where("uid", "==", uid)'),
      b.lastIndexOf('db.collection("v2_suggestions")'),
      b.lastIndexOf('db.collection("v2_purchases").where("uid", "==", uid)'),
    );
    expect(lastOtherWipe, "none of the late phases were found — the anchors moved").toBeGreaterThan(-1);
    expect(last, "the closing sweep runs before phases that can still write").toBeGreaterThan(lastOtherWipe);
  });

  it("still aborts before the auth delete if anything failed", () => {
    // The property the new sweep must not break: a failed phase leaves
    // the user signed in and able to retry, rather than orphaning data
    // under an account that no longer exists.
    const b = body();
    const abort = b.indexOf("Deletion incomplete");
    const authDelete = b.indexOf("deleteUser(uid)");
    expect(abort).toBeGreaterThan(-1);
    expect(authDelete, "the auth delete is gone").toBeGreaterThan(-1);
    expect(abort, "the abort no longer precedes the auth delete").toBeLessThan(authDelete);
    // and the sweep is inside the part that can push onto `failed`
    expect(b.indexOf('failed.push("v2SubtreeSweep")')).toBeGreaterThan(-1);
    expect(b.indexOf('failed.push("v2SubtreeSweep")')).toBeLessThan(abort);
  });
});
