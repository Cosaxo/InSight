// @vitest-environment jsdom
//
// The demo roster's internal wiring. `IS_DATA.people` is not a list of names
// — it is a set of ids that four other tables key on, and every one of those
// tables fails SILENTLY on a miss:
//
//   · follows.js SEED      → FRIENDS.list().map(find) drops unknown ids
//   · duels-data GROUPS    → groupMembers() filters them out
//   · duels-data duoList   → duoIds() filters by FRIENDS.isFriend
//   · IS_FRIEND_TYPES      → sameType simply never matches
//
// A typo in any of them removes a person from a screen and leaves the screen
// looking fine, which is why this file exists at all: `tsc -b` does not see
// these files, check:globals is name-level, and the smoke tests mount the app
// with whatever roster they find. Nothing else here would notice.
//
// It also pins the size properties the roster was grown FOR (2026-08-11):
// surfaces that only behave differently at a population — a group big enough
// for a 'pick' verdict, a circle with people still to befriend, a duel record
// deep enough for the per-domain rows — need the fixture to keep providing
// them, or they go back to being untested.

import { describe, expect, it } from "vitest";

import { IS_DATA } from "../spec/sample-data.js";
import { IS_ARCHETYPES } from "../spec/archetype-data.js";
import { FRIENDS } from "../spec/follows.js";
import "../spec/mirror-field-pops.jsx"; // publishes MFP_SECTORS
import { DUELS } from "../spec/duels-data.js";

const people = IS_DATA.people;
const byId = new Map(people.map((p) => [p.id, p]));
// A thunk, not the binding, because every call site reads it lazily and
// this keeps that shape unchanged now the store is an import (D108).
const D = () => DUELS;

describe("the circle roster", () => {
  it("gives every person the fields its consumers read", () => {
    for (const p of people) {
      // init/hue draw the avatar, match is the field pop's radius (the DATA,
      // not decoration), name.split(' ')[0] is the label every surface uses.
      expect(typeof p.id, `id on ${p.name}`).toBe("string");
      expect(p.name, `name on ${p.id}`).toBeTruthy();
      expect(p.init, `init on ${p.id}`).toBeTruthy();
      expect(typeof p.hue, `hue on ${p.id}`).toBe("number");
      expect(p.match, `match on ${p.id}`).toBeGreaterThan(0);
      expect(p.match, `match on ${p.id}`).toBeLessThanOrEqual(100);
      expect(Array.isArray(p.interests), `interests on ${p.id}`).toBe(true);
    }
  });

  it("keeps ids unique across people and nearby", () => {
    // search-overlay concatenates the two lists and de-dupes by id, so a
    // collision there quietly hides one of the pair from search.
    const ids = [...people, ...IS_DATA.nearby].map((p) => p.id);
    expect(new Set(ids).size, "duplicate id in the roster").toBe(ids.length);
  });

  it("files every person under a sector the circle field draws", () => {
    // mirror-field-pops falls back to sector 0 for an unknown category, which
    // does not look like a bug — the node just lands in the wrong wedge.
    const sectors = Object.keys(globalThis.MFP_SECTORS);
    for (const p of people) {
      expect(sectors, `category "${p.category}" on ${p.id}`).toContain(p.category);
    }
    // and each wedge has someone in it, or the sector spread is decoration
    for (const s of sectors) {
      expect(people.some((p) => p.category === s), `no one in the ${s} sector`).toBe(true);
    }
  });

  it("gives every nearby stranger one of the three distance bands", () => {
    // The bands ARE the privacy promise (never an exact distance) and they
    // size the node; anything else silently takes the largest size.
    const BANDS = ["a few streets away", "in the neighbourhood", "a short ride away"];
    for (const n of IS_DATA.nearby) {
      expect(BANDS, `dist "${n.dist}" on ${n.id}`).toContain(n.dist);
    }
    for (const b of BANDS) {
      expect(IS_DATA.nearby.some((n) => n.dist === b), `no one ${b}`).toBe(true);
    }
  });

  it("counts the same circle the aggregate does", () => {
    // Two fixture fields describing one cohort: this list, and the aggregate
    // the comparison charts read (whose mbtiDist sums to the same n). They
    // are not rendered side by side today, which is exactly why they drifted
    // — the roster sat at 7 against an aggregate of 24 and nothing said so.
    // Grow one, grow the other.
    expect(people.length).toBe(IS_DATA.aggregates.circle.n);
  });
});

