// The People lens's arithmetic (D214), pinned before the pixels: a crowd
// with known structure must come out placed, gated and counted exactly —
// the honesty rules in peopleMap.ts's header are the spec, and each case
// below names the rule it holds. (The field-label placement this file
// used to pin retired with the 2026-09-06 design: no name is standing
// type on the field, so the fold stopped solving where names go.)
import { describe, expect, it } from "vitest";
import {
  countryOf,
  foldPeople,
  peopleFetchSet,
  PEOPLE_ALIKE,
  PEOPLE_MIN_SHARED,
  PEOPLE_QUESTIONS,
  PEOPLE_C,
  type PeopleItem,
  type PeopleRow,
} from "./peopleMap";

const item = (
  qid: string,
  over: Partial<PeopleItem> = {},
): PeopleItem => ({
  qid,
  L: [0.9, 0.05],
  n: 60,
  marginal: 0,
  mine: 1,
  optionLabels: ["Yes", "No"],
  ...over,
});

const row = (uid: string, optionIdx: number, over: Partial<PeopleRow> = {}): PeopleRow => ({
  uid,
  optionIdx,
  name: uid.toUpperCase(),
  anchors: { city: "Oslo, NO", age: "25-34" },
  isMe: false,
  ...over,
});

/** Six agreeing-axis questions plus one rare-answer question (q7): its
 * marginal says only 10% pick option 0, and the viewer did. */
const ITEMS: PeopleItem[] = [
  ...[1, 2, 3, 4, 5, 6].map((i) => item(`q${i}`)),
  item("q7", { L: [0.5, 0], marginal: -0.8, optionLabels: ["RareYes", "CommonNo"] }),
];
const FETCHED = ITEMS.map((i) => i.qid);

/** Faction A answers like the viewer everywhere; faction B the opposite.
 * T is thin (three lists); q7 holds only a1's agreeing rare answer. */
function rowsOf(qid: string): PeopleRow[] | null {
  if (qid === "q7") return [row("a1", 0)];
  const base = [
    ...["a1", "a2", "a3", "a4", "a5"].map((u) => row(u, 0)),
    ...["b1", "b2", "b3", "b4", "b5"].map((u) => row(u, 1)),
  ];
  if (["q1", "q2", "q3"].includes(qid)) base.push(row("t1", 0));
  return base;
}

describe("the basis the card states", () => {
  // `answered` and `basis` are different numbers and the card printed the
  // wrong one: every pool question the viewer has answered, over a crowd
  // placed from the twelve lists the fold actually reads. Your own dot is
  // solved from all of them, which is what made it look right — and every
  // dot beside it said "12 of 12 shared answers" on the same screen.
  it("counts the lists the crowd was placed from, not everything answered", () => {
    const items = Array.from({ length: 40 }, (_, i) => item(`q${i}`));
    // Only three lists came back with rows, however many were asked for.
    const rows: Record<string, PeopleRow[]> = {
      q0: [row("a", 0)], q1: [row("a", 1)], q2: [row("a", 0)],
    };
    const fetched = items.slice(0, 12).map((i) => i.qid);
    const field = foldPeople(items, fetched, (qid) => rows[qid] ?? null);
    expect(field.answered, "the viewer's own dot is solved from all of them").toBe(40);
    expect(field.basis, "the crowd came from the lists that returned rows").toBe(3);
  });

  it("does not count a list that came back empty or unread", () => {
    const items = Array.from({ length: 12 }, (_, i) => item(`q${i}`));
    const fetched = items.map((i) => i.qid);
    expect(foldPeople(items, fetched, () => null).basis).toBe(0);
    expect(foldPeople(items, fetched, () => []).basis).toBe(0);
  });
});

