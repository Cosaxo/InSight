// Small type-safe wrapper around localStorage with graceful SSR fallback.
// In production this could be swapped for a Firestore-backed driver without
// changing the call sites.

const KEY = "insight.v1";

// Persisted state is intentionally untyped on the way in — it may come from
// an older version of the schema. Consumers narrow it with their own types.
export interface PersistedState {
  personality?: number[];
  political?: { econ: number; social: number };
  cv?: { indiv: number; change: number };
  media?: unknown;
  likes?: string[];
  dislikes?: string[];
  heroes?: { name: string; role: string; reason: string }[];
  relations?: unknown;
  cityRatings?: unknown;
  moods?: unknown;
  habits?: unknown;
  workouts?: unknown;
  meals?: unknown;
  transactions?: unknown;
}

function hasStorage(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

export function loadState(): PersistedState {
  if (!hasStorage()) return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PersistedState) : {};
  } catch {
    return {};
  }
}

export function saveState(patch: Partial<PersistedState>): void {
  if (!hasStorage()) return;
  try {
    const current = loadState();
    const next = { ...current, ...patch };
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore — storage full or disabled
  }
}
