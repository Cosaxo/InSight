// check-ios-devicebind.test.mjs — the gate's own tripwires.
//
// A gate that checks something silent has to be checked itself, and this
// one has the shape that goes wrong quietly: every assertion is a regex
// over a file it does not own. Three of the four files are managed by
// other tools (Capacitor writes the storyboard, Xcode the pbxproj), so a
// format change upstream turns a real check into a vacuous one WITHOUT
// failing — the "check that passes because it never ran" failure this
// repo keeps naming.
//
// So each case below feeds the checker a tree with exactly one link
// broken, and asserts the gate says so. If a future refactor makes any of
// these pass, the gate has stopped reading what it thinks it reads.
import { describe, it, expect } from "vitest";
import { checkDeviceBind, jsPluginName } from "./check-ios-devicebind.mjs";

const GOOD = {
  "ios/App/App/DeviceBindPlugin.swift": `
    @objc(DeviceBindPlugin)
    public class DeviceBindPlugin: CAPPlugin, CAPBridgedPlugin {
      public let identifier = "DeviceBindPlugin"
      public let jsName = "DeviceBind"
      public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "generateToken", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestIntegrityToken", returnType: CAPPluginReturnPromise)
      ]
    }`,
  "ios/App/App/MainViewController.swift": `
    class MainViewController: CAPBridgeViewController {
      override func capacitorDidLoad() { bridge?.registerPluginInstance(DeviceBindPlugin()) }
    }`,
  "ios/App/App/Base.lproj/Main.storyboard":
    `<viewController id="BYZ-38-t0r" customClass="MainViewController" customModule="App" customModuleProvider="target"/>`,
  "ios/App/App.xcodeproj/project.pbxproj": `
    DB29B11D0000000000DB0002 /* DeviceBindPlugin.swift in Sources */ = {isa = PBXBuildFile; };
    DB29B11D0000000000DB0004 /* MainViewController.swift in Sources */ = {isa = PBXBuildFile; };`,
  "src/v2/data/deviceBind.ts": `if (!Capacitor.isPluginAvailable("DeviceBind")) { return; }`,
};

const run = (over = {}) => {
  const files = { ...GOOD, ...over };
  return checkDeviceBind((p) => files[p], (p) => files[p] !== undefined);
};

describe("check:ios-devicebind", () => {
  it("passes on a correctly wired tree", () => {
    expect(run()).toEqual([]);
  });

  it("reads the expected plugin name out of the CLIENT, not a hard-coded copy", () => {
    // The name is a contract between two files. If the gate re-typed it,
    // renaming the plugin on both sides would still fail here for no
    // reason — and renaming it on ONE side would pass. This asserts the
    // read direction, which is the property that makes the check real.
    expect(jsPluginName(`Capacitor.isPluginAvailable("SomethingElse")`)).toBe("SomethingElse");
    const out = run({ "src/v2/data/deviceBind.ts": `isPluginAvailable("SomethingElse")` });
    expect(out.join(" ")).toMatch(/jsName does not equal "SomethingElse"/);
  });

  it("catches a cap sync resetting the storyboard — the silent un-registration", () => {
    const out = run({
      "ios/App/App/Base.lproj/Main.storyboard":
        `<viewController customClass="CAPBridgeViewController" customModule="Capacitor"/>`,
    });
    expect(out.join(" ")).toMatch(/not MainViewController/);
  });

  it("catches a plugin that is never registered", () => {
    const out = run({ "ios/App/App/MainViewController.swift": `class MainViewController: CAPBridgeViewController {}` });
    expect(out.join(" ")).toMatch(/registerPluginInstance/);
  });

  it("catches an @objc method missing from pluginMethods", () => {
    // Capacitor 6+ routes by the declared list, so a method that exists in
    // Swift and not in pluginMethods fails at CALL time on a device — the
    // one failure mode no build and no test in this repo can reach.
    const out = run({
      "ios/App/App/DeviceBindPlugin.swift": GOOD["ios/App/App/DeviceBindPlugin.swift"]
        .replace(/CAPPluginMethod\(name: "requestIntegrityToken"[^\n]*\n/, ""),
    });
    expect(out.join(" ")).toMatch(/requestIntegrityToken/);
  });

  it("catches a file referenced by the project but left out of the compile phase", () => {
    const out = run({ "ios/App/App.xcodeproj/project.pbxproj": `DeviceBindPlugin.swift in Sources` });
    expect(out.join(" ")).toMatch(/MainViewController\.swift is not in the Sources build phase/);
  });

  it("names a missing file rather than throwing", () => {
    const out = run({ "ios/App/App/MainViewController.swift": undefined });
    expect(out).toEqual(["missing ios/App/App/MainViewController.swift"]);
  });
});
