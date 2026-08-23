#!/usr/bin/env bash
# night-shift.sh — overnight Claude Code loop for this repo.
#
# Started by cron around midnight, then:
#   phase 1  AUDIT     claude scans the repo and writes NIGHT_TASKS.md as a
#                      `- [ ]` checklist, most important first
#   phase 2  FIX LOOP  one claude call per item: smallest fix, proven with
#                      the relevant runner/gates, exactly ONE commit each
#   repeat   both phases cycle until the night window closes — or earlier,
#            when an audit finds nothing or a whole cycle lands no commits
#   phase 3  SUMMARY   MORNING_SUMMARY.md in plain language, one line per
#                      commit with a risk label (safe / review carefully)
#
# Everything happens on a local branch night-YYYYMMDD cut from main.
# Nothing is ever pushed; main is never touched. In the morning:
#
#   cat MORNING_SUMMARY.md
#   git cherry-pick <hash>            # take fixes one by one, or
#   git merge night-YYYYMMDD          # take the whole night
#   git branch -d night-YYYYMMDD      # when you are done with it
#
# SETUP
#   1. Rehearse in daylight first — free, no API calls, exercises the whole
#      loop (branch, lock, audit, fixes, summary, cleanup) with stand-ins:
#        NIGHT_SHIFT_DRY_RUN=1 scripts/night-shift.sh
#   2. crontab -e  →  0 0 * * *  /FULL/PATH/TO/InSight/scripts/night-shift.sh
#      (the file is committed executable; `chmod +x` only if your checkout
#      lost the bit)
#
# CRON REALITIES — each of these has eaten someone's first night:
#   - cron's PATH is minimal. The script prepends the usual install dirs;
#     if `claude` still is not found, set NIGHT_SHIFT_CLAUDE=/full/path
#     in .night-shift/env.
#   - Auth: a logged-in `claude` keeps credentials under $HOME and just
#     works. If you use ANTHROPIC_API_KEY instead, put
#     `export ANTHROPIC_API_KEY=...` in .night-shift/env (gitignored);
#     it is sourced before anything else runs.
#   - The machine must be awake at midnight. Laptops sleep — use a desktop,
#     or on macOS `sudo pmset repeat wakeorpoweron MTWRFSU 23:58:00`, and
#     grant cron Full Disk Access if the audit cannot read the repo.
#
# COST — six hours of an Opus loop is real usage (API bill or Max-plan
# limits). The window/cycle/fix caps plus the two early stops bound it;
# NIGHT_SHIFT_MODEL=sonnet is the cheap dial.
#
# TRUST — the fix phase can run arbitrary shell (tests, git). That is the
# point, and it means: run this only on a machine and repo you would let
# an unattended agent work on.
#
# SAFETY PROPERTIES
#   - refuses to start on a dirty working tree — your WIP is sacred
#   - pidfile lock: a second start while one runs exits immediately
#   - stops early when an audit lists nothing, or a cycle lands no commits
#     (otherwise a clean repo re-audits in a tight loop all night, and one
#     unfixable first item would be retried until dawn)
#   - a night with zero commits deletes its empty branch on the way out
#   - NIGHT_TASKS.md / MORNING_SUMMARY.md / .night-shift/ are gitignored,
#     so overnight bookkeeping can never ride along in a commit
#
# KNOBS (environment, or persistent in .night-shift/env)
#   NIGHT_SHIFT_MODEL=opus         model for all three phases
#   NIGHT_SHIFT_HOURS=6            night window, whole hours
#   NIGHT_SHIFT_MAX_CYCLES=8      audit→fix cycles per night
#   NIGHT_SHIFT_MAX_FIXES=25      fix attempts per cycle
#   NIGHT_SHIFT_SLEEP=15          seconds between fix attempts
#   NIGHT_SHIFT_CALL_TIMEOUT=5400 hard cap per claude call (needs timeout(1))
#   NIGHT_SHIFT_CLAUDE=claude     path to the claude binary
#   NIGHT_SHIFT_BASE=main         branch the night branch is cut from
#   NIGHT_SHIFT_DRY_RUN=1         stand-in claude; test the plumbing free
#
# Logs, full transcripts included: .night-shift/logs/night-YYYYMMDD.log

