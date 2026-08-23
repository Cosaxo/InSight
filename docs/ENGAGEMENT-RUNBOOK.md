# Engagement runbook — the ordered build list

> **Reasoning lives in [`ENGAGEMENT-PLAN.md`](ENGAGEMENT-PLAN.md)**,
> which is canonical — the rung definitions, the two-channel rule, the
> refusals, the records R1–R5. This file is the same work as an ordered
> to-do list: open steps only, dependency order, what "done" means, and
> which gate proves it. If the two disagree, the plan is right and this
> is stale. Same split as `SCALE-PLAN.md` / `SCALE-RUNBOOK.md`, for the
> same reason: a person building does not want the argument, and a
> person deciding does not want the checklist.

**Sizes** are S (an afternoon), M (a few days), L (a week or more).
**Every step names the gate that proves it.** Steps marked **[owner]**
are decisions, not code, and nothing below them in their phase ships
first. **One PR per phase**, records and paperwork in the same PR as the
code they license — `ATTENTION.md` §6's rule, generalized; the gates
named in each phase are what hold the artifacts together.

Two standing constraints apply to every phase, verified against the tree
rather than remembered:

- **Nothing rides the answer trigger.** `pulse.test.mjs` pins
  `onV2AnswerCreated` at its exact `tx.get` count; every server-side
  piece below is a nightly `onSchedule` sweep, the `patterns.ts` /
  `velocity.ts` shape.
- **No new globals.** `engagement.ts` is imported (rule 2 licenses ESM
  imports into spec files — `world-feed.jsx` and `app-shell.jsx` import
  ESM today), never published onto `window` — `check:globals` rule 4
  only ratchets down, and a hook wired through a global fails CI.

---

## Phase 0 — the records that gate everything

- [x] **0.1 [owner] Adopt R1 and R5** — **R1 DONE 2026-08-23**: adopted
      by the owner in those words, recorded as **D251**. R5 is drafted as
      **D252, Status: Proposed** rather than binding — the adoption named
      R1 alone, and the D28 lesson is that this file does not mark a
      record binding ahead of the owner's word. Until adopted, its
      refusals bind through the documents that already record them. ·
      **Gate:** `check:docs` (green, index regenerated). · **Size:** S.

- [x] **0.2 [owner] Resolve the one open toggle — DONE 2026-08-23,
      public**, as the plan recommended and D251 records: the adoption
      named R1 without the toggle, so the recommendation stood as the
      default. Nothing per-person is in the day docs, and the public
      read is what keeps the scorecard fetch and the pulse console
      credential-free. Reversing is one rules line; the arm's comment
      says so.

## Phase 1 — rung 0: the digest (server + console; no client release)

Ships independently of any app build — nothing here touches `src/`.

- [x] **1.1 `functions/src/engagement.ts` — `digestEngagementV2`,
      nightly. DONE 2026-08-23.** `onSchedule` at 02:23 UTC (off the
      other two ledger readers), options from `ops.ts`, folding every
      owed day up to yesterday behind an injected `EngagementStore`
      (the `patterns.ts` idiom exactly: `lastDay` cursor, 7-day bounded
      catch-up, paged day reads, monotonic per-uid state so a
      crash-replay recomputes rather than double-counts). An empty day
      writes a ZERO doc — absent means "never folded" and the console
      draws it as a gap.

      **The named decision was taken as a SECOND scan**, not a rider on
      `velocity.ts`: velocity's window is a cursor capped at 72 h, the
      digest's is the calendar day, and coupling two windowing semantics
      to save ~3 reads per user per night is the wrong trade. The
      arithmetic is in the file header and D251; the surface of each
      qid derives from the compiled bank (pulse composites by stripping
      the day suffix, unknowns as `other`, never a guess).
      · **Gate:** `npm test --prefix functions` — 14 cases green,
      crash-replay and null-denominator cases included. · **Size:** M.

- [x] **1.2 The bookkeeping the counts need. DONE 2026-08-23.**
      `v2_users/{uid}/engagement/_state` — firstDay, lastDay,
      activeDays, **streak** (it joined the pair because streak deaths
      needed it and it costs nothing extra) — server-written, deny-all,
      erased by the existing recursive delete. The trade is stated in
      D251: uid-keyed *bookkeeping* for anonymous *outputs*, one write
      per active user per day against four full ledger scans. `_state`
      fails the date-shaped id regex phase 3 will use for client
      creates, so server-only falls out of the id discipline. ·
      **Gate:** `test:rules` — deny pinned both ways, owner included. ·
      **Size:** S.

