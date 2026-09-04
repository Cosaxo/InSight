// e2e-lib.mjs — the three e2e suites' shared assertion helpers.
//
// WHY IT EXISTS. `fail` and `ok` were written out in all three suites and
// `expectCode` in four places, three of them inside e2e-v2-loop.mjs alone —
// the same eight lines re-declared in three block scopes of one file. Nothing
// forced them to agree, and their whole subject is agreeing: they are what
// makes a security assertion mean something.
//
// THE DISCIPLINE THEY CARRY, which is why they are not one-liners. A bare
// `try { …; fail() } catch { ok() }` passes on ANY error — a typo in a
// collection name, a dropped connection, an emulator that never came up. For
// a SECURITY assertion that is worse than no test, because it still counts
// toward the green tally the deploy gates on. So every helper here demands
// the SPECIFIC refusal and reports what it got instead.
//
// `fail` exits the process rather than throwing. These suites are scripts run
// by `firebase emulators:exec`, not a test runner: the exit code is the whole
// result, and a thrown error inside an awaited callback can be swallowed by
// the caller that awaited it.

export const fail = (msg) => { console.error("✗ " + msg); process.exit(1); };
export const ok = (msg) => console.log("✓ " + msg);

/**
 * Assert `op()` rejects with exactly `code`, and HAND BACK the message.
 *
 * For the call site that has to assert the code AND what the message
 * says — an operator-facing refusal that has to name the thing it
 * refused, not merely refuse. `expectCode` swallows the error, so such a
 * site used to be written as a bare try/catch reading only the message,
 * which is the failure the header above describes: the rebuild tool's
 * `internal` wrapper answers `rebuild of <qid> failed: <reason>`, which
 * names the qid and is long, so a crash or a missing index read as the
 * refusal being tested.
 *
 * Emits no `ok` — the caller does that once its own assertions pass, so
 * the tally never counts a half-checked refusal.
 */
export const expectRefusal = async (label, code, op) => {
  try {
    await op();
  } catch (e) {
    if (e?.code === code) return String(e?.message ?? e);
    return fail(`${label} — expected ${code}, got ${e?.code || e}`);
  }
  return fail(`${label} — the operation was ALLOWED`);
};

/** Assert `op()` rejects with exactly `code`. */
export const expectCode = async (label, code, op) => {
  await expectRefusal(label, code, op);
  ok(label);
};

/** Assert `op()` is refused by the rules, specifically. */
export const expectDenied = (label, op) => expectCode(label, "permission-denied", op);
