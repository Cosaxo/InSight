// @vitest-environment jsdom
//
// LiveTakesPanel draws the circle's takes and the report control. Three of
// its behaviours look like styling choices and are actually consequences of
// firestore.rules, which means they can be "tidied" away by someone reading
// only this file. That is what these assert:
//
//   1. Reporting takes TWO taps. `v2_flags` is `allow update, delete: if
//      false` — a cast flag cannot be withdrawn by the reporter, the author
//      or a moderator. A one-tap control over an irreversible write turns a
//      misplaced thumb into a permanent record.
//   2. There is NO reason picker, unlike the demo's four chips. The create
//      rule is `hasOnly(["takeId", "gid", "uid", "at"])`, so a reason has no
//      field to live in, and the moderation run picks its own policy line
//      from the take's text. A picker would discard its answer on send.
//   3. A reported take STAYS in the list. Flags are `allow read: if false`,
//      so a local hide has nothing to rehydrate from and would reappear on
//      the next load; hiding is the moderator's verdict to make.
//
// Plus the copy: even under enforcement (MOD_ADVISORY=false, D83) the
// control promises review, never removal — that is the verdict's to say.
//
// `../data/live` is mocked rather than booted — it imports Firebase, and
// what this panel consumes is one flag, one uid, and the social surface.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

interface TakeLite {
  id: string; gid: string; authorUid: string; qid: string;
  text: string; createdAt: number; hidden: boolean;
}

const LIVE = vi.hoisted(() => ({
  enabled: true,
  uid: "u_me",
  budgetPaused: false as boolean,
  subscribe: () => () => {},
  // D98: world takes are named, resolved through the shared uid → name
  // cache. "u_other" is deliberately absent so the unnamed fallback is
  // reachable in the same fixture.
  nameFor: (uid: string) => (uid === "u_me" ? "Me" : uid === "u_named" ? "Ada" : ""),
  loadNames: vi.fn(async () => {}),
  // The side join (D149): a take's author wears the option they answered
  // with, read off the voter list rather than off the take document.
  loadVoters: vi.fn(async () => {}),
  voterList: null as Array<{ uid: string; optionIdx: number }> | null,
  voters(qid: string) { void qid; return this.voterList; },
  social: {
    takeList: [] as TakeLite[],
    flags: {} as Record<string, boolean>,
    takes(gid: string, qid?: string) {
      void gid;
      return this.takeList.filter((t) => !qid || t.qid === qid);
    },
    /** Settled by default: every case below is about a list that HAS been
     *  read, and the reading arm is asserted by the two cases that set
     *  this true. */
    reading: false,
    takesLoading(this: { reading: boolean }) { return this.reading; },
    loadTakes: vi.fn(async () => {}),
    postTake: vi.fn(async () => "t_new"),
    deleteTake: vi.fn(async () => {}),
    flagTake: vi.fn(async function (this: { flags: Record<string, boolean> }, gid: string, id: string) {
      void gid;
      this.flags[id] = true;
    }),
    flagged(id: string) { return !!this.flags[id]; },
    groups: () => [{ id: "g1", memberNames: { u_me: "Me", u_other: "Ada" } }],
  },
}));
vi.mock("../data/live", () => ({ default: LIVE, TAKE_MAX_CHARS: 280 }));

const { default: LiveTakesPanel } = await import("./LiveTakesPanel");

const take = (id: string, authorUid: string, text: string): TakeLite => ({
  id, gid: "g1", authorUid, qid: "q1", text, createdAt: Date.now() - 60000, hidden: false,
});

beforeEach(() => {
  LIVE.enabled = true;
  LIVE.uid = "u_me";
  LIVE.budgetPaused = false;
  LIVE.social.takeList = [take("t1", "u_other", "Someone else's take")];
  LIVE.voterList = null;
  LIVE.loadVoters.mockClear();
  LIVE.loadNames.mockClear();
  LIVE.social.flags = {};
  LIVE.social.reading = false;
  LIVE.social.loadTakes.mockClear();
  LIVE.social.postTake.mockClear();
  LIVE.social.deleteTake.mockClear();
  LIVE.social.flagTake.mockClear();
});
afterEach(cleanup);

