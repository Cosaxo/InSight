// @vitest-environment jsdom
//
// LiveDuelPanel is the surface D5 is about. A duel answer is sealed: nobody
// may see anyone else's pick until the reveal doc exists, and the reveal doc
// only exists once the server decides the condition is met. The rules and
// the reveal pipeline enforce that; this panel is what a person actually
// looks at, and it can leak in ways rules cannot see — by rendering a vote
// it was handed, or by promising a reveal that will not happen.
//
// So these assert the two directions:
//   before the reveal — the card shows YOUR sealed pick and nothing about
//   anyone else, and the copy says what the condition actually is (a duo
//   reveals only if both play, and saying otherwise sets up a broken promise);
//   after it — the reveal renders.
//
// `../data/live` is mocked: what this panel needs from the store is one
// group, one question, one vote and one reveal, and mocking is what lets the
// pre-reveal state be exact. The real store cannot be asked for "a duel
// where the partner HAS voted but the reveal has not landed" — that is
// precisely the window the seal covers.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const LIVE = vi.hoisted(() => {
  const social = {
    groups: () => [] as Array<Record<string, unknown>>,
    todayQ: () => null as Record<string, unknown> | null,
    // Takes the gid since D156 — the rail asks per circle which ones
    // still want you, so a fixture with two circles has to answer for both.
    myDuelVote: (gid?: string) => { void gid; return null as { optionIdx: number } | null; },
    revealFor: () => null as Record<string, unknown> | null,
    // Day browsing (D156). The card draws one dot per readable reveal and
    // folds the duo's read-runs out of the same list, so the mock answers
    // for both — empty by default, because every case below is about one
    // day and a seeded history would put dots under all of them.
    revealHistory: () => [] as Array<Record<string, unknown>>,
    loadRevealHistory: async (gid: string) => { void gid; },
    // The create-or-join pair. Both take the display name as an OPTIONAL
    // third argument since D190 — the screen sends one only when it had to
    // ask, and the callable reads the profile otherwise.
    createGroup: async (name: string, mode: string, displayName?: string) => {
      void name; void mode; void displayName;
      return { gid: "g_new", inviteCode: "AAAA1111" };
    },
    joinGroup: async (code: string, displayName?: string) => {
      void code; void displayName;
      return { gid: "g_new", name: "Test" };
    },
    voteDuel: async (gid: string, idx: number, guess?: number) => { void gid; void idx; void guess; },
    setDuoMode: async (gid: string, m: string) => { void gid; void m; },
    romanticPoolReady: () => false,
    todayKey: () => "2026-07-30",
    bankQ: (qid: string) => {
      void qid;
      return null as { prompt?: string; options?: string[] } | null;
    },
    // LdReveal mounts LiveTakesPanel on the revealed question, so this mock
    // now has to answer for that panel too. Empty throughout: what the
    // reveal tests assert is the reveal, and a seeded take here would put
    // words in a named member's mouth in a fixture.
    takes: () => [] as Array<Record<string, unknown>>,
    loadTakes: async (gid: string) => { void gid; },
    postTake: async (gid: string, qid: string, text: string) => {
      void gid; void qid; void text;
      return null as string | null;
    },
    deleteTake: async (gid: string, id: string) => { void gid; void id; },
    flagTake: async (gid: string, id: string) => { void gid; void id; },
    flagged: (id: string) => { void id; return false; },
    // Handles and invitations (D122). The panel mounts LdInvites at its
    // top and LdAddByHandle inside every group card, so this mock answers
    // for both — empty, because an invitation in a fixture would put a
    // stranger's name on a screen these cases are not about.
    invites: () => [] as Array<Record<string, unknown>>,
    invitesLoading: () => false,
    loadInvites: async () => {},
    whoIs: async (h: string) => { void h; return null as string | null; },
    claimHandle: async (h: string) => ({ handle: h }),
    inviteToGroup: async (gid: string, to: string) => { void gid; void to; return { ok: true }; },
    acceptInvite: async (gid: string) => ({ gid, name: "Test" }),
    declineInvite: async (gid: string) => { void gid; return { ok: true }; },
  };
  // `displayName` is the account's own name (D190). The create screen READS
  // it now instead of asking for one, so the default here is the ordinary
  // case — an account that has been through the first-run screen.
  return {
    enabled: true, uid: "u_me", social, subscribe: () => () => {},
    displayName: "Olaf",
    saveDisplayName: async (n: string) => { void n; },
  };
});
// `localName` is the store's device mirror of that name — the create
// screen's fallback while the profile hydrates. "" here, so these cases
// read the profile and nothing else.
vi.mock("../data/live", () => ({ default: LIVE, TAKE_MAX_CHARS: 280, localName: () => "" }));

const { default: LiveDuelPanel } = await import("./LiveDuelPanel");