describe("the per-test type map", () => {
  it("covers every person, in every test", () => {
    for (const [testKey, map] of Object.entries(window.IS_FRIEND_TYPES)) {
      for (const p of people) {
        expect(map[p.id], `${p.id} (${p.name}) missing from IS_FRIEND_TYPES.${testKey}`).toBeTruthy();
      }
    }
  });

  it("names only types that exist", () => {
    // sameType compares these strings to the archetype the user landed on. A
    // name that matches no archetype matches no user either — it is not an
    // error, just a person who can never appear.
    for (const [testKey, map] of Object.entries(window.IS_FRIEND_TYPES)) {
      const names = new Set(IS_ARCHETYPES[testKey].list.map((a) => a.name));
      for (const [pid, type] of Object.entries(map)) {
        expect(names.has(type), `IS_FRIEND_TYPES.${testKey}.${pid} = "${type}" is not an archetype`).toBe(true);
      }
    }
  });

  it("maps nobody who is not in the roster", () => {
    for (const [testKey, map] of Object.entries(window.IS_FRIEND_TYPES)) {
      for (const pid of Object.keys(map)) {
        expect(byId.has(pid), `IS_FRIEND_TYPES.${testKey} types "${pid}", who is not in the roster`).toBe(true);
      }
    }
  });
});

describe("the seeded circle", () => {
  it("seeds only real people", () => {
    for (const id of FRIENDS.list()) {
      expect(byId.has(id), `follows.js seeds "${id}", who is not in the roster`).toBe(true);
    }
  });

  it("leaves people still to befriend", () => {
    // duoAvailable() and the invite → accept path both need a person who is
    // reachable and not yet yours. Seed everyone and both go untestable.
    const unfriended = people.filter((p) => !FRIENDS.isFriend(p.id));
    expect(unfriended.length, "every person is already a friend").toBeGreaterThan(0);
  });
});

describe("the seeded duels", () => {
  it("builds every group out of real people", () => {
    for (const g of D().groups()) {
      expect(g.members.length, `group "${g.name}" resolved no members`).toBeGreaterThan(0);
      for (const m of g.members) {
        expect(byId.has(m.id), `group "${g.name}" holds "${m.id}", who is not in the roster`).toBe(true);
      }
    }
  });

  it("keeps every group big enough for a verdict", () => {
    // groupQ slides off a 'pick' question when a group has fewer than two
    // named faces — the group still works, it just never asks the question
    // the group mode is for.
    for (const g of D().groups()) {
      expect(g.members.length, `group "${g.name}" is too small for a 'pick' day`).toBeGreaterThanOrEqual(2);
    }
    // …and one group is big enough that the option list has to lay out wide
    expect(Math.max(...D().groups().map((g) => g.members.length))).toBeGreaterThanOrEqual(5);
  });

  it("pairs 1v1s only with seeded friends", () => {
    const partners = D().partners();
    expect(partners.length, "no 1v1 partners seeded").toBeGreaterThan(0);
    for (const p of partners) {
      expect(byId.has(p.id), `1v1 with "${p.id}", who is not in the roster`).toBe(true);
      expect(FRIENDS.isFriend(p.id), `1v1 with ${p.name}, who is not a friend — duoIds() filters them out`).toBe(true);
    }
  });

  it("has friends left to start a 1v1 with", () => {
    expect(D().duoAvailable().length, "every friend already has a 1v1").toBeGreaterThan(0);
  });

  it("runs records deep enough for the per-domain rows", () => {
    // domainRows() hides a lens under DOMAIN_MIN (4 correct reads EACH way),
    // so a roster of short records renders the empty state forever and the
    // whole domain split goes unexercised. Measured when written: f1 shows
    // day/heat/mirror and reads weakest under pressure, f12 shows all three
    // and reads weakest on the everyday, f17 shows two with no clear weakest
    // — three different shapes, which is what makes the readout worth having.
    const withRows = D().partners().filter((p) => D().domainRows(p).length > 0);
    expect(withRows.length, "fewer than two partners have a domain row").toBeGreaterThanOrEqual(2);
    const weak = D().partners().map((p) => D().weakDomain(p)).filter(Boolean);
    expect(weak.length, "nobody reads you clearly worst anywhere — the gap readout has nothing to draw").toBeGreaterThan(0);
  });

  it("gives the impressions feed something to say", () => {
    // "where your people misread you" is built from revealed misses; with only
    // short records it is empty and the Map's People branch shows a fallback.
    expect(D().impressions().length).toBeGreaterThan(0);
  });
});
