# Three surfaces read backwards

An implementation plan. Written 2026-08-15 against `1068c8a`, and it is
the **second** version of this page — the first one is worth describing,
because being wrong in that particular way is the finding.

[`COSTS.md`](COSTS.md) says what this costs.
[`COST-COMPARISON.md`](COST-COMPARISON.md) says whether that is a lot.
[`COST-REDUCTION.md`](COST-REDUCTION.md) prices every lever anyone has
thought of. This says what to build, and it disagrees with all three about
where the problem is.

## What the first draft got wrong

It correctly found that `social` — the D98 surfaces reading other users'
answers — is ~81% of the read bill at every size, and that
COST-REDUCTION.md's only answer to it is the cap trims its own
recommendation 5 tells you not to take.

Then it proposed **denormalising those reads so they would be cheap**:
precompute a voter document per question, precompute a per-member answer
digest. −70% at every size, no cap moved.

The arithmetic was right and the target was wrong, and the reason is worth
keeping. That plan was built on the belief that the who-voted sheet
displays a list of ~200 named strangers, which is a screen **this app does
not have**. Reading the consumers instead of the constant settles it in
one pass — `LIVE.voters(qid)` has three:

| consumer | what it renders |
| --- | --- |
| `LbFriends` (LiveBreakdownPanel) | *"3 of 5 friends are on your side"* — your follows, everyone else filtered out |
| `LiveTakesPanel` | which side a take's author picked |
| the Type cut (D146) | a personality-type **breakdown** — a statistic, not a roster |

Plus Kindred and the similarity field, which are rankings.

So the 200 was never a roster. It is a **sampling window** — fetch the 200
most recent answers from anyone, then hunt through them for the handful of
people you actually care about. The first draft's plan was to make that
sampling cheap. The right plan is to stop sampling.

**The lesson, stated so the next reader gets it for free: a cost model
tells you which term is large, and nothing at all about whether the term
should exist.** Both COST-REDUCTION.md and this page's first draft priced
`social` correctly and then reached for the constant, because a constant
is the thing a model can see. What the constant was feeding took reading
three UI files.

## The actual finding

All three of the app's cross-user surfaces ask their question the wrong way
round, and all three degrade as the app grows:

