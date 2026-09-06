InSight night shift B — one flow of an unattended nightly loop on Cosaxo/InSight. Nobody is
watching. Work the whole budget, stop on time, and leave a branch the owner can read at
breakfast. Mode is ultracode: fan out ONCE a night, verify adversarially. The fan-out width is
stated below and it is a ceiling, not a target — the night audits the tree one time and spends
the rest of itself fixing what that audit found, on the code AND on the phones.

## Which flow you are

`date -u +%H` decides, nothing else:

  20           → AUDIT + FIX flow, 95 minutes. The night's ONLY fan-out.
  22 · 00 · 02 → FIX flows, 95 minutes each. No fan-out: work the list the 20:00 flow left.
  04           → CLOSING + MERGE flow, 110 minutes.

Flows are two hours apart, so a flow that overruns eats the next one's start. Stop on time and
let the next flow continue where you left off: an unfinished item on the list is fine, a
half-finished commit is not.

**Why one fan-out and four fixing flows.** Measured 2026-09-03 (docs/USAGE-REDUCTION.md): four
audit flows landed 6 · 6 · 6 · 6 commits and shift A's landed 8 · 8 · 8 · 8 — the same number
every flow is a CAP being hit, not a tree being exhausted, and the cap was 8. Three fan-outs a
night were re-deriving findings a bigger list would have held from the first one. So the list
cap is 32, the fan-out runs once, and the other three audit-hour flows fix instead. That is the
L1 lever the owner approved ("audit once, fix four times"); the schedule stayed at five flows.

The 110 minutes at 04:00 UTC are arithmetic, not a preference — 04:00 UTC is 06:00 Oslo, and
110 minutes puts the summary on the branch before 08:00 local, which is the deadline D326 §2
set for the other shift and this one keeps.

## There are two night shifts, and you are B

The other shift ("InSight night shift", another subscription, another container) audits the
same tree on the same nights at 21/23/01/03/05 UTC and pushes to `night-YYYYMMDD`. You will
never see its session and it will never see yours. Everything you share is on origin.

  - Your branch is `nightb-YYYYMMDD`. Never push to `night-*`, never to `main`.
  - `nightb-*` does not match the glob `night-*`, so neither shift's enumeration sweeps in the
    other's branches. Keep it that way: `night-YYYYMMDD-b` would, and `night-YYYYMMDD/b` is
    refused outright by the remote as a ref conflict.
  - Your working files are `NIGHTB_TASKS.md`, `NIGHTB_SUMMARY.md`, `.nightb/` — gitignored,
    never committed, kept at the repo ROOT (a scratch file under `src/` gets linted and
    typechecked). `git add -A` is banned; stage the files you changed by name.

## Every flow, before anything else

1. **Deepen before you trust any history.** The wake may land on a freshly provisioned
   container, and this repo arrives SHALLOW. In that state `git merge-base --is-ancestor`
   exits non-zero for a branch whose history is merely absent — indistinguishable from a
   branch that genuinely is not merged, and silently wrong in the direction that matters. It
   fired on the container that wrote this brief: two long-merged branches read as unmerged
   until the history was fetched. So, first, every time:

       git rev-parse --is-shallow-repository        # true → you cannot trust anything below
       git fetch --unshallow origin || git fetch origin
       git fetch origin --prune '+refs/heads/*:refs/remotes/origin/*'

   Assume the local checkout is stale. Only origin holds the truth.
2. Read `CLAUDE.md` (ground truth) and `docs/ORIENTATION.md` (the map). Both are gated, so
   neither can quietly stop being true.
3. Resolve the date once, at flow start:
   `D=$(TZ=Europe/Oslo date -d '+4 hours' +%Y%m%d)` — dated by the MORNING being prepared, so
   all five firings resolve to the same date in CET and in CEST alike. Do not "simplify" the
   `+4 hours`: the 20:00 UTC firing is 21:00 Oslo in winter, where `+3` lands exactly on
   midnight with no margin at all.
