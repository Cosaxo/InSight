# Firestore rules tests

Unit tests for [`../firestore.rules`](../firestore.rules) using the Firebase
emulator and `@firebase/rules-unit-testing`. They assert the access decisions
the app depends on:

- per-user scoping (owner-only by default; strangers + anonymous denied)
- the **circle-tier sharing** carve-out (a mutual friend can read a shareable
  subcollection only when the owner's per-category share level allows; finance
  and other non-shareable collections never leak; a blocked friend loses access)
- **callable-only** inbound impression creates (client direct-writes denied;
  recipient can read their own inbox)
- aggregates + taxonomies are read-only to signed-in users
- the rate-limit ledger is fully opaque to clients

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
