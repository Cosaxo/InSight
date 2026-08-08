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

**Re-derived 2026-08-06 for D57 (verified logic attempts).** New stored
fields: `testResults.logic` (server-written verified score, owner-only),
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

### Collected — declare these five

| Apple category | Type | Linked? | Purpose | What it actually is |
| --- | --- | --- | --- | --- |
| Identifiers | **User ID** | Yes | App Functionality | The Firebase uid. Anonymous by default (D3) — every install becomes one at first paint |
| Contact Info | **Email Address** | Yes | App Functionality | Only if the user links Google. See the warning below |
| Contact Info | **Name** | Yes | App Functionality | Optional display name, shown in group and duel reveals |
| User Content | **Other User Content** | Yes | App Functionality | Answers and test results |
| Location | **Coarse Location** | Yes | App Functionality | City name only. **Never tick Precise** |
| Sensitive Info | **Sensitive Info** | Yes | App Functionality | Politics test result (GDPR Art. 9); gender if entered |
| Diagnostics | **Crash Data** | Yes | App Functionality | Sentry. **On by default** (D76), opt-out in the privacy panel, carries the uid only |

### Not collected — leave every one of these unticked

Phone Number · Physical Address · Other Contact Info · Health · Fitness ·
Payment Info · Credit Info · Other Financial Info · **Precise Location** ·
Contacts · Emails or Text Messages · Photos or Videos · Audio Data ·
Gameplay Content · Customer Support · Browsing History · Search History ·
**Device ID** · Purchase History · **Product Interaction** ·
**Advertising Data** · Other Usage Data · Performance Data · Other
Diagnostic Data · Other Data Types

Three of those are worth knowing *why*, because each looks tickable:

- **Device ID — No.** Device binding (D29) receives 2–3 bits from Apple
  DeviceCheck meaning "an account was activated from this device
  recently". The server stores **no device identifier**; the platforms
  hold the state. There is nothing here for `deleteAccount` to erase
  because nothing is held.
- **Product Interaction — No.** `data-inventory.md`: "No product analytics
  of any kind ship today." Adding any would change this row.
- **Emails or Text Messages / other free text — No, at launch.** Takes
  (circle-scoped free text, D1) have no live surface in a shipping build —
  `MODERATION.md` records the client report control as "still ahead
  (needs a live takes surface)". **When takes go live this row changes,
  and Apple guideline 1.2 stops being comfortable at the same moment.**

### The three that bite

1. **Coarse Location is a real Yes**, even though **no coordinate is ever
   transmitted.** The fix is resolved to a city name on the device
   (`src/v2/data/locate.ts`) and discarded, so what leaves the device is a
   city name — which is still coarse location data. Under-declaring is the
   direction that gets an app pulled.

   **Never tick Precise.** It is unobtainable by construction, not by
   policy: iOS sets `NSLocationDefaultAccuracyReduced` and never calls
   `requestTemporaryFullAccuracy`. If a reviewer asks, that is the answer.

2. **Sensitive Info is a real Yes.** The politics test result is
   special-category data under GDPR Art. 9. It never leaves the owner
   document and is never sliced by (D8) — but the form asks what you
   **collect**, not what you publish.

3. **Crash Data is a straightforward Yes: reporting is on by default**
   (D76 — it was opt-in until 2026-08-08, and the answer was Yes even
   then, because the form asks what the app *can* collect). Sentry
   carries the uid, no email, no name, no session replay,
   `sendDefaultPii: false`. The SDKs still load dynamically, and the
   privacy panel's switch (`insight.telemetry.v1`) records an opt-out
   that every send site honours.

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
3. **No live free-text surface at launch.** Takes are circle-scoped (D1)
   and demo-only in a shipping build.

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
| `messagingAndChat` | Messaging or chat between users | `false` |
| `advertising` | Advertising | `false` |
| `lootBox` | Loot boxes | `false` |
| `parentalControls` | Parental controls | `false` |
| `ageAssurance` | Age assurance | `false` |
| `healthOrWellnessTopics` | Health or wellness topics | `false` |

The two that are not simply "no content of that kind":

- **`userGeneratedContent` = `true`** is structural fact 1 above, and it is
  what actually drives the rating. Display names in reveals.
- **`messagingAndChat` = `false`** is structural fact 3, and it is the row
  with a known expiry. Takes are circle-scoped (D1) and demo-only in a
  shipping build, so nothing live carries user-to-user text. **It moves the
  day takes go live**, together with `EMAILS_OR_TEXT_MESSAGES` in §1's
  not-collected list — same trigger, and they must move together.

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

Also **Made for Kids: No**, and **In-app purchases: No** — `MONETIZATION.md`
records no consumer paid tier at launch. Neither is an
`ageRatingDeclarations` attribute, so neither is in the table.

**Expect 12+ / 13+.** Answer it deliberately rather than accepting a
default.

### Guideline 1.2, and why the answers hold

1.2 demands four things of any app with user-generated content:

| 1.2 requires | InSight |
| --- | --- |
| Filter objectionable content | Moderation substrate deployed, `MOD_ADVISORY = true` (D22) |
| Report mechanism | Report control exists in the spec layer; the takes surface it attaches to is demo-only at launch |
| Block abusive users | `leaveGroupV2`, wired to the **Leave circle** control on each live circle card — leaving **is** the block, because D1 means circle members are the only people whose content you can see. There is no owner-side *remove* callable yet (D55 §14): the answer at launch is that anyone can leave, not that an owner can eject |
| Published contact info | `olaftaule01@gmail.com`, on `web/terms.html` |

If a reviewer asks how users block one another, the circle model is a real
answer rather than a dodge: **there is no global block because there is no
global surface to be abused from.** Say that plainly. Do not build a
global block list to pre-empt a question that may not be asked.

---

## 3 · Play Data Safety — [PARKED — D42]

Not needed while Play is deferred. Kept because these were derived from the
same inventory and should not be re-derived in a hurry.

| Play category | Collected | Shared | Optional? | Purpose |
| --- | --- | --- | --- | --- |
| Personal info → User IDs | Yes | No | Required | App functionality |
| Personal info → Email address | Yes | No | Optional (Google linking only) | App functionality |
| Personal info → Name | Yes | No | Optional | App functionality |
| Personal info → Political or religious beliefs | Yes | No | Optional | App functionality |
| Personal info → Gender | Yes | No | Optional | App functionality |
| Location → Approximate location | Yes | No | **Optional** | App functionality |
| Location → Precise location | **No** | — | — | — |
| App activity, Web browsing, Contacts, Photos, Financial, Purchases | **No** | — | — | — |
| App info & performance → Crash logs | Yes | No | **Optional** (on by default; the privacy panel has the off switch, which is what keeps Play's "users can choose" definition true) | App functionality |
| Advertising ID / any ads box | **No** | — | — | — |

Play additionally asks two things Apple does not:

- **Is data encrypted in transit?** Yes — all traffic is HTTPS to Firebase.
- **Can users request deletion?** Yes — the in-app `deleteAccount` callable,
  plus the support address on the terms page.

Play asks whether location is *required*: it is **optional**. Declining
leaves the city picker working, and the app never prompts unless the
button is tapped.

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
