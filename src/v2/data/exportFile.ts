// exportFile.ts — hand a JSON export to the device (D443).
//
// The account panel's "Download your data" calls `exportAccountV2` and gets
// one JSON object back; this module is the part that turns it into
// something the person HOLDS rather than something the app displayed. It is
// loaded by a dynamic import on the tap, so the panel's chunk carries none
// of it (the walkthrough's shape, D393).
//
// THREE ROUTES, AND WHY THERE ARE THREE. There is no one way to give a
// WebView a file:
//   · a share sheet with the file in it, where the platform offers one
//     (`navigator.canShare({ files })` — iOS WebKit, and the mobile
//     browsers) — the person picks Files, Mail, AirDrop, whatever they use;
//   · an anchor download, on the web, which every browser turns into a
//     file in Downloads;
//   · the clipboard, where neither exists. Android's WebView implements
//     neither the Web Share API nor a download listener the shell would
//     have to add, so on Android the export lands on the clipboard until a
//     native share plugin is added — D443 prices that as the follow-up. The
//     JSON is the same bytes on every route; only the container differs.
//
// The route taken is RETURNED, because the panel has to say which one it
// was: "Saved" for a file the person will find in Downloads, "Shared" for a
// sheet they just used, and "Copied" for text they now have to paste
// somewhere — three different next steps, and a single "Done" would hide
// the one that needs an action.
//
// Injectable, so the test can drive each route without a real share sheet.

import { Capacitor } from "@capacitor/core";

export type HandOff = "shared" | "saved" | "copied";

/** The file's name: the app, the day. Sorts by date in a folder of them. */
export function exportFilename(now = new Date()): string {
  return `insight-export-${now.toISOString().slice(0, 10)}.json`;
}

export interface HandOffEnv {
  /** A Capacitor shell, where an anchor download is inert. */
  native: boolean;
  /** Whether the platform can put THIS file in a share sheet. */
  canShareFile: (file: File) => boolean;
  share: (file: File) => Promise<void>;
  download: (file: File) => void;
  copy: (text: string) => Promise<void>;
}

/** The real platform, read at call time — never at module load. */
export function platformEnv(): HandOffEnv {
  const nav = typeof navigator === "undefined" ? undefined : navigator;
  return {
    native: Capacitor.isNativePlatform(),
    canShareFile: (file) => {
      try {
        return !!nav && typeof nav.canShare === "function" && typeof nav.share === "function"
          && nav.canShare({ files: [file] });
      } catch {
        return false;
      }
    },
    share: (file) => nav!.share({ files: [file], title: file.name }),
    download: (file) => {
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Revoked on the next tick rather than now: the click has started the
      // download, but the browser reads the blob asynchronously.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    copy: (text) => nav!.clipboard.writeText(text),
  };
}

/**
 * Hand `text` to the device as `filename`. Tries the routes in the order
 * the header gives, and returns the one that worked. Throws only when no
 * route could — the panel shows that as the plain failure it is.
 */
export async function handOffJson(
  text: string,
  filename: string,
  env: HandOffEnv = platformEnv(),
): Promise<HandOff> {
  const file = new File([text], filename, { type: "application/json" });
  if (env.canShareFile(file)) {
    try {
      await env.share(file);
      return "shared";
    } catch (e) {
      // The person closed the sheet: not a failure to report, and not a
      // reason to paste eight megabytes onto their clipboard either.
      if ((e as { name?: string })?.name === "AbortError") return "shared";
      /* a sheet that could not open falls through to the next route */
    }
  }
  if (!env.native) {
    env.download(file);
    return "saved";
  }
  await env.copy(text);
  return "copied";
}
