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

- [x] **0.1 [owner] Adopt R1 and R5** — **both DONE 2026-08-23**: R1
      adopted by the owner in those words, recorded as **D268**; **R5
      (D269) went binding the same day** on the owner's "i adopt R5", as
      2.8's note below records. This cell first held R5 at *Proposed*
      because the adoption message named R1 alone, and the D28 lesson —
      this file does not mark a record binding ahead of the owner's word
      — is why the word is quoted now that it exists. ·
      **Gate:** `check:docs` (green, index regenerated). · **Size:** S.

- [x] **0.2 [owner] Resolve the one open toggle — DONE 2026-08-23,
      public**, as the plan recommended and D268 records: the adoption
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
      arithmetic is in the file header and D268; the surface of each
      qid derives from the compiled bank (pulse composites by stripping
      the day suffix, unknowns as `other`, never a guess).
      · **Gate:** `npm test --prefix functions` — 14 cases green,
      crash-replay and null-denominator cases included. · **Size:** M.

- [x] **1.2 The bookkeeping the counts need. DONE 2026-08-23.**
      `v2_users/{uid}/engagement/_state` — firstDay, lastDay,
      activeDays, **streak** (it joined the pair because streak deaths
      needed it and it costs nothing extra) — server-written, deny-all,
      erased by the existing recursive delete. The trade is stated in
      D268: uid-keyed *bookkeeping* for anonymous *outputs*, one write
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
      blocked row moved to the live column with D268 cited, and its two
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

- [x] **2.1 [owner] Adopt R2, and R4 with or after it — R2 DONE
      2026-08-23 as D270**: the owner's words were "start building phase
      2", and this step is the gate that defines building phase 2 AS
      adopting R2, so the record states that provenance plainly rather
      than inferring silently. **R4 was not named and is D271,
      Proposed** — the shard schema carries its field, the rules refuse
      it non-empty, and 2.8 below stays open on it. D269 (R5) went
      binding the same day, on "i adopt R5". · **Gate:** `check:docs`
      (index regenerated, 254 records). · **Size:** S.

- [x] **2.2 `src/v2/data/engagement.ts` — the tally store. DONE
      2026-08-23.** Typed, no globals; the API settled smaller than
      sketched — `note(key)` over a 30-key vocabulary (pinned by test
      AND mirrored in the rules whitelist), `noteAnswer(surface)`,
      `flushPast()` — with the day's sampling coin drawn at its first
      note and an unsampled day tallying nothing at all. Buckets at
      flush; exact tallies never leave the device. Persists
      `insight.engagement.v1` with the D51 listener; 13 unit tests plus
      the purge-wipe cycle case. · **Gate:** `test:unit`, `check:purge`
      (28 listeners), `check:globals` (rule 4 at its baseline). ·
      **Size:** M.

- [x] **2.3 Arm it from `initLive`, inert everywhere else. DONE
      2026-08-23.** Armed in `initLive` only; every note() is a no-op
      unarmed, which is the whole test-flag-free inertness story. The
      mount pin landed in `smoke-nav.test.jsx`: a full mount plus a tab
      walk leaves no `insight.engagement.v1`. (The two data suites that
      DO call `initLive` arm harmlessly — nothing flushes inside one
      day.) · **Gate:** `test:unit` (smoke). · **Size:** S.

