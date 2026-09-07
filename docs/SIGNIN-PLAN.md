# The account wall and its three doors — the plan

**Status: BUILT, 2026-09-07 — adopted as
[D414](DECISIONS.md#d414--the-account-wall-goes-back-up-and-d219s-own-condition-is-why),
which reverses D219. This page is kept as the reasoning, not as a
worklist; §7 records what each step actually cost.** The owner's
decision, 2026-09-07: *"i think this app defenenetly should have a
sigin in wall and not anonymous users"*, then *"make a plan for the c
plan that is how almost all apps do account"*, then — after reading
§6's deferral of address verification — *"add the email verification
before launch"*.

## 1 · Why, in the owner's own terms

D219 dropped the sign-in wall for the store build on one condition,
which the owner stated at the time: *"as long as that means that
everyone has a account and question can be attribute to a spesific
user that cant easly create duplicate acounts."*

**The condition is not met, and 2026-09-07 is the day it was seen
directly.** The owner deleted their account, was returned to the app
as a fresh anonymous session, and could answer again immediately. That
is the app minting a duplicate in one tap. `LivePrivacyPanel`'s own
comment already said the same thing from the other side — every
reinstall and every new handset mints a second account, and those
duplicates are indistinguishable from new users — so this is a
confirmation rather than a discovery.

An account is also what the product IS. The Mirror is the claim that
*your* answers say something about *you*, over time. A session that
dies with a handset cannot make that claim, and a population half
made of one person's re-installs cannot either.

## 2 · What is already built

- **The wall itself.** `ui/LiveSignInGate.tsx` is the screen;
  `SignInGate.tsx` decides whether it renders and dynamic-imports it.
  It is off unless `VITE_REQUIRE_SIGNIN=true`, and since D219
  `ios-release.yml` defaults that to `'false'`. Turning it on is a
  repo Actions variable or a one-word default change.
- **Google.** `signInWithGoogle` through
  `@capacitor-firebase/authentication`, with `linkWithCredential` so an
  anonymous session UPGRADES rather than being abandoned.
- **The linking idea.** The gate's header records the property worth
  keeping: it does not create an account, it links the session that
  already exists, so a user who answered before the wall appeared keeps
  every answer.

## 3 · What is not built, and what each costs

| Door | State | Work |
| --- | --- | --- |
| Google | built | none |
| Sign in with Apple | **not built** | ~half a day of code; the plugin already exposes `signInWithApple` |
| Email + password | **not built** | ~a day and a half; the plugin exposes `createUserWithEmailAndPassword`, `signInWithEmailAndPassword` and `sendPasswordResetEmail`, so the cost is the SCREEN and its tail, not the calls |

**The tail is the part that gets underestimated.** Email is not one
form. It is sign-up, sign-in, a forgotten-password round trip through
an inbox, a decision about whether addresses are verified before an
account counts, an error message for every one of those, and the
support mail when somebody still cannot get in. That is why §7
recommends the order it does.

**The verification decision, made:** addresses ARE verified before an
account counts, on the owner's instruction the same day. The estimate
above priced it as a conversion cost — one round trip through an inbox
before the first answer — and missed the cost of NOT doing it, which
is larger: a password account exists the moment Firebase accepts the
password, so a typo produces a real account whose confirmation mail
and whose reset mail both go to a stranger. Without a way out, the
wall would be a locked room on that device. D414's amendment has the
three pieces that ship (two flags on the wall, a rule that names the
password door precisely, and `abandonSignIn` as the escape).

## 4 · Apple guideline 4.8 decides the shape

4.8 says an app offering a third-party or social login must also offer
an equivalent privacy-preserving option. Today the app passes by not
requiring a login at all, and `SHIP-CHECKLIST.md` § hardening drafts
exactly that reply. **The wall deletes that defence**, so the rule
starts to bind the moment the wall goes up.

Two ways to satisfy it, and they are not equal:

1. **Offer Sign in with Apple beside Google.** The ordinary answer, and
   what this plan takes.
2. **Use only the app's own account system.** 4.8 exempts an app that
   *exclusively* uses its own sign-in. Email-only would qualify —
   but the word is *exclusively*, so keeping the Google button brings
   the rule straight back. Dropping a working one-tap door to avoid
   half a day of work is the wrong trade.

## 5 · What moves outside the code

- **`web/privacy.html` first** (D183). Passwords are new: Firebase
  holds the hash and the app never sees it; an email address becomes a
  credential as well as a contact. The page says so before the build
  ships, and `check:policy-claims` holds it.
- **The App Privacy label does not change.** Contact Info → Email
  Address is already declared, collected, linked, App Functionality.
  Verified against `design/store/app-privacy.json`, so 4.4 does not
  reopen.
- **`docs/data-inventory.md`** if any new collection appears. The plan
  expects none: Firebase Auth holds credentials, not Firestore.
- **A DECISIONS.md record** reversing D219 and citing the owner's own
  condition as the reason.
- **`SHIP-CHECKLIST.md` § hardening.** Its 4.8 paragraph becomes wrong
  the day the wall goes up, and its D134 sentence is *already* stale —
  it says `ios-release.yml` "defaults it to `true`", which D219 changed
  to `'false'`. Fix both in the same commit.

## 6 · The gate is a screen, so it goes through Claude Design first

D352: a new screen is a request in `VISUAL-REQUESTS.md`, designed
before it is built. Two extra buttons on the existing gate would be
controls and would need no request — but sign-up, forgotten-password
and their error states are a screen family. Request **9** carries it
(it was filed as 7, which collided with the first-launch walkthrough
already built under that number — the console's own pinned count
caught it).

## 6b · Step 1 is built (2026-09-07), except the entitlement

`appleSignIn` and `linkApple` are in `src/lib/firebaseImpl.ts` beside
Google's pair, exposed through `firebase.ts` and `LIVE.linkApple`, with
a provisional second button on the existing gate that request 9 will
replace. The native timeout race is now ONE helper serving both
providers rather than a second copy: the subtle half is the `finally`
that clears the timer, and a duplicate is a second place for that to go
missing in the failure path only.

**What the tests pin, and why each exists.** That the exchange carries
the RAW NONCE — Apple binds its token to one, the plugin returns it
under `nonce`, the SDK wants it as `rawNonce`, and dropping it fails
`auth/invalid-credential`, a message naming neither Apple nor nonces.
Nothing else in the stack sees it: the field is optional in the
plugin's type and `credential()` takes a loose object, so tsc, eslint
and a hand test that happens to pass all stay quiet. That `linkApple`
LINKS when a session exists and signs in fresh when it does not, both
branches, because a gate that linked Google and signed in fresh with
Apple would strand a session's answers exactly as badly while the
Google case stayed green. And that the gate offers Apple's door at all,
since 4.8 is about its presence.

**The entitlement is deliberately NOT in this commit.** `App.entitlements`
records the rule in its own comment: a provisioning profile cannot grant
an entitlement the App ID does not have, so adding
`com.apple.developer.applesignin` before the capability is enabled fails
the ARCHIVE — `ios-release.yml` would go red on a tree that is otherwise
fine. The order is: the owner enables Sign in with Apple on the App ID,
then the entitlement lands, then a build. Until then the code is
complete and inert on device, because the native sheet has nothing to
open.

## 6c · The design landed the same day (2026-09-07)

The owner's canvas is extracted to `design/front-door-2026-09-07/`, and
request 9 is `designed`. Twelve live artboards including dark and a
375×667 phone with the keyboard up. It settled more than the request
asked for, and three of those are the build's to honour rather than to
re-decide:

- **Every error names its own way out.** *No account uses this address
  yet* offers **Create one**; *This address already has an account*
  offers **Sign in instead**. A dead-end error message on the one screen
  a person cannot get past is the failure mode this removes.
- **Apple's label follows the mode** (*Sign in with Apple* / *Sign up
  with Apple*) where Google's does not. Deliberate asymmetry: keep it.
