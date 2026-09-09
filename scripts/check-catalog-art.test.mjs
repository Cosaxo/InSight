// What check:catalog-art DEMANDS, proved by breaking a tree rather than by
// reading the source. Each case is one drift the header names, on a
// fixture that is otherwise green — so a case fails for its own reason.
//
// The fixture is driven through the gate's `--root` seam rather than by
// copying the gate into a temp tree (the eager-content pattern): this
// gate's lib imports the content compiler's domain table, which a copy
// could not carry.
import { describe, it, expect, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatCredits, regenerateCatalogArtIndex, ART_DIR, INDEX_FILE, CREDITS_FILE } from "./catalog-art-lib.mjs";

const here = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GATE = join(here, "scripts", "check-catalog-art.mjs");

let root;
afterEach(() => { if (root) rmSync(root, { recursive: true, force: true }); root = null; });

function run() {
  try {
    const out = execFileSync("node", [GATE, "--root", root], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status, out: (e.stdout || "") + (e.stderr || "") };
  }
}

const HOSTING = (age = 3600) => JSON.stringify({
  hosting: {
    public: "web",
    headers: [{
      source: "/catalog-art/**",
      headers: [
        { key: "Cache-Control", value: `public, max-age=${age}` },
        { key: "Access-Control-Allow-Origin", value: "*" },
        { key: "X-Content-Type-Options", value: "nosniff" },
      ],
    }],
  },
});

const ROWS = [
  { key: 615, file: "615.jpg", name: "Lionel Messi", author: "Кирилл Венедиктов", licence: "CC BY-SA 3.0", source: "https://commons.wikimedia.org/wiki/File:Lionel_Messi_20180626.jpg" },
  { key: 36107, file: "36107.png", name: "Muhammad Ali", author: "Ira Rosenberg", licence: "Public domain", source: "https://commons.wikimedia.org/wiki/File:Muhammad_Ali_NYWTS.jpg" },
];

/** A green tree: one domain, two pictures, credits, index, hosting rule. */
function fixture({ rows = ROWS, files = { "615.jpg": 120, "36107.png": 200 }, hosting = HOSTING(), index = true } = {}) {
  root = mkdtempSync(join(tmpdir(), "catalog-art-gate-"));
  mkdirSync(join(root, "public"), { recursive: true });
  writeFileSync(join(root, "public", "athletes.txt"), "# 3 entries.\n615\tLionel Messi\n11571\tCristiano Ronaldo\n36107\tMuhammad Ali\n");
  const dir = join(root, ART_DIR, "athletes");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, CREDITS_FILE), formatCredits("athletes", rows));
  for (const [name, bytes] of Object.entries(files)) writeFileSync(join(dir, name), Buffer.alloc(bytes, 1));
  writeFileSync(join(root, "firebase.json"), hosting);
  if (index) regenerateCatalogArtIndex(root, "test");
  return dir;
}

