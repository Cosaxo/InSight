#!/usr/bin/env bash
# publish.sh <platform> — hand a Device screens job's results back over git.
#
# Pushes results/<platform> as ONE orphan commit to
# refs/heads/screens/<name>-<platform>, where <name> is the triggering
# branch with its `-screens` request suffix removed (a dispatch keeps its
# branch name). Force-pushed, so a re-run replaces the commit rather than
# stacking on it and the ref never grows history; the owner deletes it with
# the night branch. INDEX.md is written first so a reader opening the ref
# cold knows what they are looking at and where it came from.
#
# Git rather than an artifact because the readers have git and nothing
# else: the night shifts push branches and read origin, and have no GitHub
# API to fetch an artifact with (docs/ROUTINES.md § 2). A results branch is
# what they can `git fetch`.
#
# Shared by both platform jobs so the two cannot drift apart — the same
# reason scripts/store-render.mjs exists.
set -euo pipefail

PLATFORM="${1:?platform (android|ios)}"
SRC="results/${PLATFORM}"
NAME="${GITHUB_REF_NAME%-screens}"
DEST="screens/${NAME}-${PLATFORM}"

if [ ! -d "$SRC" ]; then
  echo "publish: nothing in $SRC — the job died before it captured anything"
  exit 0
fi

TMP="$(mktemp -d)"
cp -R "$SRC"/. "$TMP"/
cd "$TMP"

# GitHub refuses a file over 100 MB and warns over 50, and one such file
# refuses the whole push — run 34061114032's iOS results were lost to a
# 205 MB simulator log Maestro had written. Anything that large is not a
# capture; drop it and say so, rather than lose the captures beside it.
DROPPED=""
while IFS= read -r big; do
  DROPPED="${DROPPED}- \`${big#./}\` ($(du -h "$big" | cut -f1)) — over the size a results ref may carry, dropped before publishing
"
  rm -f "$big"
done < <(find . -type f -size +45M -not -path './.git/*' 2>/dev/null)

{
  echo "# Device screens — ${PLATFORM}"
  echo
  echo "Screened \`${GITHUB_REF_NAME}\` @ ${GITHUB_SHA:0:7}, run ${GITHUB_RUN_ID} (${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID})."
  echo
  echo "## Environment"
  echo
  if [ -f environment.txt ]; then sed 's/^/- /' environment.txt; else echo "- (no environment.txt — the job did not get that far)"; fi
  echo
  if [ -f report.md ]; then
    echo "## Report"
    echo
    echo "\`report.md\` is the script's own report — findings first, then every screen. Start there."
    echo
  fi
  echo "## Files"
  echo
  find . -type f ! -name INDEX.md ! -path './.git/*' | sed 's|^\./||' | sort | sed 's/^/- `/; s/$/`/'
  echo
  if [ -n "$DROPPED" ]; then
    echo "## Dropped"
    echo
    printf '%s' "$DROPPED"
    echo
  fi
  echo "## How to read these"
  echo
  echo "- \`00-launch-*.png\` are the shell before anything drove it: the splash, the first paint, whatever a launch crash left. Look at them first."
  echo "- The numbered captures after that are the driven screens, in the order the flow walked them. The device's own status bar and home indicator are in the frame on purpose — safe areas are half of what this lane exists to show."
  echo "- \`*-FAILED.png\` (Android) is what was on screen when a drive step could not find the control it was told to tap; \`report.md\` names the step."
  echo "- \`logcat-*.txt\` / \`syslog.txt\` are the device's own errors for the run; \`drive.log\` / \`maestro.log\` are the driver's."
  echo
  echo "This ref is one orphan commit, replaced on every re-run. Delete it with the night branch it screened."
} > INDEX.md

git init -q -b screens
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git add -A
git commit -q -m "device screens: ${PLATFORM} for ${NAME} @ ${GITHUB_SHA:0:7} (run ${GITHUB_RUN_ID})"
git push --force "https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" "HEAD:refs/heads/${DEST}"
echo "published $(find . -type f ! -path './.git/*' | wc -l | tr -d ' ') files to ${DEST}"
