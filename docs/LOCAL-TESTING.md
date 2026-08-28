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
await httpsCallable(getFunctions(undefined, "europe-west1"), "seedContentV2")({});
```

What live mode gives you:

- Anonymous session on boot (uid persists across reloads).
- The real daily deck + feed with exact counts. Your first vote publishes
  immediately and the payoff shows a split of one — that is D98 working,
  not a floor: the who-voted sheet will also name you.
- Groups & duos end-to-end: create, join by invite code, sealed votes.
  You need a second account for either to do anything — see **Test users**
  below, which is easier than a second browser profile and can also produce
  the multi-day history the Groups portrait and the streak are computed from.
- The Map accreting your real answers; passive tests advancing from zero.
- The account/privacy panel: display name, delete account.

Emulator UI (inspect any document): <http://127.0.0.1:4000>.

## Test users (1v1 and groups from one browser)

`scripts/test-users.mjs` runs synthetic accounts that play the duel loop the
way a real device does — they sign in, write a profile, join through
`joinGroupV2`, seal answers at `v2_users/{uid}/answers/g_{gid}_{day}`, and are
revealed by `revealDuelsNowV2`. Everything goes through the **client SDK**
under each account's own session, so firestore.rules applies exactly as it
does to a real phone; the admin SDK is never used. Emulator only, enforced —
test users answering world questions would move the exact public counts (D98)
on a real project.

```bash
npm run testuser -- <command>          # no arguments prints usage
```

The 1v1 loop:

```bash
# in the app: Circle tab → create a duo → copy the invite code
npm run testuser -- join 6CZ3K77N     # a test user joins your duo
# in the app: answer today's duel question
npm run testuser -- play              # the test user seals theirs
npm run testuser -- reveal            # publish the day; the card is on daily
```

Add `host [NAME] [--mode duo]` to have a test user create the group and hand
you the code instead, `join --count 5` to fill a group, `world` to give them
world answers so the aggregates and cohorts have something in them, and
`history --days 3` to backfill past days of answers and reveals — that is
what the Groups portrait (mirror → Groups) and the streak read.

Run `history` *before* `reveal`, not after: `lastRevealDay` and `streak` are
written by whichever reveal commits last, so settling today and then
backfilling leaves a group whose streak counts the backfill instead of the run
up to today. Every reveal is still there and readable — only those two fields
read oddly.

Two limits the harness states rather than hides:

- **Backfill reaches 3 days, not 6.** `firestore.rules` accepts a duel answer
  while `timestamp.date(day) > request.time - 4d`, and the day key is
  midnight UTC, so `-4` clears that bound only in the small hours.
- **A duo backfill only settles days you also played.** `shouldReveal` is
  both-or-nothing for duos, so the harness reports the days it could not
  reveal instead of writing one-sided history.

`reset` forgets the roster; `reset --purge` deletes the accounts through the
real `deleteAccount` callable. Neither rolls back the aggregate counts their
votes fed — `deleteAccount` erases the uid attribution and leaves the
anonymous tally, by design. Restart the emulator for a clean slate.

The roster lives in `.test-users.json` (gitignored — it holds each account's
emulator password). The emulator is wiped on restart while that file is not,
so the harness re-creates any account that has gone missing.

## Test suites

```bash
npm run test:rules            # 159 security-rules tests (Firestore + Storage emulators)
npm run test:e2e              # full SDK loop (auth+firestore+functions)
npm run test:e2e:erasure      # account deletion, end to end
npm run test:e2e:moderation   # moderation transport
npm run test:e2e:all          # all three, on ONE emulator boot — what CI runs
```

The e2e suites each have a `pre` script that builds `functions` first, so
run them through npm rather than by hand — a raw `firebase emulators:exec`
will happily run the *previous* build.

Reach for the three single-driver scripts while working on one: each gets a
clean database, and the failure output is not buried under the other two.
`test:e2e:all` is what `backend-checks.yml` runs, because a boot is ~22s and
paying it three times cost ~48s of every PR and every deploy. It chains the
drivers in one database, so its ORDER is load-bearing — the workflow
comment beside that step has the argument, and it is the thing to read
before adding a count or emptiness assertion to the erasure or moderation
driver.

**`npm install` at the root does not install the backend's dependencies**,
and the way that surfaces looks like a broken suite rather than a missing
install. `npm run test --prefix functions` fails to *load* six of its eight
files with

```
Error: Cannot find package 'firebase-functions/v2/scheduler'
    imported from functions/src/velocity.ts
