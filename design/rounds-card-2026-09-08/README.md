# The 1v1 and group card, when a round is the unit — Claude Design, 2026-09-08

The owner's canvas for [`VISUAL-REQUESTS.md`](../../docs/VISUAL-REQUESTS.md)
request 12, the card [`ROUNDS-PLAN.md`](../../docs/ROUNDS-PLAN.md) §7.5
asked for once a round replaced the day. Delivered as one bundled page:
nine states, each for a 1v1 and for a group, each in light and dark —
thirty-two artboards at iPhone 390 wide, drawn from one state table
inside the page's own script rather than as pictures, so every string
below is the string the artboard renders.

`1v1_and_Group_Cards.html` is the file as delivered. It is a bundle: the
artboards' markup and the state table are a gzipped asset inside it
rather than markup you can read in a diff, so **this README is the
readable half** and the reason it exists. (The unpacking is twenty lines
of `zlib.gunzipSync` over the `__bundler/manifest` block — the recipe
`design/standalone-v28/README.md` records; the state table is the
`data-dc-script` inside the template.)

## The nine states

| | 1v1 | Group |
| --- | --- | --- |
| 1 · Your turn | answer, then *And Ada picked…?* | answer, then *And the room lands on…?*; the kicker carries `1d 16h left` |
| 2 · Their turn | *you said* · Ada's answer as redacted bars · *waiting on Ada* | *you said* · who has played, haloed · *Reveals when everyone has played · 1d 16h at the latest* |
| 3 · Revealed, and the next round is open | the SAID · CALLED table above, a World round asked below | the split with faces above, *The room landed on Food* · *✓ you called it*, a World round below |
| 4 · Several rounds waiting for you | *3 rounds waiting for you · each reveals as you answer* | *… · each reveals when everyone has played, or at its deadline* |
| 5 · At the lead | *Five rounds waiting on Ada*, each with your pick and call, *Each reveals as Ada plays.* | *Five rounds waiting on The Crew*, each with its deadline |
| 6 · Closed at the deadline | — | the reveal for whoever played; absent members are dashed seats |
| 7 · Late | — | *you · late* on its bar and in the seats; *Answered after the reveal. It shows, and scores nothing.* |
| 8 · A World round | no guess when Ada already answered it in the feed; the reveal has three columns: you, Ada, World | three columns: you, The Crew, World |
| 9 · First run | Ada's invitation as the hero; *Sealed* over a hairline ballot; *Revealed · when Ada plays*; *Start a 1v1* as a row | the same beats; *Start a group* as a pill |

The rail sits under the app's header: a mark per room, a ring on the one
in view, a dot on any that is your turn, and a dashed *New* tile. The
run at the foot of every card: one dot per round you played — filled
when your call landed, hollow when it missed — and a tail of the rounds
in play: a ringed dot per round you sealed and are waiting on, a dashed
seat per round waiting on you, a dotted ring for a late answer.

## Every string it settled

Copy, verbatim, because this is what the build has to match and D182
governs it:

- **Kickers** — *Round 9* · *· World* · *· revealed* · *· closed at the
  deadline*; on a group's ask, *1d 16h left* at the right.
- **The read** — *You picked **Ignore**.* · *And Ada picked…?* · *And the
  room lands on…?*
- **Their turn, 1v1** — *you said Ignore* · *Ada's answer · **you called
  Answer*** · *waiting on Ada*
- **Their turn, group** — *you said Banter* · *Reveals when everyone has
  played · 1d 16h at the latest*
- **The band** — *3 rounds waiting for you* · *each reveals as you
  answer* / *each reveals when everyone has played, or at its deadline*
- **At the lead** — *Five rounds waiting on Ada* / *Five rounds waiting
  on The Crew* · items *you: Ignore · called Answer*, *World · you: Kinder
  · called Meaner* · *Each reveals as Ada plays.* / *Each reveals when
  everyone has played, or at its deadline.*
- **The reveal, 1v1** — columns *said* · *called*; a ✓ before the call
  that landed, in the good colour; a miss in the miss colour.
- **The reveal, group** — *The room landed on Food* · *✓ you called it* /
  *you called Kinder*
- **A World round's reveal** — columns *you* · *Ada* (or the room) ·
  *World*, each option with the World's share; *✓ you called it* · *Ada
  guessed Meaner*
- **Late** — the pill *you · late*; *Answered after the reveal. It shows,
  and scores nothing.*
- **A World round's ask, no guess** — *Ada already answered this in the
  World feed, so there is no guess this round.*
- **The run's tooltips** — *called it* · *missed* · *sealed · waiting on
  the others* · *open · waiting for you* · *late · no score*
- **The rail** — *Ada — your turn* · *New* · *Start a new 1v1* / *Create
  a group*
