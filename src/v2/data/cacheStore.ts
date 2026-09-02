// cacheStore.ts — the hand-rolled caches' IndexedDB home (D312,
// docs/ANSWER-SCALE.md §2.2 with docs/BANK-DELIVERY.md §3).
//
// WHY THIS EXISTS. live.ts used to keep its three fat caches — the
// question bank, the aggregates, the account's own answers — as JSON
// blobs in localStorage, inside a ~5 MB origin quota shared with every
// other `insight.*` key. Two of the three grow with what the account has
// ANSWERED, so an engaged device fills the box while every static gate
// stays green, and a full box fails every store's persistence at once,
// silently (the §2.1 instrument is what reports it). The app already
// keeps Firestore's own mirror in IndexedDB (`persistentLocalCache()`,
// lib/firebaseImpl.ts), so the quota argument for a second, hand-rolled
// store was never real — this module is that store, one database with
// one object store per cache plus a `meta` store for the cursors that
// make the delta fetches work.
//
// PER-ROW, NOT PER-BLOB, and that is the other half of the point: the
// aggregates cache used to be re-serialized WHOLE roughly once a second
// during a vote burst (`saveAggCache`'s coalescing comment priced it),
// a main-thread cost that grew with the archive forever. Rows keyed by
// qid make every write proportional to what changed, never to what is
// held.
//
// BEST-EFFORT BY CONTRACT, exactly like the localStorage shape it
// replaces: an environment with no IndexedDB (or one that will not open)
// reads as empty and swallows writes — the caches are a cost
// optimisation, and hydrate treats a missing cache as "refetch". The one
// exception is clearAll(), which REJECTS on failure, because its callers
// are the purge paths and "the wipe did not happen" must never look like
// success (deleteAccount reports it; the purge listener retries on the
// next purge). Write failures report once per session (`where:
// "cacheStore"`), the §2.1 discipline one box over.
//
// ORDERING. All calls funnel through one open() promise, and promise
// then-queues are FIFO, so transactions are created in call order and
// IndexedDB serializes overlapping-scope transactions in creation order —
// a read issued after a write call therefore sees that write, which is
// what lets cacheVote stay fire-and-forget. Chunked bulk writes put their
// meta row in the LAST transaction on purpose: a process killed mid-write
// leaves rows without a cursor, and every reader treats a missing or
// mismatched meta row as "no cache", so a torn write degrades to a
// refetch instead of to a cache that lies about its own completeness.
//
// THE PURGE. purgeLocalTrace (live.ts) sweeps `insight.*` localStorage
// keys and dispatches `insight:local-purge`; this module hears that event
// and clears every store, so the uid-change path wipes here too — and
// deleteAccount additionally AWAITS clearAll() beside its
// clearIndexedDbPersistence call, because "there is no undo" is a claim
// about a device that may be sold, not about an event that was
// dispatched. Cross-account safety does not rest on the clear alone: the
// answers store carries its owner uid in meta and refuses to load under
// any other, and the bank and aggregates are public content
// (check-purge-listeners.mjs holds the listener in place).

import { reportError } from "../../lib/sentry";

export const CACHE_DB = "insight-cache";
const STORES = ["bank", "aggs", "answers", "meta"] as const;
export type CacheStoreName = Exclude<(typeof STORES)[number], "meta">;

// A hung open must not hold the boot race hostage: hydrate awaits reads
// from here inside initLive's 2.5 s budget, and IndexedDB open is known
// to wedge on rare WebKit versions. Late success after the timeout closes
// itself; the session simply runs uncached, which is the same degradation
// as no IndexedDB at all.
const OPEN_TIMEOUT_MS = 1500;

// Writes are chunked so a 100k-row cold answers import does not build one
// giant transaction; meta rides the last chunk (see ORDERING above).
const WRITE_CHUNK = 4000;

