// A screen on its own React root has to join the back stack itself.
//
// THE CLASS, not three more single pins. `app-shell.jsx`'s back handler
// peels `closeTopBackLayer()` → person → city → overlay → tab, and every
// one of those but the first is SHELL STATE. A screen mounted on its own
// root and appended to `document.body` is in none of them: the shell
// cannot see it, cannot peel it, and returns false — at which point
// `data/back.ts` runs `if (!consumed) void App.exitApp()` and the app
// quits with the screen still on it.
//
// That is verbatim the failure `data/backLayers.ts` was written to stop,
// and on 2026-09-06 it was live on TWO screens at once: D393's
// first-launch walkthrough — the first thing every Android user of the
// Play build sees — and D151's account questions behind it. Both took the
// KEYBOARD half of the D24 contract (`useDialog`: Escape, a focus trap)
// and neither called `pushBackLayer`. Worse than the quit: both write
// their seen-flag only from `onDone`, so quitting through Back recorded
// nothing and the next launch served the same screen again.
//
// Nothing could have caught it. `dialog.test.jsx` pins that a `Sheet`
// registers a layer; no rule generalised it, and `useDialog` cannot be the
// marker either — six spec overlays call it legitimately without a layer,
// because the shell peels them BY NAME as person/city/ov. Being outside
// `<App/>` is what makes a screen unreachable, so that is what this scans
// for.
//
// The set is two today. The point is the third: it fails here on the day
// it is written rather than on the day someone presses Back on a phone.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
// @ts-expect-error TS7016 — untyped gate helper, shared with scripts/
import { stripComments } from "../../../scripts/strip-comments.mjs";

const V2 = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Every source file under src/v2, tests and type declarations aside. */
function sources(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { sources(p, out); continue; }
    if (!/\.(tsx?|jsx?)$/.test(e) || /\.test\.|\.d\.ts$/.test(e)) continue;
    out.push(p);
  }
  return out;
}

/**
 * `main.jsx` mounts the app's own root and is the one exemption there can
 * be: the component it renders IS the shell that owns the back handler,
 * so requiring it to register a layer would ask the peeler to queue behind
 * itself. Named here rather than pattern-matched, so a second file
 * claiming the same exemption has to say so in a diff.
 */
const APP_ROOT = "main.jsx";

interface Root { file: string; rel: string; component: string; src: string }

const roots: Root[] = [];
for (const file of sources(V2)) {
  const src = readFileSync(file, "utf8");
  // Own root AND its own host element on the body — either alone is not
  // the shape (a portal into the shell's tree is still inside <App/>).
  if (!/createRoot\(/.test(src) || !/document\.body\.appendChild\(/.test(src)) continue;
  const rel = file.slice(V2.length + 1);
  if (rel === APP_ROOT) continue;
  const m = src.match(/\.render\(\s*<([A-Z]\w*)/);
  roots.push({ file, rel, component: m ? m[1] : "", src });
}

describe("a screen on its own root joins the back stack", () => {
  it("finds the standalone roots — vacuous otherwise", () => {
    // The floor. A scan that stopped matching would make the assertion
    // below pass over an empty list, which is this file's own failure
    // pointed at itself.
    const rels = roots.map((r) => r.rel).sort();
    expect(rels).toContain("ui/walkthrough.tsx");
    expect(rels).toContain("ui/profileSetup.tsx");
    expect(roots.every((r) => r.component), `a root whose rendered component could not be read: ${rels.join(", ")}`).toBe(true);
  });

  it("every one of them renders a component that registers a layer", () => {
    const offenders: string[] = [];
    for (const r of roots) {
      // The component is imported from a sibling module; the registration
      // lives in the COMPONENT, not in the mount, because the layer's
      // lifetime is the mount's lifetime and `pushBackLayer` returns the
      // remover an effect cleanup wants.
      const imp = r.src.match(new RegExp(`import\\s+${r.component}\\s+from\\s+["']([^"']+)["']`));
      const target = imp
        ? [".tsx", ".ts", ".jsx", ".js"]
            .map((ext) => join(dirname(r.file), imp[1] + ext))
            .find((p) => { try { return statSync(p).isFile(); } catch { return false; } })
        : r.file;
      // STRIPPED, because the first version of this rule was vacuous and
      // said so under mutation: the fix it polices carries a comment
      // explaining `pushBackLayer`, so a raw scan matched the prose and
      // passed with the registration deleted. The repo's own recurring
      // gate defect (source-pins.test.mjs), committed here by the rule
      // written to prevent a different one — caught only because the
      // mutation was run rather than reasoned about.
      const body = stripComments(target ? readFileSync(target, "utf8") : r.src) as string;
      if (!/pushBackLayer/.test(body)) offenders.push(`${r.rel} → ${r.component}`);
    }
    expect(
      offenders,
      "a screen outside <App/> that Android's back button cannot close — the shell "
        + "peels person/city/overlay/tab and none of them is this, so back.ts calls "
        + "App.exitApp(). Register one: useEffect(() => pushBackLayer(() => ref.current()), []).",
    ).toEqual([]);
  });
});