- **First run** — *Invitation* · *Ada invites you to a 1v1* · *answer,
  then guess Ada's* · **Accept** · *Decline* · *Sealed* · *A World
  question stands in — a 1v1 draws its own.* · *Revealed* · *when Ada
  plays* / *when everyone has played, or at the deadline* · *Your guess
  at Ada's answer* / *Your call on where the room lands* · **Start a
  1v1** / **Start a group** · *An invitation reaches you here, and a link
  a friend sends lands here too.*

## Behaviours worth naming, because a static reading loses them

1. **No clock on a 1v1, anywhere.** It reveals the moment the other
   person answers, and the card says who it waits on and nothing else.
   A group's only clock is its round deadline, drawn coarse.
2. **The reveal and the next round share one card** (state 3) — that IS
   the loop. Once you have answered the next round, what you sealed
   takes the reveal's place (state 2); the reveal waits in the run.
3. **The run is the browser.** The dots that used to browse days browse
   rounds: a revealed round's dot opens that reveal above.
4. **Nothing invented.** Before a reveal nobody's answer shows — the 1v1
   draws the partner's as redacted bars, the group draws who has played
   and never what. An absent member is a dashed seat, never a name. The
   first run's question is a World question standing in, and says so.
5. **One tap target to start.** The first run keeps the create form
   behind *Start a 1v1* / *Start a group*; once a room exists the rail's
   *New* is that target and the start-another row is gone.

## What it keeps from the screen it replaces

`ui/LiveDuelPanel.tsx`'s stack: one room per screen, snapped under a
sticky rail (D156); the ⋯ behind *Manage*; the answer-then-guess morph
as one write (D5, D386); the takes thread on the revealed question and
never the sealed one; the late door under a reveal you have no vote in
(ROUNDS-PLAN §4); the invitation inbox leading the stack, restyled as the
hero.

## As built — where the tree departs from the canvas, and why

Recorded here rather than by editing the canvas, the same way
`ROUNDS-PLAN.md` §0a records the model's departures from its plan.

- **No World round.** State 8 — a World question as the round, no guess
  when Ada already answered it in the feed, the reveal's three columns —
  was built from the canvas and retired the same evening on the owner's
  ruling at the first reveal (*"that is stufff you already find on the
  world feed so is totaly pointless"*; D426's third amendment). A round
  draws from the room's own bank only, so the kicker never says *· World*,
  the reveal is always the SAID · CALLED table or the split with faces,
  and the ask always takes the guess. The first run's stand-in (state 9)
  is unchanged: it stands in for a room's question and says so.
- **A 1v1 can close at the deadline.** The design's note says a 1v1 has
  no deadline, so its rounds cannot close without you. The model the
  owner ruled applies the deadline to both surfaces (§0a: a partner who
  stopped playing used to seal the other's answer forever). The card
  draws no clock on a 1v1, as designed; when a 1v1 round does close for
  one player, its reveal wears the group's shapes — *closed at the
  deadline*, the open seat, the late door — because the design drew
  those for the case and drew nothing else for it.
- **State 2 has the ask under it.** After you answer, the card shows
  what you sealed (state 2 as drawn) and, under a hairline, the next
  round (state 1's grammar) — the five-round lead the owner approved is
  worth nothing if the card never offers the next round. The design's
  state 2 artboard shows the wait alone.
- **Only the open round has a deadline.** The at-lead list gives every
  group round its own `1d 16h`; the model starts a round's clock on its
  first answer, so only the open round has one. The other rounds' rows
  carry no time, and the line says *at its deadline*.
- **Your call on a sealed round is remembered, not fetched.** The list's
  *called Answer* comes from the call this device made or from the answer
  documents the boot's delta reads anyway; a round whose call is not in
  hand names your pick alone (`myDuelCall`, `data/live.ts`).
- **A sixth dot.** The run has one kind the design did not need: a round
  you played that carried no call to score — a reveal from before rounds,
  or one of the World rounds of 2026-09-08 whose guess was a lookup —
  drawn as a plain ring, titled *played · no call*.
- **Seats draw only when one is open**, and the kicker says *closed at
  the deadline* when a seat is open and your own answer was not late —
  which is the reading the two artboards (states 6 and 7) agree on.
- **The header lost its run line and its member count**, and the panel
  its *N to play* line: the canvas draws a mark, a name and ⋯, with the
  rail's dots as the count. The streak is still computed and stored
  server-side; nothing on this card prints it.
- **A late answer on a bar is counted in the bar's share** (as the
  design draws it) and stays out of the tally the verdict and the calls
  are read against — shown, not scored. A partner's guess about your
  late answer scores nothing either.
- **The ⋯ keeps *Manage …*** for both surfaces where the canvas says
  *Options for Ada* on a 1v1: the same door, and one name for it.

## Status

`built` 2026-09-08 (D426's second amendment), on the branch the rounds
model shipped on. Pinned in `ui/LiveDuelPanel.test.tsx` by what a person
can see or reach — the states, the copy above, the run's kinds, the
first run's one tap — so a later polish that keeps the behaviour is free
to move.
