# State — where the project is, generated

**Status: tree — generated, do not hand-edit.** `node scripts/state.mjs --write`.
Every figure here is read from the tree at generation time, so this page
cannot go stale in the way a hand-written summary does — it can only be
out of date, which the stamp below says. It holds no reasoning of its own;
where it and a source disagree, the source is right.

Generated **2026-09-11**.

## The two bills

Kept side by side because they are about 410x apart and only one of them
used to have an instrument (D-2026-09-09f).

| | Figure | Basis |
| --- | ---: | --- |
| Running the app (modelled) | $28.66 / month | 2 measured actives, 2026-08-25 |
| Building the app (measured) | $390 / day | measured 2026-09-03, 8 days ago |
| Usage guard | stale | allowance $50/month |
| Program guard | ok | allowance $450/day |

Largest single line: **InSight night worker** — $2,325.68 in the measured window.

## What there is to answer

| | Count |
| --- | ---: |
| Questions in the bank | 1,417 |
| Daily deck runway | 99 days |
| Answers counted | 107 |
| Unpromoted | 38 |

**Answers counted** is the one number to read first, and the reason this
page leads with cost: a program is only expensive relative to what it has
produced.

## What is waiting on a person

| List | Open | Ticked |
| --- | ---: | ---: |
| [`OWNER-LIST.md`](OWNER-LIST.md) — only the owner can | 138 | 3 |
| [`MERGE-LIST.md`](MERGE-LIST.md) — approvals | 4 | 0 |
| [`WORKLIST.md`](WORKLIST.md) — items tagged by account | 20 | 39 |

A tick is the mechanism the program runs on (`PROGRAM-PLAN.md` §2.4), so
the ratio in the OWNER-LIST row is the throughput of the whole ask
channel — including every D334 privacy question a routine deferred into it.

## What is watching

| | Count |
| --- | ---: |
| `check:*` gates | 50 |
| Cloud Functions | 46 |
| …with an alert over them | 3 |
| Decision records | 457 (29 amendments, 8 dated) |

## Where to go next

- [`ORIENTATION.md`](ORIENTATION.md) — the map: every document, gate and
  directory, and which describe the tree versus a proposal.
- [`OWNER-LIST.md`](OWNER-LIST.md) — what is blocked on a decision.
- `npm run pulse` — the console this page's figures come from, rendered.
- `npm run pulse -- --check` — the operator gate: runway, staleness, both bills.
