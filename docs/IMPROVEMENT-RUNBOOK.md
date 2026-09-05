# Improvement runbook — the prioritised items as an ordered build list

**Status: plan only. Nothing here is built.** The ordered half of
[`IMPROVEMENT-IDEAS.md`](IMPROVEMENT-IDEAS.md): the items that page
puts first, laid out as steps with who does each, how big it is, what
it depends on, and the gate that proves it. Written 2026-09-05 on the
owner's ask (*"lay a plan for the ones of these you wish to prioritize
first"*). Item numbers in brackets are that page's. Every figure was
measured on this tree or read from a file it names; where a step
collides with a standing record, the record is named and the step is
an ask, not a change (D334, D352).

**Who does what.** *Owner* is a click, a sentence or a ruling only the
owner can make. *Session* is one Claude Code session opening one PR
that goes through `MERGE-LIST.md` like any other. *Workflow* is a
change to `.github/workflows/`. Sizes: **S** under an hour, **M** a
session, **L** several PRs.

**The order in one line.** Stop the spend → fix the two legal
contradictions → clear the rules ceiling → submit → design the cold
start → shard the aggregate → put a person on content → then the
splits and the doc cuts.

---

## Rulings this plan needs before it starts

Five rows. Each is a way through with its cost, per D352; none is a
permission slip. The plan runs without them up to the step that names
them.

| # | Ruling | Recommendation | Cost of the recommendation |
| --- | --- | --- | --- |
| R1 | Delete the disabled Routines on this account, or keep them disabled | Delete the twelve theory lanes, the three axes lanes, the doc sweep and the nine disabled ops triggers; keep their rows in `ROUTINES.md` as history | Re-creating one later is a web-UI form and a charter re-adoption (`USAGE-REDUCTION.md` §5.3) |
| R2 | One night shift or two | Keep night shift B on Claude 1 (already three flows, fan-out once, list cap 32); **disable this account's** `trig_01WdCLF7zBNjqFmTVk15rWhE` and archive its worker session | ~$233 a day saved; the morning review stops composing two trees (D360, D363, D365 were each a night spent on that) |
| R3 | The D98 exposure ask — step 1.2 | Consent at the political card itself (D330's move, one question over), and a written balancing test before submission | One tap per political card; the compass keeps D331's consent unchanged |
| R4 | A person on the content farm — step 2.4, which collides with D212's *"remove the need for a human to approve the questions"* | One daily batch PR from the lanes, merged on the owner's tick in `MERGE-LIST.md` | One tick a day; questions land a day later than today |
| R5 | Shard count and timing — step 2.3 | `AGG_SHARDS = 8`, switched on for the daily lane at the first push-notification campaign, not before | Four PRs; nothing changes for users |

---

## Phase 0 · Stop the spend — day one

**Measured 2026-09-05 from `list_triggers` on this account**, and this
is the fact the register does not yet carry: of 26 recurring Routines,
**one is enabled** — `InSight night shift`, bound to worker session
`session_013UfS4opexyJsoD3K9NxqFF`, the $2,326 line in
`USAGE-REDUCTION.md` §1. The twelve theory lanes, the three axes lanes,
the doc sweep and the nine disabled ops triggers all read
`enabled: false`. `ROUTINES.md` §3 still describes the theory lanes as
live at every fourth day. So most of Phase 0's arithmetic on this
account is already spent; what remains is the largest single line and
the register.

- [ ] **0.1 Disable the night shift on this account and archive its
      worker.** *Owner, S, ruling R2.* `update_trigger` with
      `enabled: false` on `trig_01WdCLF7zBNjqFmTVk15rWhE`, then
      `archive_session` on `session_013UfS4opexyJsoD3K9NxqFF`. Night
      shift B keeps the night. *Gate:* the next morning's review is one
      tree, and `list_sessions` shows no new usage on the worker.
- [ ] **0.2 Delete what is disabled.** *Owner, S, ruling R1.* Twenty-five
      `delete_trigger` calls, or the owner's one sentence to a session
      that makes them and updates the register in the same PR. A
      disabled Routine costs nothing today and is one accidental
      `enabled: true` from costing $24 a run. *Gate:* `list_triggers`
      returns the content lanes' account rows only from here.
- [ ] **0.3 Reconcile `ROUTINES.md` with `list_triggers`.** *Session,
      S, after 0.1–0.2.* Every row on this account carries its measured
      state and the date; §7's overview shrinks to what fires. *Gate:*
      `check:docs` green; the register's rule 4 (verify from
      `list_triggers` before writing a row) applied to the whole
      section.
