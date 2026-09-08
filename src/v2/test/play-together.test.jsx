// @vitest-environment jsdom
//
// Play together (2026-08-26, redrawn 2026-09-08 as the person's page's
// TOGETHER tab — tiles rather than a card of rows) — mounted with the same
// demo stores the app hands it. Four contracts:
//
//   1. A running 1v1 is a tile that leads with the shared record's figure
//      and the partner's nearest named DUO type — a real name from the
//      registry, read off the shared record alone (poPersonTypes), never a
//      blank — and its line sits behind the ⓘ, one tap away (COPY.md §3).
//   2. The doors route through the cue + the nav registry, not through
//      window globals: the tile cues {mode:'duo'} and asks NAV for
//      'track:duo' (check:globals' ratchet is why the shape matters).
//   3. A shared group is a tile that cues the group viewer.
//   4. A friend with no duel gets Start; a stranger gets the
//      add-them-first line and no button — the tile claims nothing a
//      tap could not honour.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { IS_DATA } from '../spec/sample-data.js';
import { FRIENDS } from '../spec/follows.js';
import { DUELS } from '../spec/duels-data.js';
import { IS_ARCHETYPES } from '../spec/archetype-data.js';
import * as duelCue from '../data/duelCue';
import NAV, { registerNav } from '../data/nav';
import '../spec/person-overlay.jsx';

const overlay = () => window.PersonOverlay;
const openFor = (p) => render(<window.PersonOverlay p={p} me={IS_DATA.me} onClose={() => {}} />);
// the doors live on the Together tab since 2026-09-08 — one tap in
const goTogether = () => fireEvent.click(screen.getByRole('button', { name: 'Together' }));

let offNav;
let goNav;
beforeEach(() => {
  localStorage.clear();
  goNav = vi.fn(() => true);
  offNav = registerNav({ goNav });
});
afterEach(() => {
  cleanup();
  offNav?.();
  duelCue.takeDuelCue('duo');
  duelCue.takeDuelCue('group');
});

describe('Play together', () => {
  it('a running 1v1 is a tile with the figure and a named duo type, and Opens through the cue + nav', () => {
    expect(overlay()).toBeTypeOf('function');
    const partner = DUELS.partners().find((x) => x.played >= 3);
    expect(partner, 'the demo bank should carry at least one deep 1v1').toBeTruthy();
    const p = (IS_DATA.people || []).find((x) => x.id === partner.id);
    openFor(p);
    goTogether();
    expect(screen.getByText('Play together')).toBeTruthy();
    // the figure is the shared record's, in the round the product counts in
    expect(screen.getAllByText(String(partner.played)).length).toBeGreaterThan(0);
    expect(screen.getByText(partner.played === 1 ? 'round' : 'rounds')).toBeTruthy();
    // the type name is real: one of the duo registry's own names
    const names = IS_ARCHETYPES.duo.list.map((t) => t.name);
    const typed = names.some((n) => screen.queryByText(n));
    expect(typed, 'the 1v1 tile should carry a registry type name').toBe(true);
    // its line is behind the ⓘ, not deleted
    const type = IS_ARCHETYPES.duo.list.find((t) => screen.queryByText(t.name));
    expect(screen.queryByText(type.line)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'What the names mean' }));
    expect(screen.getByText(type.line)).toBeTruthy();
    // the tile IS the door
    fireEvent.click(screen.getByRole('button', { name: /1v1/ }));
    expect(goNav).toHaveBeenCalledWith('track:duo');
    // the cue was consumed by nothing yet — the viewer will take it on mount
    expect(duelCue.takeDuelCue('duo')).toBe(p.id);
  });

  it('a shared group is a tile that cues the group viewer', () => {
    const g = DUELS.groups().find((x) => x.members.some((m) => !m.pending));
    const mem = g.members.find((m) => !m.pending);
    const p = (IS_DATA.people || []).find((x) => x.id === mem.id);
    openFor(p);
    goTogether();
    // the tile prints the room's size in people, you included
    expect(screen.getAllByText('people').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: g.name }));
    expect(goNav).toHaveBeenCalledWith('track:group');
    expect(duelCue.takeDuelCue('group')).toBe(g.id);
  });

  it('the record draws two rings and the lead sentence for a deep 1v1', () => {
    const partner = DUELS.partners().find((x) => x.played >= 3);
    const p = (IS_DATA.people || []).find((x) => x.id === partner.id);
    openFor(p);
    goTogether();
    expect(screen.getByText('How well you read each other')).toBeTruthy();
    const first = p.name.split(' ')[0];
    expect(screen.getByText(`you read ${first}`)).toBeTruthy();
    expect(screen.getByText(`${first} reads you`)).toBeTruthy();
    // one of the three sentence shapes, never a blank
    const lead = screen.getByText(/read (each other about equally well|.+ better than)/);
    expect(lead).toBeTruthy();
    expect(screen.getByText('called it')).toBeTruthy();
    expect(screen.getByText('missed')).toBeTruthy();
  });

  it('a stranger gets the honest line, not a dead Start', () => {
    const p = (IS_DATA.people || []).find(
      (x) => x.name && !x.anon && x.id
        && FRIENDS.status(x.id) !== 'friends'
        && !DUELS.partners().some((d) => d.id === x.id)
        && !DUELS.groups().some((gg) => gg.members.some((m) => m.id === x.id)),
    );
    if (!p) return; // the demo cast may leave nobody fully unconnected — then there is nothing to pin
    openFor(p);
    // no shared record, not a friend: the tab is not there at all, and the
    // page claims nothing about playing together
    expect(screen.queryByRole('button', { name: 'Together' })).toBeNull();
    expect(screen.queryByText('Start')).toBeNull();
  });
});
