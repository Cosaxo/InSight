// photoToBase64 — capture a meal photo via @capacitor/camera and
// return the bytes as base64 (no data URI prefix). The vision-Gemma
// plugin (insight-llm) expects raw base64 in this exact shape.
//
// Why this is its own file: AddMealFlow doesn't need to know about
// Capacitor file URIs, blob conversions, or webPath quirks. It just
// asks for "a base64 photo string or null if the user cancelled" and
// passes that to the LLM.

import { Camera } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";

export interface CapturedPhoto {
  /** Raw base64 (no `data:` prefix). Pass straight to InsightLLM. */
  base64: string;
  /** A URL the <img> tag can render. Use for the in-flow preview. */
  previewUrl: string;
}

// Compromise quality + dimensions to keep the image small enough
// that base64 encoding stays under a few MB. Gemma 3n's vision
// encoder downsamples internally to 768×768, so anything larger
// is wasted bytes.
const PHOTO_OPTIONS = {
  quality: 75,
  targetWidth: 1024,
  targetHeight: 1024,
  saveToGallery: false,
};

export async function takeMealPhoto(): Promise<CapturedPhoto | null> {
  if (!Capacitor.isNativePlatform()) {
    throw new Error("Camera is not available on web.");
  }
  try {
    const result = await Camera.takePhoto(PHOTO_OPTIONS);
    return result.uri ? await materialise(result.uri) : null;
  } catch (err) {
    // The plugin throws "User cancelled photos app" / similar when
    // the user backs out — treat that as a benign null, surface
    // anything else.
    const msg = err instanceof Error ? err.message : String(err);
    if (/cancel/i.test(msg) || /denied/i.test(msg)) return null;
    throw err;
  }
}

export async function pickMealPhoto(): Promise<CapturedPhoto | null> {
  if (!Capacitor.isNativePlatform()) {
    throw new Error("Camera is not available on web.");
  }
  try {
    const result = await Camera.chooseFromGallery({
      ...PHOTO_OPTIONS,
      limit: 1,
    });
    const first = result.results?.[0];
    return first?.uri ? await materialise(first.uri) : null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/cancel/i.test(msg) || /denied/i.test(msg)) return null;
    throw err;
  }
}

// Read a Capacitor file URI and return both:
//   - raw base64 for the LLM
//   - a webview-renderable URL for the preview
async function materialise(uri: string): Promise<CapturedPhoto> {
  // Capacitor.convertFileSrc rewrites a file:// URI into a
  // capacitor://localhost/_capacitor_file_/... URL the WebView is
  // allowed to fetch.
  const previewUrl = Capacitor.convertFileSrc(uri);
  const response = await fetch(previewUrl);
  const blob = await response.blob();
  const base64 = await blobToBase64(blob);
  return { base64, previewUrl };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const raw = reader.result as string;
      // FileReader gives us a data URI ("data:image/jpeg;base64,..."); we
      // want only the part after the comma.
      const comma = raw.indexOf(",");
      resolve(comma >= 0 ? raw.slice(comma + 1) : raw);
    };
    reader.onerror = () => reject(reader.error ?? new Error("FileReader failed"));
    reader.readAsDataURL(blob);
  });
}
