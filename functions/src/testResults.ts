// The four passive test results, written by the server so their SIZE can be
// bounded — the half of the profile-size question D429 could not reach.
//
// WHY THIS EXISTS. `v2_users/{uid}` is world-readable by design (D98) and
// `voters.ts` resolves THIRTY of them per query with no field mask, so every
// byte on a profile is a byte every reader of that person downloads. Every
// other client-writable field there is bounded — `displayName` at 60
// characters, each anchor at its own leaf, the stamps to `int|timestamp`.
// `testResults` was not: D429 (2026-09-09) bounded which KEYS may appear
// (the five-name vocabulary) and explicitly left the size inside a
// legitimate kind open, because *there is no rules expression for it*.
// Firestore rules have no quantifier over a list and no byte measure for a
// nested map, so `dims` can be a list of eight entries whose `label` is a
// megabyte each and no `allow` clause can see it. Measured before this
// change: a 300 KB string in `testResults.big5` was ACCEPTED where a
// 61-character display name was refused.
//
// So the bound has to live where an expression CAN run, which is here. This
// is the shape `OWNER-LIST.md` priced as "server-only, like its own `logic`
// key already is" and recommended; the owner chose it on 2026-09-09.
//
// AND IT MAKES THE RULES CHEAPER, which is why it is worth doing on this
// path in particular. Once the client may not change `testResults` at all,
// the vocabulary check and the `logic`-is-immutable check both become dead
// weight — one comparison replaces them — and D429 measured the profile arm
// at only 80–140 expressions below the runtime ceiling. This spends none of
// that headroom; it returns some.
//
// `logic` is NOT written here. It has its own callable (`logicSubmitV2`),
// which scores against a server-held seed; this one takes a result the
// device computed, so it can only bound the shape, never verify the number.
// That is the honest difference between the two and it is why the passive
// results stay `passive: true` in the stored document.

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { ENFORCE_APP_CHECK, LIGHT_CALLABLE, FUNCTIONS_REGION } from "./ops";
import { db as firestore } from "./db";

const REGION = FUNCTIONS_REGION;

/**
 * The kinds a CLIENT may write. `logic` is deliberately absent — it is
 * server-scored by `logicSubmitV2` and a client-writable copy would be a
 * forgeable one (D57). This is `CORE_TEST_KINDS` (src/v2/data/similarity.ts)
 * and `IS_TESTS`' own key set, which agree by construction: the device
 * folds exactly these four and `syncPassiveResults` iterates the same
 * constant.
 */
export const CLIENT_TEST_KINDS = ["big5", "political", "values", "attachment"] as const;

/**
 * The kinds a client may REMOVE. `logic` is here and not above, and the
 * asymmetry is the whole point: writing a verified score would be forgery
 * (D57), deleting your own is not.
 *
 * It is carried over rather than invented. Until the rules made this field
 * server-only, `firestore.rules` allowed exactly this and said why in its
 * own test — "it is your doc; the cooldown and the norms count live in the
 * server-only attempt doc, so deletion resets nothing". No surface in the
 * app has ever called it, but a capability that exists should move when its
 * write path moves rather than disappear because nothing happened to be
 * using it.
 */
export const REMOVABLE_TEST_KINDS = [...CLIENT_TEST_KINDS, "logic"] as const;

// ── the bounds ──
//
// Every one of these is a real ceiling on a real field of `PassiveResult`
// (src/v2/data/passiveProfile.ts), set well clear of what the folds emit so
// a legitimate result is never refused: the widest instrument today is the
// Big Five at five dims, and its longest label is "Conscientiousness" (17).
// Together they cap a stored result at roughly 700 bytes, against the ~1 MiB
// a client could park before this existed.
const MAX_DIMS = 8;
const MAX_TITLE = 60;
const MAX_TAKEN = 60;
const MAX_DIM_ID = 16;
const MAX_DIM_LABEL = 40;

