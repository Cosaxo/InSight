// What build:omib / check:omib DEMAND. The gate's whole job is that the bank
// the app scores is the bank the authors published (D473), so the cases here
// are the ways that could quietly stop being true: an element read as the wrong
// one, a shape skipped instead of refused, artwork that starts carrying the
// answer, and the key escaping into the client.
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ELEMENTS, codeFromSvg, derivable, PINNED_DERIVABLE } from "./build-omib.mjs";

const here = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GATE = join(here, "scripts", "build-omib.mjs");

/** One cell of artwork, in the shape the bank writes it. */
const cell = (n, body) => `<svg width="100" height="100" id="i_1_mat${n}">${body}</svg>`;
const eight = (body) => `<svg viewBox="0 0 320 320">${
  [1, 2, 3, 4, 5, 6, 7, 8].map((n) => cell(n, n === 1 ? body : "")).join("")}</svg>`;

// The twenty elements as drawing.js draws them, id by id — the join the whole
// extraction rests on. Written out rather than imported from the gate so that a
// change to its table has to disagree with something.
const DRAWN = [
  '<polygon points="0,0 25,0 0,25"></polygon>',
  '<polygon points="25,100 0,100 0,75"></polygon>',
  '<polygon points="100,75 100,100 75,100"></polygon>',
  '<polygon points="75,0 100,0 100,25"></polygon>',
  '<polygon points="12.5,50 50,12.5"></polygon>',
  '<polygon points="12.5,50 50,87.5"></polygon>',
  '<polygon points="50,87.5 87.5,50"></polygon>',
  '<polygon points="50,12.5 87.5,50"></polygon>',
  '<polygon points="37.5,0 62.5,0 62.5,12.5 37.5,12.5"></polygon>',
  '<polygon points="0,37.5 0,62.5 12.5,62.5 12.5,37.5"></polygon>',
  '<polygon points="37.5,87.5 62.5,87.5 62.5,100 37.5,100"></polygon>',
  '<polygon points="87.5,37.5 87.5,62.5 100,62.5 100,37.5"></polygon>',
  '<rect width="20" height="20"></rect>',
  '<rect width="20" height="20" fill="none"></rect>',
  '<circle r="10"></circle>',
  '<circle r="10" fill="none"></circle>',
  '<polygon points="50,12.5 37.5,25 62.5,25"></polygon>',
  '<polygon points="12.5,50 25,37.5 25,62.5"></polygon>',
  '<polygon points="50,87.5 37.5,75 62.5,75"></polygon>',
  '<polygon points="87.5,50 75,37.5 75,62.5"></polygon>',
];

describe("the element vocabulary", () => {
  it("maps each of the twenty elements to its own bit, in the bank's own order", () => {
    DRAWN.forEach((body, id) => {
      const first = codeFromSvg(eight(body), `el${id}`).split(",")[0];
      const want = "0".repeat(id) + "1" + "0".repeat(ELEMENTS - id - 1);
      expect(first, `element ${id}`).toBe(want);
    });
  });

  it("writes element 0 FIRST — the bank's convention, not a bit-shift's", () => {
    // The one that has already been got wrong: shifting puts element 0 last,
    // which reverses every cell and still looks like a plausible code.
    expect(codeFromSvg(eight(DRAWN[0]), "x").split(",")[0].startsWith("1")).toBe(true);
  });

  it("REFUSES a shape the table does not name rather than skipping it", () => {
    // A skipped shape yields a well-formed code for the wrong item, which
    // nothing downstream could notice.
    expect(() => codeFromSvg(eight('<polygon points="1,2 3,4"></polygon>'), "x")).toThrow(/unknown polygon/);
    expect(() => codeFromSvg(eight("<ellipse></ellipse>"), "x")).not.toThrow(); // not an element tag at all
    expect(() => codeFromSvg(eight('<rect width="20"></rect><polygon points="9,9"></polygon>'), "x")).toThrow(/unknown polygon/);
  });
});

