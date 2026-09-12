import { describe, expect, it } from "vitest";
import {
  WORLD_MAP_CAP,
  WORLD_MAP_ID,
  WorldMapBuilder,
  positionModel,
  positionTheta,
  roundPos,
  worldMapId,
} from "./patternsWorld";
import { ridgeTheta } from "./patternsAls";

const person = (uid: string, n: number, country?: string) => ({ uid, x: 0.1, y: -0.2, n, ...(country ? { country } : {}) });

describe("the published position's rounding (D462)", () => {
  it("is two decimals, and never a negative zero", () => {
    expect(roundPos(0.123456)).toBe(0.12);
    expect(roundPos(-0.987)).toBe(-0.99);
    expect(roundPos(-0.0001)).toBe(0);
    expect(Object.is(roundPos(-0.0001), -0)).toBe(false);
    // the grid is coarse enough that two nearby people share a cell —
    // which is the point: a place on a picture, not a fingerprint
    expect(roundPos(0.4451)).toBe(roundPos(0.4487));
  });
});

describe("the ridge a published position is solved under (D462)", () => {
  // THE CROWD AND THE VIEWER ARE ONE PICTURE, so the two solves have to be
  // one solve. The phone places the viewer and every sampled stranger with
  // `ridgeSolve(obs, k, lambdaU)` — the published lambda on the diagonal
  // as it stands. The fold placed the published crowd with
  // `lambdaU * obs.length + 0.5`, a ridge that grows with the answer
  // count, and the block's own comment says the dots and the viewer's dot
  // "are in one space". They were not: on anisotropic evidence the two
  // ridges point in different directions, not merely at different
  // lengths, so normalising to the unit circle does not reconcile them.
  const obs = [
    { L: [1, 0], r: 1 },
    { L: [1, 0], r: 1 },
    { L: [0.2, 1], r: -1 },
  ];
  const unit = (v: readonly number[]) => {
    const n = Math.hypot(...v);
    return n > 0 ? v.map((x) => x / n) : [...v];
  };

  it("is the phone's ridge, raw — not one scaled by the observation count", () => {
    const lambdaU = 0.5;
    // what the device computes for the same evidence
    const mine = unit(ridgeTheta(obs, 2, lambdaU));
    expect(unit(positionTheta(obs, 2, lambdaU))).toEqual(mine);
    // …and the scaled form this replaced is a DIFFERENT DIRECTION, which
    // is what makes the agreement above worth pinning rather than obvious
    const scaled = unit(ridgeTheta(obs, 2, lambdaU * obs.length + 0.5));
    const cos = mine[0] * scaled[0] + mine[1] * scaled[1];
    expect(Math.acos(Math.min(1, cos)) * 180 / Math.PI,
      "the two ridges agree after all — this case cannot see the defect it is about")
      .toBeGreaterThan(5);
  });
});

describe("the model a position is solved against", () => {
  const rows = { a: { v: [1, 0], n: 10, sum: 2 }, b: { v: [0, 1], n: 10, sum: -4 } };

  it("keeps the published item metadata when the engine publishes it (ALS)", () => {
    const items = { a: { kind: "bin" as const, qid: "a", nOptions: 2 }, "anchor~gender~Woman": { kind: "anc" as const, qid: "anchor~gender", nOptions: 2, dim: "gender", bucket: "Woman" } };
    const m = positionModel(2, rows, items);
    expect(m.items["anchor~gender~Woman"].kind).toBe("anc");
    // and copies, so a later rotation of the published rows cannot reach it
    m.rows.a.v[0] = 99;
    expect(rows.a.v[0]).toBe(1);
  });

  it("synthesises bin items when the online engine publishes none", () => {
    const m = positionModel(2, rows, undefined);
    expect(m.items).toEqual({
      a: { kind: "bin", qid: "a", nOptions: 2 },
      b: { kind: "bin", qid: "b", nOptions: 2 },
    });
  });
});

describe("the world map's documents (D462)", () => {
  it("writes one document per country plus the world's own, and states the population", () => {
    const b = new WorldMapBuilder(3);
    for (let i = 0; i < 5; i++) b.add(person(`no${i}`, 10 + i, "Norway"));
    for (let i = 0; i < 2; i++) b.add(person(`se${i}`, 40 + i, "Sweden"));
    b.add(person("nowhere", 99));
    const docs = b.docs("2026-09-11");
    expect([...docs.keys()].sort()).toEqual([worldMapId("Norway"), worldMapId("Sweden"), WORLD_MAP_ID]);
    const no = docs.get(worldMapId("Norway"))!;
    expect(no.country).toBe("Norway");
    expect(no.n).toBe(3);
    expect(no.total, "the cap is stated against the population it was drawn from").toBe(5);
    expect(no.day).toBe("2026-09-11");
    // the most answers first, ties by uid
    expect(Object.keys(no.rows).sort()).toEqual(["no2", "no3", "no4"]);
    expect(no.rows.no4).toEqual({ x: 0.1, y: -0.2, n: 14 });
    // a person with no country chip is on the world map and in nobody's own
    expect(docs.get(WORLD_MAP_ID)!.rows.nowhere).toBeDefined();
    expect(docs.get(worldMapId("Norway"))!.rows.nowhere).toBeUndefined();
  });

  it("the world document is a turn each, so one country cannot fill it", () => {
    const b = new WorldMapBuilder(6);
    // a big country of high answerers and a small one of low
    for (let i = 0; i < 50; i++) b.add(person(`big${String(i).padStart(2, "0")}`, 100 + i, "Bigland"));
    for (let i = 0; i < 2; i++) b.add(person(`sm${i}`, 9 + i, "Smallia"));
    const world = b.docs("2026-09-11").get(WORLD_MAP_ID)!;
    expect(world.n).toBe(6);
    // both of Smallia's are on it — a global top-6 by answers would have
    // drawn Bigland alone and called it the world
    expect(Object.keys(world.rows).filter((u) => u.startsWith("sm")).sort()).toEqual(["sm0", "sm1"]);
    expect(world.total, "every person counted, not just the drawn").toBe(52);
    // and the country's own document is its own best
    expect(Object.keys(b.docs("2026-09-11").get(worldMapId("Bigland"))!.rows).length).toBe(6);
  });

  it("holds no more than the cap per country while it streams", () => {
    const b = new WorldMapBuilder(2);
    for (let i = 0; i < 200; i++) b.add(person(`u${String(i).padStart(3, "0")}`, i, "Norway"));
    const no = b.docs("2026-09-11").get(worldMapId("Norway"))!;
    expect(Object.keys(no.rows).sort()).toEqual(["u198", "u199"]);
    expect(no.total).toBe(200);
  });

  it("an empty night still writes the world document, empty, rather than leaving last night's", () => {
    const docs = new WorldMapBuilder().docs("2026-09-11");
    expect([...docs.keys()]).toEqual([WORLD_MAP_ID]);
    expect(docs.get(WORLD_MAP_ID)).toEqual({ id: WORLD_MAP_ID, rows: {}, n: 0, total: 0, day: "2026-09-11" });
  });

  it("the shipped cap is the drawing bound the lens states", () => {
    expect(WORLD_MAP_CAP).toBe(600);
  });
});
