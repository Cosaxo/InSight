# Device binding (D29) — what ships, what you add, how to flip it on

D29's activation gate: one counted account per physical device per
calendar month, enforced through the per-device bits Apple and Google
hold (DeviceCheck two bits / Play Integrity Device Recall). The moving
parts and their state:

| Piece | State |
| --- | --- |
| `activateDeviceV2` callable (verify + claim) | shipped, in the deploy allowlist |
| Month/epoch decision logic | shipped, unit-tested (`functions/src/deviceBind.test.ts`) |
| Rules requirement on answer writes | shipped **soft** — `deviceBindEnforced()` returns `false`; the flipped text is pre-tested |
| Client activation flow (`src/v2/data/deviceBind.ts`) | shipped, wired into the live boot, memo logic unit-tested |
| Native token bridge — **iOS** | **shipped (D341)**, compiled on every PR by `ios-build.yml` |
| Native token bridge — **Android** | **shipped (D341)**, compiled on every PR by `ci.yml`'s `android-build` |
| Apple/Google console setup + env vars | **owner steps below** |
| Apple/Google endpoint shapes | written from D29's verify-before-build list; **confirm against current docs before relying on staging results** |

Until the remaining pieces land, activation on real devices fails loud
and retries next boot; because enforcement is soft, no vote is refused.
The emulator path (e2e, dev-in-a-browser) grants without Apple/Google and
is green today.

**What was actually blocking this, and it was not the console (D341).**
It was the bridge. `src/v2/data/deviceBind.ts` checks
`Capacitor.isPluginAvailable("DeviceBind")`, did not find it, logged
`native bridge missing — activation deferred`, and returned. So activation
had never run once, on any device — and every later record that cited
device binding as a live control was citing something inert. D219 is the
consequential one: it took the sign-in wall off the store build partly on
the strength of "that layer is shipped end to end and soft". The layer was
shipped and not connected. The iOS half is now in the tree and compiled by
CI; what remains is genuinely owner-gated — the Apple key, the probe, the
flip.

## 1 · Console + environment (owner-gated)

**Apple (DeviceCheck):**

1. developer.apple.com → Certificates, Identifiers & Profiles → **Keys**
   → new key with **DeviceCheck** enabled → download the `.p8` once, note
   the **Key ID** and your **Team ID**.
2. Provide to the functions deploy (same mechanism as `SEED_ADMIN_UIDS` /
   `APPCHECK_ENFORCE` — see DEPLOYMENT.md):
   - `DC_TEAM_ID` — the 10-char team id
   - `DC_KEY_ID` — the key id
   - `DC_PRIVATE_KEY` — the `.p8` contents (newlines may be `\n`-escaped)
   - `DC_ENV=development` — only for builds signed with a development
     profile; Apple routes dev-signed device tokens to the development
     endpoint, and a mismatch reads as invalid tokens.

**Google (Play Integrity + Device Recall):**

1. Play Console → the app → **App integrity** → link a Google Cloud
   project, and opt in to **device recall** (the console location moves;
   search the Play Console docs for "device recall" if it is not under
   App integrity).
2. On the linked Cloud project: enable the **Play Integrity API** and
   ensure the functions runtime service account can call it.
3. `PLAY_PACKAGE_NAME` env is optional — defaults to
   `com.cosaxo.insight` (capacitor.config.ts appId).

## 2 · Native token bridges — both shipped

Neither token is exposed by the App Check plugin (D10) — App Check
consumes its attestations internally. Each bridge exposes exactly one
platform call. The JS side (`src/v2/data/deviceBind.ts`) detects the
bridge with `Capacitor.isPluginAvailable("DeviceBind")` and simply waits
until it exists, so each platform's bridge is a self-contained change
with no ordering constraint against the rest of D29.

**This section used to say both bridges were "deliberately not committed
from a machine that cannot compile them", and that premise was wrong the
whole time** — `ios-build.yml` compiles the iOS target on every PR
touching `ios/**`, on a macOS runner, unsigned and with no Apple account,
and `ci.yml`'s `android-build` runs `assembleDebug`. The compile check
that would have made this safe already existed, on both platforms. D341
committed both halves against it.

**And the Android snippet that sat here was broken.** It built its
`IntegrityTokenRequest` without a nonce, which that builder refuses —
so it would have failed on every device it ever ran on, and failed
*silently*, because `deviceBind.ts` treats any activation error as "try
again on a later boot". Pasting it would have looked identical to the
missing-bridge state it was meant to end. The committed version generates
a 32-byte base64url nonce, returns it to JS, and `activateDeviceV2`
refuses a payload whose signed nonce disagrees
(`requestDetailsProblem`, unit-tested).

