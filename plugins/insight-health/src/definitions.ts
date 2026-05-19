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

export interface InsightHealthPlugin {
  /**
   * Whether the underlying health store is usable on this device.
   * False on web. On Android, false when Health Connect isn't
   * installed or the OS version is too old.
   */
  isAvailable(): Promise<{ available: boolean; reason?: string }>;

  /**
   * Show the system permission sheet for every data type we need.
   * Resolves once the user has dismissed the sheet. HealthKit
   * doesn't tell us what the user chose (privacy); the only honest
   * signal is whether subsequent reads return data.
   *
   * On Android, this needs to be the first call after the user taps
   * "Enable" — Health Connect's permission UI is an Activity that
   * uses the Activity-result contract.
   */
  requestPermissions(): Promise<{ granted: boolean }>;

  /**
   * Read the data types we already requested permission for and
   * return their current values. iOS hides actual per-type
   * permission state, so this is a best-effort: types the user
   * blocked come back as `null` for the metric.
   */
  getPermissionStatus(): Promise<{ status: PermissionStatus }>;

  /**
   * Read the snapshot for the local day. Each metric is optional —
   * a value of `undefined` means either the user blocked that data
   * type or no source has written it.
   *
   * Returns the shape that maps one-to-one onto RemoteBodySnapshot
   * so the client can pass it straight into useBodySnapshot.save().
   */
  syncToday(): Promise<{ snapshot: HealthSnapshot }>;
}

export type PermissionStatus = "unknown" | "granted" | "partial" | "denied";

export interface HealthSnapshot {
  hrvMs?: number;            // RMSSD, milliseconds
  restingHrBpm?: number;
  steps?: number;
  vo2Max?: number;           // ml/(kg·min)
  sleepMinutes?: number;     // total in-bed/asleep last sleep session
  sleepDeepMinutes?: number;
  sleepRemMinutes?: number;
  activeKcal?: number;
}
