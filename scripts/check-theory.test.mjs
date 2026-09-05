// check-theory.test.mjs — pins the axiom papers' form gate in both directions.
//
// The forbidden cases are not invented. Every string in WOULD_DRIFT is the
// shape that appeared in the first attempt's 129 claims or in the docs that
// evaluated them: a DOI, a bracketed year, "et al", a source path read
// first-hand, a Firestore collection, a gate name, a decision number. A gate
// whose test cases are hypothetical proves the regex compiles; these prove
// it catches what actually pulled the theory back to the tree.
//
// The other half matters as much and is the easier one to break by
// tightening a pattern: ordinary prose that LOOKS like a citation or a path
// must keep passing — "3D", "e.g.", "the 1990s", "paper 0", "section 4.5",
// a Markdown path to the series' own README in the status line. A gate that
// punished those would push the next author into rewording theory to
// satisfy a regex, which is the opposite of what this repo wants.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { scanPaper, listPapers, PAPERS_DIR, AXES, REQUIRED, FORBIDDEN } from "./check-theory.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// A minimal paper that carries every required part and nothing forbidden.
const GOOD = `# A keyed test meets the genome

**Status: theory research.** Nothing here describes the app; \`research/README.md\` says what a paper is.

**Perfect-form test.** If the app did not exist, this would still be worth saying because a keyed test paired with a genome measures ability directly.

**Abstract.** The genome and the reasoning test cross. Ties and the body follow.

**1 · The problem**

Prose about 3D geometry, e.g. the 1990s, paper 0, section 4.5.

**2 · What would have to hold**

Ancestry is modelled.

**3 · The potential, at full population**

Everything.
`;

const rules = (text) => scanPaper(text).problems.map((p) => p.rule);

describe("a well-formed paper passes", () => {
  it("has no problems and names several axes", () => {
    const { problems, axes } = scanPaper(GOOD);
    expect(problems).toEqual([]);
    expect(axes).toEqual(expect.arrayContaining(["genome", "logic test", "ties", "body"]));
  });

  it("is not fooled by prose that looks like a citation or a path", () => {
    // Each of these sits in GOOD already; this pins the reason it does.
    for (const harmless of ["3D geometry", "e.g. the 1990s", "paper 0", "section 4.5", "`research/README.md`"]) {
      expect(GOOD).toContain(harmless);
    }
    expect(rules(GOOD)).toEqual([]);
  });
});

describe("the shapes that pulled the last attempt back to the tree", () => {
  const WOULD_DRIFT = [
    ["a link", "See https://example.org/paper for the finding."],
    ["a link", "The study is at www.example.org."],
    ["a DOI", "Reported in doi:10.1038/nature14659."],
    ["a DOI", "The figure is 14% (10.1038/nature14659)."],
    ['"et al"', "Cai et al found 14%."],
    ["a bracketed year or reference number", "Heritability is about 50% (2020)."],
    ["a bracketed year or reference number", "As shown before [12], the effect holds."],
    ["a source path or source-file extension", "Verified against src/v2/data/similarity.ts first-hand."],
    ["a source path or source-file extension", "The fold lives in functions/src/pure.ts."],
    ["a source path or source-file extension", "The rules are in firestore.rules."],
    ["a backend product or collection name", "The loadings are published on v2_patterns/loadings."],
    ["a backend product or collection name", "Firestore holds one answer per item."],
    ["a gate or npm script", "The catalogue is held by check:catalogs."],
    ["a gate or npm script", "Run npm run scorecard to see it."],
    ["a decision number", "D98 made answers public."],
    ["a decision number", "the era re-serving decision (D325) is open"],
  ];

  for (const [rule, text] of WOULD_DRIFT) {
    it(`catches ${rule}: ${text.slice(0, 48)}…`, () => {
      const found = rules(`${GOOD}\n${text}\n`);
      expect(found).toContain(`contains ${rule}`);
    });
  }

  it("names a reason and a line for every forbidden finding", () => {
    const { problems } = scanPaper(`${GOOD}\nCai et al found it at https://example.org (2020).\n`);
    const forbidden = problems.filter((p) => p.rule.startsWith("contains"));
    expect(forbidden.length).toBeGreaterThanOrEqual(3);
    for (const p of forbidden) {
      expect(p.why.length).toBeGreaterThan(10);
      expect(p.line).toBeGreaterThan(0);
      expect(p.excerpt.length).toBeGreaterThan(0);
    }
  });
});

describe("the parts a paper must carry", () => {
  it("fails without the status line", () => {
    expect(rules(GOOD.replace("**Status: theory research.**", "**Status: plan notes.**"))).toContain(
      "missing the status line",
    );
  });

  it("fails without the perfect-form sentence", () => {
    expect(rules(GOOD.replace(/If the app did not exist/i, "Because"))).toContain(
      "missing the perfect-form test",
    );
  });

  it("fails without an abstract", () => {
    expect(rules(GOOD.replace("**Abstract.**", "**Summary.**"))).toContain("missing an abstract");
  });

  it("fails without a conditions section and without a potential section", () => {
    const noConditions = GOOD.replace("**2 · What would have to hold**", "**2 · Notes**");
    expect(rules(noConditions)).toContain("missing a conditions section");
    const noPotential = GOOD.replace("**3 · The potential, at full population**", "**3 · Closing**");
    expect(rules(noPotential)).toContain("missing a potential section");
  });

  it("fails when fewer than two axes are named", () => {
    const oneAxis = `# Alone

**Status: theory research.**

**Perfect-form test.** If the app did not exist this would still hold.

**Abstract.** The genome, alone, and nothing else about it.

**1 · What would have to hold**

Nothing.

**2 · The potential**

Little.
`;
    const { problems, axes } = scanPaper(oneAxis);
    expect(axes).toEqual(["genome"]);
    expect(problems.map((p) => p.rule)).toContain("names fewer than two axes");
  });

  it("every rule carries a reason, because whoever trips it is not the person who wrote it", () => {
    for (const r of [...REQUIRED, ...FORBIDDEN]) expect(r.why.length).toBeGreaterThan(20);
    expect(AXES.length).toBeGreaterThanOrEqual(9);
  });
});

describe("the papers actually in the tree", () => {
  const papers = listPapers(join(repoRoot, PAPERS_DIR));

  it("exist — a gate over an empty directory guards nothing", () => {
    expect(papers).not.toBeNull();
    expect(papers.length).toBeGreaterThan(0);
  });

  for (const paper of papers ?? []) {
    it(`${paper} carries the form`, () => {
      const { problems } = scanPaper(readFileSync(join(repoRoot, PAPERS_DIR, paper), "utf8"));
      expect(problems).toEqual([]);
    });
  }

  it("does not treat the README as a paper", () => {
    expect(papers).not.toContain("README.md");
  });
});
