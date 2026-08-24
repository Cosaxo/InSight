# Supabase vs Firebase, measured against this tree

**Status: analysis. §§1–2 measure the app as built; §§3–6 describe a
backend that does not exist.** No decision is taken here and none is
proposed. This exists because "should we be on Supabase" is a question
that gets asked with generic arguments — per-read billing, SQL, vendor
lock-in — and the generic arguments are worth almost nothing against a
specific tree. What follows is the specific tree.

## 0 · Where every figure comes from

**InSight figures are reproducible.** The bill is `npm run costs`
(`scripts/cost-arith.mjs`). The counts are the commands quoted beside
them. If a number here disagrees with the script, the script is right and
this page is stale — [`COST-COMPARISON.md`](COST-COMPARISON.md)'s rule,
for its reason.

**Supabase figures are not.** They are external, checkable by nothing in
this repository, and `supabase.com` was unreachable from the sandbox this
was written in (egress-blocked), so the plan prices below are from
memory and marked `~`. **Do not let a `~` figure decide anything** —
re-read the pricing page first. The *shapes* (§2) do not depend on the
exact numbers; the crossover point does.

## 1 · The Firebase surface, counted

| Product | Where it lives | Size |
| --- | --- | --- |
| **Firestore** | `src/v2/data/live.ts` + 5 more modules | 57 read/write call sites in non-test `src/`, 42 of them in `live.ts` |
| **Firestore rules** | `firestore.rules` | 1,575 lines · 39 `match` blocks · 12 helper functions · 74 `get()` + 4 `exists()` |
| **Firestore indexes** | `firestore.indexes.json` | 27 composite entries |
| **Cloud Functions** | `functions/src/` | 23,225 source lines (27,631 with tests) · 25 callables · 2 Firestore triggers · 6 schedules |
| **Auth** | `src/lib/firebaseImpl.ts` | anonymous-first (D3), Google link/sign-in, native via `@capacitor-firebase/authentication` |
| **App Check** | `src/lib/appcheck.ts` + `functions/src/ops.ts` | DeviceCheck/App Attest · Play Integrity · reCAPTCHA v3, held by `check:appcheck` on the deploy path |
| **FCM** | `functions/src/v2social.ts` | `registerPushToken` + `getMessaging()` fan-out |
| **Storage** | `live.ts` (avatars only) + `storage.rules` | 106 rules lines, 235 test lines |
| **Hosting** | `web/` | `home.html`, `join.html`, `privacy.html`, CSP headers, apple-app-site-association |
| **Emulators** | `firestore-tests/` | 5,259 lines: 2 rules suites + 3 e2e suites |

Read the table by which rows are **not a database**: Auth, App Check,
FCM, Hosting. Those four are where the migration gets expensive (§4),
and none of them is what anyone means when they say "Supabase vs
Firebase".

## 2 · The bill, and why its shape is the whole argument

`npm run costs`, europe-west1 regional (D165):

| DAU | reads/day | Firestore | Functions | **total/mo** |
| ---: | ---: | ---: | ---: | ---: |
| 50 | 10,240 | $0.00 | $0.00 | **$0.00** |
| 500 | 178,900 | $1.16 | $0.00 | **$1.16** |
| 5,000 | 2,237,750 | $24 | $0.00 | **$24** |
| 50,000 | 22,377,500 | $260 | $2.20 | **$262** |
| 500,000 | 223,775,000 | $2,622 | $43 | **$2,665** |

Functions are a rounding error at every size. **The bill is Firestore
reads**, ~448 per user per day at steady state.

### The shape: this codebase has already been bent by per-read billing

Not a hypothetical. Four recorded decisions, all of them about the same
pressure:

- **D129** — seven `onSnapshot` listeners on the shared daily aggregate
  fanned out `DAU²/80` reads a day: **94% of the bill at 500k DAU**. The
  fix was to stop streaming. The deck is polled on a 60s timer, and the
  measured saving is **98.4% at 500k DAU**. *The app gave up realtime to
  afford Firestore.* Two `onSnapshot` sites survive in the entire
  codebase (`live.ts:1592`, `live.ts:1635`).