```

and reports `6 failed | 2 passed` while every test that did run passed.
It is a real import error — the package genuinely is not there. Run
`npm install --prefix functions` and all 228 pass. Two installs, two
`node_modules`, which is why `backend-checks.yml` carries
`npm ci --prefix functions` as its own step next to the root one.

`npm run test:unit` expects the **demo** defaults, so run it with no `.env` in
the tree (or one that leaves `VITE_V2_LIVE` unset). With the live-mode `.env`
from the top of this file in place, 8 tests across `follow-seeds`,
`purge-wipe`, `smoke`, `smoke-live` and `world-channels` fail on purpose —
they assert the demo furniture that `VITE_V2_LIVE=true` is supposed to remove.
Measured 2026-08-12: 767/767 without it, 759/767 with it.

`npm run check:bundle` needs **two** variables in the build it measures,
and since D144 it refuses to report anything without the second rather than
quietly grading the wrong bundle:

```bash
VITE_V2_LIVE=true VITE_SENTRY_DSN="https://example@o0.ingest.sentry.io/0" npm run build
VITE_V2_LIVE=true npm run check:bundle
```

**`VITE_V2_LIVE=true` is what makes it the bundle that ships**, and leaving
it out was worth 12 KB of total and 9 KB of eager graph — enough that the
installed app was over both ceilings while CI reported OK. The script now
exits 1 if the flag is not in its own environment. To measure a demo build
deliberately, pass `--demo`: it prints the numbers, applies no ceiling, and
says so.

Note this is the opposite of what `test:unit` wants two paragraphs up — the
tests expect the demo defaults, the bundle gate expects the shipping ones.
That is not a contradiction to resolve; they are asking about different
artifacts. Do not put `VITE_V2_LIVE=true` in a `.env` and expect both to
pass.

Without one, `sentryInit()` no-ops and the 435 KB `prod-*.js` chunk is
never emitted, so a local run reported 1725 KB against a 2176 KB ceiling —
451 KB of headroom that does not exist. The value is a dummy: nothing
sends, the point is only that the chunk gets built. This is not
flakiness when CI then fails; it is two different bundles. The *eager
graph* number is trustworthy either way, because Sentry is deferred and
never appears in the preload list.

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

### The GitHub API is not reachable from the shell, and it fails silently

Same section because it is the same shape: an environmental refusal that
looks like the thing working. `GH_TOKEN` and `GITHUB_TOKEN` are both set
in an agent container, so `curl`-ing the Actions API looks like it should
work. It does not:

```
{"message":"GitHub access is not enabled for this session. An org admin
must connect the Claude GitHub App for this organization."}
```

HTTP **403**, on every path, including read-only ones. Only the GitHub
MCP tools reach the API from here.

**Why it is worth a note rather than a shrug.** The release procedure's
central instruction is *ask the run list, not the docs* — see
[`IOS-RELEASE.md`](IOS-RELEASE.md) and runbook 2.4 — and a human asking it
in a browser never meets this. Anything that automates the asking does.
The failure mode is the bad one: a poll loop that treats a failed request
as "no news" produces **no output at all**, which is indistinguishable
from a run still in progress. Found 2026-08-15 by arming exactly that loop
against run 22 (D159); it would have sat quiet until its timeout while the
run finished underneath it.

So a watch built out of shell `curl` is not a watch. Either call the MCP
tools, or — if you must poll from a script — make a non-200 emit a line
rather than `|| true` it away.
