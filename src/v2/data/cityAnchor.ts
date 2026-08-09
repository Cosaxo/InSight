// setCityAnchor — the one write path for "my city is X" from OUTSIDE the
// profile overlay. D9 put the picker in the profile's Basics card; the
// Mirror's Near/Country stops offer the same picker in their needs-a-city
// empty state, because "go set it in your profile" with nothing tappable
// was a dead end a release user actually hit.
//
// Two halves, and the second is the one that looks optional and is not:
//
// 1. LIVE.saveAnchors — the anchor map itself: what LIVE.myCity reads
//    back for the Mirror, and what the next answer snapshots (D8).
//    `country` is DERIVED from the key as the ISO code, exactly as
//    profile-general.jsx's anchorsFrom does it — never typed.
// 2. The profile panel's own localStorage blob. GeneralPanel mirrors
//    anchorsFrom(vitals) into saveAnchors wholesale ON EVERY MOUNT —
//    deliberately, to repair fabricated anchors (see the effect's comment
//    in profile-general.jsx). A city saved only server-side would survive
//    exactly until the profile overlay next opened, then be replaced by
//    the blob's empty vitals.city, silently. So the city goes into the
//    blob too, and the mount-time mirror re-asserts it instead.
import LIVE from "./live";
import { countryOf } from "./places";

// The profile store's localStorage key. The SHAPE of the blob is owned by
// profile-general.jsx (loadGen/seed); this module writes exactly one leaf,
// `vitals.city`, and preserves everything else byte-for-byte. The constant
// lives here so the two files cannot drift apart — profile-general imports
// it rather than restating it.
export const PROFILE_GENERAL_LS = "insight.profileGeneral.v2";

export function setCityAnchor(cityKey: string): void {
  // Demo mode's profile is the sample persona and there is no server to
  // write to — the callers are live-only surfaces, and this guard keeps a
  // test or a stray call from writing a "real" city into demo data.
  if (!LIVE.enabled) return;
  try {
    let blob: unknown = null;
    try { blob = JSON.parse(localStorage.getItem(PROFILE_GENERAL_LS) || "null"); } catch { blob = null; }
    const base = (blob && typeof blob === "object" ? blob : {}) as Record<string, unknown>;
    const vitals = (base.vitals && typeof base.vitals === "object" ? base.vitals : {}) as Record<string, unknown>;
    localStorage.setItem(
      PROFILE_GENERAL_LS,
      JSON.stringify({ ...base, vitals: { ...vitals, city: cityKey } }),
    );
  } catch { /* best-effort — the anchor write below still lands */ }
  LIVE.saveAnchors({ ...LIVE.anchors(), city: cityKey, country: countryOf(cityKey) });
}
