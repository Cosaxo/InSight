// catalog-art-lib.mjs — what the catalogue-art builder and its tests share
// (D421, docs/CATALOG-QUESTIONS.md § Entity images).
//
// A picture on a pick tile is three files that have to agree: the image
// under web/catalog-art/<domain>/, the credits row that says whose it is
// and under which licence, and the app-side index that says which keys
// have one. This module owns the FORMAT of the second and the WRITER of
// the third, plus the one policy every path shares: which licences an
// image may carry at all. scripts/check-catalog-art.mjs deliberately does
// NOT share the parser (a gate that shares the builder's code shares its
// bugs — check-catalogs.mjs's stance) but does import the licence policy
// and the path constants from here: a policy with two definitions drifts,
// and a gate reading a different directory than the builder writes would
// certify an empty tree.
//
// Network lives in build-catalog-art.mjs, not here. Everything in this
// file runs under `test:scripts` with no fetch.
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { CATALOG_FILES } from "./gen-v2content.mjs";

/** Where hosting serves the images from — `web/` is firebase.json's
 *  hosting.public, so a takedown is a deleted file and a deploy, never an
 *  app-store release (D421 § the hosting choice). */
export const ART_DIR = join("web", "catalog-art");
/** The generated app-side index. Absent keys never fire a request. */
export const INDEX_FILE = join("src", "v2", "data", "catalogArtIndex.ts");
/** The credits manifest each domain directory carries. */
export const CREDITS_FILE = "credits.tsv";
/** What the builder will write and the gate will admit. SVG and GIF are
 *  refused on purpose: an SVG can carry script and a GIF can animate, and
 *  a tile face wants neither. */
export const IMAGE_EXTS = ["jpg", "png", "webp"];
/** A face is 92×74 CSS px; the thumbnail is fetched at this width, which
 *  is 2× the face. */
export const THUMB_WIDTH = 184;
/** A stray full-size poster would be the first thing a reader of the
 *  repo noticed and the last thing check:bundle could see (it reads
 *  dist/, not web/). The cap is ~5× what a 184px JPEG weighs. */
export const MAX_IMAGE_BYTES = 64 * 1024;

export { CATALOG_FILES };

/** Source tags admitted by the owner's ruling rather than by a licence
 *  (lower-cased for the policy; the credits rows carry them as written
 *  in RULED_SOURCE_TAGS). The app's credits sheet carries one notice per
 *  tag (src/v2/data/catalogArt.ts SOURCE_NOTICES) and the two lists are
 *  pinned to each other by test. */
export const RULED_SOURCE_TAGS = ["TMDB", "PokeAPI"];
const RULED_SOURCES = new Set(RULED_SOURCE_TAGS.map((t) => t.toLowerCase()));

/**
 * Every picture is re-encoded on the way in: fitted inside THUMB_WIDTH
 * square without enlargement, auto-oriented, metadata dropped (a camera
 * photo carries GPS in its EXIF — avatar.ts's second property, one
 * pipeline over), and written as WebP with alpha kept, so a Pokémon's
 * transparent artwork sits on the tile's own pattern. One shape whatever
 * the source sent — a 475 px PNG from PokéAPI, a JPEG poster, a Commons
 * render of an SVG flag — and a fifth of the bytes a JPEG would cost.
 * `sharp` is imported here and nowhere else, dynamically, so the gate
 * and the tests that never touch a bitmap never load a native module.
 */
