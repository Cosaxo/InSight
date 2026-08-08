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
// Plus the copy: MOD_ADVISORY is true, so nothing is hidden today and the
// control must not promise that it will be.
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
  subscribe: () => () => {},
  social: {
    takeList: [] as TakeLite[],
    flags: {} as Record<string, boolean>,
    takes(gid: string, qid?: string) {
      void gid;
      return this.takeList.filter((t) => !qid || t.qid === qid);
    },
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
  LIVE.social.takeList = [take("t1", "u_other", "Someone else's take")];
  LIVE.social.flags = {};
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
    expect(screen.getByText(/cannot undo a report/i)).toBeTruthy();
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

    const copy = screen.getByText(/moderator reviews flagged takes/i).textContent || "";
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
