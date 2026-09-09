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
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const LIVE = vi.hoisted(() => {
  // The open round's question, for `roundQ` — the same prompt `Q` below
  // carries; defined here because this factory is hoisted above it.
  const Q0 = { id: "duo-000", prompt: "Coffee or tea?", options: ["Coffee", "Tea"], kind: "classic" };
  const social = {
    groups: () => [] as Array<Record<string, unknown>>,
    todayQ: (gid?: string) => { void gid; return null as Record<string, unknown> | null; },
    // Takes the gid since D156 — the rail asks per circle which ones
    // still want you, so a fixture with two circles has to answer for both.
    myDuelVote: (gid?: string) => { void gid; return null as { optionIdx: number } | null; },
    // Request 12: my answer and call on a given round — the sealed list's
    // "you: Coffee · called Tea". Follows myDuelVote by default, so a case
    // that seals the open round sees its own pick in the list.
    myDuelCall: (gid: string, round: number) => {
      void round;
      const v = social.myDuelVote(gid);
      return v ? { optionIdx: v.optionIdx, guessIdx: null as number | null } : null;
    },
    // Rounds (ROUNDS-PLAN, D426). The fixture's world is "one round is the
    // lead": a sealed answer to the open round means nothing further to
    // answer, which is the card's waiting state — the state every case
    // below written against "you have played today" was about. A case
    // that wants the volley (a round sealed AND a next question) sets
    // both `roundInfo` and `todayQ` itself.
    roundInfo: (gid: string) => (social.myDuelVote(gid)
      ? { open: 1, next: null as number | null, sealed: [1], lead: 5 }
      : { open: 1, next: 1 as number | null, sealed: [] as number[], lead: 5 }),
    roundQ: (gid: string, round: number) => { void gid; void round; return Q0 as Record<string, unknown> | null; },
    // The first run's group preview (D435): the bank's first role vote, or
    // null before the cast has reached the device.
    roleVotePreview: () => null as { prompt: string; scen: { id: string; label: string; hue: number }; role: { id: string; label: string } } | null,
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
    // A tapped link ASKS since D240 — it no longer admits its holder.
    requestJoin: async (code: string, displayName?: string) => {
      void code; void displayName;
      return { gid: "g_new", name: "Test", status: "requested" as string };
    },
    approveJoin: async (gid: string, uid: string) => { void gid; void uid; return { ok: true }; },
    declineJoin: async (gid: string, uid: string) => { void gid; void uid; return { ok: true }; },
    voteDuel: async (gid: string, idx: number, guess?: number) => { void gid; void idx; void guess; },
    voteLate: async (gid: string, round: number, idx: number, qid?: string) => { void gid; void round; void idx; void qid; },
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
    takesLoading: () => false,
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
    // The name half of finding somebody (D239). A prefix over the
    // people directory, where whoIs is an exact address.
    searchPeople: async (q: string) => {
      void q;
      return [] as Array<{ uid: string; name: string; handle: string }>;
    },
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
    // The shared PersonRow draws an Avatar, which reads the face token
    // and falls back to initials (D178). Every result row goes through
    // it since D239, so these three are now part of what this panel
    // needs from the store.
    faceFor: (uid: string) => { void uid; return ""; },
    nameFor: (uid: string) => ({ u_ada: "Ada Lovelace" }[uid] || ""),
    loadNames: async (uids: readonly string[]) => { void uids; },
  };
});
// `localName` is the store's device mirror of that name — the create
// screen's fallback while the profile hydrates. "" here, so these cases
// read the profile and nothing else.
vi.mock("../data/live", () => ({ default: LIVE, TAKE_MAX_CHARS: 280, localName: () => "" }));

const { default: LiveDuelPanel } = await import("./LiveDuelPanel");

// Day keys the way the server writes them: UTC, YYYY-MM-DD.
const dayKey = (offsetDays = 0) =>
  new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);

const DUO = {
  id: "g1", name: "Us Two", mode: "duo", inviteCode: "ABCD2345", streak: 3,
  // A three-day run is a claim about the present, so the fixture carries the
  // reveal that makes it one. Without this the streak is a number that was
  // true once, which is exactly the state the panel now refuses to print.
  lastRevealDay: dayKey(-1),
  memberUids: ["u_me", "u_ada"], memberNames: { u_me: "Me", u_ada: "Ada" },
};
const Q = { id: "duo-000", prompt: "Coffee or tea?", options: ["Coffee", "Tea"], kind: "classic" };

