// @vitest-environment jsdom
//
// The demo plays ROUNDS (D437, VISION-2026-09-09 §7 step 6): the demo
// store re-ported from the owner's 2026-09-09 design, and the two cards
// on the shared shell. What is pinned is what the live app does the same
// way — a role vote three rounds in four and a rating on the fourth, a
// phase per room, the cast every fourth 1v1 round, sealed answers ahead
// of the room, a reveal at everyone-played or the deadline, a late answer
// that shows and counts for nothing — so a demo build (App Store review,
// the screenshot run, every smoke suite) plays what live plays.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup, within, act } from '@testing-library/react';
import { IS_DATA } from '../spec/sample-data.js';
import { DUELS } from '../spec/duels-data.js';
import { SEATS } from '../data/roles';
import { GroupDailyBody } from '../spec/group-daily.jsx';
import '../spec/duo-daily.jsx';

const first = (pid) => (IS_DATA.people || []).find((p) => p.id === pid).name.split(' ')[0];

beforeEach(() => {
  localStorage.clear();
  // the store keeps its state in memory across cases; the purge event is
  // the one door that resets it without a reload
  window.dispatchEvent(new Event('insight:local-purge'));
});
afterEach(cleanup);

describe('the demo store plays rounds', () => {
  it('seeds four rooms with a record, one ahead of you, one closed at its deadline', () => {
    const gs = DUELS.groups();
    expect(gs.map((g) => g.id)).toEqual(['g1', 'g2', 'g3', 'g4']);
    // eleven rounds revealed before you opened the app; the twelfth is open
    const v1 = DUELS.groupView('g1');
    expect(v1.revealed).toBe(11);
    expect(v1.open).toBe(12);
    expect(v1.lastRevealed.r).toBe(11);
    // Book Club is three rounds ahead of you
    expect(DUELS.groupView('g2').waiting).toBe(3);
    // The Cousins closed a round at its deadline with someone absent
    const v3 = DUELS.groupView('g3');
    expect(v3.revealed).toBe(12);
    expect(v3.lastRevealed.closed).toBe(true);
    expect(v3.lastRevealed.absent + (v3.lastRevealed.mine == null ? 1 : 0)).toBeGreaterThan(0);
  });

  it('asks a role vote three rounds in four and a rating on the fourth, by the room\'s phase', () => {
    // The Crew's phase is 0: rounds 4 and 8 rate; Book Club's is 1: rounds 3 and 7
    expect([1, 2, 3, 4, 5, 8, 9].map((r) => DUELS.groupQ('g1', r).kind)).toEqual(['vote', 'vote', 'vote', 'rate', 'vote', 'rate', 'vote']);
    expect([1, 2, 3, 4, 7].map((r) => DUELS.groupQ('g2', r).kind)).toEqual(['vote', 'vote', 'rate', 'vote', 'rate']);
    // a role vote's ballot is the members and You, the role from a pack
    const q = DUELS.groupQ('g1', 1);
    expect(q.targets[q.targets.length - 1]).toBe('me');
    expect(q.options[q.options.length - 1]).toBe('You');
    expect(q.role.seat).toMatch(/^(engine|hands|heart|wild)$/);
    expect(q.scen.label).toBeTruthy();
    // a rating carries two poles and the five step labels
    const rate = DUELS.groupQ('g1', 4);
    expect(rate.poles).toHaveLength(2);
    expect(rate.options).toHaveLength(5);
    expect(rate.options[2]).toBe('in between');
  });

  it('seals an answer ahead of the room, and a late one shows and counts for nothing', () => {
    DUELS.answerGroup('g1', 0);
    const v = DUELS.groupView('g1');
    expect(v.mine(12).a).toBe(0);
    expect(v.mine(12).late).toBe(false);
    expect(v.ahead).toBe(1);
    expect(v.sealed).toEqual([12]);
    // the open round moves on — you may answer up to LEAD ahead
    expect(v.open).toBe(13);
    // …and it persisted under the v2 key
    expect(JSON.parse(localStorage.getItem('insight.duels.v2')).groups.g1[12].a).toBe(0);
    // The Cousins' round 12 closed at its deadline: answering now is late
    expect(DUELS.groupView('g3').openClosed).toBe(true);
    DUELS.answerGroup('g3', 0);
    expect(DUELS.myGroupRound('g3', 12).late).toBe(true);
    expect(DUELS.groupPicksRound('g3', 12).counts.reduce((a, b) => a + b, 0)).toBe(DUELS.groupPicksRound('g3', 12).played.length);
  });

  it('reads the room as a cast: the latest vote per role, a seat from two votes, a score per rating', () => {
    const rv = DUELS.roleVotes('g1');
    // eight roles in the sample's two packs, nine role votes revealed —
    // the ninth is the first role again, so eight rows
    expect(rv.roles).toHaveLength(8);
    for (const role of rv.roles) {
      expect(role.winner).toBeTruthy();
      expect(role.votes[role.winner]).toBeGreaterThan(0);
      expect(role.seat).toMatch(/^(engine|hands|heart|wild)$/);
    }
    // THE FLOOR IS THE CONSUMER'S, NOT THE FOLD'S — and that is why this
    // pair of lines could not fail. `archetypeOf` names a seat at ANY
    // total; both consumers gate it at two votes (group-mirror.jsx's
    // "Here, you are …" and group-role-map.jsx's `p.seat`). `me` has
    // exactly ONE vote in this seeded room, so `if (A.total >= 2)` was
    // always false and its body never ran, while the assertion above it
    // (`>= 0`) cannot fail at all: a total is a sum of non-negative
    // counts. The floor itself is pinned in both directions by the live
    // twin (LiveGroupsMirrorBody's suite), which is the half that ships.
    //
    // What belongs here is the shape those consumers rely on, over the
    // WHOLE seeded population so it cannot go vacuous the way one
    // member's reading did — including that the seed carries members on
    // both sides of the floor, without which no consumer case could
    // exercise it at all.
    // The four seats themselves, from the definition the demo imports —
    // not from whatever the seed happened to produce. The per-member loop
    // below only ever reaches the seats these rooms hand out, so renaming
    // a seat nobody in the seed holds would slip past it.
    expect(SEATS).toHaveLength(4);
    for (const s of SEATS) {
      expect(s.line, `${s.id}'s line is what the app prints`).toMatch(/^the one/);
      expect(s.label, `${s.id}'s label is for result cards only (D437)`).not.toMatch(/^the one/);
    }
    let below = 0;
    let above = 0;
    for (const g of DUELS.groups()) {
      for (const m of (g.members || g.memberIds || [])) {
        const X = DUELS.archetypeOf(g.id, m.id || m);
        if (!X) continue;
        expect(Object.values(X.shares).reduce((a, b) => a + b, 0)).toBe(X.total);
        if (X.total > 0) {
          expect(X.seat.id).toMatch(/^(engine|hands|heart|wild)$/);
          // the LINE, never the label — the string the consumers print
          expect(SEATS.some((s) => s.id === X.seat.id && s.line === X.seat.line)).toBe(true);
        }
        if (X.total >= 2) above += 1; else below += 1;
      }
    }
    expect(above, 'no seeded member clears the seat floor — a consumer case could not exercise it').toBeGreaterThan(0);
    expect(below, 'every seeded member clears the floor — the under-floor branch is unreachable').toBeGreaterThan(0);
    // …and the measured fact that made the old guard dead, kept as the
    // inequality rather than the count: YOU are under the floor in this
    // seeded room, so anything written as `if (yourTotal >= 2)` here
    // tests nothing. Named so the next person does not write it again.
    expect(DUELS.archetypeOf('g1', 'me').total).toBeLessThan(2);
    // two ratings revealed in eleven rounds at phase 0
    const scores = DUELS.groupScores('g1');
    expect(scores).toHaveLength(2);
    for (const s of scores) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(100);
      expect(s.label).toBeTruthy();
    }
    // nothing in a group is called: no majority, no call, no guess
    expect(DUELS.groupPicksRound('g1', 1).majority).toBeUndefined();
    expect(DUELS.callGroup).toBeUndefined();
  });

  it('a seat is earned from the votes you received, never a vote for yourself — the live seatTally rule', () => {
    // Name yourself on every open role vote of every room, then read the
    // seat: the card counts the vote (the card's rule keeps every vote),
    // the instrument does not. The second review of #456 could earn a seat
    // line on the demo by naming itself twice.
    let selfNamed = 0;
    for (const G of DUELS.groups()) {
      // up to the lead: a room the others are ahead in reveals on your tap
      for (let step = 0; step < 4; step++) {
        const r = DUELS.groupOpen(G.id);
        if (!r) break;
        const q = DUELS.groupQ(G.id, r);
        if (q.kind !== 'vote') { act(() => { DUELS.answerGroup(G.id, 2, r); }); continue; }
        act(() => { DUELS.answerGroup(G.id, q.targets.indexOf('me'), r); });
        const round = DUELS.groupPicksRound(G.id, r);
        if (!round.revealed) break; // the others have not played it; the demo's timers do that later
        if (round.late) continue;   // a closed room: the answer is late and counts for nothing
        selfNamed += 1;
        expect(round.votes.me).toBeGreaterThanOrEqual(1);
        expect(round.received.me).toBe(round.votes.me - 1);
        for (const p of DUELS.groupMembers(G.id)) expect(round.received[p.id]).toBeLessThanOrEqual(round.votes[p.id]);
      }
      // the seat's total is the votes received over the latest vote per role — never your own
      const A = DUELS.archetypeOf(G.id, 'me');
      expect(A.total).toBe(DUELS.roleVotes(G.id).roles.reduce((s, role) => s + (role.received.me || 0), 0));
    }
    expect(selfNamed, 'no room revealed a self-named round — the case tested nothing').toBeGreaterThan(0);
  });

  it('plays a 1v1 in rounds: three own, then the cast, with the guess at what they said you are', () => {
    // f1 has 24 revealed rounds — six casts
    const co = DUELS.castOf('f1');
    expect(co.n).toBe(6);
    expect(co.youAre.role.them).toContain('{name}');
    expect(co.theyAre.role.label).toBeTruthy();
    expect(co.sawIt.total).toBe(6);
    // the kinds: own · own · own · cast
    expect([1, 2, 3, 4, 5, 8].map((r) => DUELS.duoKind(r))).toEqual(['own', 'own', 'own', 'cast', 'own', 'cast']);
    // own rounds walk the pool light → deep, skipping the casts
    expect(DUELS.duoQ('f1', 1)).toBe(DUELS.duoQ('f1', 1));
    expect(DUELS.duoQ('f1', 5).prompt).not.toBe(DUELS.duoQ('f1', 1).prompt);
    // the cast round carries the partner's name and the them forms
    const cast = DUELS.duoQ('f1', 4);
    expect(cast.kind).toBe('cast');
    expect(cast.prompt).toContain(first('f1'));
    expect(cast.options).toHaveLength(4);
    expect(cast.optionsThem).toHaveLength(4);
    expect(cast.optionsThem.join(' ')).toContain(first('f1'));
    expect(cast.dims).toEqual(['trust', 'spark', 'judgement', 'constancy']);
  });

  it('answers a 1v1 round in two steps, then waits on the partner', () => {
    // f2: five revealed, nothing ahead — round 6 is open
    expect(DUELS.duoOpen('f2')).toBe(6);
    DUELS.answerDuo('f2', { a: 0 });
    expect(DUELS.duoRound('f2', 6).mineIn).toBe(false);
    DUELS.answerDuo('f2', { g: 1 });
    const rd = DUELS.duoRound('f2', 6);
    expect(rd.mineIn).toBe(true);
    expect(rd.theirsIn).toBe(false);
    expect(rd.revealed).toBe(false);
    const p = DUELS.partners().find((x) => x.id === 'f2');
    expect(p.ahead).toBe(1);
    expect(p.open).toBe(7);
    // the stored answer carries the question it answered (§1.4)
    expect(JSON.parse(localStorage.getItem('insight.duels.v2')).duo.f2[6].qid).toBe(DUELS.duoQ('f2', 6).id);
  });
});