4. Branch `nightb-$D`. If it is on origin, continue it; otherwise cut it from `origin/main` and
   record the base SHA in `NIGHTB_TASKS.md`. Later flows continue the branch — they do not
   re-cut it. Record it because main moves at every hour of the day: recomputed 2026-09-03
   over the whole history (1,069 commits, console and pulse rows excluded), no two-hour
   window carries less than 6.6% of them and 01:00 and 03:00 UTC carry 61 each. Do not treat
   any hour as a quiet base. The base you cut at 20:00 can be stale within minutes and the
   whole night is judged against it. The closing flow's trial merge is what reports how far
   main has moved since.
5. `npm ci`, and a separate `npm ci --prefix functions`. Skip either only if its
   `node_modules` is already present and healthy.
6. **Ask for the phones, then look at them yourself** — § The device pass, below. One push
   starts the real shells on GitHub's runners; one command renders the app at phone geometry
   here. Both at flow start, so the results are back while you are still auditing.

## Know what the other shift already did tonight

Before you audit anything:

    git log --oneline origin/main..origin/night-$D     # empty or missing = it hasn't started
    git diff --stat origin/main...origin/night-$D

Every defect those commits close is OFF your list, and so is any file they are actively
rewriting — two branches carrying two different fixes for one bug is the failure this check
exists to prevent, and it costs one command. Read the commit messages: they name the defect.
The other shift's task list is gitignored, so its commits are the only signal there is.

Your 20:00 flow runs before that shift starts and will find nothing there. That flow works
items `NIGHTB_TASKS.md` already carries before deriving anything new, and records `file:line`
for everything it finds so a later flow can spot the collision.

## The device pass — what the app looks like on a phone, and what does not work there

Every gate in this tree reads names, types and counts, and the mount suites render into jsdom,
which has no layout. A row that wraps onto a third line on a small iPhone, a button under the
home indicator, a lens label that no longer fits, a stop that paints nothing, a tap that does
nothing — none of that is red anywhere, and until this pass it was found by the owner on a
phone. It is yours now. Two instruments, both already in the tree:

**A. The real shells, on GitHub's runners** (`.github/workflows/device-screens.yml`). Your
container has no `/dev/kvm` (measured 2026-09-06) and no macOS, so an Android emulator cannot
run here and an iOS simulator cannot exist here. The runners have both. You need no API: the
request is a push, the results come back over git.

    git push origin HEAD:refs/heads/nightb-$D-screens        # the request — once per flow, at flow start

That is a `nightb-*` ref, inside your push authorization, and it is a POINTER, not a branch you
work on: the lane deletes it when both platforms are done, so the next request is a plain push
(you never force-push, and this keeps it that way). Skip the request when the head has not moved
since the last one — the results' INDEX.md names the SHA it screened. About 15–25 minutes later:

    git fetch origin '+refs/heads/screens/*:refs/remotes/origin/screens/*'
    mkdir -p .nightb/screens/android .nightb/screens/ios
    git archive origin/screens/nightb-$D-android | tar -x -C .nightb/screens/android
    git archive origin/screens/nightb-$D-ios     | tar -x -C .nightb/screens/ios

Each is one orphan commit — PNGs, `INDEX.md`, `environment.txt`, the device's own logs, and on
Android the script's `report.md`. Read `INDEX.md` first, then the `00-launch-*` captures (a
splash that never hands over and a launch crash are both visible there and nowhere else), then
the driven screens. If a results ref is missing when you look, the lane is still running or it
died: check again later in the flow, and name it as unrun in the summary if it never came —
never as green.

**B. The app at phone geometry, here** (`scripts/device-screens.mjs`):

    npm run build && node scripts/device-screens.mjs --out .nightb/screens/web

Three minutes: the demo build in Chromium at an iPhone SE, an iPhone 15 Pro and a Pixel 7, every
screen — the daily and its reveal, the feed, Circle and 1v1, the Mirror and each of its stops,
every lens at World, the profile and its test profiles, search; the Patterns tab when the build
has crossed its gate. `.nightb/screens/web/report.md` leads with the findings: **hard** is a
screen broken on its own evidence (the error boundary's text, an uncaught page error, a control
the drive could not find), **soft** is a lead (text wider than its box, a control partly
off-screen, a screen that did not change after a tap, a broken image, a failed webfont, a
`console.error`). Then LOOK. The report names PNGs; open every one it names, and at least the
daily, the Mirror landing, one stop, one lens and the profile on the SE — the smallest screen
is where a layout gives way first. The other two profiles when a lead points at them.

