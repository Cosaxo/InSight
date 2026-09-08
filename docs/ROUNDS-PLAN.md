# Rounds — 1v1 and group play without the calendar

**Status: plan notes — steps 0–4 are BUILT (2026-09-08, D420's second amendment); steps 5–8 are open.** The follow-through on
[D419](DECISIONS.md#d419--build-33-on-a-real-phone-the-wall-would-not-lift-the-setup-sheet-did-not-fit-and-the-cadence-is-not-the-product)
§5, which recorded the owner's intention and left it unbuilt: *"i actualy
hope to make the 1v1 and group less lineted to move to unlimeted
questions per day."* Directed by the owner on 2026-09-08 (*"lets go with
this path"*), with the group's reveal condition ruled in the same
message and the lead cap asked for as a reflection (§5). **On the same
day, to the model explained in plain words — five rounds ahead, a late
answer marked and not counted, *waiting on Leo*, world questions with
the world's split on the reveal — the owner said *"yeah lets do that"*,
and asked whether notifications connect to it (§7.4).** Every item is
measured against the tree with the constraint that shapes it and its
backend half named (D167); §11 is the build order and the gate per step.

**The finding that makes it cheap: the day is not the seal.** What keeps
a duel answer blind is two clauses in `firestore.rules` — the sealed
answer is owner-only (a `surface` value test, not a path), and a create
is refused once that round's reveal exists. Neither reads a clock. The
day is doing one job only, and it is a scheduling job: **it is what
advances the game when somebody does not play.** Replace that one job
and the calendar has nothing left to do.

## 0a · As built, 2026-09-08 — and where it differs from the plan below

Steps 0–3 landed on this branch the day the owner approved the model,
each green on its own. The plan below is left as written; this section
is the delta a reader needs, so the plan does not silently claim what
the tree does not do.

- **`played: { r7: [uid], r8: [uid] }`, not `roundPlayers`.** A single
  list for the open round could not hold an answer sealed ahead of it,
  and the lead allows five. The map is one blind `arrayUnion` on a
  nested path per answer, pruned to the new open round at each reveal
  (`prunePlayed`, pure.ts), so it is bounded by the lead times the
  roster. `roundKey` is unpadded (`r7`): nothing orders by id, history
  orders by `revealedAt`, and the rules build the answer id with
  `string(round)` — which step 0's emulator probe confirmed before
  anything was written against it.
- **The reveal-exists `exists()` is gone from the rules.** The reveal
  and the advance of `round` are ONE commit, so `round >= open` already
  says "no reveal exists for it". One billed rule read fewer per duel
  answer (`RULE_READS.duel` 3 → 2), not the same count the plan
  assumed.
- **The clock starts on the open round's FIRST answer**, not when the
  round opens. A round nobody plays never closes and never burns its
  question — which is what "round" means, and what the day did not do.
  The reveal starts the next round's clock at once when somebody has
  already sealed it ahead.
- **A 1v1 closes at the deadline for one player too** — the owner's
  rule applied to both surfaces, and it fixes a shape that was live: a
  partner who stopped playing used to seal the other's answer with no
  reveal, ever, while the calendar handed out fresh questions anyway.
- **Steps 2 and 3 shipped together.** Rounds with a two-hour delay
  before the reveal-on-completion would have been a 1v1 waiting on a
  schedule for an answer that had already landed — the day wearing a
  different clock — so the trigger's reveal went in with the model.
  The trigger's branch is one read now (`TRIGGER_READS.duel` 0 → 1).
- **The reveal reads `2 + 2m`, not `4 + 3m`.** The pre-read of every
  answer and the standalone reveal-exists get both became unnecessary
  once `played` sat on the group document; the tripwire in
  `scripts/pulse.test.mjs` counts the two sites that remain.
- **The clean cutover happened.** No dual-write period: the answer id,
  the reveal id and the rules moved together, and reveals written
  before rounds stay readable as history. This was available only
  because nothing real had played (§11's assumption, re-checked: the
  e2e is the only duel history the repo can see).
- **The scan is the deadline's executor.** `where("roundDeadlineAt",
  "<=", now)`, an indexed range; `pendingDays`, `PENDING_DAYS_KEEP`,
  `scanDays` and `shouldReveal` are gone with the day. And a missed
  scan now self-heals — a due round stays due — where the day's scan
  left unrevealed days behind forever (`DEPLOYMENT.md`'s alert section
  says both).
- **The card is truthful, not redesigned** (step 8 is the redesign): a
  1v1 says *Reveals when Ada plays — you're N rounds ahead*, a group
  counts to its deadline through `RevealClock`'s new `until`, and the
  volley's own line — *Round 7 sealed — waiting on Ada* — sits above
  the next prompt. No sentence names a cadence (D419 §3).
- **`test-users.mjs` plays rounds** (`play`, `reveal` = the forced
  lever, `history --rounds N`); `--day` is gone.

## 0 · The short version

| Item | Verdict | Backend half (D167) | The constraint that shapes it |
| --- | --- | --- | --- |
| **The round replaces the day** (§2) | build — schema, rules, rotation, client | `round` · `roundKey` · `roundPlayers` · `roundDeadlineAt` on `v2_groups/{gid}`; answer id `g_{gid}_r{n}` | The rules' two `timestamp.date()` clauses and the day regex go, one `get()`-deduped round bound arrives — the create rule gets **cheaper**, which matters on the path D409 measured |
| **A 1v1 reveals on the second answer** (§3) | build — the reveal moves into the answer trigger | `onV2AnswerCreated`'s duel branch gains 1 read; `revealGroupDay` → `revealRound`, otherwise unchanged | The branch's "one blind write, no read" (v2.ts) stops being true and the comment moves with it |
| **A group reveals when all have played, or at the deadline** (§3) | build — the owner's rule, 2026-09-08 | the 2-hourly scan queries `roundDeadlineAt <= now` instead of `pendingDays array-contains` | The deadline is what the day used to do; without it a stalled member freezes the group forever, which is *worse* than today |
| **A late answer is marked, and does not score** (§4) | build — the enforceable half of the owner's rule | `late: true` required by rules when the reveal exists; no `guessIdx` allowed with it | Reveals are world-readable (D98), so a straggler *can* read the table before answering — the rule makes the flag true rather than trusting the client |
| **The lead cap `K`** (§5) | **owner row — the recommendation is 5** | one constant shared by rules and client | Some bound must exist or a client writes `r999999` and pins the pair's rotation forever |
| **The bank** (§6) | build — a lane burst; and an owner row for world questions | the duel lane's cap and target; a rules widening for world-surface duel answers | 32 · 26 questions is one evening at rounds pace. `check:neighbors`, the voice and every farm hard rule are unchanged |
| **Reveal history by query** (§7.1) | build — a strict cost win, ships alone | one `orderBy("revealedAt","desc")` query replaces up to 14 day-key `getDoc`s | Round ids are not guessable, so the day-key fan-out cannot survive anyway. Reads both id shapes |
| **The ledger** (§7.2) | **already an owner row — rounds make it a dependency** | `ROLES-PLAN.md` §3.3, unchanged | A fortnight of reveals is the roles fold's substrate; rounds put hundreds of reveals in a fortnight |
| **Notifications: *your turn*, and the reveal, debounced** (§7.4) | build — the owner's ask, 2026-09-08 | one send site in the answer trigger, a per-recipient `pushAt` map on the group document, a third Android channel | **`web/privacy.html` moves first (D183)**: it names four notifications and this is a fifth; `check:policy-claims` holds the list and `check:figures` holds the count against the send sites, so the gates refuse the send until the page says it |
| **The screens** (§7.5) | visual request 11, then build | none | D352: the first-day screen's three beats are drawn against a clock that a 1v1 no longer has |

**Cost, measured** (`scripts/cost-arith.mjs`, 2026-09-08): at **8 rounds a
day** per user against today's 1, with the trigger's new read included,
the whole bill is **1.35×** — $180 → $244/month at 50 k DAU. §8 has the
table and what is in it.

## 1 · What makes it one a day, measured

Five things, and only the first two are load-bearing:

1. **The answer id is the day.** `g_{gid}_{day}`
   (`src/v2/data/live.ts`'s `voteDuel`), pinned by `firestore.rules`:
   `aid == "g_" + gid + "_" + day`. One sealed answer per person per
   group per UTC day, by construction.
2. **The rules bound the day to now** — back 4 days for an offline
   queue, forward 2 because UTC+14 is already tomorrow. Without that
   bound a member could pre-seal every future day.
3. **The question is a function of the day.** `duelQFor`
   (`src/v2/data/deck.ts`) is `bank[(hash(gid) + utcDay) % len]`,
   computed on every device with no server chooser.
4. **The reveal is a scan of yesterday.** `scheduledDuelReveals`, every
   120 minutes, over `where("pendingDays","array-contains", yesterday)`.
   A 1v1 reveals both-or-nothing; a group on one answer or more.
5. **Everything downstream keys on days** — the card's day dots,
   `REVEAL_HIST_DAYS = 14` day-key `getDoc`s behind the roles fold, the
   streak's `lastRevealDay` adjacency, the Groups stop.

**What is NOT on that list is the seal.** `isDuelAnswer` refuses a
create when `exists(.../reveals/$(day))`, and the answer document is
excluded from D98's public read by a `surface` value test. Both are
statements about *this round*, not about *today*.

## 2 · The round

### 2.1 · What is written

On `v2_groups/{gid}`, all four server-written:

    round: 7                          the open round. Absent = 1
    roundKey: "r0007"                 the id half, zero-padded
    roundPlayers: [uid, …]            who has answered the open round
    roundDeadlineAt: timestamp        when it closes regardless

The answer id becomes `g_{gid}_r{n}`, and the answer carries `round`
instead of `day`. Everything else in the payload — `qid`, `surface`,
`optionIdx`, `guessIdx`, `pickUid`, `anchors` — is unchanged, so D8's
anchor snapshot, D86's frozen edit surface and D224's pick snapshot all
hold verbatim.

`duelQFor` takes the round where it took `utcDayIndex`. It stays the same
pure function on every device with no server chooser, so D70's plurality
`revealQid` still names the question a drifted client did not play.

### 2.2 · The rules

Three clauses go — the `day.matches()` regex and both
`timestamp.date(...)` comparisons — and one arrives:

    request.resource.data.round >= groupRound()
      && request.resource.data.round < groupRound() + ROUND_LEAD

`groupRound()` reads the same group document `isDuelAnswer` already
fetches for membership, and repeated `get()`s on one path are deduped
within an evaluation, so **it costs no extra read**. The create rule ends
up with fewer expressions than it has today, which is the direction the
answer path wants after D409.

> **Verify before building** (house rule — verify rather than assume, and
> say which it was): the id comparison wants
> `aid == "g_" + gid + "_r" + string(round)`. `int()` is used 20 times in
> `firestore.rules`, so the conversion family is present, but `string()`
> is **not used anywhere in this tree** and has not been probed here. If
> it is unavailable, the fallback needs no conversion at all: the answer
> carries `roundKey` as a zero-padded string, the rule compares it to the
> group's own `roundKey`, and zero-padded keys compare lexically exactly
> as they compare numerically. Step 0 of §11 is that probe.

### 2.3 · Who advances the round

The server, inside the reveal transaction that already writes `streak`,
`lastRevealDay` and `pendingDays` on the group document. The reveal
publishes round *n* and opens round *n+1* in the same commit, so the two
cannot drift. A group with no `round` field is round 1, which makes a
fresh group forward-compatible with no migration step.

### 2.4 · What `roundPlayers` buys, beyond the reveal condition

It closes an honest gap D156 §2 recorded as unclosable: *"Nobody can say
who else has played today… A duel answer is sealed until the reveal, so
no device knows."* The prototype dims the avatars of members who have not
answered, and the live card cannot, so it draws every member undimmed and
claims nothing.

`roundPlayers` is who has answered — never what they answered — on a
document members already read. It is strictly less than the reveal shows,
one round later. So the dimmed avatars become drawable honestly, and the
card can finally say *waiting on Ada* instead of nothing.

**Named as a deliberate new disclosure rather than slipped in**: it tells
a group "X has played" before the reveal, which nothing in the app says
today. It is not a D334 ask — it exposes strictly less than the reveal it
precedes, to strictly the same people — but it is the owner's to veto,
and §10 carries the row.

## 3 · The reveal, and the three conditions

| Surface | Reveals when | Who publishes it |
| --- | --- | --- |
| **1v1** | the second answer lands | `onV2AnswerCreated`, in the same second |
| **Group** | every member has answered | `onV2AnswerCreated`, in the same second |
| **Either** | the deadline passes, for those who played | the 2-hourly scan |

**The deadline is not a nicety, it is the day's replacement.** Today the
calendar advances whatever anybody does: a partner who never plays costs
you the reveal, and tomorrow hands you a fresh question anyway. Under
rounds, if nothing closes a stalled round, the pair is frozen on it
forever — strictly worse than today. So the deadline is what makes rounds
safe, and it also fixes a shape that is live today: a 1v1 where one side
stops playing currently seals the other's answer with no reveal, ever.

### 3.1 · Reveal-on-complete, and what it costs

The duel branch of `onV2AnswerCreated` today is one blind `arrayUnion`
with no read, and its comment says so with some pride. It becomes:
`arrayUnion(uid)` into `roundPlayers`, then one `get()` of the group
document to ask whether the round is now complete. **One read per duel
answer** — the cost line in §8 carries it.

The alternative shapes were considered and are worse: counting the
members' answer documents is *m* reads per answer (144 per completed
round in a group of twelve, against the reveal's own 4 + 3m = 40), and a
numeric counter on the group document is a contention point that
`arrayUnion` is not.

Two members answering at once both try to reveal. That race is already
handled: the reveal is a `tx.create()` and the loser bails on
`existing.exists`. Nothing new is needed.

### 3.2 · The scan

`where("roundDeadlineAt", "<=", now)`, ordered and paginated — an
indexed range query, served by the automatic single-field index, in place
of the `array-contains` on `pendingDays`. It finds only groups whose
round is actually due, so the "scanned but revealed nothing" reads that
dominate today's duo shape go away.

`GROUP_SCAN_CAP`'s tripwire, the five lanes, the per-group `try/catch`
and the heartbeat log with its `mode` field all stay exactly as they are.

## 4 · The late answer — the owner's rule, made enforceable

> *"revels when everyone played or if not everyone has played it gets
> reveld for the once that played at the deadline the remainders after
> they have answard."* — the owner, 2026-09-08.

The first half is §3. The second half has a problem the rules must solve
rather than the UI: **a reveal is world-readable (D98)**, so a member who
has not played can read the table before answering. Hiding it in the app
would be a claim the rules do not make, which is the one thing
`CLAUDE.md` says never to ship.

**The shape that keeps the owner's rule and stays honest.** At the
deadline the reveal publishes with whoever played. A member who has not
played may still answer that round, and:

- the answer carries **`late: true`**, and the rules **require** the flag
  when the reveal exists — so a client cannot pass a late answer off as a
  blind one, and the flag is true because the rule made it true;
- it may **not** carry `guessIdx`. A guess made with the table visible is
  not a reading of anyone, and refusing the field removes the whole class
  of score-gaming rather than filtering it downstream;
- the server appends it to the reveal, so the group sees it, marked;
- it is **excluded from every score**: the roles fold's dims, the ledger,
  and the cross-group `duel-{qid}` aggregate. It is included in the
  display, because a member who answered belongs in their group's reveal
  — D70's rule, one surface over.

The exclusion is D386's `asides` pattern reused: a reading the tables
cannot honestly take becomes a row, not a petal.

**What this costs:** `tx.create(revealRef, …)` gains a guarded
server-only append path, so D5's "materialized once" softens to
"materialized once, appended only by the server, only for a flagged late
answer". The read rule (`allow write: if false`) is untouched.

**The alternative, priced and rejected:** gate the reveal read on having
answered. It retreats from D98's public reveals, and it puts a `get()` on
a read path that has none today — a billed read on every reveal open, for
every member, forever.

## 5 · The lead cap — the reflection

**The question:** when your partner has not played round *n* yet, how many
rounds ahead may you go?

Some bound has to exist regardless of taste: without one a client writes
`round: 999999`, and since `duelQFor` is a function of the round, that
pins which question every future round serves.

**K = 1, a strict volley.** You answer, then you are blocked until they
play. This is the one-a-day problem wearing a different clock — worse in
some ways, because a day at least ends on its own. Across two time zones
it means one exchange a day. Rejected.

**K unlimited.** One person burns the whole bank alone; the other opens
the app to two hundred rounds waiting, which is a chore rather than a
game. It also skews the ledger and pins the pair's rotation for hundreds
of rounds against one client's cached bank. Rejected.

**K in the range 3–5.** Enough for one sitting: you play a handful, they
catch up later and get a run of reveals in one go, which is a good moment
rather than a backlog. The game stays a volley measured over a day
instead of a turn.

The sizing principle worth stating: **a lead is only worth anything if the
partner catches up**, so K should be "one sitting", not "one week". A
lead of five that never gets answered is five dead sealed answers.

**Recommendation: K = 5**, one constant shared by the rules and the
client, with the card saying what is waiting when you reach it. In a
group the lead is over the group's open round and the deadline throttles
it anyway, so one constant serves both.

**The part that matters more than the number:** today's limit is
structural — the calendar, unchangeable without this whole plan. K is a
number in one file. Rounds do not merely raise the limit; they turn it
into a dial the owner can move in a line.

## 6 · The bank — the real constraint

Counted 2026-09-08 from `content/duel-questions.json`:

| Pool | Questions | Notes |
| --- | --- | --- |
| `oneVsOne` | 32 | domains `day` 12 · `mirror` 11 · `heat` 9 (D386) |
| `romantic` | 24 | dark — `active: false` until an operator lights it |
| `group` | 26 | kinds `us` 12 · `pick` 8 · classic 6 |

**A pair at rounds pace burns the 1v1 pool in one evening.** The lane's
regulator grants 4 a run, weekly, toward 48 a pool
(`scripts/duel-budget.mjs`) — an arithmetic built for one question a day
and meaningless at this pace. Two sources, and they are not exclusive.

### 6.1 · A lane burst

A scheduling change, not a quality change: every farm hard rule, the
`check:neighbors` dedup under 0.5, the voice and the single-gate review
are unchanged and still apply per question. Raise the pool target and
the per-run cap, run the lane daily for a period, then let it fall back.
At a target of 400 a pool and 25 a run, daily, both pools reach 400 in
about sixteen runs.

### 6.2 · World questions as duel content — the one that serves the axiom

Counted from the shipped banks: **134 daily** and **333 feed** questions,
of which **245 are `vote`-shaped** with two or more options. That is an
order of magnitude more duel content than the duel pools hold, already
written, already reviewed, already cached on the device.

It is also the strongest form of the app's own thesis. A 1v1 round over a
world question reveals **three columns: your answer, their answer, and
the world's split** — and the third costs zero extra reads, because the
client already holds that aggregate. Nothing else on the roadmap draws a
link between a pair and a population on one card.

For the ties axiom (`AXIOMS.md`, operational) it is the difference
between a thin instrument and a real one: `tie-2`'s decomposition of a
guess into perceiver, target and relationship variance needs many shared
items per pair, and 32 questions cannot supply them.

**What has to change, and the trap in it.** `isDuelAnswer` requires the
question's `surface` to equal the answer's `"group"`/`"duo"`. That
equality is load-bearing and the rules file says why: without it a group
could seal a vote against a **catalog** question, whose `options` are
empty, so `duelIndexSpace()` falls through to the member count and the
vote is folded as if it were a member pick. So the widening cannot be a
relaxation — it must be an explicit second arm requiring a world surface
**and** `options.size() > 0`, which keeps the catalog hole shut.

Three things that need no change at all, checked: the answer id
`g_{gid}_r{n}` cannot collide with the world answer `{qid}`; duel answers
are short-circuited out of world aggregates by `surface` in the trigger,
so the world's counts stay honest; and a world question lands in the
roles fold as an ordinary day, since it carries no 1v1 domain tag.

**One refinement, with its cost:** do not serve a question the partner has
already answered in public, or the guess is a lookup rather than a
reading. Since D98 their answers are readable and `data/circle.ts`
already fetches a member's answers — one capped query per pair per
session buys the exclusion set. Worth it; not a blocker, and not free.

This is an owner row (§10): it changes what a 1v1 *is*.

## 7 · What the round changes downstream

### 7.1 · Reveal history — a strict win

Today: up to `REVEAL_HIST_DAYS` = 14 day-key `getDoc`s per group per
session, which D156 §2 already flags (*"for someone with three circles,
that is forty documents to look at today's question"*). Round ids are not
guessable, so that fan-out cannot survive rounds anyway.

It becomes **one** `orderBy("revealedAt","desc").limit(N)` query. Both id
shapes carry `revealedAt`, so it reads the day-keyed history and the
round-keyed history in the same result, and it stops paying for days that
do not exist. The reveal read rule is `allow read: if request.auth !=
null` with no field conditions, so a list query is already permitted.

**Ships alone, before anything else here.** It is a win with or without
rounds.

### 7.2 · The ledger stops being optional

`ROLES-PLAN.md` §3.3 proposes a per-member ledger the reveal writes, so a
role outlives the fortnight of reveals a device can read. It is an open
owner row today and the plan's own argument for it is about *time*.

Rounds change the argument to *volume*: a fortnight can now hold hundreds
of reveals, and the device cannot fold what it cannot fetch. Under rounds
the ledger is the substrate, not an improvement to one. The existing row
gains this as a reason; no new row.

### 7.3 · The streak stays a day

`nextStreak` extends on day adjacency and `movesPresentState` requires a
strictly newer day, so the second reveal of a day does not move it.
**That works unchanged** — the reveal passes the calendar day it landed
on. A streak is about coming back, and days are what measure that; rounds
measure something else and should not be spent on it.

### 7.4 · Notifications — the volley's other half

> *"should we have notification connectod to this as well?"* — the owner,
> 2026-09-08. Yes, and rounds are where a notification starts earning
> its place: a volley with no nudge is a game where nobody knows it is
> their move.

**What exists.** One class about play, sent once a day by the reveal scan
— *"Yesterday's answers are out — see if you called it"* — on the Android
channel `reveals`, plus three about membership on `invites` (D236, D240).
The tap lands on the room (`data/push.ts` stashes the gid). The privacy
page names all four by kind, and `check:policy-claims` holds that list.

**What rounds add: one send site, two messages.** When a member's answer
lands, the trigger already knows who else is in the room and who has
played (`roundPlayers`). For each *other* member it sends one of:

| They have… | Message | Channel |
| --- | --- | --- |
| not answered this round | *Leo answered — your turn.* | `turns` (new) |
| answered, so the round just revealed | *Leo answered — see if you called it.* | `reveals` |

In a 1v1 the two are exclusive per person per round, so it is always
exactly one push to exactly one person. In a group the reveal fires once
per round to everyone, and *your turn* fires **once per round per
member**, not once per answer — a room of thirty-one is not told
thirty-one times that Ada played. The cleanest carrier is the reveal
itself: *"Round 6 is out — and round 7 is waiting for you"* is one push
doing both jobs, because opening the next round is the same commit.

**Debounced per recipient, not per group.** A partner who plays five
rounds ahead would send five *your turn*s. One `pushAt: { uid: ts }` map
on the group document — already inside the reveal transaction, at most
32 entries — holds it to one push per recipient per window, the body
naming the count: *Leo played 4 rounds — your turn.* Per recipient
rather than per group, because a single group-wide stamp would let one
active partner silence the other's legitimate nudge.

**A third channel, with its reason.** *Your turn* is a nudge; *revealed*
is a result. A person who mutes nudges should keep results, and Android's
channel is the only control the OS gives them (`push.ts`'s own argument
for the second channel, one channel over). So `turns` — *"When it's your
turn in a 1v1 or group"* — at importance 3, default rather than heads-up:
a nudge should not pop over what you are doing, while the reveal keeps
its 4. iOS has no channels, only the one permission, which is asked at
the moment a reveal first becomes possible and does not move.

**The foreground case is unhandled today and matters more at eight a
day.** Nothing in `push.ts` registers `pushNotificationReceived`, and
`capacitor.config` sets iOS `presentationOptions` to badge, sound and
alert — so a reveal push arriving while the app is open is shown as an
alert over the app, today, on iOS (checked, not assumed). At one a day
that is a curiosity; at eight it is the app buzzing about a card you are
looking at. The client suppresses
presentation when the room is on screen — a listener, not a server
change, and it is the same fix for the reveal push that exists.

**The privacy page moves first (D183), and the gates make sure of it.**
`web/privacy.html` says the token is used for *"the four notifications
this app sends"* and names them, with the reveal as *"your group's day
has been revealed"*. This is a fifth, and *day* becomes *round*.
`check:policy-claims` holds the named list and `check:figures` holds the
count against `v2social.ts`'s send sites — so a new `sendPushToUids`
call with the page unchanged fails two gates. That is the order the
build takes: page, then send.

**Cost.** `sendPushToUids` reads one push document per recipient per
send, and FCM is free. Debounced, that is at most one read per active
recipient per window — a rounding error beside §8's table. The monitoring
heartbeat on the scan (`monitoring/scheduledDuelReveals-silent.json`)
survives: the scan still runs for group deadlines and still logs
`mode: "indexed"`, so the absence alert keeps meaning what it means.

### 7.5 · The screens

`VISION-2026-09-07.md` §3 draws the first day as three beats — *Today ·
sealed*, *Tonight* (the reveal clock), *Tomorrow · revealed*. Under
rounds a 1v1 has no clock: it reveals **when they play**. The group keeps
a clock, and it is now the deadline rather than midnight.

The card's states change with it — *your turn* / *their turn* / *N rounds
waiting for you* is a different grammar from *answered · reveals in
04:12*. That is a visual, so it is request 11 in `VISUAL-REQUESTS.md`
under D352, not a thing a routine draws on its own.

### 7.6 · Takes — one thread per question, and rounds can repeat one

`v2_takes` is keyed by group and question. Two rounds on the same
question in the same group would share one thread, so a comment made
months apart lands under today's reveal. Rare once the bank is large, and
wrong when it happens. Named rather than fixed: the fix is to key a
circle take by round, which is a document id change and a rules change,
and it should not ride the same step as the round model. **Not measured
in detail** — the take id shape wants reading before this is costed.

## 8 · What it costs

Measured with the repo's own model (`scripts/cost-arith.mjs`,
2026-09-08), varying `B.duelAnswers` and setting `TRIGGER_READS.duel` to
1 for the completeness read §3.1 adds:

| Duel answers per user per day | 500 DAU | 5 k | 50 k | 500 k |
| --- | --- | --- | --- | --- |
| **1 — today** | $1 | $16 | $180 | $1,841 |
| **4 — rounds** | $1 (1.16×) | $18 | $208 | $2,129 |
| **8 — rounds** | $1 (1.40×) | $22 | **$244 (1.35×)** | $2,506 |
| **16 — rounds** | $2 | $29 | $319 (1.77×) | $3,260 |

**Eight rounds a day costs 1.35× the whole bill.** It is not free and the
plan does not claim it is; it is also nowhere near the 8× that "eight
times the play" suggests, because a duel answer is cheap next to the
world answers and the D98 social reads that dominate every column.

Three things the table does not capture, all pointing the same way:
reveal history goes from 14 reads to 1 query (§7.1); the scan stops
paying for groups that played nothing; and a 1v1's reveal stops waiting
on a scan at all.

## 9 · A vocabulary collision, found on the way

The owner flagged it on 2026-09-08: *"i notice you use circle insted of
group and thats wrong… circle is something else in the app."* That is
correct, and the tree has the collision too.

- **Circle** is the Mirror's stop over the **follow graph** — D101, the
  accounts you follow, `data/circle.ts`, `MIRROR.md` §143.
- **Groups** is the Mirror's stop over the **named duel rooms** —
  `groupPortrait.ts`, reveal history.
- But `ui/LiveDuelPanel.tsx` calls a duel room a *circle* throughout its
  copy and its comments, and so does the 2026-09-07 design (*"the first
  day of Circle and 1v1"*).

So the app has two different things called Circle on two different tabs,
and the Mirror is the one that is right. **Not fixed here, deliberately**
— a copy rename across the duel panel, the design vocabulary and
`check:public-copy`'s expectations is its own change with its own gate,
and burying it inside the round model would make both harder to review.
Recorded so it is a known collision rather than a recurring surprise, and
this document says **group** and **1v1** throughout.

## 10 · The owner items this plan creates

Each is also a row in `OWNER-LIST.md`. None of them is a privacy ask
under D334 — the same people see the same votes, one round later instead
of one day later — so they are product calls. **The owner answered all
four on 2026-09-08** — *"yeah lets do that"*, to the model explained in
plain words, which named each of them — and the ticks stay the owner's
to make (D352).

1. **The lead cap `K`** — §5. The recommendation is 5. A number is enough.
2. **Late answers do not score** — §4. Your rule says the remainder see
   the table after they answer; this is what makes that honest, since a
   reveal is world-readable and their answer is therefore not blind. The
   answer still shows in the reveal, marked. Confirm or overrule.
3. **World questions as duel content** — §6.2. It changes what a 1v1 is,
   it multiplies the bank by an order of magnitude, it draws pair against
   population on one card, and it is what the ties axiom needs.
4. **`roundPlayers` says who has played** — §2.4. Strictly less than the
   reveal shows, to the same people, one round earlier; it is what lets
   the card dim the avatars honestly. Yours to veto.
5. **The ledger** — already open under the 1v1-and-group-profile row.
   Rounds change it from an improvement to a dependency (§7.2).

## 11 · Sequencing

Each step is shippable and green on its own.

0. **Probe the rules conversion** (§2.2) — **done 2026-09-08**:
   `string(int)` resolves, and the zero-padded fallback also works.
1. **Reveal history by query** (§7.1) — **built 2026-09-08**.
2. **The round model** (§2, §3.2) — **built 2026-09-08**, with step 3.
3. **Reveal on the completing answer** (§3.1) — **built 2026-09-08**.
4. **The late answer** (§4) — **built 2026-09-08**: the flag required
   by the rules on a revealed round inside the lead, no guess with it, the
   trigger's append to the reveal (member and name added with it), every
   fold skipping it, the card's own row and door.
5. **Notifications** (§7.4) — `web/privacy.html` first (a fifth kind,
   and *day* → *round*), then the `turns` channel, the send in the
   trigger, the per-recipient debounce, the foreground suppression.
6. **The bank burst** (§6.1) — a lane change, runs in parallel with
   everything above.
7. **World questions in duels** (§6.2) — owner row first, then the rules
   arm, the pool, the exclusion query and the reveal's third column.
8. **The screens** (§7.5) — visual request 11: plan, draft, the owner's
   refinement, extraction, then build.

**A note on migration, and the assumption under it.** Steps 2 and 3 are
written as a clean cutover with no dual-write period: rounds replace
days, old day-keyed reveals stay readable as history, and no client ever
writes both shapes. That is available **only because the app is
pre-launch** — D386 says of the role cards that "few exist (pre-launch
builds)", and D5's amendment reasons production's duel-answer set to
provably empty. **Re-check both before step 2.** If real groups are
playing by then, the same steps need a transition window in which the
rules accept both id shapes, and that is a materially bigger change.

## 12 · The gate each step must pass

| Step | Gate | What it must prove |
| --- | --- | --- |
| 0 | a rules probe in the emulator | `string()` resolves, or the zero-padded fallback is the shape |
| 1 | `npm run test:unit`, `npm run test:rules` | one query, both id shapes returned, no per-day fan-out; the list read is permitted |
| 2 | `npm run test:rules`, `npm run test --prefix functions`, `npm run test:e2e:all`, `npm run check:globals` | the lead bound refuses `open + K`; the id is pinned to the round; a non-member is still refused; the deadline scan finds only due groups |
| 3 | `npm run test --prefix functions`, `npm run test:e2e:all` | a 1v1 reveals on the second answer; two simultaneous answers reveal exactly once; a group of *m* reveals on the *m*th |
| 4 | `npm run test:rules`, `npm run test --prefix functions` | an unflagged answer after the reveal is REFUSED; a late answer with `guessIdx` is refused; a late answer moves no dim, no ledger figure and no `duel-{qid}` count |
| 5 | `npm run check:policy-claims`, `npm run check:figures`, `npm run test --prefix functions`, `npm run test:unit` | the page names five kinds before the fifth send exists; five rounds in a window send one push naming five; the partner who has answered gets the reveal and the one who has not gets *your turn*, never both; a group member is nudged once per round |
| 6 | `npm run check:content`, `check:neighbors`, `check:figures` | the dedup floor holds across a burst; the budget script's numbers match its prose |
| 7 | `npm run test:rules`, `npm run test:unit` | a catalog question is still refused on a duel surface; the world split on the reveal costs no extra read |
| 8 | `npm run test:unit`, `check:a11y`, `check:tap-targets`, `check:public-copy` | the 1v1 draws no clock; the group's clock is the deadline; no cadence word in copy (D419 §3) |

## 13 · What this plan does not decide

- **Whether the streak should count rounds** rather than days (§7.3
  keeps days, with the reason).
- **The takes thread per round** (§7.6) — named, not costed.
- **The vocabulary rename** (§9) — recorded, deliberately out of scope.
- **Anything about who may read what.** No rule in this plan changes an
  audience: the same people see the same votes, one round later instead
  of one day later. The three denies stand at their paths, D98 is
  untouched, and D5's seal is enforced by the same two clauses it is
  enforced by today.