export async function toThumb(bytes) {
  const sharp = (await import("sharp")).default;
  const out = await sharp(bytes)
    .rotate()
    .resize({ width: THUMB_WIDTH, height: THUMB_WIDTH, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer();
  return { bytes: out, ext: "webp" };
}

/**
 * May an image under this licence ship in the app at all?
 *
 * Commons' `LicenseShortName` is the input ("CC BY-SA 4.0", "Public
 * domain", "CC0", "GFDL", "CC BY-NC 2.0" …); "TMDB" is the poster route's
 * own tag, the API's terms rather than a copyright licence.
 *
 * The line: free for commercial reuse WITH attribution shown (which the
 * credits sheet does) and without a licence text we would have to ship
 * (GFDL's clause 4, which is why a GFDL-only file is refused although
 * Commons hosts it). NonCommercial and NoDerivatives refuse themselves —
 * this is a store app, and a cropped thumbnail is a derivative. Anything
 * unrecognised is refused rather than admitted: the failure to avoid is a
 * licence nobody read, not a picture nobody drew.
 */
export function licenceAllowed(short) {
  const s = String(short || "").replace(/\s+/g, " ").trim().toLowerCase();
  if (!s) return { ok: false, why: "no licence recorded" };
  if (/\bnc\b|non-?commercial/.test(s)) return { ok: false, why: "NonCommercial" };
  if (/\bnd\b|no ?derivatives?/.test(s)) return { ok: false, why: "NoDerivatives" };
  if (/fair use|non-?free|all rights reserved|©|\(c\)/.test(s)) return { ok: false, why: "not a free licence" };
  // The RULED sources: not licences but the owner's take-down-on-complaint
  // ruling applied to a named source (D421 for TMDB's posters, D422 for
  // PokéAPI's official artwork). The tag is what the credits sheet keys
  // its notice on, and the gate admits the tag so the rows can exist —
  // the ruling is the record, this line is only where it is enforced.
  if (RULED_SOURCES.has(s)) return { ok: true };
  if (/^cc0\b/.test(s)) return { ok: true };
  if (/^(cc-)?pd\b|^pd-|^public domain|^cc-pd-mark|no (known )?(copyright )?restrictions/.test(s)) return { ok: true };
  if (/^cc by(-sa)?( \d(\.\d)?)?( [a-z]{2,3})?$/.test(s)) return { ok: true };
  if (/^fal\b|^free art licen[cs]e/.test(s)) return { ok: true };
  if (/^attribution$|^copyrighted free use/.test(s)) return { ok: true };
  if (/gfdl/.test(s)) return { ok: false, why: "GFDL-only (its licence text would have to ship)" };
  return { ok: false, why: `unrecognised licence ${JSON.stringify(String(short))}` };
}

/** Commons' Artist field is HTML ("<a href=…>Name</a>"); the credit line
 *  wants the words. Entities decoded, tags dropped, whitespace folded,
 *  and capped — an author string is a name, not a paragraph. */
export function stripHtml(html, max = 100) {
  let s = String(html || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"").replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ");
  s = cleanField(s);
  if (s.length > max) s = s.slice(0, max - 1).trimEnd() + "…";
  return s;
}

/** A TSV field may hold neither a tab nor a line break. */
export function cleanField(s) {
  return String(s || "").replace(/[\t\r\n]+/g, " ").replace(/\s+/g, " ").trim();
}

export function extOf(file) {
  const m = /\.([a-z0-9]+)$/i.exec(String(file || ""));
  return m ? m[1].toLowerCase() : "";
}

/**
 * The credits manifest: one row per image, `key<TAB>file<TAB>name<TAB>
 * author<TAB>licence<TAB>source`. Sorted by key so a re-run diffs cleanly.
 * The header carries the count the way every catalogue file does, so the
 * gate can hold the file to its own claim.
 */
export function formatCredits(domain, rows) {
  const sorted = [...rows].sort((a, b) => a.key - b.key);
  const lines = [
    `# InSight catalogue art credits — GENERATED by scripts/build-catalog-art.mjs ${domain}, do not edit.`,
    `# One row per image under ${ART_DIR}/${domain}/:`,
    "# key<TAB>file<TAB>name<TAB>author<TAB>licence<TAB>source",
    `# The key is the catalogue key (public/${CATALOG_FILES[domain] || `${domain}.txt`}); the file is what`,
    "# hosting serves; author and licence are what the licence requires shown",
    "# beside the picture, which the app's credits sheet draws from this file.",
    `# A takedown is \`node scripts/build-catalog-art.mjs ${domain} --remove <key>\` (D421).`,
    `# ${sorted.length} entries.`,
  ];
  for (const r of sorted) {
    lines.push([
      String(r.key), cleanField(r.file), cleanField(r.name),
      cleanField(r.author), cleanField(r.licence), cleanField(r.source),
    ].join("\t"));
  }
  return lines.join("\n") + "\n";
}

/** The builder's own reader of the format above — tolerant of nothing
 *  it did not write, so a hand edit shows up as an error rather than as
 *  a silently dropped row. */
export function parseCredits(text) {
  const rows = [];
  const errors = [];
  let headerCount = null;
  const lines = String(text || "").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === "") continue;
    if (line.startsWith("#")) {
      const m = /# (\d+) entries/.exec(line);
      if (m) headerCount = Number(m[1]);
      continue;
    }
    const f = line.split("\t");
    if (f.length !== 6) {
      errors.push(`line ${i + 1}: expected 6 tab-separated fields, found ${f.length}`);
      continue;
    }
    const key = Number(f[0]);
    if (!Number.isInteger(key) || key < 1) {
      errors.push(`line ${i + 1}: key ${JSON.stringify(f[0])} is not a catalogue key`);
      continue;
    }
    rows.push({ key, file: f[1], name: f[2], author: f[3], licence: f[4], source: f[5] });
  }
  return { rows, errors, headerCount };
}

