# Firestore rules tests

Unit tests for [`../firestore.rules`](../firestore.rules) using the Firebase
emulators (Firestore **and** Storage) and `@firebase/rules-unit-testing`.
They assert the access decisions the product's privacy claims rest on:

**The v2 surface** (what the app actually uses):

- **what the DEFAULT user reaches.** The app is anonymous-first (D3), so in
  production "signed in" usually means "holds a free anonymous account" —
  the suite has a distinct `asAnonAuth` principal for exactly that, and an
  inventory of what it can and cannot touch.
- **public, create-once answers** (D98 for the read side, D5/D86 for the
  write side): any signed-in user may read any other user's answers, and the
  suite reads that way on purpose — an `assertSucceeds` on a stranger's
  document here is the point, not a hole. What is pinned is the WRITE side:
  create-only with exactly one legal edit (an `optionIdx` change plus an
  `editedAt` stamp — D86), `answeredAt` pinned to `request.time` so an answer
  cannot be backdated, and the doc id bound to the question id.
- **sealed duels**: a groupmate cannot read an answer before the reveal doc
  exists, a non-member cannot write one, and answering a day that is
  already revealed is refused.
- **member-only groups and reveals**, both client-unwritable — membership
  changes go through callables.
- **exact aggregates** (D98 removed the k-floor): the public mirror publishes
  real counts from the first answer and is read-only to every client. What
  stays closed is the trigger's own working state — `v2_aggs_private` (the
  catalogue accumulator) and the event ledger — because nothing needs it,
  not because it hides anything.
- the duel `day` must be near now — no pre-sealing future days.
- `optionIdx` bounds, including that a group "pick" answer can name any of
  up to 32 members.
- the retired **v1 surface stays closed** (D4): every retired collection and
  per-user subcollection denies read and write, to owner and stranger alike.
- the **collection-group** read, in both directions: a cross-user query over
  `answers` is allowed (D98) and must carry a matching `surface` value
  filter, which is what keeps a sealed duel answer out of it; every retired
  v1 subtree still refuses one outright.

**Storage** (`storage.rules.test.ts`): owner-only paths, the 8 MB cap, the
image content-type gate, and the catch-all deny.

*Provenance: the three access-model bullets above described the pre-D98
model — owner-only answers, k-floored aggregates, no cross-user
collection-group read — for long enough that the suite they document had
been asserting the opposite. `rules.test.ts`'s own header is the canonical
statement of the model; if this page and that header disagree, the header is
right.*

## Running

Requires the Firebase CLI and a JDK (the Firestore emulator runs on the JVM).

```bash
# one-time
npm install
npm install -g firebase-tools   # if you don't have it

# run
npm run test:rules
```

`test:rules` boots the Firestore emulator, runs the vitest suite against it, and
tears the emulator down. No live Firebase project or credentials are needed —
`initializeTestEnvironment` loads `firestore.rules` straight from disk into the
emulator.

## Notes

- These live **outside `src/`** so the app's `tsc -b` build never compiles them.
- When you change `firestore.rules`, add or update an assertion here. A wrong
  condition in the rules is a data leak; this suite is the cheapest place to
  catch it.
- The emulator port is configured in [`../firebase.json`](../firebase.json)
  (`emulators.firestore.port`).
