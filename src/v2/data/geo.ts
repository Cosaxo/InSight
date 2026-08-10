// The presence grid (D84): a coordinate becomes a ~1 km cell id ON THE
// DEVICE, and the cell id is all that ever leaves it.
//
// A plain 0.01°-degree grid rather than geohash: the neighbor math is two
// integer ±1s instead of a base-32 table, the precision cap is legible in
// the id itself ("6012_1074" can be read back to nothing finer than a
// square kilometre), and firestore.rules can hold the shape with one
// regex. At 0.01° a cell is ~1.11 km tall everywhere and ~1.11·cos(lat)
// km wide (~0.56 km at 60°N) — which matches the honest radius the
// shipped COARSE location permission can measure at all. True 500 m
// needs the Precise flip D84 records as the owner's separate call.
//
// The server holds its own copy of the cell contract (functions/src/
// pure.ts — presenceCellOk / presenceNeighbors); the two are pinned to
// the same vectors by their test suites, the floor.ts pattern.

export const PRESENCE_CELL_DEG = 0.01;

// "-90_1800"-style ids: floor(lat/0.01), floor(lon/0.01), underscore.
export const PRESENCE_CELL_RE = /^-?\d{1,4}_-?\d{1,5}$/;

export function presenceCell(lat: number, lon: number): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  const la = Math.floor(lat / PRESENCE_CELL_DEG);
  const lo = Math.floor(lon / PRESENCE_CELL_DEG);
  return `${la}_${lo}`;
}
