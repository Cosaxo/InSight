# Engagement — measuring what holds people and what loses them

**Status: mixed — the adoptable ladder is BUILT (rung 0 = D268, rung 1 =
D270, its per-question map = D271, rung 2 = D272, all 2026-08-23/24,
under D269's binding ceiling); what remains plan is what the plan
refuses: §4.3's event-stream rung and everything §4.4 keeps out.**
Requested 2026-08-23: *track as much as possible about how a user uses
the app — what engages them, what bores them, and whatever else is
useful.* Read §2, §4.1 and §4.2 as descriptions; the records carry the
as-built deviations. The build list, with every phase's notes, is
[`ENGAGEMENT-RUNBOOK.md`](ENGAGEMENT-RUNBOOK.md).

> **This generalizes [`ATTENTION.md`](ATTENTION.md), it does not replace
> it.** That document answered a narrower 2026-08-13 ask ("does anyone
> like Foresight, and what is this person into") and two of its tiers are
> already decided: D128 (stated topic preferences, device-only) and D163
> (the on-device interest model, device-only) stand untouched here.
> What this plan takes from it is load-bearing: the cost rule (§1), the
> signal-weight table (§3), the honesty rules for reading ratios (§3.4),
> and tier 3's anonymous-rollup shape, which becomes rung 1 of the
> ladder below. What this plan adds is everything the 2026-08-23 ask
> covers and that one did not: sessions, the Mirror, retention, funnels,
> per-question attention, and the per-person reading.

## 0 · What this collides with, before anything else

The ask is per-user behavioural analytics, and this repo refuses that
today — deliberately, in writing, re-affirmed after D98 as an analytics
decision standing on its own. Every rung below names which of these rows
it crosses, because crossing one silently would be the same failure as
the silent removals D166 forbade.

| Standing refusal | Where it is recorded |
| --- | --- |
| "No product analytics of any kind ship today" | `data-inventory.md` — **the audited list the store forms are answered from** |
| Per-user funnels, session analytics, engagement scoring | `MONITORING.md` § Off the table |
| ~~Retention or engagement sliced by anchor~~ | **Lifted at D318** — it was a decision rather than a side effect, which is exactly what made it the owner's to drop |
| Anything sliced by the political result | same table (D8; GDPR Art. 9). **Not** lifted with the row above, and the two were one sentence for long enough to read as one rule |
| Skip / pass rates reaching the server | narrowed at D271 (aggregate-only, anonymous shards); per-PERSON lists stay local-only. Hesitation joined those terms at **D318** |
| Server-side per-user content selection, ad-targeting profiles | `MONETIZATION.md` § Ruled out; narrowed to *server-side* by D163 |

Two records already crossed parts of this territory and are the shape to
copy: D98 reversed the whole privacy model knowingly, and D163 reversed
the per-user-selection row *partially*, naming itself a partial reversal
and stating what survives. A reversal taken like that is legitimate; one
that happens because a tracking module quietly shipped is not.

The teeth outside this repo: `docs/STORE-FORMS.md` answers Apple's
**Product Interaction — No** by citing the data-inventory sentence, and
says in as many words that adding any product analytics changes the row.
Its own preamble lists "product analytics being added" as a re-answer
trigger. So every rung below that uploads anything lands with the store
forms, the inventory and `web/privacy.html` **in the same PR, or not at
all** — `ATTENTION.md` §6's rule, generalized, and the gates hold it
(§7).

## 1 · The frame: one cost rule and two channels

**The cost rule** (`ATTENTION.md` §1, already treated as binding by
D164): an answer is ~1 write per user per day; an impression is 30–100
per session. **Never write an event per upload-able impression.** The
device tallies; the device uploads a rollup. Everything below is one
document per device per day per channel — the same cost bracket as one
more answer.

**The two-channel rule**, which is this plan's one structural idea:

> **The person channel never carries a question id. The question channel
> never carries a person.**

- The **person channel** (rung 2) is uid-keyed and says *how much*: how
  many sessions, how long, which tabs, how deep — never *which
  questions* were seen or passed. A uid-keyed reading history — what you
  looked at and declined to answer — would be more revealing than the
  answers themselves, and nothing below needs it.
- The **question channel** (rung 1) is anonymous and says *what*: this
  question was seen N times and answered M, this lens was opened K times
  — never *by whom*. Per-day random ids, unlinkable across days,
  fold-and-delete.

Answers are the standing exception — they carry both a person and a
question by design, and publish under D98; that is the product, not
telemetry. Sealed duel answers stay out of the question channel until
their reveal, for the same reason `surface` seals them everywhere else:
game timing.

**Both channels write yesterday, create-only.** A rollup for day *N* is
written once, after *N* ends (on day rollover in a live session, or on
the next boot) — so the create-only discipline that holds everywhere
else (D5, D86's one exception) holds here too, and no rules arm for
mid-day updates exists to be widened later. Tallies for the current day
live only on the device until then.

## 2 · Rung 0 — what the server already knows (a decision, not a collection)

Roughly half of the catalogue in §3 needs **no new collection at all**,
because answering *is* the write and every answer already carries a
timestamp, a surface and a uid. What is missing is only the fold that
reads them — and one recorded decision, because `MONITORING.md` already
flagged it: `v2_agg_events` holds `(qid, uid, at)` with a 90-day TTL,
justified as trigger dedup and fake-ring attribution (D28), and
**counting people with it is a new purpose for existing data**. That is
record R1 in §8, and it is the cheapest reversal on this page — nothing
new is collected, nothing moves on a store form, and the output is
anonymous counts.

What rung 0 can already answer, from the ledger and the answer docs:

- **DAU / WAU / MAU** (distinct answering uids per window) and
  **retention curves** — D1/D7/D30 return rates per signup cohort, with
  signup time from Firebase Auth's own account-creation stamp. D90+
  windows come from the answer docs (no TTL), the ledger covers the hot
  window.
- **Activation**: account creation → first answer → first duel answer →
  first test answer, as durations and drop-offs — every step is an
  answer with a surface.
- **Habit shape**: answers per user-day, distinct active days,
  time-of-day histograms, **streaks and streak deaths** (the streak math
  already ships in `functions/`).
- **Retention lift by week-1 behaviour**, surface-level: "answered a
  duel in week 1" vs not, against D30 return — the surface mix of a
  user's first week is already server-visible. This is the strongest
  engage/bore instrument on the whole page and it costs zero collection.
- **Per-question performance** the scorecard already reads, now with
  velocity (answers/day since seed via the ledger), edit rates (D226's
  public matrix), and take volume.
- **Social loops**: invite → join conversion, follows created, circle
  sizes, duel participation and rematch, take and flag volumes.
- **Churn floors**: days-since-last-answer distribution, one-and-done
  rate (accounts whose active-day count is 1).

All of it is **floors, not measurements** — a person who opens the app
and answers nothing is invisible here (MONITORING.md's own caveat). That
blindness is exactly the list that motivates the rungs above:

| Rung 0 cannot see | Because |
| --- | --- |
| Sessions — count, length, opens without answering | nothing writes on open |
| **The entire Mirror** — does anyone open it, which stops, which lenses | reading is the point and reading writes nothing |
| Reveal returns — do people come back for the duel reveal | the reveal doc is written by the server; viewing it writes nothing |
| Seen-denominators — skip rates, feed exhaustion, "shown but not answered" | impressions are device-local (deliberately, D163) |
| Notification opens | delivery is server-side; the tap is not |
| Cold starts, error-boundary hits as rates | Sentry holds crash *events* (uid-tagged, D76), not denominators |

## 3 · The catalogue

The full list the ask asked for. Markers say what each signal needs:

**●** rung 0 (already on the server) · **○** rung 1 (anonymous channel)
· **◐** rung 2 (person channel) · **✕** refused at every rung (§4.4).

### 3.1 · By surface

**Lifecycle & sessions**
| Signal | Needs | Notes |
| --- | --- | --- |
| Sessions per day, foreground minutes (bucketed) | ◐ | session = foreground episode; the idle-detach machinery already defines the boundary |
| Session count without any answer ("quiet sessions") | ◐ | the direct boredom read |
| Cold-start time (bucketed), error-boundary hits, offline-queue flushes | ○ | denominators for the Sentry events that already exist |
| Local daypart of use (4 buckets) | ◐ | coarse on purpose; exact hours are ● via answers anyway |
| Build, platform | ○ ◐ | rides every rollup, as ATTENTION's shape already had it |
| Push delivered → opened | ● + ○ | delivery counts are server-side today; the tap is one client event |
| Uninstall proxies (token send-failures, last-seen gap) | ● | |
| Sign-in mix (anonymous vs linked), profile completeness, avatar/name/handle adoption | ● | |

**The daily loop**
| Signal | Needs | Notes |
| --- | --- | --- |
| Answered the daily; when; streaks; streak deaths | ● | |
| Sessions that saw the daily and did not answer it | ◐ | count only, no qid needed — there is one daily |
| Deliberation time between options rendering and the vote | ◐ | hesitation; **D318** allows it bucketed inside the anonymous shard, never per answer |

**The feed**
| Signal | Needs | Notes |
| --- | --- | --- |
| Seen / answered per question (the conversion the farm cannot compute today) | ○ | per-qid counts in the anonymous shard; R4 |
| Pass and defer rates per question | ○ | already tallied on-device for D163 (`insight.feedPass.v1`, `insight.feedDefer.v1`); R4 uploads the *aggregate*, never the person's list |
| Feed exhaustion (reached the end), max scroll depth (bucketed) | ◐ | SCALE-PLAN §2's "what trips first" gets a live gauge |
| Takes read, who-voted sheets opened, topic doors used | ○ | counts per feature, not per target |
| Per-card dwell | ✕ | ATTENTION §3 already ranks it the weakest signal; with pass/defer explicit it adds nothing worth its ambiguity |

**Duels & social**
| Signal | Needs | Notes |
| --- | --- | --- |
| Created, joined, sealed-answered, rematch | ● | |
| **Reveal viewed, and how long after it unsealed** | ○ ◐ | today invisible; the loop's whole payoff is unmeasured |
| Invites sent → accepted, follows, takes written | ● | |
| Profile sheets opened | ○ | a count; per-target is ✕ |

**The Mirror** (the product's larger half, and today a total blind spot)
| Signal | Needs | Notes |
| --- | --- | --- |
| Tab opened; stops visited per visit; which of the seven | ○ ◐ | ◐ carries only counts ("3 stops"), ○ carries which |
| Lens tabs opened per stop (Answers · People · Compare · Explore · Scores) | ○ | ATTENTION §4's "engaged/seen vs neighbours" instrument, applied to the row D136 built |
| Similarity field rendered with data vs empty | ○ | measures what D1's honesty costs: how often the headline surface has nothing to say |
| Kindred taps, constellation opens, person-sheet opens (counts) | ○ | each is the tap D136 priced as the cost gate |
| Compare/Explore segment interactions | ○ | |

**Patterns** (unmounted, D217 — instrument it when the mount returns):
lens opens ○; Oracle plays and surprisal are already ● (grades ride the
ordinary vote path).

**Tests, pulses, Learn**: completions, first-attempt accuracy, logic
starts vs finishes, pulses answered — all ● today. The pulse *cadence*
stays unobserved at every rung: `data-inventory.md` records that the
rhythm of a health-adjacent question never leaves the device, and an
engagement plan does not get to un-decide that.

### 3.2 · Derived: engagement

Computable from the rungs marked, each defined so a fold can compute it:

- **Retention lift per feature** ●/◐ — D30 retention of users whose
  week 1 contains X, against those without, for X ∈ {duel, test, take,
  follow, mirror-open}. The keep/kill instrument.
- **Activation funnel** ● — signup → first answer → first duel → first
  Mirror open (last step ◐), as median hours and step drop-off.
- **Depth** ◐/○ — answers per session; stops per Mirror visit; lens
  opens per stop-visit.
- **Social pull** ◐ — share of sessions touching a duel, reveal or take.
- **Feature reach** ○ — opens per eligible session, per surface; the
  denominator rung 0 never had.

### 3.3 · Derived: boredom

- **Fade** ◐ — a 7-day window of foreground-minute buckets whose mean
  sits ≥2 buckets under the prior window's. The win-back trigger, and
  the one reading only the person channel can produce.
- **Quiet-session share** ◐ — sessions with zero answers ÷ sessions.
- **Feed futility** ◐ — sessions that reached the feed's end with no
  engagement.
- **Reveal no-show** ○ — sealed answers whose reveal is never viewed
  within 48 h ÷ sealed answers.
- **Streak deaths** ● — streaks ≥7 that end, per day.
- **Notification fatigue** ○ — opened ÷ delivered, trending down.
- **Per-question repellence** ○ — pass rate and seen→answer conversion
  against the bank's median (R4; feeds the scorecard and D162's
  measure-and-retire).
- **One-and-done rate** ● — the launch-period number to watch first.

### 3.4 · Honesty rules for reading any of it

Carried from `ATTENTION.md` §3–4 and `MONITORING.md`, restated because a
dashboard doubles every temptation (D33):

- A skip is **not** dislike. Seen-denominators only; explicit signals
  (pass, "less of this") outweigh inferred ones by an order.
- A new feature's numbers are inflated for as long as it is new — judge
  `engaged/seen` **against neighbouring features, over ≥1 month**.
- Absent ≠ zero: a day with no rollups says the fold didn't run or
  nobody came; the panel must say which, the way pulse's trail draws a
  gap as a gap.
- Every metric names the decision it serves, or it is not collected — a
  panel that serves no decision was cut from pulse, and the same rule
  holds one layer down.
- Floors vs measurements stay labelled: rung 0 counts answerers, rung 1
  is sampled, and a sampled count is quoted with its sampling rate.

## 4 · The ladder

Severable rungs — each is a legitimate stopping point, each names what
it reverses, and a higher rung subsumes the lower's outputs (adopting
rung 2 does not remove rung 1's channel; the anonymous shard is where
the qid-keyed half lives at every rung).

### 4.1 · Rung 1 — anonymous feature & question tallies (records R2 + R4)

`ATTENTION.md` tier 3, generalized from "does anyone like Foresight" to
every ○ row above. The device tallies in localStorage; once a day it
writes one shard:

```
v2_attention/{yyyy-mm-dd}/devices/{randomId}
  surfaces  { daily: {seen, engaged}, feed: {…}, mirror: {…},
              mirrorStops: {you: n, circle: n, …},
              lenses: {people: {seen, opened}, …}, reveals: {due, viewed}, … }
  qids      { q123: {seen, answered, passed, deferred}, … }   // ≤ capped entries
  build, platform, sampled
```

- `{randomId}` per write, per day — two days from one phone must not be
  linkable, or this is a per-user funnel with extra steps.
- Counts **bucketed** (0, 1–2, 3–5, 6–10, 11+) exactly as ATTENTION
  specified — an exact 137 is a fingerprint, a bucket is not. The `qids`
  map is capped by the rules; overflow rolls into an `other` cell and
  the fold reports the truncation rather than hiding it.
- A scheduled fold sums the day's shards into one public daily doc and
  **deletes the shards** — the raw pile must not accumulate into the
  thing this rung promises not to be. The deletion is asserted by a
  functions test, not assumed.
- **Sampling is legitimate and the default** — a device-local coin
  (10% to start) answers feature questions as well as a census at a
  tenth of the cost, and the shard says it was sampled.

Reverses: the data-inventory sentence (for *unlinked* data) and — via
the `qids` map — QUESTION-FARM's skip/pass row, **aggregate-only** (R4
narrows it the way D163 narrowed MONITORING's row: the server learns a
question's pass rate, never a person's passes). Store forms: Product
Interaction → collected, **not linked**, purpose Analytics; Apple's
tracking answer stays **NO** (first-party, no third party, no ad use).

### 4.2 · Rung 2 — the per-person rollup (record R3)

The rung the "what bores *them*" half of the ask actually needs, and the
real reversal: per-user funnels, session analytics, engagement scoring —
MONITORING.md's first refused row, crossed knowingly or not at all.

```
v2_users/{uid}/engagement/{yyyy-mm-dd}     // create-only, yesterday's day
  sessions, fgMinutes(bucket), quietSessions, answersBySurface{…},
  tabs{daily, mirror}, mirrorStops(count), lensOpens(count),
  feedDepth(bucket), reachedEnd, revealsViewed, notifOpened,
  dayparts[4], build, platform
```

- **No qids, ever** — the two-channel rule is this document's hard line,
  and a rules test pins the field list the way `vote.test.ts` pins
  `window.LIVE`.
- **Readable by nobody** (`allow read: if false`) — not even the owner,
  the push-tokens posture: a path with no read grant is not one edit
  from being readable. This is measurement, not a Mirror surface; if a
  "your year in InSight" product surface is ever wanted, that is its own
  decision reading its own shape.
- Create-only, day-keyed id parsed by the rules (the pulse idiom),
  size-capped, ints bounded. Written by the owner's client for
  yesterday; a client can lie about itself — same honest limit as
  Foresight's client-written verdicts, recorded, and it distorts only
  that account's row.
- **90-day TTL** (collection-group policy, D28's window and the same
  `gcloud`-was-actually-run trap MONITORING already names). The nightly
  fold extracts the durable, anonymous derivatives — cohort retention
  matrices, fade counts, funnel rates — into the public daily doc
  before the dailies expire. Long history lives only in the anonymous
  fold; the uid-keyed trail is a rolling window.
- **Erasure**: lives under `v2_users/{uid}`, so `deleteAccount` phase
  1b's recursive delete already sweeps it — no new arm, the
  patterns-fit-state shape, asserted in `e2e-delete-account.mjs`.
- Store forms: Product Interaction → collected, **linked**. Tracking
  stays NO.

What stays refused inside the rung: engagement sliced by anchor or by
any test result (the MONITORING rows, D8, Art. 9 — the rollup carries no
anchors and the fold joins none), and any server-side selection driven
by it (D163's boundary: the model that orders anything stays on the
device).

### 4.3 · Rung 3 — the event stream. Refused; record it (R5)

Raw per-event upload — taps, scrolls, screens, timestamps — is what
"track everything" means at the vendors, and it is refused here at any
adoption level, so the next ask starts from a line rather than drift:

- **Cost**: two orders of magnitude more writes than the entire app
  (ATTENTION §1's arithmetic, which D164 treats as load-bearing).
- **Shape**: a uid-keyed behavioural log is the dossier every standing
  document promises does not exist — the thing MONETIZATION.md calls
  "the moment a behavioural profile exists, whatever the intentions",
  now with subpoena and breach surface.
- **Yield**: every decision in §3.2–3.3 is computable from rollups. The
  delta a log buys is replaying an individual's session, which serves no
  keep/kill/fix decision and is not a thing this product should be able
  to do. If a specific UX question ever genuinely needs sequence data,
  the shape is a time-boxed, sampled, its-own-record experiment — never
  standing infrastructure.

**Third-party analytics SDKs (GA4, Amplitude, PostHog, …) are refused
with it**: the inventory's "no advertising or analytics identifiers" is
a store-form claim (D16 strips a Facebook SDK a transitive manifest
tries to link — the posture has a gate); an SDK is eager bundle weight
`check:bundle` prices against first paint; its data is outside
`deleteAccount`'s reach, outside the emulator suites, and outside
`firestore.rules` — unprovable by exactly the machinery this repo trusts
promises to. Sentry stays the one third party, crash-scoped (D76/D211).

### 4.4 · Refused at every rung, whatever is adopted

**Narrowed at D318** — three of these were lifted by the owner and the
list is now written as seven separate refusals rather than one, which is
what made the old bundle read as arbitrary. What remains:

Per-target reads (who viewed whom — the flag-authorship deny's
anti-retaliation reasoning, applied to viewing) · RAW per-event upload
(the cost argument of §4.3, independent of privacy) · anything from a
sealed duel before its reveal · keystrokes, drafts, free text (a take
exists when posted, not before) · coordinates or anything below the
presence cell's existing coarseness · engagement sliced by any TEST
RESULT (GDPR Art. 9 for politics; D8 keeps every result out of
`BREAKDOWN_DIMS`) · pulse cadence · the daily or the Mirror adapting to
any of it (D128/D163's invariant — one blind question, the same for
everyone, is load-bearing).

Lifted at D318, each on its own reason: **third-party analytics SDKs**
(the promise that made it costly retired at D314; the paperwork did
not) · **engagement sliced by anchor** (an analytics preference, and
this document said so) · **hesitation timing**, in one shape only —
measured on the device, published as bucketed counts inside the
anonymous shard. Raw timings per answer stay refused above.

## 5 · Where it plugs in

**Client**: one typed module, `src/v2/data/engagement.ts` — no
`window.*` publication (rule 4 only ratchets down; consumers import it,
which rule 2 already licenses through the ESM graph — `app-shell.jsx`
and `world-feed.jsx` import ESM today). Seams, all existing:

- `app-shell.jsx` — `goTab` / `openOverlay` / `registerNav` is one
  choke point for tab, stop and overlay opens; the ErrorBoundary lives
  here too.
- `live.ts` — `vote()` is the single path every surface's answer rides;
  `hydrate()` timing gives cold start; the idle-detach machinery and
  Capacitor's app-state events give session boundaries; `purgeLocalTrace`
  is where the store's purge listener registers.
- `world-feed.jsx` — the one real spec-layer addition: an
  IntersectionObserver for *seen* (≥50 % visible ≥1 s, ATTENTION's
  definition) next to the pass/defer writes that already exist.
- `MirrorLensTabs` / `lensTabs.ts` consumers — lens opens.
  `data/push.ts` — notification taps.

Tallies persist in `insight.engagement.v1`: registered with the D51
purge (`check:purge` fails otherwise, and `purge-wipe.test.ts` gets a
case), wiped on uid change so no account inherits another's day.
Flushes ride the Firestore SDK's offline queue — a rollup written on a
dead train arrives when the phone wakes, with no hand-rolled retry.
**Inert in jsdom**: nothing initializes unless `initLive` arms it, and a
mount-suite case pins that a smoke render tallies and writes nothing —
the `statsTypo` lesson says the mount tests are the only gate that would
catch it executing.

**Backend**: `functions/src/engagement.ts` — one scheduled fold
(europe-west1, D201; the named database, D165; `check:fn-runtime`,
`check:deploy-targets` both apply), off the hot write path like the
patterns fit. It is a cron, so its characteristic failure is silence —
it gets a heartbeat absence policy in `monitoring/`, the
`scheduledDuelReveals` shape, wired through `check:monitoring`. Rules
arms are create-only with day-parse and caps, tested in
`firestore-tests/` both ways; the fold math lands in `pure.ts` with the
other fold arithmetic and its own unit tests.

**Reading it**: the fold writes one **public** daily doc
(`v2_engagement_daily/{day}` — anonymous ratios and counts; a
signed-in reader could already derive activity floors from the day-keyed
pulse aggregates, and a public doc keeps the no-credentials read path).
The scorecard's committed-artifact shape (D33) extends to it: a
scheduled collect commits the day's figures, pulse gains an engagement
panel and trail columns, and the owner reads it where they already read
everything — `npm run pulse`. If the owner prefers the business numbers
non-public, the doc flips to server-only and the collect needs
credentials; that is the one open design toggle (§8, R2).

## 6 · Cost, in the app's own units

Stated as ratios against the cost model's own assumptions (3 answers +
0.2 writes per user-day; the bill is read-dominated); the binding rule
from `FEATURE-COMPLETE.md` §3 applies — **the COSTS.md line and a
`cost-arith.mjs` lever land before any rung ships**, and the lever run
is what gets quoted, not this prose.

- **Writes**: +1 per user-day (rung 2) and +1 per *sampled* device-day
  (rung 1; ~0.1 at the default rate). Against ~3.2 today: roughly a
  third more writes at full adoption — the bracket the cost rule was
  designed to hit. No shared counter anywhere, so the write-contention
  wall (the wall that binds first) is untouched.
- **Client reads**: zero added. The channels only write.
- **Fold**: ~1 read per rollup per day plus one write per active
  question-day and a handful of daily docs; rung 1 shards are deleted
  after folding, so they never accumulate storage.
- **Storage** (rung 2): at the ~2 KB cap × 90-day TTL, ≤180 KB per
  active user standing — cents per thousand users at Firestore rates.
- **Bundle**: `engagement.ts` is entry-side by necessity (it hooks
  boot); it is counters and a flush, a few KB against `MAX_EAGER_KB`'s
  headroom, and `check:bundle` holds it. The SDK it refuses to be would
  have been an order more.
- **Abuse**: shards and rollups are signed-in create-only with caps, but
  App Check on the data plane is still the soft-shipped flip — same
  exposure as answers, plus one honest limit the anonymous channel adds:
  junk shards carry no uid, so unlike answers (D28) they cannot be
  subtracted after the fact. The fold clamps outliers and the channel
  informs keep/kill decisions, never published product claims.

## 7 · The paperwork each rung lands with — same PR, or not at all

| Artifact | Rung 0 | Rung 1 | Rung 2 | Held by |
| --- | --- | --- | --- | --- |
| `docs/DECISIONS.md` record (§8) | R1 | R2 (+R4) | R3 | review |
| `docs/data-inventory.md` rows; the "not collected" paragraph rewritten | purpose note | yes | yes | `check:data-inventory` |
| `web/privacy.html` section + new `CLAIMS` rows (tokens: *without your name or account*, *no other user — and no one at all — can read*, *no third-party analytics*, *deleted with your account / expires after 90 days*) | purpose sentence | yes | yes | `check:policy-claims` |
| `docs/STORE-FORMS.md` + `design/store/app-privacy.json` (Product Interaction: No → collected/not-linked → collected/linked; purposes) | purposes check | yes | yes | `check:store-forms` |
| `docs/SCHEMA-V2.md` + rules arms + rules tests | — | yes | yes | `test:rules` |
| Erasure assertions (`e2e-delete-account.mjs`) | — (ledger already swept) | n/a (no uid) | yes | `test:e2e:erasure` |
| `docs/COSTS.md` line + cost lever | fold line | yes | yes | review + `npm run costs` |
| Monitoring heartbeat policy for the fold | yes | yes | yes | `check:monitoring` |
| Pulse panel + trail columns | yes | yes | yes | `test:scripts` |

Rung 0's store-forms cell is deliberately not "nothing": using
already-collected answers for analytics is a *purpose* change on
declared data, and the honest move is re-checking the purpose ticks even
if no category row moves. `STORE-FORMS.md` owns the final wording.

## 8 · The records adoption needs

Drafted here, adopted only by the owner writing them into
`DECISIONS.md` (a Proposed record binds nothing — ORIENTATION §6).

- **R1 · The ledger learns to count people.** Widens D28's purpose list
  for `v2_agg_events` (dedup, attribution, **population counting**);
  adds the nightly digest fold and the pulse panel. Output is anonymous
  counts; the 90-day TTL and erasure sweep stand. Reverses nothing
  user-facing; MONITORING.md's "unbuilt, not forbidden" row graduates.
  *Open toggle carried by R2 as well: public daily doc vs server-only.*
  **Taken as D268 (2026-08-23) and built the same day** — the toggle
  resolved to public, and the record carries the two build-time
  decisions (public read; a separate nightly scan) with their reasoning.
- **R2 · Anonymous feature tallies.** Adopts ATTENTION tier 3
  generalized (§4.1): sampled, bucketed, per-day random ids,
  fold-and-delete. Rewrites the data-inventory sentence to "no *linked*
  product analytics; anonymous, sampled feature tallies since R2", moves
  Product Interaction to collected/not-linked, lands the §7 row.
  **Taken as D270 (2026-08-23) and built the same day** — the record
  carries the as-built sub-decisions (the entrance-observer "seen"
  definition, the flat shard collection, rate 1 at launch) and the
  honest limits.
- **R3 · The person channel.** Reverses MONITORING's per-user
  funnels/session-analytics/engagement-scoring row, scoped by the
  two-channel rule (no qids), no-reader rules, create-only, 90-day TTL,
  recursive-delete erasure. Anchor and test-result slicing stay refused
  inside it. Product Interaction moves to linked. **Taken as D272
  (2026-08-24, "build phase 3" — the phase's own gate) and built the
  same day**: sessions, quiet, dayparts, depth, and the fade window the
  fold reads from `_state.fg7`.
- **R4 · Per-question attention, aggregate-only.** Narrows
  QUESTION-FARM's skip/pass refusal the way D163 narrowed MONITORING's:
  seen/pass/defer reach the server **only** inside anonymous shards;
  hesitation stayed refused outright until **D318**, which admits it on
  exactly the same terms — bucketed, in the shard, never per answer. The scorecard gains
  attention metrics with D33's goodhart warning printed beside them, and
  measure-and-retire (D162) gains its denominator. **Adopted as D271
  (2026-08-24, "adopt R4") and built the same day** — the record carries
  the as-built cap-includes-overflow design and the feed-population
  scoping of the answered kind.
- **R5 · The ceiling, recorded.** The §4.3–4.4 refusals as one standing
  record — event streams, third-party SDKs, per-target reads,
  hesitation, anchor/Art. 9 slicing, cadence, and the
  daily/Mirror-never-adapt invariant — so the next "track more" ask
  starts from a written line. **Adopted as D269 (2026-08-23, "i adopt
  R5")** — drafted Proposed the day before and adopted on the owner's
  explicit word, which is the D28 lesson working as the drafting
  intended.

## 9 · Failure modes

| Failure | Mitigation | Residual |
| --- | --- | --- |
| Metrics become targets — the app starts optimizing time-in-app, the engagement-loop dynamics the product's earliest records deliberately avoid | every metric names its decision; daily/Mirror never adapt (R5); farm guardrails outrank scores (D33's evenness lesson, extended) | an owner reading a dashboard daily is being trained by it; R5 is prose, not a gate |
| Skip read as dislike, novelty read as love | §3.4 rules travel with the panel, printed beside the numbers like the goodhart warning on pulse | fast scrollers still look bored in everything |
| The anonymous channel quietly becomes a funnel | per-day random ids; fold-and-delete asserted by test; bucketed counts | an operator who forks the fold to keep shards has a funnel; the delete has to stay real |
| Paperwork drift — collection changes, forms don't | §7's same-PR rule; four gates each hold one artifact | gates check presence, not truth (the check:policy-claims caveat) |
| Junk shards distort feature ratios | auth-gated create, caps, fold clamps; App Check flip when armed | unsubtractable by design (no uid) — scope claims accordingly |
| TTL policy never actually applied | SHIP-CHECKLIST §5 gains the second `gcloud` line; pulse's instrumentation panel lists it | the repo cannot see the console; known limit, same as today's |
| The rollup grows fields until it is a dossier | rules pin the field list; the no-qids test; widening = amending R3 | a future edit can amend R3 — that is what records are for |
| Smoke/emulator suites start writing tallies | inert-by-default with a pinned mount test | — |

## 10 · Order of work, and where to stop

The step-by-step build list — phases per rung, sizes, and the gate that
proves each step — is [`ENGAGEMENT-RUNBOOK.md`](ENGAGEMENT-RUNBOOK.md);
this section is the order and the stopping argument only.

1. **R1 / rung 0** — the digest fold, the pulse panel, the purpose
   record. Days of work, no collection, and it answers retention, DAU,
   activation, streak deaths, social loops and retention-lift. **Do this
   first regardless of everything else on this page.**
2. **R2 + R4 / rung 1** — the anonymous channel. This is where "what
   engages, what bores" gets its denominators: feature reach, lens
   ratios, per-question conversion, reveal no-shows, empty-field rates.
   First store-form move.
3. **R3 / rung 2** — the person channel, once a question rungs 0–1
   cannot answer is actually being asked. What it uniquely buys is
   per-person fade (the win-back trigger), quiet sessions, and
   depth-per-session; most "what bores people" reads are population
   reads and arrive one rung cheaper.
4. **R5** — record the ceiling in the same commit as whichever rung
   lands first.

Each rung is a stopping point. None of it blocks, or is blocked by, the
v1 release work.

## 11 · What I would do

Rung 0 this week — it is the cheapest real answer to the question as
asked, and it will sharpen which rung-1 metrics are worth their
paperwork by showing which questions rung 0 already answers. Then R2+R4,
because the Mirror is half the product and completely dark, and because
per-question conversion is the number the farm, the scorecard and
SCALE-PLAN's retirement loop all want and cannot have. Hold R3 until a
named decision needs a per-person number — and when it ships, ship it
exactly as scoped: no qids, no readers, 90 days, and the daily and the
Mirror never hear about any of it.