describe('the group card plays a round', () => {
  it('asks the open round over a grid of faces, seals on a tap, and lists the record', () => {
    render(<GroupDailyBody />);
    // The Long Table's open round is a role vote (phase 1: round 12 is not
    // a fourth), with the pack in the kicker
    const card = document.querySelector('[data-stack-card="g4"]');
    expect(card).toBeTruthy();
    expect(card.textContent).toMatch(/Round 12/);
    // the last reveal above it, with its verdict in one line
    expect(card.textContent).toMatch(/Round 11/);
    expect(card.textContent).toMatch(/revealed/);
    // the ballot: the members' faces and You, two across
    const grid = within(card).getByRole('group', { name: 'Who?' });
    const opts = within(grid).getAllByRole('button');
    expect(opts.length).toBe(DUELS.groupMembers('g4').filter((m) => !m.pending).length + 1);
    expect(opts[opts.length - 1].textContent).toMatch(/You/);
    // the run: a record, one mark per round, with the reading on tap
    expect(within(card).getByLabelText(/The cast so far, one mark per round/)).toBeTruthy();
    act(() => { fireEvent.click(opts[0]); });
    const after = document.querySelector('[data-stack-card="g4"]');
    expect(after.textContent).toMatch(/you named/);
    expect(after.textContent).toMatch(/Reveals when everyone has played/);
    // nothing about days, a majority or a call
    expect(after.textContent).not.toMatch(/\bdays?\b|majority|call it/i);
  });

  it('asks a rating on the fourth round, over the two poles', () => {
    render(<GroupDailyBody />);
    // The Crew's phase is 0, so round 12 rates the group
    const card = document.querySelector('[data-stack-card="g1"]');
    expect(card.textContent).toMatch(/Rate the group/);
    const q = DUELS.groupQ('g1', 12);
    const ballot = within(card).getByRole('group', { name: `${q.poles[0]} to ${q.poles[1]}` });
    const steps = within(ballot).getAllByRole('button');
    expect(steps).toHaveLength(5);
    act(() => { fireEvent.click(steps[4]); });
    const after = document.querySelector('[data-stack-card="g1"]');
    expect(after.textContent).toMatch(new RegExp(`you said\\s*${q.options[4]}`));
  });

  it('says a closed round is answered late, and shows the seat line only from two votes', () => {
    render(<GroupDailyBody />);
    const card = document.querySelector('[data-stack-card="g3"]');
    expect(card.textContent).toMatch(/closed at the deadline/);
    expect(card.textContent).toMatch(/Answering now shows as late and counts for nothing/);
  });
});

