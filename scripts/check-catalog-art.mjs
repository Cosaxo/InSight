// check-catalog-art.mjs — the pictures on the pick tiles agree with their
// credits, their catalogue, the app's index and hosting (D421).
//
// A picture is four things that can drift apart, and each drift has a
// different victim:
//   · an image with no credits row — a picture the app cannot attribute,
//     which for a CC BY file is the licence's one condition unmet;
//   · a row with no image — a credit for nothing, and a 404 on every tile;
//   · a key not in the domain's catalogue — art for an entry nobody can
//     pick (a refreshed catalogue dropped it, or a hand edit);
//   · a licence the policy refuses — the builder could be patched, the
//     row could be typed; the gate holds the COMMITTED rows to the same
//     `licenceAllowed` the builder used;
//   · a file over the cap, or of a type the face should not draw;
//   · an index that disagrees with the directories — the app would either
//     ask for a picture that is not there or never ask for one that is;
//   · the hosting rule missing — the credits fetch is cross-origin from
//     the shells and silently empty without CORS, and a Cache-Control
//     longer than an hour would make a takedown take that long to reach a
//     device (the policy is take-down-on-complaint; the hour is the
//     promise's other half).
//
// OWN PARSER, SHARED POLICY. The credits file is re-read here with this
// file's own line regex rather than the builder's parser (check-catalogs.mjs's
// stance: a gate sharing the builder's code shares its bugs). The licence
// policy and the path constants ARE imported from catalog-art-lib.mjs — a
// policy with two definitions drifts, and a gate reading a different
// directory than the builder writes would certify an empty tree.
//
// `--root <dir>` is the test's seam and nothing else's: the eager-content
// gate is tested by copying it into a fixture tree, and this one cannot
// be, because its lib imports the content compiler's domain table.
//
// Client-only (reads web/, src/ and firebase.json), so it belongs on
// ci.yml and NOT on backend-checks.yml — nothing it says bears on whether
// a rules fix is safe to deploy.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ART_DIR, INDEX_FILE, CREDITS_FILE, IMAGE_EXTS, MAX_IMAGE_BYTES, CATALOG_FILES, licenceAllowed,
} from "./catalog-art-lib.mjs";

const rootFlag = process.argv.indexOf("--root");
const root = rootFlag === -1
  ? resolve(dirname(fileURLToPath(import.meta.url)), "..")
  : resolve(process.argv[rootFlag + 1]);
const errors = [];
const ROW = /^(\d+)\t([^\t]+)\t([^\t]+)\t([^\t]*)\t([^\t]+)\t([^\t]+)$/;
/** Cache-Control may not outlive a takedown by more than this. */
const MAX_AGE_CEILING = 3600;

function catalogueKeys(domain) {
  const file = CATALOG_FILES[domain];
  if (!file) return null;
  const path = join(root, "public", file);
  if (!existsSync(path)) return null;
  const keys = new Set();
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = /^(\d+)\t/.exec(line);
    if (m) keys.add(Number(m[1]));
  }
  return keys;
}

