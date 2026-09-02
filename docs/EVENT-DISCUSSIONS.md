# Event discussions — recent events, each open for a window

**Status: plan only.** Nothing below is built. Written 2026-08-18 on the
owner's direction: rework the ambition of the parked prediction card
(D194→[D196](DECISIONS.md#d196--the-reading-game-is-the-one-that-ships-and-it-waits-for-a-crowd))
into something different — Claude finds recent events, each becomes a
card people discuss, and a timer decides how long the discussion stays
open. Building any phase of this graduates to a `DECISIONS.md` record;
this document is the plan that record would cite.

## 1 · The idea, and why it clears the bar the prediction card could not

A card in the feed names a recent event — a neutral two-sentence summary,
a link to a named published source, and a question in the product's voice
— and carries an open discussion thread with a visible countdown. When
the window closes, the thread seals: readable forever, no new posts. The
window is set per topic at authoring time, from an estimate of how long
the event will actually be talked about — a fast-moving story gets a
short window, a slow one gets a week.

The prediction card died on one constraint
(`FORESIGHT-CALLS.md` §1): a resolved call is the app **asserting a fact
about the world**, and the governing rule is that the app never asserts
what it cannot mechanically check. "How long will X be discussed" could
never be a graded call — no rubric a machine can execute resolves it, so
it is tier C by construction and banned at authoring.

This design keeps the timer and drops the assertion. **The window is a
door the app holds open, not a claim it makes.** The card says the
discussion is *open for three more days*; it never says the event *will
be discussed for three days*. The estimate behind the number is
curation — the same kind of judgement that already picks which questions
ship — and curation is exactly what D1 permits a machine to propose:
machine-authored content through the human gate is how this repo already
works, and what D1 forbids is fabricated *activity*, which nothing here
generates. The event summary itself follows the same posture the tier-B
design demanded of outcomes: the app points at a named source rather
than asserting in its own voice, and the reader can follow the link.

## 2 · What it reuses — almost everything

**The discussion is `v2_takes`, unchanged.** World-scope takes already
exist (D83, named since D98): ≤280 characters, attached to a question by
`qid`, doc id `{qid}_{uid}` so each person gets **one take per
question** — a second post is an update, and updates are denied. That
constraint is inherited on purpose, not worked around: one say per
person per event matches the product's one-question-a-day restraint,
reads as a wall of positions rather than a chat, and bounds the
moderation surface. Flags (`v2_flags`, any signed-in user), the mod
queue, verdicts, soft-hide and the author's appeal path all apply to an
event take because an event take is just a take.

**Zero new collections.** An event is a `v2_questions` document on a new
surface; its thread is takes; its moderation is the existing chain.
`docs/data-inventory.md` gains no row, only a widened sentence.

**What is deliberately NOT reused: the call machinery.** D196 parked the
prediction schema, resolver and `check:calls` gate intact so a
real-event *rubric* can arrive on them someday. This feature is not that
arrival — it grades nothing and resolves nothing — so those parts stay
parked and untouched. The one future bridge worth naming: an event whose
outcome is machine-checkable (a match, an election with a
machine-readable result) could later carry a tier-B call *beside* its
discussion. Nothing in this plan depends on that.

## 3 · Schema — one new surface, and the clock starts at the seed

`v2_questions/{event-<id>}`, `surface: "event"`, seeded from a new
`content/event-topics.json` through the existing path
(`scripts/gen-v2content.mjs` → `functions/src/v2content.ts` →
`seedContentV2`):

```
id          event-<nnn>, append-only like every bank
prompt      the question the card asks, product voice — personal angle,
            not a poll of a place (the farm's hard rule 6 posture)
summary     ≤2 sentences, neutral register, no adjectives doing opinion work
sourceUrl   a named published source the card links; REQUIRED
cat         an existing feed topic id (a new topic is a human decision,
            proposed in the PR body — QUESTION-FARM.md § When no category fits)
political   D52's flag, same meaning as everywhere
discussDays authored window length, integer, bounded (1–7)
openedAt    NOT authored — stamped by the seed on first create, like
            `active`, and never rewritten on reseed
```

`openedAt` is the load-bearing field. The farm's cycle is PR → review →
merge → deploy → seed, and `FORESIGHT-CALLS.md` §2 already recorded what
that does to perishable content: an *absolute* close date authored on
Monday is half-spent by the Thursday it goes live. Authoring a
**duration** and stamping the start **when the topic actually opens**
means the pipeline's lag delays the event's arrival (acceptable — a
few-days-old event is still current) without ever eating its window.
The client's countdown and the rules' write-gate both compute
`openedAt + discussDays` from the same two fields, so the card and the
enforcement cannot disagree.

**No options, no answers, no aggregate — in v1.** The event surface is
*not* added to `isWorldAnswer()`: an event card takes no vote, so
nothing folds, no `agg` doc exists, D86's edit arm is untouched and the
whole answer machinery stays out of scope. Whether an event should also
carry an opinion vote is an open question (§9); starting without one
keeps phase 1 to rules-plus-content and makes the discussion the
product, which is the owner's ask.

## 4 · Rules — one new condition on a rule that already exists

The world-scope take create arm (`firestore.rules`, `v2_takes`) gains
one guard: a take whose `qid` names an event must land while the event
is open.

```
// inside the world arm, after the qid shape checks
&& (!request.resource.data.qid.matches('event-.*')
    || (get(/databases/$(database)/documents/v2_questions/$(request.resource.data.qid))
          .data.openedAt
        + duration.value(get(...).data.discussDays, 'd')
        > request.time))
```

The prefix test keeps the `get()` off every non-event take, so the two
existing surfaces pay nothing. Details that matter:

- **Sealing stops new speech, not withdrawal.** The author's delete
  stays legal after close — "your speech stays yours to withdraw" is
  about the author, and a seal that trapped a regretted post would
  invert it. Flags on a sealed thread likewise stay open: moderation
  does not expire.
- **Reads are untouched.** A sealed thread is readable forever under the
  same `hidden == false` equality; the archive IS the read path.
- **`active: false` retires an event early**, through the same operator
  kill switch every bank has — the rule should also require it true, so
  a pulled topic closes its thread in the same motion.
- Tests in `firestore-tests/rules.test.ts`: create inside the window
  passes, create after it is denied, delete after close passes, the
  non-event arms are measured to not pay the `get()` (the D65 discipline:
  measured, not reasoned about).

## 5 · The lane — a farm section, with two rules of its own

> **Built for `now` at D350** (2026-09-01) as the now lane —
> `QUESTION-FARM.md` § The now lane. Rule 1's source posture became a
> corroboration bar sized to what a session can actually reach (found by
> searching, at least two independent outlets, under a week old, cited
> in the PR body — the environment's egress policy refuses news domains,
> so a run can find and cite a story but not open it); rule 2 stands
> verbatim. The event-thread surface this page proposes is still
> proposed.

A new section in `QUESTION-FARM.md`, run by a scheduled Routine two or
three times a week. Everything structural inherits: PR-only output,
human on the merge, the roll-up rule, the run log on issue #31,
`check:neighbors` batch dedup, packet lines in the PR body. Two rules
are new because events are new:

1. **An event must exist outside the model.** Every topic names a
   `sourceUrl` published within the last N days by an identifiable
   outlet, found by the run *searching*, never recalled from memory —
   the same posture as the catalog lane's "never entries from model
   memory", for the same reason: an invented event is worse than a wrong
   catalogue key. The reviewing human opens the link; a gate can hold
   the URL's shape and the field's presence, not its truth, and the PR
   body says which is which.
2. **The angle is personal, the flag is honest.** Hard rule 6 (no
   place-scoped civic questions) reads differently here — events are
   often civic by nature, and the rule's own test still decides:
   the *question* asked about the event must be interesting to the
   person answering, not a poll of a place's citizens. "Should Norway
   change X?" stays out; "Would this change how you live?" is in.
   Anything charged carries `political: true`, and warmth-over-outrage
   binds the summary as hard as it binds prompts — a news lane that
   drifts into bait is the engagement loop this product refuses, one
   door down.

The window length is the lane's judgement call, bounded by the gate:
short for a story that will be stale by the weekend, a week for one that
will not. The PR body states the reasoning per topic in one line, the
same way question batches argue their splits.

## 6 · Serving — ordinary feed cards, one new state

Event cards ride the feed deck like any other card type: a typed ESM
component (`src/v2/ui/`, no `spec-index.js` line — CLAUDE.md rule 2's
carve-out for imported modules), reached past first paint so it stays
out of the entry chunk. The card shows kicker (topic + `political`
treatment), summary, source link, the countdown, and the thread — which
is `LiveTakesPanel`'s existing world wiring pointed at the event's qid.

Open events sort ahead of sealed ones; a sealed card drops to the
archive posture with its thread intact and a closed-state line. Copy
follows D182: the countdown is the visual, so the words next to it do
not restate it.

## 7 · Gates and tests touched

- `check:content` — shapes for `event-topics.json` (id series, field
  presence, `discussDays` bounds, `sourceUrl` is a URL).
- `check:quality` — event form bounds: summary length, prompt rules,
  `cat` required against the feed taxonomy, the hard-rule-6 tripwire.
- `check:docs` — this file's row in `ORIENTATION.md` (done with this
  commit).
- Rules tests as §4; a smoke test mounting the card open and sealed
  (the spec-layer mount suites are the only gates that execute a
  render — CLAUDE.md's own warning).
- Nothing lands on the deploy path that is not already there: no new
  callable (no `check:appcheck` entry), no new function, no new trigger.

## 8 · Build order

1. **Phase 1 — substrate.** Content file + seed path + `openedAt`
   stamping + rules arm + rules tests. Bank empty; nothing renders.
2. **Phase 2 — the card.** Feed card, countdown, sealed state, takes
   thread, smoke tests. First topics are **editorial** — two or three
   hand-authored events to walk the loop end to end, the same way calls
   shipped editorial-only.
3. **Phase 3 — the lane.** The `QUESTION-FARM.md` section and its
   Routine, after the editorial batch has proven the review shape.
4. **Later, separately decided:** an opinion vote on events (adds
   `event` to `isWorldAnswer()` and brings the whole answer machinery —
   its own record); the tier-B bridge for events with checkable
   outcomes.

## 9 · Open questions for the owner

- **Vote or no vote in v1.** This plan says no; the counter-argument is
  that a card you cannot answer is the first such card in the app.
- **One take per person** is inherited from the world-take id scheme.
  Right for launch; if events want conversation rather than positions,
  that is a takes-schema decision bigger than this feature.
- **Where the cards live** — the feed (this plan), or the unbuilt v28
  `patterns` tab someday. Nothing here couples to the tab question.
- **Whether sealed threads feed the Mirror** — an archive of what you
  said about events is Map-shaped, but that is a D126-class boundary
  decision, not part of this build.
