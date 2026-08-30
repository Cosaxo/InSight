#!/usr/bin/env node
// check-ios-devicebind — the D29 bridge is WIRED, not merely present.
//
// WHY THIS GATE EXISTS. The bridge's absence is silent by construction:
// src/v2/data/deviceBind.ts asks Capacitor.isPluginAvailable("DeviceBind"),
// and when the answer is no it logs one line and returns. No error, no
// Sentry event, no failed vote — because enforcement is soft, the app
// behaves identically whether device binding works or has never run at
// all. That is exactly how D29's gate sat inert from the day it was
// written until D337, while later records (D219 above all) cited it as a
// live control.
//
// So the failure this guards is not "someone deleted the plugin". It is
// the quieter one: the plugin compiles, ships, and is never REGISTERED.
// Registration hangs off a Capacitor-MANAGED file — Main.storyboard's
// customClass — which `npx cap sync` is entitled to rewrite. A sync that
// restores CAPBridgeViewController leaves a green build, a passing test
// suite, and no device binding.
//
// Four assertions, each pinned to one link in that chain.
import { readFileSync, existsSync } from "node:fs";

const PLUGIN = "ios/App/App/DeviceBindPlugin.swift";
const VC = "ios/App/App/MainViewController.swift";
const STORYBOARD = "ios/App/App/Base.lproj/Main.storyboard";
const PBXPROJ = "ios/App/App.xcodeproj/project.pbxproj";

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
  for (const f of [PLUGIN, VC, STORYBOARD, PBXPROJ, JS_CLIENT]) {
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
  return problems;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const problems = checkDeviceBind();
  if (problems.length) {
    console.error("check:ios-devicebind FAILED — the D29 bridge is not wired:");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log("check:ios-devicebind OK — plugin declared, registered, in the storyboard and in the compile phase.");
}
