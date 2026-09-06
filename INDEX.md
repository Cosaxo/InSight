# Device screens — ios

Screened `nightb-20260906-lanetest11-screens` @ 3d3dde3, run 34062601291 (https://github.com/Cosaxo/InSight/actions/runs/34062601291).

## Environment

- GoogleService-Info.plist: present
- simulator: iPhone 17 Pro · iOS-26-5 (6EE862FE-93F2-4D55-946E-8745EE2B3A88)
- plist in the bundle: yes
- process: alive 11s after launch
- maestro screenshots collected: 0
- drive: failure

## Files

- `00-launch-11s.png`
- `00-launch-3s.png`
- `99-final.png`
- `device.txt`
- `environment.txt`
- `maestro-files.txt`
- `maestro-version.txt`
- `maestro.log`
- `maestro/2026-09-06_220917/xctest_runner_2026-09-06_220943.log`
- `syslog.txt`

## How to read these

- `00-launch-*.png` are the shell before anything drove it: the splash, the first paint, whatever a launch crash left. Look at them first.
- The numbered captures after that are the driven screens, in the order the flow walked them. The device's own status bar and home indicator are in the frame on purpose — safe areas are half of what this lane exists to show.
- `*-FAILED.png` (Android) is what was on screen when a drive step could not find the control it was told to tap; `report.md` names the step.
- `logcat-*.txt` / `syslog.txt` are the device's own errors for the run; `drive.log` / `maestro.log` are the driver's.

This ref is one orphan commit, replaced on every re-run. Delete it with the night branch it screened.