const panel = () => render(<LiveTakesPanel gid="g1" qid="q1" />);

describe("the report control is two-step, because the flag cannot be undone", () => {
  it("does not write a flag on the first tap", () => {
    panel();
    fireEvent.click(screen.getByText("Report"));

    // The confirm appeared, and nothing was sent yet. `allow update,
    // delete: if false` — there is no taking this back.
    expect(LIVE.social.flagTake).not.toHaveBeenCalled();
    expect(screen.getByText(/No undo/i)).toBeTruthy();
  });

  it("sends only after the confirm, and marks the take reported", async () => {
    panel();
    fireEvent.click(screen.getByText("Report"));
    // Two controls read "Report" once the confirm is open; the second is
    // the one inside it.
    const buttons = screen.getAllByText(/^Report$/);
    fireEvent.click(buttons[buttons.length - 1]);

    await waitFor(() => {
      expect(LIVE.social.flagTake).toHaveBeenCalledWith("g1", "t1");
    });
    await waitFor(() => {
      expect(screen.getByText("Reported")).toBeTruthy();
    });
  });

  it("lets Cancel out without sending", () => {
    panel();
    fireEvent.click(screen.getByText("Report"));
    fireEvent.click(screen.getByText("Cancel"));

    expect(LIVE.social.flagTake).not.toHaveBeenCalled();
    expect(screen.queryByText(/cannot undo/i)).toBeNull();
  });
});

describe("what the control deliberately does not have", () => {
  it("offers no reason picker — the flag document has no field for one", () => {
    panel();
    fireEvent.click(screen.getByText("Report"));

    // The demo's four chips (world-feed-report.js). None of them can be
    // sent: the create rule is hasOnly(["takeId","gid","uid","at"]).
    for (const reason of ["Abuse or hate", "Harassment", "Spam", "Misleading"]) {
      expect(screen.queryByText(reason)).toBeNull();
    }
  });

  it("does not promise removal, because MOD_ADVISORY hides nothing today", () => {
    panel();
    fireEvent.click(screen.getByText("Report"));

    const copy = screen.getByText(/A moderator reviews it/i).textContent || "";
    expect(copy).not.toMatch(/will be removed|we'll remove|taken down/i);
  });

  it("keeps a reported take on screen rather than tombstoning it", async () => {
    panel();
    fireEvent.click(screen.getByText("Report"));
    const buttons = screen.getAllByText(/^Report$/);
    fireEvent.click(buttons[buttons.length - 1]);

    await waitFor(() => {
      expect(screen.getByText("Reported")).toBeTruthy();
    });
    // Flags are unreadable, so a local hide could not survive a reload —
    // and the soft-hide belongs to the moderator's verdict.
    expect(screen.getByText("Someone else's take")).toBeTruthy();
  });
});

describe("your own take", () => {
  it("offers Delete instead of Report — the delete rule gates on authorUid", () => {
    LIVE.social.takeList = [take("t9", "u_me", "Mine")];
    panel();

    expect(screen.getByText("Delete")).toBeTruthy();
    expect(screen.queryByText("Report")).toBeNull();
  });

  it("deletes through the store", async () => {
    LIVE.social.takeList = [take("t9", "u_me", "Mine")];
    panel();
    fireEvent.click(screen.getByText("Delete"));

    await waitFor(() => {
      expect(LIVE.social.deleteTake).toHaveBeenCalledWith("g1", "t9");
    });
  });
});

describe("the composer", () => {
  it("posts a take and clears the field", async () => {
    panel();
    const input = screen.getByLabelText("Add your take") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "  my take  " } });
    fireEvent.click(screen.getByText("Post"));

    await waitFor(() => {
      expect(LIVE.social.postTake).toHaveBeenCalledWith("g1", "q1", "my take");
    });
    await waitFor(() => {
      expect(input.value).toBe("");
    });
  });

  it("caps typing at the rule's 280", () => {
    panel();
    const input = screen.getByLabelText("Add your take") as HTMLInputElement;
    expect(input.maxLength).toBe(280);
  });

  it("does not send an empty take", () => {
    panel();
    fireEvent.change(screen.getByLabelText("Add your take"), { target: { value: "   " } });
    fireEvent.click(screen.getByText("Post"));

    expect(LIVE.social.postTake).not.toHaveBeenCalled();
  });
});