beforeEach(() => {
  LIVE.enabled = true;
  LIVE.uid = "u_me";
  LIVE.social.groups = () => [DUO];
  // The next question, or nothing once the open round is sealed — the
  // fixture's one-round lead (see `roundInfo` above). Both reset here,
  // because a case that sets the volley state (a round sealed AND a next
  // question) would otherwise leak it into every case after it.
  LIVE.social.todayQ = (gid?: string) => (LIVE.social.myDuelVote(gid) ? null : Q);
  LIVE.social.roundInfo = (gid: string) => (LIVE.social.myDuelVote(gid)
    ? { open: 1, next: null, sealed: [1], lead: 5 }
    : { open: 1, next: 1, sealed: [], lead: 5 });
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
// The first run keeps the create form behind its one tap target (request
// 11, state 9): every case that types into it opens it first.
const openStart = () => fireEvent.click(screen.getByRole("button", { name: /^Start a (1v1|group)$/ }));
afterEach(cleanup);

describe("LiveDuelPanel · before the reveal, only your own pick is on screen", () => {
  it("shows your sealed choice and names nobody else", () => {
    LIVE.social.myDuelVote = () => ({ optionIdx: 0 });
    render(<LiveDuelPanel mode="duo" />);

    // "you: Coffee" — the sealed list's line (request 12, state 5), and the
    // whole of what a played card asserts about anybody's answer.
    expect(screen.getByText("you: Coffee")).toBeTruthy();
    // The partner exists in memberNames — the panel has their name in hand
    // and must not attach it to an answer.
    const text = document.body.textContent || "";
    expect(text).not.toMatch(/Ada picked|Ada chose|Ada: /);
  });

  // The onboarding block below the cards explains the same rules in general
  // terms, so a page-wide text search finds both and cannot say which one
  // it found. Scope to the waiting line itself: the claim under test is
  // what the card tells you about the answer you just sealed.
  const sealedBox = () => screen.getByText(/Each reveals/).textContent || "";

  it("a 1v1 reveals when THEY play — no clock, and no cadence (D419 §3)", () => {
    // Under rounds a 1v1 has no clock at all: it reveals the moment the
    // other person answers (ROUNDS-PLAN §3). A countdown here would count
    // to a moment the reveal does not wait on, and "tomorrow" would be a
    // sentence with an expiry date.
    LIVE.social.myDuelVote = () => ({ optionIdx: 1 });
    render(<LiveDuelPanel mode="duo" />);
    expect(sealedBox()).toMatch(/Each reveals as Ada plays/);
    expect(screen.getByText(/One round waiting on Ada/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/tomorrow|Reveals in/i);
  });

  it("a group reveals when everyone has played or at the deadline, with names", () => {
    // The other branch of the same sentence: a group closes at its round's
    // deadline for whoever played (the owner's rule), and it shows names.
    // Without a clock on the group document the card says "at the
    // deadline"; with one it counts to it (the case below).
    LIVE.social.groups = () => [{ ...DUO, mode: "group", memberUids: ["u_me", "u_ada", "u_bo"] }];
    LIVE.social.myDuelVote = () => ({ optionIdx: 0 });
    render(<LiveDuelPanel mode="group" />);
    expect(sealedBox()).toMatch(/everyone has played, or at its deadline/i);
    expect(sealedBox()).not.toMatch(/Ada plays/i);
  });

  it("a group with a running clock counts to ITS deadline, not to midnight", () => {
    LIVE.social.groups = () => [{
      ...DUO, mode: "group", memberUids: ["u_me", "u_ada", "u_bo"],
      roundDeadlineAt: Date.now() + 3 * 3600_000 + 5 * 60_000,
    }];
    LIVE.social.myDuelVote = () => ({ optionIdx: 0 });
    render(<LiveDuelPanel mode="group" />);
    // The design's coarse clock, on the open round's own line of the list.
    expect(screen.getByText(/^3h 0[45]m$/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/tomorrow|midnight/i);
  });

  it("the volley: a sealed round and the next question on one card", () => {
    // You answered round 1; Ada has not. Round 2 is yours to answer NOW —
    // the card says what is sealed and who it waits on, above the next
    // prompt. That line is the whole difference from one a day.
    LIVE.social.myDuelVote = () => ({ optionIdx: 1 });
    LIVE.social.roundInfo = () => ({ open: 1, next: 2, sealed: [1], lead: 5 });
    LIVE.social.todayQ = () => ({ id: "duo-002", prompt: "Window or aisle?", options: ["Window", "Aisle"], kind: "classic" });
    render(<LiveDuelPanel mode="duo" />);
    expect(screen.getByRole("status").textContent).toMatch(/waiting on Ada/);
    // …what you sealed, above the next question (request 12, state 2 over 1)
    expect(screen.getByText("Tea")).toBeTruthy();
    expect(screen.getByText("Window or aisle?")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Window" })).toBeTruthy();
  });

  // THE CARD BEHIND THE ONE IN VIEW STILL SAYS WHEN. Only the newest
  // card counts to its deadline (`newest`); every group card behind it
  // falls back to a written sentence, and that sentence exists to say
  // when the reveal comes. Main's night review caught this fallback
  // reduced to a fragment ("Reveals — if you both play."); under request
  // 12 the sentence is the sealed list's own line, and it has to be whole
  // on the second card too, with no cadence word in it (D419 §3).
  it("says WHEN on a card that is not the one in view, whole and without a cadence", () => {
    LIVE.social.groups = () => [
      { ...DUO, id: "g1", mode: "group", memberUids: ["u_me", "u_ada", "u_bo"], roundDeadlineAt: Date.now() + 3 * 3600_000 },
      { ...DUO, id: "g2", mode: "group", name: "The Crew", memberUids: ["u_me", "u_ada", "u_bo"], roundDeadlineAt: Date.now() + 3 * 3600_000 },
    ];
    LIVE.social.myDuelVote = () => ({ optionIdx: 1 });
    const { container } = render(<LiveDuelPanel mode="group" />);
    const text = container.textContent || "";
    // the card in view counts; the one behind it says its whole condition
    expect(screen.getByText(/^3h 0[05]m$/), "the first card lost its clock").toBeTruthy();
    expect(screen.getAllByText(/Each reveals when everyone has played, or at its deadline\./)).toHaveLength(2);
    expect(text).not.toMatch(/tomorrow|midnight|a day/i);
  });

  it("offers the options for voting when you have not played", () => {
    render(<LiveDuelPanel mode="duo" />);
    expect(screen.getByRole("button", { name: "Coffee" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tea" })).toBeTruthy();
    expect(screen.queryByText("you said")).toBeNull();
  });
});

describe("LiveDuelPanel · a late answer (ROUNDS-PLAN §4)", () => {
  // Round 1 revealed, round 2 open; the reveal is the latest one.
  const revealed = (over: Record<string, unknown> = {}) => ({
    round: 1, day: "2026-09-07", qid: "duo-000",
    votes: { u_ada: { optionIdx: 1 } }, names: { u_ada: "Ada" }, ...over,
  });

  it("a late vote sits on its own row, marked, and in no read", () => {
    LIVE.social.bankQ = () => Q;
    LIVE.social.roundInfo = () => ({ open: 2, next: 2, sealed: [], lead: 5 });
    LIVE.social.revealFor = () => revealed({
      votes: { u_me: { optionIdx: 0, guessIdx: 1 }, u_ada: { optionIdx: 1, late: true } },
    });
    render(<LiveDuelPanel mode="duo" />);
    const row = screen.getByLabelText("Answered after the reveal");
    expect(row.textContent).toMatch(/Tea/);
    expect(row.textContent).toMatch(/late/);
    // No "you read Ada" row: her answer was not blind, so nothing read it.
    expect(document.body.textContent).not.toMatch(/you read Ada|called it/);
  });

  it("offers the late answer to a member with no vote in the reveal, and writes it flagged", async () => {
    LIVE.social.bankQ = () => Q;
    LIVE.social.roundInfo = () => ({ open: 2, next: 2, sealed: [], lead: 5 });
    LIVE.social.revealFor = () => revealed();
    const calls: Array<[string, number, number, string | undefined]> = [];
    LIVE.social.voteLate = async (gid: string, round: number, idx: number, qid?: string) => {
      calls.push([gid, round, idx, qid]);
    };
    render(<LiveDuelPanel mode="duo" />);
    expect(screen.getByText(/You didn’t play this one/)).toBeTruthy();
    // The card also asks round 2's question with the same options, so pick
    // the late door's button by its own block.
    const door = screen.getByText(/You didn’t play this one/).parentElement!;
    fireEvent.click(within(door).getByRole("button", { name: "Tea" }));
    // THE QID IS THE ASSERTION, not a fourth argument along for the ride.
    // `optionIdx` indexes the options THESE buttons were rendered from,
    // which is `bankQ(reveal.qid)` — and `voteLate` used to re-derive the
    // round's question off the current bank instead, so one appended
    // question filed the answer under a different prompt.
    await waitFor(() => expect(calls).toEqual([["g1", 1, 1, "duo-000"]]));
  });

  it("does not offer it past the lead, nor to someone who played", () => {
    LIVE.social.roundInfo = () => ({ open: 9, next: 9, sealed: [], lead: 5 });
    LIVE.social.revealFor = () => revealed(); // round 1, eight behind
    render(<LiveDuelPanel mode="duo" />);
    expect(screen.queryByText(/You didn’t play this one/)).toBeNull();
    cleanup();
    LIVE.social.roundInfo = () => ({ open: 2, next: 2, sealed: [], lead: 5 });
    LIVE.social.revealFor = () => revealed({ votes: { u_me: { optionIdx: 0 }, u_ada: { optionIdx: 1 } } });
    render(<LiveDuelPanel mode="duo" />);
    expect(screen.queryByText(/You didn’t play this one/)).toBeNull();
  });
});

describe("LiveDuelPanel · the group as a cast (D432)", () => {
  const CREW = { ...DUO, id: "g2", name: "The Crew", mode: "group", memberUids: ["u_me", "u_ada", "u_bo"], memberNames: { u_me: "Me", u_ada: "Ada", u_bo: "Bo" } };
  const ROLE = {
    id: "group-gr0", prompt: "Who plans the whole thing?", options: ["Me", "Ada", "Bo"], kind: "pick",
    scen: { id: "heist", label: "Bank Heist", hue: 25 }, role: { id: "mastermind", label: "the mastermind" },
  };
  const RATE = {
    id: "group-gs0", prompt: "This group’s energy?", kind: "rate", poles: ["Calm", "Chaos"],
    options: ["Calm", "mostly Calm", "in between", "mostly Chaos", "Chaos"],
  };
  beforeEach(() => { LIVE.social.groups = () => [CREW]; });

  it("a role vote names its pack in the kicker, leads every option with its member, and seals on the one tap", async () => {
    LIVE.social.todayQ = () => ROLE;
    const calls: Array<[number, number | undefined]> = [];
    LIVE.social.voteDuel = async (_gid: string, idx: number, guess?: number) => { calls.push([idx, guess]); };
    render(<LiveDuelPanel mode="group" />);
    expect(screen.getByText("· Bank Heist")).toBeTruthy();
    // three options, each a member: the two others' marks and your pill
    expect(screen.getByRole("button", { name: "Ada" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Bo" })).toBeTruthy();
    // your own option is your pill and the word, so its name reads "you You"
    expect(screen.getByRole("button", { name: "you You" })).toBeTruthy();
    // nothing in a group is called (D435): the tap IS the vote, no guess
    fireEvent.click(screen.getByRole("button", { name: "Ada" }));
    // Ada is the second member (memberUids order), so index 1 — and no guess
    await waitFor(() => expect(calls).toEqual([[1, undefined]]));
    expect(screen.queryByText(/And the room lands on/)).toBeNull();
  });

  it("a rating asks between two poles on five steps, and seals on the one tap with no call", async () => {
    LIVE.social.todayQ = () => RATE;
    const calls: Array<[number, number | undefined]> = [];
    LIVE.social.voteDuel = async (_gid: string, idx: number, guess?: number) => { calls.push([idx, guess]); };
    render(<LiveDuelPanel mode="group" />);
    expect(screen.getByText("· Rate the group")).toBeTruthy();
    const ballot = screen.getByRole("group", { name: "Calm to Chaos" });
    expect(within(ballot).getAllByRole("button")).toHaveLength(5);
    fireEvent.click(within(ballot).getByRole("button", { name: "mostly Chaos" }));
    await waitFor(() => expect(calls).toEqual([[3, undefined]]));
    expect(screen.queryByText(/And the room lands on/)).toBeNull();
  });

  it("names one holder when a leave has moved the ballot under the votes — by the snapshots, as the Mirror does", () => {
    LIVE.social.bankQ = () => ROLE;
    LIVE.social.roundInfo = () => ({ open: 2, next: 2, sealed: [], lead: 5 });
    // The roster was [me, Ada, Bo, Cy] when u_me voted index 3 (Cy); Bo
    // left; Ada voted index 2, which is Cy now. Two indexes, one person:
    // the second review of #456 read "Cy and Cy share the mastermind" here
    // while the Votes lens said Cy held it 2–0.
    LIVE.social.revealFor = () => ({
      round: 1, day: "2026-09-08", qid: "group-gr0", members: ["u_me", "u_ada", "u_cy"],
      votes: { u_me: { optionIdx: 3, pickUid: "u_cy" }, u_ada: { optionIdx: 2, pickUid: "u_cy" } },
      names: { u_ada: "Ada", u_cy: "Cy" },
    });
    render(<LiveDuelPanel mode="group" />);
    const reveal = screen.getByTestId("ld-reveal");
    expect(reveal.textContent).toMatch(/Cy is the mastermind/);
    expect(reveal.textContent).not.toMatch(/share/);
    // one held row, not two rows for one person
    expect(reveal.querySelectorAll("[data-held]")).toHaveLength(1);
  });

  it("…and the held row is that person too: named by the snapshot, your chip on it, a late vote on the row its snapshot names", () => {
    LIVE.social.bankQ = () => ROLE;
    LIVE.social.roundInfo = () => ({ open: 2, next: 2, sealed: [], lead: 5 });
    // The same leave: the live roster is [me, Ada, Bo] and the reveal's was
    // [me, Ada, Cy]. Bo, who left, answered late at index 1, naming Cy.
    LIVE.social.revealFor = () => ({
      round: 1, day: "2026-09-08", qid: "group-gr0", members: ["u_me", "u_ada", "u_cy"],
      votes: {
        u_me: { optionIdx: 3, pickUid: "u_cy" },
        u_ada: { optionIdx: 2, pickUid: "u_cy" },
        u_bo: { optionIdx: 1, pickUid: "u_cy", late: true },
      },
      names: { u_ada: "Ada", u_cy: "Cy", u_bo: "Bo" },
    });
    render(<LiveDuelPanel mode="group" />);
    const reveal = screen.getByTestId("ld-reveal");
    const held = reveal.querySelectorAll("[data-held]");
    expect(held).toHaveLength(1);
    // the row reads "Cy" — not "Bo", the LIVE roster's name at the row's index
    expect(held[0].textContent).toMatch(/Cy/);
    expect(held[0].textContent).not.toMatch(/Bo/);
    // your vote is on it, whatever index it was cast at
    expect(held[0].textContent).toMatch(/you/);
    // Bo's late vote sits on Cy's row, marked, and the late list says Cy —
    // not "Ada", the live roster at index 1
    expect(within(held[0] as HTMLElement).getByTitle("Bo · late")).toBeTruthy();
    const lateList = within(reveal).getByLabelText("Answered after the reveal");
    expect(lateList.textContent).toMatch(/Cy/);
    expect(lateList.textContent).not.toMatch(/Ada/);
  });

  it("a role vote's reveal crowns who the room named, off the snapshots, in the pack's words", () => {
    LIVE.social.bankQ = () => ROLE;
    LIVE.social.roundInfo = () => ({ open: 2, next: 2, sealed: [], lead: 5 });
    LIVE.social.revealFor = () => ({
      round: 1, day: "2026-09-08", qid: "group-gr0",
      votes: {
        // a guess on a group vote is an older client's (D386's week); the
        // reveal draws the vote and says nothing about a call
        u_me: { optionIdx: 1, pickUid: "u_ada", guessIdx: 1 },
        u_ada: { optionIdx: 1, pickUid: "u_ada" },
        u_bo: { optionIdx: 0, pickUid: "u_me" },
      },
      names: { u_ada: "Ada", u_bo: "Bo" },
    });
    render(<LiveDuelPanel mode="group" />);
    const reveal = screen.getByTestId("ld-reveal");
    expect(within(reveal).getByText("· Bank Heist")).toBeTruthy();
    // the verdict names the cast, not "the room landed on"
    expect(reveal.textContent).toMatch(/Ada is the mastermind/);
    expect(reveal.textContent).not.toMatch(/The room landed on/);
    // …and nothing in a group is called (D435)
    expect(reveal.textContent).not.toMatch(/you called/);
    // the held row is first and marked
    const held = reveal.querySelector("[data-held]");
    expect(held).not.toBeNull();
    expect(held!.textContent).toMatch(/Ada/);
  });

  it("a rating's reveal says where the group landed, with the poles and the marks", () => {
    LIVE.social.bankQ = () => RATE;
    LIVE.social.roundInfo = () => ({ open: 5, next: 5, sealed: [], lead: 5 });
    LIVE.social.revealFor = () => ({
      round: 4, day: "2026-09-08", qid: "group-gs0",
      votes: { u_me: { optionIdx: 4 }, u_ada: { optionIdx: 3 }, u_bo: { optionIdx: 2 } },
      names: { u_ada: "Ada", u_bo: "Bo" },
    });
    render(<LiveDuelPanel mode="group" />);
    const reveal = screen.getByTestId("ld-reveal");
    expect(within(reveal).getByText("· Rate the group")).toBeTruthy();
    // mean step 3 → "mostly Chaos" · 75
    expect(reveal.textContent).toMatch(/The group lands on\s*mostly Chaos\s*· 75/);
    expect(within(reveal).getByLabelText("How the group rated itself")).toBeTruthy();
    expect(within(reveal).getByLabelText("the group · 75")).toBeTruthy();
    // no call was asked, so none is scored
    expect(reveal.textContent).not.toMatch(/called/);
  });

  it("the run is a record: a dot per vote in the pack's ink whose caption names who, a square per rating (D435)", () => {
    const bank: Record<string, unknown> = { "group-gr0": ROLE, "group-gs0": RATE };
    LIVE.social.bankQ = (qid: string) => (bank[qid] as Record<string, unknown>) || null;
    LIVE.social.roundInfo = () => ({ open: 3, next: 3, sealed: [], lead: 5 });
    LIVE.social.revealHistory = () => [
      { round: 2, day: "2026-09-08", qid: "group-gs0", votes: { u_me: { optionIdx: 2 }, u_ada: { optionIdx: 2 } } },
      { round: 1, day: "2026-09-08", qid: "group-gr0", votes: { u_me: { optionIdx: 0, pickUid: "u_me" }, u_ada: { optionIdx: 0, pickUid: "u_me" }, u_bo: { optionIdx: 1, pickUid: "u_ada" } } },
    ];
    LIVE.social.revealFor = () => ({ round: 2, day: "2026-09-08", qid: "group-gs0", votes: { u_me: { optionIdx: 2 }, u_ada: { optionIdx: 2 } } });
    render(<LiveDuelPanel mode="group" />);
    // option 0 took two votes whose snapshots both name u_me: the caption
    // says so, and the dot is a dot whoever it named
    expect(screen.getByTitle(/Bank Heist · You are the mastermind/)).toBeTruthy();
    expect(screen.getByTitle(/rated the group/)).toBeTruthy();
    expect(screen.queryByTitle(/named you|named someone else/)).toBeNull();
  });

  it("the run's caption names someone else when the room did — a record, not a score", () => {
    const bank: Record<string, unknown> = { "group-gr0": ROLE };
    LIVE.social.bankQ = (qid: string) => (bank[qid] as Record<string, unknown>) || null;
    LIVE.social.roundInfo = () => ({ open: 2, next: 2, sealed: [], lead: 5 });
    LIVE.social.revealHistory = () => [
      { round: 1, day: "2026-09-08", qid: "group-gr0", votes: { u_me: { optionIdx: 1, pickUid: "u_ada" }, u_ada: { optionIdx: 1, pickUid: "u_ada" }, u_bo: { optionIdx: 0, pickUid: "u_me" } } },
    ];
    LIVE.social.revealFor = () => ({ round: 1, day: "2026-09-08", qid: "group-gr0", votes: { u_me: { optionIdx: 1, pickUid: "u_ada" }, u_ada: { optionIdx: 1, pickUid: "u_ada" }, u_bo: { optionIdx: 0, pickUid: "u_me" } } });
    render(<LiveDuelPanel mode="group" />);
    expect(screen.getByTitle(/Bank Heist · Ada is the mastermind/)).toBeTruthy();
    expect(screen.getByLabelText(/The cast so far/)).toBeTruthy();
  });
});

describe("LiveDuelPanel · the cast round (D435)", () => {
  const CAST = {
    id: "duo-073", kind: "cast", prompt: "Most days, {name} is…",
    options: ["the one you tell first", "the one who gets you out the door", "the one you ask what to do", "the one who is just always there"],
    them: ["the one {name} tells first", "the one who gets {name} out the door", "the one {name} asks what to do", "the one who is just always there"],
    dims: ["trust", "spark", "judgement", "constancy"],
  };

  it("asks about them by name, then asks what they said you are over the them forms — and writes once", async () => {
    LIVE.social.todayQ = () => CAST;
    const calls: Array<[string, number, number | undefined]> = [];
    LIVE.social.voteDuel = async (gid: string, idx: number, guess?: number) => { calls.push([gid, idx, guess]); };
    render(<LiveDuelPanel mode="duo" />);
    // the prompt carries Ada's name, never the placeholder
    expect(screen.getByText("Most days, Ada is…")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/\{name\}/);
    fireEvent.click(screen.getByRole("button", { name: "the one you tell first" }));
    expect(calls).toEqual([]);
    expect(screen.getByText(/You said Ada is/)).toBeTruthy();
    expect(screen.getByText("And Ada said you are…?")).toBeTruthy();
    // the guess is over the them forms
    fireEvent.click(screen.getByRole("button", { name: "the one Ada asks what to do" }));
    await vi.waitFor(() => expect(calls.length).toBe(1));
    expect(calls[0]).toEqual(["g1", 0, 2]);
  });

  it("the reveal leads with what each of you is to the other, and calls the guess over the them forms", () => {
    LIVE.social.bankQ = () => CAST;
    LIVE.social.roundInfo = () => ({ open: 5, next: 5, sealed: [], lead: 5 });
    LIVE.social.revealFor = () => ({
      round: 4, day: "2026-09-09", qid: "duo-073",
      votes: { u_me: { optionIdx: 0, guessIdx: 2 }, u_ada: { optionIdx: 2, guessIdx: 1 } },
    });
    render(<LiveDuelPanel mode="duo" />);
    const reveal = screen.getByTestId("ld-reveal");
    expect(within(reveal).getByText("Most days, Ada is…")).toBeTruthy();
    // they said I am option 2, said of me in its them form; I said they are option 0
    expect(within(reveal).getByTestId("ld-cast-line").textContent)
      .toBe("You are the one Ada asks what to do. Ada is the one you tell first.");
    // my call (2) landed — their answer was 2 — and reads as a them form;
    // theirs (1) missed my 0 and reads as the answer as written
    expect(reveal.textContent).toMatch(/✓ the one Ada asks what to do/);
    expect(reveal.textContent).toMatch(/the one who gets you out the door/);
    expect(reveal.textContent).not.toMatch(/\{name\}/);
  });
});

describe("LiveDuelPanel · the first run draws a real role vote (D435)", () => {
  it("previews the bank's first role vote when the bank has one", () => {
    LIVE.social.groups = () => [];
    LIVE.social.roleVotePreview = () => ({
      prompt: "Who plans the whole thing?", scen: { id: "heist", label: "Bank Heist", hue: 25 }, role: { id: "mastermind", label: "the mastermind" },
    });
    render(<LiveDuelPanel mode="group" />);
    expect(screen.getByText("Who plans the whole thing?")).toBeTruthy();
    expect(screen.getByText("· Bank Heist")).toBeTruthy();
    expect(screen.getByText("the mastermind")).toBeTruthy();
    expect(screen.getByText(/A role a round\./)).toBeTruthy();
    expect(screen.getByText("Who the room names, round by round")).toBeTruthy();
    expect(screen.queryByText(/World question stands in/)).toBeNull();
  });

  it("falls back to the World stand-in copy before the cast has reached the bank", () => {
    LIVE.social.groups = () => [];
    LIVE.social.roleVotePreview = () => null;
    render(<LiveDuelPanel mode="group" />);
    // no deck in this fixture, so no stand-in either — but never a role
    // vote made up here (D1)
    expect(screen.queryByText(/A role a round\./)).toBeNull();
    expect(screen.getByRole("button", { name: "Start a group" })).toBeTruthy();
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

  it("a group seals on the one tap — nothing in a group is called (D435)", async () => {
    // For one week (D386) a group's second tap was a call on where the
    // room would land. The owner's 2026-09-09 brief removed it, and the
    // rules refuse a guess on the group surface, so the tap IS the vote:
    // one create, no guess, no morph.
    const calls: Array<[string, number, number | undefined]> = [];
    LIVE.social.voteDuel = async (gid: string, idx: number, guess?: number) => {
      calls.push([gid, idx, guess]);
    };
    LIVE.social.groups = () => [{ ...DUO, mode: "group", memberUids: ["u_me", "u_ada", "u_bo"] }];
    render(<LiveDuelPanel mode="group" />);
    fireEvent.click(screen.getByRole("button", { name: "Coffee" }));
    await vi.waitFor(() => expect(calls.length).toBe(1));
    expect(calls[0]).toEqual(["g1", 0, undefined]);
    expect(screen.queryByText(/And the room lands on/)).toBeNull();
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
    expect(screen.getByText(/Add them, or send the link/i)).toBeTruthy();
    // NAME OR HANDLE since D239 — the field takes both, and the
    // placeholder is the only thing that says so.
    expect(screen.getByPlaceholderText(/Name or @handle/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /copy invite link/i })).toBeTruthy();
  });

  it("does not count it as one to play, or dot the rail for it", () => {
    // `todayQ` returns a question for any room whatever its membership, so
    // a 1v1 whose partner has not joined was owed an answer for ever: the
    // header said "1 to play" and the rail marked it "still to play",
    // directly above a card reading "Waiting for someone" with no options
    // on it. The prototype excluded an unaccepted partner from both.
    LIVE.social.groups = () => [{ ...DUO, memberUids: ["u_me"] }];
    render(<LiveDuelPanel mode="duo" />);
    expect(screen.getByText(/Waiting for someone/i), "the fixture is not the solo state").toBeTruthy();
    expect(screen.queryByText(/to play/), "a room that cannot be played was counted").toBeNull();
    expect(screen.queryByLabelText(/still to play/), "the rail dotted a room with nobody in it").toBeNull();
  });

  it("still counts a real 1v1 you have not answered — the control", () => {
    // Without this, excluding everything passes the case above and the
    // header stops counting the days you actually owe.
    LIVE.social.groups = () => [{ ...DUO, memberUids: ["u_me", "u_them"] }];
    render(<LiveDuelPanel mode="duo" />);
    // The rail's dot is the count now (request 12): a room that wants you
    // says so on its tile, and nothing else counts the days you owe.
    expect(screen.getByRole("button", { name: /— your turn/ })).toBeTruthy();
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

  it("locks the picker while an answer of yours is sealed, and says so", () => {
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
    expect(screen.getByText(/locked while an answer of yours is sealed/i)).toBeTruthy();
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
    // The next round is also on screen and renders the same option words as
    // buttons, so a page-wide text search cannot tell the reveal's "Tea"
    // from today's. Every assertion below reads the reveal box alone —
    // and the reveal stands only while the next round is open and
    // unanswered (request 12, state 3), which is this.
    LIVE.social.roundInfo = () => ({ open: 2, next: 2, sealed: [], lead: 5 });
  });

  const revealBox = () => screen.getByTestId("ld-reveal").textContent || "";

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
    // …nor the ✓ the CALLED column wears on a read that landed.
    expect(within(screen.getByTestId("ld-reveal")).queryAllByLabelText("called it")).toHaveLength(0);
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
    expect(within(screen.getByTestId("ld-reveal")).getAllByLabelText("called it")).toHaveLength(2);
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

describe("LiveDuelPanel · adding someone to a circle", () => {
  // BOTH reads reset per case. They are assigned per test and nothing
  // else puts them back, so without this a case that expects to find
  // nobody inherits the previous one's Ada.
  beforeEach(() => {
    LIVE.social.whoIs = vi.fn(async () => null);
    LIVE.social.searchPeople = vi.fn(async () => []);
  });
  const found = (rows: Array<{ uid: string; name: string; handle: string }>) => {
    LIVE.social.searchPeople = vi.fn(async () => rows);
  };

  // THE POINT OF D239. This screen was handle-only, which meant you
  // could add the friend whose address you had memorised and nobody
  // else.
  it("finds by name and invites the uid behind the row", async () => {
    found([{ uid: "u_ada", name: "Ada Lovelace", handle: "ada" }]);
    const invite = vi.fn(async (gid: string, to: string) => { void gid; void to; return { ok: true }; });
    LIVE.social.inviteToGroup = invite;
    LIVE.social.groups = () => [{ ...DUO, memberUids: ["u_me"] }];
    render(<LiveDuelPanel mode="duo" />);

    fireEvent.change(screen.getByPlaceholderText(/Name or @handle/i), { target: { value: "ada love" } });
    fireEvent.click(await screen.findByRole("button", { name: /Ada Lovelace/i }));
    await waitFor(() => expect(invite).toHaveBeenCalled());
    // The uid, never the name — the callable addresses accounts.
    expect(invite.mock.calls[0][1]).toBe("u_ada");
    expect(await screen.findByText(/Invited @ada/i)).toBeTruthy();
  });

  it("still resolves an exact handle, and folds it into one row", async () => {
    const whoIs = vi.fn(async () => "u_ada");
    LIVE.social.whoIs = whoIs;
    found([{ uid: "u_ada", name: "Ada Lovelace", handle: "ada" }]);
    LIVE.social.groups = () => [{ ...DUO, memberUids: ["u_me"] }];
    render(<LiveDuelPanel mode="duo" />);

    fireEvent.change(screen.getByPlaceholderText(/Name or @handle/i), { target: { value: "@Ada" } });
    await waitFor(() => expect(whoIs).toHaveBeenCalled());
    // Canonical on the way out: the registry is keyed on the fold, so
    // sending "@Ada" would look up a handle nobody holds.
    expect(whoIs).toHaveBeenCalledWith("ada");
    expect(screen.getAllByRole("button", { name: /Ada Lovelace/i })).toHaveLength(1);
  });

  // The failure this flow has that a code did not. It deliberately does
  // not distinguish "no such name" from "no such handle": to somebody
  // looking a person up those are one answer.
  it("says nobody matched rather than reporting a silent success", async () => {
    const invite = vi.fn(async (gid: string, to: string) => { void gid; void to; return { ok: true }; });
    LIVE.social.inviteToGroup = invite;
    LIVE.social.groups = () => [{ ...DUO, memberUids: ["u_me"] }];
    render(<LiveDuelPanel mode="duo" />);

    fireEvent.change(screen.getByPlaceholderText(/Name or @handle/i), { target: { value: "ghost" } });
    expect(await screen.findByText(/Nobody found for/i)).toBeTruthy();
    expect(invite, "an unmatched query still sent an invitation").not.toHaveBeenCalled();
  });

  // A row you may not tap is a worse answer than no row, and the server
  // would refuse this one with "already a member".
  // The circle's own members are filtered out of the results, so a row
  // the callable would refuse with "already a member" is never offered —
  // and a row you may not tap is a worse answer than no row. YOU are the
  // member every circle has, which is what this reaches: the duo below
  // has one member, and that member is the viewer.
  it("never offers somebody the circle already has", async () => {
    found([
      { uid: "u_me", name: "Me Myself", handle: "olaf" },
      { uid: "u_bea", name: "Bea Arthur", handle: "bea" },
    ]);
    LIVE.social.groups = () => [{ ...DUO, memberUids: ["u_me"] }];
    render(<LiveDuelPanel mode="duo" />);
    fireEvent.change(screen.getByPlaceholderText(/Name or @handle/i), { target: { value: "e" } });
    expect(await screen.findByRole("button", { name: /Bea Arthur/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Me Myself/i })).toBeNull();
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

    expect(screen.getByRole("button", { name: /^Ada$/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Bo — your turn/ })).toBeTruthy();
    // and no count above it: the tiles' dots are the count (request 12)
    expect(screen.queryByText(/to play/)).toBeNull();
  });

  it("offers a way to start another one without scrolling to the bottom", () => {
    render(<LiveDuelPanel mode="duo" />);
    expect(screen.getByRole("button", { name: /Start a new 1v1/i })).toBeTruthy();
  });

  it("draws no rail before there is anything to put on it", () => {
    // First run: the panel IS the create form, and a rail with one "+" on
    // it would be a frame around nothing.
    LIVE.social.groups = () => [];
    render(<LiveDuelPanel mode="group" />);
    expect(screen.queryByRole("button", { name: /Create a group/i })).toBeNull();
    openStart();
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
    openStart();
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
    openStart();
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
    openStart();

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

describe("LiveDuelPanel · the member list says you once (D244)", () => {
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
    LIVE.social.roundInfo = () => ({ open: 2, next: 2, sealed: [], lead: 5 });
  });

  const box = () => screen.getByTestId("ld-reveal");

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
    expect(screen.getByLabelText("How well you read Ada")).toBeTruthy();
    expect(screen.getByLabelText("How well Ada reads you")).toBeTruthy();
    // filled = called it, hollow = missed; each revealed dot opens its reveal
    expect(screen.getAllByRole("button", { name: /called it|missed/ })).toHaveLength(2);
  });

  it("scores nothing before a single round has revealed — the tail alone", () => {
    // No score is not a zero score. A sealed round is a ring in the run's
    // tail (request 12) and never a hollow dot, which would read as a miss.
    LIVE.social.myDuelVote = () => ({ optionIdx: 0 });
    LIVE.social.revealHistory = () => [];
    render(<LiveDuelPanel mode="duo" />);
    expect(screen.queryAllByRole("button", { name: /called it|missed/ })).toHaveLength(0);
    // …on both rows: the tail is the same rounds for you and for Ada.
    expect(screen.getAllByTitle("sealed · waiting on the others")).toHaveLength(2);
  });

  it("draws one run for a group — your calls on where the room lands", () => {
    LIVE.social.groups = () => [{ ...DUO, mode: "group", memberUids: ["u_me", "u_ada", "u_bo"] }];
    LIVE.social.myDuelVote = () => ({ optionIdx: 0 });
    LIVE.social.revealHistory = () => [hist("2026-08-12", 1, 0)];
    render(<LiveDuelPanel mode="group" />);
    // The group's one run is the cast's record since D435: a dot per vote
    // in the pack's ink, a square per rating — never the pair's two runs.
    expect(screen.getByLabelText(/The cast so far/)).toBeTruthy();
    expect(screen.queryByLabelText(/How well/)).toBeNull();
  });
});

describe("LiveDuelPanel · day history is bought, not assumed", () => {
  it("does not fetch older rounds just because the tab opened", () => {
    // REVEAL_HIST_CAP doc reads per circle per session, on the app's FIRST
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
    fireEvent.click(screen.getByRole("button", { name: /Load older rounds/i }));
    await waitFor(() => expect(load).toHaveBeenCalledWith("g1"));
  });

  // Dates RELATIVE TO NOW, not literals. The labels are a claim about how
  // long ago a day was, so a fixture pinned to August could only ever be
  // right on the day it was written — and it stayed green for months
  // because the labels ignored the date entirely, which is the defect.
  const dayAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

  it("browses back to a day through its dot, and back to today", () => {
    LIVE.social.myDuelVote = () => ({ optionIdx: 0 });
    LIVE.social.bankQ = () => ({ prompt: "Coffee or tea?", options: ["Coffee", "Tea"] });
    LIVE.social.revealHistory = () => [
      { day: dayAgo(1), qid: "duo-000", votes: { u_me: { optionIdx: 0 } }, names: { u_me: "Me" } },
      { day: dayAgo(2), qid: "duo-000", votes: { u_me: { optionIdx: 1 } }, names: { u_me: "Me" } },
    ];
    render(<LiveDuelPanel mode="duo" />);

    fireEvent.click(screen.getByRole("button", { name: /^2 days ago/ }));
    expect(screen.getByTestId("ld-reveal").textContent).toMatch(/2 days ago/);
    // …and the way back is on the card, not in the browser's back button.
    fireEvent.click(screen.getByRole("button", { name: "‹ back" }));
    expect(screen.queryByTestId("ld-reveal")).toBeNull();
    expect(screen.getByText("you: Coffee")).toBeTruthy();
  });

  it("counts a skipped day, rather than labelling by dot position", () => {
    // revealHistory COMPACTS. A day where only one of them played has no
    // reveal doc at all, so it is absent from the list rather than present
    // as a hole — and the dots index the list. Before this, the second dot
    // said "2 days ago" about a day five days old, and so did the card it
    // opened; every entry behind a gap was wrong by the size of the gap.
    LIVE.social.myDuelVote = () => ({ optionIdx: 0 });
    LIVE.social.bankQ = () => ({ prompt: "Coffee or tea?", options: ["Coffee", "Tea"] });
    LIVE.social.revealHistory = () => [
      { day: dayAgo(1), qid: "duo-000", votes: { u_me: { optionIdx: 0 } }, names: { u_me: "Me" } },
      // three days missing between these two
      { day: dayAgo(5), qid: "duo-000", votes: { u_me: { optionIdx: 1 } }, names: { u_me: "Me" } },
    ];
    render(<LiveDuelPanel mode="duo" />);

    const dot = screen.getByRole("button", { name: /^5 days ago/ });
    expect(dot, "the second dot is still labelled by its position").toBeTruthy();
    fireEvent.click(dot);
    const shown = screen.getByTestId("ld-reveal").textContent || "";
    expect(shown, "the card disagreed with the dot, or both counted positions").toMatch(/5 days ago/);
    expect(shown).not.toMatch(/2 days ago/);
  });
});

// ── create with people in it (D236) ────────────────────────────────
//
// The screen used to make an empty room and leave you to find a way to
// tell anyone. What these hold is the property the change exists for:
// the pick is what causes the invitation, and the invitation is what
// causes the notification — so a create that picked nobody must invite
// nobody, and a create that picked three must send one call carrying all
// three.

describe("LiveDuelPanel · creating with people picked", () => {
  beforeEach(() => {
    LIVE.social.groups = () => [];
    LIVE.social.whoIs = vi.fn(async () => null);
    LIVE.social.searchPeople = vi.fn(async () => []);
  });

  // Name OR handle since D239 — the picker was handle-only, so it could
  // add the friend whose address you had memorised and nobody else.
  const pick = async (handle: string, uid: string, name: string) => {
    LIVE.social.searchPeople = vi.fn(async () => [{ uid, name, handle }]);
    fireEvent.change(screen.getByPlaceholderText(/Who's coming/i), { target: { value: name } });
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(name, "i") }));
    await screen.findByRole("button", { name: new RegExp(`Remove @${handle}`, "i") });
  };

  it("invites everyone picked, in ONE call, with the uids behind the rows", async () => {
    const create = vi.fn(async () => ({ gid: "g9", inviteCode: "AAAA1111" }));
    const invite = vi.fn(async (gid: string, to: string | readonly string[]) => {
      void gid; void to;
      return { ok: true, invited: ["u_ada", "u_bea"], skipped: [] };
    });
    LIVE.social.createGroup = create;
    LIVE.social.inviteToGroup = invite;
    render(<LiveDuelPanel mode="group" />);
    openStart();

    await pick("ada", "u_ada", "Ada Lovelace");
    await pick("bea", "u_bea", "Bea Arthur");
    fireEvent.change(screen.getByPlaceholderText(/Group name/i), { target: { value: "Book Club" } });
    fireEvent.click(screen.getByRole("button", { name: /^Create$/ }));

    await waitFor(() => expect(invite).toHaveBeenCalled());
    // ONE call, not one per person: the server's budget charges per
    // recipient, so a loop here would be N round trips against a cap
    // that already counts them.
    expect(invite).toHaveBeenCalledTimes(1);
    expect(invite.mock.calls[0][0]).toBe("g9");
    expect(invite.mock.calls[0][1]).toEqual(["u_ada", "u_bea"]);
  });

  it("creates and invites nobody when nobody was picked", async () => {
    const create = vi.fn(async () => ({ gid: "g9", inviteCode: "AAAA1111" }));
    const invite = vi.fn(async () => ({ ok: true }));
    LIVE.social.createGroup = create;
    LIVE.social.inviteToGroup = invite;
    render(<LiveDuelPanel mode="group" />);
    openStart();
    fireEvent.change(screen.getByPlaceholderText(/Group name/i), { target: { value: "Book Club" } });
    fireEvent.click(screen.getByRole("button", { name: /^Create$/ }));
    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(invite, "an empty pick still notified somebody").not.toHaveBeenCalled();
  });

  it("says nobody matched rather than adding a uid-less chip", async () => {
    LIVE.social.searchPeople = vi.fn(async () => []);
    render(<LiveDuelPanel mode="group" />);
    openStart();
    fireEvent.change(screen.getByPlaceholderText(/Who's coming/i), { target: { value: "ghost" } });
    expect(await screen.findByText(/Nobody found for/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Remove/i })).toBeNull();
  });

  it("takes someone back off the list", async () => {
    render(<LiveDuelPanel mode="group" />);
    openStart();
    await pick("ada", "u_ada", "Ada Lovelace");
    fireEvent.click(screen.getByRole("button", { name: /Remove @ada/i }));
    expect(screen.queryByRole("button", { name: /Remove @ada/i })).toBeNull();
  });

  // A row you may not tap is a worse answer than no row.
  it("stops offering somebody already picked", async () => {
    render(<LiveDuelPanel mode="group" />);
    openStart();
    await pick("ada", "u_ada", "Ada Lovelace");
    LIVE.social.searchPeople = vi.fn(async () => [
      { uid: "u_ada", name: "Ada Lovelace", handle: "ada" },
    ]);
    fireEvent.change(screen.getByPlaceholderText(/Who's coming/i), { target: { value: "ada" } });
    expect(await screen.findByText(/Nobody found for/i)).toBeTruthy();
  });

  // A 1v1 has exactly one seat. An open field after the first pick would
  // invite a second person into a room that cannot hold them — the server
  // refuses it, but the screen should never have offered it.
  it("closes the field at the cap, which for a 1v1 is one person", async () => {
    render(<LiveDuelPanel mode="duo" />);
    openStart();
    expect(screen.getByPlaceholderText(/Who's coming/i)).toBeTruthy();
    await pick("ada", "u_ada", "Ada Lovelace");
    expect(screen.queryByPlaceholderText(/Who's coming/i)).toBeNull();
  });

  // The circle EXISTS by the time the invitations run. Reporting this as
  // a failed creation would send someone back to make a circle they
  // already have.
  it("says the circle was made when only the invitations failed", async () => {
    LIVE.social.createGroup = vi.fn(async () => ({ gid: "g9", inviteCode: "AAAA1111" }));
    LIVE.social.inviteToGroup = vi.fn(async () => { throw new Error("internal: too many invitations"); });
    render(<LiveDuelPanel mode="group" />);
    openStart();
    await pick("ada", "u_ada", "Ada Lovelace");
    fireEvent.change(screen.getByPlaceholderText(/Group name/i), { target: { value: "Book Club" } });
    fireEvent.click(screen.getByRole("button", { name: /^Create$/ }));
    expect(await screen.findByText(/Circle made/i)).toBeTruthy();
  });
});

// ── the code stops being something anyone reads or types (D238) ────
//
// D122 demoted the field to a fallback; this removes it. What made that
// worth doing is not tidiness: an invite code was a bearer token with no
// expiry and no rotation that admitted whoever held it with nobody's
// consent, sitting beside an invitation flow that exists precisely
// because joining a circle puts your name on an answer these people
// read the next day. Two doors, two rules.
//
// These pin the removal as well as the replacement, because the suite
// went green when the field came out — nothing had ever covered it, and
// a deletion no test can see is one that grows back.

describe("LiveDuelPanel · no code is read off one screen and typed into another", () => {
  beforeEach(() => {
    sessionStorage.clear();
    LIVE.social.groups = () => [];
  });
  afterEach(() => sessionStorage.clear());

  it("offers no way to type a code, and no door that opens one", () => {
    render(<LiveDuelPanel mode="group" />);
    expect(screen.queryByPlaceholderText(/invite code/i)).toBeNull();
    expect(screen.queryByText(/OR JOIN WITH A CODE/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /have an invite code/i })).toBeNull();
  });

  it("shows the invite button as what it does, not as eight characters", () => {
    LIVE.social.groups = () => [{ ...DUO, memberUids: ["u_me"], inviteCode: "ABCD2345" }];
    render(<LiveDuelPanel mode="duo" />);
    expect(screen.getByRole("button", { name: /Copy invite link/i })).toBeTruthy();
    expect(screen.queryByText("ABCD2345"), "the code was still on the screen").toBeNull();
  });
});

describe("LiveDuelPanel · a tapped invite link", () => {
  beforeEach(() => {
    sessionStorage.clear();
    LIVE.social.groups = () => [];
  });
  afterEach(() => sessionStorage.clear());

  // The link used to PREFILL A FIELD — the app had the invitation and
  // then asked you to confirm it by looking at characters it already
  // held. One button is the same act with the reading removed.
  // ASKS, not joins (D240). The link used to admit whoever held it —
  // a permanent bearer token beside a consent flow — so a forwarded one
  // put a stranger in the circle. Now it puts them forward.
  it("asks to join with the code it arrived with, and says who decides", async () => {
    sessionStorage.setItem("insight.pendingJoin", "ABCD2345");
    const ask = vi.fn(async (code: string, displayName?: string) => {
      void code; void displayName;
      return { gid: "g_new", name: "Book Club", status: "requested" as string };
    });
    LIVE.social.requestJoin = ask;
    render(<LiveDuelPanel mode="group" />);

    expect(screen.getByRole("button", { name: /Ask to join/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Ask to join/i }));
    await waitFor(() => expect(ask).toHaveBeenCalled());
    expect(ask.mock.calls[0][0]).toBe("ABCD2345");
    // The circle's half of the consent is a member tapping Let in, and
    // the asker is told that rather than left to wonder.
    expect(await screen.findByText(/has to let you in/i)).toBeTruthy();
  });

  // …AND WHEN THE LINK ARRIVES WITH THE SCREEN ALREADY OPEN.
  //
  // The panel read the stash once, in a `useState` initializer, which is
  // right for the ordinary case — the deep link opens the app and the panel
  // mounts after it. It is silently wrong for the other one: an invite
  // tapped while the Circle screen is already up stashes a code and
  // navigates to the tab the user is already on, so nothing remounts, the
  // initializer never runs again, and the invitation sits unread in
  // sessionStorage until something else happens to remount the panel.
  // Reproduced end to end before the subscription existed.
  it("shows an invitation that arrives while the screen is already open", async () => {
    const { stashJoinCode } = await import("../data/links");
    render(<LiveDuelPanel mode="group" />);
    expect(screen.queryByRole("button", { name: /Ask to join/i }), "the case started with one already pending").toBeNull();

    // The deep-link boot path, minus the navigation it does not need here:
    // the user is already on this tab, which is the whole point.
    stashJoinCode("ABCD2345");

    expect(await screen.findByRole("button", { name: /Ask to join/i }), "an invite arriving on an open screen was swallowed").toBeTruthy();
    // …and it is still read-and-clear: the stash must not keep re-firing it.
    expect(sessionStorage.getItem("insight.pendingJoin")).toBeNull();
  });

  // The one shortcut, and it is the circle having already consented:
  // somebody invited by handle who then taps the link is completing that
  // invitation, not opening a second queue behind it.
  it("completes an invitation the circle had already sent", async () => {
    sessionStorage.setItem("insight.pendingJoin", "ABCD2345");
    LIVE.social.requestJoin = vi.fn(async () => (
      { gid: "g_new", name: "Book Club", status: "joined" as string }
    ));
    render(<LiveDuelPanel mode="group" />);
    fireEvent.click(screen.getByRole("button", { name: /Ask to join/i }));
    // Names the invitation as the reason — an asker who is suddenly in
    // without being told why has no way to tell that from a bug.
    expect(await screen.findByText(/had an invitation to Book Club/i)).toBeTruthy();
    expect(screen.queryByText(/has to let you in/i)).toBeNull();
  });

  // A CLAIM, not a caption. Somebody arriving from a link has been told
  // nothing by the app yet, and what joining does is put their name on an
  // answer these people read — which is the whole reason D122 made
  // invitations consented.
  it("says what joining exposes before the tap, not after", () => {
    sessionStorage.setItem("insight.pendingJoin", "ABCD2345");
    render(<LiveDuelPanel mode="group" />);
    // THE AUDIENCE, and it has to be the real one. This pinned "revealed
    // with names to the people in it", which a revealed day is not:
    // `match /reveals/{day}` is `request.auth != null`, and rules.test.ts
    // asserts a stranger, a late joiner and somebody who left can each
    // read one. A consent sentence that understates who reads your answer
    // is worse than none, because it is the sentence somebody agrees on.
    expect(screen.getByText(/opens[\s\S]*with names, to anyone signed in who has the group\u2019s id/i)).toBeTruthy();
    expect(document.body.textContent, "the retired audience claim is back")
      .not.toMatch(/to the people in it/i);
  });

  it("takes no for an answer without joining anything", () => {
    sessionStorage.setItem("insight.pendingJoin", "ABCD2345");
    const ask = vi.fn(async () => ({ gid: "g_new", name: "Test", status: "requested" as string }));
    LIVE.social.requestJoin = ask;
    render(<LiveDuelPanel mode="group" />);
    fireEvent.click(screen.getByRole("button", { name: /Not now/i }));
    expect(screen.queryByRole("button", { name: /Ask to join/i })).toBeNull();
    expect(ask).not.toHaveBeenCalled();
  });

  // The card sits at the TOP of the panel rather than inside LdOnboard,
  // which for an account that already has circles renders at the end of
  // the rail — so the old field was four circles' worth of scrolling
  // below the invitation that had just opened the app.
  it("is reachable without scrolling past the circles you already have", () => {
    sessionStorage.setItem("insight.pendingJoin", "ABCD2345");
    LIVE.social.groups = () => [{ ...DUO, memberUids: ["u_me", "u_ada"] }];
    render(<LiveDuelPanel mode="duo" />);
    expect(screen.getByRole("button", { name: /Ask to join/i })).toBeTruthy();
  });

  it("draws nothing when no link was tapped", () => {
    render(<LiveDuelPanel mode="group" />);
    expect(screen.queryByRole("button", { name: /Ask to join/i })).toBeNull();
  });
});

// ── the circle's half of the consent (D240) ────────────────────────
//
// A link used to admit whoever held it. Now it puts them in `pending` on
// the group document, and a member decides. These hold the two halves a
// request queue is easy to get wrong: it has to be visible to members
// without a refresh, and declining must tell the asker nothing.

describe("LiveDuelPanel · people waiting to be let in", () => {
  const WAITING = {
    ...DUO, memberUids: ["u_me"],
    pending: ["u_ada"], pendingNames: { u_ada: "Ada Lovelace" },
  };

  it("names who is waiting, and offers both answers", () => {
    LIVE.social.groups = () => [WAITING];
    render(<LiveDuelPanel mode="duo" />);
    expect(screen.getByText(/Wants to join/i)).toBeTruthy();
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Let in$/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^No$/ })).toBeTruthy();
  });

  it("lets them in by uid, not by the name on the row", async () => {
    const approve = vi.fn(async (gid: string, uid: string) => { void gid; void uid; return { ok: true }; });
    LIVE.social.approveJoin = approve;
    LIVE.social.groups = () => [WAITING];
    render(<LiveDuelPanel mode="duo" />);
    fireEvent.click(screen.getByRole("button", { name: /^Let in$/ }));
    await waitFor(() => expect(approve).toHaveBeenCalled());
    expect(approve.mock.calls[0][0]).toBe("g1");
    expect(approve.mock.calls[0][1]).toBe("u_ada");
  });

  it("turns them down through the decline path, never the approve one", async () => {
    const approve = vi.fn(async () => ({ ok: true }));
    const decline = vi.fn(async (gid: string, uid: string) => { void gid; void uid; return { ok: true }; });
    LIVE.social.approveJoin = approve;
    LIVE.social.declineJoin = decline;
    LIVE.social.groups = () => [WAITING];
    render(<LiveDuelPanel mode="duo" />);
    fireEvent.click(screen.getByRole("button", { name: /^No$/ }));
    await waitFor(() => expect(decline).toHaveBeenCalled());
    expect(decline.mock.calls[0][1]).toBe("u_ada");
    expect(approve, "declining let somebody in").not.toHaveBeenCalled();
  });

  it("draws nothing when nobody is waiting", () => {
    LIVE.social.groups = () => [{ ...DUO, memberUids: ["u_me"] }];
    render(<LiveDuelPanel mode="duo" />);
    expect(screen.queryByText(/Wants to join/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /^Let in$/ })).toBeNull();
  });
});
