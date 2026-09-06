## What changed, and why

<!-- The why matters more than the what — the diff already says what. -->

## Checks

- [ ] `npm run lint` and `npm run check:globals` pass
- [ ] Tests pass for whatever this touches — `test:unit`,
      `test --prefix functions`, `test:rules`, `test:e2e`
- [ ] New behaviour has a test that **fails without the change**
- [ ] Ready to merge: `main` merged in, decision numbers uncollided,
      green on the current head. The owner merges by hand (D382) — no
      lane and no Action merges anything here

## If this touches the access surface

Skip if it doesn't. If it does, none of these should be answered from
memory.

**Answers are PUBLIC (D98).** Reads are open by design — a user reading
another user's answers, profile or exact counts is the product, not a
finding. What the checks below protect is the write side, the handful of
things still closed for non-privacy reasons, and honesty about all of it.

- [ ] **`firestore.rules` / `storage.rules`** — every change has a matching
      assertion in `firestore-tests/`, including a *negative* one
- [ ] **Writes stay owner-bound.** Answers are create-only with one legal
      edit shape (D86); nobody authors under another user's uid
- [ ] **Duel answers stay sealed** until the reveal doc exists. That is
      game timing, not privacy, and it is enforced by a `surface` value
      test on the answer read rule
- [ ] **The four things that are still closed stayed closed** — the logic
      answer key (anti-cheat), flag authorship (anti-retaliation), the
      presence cell (physical safety), push tokens (a credential)
- [ ] **The default user is an anonymous account** (D3), so "any signed-in
      user" means "anyone with a script". That is intended for answers —
      is it intended for whatever this adds?
- [ ] **The UI does not claim otherwise.** If this changes who can see
      what, the account panel and `docs/data-inventory.md` say so. The
      product's rule is that the copy matches the rules — that survived
      D98, pointed the other way
- [ ] **`deleteAccount`** still erases anything this adds, including data
      about a user stored under *another* user's documents

## If this touches deploy or native config

- [ ] A new Cloud Function is in the deploy `--only` list
      (`npm run check:deploy-targets`)
- [ ] Version numbers still agree (`npm run check:versions`)
- [ ] Native config changed → `npm run sync` was run and the result committed

## Decisions

- [ ] Anything deferred or traded away is recorded in `docs/DECISIONS.md`
      rather than left in a commit message
