//
//  DeviceBindPlugin.swift
//  The native half of D29's device binding — the one piece that was
//  missing, and the reason the whole gate did nothing.
//
//  WHAT THIS IS FOR. Clearing app storage gives you a fresh anonymous uid
//  and another vote, forever, on one genuine phone. App Check passes (real
//  app, real device) and rules pass (new uid), so nothing else in the stack
//  sees it. Apple's DeviceCheck holds two bits AGAINST THE DEVICE that
//  survive reinstall and erase, which is what turns "unbounded and free"
//  into "one counted account per device per month" (docs/DEVICE-BIND.md).
//
//  WHY IT WAS NOT HERE. D29 shipped every other part — the callable, the
//  month logic, the rules switch, the client flow — and deliberately left
//  these ~30 lines out because the machine writing them could not compile
//  them. `src/v2/data/deviceBind.ts` then checks for this plugin, does not
//  find it, logs "native bridge missing — activation deferred", and
//  returns. So activation has never run once, on any device, and the gate
//  has been decorative since the day it was written. `ios-build.yml`
//  compiles this target on every PR touching ios/**, which is the check
//  that was actually available all along.
//
//  THIS FILE SENDS NOTHING AND STORES NOTHING. `generateToken` returns an
//  ephemeral, single-use blob that only Apple can read; the server exchanges
//  it for two bits and an update. No device identifier exists on either
//  side of that exchange — which is the property that let D29 add this
//  control without adding a row to the data inventory.
//
import Foundation
import Capacitor
import DeviceCheck

@objc(DeviceBindPlugin)
public class DeviceBindPlugin: CAPPlugin, CAPBridgedPlugin {
    // `jsName` is the name the JS side registers ("DeviceBind" in
    // src/v2/data/deviceBind.ts). It is NOT the class name, and a mismatch
    // fails the way the missing bridge did — isPluginAvailable returns
    // false and activation silently defers.
    public let identifier = "DeviceBindPlugin"
    public let jsName = "DeviceBind"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "generateToken", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestIntegrityToken", returnType: CAPPluginReturnPromise)
    ]

    @objc func generateToken(_ call: CAPPluginCall) {
        guard DCDevice.current.isSupported else {
            // Simulators cannot mint DeviceCheck tokens. Expected there and
            // on nothing else — on a real handset this is a signal, which is
            // why it rejects rather than resolving an empty token that the
            // server would then have to distinguish from a real one.
            call.reject("devicecheck unsupported on this device")
            return
        }
        DCDevice.current.generateToken { data, error in
            if let error = error {
                call.reject("token failed: \(error.localizedDescription)")
                return
            }
            guard let data = data else {
                call.reject("no token data")
                return
            }
            call.resolve(["token": data.base64EncodedString()])
        }
    }

    @objc func requestIntegrityToken(_ call: CAPPluginCall) {
        // Play Integrity's half. Declared here so the one TypeScript
        // interface covers both platforms and the JS never branches on a
        // method's existence — it branches on Capacitor.getPlatform().
        call.reject("android only")
    }
}
