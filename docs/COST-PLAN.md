# Cutting the bill without cutting the product

An implementation plan, not a decision to build. Written 2026-08-15
against `ddb1624`, after a re-read of [`COST-REDUCTION.md`](COST-REDUCTION.md)
asked a question that page does not answer: *what is the most money that
comes off the bill without the product getting worse?*

[`COSTS.md`](COSTS.md) says what this costs.
[`COST-COMPARISON.md`](COST-COMPARISON.md) says whether that is a lot.
[`COST-REDUCTION.md`](COST-REDUCTION.md) prices every lever somebody has
thought of. This says **how to build the ones worth building, in what
order, and what each one could take away** — the last part in its own
section at the bottom, because it is the half that decides whether any of
this is a good idea.

D7 still governs the timing. Nothing here except Phase 1 should be built
before the trigger COST-REDUCTION.md already wrote down (~10 k DAU).

## Why this is not COST-REDUCTION.md's plan

That page was written the day before D129 and its shape is pre-D129: two
regimes, `social` at the small end and `fanOut` at the large end, wanting
different fixes. **D129 removed the fan-out**, and what is left is one
regime at every size:

| reads/user/day | boot | topUp | reseed | fanOut | reattach | rules | server | **social** |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 50 → 500,000 DAU | 21 | 2 | 3 | 3 | 28 | 7 | 17 | **354** |

`social` — the D98 surfaces reading other users' answers — is **81% of
the read bill at every size the model covers**, and it is flat per user,
so no amount of growth changes the proportion.

COST-REDUCTION.md's only offer against it is trimming
`VOTER_FETCH_CAP`, `KINDRED_QUESTIONS` and `CIRCLE_ANSWER_CAP`, and its
recommendation 5 correctly says **don't**: those are the only levers on
that page that thin a Mirror surface, and they are the worst ratio of
product cost to money in the repository.

The premise both share is that the cap is what costs money. It is not.
**What costs money is documents read per open**, and the cap is only one
of its two factors:

```
who-voted open  =  VOTER_FETCH_CAP answer docs  +  up to that many profile docs
```

Halving the cap halves the cost and halves the sheet. Serving the same
200 voters from **one precomputed document** removes ~99% of the cost and
changes nothing a user sees. That is denormalisation, it is the standard
answer to exactly this shape, and it is priced nowhere in these docs.

## What it is worth

| | reads/user/day | 5 k | 50 k | 500 k |
| --- | ---: | ---: | ---: | ---: |
| as built | 435 | $44 | $472 | $4,774 |
| Phase 2 · voter page doc | 231 | $26 | $291 | $2,965 |
| Phase 3 · circle digest doc | 285 | $31 | $342 | $3,474 |
| **Phase 2 + 3** | **82** | **$14** | **$161** | **$1,665** |
| + Phase 4 client trims | 55 | $11 | $136 | $1,412 |
| + Phase 5 single region | 55 | $5.66 | $71 | **$757** |

**−70% at every size, with nothing removed from the product** — against
−55% for COST-REDUCTION.md's path A/B, which removes three things.

> **These figures do not yet have a gate under them, which is why Phase 0
> exists.** They come from a scratch run over `scripts/cost-arith.mjs`
> using `socialTerms` overrides — `voterCap: 1` and `circleAnswerCap: 1`
> as proxies for "documents read per open", with the extra writes priced
> through the same free tier — and that proxy abuses two constants that
> mean something else. A number quoted in prose and kept current by
> intention is the one documentation error this repo keeps re-committing
> (D39, `check:figures`). Treat the table as an estimate until Phase 0
> lands, and do not copy it anywhere else in the meantime.

## Phase 0 · Make the plan measurable

Half a day, ships nothing, and it goes first for the reason the block
above gives.

