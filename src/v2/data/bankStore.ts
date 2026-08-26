// bankStore.ts — the question-bank cache, out of the small box (D315,
// building D313 phase 1; BANK-DELIVERY §3 as-built).
//
// live.ts used to keep the whole bank in localStorage under
// `insight.bankCache.v2`, which put a ~5 MB origin quota — shared with
// every other `insight.*` key — between the bank and its own growth, and
// the write swallowed quota failures, so crossing the box did not break
// anything: it silently stopped caching and every boot then paid a full
// bank fetch forever. IndexedDB is a store the app already leans on
// (Firestore's persistentLocalCache lives there), its budget is measured
// in hundreds of MB rather than five, and it takes the payload as a
// structured clone — no stringify of the whole bank on the boot path.
//
// The API is the shape hydrate() already speaks: one payload, get and
// put, null/no-op on ANY failure. A missing or broken store must read as
// "no cache" (refetch — correct but slow), never as an error a boot can
// die on. That contract is what made the localStorage version survivable,
// and it carries over unchanged; what changed is that the failure this
// swallows is no longer a fixed quota the bank was certain to grow into.

const DB_NAME = "insight-bank";
const STORE = "bank";
const KEY = "cache";
// Where the cache lived until D315. Read once as a migration source — so
// an updating device pays a delta fetch, not a full one — and removed
// only when the new store is known to work, because freeing the small box
// is half the point and stranding a device with no cache at all is not.
const LEGACY_LS = "insight.bankCache.v2";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      // One object store, one row. The payload versions itself — live.ts
      // checks `rev` and shape — so IDB's schema version stays at 1.
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    // Another tab holding an old version open. Treated as "no cache"
    // rather than waited on: the boot path must never block on a tab the
    // user forgot about.
    req.onblocked = () => reject(new Error("bank store blocked"));
  });
}

export async function bankGet(): Promise<unknown> {
  try {
    if (typeof indexedDB === "undefined") return legacyRead(false);
    const db = await openDb();
    try {
      const row = await new Promise<unknown>((resolve, reject) => {
        const req = db.transaction(STORE, "readonly").objectStore(STORE).get(KEY);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      if (row != null) return row;
    } finally {
      db.close();
    }
    // The store works and is empty: this is the one moment migration is
    // safe, so the legacy copy is consumed — returned for this boot (the
    // put in hydrate re-homes it) and removed from the box.
    return legacyRead(true);
  } catch {
    // IndexedDB itself failed. Fall back to reading the legacy copy
    // WITHOUT removing it — on a device where the new store never works,
    // a stale-but-delta-able localStorage cache still beats a full fetch
    // every boot.
    return legacyRead(false);
  }
}

function legacyRead(consume: boolean): unknown {
  try {
    const raw = localStorage.getItem(LEGACY_LS);
    if (raw == null) return null;
    if (consume) localStorage.removeItem(LEGACY_LS);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function bankPut(payload: unknown): Promise<void> {
  try {
    if (typeof indexedDB === "undefined") return;
    const db = await openDb();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(payload, KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  } catch {
    // Best-effort, the same contract the localStorage write had. The
    // next boot refetches, which costs money and no correctness.
  }
}
