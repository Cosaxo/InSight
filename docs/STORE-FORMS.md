# Store forms — the answers, ready to transcribe

Apple's Privacy Nutrition Labels and the age rating questionnaire, answered
field by field so submission is transcription rather than judgement. Play's
Data Safety form is here too, parked under D42 and kept because the answers
were derived once and should not be re-derived under time pressure.

**This file holds the answers. [`data-inventory.md`](data-inventory.md) is
the audited source they come from and stays canonical** — if the two ever
disagree, that file is right and this one is stale. `SHIP-CHECKLIST.md §3`
holds the reasoning for the three that bite.

Re-derive this file if any of these change: a new stored field, a new SDK,
the takes surface going live, or product analytics being added.

**Re-derived 2026-08-26 for D322 (the interest profile, D317 phase 1).**
New stored field: `v2_users/{uid}/taste/profile` — feed answers counted
by topic, server-derived nightly, owner-readable only, used to size the
feed's topic pages (D321). **One answer moves**: User Content → Other
User Content gains the **Product Personalisation** purpose beside App
Functionality, because content selection is now personalised from that
content — the honest reading of Apple's purpose list. Collected/linked/
tracking all unchanged (the profile is an arrangement of answers already
declared; nothing new leaves the device — behaviour stays out until
D317 phase 2, which must re-derive this file). Play's parked form (D42)
gains the matching "Personalization" purpose on its answers rows when it
is actually filed.

**Re-derived 2026-08-06 for D57 (verified logic attempts).** New stored
fields: `testResults.logic` (server-written verified score, publicly
readable but client-unwritable since D57/D98),
`v2_logic_attempts/{uid}` (server-only), and the anonymous
`v2_logic_norms*` histogram. **No answer below changes**: the score is
User Content → Other User Content (already **Yes**, linked, App
Functionality — "Answers and test results"); the attempt doc is
server-side operational data about that same content; the histogram
carries no identifier and no linkage. Practice attempts still send
nothing. `data-inventory.md` carries the audited rows.

---

## 1 · Apple Privacy Nutrition Labels

> **You still have to type this one in — but not from memory.**
> `design/store/app-privacy.json` holds every answer below as data, and
> **Actions → App Store metadata** with *privacy* selected prints it as the
> form, row by row, in the order App Store Connect asks. Copy from that.
>
> **Apple's API cannot write this form.** Not through a different path —
> there is no App Privacy resource in the App Store Connect API at all
> (D73 has the three ways that was established, and what the three failed
> attempts cost). The age rating next door *is* pushed; the difference
> between them is only which one Apple exposes.
>
> What you are entering is a legal statement about what the app collects,
> so read this page rather than the printout alone. `npm run
> check:store-forms` holds the two files equal, so this page cannot quietly
> stop describing what the printout says.

App Store Connect → your app → App Privacy. For each type you answer three
things: **collected?**, **linked to identity?**, **used for tracking?**,
plus purposes.

### Tracking — answer first, it gates everything

> **Do you or your third-party partners use data for tracking? → NO**

No IDFA, no ATT prompt, no advertising SDK of any kind. The Facebook SDK
was a transitive SwiftPM dependency of `@capacitor-firebase/authentication`
and is stripped at `postinstall` (D16), with `npm run check:ios-facebook`
asserting its absence in CI. Nothing here follows a user across other
companies' apps or sites.

**Every row below is therefore "Not used for tracking".**

### Collected — declare these eight

