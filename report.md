# Device screens — 2026-09-06T22:20:41Z

Mode: **UNKNOWN** · source: android:emulator-5554 · 11 screens across 1 profile(s) · **11 hard** / 0 soft finding(s)

Target: sdk_gphone64_x86_64 · com.cosaxo.insight

## Findings — read these first

- **[hard] android-sdk-gphone64-x86-64 / daily-NO-APP** — drive failed: the app did not open for this scene — Cannot read properties of undefined (reading 'webView') → `(none)`
- **[hard] android-sdk-gphone64-x86-64 / daily-reveal-NO-APP** — drive failed: the app did not open for this scene — Command failed: adb -s emulator-5554 shell am force-stop com.cosaxo.insight
adb: device 'emulator-5554' not found
 → `(none)`
- **[hard] android-sdk-gphone64-x86-64 / daily-feed-NO-APP** — drive failed: the app did not open for this scene — Command failed: adb -s emulator-5554 shell am force-stop com.cosaxo.insight
adb: device 'emulator-5554' not found
 → `(none)`
- **[hard] android-sdk-gphone64-x86-64 / daily-circle-NO-APP** — drive failed: the app did not open for this scene — Command failed: adb -s emulator-5554 shell am force-stop com.cosaxo.insight
adb: device 'emulator-5554' not found
 → `(none)`
- **[hard] android-sdk-gphone64-x86-64 / daily-1v1-NO-APP** — drive failed: the app did not open for this scene — Command failed: adb -s emulator-5554 shell am force-stop com.cosaxo.insight
adb: device 'emulator-5554' not found
 → `(none)`
- **[hard] android-sdk-gphone64-x86-64 / mirror-NO-APP** — drive failed: the app did not open for this scene — Command failed: adb -s emulator-5554 shell am force-stop com.cosaxo.insight
adb: device 'emulator-5554' not found
 → `(none)`
- **[hard] android-sdk-gphone64-x86-64 / mirror-stops-NO-APP** — drive failed: the app did not open for this scene — Command failed: adb -s emulator-5554 shell am force-stop com.cosaxo.insight
adb: device 'emulator-5554' not found
 → `(none)`
- **[hard] android-sdk-gphone64-x86-64 / mirror-lenses-NO-APP** — drive failed: the app did not open for this scene — Command failed: adb -s emulator-5554 shell am force-stop com.cosaxo.insight
adb: device 'emulator-5554' not found
 → `(none)`
- **[hard] android-sdk-gphone64-x86-64 / profile-NO-APP** — drive failed: the app did not open for this scene — Command failed: adb -s emulator-5554 shell am force-stop com.cosaxo.insight
adb: device 'emulator-5554' not found
 → `(none)`
- **[hard] android-sdk-gphone64-x86-64 / search-NO-APP** — drive failed: the app did not open for this scene — Command failed: adb -s emulator-5554 shell am force-stop com.cosaxo.insight
adb: device 'emulator-5554' not found
 → `(none)`
- **[hard] android-sdk-gphone64-x86-64 / patterns-NO-APP** — drive failed: the app did not open for this scene — Command failed: adb -s emulator-5554 shell am force-stop com.cosaxo.insight
adb: device 'emulator-5554' not found
 → `(none)`

## Screens

### sdk_gphone64_x86_64 (0×0 @2.625)

| # | screen | file | findings |
| --- | --- | --- | --- |
| 01 | daily-NO-APP | `(none)` | ✗ drive failed |
| 02 | daily-reveal-NO-APP | `(none)` | ✗ drive failed |
| 03 | daily-feed-NO-APP | `(none)` | ✗ drive failed |
| 04 | daily-circle-NO-APP | `(none)` | ✗ drive failed |
| 05 | daily-1v1-NO-APP | `(none)` | ✗ drive failed |
| 06 | mirror-NO-APP | `(none)` | ✗ drive failed |
| 07 | mirror-stops-NO-APP | `(none)` | ✗ drive failed |
| 08 | mirror-lenses-NO-APP | `(none)` | ✗ drive failed |
| 09 | profile-NO-APP | `(none)` | ✗ drive failed |
| 10 | search-NO-APP | `(none)` | ✗ drive failed |
| 11 | patterns-NO-APP | `(none)` | ✗ drive failed |

## What the checks mean

- **hard** — the screen is broken on its own evidence: the error boundary's text, an uncaught page error, or a drive step that could not find the control it was told to tap. The run exits 1.
- **soft** — a lead: text wider than the box it is set in, a control partly outside the viewport, a screen that did not change after a tap, a broken image, a failed webfont, a `console.error`, a failed request. A label cut on purpose reads the same as one cut by accident; a reader decides.
- Not checked, by design: overlap, contrast, alignment, whether the screen makes sense — that is what the PNGs are for.
