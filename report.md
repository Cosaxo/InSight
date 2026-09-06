# Device screens — 2026-09-06T22:13:19Z

Mode: **DEMO** · source: android:emulator-5554 · 6 screens across 1 profile(s) · **1 hard** / 0 soft finding(s)

Target: sdk_gphone64_x86_64 · com.cosaxo.insight

## Findings — read these first

- **[hard] the run ended early** — page.screenshot: Target page, context or browser has been closed; every screen below is what landed before that
None from the automatic checks. Look at the screens anyway — the checks see overflow and errors, not taste.

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

## What the checks mean

- **hard** — the screen is broken on its own evidence: the error boundary's text, an uncaught page error, or a drive step that could not find the control it was told to tap. The run exits 1.
- **soft** — a lead: text wider than the box it is set in, a control partly outside the viewport, a screen that did not change after a tap, a broken image, a failed webfont, a `console.error`, a failed request. A label cut on purpose reads the same as one cut by accident; a reader decides.
- Not checked, by design: overlap, contrast, alignment, whether the screen makes sense — that is what the PNGs are for.