- [x] **1.3 Rules arms + tests. DONE 2026-08-23.** `v2_engagement_daily`
      world-read / write-nobody (the `v2_patterns` posture, labelled at
      the path, `meta` cursor included); `v2_users/{uid}/engagement`
      deny-all, with a test that a rung-2-shaped date id is refused
      TODAY. 128 → 130 rules tests; the `SCHEMA-V2.md` figure moved
      with them (`check:figures` caught the quote, as designed). ·
      **Gate:** `test:rules` (130 green). · **Size:** S.

- [x] **1.4 Deploy + monitoring wiring. DONE 2026-08-23.**
      `digestEngagementV2` in the deploy `--only` list (33 functions,
      `check:deploy-targets` green); `monitoring/
      digestEngagementV2-silent.json` watching **absence** of the
      `engagement_digest` heartbeat over 30 h, with its metric in
      `apply-monitoring.mjs`'s METRICS and the policy in POLICIES
      (`check:monitoring`: 8 policies, 5 metrics, every link resolves).
      `monitoring:apply` stays the hand-run step — the policy is
      *committed*, not yet *deployed*, and the console will say so. ·
      **Gate:** all three green. · **Size:** S.

- [x] **1.5 Cost line first. DONE 2026-08-23, before any deploy.**
      `ENGAGEMENT_READS_PER_LEDGER_ENTRY` + `ENGAGEMENT_USER_STATE_OPS`
      in `cost-arith.mjs`, folded into the server-reads and writes
      terms; `COSTS.md` re-ran and moved: server reads 22 → 27 per
      user-day, $251 → $255/mo at 50 k, $2,555 → $2,593 at 500 k, with
      the dated note and the separate-scan argument beside the table. ·
      **Gate:** `npm run costs` reproduces the quoted rows;
      `test:scripts` pins the constants. · **Size:** S.

- [x] **1.6 Paperwork. DONE 2026-08-23.** Inventory rows for the day
      docs and `_state`, the ledger row's third purpose named, the
      "not collected" paragraph rewritten to the collection/derivation
      distinction; `web/privacy.html` gains the headcount paragraph and
      `check:policy-claims` two rows pinning its halves (counts-without-
      identity; the date pair unreadable and erased); `SCHEMA-V2.md`
      entries; `STORE-FORMS.md` Product Interaction re-answered **No**
      with the reasoning (server-side derivation is not collection —
      whoever ships rung 1 or 2 owns flipping it). · **Gate:** all four
      green (22 disclosures, 33 collections). · **Size:** S.

- [x] **1.7 The console reads it. DONE 2026-08-23.**
      `question-scorecard.mjs --fetch` now also writes
      `monitoring/engagement.json` on the same anonymous token (one
      fetch path); `pulse-collect.mjs` gains `collectEngagement` +
      the pure `engagementFromDays` (null-aware: an unfolded cohort day
      reads *unknown*, never 0%); `pulse-render.mjs` draws the panel
      with the §3.4 honesty rules printed beside the numbers;
      `pulse.mjs` trails `dau` and `retD7`. The population panel's
      blocked row moved to the live column with D251 cited, and its two
      stale refusal citations were corrected while the file was open. ·
      **Gate:** `test:scripts` — 265 green, honest-absence case
      included. · **Size:** M.

- [ ] **1.8 Done when:** the first real nightly run publishes a day
      doc, the trail carries its row, and `npm run pulse` answers "did
      anyone come yesterday" from a committed file. **Stop here is a
      legitimate state** — rung 0 alone answers retention, activation,
      streak deaths and retention-lift-by-week-1-surface.

      **Code-complete 2026-08-23; open until the next production
      deploy** carries `digestEngagementV2` out (the standing
      europe-west1 deploy path), the first digest folds a real day, and
      `npm run scorecard -- --fetch` commits the first trail. Until
      then the pulse panel reports the honest absence, and that is the
      correct reading.