| Apple category | Type | Linked? | Purpose | What it actually is |
| --- | --- | --- | --- | --- |
| Identifiers | **User ID** | Yes | App Functionality | The Firebase uid, anonymous by default (D3) — every install becomes one at first paint — **and the handle since D122**, which Apple's own definition of this type names ("any screen name, handle, account ID …"). See the note below the table |
| Contact Info | **Email Address** | Yes | App Functionality | Only if the user links Google. See the warning below |
| Contact Info | **Name** | Yes | App Functionality | Optional display name, shown in group and duel reveals |
| User Content | **Other User Content** | Yes | App Functionality, Product Personalisation (D322) | Answers and test results, the anchors each answer was given under, and question suggestions (D138). The personalisation purpose is the interest profile: feed answers counted by topic, used to size the feed's topic pages. See the note below the table |
| User Content | **Photos or Videos** | Yes | App Functionality | **Optional profile photo, off by default (D178)** — shown anywhere the app shows the user's name, including to people nearby since D177. Shrunk and re-encoded on the device, which drops the original's EXIF. See the note below the table |
| Location | **Coarse Location** | Yes | App Functionality | City name; 0.002° presence cell |
| Health & Fitness | **Health** | Yes | App Functionality | **New at D203.** Two of the five pulse questions are "How did you sleep?" and "How was your energy today?" — one five-step answer a day each, keyed to a UTC day. See the note below the table |
| Location | **Precise Location** | Yes | App Functionality | Requested since D175; nothing precise is retained — see §"The three that bite" |
| Sensitive Info | **Sensitive Info** | Yes | App Functionality | Politics test result (GDPR Art. 9); gender if entered |
| Diagnostics | **Crash Data** | Yes | App Functionality | Sentry. **On** (D76; the in-app switch left at D211), carries the uid only |
| Usage Data | **Product Interaction** | **Yes** | Analytics | **Collected at D270, LINKED at D272.** Two shapes: the anonymous device tally (`v2_attention` — bucketed feature and, since D271, per-question counts under a fresh random id, unlinkable even to the same phone across days), and the per-account day rollup (`v2_users/{uid}/engagement` — sessions, a foreground bracket, quiet sessions, dayparts; no question id by rules-enforced construction, readable by nobody including the owner, 90-day TTL, erased with the account). The rollup is uid-keyed, so the row is Linked. See the note below the table |

**The handle (D122) lands in *User ID*, and the answer does not move.**
Worth a line anyway, because the row's stated basis was "the Firebase uid"
and that is no longer the whole of it. A handle is user-chosen, unique and
readable by any signed-in user — `v2_users/{uid}.handle` plus the
`v2_handles/{handle}` registry — and Apple's definition of this type names
it outright: *"any screen name, handle, account ID, assigned user ID,
customer number, or other user- or account-level ID"*. So nothing needs
re-typing into App Store Connect; what needed correcting was the sentence a
future reviewer checks the row against. That is the D116 failure one layer
in — pushed state was right, the reasoning under it had gone stale — and it
is the reason this note exists rather than a diff nobody would notice.

**Question suggestions (D138) land in *Other User Content*, and the answer
does not move either.** Same shape, recorded for the same reason: this
row's stated basis was "answers and test results", and a suggestion is
neither. It is free text a user writes — a prompt, its options, and a
`credit` flag saying they would like to be named if it is ever used —
stored in `v2_suggestions`, written only by `suggestQuestionV2`, and
**read by its author and nobody else** (`firestore.rules`, and the D98
"answers are public" model deliberately does not reach it). That last
part is the one worth being careful about: it makes the row look
arguable, and it is not. This form asks what the app **collects**, not
what it publishes — the same reasoning that keeps Email Address a Yes
while no Firestore document of ours holds one. Nothing to re-type in App
Store Connect; the sentence a future reviewer checks the row against is
what needed fixing.

### Not collected — leave every one of these unticked

Phone Number · Physical Address · Other Contact Info · Fitness ·
Payment Info · Credit Info · Other Financial Info ·
Contacts · Emails or Text Messages · Audio Data ·
Gameplay Content · Customer Support · Browsing History · Search History ·
**Device ID** · Purchase History ·
**Advertising Data** · Other Usage Data · Performance Data · Other
Diagnostic Data · Other Data Types

**Product Interaction left this list at D270** and is now a ticked row in
the table above — not linked, the label's first and only unlinked row.
It is called out here because the D268 bullet below spent a release
explaining why it was still a No, and the reasoning that mattered there —
the row asks what is *collected from the app* — is exactly what changed:
rung 1 collects.

**Precise Location left this list at D175** and is now a ticked row in the
table above — the app requests a precise fix for Near even though nothing
precise is retained. It is called out here because this is the line a
future reviewer will check the change against.

**Photos or Videos left this list at D178**, and it is the one that had
been called load-bearing in this very document: §"Facial symmetry" refuses
a feature partly *because* this row was a No. That refusal stands
unchanged and the distinction is worth stating, because the two look
alike and are not. The symmetry idea wanted to MEASURE a face — camera
capture and face geometry, biometric data in GDPR and BIPA terms, feeding
a pseudo-measurement into a personality reading. D178 stores a picture
somebody chose to publish, and nothing reads it but a human eye. The app
does no face processing of any kind, and this row moving does not open the
door the other section closed.

