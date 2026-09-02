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
// run — the native bridges did not exist until D342 — so no account
// anywhere holds a `db` claim. Redefining what the claim MEANS costs
// nothing right now. Once real accounts carry `db: 1`, changing its
// meaning is a migration over live auth users.
//
// The ladder is deliberately short. A level is only worth minting when
// something can actually VERIFY it; a level nothing checks is the dead
// allowlist entry D331 removed from the profile — a promise the tree
// cannot keep.

/**
 * Everything the activation callable was able to VERIFY about a caller.
 *
 * A new requirement adds a field here and a rung below — never a branch in
 * `levelFor`, which is why that function has no knowledge of any specific
 * level. Facts come from the server's own checks and from the auth USER
 * RECORD; nothing here may be sourced from `request.data`, because a
 * client-declared fact is not a fact.
 */
export interface LevelFacts {
  /** The platform confirmed this device had not already activated this month. */
  deviceBound: boolean;
  /**
   * Provider ids linked to the account — `UserRecord.providerData`, which
   * firebase-admin documents as "providers linked to the user". Empty for a
   * session that has never linked.
   *
   * NOT `firebase.sign_in_provider`, which this first read and which was
   * wrong in a way that made rung 2 unreachable. That claim is the provider
   * used to SIGN IN, and this app's linking path is `linkWithCredential`
   * (D134: "it links, it does not sign in") — the uid and every answer
   * survive precisely because the session is not replaced, so the token
   * keeps saying "anonymous" for the life of the account. Level 2 would
   * have been earned only by someone who ABANDONED their session through
   * the gate's second button, which is exactly backwards.
   */
  linkedProviders?: readonly string[];
}

/**
 * The providers that satisfy the identity rung.
 *
 * NAMED RATHER THAN "any linked provider", which is what this first said
 * and what a review pass caught. `password` is a linked provider and an
 * email address is free and unlimited, so it carries none of the Sybil
 * resistance rung 2's own description claims to be borrowing — it would
 * have made the rung a formality that any attacker clears in bulk.
 *
 * `phone` is deliberately ABSENT even though it is genuinely scarce. It is
 * scarce for a different reason and at a different price (a number costs
 * money; a Google account costs Google's abuse team), so folding it in here
 * would let one rung mean two unrelated things. If it is ever wanted, it is
 * its own rung — which is now a one-entry change.
 *
 * These are the two the app can actually offer: `linkGoogle` today, and
 * Sign in with Apple if a reviewer ever demands it (SHIP-CHECKLIST §4.8).
 */
export const FEDERATED_PROVIDERS: readonly string[] = ["google.com", "apple.com"];

export interface AccountLevelDef {
  level: number;
  key: string;
  /** What an account at this level has been shown to satisfy. */
  what: string;
  /**
   * The test for THIS rung alone, not for the rungs beneath it — `levelFor`
   * walks the ladder in order and stops at the first unmet rung, so
   * subsumption is structural rather than something each predicate has to
   * remember to repeat.
   */
  met: (facts: LevelFacts) => boolean;
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
    // The floor is unconditional by definition: it is what an account has
    // before anything has been checked.
    met: () => true,
  },
  {
    level: 1,
    key: "device",
    what: "Device-bound: the platform confirmed this physical device had not already activated an account this calendar month (D29).",
    met: (f) => f.deviceBound,
  },
  {
    level: 2,
    key: "device+identity",
    what: "Device-bound AND linked to a real identity provider, so the account survives the handset and carries a second scarce factor — one whose Sybil defence Google and Apple already pay for.",
    // A FEDERATED provider, not merely any linked one — see
    // FEDERATED_PROVIDERS for why `password` does not qualify. Absent is
    // treated as unlinked rather than as "some provider": failing open here
    // would hand every anonymous session this rung the day the fact stopped
    // being collected.
    met: (f) => (f.linkedProviders ?? []).some((p) => FEDERATED_PROVIDERS.includes(p)),
  },
];

/**
 * The bar `firestore.rules` enforces once `deviceBindEnforced()` is true.
 *
 * MOVING THIS IS THE WHOLE POINT, and it is not a free edit: every account
 * below the new value stops counting the moment the rules deploy. Read the
 * per-level bind coverage the daily scan logs FIRST (velocity.ts,
 * `bind_coverage`) — it says how many real votes each level would refuse,
 * which is the same question D342 answered for the original flip.
 *
 * `check:account-level` holds firestore.rules' own literal equal to this,
 * because two numbers that must agree and live in different files are two
 * numbers that will not agree.
 */
export const REQUIRED_LEVEL = 1;

/**
 * What a just-verified account is entitled to: the highest rung reachable
 * without skipping one.
 *
 * KNOWS ABOUT NO SPECIFIC LEVEL, which is the point — adding a requirement
 * is one entry in ACCOUNT_LEVELS with its own `met`, and this function,
 * firestore.rules' `>=`, the nightly per-level coverage and the operator
 * filter all pick it up with no edit.
 *
 * Walking and STOPPING at the first unmet rung is what makes levels
 * subsume. Taking the maximum satisfied rung instead would let an account
 * that somehow met level 3 but not level 2 be reported as 3, and `>=` in
 * the rules would then wave through an account that never met the bar it
 * is being compared against.
 */
export function levelFor(facts: LevelFacts): number {
  let level = 0;
  for (const rung of ACCOUNT_LEVELS) {
    if (rung.level === 0) continue; // the floor is where everyone starts
    if (!rung.met(facts)) break;
    level = rung.level;
  }
  return level;
}

/** The definition for a level, for logs and operator output. */
export function levelDef(level: number): AccountLevelDef {
  return (
    ACCOUNT_LEVELS.find((l) => l.level === level)
    // A claim carrying an unknown level is not an error to throw on: it is
    // an account minted by a NEWER deploy than the reader. Describe it
    // honestly rather than crashing a report or a nightly scan.
    //
    // `met` returns false: this code cannot know what that rung required,
    // and claiming an account meets a requirement you cannot describe is
    // the one wrong answer here. Nothing calls it on this path today —
    // levelFor walks the real ladder — so it exists to keep the shape
    // total rather than to be relied on.
    || {
      level,
      key: `unknown-${level}`,
      what: "Minted by a newer deploy than this code knows about.",
      met: () => false,
    }
  );
}
