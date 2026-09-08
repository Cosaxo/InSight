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
import { scanPaper, listPapers, PAPERS_DIR, PAPER_SETS, AXES, REQUIRED, FORBIDDEN, CITATION_SHAPES, GENERAL_REQUIRED, GENERAL_FORBIDDEN } from "./check-theory.mjs";

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

// Citations, since 2026-09-08: allowed as `[n]` markers in the body that
// resolve to `[n] …` entries in a trailing **References.** block, each
// entry carrying a DOI or a URL. Both directions are pinned: a paper that
// cites properly passes, and every way of citing improperly fails — a
// shape in the body, a marker with no entry, an entry with no marker, an
// entry nobody can resolve, prose after the block.
const CITED = GOOD.replace(
  "Prose about 3D geometry",
  "The decomposition is the social relations model [1], and the comparison result is classical [2]. Prose about 3D geometry",
) + `
**References.**

[1] Kenny, D. A., & La Voie, L. The social relations model. Advances in Experimental Social Psychology, 18, 141–182 (1984). https://doi.org/10.1016/S0065-2601(08)60144-6
[2] Bradley, R. A., & Terry, M. E. Rank analysis of incomplete block designs: I. The method of paired comparisons. Biometrika, 39, 324–345 (1952). https://doi.org/10.2307/2334029
`;

describe("citations: markers into a References block, and nothing else", () => {
  it("a paper that cites by marker into a resolvable References block passes", () => {
    expect(rules(CITED)).toEqual([]);
  });

  it("the block may carry every shape the body may not", () => {
    // The two entries above hold a DOI, a URL, a bracketed year and an
    // author list; none of that is flagged because it is in the block.
    expect(CITED).toMatch(/\(1984\)/);
    expect(CITED).toMatch(/https:\/\/doi\.org/);
    expect(rules(CITED)).toEqual([]);
  });

  it("a citation shape in the body still fails, with the block present", () => {
    for (const shape of ["see https://example.org", "doi 10.1000/xyz", "Kenny et al", "as shown (1984)"]) {
      const text = CITED.replace("Prose about 3D geometry", `${shape}. Prose about 3D geometry`);
      expect(rules(text).some((r) => r.startsWith("contains "))).toBe(true);
    }
  });

  it("a marker with no entry fails", () => {
    const text = CITED.replace("classical [2]", "classical [7]");
    expect(rules(text)).toContain("a citation marker with no reference");
    expect(rules(text)).toContain("a reference nothing cites");
  });

  it("an entry nothing cites fails", () => {
    const text = CITED.replace("classical [2]", "classical");
    expect(rules(text)).toContain("a reference nothing cites");
  });

  it("an entry with neither DOI nor URL fails", () => {
    const text = CITED.replace(/ https:\/\/doi\.org\/10\.2307\/2334029/, "");
    expect(rules(text)).toContain("an unresolvable reference");
  });

  it("prose after the References line fails", () => {
    const text = CITED + "\nAnd one more paragraph of argument.\n";
    expect(rules(text)).toContain("a References line that is not an entry");
  });

  it("a duplicate number fails", () => {
    const text = CITED.replace("[2] Bradley", "[1] Bradley");
    expect(rules(text)).toContain("a duplicate reference number");
  });

  it("every citation rule carries a reason", () => {
    for (const rule of CITATION_SHAPES) {
      expect(rule.why.length).toBeGreaterThan(20);
    }
  });
});

describe("the shapes that pulled the last attempt back to the tree", () => {
  const WOULD_DRIFT = [
    ["a link", "See https://example.org/paper for the finding."],
    ["a link", "The study is at www.example.org."],
    ["a DOI", "Reported in doi:10.1038/nature14659."],
    ["a DOI", "The figure is 14% (10.1038/nature14659)."],
    ['"et al"', "Cai et al found 14%."],
    ["a bracketed year", "Heritability is about 50% (2020)."],
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

  it("catches a numbered marker with no References block behind it", () => {
    // Before 2026-09-08 `[12]` was a forbidden shape outright; now it is a
    // marker, and a marker into nothing is the same drift by another name.
    expect(rules(`${GOOD}\nAs shown before [12], the effect holds.\n`)).toContain("a citation marker with no reference");
  });

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

const GENERAL_GOOD = `# The discovery problem

**Status: theory research.** General track.

**Perfect-form test.** If the app did not exist, this would still be worth saying because the problem is general.

**Setting.** A population of units, a set of sources each with a cost, a budget of observations per unit per period.

**Abstract.** Which observations to take so that the couplings between sources are identified.

**1 · The problem**

Sources are observed on units.

**2 · What would have to hold**

The co-observation graph is connected.

**3 · The potential**

A general theory.
`;

describe("general papers state their setting and name none of this app's sources", () => {
  it("a well-formed general paper passes without naming any axis", () => {
    const { problems, axes } = scanPaper(GENERAL_GOOD, "general");
    expect(problems).toEqual([]);
    expect(axes.length).toBeLessThan(2);
  });

  it("the same text fails as an AXIOM paper, because it names no axes", () => {
    expect(scanPaper(GENERAL_GOOD, "axiom").problems.map((p) => p.rule)).toContain(
      "names fewer than two axes",
    );
  });

  it("fails without a setting paragraph", () => {
    const noSetting = GENERAL_GOOD.replace("**Setting.**", "**Context.**");
    expect(scanPaper(noSetting, "general").problems.map((p) => p.rule)).toContain(
      "missing a setting paragraph",
    );
  });

  for (const text of [
    "Consider a genome imported by the unit.",
    "The logic test is one keyed source.",
    "A duel between two units is a relation.",
    "InSight measures seven sources.",
  ]) {
    it(`fails when it reaches for this app's sources: ${text.slice(0, 40)}…`, () => {
      const rules = scanPaper(`${GENERAL_GOOD}\n${text}\n`, "general").problems.map((p) => p.rule);
      expect(rules).toContain("contains this app or one of its sources");
    });
  }

  it("an axiom paper may name them, of course", () => {
    expect(rules(`${GOOD}\nA duel between two units is a relation.\n`)).toEqual([]);
  });

  it("every general rule carries a reason too", () => {
    for (const r of [...GENERAL_REQUIRED, ...GENERAL_FORBIDDEN]) expect(r.why.length).toBeGreaterThan(20);
    expect(PAPER_SETS.map((s) => s.kind)).toEqual(["axiom", "general"]);
  });
});

describe("the papers actually in the tree", () => {
  const papers = listPapers(join(repoRoot, PAPERS_DIR));

  it("exist — a gate over an empty directory guards nothing", () => {
    expect(papers).not.toBeNull();
    expect(papers.length).toBeGreaterThan(0);
  });

  for (const { dir, kind } of PAPER_SETS) {
    for (const paper of listPapers(join(repoRoot, dir)) ?? []) {
      it(`${dir}/${paper} carries the ${kind} form`, () => {
        const { problems } = scanPaper(readFileSync(join(repoRoot, dir, paper), "utf8"), kind);
        expect(problems).toEqual([]);
      });
    }
  }

  it("does not treat the README as a paper", () => {
    expect(papers).not.toContain("README.md");
  });
});
