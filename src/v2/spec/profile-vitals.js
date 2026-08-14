// profile-vitals.js — the vitals vocabulary, and the map from it onto the
// eight anchor keys (D151).
//
// WHY ITS OWN FILE. These lists are not styling. `check:anchors` holds
// four of them equal to BREAKDOWN_DIM_VOCAB in functions/src/pure.ts —
// the aggregate trigger buckets on these exact strings, so a label typed
// a second time in a second file silently stops that level counting, with
// nothing red anywhere. `anchorsFrom` is the same hazard in function form.
//
// They lived inside profile-general.jsx's IIFE while the Basics card was
// the only thing that collected them. It is not any more: the
// account-creation screen (ui/LiveProfileSetup.tsx) asks the same seven
// questions at the top of a new account, and it must ask them with the
// same words.
//
// A MODULE OF THEIR OWN RATHER THAN AN EXPORT FROM profile-general, and
// that part is measured. `spec-index.js` imports profile-general eagerly,
// so a lazy screen importing it too makes rollup extract the whole panel
// into a shared chunk that first paint still preloads — `check:bundle`
// put 19 KB of profile panel into the eager graph and went 1 KB over the
// ceiling. Three kilobytes of vocabulary is a fine thing to share; a
// profile panel is not.
//
// scripts/check-anchors.mjs reads THIS file for the client half of its
// comparison (`clientVocab`, `clientAgeBands`), so the declarations keep
// their exact spelling: `const NAME = [` on one line, one string literal
// per option.
//
// No React import and no window reads — it is data and two pure
// functions, which is what makes it safe to share in both directions.
import PLACES from '../data/places';

// ── select (fixed options — keeps profile fields filterable) ──
const YEAR_NOW = new Date().getFullYear();
export const YEARS = Array.from({ length: YEAR_NOW - 13 - 1929 }, (_, i) => String(YEAR_NOW - 13 - i));
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));
const monthNum = (name) => MONTHS.indexOf(name) + 1; // 0 when unset
export function calcAge(y, mName, d) {
  if (!y) return '';
  const now = new Date();
  let a = now.getFullYear() - Number(y);
  const m = monthNum(mName);
  if (m) { const cm = now.getMonth() + 1; if (cm < m || (cm === m && now.getDate() < Number(d || 0))) a--; }
  return String(a);
}
export const JOB_OPTS = ['Arts & culture', 'Design & creative', 'Media & publishing', 'Writing & journalism', 'Education & research', 'Science', 'Software & IT', 'Tech & engineering', 'Engineering', 'Architecture', 'Healthcare', 'Mental health & care', 'Business & finance', 'Marketing & advertising', 'Sales', 'Consulting', 'Law & government', 'Public sector & nonprofit', 'Trades & crafts', 'Construction', 'Manufacturing', 'Agriculture & environment', 'Transport & logistics', 'Service & hospitality', 'Retail', 'Entrepreneur / self-employed', 'Student', 'Homemaker', 'Between jobs', 'Retired', 'Other'];
// Anchor vocabularies (D8). Coarse on purpose: the breakdown floors get
// thin fast, and a free-text answer would mint a bucket per spelling.
// "Prefer not to say" is a REAL option, not an empty string, so choosing
// it is distinguishable from never having been asked.
export const GENDER_OPTS = ['Woman', 'Man', 'Non-binary', 'Prefer not to say'];
export const REL_OPTS = ['Single', 'Dating', 'Partnered', 'Married', 'It\u2019s complicated', 'Prefer not to say'];
// D140: a band select, never a centimetre field — the band is what is
// collected, the locate.ts posture (coarse by construction). Held equal
// to BREAKDOWN_DIM_VOCAB by check:anchors like every closed vocabulary.
export const HEIGHT_OPTS = ['Under 160 cm', '160-169 cm', '170-179 cm', '180-189 cm', '190 cm or taller', 'Prefer not to say'];
// ~5-year bands under 35, widening after — matches how the splits are
// read ("25-34 went the other way"), and keeps cells populated.
export const AGE_BANDS = [
  [0, 17, 'Under 18'], [18, 24, '18-24'], [25, 34, '25-34'],
  [35, 44, '35-44'], [45, 54, '45-54'], [55, 64, '55-64'], [65, 200, '65+'],
];
export function ageBandOf(age) {
  const n = Number(age);
  if (!n || Number.isNaN(n)) return '';
  const hit = AGE_BANDS.find(([lo, hi]) => n >= lo && n <= hi);
  return hit ? hit[2] : '';
}
// The profile\u2019s own vocabulary, mapped onto the seven rules-validated
// anchor keys. Only the band is derived \u2014 the exact birthday never
// leaves the device.
export function anchorsFrom(v) {
  // `city` holds the canonical catalogue key ("Oslo, NO"), which is also
  // the breakdown bucket key. `country` is DERIVED from it as the ISO
  // code, never typed: the code is locale-independent, so a French phone
  // and a Norwegian one land in the same cohort. The breakdown UI turns
  // it back into "Norway" / "Norvège" at display time.
  //
  // A profile written before the picker holds free text, which does not
  // parse — those keep their city string (it is still their answer) and
  // simply contribute no country until they re-pick.
  const city = v.city || '';
  return {
    ageBand: ageBandOf(calcAge(v.born, v.bornM, v.bornD) || v.age),
    gender: v.gender || '',
    // Imported binding — the (window.PLACES && …) load-order guard died
    // with the conversion, as the README's conversion notes prescribe.
    country: PLACES.countryOf(city) || '',
    city,
    education: v.education || '',
    profession: v.job || '',
    relationship: v.relationship || '',
    heightBand: HEIGHT_OPTS.includes(v.heightBand) ? v.heightBand : '',
  };
}

// Held equal to BREAKDOWN_DIM_VOCAB in functions/src/pure.ts by
// `npm run check:anchors` — the aggregate trigger buckets on these exact
// strings, so a label edit here silently stops that level counting.
// 'Vocational or trade' is spelled without the slash for that reason: a
// slash is in breakdownBucket's rejected character class, and while this
// list said 'Vocational / trade' that option folded into no bucket at all.
export const EDU_OPTS = ['Primary school', 'Middle school', 'High school', 'Vocational or trade', 'Some college', 'Associate degree', "Bachelor's", 'Postgraduate diploma', "Master's", 'MBA', 'Doctorate', 'Postdoctoral', 'Professional certification', 'Self-taught', 'Other'];