set -u -o pipefail

# ---------------------------------------------------------------- config --

# The script lives in <repo>/scripts/, so the repo is one level up — which
# is why there is no "CHANGE THIS PATH" line to forget when the repo moves.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_PATH="${NIGHT_SHIFT_REPO:-$(cd "$SCRIPT_DIR/.." && pwd)}"
cd "$REPO_PATH" || exit 1

# Machine-local settings (API key, model override…). Sourced this early so
# it can set every knob below — which is also why it cannot set REPO_PATH.
[ -f "$REPO_PATH/.night-shift/env" ] && . "$REPO_PATH/.night-shift/env"

# cron runs with PATH=/usr/bin:/bin, which is where "works in my shell,
# dies in cron" comes from. Prepend the places claude and node actually live.
PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"; export PATH

MODEL="${NIGHT_SHIFT_MODEL:-opus}"
RUN_HOURS="${NIGHT_SHIFT_HOURS:-6}"
MAX_CYCLES="${NIGHT_SHIFT_MAX_CYCLES:-8}"
MAX_FIXES_PER_CYCLE="${NIGHT_SHIFT_MAX_FIXES:-25}"
SLEEP_BETWEEN="${NIGHT_SHIFT_SLEEP:-15}"
CALL_TIMEOUT="${NIGHT_SHIFT_CALL_TIMEOUT:-5400}"
CLAUDE_BIN="${NIGHT_SHIFT_CLAUDE:-claude}"
BASE_BRANCH="${NIGHT_SHIFT_BASE:-main}"
DRY_RUN="${NIGHT_SHIFT_DRY_RUN:-0}"
# Write is listed because two of the three phases exist to create a file.
ALLOWED_TOOLS="Read,Write,Edit,Bash,Glob,Grep"
AUDIT_TURNS=40 FIX_TURNS=40 SUMMARY_TURNS=30

[ "$DRY_RUN" = "1" ] && SLEEP_BETWEEN=0   # a free rehearsal should be fast

STAMP="$(date +%Y%m%d)"
BRANCH="night-$STAMP"
STATE_DIR="$REPO_PATH/.night-shift"
LOG_DIR="$STATE_DIR/logs"
LOG="$LOG_DIR/night-$STAMP.log"
TASKS="$REPO_PATH/NIGHT_TASKS.md"
SUMMARY="$REPO_PATH/MORNING_SUMMARY.md"
mkdir -p "$LOG_DIR"

# -------------------------------------------------------------- plumbing --

# Status lines go to stderr, not stdout: callers capture run_claude's stdout
# (the CYCLEDONE check), and a tee to stdout would pollute what they read.
log() { printf '%s  %s\n' "$(date '+%F %T')" "$*" | tee -a "$LOG" >&2; }

run_logged() { log "\$ $*"; "$@" >>"$LOG" 2>&1; }

# timeout(1) guards against one hung call eating the night. It is missing on
# stock macOS, hence a feature test instead of a hard dependency —
# --max-turns still bounds every call.
with_timeout() {
  if command -v timeout >/dev/null 2>&1; then
    timeout "$CALL_TIMEOUT" "$@"
  else
    "$@"
  fi
}

unchecked_count() {
  local c
  c="$(grep -c '^[[:space:]]*- \[ \]' "$TASKS" 2>/dev/null)"
  printf '%s' "${c:-0}"
}

night_commits() { git rev-list --count "$BASE_BRANCH..HEAD" 2>/dev/null || printf 0; }

