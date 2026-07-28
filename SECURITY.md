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

- **`firestore.rules` and `storage.rules`** — anything that reads or writes
  data belonging to another user. Answer documents are meant to be
  owner-only forever; group and duo answers are meant to be unreadable
  until a Cloud Function materializes the reveal.
- **The k-anonymity floors.** Public aggregates must never expose a count
  below their floor, and must never carry per-vote timing that would
  re-identify a respondent.
- **The Cloud Functions callables** in `functions/src/` — authorization,
  rate limiting, invite-code minting, membership caps.
- **`deleteAccount`** — anything it fails to erase, including data about a
  user living under another user's documents.
- Anything reachable with a scripted anonymous sign-in that should not be.

Out of scope: the demo/mock mode data (it is synthetic by design — see D1),
denial of service through volume alone, and findings that require a
compromised device or a modified client binary.

## Known weaknesses

Not vulnerabilities to report — we already know, and they are tracked:

- **FCM token binding.** Push tokens are written by the client into its own
  profile document, and rules cannot verify that a token belongs to the uid
  storing it. A stolen token could be planted on another account to receive
  that account's reveal notifications. Moving registration behind a
  callable is planned; see `docs/SHIP-CHECKLIST.md`.
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