describe("the surfaces around the list", () => {
  it("names a departed member 'Member' rather than inventing one", () => {
    LIVE.social.takeList = [take("t5", "u_gone", "From someone who left")];
    panel();

    expect(screen.getByText("Member")).toBeTruthy();
  });

  it("renders nothing when live mode is off — there is no demo fallback here", () => {
    LIVE.enabled = false;
    const { container } = panel();

    expect(container.textContent).toBe("");
  });

  it("surfaces a refused flag instead of leaving it looking sent", async () => {
    LIVE.social.flagTake.mockRejectedValueOnce(new Error("permission-denied"));
    panel();
    fireEvent.click(screen.getByText("Report"));
    const buttons = screen.getAllByText(/^Report$/);
    fireEvent.click(buttons[buttons.length - 1]);

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toMatch(/didn’t send/i);
    });
    expect(screen.queryByText("Reported")).toBeNull();
  });
});

// ── the world scope (D83) ────────────────────────────────────────────
//
// Same panel, sentinel gid "world". What changes is exactly what D78
// part 2 demanded: no author names anywhere, one take per person per
// question (the composer folds when yours exists — the doc id enforces
// it server-side), and the mute control guideline 1.2 expects a
// world-scale UGC surface to carry. The mute store is REAL here
// (data/mutes.ts over jsdom localStorage) — muting is the one behaviour
// with cross-render persistence worth executing rather than mocking.

const wtake = (id: string, authorUid: string, text: string): TakeLite => ({
  id, gid: "world", authorUid, qid: "q1", text, createdAt: Date.now() - 60000, hidden: false,
});
const worldPanel = () => render(<LiveTakesPanel gid="world" qid="q1" />);

describe("world takes are named (D98)", () => {
  beforeEach(() => { localStorage.clear(); });

  it("prints the author's name, resolved through the shared cache", () => {
    // The inverse of the case that stood here, which asserted the world
    // panel must NOT consult any name source. D98 reversed that: the
    // anonymity was a client-side string all along, since `authorUid` has
    // been on the take document and readable throughout.
    //
    // Note the name comes from LIVE.nameFor — the shared uid → name cache
    // the who-voted read fills — and NOT from the groups map, which knows
    // only circle members and would name nobody at world scale.
    LIVE.social.takeList = [wtake("w1", "u_named", "A stranger's words")];
    worldPanel();

    expect(screen.getByText(/posted under your name/i)).toBeTruthy();
    expect(screen.getByText("Ada")).toBeTruthy();
    expect(screen.queryByText("Someone")).toBeNull();
  });

  it("falls back to Someone for an account with no display name", () => {
    // Absence of a name, not a pseudonym: D1 survives D98, so nothing is
    // invented to fill the gap — not the uid, not a generated handle.
    LIVE.social.takeList = [wtake("w1", "u_nameless", "Anonymous by omission")];
    worldPanel();

    expect(screen.getByText("Someone")).toBeTruthy();
    expect(screen.queryByText(/u_nameless/)).toBeNull();
  });

  it("asks for the author names it does not already hold", () => {
    // The cost shape: batched, once, and only for world scope — a circle
    // reads its names off the group document and must not pay for this.
    LIVE.loadNames.mockClear();
    LIVE.social.takeList = [wtake("w1", "u_named", "hello")];
    worldPanel();
    expect(LIVE.loadNames).toHaveBeenCalledWith(["u_named"]);
  });

  it("passes the question through to loadTakes — the world query is per-qid", () => {
    worldPanel();
    expect(LIVE.social.loadTakes).toHaveBeenCalledWith("world", "q1");
  });

  it("folds the composer once your take exists — one take per question", () => {
    LIVE.social.takeList = [wtake("q1_u_me", "u_me", "Mine already")];
    worldPanel();

    expect(screen.getByText("You")).toBeTruthy();
    expect(screen.queryByLabelText(/Add your take/i)).toBeNull();
    expect(screen.getByText(/One take each/i)).toBeTruthy();
    // Delete stays: withdraw-and-rewrite is the only edit path.
    expect(screen.getByText("Delete")).toBeTruthy();
  });
});

