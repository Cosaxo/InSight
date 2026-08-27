// Rasterise design/icon/mark.svg into every launcher icon the two shells
// need. Run after changing the mark:
//
//   node scripts/gen-icons.mjs
//
// Renders through the Chromium that Playwright already installs
// (default /opt/pw-browsers) rather than adding sharp or ImageMagick: the
// icon changes about once a product lifetime, so a build-time image
// dependency in package.json would be permanent cost for a one-off job.
// Override with CHROME=/path/to/chrome if it lives elsewhere.
//
// Two masters are rendered at 1024 and every size is derived by area-average
// downsampling here, rather than screenshotting each size directly. Direct
// small screenshots do not work: Chromium clamps the window to a platform
// minimum, so --window-size=48,48 silently produced a 48px image of pure
// background — a blank icon that looked plausible in a file listing and only
// showed up when the pixels were counted. Downsampling is also simply better
// antialiasing than rendering a 48px viewport.
//
// The icon is the INK TILE (D302): the identity canvas's primary icon is
// the mark on --ink, not on paper, so every output here composites the
// mark-tile group (the brightened tile palette) over INK. The paper-ground
// group in the same file belongs to the feature graphic, not to any icon.
//
// Three output families, and they are NOT the same picture:
//   - ic_launcher_foreground: transparent, mark at 55% (Android composites
//     it over @color/ic_launcher_background and then masks it — content must
//     stay inside the 66/108 safe zone or a circular mask clips it).
//   - ic_launcher / ic_launcher_round: opaque ink background, mark at 73%
//     (the canvas's 13/96 tile padding), for pre-26 Android which has no
//     adaptive layer.
//   - AppIcon-512@2x: opaque 1024, mark at 73%. iOS applies its own corner
//     mask and the store rejects alpha in the marketing icon, so this is
//     written as RGB with no alpha channel at all.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { deflateSync, inflateSync } from "node:zlib";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// The tile ground: --ink (oklch 0.216 0.011 70), same hex as the mark's
// preview rect. MUST equal values/ic_launcher_background.xml, or Android
// 26+ composites the adaptive foreground over one colour while pre-26
// ships the other baked in. (The splash stays paper #FAF9F2 — the icon
// stopped matching it at D302, deliberately.)
const INK = "#1d1914";
const MASTER = 1024;

// ── the lock, and the outputs it covers ──────────────────────────────
// D324 found the app icon on no gate's path: this script is the only
// writer of every launcher icon, it had no package.json entry, and no
// workflow invoked it — so a stale or hand-touched icon would ship with
// every gate green. The lock is the fix that works without Chromium in
// CI (a re-render is not byte-stable across Chromium versions): each run
// records the hash of the mark, of this script, and of every file it
// wrote, and `check:icons` holds the committed tree to it.
//
// Android density buckets: legacy square/round px, then adaptive
// foreground px. (Declared here rather than at the write loop because
// the lock needs the output list before anything renders.)
const ANDROID = [
  ["mdpi", 48, 108],
  ["hdpi", 72, 162],
  ["xhdpi", 96, 216],
  ["xxhdpi", 144, 324],
  ["xxxhdpi", 192, 432],
];
const OUTPUTS = [
  ...ANDROID.flatMap(([bucket]) => [
    `android/app/src/main/res/mipmap-${bucket}/ic_launcher.png`,
    `android/app/src/main/res/mipmap-${bucket}/ic_launcher_round.png`,
    `android/app/src/main/res/mipmap-${bucket}/ic_launcher_foreground.png`,
  ]),
  "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png",
];
const LOCK = join(root, "design/icon/icons.lock.json");

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function writeLock() {
  const lock = {
    "//": "Written by scripts/gen-icons.mjs; npm run check:icons holds the committed icons to it. Do not hand-edit.",
    source: sha256(join(root, "design/icon/mark.svg")),
    script: sha256(fileURLToPath(import.meta.url)),
    ink: INK,
    outputs: Object.fromEntries(OUTPUTS.map((p) => [p, sha256(join(root, p))])),
  };
  writeFileSync(LOCK, JSON.stringify(lock, null, 2) + "\n");
}

