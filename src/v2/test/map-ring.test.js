// @vitest-environment jsdom
//
// The Map's mainstream boundary — the ring drawn around You on the Mirror's
// innermost stop — is sized by the layout engine and drawn by the stylesheet,
// which is two halves that no other gate holds together:
//
//   · the arithmetic lives in map-layout.js and is not otherwise executed by
//     any test — the mount suites cannot reach it, because jsdom reports
//     clientWidth 0 and MapTab returns its empty shell before rendering the
//     ground at all;
//   · the wiring is a CSS custom property, which tsc, eslint and
//     check:globals are all blind to. Drop it and .mmt-ground::after falls
//     back to the 640px circle this change exists to remove — green tests,
//     old bug.
//
// So the cases below split accordingly: real assertions on the numbers, and a
// source-text pin on the three files that have to agree about `--ring`. The
// second kind proves the property is passed and read, NOT that it lands on
// screen; that would need a mount with stubbed element sizes, and the Mirror
// mount is already the slowest case in the suite (mount-app.jsx).

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
// The named export, not globalThis — the window copy left with the Map's
// lazy move (v28 §5).
import { MapTabLayout } from '../spec/map-layout.js';

const { mtClusterLayout } = MapTabLayout;

// A map of `nCats` branches holding `perCat` sub-topics, each with `subs`
// answers under it — the three levels MapTab actually builds. Typicality is
// spread across the range real answers use, since it is what pushes a dot off
// its cloud's radius.
function map(nCats, perCat, subs = 0) {
  const cats = [];
  const nodes = [];
  for (let c = 0; c < nCats; c++) {
    const id = 'cat' + c;
    cats.push({ id, label: 'Cat ' + c, hue: 30 * c });
    for (let k = 0; k < perCat; k++) {
      const kid = id + '-k' + k;
      nodes.push({ id: kid, parentId: id, daily: true, typ: 0.2 + 0.06 * ((k * 7) % 10) });
      for (let g = 0; g < subs; g++) {
        nodes.push({ id: kid + '-g' + g, parentId: kid, daily: true, typ: 0.3 + 0.05 * ((g * 3) % 10) });
      }
    }
  }
  return mtClusterLayout(nodes, cats);
}

const reachOf = ({ pos }) => Object.keys(pos)
  .filter((id) => id !== 'root')
  .reduce((m, id) => Math.max(m, Math.hypot(pos[id].x, pos[id].y)), 0);

describe('the map’s mainstream boundary', () => {
  it('grows with the constellation instead of standing still', () => {
    // The reported bug in one line: the ring was a constant while everything
    // around it scaled, so a two-branch map wore a full map’s circle.
    expect(map(2, 2, 2).ring).toBeLessThan(map(7, 6, 2).ring);
    expect(map(7, 6, 2).ring).toBeLessThan(map(12, 8, 2).ring);
  });

  it('shrinks the reported case well under the constant it replaces', () => {
    // The screenshot: two branches, seven answers, and a 640px circle running
    // to both edges of the canvas. Anything close to 640 here is that bug.
    expect(map(2, 2, 2).ring * 2).toBeLessThan(640 * 0.7);
  });

  it('leaves a filled-out map where it already was', () => {
    // 0.26 was chosen to land a full map on the old 640px circle, so this
    // change is invisible to anyone who has been answering for a while.
    // Widen the tolerance and the number stops saying anything.
    expect(map(9, 8, 2).ring).toBeGreaterThan(300);
    expect(map(9, 8, 2).ring).toBeLessThan(340);
  });

  it('never draws inside the profile ring, however little data there is', () => {
    // 205 is the layout’s own floor for a dot (step 4) and sits clear of the
    // anchor ring at 170 plus its labels. Below that the boundary stops being
    // a horizon and becomes a second circle inside the anchors. It is the
    // binding term up to about five branches, which is most maps.
    for (const [c, k, s] of [[1, 1, 0], [1, 3, 0], [2, 2, 2], [3, 3, 2], [5, 5, 1]]) {
      expect(map(c, k, s).ring, `${c} branches × ${k} × ${s}`).toBe(205);
    }
    // and an empty map, which reaches nothing at all
    expect(mtClusterLayout([], []).ring).toBe(205);
  });

  it('stays well inside the outermost thing on the map', () => {
    // The canvas fits itself to the reach, so a ring at or past it is the
    // balloon that filled the screen. Half the reach is already generous.
    for (const [c, k, s] of [[2, 2, 2], [5, 5, 1], [9, 8, 2]]) {
      const laid = map(c, k, s);
      expect(laid.ring, `${c} branches × ${k} × ${s}`).toBeLessThan(reachOf(laid) * 0.5);
    }
  });

  it('is wired from the layout through both maps to the stylesheet', () => {
    const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
    // The stylesheet doubles the radius, and keeps the old constant as the
    // fallback for a consumer that has not been told.
    expect(read('../styles.css')).toContain('calc(var(--ring, 320px) * 2)');
    // Both maps draw the same ground, and both must size it.
    for (const f of ['../spec/map-tab.jsx', '../spec/person-mindmap.jsx']) {
      expect(read(f), f).toContain('className="mmt-ground" style={{ \'--ring\': laid.ring + \'px\' }}');
    }
  });
});