- [x] **2.4 Wire the seams. DONE 2026-08-23**, with three placements
      landing better than sketched once the code was open:

      - `live.ts` — `vote`/`editVote` count on the server ACK, not the
        tap, so the tally agrees with the server about what was
        answered; a slow first paint (>4 s) counts off the boot promise.
      - `app-shell.jsx` — NOT the nav registry (it carries cross-links,
        not the tab bar's own taps): three one-line effects on the
        shell's `tab`, `ov` and `mirrorPop` state cover every tab,
        overlay and Mirror-stop view from any path, the ruler included —
        which also dissolved the "find mirror-tab's setter" step, since
        every stop change flows through `mirrorPop`. The `ErrorBoundary`
        counts beside its Sentry report.
      - `world-feed.jsx` — the EXISTING entrance IntersectionObserver
        doubles as "seen" (first scroll into view — a deliberate,
        recorded deviation from ATTENTION §3's ≥50 %/≥1 s: one observer,
        one definition for every card; D270 carries it). Pass/defer
        count at `setPass`/`setDefer`, outside the updaters.
      - `MirrorLensTabs` — lens taps at the row itself, one point for
        both callers. Reveal-viewed at `LdRevealBars`'s mount in
        `LiveDuelPanel.tsx` (typed, tested — no spec duel module
        touched). `push.ts` — the tap lands `notifOpen`.

      · **Gate:** `check:globals` (coupling baseline unmoved;
      spec-index untouched), `test:unit` across the six touched suites.
      · **Size:** M.

- [x] **2.5 Rules arm for the shards. DONE 2026-08-23**, with one
      structural improvement over the sketch: the shards live FLAT
      (`v2_attention/{shardId}`, day as a bounded FIELD with the pulse
      parse idiom, −8 d/+2 d) — a collection-group query and its index
      question disappear. `hasOnly` over seven fields plus the 30-key
      `s` whitelist; **bucket VALUES deliberately unbounded here** —
      rules cannot iterate a map, and the fold (the only reader) clamps
      in one line, with the arm's comment saying so. No read for
      anyone, no update, no client delete. The `qids` clause admits
      only an EMPTY map until D271. Two rules tests, uid-refusal and
      qids-refusal included → 132. · **Gate:** `test:rules`. ·
      **Size:** S.

- [x] **2.6 Flush transport. DONE 2026-08-23.** `flushPast()` hands
      each finished sampled day to the SDK (`setDoc`, random UUID id)
      and clears local state on hand-off — the offline queue owns
      delivery, and re-writing on the next boot would double-count a
      shard the queue already delivered. A refused write is one lost
      anonymous day, priced and unlogged (wiring Sentry in would couple
      every seam's import graph for a loss the design accepts). Tallies
      older than the rules window are dropped, not sent to be refused.
      · **Gate:** `test:unit` (injected writer). · **Size:** S.

- [x] **2.7 The shard fold. DONE 2026-08-23**, as `runAttentionFold` in
      the same nightly run (one schedule, one heartbeat — the digest's
      metric gains `shards`/`shardDays` fields, no monitoring change).
      Late shards are the NORMAL case (a device flushes yesterday on
      its next boot), so the fold sweeps whatever exists — capped at
      `SHARD_FOLD_CAP` per night, cap logged, never silent — and
      merges additively into ANY day's doc via `FieldValue.increment`
      under set-merge. **Exactly-once is the batch**: each chunk's
      delta and its deletes commit atomically, so a crash between
      chunks re-folds survivors without double-counting (pinned by the
      700-shard chunk test). Reach + midpoint estimates, scaled by the
      shard's own rate; garbage clamped. No e2e callable — the
      injected-store tests carry it, so `check:appcheck` stays
      untouched. · **Gate:** `npm test --prefix functions` (8 fold
      cases). · **Size:** M.

- [x] **2.8 R4 lands in the scorecard. DONE 2026-08-24, on the owner's
      "adopt R4" (D271 flips binding).** Exactly the staged shape the
      open note promised: the rules clause widened to `size() <= 120`
      (the cap INCLUDES the client's `_other` overflow cell, so a capped
      shard is legal by construction); the client populates the map from
      the seen/pass/defer seams it already had (the entrance observer's
      ref now stamps the card's qid) plus answered on the feed-rendered
      surfaces, so numerator and denominator describe one population;
      the fold sums into `attn.q` with truncation counted apart as
      `qOther`; and `attentionFromTrail` (scorecard-metrics.mjs) merges
      `attnSeen`/`attnConv`/`attnPass` onto the card with the D33
      warning STORED on it and a basis floor (`ATTENTION_MIN_SEEN`)
      under which rates read null, not noise. QUESTION-FARM's two
      skip/pass passages narrowed in the same change. ·
      **Gate:** `test:rules` (134), `test:scripts` (275). · **Size:** S.

- [x] **2.9 Paperwork, same PR. DONE 2026-08-23.** Inventory row +
      the "not collected" paragraph rewritten to the derive/collect/
      per-user three-way; **Product Interaction → collected / NOT
      linked** in both store files, moved together under
      `check:store-forms` (11 collected types), with the unlinkability
      reasoning written at filing depth and a tombstone in the JSON's
      notCollected block; `web/privacy.html`'s tally paragraph + two
      `CLAIMS` rows (unlinkable-across-days; deleted-after-the-fold) →
      24 disclosures; `SCHEMA-V2.md` entries; the COSTS lever reads
      `SHARD_SAMPLE_RATE` from source (server reads 27 → 28/user-day,
      $255 → $257 at 50 k, $2,593 → $2,613 at 500 k, linear in the
      rate). · **Gate:** all four green. · **Size:** S.

- [x] **2.10 Bundle + release — code side DONE 2026-08-23.**
      `engagement.ts` is entry-side by necessity; the build and
      `check:bundle` run in this change's gate sweep, and the release
      itself rides the normal train (`appBuild` moves with the next
      store build, not with this commit). · **Gate:** `check:bundle`,
      `npm run build`. · **Size:** S.

- [ ] **2.11 Done when:** a device on a store build produces a shard,
      and the nightly fold publishes feature reach with the shards
      deleted behind it. **Code-complete 2026-08-23; open until the
      next production deploy AND the next app release** — the fold
      ships with the standing europe-west1 deploy, the shard writer
      ships inside the next store build, and until both are out the
      pulse panel's attention table simply is not there, which is the
      correct reading. (Per-question ratios belong to 2.8/D271, not
      here.)

## Phase 3 — rung 2: the person channel

Gated on R3. Everything here extends phase 2's module and fold.

- [x] **3.1 [owner] Adopt R3 — DONE 2026-08-24 as D272**: the owner's
      words were "build phase 3", and this step is the gate that
      defines building phase 3 AS adopting R3 (the D270 provenance
      shape, stated in the record). · **Gate:** `check:docs` (255
      records). · **Size:** S.

- [x] **3.2 Session machinery. DONE 2026-08-24.** Foreground episodes
      split at 30 min hidden (`SESSION_GAP_MS` — attention semantics,
      deliberately not live.ts's 60 s billing detach; the two constants
      are neighbours, not one number). Quiet is decided at session
      CLOSE and lands on the start day; foreground time accumulates
      visible→hidden; dayparts are LOCAL (when in their day people
      come). Trimmed from the sketch: reveals/notifs stayed shard-only
      rather than duplicating onto the rollup — the person channel
      carries what only it can (sessions, fg, quiet, dayparts, depth).
      Two priced edges stated in the record: midnight-spanning fg lands
      on the hidden day, and a session open when its day flushes never
      gets its quiet verdict. · **Gate:** `test:unit` (fake-timer
      episode cases). · **Size:** M.

- [x] **3.3 The rollup write. DONE 2026-08-24.** Create-only for
      yesterday, `day` duplicating the id, `expireAt` = day + 90 d,
      `folded: false` at birth — and, unlike the shard's
      fire-and-forget, a rollup with no session to own it yet is
      RETAINED and retried next boot: uid-keyed data loses nothing by
      waiting. · **Gate:** `test:unit` (retention-and-retry case). ·
      **Size:** S.

- [x] **3.4 The rules arm is the no-qids pin. DONE 2026-08-24.** Owner
      create only, date-id parse with the pulse bounds, `hasOnly` over
      the fourteen fields, every int bounded, `folded == false`,
      `expireAt` inside 100 d; `_state` fails the date regex inside the
      SAME match block and stays server-only. The smuggle-a-qids test
      is in, and read is denied to the owner too. · **Gate:**
      `test:rules` (134). · **Size:** S.

- [x] **3.5 Fold extension + index. DONE 2026-08-24**, one design
      correction from the sketch: the query is
      `where("folded", "==", false)`, not `where("day", "==", D)` —
      rollups arrive LATE (a device flushes yesterday on its next
      boot), so "unfolded" is the honest sweep and the flag, marked in
      the same batch as the day-doc increments, is what makes it
      exactly-once without deleting the trail the TTL owns. The
      group-scope fieldOverride on `folded` landed in
      `firestore.indexes.json`, riding the existing indexes deploy.
      Derived into `people`: rollups, sessions, quiet, dayparts,
      fg-bucket histograms, depth-end — and **fading**, from the
      `_state.fg7` window the fold advances in day order. The store
      interface reads uid, day and the rollup's own fields — no
      profile, no anchor is reachable, which is the
      anchor-slicing refusal as code. · **Gate:** `npm test --prefix
      functions` (332 + the 8 rollup cases = 340). · **Size:** M.

- [x] **3.6 TTL, actually applied — the repo's half DONE 2026-08-24.**
      `SHIP-CHECKLIST.md` §5 carries the second `gcloud` line, with
      what an unapplied policy quietly breaks written beside it (the
      privacy page's "deletes itself 90 days after its day" is what the
      command makes true). The console half stays hand-run, the
      ledger's own caveat. · **Gate:** review; the checklist row. ·
      **Size:** S.

- [x] **3.7 Erasure asserted. DONE 2026-08-24, against the real
      emulated functions.** The e2e seeds the rollup AND `_state`,
      both on the must-be-gone list, plus a control that another
      account's rollup survives (a sweep that took the collection
      instead of the account would look identical from the deleted
      side). ALL ERASURE CHECKS PASSED. · **Gate:**
      `test:e2e:erasure`. · **Size:** S.

- [x] **3.8 Paperwork. DONE 2026-08-24.** Product Interaction →
      **Linked** in both store files (moved together, 11 types
      agreeing), with the three-move history written at the bullet;
      privacy.html's rollup paragraph + three claim rows (no question,
      nobody reads it including you, 90-day self-expiry) → 27
      disclosures; inventory rows and the ladder paragraph; SCHEMA-V2;
      MONITORING's first refused row rewritten as the record of its
      ceiling; COSTS lever ($257 → $262 at 50 k, the ladder's priciest
      rung and under 2 % of a read-dominated bill). · **Gate:** all
      four green. · **Size:** S.

- [ ] **3.9 Done when:** rollups flow, the fold publishes fade and
      quiet-session numbers with no uid anywhere downstream, the TTL
      policy is applied in the console, and the pulse panel's people
      tiles draw from a real day. **Code-complete 2026-08-24; open
      until the next production deploy (the fold), the next app release
      (the writer), and the hand-run TTL command** — three different
      hands, all named.

## Phase 4 — reading it well (optional, any time after 1.7)

- [ ] **4.1 Pulse engagement charts** — self-contained, stdlib-only,
      the console's own palette discipline (labels on segments, table
      beside every chart). · **Gate:** `test:scripts`. · **Size:** M.
      *(State 2026-08-27: panel 4b in `pulse-render.mjs` already draws
      the digest trail; what this box still wants is chart treatment
      beyond the sparkline — worth doing when the figures have signal
      to show, since every reading is zero until real users.)*
- [ ] **4.2 Trail curation** — keep the handful of figures worth
      trending (DAU, D7, one-and-done, Mirror reach, top/bottom
      conversion), resist the rest; a trail that carries everything is
      a second copy of the artifact nobody can read. · **Size:** S.
      *(State 2026-08-27: two of the five ride
      `monitoring/pulse-trail.jsonl` already — `dau` and `retD7`,
      null-as-gap. One-and-done, Mirror reach and top/bottom conversion
      have no committed source until the rung 1–2 writers ship with a
      release (3.9's open half); adding their columns now would be
      permanent nulls — the second-copy noise this box exists to
      resist. Blocked on data, not on code.)*

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
