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

| | before | after |
| --- | ---: | ---: |
| Friends: your follows' answers to this question | ~400 reads/open | ≤50, typically **5** |
| Circle: each member's score profile | up to 300/member | **1**/member |
| Circle's splits section | on arrival | on the tap that asks |
| Kindred: people queried directly, not discovered through answers | 2,400/view | **50** |

**All four have shipped.** Measured with `npm run costs`:

| DAU | bill before | after | + single region |
| ---: | ---: | ---: | ---: |
| 500 | $2.20 | **$0.58** | $0.29 |
| 5,000 | $44 | **$18** | $9.18 |
| 50,000 | $472 | **$211** | $111 |
| 500,000 | $4,774 | **$2,158** | $1,151 |

435 → **157** reads/user/day, and every scenario grades B or better where
the range used to run C at the top end.

**What is left in `social`, and it is worth naming**: 60 of the remaining
100 reads/user/day are still the who-voted SAMPLE — `VOTER_FETCH_CAP`
answers plus name resolution — because the Type cut (D146) and the takes
panel are honest consumers of a sample and still open it. That is now the
largest single social line, and unlike the three fixed above it is not a
backwards read: a statistic over a bounded sample is what a sample is
for. Trimming it is the one remaining product-degrading lever, and it is
still not recommended.

**Every one of these makes the app more correct, not less.** The friends
cut stops missing friends. Kindred stops silently ranking the recently
active. That is the opposite trade from COST-REDUCTION.md's path A/B,
which buys a smaller saving by thinning three Mirror surfaces.

> Figures are `npm run costs` and `npm run costs:levers` against the tree,
> not a scratch model — see Phase 0.

## Phases

### 0 · Make the plan measurable — **SHIPPED**

The first draft of this page quoted a scratch model that abused `voterCap`
and `circleAnswerCap` as proxies for "documents read per open", which is
the hand-maintained-figure error D39 and `check:figures` exist to stop.
That is closed: `socialTerms` now decomposes into five terms in the units
that actually move — `whoVoted`, `friends`, `kindred`, `circle`,
`circleSplits` — each with its own override, and `KINDRED_CANDIDATE_CAP`
is read from source the way `VOTER_FETCH_CAP` always was. `pulse.test.mjs`
holds the constants equal to the tree.

So the tables above are `npm run costs` output rather than prose, and the
levers file prints today's plan rather than a remembered one.

### 1 · The two console items — **THE BIGGEST NUMBERS HERE, AND STILL OPEN**

Now that phases 2–4 have landed, **the auth line is larger than the entire
rest of the bill** at every size where it bills at all:

| DAU | MAU | Identity Platform, IF active | everything else, after this branch |
| ---: | ---: | ---: | ---: |
| 50,000 | 150,000 | **$505/mo** | $211/mo |
| 500,000 | 1,500,000 | **$6,015/mo** | $2,158/mo |

Neither is code, so neither can be done from a pull request. Both have
full procedures already — this section deliberately does not restate them,
because a second copy of a runbook is the thing that goes stale:

- **Auth billing mode** — `docs/SHIP-CHECKLIST.md` § "the largest unknown
  on the bill". Firebase Console → Authentication (an un-upgraded project
  shows an *Upgrade to Identity Platform* call to action); the unambiguous
  version is Cloud Console → Billing → Reports grouped by service.
- **App Check enforcement on the Firestore API** —
  `docs/SHIP-CHECKLIST.md` § "App Check enforcement". Separate from the
  callables, which `check:appcheck` already guards, and separate from
  setting the site key in the build.

**What is actually missing is not the procedure, it is the ANSWER.** Both
have been "somebody should check this" since COSTS.md was written, and
nothing in the tree can tell whether anyone has. So record it here, in the
tree, where the next reader finds it beside the arithmetic that depends
on it:

| Question | Answer | Recorded |
| --- | --- | --- |
| Is `prvfire33` on Identity Platform billing? | **No** — owner attests never having enabled it | 2026-08-15 |
| Is App Check enforced on the Firestore API? | **unrecorded** | — |

The auth answer is an **attestation, not a console reading**, and the
distinction is worth keeping rather than rounding off. What supports it:
upgrading is an explicit action behind a billing consent screen, nothing
in this repository's history has ever touched auth configuration, and the
Authentication page shows no upgrade prompt. What would settle it in
thirty seconds, and is still worth doing before launch: Cloud Console →
Identity Platform. An ENABLE button means not provisioned; a
Providers/Settings/Users console means it is.

Either way it is **$0 today** — Identity Platform's free tier is 50,000
MAU and this project has a handful of accounts. The reason to close it
properly is that D3 makes the app anonymous-first, so MAU tracks
INSTALLS rather than engaged users: it is the one line a viral week moves
hardest, and the one nobody would think to look at.

Two minutes each, and the first one is worth more than every code change
on this branch put together at 50 k DAU. If the answer to the first is
"yes", the follow-up is in SHIP-CHECKLIST too: the app uses no Identity
Platform feature at all — `signInAnonymously` and `GoogleAuthProvider` are
the entire surface — so an upgraded project here is paying for nothing it
uses.

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

### 3 · Circle on score profiles — **SHIPPED**

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

### 4 · Kindred: query people, not answers — **SHIPPED**

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

### 5 · Region — **DECIDED (D165), NOT EXECUTED**

Overtaken by `main` while this branch was being written, and in the right
direction: **D165 takes option A** of
[`FIRESTORE-REGION.md`](FIRESTORE-REGION.md) — a second regional database
in the same project, `europe-west1` recommended, both triggers repointed,
existing answers not migrated. The app already names the `insight`
database in all its call sites.

What is left is the operator step: creating the database and deleting
`(default)` once it is proven (`LAUNCH-RUNBOOK.md` 0.0). **Until that
runs, the model is right to keep quoting `nam5` prices** — `costModel`
defaults to `regional: false`, and every figure on this page is the
multi-region one. When the migration executes, that default flips and
roughly half of every Firestore line goes with it.

D165 also found the better argument, which was not the cost one: `nam5`
is the **US** multi-region and the operator is a Norwegian sole trader.
Data residency, not $20/month.

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
