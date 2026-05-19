import { WebPlugin } from "@capacitor/core";

import type {
  HealthSnapshot,
  InsightHealthPlugin,
  PermissionStatus,
} from "./definitions";

// Web stub. Browsers don't expose a unified health-data API, and
// even the experimental Web HID / Bluetooth GATT routes are not
// general enough to bridge HealthKit / Health Connect coverage.
// Callers should gate on isAvailable() before doing anything.
export class InsightHealthWeb extends WebPlugin implements InsightHealthPlugin {
  async isAvailable(): Promise<{ available: boolean; reason?: string }> {
    return { available: false, reason: "web platform" };
  }
  async requestPermissions(): Promise<{ granted: boolean }> {
    return { granted: false };
  }
  async getPermissionStatus(): Promise<{ status: PermissionStatus }> {
    return { status: "denied" };
  }
  async syncToday(): Promise<{ snapshot: HealthSnapshot }> {
    return { snapshot: {} };
  }
}