function shortString(v: unknown, max: number): v is string {
  return typeof v === "string" && v.length <= max;
}

/**
 * The stored shape, validated field by field. Returns the value to write —
 * REBUILT rather than passed through, so an unknown extra key cannot ride
 * along on a document everyone downloads. That is the difference between
 * checking a payload and accepting one.
 */
export function validatePassiveResult(raw: unknown): Record<string, unknown> {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r !== "object" || Array.isArray(r)) {
    throw new HttpsError("invalid-argument", "result must be an object");
  }
  if (!shortString(r.title, MAX_TITLE)) {
    throw new HttpsError("invalid-argument", `title must be a string of at most ${MAX_TITLE} characters`);
  }
  if (!shortString(r.taken, MAX_TAKEN)) {
    throw new HttpsError("invalid-argument", `taken must be a string of at most ${MAX_TAKEN} characters`);
  }
  if (r.passive !== true) {
    throw new HttpsError("invalid-argument", "passive must be true — this callable writes folded results only");
  }
  for (const k of ["answered", "total"] as const) {
    const n = r[k];
    if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > 100000) {
      throw new HttpsError("invalid-argument", `${k} must be a non-negative integer`);
    }
  }
  if (!Array.isArray(r.dims) || r.dims.length > MAX_DIMS) {
    throw new HttpsError("invalid-argument", `dims must be a list of at most ${MAX_DIMS} entries`);
  }
  // The loop the rules could not write. This is the whole reason the write
  // moved to a server.
  const dims = r.dims.map((d: unknown) => {
    const e = d as Record<string, unknown> | null;
    if (!e || typeof e !== "object" || Array.isArray(e)) {
      throw new HttpsError("invalid-argument", "each dim must be an object");
    }
    if (!shortString(e.id, MAX_DIM_ID)) {
      throw new HttpsError("invalid-argument", `dim id must be a string of at most ${MAX_DIM_ID} characters`);
    }
    if (!shortString(e.label, MAX_DIM_LABEL)) {
      throw new HttpsError("invalid-argument", `dim label must be a string of at most ${MAX_DIM_LABEL} characters`);
    }
    const value = e.value;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) {
      throw new HttpsError("invalid-argument", "dim value must be a number in 0..100");
    }
    return { id: e.id, label: e.label, value };
  });
  return { title: r.title, taken: r.taken, dims, passive: true, answered: r.answered, total: r.total };
}

/**
 * Write or remove one passive test result on the caller's own profile.
 *
 * `result: null` REMOVES the key, and that arm is load-bearing rather than a
 * convenience: it is how a political-consent withdrawal takes the published
 * coordinate down (D331), and how `syncPassiveResults` removes a coordinate
 * a pre-gate build published. Both used to be client `deleteField()` writes.
 *
 * Offline, this is a callable and so it simply fails where a Firestore write
 * would have queued — which is survivable HERE and was checked rather than
 * assumed: the device deletes its local copy first and `syncPassiveResults`
 * re-attempts the removal on every hydrate, so a withdrawal made offline is
 * retried on the next boot rather than lost. The local mirror is what the
 * screen reads in the meantime, so the toggle never lies to the person who
 * set it.
 */
