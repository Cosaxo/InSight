// Handles, client side (D122) — the app's first way to name a person.
//
// The VALIDATION here is a copy of functions/src/pure.ts's, deliberately,
// and the duplication is the point rather than a thing to factor out: the
// client half exists so the field can say "that's taken" or "too short"
// while you type, and the server half exists because a client check is a
// courtesy and the callable is the gate. Two copies that must agree is a
// risk; one copy reachable from both is a build-graph problem this repo
// does not have (functions/ ships separately). handles.test.ts pins them
// to the same table of cases, which is the cheap version of the same
// guarantee.
//
// PURE, and that is structural rather than tidy: this module rode the
// first-paint chunk through its panel importers for most of its life
// (LiveDuelPanel until D156 made it a React.lazy, LivePrivacyPanel until
// D344 moved it into the overlays chunk), and a `firebase/firestore`
// import here landed the whole SDK in that chunk — measured at 1270 KB
// against a 955 KB ceiling, which is precisely the tree as it stood
// before D110. Both importers are off first paint now; the split stays,
// because a pure module cannot regress the eager graph however its
// importers move. The lookup that needs Firestore lives in ./socialFetch,
// which only live.ts imports and only dynamically.

/** Longest a handle may be, typed or stored. */
export const HANDLE_MAX = 20;
/** Shortest. */
export const HANDLE_MIN = 3;

const HANDLE_RE = /^[a-z0-9_]+$/;

/**
 * Names no account may hold — the app's own URL segments and the words
 * that would let an account impersonate the system. Kept in step with
 * functions/src/pure.ts by handles.test.ts.
 */
export const RESERVED_HANDLES = new Set([
  "insight", "admin", "administrator", "root", "system", "support",
  "help", "about", "privacy", "terms", "join", "invite", "invites",
  "profile", "settings", "account", "me", "you", "everyone", "world",
  "team", "staff", "official", "mod", "moderator", "null", "undefined",
  "anonymous", "anon", "deleted",
]);

/** The canonical key for a typed handle, or null if it is not one. */
export function normalizeHandle(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const h = raw.trim().replace(/^@+/, "").toLowerCase();
  if (h.length < HANDLE_MIN || h.length > HANDLE_MAX) return null;
  if (!HANDLE_RE.test(h)) return null;
  if (/^[0-9]+$/.test(h)) return null;
  if (RESERVED_HANDLES.has(h)) return null;
  return h;
}

/**
 * Why a typed handle is not claimable — for the field under the input.
 *
 * Separate from normalizeHandle because they answer different questions:
 * the fold says "is this a handle", this says "what do I tell you". A
 * single function returning a string|null would make every non-UI caller
 * parse prose.
 *
 * Returns null when the handle is fine. Empty input is also null — an
 * untouched field is not an error, and saying so in red is how a form
 * greets someone by telling them off.
 */
export function handleProblem(raw: string): string | null {
  const typed = raw.trim().replace(/^@+/, "");
  if (!typed) return null;
  if (normalizeHandle(typed)) return null;
  const low = typed.toLowerCase();
  if (typed.length < HANDLE_MIN) return `At least ${HANDLE_MIN} characters.`;
  if (typed.length > HANDLE_MAX) return `At most ${HANDLE_MAX} characters.`;
  if (!HANDLE_RE.test(low)) return "Letters, numbers and _ only.";
  if (/^[0-9]+$/.test(low)) return "Needs at least one letter.";
  if (RESERVED_HANDLES.has(low)) return "That one is reserved.";
  // Unreachable while the branches above cover every rejection in
  // normalizeHandle — kept because the two functions are separate lists
  // and a new rule added to one and not the other should say something
  // rather than render an empty error.
  return "That handle can't be used.";
}

/** `@olaf` — the display form, from a canonical or typed one. */
export function atHandle(handle: string): string {
  return `@${handle.replace(/^@+/, "")}`;
}