describe("check:catalog-art", () => {
  it("passes a tree where pictures, credits, catalogue, index and hosting all agree", () => {
    fixture();
    const r = run();
    expect(r.out).toContain("athletes 2 (1 jpg + 1 png)");
    expect(r.code).toBe(0);
  });

  it("passes a tree with no art at all — the state before the first operator run", () => {
    root = mkdtempSync(join(tmpdir(), "catalog-art-gate-"));
    mkdirSync(join(root, "public"), { recursive: true });
    writeFileSync(join(root, "firebase.json"), HOSTING());
    regenerateCatalogArtIndex(root, "test");
    const r = run();
    expect(r.out).toContain("no art yet");
    expect(r.code).toBe(0);
  });

  it("refuses a picture with no credits row — the one the app could not attribute", () => {
    const dir = fixture();
    writeFileSync(join(dir, "11571.jpg"), Buffer.alloc(50, 1));
    const r = run();
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/11571\.jpg: on disk with no credits row/);
  });

  it("refuses a credits row whose picture is not on disk", () => {
    fixture({ files: { "615.jpg": 120 } });
    const r = run();
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/36107\.png: named by the credits .* not on disk/);
  });

  it("refuses a key the catalogue does not carry", () => {
    fixture({
      rows: [...ROWS, { key: 999, file: "999.jpg", name: "Nobody", author: "X", licence: "CC0", source: "https://c/x" }],
      files: { "615.jpg": 120, "36107.png": 200, "999.jpg": 10 },
    });
    const r = run();
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/key 999 is not in public\/athletes\.txt/);
  });

  it("refuses a licence the policy refuses, by name, however it got into the row", () => {
    fixture({ rows: [{ ...ROWS[0], licence: "CC BY-NC 2.0" }, ROWS[1]] });
    const r = run();
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/licence "CC BY-NC 2\.0" refused — NonCommercial/);
  });

  it("refuses a file over the cap and a file name that is not its key", () => {
    fixture({ files: { "615.jpg": 64 * 1024 + 1, "36107.png": 200 } });
    let r = run();
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/615\.jpg: 65537 bytes, over the 65536-byte cap/);
    rmSync(root, { recursive: true, force: true });
    fixture({ rows: [{ ...ROWS[0], file: "messi.jpg" }, ROWS[1]], files: { "messi.jpg": 100, "36107.png": 200 } });
    r = run();
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/file "messi\.jpg" must be `615\.<jpg\|png\|webp>`/);
  });

  it("refuses an index that disagrees with the directories, in either direction", () => {
    const dir = fixture();
    // a picture added by hand after the index was written
    writeFileSync(join(dir, "11571.jpg"), Buffer.alloc(50, 1));
    writeFileSync(join(dir, CREDITS_FILE), formatCredits("athletes", [
      ...ROWS, { key: 11571, file: "11571.jpg", name: "Cristiano Ronaldo", author: "F", licence: "CC BY-SA 3.0", source: "https://c/r" },
    ]));
    let r = run();
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/catalogArtIndex\.ts: athletes\.jpg lists 1 key\(s\), web\/catalog-art\/athletes\/ carries 2/);
    // …and the other way: the index names a domain with no directory
    rmSync(root, { recursive: true, force: true });
    fixture();
    rmSync(join(root, ART_DIR, "athletes"), { recursive: true, force: true });
    r = run();
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/athletes\.jpg lists 1 key\(s\), web\/catalog-art\/athletes\/ carries 0/);
  });

  it("refuses a hand-typed index shape, and a missing index", () => {
    fixture();
    writeFileSync(join(root, INDEX_FILE), "export const CATALOG_ART = {\n  athletes: { jpg: [615] },\n};\n");
    let r = run();
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/not the generated shape/);
    unlinkSync(join(root, INDEX_FILE));
    r = run();
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/catalogArtIndex\.ts is missing/);
  });

  it("holds hosting to the rule: CORS for the credits fetch, and a max-age a takedown can outlive", () => {
    fixture({ hosting: JSON.stringify({ hosting: { public: "web", headers: [] } }) });
    let r = run();
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/no hosting headers rule for `\/catalog-art\/\*\*`/);
    rmSync(root, { recursive: true, force: true });
    fixture({ hosting: HOSTING(86400) });
    r = run();
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/max-age=86400 outlives a takedown/);
  });

  it("refuses a directory for a domain that has no catalogue, and a stray top-level file", () => {
    fixture();
    mkdirSync(join(root, ART_DIR, "nosuch"), { recursive: true });
    writeFileSync(join(root, ART_DIR, "nosuch", CREDITS_FILE), "# 0 entries.\n");
    writeFileSync(join(root, ART_DIR, "stray.jpg"), Buffer.alloc(10, 1));
    writeFileSync(join(root, ART_DIR, "README.md"), "allowed\n");
    const r = run();
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/nosuch\/: no committed catalogue/);
    expect(r.out).toMatch(/stray\.jpg: only domain directories and README\.md/);
    expect(r.out).not.toMatch(/README\.md: only/);
  });
});
