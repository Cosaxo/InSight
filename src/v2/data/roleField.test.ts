// roleField — the role map's geometry (D437). What matters is not where a
// dot lands but that everyone is placed, every held role hangs off its
// holder, a shared role sits between its two, and nothing lands on top of
// anything else.
import { describe, expect, it } from "vitest";
import { buildRoleField, FIELD_H, FIELD_W } from "./roleField";
import type { RoleVoteRow, RoleVotes } from "./groupCast";

const row = (key: string, holders: string[], extra: Partial<RoleVoteRow> = {}): RoleVoteRow => ({
  key, qid: key, round: 1, day: "2026-09-01", label: "the " + key, prompt: "Who?",
  pack: { id: "heist", label: "Bank Heist", hue: 25 }, seat: "engine",
  votes: Object.fromEntries(holders.map((h) => [h, 2])), by: {}, total: holders.length * 2,
  holders, second: null, contested: false, mine: null, ...extra,
});
const members = [
  { id: "u_me", name: "You", me: true, seatLine: null },
  { id: "a", name: "Ada", me: false, seatLine: "the one who gets things going" },
  { id: "b", name: "Bo", me: false, seatLine: null },
];

describe("buildRoleField", () => {
  it("places every member inside the frame, in a stable order", () => {
    const f = buildRoleField("g1", { roles: [], packs: [] }, members);
    expect(f.people.map((p) => p.id)).toEqual(["u_me", "a", "b"]);
    for (const p of f.people) {
      expect(p.x).toBeGreaterThan(0); expect(p.x).toBeLessThan(FIELD_W);
      expect(p.y).toBeGreaterThan(0); expect(p.y).toBeLessThan(FIELD_H);
    }
    // seeded, not random: the same room draws the same map
    const again = buildRoleField("g1", { roles: [], packs: [] }, members);
    expect(again.people.map((p) => [p.x, p.y])).toEqual(f.people.map((p) => [p.x, p.y]));
  });

  it("hangs a held role off its holder, and a contested one between the two", () => {
    const rv: RoleVotes = {
      roles: [
        row("mastermind", ["a"]),
        row("driver", ["b"], { contested: true, second: "u_me", votes: { b: 3, u_me: 2 } }),
        row("medic", ["a", "b"]),   // a tie: shared
      ],
      packs: [{ id: "heist", label: "Bank Heist", hue: 25 }],
    };
    const f = buildRoleField("g1", rv, members);
    expect(f.byId.a.roles.map((r) => r.key)).toEqual(["mastermind"]);
    expect(f.byId.a.shared.map((r) => r.key)).toEqual(["medic"]);
    expect(f.byId.b.shared.map((r) => r.key).sort()).toEqual(["driver", "medic"]);
    expect(f.byId.u_me.shared.map((r) => r.key)).toEqual(["driver"]);
    const driver = f.sats.find((s) => s.key === "driver")!;
    expect(driver.shared).toBe(true);
    expect(driver.holderIds).toEqual(["b", "u_me"]);
    // a solo satellite sits near its holder; a shared one near the midpoint
    const master = f.sats.find((s) => s.key === "mastermind")!;
    expect(Math.hypot(master.sx - f.byId.a.x, master.sy - f.byId.a.y)).toBeLessThan(60);
    const mid = { x: (f.byId.b.x + f.byId.u_me.x) / 2, y: (f.byId.b.y + f.byId.u_me.y) / 2 };
    expect(Math.hypot(driver.sx - mid.x, driver.sy - mid.y)).toBeLessThan(40);
  });

  it("keeps satellites apart and off the discs", () => {
    const rv: RoleVotes = {
      roles: ["r1", "r2", "r3", "r4", "r5"].map((k) => row(k, ["a"])),
      packs: [],
    };
    const f = buildRoleField("g1", rv, members);
    for (let i = 0; i < f.sats.length; i++) {
      for (let j = i + 1; j < f.sats.length; j++) {
        expect(Math.hypot(f.sats[i].sx - f.sats[j].sx, f.sats[i].sy - f.sats[j].sy)).toBeGreaterThan(12);
      }
      for (const p of f.people) {
        expect(Math.hypot(f.sats[i].sx - p.x, f.sats[i].sy - p.y)).toBeGreaterThan(p.rr + 6);
      }
    }
  });

  it("draws no satellite for a role whose holder has left the room", () => {
    const f = buildRoleField("g1", { roles: [row("mastermind", ["gone"])], packs: [] }, members);
    expect(f.sats).toEqual([]);
  });

  it("puts the seat line under a picked name, else the first role", () => {
    const f = buildRoleField("g1", { roles: [row("mastermind", ["b"])], packs: [] }, members);
    expect(f.byId.a.top).toBe("the one who gets things going");
    expect(f.byId.b.top).toBe("the mastermind");
    expect(f.byId.u_me.top).toBeNull();
  });
});