**iOS — shipped, and not by the route this section used to prescribe.**
`ios/App/App/DeviceBindPlugin.swift` holds the plugin;
`ios/App/App/MainViewController.swift` registers it from
`capacitorDidLoad()`, and `Base.lproj/Main.storyboard` names that class in
place of `CAPBridgeViewController`. Four `project.pbxproj` entries carry
the two files into the target.

The `CAP_PLUGIN` macro this section used to prescribe was **not usable
here**, and the reason generalises: the macro lives in an Objective-C
file, needs `#import <Capacitor/Capacitor.h>` and a bridging header, and
this project has no `.m` file and no `SWIFT_OBJC_BRIDGING_HEADER` — while
Capacitor arrives as a Swift Package (`CapApp-SPM`), which publishes no
Objective-C umbrella header to import. Registering the instance from the
bridge view controller is all-Swift, needs no new build settings, and is
Capacitor's own documented path for app-local plugins.

**The fragility that route buys, stated because it is silent.** The
storyboard is a Capacitor-managed file. If `npx cap sync` ever rewrites
that `customClass` back to `CAPBridgeViewController`, the plugin stops
registering and activation defers again with no error — the exact failure
the bridge's absence already caused once. Check that attribute first if
`[deviceBind] activated` lines stop appearing.

**Measured, not assumed:** `npm run build && npx cap sync` was run against
this tree on 2026-09-01 and left `android/` and `ios/` byte-identical —
`customClass="MainViewController"` survives. Capacitor writes the
storyboard at `cap add`, not at `cap sync`, so the risk is a future CLI
change rather than routine use. `npm run check:devicebind` is what would
catch it either way.

**Android — shipped.**
`android/app/src/main/java/com/cosaxo/insight/DeviceBindPlugin.java` holds
the plugin; `MainActivity.java` registers it with
`registerPlugin(DeviceBindPlugin.class)` **before** `super.onCreate`, which
is where Capacitor builds the bridge — registering after it compiles,
ships and does nothing. `app/build.gradle` carries
`com.google.android.play:integrity` at `playIntegrityVersion` from
`variables.gradle`.

`npm run check:devicebind` holds all of it on both platforms, including
that registration order and the nonce, because every one of those failures
is silent on a device.