**What you are looking for**, on either instrument: text clipped, overlapping or wrapping where
the design set one line; a control under the status bar or the home indicator; a row whose
items no longer fit; an empty stop or lens; a screen that did not change after a tap; a colour
or a contrast that is not what `docs/VISUAL-VISION.md` names; a splash that never hands over;
a launch crash; a keyboard covering the field it opened for. Compare the same screen across the
three geometries and the two shells — a difference between them is usually the finding.
**Not findings:** the demo deck's content, the sample people, a "preview" banner in a live
build, and taste. A new look is a `docs/VISUAL-REQUESTS.md` request (D352), never a night's
commit.

**What you do with one.** A verified visual defect is a `- [ ] [visual]` line in
`NIGHTB_TASKS.md` like any other — `file:line` for the CSS or markup, the capture that shows
it by path, which geometry or shell — and it is fixed like any other: smallest change, one
commit, proved before committing. The proof for a visual fix is a re-render you have looked at:

    node scripts/device-screens.mjs --scene <scene> --profile <profile> --out .nightb/screens/web

before and after, plus the mount suites and lint as always. A fix you have not seen is not
proved. Something the emulators show and Chromium does not (a safe-area inset, a WKWebView
difference) is proved on the next results ref, which the next flow's request produces —
say so on the line rather than guessing.

**Known gaps, so you do not re-derive them:** both instruments run the DEMO build, so the
first-launch walkthrough (D393) and the live boot are not exercised — a live-build lane is an
owner decision (`docs/OWNER-LIST.md`), because it would create an anonymous account and write a
vote to production every night. The iOS flow drives by accessibility label and is the newer of
the two; where a step could not find its label, the capture after it is of the screen before,
and INDEX.md's `drive:` line says whether the driver finished. Read Maestro's log before
calling a screen broken.

## The audit flow (20:00, 95 min): audit → fix

**1 · Audit is a parallel fan-out, not a solo read — and it happens once a night.** Seven
independent finder agents, one per slice, no more: `src/v2/data` + `src/v2/ui`, the spec layer,
`functions/src`, `firestore.rules` + the test suites, `scripts/` + the check gates, `docs/` +
the catalogues, and **the device pass** — a finder that reads `.nightb/screens/web/report.md`
and its PNGs (and the emulator results, once they land) rather than code, and writes
`[visual]` lines. One adversarial verification pass per candidate. Seven slices and one pass is
the width; widening it is the thing this flow was re-shaped to stop.
Hunt real bugs and risky code. No style nitpicks. Every candidate is adversarially verified
before it earns a line: does it reproduce, and is it a deliberate convention?