# The dry run rehearses the loop's control flow with zero API calls: the
# "audit" writes a two-item sample list (first cycle only), each "fix"
# checks off one item, and once none remain it answers CYCLEDONE exactly as
# the real prompt instructs. The check-off is a bash rewrite because
# `sed -i` is not portable (BSD vs GNU).
dry_claude() {
  local label="$1" tmp line found
  case "$label" in
    audit*)
      if [ ! -f "$TASKS" ]; then
        printf '%s\n' \
          "# Night tasks (dry run)" \
          "- [ ] sample item one — nothing will actually change" \
          "- [ ] sample item two — nothing will actually change" >"$TASKS"
      fi
      ;;
    fix*)
      if [ "$(unchecked_count)" = "0" ]; then printf 'CYCLEDONE'; return 0; fi
      tmp="$TASKS.tmp" found=0
      : >"$tmp"
      while IFS= read -r line; do
        case "$line" in
          "- [ ]"*)
            if [ "$found" = "0" ]; then line="- [x]${line#- \[ \]}"; found=1; fi
            ;;
        esac
        printf '%s\n' "$line" >>"$tmp"
      done <"$TASKS"
      mv "$tmp" "$TASKS"
      printf 'checked one item (dry run)'
      ;;
  esac
}

# One claude call. Prints claude's own output for the caller; the status
# line and the full transcript go to the log.
run_claude() {
  local label="$1" turns="$2" prompt="$3" out rc
  log ">> $label (model=$MODEL, max-turns=$turns)"
  if [ "$DRY_RUN" = "1" ]; then
    out="$(dry_claude "$label")"
    rc=0
    log "[dry-run] $label -> ${out:-wrote/kept NIGHT_TASKS.md}"
  else
    out="$(with_timeout "$CLAUDE_BIN" -p "$prompt" \
      --model "$MODEL" \
      --permission-mode acceptEdits \
      --allowedTools "$ALLOWED_TOOLS" \
      --max-turns "$turns" 2>&1)"
    rc=$?
    printf '%s\n\n' "$out" >>"$LOG"
    if [ "$rc" -ne 0 ]; then
      log "!! $label exited rc=$rc — transcript is in the log"
    fi
  fi
  printf '%s' "$out"
  return "$rc"
}

# ------------------------------------------------------------- preflight --

# flock(1) is not on macOS; a pidfile with a liveness probe is the portable
# version, and single-user cron needs nothing stronger.
PIDFILE="$STATE_DIR/night-shift.pid"
if [ -f "$PIDFILE" ]; then
  oldpid="$(cat "$PIDFILE" 2>/dev/null)"
  if [ -n "${oldpid:-}" ] && kill -0 "$oldpid" 2>/dev/null; then
    log "another night shift (pid $oldpid) is still running; exiting"
    exit 0
  fi
fi
printf '%s' "$$" >"$PIDFILE"
trap 'rm -f "$PIDFILE"' EXIT

if [ "$DRY_RUN" != "1" ] && ! command -v "$CLAUDE_BIN" >/dev/null 2>&1; then
  log "claude not found (PATH=$PATH) — set NIGHT_SHIFT_CLAUDE=/full/path in .night-shift/env"
  exit 1
fi

# Refuse a dirty tree rather than stash it: midnight is exactly when WIP got
# left behind, and an automated stash is how WIP gets lost.
if [ -n "$(git status --porcelain)" ]; then
  log "working tree is not clean — commit or stash before bed; not starting"
  exit 1
fi

# Yesterday's bookkeeping moves out of the way BEFORE tonight's audit runs:
# if the audit failed to write and a stale list stayed at the root, the fix
# loop would happily work last week's items.
[ -f "$TASKS" ] && mv "$TASKS" "$LOG_DIR/prev-NIGHT_TASKS-$STAMP.md"
[ -f "$SUMMARY" ] && mv "$SUMMARY" "$LOG_DIR/prev-MORNING_SUMMARY-$STAMP.md"

run_logged git checkout "$BASE_BRANCH" || { log "cannot check out $BASE_BRANCH"; exit 1; }
run_logged git pull --ff-only origin "$BASE_BRANCH" \
  || log "warn: pull failed (offline?) — continuing on the local $BASE_BRANCH"