- **The idle detach** (`live.ts:4721`) — a backgrounded WebView kept its
  listeners and kept being billed. At `onlineMin` 60 the modelled bill at
  50k DAU goes **$1,224 → $16,689**. The fix is a 60-second grace timer
  whose length is derived from the read cost of re-attaching.
- **D34** — the seed writes only changed documents and clients page
  `updatedAt > cursor`, so a returning device pays for the delta.
- **D7** — the public aggregate publishes every 5th answer, cutting
  writes to `pubRef` by ~80%.

Plus a whole document, [`COST-REDUCTION.md`](COST-REDUCTION.md), about
getting the number down.

**Postgres does not bill per row read.** A query returning 200 rows costs
one query, not 200 reads. Every item above is Firestore-shaped work that
would not have existed — and, more to the point, the *next* item on that
list would not exist either.

### The counterweight, which is the part that decides

Supabase Pro's floor is **~$25/month**, before usage. InSight's Firestore
bill does not reach $25/month until **~5,000 DAU**.

So below ~5,000 DAU, migrating **costs** money. The saving exists only in
a band the app has not reached, and the app is currently pre-launch
(`npm run costs` line 1: 50 DAU, $0.00).

## 3 · The four things Postgres would remove outright

**1 · D7's write-contention wall.** Firestore sustains ~1 write/sec/
document. `onV2AnswerCreated` folds every answer into
`v2_aggs_private/{qid}` and `v2_question_aggs/{qid}`, so the ceiling is
~14,400 answers/day on one question — "5–10k DAU with normal
burstiness". D7 records this and explicitly declines to shard, because
sharding is an XL change. `UPDATE … SET n = n + 1` on one Postgres row
serializes too, but at three to four orders of magnitude more throughput,
and the fallback (append-only tally + rollup) is ordinary SQL rather than
new machinery.

*Caveat, because it is easy to over-claim here:* D7's publish cadence is
**no longer only about contention**. Its 2026-07-28 amendment made
`shouldPublishAgg` a k-anonymity floor on the *update stream* — per-answer
publishes disclose individual votes by arrival time. That reason survives
any migration, and Supabase Realtime has the identical property. **The
ceiling goes; the cadence stays.**

**2 · The precomputed-aggregate backend.** Firestore cannot `GROUP BY`.
That is why `functions/src/pure.ts` is 1,962 lines and 68 exported
functions of fold arithmetic, why `v2_aggs_private` / `v2_question_aggs` /
the cohort cells exist at all, and why `fitPatternsV2` is a nightly job.
In SQL, most of the Mirror's seven stops are a `GROUP BY` over `answers`
with the anchors snapshot as columns. Not all of it collapses — the fold
is also precomputed to keep *reads* cheap, and materialized views have
their own refresh cost — but the reason it **must** be precomputed goes
away, and with it a large fraction of those 23k lines.

**3 · The rules read budget.** `firestore.rules` makes 74 `get()` and 4
`exists()` calls, against a hard cap of 10 rule-evaluation document reads
per single-document request. Every access rule here is written inside
that budget. RLS predicates are SQL and may join freely.

**4 · Ceilings that fail silently.** SCALE-PLAN §2 names what trips
first: `live.ts` fetches the bank in one unpaginated query bounded by
`BANK_LIMIT`, and **"a query that hits its limit returns a short page and
no error"** — an over-sized bank serves a truncated corpus with nothing
failing anywhere. Keyset pagination in SQL is ordinary and its failures
are loud. Same for the 27 composite indexes: in Firestore a missing index
is a runtime failure, in Postgres it is a slow query.

Two smaller ones: `src/v2/data/geo.ts` uses "a plain degree grid rather
than geohash" because Firestore has no geo query — PostGIS does this
natively; and `peopleMap.ts` solves nearest-neighbour **on the device**
over published loading vectors, which is pgvector's job description.

## 4 · The five things Supabase does not have

