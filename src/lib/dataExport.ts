// dataExport.ts — JSON backup of all locally-cached app data.
//
// Why it exists:
//   - Apple/Google policies and basic respect for the user both
//     want a way to export your own data. This is that.
//   - It's also the simplest "scared we're going to break a
//     migration" insurance: take a backup, ship the change, restore
//     if anything looks wrong.
//
// What it dumps:
//   Every localStorage key under the `insight.` namespace. The
//   hooks mirror remote (Firestore) reads into localStorage on
//   subscribe, so for a signed-in user the dump captures whatever
//   the app last saw from Firestore plus any pending local edits.
//   For a signed-out user, localStorage IS the source of truth.
//
// What it does NOT capture:
//   - Cross-user data (inbound impressions, friend daily reports).
//     Those belong to the senders; restoring them on someone else's
//     account would be misleading.
//   - The on-device Gemma LLM model file (it's a multi-GB blob in
//     Capacitor Filesystem, not localStorage — keeping it out of a
//     JSON file is the only sane choice).
//   - The Firebase auth account itself (you'd re-sign-in after
//     restore on a new device).
//
// Import semantics:
//   Wipe every `insight.*` localStorage key, write the keys from
//   the backup, reload the page so hooks re-init from fresh state.
//   We don't try to merge — a manual restore is rare, and a clean
//   replace is much easier to reason about than a diff.

const NAMESPACE = "insight.";

export interface BackupBlob {
  format: "insight-backup";
  version: 1;
  exportedAt: string; // ISO timestamp
  // Each value is the raw localStorage string (already JSON-encoded
  // by the hook that wrote it). We don't re-parse — keeps the
  // round-trip lossless even if a hook stores something unusual.
  entries: Record<string, string>;
}

export function gatherExport(): BackupBlob {
  const entries: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(NAMESPACE)) continue;
    const value = localStorage.getItem(key);
    if (value == null) continue;
    entries[key] = value;
  }
  return {
    format: "insight-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    entries,
  };
}

// Trigger a browser download of the backup JSON. Works on web and
// inside the Capacitor WebView — both expose the standard Blob /
// anchor-click pattern.
export function downloadBackup(blob: BackupBlob): void {
  const json = JSON.stringify(blob, null, 2);
  const data = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  const stamp = blob.exportedAt.slice(0, 10);
  a.download = `insight-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer revoke so the click has finished triggering the download.
  setTimeout(() => URL.revokeObjectURL(url), 5_000);
}

// Validate a parsed JSON blob looks like a backup we recognise.
// Returns the typed blob or throws an informative error.
export function validateBackup(raw: unknown): BackupBlob {
  if (!raw || typeof raw !== "object") {
    throw new Error("File doesn't look like a backup (not an object).");
  }
  const obj = raw as Partial<BackupBlob>;
  if (obj.format !== "insight-backup") {
    throw new Error("File isn't an InSight backup.");
  }
  if (obj.version !== 1) {
    throw new Error(`Backup version ${obj.version} is not supported.`);
  }
  if (!obj.entries || typeof obj.entries !== "object") {
    throw new Error("Backup has no entries.");
  }
  return obj as BackupBlob;
}

// Replace every `insight.*` localStorage key with the backup's
// entries. Returns the count of keys written.
//
// Note: This is destructive. The caller is expected to have
// confirmed with the user first (with a "this overwrites your
// current local data" prompt). After this returns the page should
// be reloaded so every hook re-reads its initial state.
export function applyImport(blob: BackupBlob): number {
  // Remove existing insight.* keys first. Two-pass so we don't
  // mutate localStorage while iterating its length.
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(NAMESPACE)) toRemove.push(key);
  }
  for (const key of toRemove) localStorage.removeItem(key);
  // Write each backup entry.
  let written = 0;
  for (const [key, value] of Object.entries(blob.entries)) {
    if (!key.startsWith(NAMESPACE)) continue; // refuse foreign keys
    if (typeof value !== "string") continue;
    localStorage.setItem(key, value);
    written += 1;
  }
  return written;
}

// Read a File (from <input type="file">) and parse it as a backup.
// Throws if the file isn't valid JSON or the right shape.
export async function readBackupFile(file: File): Promise<BackupBlob> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(
      `Couldn't parse JSON: ${err instanceof Error ? err.message : err}`,
    );
  }
  return validateBackup(parsed);
}