/** Domain directories under web/catalog-art/, sorted — the README and
 *  any stray file are not domains. */
export function artDomains(root) {
  const dir = join(root, ART_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

export function readCredits(root, domain) {
  const file = join(root, ART_DIR, domain, CREDITS_FILE);
  if (!existsSync(file)) return { rows: [], errors: [], headerCount: null, present: false };
  return { ...parseCredits(readFileSync(file, "utf8")), present: true };
}

/** The catalogue a domain answers into, as key → name. The builder needs
 *  the names for the credits rows; the keys are the only thing that binds. */
export function readCatalogue(root, domain) {
  const file = CATALOG_FILES[domain];
  if (!file) return null;
  const path = join(root, "public", file);
  if (!existsSync(path)) return null;
  const out = new Map();
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const tab = line.indexOf("\t");
    if (tab < 1) continue;
    const key = Number(line.slice(0, tab));
    if (Number.isInteger(key) && key >= 1) out.set(key, line.slice(tab + 1));
  }
  return out;
}

/**
 * Regenerate src/v2/data/catalogArtIndex.ts from every domain's credits
 * file. Any domain's run regenerates every domain's entry (the
 * catalog-keys-lib pattern), so the index can never describe a directory
 * that is not there. Returns {domain: {ext: count}} for the log line.
 */
export function regenerateCatalogArtIndex(root, builderName) {
  const summary = {};
  const entries = [];
  for (const domain of artDomains(root)) {
    const { rows } = readCredits(root, domain);
    const byExt = {};
    for (const r of rows) {
      const ext = extOf(r.file);
      if (!IMAGE_EXTS.includes(ext)) continue;
      (byExt[ext] ||= []).push(r.key);
    }
    const exts = Object.keys(byExt).sort();
    if (!exts.length) continue;
    summary[domain] = Object.fromEntries(exts.map((e) => [e, byExt[e].length]));
    const body = exts
      .map((e) => `    ${e}: [${[...byExt[e]].sort((a, b) => a - b).join(", ")}],`)
      .join("\n");
    entries.push(`  ${/^[a-z][a-z0-9]*$/.test(domain) ? domain : JSON.stringify(domain)}: {\n${body}\n  },`);
  }
  const lines = [
    "// GENERATED from web/catalog-art/*/credits.tsv by",
    "// scripts/build-catalog-art.mjs (any domain's run regenerates every",
    "// domain's entry, via scripts/catalog-art-lib.mjs) — do not hand-edit.",
    "// scripts/check-catalog-art.mjs re-derives this from the committed",
    "// directories and fails CI on any disagreement.",
    "//",
    "// Which catalogue entries have a picture on hosting, by file extension",
    "// (D421). The app asks this BEFORE it asks the network: a tile whose key",
    "// is not here never fires a request that would end in a 404, and a",
    "// domain with no directory draws its generated faces and nothing else.",
    "// Empty until an operator runs the builder — the fetch needs Wikimedia",
    "// Commons and Wikidata, which sandboxed sessions cannot reach (D15's",
    "// reason, one artifact over).",
    "export const CATALOG_ART: Readonly<Record<string, Readonly<Record<string, readonly number[]>>>> = {",
    ...entries,
    "};",
    "",
  ];
  mkdirSync(join(root, "src", "v2", "data"), { recursive: true });
  writeFileSync(join(root, INDEX_FILE), lines.join("\n"));
  const said = Object.entries(summary)
    .map(([d, c]) => `${d} ${Object.entries(c).map(([e, n]) => `${n} ${e}`).join(" + ")}`)
    .join(", ") || "no art";
  console.log(`${builderName}: regenerated ${INDEX_FILE} (${said})`);
  return summary;
}
