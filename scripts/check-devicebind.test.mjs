// check-devicebind.test.mjs — the gate's own tripwires.
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
import { checkDeviceBind, jsPluginName } from "./check-devicebind.mjs";

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
  "android/app/src/main/java/com/cosaxo/insight/DeviceBindPlugin.java": `
    @CapacitorPlugin(name = "DeviceBind")
    public class DeviceBindPlugin extends Plugin {
      @PluginMethod public void requestIntegrityToken(PluginCall call) {
        IntegrityTokenRequest.builder().setNonce(nonce);
        out.put("nonce", nonce);
      }
      @PluginMethod public void generateToken(PluginCall call) { call.reject("ios only"); }
    }`,
  "android/app/src/main/java/com/cosaxo/insight/MainActivity.java": `
    public class MainActivity extends BridgeActivity {
      @Override public void onCreate(Bundle b) {
        registerPlugin(DeviceBindPlugin.class);
        super.onCreate(b);
      }
    }`,
  "android/app/build.gradle": `implementation "com.google.android.play:integrity:$playIntegrityVersion"`,
  "android/variables.gradle": `playIntegrityVersion = '1.4.0'`,
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

  it("catches a registration that is COMMENTED OUT, not only one deleted", () => {
    // Every case in this file deleted a line, and every rule in the gate
    // was a regex over raw source — so a registration commented out to
    // chase something, and left that way, answered yes to "is it
    // registered?". Measured on the real tree before the fix: both
    // platforms' registrations commented out at once, and the gate printed
    // "declared, registered and buildable" and exited 0. The gate now
    // blanks comments first, as every sibling source-scanning gate does.
    const out = run({
      "ios/App/App/MainViewController.swift": GOOD["ios/App/App/MainViewController.swift"]
        .replace("bridge?.registerPluginInstance", "// bridge?.registerPluginInstance"),
    });
    expect(out.join(" "), "a commented-out registration read as a live one").toMatch(/registerPluginInstance/);
  });

  it("catches a block-commented registration too", () => {
    const out = run({
      "ios/App/App/MainViewController.swift": GOOD["ios/App/App/MainViewController.swift"]
        .replace("bridge?.registerPluginInstance(DeviceBindPlugin())",
          "/* bridge?.registerPluginInstance(DeviceBindPlugin()) */"),
    });
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

// ── Android ──────────────────────────────────────────────────────────
//
// Same failure shape, one extra way to be wrong. Every case here is a
// silent failure on a device: the app builds, ships, and simply never
// activates — which is indistinguishable from the state D342 found.
describe("check:devicebind · Android", () => {
  const A_PLUGIN = "android/app/src/main/java/com/cosaxo/insight/DeviceBindPlugin.java";
  const A_ACTIVITY = "android/app/src/main/java/com/cosaxo/insight/MainActivity.java";

  it("catches an integrity request with no nonce — the bug the doc shipped", () => {
    // IntegrityTokenRequest refuses to build without one, so this fails on
    // every device. DEVICE-BIND.md's paste-ready snippet omitted it for a
    // month, and pasting it would have looked exactly like the missing
    // bridge it was written to end.
    const out = run({ [A_PLUGIN]: GOOD[A_PLUGIN].replace("setNonce(nonce)", "build()") });
    expect(out.join(" ")).toMatch(/sets no nonce/);
  });

  it("catches a commented-out registerPlugin on Android as well", () => {
    // Same hole, other platform, and the one with the extra failure mode:
    // registerPlugin must run BEFORE super.onCreate, so this file is where
    // a line gets moved and commented while someone works out an ordering.
    const out = run({
      [A_ACTIVITY]: GOOD[A_ACTIVITY].replace("registerPlugin(DeviceBindPlugin.class);",
        "// registerPlugin(DeviceBindPlugin.class);"),
    });
    expect(out.join(" ")).toMatch(/registerPlugin/);
  });

  it("catches a commented-out nonce — the gate's own headline case", () => {
    // Both halves of the nonce at once, each commented rather than deleted.
    // Measured before the fix: exit 0, "declared, registered and buildable".
    const out = run({
      [A_PLUGIN]: GOOD[A_PLUGIN]
        .replace(".setNonce(nonce)", "/* .setNonce(nonce) */")
        .replace('out.put("nonce", nonce);', '// out.put("nonce", nonce);'),
    });
    expect(out.join(" "), "a commented-out nonce read as a live one").toMatch(/nonce/);
  });

  it("catches a nonce that never reaches JS", () => {
    // Generated and used but not returned: the server then has nothing to
    // compare the signed payload against, and its check silently degrades
    // to "some nonce was present".
    const out = run({ [A_PLUGIN]: GOOD[A_PLUGIN].replace('out.put("nonce", nonce);', "") });
    expect(out.join(" ")).toMatch(/not returned to JS/);
  });

  it("catches registerPlugin running AFTER super.onCreate", () => {
    // The single most likely way to get this wrong, and it compiles. The
    // bridge is built inside super.onCreate, so a later registration is a
    // no-op with no error and no log line.
    const out = run({
      [A_ACTIVITY]: `public class MainActivity extends BridgeActivity {
        @Override public void onCreate(Bundle b) {
          super.onCreate(b);
          registerPlugin(DeviceBindPlugin.class);
        }
      }`,
    });
    expect(out.join(" ")).toMatch(/AFTER super\.onCreate/);
  });

  it("catches a plugin name that disagrees with the client", () => {
    const out = run({ "src/v2/data/deviceBind.ts": `isPluginAvailable("Renamed")` });
    expect(out.join(" ")).toMatch(/@CapacitorPlugin name is not "Renamed"/);
  });

  it("catches a missing Play Integrity dependency or version", () => {
    expect(run({ "android/app/build.gradle": `implementation "androidx.core:core"` }).join(" "))
      .toMatch(/Play Integrity dependency is absent/);
    // An undefined Gradle variable interpolates to empty rather than
    // failing, so the dependency line would resolve to a versionless
    // coordinate — this is why the version has its own assertion.
    expect(run({ "android/variables.gradle": `minSdkVersion = 24` }).join(" "))
      .toMatch(/playIntegrityVersion is undefined/);
  });
});
