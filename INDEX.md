# Device screens — android

Screened `nightb-20260906-lanetest18-screens` @ 4979824, run 34064026935 (https://github.com/Cosaxo/InSight/actions/runs/34064026935).

## Environment

- google-services.json: PLACEHOLDER (secret empty) — Firebase initialised against a project that does not exist; nothing reaches a backend
- avd: pixel_7 on system-images;android-35;google_apis;x86_64
- emulator process at the end: GONE (a host-side crash, if adb lost it)
- logs collected at 22:30:55 UTC
- drive: skipped

## Files

- `adb-devices.txt`
- `environment.txt`
- `host-dmesg.txt`
- `host-memory.txt`
- `logcat-console.txt`
- `logcat-errors.txt`

## How to read these

- `00-launch-*.png` are the shell before anything drove it: the splash, the first paint, whatever a launch crash left. Look at them first.
- The numbered captures after that are the driven screens, in the order the flow walked them. The device's own status bar and home indicator are in the frame on purpose — safe areas are half of what this lane exists to show.
- `*-FAILED.png` (Android) is what was on screen when a drive step could not find the control it was told to tap; `report.md` names the step.
- `logcat-*.txt` / `syslog.txt` are the device's own errors for the run; `drive.log` / `maestro.log` are the driver's.

This ref is one orphan commit, replaced on every re-run. Delete it with the night branch it screened.