**1 · The friends cut.** To find which of your ≤50 follows answered a
question, it downloads the 200 most recent answers from anyone and filters.
At 500 users that mostly works. At 50,000 your friends answered this
morning and have fallen out of the window — so it says *"None of the people
you follow has answered this yet"* about people who did. The panel already
half-admits it in small print (*"an older answer from a friend may not be
here yet"*). Raising the cap delays this; it does not fix it.

**2 · Circle.** Reads up to `CIRCLE_ANSWER_CAP` raw answers per member to
compute likeness by counting matching options. The direction is right —
it queries the people it means — but the metric depends on which questions
you happen to share, which makes it unstable: `rankMembers` already carries
a tiebreak specifically to stop one shared matching question scoring 100%
and heading the list forever.

**3 · Kindred.** Takes your 12 most recent questions, pulls 200 voters from
each — **2,400 records** — to assemble a candidate pool, then ranks those
people by their **test scores**, which come from their profile documents,
not from any of those answers. The answers are discovery scaffolding,
read and discarded. And it inherits the same window flaw: at scale
"the 200 most recent answers" means *whoever was online in the last few
minutes*, so Kindred quietly stops being "people most like you" and becomes
"recently active people, ranked". Nothing on screen says so.

## The fix, and what it is worth

Ask for what you actually want.

| | today | after |
| --- | ---: | ---: |
| Friends: your follows' answers to this question | ~400 reads/open | ≤50, typically **5** |
| Circle: each member's score profile | up to 300/member | **1**/member |
| Kindred: query people by score, don't discover them through answers | 2,400/view | **~50** |

| DAU | reads/user/day | bill | after | + single region |
| ---: | ---: | ---: | ---: | ---: |
| 5,000 | 411 → **59** | $42 | **$9.99** | $5.42 |
| 50,000 | 411 → **59** | $450 | **$133** | $78 |
| 500,000 | 411 → **59** | $4,548 | **$1,386** | $818 |

Below 5,000 DAU the bill is inside the free tier either way.

**Every one of these makes the app more correct, not less.** The friends
cut stops missing friends. Kindred stops silently ranking the recently
active. That is the opposite trade from COST-REDUCTION.md's path A/B,
which buys a smaller saving by thinning three Mirror surfaces.

> Figures from `scripts/cost-arith.mjs` via a scratch model run, with the
> candidate pool at 50 and the per-open reads set to what each fixed query
> would actually cost. **They have no gate under them yet** — see Phase 0,
> which exists for exactly the reason D39 and `check:figures` exist.

## Phases

### 0 · Make the plan measurable

Half a day, ships nothing, goes first. `socialTerms` currently exposes the
three CAPS as its overrides, which is the right shape for the levers it was
built for and the wrong shape for this plan — none of these changes moves a
cap. Give it overrides in the units that actually move: documents read per
sheet open, per circle member, per Kindred view. Then add the paths to
`cost-levers.mjs` so `npm run costs:levers` prints this page instead of
this page quoting it. `pulse.test.mjs` pins the `readsPerUser` key set;
check it still passes.

### 1 · The two console items

Larger than everything else here, neither is code, both already on
SHIP-CHECKLIST.

- **Auth billing mode.** If the project is on Identity Platform, auth alone
  is $505/mo at 50 k DAU against a $450 Firestore bill, and $6,015 at
  500 k. Plain Firebase Auth is free at any size. Five minutes to check;
  COSTS.md finding 3 has had it open since it was written.
- **App Check enforcement on the Firestore API.** Not a lever, a hole. It
  cannot be armed during an incident — the soak takes days.

### 2 · The friends cut — **SHIPPED**

`fetchFriendVoters` asks each follow directly. `LIVE.loadVoters` is
untouched: the takes panel and the Type cut are legitimate users of the
sample (both are statistics *over* a sample, which is what one is for).
What changed is that opening a breakdown no longer forces the 200-fetch,
and the Friends cut is exact at every size — the small-print disclaimer
came out with the flaw that needed it.

**The read shape was forced, not chosen, and both cheaper forms are
refused by `firestore.rules`.** Measured against the emulator rather than
reasoned about, and now pinned as rules cases:

- a **direct `getDoc` per follow** is `permission-denied` when that follow
  has *not* answered — the grant tests `resource.data.surface`, and
  `resource` is null for a document that does not exist. The most ordinary
  input to this feature is an error.
- **one collection-group query with `documentId() in [paths]`** fails the
  same way ("Null value error") as soon as any path in the batch is
  missing, which is not knowable in advance.

A LIST scoped to one user's subcollection has neither problem — a query
matches only documents that exist — and it is the shape `circle.ts`
already ships, so Phase 3 inherits it.

### 3 · Circle on score profiles

`scoreMatch` (`data/similarity.ts`) already exists, and D112 already made
it the **primary** ranking for the People lens and the similarity field —
answer-agreement was demoted to the fallback for people you share no
completed instrument with. Circle is the surface that never got moved
over. So this is finishing a migration, not designing one.

Read each member's profile (1 read) instead of their answers (up to 300),
rank with `scoreMatch`, keep `agreement` as the fallback exactly as
`rankKindred` does.

Circle's other half — *how your circle answered this question* — still
needs real answers, but only for the questions on screen. That is the
Phase 2 query with a different set of uids, so both halves of Circle end
up on one mechanism.

### 4 · Kindred: query people, not answers

Ranking is already right — `rankKindred` flattens every axis of all four
persisted instruments (Big Five, Politics, Values, Attachment: 22 axes).
**Nothing about the ranking changes.** What changes is candidate discovery.

`v2_users` is world-readable and already queried (that is how names
resolve), so people can be found directly. Three shapes, cheapest first:

1. **Store a type key and query it.** The Big Five archetype is already
   computed (`typeMix.ts` → `matchArchetype`) and simply not persisted.
   Persist it, `where archetype == yours limit 50`, rank those 50 properly
   on the client. One field, one index.
2. **Range-query one axis** near yours and refine client-side. No new
   field, fuzzier.
3. **A server-built "people like you" document.** One read, best rankings,
   most infrastructure.

Start with 1. Either way the query can be scoped by city in the same
breath, which is what the similarity field wants anyway.

### 5 · Region

Half of every Firestore line forever, nothing a user sees — but no longer
a setting. `(default)` is `nam5`, seeded, with TestFlight testers on it,
so it is the second-database migration in
[`FIRESTORE-REGION.md`](FIRESTORE-REGION.md). Last because it is the only
irreversible item, and doing it after the schema stops moving is cheaper.

## Already shipped

**An ordinary foreground re-reads today, not the whole deck** (`1068c8a`).
`reattach` was `bgCycles × DECK_DAYS` = 28 reads/user/day, all of it
re-answering "have the six cold back days moved?" on every app swap. Boot
and day-rollover still take the whole deck; a plain foreground takes
`FOREGROUND_AGG_DOCS`. 28 → 4, −5% of the bill at every size.
`cost-arith.mjs` reads the constant from source.

**It shipped without a test, and the reason is a finding.** The obvious
test — foreground, then assert the read asked for one id — passes with the
change reverted, because `idle-detach.test.ts`'s fixture bank holds a
single daily question, so `computeDeckIds` returns one id and "today only"
and "the whole deck" are the same list.

The neighbouring case, `"a poll tick asks about today only"`, has the same
blind spot, and that is **measured**: widening the poll itself to
`refreshAggs(state.deckIds)` leaves the whole file green. Any future work
on deck scope should fix the harness first — a multi-day deck through that
fixture — or it will be writing tests that cannot fail.

## What could be lost

Much shorter than the first draft's list, because these are corrections
rather than trades.

1. **Score-based likeness needs a completed instrument.** Answer-agreement
   works for anyone who has answered anything. `rankKindred`'s existing
   score-first-agreement-second pattern is the answer, and Circle should
   copy it rather than invent one.
2. **Kindred's candidate pool changes character** — from "recently active
   people who overlap with you" to "people whose scores are near yours".
   That is the surface working as described rather than a loss, but it is a
   visible change: the same person opening the People lens twice a day will
   stop seeing it churn.
3. **A coarse type key misses near-neighbours** just outside your bucket.
   Real, and smaller than what it replaces — today's pool is bounded by who
   was online, which is not a likeness criterion at all.
4. **Circle's per-question split becomes bounded by the questions on
   screen.** No visible difference; it is the same fold over fewer reads.

**Not lost:** no cap moves. `VOTER_FETCH_CAP` stays 200,
`KINDRED_QUESTIONS` 12, `CIRCLE_ANSWER_CAP` 300, `FOLLOW_CAP` 50. Nothing
new is published — profiles and answers are already world-readable (D98),
and the three denies CLAUDE.md names are untouched.

**One constraint to carry into Phase 4:** if a type key becomes a
*queryable, indexed* field, keep it Big Five. The politics result is
Art. 9 special-category data, and D146 already restricts type *grouping*
to Big Five for that reason (`typeMix.TYPE_TEST`). Ranking on all four
instruments is unaffected — that is a client-side fold over data already
readable, and it is what ships today.

## When

D7 still governs. Phase 1 now — it is free and it is the biggest number on
the page. Phase 2 whenever, because it is a bug fix rather than an
optimisation. Phases 3–4 at the ~10 k DAU trigger COST-REDUCTION.md set,
which is also before D7's contention wall at ~14,400. Phase 5 before the
data gets deeper, or record `nam5` as the decision.

Record the outcome in `docs/DECISIONS.md` either way — including, if it
goes this way, that the first version of this page optimised a screen that
does not exist.
