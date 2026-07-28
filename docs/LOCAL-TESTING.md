# Local testing

Two modes, one command each.

## Mock mode (zero setup)

```bash
npm install
npm run dev
```

The full UI on demo data: the daily deck, feed, duel bodies, Mirror
populations and profile all run on the spec's synthetic dataset. No
Firebase, no network. This is the fastest way to see or iterate on UI.

## Live mode (the real backend, locally)

Prereqs: Node LTS, a JDK 11+ (the emulators are Java), and
`npm i -g firebase-tools`.

```bash
cp .env.emulator .env          # dummy config + VITE_USE_EMULATOR + VITE_V2_LIVE
firebase emulators:start --only auth,firestore,functions --project prvfire33   # terminal 1
npm run dev                                                                    # terminal 2
```

Then seed the question bank once per emulator session — from the browser
console of the running app (the seed callable is open in the emulator):

```js
const { getFunctions, httpsCallable } = await import("firebase/functions");
await httpsCallable(getFunctions(undefined, "us-central1"), "seedContentV2")({});
```

What live mode gives you:

- Anonymous session on boot (uid persists across reloads).
- The real daily deck + feed with k-floored counts (below 5 answers the
  payoff shows only your own vote — that's the floor working).
- Groups & duos end-to-end: create, join by invite code from a second
  browser profile/incognito window, sealed votes. Force a reveal for
  testing with the `revealDuelsNowV2` callable (open in the emulator):
  pass `{ day: "<yesterday's UTC date>" }`.
- The Map accreting your real answers; passive tests advancing from zero.
- The account/privacy panel: display name, delete account.

Emulator UI (inspect any document): <http://127.0.0.1:4000>.

## Test suites

```bash
npm run test:rules      # 29 security-rules tests (Firestore + Storage emulators)
# full SDK end-to-end (auth+firestore+functions):
firebase emulators:exec --only auth,firestore,functions --project demo-insight \
  "node firestore-tests/e2e-v2-loop.mjs"
```

## Sandbox/CI note

If emulator commands fail with `denied by policy` on localhost calls,
run them with `HTTPS_PROXY` unset — firebase-tools routes even localhost
HTTP through a proxy dispatcher when the variable is set.