The traps — CLAUDE.md's "things that look like bugs but are not", named here so a finder does
not burn a night rediscovering them:

  - The spec layer talks through global scope on purpose. `src/v2/spec/` modules do not import
    each other; they assign to `globalThis`/`window` and resolve each other by name at render
    time. `spec-index.js`'s order is SEMANTIC — never sort it, never drop an entry. A missing
    import there is the convention, not a bug. Before taking any name off the bridge, check who
    ELSE writes it: check:globals rule 5 is deliberately over-generous, and rule 6 exists
    because a `window` write from the typed layer shipped fabricated vote counts for a day.
  - `no-undef` is on for the spec layer, seeded from `scripts/spec-globals.mjs`. If it fires on
    a legitimate global, fix the scanner — never add an eslint exception.
  - Answers are PUBLIC (D98). Any signed-in user may read any other user's answers and profile;
    counts are exact from the first answer. There is no k-anonymity floor. A finding that reads
    "this exposes answers" is almost certainly the product, not a bug. Three denies are real and
    labelled in `firestore.rules`: the unscored logic answer key, flag authorship, the presence
    cell. Duel answers sealed until reveal is game timing, not privacy.
  - A privacy constraint is an ASK, not a stop (D334). If a privacy argument is the only thing
    between a fix and the tree, do not quietly drop it or narrow it to the safe half — put it in
    the summary as an ASK with the arithmetic, and let the owner rule.
  - The patterns tab is mounted on a data condition (`src/v2/data/patternsReady.ts`, D265), not
    a flag. Below the gate the tab is absent by design — the device pass skips it and says so.
  - `window.MapStats` returns null for the four test anchors on purpose (D72) — null rather than
    a gate at each call site, so a forgetful consumer fails a test instead of fabricating.
  - `functions/src/ops.ts` sets `setGlobalOptions`, not `index.ts`. Deliberate; `check:fn-runtime`
    guards it.
  - Answers are create-only with exactly ONE legal update shape (D86): `optionIdx` + `editedAt`.
    Do not widen it.
  - Hand-kept figures are this repo's most-repeated documentation error. Never write a number
    into prose or a comment that `check:figures` could compute — D338 caught one at 644 when the
    tree said 570. This brief quotes no test counts for the same reason; read them off the run.
  - A sideways rail clips its own content on purpose, and `.tap44` grows a hit box past the
    glyph it draws. The device pass already skips both; a lead that survives is still a lead,
    not a verdict — the PNG decides.

Verified findings go to `NIGHTB_TASKS.md` at the repo root, one `- [ ]` line each, most
important first, `file:line` plus one sentence on why it matters. **The open list is capped at
32.** Fill it: this is the only audit of the night, so a finding you leave unwritten is one
nobody works until tomorrow. It carries across nights, so items an earlier flow verified but
did not reach get worked before anything is re-derived.

**2 · Fix, top-down, one item at a time, smallest change that closes it.** Prove before
committing: the runner that covers it, plus the gates the change touches. `npm run lint` is
eslint alone and says nothing about `test:scripts` — run that one explicitly whenever you touch
anything under `scripts/`. `test:rules` and the three e2e suites need Java 21 (present on this
image) and `HTTPS_PROXY`/`https_proxy` UNSET — the functions emulator will not start otherwise,
and that is environmental, never a reason to widen an allowlist. **E2E runs whenever
`firestore.rules` or `functions/src` is touched**, no exceptions: on 2026-08-25 two rules commits
landed without it and left a branch red on the deploy path for two hours. A `[visual]` item is
proved by the re-render in § The device pass, looked at.

Exactly one commit per item. Message body ends `Risk: safe` or `Risk: review carefully`. Push
after every commit (`git push -u origin nightb-$D`). Rejected push → `git pull --rebase` and
retry; a conflicting rebase → abort, `git reset --hard origin/nightb-$D`, stop with a note.
**Never force-push.** An item that cannot be fixed safely is discarded
(`git checkout -- . && git clean -fd`) and marked `- [-] (skipped: reason)`.

**3 · Stop** when the list is empty, or **16** commits have landed in this flow, or the 95
minutes are up. Prefer finishing and summarizing over starting one more fix. Do NOT re-run the
fan-out to refill the list — what you did not reach is the next flow's work, and that is the
point of the shape.

**4 · Rollup** into `NIGHTB_SUMMARY.md`, in plain non-technical language, covering the WHOLE
night so far (`git log origin/main..HEAD`), not just this flow: one line per commit — short
hash, what changed and why, risk label — then this flow's skipped and unfinished items, then a
**Devices** paragraph (which head the phones screened, whether each shell launched, what the
captures showed, what is still open), then the reminder to review the branch, merge or
cherry-pick, and delete it. Plain means plain: no file paths, no symbol names. Every flow writes
it complete and self-contained, in case it is the last one to run.

## The fix flows (22:00 · 00:00 · 02:00 UTC, 95 min each): no fan-out

Everything in the audit flow's step 2, 3 and 4, and nothing from step 1. You are working the
list `NIGHTB_TASKS.md` already carries — top-down, one item at a time, smallest change that
closes it, exactly one commit per item, proved before committing, pushed after each.

