// build-catalog-art.test.mjs — the TAKEDOWN, which had no test at all.
//
// D421/D422's whole posture is "attempt, and take down on complaint", and
// the takedown is this one command. Its argument surface answered three
// operator typos with the success line and exit 0, having deleted nothing
// or only part of what was asked:
//
//   --remove 28 29 30   removed 28, left 29 and 30 on hosting, exit 0
//   --remove pikachu    removed nothing, exit 0
//   --remove 0          removed nothing, exit 0
//
// `check:catalog-art` cannot see any of it: the tree is still
// self-consistent afterwards, and a gate can only check what IS there,
// never what should have come down. So the cases live here, driven
// through the real CLI against a throwaway tree (`--root`, the seam
// check-catalog-art.mjs already had and this script did not — which is
// why it had no test: the only tree to run it on was the real 3,676
// pictures).
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { formatCredits, readCredits } from "./catalog-art-lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const SELF = resolve(here, "build-catalog-art.mjs");
const box = mkdtempSync(join(tmpdir(), "insight-takedown-"));
const art = join(box, "web", "catalog-art", "pokemon");

/** A three-picture pokemon domain, rebuilt before every case. */
function seed() {
  rmSync(box, { recursive: true, force: true });
  mkdirSync(join(box, "public"), { recursive: true });
  mkdirSync(art, { recursive: true });
  mkdirSync(join(box, "src", "v2", "data"), { recursive: true });
  writeFileSync(join(box, "public", "pokedex.txt"), "1\tBulbasaur\n2\tIvysaur\n3\tVenusaur\n");
  const rows = [1, 2, 3].map((k) => ({
    key: k, file: `${k}.webp`, name: `N${k}`, author: "A", licence: "Public domain", source: `https://example.test/${k}`,
  }));
  writeFileSync(join(art, "credits.tsv"), formatCredits("pokemon", rows));
  // magic bytes only: nothing here decodes an image, and the gate that
  // does is check:catalog-art's, tested in its own file
  for (const k of [1, 2, 3]) writeFileSync(join(art, `${k}.webp`), "RIFF????WEBPVP8 ");
}

const run = (...args) => {
  const r = spawnSync(process.execPath, [SELF, "pokemon", "--root", box, ...args], { encoding: "utf8" });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
};
const live = () => [1, 2, 3].filter((k) => existsSync(join(art, `${k}.webp`)));
const credited = () => readCredits(box, "pokemon").rows.map((r) => r.key);

beforeEach(seed);
afterAll(() => rmSync(box, { recursive: true, force: true }));

describe("the takedown removes what it says it removed", () => {
  it("takes down one key, and the credits row with it", () => {
    const r = run("--remove", "2");
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/removed N2 \(2, 2\.webp\)/);
    expect(live()).toEqual([1, 3]);
    expect(credited()).toEqual([1, 3]);
  });

  it("takes down a comma list — the documented spelling", () => {
    expect(run("--remove", "1,3").code).toBe(0);
    expect(live()).toEqual([2]);
    expect(credited()).toEqual([2]);
  });

  it("refuses space-separated keys instead of removing the first and reporting success", () => {
    const r = run("--remove", "2", "3");
    expect(r.code, "a partial takedown must not exit 0").toBe(2);
    expect(r.out).toMatch(/unexpected argument\(s\) "3"/);
    expect(live(), "nothing may be deleted on a refusal").toEqual([1, 2, 3]);
  });

  it("refuses a key it cannot read, rather than filtering it away", () => {
    for (const bad of ["pikachu", "0", "-1", "2.5", "1,pikachu"]) {
      const r = run("--remove", bad);
      expect(r.code, `--remove ${bad} was accepted`).toBe(2);
      expect(r.out).toMatch(/is not a catalogue key/);
      expect(live(), `--remove ${bad} deleted something`).toEqual([1, 2, 3]);
    }
  });

  it("does not report success when the key names no picture", () => {
    const r = run("--remove", "999");
    expect(r.code, "an unanswered complaint must not exit 0").toBe(1);
    expect(r.out).toMatch(/had no picture for key 999/);
    expect(r.out).toMatch(/nothing was removed/);
    expect(live()).toEqual([1, 2, 3]);
  });

  it("a partial re-run still succeeds — a half-committed takedown is a real flow", () => {
    expect(run("--remove", "2").code).toBe(0);
    const again = run("--remove", "2,3");
    expect(again.code, "3 came down, so this is not a no-op").toBe(0);
    expect(live()).toEqual([1]);
  });

  it("drops the whole domain when the last picture goes", () => {
    expect(run("--remove", "1,2,3").code).toBe(0);
    expect(existsSync(art), "the directory should be gone").toBe(false);
    expect(readFileSync(join(box, "src", "v2", "data", "catalogArtIndex.ts"), "utf8"))
      .not.toMatch(/pokemon/);
  });

  it("bare --remove regenerates the index and removes nothing", () => {
    const r = run("--remove");
    expect(r.code).toBe(0);
    expect(live()).toEqual([1, 2, 3]);
  });
});