- [ ] **0.4 Stop `console.yml` committing on every push.** *Workflow,
      S.* 38 of the last 50 commits on `main` are `console:` and
      `pulse:` rows. Drop the unfiltered `push` trigger (a merge already
      arrives as `pull_request: closed`); render the lists to the pinned
      Console issue on every run and **commit the files once a day**,
      at the pulse hour, or when the owner's tick changes a label. The
      header's argument for the push trigger is about the *page* moving
      within minutes, which the issue rewrite still gives. *Gate:*
      `git log --oneline -50 main` a week later shows under ten workflow
      commits.
- [ ] **0.5 A spend ceiling the program cannot ignore.** *Owner one
      click, then session M.* Only a session can read usage
      (`list_sessions`), so the sensor is the roll call, and the roll
      call on this account is disabled because a dispatcher is the only
      binding a session can give it (`OWNER-LIST.md` § Clicks). The
      owner creates it in the web UI with the repository attached,
      fresh session per fire, `claude-sonnet-5`, the block in
      `OPS-RUNBOOK.md` §4. Then `console.yml` reads the roll call's
      daily usage line from the Ops run log the way it reads every
      other row, writes `routineUsdDay` into
      `monitoring/console-trail.jsonl`, and **fails the run** when the
      seven-day mean exceeds a ceiling committed beside the pulse
      console's rate card. Recommended ceiling: $60 a day for routines
      across all accounts, which is the content lanes plus one night
      shift with headroom. *Gate:* a trail row carries the figure; a
      test in `scripts/` pins the red case.

**What Phase 0 does not touch.** The content lanes on Claude 1 (farm,
catalog, learn, feed, duel, now): they are the cheapest lanes in the
program and the only ones whose output reaches users. Their merge rule
is Phase 2's question, not this phase's.

---

## Phase 1 · Legal contradictions, the rules ceiling, submission — week one

- [ ] **1.1 Fix the privacy page's health sentence** [4]. *Session,
      S.* `web/privacy.html:233` says *"We never ask for your religion,
      health or ethnicity — there is no field for any of them anywhere
      in the app"*; `STORE-FORMS.md` line 86 answers Apple's Health row
      **Yes** for the pulse's sleep and energy questions (D203). Page
      first (D183). Replacement, in the page's register:

      > We never ask for your religion or ethnicity — there is no
      > field for either anywhere in the app, and neither is used in
      > these groupings. Two of the daily pulse questions ask how you
      > slept and how your energy was; Apple's forms treat those
      > answers as health data, so we say so here. They are answers
      > like any other: public, grouped the same way, and yours to
      > leave blank.

      Then add the claim to `scripts/check-policy-claims.mjs` so the
      page and the store form cannot part again: the Health row's
      answer and the page's sentence are one claim in two files.
      *Gate:* `check:policy-claims`, `check:store-forms`,
      `check:public-copy` green; the deploy that carries the page lands
      before 1.5, because the review reads the privacy URL.
