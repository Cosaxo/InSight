# Data inventory — App Store Privacy Nutrition + Play Data Safety prep

When you fill out App Store Connect's **Privacy Nutrition Label** and
Google Play Console's **Data Safety** form, you'll be asked to declare,
for every category of data, whether you collect it, whether it's
linked to identity, whether it's used for tracking, and so on. This
document maps every Firestore subcollection / profile field / external
call to those category systems so you can fill the forms accurately
without missing anything.

Update this document whenever a new collection or third-party
integration lands.

## Quick answers

- **Tracking?** No. We don't link any user data to advertising or
  cross-app identifiers. None of the data here is shared with
  third-party advertisers or data brokers.
- **Sold to third parties?** No.
- **Encrypted in transit?** Yes — Firebase requires HTTPS.
- **Encrypted at rest?** Yes — Firestore encrypts data at rest by
  default.
- **User can request deletion?** Yes — ProfileOverlay → Danger Zone.
- **User can request export?** Roadmap (not yet implemented).

## Apple App Store — Privacy Nutrition Label

Every section: **collected? linked to identity? used for tracking?
purpose?**

| Apple category / type | Collected? | Linked to user? | Tracking? | Purpose |
|---|---|---|---|---|
| **Contact Info** | | | | |
| ↳ Email Address | Yes | Yes | No | App Functionality (auth) |
| ↳ Name | Yes (optional, from auth provider) | Yes | No | App Functionality |
| ↳ Phone Number | No | — | — | — |
| ↳ Physical Address | No | — | — | — |
| ↳ Other User Contact Info | No | — | — | — |
| **Health & Fitness** | | | | |
| ↳ Health (weight, height, mood, dreams) | Yes | Yes | No | App Functionality |
| ↳ Fitness (workouts logged) | Yes | Yes | No | App Functionality |
| **Financial Info** | | | | |
| ↳ Payment Info | No (no in-app payments yet) | — | — | — |
| ↳ Credit Info | No | — | — | — |
| ↳ Other Financial Info (transactions log) | Yes | Yes | No | App Functionality |
| **Location** | | | | |
| ↳ Precise Location | No (we never request precision higher than ~5 km for the discoverable system) | — | — | — |
| ↳ Coarse Location (geohash5) | Yes (only when "discoverable" toggle on) | Yes | No | App Functionality (find people nearby, area aggregates) |
| **Sensitive Info** | | | | |
| ↳ Religious or Political Beliefs (politics + values tests) | Yes | Yes | No | App Functionality |
| ↳ Sexual Orientation, Gender Identity, Race | No | — | — | — |
| **Contacts** | | | | |
| ↳ Contacts (the user's manually-added relations) | Yes | Yes | No | App Functionality |
| **User Content** | | | | |
| ↳ Emails or Text Messages | No | — | — | — |
| ↳ Photos or Videos (daily report, scrapbook; STAY ON DEVICE) | Yes (locally; never uploaded) | Yes | No | App Functionality |
| ↳ Audio Data | No | — | — | — |
| ↳ Customer Support | No (planned via email; no in-app messaging) | — | — | — |
| ↳ Other User Content (journal entries, dreams, impressions, daily reports, ledger entries, ratings) | Yes | Yes | No | App Functionality |
| **Browsing History** | No | — | — | — |
| **Search History** | No | — | — | — |
| **Identifiers** | | | | |
| ↳ User ID (Firebase uid) | Yes | Yes | No | App Functionality |
| ↳ Device ID | No (we don't read IDFA/AAID) | — | — | — |
| **Purchases** | | | | |
| ↳ Purchase History | No (no purchases yet) | — | — | — |
| **Usage Data** | | | | |
| ↳ Product Interaction (which screens you open, etc.) | No (no analytics yet) | — | — | — |
| ↳ Advertising Data | No | — | — | — |
| ↳ Other Usage Data | No | — | — | — |
| **Diagnostics** | | | | |
| ↳ Crash Data | Yes (when Sentry / Crashlytics is wired) | No (anonymous device ID only) | No | App Functionality |
| ↳ Performance Data | Yes (when wired) | No | No | App Functionality |
| ↳ Other Diagnostic Data | No | — | — | — |

**Important caveats to mention in the form text fields:**

1. *Photos* are stored on-device only. The Privacy Nutrition Label
   doesn't have a "device-local only" axis, so we mark photos as
   collected (technically true: we read them) but with the explicit
   privacy-policy note that they never leave the device.
2. *Health data* includes Big5 personality + dream content + mood +
   weight. Apple treats personality test scores as part of "Other
   Sensitive Info" rather than Health; we list them under both for
   safety.
3. The political and values test results are explicitly flagged as
   "Sensitive Info → Religious or Political Beliefs" since they
   include political compass data.

## Google Play — Data Safety form

Google's taxonomy is parallel but uses different category names.
Map each:

| Play data type | Collected? | Shared? | Optional? | Purpose | Encrypted in transit? |
|---|---|---|---|---|---|
| **Personal info** | | | | | |
| ↳ Name | Yes | No | Yes | Account management | Yes |
| ↳ Email address | Yes | No | No | Account management | Yes |
| ↳ User IDs (Firebase uid) | Yes | No | No | App functionality | Yes |
| ↳ Address | No | — | — | — | — |
| ↳ Phone number | No | — | — | — | — |
| **Financial info** | | | | | |
| ↳ User payment info | No | — | — | — | — |
| ↳ Purchase history | No | — | — | — | — |
| ↳ Credit score | No | — | — | — | — |
| ↳ Other financial info (logged transactions) | Yes | No | Yes | App functionality | Yes |
| **Health and fitness** | | | | | |
| ↳ Health info (mood, weight, dreams) | Yes | No | Yes | App functionality | Yes |
| ↳ Fitness info (workouts) | Yes | No | Yes | App functionality | Yes |
| **Messages** | | | | | |
| ↳ Emails, SMS, in-app messages | No | — | — | — | — |
| **Photos and videos** | | | | | |
| ↳ Photos (LOCAL ONLY) | No (we don't transmit them) | — | — | — | — |
| **Audio files** | No | — | — | — | — |
| **Files and docs** | No | — | — | — | — |
| **Calendar** | No | — | — | — | — |
| **Contacts** | | | | | |
| ↳ Contacts | Yes (relations manually added by user) | No | Yes | App functionality | Yes |
| **Location** | | | | | |
| ↳ Approximate location | Yes (when discoverable on) | No | Yes | App functionality | Yes |
| ↳ Precise location | No | — | — | — | — |
| **Web browsing** | No | — | — | — | — |
| **App activity** | | | | | |
| ↳ App interactions / In-app search history | No | — | — | — | — |
| ↳ Other user-generated content | Yes (journal entries, ledger, impressions, daily reports, all the typed content) | No | Yes | App functionality | Yes |
| **App info and performance** | | | | | |
| ↳ Crash logs | Yes (when Sentry / Crashlytics is wired) | No | No | App functionality | Yes |
| ↳ Diagnostics | Yes (when wired) | No | No | App functionality | Yes |
| **Device or other IDs** | No (we don't read AAID/IDFV beyond what Firebase auto-uses for App Check) | — | — | — | — |

### Security practices to declare

- ☑ Data is encrypted in transit
- ☑ Users can request that their data be deleted
- ☐ Committed to follow the Play Families Policy (we don't target
  children — so no)
- ☑ Independent security review (when audited; declare based on
  reality)

## Source-of-truth per Firestore collection

Every collection that holds user data, what it stores, what Apple /
Google bucket it lands in. When adding a new collection, append a
row here AND update both tables above.

| Path | Stores | Apple bucket | Play bucket |
|---|---|---|---|
| `insight_users/{uid}` | profile (personality, politics, morals, likes, dislikes, heroes, weight, birth year, dayTemplate, sharePrefs, currency) | Health & Fitness; Sensitive Info | Health and fitness; Other UGC |
| `insight_users/{uid}/insight_moods/{date}` | daily mood 1..5 + note | Health & Fitness | Health and fitness |
| `insight_users/{uid}/insight_habits/{id}` | habit names + completion dates | Other User Content | Other UGC |
| `insight_users/{uid}/insight_workouts/{id}` | type, duration, intensity, kcal | Health & Fitness | Fitness info |
| `insight_users/{uid}/insight_meals/{id}` | name, kcal, macros, date | Health & Fitness | Health info |
| `insight_users/{uid}/insight_transactions/{id}` | type, amount, category, note | Other Financial Info | Other financial info |
| `insight_users/{uid}/insight_weighins/{id}` | kg + date | Health & Fitness | Health info |
| `insight_users/{uid}/insight_dreams/{id}` | longhand text, tags, vividness, lucidity | Health & Fitness; Other UC | Health info; Other UGC |
| `insight_users/{uid}/insight_impressions/{id}` | private sketches of people | Other User Content | Other UGC |
| `insight_users/{uid}/insight_inbound_impressions/{id}` | anonymous traits from circle (senderUid stored) | Contacts; Other UC | Contacts; Other UGC |
| `insight_users/{uid}/insight_scrapbook/{id}` | nature finds with optional photo (photo local) | Other User Content | Other UGC |
| `insight_users/{uid}/insight_books/{id}` | title, author, finish date, rating | Other User Content | Other UGC |
| `insight_users/{uid}/insight_visits/{id}` | country, city, dates | Coarse Location; UC | Approximate location; Other UGC |
| `insight_users/{uid}/insight_homes/{id}` | place + year range | Coarse Location; UC | Approximate location; Other UGC |
| `insight_users/{uid}/insight_languages/{id}` | name + proficiency | Other User Content | Other UGC |
| `insight_users/{uid}/insight_jobs/{id}` | role + org + dates | Other User Content | Other UGC |
| `insight_users/{uid}/insight_milestones/{id}` | dated life events | Other User Content | Other UGC |
| `insight_users/{uid}/insight_time_blocks/{id}` | time-tracking sessions | Other User Content | Other UGC |
| `insight_users/{uid}/insight_daily/{date}` | per-day report (mood, weather, one-line, hasPhoto, shared list) | Other User Content; Health | Health info; Other UGC |
| `insight_users/{uid}/relations/{id}` | manually-added people in the user's circle | Contacts | Contacts |
| `insight_users/{uid}/insight_cityratings/{cityId}` | star ratings per dimension | Other User Content | Other UGC |
| `insight_users/{uid}/insight_skills/{id}` | skill name + level | Other User Content | Other UGC |
| `insight_users/{uid}/circle/{viewerUid}` | grant markers (presence-based) | Contacts | Contacts |
| `insight_discoverable/{uid}` | geohash + lat/long (rounded) | Coarse Location | Approximate location |
| `aggregates_by_geohash5/{hash}` | anonymized per-cell averages | Not personal (no user link) | Not personal |
| `Cities/{cityId}` | city catalogue (admin-curated) | Not personal | Not personal |

## Photos

Photos are explicitly handled outside Firestore:
- `localStorage["insight.dailyReport.photo.v1"]` — today's daily-report photo
- `localStorage["insight.dailyReport.photo.{date}.v1"]` — per-day archive
- `localStorage["insight.scrapbook.photos.v1"]` (or per-id) — scrapbook photos

These never sync to Firebase. The Firestore docs only record
`hasPhoto: boolean` and an optional `photoId` for stock photos. The
privacy policy is explicit about this.

When the wearable / Firebase Storage integration lands, photos will
move to Storage and the data inventory will need to update.

## When to update this doc

- A new Firestore collection or top-level document is added.
- A new third-party integration is wired (Sentry, push notification
  service, AI vision provider, bank link, etc.).
- The data flow for an existing collection materially changes (e.g.
  a field that was local-only starts syncing).
- Before each App Store / Play Store resubmission, do a diff against
  the previously-filled forms.