const DUO = {
  id: "g1", name: "Us Two", mode: "duo", inviteCode: "ABCD2345", streak: 3,
  memberUids: ["u_me", "u_ada"], memberNames: { u_me: "Me", u_ada: "Ada" },
};
const Q = { id: "duo-000", prompt: "Coffee or tea?", options: ["Coffee", "Tea"], kind: "classic" };

beforeEach(() => {
  LIVE.enabled = true;
  LIVE.uid = "u_me";
  LIVE.social.groups = () => [DUO];
  LIVE.social.todayQ = () => Q;
  LIVE.social.myDuelVote = () => null;
  LIVE.social.revealFor = () => null;
  LIVE.social.romanticPoolReady = () => false;
  LIVE.social.setDuoMode = async () => {};
  LIVE.social.revealHistory = () => [];
});

// The ⋯ panel (D156) — the invite code, the member list, the pool picker
// and Leave all moved behind it, which is the prototype's shape: the card
// is today's question, and everything that is not today's question is one
// tap away.
const openManage = () => fireEvent.click(screen.getByRole("button", { name: /^Manage/i }));
afterEach(cleanup);

describe("LiveDuelPanel · before the reveal, only your own pick is on screen", () => {
  it("shows your sealed choice and names nobody else", () => {
    LIVE.social.myDuelVote = () => ({ optionIdx: 0 });
    render(<LiveDuelPanel mode="duo" />);

    // "you said Coffee" — the prototype's wording, and the whole of what a
    // played card asserts about anybody's answer.
    expect(screen.getByText("you said")).toBeTruthy();
    expect(screen.getByText("Coffee")).toBeTruthy();
    // The partner exists in memberNames — the panel has their name in hand
    // and must not attach it to an answer.
    const text = document.body.textContent || "";
    expect(text).not.toMatch(/Ada picked|Ada chose|Ada: /);
  });

  // The onboarding block below the cards explains the same rules in general
  // terms, so a page-wide text search finds both and cannot say which one
  // it found. Scope to the countdown line itself: the claim under test is
  // what the card tells you about the answer you just sealed.
  const sealedBox = () => screen.getByText(/Reveals in/).textContent || "";

  it("states the duo condition rather than promising a reveal outright", () => {
    // "revealed after 00:00" alone would be a promise the pipeline does not
    // keep: shouldReveal() is both-or-nothing for a duo, so a partner who
    // never plays means no reveal and a streak of zero. The card has to say
    // the condition, or the product looks broken on the morning it applies.
    LIVE.social.myDuelVote = () => ({ optionIdx: 1 });
    render(<LiveDuelPanel mode="duo" />);
    expect(sealedBox()).toMatch(/if you both play/i);
  });

  it("promises names for a group, where one answer is enough", () => {
    // The other branch of the same sentence, and the reason it is a branch:
    // a group reveals on one answer and does show names, so borrowing the
    // duo's hedge here would understate what happens.
    LIVE.social.groups = () => [{ ...DUO, mode: "group", memberUids: ["u_me", "u_ada", "u_bo"] }];
    LIVE.social.myDuelVote = () => ({ optionIdx: 0 });
    render(<LiveDuelPanel mode="group" />);
    expect(sealedBox()).toMatch(/with names/i);
    expect(sealedBox()).not.toMatch(/if you both play/i);
  });

  it("offers the options for voting when you have not played", () => {
    render(<LiveDuelPanel mode="duo" />);
    expect(screen.getByRole("button", { name: "Coffee" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tea" })).toBeTruthy();
    expect(screen.queryByText("you said")).toBeNull();
  });
});

describe("LiveDuelPanel · answering morphs into guessing (D156)", () => {
  it("asks the question first and the read second, never both at once", () => {
    // The prototype's two steps, and the reason they are two: "what do you
    // think" and "what do you think THEY think" are different questions,
    // and a screen that shows the second before the first is answered
    // invites you to reverse-engineer one from the other.
    render(<LiveDuelPanel mode="duo" />);
    expect(screen.queryByText(/picked…\?/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Coffee" }));
    expect(screen.getByText(/And Ada picked…\?/)).toBeTruthy();
    // …and it says what you gave, so the read is made against a decision
    // you can still see.
    expect(screen.getByText(/You picked/)).toBeTruthy();
  });

  it("holds the answer locally until the guess lands, then writes both once", async () => {
    // ONE create, not two writes: answers are create-only (D5), so the
    // pick waits in component state and goes up with the guess.
    const calls: Array<[string, number, number | undefined]> = [];
    LIVE.social.voteDuel = async (gid: string, idx: number, guess?: number) => {
      calls.push([gid, idx, guess]);
    };
    render(<LiveDuelPanel mode="duo" />);
    fireEvent.click(screen.getByRole("button", { name: "Coffee" }));
    expect(calls, "the pick wrote before the guess existed").toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Tea" }));
    await vi.waitFor(() => expect(calls.length).toBe(1));
    expect(calls[0]).toEqual(["g1", 0, 1]);
  });

  it("lets you go back and change the answer before the guess seals it", () => {
    render(<LiveDuelPanel mode="duo" />);
    fireEvent.click(screen.getByRole("button", { name: "Coffee" }));
    fireEvent.click(screen.getByRole("button", { name: /change my answer/i }));
    // back on the question, with both options live again
    expect(screen.getByRole("button", { name: "Coffee" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tea" })).toBeTruthy();
    expect(screen.queryByText(/picked…\?/)).toBeNull();
  });

  it("surfaces a failed seal instead of looking like it worked", async () => {
    // The write is owner-only and can be refused — a rules rejection for a
    // day that has just revealed, most plausibly. Swallowing it leaves the
    // user believing they played on a day they did not.
    LIVE.social.voteDuel = async () => { throw new Error("permission-denied"); };
    render(<LiveDuelPanel mode="duo" />);
    fireEvent.click(screen.getByRole("button", { name: "Coffee" }));
    fireEvent.click(screen.getByRole("button", { name: "Tea" }));
    expect(await screen.findByText(/didn.t save/i)).toBeTruthy();
    // …and it puts the question back rather than stranding you on a guess
    // step for an answer that was never stored.
    expect(screen.getByRole("button", { name: "Coffee" })).toBeTruthy();
  });

  it("seals on the first tap in a group, where there is nothing to guess", async () => {
    const calls: Array<[string, number, number | undefined]> = [];
    LIVE.social.voteDuel = async (gid: string, idx: number, guess?: number) => {
      calls.push([gid, idx, guess]);
    };
    LIVE.social.groups = () => [{ ...DUO, mode: "group", memberUids: ["u_me", "u_ada", "u_bo"] }];
    render(<LiveDuelPanel mode="group" />);
    fireEvent.click(screen.getByRole("button", { name: "Coffee" }));
    await vi.waitFor(() => expect(calls.length).toBe(1));
    expect(calls[0]).toEqual(["g1", 0, undefined]);
  });
});

describe("LiveDuelPanel · a solo duo says why nothing is happening", () => {
  it("offers both ways to reach the partner when they have not joined", () => {
    // Two paths since D122, and the copy names both because they answer
    // different situations: a handle reaches someone who is already here,
    // a link reaches someone who is not. The old line said "share the
    // code above", which was the only path there was.
    LIVE.social.groups = () => [{ ...DUO, memberUids: ["u_me"] }];
    render(<LiveDuelPanel mode="duo" />);
    expect(screen.getByText(/Add them by handle or send the link/i)).toBeTruthy();
    expect(screen.getByPlaceholderText(/their-handle/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /copy invite link/i })).toBeTruthy();
  });

  it("renders nothing when LIVE is off", () => {
    LIVE.enabled = false;
    const { container } = render(<LiveDuelPanel mode="duo" />);
    expect(container.textContent).toBe("");
  });
});

describe("LiveDuelPanel · the question-pool picker (D40 part 4)", () => {
  it("does not render while the romantic pool is dark — no stranding flips", () => {
    render(<LiveDuelPanel mode="duo" />);
    openManage();
    expect(screen.queryByText(/Question pool/i)).toBeNull();
  });

  it("offers the flip when the pool is live, and writes it through setDuoMode", async () => {
    LIVE.social.romanticPoolReady = () => true;
    const calls: Array<[string, string]> = [];
    LIVE.social.setDuoMode = async (gid: string, m: string) => { calls.push([gid, m]); };
    render(<LiveDuelPanel mode="duo" />);
    openManage();
    expect(screen.getByText(/Question pool/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Romantic" }));
    await Promise.resolve();
    expect(calls).toEqual([["g1", "romantic"]]);
  });

  it("keeps the road back open for an already-romantic pair even if the pool darkens", async () => {
    LIVE.social.groups = () => [{ ...DUO, duoMode: "romantic" }];
    const calls: Array<[string, string]> = [];
    LIVE.social.setDuoMode = async (gid: string, m: string) => { calls.push([gid, m]); };
    render(<LiveDuelPanel mode="duo" />);
    openManage();
    fireEvent.click(screen.getByRole("button", { name: "Friends" }));
    await Promise.resolve();
    expect(calls).toEqual([["g1", "friends"]]);
  });

  it("locks the picker once today's answer is sealed, and says so", () => {
    LIVE.social.romanticPoolReady = () => true;
    LIVE.social.myDuelVote = () => ({ optionIdx: 0 });
    const calls: string[] = [];
    LIVE.social.setDuoMode = async (_gid: string, m: string) => { calls.push(m); };
    render(<LiveDuelPanel mode="duo" />);
    openManage();
    const romantic = screen.getByRole("button", { name: "Romantic" }) as HTMLButtonElement;
    expect(romantic.disabled).toBe(true);
    fireEvent.click(romantic);
    expect(calls).toEqual([]);
    expect(screen.getByText(/locked until tomorrow/i)).toBeTruthy();
  });

  it("never renders for a solo duo or a group", () => {
    LIVE.social.romanticPoolReady = () => true;
    LIVE.social.groups = () => [{ ...DUO, memberUids: ["u_me"] }];
    render(<LiveDuelPanel mode="duo" />);
    openManage();
    expect(screen.queryByText(/Question pool/i)).toBeNull();
    cleanup();
    LIVE.social.groups = () => [{ ...DUO, id: "g2", mode: "group", memberUids: ["u_me", "u_ada", "u_bo"] }];
    render(<LiveDuelPanel mode="group" />);
    openManage();
    expect(screen.queryByText(/Question pool/i)).toBeNull();
  });
});

// ── the reveal, when the group was not all asked the same thing ──
//
// duelQFor derives the day's question from the cached bank with its LENGTH
// as the modulus, so between a promotion and a member's next cache refresh
// two people can be asked different questions on the same day — no hacked
// client, and rules cannot see it (both qids exist in the bank). The reveal
// is published under the plurality question (D70) and stamps `qid` on the
// answers given to something else (D71).
//
// What this pins is the thing the server fix could not reach: a member's
// answer must never be rendered under a prompt they were not asked. That is
// a sentence with their name on it, asserting something they did not say.
describe("LiveDuelPanel · a reveal whose members answered different questions", () => {
  const QA = { prompt: "Coffee or tea?", options: ["Coffee", "Tea"] };
  const QB = { prompt: "Beach or mountains?", options: ["Beach", "Mountains"] };

  beforeEach(() => {
    LIVE.social.bankQ = (qid: string) => (qid === "duo-000" ? QA : qid === "duo-777" ? QB : null);
    // Today's card is also on screen and renders the same option words as
    // buttons, so a page-wide text search cannot tell the reveal's "Tea"
    // from today's. Every assertion below reads the reveal box alone.
    LIVE.social.myDuelVote = () => ({ optionIdx: 0 });
  });

  // the kicker's parent IS the reveal box (LdReveal's outer div)
  const revealBox = () =>
    (screen.getByText(/Yesterday · revealed/).parentElement as HTMLElement).textContent || "";

  it("renders each answer under the question that member was actually asked", () => {
    LIVE.social.revealFor = () => ({
      day: "2026-07-29",
      qid: "duo-000",
      votes: {
        u_me: { optionIdx: 0 },
        u_ada: { optionIdx: 1, qid: "duo-777" },
      },
      names: { u_me: "Me", u_ada: "Ada" },
    });
    render(<LiveDuelPanel mode="duo" />);
    const text = revealBox();

    // both prompts are in the reveal, each above its own answer
    expect(text).toMatch(/Coffee or tea\?/);
    expect(text).toMatch(/Beach or mountains\?/);
    expect(text).toMatch(/Ada was asked a different question/i);
    // Ada picked index 1. Under the old card that read as "Tea" — an answer
    // to a question she was never shown. It must read as HER option.
    expect(text).toMatch(/Mountains/);
    expect(text).not.toMatch(/Tea/);
  });

  it("does not score a guess across the split", () => {
    // Ada guessed 0 about a different question; my pick is 0 of mine. Left
    // alone the card would compare the two indexes, find them equal, and
    // print "called it" for a read she never made.
    LIVE.social.revealFor = () => ({
      day: "2026-07-29",
      qid: "duo-000",
      votes: {
        u_me: { optionIdx: 0, guessIdx: 1 },
        u_ada: { optionIdx: 1, guessIdx: 0, qid: "duo-777" },
      },
      names: { u_me: "Me", u_ada: "Ada" },
    });
    render(<LiveDuelPanel mode="duo" />);
    const text = revealBox();
    expect(text).not.toMatch(/called it/i);
    expect(text).not.toMatch(/guessed/i);
  });

  it("the ordinary reveal is unchanged — one prompt, and guesses still score", () => {
    // The regression guard for the common case: no per-vote qid anywhere,
    // which is also every reveal written before D71.
    LIVE.social.revealFor = () => ({
      day: "2026-07-29",
      qid: "duo-000",
      votes: {
        u_me: { optionIdx: 0, guessIdx: 1 },
        u_ada: { optionIdx: 1, guessIdx: 0 },
      },
      names: { u_me: "Me", u_ada: "Ada" },
    });
    render(<LiveDuelPanel mode="duo" />);
    const text = revealBox();
    expect(text).toMatch(/Coffee or tea\?/);
    expect(text).not.toMatch(/asked a different question/i);
    expect(text).not.toMatch(/Beach or mountains\?/);
    // me guessed 1, Ada picked 1 → called it; Ada guessed 0, I picked 0 → called it
    expect(text).toMatch(/called it/i);
  });
});

describe("LiveDuelPanel · takes hang off the reveal, never the sealed question", () => {
  const QA = { prompt: "Coffee or tea?", options: ["Coffee", "Tea"] };

  beforeEach(() => {
    LIVE.social.bankQ = (qid: string) => (qid === "duo-000" ? QA : null);
  });

  it("shows the composer on the revealed question", async () => {
    LIVE.social.revealFor = () => ({
      day: "2026-07-29",
      qid: "duo-000",
      votes: { u_me: { optionIdx: 0 }, u_ada: { optionIdx: 1 } },
      names: { u_me: "Me", u_ada: "Ada" },
    });
    render(<LiveDuelPanel mode="duo" />);

    // findBy, not getBy: the takes panel is a React.lazy chunk since D152
    // (it was 40 KB of first-paint weight for a thread behind a reveal),
    // so the composer arrives one dynamic import after the reveal does.
    expect(await screen.findByLabelText("Add your take")).toBeTruthy();
  });

  it("shows no composer when there is no reveal yet", () => {
    // Today's question is on screen and sealed. Free text beside a sealed
    // answer is the leak the seal exists to prevent — "obviously B" under a
    // question nobody has answered is the vote, written out. One composer
    // reachable here would undo the whole duel model.
    LIVE.social.revealFor = () => null;
    LIVE.social.myDuelVote = () => ({ optionIdx: 0 });
    render(<LiveDuelPanel mode="duo" />);

    expect(screen.queryByLabelText("Add your take")).toBeNull();
  });

  it("shows no composer when the reveal carries no question id", () => {
    // A reveal with no qid has no thread to hang takes on; the panel's own
    // guard returns null rather than opening one against an empty key.
    LIVE.social.revealFor = () => ({
      day: "2026-07-29",
      votes: { u_me: { optionIdx: 0 } },
      names: { u_me: "Me" },
    });
    render(<LiveDuelPanel mode="duo" />);

    expect(screen.queryByLabelText("Add your take")).toBeNull();
  });
});

// ── handles and invitations (D122) ────────────────────────────────
//
// The flow that replaced the typed invite code. What these cases hold is
// the pair of properties the change is easy to get wrong on: an invite
// grants nothing until the other side accepts, and a handle that names
// nobody has to say so rather than appearing to work.

describe("LiveDuelPanel · adding someone by handle", () => {
  it("resolves the handle, then invites the uid behind it", async () => {
    const whoIs = vi.fn(async () => "u_ada");
    const invite = vi.fn(async (gid: string, to: string) => { void gid; void to; return { ok: true }; });
    LIVE.social.whoIs = whoIs;
    LIVE.social.inviteToGroup = invite;
    LIVE.social.groups = () => [{ ...DUO, memberUids: ["u_me"] }];
    render(<LiveDuelPanel mode="duo" />);

    fireEvent.change(screen.getByPlaceholderText(/their-handle/i), { target: { value: "@Ada" } });
    fireEvent.click(screen.getByRole("button", { name: /^Invite$/ }));
    await waitFor(() => expect(invite).toHaveBeenCalled());
    // Canonical form on the way out: the registry is keyed on the fold,
    // so sending "@Ada" would look up a handle nobody holds.
    expect(whoIs).toHaveBeenCalledWith("ada");
    // The uid, never the handle — the callable addresses accounts.
    expect(invite.mock.calls[0][1]).toBe("u_ada");
    expect(await screen.findByText(/Invited @ada/i)).toBeTruthy();
  });

  it("says nobody holds a handle rather than reporting a silent success", async () => {
    // The failure this flow has that a code did not. It deliberately does
    // not distinguish "unclaimed" from "malformed": to someone looking a
    // person up those are the same answer.
    LIVE.social.whoIs = vi.fn(async () => null);
    const invite = vi.fn(async (gid: string, to: string) => { void gid; void to; return { ok: true }; });
    LIVE.social.inviteToGroup = invite;
    LIVE.social.groups = () => [{ ...DUO, memberUids: ["u_me"] }];
    render(<LiveDuelPanel mode="duo" />);

    fireEvent.change(screen.getByPlaceholderText(/their-handle/i), { target: { value: "ghost" } });
    fireEvent.click(screen.getByRole("button", { name: /^Invite$/ }));
    expect(await screen.findByText(/No account is @ghost/i)).toBeTruthy();
    expect(invite, "an unresolved handle still sent an invitation").not.toHaveBeenCalled();
  });

  it("will not send a handle the server would refuse", () => {
    LIVE.social.groups = () => [{ ...DUO, memberUids: ["u_me"] }];
    render(<LiveDuelPanel mode="duo" />);
    const field = screen.getByPlaceholderText(/their-handle/i);
    const btn = () => screen.getByRole("button", { name: /^Invite$/ }) as HTMLButtonElement;
    expect(btn().disabled, "empty handle was sendable").toBe(true);
    fireEvent.change(field, { target: { value: "ab" } });
    expect(btn().disabled).toBe(true);
    expect(screen.getByText(/at least 3 characters/i)).toBeTruthy();
    fireEvent.change(field, { target: { value: "ada" } });
    expect(btn().disabled).toBe(false);
  });
});

describe("LiveDuelPanel · the invitation inbox", () => {
  const INV = { gid: "g_new", groupName: "The Crew", mode: "duo", from: "u_ada", fromName: "Ada", at: 2 };

  it("names who asked and what for, and offers both answers", () => {
    LIVE.social.invites = () => [INV];
    render(<LiveDuelPanel mode="duo" />);
    expect(screen.getByText(/Ada wants to play The Crew with you/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Accept$/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Decline$/ })).toBeTruthy();
  });

  it("shows only the invitations for the mode you are looking at", () => {
    // A 1v1 challenge in the group tab reads as a circle you were added
    // to, which is a different thing being asked of you.
    LIVE.social.invites = () => [INV];
    render(<LiveDuelPanel mode="group" />);
    expect(screen.queryByText(/Ada wants to play/i)).toBeNull();
  });

  it("accept and decline each go to their own callable", async () => {
    const accept = vi.fn(async () => ({ gid: "g_new", name: "The Crew" }));
    const decline = vi.fn(async () => ({ ok: true }));
    LIVE.social.invites = () => [INV];
    LIVE.social.acceptInvite = accept;
    LIVE.social.declineInvite = decline;

    render(<LiveDuelPanel mode="duo" />);
    fireEvent.click(screen.getByRole("button", { name: /^Accept$/ }));
    await waitFor(() => expect(accept).toHaveBeenCalledWith("g_new"));
    cleanup();

    render(<LiveDuelPanel mode="duo" />);
    fireEvent.click(screen.getByRole("button", { name: /^Decline$/ }));
    await waitFor(() => expect(decline).toHaveBeenCalledWith("g_new"));
    // Decline writes nothing back to the inviter — no "declined" state
    // exists to write. Asserted as the absence of a second call, because
    // the shape a well-meaning future edit takes is telling them.
    expect(accept).toHaveBeenCalledTimes(1);
  });

  it("draws nothing at all when nobody has invited you", () => {
    LIVE.social.invites = () => [];
    render(<LiveDuelPanel mode="duo" />);
    expect(screen.queryByText(/invitation/i)).toBeNull();
  });
});

// ── the prototype's shape (D156) ──────────────────────────────────
//
// What these hold is the set of things the live panel did NOT have and the
// v25 sample did — the reasons the two screens did not look alike. Each is
// asserted through what a person can actually see or reach, not through a
// style object, so a redesign that keeps the behaviour is free to move.

describe("LiveDuelPanel · the rail", () => {
  it("names every circle and says which ones still want you", () => {
    LIVE.social.groups = () => [
      { ...DUO, id: "g1", memberNames: { u_me: "Me", u_ada: "Ada" } },
      { ...DUO, id: "g2", memberUids: ["u_me", "u_bo"], memberNames: { u_me: "Me", u_bo: "Bo" } },
    ];
    // g1 played, g2 has not
    LIVE.social.myDuelVote = (gid?: string) => (gid === "g1" ? { optionIdx: 0 } : null);
    render(<LiveDuelPanel mode="duo" />);

    expect(screen.getByRole("button", { name: /Ada — done for today/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Bo — still to play/i })).toBeTruthy();
    // and the count above it, so "how much is left" is one glance
    expect(screen.getByText("1 to play")).toBeTruthy();
  });

  it("offers a way to start another one without scrolling to the bottom", () => {
    render(<LiveDuelPanel mode="duo" />);
    expect(screen.getByRole("button", { name: /Start a 1v1/i })).toBeTruthy();
  });

  it("draws no rail before there is anything to put on it", () => {
    // First run: the panel IS the create form, and a rail with one "+" on
    // it would be a frame around nothing.
    LIVE.social.groups = () => [];
    render(<LiveDuelPanel mode="group" />);
    expect(screen.queryByRole("button", { name: /Create a group/i })).toBeNull();
    expect(screen.getByRole("button", { name: /^Create$/ })).toBeTruthy();
  });
});

// ── the create screen does not ask for your name (D190) ────────────
//
// It did, in a field above the circle's name, and that was reported from a
// device: the name is set at sign-in and belongs to the account, so a
// screen that asks again is one that has not been told. What it keeps is
// the BACKUP — the setup screen is skippable and its "asked already" flag
// is per device, so an account with no name is a state that survives, and
// a reveal with a blank where a name goes is worse than one more field.
describe("LiveDuelPanel · your name is the account's, not this screen's", () => {
  beforeEach(() => { LIVE.social.groups = () => []; });
  afterEach(() => { LIVE.displayName = "Olaf"; });

  it("asks only for the circle's name when the account has one", () => {
    render(<LiveDuelPanel mode="group" />);
    expect(screen.queryByPlaceholderText(/Your name/i)).toBeNull();
    expect(screen.getByPlaceholderText(/Group name/i)).toBeTruthy();
  });

  it("creates without re-sending a name the profile already holds", async () => {
    // undefined, never "": createGroupV2's callerName reads the profile
    // when the client sends nothing, and an empty string would overwrite
    // the name it is standing in for.
    const create = vi.fn(async () => ({ gid: "g9", inviteCode: "AAAA1111" }));
    LIVE.social.createGroup = create;
    render(<LiveDuelPanel mode="group" />);
    fireEvent.change(screen.getByPlaceholderText(/Group name/i), { target: { value: "Book Club" } });
    fireEvent.click(screen.getByRole("button", { name: /^Create$/ }));
    await waitFor(() => expect(create).toHaveBeenCalledWith("Book Club", "group", "Olaf"));
  });

  it("falls back to the field for an account that has no name at all", async () => {
    LIVE.displayName = "";
    const save = vi.fn(async (n: string) => { void n; });
    const create = vi.fn(async () => ({ gid: "g9", inviteCode: "AAAA1111" }));
    LIVE.saveDisplayName = save;
    LIVE.social.createGroup = create;
    render(<LiveDuelPanel mode="group" />);

    const field = screen.getByPlaceholderText(/Your name/i);
    expect(field, "the backup went with the field").toBeTruthy();
    fireEvent.change(field, { target: { value: "Olaf" } });
    fireEvent.change(screen.getByPlaceholderText(/Group name/i), { target: { value: "Book Club" } });
    fireEvent.click(screen.getByRole("button", { name: /^Create$/ }));
    // …and it lands on the ACCOUNT, so the next screen that needs a name
    // has one and this fallback is never seen again.
    await waitFor(() => expect(save).toHaveBeenCalledWith("Olaf"));
    expect(create).toHaveBeenCalledWith("Book Club", "group", "Olaf");
  });
});

describe("LiveDuelPanel · the member list says you once (D229)", () => {
  /**
   * What a screen reader would get: `textContent` with the `aria-hidden`
   * subtrees taken out.
   *
   * The duplication is still in the DOM on purpose — the pill is the
   * VISUAL marker and stays drawn — so a `getAllByText` count cannot see
   * this fix at all. The question is only ever about the accessibility
   * tree, so the assertion has to be too.
   */
  const spoken = (el: Element): string => {
    const clone = el.cloneNode(true) as Element;
    clone.querySelectorAll("[aria-hidden='true']").forEach((n) => n.remove());
    return clone.textContent ?? "";
  };
  const memberList = () => screen.getByText("2 here").parentElement!;

  it("does not announce “you you” on your own chip", () => {
    // `YouChip` speaks by design — in a reveal bar it is the only marker
    // of your own row, so `aria-hidden` on the COMPONENT would cost that.
    // This chip is the one place that already prints the word beside the
    // pill, and unhidden the member list read it twice.
    render(<LiveDuelPanel mode="duo" />);
    openManage();
    expect(spoken(memberList()).match(/you/g) ?? [], "the pill and the label both spoke").toHaveLength(1);
  });

  it("still names the other member, and still draws the pill", () => {
    // Two halves the fix must not swallow: hiding the wrong element would
    // take a real name off the list rather than a duplicate word, and
    // hiding the pill from SIGHT would lose the marker it exists to be.
    render(<LiveDuelPanel mode="duo" />);
    openManage();
    expect(spoken(memberList())).toContain("Ada");
    expect(memberList().textContent, "the pill stopped being drawn").toContain("youyou");
  });
});

describe("LiveDuelPanel · a circle's reveal is a split, not a list", () => {
  const GROUP = {
    ...DUO, mode: "group",
    memberUids: ["u_me", "u_ada", "u_bo"],
    memberNames: { u_me: "Me", u_ada: "Ada", u_bo: "Bo" },
  };

  beforeEach(() => {
    LIVE.social.groups = () => [GROUP];
    LIVE.social.bankQ = () => ({ prompt: "Coffee or tea?", options: ["Coffee", "Tea"] });
    LIVE.social.myDuelVote = () => ({ optionIdx: 0 });
  });

  const box = () => screen.getByText(/Yesterday · revealed/).parentElement as HTMLElement;

  it("puts the people who chose an option on that option", () => {
    LIVE.social.revealFor = () => ({
      qid: "duo-000",
      votes: { u_me: { optionIdx: 0 }, u_ada: { optionIdx: 1 }, u_bo: { optionIdx: 1 } },
      names: { u_me: "Me", u_ada: "Ada", u_bo: "Bo" },
    });
    render(<LiveDuelPanel mode="group" />);
    const rows = box();
    expect(rows.textContent).toMatch(/Coffee/);
    expect(rows.textContent).toMatch(/Tea/);
    // the marks carry the names — that is what makes a reveal a room
    expect(rows.querySelector('[title="Ada"]')).toBeTruthy();
    expect(rows.querySelector('[title="Bo"]')).toBeTruthy();
    // and you are a chip rather than a mark, so you never have to decode
    // your own initials
    expect(rows.textContent).toMatch(/you/);
  });

  it("draws no bar for an option nobody chose", () => {
    // A row reading zero is noise on a screen whose whole job is the shape
    // of the split. "Tea" appears only in the prompt, in lower case.
    LIVE.social.revealFor = () => ({
      qid: "duo-000",
      votes: { u_me: { optionIdx: 0 }, u_ada: { optionIdx: 0 }, u_bo: { optionIdx: 0 } },
      names: { u_me: "Me", u_ada: "Ada", u_bo: "Bo" },
    });
    render(<LiveDuelPanel mode="group" />);
    expect(box().textContent).not.toMatch(/Tea/);
  });
});

describe("LiveDuelPanel · the pair's read-runs", () => {
  const hist = (day: string, mineGuess: number, theirsGuess: number) => ({
    day, qid: "duo-000",
    votes: {
      u_me: { optionIdx: 0, guessIdx: mineGuess },
      u_ada: { optionIdx: 1, guessIdx: theirsGuess },
    },
  });

  it("draws both runs once there are scored days to draw", () => {
    LIVE.social.myDuelVote = () => ({ optionIdx: 0 });
    LIVE.social.revealHistory = () => [hist("2026-08-12", 1, 0), hist("2026-08-11", 0, 1)];
    render(<LiveDuelPanel mode="duo" />);
    expect(screen.getByLabelText("How well you read them")).toBeTruthy();
    expect(screen.getByLabelText("How well they read you")).toBeTruthy();
  });

  it("draws nothing at all before a single day has revealed", () => {
    // An empty run is not a zero score, it is no score — and a row of
    // hollow dots would read as the first.
    LIVE.social.myDuelVote = () => ({ optionIdx: 0 });
    LIVE.social.revealHistory = () => [];
    render(<LiveDuelPanel mode="duo" />);
    expect(screen.queryByLabelText("How well you read them")).toBeNull();
  });

  it("never draws them for a circle, where there is nothing to read", () => {
    LIVE.social.groups = () => [{ ...DUO, mode: "group", memberUids: ["u_me", "u_ada", "u_bo"] }];
    LIVE.social.myDuelVote = () => ({ optionIdx: 0 });
    LIVE.social.revealHistory = () => [hist("2026-08-12", 1, 0)];
    render(<LiveDuelPanel mode="group" />);
    expect(screen.queryByLabelText("How well you read them")).toBeNull();
  });
});

describe("LiveDuelPanel · day history is bought, not assumed", () => {
  it("does not fetch older days just because the tab opened", () => {
    // REVEAL_HIST_DAYS doc reads per circle per session, on the app's FIRST
    // screen. Anyone with three circles would pay for forty documents to
    // look at today's question.
    const load = vi.fn(async (gid: string) => { void gid; });
    LIVE.social.loadRevealHistory = load;
    LIVE.social.revealFor = () => ({ qid: "duo-000", votes: { u_me: { optionIdx: 0 } }, names: { u_me: "Me" } });
    render(<LiveDuelPanel mode="duo" />);
    expect(load).not.toHaveBeenCalled();
  });

  it("fetches them on the tap that asks for them", async () => {
    const load = vi.fn(async (gid: string) => { void gid; });
    LIVE.social.loadRevealHistory = load;
    LIVE.social.revealFor = () => ({ qid: "duo-000", votes: { u_me: { optionIdx: 0 } }, names: { u_me: "Me" } });
    render(<LiveDuelPanel mode="duo" />);
    fireEvent.click(screen.getByRole("button", { name: /Load older days/i }));
    await waitFor(() => expect(load).toHaveBeenCalledWith("g1"));
  });

  it("browses back to a day through its dot, and back to today", () => {
    LIVE.social.myDuelVote = () => ({ optionIdx: 0 });
    LIVE.social.bankQ = () => ({ prompt: "Coffee or tea?", options: ["Coffee", "Tea"] });
    LIVE.social.revealHistory = () => [
      { day: "2026-08-13", qid: "duo-000", votes: { u_me: { optionIdx: 0 } }, names: { u_me: "Me" } },
      { day: "2026-08-12", qid: "duo-000", votes: { u_me: { optionIdx: 1 } }, names: { u_me: "Me" } },
    ];
    render(<LiveDuelPanel mode="duo" />);

    fireEvent.click(screen.getByRole("button", { name: /2 days ago — revealed/i }));
    expect(screen.getByText(/2 days ago · revealed/)).toBeTruthy();
    // …and the way back is on the card, not in the browser's back button.
    // Exact name: the dots row also carries a "Today" one, and matching
    // loosely here would pass by pressing the wrong control.
    fireEvent.click(screen.getByRole("button", { name: "‹ today" }));
    expect(screen.queryByText(/2 days ago · revealed/)).toBeNull();
    expect(screen.getByText("you said")).toBeTruthy();
  });
});
