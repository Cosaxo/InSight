// @vitest-environment jsdom
//
// usePeopleFinder's own contract, tested at the hook rather than through a
// panel — because the failure this pins is invisible from LivePeopleSearch.
// That component hides its whole section on an empty query, so the flag
// being stuck reads as "the section closed"; LdAddByHandle
// (LiveDuelPanel.tsx) keeps its field mounted whatever is typed and draws
// `{busy && !rows.length && <div role="status">Looking…</div>}`
// unconditionally, which is where a stranded flag becomes a permanent
// "Looking…" under an empty box, announced to a screen reader.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor, act } from "@testing-library/react";

const LIVE = vi.hoisted(() => ({
  loadNames: vi.fn(async (uids: readonly string[]) => { void uids; }),
  nameFor: (uid: string) => ({ u_ada: "Ada Lovelace" }[uid] || ""),
  social: {
    whoIs: vi.fn(async (h: string) => { void h; return null as string | null; }),
    searchPeople: vi.fn(async (q: string) => {
      void q;
      return [] as Array<{ uid: string; name: string; handle: string }>;
    }),
  },
}));
vi.mock("../data/live", () => ({ default: LIVE }));

const { usePeopleFinder } = await import("./peopleSearch");

beforeEach(() => {
  LIVE.social.whoIs = vi.fn(async () => null);
  LIVE.social.searchPeople = vi.fn(async () => []);
  LIVE.loadNames = vi.fn(async () => {});
});
afterEach(cleanup);

describe("usePeopleFinder · the busy flag", () => {
  it("lowers busy when the query is cleared mid-lookup", async () => {
    // A lookup that never settles on its own, so the clear lands strictly
    // inside the in-flight window — which is a real network round trip
    // here: searchPeople does a dynamic import plus a Firestore prefix
    // query on a cold key.
    let release: (v: Array<{ uid: string; name: string; handle: string }>) => void = () => {};
    LIVE.social.searchPeople = vi.fn(
      () => new Promise<Array<{ uid: string; name: string; handle: string }>>((r) => { release = r; }),
    );

    const { result, rerender } = renderHook(({ q }) => usePeopleFinder(q), {
      initialProps: { q: "ada" },
    });
    // The debounce has to elapse before the flag is raised at all.
    await waitFor(() => { expect(result.current.busy).toBe(true); });

    rerender({ q: "" });
    // THE ASSERTION. `busy` is raised inside the debounce timer and
    // lowered in the lookup's `finally` under `if (live)` — and the
    // effect cleanup sets `live = false` for the run it supersedes, which
    // is exactly what stops that `finally` from firing. The empty-query
    // exit starts no replacement lookup, so it is the only path where
    // nothing else is left to lower the flag.
    await waitFor(() => { expect(result.current.busy).toBe(false); });

    // …and the abandoned lookup landing afterwards changes nothing.
    await act(async () => { release([{ uid: "u_ada", name: "Ada Lovelace", handle: "ada" }]); });
    expect(result.current.busy).toBe(false);
    expect(result.current.rows).toEqual([]);
  });

  it("does not blink busy off between two non-empty queries", async () => {
    // The other half, and the reason the fix is one line rather than an
    // unconditional reset: a supersede by a non-empty query has its own
    // run to lower the flag, and clearing it here would flicker the
    // spinner once per keystroke.
    LIVE.social.searchPeople = vi.fn(() => new Promise<never[]>(() => {}));
    const { result, rerender } = renderHook(({ q }) => usePeopleFinder(q), {
      initialProps: { q: "ad" },
    });
    await waitFor(() => { expect(result.current.busy).toBe(true); });
    rerender({ q: "ada" });
    expect(result.current.busy).toBe(true);
  });
});
