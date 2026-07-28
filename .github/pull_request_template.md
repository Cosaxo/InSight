## What changed, and why

<!-- The why matters more than the what — the diff already says what. -->

## Checks

- [ ] `npm run lint` and `npm run check:globals` pass
- [ ] Tests pass for whatever this touches — `test:unit`,
      `test --prefix functions`, `test:rules`, `test:e2e`
- [ ] New behaviour has a test that **fails without the change**

## If this touches the privacy surface

Skip if it doesn't. If it does, none of these should be answered from
memory:

- [ ] **`firestore.rules` / `storage.rules`** — every change has a matching
      assertion in `firestore-tests/`, including a *negative* one
- [ ] **Answers stay owner-only and create-only** (D5); duel answers stay
      unreadable until the reveal doc exists
- [ ] **k-floors** — no public document can expose a count below its floor,
      and none carries per-vote timing
- [ ] **The default user is an anonymous account** (D3). Any new
      `request.auth != null` grant is reachable by anyone with a script —
      is that intended?
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
