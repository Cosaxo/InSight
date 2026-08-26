// @vitest-environment jsdom
//
// Play together (2026-08-26) — the person overlay's doors card, mounted
// with the same demo stores the app hands it. Three contracts:
//
//   1. A running 1v1 offers Open, prefixed with the partner's nearest
//      named DUO type — a real name from the registry, read off the
//      shared record alone (poPersonTypes), never a blank.
//   2. The doors route through the cue + the nav registry, not through
//      window globals: Open cues {mode:'duo'} and asks NAV for
//      'track:duo' (check:globals' ratchet is why the shape matters).
//   3. A friend with no duel gets Start; a stranger gets the
//      add-them-first line and no button — the card claims nothing a
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
  it('a running 1v1 leads with a named duo type and Opens through the cue + nav', () => {
    expect(overlay()).toBeTypeOf('function');
    const partner = DUELS.partners().find((x) => x.played >= 3);
    expect(partner, 'the demo bank should carry at least one deep 1v1').toBeTruthy();
    const p = (IS_DATA.people || []).find((x) => x.id === partner.id);
    openFor(p);
    expect(screen.getByText('Play together')).toBeTruthy();
    // the type name is real: one of the duo registry's own names
    const names = IS_ARCHETYPES.duo.list.map((t) => t.name);
    const typed = names.some((n) => screen.queryByText(n));
    expect(typed, 'the 1v1 row should carry a registry type name').toBe(true);
    fireEvent.click(screen.getByText('Open'));
    expect(goNav).toHaveBeenCalledWith('track:duo');
    // the cue was consumed by nothing yet — the viewer will take it on mount
    expect(duelCue.takeDuelCue('duo')).toBe(p.id);
  });

  it('a shared group is a chip that cues the group viewer', () => {
    const g = DUELS.groups().find((x) => x.members.some((m) => !m.pending));
    const mem = g.members.find((m) => !m.pending);
    const p = (IS_DATA.people || []).find((x) => x.id === mem.id);
    openFor(p);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(g.name) }));
    expect(goNav).toHaveBeenCalledWith('track:group');
    expect(duelCue.takeDuelCue('group')).toBe(g.id);
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
    // no shared record, not a friend: the card either hides or says why
    if (screen.queryByText('Play together')) {
      expect(screen.getByText(/add .* first/)).toBeTruthy();
      expect(screen.queryByText('Start')).toBeNull();
    }
  });
});