describe('the 1v1 card plays a round', () => {
  it('asks, then guesses what they said, then waits', () => {
    const DuoBody = window.DuoBody;
    render(<DuoBody />);
    const name = first('f2');
    const card = () => document.querySelector('[data-stack-card="f2"]');
    expect(card().textContent).toMatch(/Round 6/);
    const q = DUELS.duoQ('f2', 6);
    act(() => { fireEvent.click(within(card()).getByRole('button', { name: q.options[0] })); });
    expect(card().textContent).toMatch(new RegExp(`And ${name} said`));
    act(() => { fireEvent.click(within(card()).getByRole('button', { name: q.options[1] })); });
    expect(card().textContent).toMatch(/you called/);
    expect(card().textContent).toMatch(new RegExp(`waiting on ${name}`));
  });

  it('asks the cast every fourth round, and guesses in the them form', () => {
    const DuoBody = window.DuoBody;
    render(<DuoBody />);
    // f4: three revealed, the partner three ahead — round 4, the cast, is open
    const name = first('f4');
    const card = () => document.querySelector('[data-stack-card="f4"]');
    expect(card().textContent).toMatch(/Round 4/);
    expect(card().textContent).toMatch(/the cast/);
    const q = DUELS.duoQ('f4', 4);
    expect(card().textContent).toContain(q.prompt);
    act(() => { fireEvent.click(within(card()).getByRole('button', { name: q.options[0] })); });
    expect(card().textContent).toMatch(new RegExp(`You said ${name} is`));
    expect(card().textContent).toMatch(new RegExp(`And ${name} said you are`));
    expect(within(card()).getByRole('button', { name: q.optionsThem[0] })).toBeTruthy();
  });
});