What moving it costs, stated plainly: an optional photo, off by default,
one 256px object per account, deleted with the account (bytes included —
`deleteAccount` reaches Storage since D178, which it never did before).

**The iOS purpose strings, and why there are two of them for one control.**
The photo is added through a plain `<input type="file">` — no camera
plugin, no code path in this app that asks for a camera. WebKit's upload
sheet offers one regardless: it builds its menu from the `accept`
attribute, `image/jpeg` and `image/png` conform to `public.image`, and it
presents the system camera in-process with no check for a purpose string,
so iOS terminates the app on the tap. `Info.plist` therefore carries
NSCameraUsageDescription and NSPhotoLibraryUsageDescription, and the
mechanism is written out beside them. This changes nothing in the table
above: the datum is the same optional photo the row already declares, and
a photo taken with the camera is the same "Photos or Videos" as a photo
chosen from the library. It is recorded here because this is where a
reviewer will look for it, and because §"Facial symmetry" below reasons
about camera capture — the app can now be handed a camera photo, and still
does no face processing of any kind, which is what that refusal was about.
Android needs no permission for a file input, so its manifest is unchanged.

Four of those are worth knowing *why*, because each looks tickable:

- **Health — YES since D203, and the trip-wire is what moved it.** This
  bullet answered **No** from the first filing until the pulse roster
  shipped, and the No was argued at D140 for the **height band** alone: a
  six-value demographic select (`Under 160 cm` … `190 cm or taller`, plus
  a real `Prefer not to say`) collected to slice cohorts, never a
  measurement, with no centimetre field to hold anything finer. That
  argument still stands for height and is not what changed.
  **What changed is that the app started asking about sleep.** D166 §3
  approved the five-pulse roster and D203 built it; two of the five are
  *"How did you sleep?"* and *"How was your energy today?"*, answered once
  per scheduled day on a five-step scale. Apple's wording for this row is
  health and medical data — HealthKit, Clinical Health Records,
  health-related research, **"or any other user provided health or medical
  data"** — and a self-reported daily sleep series is that, on any reading.
  So the row is Yes, and it is Yes on the roster rather than on the band.
  **This is the D140 trip-wire being honoured, not overruled.** That
  bullet said, in as many words, *"Whoever picks that decision back up owns
  this row"* — it was written about weight and BMI, and the general case it
  was really about is anything that turns a demographic app into one
  holding a health series. Neither weight nor BMI is collected; D140's own
  refusal is untouched, and this row would already have been Yes without
  it.
  *What is collected:* one ordinal answer a day per pulse, keyed to a UTC
  day, written under `v2_users/{uid}/answers` like every other answer. It
  is **Linked**, because under D98 it folds into the same exact aggregate
  any signed-in user can read — a pulse answer is as public as a feed
  answer, and filing it as unlinked would be the more flattering lie.
  No HealthKit API is touched and nothing medical is inferred.
  *What is NOT collected:* the **cadence**. How often someone wants to be
  asked how they slept is arguably the more revealing half, and it never
  leaves the device — `insight.pulseCadence.v1` in localStorage, swept by
  the D51 purge, with no field, no rules arm and no server representation
  to file. That is a design choice made partly for this row.
- **Device ID — No.** Device binding (D29) receives 2–3 bits from Apple
  DeviceCheck meaning "an account was activated from this device
  recently". The server stores **no device identifier**; the platforms
  hold the state. There is nothing here for `deleteAccount` to erase
  because nothing is held.
- **Product Interaction — Yes and LINKED since D272, and the row's
  history is three deliberate moves in three days.** D268 re-answered it
  **No** (a server-side fold of answers already stored is not data
  *collected from the app*); D270 collected, **not linked** (the
  anonymous device tally); D272 — the owner adopting ENGAGEMENT-PLAN.md
  rung 2 — adds the uid-keyed day rollup, and a uid-keyed row is Linked
  on Apple's definition however few can read it. *What the linked shape
  is:* one small doc per account per finished day — session count, a
  foreground-time BRACKET (never minutes), quiet-session count, local
  dayparts, answer count, feed-depth bracket, stop/lens counts. *What
  bounds it, each part enforced rather than promised:* it carries **no
  question id** — the rules' field whitelist refuses one, asserted by
  test, so no reading history exists on any uid-keyed path; it is
  readable by **nobody, the owner included** (measurement, not a profile
  surface — what publishes is counts of people, `v2_engagement_daily
  .people`); each doc **self-expires at 90 days** (TTL) and the whole
  subtree erases with the account, asserted in the erasure e2e. The
  anonymous tally beside it is unchanged — still no uid, still
  unlinkable across days, and since D271 its per-question counts are
  facts about questions, not people. *Still not collected:* any
  advertising or analytics identifier, any event stream, anything a
  third party receives — no analytics SDK is in the binary, so the
  tracking answer above is untouched. The ceiling on all of it is
  D269, binding.
