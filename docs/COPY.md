# Copy — visual > word > sentence > sentences

The owner's rule, in the owner's order. Prefer a **visual** to a **word**,
a word to a **sentence**, a sentence to **sentences**. It is a preference
and not a law — plenty of things on this tab can only be said — but the
burden of proof runs one way: a sentence has to earn its place against the
shorter thing that would have done.

This file exists because the app grew the same four faults on four
different screens, and naming them is cheaper than finding them again.
D181 is the pass that produced it; D182 is the one that moved the
disclosures out. Neither is a style opinion — both came from a screenshot
of a real screen with more words than readings on it.

## 1 · The four shapes

Almost every cut in D181 was one of these. When copy grows back, it grows
back as one of these.

### A legend for a visual the reader is looking at

The purest case, and the one to delete without discussion.

| Was | Under |
| --- | --- |
| "the fuller the ring, the closer" | a match ring whose fullness *is* the likeness |
| "your own type is marked in the accent" | a bar list with exactly one row in the accent |
| "each question someone answered counts once" | a histogram whose bars are labelled |
| "Answers, not people" | a figure whose own kicker reads *answers with an age* |

A legend is for an encoding the reader cannot infer — `dashed = answers
only` stays, because nothing about a dashed ring says what it means.
A caption restating a shape you are looking at is not a legend.

### A noun the screen already carries

Compare said *"against Oslo"* under a ruler, a tab bar and a header that
all say Oslo. Explore repeated the selected chip's own name on every row
beneath it, while the chip sat above them lit in the accent.

Count the copies before adding one. The stop names itself; the tab names
itself; the chip names itself.

### A clause restating its own first clause

> Nobody has answered enough of the same questions yet. **This fills in as
> you answer more.**

The second sentence is the whole message and the first is its setup. Ship
the second.

### An instruction for a control sitting directly underneath

The city ask explained *"use your location or search the list"* above a
picker offering exactly those two things, and *"you can change it any time
in your profile"* — true of every anchor, and belonging where anchors are
edited.

## 2 · Fragments become glyphs, where a glyph is honest

A ratio the eye has to assemble out of words is a ratio said twice.

| Was | Is |
| --- | --- |
| `5 of 6 the same` | `5/6 alike` |
| `You went with the majority in 3 of 8, against Oslo. Least typical first.` | `3/8 with Oslo · least typical first` |
| `{picked} are 30 points more likely to say Yes` | `30 pts more likely to say Yes` |
| `of the 12 sampled voters in the world with a Big Five result` | `12 typed in the world` (definition in a `title`) |

Set `fontVariantNumeric: "tabular-nums"` on anything that reads as a
figure. A `title` is a fine home for a definition the curious want and the
other twelve rows should not pay for — findable, not free.

## 3 · What the rule does NOT license

This is the half that matters, and the half a brief like "there is too
much text" will not say out loud.

**A claim is not a word count.** Three kinds of copy hold at full
strength, and one got *longer* to read:

- **Consent and disclosure.** Near's opt-in notice keeps every fact — the
  square and its size, that nobody reads it, what the people in it see,
  the three-hour linger, what off does. D182 put it behind a two-word
  `details`; it did not drop a clause. **Moving a disclosure one tap away
  and deleting a clause from it are different edits.** Do one without
  meaning the other.
- **Honesty qualifiers that name a limit.** `counts, not shares`;
  `dashed = answers only`; `unranked: …`; `Nobody is named here`.
  Shorten them. Do not remove the limit — a reading whose basis is
  unstated is the fabrication D1 forbids, wearing fewer words.
- **The blunt sentence.** *Your answers are public* stays open on the
  account panel, unlinked and untapped, because a user learning it from a
  stranger quoting their vote back at them is the failure that panel
  exists to prevent.

**A qualifier is redundant only when something else on screen says it.**
Two of D182's cuts qualify and it is worth being precise about why:

- "Answers, not people" went because the KICKER says *answers with an
  age* — the unit is printed on the number it qualifies, which is the
  only place a unit belongs.
- "Nobody is named here" went because the stop's closing line says *The
  field names nobody — People does*, which is the same promise plus the
  half a caption could not carry: where the names are.

Neither was dropped for being long. Both were dropped for being second
copies, and a second copy of a promise is not twice the promise — it is
the shape that let the takes line claim namelessness while the takes panel
printed every author's name (D106).

## 4 · Before you delete a sentence

1. **Grep for it in tests.** 46 assertions moved in D181 and none was
   deleted. Every one pinned a *claim*, and the claim survived every
   rewording. If a test asserted the sentence rather than the claim, fix
   the test to assert the claim — `Compare stops calling a tie the
   majority` matched `/majority in\s*0\s*of/` and now reads the fraction
   at the head of the line, so the next rewording does not break it.
2. **Ask what enforces it.** If `firestore.rules` or a Cloud Function
   makes it true, it is a promise, not copy. Promises live in
   `web/privacy.html` and are gated by `check:policy-claims`. Deleting one
   from the app is fine; deleting one from the product is not.
3. **Check the other copy.** `check:public-copy` catches a retired promise
   reappearing. `check:policy-claims` catches a live promise vanishing.
   Neither catches a promise left behind by a change three commits away —
   which is exactly how the policy page came to say "kilometre-sized"
   after D175 shrank the grid five-fold.

## 5 · Two mechanical traps

- **`\uXXXX` in JSX *text* is not an escape.** It renders as the six
  literal characters. Two sites shipped this way and both were live; the
  quoted `'…'` on the same line *is* a real escape and was always
  fine, which is why they survived review. Grepping for `—` will not find
  them — strip quoted strings first, then look at what is left. Not gated:
  two sites is not a class, and a gate that fires on the legitimate
  spelling trains people to ignore it.
- **A `details` is better than state.** The tap costs no JavaScript, it
  survives a re-render, and a screen reader gets a real disclosure widget
  rather than a `div` pretending. Closed by default is what makes a
  disclosure "a word".
