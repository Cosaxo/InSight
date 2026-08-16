// Shared writer for functions/src/catalogKeys.ts — extracted 2026-08-16,
// when the dogs domain would have made a FOURTH copy of the same derivation
// (build-catalog.mjs, build-emoji.mjs, build-countries.mjs each carried
// one). Four copies of "whichever builder ran last regenerates all sets"
// is four chances for the sets to disagree about what "all" means; one
// list here is none. scripts/check-catalogs.mjs stays deliberately
// independent — it re-derives from the committed files with its own
// parser, because a gate that shares the builders' code shares their bugs.
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// Every keys-domain catalogue, in declaration order. Range domains
// (pokemon, elements) are compiled-in maxima and do not appear here.
export const KEY_DOMAINS = [
  { constName: "FILM_KEYS", file: "films.txt" },
  { constName: "ARTIST_KEYS", file: "artists.txt" },
  { constName: "EMOJI_KEYS", file: "emoji.txt" },
  { constName: "COUNTRY_KEYS", file: "countries.txt" },
  { constName: "DOG_KEYS", file: "dogs.txt" },
];

export function parseKeys(file) {
  if (!existsSync(file)) return [];
  const keys = [];
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const tab = line.indexOf("\t");
    if (tab > 0) keys.push(Number(line.slice(0, tab)));
  }
  return keys;
}

/** Regenerate functions/src/catalogKeys.ts from the committed catalogues.
 *  Returns {name: count} for the caller's log line. */
export function regenerateCatalogKeys(root, builderName) {
  const counts = {};
  const lines = [
    "// GENERATED from the committed catalogues in public/ by the",
    "// build-* catalogue scripts (any regenerates all sets, via",
    "// scripts/catalog-keys-lib.mjs) — do not hand-edit.",
    "// scripts/check-catalogs.mjs re-derives these from the committed",
    "// files and fails CI on any disagreement, in ci.yml and",
    "// backend-checks.yml both.",
    "//",
    "// The trigger validates catalog `entity` keys against these sets",
    "// (functions/src/v2.ts, CATALOG_DOMAINS): an empty set means the",
    "// domain's catalogue has not been generated yet, so nothing",
    "// aggregates for it — fail-safe until an operator runs the builder",
    "// (D15 records why films/artists generation is an operator step).",
  ];
  const setLiteral = (keys) =>
    keys.length ? `new Set<number>([\n  ${keys.join(", ")},\n])` : "new Set<number>()";
  for (const d of KEY_DOMAINS) {
    const keys = parseKeys(join(root, "public", d.file));
    counts[d.file.replace(".txt", "")] = keys.length;
    lines.push(`export const ${d.constName}: ReadonlySet<number> = ${setLiteral(keys)};`);
  }
  lines.push("");
  writeFileSync(join(root, "functions", "src", "catalogKeys.ts"), lines.join("\n"));
  console.log(
    `${builderName}: regenerated functions/src/catalogKeys.ts (` +
      Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(", ") + ")",
  );
  return counts;
}