- **Emails or Text Messages — still No, for the shape reason.** A take is
  a **post** — to a circle (D78 part 1) or, since D83, anonymously to the
  world — never a message to a person, and Apple files posts under *User
  Content → Other User Content* — already declared **Yes** above. The
  content is declared either way; this row is about shape. It moves if a
  surface ships that is addressed to a person **and** carries text its
  sender wrote. D122's circle invitation is addressed and carries no such
  text — there is no note field on the write — so it does not move this
  row; §3 has the re-derivation and why both halves of that test matter.

  **The age rating did move** (`messagingAndChat` → `true`, D79) and the
  divergence is real rather than an inconsistency: that question asks
  whether the app *has* chat at all, this one asks which category the text
  lands in. Guideline 1.2 now applies for real, and the answers hold — see
  the 1.2 table in §2.

### The three that bite

1. **Both location rows are a real Yes, and Precise moved at D175.**
   No coordinate is ever transmitted: a fix is folded on the device
   (`src/v2/data/locate.ts`) to a city name, or to a 0.002° presence cell,
   and discarded. What leaves the phone is a city name or a grid square.
   Under-declaring is the direction that gets an app pulled, so both rows
   are ticked.

   **Precise Location: Yes (D175, was No).** The app now REQUESTS a
   precise fix — iOS `NSLocationDefaultAccuracyReduced` is `false`,
   Android's `ACCESS_FINE_LOCATION` is uncapped, and `enableHighAccuracy`
   is on — because Near's venue-scale reading cannot be measured by a
   coarse one, and a finer grid computed from a coarse fix would be
   invented precision.

   **The row describes what is REQUESTED, which is why it moves even
   though what is KEPT did not get finer than the threshold.** Apple
   defines Precise Location as a resolution of three or more decimal
   places (0.001°); the presence cell is 0.002°, deliberately one step
   coarser, and the city name is coarser still. So the honest position to
   give a reviewer is: precise is requested, nothing precise is retained
   or transmitted, and the grid was chosen to sit above the line rather
   than at it.

   **What the old answer said, so the change is not mistaken for drift:**
   "Never tick Precise — it is unobtainable by construction, not by
   policy." That was true and is not any more. D84 named this exact flip
   as the owner's separate call ("request precise fixes, flip the App
   Store label, rewrite the coarse-only lines"), and D175 is that call.

2. **Sensitive Info is a real Yes, and D98 strengthened the reason.**
   The politics test result is special-category data under GDPR Art. 9.
   It used to be filed on the narrow ground that the form asks what you
   **collect**, not what you publish — while the data itself never left
   the owner document and was never sliced by (D8/D44).

   Both halves of that are now false. Since D98 answers and profiles are
   readable by any signed-in user, political *items* slice by cohort like
   every other question, and the politics *result* sits on a public
   profile. The row stays Yes and its justification is simply broader:
   the app collects it **and** publishes it.

   **Do not delete this row** on the reasoning that politics is "no
   longer special" here — that would be an under-declaration, and
   `check:store-forms` rule 2 refuses it.

3. **Crash Data is a straightforward Yes: reporting is on** (D76 — it
   was opt-in until 2026-08-08, and the answer was Yes even then,
   because the form asks what the app *can* collect; the privacy panel's
   off switch was removed at D211). Sentry carries the uid, no email, no
   name, no session replay, `sendDefaultPii: false`. The SDKs still load
   dynamically, and an opt-out an OLDER build recorded
   (`insight.telemetry.v1` = "false") is still honoured at every send
   site — nothing writes that key any more.

### The guideline 4.8 reply, and the clause that was cut from it

