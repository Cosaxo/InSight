// THE ONE THING THAT WOULD HAVE CAUGHT IT. There is no camera plugin in
// this app and no code that asks for a camera, so nothing looked for a
// purpose string: `check:ios-location` reads only the location keys and
// `check:store-forms` reads only NSLocationDefaultAccuracyReduced. The
// camera arrives through WebKit instead — WKFileUploadPanel builds the
// upload sheet from the `accept` attribute, image MIME types conform to
// public.image, and it presents the system camera in-process with no check
// for the key. iOS TCC terminates the app on the tap.
//
// So the condition is not "does the app use a camera" but "does any file
// input accept an image", and that is a property of two files on disk
// rather than of a render. Asserted as source text for exactly that
// reason: a mounted component cannot tell you what Info.plist says, and
// the failure this pins happens on a device, before any JS runs.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

/** Every `accept` value on a file input in the typed UI layer. */
function imageAccepts(): string[] {
  const out: string[] = [];
  for (const f of ["src/v2/ui/LivePrivacyPanel.tsx"]) {
    const src = read(f);
    for (const m of src.matchAll(/<input\s+type="file"[\s\S]*?\/>/g)) {
      const a = /accept="([^"]*)"/.exec(m[0]);
      if (a && /image\//.test(a[1])) out.push(a[1]);
    }
  }
  return out;
}

describe("a file input that accepts images needs iOS purpose strings", () => {
  it("still has the input this is about — otherwise the case is vacuous", () => {
    expect(imageAccepts().length, "no image-accepting file input found; if the avatar picker "
      + "moved, move this case with it rather than deleting it").toBeGreaterThan(0);
  });

  it("declares NSCameraUsageDescription, because WebKit offers Take Photo", () => {
    if (!imageAccepts().length) return;
    const plist = read("ios/App/App/Info.plist");
    const m = /<key>NSCameraUsageDescription<\/key>\s*<string>([\s\S]*?)<\/string>/.exec(plist);
    expect(m, "an image file input ships with no camera purpose string — iOS kills the app "
      + "the moment someone taps Take Photo in the upload sheet").not.toBeNull();
    expect((m?.[1] ?? "").trim().length, "the camera purpose string is empty").toBeGreaterThan(20);
  });

  it("declares NSPhotoLibraryUsageDescription for the library leg", () => {
    if (!imageAccepts().length) return;
    const plist = read("ios/App/App/Info.plist");
    const m = /<key>NSPhotoLibraryUsageDescription<\/key>\s*<string>([\s\S]*?)<\/string>/.exec(plist);
    expect(m, "an image file input ships with no photo-library purpose string").not.toBeNull();
    expect((m?.[1] ?? "").trim().length, "the library purpose string is empty").toBeGreaterThan(20);
  });
});
