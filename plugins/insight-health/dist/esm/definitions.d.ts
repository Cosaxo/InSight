export interface InsightHealthPlugin {
    /**
     * Whether the underlying health store is usable on this device.
     * False on web. On Android, false when Health Connect isn't
     * installed or the OS version is too old.
     */
    isAvailable(): Promise<{
        available: boolean;
        reason?: string;
    }>;
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
    requestPermissions(): Promise<{
        granted: boolean;
    }>;
    /**
     * Read the data types we already requested permission for and
     * return their current values. iOS hides actual per-type
     * permission state, so this is a best-effort: types the user
     * blocked come back as `null` for the metric.
     */
    getPermissionStatus(): Promise<{
        status: PermissionStatus;
    }>;
    /**
     * Read the snapshot for the local day. Each metric is optional —
     * a value of `undefined` means either the user blocked that data
     * type or no source has written it.
     *
     * Returns the shape that maps one-to-one onto RemoteBodySnapshot
     * so the client can pass it straight into useBodySnapshot.save().
     */
    syncToday(): Promise<{
        snapshot: HealthSnapshot;
    }>;
}
export type PermissionStatus = "unknown" | "granted" | "partial" | "denied";
export interface HealthSnapshot {
    hrvMs?: number;
    restingHrBpm?: number;
    steps?: number;
    vo2Max?: number;
    sleepMinutes?: number;
    sleepDeepMinutes?: number;
    sleepRemMinutes?: number;
    activeKcal?: number;
}