**Resolved 2026-08-05.** `SHIP-CHECKLIST § hardening` used to end its
draft reply to a guideline 4.8 challenge with *"note the app collects no
email or name via Google either"* — which contradicted the Email Address
row above. The checklist has been corrected; this note stays because the
sentence is the kind that gets rewritten from memory.

`linkGoogle()` calls `new GoogleAuthProvider()` with no `addScope`
(`src/lib/firebaseImpl.ts:167`), so Firebase requests `email` and
`profile` by default and Firebase Auth stores both on the user record. The
app's own code never reads them, which is probably what the sentence
meant, but "collects" on these forms means what lands on your servers, and
Firebase Auth is your server.

**Never say that line to a reviewer while the nutrition label declares
Email Address** — a listing that contradicts its own developer response is
a worse problem than the one the sentence was trying to solve. The rest of
the 4.8 reply stands and is the strong part: the primary path is anonymous,
no account is required to use the app, and Google is an optional upgrade
rather than a login wall.

If you would rather the claim were true than the label complete, that is a
code change and not a forms change: request no scopes at all, accept that
the profile name has to come from somewhere else, and re-answer both rows.
It is not needed for launch.

---

## 2 · Age rating

Apple revised this questionnaire and its tiers in 2025, so the exact
question list may not match the headings below. **Map these answers onto
whatever the form shows rather than pattern-matching the labels.**

### Every content frequency question → None

Measured, not assumed. Scanning all four committed banks for violence,
sex, substances, gambling and profanity returns **four hits, all
references rather than depictions**: "Pub" as a place option, "Cry in a
film — freely, or fight it?", an etymology card for the word *alcohol*,
and a history card naming the Second World War.

So: Cartoon or Fantasy Violence · Realistic Violence · Prolonged Graphic
or Sadistic Violence · Profanity or Crude Humor · Mature/Suggestive
Themes · Horror/Fear Themes · Medical/Treatment Information · Alcohol,
Tobacco, or Drug Use · Simulated Gambling · Sexual Content or Nudity ·
Graphic Sexual Content · Contests · Gambling — **all None.**

**Re-run that scan if the banks grow substantially.** The farm (D33)
writes the spec layer and promotion (D30) is the gate where new content
reaches users.

### What actually drives the rating — three structural facts

1. **Users see each other's names.** Group and duel reveals show display
   names. That is user-generated content and social interaction on any
   version of this form, whatever the content questions say.
2. **Coarse location exists** (D9, optional). Answer consistently with §1.
3. **Free text is live at both scopes, and NAMED at both.** Circle takes
   with names since D78 part 1 (2026-08-09); world takes since D83
   (2026-08-10), carrying their author's name since D98 (2026-08-16), one
   take per person per question, behind ENFORCED moderation
   (`MOD_ADVISORY = false`) with report and per-author mute. This fact has
   moved three times: "no live free-text surface" → "circle-scoped" (D79)
   → "both scopes, world anonymous" (D83) → "both scopes, both named"
   (D98) — which is why `messagingAndChat` is `true` (D79) while
   `EMAILS_OR_TEXT_MESSAGES` stays unticked.

   It said **anonymous by construction** here until 2026-08-30, two weeks
   after D98 named every world take. That is a claim about the app made to
   a store reviewer, and the file it is mirrored into contradicted itself:
   `$guideline12` in `app-privacy.json` has said "D98 makes every take
   named at world scale" since the day it shipped. What answers guideline
   1.2 for the world surface is the kit — enforced moderation, report,
   per-author mute — and never anonymity, which was always a client-side
   string choice rather than a rule (`authorUid` has been on the take
   document and readable all along).

### Every answer, keyed by the field Apple actually stores

Keyed by API name rather than by the label on the form, because the labels
move and the keys do not — and because `check:store-forms` holds this table
equal to `app-privacy.json`, key **and** value. That gate exists because the
age-rating half of that file was ungated while the privacy half was, which is
how eight required fields went unnoticed until a 409 named them one by one
(D75).

The value column is the literal JSON. Frequency questions are an enum
(`"NONE"`), the rest are booleans — do not swap one for the other.