if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  # Same-night rerun (crash, manual restart): continue the existing branch.
  run_logged git checkout "$BRANCH" || exit 1
else
  run_logged git checkout -b "$BRANCH" || exit 1
fi

log "night shift on $BRANCH (window ${RUN_HOURS}h, model $MODEL$([ "$DRY_RUN" = "1" ] && printf ', DRY RUN'))"

# --------------------------------------------------------------- prompts --

AUDIT_PROMPT="$(cat <<'EOF'
Overnight audit. CLAUDE.md is ground truth and docs/ORIENTATION.md is the
map — deliberate conventions are NOT findings (the spec layer's
global-scope bridge, the unmounted patterns tab, answers being public by
design, MapStats returning null for five anchors: all intentional; see
CLAUDE.md "Things that look like bugs but are not").

Scan the codebase for real bugs, risky code, and clear improvement
opportunities. Only list issues that clearly matter — no style nitpicks.
Write NIGHT_TASKS.md at the repo root as a markdown checklist: one `- [ ]`
line per issue, most important first, each with file:line and one sentence
on why it matters. Cap the list at 10 items; a night is short.

If NIGHT_TASKS.md already exists from an earlier cycle tonight, keep its
`- [x]` and `- [-]` lines at the bottom and add only genuinely NEW issues
as `- [ ]` lines above them. If nothing new is worth doing, leave zero
`- [ ]` lines.

Do NOT fix anything yet, do not commit anything, and never push.
NIGHT_TASKS.md is gitignored on purpose — leave it untracked.
EOF
)"

FIX_PROMPT="$(cat <<'EOF'
You are midway through an overnight fix loop on a dedicated night branch.
If `git status` shows uncommitted changes, they are debris from an earlier
interrupted attempt tonight — discard them (`git checkout -- .` and
`git clean -fd`; the night started from a clean tree) before you begin.

Open NIGHT_TASKS.md and take the FIRST `- [ ]` (unchecked) item. Fix only
that item, as the smallest change that closes it, following CLAUDE.md.
Prove it: run the runner that covers the change — `npm run test:unit`,
`npm run test --prefix functions`, or `npm run test:scripts` — plus the
check gates the change touches (`npm run check:globals` for anything under
src/v2, `npm run lint`, and so on). `test:rules` and the e2e suites need
Java 21; if a runner the change really needs is unavailable on this
machine, run the closest one that works and say so in the commit body.
Keep the tree green.

Then make exactly ONE git commit for that fix with a clear message. Never
commit NIGHT_TASKS.md, MORNING_SUMMARY.md, or .night-shift/ (all
gitignored), and never push anything.

Finally update the item's line in NIGHT_TASKS.md: `- [x]` on success. If
the item cannot be fixed safely tonight, discard your changes and rewrite
its line as `- [-] (skipped: short reason)` so the morning summary can
report it.

If NIGHT_TASKS.md has no `- [ ]` lines left, reply with only the word
CYCLEDONE and change nothing.
EOF
)"

SUMMARY_PROMPT="Look at every commit on this branch compared to $BASE_BRANCH
(git log $BASE_BRANCH..HEAD -p). Write MORNING_SUMMARY.md at the repo root
in plain, non-technical language: for each commit, its short hash, one
sentence on what changed and why, and a risk label — safe / review
carefully. Then list every '- [-]' (skipped) and '- [ ]' (unfinished) line
from NIGHT_TASKS.md. Keep it readable over one coffee. Do not commit or
push anything; MORNING_SUMMARY.md stays untracked (it is gitignored)."

# ----------------------------------------------------- phases 1+2: cycle --

# A duration, not a wall-clock hour test: the draft this replaces used
# `date +%H` ranges, which also matched every afternoon (and would misfire
# when a run is started by hand for testing). Cron decides WHEN the night
# starts; this only decides how long it lasts.
DEADLINE=$((RUN_HOURS * 3600))
still_night() { [ "$SECONDS" -lt "$DEADLINE" ]; }

