# CHARTER.md — the cadence correction (a paste, 2026-09-04)

**What this is.** The theory lanes' contract lives at the root of the
orphan `axiom-theory` branch, and no routine may amend it
(`AXES-PLAN.md` §10, `AXIOM-THEORY.md` § The read budget). Its §2 and
§10 describe a cadence the account stopped running on 2026-09-03: the
crons in the §10 table are the every-other-day ones D359 replaced with
a four-day cycle, and D363 has now halved that again to an eight-day
one. Twelve lanes read that file every run, so the record they read is
wrong about their own schedule.

This file is the wording, so applying it is a paste rather than a
drafting job. Nothing here changes what a lane does — only what the
record says about when it runs. Trigger ids are unchanged; the live
ones are in `docs/ROUTINES.md` § The theory lanes and were read back
from `list_triggers` on 2026-09-04.

**Three replacements.**

## 1 · §2's opening sentence

Replace:

```
Twelve recurring lanes — eleven every other day and the review lane
every second night (§10), each firing as a fresh session spawned
through the dispatcher — each owning one workspace directory.
```

with:

```
Twelve recurring lanes — every one of them, the review lane included,
every eighth day (§10), each firing as a fresh session spawned
through the dispatcher — each owning one workspace directory.
```

## 2 · §2's Review row

In the lane table, the Review row opens *"The scoring lane (§12,
chartered 2026-09-01 on the owner's direction): every second night,
every other lane's latest work scored…"*. Replace `every second night`
with `every eighth night`. §12's own opening quotes the owner's
words — *"every second night"* — and stays exactly as it is: it is a
quotation, and the cadence dial has moved under it twice since with
the owner's word each time.

## 3 · §10's cadence paragraph and table

Replace:

```
**Cadence: every lane every other day (the owner's re-pace,
2026-08-25)** — subject axioms on odd UTC dates, reader lanes on even
dates, so a reader always works on subject output at most a day old;
five to six runs a day in total across the eleven — the ties and
interests lanes (added 2026-09-01) take the odd-date afternoon slots,
so central still reads them at most a day old. **The review lane
(§12, added 2026-09-01) runs at 02:02 UTC on odd dates** — six hours
before the earliest lane slot, so every lane's next run reads feedback
that already covers its latest landed run: the subject lanes the same
morning, the reader lanes the next.
```

with:

```
**Cadence: every lane every eighth day** — re-paced three times, each
on the owner's word: 2026-08-25 off the three-hourly trial to every
other day, 2026-09-03 to a four-day cycle (D359, on cost), 2026-09-04
to an eight-day one (D363, *"reduce the theory production"*). The
cycle is four consecutive dates and then four clear ones, and it keeps
the alternation the odd/even split gave: subject axioms on the cycle's
1st and 3rd dates, reader lanes on its 2nd and 4th, so a reader still
works on subject output at most a day old. About 1.5 runs a day in
total across the twelve. **The review lane (§12) runs at 02:02 UTC on
the cycle's first date** — seven hours before that date's earliest lane
slot, so every lane's next run reads feedback that already covers its
latest landed run. A date-stepped cron restarts at the 1st, so the gap
across a month end is 4 to 7 days rather than 8; that is the scheme's
artefact at an eighth of its old rate, and naming it is the fix.

| Lane | Trigger id | Schedule (UTC) | Dates |
| --- | --- | --- | --- |
| Review | `trig_01P1aDKgDhab3yLeCrYn3TAt` | `2 2 1-31/8 * *` | 1, 9, 17, 25 |
| Genetic | `trig_01Vx4tmhq3EVwySCjSESjrrW` | `2 9 1-31/8 * *` | 1, 9, 17, 25 |
| Body | `trig_01AopNS2HAVVHFYk99w7oJv7` | `2 10 1-31/8 * *` | 1, 9, 17, 25 |
| Database | `trig_01VDccEWW215SDJPE3ujHciL` | `2 8 2-30/8 * *` | 2, 10, 18, 26 |
| Map | `trig_014HZHQYSpjc4xQGfbyAgjXw` | `2 9 2-30/8 * *` | 2, 10, 18, 26 |
| Pattern | `trig_01AsWK9g327DuHD6XatbBAmR` | `2 10 2-30/8 * *` | 2, 10, 18, 26 |
| Questions | `trig_01JeVZmgC9FB78L5VRxGQJ9L` | `2 11 3-31/8 * *` | 3, 11, 19, 27 |
| Tests | `trig_01URyaqWz9WgLdRJVDn6z8hX` | `2 12 3-31/8 * *` | 3, 11, 19, 27 |
| Ties | `trig_01PjG2bW3zK3GTgnfaYTjQky` | `2 13 3-31/8 * *` | 3, 11, 19, 27 |
| Interests | `trig_01HUHXnMT6xAiEaurLxeBJNq` | `2 14 3-31/8 * *` | 3, 11, 19, 27 |
| Graph optimizer | `trig_016uPKLAXGriwC7ukQyRRmUG` | `2 11 4-30/8 * *` | 4, 12, 20, 28 |
| Central | `trig_017ZfLe6VNmVGZ677qqvkqgm` | `2 12 4-30/8 * *` | 4, 12, 20, 28 |

Central still sits last in its group so it reads the freshest axiom
work. Three of the twelve records — review, ties and interests — carry
no model where the other nine carry `claude-fable-5-1`; because every
lane is bound to the dispatcher, that field governs the dispatcher's
turn rather than the lane run it spawns, and the dispatcher runs
`claude-fable-5-1`. Only the owner sets a Routine's model.
```

**What is deliberately not in this paste.** The read budget (charter
§3's orient step) — that is a separate amendment, worded in
`docs/AXIOM-THEORY.md` § The read budget and still waiting on the same
signature. The two are independent: this one corrects a record, that
one changes how a lane works.