describe("foldPeople", () => {
  const field = foldPeople(ITEMS, FETCHED, rowsOf);
  const by = new Map(field.placed.map((p) => [p.uid, p]));

  it("places both factions and refuses the thin person (confidence rule)", () => {
    for (const uid of ["a1", "a2", "b1", "b5"]) expect(by.has(uid)).toBe(true);
    // t1 shares 3 answers — under the floor, absent, never centre-parked
    expect(by.has("t1")).toBe(false);
    expect(field.minShared).toBe(Math.max(PEOPLE_MIN_SHARED, Math.round(FETCHED.length * 0.32)));
  });

  it("counts agreement exactly, per person (numbers rule)", () => {
    const a2 = by.get("a2")!;
    expect(a2.shared).toBe(6);
    expect(a2.agree).toBe(6);
    const b1 = by.get("b1")!;
    expect(b1.shared).toBe(6);
    expect(b1.agree).toBe(0);
    expect(by.get("a1")!.shared).toBe(7);
  });

  it("separates the factions on the plane, with the viewer on their side", () => {
    // the shared axis is the first component; the sign is arbitrary but
    // must be CONSISTENT — A with the viewer, B opposite
    const a = by.get("a3")!;
    const b = by.get("b3")!;
    expect(Math.sign(a.px)).not.toBe(Math.sign(b.px));
    const meanX = (uids: string[]) =>
      uids.reduce((s, u) => s + by.get(u)!.x, 0) / uids.length;
    const aX = meanX(["a1", "a2", "a3", "a4", "a5"]);
    const bX = meanX(["b1", "b2", "b3", "b4", "b5"]);
    // the viewer answered like A everywhere, so their pixel sits A-ward
    expect(Math.abs(field.me.x - aX)).toBeLessThan(Math.abs(field.me.x - bX));
  });

  it("solves the viewer from their own wider evidence when the caller has it (D395)", () => {
    // every pool item loads along axis 0; evidence along axis 1 alone
    // moves the viewer's dot off the crowd's axis, and the strangers are
    // placed exactly as before
    const base = foldPeople(ITEMS, FETCHED, rowsOf);
    const wide = foldPeople(ITEMS, FETCHED, rowsOf, { viewerObs: [{ L: [0, 1], r: 1 }], lambda: 0.5 });
    expect(Math.abs(wide.me.x - PEOPLE_C)).toBeLessThan(Math.abs(base.me.x - PEOPLE_C));
    expect(wide.me.y).toBeGreaterThan(PEOPLE_C);
    expect(wide.placed.map((p) => [p.uid, p.agree, p.shared])).toEqual(base.placed.map((p) => [p.uid, p.agree, p.shared]));
    // the card's own count is still the viewer's two-option answers
    expect(wide.answered).toBe(base.answered);
    // an empty list means "solve me like everyone else"
    expect(foldPeople(ITEMS, FETCHED, rowsOf, { viewerObs: [] }).me).toEqual(base.me);
  });

  it("names the tie by the RAREST shared answer, with its crowd share", () => {
    // a1 agrees on q7, whose option carries a 10% marginal share — rarer
    // than the 50% of every other shared answer
    const a1 = by.get("a1")!;
    expect(a1.tie).toEqual({ label: "RareYes", share: expect.closeTo(0.1, 5) as number });
    // a2 never answered q7; its rarest shared answer is an even split
    expect(by.get("a2")!.tie).toEqual({ label: "Yes", share: expect.closeTo(0.5, 5) as number });
    // b-side agrees on nothing — no tie, and the card says the split
    expect(by.get("b1")!.tie).toBeNull();
  });

  it("keeps every dot inside the RIM", () => {
    // the frame is a disc since 2026-09-02: a rectangular clamp would
    // leave a pushed dot sitting in a corner the field does not have
    for (const p of [...field.placed, field.me]) {
      expect(Math.hypot(p.x - PEOPLE_C, p.y - PEOPLE_C)).toBeLessThanOrEqual(PEOPLE_C - p.r - 12 + 1e-9);
    }
  });

  it("rows at most the cap, each named, no name twice", () => {
    // three rows since 2026-09-06 — the one place a name is standing type
    expect(field.alike.length).toBeLessThanOrEqual(PEOPLE_ALIKE);
    const names = field.alike.map((p) => p.name);
    expect(names.every(Boolean)).toBe(true);
    expect(new Set(names).size).toBe(names.length);
  });

  it("sizes a dot in two steps, and draws nothing off a hue", () => {
    // size is a RANK (more shared answers), not a measurement: a continuum
    // read as jitter. Colour is the lens's job now, so the fold carries no
    // per-person hue to be mistaken for one.
    expect(new Set(field.placed.map((p) => p.r)).size).toBeLessThanOrEqual(2);
    for (const p of field.placed) expect(p.many).toBe(p.r > 4);
    expect(field.placed.every((p) => !("hue" in p))).toBe(true);
  });

  it("is deterministic — same inputs, same field, bit for bit", () => {
    expect(JSON.stringify(foldPeople(ITEMS, FETCHED, rowsOf))).toBe(
      JSON.stringify(foldPeople(ITEMS, FETCHED, rowsOf)),
    );
  });
});

