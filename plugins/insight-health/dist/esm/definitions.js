// InsightHealth — bridge to the platform health stores.
//
// iOS: HealthKit (HKHealthStore). Aggregates Apple Watch readings
// plus any third-party device that writes into HealthKit (Garmin,
// Whoop, Oura, Fitbit's HealthKit sync, etc.). Reading one source
// gets us everything the user has paired.
//
// Android: Health Connect (androidx.health.connect). Same model —
// the user's preferred wearable app writes records, we read them.
// Requires the Health Connect app to be installed (pre-installed
// on Android 14+, Play Store install on older versions).
//
// We deliberately keep the surface tiny:
//   - isAvailable()       — can we even use the store? (false on web,
//                           false on Android without Health Connect)
//   - requestPermissions() — present the system grant sheet
//   - getPermissionStatus()
//   - syncToday()         — read today's snapshot in one round-trip
//
// No background sync. The journal-companion framing means people
// open the app once a day; foreground-on-open is enough and
// avoids battery cost + the BGTaskScheduler / WorkManager dance.
export {};