## Phase 2 — rung 1: the anonymous channel (first client release)

Gated on R2 (+R4 if the `qids` map ships — they can land together or
R4 can wait; the shard shape carries an empty map either way).

- [ ] **2.1 [owner] Adopt R2, and R4 with or after it** →
      `DECISIONS.md`, `build:doc-index`. · **Gate:** `check:docs`. ·
      **Size:** S.

- [ ] **2.2 `src/v2/data/engagement.ts` — the tally store.** Typed,
      no globals. API on the order of `bump(surface, key)`,
      `bumpQid(qid, kind)`, `flushYesterday()`; UTC day rollover; the
      sampling coin; buckets applied **at flush** (0, 1–2, 3–5, 6–10,
      11+ — exact tallies never leave the device). Persists
      `insight.engagement.v1`, registers the `insight:local-purge`
      listener (D51) — `check:purge` fails a store that forgets, and
      `purge-wipe.test.ts` gets a seed → purge → remutate case so the
      wipe is real, not just the keys. Unit tests beside it
      (`engagement.test.ts`): rollover, bucketing, purge, sampling
      determinism under an injected coin. · **Gate:** `test:unit`,
      `check:purge`, `check:globals` (rule 4 unmoved). · **Size:** M.

- [ ] **2.3 Arm it from `initLive`, inert everywhere else.** Nothing
      tallies in jsdom: the mount suites are the only gate that
      executes a render (the `statsTypo` lesson), so add a smoke case
      asserting a full walk of both tabs writes nothing and tallies
      nothing. · **Gate:** `test:unit` (smoke). · **Size:** S.

