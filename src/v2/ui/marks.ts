// marks — the initials and the colours the daily's social surfaces
// identify people and circles by (D156).
//
// WHY IT EXISTS. The v25 prototype's group and 1v1 bodies are built on two
// marks: a round initial avatar for a PERSON and a rounded-square initial
// mark for a CIRCLE, each coloured by a hash of its own id, plus a black
// "you" pill. Every row in those screens leans on them — the rail, the
// reveal bars, the member list, the guess step. The live panel had none of
// it and rendered names as plain text, which is the largest single reason
// the live 1v1 and Group screens did not look like the sample.
//
// The prototype's people carry `hue` and `init` as precomputed fields on a
// sample-data record. Live members are a uid and a display name, so both
// have to be derived — and derived DETERMINISTICALLY, because a colour that
// moves between renders is worse than no colour: the rail is a row of
// coloured squares you learn by position and shade.
//
// The hash is `ghash` from group-daily.jsx, character for character, so a
// circle keeps the same colour as it had in the prototype and the two
// screens agree with each other. It is not a good hash and does not need to
// be — it needs to be the SAME one.
//
// Its own module rather than locals in LiveDuelPanel because
// LiveCircleBody and the Mirror's Groups stop want the same marks, and a
// second copy of the hash would silently draw the same circle in two
// colours on two screens.
//
// SPLIT FROM duelMarks.tsx, which draws the shapes: react-refresh refuses a
// file that exports both components and plain functions, because a fast
// refresh of the component half would silently keep the old copy of the
// other. These four are the plain half.

// group-daily.jsx's ghash, unchanged. Math.imul keeps it 32-bit across
// engines — a plain `*` here overflows to a double and gives a different
// number on the same string.
function ghash(s: string): number {
  let h = 9;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 387420489);
  return ((h ^ (h >>> 9)) >>> 0) / 4294967295;
}

/** A stable 0–359 hue for any id. Same id, same colour, every session. */
export function markHue(seed: string): number {
  return Math.round(ghash(seed || "?") * 360);
}

/**
 * A person's initials: first letters of the first two words, or the first
 * two characters of a single-word name. "" for an account that set no
 * name — the caller decides what an anonymous member looks like, because
 * "Someone" and "?" are different claims.
 */
export function personInitials(name: string): string {
  const w = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!w.length) return "";
  return (w.length > 1 ? w[0][0] + w[1][0] : w[0].slice(0, 2)).toUpperCase();
}

/**
 * A circle's initials. Drops a leading "The" first — "The Sunday Club"
 * reads as SC, not TS, which is what a person would write on the label.
 */
export function groupInitials(name: string): string {
  const w = String(name || "").replace(/^The\s+/i, "").split(/\s+/).filter(Boolean);
  return (w.length > 1 ? w.slice(0, 2).map((x) => x[0]).join("") : (w[0] || "?").slice(0, 2)).toUpperCase();
}

/** First name, for the places a full name will not fit. */
export function firstName(name: string): string {
  return String(name || "").trim().split(/\s+/)[0] || "";
}
