# Device screens — android

Screened `nightb-20260906-lanetest20-screens` @ 871a342, run 34064302954 (https://github.com/Cosaxo/InSight/actions/runs/34064302954).

## Environment

- google-services.json: PLACEHOLDER (secret empty) — Firebase initialised against a project that does not exist; nothing reaches a backend
- avd: pixel_7 on system-images;android-35;google_apis;x86_64
- renderer: -gpu swiftshader_indirect
- booted: 15 · sdk_gphone64_x86_64 (boot 1, attempt 1)
- process: alive 10s after launch (boot 1)
- emulator process gone at 22:38:20 UTC
- renderer: -gpu swiftshader_indirect
- booted: 15 · sdk_gphone64_x86_64 (boot 2, attempt 1)
- process: alive 10s after launch (boot 2)
- emulator process gone at 22:40:31 UTC
- renderer: -gpu swiftshader_indirect
- booted: 15 · sdk_gphone64_x86_64 (boot 3, attempt 1)
- process: alive 10s after launch (boot 3)
- emulator process gone at 22:42:20 UTC
- emulator process at the end: GONE (a host-side crash, if adb lost it)
- logs collected at 22:44:20 UTC
- drive: failure

## Report

`report.md` is the script's own report — findings first, then every screen. Start there.

## Files

- `00-launch-1-10s.png`
- `00-launch-1-2s.png`
- `00-launch-2-10s.png`
- `00-launch-2-2s.png`
- `00-launch-3-10s.png`
- `00-launch-3-2s.png`
- `adb-devices.txt`
- `android-sdk-gphone64-x86-64/01-daily.png`
- `android-sdk-gphone64-x86-64/02-daily-reveal.png`
- `android-sdk-gphone64-x86-64/03-daily-feed-1.png`
- `android-sdk-gphone64-x86-64/04-daily-feed-2.png`
- `android-sdk-gphone64-x86-64/05-daily-circle.png`
- `android-sdk-gphone64-x86-64/06-daily-1v1.png`
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