- [ ] **2.4 Wire the seams.** Each is an import plus one call; grep
      the named symbol before wiring — verify rather than assume:

      - `live.ts` — `LIVE.vote` / `LIVE.editVote` (the pinned surface
        in `vote.test.ts`): answer counts by surface, edit counts.
        `hydrate()` duration → cold-start bucket.
      - `app-shell.jsx` — the D248 nav registry (`registerNav({goTab,
        openOverlay, openProfileTab, openCity, openPerson, …})`) is one
        choke point for tab, overlay, city and person opens; the
        `ErrorBoundary` here counts catches beside its Sentry report.
      - `world-feed.jsx` — an IntersectionObserver for **seen** (≥50 %
        visible ≥1 s, `ATTENTION.md` §3's definition), beside the
        existing `WF_PASS_LS` pass/defer writes, which are the tap
        points for pass/defer counts (R4).
      - `MirrorLensTabs` — lens opens per stop. The stop-change seam
        lives in `mirror-tab.jsx`'s stop state; find the setter by grep
        at build.
      - Reveal viewed — the reveal body's mount in the duel spec
        modules; `subscribeReveals` in `live.ts` is *delivery*, not
        viewing, so the hook goes at the render.
      - `push.ts` — the `pushNotificationActionPerformed` listener:
        notification opened.

      · **Gate:** `check:globals` (no new coupling; spec-index
      untouched), `test:unit`. · **Size:** M.

- [ ] **2.5 Rules arm for the shards.** `v2_attention/{day}/devices/
      {shardId}`: create-only, signed-in; the **day segment** parsed
      with the pulse idiom (`matches('[0-9]{4}-…')` +
      `timestamp.date()` bounds, a ±few-day window for yesterday-flush
      and clock skew); `hasOnly` field whitelist; `qids` map size
      capped; bucket values bounded 0–4; no read, no update, no client
      delete (the fold deletes on the admin SDK). Rules tests in both
      directions, including every cap refusal. · **Gate:**
      `test:rules`. · **Size:** S.

- [ ] **2.6 Flush transport.** `flushYesterday()` writes the shard
      through the ordinary SDK (`getDb()`), riding the offline queue —
      a rollup written on a dead train arrives when the phone wakes,
      no hand-rolled retry. Random doc id per write; `sampled` flag on
      the doc. · **Gate:** `test:unit` with the mock firestore
      (`bank-cache.test.ts` shows the mock's shape). · **Size:** S.

- [ ] **2.7 `foldAttentionV2`** — second phase of the nightly file:
      sum yesterday's shards into the day doc's `features` / `qids`
      sections, **then delete the shards** (batched); the deletion is
      asserted on the injected store, because an operator who keeps
      the raw pile has built the funnel this rung promises not to be.
      Truncated `qids` overflow is counted into `other`, reported, not
      hidden. If an e2e leg is wanted, `revealDuelsNowV2` is the
      precedent for a test-trigger callable — and then it takes the
      `ENFORCE_APP_CHECK` constant and a `check:appcheck` entry like
      every callable; otherwise the injected-store tests carry it. ·
      **Gate:** `npm test --prefix functions`; `check:appcheck` only
      if the callable exists. · **Size:** M.

- [ ] **2.8 R4 lands in the scorecard.** `question-scorecard.mjs`
      merges seen→answer conversion and pass rate per question from
      the day docs; `scorecard-metrics` gains the columns and their
      tests; the D33 warning prints beside them (a metric this simple
      invites goodharting, and a dashboard doubles the invitation).
      This is the denominator `SCALE-RUNBOOK.md` 3.4
      (measure-and-retire) has been missing. · **Gate:**
      `test:scripts`. · **Size:** S.

- [ ] **2.9 Paperwork, same PR.** `data-inventory.md`'s "not
      collected" paragraph rewritten to the R2 wording; **Product
      Interaction → collected / not linked** in `docs/STORE-FORMS.md`
      *and* `design/store/app-privacy.json` (they exist twice on
      purpose; `check:store-forms` holds them equal); `web/privacy.html`
      section + `CLAIMS` rows (tokens: *without your name or account*,
      *no third-party analytics*, the sampling sentence);
      `SCHEMA-V2.md`; COSTS lever updated. · **Gate:**
      `check:store-forms`, `check:policy-claims`,
      `check:data-inventory`, `check:public-copy`. · **Size:** S.

- [ ] **2.10 Bundle + release.** `engagement.ts` is entry-side (it
      hooks boot); `check:bundle` prices the eager delta — if
      `MAX_EAGER_KB` must move, it moves with a note beside the
      ceiling, the 955→966 pulse-card precedent, never silently. Ships
      with a normal app release (`appBuild` etc. ride the release's
      own `check:versions` discipline). · **Gate:** `check:bundle`,
      `npm run build`. · **Size:** S.

- [ ] **2.11 Done when:** a device on a store build produces a shard,
      the nightly fold publishes feature and question ratios with the
      shards deleted behind it, and the scorecard prints a question's
      seen→answer conversion next to its evenness.

## Phase 3 — rung 2: the person channel

Gated on R3. Everything here extends phase 2's module and fold.

- [ ] **3.1 [owner] Adopt R3** → `DECISIONS.md`, `build:doc-index`. ·
      **Size:** S.

- [ ] **3.2 Session machinery.** Session = foreground episode:
      visibility events plus Capacitor's app-state listener, ended by
      >30 min hidden (a constant with its reasoning, beside
      `IDLE_DETACH_MS`'s — note the idle detach fires at 60 s and is
      about listener billing, not session semantics; the two constants
      are neighbours, not one number). Tallies: sessions, foreground
      minutes (bucketed), quiet sessions, dayparts (4), feed depth
      bucket, reached-end, reveals viewed, notifications opened. ·
      **Gate:** `test:unit` (fake timers over the episode state
      machine). · **Size:** M.

- [ ] **3.3 The rollup write.** `v2_users/{uid}/engagement/{yyyy-mm-dd}`
      for yesterday, create-only: a `day` field duplicating the id (the
      collection-group query needs a field), `expireAt` = day + 90 d
      (the TTL field, the ledger's own idiom). · **Size:** S.

- [ ] **3.4 The rules arm is the no-qids pin.** Owner create only; id
      parsed as a date with the pulse bounds; **`hasOnly` over the
      exact field list** — this is where the two-channel rule becomes
      enforcement rather than prose, so the rules test that tries to
      smuggle a `qids` field in and is refused is not optional. Ints
      bounded; `read: if false` (the push-tokens posture — not even
      the owner); no update, no client delete; `_state` keeps failing
      the date regex and stays server-only. · **Gate:** `test:rules`.
      · **Size:** S.

- [ ] **3.5 Fold extension + index.** The nightly fold reads
      `collectionGroup("engagement").where("day", "==", D)` — the
      group-scope index lands in `firestore.indexes.json` and deploys
      through the existing `--only "firestore:rules,firestore:indexes"`
      path. Derives the anonymous durables into the day doc: fade
      counts (plan §3.3's definition), quiet-session share, depth
      distributions, cohort funnels. **The fold never joins a profile:**
      its injected store is handed engagement docs and nothing else, so
      anchor-sliced engagement is unrepresentable in the code, not just
      refused in prose — that is the test. · **Gate:** `npm test
      --prefix functions`. · **Size:** M.

- [ ] **3.6 TTL, actually applied.** `docs/SHIP-CHECKLIST.md` §5 gains
      the second line beside the ledger's:
      `gcloud firestore fields ttls update expireAt
      --collection-group=engagement --enable-ttl --project=prvfire33`.
      Hand-run, like the first one — and the same standing caveat
      `MONITORING.md` records for the ledger applies: the repo cannot
      see whether it ran, so the checklist is the control. · **Gate:**
      review; the checklist row. · **Size:** S.

- [ ] **3.7 Erasure asserted.** `e2e-delete-account.mjs` seeds a
      rollup and adds its path to the must-be-gone list (the foresight
      row's shape). Phase 1b's `recursiveDelete` of `v2_users/{uid}`
      already reaches it — assert it anyway; the handle registry and
      `v2_people` both looked covered and were not, which is why 3b
      and 3d exist. · **Gate:** `test:e2e:erasure`. · **Size:** S.

- [ ] **3.8 Paperwork.** Product Interaction → **linked** in both
      store-form files; inventory row (fields, cap, TTL, "readable by
      nobody", erasure); privacy.html + the *no other user — and no
      one at all — can read* and *expires after 90 days* claim rows;
      COSTS lever. · **Gate:** the same four gates as 2.9. ·
      **Size:** S.

- [ ] **3.9 Done when:** rollups flow, the fold publishes fade and
      quiet-session numbers with no uid anywhere downstream, a
      smuggled `qids` field is refused by a passing test, the TTL row
      is checked off, and the erasure e2e is green.

## Phase 4 — reading it well (optional, any time after 1.7)

- [ ] **4.1 Pulse engagement charts** — self-contained, stdlib-only,
      the console's own palette discipline (labels on segments, table
      beside every chart). · **Gate:** `test:scripts`. · **Size:** M.
- [ ] **4.2 Trail curation** — keep the handful of figures worth
      trending (DAU, D7, one-and-done, Mirror reach, top/bottom
      conversion), resist the rest; a trail that carries everything is
      a second copy of the artifact nobody can read. · **Size:** S.

## The dependency order, in one line

**0.1 → 1.x → 2.x → 3.x**, with 4.x free after 1.7. Phase 1 needs no
client release and no store-form category change; phase 2 is the first
of both; phase 3 extends phase 2's module, rules file and fold rather
than adding new machinery. Each phase is a stopping point, and stopping
is a decision the plan already priced (§10).

## What would make me stop and re-plan

- **The digest's ledger scan and `velocity.ts` start fighting over the
  same read budget.** The 1.1 decision was one scan or two; if the
  arithmetic that picked it stops holding at real volume, re-take it
  there rather than tuning around it.
- **Unsampled shard volume swamps the fold.** Sampling is the designed
  lever — turn it down before sharding the fold; if 10 % is not enough
  signal for a question, `ATTENTION.md` §4's line applies: a number
  only convincing at 100 % was never convincing.
- **`check:globals` rule 4 moves during phase 2.** A hook got wired
  through the bridge. Rewrite it as an import; do not touch the
  baseline.
- **A store reviewer reads "not linked" differently than filed.**
  `STORE-FORMS.md` owns the wording; stop, re-answer the row from
  `data-inventory.md`, re-file — under-declaration is the direction
  that gets an app pulled, so the safe failure is declaring more.
- **Anything in phase 2 or 3 turns out to want a field the two-channel
  rule forbids** (a qid on the person channel, a uid on the question
  channel). That is not a schema tweak; it is R3's scope. Amend the
  record or drop the field — the 3.4 test exists so this surfaces as a
  red test instead of a quiet widening.
