// catalog-curate-lib.test.mjs — pins the artists domain's curation rule.
//
// The cases below are the real ones, with their real occupation counts as
// measured against Wikidata on 2026-08-23 (D265). They are named after the
// people they are about on purpose: the rule exists because a mechanically
// valid catalogue put Leonardo da Vinci 2nd in a list of musicians, and a
// test that says `{ music: 2, total: 30 }` would not have caught the
// regression that matters, which is a person.
import { describe, it, expect } from "vitest";
import {
  MUSIC_OCC_SEEDS,
  MUSIC_RATIO_MIN,
  musicShare,
  keepsAsArtist,
  parseReview,
  applyReview,
} from "./catalog-curate-lib.mjs";

// A stand-in closure: the builder resolves P279* against Wikidata, and
// every occupation id below either is a seed or is treated as musical
// here because the real closure says so.
const MUSIC = new Set([...MUSIC_OCC_SEEDS, 1234, 5678]);
const occ = (music, other) => [
  ...Array.from({ length: music }, (_, i) => (i === 0 ? 639669 : i === 1 ? 36834 : 1234)),
  ...Array.from({ length: other }, (_, i) => 900000 + i),
];
const person = (key, name, music, total, links) =>
  ({ key, name, links, isGroup: false, occ: occ(music, total - music) });

describe("musicShare", () => {
  it("counts musical occupations against the whole list", () => {
    expect(musicShare(occ(3, 8), MUSIC)).toEqual({ music: 3, total: 11 });
  });

  it("reports an empty occupation list rather than dividing by zero", () => {
    expect(musicShare([], MUSIC)).toEqual({ music: 0, total: 0 });
    expect(musicShare(undefined, MUSIC)).toEqual({ music: 0, total: 0 });
  });
});

describe("keepsAsArtist — the people the rule exists for", () => {
  // Every count here is D265's measurement, not an invention.
  const KEEP = [
    ["Bob Dylan", 8, 22],
    ["John Lennon", 9, 22],
    ["Whitney Houston", 4, 9],
    ["Hector Berlioz", 3, 9],
    ["Robert Schumann", 4, 9],
    ["Tupac Shakur", 4, 10],
    ["Jimi Hendrix", 9, 9],
  ];
  const DROP = [
    ["Leonardo da Vinci", 2, 30],
    ["Johann Wolfgang von Goethe", 1, 40],
    ["Charlie Chaplin", 3, 15],
    ["Martin Luther", 2, 16],
    ["Friedrich Nietzsche", 1, 8],
    ["Marilyn Monroe", 2, 8],
    ["Mother Teresa", 1, 7],
    ["Pelé", 2, 7],
    ["Tom Hanks", 2, 22],
  ];

  for (const [name, m, n] of KEEP) {
    it(`keeps ${name} (${m}/${n})`, () => {
      expect(keepsAsArtist(person(1, name, m, n, 100), MUSIC)).toBe(true);
    });
  }
  for (const [name, m, n] of DROP) {
    it(`drops ${name} (${m}/${n})`, () => {
      expect(keepsAsArtist(person(1, name, m, n, 100), MUSIC)).toBe(false);
    });
  }

  it("keeps a musical group despite no occupations at all", () => {
    // The Beatles: P31 Q215380, P106 empty. A ratio over nothing would
    // reject every band in the catalogue.
    expect(keepsAsArtist({ key: 1, isGroup: true, occ: [] }, MUSIC)).toBe(true);
  });

  it("drops a person with no occupations rather than dividing by zero", () => {
    expect(keepsAsArtist({ key: 1, isGroup: false, occ: [] }, MUSIC)).toBe(false);
  });

  it("holds the boundary at the threshold itself, inclusive", () => {
    // Berlioz sits exactly on it at 3/9, so an exclusive comparison would
    // silently drop him — this is the case that picks < over <=.
    expect(MUSIC_RATIO_MIN).toBeCloseTo(1 / 3, 12);
    expect(keepsAsArtist(person(1, "on the line", 3, 9, 100), MUSIC)).toBe(true);
    expect(keepsAsArtist(person(1, "just under", 3, 10, 100), MUSIC)).toBe(false);
  });

  it("a majority threshold would drop Tchaikovsky and Dylan — why it is a third", () => {
    for (const [name, m, n] of [["Tchaikovsky", 4, 11], ["Bob Dylan", 8, 22], ["Berlioz", 3, 9]]) {
      expect(keepsAsArtist(person(1, name, m, n, 100), MUSIC, 0.5)).toBe(false);
      expect(keepsAsArtist(person(1, name, m, n, 100), MUSIC)).toBe(true);
    }
  });

  // The honest limit of the mechanical rule, pinned so nobody re-tunes
  // the constant expecting it to close: Wagner and Sinatra sit under a
  // third, and every threshold low enough to catch them also re-admits
  // Chaplin and Marilyn Monroe. These four are content/artist-review.json's
  // job, not the ratio's.
  it("cannot separate Wagner and Sinatra from Chaplin and Monroe at any threshold", () => {
    const WANTED = [["Richard Wagner", 3, 11], ["Frank Sinatra", 2, 10]];
    const UNWANTED = [["Charlie Chaplin", 3, 15], ["Marilyn Monroe", 2, 8]];
    for (const min of [1 / 3, 0.28, 0.25, 0.2]) {
      const inWanted = WANTED.filter(([n, m, t]) => keepsAsArtist(person(1, n, m, t, 1), MUSIC, min));
      const inUnwanted = UNWANTED.filter(([n, m, t]) => keepsAsArtist(person(1, n, m, t, 1), MUSIC, min));
      // No threshold admits every wanted name while excluding every
      // unwanted one — that is the claim, and it is why the review file
      // is not a workaround for a badly chosen constant.
      expect(inWanted.length === WANTED.length && inUnwanted.length === 0).toBe(false);
    }
  });
});