// ── the directories ──────────────────────────────────────────────────
const artRoot = join(root, ART_DIR);
const found = {}; // domain → { ext → sorted keys }
if (existsSync(artRoot)) {
  const entries = readdirSync(artRoot, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory()) continue;
    if (e.name !== "README.md") errors.push(`${ART_DIR}/${e.name}: only domain directories and README.md belong at this level`);
  }
  for (const domain of entries.filter((e) => e.isDirectory()).map((e) => e.name).sort()) {
    const at = `${ART_DIR}/${domain}`;
    const keys = catalogueKeys(domain);
    if (!keys) {
      errors.push(`${at}/: no committed catalogue for a domain called ${JSON.stringify(domain)} — pictures follow keys, and there are none`);
      continue;
    }
    const dir = join(artRoot, domain);
    const creditsPath = join(dir, CREDITS_FILE);
    const rows = new Map();
    if (!existsSync(creditsPath)) {
      errors.push(`${at}/${CREDITS_FILE}: missing — every picture needs its credit`);
    } else {
      const lines = readFileSync(creditsPath, "utf8").split("\n");
      let headerCount = null;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const where = `${at}/${CREDITS_FILE} line ${i + 1}`;
        if (line === "") {
          if (i !== lines.length - 1) errors.push(`${where}: blank line inside the file`);
          continue;
        }
        if (line.endsWith("\r")) { errors.push(`${where}: CRLF line ending`); continue; }
        if (line.startsWith("#")) {
          const m = /# (\d+) entries/.exec(line);
          if (m) headerCount = Number(m[1]);
          continue;
        }
        const m = ROW.exec(line);
        if (!m) { errors.push(`${where}: not \`key<TAB>file<TAB>name<TAB>author<TAB>licence<TAB>source\`: ${JSON.stringify(line.slice(0, 80))}`); continue; }
        const key = Number(m[1]);
        const [, , file, , , licence, source] = m;
        if (rows.has(key)) { errors.push(`${where}: duplicate key ${key}`); continue; }
        if (!keys.has(key)) errors.push(`${where}: key ${key} is not in public/${CATALOG_FILES[domain]} — art for an entry nobody can pick`);
        const ext = (/\.([a-z0-9]+)$/.exec(file) || [])[1] || "";
        if (file !== `${key}.${ext}` || !IMAGE_EXTS.includes(ext)) {
          errors.push(`${where}: file ${JSON.stringify(file)} must be \`${key}.<${IMAGE_EXTS.join("|")}>\` — the file name IS the key`);
        }
        const verdict = licenceAllowed(licence);
        if (!verdict.ok) errors.push(`${where}: licence ${JSON.stringify(licence)} refused — ${verdict.why}`);
        if (!/^https:\/\/\S+$/.test(source)) errors.push(`${where}: source ${JSON.stringify(source)} is not an https URL`);
        rows.set(key, { file, ext });
      }
      if (headerCount !== null && headerCount !== rows.size) {
        errors.push(`${at}/${CREDITS_FILE}: header says ${headerCount} entries, file has ${rows.size}`);
      }
    }
    // Both directions between rows and files.
    const files = new Set(readdirSync(dir).filter((f) => f !== CREDITS_FILE));
    for (const [key, r] of rows) {
      if (!files.has(r.file)) { errors.push(`${at}/${r.file}: named by the credits (key ${key}) but not on disk`); continue; }
      const size = statSync(join(dir, r.file)).size;
      if (size === 0) errors.push(`${at}/${r.file}: empty file`);
      if (size > MAX_IMAGE_BYTES) errors.push(`${at}/${r.file}: ${size} bytes, over the ${MAX_IMAGE_BYTES}-byte cap — a thumbnail, not a poster`);
    }
    const named = new Set([...rows.values()].map((r) => r.file));
    for (const f of [...files].sort()) {
      if (!named.has(f)) errors.push(`${at}/${f}: on disk with no credits row — a picture the app cannot attribute`);
    }
    const byExt = {};
    for (const [key, r] of rows) if (IMAGE_EXTS.includes(r.ext) && r.file === `${key}.${r.ext}`) (byExt[r.ext] ||= []).push(key);
    for (const ext of Object.keys(byExt)) byExt[ext].sort((a, b) => a - b);
    if (Object.keys(byExt).length) found[domain] = byExt;
  }
}