describe("the world mute control (guideline 1.2's block)", () => {
  beforeEach(() => { localStorage.clear(); });

  it("is two-step, world-only, and never offered on your own take", () => {
    LIVE.social.takeList = [wtake("w1", "u_other", "Gratingly loud")];
    worldPanel();
    // First tap opens the confirm; nothing is hidden yet.
    fireEvent.click(screen.getByText("Hide author"));
    expect(screen.getByText("Gratingly loud")).toBeTruthy();
    cleanup();

    // A circle panel carries no mute — membership and Leave are its exits.
    LIVE.social.takeList = [take("t1", "u_other", "Circle words")];
    panel();
    expect(screen.queryByText("Hide author")).toBeNull();
    cleanup();

    LIVE.social.takeList = [wtake("q1_u_me", "u_me", "Mine")];
    worldPanel();
    expect(screen.queryByText("Hide author")).toBeNull();
  });

  it("confirmed, it hides the author's takes and the choice survives a remount", () => {
    LIVE.social.takeList = [
      wtake("w1", "u_loud", "Gratingly loud"),
      wtake("w2", "u_other", "Perfectly fine"),
    ];
    worldPanel();
    // Two rows, two controls — the loud author's row renders first.
    fireEvent.click(screen.getAllByText("Hide author")[0]);
    // The confirm names the trade: local, silent, no unhide surface yet.
    expect(screen.getByText(/on this device/i)).toBeTruthy();
    fireEvent.click(screen.getByText("Hide"));

    expect(screen.queryByText("Gratingly loud")).toBeNull();
    expect(screen.getByText("Perfectly fine")).toBeTruthy();
    cleanup();

    // The store is real: a fresh mount reads the same localStorage.
    worldPanel();
    expect(screen.queryByText("Gratingly loud")).toBeNull();
    expect(screen.getByText("Perfectly fine")).toBeTruthy();
  });
});

// ── which side is talking (D149) ─────────────────────────────────────
//
// A take is an argument, and an argument reads completely differently once
// you know which way the person making it voted. The panel had no idea:
// every row was a name and a paragraph, in one undifferentiated column, on
// a screen whose entire subject is that people disagree.
//
// The side does NOT come from the take document — `v2_takes` accepts a
// fixed field list and carries no vote — but from the author's own answer,
// through the collection-group read the who-voted sheet already uses. So
// the badge cannot disagree with the split above it, and it costs nothing
// on a question whose voters are already in the store.
describe("a take carries the side its author voted", () => {
  const OPTS = ["Champions League final", "Super Bowl"];
  const sidePanel = () => render(<LiveTakesPanel gid="world" qid="q1" options={OPTS} />);

  it("badges each author with the option they picked", () => {
    LIVE.social.takeList = [
      wtake("w1", "u_named", "90 minutes of flow."),
      wtake("w2", "u_me", "The halftime show alone."),
    ];
    LIVE.voterList = [
      { uid: "u_named", optionIdx: 0 },
      { uid: "u_me", optionIdx: 1 },
    ];
    sidePanel();
    expect(screen.getAllByText("Champions League final").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Super Bowl").length).toBeGreaterThan(0);
  });

  it("badges nobody when the caller has no options to badge with", () => {
    // A dial, a field, a catalogue pick and a sealed duel row all reach
    // this panel. None of them has sides, and none of them should pay for
    // a voter read to find that out.
    LIVE.social.takeList = [wtake("w1", "u_named", "words")];
    LIVE.voterList = [{ uid: "u_named", optionIdx: 0 }];
    render(<LiveTakesPanel gid="world" qid="q1" />);
    expect(LIVE.loadVoters).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /^All/ })).toBeNull();
  });

  it("leaves an author with no answer unbadged rather than guessing one", () => {
    LIVE.social.takeList = [wtake("w1", "u_named", "words")];
    LIVE.voterList = [];
    sidePanel();
    expect(screen.getByText("words")).toBeTruthy();
    expect(screen.queryByText("Champions League final")).toBeNull();
    expect(screen.queryByText("Super Bowl")).toBeNull();
  });

  it("does not re-resolve names the voter read already resolved", () => {
    // loadVoters resolves a display name for everyone who answered. Asking
    // loadNames for those same uids is a second profile read of the same
    // documents on every first open.
    LIVE.social.takeList = [wtake("w1", "u_named", "words")];
    LIVE.voterList = [{ uid: "u_named", optionIdx: 0 }];
    sidePanel();
    expect(LIVE.loadNames).not.toHaveBeenCalled();
  });
});

