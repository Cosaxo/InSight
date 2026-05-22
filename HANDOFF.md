# Session handoff · what's done, what's not

Written at the end of the chat session that ran 32 commits between
`6ee4758` (Sentry wiring) and `0a02309` (dream quick-capture).
Branch: `claude/project-plan-9LaiG`.

## You need to deploy

These ship the schema + server rules for everything we built. The
client compiles + runs without them, but cross-user paths fail in
production.

```bash
firebase deploy --only firestore:rules,firestore:indexes,functions
```

Then manually invoke once in the Firebase Console (functions ship
with `rebuildX` callable + a scheduled twin running every 24 h):
- `rebuildWorldAggregates` — seeds `aggregates_world/snapshot` with
  the global + per-country breakdown the World tab reads.
- `rebuildCityAggregates` — seeds `aggregates_city/{slug}` for the
  City tab community averages + impression strips.

After the first run, both refresh daily without intervention.

## You also need to do, separately

| Item | What |
|---|---|
| `npm run sync` + `pod install` | Pulls the in-repo `plugins/insight-llm` (vision Gemma) and `plugins/insight-health` (HealthKit / Health Connect) into the native shells. None of the native LLM / wearable code reaches a device until this runs. |
| iOS HealthKit capability | Xcode → App target → Signing & Capabilities → "+ Capability" → HealthKit. Paid Apple Dev tier required. |
| Android Health Connect | Pre-installed on Android 14+; older devices prompt on first permission request. |
| Test the vision-Gemma plugin | I wrote the native Swift / Kotlin blind. Expect 1–2 build errors to surface; paste them and they're mechanical to fix. |

## Bottom of the brainstorm — nothing concrete left to build

The session worked through every concrete item on the punch list.
What remains is gated on operational work (above) or product
decisions you've explicitly deferred:

| Item | Status | Note |
|---|---|---|
| Push notifications | Gated on you | Need FCM VAPID key + APNs Authentication Key. UI scaffolding hasn't been built. |
| Bank linking (Plaid / Tink) | Deferred by you | Per-connection cost. Receipt-photo via Gemma vision is the proposed alternative — unbuilt but the vision plugin exists. |
| Gemini API key (web AI fallback) | Deferred by you | Web users get no AI features today. |
| City editorial content | Deferred / needs your content | Long-tail cities show "no editorial yet"; only the curated ~30 have blurbs + axis seeds. |
| DNA tab | Decided to keep as-is for now | Still renders pure seed data (Norwegian 58.4%, etc.). Option B (manual paste) + C (raw-file parser) discussed but you said too complex. |

## Known issues + loose ends

These are real but ship-ready code; I just noticed them at the end.

- **Native plugin code not verified.** Swift + Kotlin in both
  `plugins/insight-llm` and `plugins/insight-health` was written
  against my read of MediaPipe / HealthKit / Health Connect docs
  and never compiled against the SDKs. Expect SDK-version drift
  errors on first `pod install` / `gradle build`.
- **`SHARE_DATA` in SharingOverlay** still has dead entries.
  Some of the toggles ("milestones", "media", etc.) never had
  cross-user reads wired and now never will. Harmless but stale.
- **DnaOverlay** — still renders seed data. Discussed (option B
  manual paste / option D Heritage reframe / option A delete the
  tab); no decision made. Tab still works, just lies.
- **Voting backend (Interest items)** — shipped (`4b7b185`) but
  was never exercised in production. The composite index on
  `(interestSlug, type, voteCount desc)` needs to finish building
  in Firestore (1–2 min after deploy) before the leaderboard
  query works.
- **Stranded code** that's compiled but unreachable:
  - `RemoteSkill` + `addSkill` / `subscribeSkills` / etc. in
    firebaseImpl + firebase.ts — old skill API, replaced by the
    new `insight_profile_skills` collection. Safe to delete in a
    cleanup pass.
  - The original `useSkills.ts` was deleted earlier; these are
    just the lingering server-side bindings.
- **FAB still grows.** Currently at 7 items. If more features land
  it'll re-bloat — needs a real grouping pass (input vs nav vs
  settings) if it hits 10 again.