describe("the artwork must not carry the answer", () => {
  it("accepts eight cells and leaves the ninth empty", () => {
    const cells = codeFromSvg(eight(DRAWN[0]), "x").split(",");
    expect(cells).toHaveLength(9);
    expect(cells[8]).toBe("0".repeat(ELEMENTS));
  });

  it("STOPS if a future revision ships nine", () => {
    // Not a formatting quibble: a ninth rendered cell means the published
    // pictures now show the solution, which changes what the test is.
    const nine = `<svg>${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => cell(n, "")).join("")}</svg>`;
    expect(() => codeFromSvg(nine, "x")).toThrow(/expected 1\.\.8/);
  });
});

describe("the derivation that verifies the codes", () => {
  it("reproduces a plain addition row", () => {
    const c = (s) => s.padEnd(ELEMENTS, "0");
    const code = [c(""), c(""), c(""), c(""), c(""), c(""), c("1000"), c("0100"), c("1100")].join(",");
    expect(derivable(code, c("1100"))).toBe(true);
    // The negative has to be a cell NO rule reaches. "0001" is not one: the
    // four ids of a family are its four orientations, so a rotation lands on
    // it — which is exactly why the derivation is a check on the codes and
    // never a scorer.
    expect(derivable(code, c("1111"))).toBe(false);
  });
});

describe("the committed bank", () => {
  it("matches the published source", () => {
    const out = execFileSync("node", [GATE, "--check"], { encoding: "utf8" });
    expect(out).toMatch(/check-omib OK/);
    expect(out).toMatch(new RegExp(`${PINNED_DERIVABLE} answers re-derived`));
  });

  it("ships 220 items with their calibration, and no answers", () => {
    const bank = JSON.parse(readFileSync(join(here, "content", "omib.json"), "utf8"));
    expect(bank.items).toHaveLength(220);
    expect(bank.items.filter((i) => typeof i.b === "number")).toHaveLength(219);
    // The reason the bank was chosen over the generator (D473): every item
    // carries a difficulty measured before we shipped a line.
    for (const item of bank.items) {
      expect(item.code.split(",")).toHaveLength(9);
      expect(item.code.split(",")[8], `${item.id} goal cell`).toBe("0".repeat(ELEMENTS));
      expect(JSON.stringify(item)).not.toMatch(/solution/i);
    }
  });

  it("keeps the answer key out of the client's reach", { timeout: 20000 }, () => {
    // The D57 posture, applied to a bank instead of a seed: the key is a
    // server-side file, so nothing under src/ may so much as name it.
    // git grep exits 1 on no matches, which is the passing case here.
    //
    // THREE NEEDLES, because one was narrower than the sentence above it.
    // This grepped `omib-key` alone — the name of the JSON the generator
    // reads. What actually ships is the SYMBOL `OMIB_KEY`, exported from
    // `functions/src/omib-bank.ts`, so a client file importing it by name,
    // or a hand-copied table under that symbol, passed a case whose own
    // comment says "nothing under src/ may so much as name it". An
    // anti-cheat assertion that does not assert what it claims is worse
    // than none, because it is read as cover.
    const NEEDLES = ["omib-key", "OMIB_KEY", "omib-bank"];
    let hits = "";
    try {
      hits = execFileSync(
        "git",
        ["grep", "-l", ...NEEDLES.flatMap((n) => ["-e", n]), "--", "src", "index.html"],
        { cwd: here, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      ).trim();
    } catch (e) {
      if (e.status !== 1) throw e;
    }
    expect(hits, "a client file names the answer key or the module that holds it").toBe("");

    // THE VACUITY GUARD. Every needle above has to still find the key on
    // the SERVER side, or this case is refusing names nothing uses — which
    // is how it would pass forever after a rename, in silence, on the one
    // assertion in the tree whose whole job is to catch the key escaping.
    const server = execFileSync(
      "git",
      ["grep", "-l", ...NEEDLES.flatMap((n) => ["-e", n]), "--", "functions/src", "content"],
      { cwd: here, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    ).trim();
    expect(server, "the key was renamed — these needles now guard nothing").not.toBe("");
  });
});
