#!/usr/bin/env node
// check-devicebind — the D29 bridges are WIRED, not merely present.
//
// WHY THIS GATE EXISTS. The bridge's absence is silent by construction:
// src/v2/data/deviceBind.ts asks Capacitor.isPluginAvailable("DeviceBind"),
// and when the answer is no it logs one line and returns. No error, no
// Sentry event, no failed vote — because enforcement is soft, the app
// behaves identically whether device binding works or has never run at
// all. That is exactly how D29's gate sat inert from the day it was
// written until D341, while later records (D219 above all) cited it as a
// live control.
//
// So the failure this guards is not "someone deleted the plugin". It is
// the quieter one: the plugin compiles, ships, and is never REGISTERED.
// Registration hangs off a Capacitor-MANAGED file — Main.storyboard's
// customClass — which `npx cap sync` is entitled to rewrite. A sync that
// restores CAPBridgeViewController leaves a green build, a passing test
// suite, and no device binding.
//
// Both platforms, because the failure is the same shape on each and the
// Android half has one extra way to be silently wrong: registerPlugin must
// run BEFORE super.onCreate, which is where the bridge is built. Called
// after, the plugin compiles, ships, and is invisible to JS.
//
// Every assertion is a regex over a file this gate does not own. Three of
// them are tool-managed (Capacitor writes the storyboard, Xcode the
// pbxproj, Capacitor scaffolds MainActivity), so check-devicebind.test.mjs
// feeds the checker a broken tree per link — otherwise an upstream format
// change turns a real check into a vacuous one without failing.
import { readFileSync, existsSync } from "node:fs";

const PLUGIN = "ios/App/App/DeviceBindPlugin.swift";
const VC = "ios/App/App/MainViewController.swift";
const STORYBOARD = "ios/App/App/Base.lproj/Main.storyboard";
const PBXPROJ = "ios/App/App.xcodeproj/project.pbxproj";
const A_PLUGIN = "android/app/src/main/java/com/cosaxo/insight/DeviceBindPlugin.java";
const A_ACTIVITY = "android/app/src/main/java/com/cosaxo/insight/MainActivity.java";
const A_GRADLE = "android/app/build.gradle";
const A_VARS = "android/variables.gradle";

// The name the JS side registers. Not the Swift class name — a mismatch
// here is the silent failure, so the gate reads the JS as the source of
// truth rather than re-typing the string.
const JS_CLIENT = "src/v2/data/deviceBind.ts";

export function jsPluginName(clientSrc) {
  const m = clientSrc.match(/isPluginAvailable\(\s*"([^"]+)"\s*\)/);
  return m ? m[1] : null;
}