let conn: Promise<IDBDatabase | null> | null = null;
// The resolved connection, held synchronously once open() settles. This
// is not a convenience: the hide-time flush (live.ts's visibilitychange
// handler) is the last work a backgrounded WebView is guaranteed, so its
// transaction must be OPEN before that handler returns — and an await
// between the handler and db.transaction() puts a microtask boundary in
// exactly the window the flush exists to beat. write() takes the sync
// path whenever this is set; everything before first open settles keeps
// the promise path.
let ready: IDBDatabase | null = null;
let writeFailures = 0;
let writeReported = false;

/** Swallowed IndexedDB write failures this session — LIVE.stats merges it
 * beside the localStorage counter so the two boxes read side by side. */
export function cacheStoreFailures(): number {
  return writeFailures;
}

function open(): Promise<IDBDatabase | null> {
  if (conn) return conn;
  conn = new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") {
        resolve(null);
        return;
      }
      let settled = false;
      const settle = (db: IDBDatabase | null) => {
        if (settled) {
          db?.close();
          return;
        }
        settled = true;
        if (db) ready = db;
        resolve(db);
      };
      setTimeout(() => settle(null), OPEN_TIMEOUT_MS);
      const req = indexedDB.open(CACHE_DB, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const s of STORES) {
          if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
        }
      };
      req.onsuccess = () => settle(req.result);
      req.onerror = () => settle(null);
    } catch {
      resolve(null);
    }
  });
  return conn;
}

function noteWriteFailure(err: unknown): void {
  writeFailures += 1;
  if (!writeReported) {
    writeReported = true;
    reportError(err instanceof Error ? err : new Error(String(err)), { where: "cacheStore" });
  }
}

/** One transaction, resolved on complete. Best-effort: a failure reports
 * (once per session) and resolves, so no caller has to guard a cache. */
function tx(
  db: IDBDatabase,
  scope: string[],
  body: (t: IDBTransaction) => void,
): Promise<void> {
  return new Promise((resolve) => {
    try {
      const t = db.transaction(scope, "readwrite");
      t.oncomplete = () => resolve();
      t.onabort = () => {
        noteWriteFailure(t.error ?? new Error("cacheStore transaction aborted"));
        resolve();
      };
      t.onerror = () => {
        /* onabort follows and settles */
      };
      body(t);
    } catch (err) {
      // A synchronous throw (DataCloneError on an unclonable value, a
      // deleted store) is a write failure like any other.
      noteWriteFailure(err);
      resolve();
    }
  });
}

/** Every row of one store, keyed — ascending key order, which is also the
 * order getAllKeys/getAll both use, so the zip below cannot misalign. */
export async function readAll<T>(store: CacheStoreName): Promise<Map<string, T>> {
  const out = new Map<string, T>();
  const db = await open();
  if (!db) return out;
  return new Promise((resolve) => {
    try {
      const t = db.transaction(store, "readonly");
      const s = t.objectStore(store);
      const keysReq = s.getAllKeys();
      const valsReq = s.getAll();
      t.oncomplete = () => {
        const keys = keysReq.result;
        const vals = valsReq.result;
        for (let i = 0; i < keys.length; i++) out.set(String(keys[i]), vals[i] as T);
        resolve(out);
      };
      t.onabort = () => resolve(out);
      t.onerror = () => {
        /* onabort follows */
      };
    } catch {
      resolve(out);
    }
  });
}

/** One row of the meta store, or null — cursors, revisions, owners. */
export async function readMeta<T>(key: string): Promise<T | null> {
  const db = await open();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const t = db.transaction("meta", "readonly");
      const req = t.objectStore("meta").get(key);
      t.oncomplete = () => resolve(req.result === undefined ? null : (req.result as T));
      t.onabort = () => resolve(null);
      t.onerror = () => {
        /* onabort follows */
      };
    } catch {
      resolve(null);
    }
  });
}

export interface WriteOpts {
  /** Meta rows committed in the LAST chunk (crash safety — see header). */
  meta?: Array<[string, unknown]>;
  /** Clear the store first, in the same transaction as the first chunk —
   * the full-rewrite shape (a cold fetch, a legacy import). */
  clearFirst?: boolean;
}

