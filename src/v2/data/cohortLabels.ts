// Bucket key → the name a reader should see.
//
// Breakdown buckets are stored canonically so that one cohort is one key
// worldwide: `country` is the ISO code and `city` is "Oslo, NO" (D9).
// That is the right thing to STORE — it is what makes two devices in two
// languages fold into the same cell — and the wrong thing to show, and
// every surface that draws a cohort chip has to make the same conversion.
//
// Its own module for the mechanical reason lensDefs.ts records: eslint's
// react-refresh rule wants a component file to export only components, and
// it is right that a function shared between two of them does not belong
// in one.
//
// It lives under `data/` since 2026-08-31, and that move is the same
// lesson a third time. It sat in `ui/` while the module it wraps
// (`data/places`) sat here, so the one surface below `ui/` that needed it
// — the pulse's own scope labels — could not import it without inverting
// the layering, and printed the raw keys instead: "NO" for a country,
// "Oslo, NO" for a city, at the reader. The practical reason is better — before D125 there were two
// conversions (world-feed's `wfBucketLabel`, off `window.PLACES`) and one
// omission (the Mirror's lenses, which printed "NO" at people), which is
// exactly the drift a shared list exists to stop.
import PLACES from "./places";

export function bucketLabel(dim: string, bucket: string): string {
  if (dim === "country") return PLACES.countryName(bucket) || bucket;
  if (dim === "city") {
    const p = PLACES.parse(bucket);
    return p ? PLACES.label(p) : bucket;
  }
  return bucket;
}
