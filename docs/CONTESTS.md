# Arranged contests — the read path (D390)

**Status: tree — what the contest backend does today.** The first axis
built under its paper: `research/axiom-theory/paper-08-arranged-competition.md`
says what a competitive axis measures at its perfect form and what it
would take; this page says what of that the tree holds, field by field,
and what is deferred. The owner chose the axis 2026-09-08 (the choice and
the arithmetic behind it are D390).

## 1 · What a contest is

Two people, one domain, one sitting each on the **same** server-minted
form, scored server-side the way the verified logic test is (D57), settled
when both have played or the window closes. The domain is the keyed logic
instrument — twelve items of the form a seed yields, the solo test's first
twelve — because it is the one domain that gives a **graded** per-person
score and not only a win, which paper 8 §4.1 prices at roughly an order
of magnitude fewer encounters per reading, and because the solo test at
fixed difficulty is exactly the anchor contest §3.1 needs to pin a
comparison network to an absolute scale.

Only the **assigned** arm exists (paper 8 §5's measurement arm): the
matcher picks the opponent and draws the stake; the player accepts or
declines the offer and cannot change either. Stakes are **points, never
money** — 10 or 50 a contest, at most 200 a week, from a balance that
starts at 500 — which keeps "verified entrants for staked play" and every
gambling regime out of scope. A chosen-stake, chosen-opponent arm (§4.4)
is a later build, and every record carries `arm` so the two are never
pooled.

## 2 · The record, and what each field is for

`v2_contests/{cid}` — public once scored (D98), the two participants'
while offered or open, written by nobody but the callables.

| Field | What it is | Why it is recorded |
| --- | --- | --- |
| `a`, `b`, `aName`, `bName` | the pair | the relation's members (G7) |
| `domain`, `arm`, `gv`, `items` | logic · assigned · generator version · 12 | every reading is labelled by arm and era; a 12-item score never mixes with a 25-item one |
| `stake.level`, `stake.points` | 0 or 1 · 10 or 50 | §4.1's stakes contrast is the difference between the two levels; drawn at offer time so it cannot be raised after a loss (§4.4) |
| `match.rule` | `band` · `blind` · `band-empty` | the matcher's decision — G2's atom carries the decision, not only the outcome |
| `match.pool`, `match.p` | candidates the rule drew from · 1/pool | the realised probability of THIS pairing, so the pairing propensity can enter an estimator (G1 §5's steering rule) |
| `match.blind`, `role` | whether the draw read the logic score | G1's roles: a coupling between contest performance and the logic score is estimated on blind pairings only |
| `offeredAtMs`, `offerExpiresAtMs`, `sideA/B.acceptedAtMs`, `.declinedAtMs` | the offer and each side's answer | the offer is randomized, acceptance is chosen: the intention-to-treat on the offer is what is identified (§6) |
| `status` | offered · declined · expired · open · scored | expiry and decline are outcomes, kept, not deleted |
| `openedAtMs`, `windowEndsMs` | both accepted → 24 h to play | a side that has not played when it closes forfeits: an outcome, recorded (§6's dropout discipline) |
| `scoreA/B`, `durationA/B`, `seed` | written at settlement | sealed from each other until then — game timing, the duel discipline; the seed is disclosed like the logic test's |
| `result.outcome`, `result.transfer` | a · b · tie · forfeit-a · forfeit-b · none · points moved | the transfer is capped by the loser's balance: a stake is never a debt |

`v2_contest_attempts/{cid}` — nobody reads it: the seed while either side
has not played, and each side's `startedAtMs`, `deadlineMs`, `scoredAtMs`,
`score`, `durationMs`. The other side's sitting is the score the seal
holds back.

`v2_users/{uid}/contests/{cid}` — owner-only, server-written: what this
person was offered and how it went, without the seed and without the
other side's score before settlement. The client lists these; it never
queries `v2_contests`.

`v2_users/{uid}.contest` — server-written, client-immutable and
client-unremovable (a deletable map would reset a balance): `points`,
`n/w/l/t`, `rating` (the verified logic percentile the matcher reads),
`openCid`, `exposure[]` (stake booked inside the last week), and `optIn`
— the specific consent, with its on time and, if withdrawn, its off time,
kept rather than erased because "consented from X to Y" is what an offer
made at Z is checked against.

## 3 · Transitions and callables

1. **Consent** — `contestOptInV2({on})`. Server-written, so the whole
   summary keeps one writer.
2. **Offer** — the daily sweep `contestSweepV2` (09:05 UTC) pairs
   everyone opted in, verified on the logic test, not in an open contest
   and under the exposure cap: a quarter of pairings blind (uniform over
   the pool), the rest within ±20 percentile points of the player's
   rating, falling back to a labelled uniform draw when the band is
   empty; a stake drawn per contest with equal probability; four writes
   per offer. The sweep first expires offers past their day and settles
   open contests past their window (forfeits).
3. **Answer** — `contestRespondV2({cid, accept})`. Both accepted opens
   the 24-hour window and books the stake as exposure on both sides.
4. **Sitting** — `contestStartV2({cid})` returns twelve items with the
   answer index withheld and a deadline that never passes the window's
   end; a second call resumes with the same deadline.
   `contestSubmitV2({cid, picks})` scores against the stored seed inside
   the deadline, returns the player's own score, and settles the contest
   if the other side has already scored.
5. **Settlement** — both scored: the higher score takes the stake, a tie
   moves nothing; one scored after the window: the other forfeits;
   neither: nothing moves. Both summaries fold, both index rows and the
   contest are rewritten, the seed is disclosed.

Every callable demands App Check (`check:appcheck`); the rules refuse
every client write at every one of these paths (`test:rules`).

## 4 · The first reading

`stakesContrast` in `functions/src/contest.ts` — a person's mean score at
the high stake minus at the low, with the standard error the two samples
support, null until each level has two contests — is paper 8 §4.1's
stakes slope in its first form, as a pure fold. Publishing it, and the
coupling between contest performance and the logic score on the blind
pairings, is the nightly fold on `WORKLIST.md`.

## 5 · Deferred, and where each waits

- **The surface** — `VISUAL-REQUESTS.md` § 2; the status word in
  `AXIOMS.md` is the owner's (`OWNER-LIST.md`).
- **A push on offer** — a fifth notification kind; the owner's call.
- **The chosen arm** (§4.4: re-entry, quitting, raising the stake,
  avoiding an opponent) — needs the player choosing, which the assigned
  arm forbids by design.
- **The mismatched-side budget** (§6) — every contest records whether it
  was a blind draw; capping them per person is a design number.
- **A rating that moves** — today the matcher reads the anchor (the
  logic percentile); a comparison-network fit against the anchors is the
  fold that would give a contest rating with an absolute scale (§4.7).
- **Reported against enacted** (§4.2) — needs the bank's competitiveness
  and persistence items joined to contest behaviour in a bivariate latent
  model; a fold, once contests exist.
- **An e2e leg** on the emulator — `WORKLIST.md`.

## 6 · Cost

One query over opted-in profiles and four writes per offer, daily; three
document reads per callable in a transaction. Nothing here reaches
`docs/COSTS.md`'s three lines at any opt-in count the app has seen.