describe("a list still being read is not an empty room", () => {
  // `takes()` answers [] for three different things — never fetched, in
  // flight, and genuinely nothing written. The panel branched on length
  // alone, so it printed "No takes yet. Say the first thing." over a query
  // still running — and kept printing it for the life of that mount after
  // a FAILED fetch, because loadTakes' catch deliberately leaves the key
  // absent so a later open retries rather than caching an empty list.
  //
  // Same defect the Compare lens and the Near field were fixed for, on the
  // surface where the sentence is an invitation: "say the first thing" to
  // someone whose circle may already have said several.
  it("says it is reading rather than that nobody has written", () => {
    LIVE.social.takeList = [];
    LIVE.social.reading = true;
    panel();
    expect(screen.getByText(/Reading the room/)).toBeTruthy();
    expect(screen.queryByText(/Say the first thing/),
      "an unread list was called an empty one").toBeNull();
  });

  it("says the room is empty once it really has been read", () => {
    // The control: the reading arm must not swallow the true empty state,
    // which is the one the composer's invitation belongs to.
    LIVE.social.takeList = [];
    LIVE.social.reading = false;
    panel();
    expect(screen.getByText(/Say the first thing/)).toBeTruthy();
  });

  it("keeps the paused sentence in front of the reading one", () => {
    // The breaker's state is true whatever the query would have found, so
    // it stays the outermost arm.
    LIVE.social.takeList = [];
    LIVE.social.reading = true;
    LIVE.budgetPaused = true;
    panel();
    expect(screen.queryByText(/Reading the room/)).toBeNull();
  });
});

