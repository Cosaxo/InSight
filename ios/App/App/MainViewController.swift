//
//  MainViewController.swift
//  Registers this app's own Capacitor plugins.
//
//  WHY A VIEW CONTROLLER AT ALL, and why not the CAP_PLUGIN macro that
//  docs/DEVICE-BIND.md suggests: that macro lives in an Objective-C file
//  and needs `#import <Capacitor/Capacitor.h>` plus a bridging header.
//  This project has neither — no .m file, no SWIFT_OBJC_BRIDGING_HEADER —
//  and Capacitor arrives as a Swift Package (`CapApp-SPM`), which does not
//  publish an Objective-C umbrella header to import. So the macro route is
//  two blind additions with a real chance of not building. Registering the
//  instance from `capacitorDidLoad()` is all Swift, needs no new build
//  settings, and is Capacitor's own documented path for app-local plugins.
//
//  The cost is one storyboard attribute: Main.storyboard names this class
//  instead of CAPBridgeViewController. If a future `npx cap sync` rewrites
//  that storyboard back, the plugin stops registering and device binding
//  silently defers again — the exact failure D29 already had once. That is
//  the thing to check first if activation logs go quiet.
//
import Capacitor

class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(DeviceBindPlugin())
    }
}