// --relock adopts the COMMITTED outputs as they stand, no Chromium and
// no re-render. It exists for exactly one shape of moment: outputs whose
// provenance was verified some other way (build 26's icon was pinned to
// D302's commit by D324's own audit) predate the lock, and re-rendering
// here would swap shipped bytes for a different Chromium's near-identical
// render — a change nobody asked for on files already delivered. It does
// NOT verify the icons match the mark; it asserts they are what the tree
// holds today, so every FUTURE change to mark, script or output trips
// the gate until a real run.
if (process.argv.includes("--relock")) {
  writeLock();
  console.log(`gen-icons: relocked ${OUTPUTS.length} committed icons into design/icon/icons.lock.json — no render`);
  process.exit(0);
}

const CHROME = process.env.CHROME || [
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  "/opt/pw-browsers/chromium/chrome-linux/chrome",
  "/usr/bin/chromium",
  "/usr/bin/google-chrome",
].find((p) => existsSync(p));

if (!CHROME) {
  console.error("gen-icons: no Chromium found. Set CHROME=/path/to/chrome.");
  process.exit(1);
}

// ── minimal PNG read/write (no deps) ─────────────────────────────────
function crc32(buf) {
  let c, table = crc32.t;
  if (!table) {
    table = crc32.t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  c = -1;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function readPng(path) {
  const d = readFileSync(path);
  let i = 8, w = 0, h = 0, ct = 0;
  const idat = [];
  while (i < d.length) {
    const len = d.readUInt32BE(i);
    const type = d.toString("ascii", i + 4, i + 8);
    if (type === "IHDR") { w = d.readUInt32BE(i + 8); h = d.readUInt32BE(i + 12); ct = d[i + 17]; }
    if (type === "IDAT") idat.push(d.slice(i + 8, i + 8 + len));
    i += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const ch = ct === 6 ? 4 : 3;
  const stride = w * ch + 1;
  const out = Buffer.alloc(w * h * ch);
  let prev = Buffer.alloc(w * ch);
  for (let y = 0; y < h; y++) {
    const f = raw[y * stride];
    const line = raw.slice(y * stride + 1, y * stride + 1 + w * ch);
    const cur = Buffer.alloc(w * ch);
    for (let x = 0; x < w * ch; x++) {
      const a = x >= ch ? cur[x - ch] : 0, b = prev[x], c2 = x >= ch ? prev[x - ch] : 0;
      let v = line[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const pa = Math.abs(b - c2), pb = Math.abs(a - c2), pc = Math.abs(a + b - 2 * c2);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c2;
      }
      cur[x] = v & 255;
    }
    cur.copy(out, y * w * ch);
    prev = cur;
  }
  return { w, h, ch, px: out };
}

function writePng(path, { w, h, ch, px }) {
  const stride = w * ch;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filter: none — these are flat graphics, deflate handles them
    px.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;                    // bit depth
  ihdr[9] = ch === 4 ? 6 : 2;     // colour type: RGBA or RGB
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]));
}

// Area-average resize. Alpha is premultiplied before averaging and undone
// after, so a transparent edge pixel cannot drag its (arbitrary) RGB into
// the average and fringe the mark.
function resize(src, size) {
  const { w: sw, h: sh, ch, px } = src;
  const out = Buffer.alloc(size * size * ch);
  const sx = sw / size, sy = sh / size;
  for (let y = 0; y < size; y++) {
    const y0 = Math.floor(y * sy), y1 = Math.min(sh, Math.ceil((y + 1) * sy));
    for (let x = 0; x < size; x++) {
      const x0 = Math.floor(x * sx), x1 = Math.min(sw, Math.ceil((x + 1) * sx));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * sw + xx) * ch;
          const av = ch === 4 ? px[i + 3] / 255 : 1;
          r += px[i] * av; g += px[i + 1] * av; b += px[i + 2] * av; a += av; n++;
        }
      }
      const o = (y * size + x) * ch;
      const am = a / n;
      out[o] = am > 0 ? Math.round(r / n / am) : 0;
      out[o + 1] = am > 0 ? Math.round(g / n / am) : 0;
      out[o + 2] = am > 0 ? Math.round(b / n / am) : 0;
      if (ch === 4) out[o + 3] = Math.round(am * 255);
    }
  }
  return { w: size, h: size, ch, px: out };
}

