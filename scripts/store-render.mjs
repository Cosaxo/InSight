// Shared plumbing for the two store-asset generators (gen-screenshots,
// gen-feature-graphic). Not runnable on its own — the same shape as
// spec-globals.mjs, which is a module two consumers share so the two
// cannot drift apart.
//
// Playwright is deliberately NOT a package.json dependency. Adding it
// would make every `npm ci` — CI included — fetch a browser for a job
// that runs a handful of times per release. gen-icons.mjs takes the same
// trade with Chromium. Both generators resolve it from the ambient
// install and print the one-line fix when it is missing.

import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const PREVIEW_URL = "http://localhost:4173/";

export async function loadPlaywright() {
  const candidates = [
    "playwright",
    "/opt/node22/lib/node_modules/playwright/index.mjs",
    "/usr/lib/node_modules/playwright/index.mjs",
    "/usr/local/lib/node_modules/playwright/index.mjs",
  ];
  for (const c of candidates) {
    try { return await import(c); } catch { /* try the next one */ }
  }
  console.error(
    "Playwright not found.\n" +
    "  npm i -D playwright && npx playwright install chromium\n" +
    "It is intentionally not in package.json — see scripts/store-render.mjs.",
  );
  process.exit(1);
}

async function reachable(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch { return false; }
}

// Returns { url, stop }. Reuses an already-running preview if there is
// one, otherwise starts `vite preview` over dist/ and stops it on close.
// The captures are of dist/ and not the dev server on purpose: the dev
// server serves unminified modules over HMR, which is not what ships.
export async function ensureServer(urlArg) {
  const url = urlArg || PREVIEW_URL;
  if (await reachable(url)) return { url, stop() {} };
  if (urlArg) {
    console.error(`store-render: nothing serving at ${urlArg}`);
    process.exit(1);
  }
  if (!existsSync(join(ROOT, "dist/index.html"))) {
    console.error("store-render: no dist/ — run `npm run build` first.");
    process.exit(1);
  }
  const proc = spawn("npx", ["vite", "preview", "--port", "4173", "--strictPort"], {
    cwd: ROOT, stdio: "ignore",
  });
  const deadline = Date.now() + 20000;
  while (!(await reachable(url))) {
    if (Date.now() > deadline) {
      proc.kill();
      console.error("store-render: vite preview never came up.");
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return { url, stop: () => proc.kill() };
}

// PNG dimensions with no dependency. IHDR is always the first chunk:
// 8-byte signature, 4-byte length, 4-byte type, then two big-endian
// uint32s. Both stores reject a wrong-sized asset at the end of a long
// manual upload flow, so the cheap place to catch it is at generation.
export function pngSize(file) {
  const b = readFileSync(file);
  if (b.length < 24 || b.readUInt32BE(12) !== 0x49484452) return null; // 'IHDR'
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}
