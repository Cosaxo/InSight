# The 1v1 and group profile — the plan

**Status: plan notes — §5's steps 1 and 2 are built (D381, 2026-09-06,
the owner's *"yes build the first two steps"*); the rest proposes.** Written
2026-09-06 on the owner's ask of that day — *"how could we make the 1v1
and groups profile better, and check if you want to improve the
questions that decide what type, and if you want to change anything
about the types — assume you have full creative freedom."* §2 is
measured, by `scripts/roles-probe.mjs` against the shipped tables, and
re-runs in seconds; everything after it is a proposal. The instrument
change is the owner's call and sits on [`OWNER-LIST.md`](OWNER-LIST.md)
§ Decisions; the two screens it needs are requests 5 and 6 in
[`VISUAL-REQUESTS.md`](VISUAL-REQUESTS.md). D204 stays binding until a
record adopts this.

## 0 · In one screen

**What exists.** The profile's Roles tab (D204): the role you play in a
1v1 and in a group, each read as an instrument — four dims for a 1v1
(Insight · Legibility · Likeness · Steadiness), three for a group
(Independence · Centrality · Steadiness) — folded from the reveal
documents the duel panel already fetches, over the last fortnight, and
matched to one of ten 1v1 types or six group types by the same matcher
every test uses.

**What is wrong, measured (§2).**

- A fortnight cannot hold a name: at 14 days the match is a tie for
  over half of records, and one more day changes the name for one in
  six or seven.
- The group instrument is one axis wearing three labels: its dims
  correlate at −0.7 to −0.9, so after a fortnight four in five members
  are "The Quiet Majority" and a member who genuinely votes alone is
  called that too.
- Steadiness — a dim in both instruments and the definition of two of
  the 1v1 types — measures how long you have played, not who you are.
- The days are not all the same day: a "mirror" day (what word fits
  *them*) is folded as if it measured likeness and reading, a 2-option
  day counts like a 4-option day, and a pick day's 8 options like a
  classic's 2.
- A role card is missing what every result card has — the rule line,
  the runner-up, the rarity — and nothing draws the pair's own type or
  the group's cast, though both fold from data already on the phone.