- **The toggle and the legal footer hide while the keyboard is up**, and
  every door dims while another is in flight.

The step-1 code already matches the parts that overlap, because the
gate's shell survived by request.

## 7 · The order, and what it cost

All five ran on 2026-09-07. Steps 1 and 2 ran in parallel as planned —
1 is code against an existing surface, 2 is the owner's and Claude
Design's — which is why a two-to-three-day estimate closed in one.

1. **Sign in with Apple** — done. Code, tests, then the entitlement in
   its own commit once the owner ticked the App ID capability. §6b has
   why that order is not optional.
2. **The design round** — done. Request 9, twelve artboards, extracted
   to `design/front-door-2026-09-07/`. §6c records the three decisions
   the design made that the request had not asked for.
3. **Email + password** — done: sign in, create, reset, and (added on
   the owner's word, above) address verification with its escape.
4. **The wall on** — done. `ios-release.yml` defaults
   `VITE_REQUIRE_SIGNIN` to `'true'`, `web/privacy.html` moved first
   per D183, `SHIP-CHECKLIST`'s 4.8 reply is retired, and the runbook's
   6.2 says so at the step where it binds.
5. **Build, device test, submit** — the owner's, and the only part
   left. Runbook **5.16** is the one new console step it depends on
   (the two Firebase auth mail templates), and the one hand test worth
   doing is the mistyped-address escape.

**Three clicks were the owner's alone and blocked step 1's testing:**
the Apple provider and the Email/Password provider in the Firebase
console, and Sign in with Apple enabled for the App ID in the Apple
Developer portal. All three are done.

## 8 · What this costs the release

Roughly two to three days of build, plus a new build number and a
review round. The owner's options on 2026-09-07 were to submit
anonymous-first now and wall later, to hold everything, or to submit
now and **hold the approved version unreleased** while the wall is
built, so no real user ever meets the anonymous version. The third is
what this plan assumes; it is the only one where the first person
through the door sees the app the owner intends.