cycle=0
STOP_REASON="the ${RUN_HOURS}h window closed"
while still_night && [ "$cycle" -lt "$MAX_CYCLES" ]; do
  cycle=$((cycle + 1))
  before="$(night_commits)"

  log "-- cycle $cycle: audit"
  run_claude "audit c$cycle" "$AUDIT_TURNS" "$AUDIT_PROMPT" >/dev/null || true

  if [ "$(unchecked_count)" = "0" ]; then
    STOP_REASON="cycle $cycle's audit listed nothing actionable"
    log "$STOP_REASON — stopping early"
    break
  fi

  fixes=0
  while still_night && [ "$fixes" -lt "$MAX_FIXES_PER_CYCLE" ]; do
    fixes=$((fixes + 1))
    out="$(run_claude "fix c$cycle.$fixes" "$FIX_TURNS" "$FIX_PROMPT")" || true
    case "$out" in
      *CYCLEDONE*) log "cycle $cycle: task list drained"; break ;;
    esac
    sleep "$SLEEP_BETWEEN"
  done

  if ! still_night; then break; fi   # the default STOP_REASON stands

  # A cycle that lands no commits means the remaining items are beyond
  # tonight (or the audit keeps re-finding the same unfixables); another
  # audit would only spend tokens re-discovering that.
  if [ "$(night_commits)" -eq "$before" ]; then
    STOP_REASON="cycle $cycle landed no commits"
    log "$STOP_REASON — stopping early"
    break
  fi
done
if [ "$cycle" -ge "$MAX_CYCLES" ] && still_night; then
  STOP_REASON="hit the $MAX_CYCLES-cycle cap"
fi

# ------------------------------------------------------- phase 3: summary --

total="$(night_commits)"
log "-- morning summary ($STOP_REASON; $total commit(s) over $cycle cycle(s))"
rm -f "$SUMMARY"
if [ "$total" -gt 0 ] && [ "$DRY_RUN" != "1" ]; then
  run_claude "summary" "$SUMMARY_TURNS" "$SUMMARY_PROMPT" >/dev/null || true
fi
# Fallback for a quiet night — no commits means nothing worth an Opus call —
# and for a summary step that died: the morning file must always exist.
if [ ! -f "$SUMMARY" ]; then
  {
    printf '# Morning summary — %s\n\n' "$(date '+%F')"
    if [ "$total" -gt 0 ]; then
      printf 'The night shift made %s commit(s) on %s but the summary step failed;\nthe raw list:\n\n' "$total" "$BRANCH"
      git log --format='- %h %s' "$BASE_BRANCH..HEAD"
    else
      printf 'The night shift ran and made no commits (%s).\n' "$STOP_REASON"
    fi
    printf '\nFull log: .night-shift/logs/night-%s.log' "$STAMP"
    [ -f "$TASKS" ] && printf '  ·  task list: NIGHT_TASKS.md'
    printf '\n'
  } >"$SUMMARY"
fi

# ---------------------------------------------------------------- wrap-up --

# Land the checkout back on the base branch so the morning ritual
# (cherry-pick / merge) starts where it happens; keep the night branch only
# if it actually holds work.
if [ -n "$(git status --porcelain)" ]; then
  log "the last fix attempt left the tree dirty — staying on $BRANCH for inspection"
else
  run_logged git checkout "$BASE_BRANCH" || true
  if [ "$total" -eq 0 ]; then
    run_logged git branch -d "$BRANCH" || true
    log "no commits tonight; removed the empty $BRANCH"
  fi
fi

cp -f "$SUMMARY" "$LOG_DIR/MORNING_SUMMARY-$STAMP.md"
[ -f "$TASKS" ] && cp -f "$TASKS" "$LOG_DIR/NIGHT_TASKS-$STAMP.md"
if [ "$total" -gt 0 ]; then
  log "night shift complete: $total commit(s) waiting on $BRANCH — read MORNING_SUMMARY.md"
else
  log "night shift complete: quiet night — read MORNING_SUMMARY.md"
fi
