# Device screens — android

Screened `nightb-20260906-lanetest11-screens` @ 3d3dde3, run 34062601291 (https://github.com/Cosaxo/InSight/actions/runs/34062601291).

## Environment

- google-services.json: PLACEHOLDER (secret empty) — Firebase initialised against a project that does not exist; nothing reaches a backend
- avd: pixel_7 on system-images;android-34;google_apis;x86_64
- renderer: -gpu swiftshader_indirect -feature -Vulkan
- android: 14 · sdk_gphone64_x86_64 (attempt 1)
- process: alive 10s after launch
- drive: failure

## Report

`report.md` is the script's own report — findings first, then every screen. Start there.

## Files

- `00-launch-10s.png`
- `00-launch-2s.png`
- `adb-devices.txt`
- `drive.log`
- `emulator.log`
- `environment.txt`
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
