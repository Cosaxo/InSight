// A memoised loader that does not cache failure.
//
// WHY THIS EXISTS. spec-index's two deferred groups (loadWorldFeed,
// loadOverlays — D25, D48) memoised into a plain module-level variable:
//
//   let worldFeedLoad = null;
//   if (!worldFeedLoad) worldFeedLoad = (async () => { await import(…) })();
//   return worldFeedLoad;
//
// That is correct for the case it was written for — main.jsx starts each
// load once, every opener awaits the same promise, and the mount tests await
// them in beforeAll — but `if (!p)` cannot tell a resolved promise from a
// rejected one. A single failed chunk fetch (a dropped connection on the
// first scroll, a stale asset served after a deploy, a flaky native file
// read) was therefore permanent for the whole session: every later call
// returned the same rejection, so the World feed and all five cross-link
// overlays stayed gone until the user relaunched the app. app-shell's
// openers catch and return, so the symptom was a tap that did nothing.
//
// Dropping the cached promise on rejection is the whole fix. It adds no
// retry loop and no backoff — the caller decides whether to ask again — it
// only stops the first failure from being the last word. The overlays get
// recovery for free, because every one of them is reached through an opener
// that awaits this promise: the second tap re-attempts the import.
//
// The success path is unchanged, and that matters as much as the fix:
// concurrent callers still share one in-flight promise, so this cannot turn
// one deferred group into two parallel downloads.
export function retryable<T>(load: () => Promise<T>): () => Promise<T> {
  let inflight: Promise<T> | null = null;
  return () => {
    if (!inflight) {
      inflight = load().catch((err) => {
        // Cleared BEFORE the rethrow, not in a `finally` and not after it: a
        // caller that catches and retries synchronously must find an empty
        // slot rather than the promise it just saw reject.
        inflight = null;
        throw err;
      });
    }
    return inflight;
  };
}
