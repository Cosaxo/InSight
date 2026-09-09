// @vitest-environment jsdom
//
// LgRoleMap — the room drawn as a cast (D435). The geometry is pinned in
// data/roleField.test.ts; what is pinned here is what a tap opens, that
// every node is reachable without a mouse, and that a person's card says
// no more than the reveals do.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { RoleVotes, RoleVoteRow } from "../data/groupCast";

vi.mock("../data/live", () => ({ default: { uid: "u_me" } }));
const { default: LgRoleMap } = await import("./LgRoleMap");

const HEIST = { id: "heist", label: "Bank Heist", hue: 25 };
const row = (key: string, label: string, prompt: string, votes: Record<string, number>, by: Record<string, string[]>, extra: Partial<RoleVoteRow> = {}): RoleVoteRow => {
  const order = Object.entries(votes).sort((a, b) => b[1] - a[1]);
  const top = order[0]?.[1] ?? 0;
  return {
    key, qid: key, round: 1, day: "2026-09-01", label, prompt, pack: HEIST, seat: "engine",
    votes, by, total: Object.values(votes).reduce((a, b) => a + b, 0),
    holders: order.filter(([, n]) => n === top).map(([u]) => u), second: null, contested: false, mine: null, ...extra,
  };
};
const RV: RoleVotes = {
  roles: [
    row("mind", "the mastermind", "Who plans it?", { u_ada: 3, u_bo: 1 }, { u_ada: ["u_me", "u_bo", "u_cy"], u_bo: ["u_ada"] }),
    row("wheel", "the getaway driver", "Who drives?", { u_bo: 2, u_me: 2 }, { u_bo: ["u_me", "u_ada"], u_me: ["u_bo", "u_cy"] }),
  ],
  packs: [HEIST],
};
const MEMBERS = [
  { id: "u_me", name: "You", me: true, seatLine: null },
  { id: "u_ada", name: "Ada Lovelace", me: false, seatLine: "the one who gets things going" },
  { id: "u_bo", name: "Bo", me: false, seatLine: null },
  { id: "u_cy", name: "Cy", me: false, seatLine: null },
];

afterEach(cleanup);

describe("LgRoleMap", () => {
  it("draws everyone and every held role as a reachable control", () => {
    render(<LgRoleMap gid="g1" gname="The Crew" rv={RV} members={MEMBERS} />);
    const map = screen.getByTestId("lg-role-map");
    const names = within(map).getAllByRole("button").map((b) => b.getAttribute("aria-label"));
    // you share the driver, so the line under your name is that role
    expect(names).toContain("You · the getaway driver");
    expect(names).toContain("Ada Lovelace · the one who gets things going");
    expect(names).toContain("Bo · the getaway driver");
    expect(names).toContain("Cy");
    expect(names).toContain("the mastermind · Ada Lovelace");
    expect(names).toContain("the getaway driver · Bo and you · shared");
    // the ring, once — the demo map mints `grWash-`, this one `lgWash-`
    expect(map.querySelectorAll('[id^="lgWash-"]').length).toBe(1);
  });

  it("opens a role onto who voted for whom, and again to close", () => {
    render(<LgRoleMap gid="g1" gname="The Crew" rv={RV} members={MEMBERS} />);
    const sat = screen.getByRole("button", { name: "the mastermind · Ada Lovelace" });
    fireEvent.click(sat);
    const card = screen.getByLabelText("the mastermind — the vote");
    expect(card.textContent).toMatch(/Who plans it\? · round 1/);
    expect(card.textContent).toMatch(/Ada Lovelace3 votes/);
    expect(card.textContent).toMatch(/Bo1 vote/);
    expect(sat.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(sat);
    expect(screen.queryByLabelText("the mastermind — the vote")).toBeNull();
  });

  it("opens a person onto the roles the room gave them, by keyboard too", () => {
    render(<LgRoleMap gid="g1" gname="The Crew" rv={RV} members={MEMBERS} />);
    fireEvent.keyDown(screen.getByRole("button", { name: /^Bo/ }), { key: "Enter" });
    const card = screen.getByLabelText("Bo — the roles");
    expect(card.textContent).toMatch(/how The Crew cast Bo/);
    expect(card.textContent).toMatch(/the getaway drivershared with you/);
    // a member the room has not cast says so, and claims nothing else
    fireEvent.click(screen.getByRole("button", { name: "Cy" }));
    expect(screen.getByLabelText("Cy — the roles").textContent).toMatch(/The Crew hasn't cast Cy yet/);
    expect(screen.queryByLabelText("Bo — the roles")).toBeNull();
  });

  it("says a seat as its line, never as its title", () => {
    render(<LgRoleMap gid="g1" gname="The Crew" rv={RV} members={MEMBERS} />);
    fireEvent.click(screen.getByRole("button", { name: /^Ada/ }));
    const card = screen.getByLabelText("Ada Lovelace — the roles");
    expect(card.textContent).toMatch(/the one who gets things going/);
    expect(card.textContent).not.toMatch(/the Engine/);
  });
});
