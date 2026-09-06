# Device screens — 2026-09-06T22:36:14Z

Mode: **DEMO** · source: android:emulator-5554 · 12 screens across 1 profile(s) · **6 hard** / 0 soft finding(s)

Target: sdk_gphone64_x86_64 · com.cosaxo.insight

## Findings — read these first

- **[hard] android-sdk-gphone64-x86-64 / mirror-FAILED** — drive failed: page.screenshot: Timeout 30000ms exceeded.
Call log:
  - taking page screenshot
 → `(none)`
- **[hard] android-sdk-gphone64-x86-64 / mirror-stops-FAILED** — drive failed: locator.evaluateAll: Target page, context or browser has been closed → `(none)`
- **[hard] android-sdk-gphone64-x86-64 / mirror-lenses-FAILED** — drive failed: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /^mirror$/i }).first()
    - locator resolved to <button class="tab-btn">…</button>
  - attempting click action
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled → `(none)`
- **[hard] android-sdk-gphone64-x86-64 / profile-NO-APP** — drive failed: the app did not open for this scene — the emulator is gone (Command failed: adb -s emulator-5554 shell am force-stop com.cosaxo.insight
adb: device offline
) and both reboots this run allows are spent → `(none)`
- **[hard] android-sdk-gphone64-x86-64 / search-NO-APP** — drive failed: the app did not open for this scene — the emulator is gone (Command failed: adb -s emulator-5554 shell am force-stop com.cosaxo.insight
adb: device offline
) and both reboots this run allows are spent → `(none)`
- **[hard] android-sdk-gphone64-x86-64 / patterns-NO-APP** — drive failed: the app did not open for this scene — the emulator is gone (Command failed: adb -s emulator-5554 shell am force-stop com.cosaxo.insight
adb: device offline
) and both reboots this run allows are spent → `(none)`

## Screens

### sdk_gphone64_x86_64 (412×839 @2.625)

| # | screen | file | findings |
| --- | --- | --- | --- |
| 01 | daily | `android-sdk-gphone64-x86-64/01-daily.png` | ✓ |
| 02 | daily-reveal | `android-sdk-gphone64-x86-64/02-daily-reveal.png` | ✓ |
| 03 | daily-feed-1 | `android-sdk-gphone64-x86-64/03-daily-feed-1.png` | ✓ |
| 04 | daily-feed-2 | `android-sdk-gphone64-x86-64/04-daily-feed-2.png` | ✓ |
| 05 | daily-circle | `android-sdk-gphone64-x86-64/05-daily-circle.png` | ✓ |
| 06 | daily-1v1 | `android-sdk-gphone64-x86-64/06-daily-1v1.png` | ✓ |
| 07 | mirror-FAILED | `(none)` | ✗ drive failed |
| 08 | mirror-stops-FAILED | `(none)` | ✗ drive failed |
| 09 | mirror-lenses-FAILED | `(none)` | ✗ drive failed |
| 10 | profile-NO-APP | `(none)` | ✗ drive failed |
| 11 | search-NO-APP | `(none)` | ✗ drive failed |
| 12 | patterns-NO-APP | `(none)` | ✗ drive failed |

## What the checks mean

- **hard** — the screen is broken on its own evidence: the error boundary's text, an uncaught page error, or a drive step that could not find the control it was told to tap. The run exits 1.
- **soft** — a lead: text wider than the box it is set in, a control partly outside the viewport, a screen that did not change after a tap, a broken image, a failed webfont, a `console.error`, a failed request. A label cut on purpose reads the same as one cut by accident; a reader decides.
- Not checked, by design: overlap, contrast, alignment, whether the screen makes sense — that is what the PNGs are for.
