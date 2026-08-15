# The Firestore region, and how to change it

The one cost decision in this repository with a **deadline**, and the one
that cannot be revisited afterwards. Everything else in
[`COSTS.md`](COSTS.md) can be tuned after launch; a Firestore database's
location is fixed at creation and there is no operation that moves it.

Written 2026-08-13 against `3115783`, after D129 took the fan-out out of
the bill and left this as the largest remaining lever.

## What it is worth

`node scripts/cost-model.mjs --regional` against the default run:

| DAU | `nam5` (today) | single-region | saved |
| ---: | ---: | ---: | ---: |
| 500 | $2.12 | $1.06 | 50% |
| 5,000 | $41 | $21 | 49% |
| 50,000 | $440 | $230 | 48% |
| 500,000 | $4,448 | $2,342 | 47% |

Roughly half of every Firestore line, forever, and **no user sees anything
change**. The trade is durability: `nam5` replicates across multiple US
regions and survives one of them failing; a single region does not.

At the sizes this app will realistically see for a long time that is **~$20
a month**. Nobody should do this for the money. The reason to decide it now
is that after the decision passes, it costs a migration instead of a
setting — and it gets more expensive every day real answers accumulate.

## Why it is not simply a setting

Three facts that make this a migration rather than a toggle:

1. **The location is immutable.** [Google's own
   documentation](https://cloud.google.com/firestore/native/docs/locations)
   is explicit: once a database is provisioned you cannot change where it
   lives. There is no console button and no `gcloud` command.
2. **`prvfire33`'s `(default)` database is already `nam5`**, already
   seeded (512 questions, LAUNCH-RUNBOOK § 0.1) and already serving a
   deployed backend.
3. **Build 1 is in TestFlight** with internal testers. So this is not a
   clean slate: whatever those testers have answered lives in the
   `(default)` database, and any move either carries it or drops it.

Point 3 is the one that decides the timing. Right now the data at risk is
a handful of internal testers' answers. After a public launch it is
everyone's.

## The options

**A · A second database in the same project, in one region.** Firestore
supports [multiple databases per
project](https://firebase.google.com/docs/firestore/manage-databases), each
with its own location. Create one, point the app and the triggers at it,
re-seed the bank, delete the old one when you are satisfied. The question
bank is regenerable from `functions/src/v2content.ts`, so nothing has to be
exported — only the testers' answers, which is a decision rather than a
problem (see § What happens to the existing data).

**B · A whole new Firebase project.** Cleanest slate, and it re-does App
Check registration, the auth providers, the iOS/Android config files, the
service-account secrets and most of SHIP-CHECKLIST. Days, not hours.

**C · Stay on `nam5`.** Costs ~$20/month at real traction and buys
multi-region durability. This is a legitimate answer and it is the current
answer by default rather than by decision, which is the only thing wrong
with it.

**Recommended: A, while the app is still pre-launch.** B is not worth it
for a location change. C is worth choosing deliberately if the durability
matters more than the money — but choose it, rather than arriving at it.

## The procedure, in order

**The order is the whole thing.** Steps 1–3 are reversible and invisible to
users. Step 4 is the one that changes what the running app talks to, and
doing it before step 2 points the app at an empty database.

### 1 · Create the database (console, ~2 minutes)

Firebase console → Firestore → the database picker → **Add database**.
Pick **regional** and a region near your users (`us-central1` and
`europe-west1` are the usual defaults; the region is what you cannot change
later, so it deserves the same thought as this document). Give it an id —
`insight` reads better in a stack trace than `insight-prod-2`.

Do **not** delete `(default)` yet. It is the rollback.

### 2 · Deploy rules and indexes to it, then seed it

Rules first, then the seed — a seed against a database with no rules is a
`permission-denied` at best and an open database at worst.

**⚠ The deploy command has to change, and if it does not, it fails
silently.** See § The two silent failures below. In short: with a
multi-database `firestore` array in `firebase.json`, the sub-target form
`--only firestore:rules` exits 0, prints "Deploy complete!" and deploys
nothing. Use `--only firestore`.

Then Actions → **Seed content** → Run workflow, and read the summary:
`written: 0` means nothing landed.

### 3 · Verify the new database serves before anything points at it

In the console, confirm `v2_questions` holds the full bank and that the
rules tab shows the rules you just deployed. This is the last cheap moment
to find a mistake.

### 4 · Merge the code change

> **This list was wrong, and the correction is the useful part (D165,
> 2026-08-15).** It named three edits and missed the largest: every Cloud
> Function got its handle from bare `getFirestore()` — **37 call sites
> across seven files** — which binds to `(default)` regardless of what the
> triggers watch. With only the three edits below, a trigger fires on the
> new database and writes its aggregate to the old one. Deploy green,
> functions healthy, every answer written, nothing aggregated.
>
> Two more the list missed: `scripts/question-scorecard.mjs` hardcoded
> `/databases/(default)/` in its REST URL (a stale id makes it report an
> EMPTY corpus rather than fail, so every farm lane would quietly see "no
> signal" forever), and all three e2e harnesses build their own clients.
>
> What shipped instead: one `functions/src/db.ts` accessor behind
> `FIRESTORE_DB_ID`, so there is a single place this can be wrong, and
> `check:fn-runtime` cross-reads the expected id from **firebase.json**
> and asserts every trigger matches it. Cross-reading matters: omitting
> the trigger option does not leave `database` undefined, it fills in the
> literal `"(default)"` — measured — so "is it set?" is dead code and "do
> they agree?" passes when *both* triggers have lost it.
>
> The e2e suites caught two of these, not review: the loop failed on a
> phantom `contentRev`, and the erasure suite on a null-value rules error
> four layers from the actual mistake (a bare `adminFirestore()` writing
> the question to one database while the client answered in another).

Three edits, none of them large, all of them load-bearing:

- **`src/lib/firebaseImpl.ts`** — `initializeFirestore(app, { localCache:
  persistentLocalCache() })` takes the database id as its third argument.
- **`functions/src/v2.ts`** — **both** Firestore triggers,
  `onV2AnswerCreated` and `onV2AnswerUpdated`, need `database: "<id>"` in
  their options object. They default to `(default)` and will otherwise
  never fire. See § The two silent failures.
- **`firebase.json`** — the `firestore` key becomes an array, one entry per
  database, each with its own `database`, `rules` and `indexes`.

Deploy, then answer one question on a real device and watch the count move.

> **Steps 1–4 executed 2026-08-15 (D165).** `insight` /
> `europe-west1`; the deploy and the seed both ran themselves off the
> merge (firebase-deploy on push to main, seed-content on that workflow
> completing), and the bank was verified in the console. **Step 5 is the
> only one left, and it is not urgent** — a week of `(default)` costs
> nothing and is the only way back.

### 5 · Delete `(default)` when you are satisfied

Not before. It costs nothing to keep for a week and it is the only way
back.

## The two silent failures

Both of these deploy green, run green, and are invisible until someone
audits a log or a user notices the Mirror has stopped moving. Neither is
hypothetical — the first has already happened in this repository, to a
different rules file.

### The deploy sub-target

`.github/workflows/firebase-deploy.yml` deploys with:

```
--only "firestore:rules,firestore:indexes"
```

That is correct today, with one default database. With the multi-database
array config it becomes the
[silently-does-nothing form](https://github.com/firebase/firebase-tools/issues/10447):
*"exit with code 0 and print 'Deploy complete!' but deploy nothing"*. The
workaround is the non-sub-target form, `--only firestore`, which deploys
every configured database's rules and indexes.

The issue is fixed (PR #9770) and this repo pins `firebase-tools ^15.24.0`,
newer than the affected 15.10.0 — so it may not bite. **Do not rely on
that.** A caret range resolves to whatever the lockfile holds, the failure
mode is silence, and the subject is the file that decides who can read
whose answers.

**This exact class of bug has already cost this repo a rules file.** The
storage step carries the scar in a comment: `--only storage:rules` errored
under `continue-on-error` on every deploy, and *"storage.rules had never
actually shipped from here"* until run 30643945632's log was audited.

Whoever does step 4 should extend `npm run check:deploy-targets` to assert
the firestore deploy uses a form that reaches every configured database.
That gate already exists for exactly this shape of failure — its own header
says *"Same silent shape as storage.rules being configured and deployed by
nothing."*

### The trigger's database option

`onDocumentCreated` and `onDocumentUpdated` bind to the `(default)`
database unless told otherwise. Miss the `database:` option and:

- the deploy succeeds,
- the functions are healthy,
- every answer still writes,
- and **nothing aggregates** — no ledger event, no private aggregate, no
  published mirror.

There is no error, because nothing failed. `monitoring/onV2AnswerCreated-errors.json`
watches for the trigger *erroring*; a trigger that is never invoked raises
nothing. The Mirror simply stops moving, and the first signal is a human
noticing that today's count is stuck at zero.

Pin it with a test in the same commit. `scripts/check-fn-runtime.mjs`
already reads deployed options off the built output (`__endpoint`), which
is the shape to copy.

## What happens to the existing data

The question bank is regenerable — it is `functions/src/v2content.ts` and
the seed workflow, so it costs one run.

The testers' answers are not. Options, in the order they are usually
right for a pre-launch app:

1. **Let them go.** Internal testers, pre-launch, and the answers are a
   handful of taps against a bank that has been reseeded repeatedly
   anyway. Tell the testers, and treat it as the last free reset.
   **CHOSEN 2026-08-15 (D165), and the reason is stronger than the
   general case: the owner is the only person who has answered anything.**
   There are no testers to tell.
2. **Export and import.** Firestore's [managed
   export/import](https://firebase.google.com/docs/firestore/manage-data/export-import)
   moves collections between databases. It is the honest path if any real
   usage has accrued, and it is also a rehearsal for a restore.

Whichever you pick, note that `deleteAccount` and the erasure e2e suite
address one database. If both databases exist for a while, an erasure run
against the new one does not reach data left in the old — which is another
reason step 5 (delete `(default)`) is a step rather than an afterthought.

## What this document deliberately does not do

**No code.** The client, trigger and `firebase.json` changes are written
down above but not implemented, because merging them before the database
exists points the running app at an empty database — and a PR that must not
be merged until an unrelated console action happens is a trap sitting in
the queue. The code belongs in its own PR, opened when step 1 is done.

**No decision.** Recorded here with its arithmetic and its deadline so the
choice can be made rather than defaulted into. If the answer is C — stay on
`nam5` and buy the durability — that is a fine answer, and this page's job
is to make sure it was an answer.