describe("parseReview", () => {
  it("reads both sides into maps", () => {
    const r = parseReview({
      reject: [{ qid: 20821, name: "Henry VIII of England", why: "king; one music occupation of two" }],
      admit: [{ qid: 1511, name: "Richard Wagner" }],
    });
    expect(r.errors).toEqual([]);
    expect(r.reject.get(20821).name).toBe("Henry VIII of England");
    expect(r.admit.get(1511).name).toBe("Richard Wagner");
  });

  it("accepts a file with neither side, which is the shipped state", () => {
    expect(parseReview({}).errors).toEqual([]);
    expect(parseReview({ reject: [], admit: [] }).errors).toEqual([]);
  });

  it("refuses a rejection with no reason", () => {
    const r = parseReview({ reject: [{ qid: 5, name: "Someone" }] });
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatch(/why is required/);
    expect(r.reject.size).toBe(0);
  });

  it("refuses a QID that is not a positive integer", () => {
    for (const qid of ["1511", 0, -1, 15.5, null]) {
      expect(parseReview({ admit: [{ qid, name: "x" }] }).errors).toHaveLength(1);
    }
  });

  it("refuses an entry with no name — the name is what makes it auditable", () => {
    expect(parseReview({ admit: [{ qid: 5, name: "  " }] }).errors[0]).toMatch(/name is required/);
  });

  it("refuses the same QID twice, including across the two sides", () => {
    const r = parseReview({
      reject: [{ qid: 7, name: "A", why: "because" }],
      admit: [{ qid: 7, name: "A" }],
    });
    expect(r.errors[0]).toMatch(/already in reject\[0\]/);
  });

  it("collects every complaint rather than stopping at the first", () => {
    const r = parseReview({ admit: [{ qid: 0, name: "a" }, { qid: 1, name: "" }] });
    expect(r.errors).toHaveLength(2);
  });
});

describe("applyReview", () => {
  const pool = [
    { key: 2831, name: "Michael Jackson", links: 300 },
    { key: 1511, name: "Richard Wagner", links: 200 },
    { key: 20821, name: "Henry VIII of England", links: 150 },
    { key: 762, name: "Leonardo da Vinci", links: 100 },
  ];
  const kept = [pool[0], pool[2]]; // prefilter kept Jackson and (wrongly) Henry VIII

  it("removes a rejected row and restores an admitted one, in rank order", () => {
    const review = parseReview({
      reject: [{ qid: 20821, name: "Henry VIII of England", why: "king who composed" }],
      admit: [{ qid: 1511, name: "Richard Wagner" }],
    });
    const out = applyReview(kept, pool, review);
    expect(out.rows.map((r) => r.name)).toEqual(["Michael Jackson", "Richard Wagner"]);
    expect(out.rejected).toHaveLength(1);
    expect(out.admitted).toHaveLength(1);
    expect(out.stale).toEqual([]);
  });

  it("re-sorts an admitted row by sitelinks, not onto the end", () => {
    const review = parseReview({ admit: [{ qid: 1511, name: "Richard Wagner" }] });
    const out = applyReview([pool[3], pool[0]], pool, review);
    expect(out.rows.map((r) => r.links)).toEqual([300, 200, 100]);
  });

  it("reports an exception whose subject left the candidate pool", () => {
    const review = parseReview({ admit: [{ qid: 99999, name: "Gone On Refresh" }] });
    const out = applyReview(kept, pool, review);
    expect(out.stale).toEqual([{ side: "admit", qid: 99999, name: "Gone On Refresh" }]);
    expect(out.rows).toHaveLength(2);
  });

  it("reports a rejection the prefilter already handled as redundant, not stale", () => {
    // Leonardo is a candidate but the ratio rule already dropped him. The
    // distinction matters: stale means the entry points at nothing, and
    // redundant means the rule caught up with the reviewer.
    const review = parseReview({ reject: [{ qid: 762, name: "Leonardo da Vinci", why: "painter" }] });
    const out = applyReview(kept, pool, review);
    expect(out.stale).toEqual([]);
    expect(out.redundant.map((e) => e.name)).toEqual(["Leonardo da Vinci"]);
  });

  it("leaves the rows untouched when the review is empty", () => {
    const out = applyReview(kept, pool, parseReview({}));
    expect(out.rows).toEqual(kept);
    expect(out.rejected).toEqual([]);
    expect(out.admitted).toEqual([]);
  });

  it("never admits a key the generator did not produce", () => {
    // The whole safety argument for a hand-edited file: an admission can
    // only restore a row from the pool, so no key here can resolve to an
    // entity the query never saw.
    const review = parseReview({ admit: [{ qid: 424242, name: "Invented" }] });
    const out = applyReview(kept, pool, review);
    expect(out.rows.some((r) => r.key === 424242)).toBe(false);
  });
});
