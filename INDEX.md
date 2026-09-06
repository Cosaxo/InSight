# Device screens — ios

Screened `nightb-20260906-lanetest14-screens` @ 26b4018, run 34063159475 (https://github.com/Cosaxo/InSight/actions/runs/34063159475).

## Environment

- GoogleService-Info.plist: present
- simulator: iPhone 17 Pro · iOS-26-5 (0130C0CE-9E1A-4769-A6A0-FA820D0295E6)
- plist in the bundle: yes
- process: alive 11s after launch
- maestro screenshots collected: 6
- drive: failure

## Files

- `00-launch-11s.png`
- `00-launch-3s.png`
- `01-daily.png`
- `02-daily-circle.png`
- `03-daily-1v1.png`
- `04-mirror.png`
- `05-mirror-you.png`
- `06-mirror-circle.png`
- `99-final.png`
- `device.txt`
- `environment.txt`
- `maestro-files.txt`
- `maestro-junit.xml`
- `maestro-version.txt`
- `maestro.log`
- `maestro/2026-09-06_223333/InSight device screens/commands.json`
- `maestro/2026-09-06_223333/InSight device screens/manifest.json`
- `maestro/2026-09-06_223333/InSight device screens/takeScreenshot/01-daily.png`
- `maestro/2026-09-06_223333/InSight device screens/takeScreenshot/02-daily-circle.png`
- `maestro/2026-09-06_223333/InSight device screens/takeScreenshot/03-daily-1v1.png`
- `maestro/2026-09-06_223333/InSight device screens/takeScreenshot/04-mirror.png`
- `maestro/2026-09-06_223333/InSight device screens/takeScreenshot/05-mirror-you.png`
- `maestro/2026-09-06_223333/InSight device screens/takeScreenshot/06-mirror-circle.png`
- `maestro/2026-09-06_223333/xctest_runner_2026-09-06_223348.log`
- `syslog.txt`

## How to read these

- `00-launch-*.png` are the shell before anything drove it: the splash, the first paint, whatever a launch crash left. Look at them first.
- The numbered captures after that are the driven screens, in the order the flow walked them. The device's own status bar and home indicator are in the frame on purpose — safe areas are half of what this lane exists to show.
- `*-FAILED.png` (Android) is what was on screen when a drive step could not find the control it was told to tap; `report.md` names the step.
- `logcat-*.txt` / `syslog.txt` are the device's own errors for the run; `drive.log` / `maestro.log` are the driver's.

This ref is one orphan commit, replaced on every re-run. Delete it with the night branch it screened.