**What this proposes (§3).** Three objects instead of one — the pair's
reading, your role across pairs, and your role in a group (the ties
lane's tie-1); every rate on one chance-scaled scale; a per-member
ledger the reveal writes so the record outlives the fortnight; new
tables written in full below, with two dims that are new and honest —
*Projection* (do you guess yourself?) for a 1v1 and *Reading the room*
for a group, the latter one tap and no backend; *Standing* from the
pick days D224 made safe, and *Presence* from the reveal's own roster;
a name only when the gap says so; the 1v1 questions' domain tag carried
into the seed so a mirror day is folded as what it is; and the cast —
every member's role in a group, drawn.

**What it costs.** Zero new reads on every step; one map on a document
already written; one more tap per group day; a design pass for two
screens.

## 1 · What exists, verified

- **The instrument** — `src/v2/data/roles.ts`: `duoRole` reads
  `duoRuns` (D156; a day counts only when both guessed the same
  question), `groupRole` reads `groupPortrait`; `blendRoles` averages
  settings weighted by their days. Floors `MIN_DUO` 3 days both
  guessed, `MIN_GROUP` 2 days played. `steadiness` is one minus the
  flip rate of a boolean run.
- **The tables** — `src/v2/spec/archetype-data.js`, `duo` (10 types)
  and `group` (6 — nine in the prototype, three dropped with the `cast`
  dim D204 refused as a dead axis). Baselines in
  `src/v2/spec/test-definitions.js` `IS_TEST_AVG` — authored, and
  deliberately so (D157's rule: which type you ARE must not drift with
  whoever the app fetched). `IS_archScores` weights each dim by
  |sig − 50| and taxes rare types by log(maxShare/share).
- **The panel** — `src/v2/ui/LiveRolesPanel.tsx`: per setting the
  average rose, the name, the line, the day count; one row per setting
  with receipts on tap; thin rows for settings under the floor. The ⓘ
  opens `spec/explain-sheet.jsx`'s `duo`/`group` entries. Live only.
- **The record** — `v2_groups/{gid}/reveals/{day}` (`SCHEMA-V2.md`):
  `votes { uid: { optionIdx, guessIdx?, pickUid? } }`, `members[]` (who
  was in the group ON that day), readable by any signed-in user (D98).
  The client reads the last `REVEAL_HIST_DAYS` = 14 of them per room
  (`live.ts`; `COSTS.md`'s Roles row) — so a role is a fortnight's
  reading, and the run of dots is the only thing that shows the days.
- **The questions** — `content/duel-questions.json`: 26 group (kinds
  `us` · `pick` · `classic`, interleaved in rotation order), 32 friends
  1v1 and 24 romantic 1v1 (dark: `active: false`, D40 part 4). Every
  1v1 entry carries a domain `d` — `day` (everyday), `heat` (under
  pressure), `mirror` (a read of the other person: *"The word that fits
  them best?"*), `ahead` (the future, romantic only) — which the demo
  layer uses (`duels-data.js` `domainRows`) and the seed drops
  (`scripts/gen-v2content.mjs` emits `topic: null` for the duo surface).
  The scorecard's duel section has scored nothing yet — no duo has
  played on the live signal (`content/scorecard.json`, `npm run
  duel:budget`).
- **Around it** — the group's People tab names your twin and who
  breaks ranks (`groupPortrait`, D277); the demo person overlay draws a
  pair type from the shared record (`poPersonTypes`, D310) and nothing
  draws one on a live device; the ties theory lane (D347, tie-1 … tie-7
  on `axiom-theory`) names the guess as a key-scored second-person
  measurement, knowledge against projection (Cronbach), picks as
  nominations (Moreno), and the tie as the unit.

## 2 · What is wrong, measured

`node scripts/roles-probe.mjs` draws pairs and groups with plausible
true rates, plays them for *n* days, folds the days exactly as
`roles.ts` does, and hands the dims to the shipped matcher. The spread
of true rates is authored — nothing live has scored — so each
instrument is run under two models and only findings that survive both
are quoted. Measured 2026-09-06; the script prints the full tables.

### 2.1 A fortnight cannot hold a name

| 1v1 record | the match is a tie (`gap` < 5 rms — the matcher's own "effectively a tie") | one more day changes the name |
| --- | --- | --- |
| 3 days (the floor) | 47–49% | 41–44% |
| 7 days | 58–62% | 24–27% |
| 14 days (the whole window) | 58–65% | 15–17% |
| 30 days (needs §3.3) | 60–72% | 8–10% |

The name on the card is a coin toss at the floor and still flips every
sixth or seventh day at the window's full depth. The matcher computes
the gap and the runner-up on every call (`IS_matchArchetype` returns
both) and the panel reads neither.

### 2.2 The group instrument is one axis

Independence is the share of days you land away from the majority;
Centrality is how often others land where you land; Steadiness is the
flip rate of the first. On simulated groups of four and six, r(own,
pull) is −0.74 to −0.84 and r(own, settle) is −0.64 to −0.91, at every
depth, under both priors. Three dims that move together are one dim,
and a table of six types over one dim cannot spread:

| group record, six members | Quiet Majority | Anchor | Wildcard | Contrarian + Bellwether + Outlier |
| --- | --- | --- | --- | --- |
| 2 days (the floor) | 32% | 30–34% | 30–32% | 5–6% |
| 14 days | 79–83% | 8–10% | 7% | 1–3% |
| 30 days | 88–91% | 4–5% | 3–5% | 1–2% |

At the floor the name is a three-way coin toss; after a fortnight
everyone is The Quiet Majority — including the members whose true
conformity is 0.3, who land there 67–86% of the time. The Bellwether
(*"vote with you and you vote with everyone"*, defined by pull 92) is
the Anchor's twin and is picked for 0–4% of records at any depth.

### 2.3 Steadiness measures how long you have played

The Wildcard (steady 8) takes 22% of three-day pairs and 2–3% of
thirty-day pairs; The Steady Hand (steady 94) goes 15–19% → 6–7%. A
boolean run's flip rate at 60–70% accuracy is a coin, and the coin
settles as *n* grows; the two types are reading *n*. In the group
table the Wildcard (settle 8) behaves the same way (25–32% → 1–5%).

### 2.4 The days are not all the same day

- **Mirror days.** Eleven of the 32 friends questions ask for a read
  of the *other* person (*"Their best quality, in one word?"*). Both
  answer about the other; the guess is what they said about *you*.
  A hit there is knowing how you are seen — a different measurement
  (the lane's tie-2 would call it metaperception) — and the fold
  counts it as reading their preferences. Worse, Likeness counts the
  day: the same answer on a mirror day means you each picked "Warm"
  about the other, which says nothing about being alike. The tag that
  would tell the fold is in the source file and not in the seed.
- **Chance.** Thirteen of the 32 friends questions have two options;
  eleven have four. A guess on a two-option day is right half the time
  by luck, a quarter on a four-option day, and a pick day in a group
  of eight lands one in eight. Every rate in `roles.ts` is a raw hit
  rate, so a pair whose rotation happened to serve binary days reads
  each other "better", and Independence in a group of eight on a pick
  day is near-certain for a reason that is not the person.
- **Picks.** A pick day's "with the majority" is a nomination
  consensus — legitimate, but it is the day that carries the group's
  reading of a *member*, and nothing folds that half (D204's `cast`).
  Since D224 every pick answer snapshots the uid it meant, so the fold
  is arithmetic now; what it lacks is a floor and a table.

### 2.5 A role card is missing what every result card has

`result-card.jsx` draws the rule that earns the name
(`IS_typeRuleParts` — *"very reading + unreadable"*), the two types you
nearly were with why (`IS_nearWhy`), and how far from the average
person you sit (`IS_profileRarity`). The Roles panel draws none. The
nearly-words exist for both instruments (`IS_DIM_WORD`); the rule
words do not (`IS_RULE_WORD` and `IS_RULE_ADJ` have no `duo` or `group`
entry, so the rule line would read *high insight* rather than
*reading*).

### 2.6 What nobody draws

- The pair's own reading. Half the 1v1 types describe the *pair* (The
  Twin, The Opposite, The Two-Way, The Stranger) and half describe *you
  in it* (The Mind Reader, The Open Book, The Poker Face, The Watcher);
  the blend across pairs then averages pair facts into a person. On a
  live device the pair's type is drawn nowhere — the daily card shows
  the two runs, the person overlay's pair type is demo data.
- The cast. `groupRole` answers for any uid, from the same reveals;
  every member's role in this group is one loop away and no screen
  runs it. The prototype's `group-role-map.jsx` drew exactly this shape
  from a scenario generator; the real version has had a source since
  D224.
- Your role in the *other* direction: a person's page could say what
  they are in the pairs and groups you share, from the record you both
  already see (D310 built this on demo data only).

## 3 · The redesign

### 3.1 Three objects, not one (tie-1)

A tie has three readings and they are not the same number: the pair
between the two of you, you across the pairs you hold, and you inside
one group. Today one table serves the first two and a blend confuses
them. The proposal is three instruments, each matched by the same
matcher, each with its own table:

| object | dims | where it draws | floor |
| --- | --- | --- | --- |
| **the pair** (`duoPair`) | Likeness · Mutual reading · Lean (who does the reading) | the 1v1 card's done state; the person's page; one row per pair on your Roles tab | 4 days both guessed |
| **you, across pairs** (`duo`) | Insight · Legibility · Projection | your Roles tab, above the rows | 6 days both guessed, across any pairs |
| **you, in a group** (`group`) | Independence · Reading the room · Standing · Presence | your Roles tab; the group's cast (§3.8) | 3 days played; Standing 3 pick days with snapshots; Reading the room 3 guessed days |

Steadiness leaves both instruments (§2.3); the runs of dots keep
showing the shape of the days, which is what D156 built them for. The
group's Centrality leaves as a dim (it is one minus Independence,
§2.2) and stays as a receipt line — *others landed with you 31 of 40
times* is a true sentence.

### 3.2 One scale for every rate

Every dim that is a hit rate — a guess, a same answer, a majority, a
nomination — is scored per day against what luck would have got on
that day's options, then averaged: a hit counts 1, a miss counts
−1/(k−1) for a day with *k* options (the bank's options, or the roster
on a pick day), and the mean lands on 0–100 as 50 + 50·mean. **50 is
guessing at random, 100 is right every day**, on a two-option day and
an eight-option day alike. Standing uses the same shape against 1/m
for a group of *m*; Presence is a plain share and stays one.

The baselines below are authored on that scale, like every baseline in
`IS_TEST_AVG` and for D157's reason; re-authoring them from the first
real fold is a one-line change and its own note. **Done at D381** for
the tables that exist: `duo` 70 · 70 · 64 · 58 and `group` 24 · 70 ·
58, the arithmetic beside them in `test-definitions.js`.

### 3.3 The record outlives the fortnight: the ledger

A role read over 14 days is §2.1's coin. The fix is not more reads —
14 per room is already `COSTS.md`'s Roles row — but a fold the server
keeps as it goes. `revealGroupDay` already writes the group document
inside the reveal transaction (streak, `lastRevealDay`, `pendingDays`);
it adds one map:

    v2_groups/{gid}.ledger.{uid} = {
      member, played,                   // revealed days a member · days answered
      readK, readN, seenK, seenN,       // 1v1: your read of them · theirs of you
      likeK, likeN, projK, projN,       // 1v1: same answer · guessed your own answer
      mirrorK, mirrorN,                 // 1v1 mirror days, held apart (§3.7)
      ownK, ownN, roomK, roomN,         // group: away from the majority · called the winner
      namedK, namedN,                   // group: nominations received · pick days that snapshot
    }

`…K` is the chance-scaled sum of §3.2, `…N` the days behind it, so a
score is `50 + 50·K/N` whether it comes from the ledger or from the
fortnight of reveals a device can see — `roles.ts` folds either into
the same `RoleResult`, and the reveals keep drawing the runs.

- **Cost:** zero reads (every member already holds the group doc),
  no new write (the map rides a write the transaction makes), ≤32
  members × 20 small ints per group.
- **Custody:** the group doc is member-readable (`firestore.rules`,
  `v2_groups` read) and server-written but for `duoMode`; the ledger
  is a fold of reveals any signed-in user may read (D98), stored where
  fewer people can — strictly less exposure than its inputs.
- **Forward-only** (D5): existing groups start at zero and fill from
  the next reveal; until a ledger clears a floor the fold reads the
  reveals it has, as today.
- **Erasure** (D45): `deleteAccount` removes the uid's entry in the
  same pass that scrubs its reveal votes.
- **Paper:** `SCHEMA-V2.md`, `docs/data-inventory.md` (the reader
  column, `check:data-inventory`), `COSTS.md`'s Roles row.

### 3.4 The 1v1 — the pair's reading, and your role across pairs

Written in `archetype-data.js`'s own shape so adopting is a copy;
shares sum to 100 and every type is extreme on a dim, which
`roles.test.ts`'s registry cases hold. Baselines (`IS_TEST_AVG`):
`duoPair: { like: 58, mutual: 70, lean: 22 }`, `duo: { read: 70,
seen: 70, project: 62 }`.

**The pair** — `like` (same answer, chance-scaled, everyday and heat
days only), `mutual` (the mean of both reads), `lean` (the gap between
the two reads, 0–100; the card names who is ahead):

| name | share | line | like · mutual · lean |
| --- | --- | --- | --- |
| The Familiar | 24 | Alike, and you know it. | 78 · 82 · 16 |
| The Strangers | 15 | Two people still guessing. | 50 · 24 · 26 |
| The One-Way | 14 | One of you does the reading. | 56 · 66 · 90 |
| The Twins | 13 | Same answer before either of you guesses. | 94 · 70 · 18 |
| The Puzzle | 13 | Different, and still a mystery. | 30 · 34 · 24 |
| The Two-Way | 11 | You read each other equally well. | 60 · 94 · 10 |
| The Opposites | 10 | Never the same answer — you read each other anyway. | 12 · 72 · 20 |

**You, across pairs** — `read` (your guess lands), `seen` (theirs
does), `project` (your guess was your own answer, chance-scaled: the
lane's knowledge-against-projection, tie-3):

| name | share | line | read · seen · project |
| --- | --- | --- | --- |
| The Open Book | 17 | Easy to call, and fine with it. | 64 · 94 · 60 |
| The Stranger | 14 | Nobody has the other's number yet. | 28 · 28 · 60 |
| The Mirror | 13 | You guess yourself, and it works. | 84 · 70 · 92 |
| The Projector | 10 | You guess yourself, and it doesn't. | 40 · 60 · 92 |
| The Watcher | 10 | Reads more than gets read. | 90 · 34 · 48 |
| The Mind Reader | 9 | Calls their answer even when it isn't yours. | 94 · 62 · 30 |
| The Poker Face | 9 | Nobody's guess lands. | 66 · 20 · 58 |
| The Two-Way | 9 | Read, and reading. | 90 · 90 · 56 |
| The Guesser | 9 | Not yourself, not them — still guessing. | 30 · 40 · 22 |

Projection is the dim that makes The Mind Reader mean something: today
a pair who are alike and who each guess themselves score as readers.
It costs nothing — my answer, my guess and their answer are all in the
reveal.

### 3.5 The group — four dims that are four

`own` (away from the majority, chance-scaled per day), `room` (you
called the option that won — the 1v1's guess, on the group card),
`named` (the share of the group's nominations that name you on pick
days, against 1/m), `present` (days answered over revealed days you
were a member for — `reveal.members` says which). Baseline
`group: { own: 30, room: 62, named: 50, present: 72 }`.

| name | share | line | own · room · named · present |
| --- | --- | --- | --- |
| The Quiet Majority | 22 | With the group, never at the front. | 20 · 58 · 28 · 70 |
| The Regular | 18 | Every day, whatever the question. | 34 · 62 · 46 · 97 |
| The Anchor | 12 | Where the room lands, you were already standing. | 16 · 84 · 68 · 86 |
| The Occasional | 12 | Drops in, drops out, still counted. | 40 · 52 · 36 · 16 |
| The Contrarian | 10 | Knows where the room is going, and goes the other way. | 86 · 78 · 48 · 78 |
| The Bellwether | 9 | Calls where the room will land before it does. | 40 · 94 · 50 · 72 |
| The First Pick | 9 | The one the group names. | 44 · 60 · 94 · 74 |
| The Outlier | 8 | Your own answer, every time — and no map of theirs. | 88 · 26 · 40 · 60 |

Two of these are the prototype's returning: The First Pick was defined
by the `cast` D204 could not compute, and The Bellwether becomes
measurable the moment a group day carries a guess — a Contrarian who
calls the winner and votes against it is a different person from an
Outlier who cannot call it, and today they are one point.

**Reading the room is nearly free.** `isDuelAnswer` already admits
`guessIdx` on the group surface, `revealGroupDay` copies it into the
reveal for any mode, and the answer→guess morph is built on the 1v1
card (D156 §4 — one create, the pick waits for the guess). The group
card runs the same morph; the write shape does not change. The cost is
one more tap per group day, and it is the owner's to weigh (§6).
**Built at D381**: the morph on the group card, a *you read the room*
row on the reveal, the reading as a receipt row (`asides` in
`roles.ts`) and in the signal (`duelAggDelta` scores a group's guess
against the option the room landed on); it becomes a matched dim with
the table in step 4.

**Standing is the pick days.** Only votes carrying a D224 snapshot
count, only when the counted votes agree (the `majorityPickUid` rule),
and a pick day counts toward `named` only with three or more snapshot
votes. Below the floor the dim is absent and the types it defines are
out of the running (§3.6) — no First Pick before the days exist.

**Copy.** A group type is said to a person in front of their group.
The lines above are written to be sayable — *The Occasional*, not the
obvious word — and the rule that holds them is `COPY.md` §3's: a line
is a claim about a person, so it has to be true and kind at once.

### 3.6 A name only when the gap says so

- **Eligibility.** A type is in the running only when every dim that
  defines it (|sig − baseline| ≥ `RULE_STRONG`) is present in the
  fold. A small amendment to `IS_matchArchetype` — filter the list
  before scoring — with a registry case: `group` with no `named` never
  returns The First Pick.
- **The runner-up.** When `gap` < 5 the card says so in the result
  card's own words: *The Watcher · nearly The Mind Reader*, with
  `IS_nearWhy`'s *if sharper on them*.
- **Hysteresis.** The last name shown per setting is remembered on
  the device (one `insight.roleNames.v1` key, swept by the purge like
  D265's), and it changes only when the new best beats the remembered
  type by 3 rms points or the remembered type is no longer eligible.
  §2.1's every-sixth-day flip becomes a change you can see coming,
  because the runner-up was on the card first.
- **The rule line and rarity.** `IS_RULE_WORD` / `IS_RULE_ADJ` gain
  the three instruments (*reading · readable · alike · projecting;
  independent · room-reading · named · present*), and the panel draws
  `IS_typeRuleParts` and `IS_profileRarity` beside the name as every
  result card does.

### 3.7 The questions

**The tag reaches the seed** (built at D381). `gen-v2content.mjs` emits the source's
`d` as `topic` on duo entries (`day` · `heat` · `mirror` · `ahead` —
the group's kind already rides that field), `check:content` holds the
set closed as it does the group kinds, `duelQFor` carries it to the
card as `kind`. Then the fold can read the day:

| domain | what a hit means | folds into |
| --- | --- | --- |
| `day`, `heat`, `ahead` | you know what they would do | read · seen · like · project |
| `mirror` | you know how they see you | its own row — *how they see you: 4 of 6* — and `mirrorK` in the ledger; **never** into Likeness |

**Chance** needs the day's option count: the bank entry by `qid`, or
`reveal.members.length` on a pick day — both already on the device.

**Rules for a question that serves the instrument**, for the duel lane
(`QUESTION-FARM.md` § The duel lane) — beside its own:

1. Three or four options. A two-option day carries half the
   information of a four-option day and makes projection right for
   free.
2. The options must split people. A question most people answer one
   way is a hit for everyone and says nothing about a pair.
3. Not a fact a profile already holds (city, job, age).
4. A mirror question asks for a read of the other person and admits a
   flattering and an unflattering answer, both sayable to their face.
   The romantic pool has none (its 24 are `day` 6 · `heat` 8 · `ahead`
   10) and is the pool that wants them most.
5. A pick question names a virtue as often as a vice. Eight picks
   today, three of them gentle vices; a Standing profile built on vices
   is a roast.

**The first batch**, written to those rules — twelve questions the
lane appends at its cap (the budget prints 2 romantic · 1 group · 1
1v1 per run at today's pools, so three runs). Ids continue each series:

    friends 1v1
      056 · mirror · What they're secretly best at?
            Reading people · Getting away with it · Showing up · Making it look easy
      057 · mirror · The thing they'd never admit?
            Caring what people think · Being the jealous one · Loving the drama · Needing the praise
      058 · heat   · A queue-jumper, right in front of you. You…
            Say it · Loud sigh · Let it go
      059 · day    · Birthday coming up. The ideal version?
            Big table · Two or three people · Nobody knows · Away somewhere
    romantic 1v1 (dark until the pool lights, D40 part 4)
      060 · mirror · What do they love most about you, if you had to bet?
            How you listen · How you laugh · How you handle things · How you look at them
      061 · mirror · Their idea of your worst habit?
            The phone · The lateness · The tidiness, or lack of it · The overthinking
      062 · heat   · Their side of the family is coming for the week. They…
            Can't wait · Brace · Book a hotel
      063 · ahead  · A windfall lands on the two of you. First call?
            A home · A year off · A party · It stays in the bank
    group
      gu12 · us      · Our group's unofficial motto?
            Why not · Not tonight · Same again · Who's in?
      gu13 · us      · The thing outsiders get wrong about us?
            How close we are · How different we are · How serious we are · How long this has been going
      gd9  · classic · A free weekend and one ticket somewhere. Where?
            A city · A coast · A mountain · Home, actually
      gp8  · pick    · Who'd talk us out of a bad idea?

Nothing in the existing banks is retired: the signal that would say
which questions are dead or noisy (D40 part 3's guess-match band) has
nothing to read until duos play, and the lane's rule is to read it
first.

### 3.8 The surfaces

Two screens change shape and go through the design step (D352):
**request 5** — the Roles tab redrawn around three instruments, and
the pair's card on the 1v1 daily card and the person's page — and
**request 6** — the cast: the group's People tab listing every
member's role, with the crowns of the pick days. The group card's
guess step is the 1v1 card's own control on a surface that exists and
needs no request. Everything in §3.1–§3.7 is code and content under
the screens as they are.

## 4 · What stays

D204's honesty, whole: no dead axis drawn (a dim below its floor is
absent, and so are the types it defines), receipts on every dim, live
only and never a demo tab, the floors stated in their own unit. The
seal (D5), the reveal's shape and its readers (D98), the one edit shape
(D86 — duel answers stay frozen), the fortnight of reads and its cost
row, the ratchet on the bridge (`check:globals` rule 4 — the panel
imports its bindings already), and the demo layer's own type maths,
which draws sample people and is not this plan's.

## 5 · Build order, sizes, gates

Sizes as `PROGRAM-RUNBOOK.md` uses them; every step lands with its
record or note; steps 1 and 2 are worth building even if the owner
keeps D204's tables, because they fix what the current numbers mean.

0. **[owner]** The call — § 6 and `OWNER-LIST.md`.
1. **S · The day's kind and the honest fold — BUILT (D381).** `gen-v2content.mjs`
   emits the duo domain as `topic`; `check:content` holds the closed
   set; `npm run build:content`. `roles.ts` holds mirror days apart,
   chance-scales every rate (§3.2), and refuses a type whose defining
   dim is absent (§3.6); `roles.test.ts` grows the cases (a mirror day
   does not move Likeness; a two-option miss and a four-option miss
   are different numbers; no First Pick without pick days). The
   numbers on today's card move, so a note says so.
   · **Gate:** `npm run test:unit`, `npm run check:content`,
   `npm run test --prefix functions`.
2. **S · Reading the room — BUILT (D381).** `LiveDuelPanel` runs the answer→guess
   morph on group cards; `roles.ts` folds `room`; `foldDuelSignal`
   counts group guesses (today: only a duo's) and the scorecard's duel
   section reads them. · **Gate:** `npm run test:unit`, functions
   tests, `npm run test:e2e:all` (the duel loop).
3. **M · The ledger (§3.3).** `revealGroupDay` writes it in its
   transaction; `deleteAccount` scrubs the entry; the schema, the data
   inventory and the costs row; `roles.ts` folds a ledger when present.
   · **Gate:** functions tests, `npm run test:rules`,
   `npm run test:e2e:all`, `npm run check:data-inventory`.
4. **M · The instruments (§3.4–§3.6).** The three tables and baselines;
   `RP_TESTS` hues and poles for the new dims; the rule words; the
   explain sheet's copy; hysteresis and the runner-up in the panel;
   the D-record that supersedes D204's tables. · **Gate:**
   `npm run test:unit` (the registry cases, the panel's mount),
   `npm run check:globals`, `npm run check:public-copy`, `npm run lint`.
5. **L · The screens** — requests 5 and 6 through `planned → drafted →
   designed`, then built, `VISUAL-VISION.md` moving with them.
6. **S · The questions** — §3.7's batch through the duel lane, three
   runs.

## 6 · The owner's calls, in D334's shape

None of these is a privacy ask — every number folds from reveals any
signed-in user may already read — but each changes something a person
sees or pays, so they are stated with what they expose and cost:

- **The rename.** Steps 1 and 4 change the name and the dims on every
  role card that exists today. Few exist (the app is in pre-launch
  builds), and the alternative is a card whose name is §2.1's coin.
- **The ledger.** A schema addition on the group document,
  server-written, member-readable — the doc's own custody.
- **The guess on group days.** One more tap a day for every group
  member, in exchange for the one dim that makes the group table
  spread. The 1v1 has no skip and this proposes none; a skipped day
  simply carries no `guessIdx` and does not count. *Built at D381 on
  your word.*
- **The cast.** Each member's role in the group, drawn for the group.
  The inputs are public (D98); the lines are said in front of people,
  so §3.5's copy rule is the constraint, not the rules file.
- **The romantic pool** stays dark until the operator lights it (D40
  part 4); §3.7's rules and batch apply to it when it does.

## 7 · What this plan does not propose

A `cast` dim in D204's shape (Standing replaces it, floored); a Mirror
stop for 1v1s; anything in the demo build (D167 — the demo room has no
reveals); reading the follow graph (tie-5 is the lane's); a separate
instrument for romantic pairs (tie-6 says tie type should matter — the
ledger makes it measurable, which is all a plan should do before the
data speaks); and retiring any existing question before the signal can
say which.
