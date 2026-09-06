# Device screens — android

Screened `nightb-20260906-lanetest14-screens` @ 26b4018, run 34063159475 (https://github.com/Cosaxo/InSight/actions/runs/34063159475).

## Environment

- google-services.json: PLACEHOLDER (secret empty) — Firebase initialised against a project that does not exist; nothing reaches a backend
- avd: pixel_7 on system-images;android-33;google_apis;x86_64
- renderer: -gpu swiftshader_indirect -feature -Vulkan
- android: 13 · sdk_gphone64_x86_64 (attempt 1)
- process: alive 10s after launch
- emulator process at the end: RUNNING (a guest that stopped answering, if adb lost it)
- drive: success

## Report

`report.md` is the script's own report — findings first, then every screen. Start there.

## Files

- `00-launch-10s.png`
- `00-launch-2s.png`
- `adb-devices.txt`
- `android-sdk-gphone64-x86-64/01-daily.png`
- `android-sdk-gphone64-x86-64/02-daily-reveal.png`
- `android-sdk-gphone64-x86-64/03-daily-feed-1.png`
- `android-sdk-gphone64-x86-64/04-daily-feed-2.png`
- `android-sdk-gphone64-x86-64/05-daily-circle.png`
- `android-sdk-gphone64-x86-64/06-daily-1v1.png`
- `android-sdk-gphone64-x86-64/07-mirror.png`
- `android-sdk-gphone64-x86-64/08-mirror-you.png`
- `android-sdk-gphone64-x86-64/09-mirror-circle.png`
- `android-sdk-gphone64-x86-64/10-mirror-groups.png`
- `android-sdk-gphone64-x86-64/11-mirror-near.png`
- `android-sdk-gphone64-x86-64/12-mirror-city.png`
- `android-sdk-gphone64-x86-64/13-mirror-country.png`
- `android-sdk-gphone64-x86-64/14-mirror-world.png`
- `android-sdk-gphone64-x86-64/15-mirror-world-answers.png`
- `android-sdk-gphone64-x86-64/16-mirror-world-people.png`
- `android-sdk-gphone64-x86-64/17-mirror-world-scores.png`
- `android-sdk-gphone64-x86-64/18-mirror-world-explore.png`
- `android-sdk-gphone64-x86-64/19-mirror-world-compare.png`
- `android-sdk-gphone64-x86-64/20-profile.png`
- `android-sdk-gphone64-x86-64/21-profile-tests.png`
- `android-sdk-gphone64-x86-64/22-search.png`
- `crash-reporter-files.txt`
- `drive.log`
- `emulator.log`
- `environment.txt`
- `host-dmesg.txt`
- `host-memory.txt`
- `logcat-console.txt`
- `logcat-errors.txt`
- `report.json`
- `report.md`

## How to read these

- `00-launch-*.png` are the shell before anything drove it: the splash, the first paint, whatever a launch crash left. Look at them first.
- The numbered captures after that are the driven screens, in the order the flow walked them. The device's own status bar and home indicator are in the frame on purpose — safe areas are half of what this lane exists to show.
- `*-FAILED.png` (Android) is what was on screen when a drive step could not find the control it was told to tap; `report.md` names the step.
- `logcat-*.txt` / `syslog.txt` are the device's own errors for the run; `drive.log` / `maestro.log` are the driver's.

This ref is one orphan commit, replaced on every re-run. Delete it with the night branch it screened.