| Field | The form asks | Answer |
| --- | --- | --- |
| `violenceCartoonOrFantasy` | Cartoon or Fantasy Violence | `"NONE"` |
| `violenceRealistic` | Realistic Violence | `"NONE"` |
| `violenceRealisticProlongedGraphicOrSadistic` | Prolonged Graphic or Sadistic Violence | `"NONE"` |
| `profanityOrCrudeHumor` | Profanity or Crude Humor | `"NONE"` |
| `matureOrSuggestiveThemes` | Mature/Suggestive Themes | `"NONE"` |
| `horrorOrFearThemes` | Horror/Fear Themes | `"NONE"` |
| `medicalOrTreatmentInformation` | Medical/Treatment Information | `"NONE"` |
| `alcoholTobaccoOrDrugUseOrReferences` | Alcohol, Tobacco, or Drug Use | `"NONE"` |
| `gamblingSimulated` | Simulated Gambling | `"NONE"` |
| `sexualContentOrNudity` | Sexual Content or Nudity | `"NONE"` |
| `sexualContentGraphicAndNudity` | Graphic Sexual Content | `"NONE"` |
| `contests` | Contests | `"NONE"` |
| `gunsOrOtherWeapons` | Guns or Other Weapons | `"NONE"` |
| `gambling` | Gambling | `false` |
| `unrestrictedWebAccess` | Unrestricted web access | `false` |
| `userGeneratedContent` | User-generated content | `true` |
| `messagingAndChat` | Messaging or chat between users | `true` |
| `advertising` | Advertising | `false` |
| `lootBox` | Loot boxes | `false` |
| `parentalControls` | Parental controls | `false` |
| `ageAssurance` | Age assurance | `false` |
| `healthOrWellnessTopics` | Health or wellness topics | `false` |

The two that are not simply "no content of that kind":

- **`userGeneratedContent` = `true`** is structural fact 1 above, and it is
  what actually drives the rating. Display names in reveals.
- **`messagingAndChat` = `true`** since 2026-08-09, and it was `false` for
  one day. Structural fact 3 said "no live free-text surface at launch";
  D78 part 1 shipped the circle takes client, so `postTake` now writes free
  text that other group members read and that half of the reasoning
  expired on merge. Scope limits the *audience*, not the feature — Apple
  asks whether the app *has* messaging or chat, and a private group where
  members write to each other is chat; since D83 takes also exist at world
  scale (anonymous), which only reinforces the answer.

  Answered the safer way deliberately: under-declaring is the direction
  that pulls an app, and the honest answer costs nothing here because
  `userGeneratedContent` already drives the rating to 12+. **D78's own cost
  table files this flip under its world-takes part, which is still
  Proposed** — D79 settles that disagreement rather than leaving a live
  filing resting on it.

  `EMAILS_OR_TEXT_MESSAGES` in §1 shared the old trigger and does **not**
  move with it: a take reads as a post rather than a message, and its
  content is already declared under **Other User Content**. That row moves
  only if a direct person-to-person surface ships.

  **D98 does not trip that trigger, and the distinction is worth stating
  because it is close.** Answers and takes are now named and world-visible
  — but they are still POSTS, addressed to a question rather than to a
  person. It does not move because the posts acquired names.

  **D122 sharpened the trigger, because it is the first thing to half-meet
  it.** This paragraph used to end "Nothing in the app lets one user send
  anything to another user. The row moves the day a DM, a reply-to-person,
  or any addressed surface ships" — and a circle invitation *is* an
  addressed surface: `inviteToGroupV2` writes to
  `v2_groups/{gid}/invites/{invitedUid}`, a document only that one invitee
  may read. So the sentence is false as written and the trigger it stated
  was too broad.

  The row still does not move, and the re-derived reason is narrower than
  "nothing is addressed": Apple's type is the **content** of emails or
  text messages, and an invitation has no content field to declare. Read
  off the write rather than the feature name — `to`, `from`, `fromName`,
  `groupName`, `mode`, `at` — every one app-generated. There is nowhere
  for a sender to type. An invitation is a **capability offered** to one
  person, not a message sent to them, which is also why accepting it is
  the only path that appends to `memberUids`.

  So the trigger is **addressed AND carrying text its sender wrote**, and
  both halves are load-bearing. It moves the day a DM or a reply-to-person
  ships — or, much more cheaply and far more likely, the day someone adds
  a note field to an invite.

Two were measured rather than asserted, on the same scan the frequency
answers came from:

- **`gunsOrOtherWeapons`** — zero hits across all five banks for gun, rifle,
  pistol, firearm, weapon, knife, sword, bomb, shoot, ammo, bullet, blade,
  dagger, missile, grenade.
