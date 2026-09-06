# Device screens — 2026-09-06T22:05:37Z

Mode: **DEMO** · source: android:emulator-5554 · 22 screens across 1 profile(s) · **0 hard** / 1 soft finding(s) · 1 skipped

Target: sdk_gphone64_x86_64 · com.cosaxo.insight

## Findings — read these first

- **[soft] android-sdk-gphone64-x86-64 / mirror-world-compare** — text wider than its box: <span> "establishment" by 8px (overflow-x: visible, below the fold) → `android-sdk-gphone64-x86-64/19-mirror-world-compare.png`

## Screens

### sdk_gphone64_x86_64 (412×867 @2.625)

| # | screen | file | findings |
| --- | --- | --- | --- |
| 01 | daily | `android-sdk-gphone64-x86-64/01-daily.png` | ✓ |
| 02 | daily-reveal | `android-sdk-gphone64-x86-64/02-daily-reveal.png` | ✓ |
| 03 | daily-feed-1 | `android-sdk-gphone64-x86-64/03-daily-feed-1.png` | ✓ |
| 04 | daily-feed-2 | `android-sdk-gphone64-x86-64/04-daily-feed-2.png` | ✓ |
| 05 | daily-circle | `android-sdk-gphone64-x86-64/05-daily-circle.png` | ✓ |
| 06 | daily-1v1 | `android-sdk-gphone64-x86-64/06-daily-1v1.png` | ✓ |
| 07 | mirror | `android-sdk-gphone64-x86-64/07-mirror.png` | ✓ |
| 08 | mirror-you | `android-sdk-gphone64-x86-64/08-mirror-you.png` | ✓ |
| 09 | mirror-circle | `android-sdk-gphone64-x86-64/09-mirror-circle.png` | ✓ |
| 10 | mirror-groups | `android-sdk-gphone64-x86-64/10-mirror-groups.png` | ✓ |
| 11 | mirror-near | `android-sdk-gphone64-x86-64/11-mirror-near.png` | ✓ |
| 12 | mirror-city | `android-sdk-gphone64-x86-64/12-mirror-city.png` | ✓ |
| 13 | mirror-country | `android-sdk-gphone64-x86-64/13-mirror-country.png` | ✓ |
| 14 | mirror-world | `android-sdk-gphone64-x86-64/14-mirror-world.png` | ✓ |
| 15 | mirror-world-answers | `android-sdk-gphone64-x86-64/15-mirror-world-answers.png` | ✓ |
| 16 | mirror-world-people | `android-sdk-gphone64-x86-64/16-mirror-world-people.png` | ✓ |
| 17 | mirror-world-scores | `android-sdk-gphone64-x86-64/17-mirror-world-scores.png` | ✓ |
| 18 | mirror-world-explore | `android-sdk-gphone64-x86-64/18-mirror-world-explore.png` | ✓ |
| 19 | mirror-world-compare | `android-sdk-gphone64-x86-64/19-mirror-world-compare.png` | △ text wider than its box |
| 20 | profile | `android-sdk-gphone64-x86-64/20-profile.png` | ✓ |
| 21 | profile-tests | `android-sdk-gphone64-x86-64/21-profile-tests.png` | ✓ |
| 22 | search | `android-sdk-gphone64-x86-64/22-search.png` | ✓ |

## Skipped

- **patterns** — the tab is mounted on a data condition (D265) and this build has not crossed it — absent by design

## What the checks mean

- **hard** — the screen is broken on its own evidence: the error boundary's text, an uncaught page error, or a drive step that could not find the control it was told to tap. The run exits 1.
- **soft** — a lead: text wider than the box it is set in, a control partly outside the viewport, a screen that did not change after a tap, a broken image, a failed webfont, a `console.error`, a failed request. A label cut on purpose reads the same as one cut by accident; a reader decides.
- Not checked, by design: overlap, contrast, alignment, whether the screen makes sense — that is what the PNGs are for.
