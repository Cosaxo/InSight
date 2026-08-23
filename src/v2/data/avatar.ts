// The profile photo (D178) — the upload half, and the URL every surface
// draws from.
//
// The app held no image of anyone until this. `docs/STORE-FORMS.md` said
// "Photos or Videos: not collected" and that was load-bearing, so this
// module arriving flips a store answer the same way D175's precise fix
// did — deliberately, on the owner's call, recorded rather than absorbed.
//
// THREE PROPERTIES, and they are all here rather than spread across the
// callers:
//
//   1. ONE OBJECT PER ACCOUNT, at a fixed Storage id. The retired v1 path
//      in `storage.rules` records what a free filename cost — unbounded
//      objects, unbounded bytes, unbounded egress, from an app where an
//      account is free (D3). A fixed id makes a second upload an
//      overwrite, so the object count is bounded by construction.
//   2. THE DEVICE DOES THE SHRINKING. What leaves the phone is a small
//      square, re-encoded, with the original's metadata gone — EXIF on a
//      camera photo carries GPS, and this app spent D9, D84 and D175
//      being careful about exactly that datum. A canvas round-trip drops
//      it; there is no EXIF on a `toBlob` result.
//   3. A TOKEN IS STORED, NOT A URL. `v2_avatars` holds the Storage
//      download token and the URL is built here, so the stored field
//      cannot name a host we do not control — which would leak every
//      viewer's IP to it and let the picture change after it was
//      reported. `firestore.rules` enforces the charset that makes that
//      true; this module is the other end of the same argument.
//
// The Storage SDK is imported DYNAMICALLY and only by the upload path.
// Drawing a face needs no SDK at all — it is an `<img>` and a URL — so a
// user who never sets a photo never pays for `firebase/storage`.

/** The square the uploader produces. Bigger than any surface draws it. */
export const AVATAR_PX = 256;

/**
 * The JPEG quality. 0.82 is where a 256px face stops visibly improving;
 * the result is ~15-25 KB against a 256 KB rules cap, which is the ten
 * times of headroom that makes the cap a backstop rather than a limit
 * real uploads have to fit.
 */
const AVATAR_QUALITY = 0.82;

/** What `storage.rules` will actually refuse. Checked here so a huge file
 * fails with a sentence instead of a permission error. */
export const AVATAR_MAX_BYTES = 256 * 1024;

/** Where the object lives. One id, no filename — see the header. */
export const avatarPath = (uid: string): string => `avatars/${uid}`;

/**
 * The URL a surface draws.
 *
 * Built rather than stored, from the bucket this build is configured with
 * and a token that cannot be anything else. Returns "" when either half
 * is missing, which callers read as "no photo" and fall back to initials.
 */
export function avatarUrl(uid: string, token: string): string {
  const bucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;
  if (!bucket || !uid || !token) return "";
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/`
    + `${encodeURIComponent(avatarPath(uid))}?alt=media&token=${encodeURIComponent(token)}`;
}

/**
 * A centre-cropped square at AVATAR_PX, re-encoded as JPEG.
 *
 * CROPPED, not squashed: every surface draws this in a circle, and a
 * letterboxed portrait squeezed into one is a face with the ears cut off
 * rather than a smaller face.
 *
 * Rejects rather than guesses when the browser cannot decode the file —
 * a `createImageBitmap` failure means it is not an image this device can
 * read, whatever its extension claims.
 */
export async function shrinkToSquare(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - side) / 2;
    const sy = (bitmap.height - side) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_PX;
    canvas.height = AVATAR_PX;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, AVATAR_PX, AVATAR_PX);
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, "image/jpeg", AVATAR_QUALITY));
    if (!blob) throw new Error("encode failed");
    return blob;
  } finally {
    // Explicit: a bitmap holds decoded pixels, and a phone that lets
    // someone try four photos in a row should not hold four full-size
    // decodes waiting for a GC that has no reason to run.
    bitmap.close();
  }
}

/**
 * The token out of a Storage download URL.
 *
 * Parsed rather than read off the upload result, because the SDK does not
 * expose `downloadTokens` as public API and a private field is a thing
 * that changes under you. `getDownloadURL` is the supported call, and the
 * token is a query parameter of what it returns.
 */
export function tokenFromUrl(url: string): string {
  const m = /[?&]token=([^&]+)/.exec(url);
  return m ? decodeURIComponent(m[1]) : "";
}

/**
 * The two initials, from a display name.
 *
 * Here rather than beside the component for eslint's react-refresh rule
 * (a component file must export only components) — and it belongs here
 * anyway: it is the fallback half of "what does this person look like",
 * which is what this module is about. `?` for an account with no name at
 * all, which is a real state: a display name is optional.
 */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  // CODE POINTS, NOT CODE UNITS (D233). `parts[0][0]` indexes UTF-16, and
  // an astral character — an emoji, a CJK extension B glyph — is two units
  // wide, so a multi-word name whose first or last word starts with one
  // contributed HALF of it: "Ada 🎈" drew "A\uD83C", an unpaired surrogate
  // rendering as tofu beside a correct letter, on the one surface whose
  // whole job is drawing identity.
  //
  // The single-word branch escaped it by accident — `slice(0, 2)` happens
  // to take both halves of one astral character — which is why the bug
  // survived every by-hand reading. Spreading gives both branches the same
  // unit and makes the accident deliberate.
  const cps = (s: string): string[] => [...s];
  if (parts.length === 1) return cps(parts[0]).slice(0, 2).join("").toUpperCase();
  return (cps(parts[0])[0] + cps(parts[parts.length - 1])[0]).toUpperCase();
}