- `scripts/cost-arith.mjs`: give `socialTerms` overrides in the units of
  the change — something like `voterDocsPerFetch` and `circleDocsPerMember`
  — instead of the two caps standing in for them. The caps keep meaning
  the product bound; the new inputs mean the read cost. The existing
  comment on `socialTerms` already argues for exactly this ("the overrides
  are in the CAPS' OWN UNITS rather than as ratios"), and the proxy above
  is that argument being violated.
- `scripts/pulse.test.mjs` pins the key set of `readsPerUser` and names
  the consumers that must move with it — check it still passes.
- `scripts/cost-levers.mjs`: add the three paths so `npm run costs:levers`
  prints this plan rather than this file quoting it.

The rest of this document then has one authority (`npm run costs:levers`)
instead of a table somebody has to remember to update.

## Phase 1 · The two console items

Neither is code, both are larger than everything below, and both should
happen **regardless of size or of whether the rest is ever built**.

**1a · Check the auth billing mode.** If `prvfire33` was ever upgraded to
Identity Platform, auth alone costs more than the entire rest of the bill:

| DAU | MAU (×3) | Identity Platform | whole Firestore + Functions bill |
| ---: | ---: | ---: | ---: |
| 50,000 | 150,000 | **$505/mo** | $472/mo |
| 500,000 | 1,500,000 | **$6,015/mo** | $4,774/mo |

Plain Firebase Auth is free at any size, so this is a five-minute console
check with a four-figure answer. COSTS.md finding 3 has flagged it as
unrecorded since it was written, and it is still unrecorded.

**1b · Arm App Check enforcement on the Firestore API.** Not a lever — a
hole. `check:appcheck` already guards the callables; the Firestore API is
the path it does not cover. It cannot be armed during an incident because
the soak takes days, which makes it a launch item rather than a response.

Both are already on SHIP-CHECKLIST. This plan does not move them, it just
notes that everything below is smaller than either.

## Phase 2 · The voter page doc

**The change.** `onV2AnswerCreated` maintains
`v2_question_voters/{qid}`: a rolling list of at most `VOTER_FETCH_CAP`
entries, newest first, each carrying what the who-voted sheet renders —
`uid`, `name`, `optionIdx`, the frozen `anchors` snapshot, and (see the
losses section) a compact score profile. `loadVoters` reads **one
document** instead of a capped collection-group query plus up to 200
profile reads.

Kindred is the same saving multiplied: it walks `KINDRED_QUESTIONS` voter
lists through `loadVoters`, so it drops from ~2,400 reads to 12 with no
code change of its own.

**Where the work is:**

- `functions/src/v2.ts` — the write, inside the transaction that already
  holds `privRef` and `pubRef`. Same transaction on purpose: a fourth
  document in the same commit adds no new contention *class*, and the
  ceiling is already bounded by the most contended document in it (the
  note above `CONTENTION_ATTEMPTS` makes this argument for `privRef`).
- `functions/src/v2.ts` — **`onV2AnswerUpdated` must retarget the entry
  too.** This is correctness, not cost: D86 admits an `optionIdx` edit,
  and a voter doc that misses it shows the sheet a vote the answer no
  longer holds. The `-old/+new` discipline the aggregate already uses
  applies unchanged.
- `functions/src/pure.ts` — the fold (append, dedupe by uid, truncate to
  cap) belongs here, unit-tested without Firebase, like every other fold.
- `src/v2/data/voters.ts` — read the doc; **keep the collection-group
  query as the fallback and the paging path** (see losses).
- `firestore.rules` — `allow read: if request.auth != null; allow write:
  if false;`, the same shape `v2_question_aggs` has. It publishes nothing
  that is not already public: these are answers to a world question, and
  the surface filter must exclude `group`/`duo` so sealed duel answers
  cannot ride in.
- `docs/data-inventory.md` — a row. `check:data-inventory` is a *name*
  gate on every `match` block in the rules and will fail the build without
  it (D130).
- `functions/src/index.ts` — `deleteAccount` phase 3d. The account's own
  answers name the qids it appears in, so the scrub is bounded by the
  user's answer count rather than by the corpus; do it before phase 1b
  deletes the answers, or collect the qids first. `firestore-tests/e2e-delete-account.mjs`
  must assert the entry is gone — the same standard the D122 handle
  registry and invitations are held to.

**Backfill.** Every question answered before this ships has no document.
Do not write a migration: `loadVoters` falls back to today's query when
the doc is absent, and the doc appears on the question's next answer. A
back day heals or it does not, and either way nothing is wrong on screen.

**Gates:** `test --prefix functions` (the fold), `test:rules` (public
read, no client write, duel surfaces excluded), `test:e2e:erasure`,
`test:unit` (the fallback path), `check:data-inventory`.

## Phase 3 · The circle digest doc

**The change.** The same trigger maintains a rolling `qid → optionIdx`
map of the answering user's last `CIRCLE_ANSWER_CAP` answers, **under
their own profile document**. Circle reads one document per followed
account instead of `CIRCLE_ANSWER_CAP` answers each: 5 reads per open
instead of up to 1,500.

Under `v2_users/{uid}` deliberately, and that is the whole design:

- no contention — each user writes only their own document, unlike the
  shared per-question docs;
- **erasure is already solved** — phase 1b's `recursiveDelete` of
  `v2_users/{uid}` covers it, so this phase adds no new erasure surface
  at all, which is the opposite of Phase 2's position;
- it is already world-readable, so the rules change is a field, not a
  collection, and `check:data-inventory` needs a row rather than a block.

Size: ~300 entries × ~30 B ≈ 9 KB, comfortably under the 1 MiB document
limit — but it is now the *reason* `CIRCLE_ANSWER_CAP` cannot rise freely,
so the constant's comment should say so.

`onV2AnswerUpdated` must move the entry here too, for the same D86 reason.

## Phase 4 · The two client trims already on the books

Both are described in COST-REDUCTION.md, neither is built, and after
Phases 2–3 they are the two largest remaining terms.

- **Refresh only today on foreground.** `reattach` is `bgCycles ×
  DECK_DAYS` = 28 reads/user/day and becomes 4. The six back days are
  answerable but barely move; they can refresh on boot instead of on
  every foreground.
- **Serve the bank off Hosting.** Takes `reseed` to 0 and makes cold boot
  faster. Days of work for ~$3/mo at 500 k DAU — build it for the boot
  time, and take the reads as change.

## Phase 5 · The region

Still worth ~half of every Firestore line forever, still nothing a user
sees — but it is **no longer a setting**. `(default)` is `nam5`, seeded,
with TestFlight testers on it, so this is now the second-database
migration in [`FIRESTORE-REGION.md`](FIRESTORE-REGION.md) option A. It
costs more every day real answers accumulate, and the trade is resilience
to a whole-region outage.

Sequenced last because it is the only irreversible item here, and doing it
after Phases 2–3 means migrating a schema that has stopped changing.

---

# What could be lost

The section that decides the plan. Every item below is a real cost, and
they are ordered by how much they would hurt.

### 1 · The similarity field and the Type cut lose their free ride — the one that could actually break something

`resolveNames` (`data/voters.ts`) fills **two** caches from one profile
read: `names` and, since D112, `scores`. Its own comment says why this is
free — "the whole profile document was already on the wire". `live.ts`
says the same from the other side: *"Candidate scores cost nothing here:
they rode along with the voter lists' name resolution."*

**Phase 2 removes that read, and the subsidy with it.** Two consumers
depend on it:

- `LiveSimilarityField` — which CLAUDE.md calls *the permanent head of the
  City/Country/World stops* and D136 moved above the tab row precisely
  because it is "the sentence the Mirror exists to say";
- the who-voted **Type cut** (D146), which groups a question's voters by
  Big Five archetype.

Both would render empty. That is not a minor loss; it is the largest
surface on the Mirror.

**Two ways out, and the plan picks the first:**

| | what it costs |
| --- | --- |
| **(a) put a compact score profile on the voter doc** | bytes, plus scores frozen at vote time |
| (b) keep the profile read for the similarity field only | gives back most of Phase 2's saving |

(a) is recommended, and its cost is worth stating plainly: **someone who
takes a test *after* answering ranks on their old scores until they answer
again.** The anchors snapshot already works exactly this way (D8) and the
app already defends that choice, so the shape is familiar — but anchors
are frozen *deliberately*, to keep history honest, and this would be
frozen *incidentally*, to save a read. Those are different arguments and
the second one is weaker.

If (a) is taken, `data/similarity.ts` must keep parsing defensively —
it already does, because the rules validate only the key set.

### 2 · Names freeze at vote time

A renamed account shows its old name on any voter doc written before the
rename, until it answers again.

The persisted profile cache already has this property — D129 shipped it
with `PROFILE_TTL_MS` and a 800-entry cap for exactly this reason, and
COST-REDUCTION.md's own table flagged "it needs a TTL" when the cache was
proposed. So this is a difference of degree, not of kind, with one real
change: **a cache expires and a denormalised copy does not.**

Mitigation if it matters: the display name is already denormalised onto
`v2_groups.memberNames`, so whatever the rename path does there is the
precedent to follow.

### 3 · The modelled saving is an upper bound

`nameFactor: 2` in the cost model is the *no-overlap ceiling* — "every
voter is a stranger whose profile must be read" — and the model's own
comment says the truth is lower because crowds overlap and the session
cache exists. D129's persisted cache already recovers part of what
Phase 2 is being credited for.

The honest claim is that Phase 2 saves **between** the modelled figure and
something meaningfully less, and nobody will know which until real open
rates exist. `sheetOpens`, `kindredViews` and `circleOpens` are guesses
about curiosity, flagged as such in `cost-arith.mjs`, and they multiply
every number in this plan.

### 4 · Paging past the cap gets a seam

Today `loadVoters` runs an ordered query, so the cursor for a "load more"
already exists — `voters.ts` says the answer to a binding cap is *to page
from that cursor, not to raise the number quietly* (the D101 rule). A
precomputed document has no cursor past its own cap.

Keeping the collection-group query as the fallback (which Phase 2 needs
anyway for backfill) keeps that door open. It is a seam, not a loss —
but it is a seam a future feature will hit.

### 5 · Circle freshness becomes eventual

Circle reads answers directly today, so it is exact. A digest is written
by a trigger, so a member who answered seconds ago may not appear until
it lands. Sub-second in practice, and the Mirror is not a live surface —
but it is one more place where the screen is a fold behind the truth.

### 6 · A back-day gap while the corpus fills

Questions answered before Phase 2 ships have no voter doc until their
next answer. With the query fallback in place nothing renders wrong; a
back day just costs what it costs today. Worth knowing, not worth
migrating.

### 7 · Not a loss, and worth saying so

**Cohort chips do not degrade.** The `anchors` snapshot on the voter doc
is a copy of the snapshot the answer already froze at vote time (D8), so
denormalising it changes nothing — the sheet shows the city someone
answered *from*, before and after, which is the property the snapshot
exists to guarantee.

**No cap moves.** `VOTER_FETCH_CAP` stays 200, `KINDRED_QUESTIONS` stays
12, `CIRCLE_ANSWER_CAP` stays 300, `FOLLOW_CAP` stays 50. Every Mirror
surface reads exactly as much as it does today. That is the entire point
of preferring this plan to COST-REDUCTION.md's path A/B, which cuts all
three.

**Nothing new is published.** Voter docs hold answers to world questions,
which any signed-in user may already read (D98); the digest holds the
owner's own answers under their own already-world-readable profile. The
three denies CLAUDE.md names — the unscored logic key, flag authorship,
the presence cell — are untouched, and the duel seal is preserved by the
same `surface` exclusion the collection-group query already uses.

---

## What this plan does not do

- **It does not fix contention.** D7's ~1 write/sec/document ceiling still
  binds at ~14,400 DAU, and Phase 2 writes a second hot document per
  question in the same transaction. Sharding, or collapsing documents, is
  a separate piece of work that COSTS.md already describes.
- **It does not touch the ~45 irreducible reads** — boot, rules, server.
  Flat, answer-driven, and not worth attention.
- **It does not trim a single cap.** See loss 7.

## When

1. **Phase 1 now.** Console-only, larger than everything else, already on
   SHIP-CHECKLIST.
2. **Phase 0 whenever the next person quotes a figure from this page.**
3. **Phases 2–3 at ~10 k DAU**, the trigger COST-REDUCTION.md already set
   — early enough to land before D7's contention wall at ~14,400, late
   enough that D7's "do not build for scale yet" still holds. At today's
   size the whole plan is worth $0.
4. **Phase 4 for the boot time**, not for the money.
5. **Phase 5 before the data gets deeper**, or accept `nam5` and record
   that as the decision.

The reassuring version: the 81% of the bill nobody has costed a fix for
turns out to be removable without touching the product, the fix is three
ordinary denormalisations, and the only genuine casualty — the similarity
field's free scores — has a known remedy with a stated price. Record the
outcome in `docs/DECISIONS.md` either way; a deferral with arithmetic is
survivable, a surprise is not.
