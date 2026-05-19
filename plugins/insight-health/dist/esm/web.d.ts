import { WebPlugin } from "@capacitor/core";
import type { HealthSnapshot, InsightHealthPlugin, PermissionStatus } from "./definitions";
export declare class InsightHealthWeb extends WebPlugin implements InsightHealthPlugin {
    isAvailable(): Promise<{
        available: boolean;
        reason?: string;
    }>;
    requestPermissions(): Promise<{
        granted: boolean;
    }>;
    getPermissionStatus(): Promise<{
        status: PermissionStatus;
    }>;
    syncToday(): Promise<{
        snapshot: HealthSnapshot;
    }>;
}
