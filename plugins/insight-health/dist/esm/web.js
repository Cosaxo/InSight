import { WebPlugin } from "@capacitor/core";
// Web stub. Browsers don't expose a unified health-data API, and
// even the experimental Web HID / Bluetooth GATT routes are not
// general enough to bridge HealthKit / Health Connect coverage.
// Callers should gate on isAvailable() before doing anything.
export class InsightHealthWeb extends WebPlugin {
    async isAvailable() {
        return { available: false, reason: "web platform" };
    }
    async requestPermissions() {
        return { granted: false };
    }
    async getPermissionStatus() {
        return { status: "denied" };
    }
    async syncToday() {
        return { snapshot: {} };
    }
}