// ── render the two masters ───────────────────────────────────────────
const markSvg = readFileSync(join(root, "design/icon/mark.svg"), "utf8");
// Strip down to the <g id="mark-tile"> payload so it can be re-embedded at
// different scales without nested-svg sizing surprises. The group is flat
// by contract (see the comment in mark.svg), so its first </g> closes it —
// slicing to the end of the file would drag the paper-ground group along.
const tileStart = markSvg.indexOf('<g id="mark-tile">');
if (tileStart < 0) {
  console.error('gen-icons: design/icon/mark.svg has no <g id="mark-tile"> group.');
  process.exit(1);
}
const inner = markSvg.slice(tileStart, markSvg.indexOf("</g>", tileStart) + 4);
// A match inside mark.svg's own comment yields prose, not artwork — that
// shipped a 0%-ink master on the first run. Real payload has the dots.
if (!inner.includes("<circle")) {
  console.error("gen-icons: mark-tile payload has no circles — matched the comment, not the group?");
  process.exit(1);
}

const work = join(tmpdir(), "insight-icons");
mkdirSync(work, { recursive: true });

function renderMaster(name, { scale, bg }) {
  const off = (100 - 100 * scale) / 2;
  const html = join(work, name + ".html");
  writeFileSync(html, `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;padding:0;width:${MASTER}px;height:${MASTER}px;overflow:hidden}
svg{display:block;width:${MASTER}px;height:${MASTER}px}</style>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" shape-rendering="geometricPrecision">
${bg ? `<rect x="0" y="0" width="100" height="100" fill="${bg}"/>` : ""}
<g transform="translate(${off} ${off}) scale(${scale})">${inner}</g>
</svg>`);
  const out = join(work, name + ".png");
  execFileSync(CHROME, [
    "--headless", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
    "--force-device-scale-factor=1",
    `--default-background-color=${bg ? bg.slice(1).toUpperCase() + "FF" : "00000000"}`,
    `--window-size=${MASTER},${MASTER}`,
    `--screenshot=${out}`,
    `file://${html}`,
  ], { stdio: ["ignore", "ignore", "pipe"] });
  const img = readPng(out);
  if (img.w !== MASTER || img.h !== MASTER) {
    throw new Error(`gen-icons: master ${name} came back ${img.w}x${img.h}, expected ${MASTER}`);
  }
  return img;
}

const opaque = renderMaster("opaque", { scale: 0.73, bg: INK });
const alpha = renderMaster("alpha", { scale: 0.55, bg: null });

// Refuse to ship a blank icon — the exact failure this script was rewritten
// to avoid. The mark must cover a few percent of the master.
const inkBytes = [1, 3, 5].map((i) => parseInt(INK.slice(i, i + 2), 16));
function assertNotBlank(img, label) {
  const { w, h, ch, px } = img;
  let marked = 0;
  for (let i = 0; i < w * h; i++) {
    const o = i * ch;
    if (ch === 4 ? px[o + 3] > 8 : !(px[o] === inkBytes[0] && px[o + 1] === inkBytes[1] && px[o + 2] === inkBytes[2])) marked++;
  }
  const pct = (100 * marked) / (w * h);
  if (pct < 1) throw new Error(`gen-icons: ${label} master is ${pct.toFixed(2)}% marked — blank render`);
  return pct;
}
assertNotBlank(opaque, "opaque");
assertNotBlank(alpha, "alpha");

// ── write every target ───────────────────────────────────────────────
let n = 0;
for (const [bucket, legacy, fg] of ANDROID) {
  const dir = join(root, "android/app/src/main/res", `mipmap-${bucket}`);
  const sq = resize(opaque, legacy);
  writePng(join(dir, "ic_launcher.png"), sq);
  writePng(join(dir, "ic_launcher_round.png"), sq);
  writePng(join(dir, "ic_launcher_foreground.png"), resize(alpha, fg));
  n += 3;
}

writePng(
  join(root, "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"),
  opaque, // already 1024 and already RGB — iOS wants no alpha here
);
n += 1;

rmSync(work, { recursive: true, force: true });
writeLock();
console.log(`gen-icons: wrote ${n} icons from design/icon/mark.svg, and the lock check:icons reads`);
