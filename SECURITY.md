# Security Policy

InSight's product claim is that its privacy guarantees are enforced by the
backend rather than promised by the UI. Reports that show otherwise are the
most valuable thing anyone can send us.

## Reporting a vulnerability

Please report privately first — open a
[GitHub security advisory](https://github.com/Cosaxo/InSight/security/advisories/new)
on this repository. That keeps the report visible only to the maintainer
until a fix ships.

Please do **not** open a public issue for a security problem. It is the
default action otherwise, and it publishes the exploit before the fix.

Include what you have: the request or rules path, the account state it
needs (note that anonymous accounts are free and unlimited by design — see
D3), and what you were able to read or write. A failing
`firestore-tests/rules.test.ts` case is the ideal report; a screenshot is a
fine one.

Expect an acknowledgement within a week. This is a small project with one
maintainer, so a fix may take longer than that — you will be told where it
stands rather than left waiting.

## Scope

In scope, and most interesting:

- **`firestore.rules` and `storage.rules`** — anything that WRITES data
  belonging to another user. Reads are open by design since D94; writes
  are not, and a client that can author, edit or delete under someone
  else's uid is a real finding.
- **The four things that are still closed**, because each is closed for a
  reason that survived D94:
  - `v2_logic_attempts` — the unscored answer key (anti-cheat).
  - `v2_flags` — who reported a comment (anti-retaliation).
  - `v2_presence` — the uid → ~1 km cell pair. The only read path is
    `nearbyCountV2`, which returns a count. Anything that recovers a
    uid's cell is in scope and serious: the app publishes what people
    answered, not where they are standing.
  - Push tokens at `v2_users/{uid}/push/tokens` — a credential. Anything
    that reads one is in scope.
- **Duel answers before their reveal.** Sealed until the next-day reveal
  doc exists. This is a game-integrity boundary rather than a privacy
  one, and it is still a finding: reading a groupmate's pick early, or
  answering a day already revealed, breaks the mechanic.
- **The Cloud Functions callables** in `functions/src/` — authorization,
  rate limiting, invite-code minting, membership caps.
- **`deleteAccount`** — anything it fails to erase, including data about a
  user living under another user's documents.
- Anything reachable with a scripted anonymous sign-in that should not be.

**Explicitly NOT a vulnerability (D94):** one user reading another
user's answers, anchors, display name, test results or exact cohort
counts, at any group size, including on political and other sensitive
questions. That is the product. It is documented in the account panel,
the README and `docs/data-inventory.md`.

Out of scope: the demo/mock mode data (it is synthetic by design — see D1),
denial of service through volume alone, and findings that require a
compromised device or a modified client binary.

## Known weaknesses

Not vulnerabilities to report — we already know, and they are tracked:

- ~~**FCM token binding.** Push tokens are written by the client into its own
  profile document, and rules cannot verify that a token belongs to the uid
  storing it.~~ **Largely closed.** Registration moved behind the
  `registerPushToken` callable (`functions/src/v2social.ts`) and
  `firestore.rules` now refuses `fcmTokens` from clients outright — the key
  stays in `hasOnly` so profile merges keep working, but a client can
  neither introduce nor change it. What binds token→uid is App Check
  attestation, **not** cryptographic possession: inside the attested app the
  only obtainable token is the device's own. If a possession proof is ever
  warranted the shape is a nonce sent to the token and echoed back, and the
  callable is where it goes.
- **App Check enforcement** is not yet enabled console-side, so the
  attestation the callables expect is not yet required of clients.
- ~~**Reveal membership** is currently evaluated against a group's
  *current* members, so joining a group exposes its past reveals.~~
  **Closed.** Both deploys have shipped: `revealGroupDay` writes a
  `members` snapshot, and the read rule now gates on that array rather
  than the parent group's roster. A later joiner is denied; a member who
  leaves keeps the days they played. Two rules tests pin both directions,
  and both fail against the old rule.

If you can do something worse with one of these than the description
admits, that is very much worth reporting.

## Dependency advisories

**Runtime is clean and that is the number that matters.**
`npm audit --omit=dev` reports **0 vulnerabilities** — nothing shipped in
the app bundle or in `functions/` carries an open advisory. That is the gate
`ci.yml` runs, and the one that says something about users.

A full `npm audit` (dev included) reports ~30, and they are not going to
zero. Every one is transitive through **`eslint`** or **`firebase-tools`** —
build and emulator tooling that never reaches a device — and npm's proposed
remedy for the three direct packages is a **downgrade**, not an upgrade:

| package | installed | `npm audit fix --force` would install |
| --- | --- | --- |
| `firebase-tools` | 15.x | **14.23.0** — older; 15 is what the Java 21 emulator setup needs |
| `firebase-admin` | 14.x | **10.3.0** — four majors back, predates the modular API `functions/src/` uses |
| `eslint` | 9.x | 10.8.0 — a real major, unrelated to any runtime risk |

Taking that trade would break the emulator suites and the functions build to
silence advisories in code that never runs in production. So it is not
taken. What *is* taken is anything fixable without moving the toolchain:
`vitest` is held at ≥3.2.7 and `tar` is pinned by a `package.json`
`overrides` entry, which is what cleared both criticals.

**Why `tar` is an override rather than a bump.** It arrives underneath
`firebase-tools`, so there is no direct dependency to raise. The override
pins 7.5.22 across the tree; it is a patch move inside the same major, so
every consumer's range is still satisfied.

**Why the toolchain is not upgraded opportunistically.** `npm audit fix`
pulls `rolldown` from `1.0.0-rc.15` to `1.2.1`, which re-shapes the build
into 13 chunks instead of 18 and pushes the main chunk from 932 KB to
1259 KB — over `check:bundle`'s per-chunk ceiling, with the *total* barely
moving. That is a bundling change wearing a security patch's clothes, and it
belongs in its own change with its own before/after numbers.

Re-check this table whenever `firebase-tools` or `eslint` ships a major, and
delete a row the moment its advisory clears upward instead of downward.