- **`shareImpressionsAbout`** on the discoverable doc is
  denormalised but the cross-user read of impressions is the
  first feature that genuinely depends on Firestore-rule
  consistency between the profile field (source of truth) and
  the discoverable field (UX hint). If a user updates the profile
  field while offline, the discoverable doc could lag behind for
  a write cycle. Minor.
- **Today pill (App header)** uses ~80 px of width. Untested on
  narrow screens. If it wraps badly, the easiest fix is to
  remove the mood-label text and keep only the dot.

## What got shipped this session (32 commits, oldest first)

```
6ee4758  feat(obs): Sentry + Crashlytics
8617afe  feat(security): Firebase App Check
b456255  feat(backup): JSON export / import
df1f933  feat(rules): server-side validation + city tier
d8f686a  feat(around): live compass widget
f9e585e  feat(visits): Leaflet map
4fd7fec  feat(storage): opt-in cloud photos
0cbd5ce  feat(body): TDEE + macro % + streak + heatmap
eb8b4e4  feat(meals): AI-assist (text) on-device Gemma
ea44cd4  feat(onboarding): welcome flow
36be9fc  refactor + settings: politics extracted; sign-out + telemetry
7194d6f  refactor(taxonomies): interest / skill / groupTest extracted
473f974  feat(nearby): Big Five match% (cosine)
b61c319  feat(body): wearable scaffold + dev mock
5db5c86  feat(llm): custom Capacitor plugin (vision Gemma)
3492f36  feat(health): HealthKit + Health Connect plugin
fa77b67  feat(nearby): bio + role + derived age
2ca00e2  feat(social): friend system + widened impressions inbox
04c55e7  chore(language): plainer copy everywhere
3033a60  feat(interests): Groups → Interests tab
4b7b185  feat(interests): community voting backend
50cd620  feat(people): circle interest distribution
f8858b1  feat(world): userbase aggregates by country
d1ee4f7  feat(city): 7-dimension ratings + community avgs
4867394  chore(profile, mood): section nav + plainer moods
b503006  feat(daily): live weather + AI mood
8d10f6c  feat(tests): money / chronotype / attachment + tab reorder
c9f9eb4  feat(insight): cross-tab uses for the four tests
ef3a261  feat(person): similarity card + share-impressions
66ce2e4  feat(life): achievements + skills
f190e79  feat(aggregates): impression breakdowns per city + country
c6e50ad  feat(nav): tighter FAB + Today pill
9c4b689  feat(daily): sleep + energy + activities + highlight
1bcbd6b  fix(profile): restore Sharing + Journal reachability
0a02309  feat(daily): dream quick-capture
```

## Quick map of where the major surfaces live

| Surface | File |
|---|---|
| Six tests + new compute | `src/lib/useProfile.ts`, `src/components/overlays/TestOverlay.tsx` |
| Voting backend | `src/lib/useInterestVotes.ts`, `functions/src/index.ts` |
| World aggregates | `functions/src/index.ts` (`runWorldAggregation`), `src/lib/useWorldAggregates.ts` |
| City aggregates | `functions/src/index.ts` (`runCityAggregation`), `src/lib/useCityAggregate.ts` |
| Impression aggregates | `functions/src/index.ts` (`rollUpImpressions`) — folded into both world + city snapshots |
| Friend system | `src/lib/useMyRelations.ts`, `firestore.rules` (`/followers`, `/friendRequests`, `/blocks`, `/circle`) |
| Native plugins | `plugins/insight-llm/`, `plugins/insight-health/` |
| Custom hooks added | `useBodySnapshot`, `useHealthSync`, `useMyRelations`, `useInterests`, `useInterestStats`, `useInterestVotes`, `useCircleInterestDistribution`, `useWorldAggregates`, `useCityAggregate`, `usePersonImpressions` |

## Next session, if you come back to it

The natural priority order:
1. Deploy rules + functions + seed the aggregate docs. Without
   this, half the new code does nothing in production.
2. `npm run sync` + native build to validate the LLM + Health
   plugins compile.
3. Use the app for a few days. New issues will surface from real
   use that no audit catches.
4. Then pick from the deferred list (DNA, push, bank, etc.)
   based on what you actually missed.

— end of handoff —