describe("the fold's guards", () => {
  it("folds hostile rows to nothing: the viewer's own row, foreign optionIdx", () => {
    const dirty = (qid: string): PeopleRow[] | null => {
      const rows = rowsOf(qid) ?? [];
      return [
        ...rows,
        row("me", 0, { isMe: true }),
        row("catalogish", 7),
        row("negative", -1),
      ];
    };
    const field = foldPeople(ITEMS, FETCHED, dirty);
    const uids = new Set(field.placed.map((p) => p.uid));
    expect(uids.has("me")).toBe(false);
    expect(uids.has("catalogish")).toBe(false);
    expect(uids.has("negative")).toBe(false);
  });

  it("leaves a nameless account drawn but never rowed (D167 — no invented names)", () => {
    const anon = (qid: string): PeopleRow[] | null =>
      (rowsOf(qid) ?? []).map((r) => (r.uid.startsWith("a") ? { ...r, name: "" } : r));
    const field = foldPeople(ITEMS, FETCHED, anon);
    for (const p of field.alike) expect(p.name, "a row with no name to carry is an invented identity").not.toBe("");
    // still drawn — anonymity thins the rows, never the crowd
    expect(field.placed.some((p) => p.uid === "a1")).toBe(true);
  });

  it("folds an unfetched list (null rows) as absent, not as empty agreement", () => {
    const half = (qid: string) => (["q1", "q2", "q3", "q4"].includes(qid) ? rowsOf(qid) : null);
    const field = foldPeople(ITEMS, FETCHED, half);
    // four lists loaded → shared can reach 4 → the floor still holds
    for (const p of field.placed) expect(p.shared).toBeGreaterThanOrEqual(field.minShared);
  });

  it("answers the empty world without dividing by it", () => {
    const field = foldPeople([], [], () => null);
    expect(field.placed).toEqual([]);
    expect(field.answered).toBe(0);
    expect(Number.isFinite(field.me.x)).toBe(true);
  });
});

describe("populations (D216)", () => {
  it("places only who the filter passes, and reframes around them", () => {
    // keep the A faction only — the field must be A's own picture, not
    // the world's with dots removed
    const field = foldPeople(ITEMS, FETCHED, rowsOf, { keep: (uid) => uid.startsWith("a") });
    const uids = field.placed.map((p) => p.uid);
    expect(uids.every((u) => u.startsWith("a"))).toBe(true);
    expect(uids.length).toBe(5);
    // the viewer is still drawn — a population that excludes you is not
    // a place you can be looking from
    expect(Number.isFinite(field.me.x)).toBe(true);
  });

  it("keeps the same counts under a filter — membership, never arithmetic", () => {
    const world = foldPeople(ITEMS, FETCHED, rowsOf);
    const only = foldPeople(ITEMS, FETCHED, rowsOf, { keep: (uid) => uid === "a2" });
    const wa = world.placed.find((p) => p.uid === "a2")!;
    const fa = only.placed.find((p) => p.uid === "a2")!;
    expect(fa.shared).toBe(wa.shared);
    expect(fa.agree).toBe(wa.agree);
    expect(fa.tie).toEqual(wa.tie);
  });

  it("swaps a circle member's chips for the one that matters", () => {
    const field = foldPeople(ITEMS, FETCHED, rowsOf, { circle: new Set(["a1"]) });
    expect(field.placed.find((p) => p.uid === "a1")!.chips).toEqual(["your circle"]);
    expect(field.placed.find((p) => p.uid === "a2")!.chips).toEqual(["Oslo, NO", "25-34"]);
  });
});