export function checkDeviceBind(read = (p) => readFileSync(p, "utf8"), exists = existsSync) {
  const problems = [];
  for (const f of [PLUGIN, VC, STORYBOARD, PBXPROJ, JS_CLIENT, A_PLUGIN, A_ACTIVITY, A_GRADLE, A_VARS]) {
    if (!exists(f)) problems.push(`missing ${f}`);
  }
  if (problems.length) return problems;

  const plugin = read(PLUGIN);
  const vc = read(VC);
  const story = read(STORYBOARD);
  const pbx = read(PBXPROJ);
  const jsName = jsPluginName(read(JS_CLIENT));

  // 1 · the jsName the plugin declares is the one the client asks for.
  if (!jsName) {
    problems.push(`${JS_CLIENT}: no isPluginAvailable("…") call found — the gate cannot read the expected plugin name`);
  } else if (!new RegExp(`jsName\\s*=\\s*"${jsName}"`).test(plugin)) {
    problems.push(`${PLUGIN}: jsName does not equal "${jsName}", which is what ${JS_CLIENT} looks for — activation would defer forever`);
  }

  // 2 · the plugin declares both methods to the bridge. A Swift @objc func
  //     that is absent from pluginMethods is unreachable from JS in
  //     Capacitor 6+, and fails at call time rather than at build time.
  for (const method of ["generateToken", "requestIntegrityToken"]) {
    if (!new RegExp(`CAPPluginMethod\\(name:\\s*"${method}"`).test(plugin)) {
      problems.push(`${PLUGIN}: "${method}" is not in pluginMethods — Capacitor will not route a call to it`);
    }
  }

  // 3 · something actually registers the instance.
  if (!/registerPluginInstance\(\s*DeviceBindPlugin\(\)\s*\)/.test(vc)) {
    problems.push(`${VC}: does not call registerPluginInstance(DeviceBindPlugin()) — the plugin would compile and never load`);
  }

  // 4 · THE FRAGILE ONE. The storyboard must name the subclass; `npx cap
  //     sync` rewriting it back to CAPBridgeViewController is a silent
  //     un-registration, and it is the single most likely way this breaks.
  if (!/customClass="MainViewController"/.test(story)) {
    problems.push(`${STORYBOARD}: the view controller is not MainViewController — if a cap sync reset it, device binding is silently off`);
  }
  if (!/customModule="App"/.test(story)) {
    problems.push(`${STORYBOARD}: customModule is not "App" — the class will not resolve at runtime and the app opens on a blank bridge`);
  }

  // 5 · both files are in the compile phase. A pbxproj that references a
  //     file without a Sources entry builds cleanly and ships nothing.
  for (const f of ["DeviceBindPlugin.swift", "MainViewController.swift"]) {
    if (!new RegExp(`${f.replace(".", "\\.")} in Sources`).test(pbx)) {
      problems.push(`${PBXPROJ}: ${f} is not in the Sources build phase — it would not be compiled into the app`);
    }
  }
  // ── Android ──────────────────────────────────────────────────────
  const aPlugin = read(A_PLUGIN);
  const aActivity = read(A_ACTIVITY);
  const aGradle = read(A_GRADLE);
  const aVars = read(A_VARS);

  // Same contract as iOS rule 1: the annotation's name is what JS asks for.
  if (jsName && !new RegExp(`@CapacitorPlugin\\(\\s*name\\s*=\\s*"${jsName}"`).test(aPlugin)) {
    problems.push(`${A_PLUGIN}: @CapacitorPlugin name is not "${jsName}", which is what ${JS_CLIENT} looks for`);
  }
  for (const method of ["generateToken", "requestIntegrityToken"]) {
    if (!new RegExp(`public void ${method}\\(`).test(aPlugin)) {
      problems.push(`${A_PLUGIN}: "${method}" is missing — the shared TypeScript interface expects both platforms to answer it`);
    }
  }

  // THE BUG THE DOC SHIPPED. IntegrityTokenRequest refuses to build
  // without a nonce, so a request that omits it fails on every device —
  // and fails the way a missing bridge does, which is to say invisibly.
  if (!/setNonce\(/.test(aPlugin)) {
    problems.push(`${A_PLUGIN}: the integrity request sets no nonce — IntegrityTokenRequest will not build, and the failure is silent to the user`);
  }
  if (!/out\.put\("nonce"/.test(aPlugin)) {
    problems.push(`${A_PLUGIN}: the nonce is not returned to JS, so the server cannot compare it against the signed payload`);
  }

  // Registration, and its ORDER. Capacitor builds the bridge inside
  // super.onCreate; registering after it is a no-op that still compiles.
  const reg = aActivity.indexOf("registerPlugin(DeviceBindPlugin.class)");
  const sup = aActivity.indexOf("super.onCreate(");
  if (reg < 0) {
    problems.push(`${A_ACTIVITY}: does not call registerPlugin(DeviceBindPlugin.class) — the plugin would ship invisible to JS`);
  } else if (sup >= 0 && reg > sup) {
    problems.push(`${A_ACTIVITY}: registerPlugin runs AFTER super.onCreate — the bridge is already built, so the registration is a silent no-op`);
  }

  if (!/com\.google\.android\.play:integrity:/.test(aGradle)) {
    problems.push(`${A_GRADLE}: the Play Integrity dependency is absent — the plugin would not compile`);
  }
  if (!/playIntegrityVersion\s*=/.test(aVars)) {
    problems.push(`${A_VARS}: playIntegrityVersion is undefined — Gradle would interpolate an empty version`);
  }

  return problems;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const problems = checkDeviceBind();
  if (problems.length) {
    console.error("check:devicebind FAILED — a D29 bridge is not wired:");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log("check:devicebind OK — iOS and Android plugins declared, registered and buildable.");
}
