// The one predicate check-fn-runtime.mjs rests on, in a file that can be
// imported without running the gate.
//
// WHY IT LIVES HERE. The gate reads `functions/lib/index.js` at module
// scope — it has to, the endpoint metadata only exists on the compiled
// output — so importing it to test anything runs the whole check. That is
// why its one assertion went untested, and why the assertion was
// unreachable for as long as it was: `r.mem == null || r.timeout == null
// || r.maxInst == null` can never select a row.
//
// THE SHAPES, measured 2026-09-02 rather than assumed. firebase-functions
// never leaves these three unset:
//
//   - an omitted `memory` or `timeoutSeconds` is backfilled with the
//     gen-2 default, so the value is a NUMBER either way and "is it set?"
//     cannot tell a deliberate 512 from an inherited 256;
//   - an omitted `maxInstances` becomes a RESET SENTINEL — a ResetValue
//     instance, which prints as `[object Object]` and is not `== null`.
//
// Deleting `memory: "512MiB"` from ops.ts's setGlobalOptions put
// deleteAccount back on 256 MiB and the gate printed "all with explicit
// memory, timeout and maxInstances" and exited 0. The only trace was
// `mem=[object Object]MiB` in a table nothing reads.

/**
 * Is this runtime option EXPLICITLY set to a usable value?
 *
 * Not "is it non-null" — see above. A finite number is the only thing
 * that means the option was really given: the reset sentinel is an
 * object, a missing option is filled in by the SDK, and a stringy
 * "512MiB" would mean the metadata shape changed under us and the gate
 * should say so rather than accept it.
 */
export const isExplicit = (v) => typeof v === "number" && Number.isFinite(v);