- **`healthOrWellnessTopics`** — three hits, none of them health content.
  *Medicine* is one of four options on "Humanity's best invention?"; the
  other two are Map taxonomy (the `Body` category's palette seed, and one
  cuisine question filing under `Body / Health`). A category label is not a
  health topic. The nearest real candidate is the personality and politics
  profiles, and neither is health or wellness.

Also **Made for Kids: No**, and **In-app purchases: No** — there are no
StoreKit products, which is what that field asks about.

**The answer stands; the reason it used to give does not.** It read
"`MONETIZATION.md` records no consumer paid tier at launch", which went
stale at D313: there IS a paid tier now — a buyer books a question or a
feed ad and pays through Stripe — it is simply B2B and off-StoreKit.
Same answer, dead reasoning, which is the D179/D183 shape exactly. Where
that purchase surface may live without the stores taking a cut of it is
[`STORE-CUT-PLAN.md`](STORE-CUT-PLAN.md), and SHIP-CHECKLIST § 3 carries
it as a pre-submission decision.

Neither is an `ageRatingDeclarations` attribute, so neither is in the
table.

**Play's equivalent declaration answers No for the same reason** — there
are no Google Play Billing products either. But the two stores do not ask
the same second question: whether Play's *Payments* policy **requires**
that sale to use its billing system is separate, open, and disposed of by
neither declaration. [`PLAY-RELEASE.md`](PLAY-RELEASE.md) §3.4 has it, and
`STORE-CUT-PLAN.md` above is the same subject from the Apple side.

**Expect 12+ / 13+.** Answer it deliberately rather than accepting a
default.

### Guideline 1.2, and why the answers hold

1.2 demands four things of any app with user-generated content:

| 1.2 requires | InSight |
| --- | --- |
| Filter objectionable content | Moderation substrate deployed and **enforcing** since D83 — `MOD_ADVISORY = false`, a remove verdict really hides, per-run cap bounds a bad run (D22 → D83) |
| Report mechanism | **Live since D78 part 1** — `flagTake` writes to `v2_flags` from the takes panel, at both scopes since D83: members flag circle takes, any signed-in user flags world takes |
| Block abusive users | **Hide author** — the per-author mute on every take at every scope (`data/mutes.ts`): local, silent, immediate. Re-derived at D98: this used to be "leave the circle, or hide the author", on the reasoning that circle members were the only *named* people whose content you saw. D98 names every take at world scale, so leaving a circle no longer bounds who you see and cannot be the block. `leaveGroupV2` remains and still stops that circle's content, but it is now a membership action rather than the 1.2 answer (no owner-side eject yet, D55 §14) |
| Published contact info | `olaftaule01@gmail.com`, on `web/terms.html` |

If a reviewer asks how users block one another, the answer is **Hide
author**, and it is one answer rather than two on purpose. Every take in
the app now carries its author's name (D98), so the control that matters
is the one that works everywhere: mute that person and their content
stops rendering for you, in circles and at world scale alike.

The previous answer — "leave the circle" — depended on named content only
ever coming from a circle. That stopped being true at D98, and a 1.2
answer resting on it would have been a rejection risk rather than a
technicality.

---

## 3 · Play Data Safety — [PARKED — D42]

Not needed while Play is deferred. Kept because these were derived from the
same inventory and should not be re-derived in a hurry.

> **OPEN AFTER D98 — the Shared column needs a decision, not an edit.**
> Every row below files **Shared = No**. Play defines sharing as transfer
> to a *third party*, and it carves out transfers the user initiated and
> reasonably expects — so "answers are visible to other users of the same
> app, which the app states plainly at the top of the account panel" is
> arguably still Not Shared.
>
> Arguably is not good enough for a filing. This is a legal/owner call
> and it is deliberately NOT been changed here: flipping six rows to
> Shared = Yes on an engineer's reading would be as wrong as leaving them
> if the reading is wrong. Resolve it before Play is un-parked (D42).
>
> What is NOT in doubt: the Collected column is unchanged by D98, because
> Play asks what you collect. Political or religious beliefs stays Yes.

