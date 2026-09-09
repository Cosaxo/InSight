# Bringing production's 1v1 and group questions onto the 2026-09-09 design

**Status: plan notes — measured 2026-09-09, nothing in it is done until its
step says so.** The owner's ask of 2026-09-09: *"lets instead plan for a
update to the production of 1v1 and group question with the new desigin."*
The design is [`VISION-2026-09-09.md`](VISION-2026-09-09.md), built at
D437; this is the rollout of what it changed about the QUESTIONS — the
packs, the seats, the ratings, the 1v1's cast round, the retirements — into
the three places a duel question lives, in an order that never refuses a
real player twice.

## Read this first: there are no users yet

The owner, 2026-09-09, on reading the first draft: *"there is no users yet
so most of this is not that deep."* True, and it changes the weight of
every step below, not the order. With nobody on an old build, the bridge
(step 2) is nothing to decide; with nobody mid-round, the one-time re-map
at the bump is a fact and not a risk; with no data to lose, a wrong flip
is a flag set back. What remains is three acts: **flip the retired
questions off, reseed with `bump_rev`, and release build 35 when it is
convenient** — in that order, because the order is free and the reverse
costs a second bump. The eight steps stay written so the same rollout is
right the day there are users; today, read them as a checklist, not a
procedure.

## 0 · Where production is, measured 2026-09-09

A duel question lives in three copies, and today they disagree on purpose:

| copy | what it holds tonight | how it moves |
| --- | --- | --- |
| **the bank** (`content/duel-questions.json`) | 6 packs of role votes (four each, one a seat), 10 ratings, one cast entry per 1v1 pool, 41 own 1v1 questions; 13 group questions retired, the romantic pool's 34 dark | a merged PR |
| **Firestore** (`v2_questions`) | 66 group and 75 duo documents; the seed runs after every backend deploy and ran three times today (last: run 156, 18:26 UTC), so every new pack, seat and cast entry is there | the seed rewrites content, **never `active`** (SHIP-CHECKLIST § the remaining step) |
| **the phone** | the bank as it was when `contentRev` last moved — **2026-08-20, 20 days before this was measured** | only a `contentRev` bump (Seed content with `bump_rev`) makes a returning device re-read |

So tonight the packs are in Firestore and on no phone, and some questions
the bank retired are still dealt. Around them:

- **The backend is the design's** since 17:06 UTC (#456): the rules refuse
  a guess on a group answer, the clock is 48 hours, the reveal and the
  instrument are D437's. Every push to `main` deploys.
- **The clients are split.** Builds up to 34 send a guess on every group
  round and are refused — *That didn't save* — until they update; nothing
  is written, so the vote can be cast again on the new build. Build 35,
  the design's client, was uploaded at 17:29 UTC (run 59, #459) and is
  not yet released.