**Verify while adding (D29's open API questions):** whether device
recall requires the *standard* (warmed-up) integrity request rather than
the classic one-shot above, the minimum Android/GMS version for recall,
and whether the decoded verdict carries recall **write dates** — the
server handles both shapes (`decideRecall`), but month-exact semantics
only apply when dates exist.

## 3 · Staging probe (before flipping enforcement)

The Apple/Google round trips cannot run in the emulator. Before the
flip, on one real device per platform (dev build, `DC_ENV=development`
for iOS):

1. Fresh install → the boot calls `activateDeviceV2` silently. Function
   logs should show `[deviceBind] activated uid=… platform=…`.
2. Delete the account in-app (or clear storage), sign in again the same
   month → logs show `cooldown`, and the app still browses and votes
   (soft mode).
3. Next calendar month (or a second device): activation succeeds again.

Watch for `[deviceBind] verdict without deviceRecall` on Android — a
high rate means recall is not available on real devices as configured,
and the month bound is not yet biting there.

## 4 · The enforcement flip

One word in `firestore.rules` — `deviceBindEnforced()`'s literal,
`false` → `true` — deployed through the normal path
(`backend-checks.yml` gates it). The flipped text is already pinned by
`rules.test.ts` (a second emulator environment runs the rewritten
rules), so the flip commit's behavior is tested before it exists.

Rolling back mid-incident is the same word back again — rules deploy,
no code change, no console visit.

### What the flip costs if it is early, and why that is not obvious

After the flip, an account without the `db` claim has every
aggregate-feeding answer **refused by rules**. The client does not say so.
`live.ts`'s `vote()` catch rolls the optimistic state back and reports to
Sentry: the user taps an option, watches it take, and watches it silently
revert, with no message and nothing to retry. Duel answers are unaffected
(D29 exempts them), so the app keeps working *partly*, which is worse than
failing outright — it reads as a flaky product rather than a refused write.

So an early flip does not generate reports that name the cause. That is the
argument for measuring before flipping rather than flipping and watching,
and it is why the sequence below replaces "enough client uptake that
activation-capable builds dominate". Two populations lack the claim, and
they need different treatment:

| Population | Driven to zero by | Needs a number? |
| --- | --- | --- |
| On a build predating the activation flow | `v2_meta.minBuild` | **No** |
| On a capable build, activation failed | nothing — it is a floor | **Yes** |

### Step 1 · Raise `minBuild`, do not wait for uptake

`minBuild` is a **hard** gate, not a nudge: `LIVE.updateRequired` renders a
full-screen `role="dialog"` over the whole app (`app-shell.jsx`), so a
client below it cannot reach a vote at all. Set `v2_meta/app.minBuild` to
the first activation-capable build and population 1 becomes empty by
construction, immediately, rather than shrinking asymptotically while its
tail votes into a silent rollback.

That is a change of kind, not of patience: "dominate" is a statistic with a
tail of refused honest voters; `minBuild` is a guarantee with none. Set
`updateUrl` at the same time — without it the dialog's button falls back to
`location.reload()`, which on a native shell reloads the same old bundle.

One thing this does NOT cover: a build number is not an activation. A
capable build still has to succeed, which is step 2.

### Step 2 · Read the two rates, and only then flip

The staging probe (§3) proves the round trip works on *one* device. These
are the fleet numbers, and they guard two different failures — one is
"we are refusing honest users", the other is "we are not actually stopping
the attack". Both must pass; neither substitutes for the other.

**Read the third number FIRST (D341), because the two below cannot see
the failure they exist to prevent.** Both are computed from
`activateDeviceV2`'s own logs, so both measure THE ENDPOINT. An account
that never called it is invisible to both — a client below the activation
build, a device with no bridge (which was every device until D341), a boot
where the call was never reached. Those accounts vote, and the flip
refuses them. So both rates can read perfect while most real votes would
be refused, which is precisely the silent-refusal failure this section
exists to prevent, hiding inside the instrument meant to prevent it.

`ledgerVelocityScan` now logs the population that actually matters, daily,
at INFO, from the Auth records it already fetches:

```bash
gcloud logging read \
  'resource.labels.service_name="ledgervelocityscan" AND jsonPayload.metric="bind_coverage"' \
  --project prvfire33 --limit 7 --format='value(jsonPayload.refusedPct,jsonPayload.boundAnswers,jsonPayload.answers)'
```

`refusedPct` is, directly, the share of that window's real votes the flip
would have refused. **It must be at or near zero before flipping** — that
is the gate, and the two rates below are the diagnostics for why it is
not. A coverage number that will not climb means activation is failing
somewhere the endpoint's own logs do not show.

| | Threshold | What failing it means |
| --- | --- | --- |
| **Error rate** — DeviceCheck/Play failures ÷ all `activateDeviceV2` invocations, over 24h | **< 1%**, and **zero** `DeviceCheck auth rejected` | Honest users on capable builds would be refused. `auth rejected` is always a misconfigured key, never a device condition, so its threshold is zero rather than small. |
| **Android recall coverage** — `verdict without deviceRecall` ÷ Android activations, over 24h | **< 5%** | Recall is not reaching real devices as configured. That path allows on integrity alone, so it refuses nobody — the flip simply does not buy the month bound on Android, which is the thing it exists for. |

Note what is deliberately **not** in the error rate: `cooldown` is a
success. It is the mechanism working — a second account on the same device
in the same month, correctly given no claim. Counting it as failure would
make the metric go bad exactly when the system starts doing its job.

Read them with (substitute the day):

```bash
# Every activateDeviceV2 log line for one day, tallied by outcome.
gcloud logging read \
  'resource.labels.service_name="activatedevicev2"
   AND timestamp>="2026-08-04T00:00:00Z" AND timestamp<"2026-08-05T00:00:00Z"' \
  --project prvfire33 --format='value(jsonPayload.message,textPayload)' \
  | sed -n 's/.*\[deviceBind\] \([a-zA-Z ]*\).*/\1/p' | sort | uniq -c | sort -rn
```

The outcome strings to expect, from `functions/src/deviceBind.ts`:
`activated` and `cooldown` (both fine), against `DeviceCheck auth
rejected`, `DeviceCheck query failed`, `DeviceCheck update failed`,
`Play Integrity decode failed`, `Play Integrity recall write failed`, and
the Android-coverage line `verdict without deviceRecall`.

**Not an alert, on purpose.** DEPLOYMENT.md's "one alert, deliberately"
argument holds: an alert nobody acts on trains people to ignore the
channel. This is a number read **once**, at the moment of a deliberate
decision, and then not again unless the flip is rolled back. A standing
alert on a rate that only matters on one day is the noise that reasoning
warns about.

**Written, not run.** These queries are composed from the log lines in
`deviceBind.ts` and the resource shape in
`monitoring/onV2AnswerCreated-errors.json`; they have not been executed
against production, because activation has never run there — the native
bridges (§2) are not in the tree yet. Expect to adjust the `--format`
field if the runtime writes `textPayload` where `jsonPayload.message` is
assumed. The tallied strings are the part that is certain, since they are
read straight from the source.