describe("the side filter", () => {
  const OPTS = ["Champions League final", "Super Bowl"];
  const sidePanel = () => render(<LiveTakesPanel gid="world" qid="q1" options={OPTS} />);

  beforeEach(() => {
    LIVE.social.takeList = [
      wtake("w1", "u_named", "Ninety minutes of flow."),
      wtake("w2", "u_other", "The halftime show alone."),
    ];
    LIVE.voterList = [
      { uid: "u_named", optionIdx: 0 },
      { uid: "u_other", optionIdx: 1 },
    ];
  });

  it("shows every take until a side is picked, then only that side's", () => {
    sidePanel();
    expect(screen.getByText("Ninety minutes of flow.")).toBeTruthy();
    expect(screen.getByText("The halftime show alone.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^Super Bowl/ }));
    expect(screen.queryByText("Ninety minutes of flow.")).toBeNull();
    expect(screen.getByText("The halftime show alone.")).toBeTruthy();
  });

  it("carries each side's count, so an empty side is visible before the tap", () => {
    sidePanel();
    expect(screen.getByRole("button", { name: "All · 2" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Champions League final · 1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Super Bowl · 1" })).toBeTruthy();
  });

  it("says how many takes the chips cannot account for", async () => {
    // Sides come from the voter list, which is the newest VOTER_FETCH_CAP
    // answers; takes come from their own page. An author who answered
    // outside that window has no side, so they count in "All" and in none
    // of the chips — "All · 3 · Champions League final · 1 · Super Bowl ·
    // 1" with no word about the third. The sibling panel in this same
    // sheet says exactly this about its own bound, twice.
    LIVE.social.takeList = [
      wtake("w1", "u_named", "Ninety minutes of flow."),
      wtake("w2", "u_me", "The halftime show alone."),
      wtake("w3", "u_older", "Answered a long time ago."),
    ];
    LIVE.voterList = [
      { uid: "u_named", optionIdx: 0 },
      { uid: "u_me", optionIdx: 1 },
    ];
    sidePanel();
    expect(screen.getByRole("button", { name: "All · 3" })).toBeTruthy();
    expect(screen.getByText(/1 of these was written by someone whose answer is outside the newest/))
      .toBeTruthy();
  });

  it("says nothing when every take has a side — the control", () => {
    // A complete row stays a row of chips. Without this, printing the
    // sentence unconditionally passes the case above and puts a caveat
    // under every question in the app.
    sidePanel();
    expect(screen.getByRole("button", { name: "All · 2" })).toBeTruthy();
    expect(screen.queryByText(/outside the newest/)).toBeNull();
  });

  it("tapping the open side again returns to All", () => {
    sidePanel();
    const sb = () => screen.getByRole("button", { name: /^Super Bowl/ });
    fireEvent.click(sb());
    expect(screen.queryByText("Ninety minutes of flow.")).toBeNull();
    fireEvent.click(sb());
    expect(screen.getByText("Ninety minutes of flow.")).toBeTruthy();
  });

  it("says PAUSED for an unloaded list under the read breaker (D332)", () => {
    // The store's takes never loaded (the breaker refused the query), so
    // the list is empty for a reason that is not "nobody wrote" — and
    // "say the first thing" would present a withheld room as a blank one.
    // The composer stays: writing still works, and a posted take echoes
    // locally.
    LIVE.budgetPaused = true;
    LIVE.social.takeList = [];
    panel();
    expect(screen.getByText(/costs in check/i)).toBeTruthy();
    expect(screen.queryByText(/say the first thing/i)).toBeNull();
    expect(screen.getByPlaceholderText("Add your take…")).toBeTruthy();
  });

  it("names the side when its filter is empty, not the whole panel", () => {
    // "No takes yet. Say the first thing." under a side filter is a lie
    // about the question — there are takes, just not on this side.
    LIVE.social.takeList = [wtake("w1", "u_named", "Ninety minutes of flow.")];
    LIVE.voterList = [{ uid: "u_named", optionIdx: 0 }];
    sidePanel();
    fireEvent.click(screen.getByRole("button", { name: /^Super Bowl/ }));
    expect(screen.getByText(/nobody who picked Super Bowl has written a take/i)).toBeTruthy();
    expect(screen.queryByText(/say the first thing/i)).toBeNull();
  });

  it("hides the row until a side is actually known for somebody", () => {
    // Before the voter read lands every chip would read 0 — a filter over
    // a list the panel cannot yet sort.
    LIVE.voterList = null;
    sidePanel();
    expect(screen.queryByRole("button", { name: /^All/ })).toBeNull();
  });

  it("keeps the one-take-per-question rule measured on the whole list", () => {
    // Your own take hidden by a side filter must not re-offer a composer
    // the rules will bounce.
    LIVE.social.takeList = [
      wtake("q1_u_me", "u_me", "Mine"),
      wtake("w2", "u_other", "Theirs"),
    ];
    LIVE.voterList = [
      { uid: "u_me", optionIdx: 0 },
      { uid: "u_other", optionIdx: 1 },
    ];
    sidePanel();
    fireEvent.click(screen.getByRole("button", { name: /^Super Bowl/ }));
    expect(screen.queryByText("Mine")).toBeNull();
    expect(screen.getByText(/one take each/i)).toBeTruthy();
    expect(screen.queryByPlaceholderText(/add your take/i)).toBeNull();
  });
});
