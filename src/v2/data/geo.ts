// The presence grid (D84): a coordinate becomes a cell id ON THE DEVICE,
// and the cell id is all that ever leaves it.
//
// A plain degree grid rather than geohash: the neighbor math is two
// integer ±1s instead of a base-32 table, the precision cap is legible in
// the id itself, and firestore.rules can hold the shape with one regex.
//
// 0.002° SINCE D174, DOWN FROM 0.01°, and the reason the constant could
// not simply be edited is worth keeping here. At 0.01° a cell was ~1.11 km
// tall — which was not a design choice but the honest ceiling of the
// COARSE fix the app used to request. A finer grid over a coarse fix would
// have produced precise-LOOKING ids computed from a kilometre-wide
// measurement, which is the invented precision this app refuses
// everywhere else. So the grid moved only once the fix did: D174 requests
// precise location on both platforms and pays for it at the store label.
//
// At 0.002° a cell is ~222 m tall everywhere and ~222·cos(lat) m wide
// (~111 m at 60°N), so the 3×3 neighborhood the count reads is roughly
// 670 m × 330 m in Oslo — a venue and its street rather than a district.
//
// AND IT IS STILL COARSER THAN APPLE'S PRECISE THRESHOLD, deliberately.
// "Precise Location" is defined as a resolution of three or more decimal
// places (0.001°); 0.002° sits one step above it. What the app REQUESTS is
// precise and is declared as such; what it KEEPS is still a square this
// side of that line, and picking the grid to land there was the point.
//
// The server holds its own copy of the cell contract (functions/src/
// pure.ts — presenceCellOk / presenceNeighbors); the two are pinned to
// the same vectors by their test suites, the floor.ts pattern.

export const PRESENCE_CELL_DEG = 0.002;

// "-450_9000"-style ids: floor(lat/0.002), floor(lon/0.002), underscore.
// Five digits each now: latitude reaches 45000 and longitude 90000.
export const PRESENCE_CELL_RE = /^-?\d{1,5}_-?\d{1,5}$/;

export function presenceCell(lat: number, lon: number): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  const la = Math.floor(lat / PRESENCE_CELL_DEG);
  const lo = Math.floor(lon / PRESENCE_CELL_DEG);
  return `${la}_${lo}`;
}