- **What the audit measured** (19:27 UTC, on the owner's *"do what you
  recomend"*): eleven retired group questions were still dealt in
  production — `gd7 gp0 gp1 gp6 gp7 gp8 gp9 gu11 gu3 gu7 gu8` — and the
  romantic pool's 34 were already off, seeded that way. Nothing killed
  by hand, nothing unseeded, nothing extra. `--apply` flipped the eleven
  and a second read printed zero waiting; the reseed with `bump_rev` was
  triggered from the same sitting. §5 is the table.
- **The lane** writes only packs and ratings now (`QUESTION-FARM.md` § The
  duel lane), 25 a run, daily, toward 400 a pool; today's pools hold 53
  active group and 41 own 1v1 questions.

## 1 · The target

1. Every phone reads the design's bank: packs, seats, ratings, the cast
   round, and none of the retired questions.
2. Every client plays rounds without a call, so no real vote is refused.
3. Firestore agrees with the bank on `active`, so the audit prints nothing
   to flip.
4. The lane keeps filling the pools under the new contract, and a seventh
   pack, if wanted, is a lane run rather than a session's hand.
5. The one thing the design left open on the questions, the older group
   questions' fate (§3.7), is closed: retired in the bank (done, D444), off
   in production (step 4).

## 2 · The steps, in order

Each step names who does it, what proves it done, and how it is undone.
Steps 3–5 are one sitting; the order matters because a bump before the
flips would send every phone a bank that still deals the retired
questions.

1. **Release build 35** — *owner, App Store Connect / TestFlight.* Done
   when TestFlight or the store shows 35. Undo: none needed; a build is a
   build.
2. **Decide the bridge for old builds** — *owner.* Two ways, from
   `OWNER-LIST.md`'s row: *wait* (refused votes are harmless: nothing is
   written, the member votes again once updated) or *soften for one
   release* (one clause in `firestore.rules`: a `guessIdx` on a group
   answer is accepted and scored as nothing, which the fold already does;
   D437's refusal reinstated the release after). **Recommendation: wait if
   step 1 lands within 48 hours of the 17:06 UTC deploy; past that, ship
   the softening** — a session can open that PR in an hour, and it is
   undone by the same PR reversed.
3. **Audit production against the bank** — *a session with the key, or the
   owner:* `node scripts/duel-live-audit.mjs --project prvfire33`,
   read-only. It prints, per pool, what the bank holds, serves and has
   seeded, and the five disagreements by id (§5). Done when the table is
   in this file. Undo: nothing changes.
4. **Flip the retired questions off** — *the same run, `--apply`, or the
   owner in the Firebase console.* `--apply` sets `active: false` on
   exactly the ids the audit listed as *retired in the bank, still dealt
   in production*, prints each, and re-reads them; it never re-lights and
   never touches content. Done when a second read-only run prints zero
   flips waiting. Undo: the same ids back to `true` in the console. The
   rules re-check `active` on every write, so a killed question still on a
   screen is refused server-side rather than silently accepted
   (SHIP-CHECKLIST).
5. **Seed content with `bump_rev`** — *owner: Actions → Seed content → Run
   workflow, bump_rev ticked; or a session through the same workflow.*
   Every returning device replaces its bank on the next boot (+551 reads
   each, `COSTS.md`'s cold-boot row; trivial before launch). One thing to
   know, from D437 step 2: the cast entering a pool re-maps every live
   pair's OPEN own round once; every revealed round keeps its stored `qid`,
   so nothing already shown changes. Done when the job summary shows the
   run and a device that relaunches sees a pack on its next group round.
   Undo: none — a bump is a re-read of the bank that is already in
   Firestore.
6. **Verify on a phone** — *owner, one evening:* a group's round deals a
   pack (a role vote with a seat) and, on the phase's fourth, a rating; a
   1v1's fourth round is the cast; the roles panel counts casts toward
   three; no retired question appears. Done when all four are seen. A
   second `duel-live-audit` run is the server's half of the same check.
7. **The lane** — *owner, the other account:* confirm the duel lane's
   Routine prompt still points at `QUESTION-FARM.md` § The duel lane (it
   names the section; the contract moved under it, D434). Keep the daily
   burst until the pools reach 400. If the seventh pack is wanted (the
   three of D444's six that fit a pack, plus one new wild-seat question),
   it is a lane run under that contract: the lane writes questions, a
   session does not.
8. **Records** — *the run that does steps 3–5:* one decision record with
   the audit's numbers before and after, `OWNER-LIST.md`'s rows on the
   seed, the build and the older questions closed as done (ticks the
   owner's), and §5 of this file filled.

## 3 · What each step costs, and what can go wrong

| step | cost | what can go wrong | what catches it |
| --- | --- | --- | --- |
| 1 | a release | old builds keep being refused until people update | step 2's bridge; the refusal writes nothing |
| 2 (softening) | one rules clause, one PR, reversed after | a group guess accepted and scored as nothing for one release | the fold already scores nothing (D386); rules tests pin both states |
| 3 | one read of ~140 documents | the key is not to hand | the script refuses with the sentence that says what to set |
| 4 | one batched write of the flipped ids | the wrong id flipped | the script flips only what the bank retires, prints before and after; a flip is one field, reversible |
| 5 | +551 reads per returning device, once | a pack with a typo reaches every phone | retire it in the bank, reseed, bump again — the same three steps |
| 5 | | a live pair's open own round re-maps once | known (D437 step 2); revealed rounds keep their `qid` |
| 6 | an evening | the phone still shows the old bank | it did not relaunch after the bump, or the bump was skipped |

## 4 · What this plan does not do

- **The ledger** (ROLES-PLAN §3.3) — its own PR, in flight on the owner's
  2026-09-09 yes.
- **The romantic pool** stays dark (34 retired in the bank); lighting it
  is a design act with its own row.
- **Android** — the release path is un-parked but not built
  (`LAUNCH-RUNBOOK.md` 2.6, 3.1); this plan's client step is iOS.
- **App Check enforcement** — a separate decision with its own
  preconditions (`OWNER-LIST.md`'s row: the runbook's 3.4 metrics, and the
  anonymous-token readers it would cut off).
- **A seventh pack** — the lane's, if the owner wants it (step 7).

## 5 · The table the audit fills

Step 3's output, 2026-09-09 19:27 UTC, with step 4 applied in the same sitting.

| pool | bank | active | seeded | retired but still dealt | killed by hand | not yet seeded | extra |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| group | 66 | 53 | 66 | 11, flipped 19:27 UTC | 0 | 0 | 0 |
| oneVsOne | 41 | 41 | 41 | 0 | 0 | 0 | 0 |
| romantic | 34 | 0 | 34 | 0 (seeded off) | 0 | 0 | 0 |
| `contentRev` | 20 days old at the audit; bumped by the reseed that followed | | | | | | |