/** Put rows (and optionally meta) into one store. Chunked past
 * WRITE_CHUNK; within a chunk it is one atomic transaction. Once the
 * connection is open the first transaction is created SYNCHRONOUSLY
 * inside this call — the hide-flush guarantee (see `ready` above). */
export function write(
  store: CacheStoreName,
  rows: Array<[string, unknown]>,
  opts: WriteOpts = {},
): Promise<void> {
  if (ready) return writeTo(ready, store, rows, opts);
  return open().then((db) => (db ? writeTo(db, store, rows, opts) : undefined));
}

async function writeTo(
  db: IDBDatabase,
  store: CacheStoreName,
  rows: Array<[string, unknown]>,
  opts: WriteOpts,
): Promise<void> {
  const chunks: Array<Array<[string, unknown]>> = [];
  for (let i = 0; i < rows.length; i += WRITE_CHUNK) chunks.push(rows.slice(i, i + WRITE_CHUNK));
  if (!chunks.length) chunks.push([]);
  for (let i = 0; i < chunks.length; i++) {
    const first = i === 0;
    const last = i === chunks.length - 1;
    const scope = last && opts.meta?.length ? [store, "meta"] : [store];
    await tx(db, scope, (t) => {
      const s = t.objectStore(store);
      if (first && opts.clearFirst) s.clear();
      for (const [k, v] of chunks[i]) s.put(v, k);
      if (last && opts.meta?.length) {
        const m = t.objectStore("meta");
        for (const [k, v] of opts.meta) m.put(v, k);
      }
    });
  }
}

/** Meta only — the aggregate-recheck stamps and their kind. */
export function writeMeta(key: string, value: unknown): Promise<void> {
  return write("bank", [], { meta: [[key, value]] });
}

/** Empty every store. REJECTS on failure — the callers are the purge
 * paths, where a wipe that did not happen must never read as one. */
export async function clearAll(): Promise<void> {
  // No IndexedDB in this environment is the ONE honest early return: there
  // is no database, so there is nothing that failed to be wiped. It is
  // also the case cacheStore.test.ts pins — no count, no report.
  if (typeof indexedDB === "undefined") return;
  const db = await open();
  if (!db) {
    // …but open() returns null for three other reasons, and they are not
    // that one: the open request errored, it timed out, or the accessor
    // threw (a browser set to block site data). In every one of those the
    // database can exist and hold answers, and returning here reported a
    // wipe that never happened — precisely what the contract above forbids,
    // on precisely the paths where it matters (account delete, uid change).
    //
    // Deleting the database outright needs no usable connection, so it is
    // the fallback that can still tell the truth. On a device that never
    // wrote anything it succeeds quietly rather than inventing a failure.
    return new Promise((resolve, reject) => {
      try {
        const req = indexedDB.deleteDatabase(CACHE_DB);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error ?? new Error("cacheStore deleteDatabase failed"));
        // BLOCKED IS NOT SUCCESS. Another tab still holds a connection, so
        // the delete is queued, not done — and this call cannot honestly
        // say it happened. Loud, for the same reason the rest of this
        // function is; the purge paths retry and deleteAccount awaits.
        req.onblocked = () => reject(new Error("cacheStore deleteDatabase blocked"));
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }
  return new Promise((resolve, reject) => {
    try {
      const t = db.transaction([...STORES], "readwrite");
      for (const s of STORES) t.objectStore(s).clear();
      t.oncomplete = () => resolve();
      t.onabort = () => reject(t.error ?? new Error("cacheStore clear aborted"));
      t.onerror = () => {
        /* onabort follows */
      };
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

// The uid-change half of the wipe (D51's event) — deleteAccount also
// awaits clearAll() directly, so this listener is the path for purges
// with no awaiter. Swallowed here because there is no caller to hand the
// rejection to; the next purge (or the account delete) retries.
if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("insight:local-purge", () => {
    void clearAll().catch(() => {
      /* best-effort on this path — deleteAccount's own await is the loud one */
    });
  });
}
