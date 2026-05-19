// InsightHealthPlugin — Capacitor binding for the HealthKit bridge.
// Pure shim: translates JS args into Swift calls on InsightHealth.

import Capacitor
import Foundation

@objc(InsightHealthPlugin)
public class InsightHealthPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "InsightHealthPlugin"
    public let jsName = "InsightHealth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getPermissionStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "syncToday", returnType: CAPPluginReturnPromise),
    ]

    private lazy var bridge = InsightHealth()

    @objc func isAvailable(_ call: CAPPluginCall) {
        let result = bridge.isAvailable()
        var payload: [String: Any] = ["available": result.available]
        if let reason = result.reason { payload["reason"] = reason }
        call.resolve(payload)
    }

    @objc func requestPermissions(_ call: CAPPluginCall) {
        Task {
            do {
                let granted = try await bridge.requestPermissions()
                call.resolve(["granted": granted])
            } catch {
                call.reject("PERMISSION_REQUEST_FAILED", error.localizedDescription, error)
            }
        }
    }

    @objc func getPermissionStatus(_ call: CAPPluginCall) {
        // HealthKit on iOS deliberately doesn't expose read-permission
        // status (privacy: would let apps detect which data the user
        // blocked). The honest answer is "unknown" until a read
        // either returns data or doesn't.
        call.resolve(["status": "unknown"])
    }

    @objc func syncToday(_ call: CAPPluginCall) {
        Task {
            do {
                let snap = try await bridge.syncToday()
                call.resolve(["snapshot": snap.toDictionary()])
            } catch InsightHealthError.notAvailable {
                call.reject("NOT_AVAILABLE", "HealthKit is not available on this device.")
            } catch InsightHealthError.permissionDenied {
                call.reject("PERMISSION_DENIED", "Permission for one or more data types was not granted.")
            } catch {
                call.reject("SYNC_FAILED", error.localizedDescription, error)
            }
        }
    }
}
