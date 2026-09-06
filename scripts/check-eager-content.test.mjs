// What check:eager-content DEMANDS, proved by breaking a tree rather than
// by reading the source. Both refusals are the ones that failed to exist on
// 2026-09-05: a content module reaching first paint through a static import
// (which is how the farm lane ended up behind the bundle ceiling), and an
// allowlist line outliving the debt it names.
//
// The fixture is a miniature app rather than a copy of the repo: the gate
// walks static imports from src/v2/main.jsx, so a handful of files
// reproduces every edge it can see, and the test says what it is about
// instead of inheriting whatever the real tree happens to import today.
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GATE = join(root, "scripts", "check-eager-content.mjs");

/** A tree with `files` written under it, and the gate run inside it. */
function runIn(files) {
  const dir = mkdtempSync(join(tmpdir(), "eager-content-"));
  try {
    mkdirSync(join(dir, "scripts"), { recursive: true });
    copyFileSync(GATE, join(dir, "scripts", "check-eager-content.mjs"));
    for (const [p, body] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, p)), { recursive: true });
      writeFileSync(join(dir, p), body);
    }
    try {
      const out = execFileSync("node", [join(dir, "scripts", "check-eager-content.mjs")], {
        cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
      });
      return { code: 0, out };
    } catch (e) {
      return { code: e.status, out: (e.stdout || "") + (e.stderr || "") };
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// The six real allowlist entries are eager in the repo but absent from a
// fixture, so every fixture run trips the ratchet unless they are present.
// Supplying them keeps each case about the one thing it is testing.
const DEBT = {
  "src/v2/spec/sample-data.js": "export const S = 1;\nimport '../../../content/duel-questions.json';\n",
  "src/v2/spec/duels-data.js": "import './sample-data.js';\nexport const D = 1;\n",
  "src/v2/spec/world-feed-data.js": "export const W = 1;\n",
  "src/v2/spec/test-feed-data.js": "export const T = 1;\n",
  "src/v2/spec/archetype-data.js": "export const A = 1;\n",
  "content/duel-questions.json": "{}\n",
};
const DEBT_IMPORTS = Object.keys(DEBT)
  .filter((p) => p.endsWith(".js"))
  .map((p) => `import '${p.replace("src/v2/", "./")}';`).join("\n");

describe("check:eager-content", () => {
  it("passes when the only content in first paint is the named debt", () => {
    const r = runIn({ ...DEBT, "src/v2/main.jsx": DEBT_IMPORTS + "\n" });
    expect(r.out).toContain("check:eager-content OK");
    expect(r.code).toBe(0);
  });

  it("sees a BARE side-effect import even when a `from` import follows it", () => {
    // THE SHAPE EVERY CASE IN THIS FILE USED TO MISS, and the reason it
    // could: `DEBT_IMPORTS` is side-effect imports only, so no fixture
    // entry ever contained a ` from ` for the walk's regex to reach past.
    // The real entry — src/v2/main.jsx — has had one from the beginning.
    //
    // The optional clause group was `[\s\S]*?`, lazy but unbounded, so it
    // expanded ACROSS the statement break to the next line's ` from `,
    // consumed the bare import and captured the LATER specifier. Measured
    // on the real tree: prepending `import "./spec/daily-questions.js";`
    // to main.jsx left the gate printing OK with the module count
    // unmoved — the D382–D384 regression this gate exists to refuse,
    // walking straight past it.
    const r = runIn({
      ...DEBT,
      // Bare import FIRST, a `from` import after it. Swap the two lines
      // and the old regex catches it, which is what made this invisible.
      "src/v2/main.jsx": DEBT_IMPORTS + "\nimport './spec/daily-questions.js';\nimport { App } from './spec/app-shell.jsx';\n",
      "src/v2/spec/app-shell.jsx": "export const App = 1;\n",
      "src/v2/spec/daily-questions.js": "export const DAILYQ = { questions: [] };\n",
    });
    expect(r.code, "a bare content import walked straight past the gate").toBe(1);
    expect(r.out).toContain("src/v2/spec/daily-questions.js");
    expect(r.out).toContain("imported by: src/v2/main.jsx");
  });

  it("REFUSES a content module pulled in by a static import, and names the chain", () => {
    // Exactly yesterday's edge: the daily tab is in the entry chunk and
    // imported the archive for one demo id.
    const r = runIn({
      ...DEBT,
      "src/v2/main.jsx": DEBT_IMPORTS + "\nimport './spec/daily-split.jsx';\n",
      "src/v2/spec/daily-split.jsx": "import { DAILYQ } from './daily-questions.js';\nexport default DAILYQ;\n",
      "src/v2/spec/daily-questions.js": "export const DAILYQ = { questions: [] };\n",
    });
    expect(r.code).toBe(1);
    expect(r.out).toContain("src/v2/spec/daily-questions.js");
    // the chain is the actionable half — without it the gate names a file
    // and leaves you to find the edge, which is what took the measuring.
    expect(r.out).toContain("imported by: src/v2/spec/daily-split.jsx");
    expect(r.out).toContain("src/v2/main.jsx");
  });

  it("ALLOWS the same module behind a dynamic import", () => {
    // The fix the gate's own message asks for must actually pass it.
    const r = runIn({
      ...DEBT,
      "src/v2/main.jsx": DEBT_IMPORTS + "\nimport './spec/daily-split.jsx';\n",
      "src/v2/spec/daily-split.jsx": "export const dq = () => import('./daily-questions.js');\n",
      "src/v2/spec/daily-questions.js": "export const DAILYQ = { questions: [] };\n",
    });
    expect(r.out).toContain("check:eager-content OK");
    expect(r.code).toBe(0);
  });

  it("REFUSES an allowlist line whose module is no longer eager (the ratchet)", () => {
    const rest = { ...DEBT };
    delete rest["src/v2/spec/archetype-data.js"];
    const imports = DEBT_IMPORTS.replace("import './spec/archetype-data.js';", "");
    const r = runIn({ ...rest, "src/v2/main.jsx": imports + "\n" });
    expect(r.code).toBe(1);
    expect(r.out).toContain("delete their allowlist lines");
    expect(r.out).toContain("src/v2/spec/archetype-data.js");
  });

  it("treats any content/ seed as content, not just the listed modules", () => {
    const r = runIn({
      ...DEBT,
      "src/v2/main.jsx": DEBT_IMPORTS + "\nimport './spec/feed-thing.js';\n",
      "src/v2/spec/feed-thing.js": "import '../../../content/feed-questions.json';\nexport const F = 1;\n",
      "content/feed-questions.json": "{}\n",
    });
    expect(r.code).toBe(1);
    expect(r.out).toContain("content/feed-questions.json");
  });
});
