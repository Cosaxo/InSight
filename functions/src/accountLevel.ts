// accountLevel.ts — WHICH set of account requirements an account has met.
//
// D29 shipped this as a boolean: `db: 1` meant "passed the device check",
// and firestore.rules asked `== 1`. That was enough while there was one
// requirement, and it is the wrong shape the moment there are two — a
// boolean cannot say WHICH bar an account cleared, so raising the bar
// later leaves no way to tell the accounts that met the old one from the
// accounts that meet the new one. You would be re-deriving that from
// whatever evidence survived, per account, after the fact.
//
// So `db` carries a LEVEL, and the rules ask `>=`. Raising the bar is then
// one number, and every account already carries the answer to "does this
// one still qualify?".
//
// WHY THIS IS FREE TO DO TODAY AND EXPENSIVE LATER. Activation has never
// run — the native bridges did not exist until D337 — so no account
// anywhere holds a `db` claim. Redefining what the claim MEANS costs
// nothing right now. Once real accounts carry `db: 1`, changing its
// meaning is a migration over live auth users.
//
// The ladder is deliberately short. A level is only worth minting when
// something can actually VERIFY it; a level nothing checks is the dead
// allowlist entry D331 removed from the profile — a promise the tree
// cannot keep.

export interface AccountLevelDef {
  level: number;
  key: string;
  /** What an account at this level has been shown to satisfy. */
  what: string;
}

/**
 * Ordered, ascending. Each level SUBSUMES the ones below it, which is what
 * makes `>=` the right comparison in rules and what lets the bar move by
 * one number.
 */
export const ACCOUNT_LEVELS: AccountLevelDef[] = [
  {
    level: 0,
    key: "none",
    what: "Signed in, nothing verified. Every account starts here (D3, anonymous-first) and stays here if activation never succeeds.",
  },
  {
    level: 1,
    key: "device",
    what: "Device-bound: the platform confirmed this physical device had not already activated an account this calendar month (D29).",
  },
  {
    level: 2,
    key: "device+identity",
    what: "Device-bound AND linked to a real identity provider, so the account survives the handset and carries a second scarce factor — one whose Sybil defence Google and Apple already pay for.",
  },
];

/**
 * The bar `firestore.rules` enforces once `deviceBindEnforced()` is true.
 *
 * MOVING THIS IS THE WHOLE POINT, and it is not a free edit: every account
 * below the new value stops counting the moment the rules deploy. Read the
 * per-level bind coverage the daily scan logs FIRST (velocity.ts,
 * `bind_coverage`) — it says how many real votes each level would refuse,
 * which is the same question D337 answered for the original flip.
 *
 * `check:account-level` holds firestore.rules' own literal equal to this,
 * because two numbers that must agree and live in different files are two
 * numbers that will not agree.
 */
export const REQUIRED_LEVEL = 1;

/**
 * What a just-verified account is entitled to.
 *
 * `signInProvider` is Firebase's own `firebase.sign_in_provider` from the
 * caller's ID token — "anonymous" for a session that has never linked. It
 * is read from the TOKEN rather than from anything the client sends,
 * because a client-declared level is not a level.
 *
 * A device that failed the check never reaches here: activation returns
 * `cooldown` instead, and the account stays at 0.
 */
export function levelFor(input: { deviceBound: boolean; signInProvider?: string }): number {
  if (!input.deviceBound) return 0;
  return input.signInProvider && input.signInProvider !== "anonymous" ? 2 : 1;
}

/** The definition for a level, for logs and operator output. */
export function levelDef(level: number): AccountLevelDef {
  return (
    ACCOUNT_LEVELS.find((l) => l.level === level)
    // A claim carrying an unknown level is not an error to throw on: it is
    // an account minted by a NEWER deploy than the reader. Describe it
    // honestly rather than crashing a report or a nightly scan.
    || { level, key: `unknown-${level}`, what: "Minted by a newer deploy than this code knows about." }
  );
}
