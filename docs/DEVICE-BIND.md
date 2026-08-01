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
| Native token bridges (iOS/Android) | **not in the tree — paste-ready below**, needs Xcode / Android Studio |
| Apple/Google console setup + env vars | **owner steps below** |
| Apple/Google endpoint shapes | written from D29's verify-before-build list; **confirm against current docs before relying on staging results** |

Until the last three land, activation on real devices fails loud and
retries next boot; because enforcement is soft, no vote is refused. The
emulator path (e2e, dev-in-a-browser) grants without Apple/Google and is
green today.

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

## 2 · Native token bridges (paste-ready, ~30 lines each)

Neither token is exposed by the App Check plugin (D10) — App Check
consumes its attestations internally. These bridges expose exactly one
platform call each and are deliberately not committed from a machine
that cannot compile them: iOS additionally requires registering the file
with the Xcode project (`project.pbxproj`), which is not safe to edit
blind. The JS side (`src/v2/data/deviceBind.ts`) detects the bridge with
`Capacitor.isPluginAvailable("DeviceBind")` and simply waits until it
exists, so pasting these is a self-contained change with no ordering
constraint against the rest of D29.

**iOS — `ios/App/App/DeviceBindPlugin.swift`** (add via Xcode so the
project file updates):

```swift
import Foundation
import Capacitor
import DeviceCheck

@objc(DeviceBindPlugin)
public class DeviceBindPlugin: CAPPlugin {
    @objc func generateToken(_ call: CAPPluginCall) {
        guard DCDevice.current.isSupported else {
            // Simulators cannot mint DeviceCheck tokens — expected there,
            // an error on any real device.
            call.reject("devicecheck unsupported on this device")
            return
        }
        DCDevice.current.generateToken { data, error in
            if let error = error {
                call.reject("token failed: \(error.localizedDescription)")
                return
            }
            guard let data = data else {
                call.reject("no token data")
                return
            }
            call.resolve(["token": data.base64EncodedString()])
        }
    }

    @objc func requestIntegrityToken(_ call: CAPPluginCall) {
        call.reject("android only")
    }
}
```

**iOS — `ios/App/App/DeviceBindPlugin.m`** (the registration macro; same
Xcode add):

```objc
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(DeviceBindPlugin, "DeviceBind",
  CAP_PLUGIN_METHOD(generateToken, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(requestIntegrityToken, CAPPluginReturnPromise);
)
```

If the app's Capacitor version has moved off the macro registration,
follow the current "custom code" page (registerPluginInstance in a
CAPBridgeViewController subclass) — the plugin class body is unchanged.

**Android — `android/app/src/main/java/com/cosaxo/insight/DeviceBindPlugin.java`**
(a new file in the source tree is picked up by Gradle without project
surgery):

```java
package com.cosaxo.insight;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.play.core.integrity.IntegrityManager;
import com.google.android.play.core.integrity.IntegrityManagerFactory;
import com.google.android.play.core.integrity.IntegrityTokenRequest;

@CapacitorPlugin(name = "DeviceBind")
public class DeviceBindPlugin extends Plugin {

    @PluginMethod
    public void requestIntegrityToken(PluginCall call) {
        IntegrityManager manager = IntegrityManagerFactory.create(getContext());
        IntegrityTokenRequest.Builder req = IntegrityTokenRequest.builder();
        String cloudProjectNumber = call.getString("cloudProjectNumber");
        if (cloudProjectNumber != null) {
            try {
                req.setCloudProjectNumber(Long.parseLong(cloudProjectNumber));
            } catch (NumberFormatException e) {
                call.reject("bad cloudProjectNumber");
                return;
            }
        }
        manager.requestIntegrityToken(req.build())
            .addOnSuccessListener(r -> {
                JSObject out = new JSObject();
                out.put("token", r.token());
                call.resolve(out);
            })
            .addOnFailureListener(e ->
                call.reject("integrity token failed: " + e.getMessage()));
    }

    @PluginMethod
    public void generateToken(PluginCall call) {
        call.reject("ios only");
    }
}
```

Register it in `MainActivity` (`registerPlugin(DeviceBindPlugin.class);`
before `super.onCreate`), and add the Play library to
`android/app/build.gradle` if it is not already present transitively:

```groovy
implementation "com.google.android.play:integrity:1.4.0"
```

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
Sequence per D29: after the staging probe, and after enough client
uptake that activation-capable builds dominate (`v2_meta.latestBuild` /
`minBuild` are the existing levers).

Rolling back mid-incident is the same word back again — rules deploy,
no code change, no console visit.
