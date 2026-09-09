// @vitest-environment jsdom
//
// exportFile — the three routes a JSON export can take to the device, and
// which one the panel is told about. The route matters because the panel's
// next sentence depends on it: a saved file, a used share sheet, and a
// clipboard the person now has to paste from are three different endings.

import { describe, expect, it, vi } from "vitest";
import { exportFilename, handOffJson, type HandOffEnv } from "./exportFile";

vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => false } }));

function env(over: Partial<HandOffEnv> = {}): HandOffEnv & { log: string[] } {
  const log: string[] = [];
  return {
    log,
    native: false,
    canShareFile: () => false,
    share: async (f) => { log.push(`share:${f.name}`); },
    download: (f) => { log.push(`download:${f.name}`); },
    copy: async (t) => { log.push(`copy:${t.length}`); },
    ...over,
  };
}

describe("handOffJson", () => {
  it("names the file by the day", () => {
    expect(exportFilename(new Date("2026-09-09T12:00:00Z"))).toBe("insight-export-2026-09-09.json");
  });

  it("shares the file where the platform offers a sheet for it", async () => {
    const e = env({ canShareFile: () => true });
    expect(await handOffJson("{}", "x.json", e)).toBe("shared");
    expect(e.log).toEqual(["share:x.json"]);
  });

  it("downloads on the web when there is no sheet", async () => {
    const e = env();
    expect(await handOffJson("{}", "x.json", e)).toBe("saved");
    expect(e.log).toEqual(["download:x.json"]);
  });

  // Android's WebView has neither route, and a download that silently does
  // nothing is the failure this module exists to avoid — the person must
  // end up holding the bytes somewhere.
  it("copies to the clipboard on a native shell with no sheet, and says so", async () => {
    const e = env({ native: true });
    expect(await handOffJson('{"a":1}', "x.json", e)).toBe("copied");
    expect(e.log).toEqual(["copy:7"]);
  });

  it("treats a closed share sheet as done rather than pasting the export onto the clipboard", async () => {
    const abort = Object.assign(new Error("closed"), { name: "AbortError" });
    const e = env({ native: true, canShareFile: () => true, share: async () => { throw abort; } });
    expect(await handOffJson("{}", "x.json", e)).toBe("shared");
    expect(e.log).toEqual([]);
  });

  it("falls through to the next route when the sheet could not open", async () => {
    const e = env({ native: true, canShareFile: () => true, share: async () => { throw new Error("no sheet"); } });
    expect(await handOffJson("{}", "x.json", e)).toBe("copied");
    expect(e.log).toEqual(["copy:2"]);
  });

  it("throws when the last route fails, so the panel can say so", async () => {
    const e = env({ native: true, copy: async () => { throw new Error("clipboard unavailable"); } });
    await expect(handOffJson("{}", "x.json", e)).rejects.toThrow(/clipboard/);
  });
});