| Play category | Collected | Shared | Optional? | Purpose |
| --- | --- | --- | --- | --- |
| Personal info → User IDs | Yes | No | Required | App functionality |
| Personal info → Email address | Yes | No | Optional (Google linking only) | App functionality |
| Personal info → Name | Yes | No | Optional | App functionality |
| Personal info → Political or religious beliefs | Yes | No | Optional | App functionality |
| Personal info → Gender | Yes | No | Optional | App functionality |
| Location → Approximate location | Yes | No | **Optional** | App functionality |
| Location → Precise location | **Yes** (D175) | No | **Optional** | App functionality |
| App activity, Web browsing, Contacts, Photos, Financial, Purchases | **No** | — | — | — |
| App info & performance → Crash logs | Yes | No | **Required** (on with no in-app switch since D211 — Play's "users can choose" definition no longer holds, so the honest answer moved from Optional to Required with it) | App functionality |
| Advertising ID / any ads box | **No** | — | — | — |

Play additionally asks two things Apple does not:

- **Is data encrypted in transit?** Yes — all traffic is HTTPS to Firebase.
- **Can users request deletion?** Yes — the in-app `deleteAccount` callable,
  plus the support address on the terms page.

Play asks whether location is *required*: it is **optional**. Declining
leaves the city picker working, and the app never prompts unless the
button is tapped.

**Three corrections to this table, found 2026-09-01 while assessing the
Play path ([`PLAY-RELEASE.md`](PLAY-RELEASE.md)). The first is made; the
other two are flagged rather than made, because they are re-derivations
and this page's own rule is that `data-inventory.md` is canonical.**

1. **The Precise location row had its columns transposed** against the
   header — it read `Yes | App Functionality | Not linked to identity
   beyond the account | No`, which put a purpose in the Shared column, a
   note in the Optional column and "No" under Purpose. Corrected above to
   `Yes | No | Optional | App functionality`, matching the Approximate
   location row directly over it and the paragraph directly under it.
   The dropped note — *not linked to identity beyond the account* — was an
   Apple-ism: Play's form has no "linked" column, so there was nowhere
   for it to go. What it was reaching for is real and belongs in prose:
   the coordinate is folded to a 0.002° cell on the device and the fix
   itself discarded (D175).

2. **The App activity row is stale against D270/D272 and reads as an
   under-declaration** — the direction that gets an app pulled. It files
   the whole group **No**, but §1's Apple table carries *Usage Data →
   Product Interaction* as **collected at D270 and linked at D272**, in
   two shapes (the anonymous device tally, and the per-account day
   rollup). Play's *App activity → App interactions* is the row that
   answers to the same facts. Re-derive it from `data-inventory.md`
   before filing; do not transcribe this table's **No**.

3. **The Purchases row postdates its own answer.** It files **No**, and
   §1's not-collected list agrees for Apple's *Purchase History*. Since
   D313/D315 the app records purchase contracts (`v2_purchases`, read by
   their buyer). Whether that is Play's *Financial info → Purchase
   history* is a genuine question rather than an oversight — the buyer is
   a sponsor rather than a consumer, and no payment instrument reaches
   this tree — but it is a question nobody has answered on the record,
   and both stores' rows were derived before the sale existed.

**None of these is what §4 of `PLAY-RELEASE.md` is asking for.** The
reason a transposed row survived in a file this careful is that nothing
can read it: `check:store-forms` holds `app-privacy.json` equal to §1–2
and this section has no machine-readable twin. Points 2 and 3 are the
same absence one step further out — a Play answer can go stale against a
decision and no gate is watching.

Play's data-safety **Advertising ID** row is a different question from
the store listing's **Contains ads** declaration, and they now diverge:
no advertising ID is collected (the row stays **No**), while the app does
carry paid placements since D315 (the listing declaration is **Yes**).
Keeping them apart is the point — one is about an identifier, the other
about the presence of ads.

---

## Precondition on the "sensitive info" scope

`data-inventory.md` gates one claim on work that has not run: the retired
v1 `insight_discoverable` documents still hold Big Five vectors, political
coordinates, age, gender, country and free-text bios. Client access is
closed (D4), which is not the same as the data being gone.

The **answers above are unaffected** — Sensitive Info is a Yes either way,
because the v2 politics result is Art. 9 data on its own. What the scrub
changes is the *scope* of what you are attesting to. Run it before
submitting:

```bash
node scripts/scrub-v1-discoverable.mjs --project prvfire33          # report
node scripts/scrub-v1-discoverable.mjs --project prvfire33 --apply  # delete
```
