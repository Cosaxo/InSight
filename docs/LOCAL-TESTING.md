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

Prereqs: Node LTS, a JDK 21+ (the emulators are Java), and
`npm i -g firebase-tools`. The floor is 21, not 11: firebase-tools 15
requires it for the Firestore emulator, which is why
`backend-checks.yml` pins Java 21 on both jobs that start one.

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
- The real daily deck + feed. The k-floor is paused to 1 (D81), so counts
  appear from your first vote; at the design floor of 5 the payoff would
  show only your own vote until five answers landed — that machinery
  still runs, it just bites at a size that cannot occur.
- Groups & duos end-to-end: create, join by invite code from a second
  browser profile/incognito window, sealed votes. Force a reveal for
  testing with the `revealDuelsNowV2` callable (open in the emulator):
  pass `{ day: "<yesterday's UTC date>" }`.
- The Map accreting your real answers; passive tests advancing from zero.
- The account/privacy panel: display name, delete account.

Emulator UI (inspect any document): <http://127.0.0.1:4000>.

## Test suites

```bash
npm run test:rules            # 61 security-rules tests (Firestore + Storage emulators)
npm run test:e2e              # full SDK loop (auth+firestore+functions)
npm run test:e2e:erasure      # account deletion, end to end
npm run test:e2e:moderation   # moderation transport
```

The three e2e suites each have a `pre` script that builds `functions`
first, so run them through npm rather than by hand — a raw
`firebase emulators:exec` will happily run the *previous* build.

## Sandbox/CI note

Behind an egress proxy, run the emulator suites with `HTTPS_PROXY`
unset:

```bash
env -u HTTPS_PROXY -u https_proxy npm run test:e2e
```

Two different failures hide behind that one line, and only the first is
obvious.

**Localhost.** firebase-tools routes even localhost HTTP through a proxy
dispatcher when the variable is set, so emulator-to-emulator calls come
back `denied by policy`.

**The trigger registration, which is the one that looks like a broken
test.** Starting the *functions* emulator fetches remote config from
`firebase-public.firebaseio.com`. If the proxy answers 403 to that
CONNECT, firebase-tools parses the denial body as JSON and dies:

```
Error adding firestore function: FirebaseError: Unable to parse JSON:
SyntaxError: Unexpected token 'd', "denied by "... is not valid JSON
```

Every function definition loads first, so the log looks healthy right up
to the crash, and the message names neither the host nor the proxy.

Unsetting the variable fixes it because the *same fetch still fails* —
it just fails as a connection error, which firebase-tools already
tolerates (`Unable to fetch the CLI MOTD and remote config. This is not
a fatal error`). A refused connection is handled; a 403 body is parsed.
Nothing about the run needs that host to succeed.

Allowlisting `firebase-public.firebaseio.com` in the sandbox's egress
policy also works, and is the better fix where you control the policy —
it removes the env-var dance instead of routing around it. Verified
2026-08-07: with the variable unset, `test:e2e`, `:erasure` and
`:moderation` all pass in a proxied container that denies that host.