- [ ] **1.2 Put the D98 exposure question to the owner as a way
      through** [5]. *Session S to write it; owner rules (R3).* One
      `OWNER-LIST.md` row under Decisions carrying: what is exposed (a
      named answer with city, age band, gender, education, relationship
      and height band — `src/v2/data/cohort.ts:38-41` — in a cohort of
      one, and thirteen political feed questions that slice like any
      other); what D331's consent covers (the derived compass) and does
      not (the raw political answer); which of the four things outside
      the ask it touches (the privacy page's own sentence on political
      opinion, so the page moves with the choice); and the three
      shapes with their cost — **consent at the political card**
      (one tap, D330's mechanism one question over), **the anonymous
      answer** `VISION-2026-08-26.md` §1 already draws (a field on the
      answer document and a rules change, the first amendment D98 would
      notice), or **no change plus a written legitimate-interest
      balancing test** filed beside `data-inventory.md`. The
      recommendation is the first plus the test. *Gate:* the row
      exists with the arithmetic; the ruling becomes a DECISIONS record
      before 1.5.
- [ ] **1.3 Clear the `firestore.rules` expression ceiling** [28].
      *Session, M; needs Java 21 (`test:e2e`).* The night shift's
      finding on `OWNER-LIST.md`: a `set` over an existing answer
      evaluates `allow create` at `firestore.rules:1047` and `allow
      update` at `:1109` in one request and exceeds Firestore's
      1000-expression budget, so eleven e2e refusal cases assert
      nothing. Steps: reproduce with the row's six-line probe; hoist
      the shape checks the two rules share into one function called
      once per rule; drop from the rules any per-field check the
      aggregate trigger already enforces on the server (the catalogue
      key validation of D14–D17 is the candidate) and say so at the
      path; re-run the probe until rows 2 and 5 render an ordinary
      verdict. Then the durable half: `firestore-tests/e2e-v2-loop.mjs`
      greps the emulator log for *"maximum of 1000 expressions"* and
      **fails on any hit**, so the ceiling cannot come back silently.
      *Gate:* `test:rules` and `test:e2e:all` green with the new
      assertion; the eleven cases fail when their rule is deleted
      (check one by hand and say which).
- [ ] **1.4 Refresh the launch runbook's state block.** *Session, S.*
      The block says build 1 is on App Store Connect; the file's own
      later steps record build 21 uploaded, build 26 in TestFlight
      (D324) and build 29 in `package.json`. Rewrite the block as a
      pointer to the run list, which is what step 2.4 already says to
      do. *Gate:* `check:figures`, `check:docs`.
- [ ] **1.5 Submit** [1]. *Owner; three clicks and a run.* The runbook
      names three things that block 6.2 and nothing else:
      1. **4.4 the privacy nutrition label** — the manual form, eleven
         rows typed from the *App Store metadata* printout.
      2. **4.1 live screenshots** — Actions → *Screenshots* → Run
         workflow, against production, because `asc:push` refuses the
         demo-flagged captures (App Store 2.3.3).
      3. **6.1 pre-flight** with `--ios`, then **6.2**. Budget the one
         4.8 rejection round the runbook budgets; do not pre-build Sign
         in with Apple.
      EU trader verification (4.3b) gates EU distribution only; Norway
      is EEA, so exclude the EU-27 in Pricing and Availability and add
      them later without a new review. *Gate:* the submission id on
      the runbook row.
- [ ] **1.6 The week after submission, in this order.** *Owner.* 3.3
      the on-device list; 1.4 the two App Check debug tokens; then
      after 24–48 hours of metrics near 100 %, 3.4 enforcement,
      Firestore first, then Storage; 5.7 a second operator uid (one
      env var — `ops.ts:26-45` says the two allowlists are one person
      today); 0.3 the protection rules on the `production` environment.
      None of these blocks review; all of them block *public*.

---

## Phase 2 · Cold start, the aggregate, a person on content — weeks two and three

- [ ] **2.1 Write the cold-start request** [2, 13]. *Session, S; owner
      refines; a routine drafts only after the plan (D352).* One
      request in `VISUAL-REQUESTS.md`, in the file's own shape, titled
      *The first week*: **surface** — the first session from install to
      the day's reveal, and the Mirror's stops while their cohorts are
      empty; **data and basis** — exact counts from the first answer
      (D98), no seeding (D1), the seven stops and which of them can
      draw at *n* = 1, 10, 100; **states** — empty is the one being
      designed, so it comes first; **interaction** — what a stop that
      cannot draw yet shows on a tap (a number and a sentence, never a
      teaser); **constraints** — the bundle ceiling, first paint, tap
      targets; **why** — item 2's three shapes: World draws first and
      the other stops arrive on a floor of *interest* (D265's shape one
      stop over), a first-week arc where the reveal is against the
      whole app, or invite-first so a circle exists on day one. The
      request asks the design to pick between them or combine them,
      and it is the one screen a reviewer will see. *Gate:* the row is
      `requested` with every field filled; the owner's ruling moves it
      to `planned`.
- [ ] **2.2 Design, then build, the first week.** *Owner in Claude
      Design; then session, L.* Extract under `design/`, build behind
      the shell's existing `firstRun` seam in `app-shell.jsx`, and mount
      it in a smoke suite that renders the whole app from a cold cache.
      *Gate:* `check:bundle` (the ceiling was raised to 642 on
      2026-09-05 and the next raise is a deferral — this feature must
      pay for itself in eager kilobytes), `check:panel-suites`,
      `check:tap-targets`, the new mount case.
- [ ] **2.3 Shard the per-question aggregate** [25]. *Session, L: four
      PRs; ruling R5.* `ANSWER-SCALE.md` §4 already derived the shape
      and the plan follows it: `v2_agg_shards/{qid}.{s}` with
      `s = hash(uid) % N`, a per-minute compactor summing into
      `v2_question_aggs/{qid}` in the exact published shape, clients
      unchanged except the `unaggregated` clear rule in `live.ts`
      (1257, 1482), which compares totals. §4 never picked N: **8**,
      from one write a second per document against a push-driven
      morning where a tenth of 10,000 daily users answer inside ten
      minutes (about 1.7 writes a second, 0.2 per shard). Per-qid, the
      daily lane only, switched on for the first push campaign.
      1. `pure.ts` summing helper and shard key, with tests proving
         sum-of-shards equals the direct fold on `counts`, `by`,
         `edits` and `pos`.
      2. Compactor, rules (`allow write: if false`), `data-inventory.md`
         row, deploy target. Shards empty; nothing changes.
      3. Trigger shard mode in both handlers, per-qid switch; the D86
         edit lands on its create's shard by construction (same uid).
      4. Client clear rule and `replay.ts` shard awareness, so a rebuild
         is not overwritten by the next compaction.
      *Gate per PR:* `pure.test.ts`; `check:data-inventory`,
      `check:deploy-targets`, `test:rules`; `idempotence.test.ts` and
      `contention.test.ts` with the shard in the log's label;
      `replay-guards.test.ts` rebuild-then-compact equals published. Plus
      the load test the tree has never run [33]: one script driving a
      hundred concurrent answers at one qid through the emulator, exact
      count at the end, kept beside the e2e suites.
- [ ] **2.4 A person between the farm and the bank** [14]. *Owner
      ruling R4; then owner edits six prompts on Claude 1; session S
      for the record.* Today each content lane squash-merges its own PR
      on green (D212). The smallest shape that puts a human tick back
      without slowing the farm to a crawl: the lanes keep writing to
      their dated branches, and one of them — the now lane, last of
      the day at 11:00 UTC — opens **one batch PR** carrying the day's
      content; the console draws its row; the owner ticks it in
      `MERGE-LIST.md`; `pr-shepherd.yml` merges. The lanes' prompts
      change one clause each ("open the PR; never merge"), which is the
      owner's edit on that account. `paid.ts:471`'s model review of a
      buyer's question stays as the first gate and gains the same
      human tick before the question is served. The record reverses the
      merge half of D212 only and cites this arithmetic: fourteen
      questions a week wait one day; one bad question is a store
      removal. *Gate:* a week of content PRs authored by the lane and
      merged by the shepherd, none self-merged.

---

## Phase 3 · The splits and the doc cuts — weeks three and four

- [ ] **3.1 Cut `CLAUDE.md` to the traps** [47]. *Session, M.* Keep:
      the spec layer's global scope and its four guards, the five
      runners and the hidden fifth, `setGlobalOptions` in `ops.ts`, the
      `HTTPS_PROXY` failure, `LIVE.ready` versus `attached`, the answer
      edit shape, the three denies, and the ask rule in three
      sentences. Move: the D265 paragraph and the Mirror's lens history
      to `ORIENTATION.md` §2 and `MIRROR.md`; the privacy history to
      the records it cites; the lists paragraph to `PROGRAM-PLAN.md`,
      which already holds it. Target under 200 lines. *Gate:*
      `check:docs` rule 6 (every path still exists), `check:figures`;
      a newcomer reads it in ten minutes.
- [ ] **3.2 A record leads with the decision** [48]. *Session, S.* A
      template at the head of `DECISIONS.md`: the decision in three
      lines, then the arithmetic, then the history; and the rule that a
      record longer than a screen splits its history into the document
      it changed. Applied to new records only. *Gate:* `check:docs`
      rule 10 unchanged.
- [ ] **3.3 Archive D1–D200** [49]. *Session, M.* `docs/decisions/
      archive-2026-08.md` holds the records; `DECISIONS.md` keeps
      D201 onward; `scripts/doc-index.mjs` learns two source files for
      rules 1, 9 and 10 so every `#dNNN-` link and the renumber guard
      still resolve. *Gate:* `check:docs` green with the index
      regenerated; a spot-check of ten archived links.
- [ ] **3.4 Split `live.ts` along its own seams** [15]. *Session, L:
      one PR per seam, in this order because each is read by the next —
      pending answers (766–930), the caches (1059–1300), the bank pager,
      the feed publication, social, near and presence; `LIVE` becomes a
      façade that still publishes `window.LIVE` for the two readers that
      resolve it by name.* Rule 6 of `check:globals` is the trap here
      (a name written to `window` by the typed layer and read by
      `import` reaches nobody), so the façade keeps every publication
      until its last `window.` reader is gone. `vote.test.ts` splits
      with the file it tests. *Gate per PR:* `test:unit`,
      `check:globals` with rule 4 unchanged or lower,
      `live-surface.ts`'s pin unchanged, `check:bundle` — a split must
      not move code into the eager chunk.
- [ ] **3.5 Three function codebases** [26]. *Session, M: two PRs.*
      `firebase.json` gains `core` (answers, aggregates, reveals, the
      erasure path), `paid` (`paid.ts`, the Stripe webhook, the model
      review) and `ops` (schedules, moderation, patterns fit); the
      generated `v2content.ts` is imported by `core` and `ops` only.
      `check:deploy-targets`, `check:fn-runtime` and `check:appcheck`
      learn the layout in the first PR before any function moves in
      the second. *Gate:* the three gates green; `test --prefix
      functions`; a deploy dry run listing every function once.

---

## Not in this plan, on purpose

The Patterns tab, the axes, paid reports, sponsored questions and the
engagement ladder stay where they are: their items on the ideas page
are parks, and a park is a record, not a build step. The dependabot
queue (nine PRs, 761 commits behind) is the dependency shepherd's, once
one exists on the web-UI path. Item 36's second half, a ceiling on
*interactive* spend, is the owner's own bill and not a routine's.

## How this page is kept

A step is ticked in the PR that lands it, with the PR number on the
row. When Phase 1 is complete this page's status changes to `mixed`
and `ORIENTATION.md` says which phases are built. When every box is
ticked or explicitly abandoned, the page moves to `past` and the
ideas page carries the verdicts.