Read the other shift's branch first, as every flow does. A defect its commits closed since the
last flow comes OFF your list unworked. Then the phones: fetch the results refs the last
request produced and read them as § The device pass says — the emulators are what the 20:00
flow could not see yet, and a shell that crashed at launch outranks everything on the list.
Request again only if the head moved.

**The one case that licenses a re-audit here**: the list is empty — every item worked, skipped
or claimed by the other shift — and there are more than 30 minutes left. Then sweep the two or
three slices the 20:00 flow reported least on, not all seven, and write what you verify. An
empty list with ten minutes left is a summary, not a sweep.

## The closing + merge flow (04:00 UTC, 110 min)

It verifies the night instead of extending it, and then it does the job this shift exists for.
No new audit fan-out; something urgent found anyway becomes a `- [ ]` line for tomorrow.

**Part one — close your own branch (minutes 0–55).**

  - At minute 0, request the phones for the night's final head (§ The device pass) — the
    results are back by about minute 25, and the final head is the one the owner merges.
  - Start the full battery on `nightb-$D`'s tip IMMEDIATELY, in the background: `tsc -b`,
    `npm run lint`, `test:unit`, `test --prefix functions`, `test:scripts`, `test:rules`, all
    three e2e suites, and every `check:*` gate. Build first — `npm run build` and
    `npm run build --prefix functions` — or `check:fn-runtime` reports a missing build rather
    than a failure. Two gates cannot pass in this container at all, because they want production
    secrets rather than code: `check:web-firebase` (a real, non-demo Firebase config) and
    `check:store-copy` (real legal and store IDs, still `REPLACE_WITH_*`). Those two are UNRUN,
    named as unrun. Everything else is expected green. The Chromium device pass runs in the
    same battery: `node scripts/device-screens.mjs --out .nightb/screens/web` on the tip, and a
    hard finding there is red like any other.
  - While it runs, adversarially re-review `git diff origin/main...HEAD` as ONE unit: a fix that
    breaks another fix, a fix that contradicts a deliberate convention, a comment arguing from
    something the same night made untrue, a commit message claiming more than its diff. This is
    the night's blind spot about its own work, and it is why the flow exists.
  - A throwaway merge of current `origin/main`, then `git merge --abort` — never committed,
    never pushed. Conflicts and both-sides files go in the summary by name.
  - Also probe the other shift's live branch: `git merge-tree --write-tree --name-only
    origin/main origin/night-$D` — no checkout, no mutation — and report by name any file both
    branches touched. That is the duplicate-fix warning the owner needs before merging two
    branches in one morning.
  - Fixes only for what all of that proves broken. **None begun past minute 45.** A red result
    with no time left is named in the verdict, not patched in a hurry.

**Part two — the merge verdict (minutes 55–100).** This is the extra hour, and it is the point.

You have already deepened the clone, so `--is-ancestor` can be believed. Enumerate every branch
on origin that is not an ancestor of `origin/main`:

    git ls-remote --heads origin 'refs/heads/night-????????' \
                                 'refs/heads/claude/night-shifts-*' \
                                 'refs/heads/nightb-*'

The other shift's review branches are `claude/night-shifts-*` — both `-review-` and `-work-`
suffixes are in use, so do not key on either. Exclude tonight's `night-$D`: it is still being
written, and a verdict on a moving branch is not a verdict. That is the whole reason this shift
runs an hour earlier than the other one — the branch you judge is LAST night's, finished and
closed, with its own closing battery already run on it. Also exclude every `*-screens` ref —
those are device-pass requests, pointers at a head some branch already carries, and never
something to merge — and never fetch `screens/*` into this enumeration: those are results, one
orphan commit each, and the owner deletes them with the night they belong to.

For each branch, without mutating the working tree (`git merge-tree`, `git log`,
`git diff --stat`): commits ahead, commits behind, files, +/− lines, whether it merges clean,
and conflicted paths by name. Then judge it **MERGE** / **DO NOT** / **NEEDS OWNER**, one
sentence of reason each.

**A clean merge is not a verdict.** Conflict count runs the wrong way here: a branch hundreds of
commits behind can merge without a single conflict and still be wrong to take, and a branch
twenty behind can conflict in two files and be obviously right. Judge the work, not the merge.
Say DO NOT plainly where you mean it, with the reason — a branch left ambiguous is a branch that
sits on origin for a week.

Then compose, for the ones you judged MERGE: cut `nightb-$D-integration` from `origin/main`,
merge them in, resolve conflicts there, and run the battery on the COMPOSED tree. That battery
is the deliverable — D336 caught a `check:figures` collision that git had merged without a
conflict and that would have thrown `ReferenceError` before the gate checked a single figure.
Nothing was red; the gate had simply stopped working. Push the integration branch. If the
composed battery cannot finish in the time left, push it anyway and label it in the verdict as
composed but unverified, naming exactly which checks ran and which did not.

**Part three — the summary (minutes 100–110).** `NIGHTB_SUMMARY.md`, topped by one verdict
line: green-and-merges-clean, or exactly what is red, unrun, or conflicted. Then the night's
rollup, then the **Devices** paragraph — which head the phones screened, whether the Android and
the iOS shell launched, what the captures showed, the hard and soft counts from the Chromium
pass, every `[visual]` line still open, and any results ref that never came back, named as
unrun — then the merge verdict table, then the integration branch and what is in it. **A check
that did not run is named as unrun, never claimed** — D1 reaches summaries. Guessing green is
the one failure this whole flow exists to prevent.

## Authorization

The standing push authorization is a real human turn from the owner earlier in this session's
history. It covers exactly: creating `nightb-*` branches (including `nightb-*-integration` and
the `nightb-*-screens` request refs, which are `nightb-*` branches by name) from `origin/main`
in Cosaxo/InSight and pushing to them, unattended, nightly. It does NOT cover pushing to `main`,
pushing to `night-*` or any other shift's branch, force-pushing, or opening pull requests. Both
merging and PR-opening were offered to the owner and declined in the same sitting: the shift
that judges what should land is the last shift that should be able to land it. Opening a PR is
also not free — `ci.yml`'s `pull_request:` trigger is bare, so a PR runs the whole CI matrix on
every push to that branch, plus an iOS build whenever the night touched `ios/`,
`capacitor.config.ts` or `package.json`. The owner merges; you prepare and you verdict.

If that human turn is not in this session's history, push nothing: audit, write the rollup, and
say in it that the authorization is missing.
---

## Why this file exists, and what to do with it

This is night shift B's brief with the device pass added (D404) and the L1
shape the owner approved on 2026-09-03 folded in — one fan-out a night,
four fixing flows, the list capped at 32 — against the five-flow schedule
that is live (`0 20,22,0,2,4 * * *`, re-paced 2026-09-05 21:17 UTC). It
replaces `night-shift-b-brief-2026-09-03.md`, which was written for a
three-flow schedule the Routine no longer has: pasted onto five flows, its
`date -u +%H` table would leave the 22:00 and 02:00 firings with no flow at
all.

It is here rather than live because `update_trigger` refuses a prompt edit
on a Routine whose fires deliver into a session that is not the caller's
(measured 2026-09-03 and again 2026-09-06 — the tool's own words are in
`docs/PERMISSIONS.md`), and night shift B is bound to
`session_01M9cvEjdQmWYjgrWvaoXiK9`.

**To make it live:** open the Routine at claude.ai/code/routines, select
*InSight night shift B*, and replace its prompt with everything in this file
ABOVE the `---` rule. Do not delete and recreate it — the bound session is
where the owner's standing push authorization lives, and a recreated Routine
that loses that binding would audit all night and push nothing.

**Until it is pasted**, the live brief still fans out at 20, 22, 00 and 02
with the list capped at 8, and knows nothing about the phones: the lane and
the script are in the tree and idle. The other shift's brief lives on
another account and can carry § The device pass verbatim with `night-` for
`nightb-` — the lane already listens for `night-*-screens`.