export const saveTestResultV2 = onCall(
  { ...LIGHT_CALLABLE, region: REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "sign-in required");

    const data = (req.data || {}) as {
      kind?: unknown;
      result?: unknown;
      politicalConsent?: unknown;
    };
    const kind = data.kind;
    const removing = data.result === null;
    // The allowed set depends on the DIRECTION, which is why the check
    // reads the removing flag first: `logic` may be removed and never
    // written. Names the set rather than echoing the input — the message
    // is read by a developer, and the input is attacker-controlled.
    const allowed: readonly string[] = removing ? REMOVABLE_TEST_KINDS : CLIENT_TEST_KINDS;
    if (typeof kind !== "string" || !allowed.includes(kind)) {
      throw new HttpsError(
        "invalid-argument",
        `kind must be one of ${allowed.join(", ")}${removing ? "" : " (logic is written by logicSubmitV2 only)"}`,
      );
    }

    const value = removing ? FieldValue.delete() : validatePassiveResult(data.result);

    // THE WITHDRAWAL'S OTHER HALF, IN THE SAME WRITE — and it is here for
    // a property that predates this callable. Taking the political
    // coordinate down used to be one client merge that carried the consent
    // record with it, and `vote.test.ts` pinned exactly that: "One merge,
    // so a partial failure cannot land that state." The state it means is
    // a profile still publishing a six-axis coordinate behind a switch
    // reading "off", which is worse than no switch because it is a claim.
    //
    // Splitting the write across a client consent merge and this callable
    // would have reintroduced that window whenever the call failed — the
    // offline case in particular, where the old Firestore write simply
    // queued. So the record travels WITH the removal and both land in one
    // `set`, which is stronger than what it replaced rather than weaker:
    // it is now one server-side write instead of one client-side one.
    //
    // Only the withdrawal needs this. Granting consent touches no test
    // result, so it stays an ordinary client write.
    const consent = data.politicalConsent;
    const withConsent = consent !== undefined;
    // Hoisted, because the WRITE below rebuilds the record from these
    // three fields rather than passing the caller's object through — see
    // the note there.
    const c = consent as Record<string, unknown> | null;
    if (withConsent) {
      if (kind !== "political" || !removing) {
        throw new HttpsError(
          "invalid-argument",
          "politicalConsent may only ride along with a political removal",
        );
      }
      if (!c || typeof c !== "object" || Array.isArray(c)
        || typeof c.v !== "number" || !Number.isInteger(c.v)
        || typeof c.at !== "number" || !Number.isInteger(c.at)
        || typeof c.off !== "number" || !Number.isInteger(c.off)) {
        // `off` is REQUIRED here, not optional as it is on the record in
        // general: this arm exists only for a withdrawal, and a record
        // without `off` is a grant. Accepting one would let this call
        // remove the coordinate while leaving consent reading ON, so the
        // next fold republishes it.
        throw new HttpsError(
          "invalid-argument",
          "politicalConsent must be a withdrawal record with integer v, at and off",
        );
      }
    }

    await firestore().collection("v2_users").doc(uid).set(
      {
        testResults: { [kind]: value },
        // REBUILT FROM THE THREE VALIDATED FIELDS, exactly as `value` is
        // rebuilt above, and for the same reason one field over.
        //
        // The checks above prove `v`, `at` and `off` are integers and
        // stop there; passing `consent` through would carry every OTHER
        // key the caller sent. This runs on the admin SDK, which bypasses
        // rules, so `firestore.rules`'s own
        // `consent.political.keys().hasOnly(["v", "at", "off"])` — the
        // bound that holds this shape on the client path — does not apply
        // here. That made this the one client-reachable way to park
        // arbitrary keys on `v2_users/{uid}`: a world-readable document
        // that `voters.ts` fetches WHOLE, thirty at a time, with no field
        // mask. Measured 2026-09-09 against this callable: a consent
        // object carrying two extra keys was written verbatim, 300,075
        // bytes of it, onto the document this file exists to keep at
        // roughly seven hundred.
        //
        // The cost of rebuilding is that a field added to the record
        // later is dropped here rather than refused, and silently. The
        // client's `politicalConsentRecord` emits exactly these three
        // (`v: POLITICAL_CONSENT_VERSION`, `at`, `off`) and no surface
        // sends any other, so nothing is lost today — but a version 2
        // carrying a fourth has to be added to the guard above AND to
        // this line, or it reaches the server and stops there.
        ...(withConsent && c ? { consent: { political: { v: c.v, at: c.at, off: c.off } } } : {}),
      },
      { merge: true },
    );
    return { ok: true, kind, removed: removing, consent: withConsent };
  },
);