describe("countryOf", () => {
  it("reads the code off a frozen city anchor, and refuses the rest", () => {
    expect(countryOf("Oslo, NO")).toBe("NO");
    expect(countryOf("San Cristóbal de las Casas, MX")).toBe("MX");
    expect(countryOf("Nowhere")).toBeNull();
    expect(countryOf("")).toBeNull();
    expect(countryOf(undefined)).toBeNull();
  });
});

describe("peopleFetchSet", () => {
  it("asks for answered questions only, strongest basis first, capped", () => {
    const items = [
      item("weak", { n: 5 }),
      item("strong", { n: 500 }),
      item("open", { n: 900, mine: null }),
      ...Array.from({ length: 15 }, (_, i) => item(`mid${i}`, { n: 50 + i })),
    ];
    const set = peopleFetchSet(items);
    expect(set.length).toBe(PEOPLE_QUESTIONS);
    expect(set[0]).toBe("strong");
    expect(set).not.toContain("open");
    expect(set).not.toContain("weak");
  });
});

// ── "Most like you" ranked on pixels, not on likeness ──────────────
//
// The rows are labelled "Most like you" and each prints "agrees X of Y".
// They once rendered `near` — the retired label-placement set, ordered by
// distance from your dot on the field.
//
// Position is components 0 and 1 of a unit-normalised EIGHT-dimensional
// solve, so agreement living in the other six is discarded before the
// distance is taken. The rows could therefore lead with the person who
// agrees with you least, in the colour that says "mostly disagrees",
// while the real match sat at the opposite rim.
//
// `alike` ranks on the number each row already shows.
describe("the rows that say most like you", () => {
  // Eleven questions whose loading sits on a latent dimension the field
  // does NOT draw, and one on a dimension it does. Xena disagrees on the
  // eleven and agrees on the drawn one; Yuri is the reverse.
  const HIDDEN: PeopleItem[] = [
    ...Array.from({ length: 11 }, (_, i) => item(`h${i}`, { L: [0, 0, 0.9] })),
    item("shown", { L: [0.9, 0] }),
  ];
  const FETCH = HIDDEN.map((i) => i.qid);
  const rowsHidden = (qid: string): PeopleRow[] | null =>
    qid === "shown"
      ? [row("xena", 1), row("yuri", 0)]
      : [row("xena", 0), row("yuri", 1)];

  it("ranks on agreement, not on where the dots landed", () => {
    const f = foldPeople(HIDDEN, FETCH, rowsHidden);
    const byName = Object.fromEntries(f.placed.map((p) => [p.name, p]));
    // The premise, asserted rather than assumed: YURI agrees with one
    // answer of twelve and XENA with eleven — and YURI is the NEARER dot,
    // because the disagreement lives in dimensions the field does not
    // draw. Measured on this fixture: YURI 16px from you, XENA 292px.
    expect(byName.YURI.agree, "the fixture does not separate them").toBeLessThan(byName.XENA.agree);
    const dist = (p: typeof byName.XENA) => Math.hypot(p.x - f.me.x, p.y - f.me.y);
    expect(dist(byName.YURI), "the projection no longer hides the disagreement — pick a new fixture")
      .toBeLessThan(dist(byName.XENA));
    // …so the rows must lead with the one who agrees, not the one nearby.
    expect(f.alike[0].name, "the rows crowned the person who agrees least").toBe("XENA");
  });
});