**1 · Offline persistence — the largest hidden dependency.** One line
(`firebaseImpl.ts:153`, `persistentLocalCache()`), and the architecture
leans on it hard. SCALE-PLAN §2's finding that bank *size* "moves the
steady-state model not at all" holds "because the bank is a one-time
install cost **absorbed by the offline cache**". `live.ts:4806` counts on
the SDK's offline write queue — "a shard written on a dead train".
`supabase-js` is an online HTTP/WebSocket client. Replacing this is not a
port; it is a new subsystem (PowerSync, ElectricSQL, or hand-rolled),
and until it exists the cost model's flat curve is not flat.

**2 · App Check.** Device attestation on every Firestore and callable
request, with `check:appcheck` on the **deploy path** holding all 25
callables to enforce-or-explain. Supabase has no product here. You would
verify DeviceCheck / Play Integrity tokens yourself in an Edge Function —
and you could not put that in front of the direct-from-client PostgREST
path the way App Check sits in front of Firestore. **A capability loss,
not a port.**

**3 · Push.** No Supabase equivalent. You keep FCM — and therefore keep a
Firebase project — calling it from an Edge Function with a service
account.

**4 · `onSnapshot` semantics.** Firestore streams *query results*, with
re-evaluation and local-cache integration. Supabase Realtime streams *row
changes* off the WAL and you maintain the result set yourself. This is
the cheapest item on the list precisely because of §2: D129 already left
only 2 listeners, and Supabase Realtime bills by connection and message
rather than per delivered document, so the fan-out term that was 94% of
the bill has no Postgres analogue at all.

**5 · The emulator suite.** `firebase emulators:exec` brings up auth +
firestore + functions + storage in one command, and it is the whole of
`test:rules` and the three e2e suites. The Supabase CLI's local stack is
comparable in kind; the harness is a total rewrite.

## 5 · The migration, priced in this tree's own units

| What | Size | Security-critical |
| --- | --- | --- |
| `firestore.rules` → RLS policies | 1,575 lines, 39 blocks, 12 helpers | **every line** |
| `firestore-tests/rules.test.ts` → pgTAP or equivalent | 2,647 lines | **yes** |
| `functions/src/` → Edge Functions + SQL triggers + pg_cron | 23,225 lines, 33 entry points | partly |
| `live.ts` + 5 modules → `supabase-js` | 4,983 lines, 57 call sites | no |
| Offline cache | does not exist yet | no |
| App Check → hand-rolled attestation | new, with reduced coverage | **yes** |
| FCM | kept — Firebase project stays | no |
| 2 rules suites + 3 e2e suites + emulator harness | 5,259 lines | partly |
| Native auth plugin swap (iOS + Android) | 2 shells | no |
| Live production data migration | one-way | **yes** |

Essentially the whole backend and the whole data layer, against a bill
that is **$1.16/month**.

## 6 · What the numbers actually say

1. **Cost is not a reason today** and does not become one until roughly
   50k DAU. Below ~5k DAU it is a reason *against*.
2. **The D7 wall arrives first** — 14,400 DAU by the model's own line,
   5–10k with burstiness — and its cheap fix is sharding two documents.
   D7 priced that as XL and declined it; it is still one to two orders of
   magnitude smaller than a platform migration. **If the wall is the
   worry, shard the wall.**
3. **The real argument for Postgres is not the invoice.** It is that four
   of this backend's largest shapes (§3) exist to work around Firestore's
   query model, and that the app has already surrendered realtime (D129)
   to afford its billing model. The real argument *against* is that three
   Firebase products with no Supabase counterpart (§4) are load-bearing,
   and one of them — the offline cache — is silently holding up the cost
   model's flattest claim.
4. **If it were ever taken, the read-only analytics side goes first.**
   `fitPatternsV2`'s ridge solve, the place scorecards, the People map's
   nearest-neighbour — all of it is SQL-shaped, none of it needs offline,
   attestation, or realtime, and it can be fed by an export without
   touching the write path. That is also the hybrid, and the hybrid's
   honest cost is two backends.

One thing that is **not** a differentiator: region permanence. D165 fixed
`insight` at `europe-west1` and [`FIRESTORE-REGION.md`](FIRESTORE-REGION.md)
calls it the decision that cannot be revisited — but a Supabase project's
region is chosen at creation too. Same one-way door, both sides.
