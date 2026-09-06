#!/usr/bin/env bash
# android-boot.sh — boot the emulator, install the debug APK, launch the
# app, capture the launch. Used twice: by device-screens.yml as its boot
# step, and by scripts/device-screens.mjs --android when the emulator dies
# under it mid-drive (DEVICE_SCREENS_REBOOT), so the drive can carry on
# from the next scene on a fresh emulator instead of ending with what it
# had.
#
# WHY A REBOOT IS PART OF THE DESIGN. On GitHub's hosted Linux runners the
# emulator process itself crashes — not a guest hang: the process is gone
# — one to three minutes after the app's WebView starts drawing, on the
# Android 14 and 15 images, whatever renderer: swiftshader_indirect with
# and without Vulkan, with the host-composition and direct-memory features
# off, the Play Store build of the image (2026-09-06, runs 34061114032
# through the seventeenth request of that night — eleven of twelve
# attempts). The Android 12 and 13 images ran the whole flow without a
# crash and cannot render the app: their WebViews predate color-mix(),
# oklch and dvh, so every capture was a colourless page and would have
# been a false finding. Android 15 draws it right and lived longest, six
# scenes, which is why it is the image and why a run expects to boot more
# than once.
#
# Inputs (environment): ANDROID_HOME, APP_ID, AVD_NAME (default screens),
# RESULTS (default results/android), APK (default the debug build's
# path), RENDERERS — a newline-separated list of emulator renderer
# arguments, one per attempt (default: three swiftshader_indirect
# attempts, Vulkan off on the last two).
#
# Exit 0 with the app alive on a booted device; exit 1 when every attempt
# lost the emulator, with environment.txt saying so.
set -uo pipefail

: "${ANDROID_HOME:?}"
: "${APP_ID:?}"
AVD_NAME="${AVD_NAME:-screens}"
RESULTS="${RESULTS:-results/android}"
APK="${APK:-android/app/build/outputs/apk/debug/app-debug.apk}"
RENDERERS="${RENDERERS:-$'-gpu swiftshader_indirect\n-gpu swiftshader_indirect -feature -Vulkan\n-gpu swiftshader_indirect -feature -Vulkan'}"
mkdir -p "$RESULTS"
BOOT_NO="$(( $(grep -c '^booted:' "$RESULTS/environment.txt" 2>/dev/null || echo 0) + 1 ))"

boot() {
  pkill -f "emulator/qemu" 2>/dev/null || true
  sleep 3
  : > "$RESULTS/emulator.log"
  echo "renderer: $1" >> "$RESULTS/environment.txt"
  # The full path, never `emulator` off PATH: the SDK ships a legacy
  # launcher under tools/ that dies with "Missing emulator engine program"
  # when it is found first.
  # shellcheck disable=SC2086
  "$ANDROID_HOME/emulator/emulator" -avd "$AVD_NAME" -no-window $1 -no-snapshot -noaudio -no-boot-anim \
    -camera-back none -camera-front none -memory 3072 >> "$RESULTS/emulator.log" 2>&1 &
  EMU=$!
  # When it dies, say when: the emulator has left its log without a last
  # line on every crash so far, and the moment is the one fact that
  # places the crash against what the app was doing.
  ( while kill -0 "$EMU" 2>/dev/null; do sleep 1; done; echo "emulator process gone at $(date -u +%H:%M:%S) UTC" >> "$RESULTS/environment.txt" ) &
  sleep 8
  echo "--- emulator, first seconds:"; head -40 "$RESULTS/emulator.log" || true
  # No `adb wait-for-device`: it blocks forever when the emulator process
  # has already died. Poll the boot property and fail the moment the
  # emulator is gone — its log is then the diagnosis.
  for _ in $(seq 1 120); do
    if ! kill -0 "$EMU" 2>/dev/null; then
      echo "the emulator process exited before the device booted"; tail -80 "$RESULTS/emulator.log"; return 1
    fi
    [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ] && break
    sleep 5
  done
  [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ] || { echo "no boot in ten minutes"; adb devices || true; tail -80 "$RESULTS/emulator.log"; return 1; }
  # sys.boot_completed flips while the system is still settling: wait for
  # the boot animation to stop and give it a moment more before asking it
  # to install anything.
  for _ in $(seq 1 60); do
    [ "$(adb shell getprop init.svc.bootanim 2>/dev/null | tr -d '\r')" = "stopped" ] && break
    sleep 2
  done
  sleep 15
  # No animation scales: a capture taken mid-transition is a capture of
  # nothing, and the driver's waits are tuned for the app's own motion,
  # not the OS's.
  adb shell settings put global window_animation_scale 0 || true
  adb shell settings put global transition_animation_scale 0 || true
  adb shell settings put global animator_duration_scale 0 || true
  adb shell input keyevent 82 || true
  return 0
}

launch() {
  adb install -r "$APK" || return 1
  adb logcat -c || true
  adb shell am start -W -n "$APP_ID/.MainActivity" || true
  sleep 2;  adb exec-out screencap -p > "$RESULTS/00-launch-${BOOT_NO}-2s.png" || true
  sleep 8;  adb exec-out screencap -p > "$RESULTS/00-launch-${BOOT_NO}-10s.png" || true
  adb get-state > /dev/null 2>&1
}

attempt=0
while IFS= read -r renderer; do
  [ -n "$renderer" ] || continue
  attempt=$((attempt + 1))
  echo "::group::boot $BOOT_NO, attempt $attempt — $renderer"
  if ! boot "$renderer"; then echo "::endgroup::"; continue; fi
  echo "::endgroup::"
  echo "booted: $(adb shell getprop ro.build.version.release | tr -d '\r') · $(adb shell getprop ro.product.model | tr -d '\r') (boot $BOOT_NO, attempt $attempt)" >> "$RESULTS/environment.txt"
  if launch; then
    if adb shell pidof "$APP_ID" > /dev/null 2>&1; then
      echo "process: alive 10s after launch (boot $BOOT_NO)" >> "$RESULTS/environment.txt"
    else
      echo "process: GONE 10s after launch (boot $BOOT_NO) — a launch crash; logcat-errors.txt has it" >> "$RESULTS/environment.txt"
    fi
    exit 0
  fi
  echo "the emulator disappeared during the launch (boot $BOOT_NO, attempt $attempt)"
  echo "emulator: disappeared during the launch (boot $BOOT_NO, attempt $attempt)" >> "$RESULTS/environment.txt"
done <<< "$RENDERERS"
echo "process: UNKNOWN — the emulator disappeared during the launch on every attempt of boot $BOOT_NO; emulator.log is the evidence" >> "$RESULTS/environment.txt"
echo "::error::the emulator did not survive the app's launch on any attempt (boot $BOOT_NO)"
exit 1
