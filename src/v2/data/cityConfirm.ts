// Whether the phone has agreed with your city (D205).
//
// THE PROBLEM. The city anchor is a claim with no evidence: `setCityAnchor`
// writes whatever the picker returns, and nothing ever checks it. That is
// fine for a cohort — "show me people who say they are in Oslo" is a
// coherent reading — and it is NOT fine for the place scorecard D187
// built, which claims to say how Oslo's people rate Oslo. One person
// picking a city they have never been to moves that number.
//
// WHAT THIS IS. One string beside the city in the profile blob: the city
// key the device's own location fix agreed with, the last time it did.
//
// STORING THE KEY RATHER THAN A BOOLEAN is the whole trick. A flag would
// have to be cleared on every path that changes the city, and the one that
// got missed would leave a stale "confirmed" on a city nobody checked.
// A key cannot go stale: it either equals the current city or it does not,
// so re-picking invalidates the confirmation for free, from the same
// comparison, with no clearing code to forget.
//
// IT NEVER LEAVES THE DEVICE. `anchorsFrom` (spec/profile-vitals.js)
// whitelists the nine keys it sends, and `cityOk` is not one of them — so
// this is device state like every other `insight.*` leaf, swept by the
// D51 purge with the rest of the blob. It is deliberately NOT an anchor:
// an anchor would be a tenth key on every answer forever, a rules arm, a
// `data-inventory` row and a bucket in a dimension list the source calls
// "a scarce resource" — all to carry a fact the client is the only reader
// of.
//
// NO IMPORTS, ON PURPOSE. `data/live.ts` reads this at vote time and
// `data/cityAnchor.ts` writes it; cityAnchor already imports live, so a
// module importing either would close a cycle. Owning the storage key here
// and letting cityAnchor re-export it keeps one source of truth without
// one.

/** The profile store's localStorage key. The SHAPE of the blob is owned by
 * profile-general.jsx (loadGen/seed); this module and `cityAnchor` write
 * exactly two leaves under `vitals` and preserve everything else. */
export const PROFILE_GENERAL_LS = "insight.profileGeneral.v2";

/** The vitals leaf: the city key the sensor last agreed with. */
export const CITY_OK_LEAF = "cityOk";

function vitals(): Record<string, unknown> {
  try {
    const blob: unknown = JSON.parse(localStorage.getItem(PROFILE_GENERAL_LS) || "null");
    if (!blob || typeof blob !== "object") return {};
    const v = (blob as Record<string, unknown>).vitals;
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch { return {}; }
}

/** The city the device's own fix agreed with, or "" if none ever did. */
export function confirmedCityKey(): string {
  const v = vitals()[CITY_OK_LEAF];
  return typeof v === "string" ? v : "";
}

/**
 * Whether `city` is the one the phone agreed with.
 *
 * An empty city is never confirmed — "nowhere" cannot be verified, and
 * returning true for it would let a profile with no city score every
 * place at once.
 */
export function cityIsConfirmed(city: string | null | undefined): boolean {
  if (!city) return false;
  return confirmedCityKey() === city;
}