// ── the app's index ──────────────────────────────────────────────────
const indexPath = join(root, INDEX_FILE);
if (!existsSync(indexPath)) {
  errors.push(`${INDEX_FILE} is missing — run scripts/build-catalog-art.mjs <domain> --remove (with no keys) to regenerate it`);
} else {
  const declared = {};
  const lines = readFileSync(indexPath, "utf8").split("\n");
  const start = lines.findIndex((l) => l.startsWith("export const CATALOG_ART"));
  if (start === -1) {
    errors.push(`${INDEX_FILE}: no \`export const CATALOG_ART\` — not the generated shape`);
  } else {
    let domain = null;
    let shape = true;
    for (let i = start + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line === "};") break;
      if (line === "") continue;
      let m;
      if ((m = /^ {2}([a-z][a-z0-9]*|"[^"]+"): \{$/.exec(line))) { domain = m[1].replace(/^"|"$/g, ""); declared[domain] ||= {}; continue; }
      if (domain && (m = /^ {4}(jpg|png|webp): \[([\d, ]*)\],$/.exec(line))) {
        declared[domain][m[1]] = m[2].split(",").map((s) => s.trim()).filter(Boolean).map(Number);
        continue;
      }
      if (line === "  },") { domain = null; continue; }
      shape = false;
      errors.push(`${INDEX_FILE} line ${i + 1}: not the generated shape: ${JSON.stringify(line.slice(0, 80))}`);
      break;
    }
    if (shape) {
      const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
      for (const domain of new Set([...Object.keys(found), ...Object.keys(declared)])) {
        const f = found[domain] || {};
        const d = declared[domain] || {};
        for (const ext of new Set([...Object.keys(f), ...Object.keys(d)])) {
          if (!same(f[ext] || [], d[ext] || [])) {
            errors.push(
              `${INDEX_FILE}: ${domain}.${ext} lists ${(d[ext] || []).length} key(s), ${ART_DIR}/${domain}/ carries ${(f[ext] || []).length} — ` +
              "run scripts/build-catalog-art.mjs, never hand-edit",
            );
          }
        }
      }
    }
  }
}

// ── hosting ──────────────────────────────────────────────────────────
try {
  const cfg = JSON.parse(readFileSync(join(root, "firebase.json"), "utf8"));
  const hosting = Array.isArray(cfg.hosting) ? cfg.hosting[0] : cfg.hosting;
  const rule = (hosting?.headers || []).find((r) => r.source === "/catalog-art/**");
  if (!rule) {
    errors.push("firebase.json: no hosting headers rule for `/catalog-art/**` — the credits fetch is cross-origin and needs Access-Control-Allow-Origin, and a takedown needs a bounded Cache-Control");
  } else {
    const h = new Map((rule.headers || []).map((x) => [String(x.key), String(x.value)]));
    if (h.get("Access-Control-Allow-Origin") !== "*") errors.push("firebase.json: `/catalog-art/**` must send `Access-Control-Allow-Origin: *` — the app's credits sheet fetches credits.tsv from the shells' own origin");
    const cc = h.get("Cache-Control") || "";
    const age = /max-age=(\d+)/.exec(cc);
    if (!age) errors.push("firebase.json: `/catalog-art/**` must send a Cache-Control with max-age — that number is how long a taken-down picture survives on a device");
    else if (Number(age[1]) > MAX_AGE_CEILING) errors.push(`firebase.json: \`/catalog-art/**\` max-age=${age[1]} outlives a takedown — the ceiling is ${MAX_AGE_CEILING} (D421)`);
    if (!/nosniff/i.test(h.get("X-Content-Type-Options") || "")) errors.push("firebase.json: `/catalog-art/**` must send `X-Content-Type-Options: nosniff`");
  }
} catch (e) {
  errors.push(`firebase.json: ${e.message}`);
}

if (errors.length) {
  console.error(`check:catalog-art: ${errors.length} problem(s)`);
  for (const e of errors.slice(0, 25)) console.error(`  - ${e}`);
  process.exit(1);
}
const said = Object.entries(found)
  .map(([d, byExt]) => `${d} ${Object.values(byExt).reduce((n, k) => n + k.length, 0)} (${Object.entries(byExt).map(([e, k]) => `${k.length} ${e}`).join(" + ")})`)
  .join(", ");
console.log(`check:catalog-art OK — ${said || "no art yet"}; index agrees; hosting rule present`);
