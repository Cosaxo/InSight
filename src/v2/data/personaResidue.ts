// The sample persona's residue in a live profile, and the one honest way
// to remove it.
//
// THE HISTORY. profile-general.jsx's merge path used to spread the demo
// seed's vitals underneath a live user's saved blob on every second
// profile open, and the panel's mount mirror then wrote the result to
// `v2_users/{uid}` — from where the Map's anchor ring reads it back as
// "Editor · independent press · FROM YOUR PROFILE" on a stranger's map
// (the owner hit exactly this on a device, 2026-08-11). The client leak
// is fixed (baseFor holds on every mount) and migrateV1 filters the local
// v1 blob, but the DOC a pre-fix build polluted stays polluted until the
// profile overlay is next opened — which on a device that never opens it
// is forever, while answerAnchors() stamps the fabricated cohort onto
// every new answer (D8, and answers are immutable).
//
// THE RULE. An anchor value exactly equal to the persona's is residue and
// is dropped, boot-time, doc included. That is safe for these two fields
// because neither string is enterable today: profession and education are
// fixed <select> vocabularies (JOB_OPTS / EDU_OPTS) that do not contain
// them — personaResidue.test.ts pins both facts, the equality to
// sample-data and the absence from the vocabularies. ageBand is NOT
// distinctive (plenty of real people share the persona's band), so it
// goes only when both signature strings matched — i.e. when the whole
// triple was the leak's one write. City, gender and relationship were
// never in the seeded vitals, so they are never touched.
//
// Pure and dependency-free, so the test needs no Firebase mocks; live.ts
// applies it at hydrate and repairs the doc through saveAnchors.

// spec/sample-data.js `me` — restated rather than imported (data/ must not
// depend on the spec layer); the test binds the copies.
export const PERSONA_JOB = "Editor · independent press";
export const PERSONA_EDU = "MA Literature · Univ. of Oslo";

/**
 * The anchors map with the persona's residue removed, or null when there
 * was none (the common case — callers skip the repair write entirely).
 */
export function scrubPersonaAnchors(
  anchors: Record<string, string>,
): Record<string, string> | null {
  const jobHit = anchors.profession === PERSONA_JOB;
  const eduHit = anchors.education === PERSONA_EDU;
  if (!jobHit && !eduHit) return null;
  const clean = { ...anchors };
  if (jobHit) delete clean.profession;
  if (eduHit) delete clean.education;
  if (jobHit && eduHit) delete clean.ageBand;
  return clean;
}
