// Ported from design/spec-modules/relmap.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';
import { RMCore } from './relmap-core.js';
import { useDialog } from './primitives.jsx';

// RelationshipMap — a force-directed map of your people.
// You sit at the center; each circle (family, friends, work…) gathers around its
// own hub; members orbit their hub. Four lenses recolor the graph. Pan, zoom,
// drag a node to pin it, search to filter, tap a node for the full profile.
// Data + layout: relationship-map-core.js · panels: relationship-map-panels.jsx
(function () {
  const { DEFAULT_GROUPS, AGE_BANDS, ageBand, ageColor, statusMeta, yearsWord,
    politicalColor, personalityColor, politicalLabel, personalityLabel,
    P, groupDefs, buildGraph, defaultPeople } = RMCore;
  const { RMPersonPanel, RMHubPanel } = window;

  class RelationshipMap extends React.Component {
    constructor(props) {
      super(props);
      this.svgEl = null;
      this.drag = null;
      this.pointers = new Map();
      this.pinch = null;
      this.lastTap = null;
      this.state = {
        selectedId: null, hoveredId: null, hoveredLegend: null,
        query: '', mode: props.initialView || 'circles', lensAxis: null, layout: 'web',
        zoom: 1, panX: 0, panY: 0, positions: {}, focusGroup: null, searchOpen: false, drill: [],
        groups: this.applyNames(DEFAULT_GROUPS), people: this.applyRel(defaultPeople()),
        adding: false, newLabel: '', editing: false, dropGroup: null,
      };
      this.setSvg = (el) => { this.svgEl = el; };
      ['onPointerDown', 'onPointerMove', 'onPointerUp', 'onWheel'].forEach(m => { this[m] = this[m].bind(this); });
    }
    componentDidMount() {
      if (this.svgEl && !this.props.compact && !this.props.embedded) this.svgEl.addEventListener('wheel', this.onWheel, { passive: false });
      this._onWinResize = () => this.measure();
      window.addEventListener('resize', this._onWinResize);
      this.measure();
    }
    componentWillUnmount() {
      if (this.svgEl) this.svgEl.removeEventListener('wheel', this.onWheel);
      if (this._onWinResize) window.removeEventListener('resize', this._onWinResize);
    }

    // How many CSS px one graph unit draws at. Label sizes are authored in
    // graph units, so without this a name reads at 12px in one frame and 5px
    // in another purely because the viewBox is fitted differently. Measured
    // once the frame exists, then only on a real window resize.
    measure() {
      if (!this.svgEl) return;
      const r = this.svgEl.getBoundingClientRect();
      if (r.width < 20 || r.height < 20) { if ((this._mTries = (this._mTries || 0) + 1) < 30) setTimeout(() => this.measure(), 120); return; }
      const g = this.ensureGraph();
      const s = Math.min(r.width / g.W, r.height / g.H);
      if (s > 0 && Math.abs(s - (this.state.pxScale || 0)) > 0.004) this.setState({ pxScale: s });
    }

    // Keep the view from zooming out past its fitted size (zoom < 1) or being
    // panned until the graph leaves the frame. zoom 1 == the reset framing, so
    // the graph always fills the viewBox and can't drift off into empty space.
    clampView(zoom, panX, panY) {
      const g = this.ensureGraph();
      const z = Math.max(1, Math.min(4, zoom));
      const minPanX = g.W * (1 - z), minPanY = g.H * (1 - z);
      return {
        zoom: z,
        panX: Math.max(minPanX, Math.min(0, panX)),
        panY: Math.max(minPanY, Math.min(0, panY)),
      };
    }

    ensureGraph() {
      const st = this.state;
      const portrait = this.props.compact || this.props.embedded;
      const dv = RMCore.drillView(st.groups, st.people, st.drill);
      // Group membership must be in the signature: moving someone between circles
      // changes no person count and no name, so without this the graph is never
      // rebuilt and a reassignment silently does nothing.
      const gc = {}; st.people.forEach((p) => { gc[p.group] = (gc[p.group] || 0) + 1; });
      const gsig = Object.keys(gc).sort().map((k) => k + gc[k]).join(',');
      const sig = (this.props.compact ? 'c#' : this.props.embedded ? 'e#' : 'f#') + st.layout + '#' + st.groups.map(g => g.key + ':' + g.hue + ':' + g.label).join('|')
        + '#' + st.people.length + '/' + (st.people[0] || {}).name + '/' + (st.people[st.people.length - 1] || {}).name + '#' + (st.drill || []).join('>') + '#' + gsig;
      // Every frame here is a tall phone — lay the graph out portrait so it
      // fills the screen. (The full map used to build a 1000×680 landscape and
      // letterbox it into the middle third, which shrank the whole graph and
      // its labels to about 40% and left dead space above and below.)
      if (this._sig !== sig) {
        this._g = buildGraph(dv.groups, dv.people, 660, portrait ? 900 : 760, 0.05, this.props.compact ? 'web' : st.layout);
        this._g.G = groupDefs(dv.groups);
        this._g.drillLabel = dv.label; this._g.drillLevel = dv.level;
        this._sig = sig;
      }
      return this._g;
    }

    // a disc is a promise that the people inside are reachable — tapping one
    // goes down a level rather than selecting an aggregate you can't inspect
    drillInto(key) {
      if (key == null) return;
      this.setState(s => ({ drill: [...s.drill, key], zoom: 1, panX: 0, panY: 0, positions: {}, selectedId: null, hoveredLegend: null, focusGroup: null }));
    }
    drillOut() {
      this.setState(s => ({ drill: s.drill.slice(0, -1), zoom: 1, panX: 0, panY: 0, positions: {}, selectedId: null, hoveredLegend: null, focusGroup: null }));
    }
    setScale(n) {
      if (RMCore.setMapScale) RMCore.setMapScale(n);
      // applyRel here too (the prototype forgets it): the overrides persist by
      // NAME so a rebuilt roster can honour them, and a scale switch that snaps
      // a dragged person back to their default circle reads as a lost edit.
      this.setState({ people: this.applyRel(RMCore.peopleAtScale(n)), drill: [], positions: {}, selectedId: null, hoveredLegend: null, focusGroup: null, zoom: 1, panX: 0, panY: 0 });
    }
    newHue() {
      const used = this.state.groups.map(g => g.hue);
      const palette = [12, 128, 268, 50, 340, 95, 222, 175, 215, 62, 110, 290];
      for (const h of palette) { if (!used.some(u => Math.abs(((u - h + 540) % 360) - 180) > 166)) return h; }
      return Math.floor(Math.random() * 360);
    }
    startAdd() { this.setState({ adding: true, newLabel: '' }); }
    // ── relation = which wedge you sit in, set by dragging ────────────────────
    // The layout already places people by circle, so the map IS the control:
    // drop someone nearer another hub and that becomes how you know them. No
    // form, no dropdown, and the gesture teaches the map's own encoding.
    // Overrides persist by name; renames persist by key.
    LS_REL = 'insight.rmRelations.v1';
    loadRel() { try { return JSON.parse(localStorage.getItem('insight.rmRelations.v1') || '{}') || {}; } catch (e) { return {}; } }
    saveRel(patch) {
      const cur = this.loadRel();
      try { localStorage.setItem('insight.rmRelations.v1', JSON.stringify({ ...cur, ...patch })); } catch (e) { /* localStorage can throw: private mode, quota, disabled storage. Best-effort — the in-memory state stays correct. */ }
    }
    applyRel(people) {
      const by = this.loadRel().by || {};
      return people.map((p) => (by[p.name] ? { ...p, group: by[p.name] } : p));
    }
    applyNames(groups) {
      const names = this.loadRel().names || {};
      return groups.map((g) => (names[g.key] ? { ...g, label: names[g.key] } : g));
    }
    renameGroup(key, label) {
      const groups = this.state.groups.map((g) => (g.key === key ? { ...g, label } : g));
      this.setState({ groups });
      const names = { ...(this.loadRel().names || {}) }; names[key] = label;
      this.saveRel({ names });
    }
    // a person node at the top level — hubs, You, and drill views are not draggable
    canSetRelation(nodeId) {
      if (nodeId == null || nodeId === 0) return false;
      if ((this.state.drill || []).length) return false;
      const n = this.ensureGraph().byId[nodeId];
      return !!n && !n.isHub;
    }
    // Which circle does this point belong to? Considers hubs *and* their members,
    // so dropping onto a cluster of nodes counts as dropping on that circle —
    // the whole visible blob is the target, not just the hub dot.
    nearestHub(x, y) {
      const g = this._g; if (!g) return null;
      const P0 = this.state.positions;
      let best = null, bd = Infinity;
      g.nodes.forEach((n) => {
        if (n.id === 0) return;
        const p = P0[n.id] || n;
        // members count from a bit further out than their own radius
        const d = Math.hypot(p.x - x, p.y - y) - (n.isHub ? (n.r || 0) + 40 : (n.r || 0) + 10);
        if (d < bd) { bd = d; best = n; }
      });
      // no distance cap — whichever circle is nearest IS the target. A cap meant a
      // drop landing between clusters silently sprang back and read as broken.
      return best || null;
    }
    setRelation(nodeId, key) {
      const node = this.ensureGraph().byId[nodeId];
      if (!node || !key) return;
      const people = this.state.people.map((p) => (p.name === node.name ? { ...p, group: key } : p));
      const by = { ...(this.loadRel().by || {}) }; by[node.name] = key;
      this.saveRel({ by });
      // clearing the pins lets the layout carry them into their new wedge — the
      // move is the confirmation, so nothing has to say “saved”
      this.setState({ people, positions: {}, dropGroup: null, selectedId: null, hoveredLegend: null });
    }
    cancelAdd() { this.setState({ adding: false, newLabel: '' }); }
    confirmAdd() {
      const label = (this.state.newLabel || '').trim();
      if (!label) { this.setState({ adding: false, newLabel: '' }); return; }
      const key = 'g' + Date.now().toString(36);
      const groups = [...this.state.groups, { key, label, hue: this.newHue() }];
      this.setState({ groups, adding: false, newLabel: '', positions: {}, selectedId: null, hoveredLegend: null });
    }
    removeGroup(key) {
      if (this.state.groups.length <= 1) return;
      const groups = this.state.groups.filter(g => g.key !== key);
      const people = this.state.people.filter(p => p.group !== key);
      this.setState({ groups, people, positions: {}, selectedId: null, hoveredLegend: null, focusGroup: null });
    }

    // pointer / pan / zoom
    toUser(cx, cy) {
      const svg = this.svgEl; if (!svg || !svg.getScreenCTM) return { x: 0, y: 0 };
      const ctm = svg.getScreenCTM(); if (!ctm) return { x: 0, y: 0 };
      const inv = ctm.inverse();
      return { x: cx * inv.a + cy * inv.c + inv.e, y: cx * inv.b + cy * inv.d + inv.f };
    }
    onPointerDown(e) {
      if (this.props.compact) return;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinch = { d0: Math.hypot(b.x - a.x, b.y - a.y) || 1, zoom0: this.state.zoom };
        this.drag = null;
      } else if (this.pointers.size === 1) {
        const hit = e.target.closest && e.target.closest('[data-id]');
        const nodeId = hit ? parseInt(hit.getAttribute('data-id'), 10) : null;
        this.drag = { lastX: e.clientX, lastY: e.clientY, moved: 0, nodeId, pid: e.pointerId };
      }
      try { this.svgEl.setPointerCapture(e.pointerId); } catch (_) { /* pointer capture is best-effort; the browser refuses it for an already-released or foreign pointer. */ }
    }
    onPointerMove(e) {
      if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pinch && this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const d1 = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const u = this.toUser((a.x + b.x) / 2, (a.y + b.y) / 2);
        this.zoomAt(this.pinch.zoom0 * (d1 / this.pinch.d0), u.x, u.y);
        return;
      }
      const d = this.drag; if (!d) return;
      const dx = e.clientX - d.lastX, dy = e.clientY - d.lastY;
      d.lastX = e.clientX; d.lastY = e.clientY; d.moved += Math.abs(dx) + Math.abs(dy);
      const ctm = this.svgEl && this.svgEl.getScreenCTM ? this.svgEl.getScreenCTM() : null;
      const s = ctm ? ctm.a : 1;
      if (d.nodeId != null) {
        // only people can be moved at all, and only to change circle — dragging a
        // hub or You would otherwise let the layout be rearranged by hand
        if (!this.canSetRelation(d.nodeId)) {
          this.setState(this.clampView(this.state.zoom, this.state.panX + dx / s, this.state.panY + dy / s));
          return;
        }
        if (d.moved > 4) {
          const u = this.toUser(e.clientX, e.clientY);
          const { zoom, panX, panY } = this.state;
          const lx = (u.x - panX) / zoom, ly = (u.y - panY) / zoom;
          const positions = { ...this.state.positions, [d.nodeId]: { x: lx, y: ly } };
          const patch = { positions };
          const hub = this.nearestHub(lx, ly);
          const key = hub ? hub.group : null;
          d.dropKey = key;
          if (this.state.dropGroup !== key) patch.dropGroup = key;
          this.setState(patch);
        }
      } else {
        this.setState(this.clampView(this.state.zoom, this.state.panX + dx / s, this.state.panY + dy / s));
      }
    }
    onPointerUp(e) {
      this.pointers.delete(e.pointerId);
      try { this.svgEl.releasePointerCapture(e.pointerId); } catch (_) { /* pointer capture is best-effort; the browser refuses it for an already-released or foreign pointer. */ }
      if (this.pinch) { if (this.pointers.size < 2) this.pinch = null; this.drag = null; return; }
      const d = this.drag; if (!d) return;
      this.drag = null;
      // dropped in another circle — that IS the edit
      if (d.moved >= 5 && d.nodeId != null && d.dropKey && this.canSetRelation(d.nodeId)) {
        const node = this.ensureGraph().byId[d.nodeId];
        if (node && node.group !== d.dropKey) { this.setRelation(d.nodeId, d.dropKey); return; }
      }
      // Otherwise snap back. Distance from You encodes closeness, so a person
      // never keeps a hand-placed spot — only their circle is yours to change.
      if (d.nodeId != null && d.moved >= 5 && this.state.positions[d.nodeId]) {
        const positions = { ...this.state.positions }; delete positions[d.nodeId];
        this.setState({ positions, dropGroup: null });
      } else if (this.state.dropGroup) this.setState({ dropGroup: null });
      if (d.moved < 5) {
        if (d.nodeId != null) {
          this.lastTap = null;
          const node = this.ensureGraph().byId[d.nodeId];
          if (node && node.isHub && node.collapsed && this.state.drill.length < 4) this.drillInto(node.drillKey);
          else if (node && node.isHub && this.state.focusGroup !== node.group) this.focusOnGroup(node.group);
          else this.setState(s => ({ selectedId: s.selectedId === d.nodeId ? null : d.nodeId, hoveredLegend: null, query: '' }));
        } else {
          const now = Date.now(), lt = this.lastTap;
          if (lt && now - lt.t < 350 && Math.hypot(e.clientX - lt.x, e.clientY - lt.y) < 30) {
            this.lastTap = null;
            if (this.state.zoom > 2.6) this.setState({ zoom: 1, panX: 0, panY: 0, focusGroup: null });
            else { const u = this.toUser(e.clientX, e.clientY); this.zoomAt(this.state.zoom * 1.9, u.x, u.y); }
          } else {
            this.lastTap = { t: now, x: e.clientX, y: e.clientY };
            this.setState({ selectedId: null, hoveredLegend: null });
          }
        }
      }
    }
    zoomAt(nz, ux, uy) {
      const { zoom, panX, panY } = this.state;
      nz = Math.max(1, Math.min(4, nz));
      const gx = (ux - panX) / zoom, gy = (uy - panY) / zoom;
      this.setState(this.clampView(nz, ux - gx * nz, uy - gy * nz));
    }
    zoomStep(f) {
      const g = this.ensureGraph();
      this.zoomAt(this.state.zoom * f, g.W / 2, g.H / 2);
    }
    focusOnGroup(key) {
      const g = this.ensureGraph();
      if (g.groupHubId[key] == null) return;
      const ids = [g.groupHubId[key], ...g.groupMembers[key]];
      const pos = this.state.positions;
      let mnx = Infinity, mxx = -Infinity, mny = Infinity, mxy = -Infinity;
      ids.forEach(id => {
        const n = g.byId[id], p = pos[id] || { x: n.cx, y: n.cy };
        mnx = Math.min(mnx, p.x - n.r); mxx = Math.max(mxx, p.x + n.r);
        mny = Math.min(mny, p.y - n.r); mxy = Math.max(mxy, p.y + n.r);
      });
      const pad = 70;
      const z = Math.max(1.2, Math.min(3.4, Math.min(g.W / (mxx - mnx + pad * 2), g.H / (mxy - mny + pad * 2))));
      const cx = (mnx + mxx) / 2, cy = (mny + mxy) / 2;
      this.setState({ focusGroup: key, selectedId: null, hoveredLegend: null, ...this.clampView(z, g.W / 2 - cx * z, g.H / 2 - cy * z) });
    }
    onWheel(e) {
      e.preventDefault();
      const u = this.toUser(e.clientX, e.clientY);
      const { zoom, panX, panY } = this.state;
      const nz = Math.max(1, Math.min(4, zoom * (e.deltaY < 0 ? 1.12 : 0.893)));
      const gx = (u.x - panX) / zoom, gy = (u.y - panY) / zoom;
      this.setState(this.clampView(nz, u.x - gx * nz, u.y - gy * nz));
    }

    computeVals() {
      const g = this.ensureGraph();
      const G = g.G || groupDefs(this.state.groups);
      const st = this.state;
      const { selectedId, hoveredId, hoveredLegend, query, mode, zoom, panX, panY, positions } = st;
      const q = (query || '').trim().toLowerCase();

      const posOf = (id) => positions[id] || { x: g.byId[id].cx, y: g.byId[id].cy };
      // text in graph units → text at a fixed size on screen. Labels grow a
      // little as you zoom in (0.8) rather than tracking the zoom outright.
      const sc = st.pxScale || (this.props.embedded ? 0.5 : 0.55);
      const upx = (t) => t / sc / Math.max(1, zoom * 0.8);
      // ── test lenses: stable per-person values for the active test ──
      const RL = window.RMLenses;
      const isLens = RL && RL.TESTS[mode];
      let lensVals = null;
      if (isLens) {
        lensVals = {};
        g.nodes.forEach(n => {
          if (n.isHub) return;
          lensVals[n.id] = n.id === 0
            ? (RL.youVals(mode) || RL.personVals('You', mode, 3, 3))
            : RL.personVals(n.name, mode, n.political, n.personality);
        });
        g.nodes.forEach(n => {
          if (!n.isHub) return;
          const ids = g.groupMembers[n.group] || [];
          if (ids.length) { lensVals[n.id] = RL.meanVals(ids.map(id => lensVals[id]), mode); return; }
          const src = (g.groupPeople[n.group] || []).slice(0, 300);
          lensVals[n.id] = RL.meanVals(src.map(q => RL.personVals(q.name, mode, q.political, q.personality)), mode);
        });
      }
      const lensColor = (id) => {
        const vals = lensVals[id];
        if (st.lensAxis) return RL.axisColor(mode, vals[st.lensAxis]);
        return RL.TESTS[mode].typeOf(vals).color;
      };
      const colorOf = (n) => {
        if (isLens) return lensColor(n.id);
        if (n.isHub) {
          if (n.avgAge == null) return (G[n.group] || {}).color || P.ink3;
          if (mode === 'age') return ageColor(n.avgAge);
          return (G[n.group] || {}).color || P.ink3;
        }
        if (n.id === 0) {
          if (mode === 'age') return ageColor(n.age);
          return P.youDot;
        }
        if (mode === 'age') return ageColor(n.age);
        return (G[n.group] || {}).color || P.ink3;
      };
      const colorById = (id) => colorOf(g.byId[id]);

      let legend = [], legendTitle = 'Circles';
      const legendSets = {};
      if (mode === 'circles') {
        legendTitle = 'Circles';
        legend = Object.keys(g.groupMembers).map(key => {
          legendSets[key] = new Set([0, g.groupHubId[key], ...g.groupMembers[key]]);
          const gd = G[key] || {};
          return { key, label: gd.label || key, color: gd.color, count: g.groupCounts[key], removable: true };
        });
      } else if (mode === 'age') {
        legendTitle = 'Age';
        AGE_BANDS.forEach(b => {
          const ids = g.nodes.filter(n => n.id !== 0 && !n.isHub && ageBand(n.age) === b).map(n => n.id);
          legendSets[b.key] = new Set([0, ...ids]);
          legend.push({ key: b.key, label: b.label, color: b.color, count: ids.length });
        });
      } else if (isLens) {
        const T = RL.TESTS[mode];
        if (st.lensAxis) {
          const ax = T.axes.find(x => x.id === st.lensAxis);
          legendTitle = T.full + ' · ' + ax.label;
          RL.axisBands(mode, st.lensAxis).forEach(b => {
            const ids = g.nodes.filter(n => n.id !== 0 && !n.isHub && lensVals[n.id][st.lensAxis] >= b.lo && lensVals[n.id][st.lensAxis] < b.hi).map(n => n.id);
            legendSets[b.key] = new Set([0, ...ids]);
            legend.push({ key: b.key, label: b.label, color: b.color, count: ids.length });
          });
        } else {
          legendTitle = T.full + ' · type';
          T.types.forEach(t => {
            const ids = g.nodes.filter(n => n.id !== 0 && !n.isHub && T.typeOf(lensVals[n.id]).id === t.id).map(n => n.id);
            legendSets[t.id] = new Set([0, ...ids]);
            legend.push({ key: t.id, label: t.label, color: t.color, count: ids.length });
          });
        }
      }
      legend = legend.map(it => ({ ...it, rowOpacity: hoveredLegend == null || hoveredLegend === it.key ? 1 : 0.4 }));

      let matchSet = null, resultCount = 0;
      if (q) {
        matchSet = new Set([0]);
        g.nodes.forEach(n => { if (n.id !== 0 && !n.isHub && n.name.toLowerCase().includes(q)) { matchSet.add(n.id); resultCount++; } });
      }

      const activeId = hoveredId != null ? hoveredId : selectedId;
      let focus = null;
      if (matchSet) focus = matchSet;
      else if (activeId != null) focus = g.adj[activeId];
      else if (hoveredLegend != null) focus = legendSets[hoveredLegend];
      else if (st.focusGroup && g.groupHubId[st.focusGroup] != null) focus = new Set([0, g.groupHubId[st.focusGroup], ...g.groupMembers[st.focusGroup]]);
      const dimmed = focus != null;
      const lightEdge = P.rule;

      const nodes = g.nodes.map(n => {
        const p = posOf(n.id);
        const col = colorOf(n);
        const inFocus = !dimmed || focus.has(n.id);
        const isActive = n.id === activeId;
        const zoomNames = zoom >= 1.6;
        const labelShown = dimmed ? focus.has(n.id) : (g.keyNodes.has(n.id) || (zoomNames && !n.isHub && n.id !== 0));
        const showInit = (n.isHub || n.id === 0 || n.id === activeId) && (!dimmed || inFocus);
        return {
          id: n.id, name: n.name, cx: p.x, cy: p.y, r: n.r, hitR: Math.max(n.r + 16, 34 / zoom),
          fill: col, color: col, stroke: P.nodeStroke, strokeW: n.isHub ? 2 : 1.5,
          opacity: inFocus ? 1 : 0.12,
          ringR: n.r + (n.isHub ? 7 : 6), ringOpacity: isActive ? 0.9 : (n.isHub ? 0.4 : 0),
          labelX: n.ang != null ? p.x + Math.cos(n.ang) * (n.r + 19) : p.x,
          labelY: n.ang != null ? p.y + Math.sin(n.ang) * (n.r + 19) + 5 : p.y + n.r + (n.isHub ? 17 : 14),
          labelAnchor: n.ang == null ? 'middle' : (Math.cos(n.ang) > 0.35 ? 'start' : Math.cos(n.ang) < -0.35 ? 'end' : 'middle'),
          labelSize: n.isHub ? upx(n.collapsed ? 13 : 12) : upx(n.closeness >= 4 ? 11.5 : 10.5),
          labelWeight: n.isHub ? 700 : (isActive ? 700 : 500),
          labelFill: n.isHub ? col : P.ink2,
          // the centre node already says You inside it — no second label
          labelOpacity: (labelShown && n.id !== 0) ? 1 : 0,
          initials: n.initials,
          initSize: n.isHub ? (n.collapsed ? Math.min(n.r * 0.62, upx(21)) : Math.min(n.r * 0.9, upx(10))) : Math.max(9, n.r * 0.8),
          initOpacity: showInit ? 1 : 0,
        };
      });

      const edges = g.edges.map(e => {
        const a = posOf(e.a), b = posOf(e.b);
        const inFocus = !dimmed || (focus.has(e.a) && focus.has(e.b));
        const touchesActive = activeId != null && (e.a === activeId || e.b === activeId);
        const baseW = 0.6 + e.strength * 0.5;
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const dx = b.x - a.x, dy = b.y - a.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const sign = ((e.a + e.b) % 2) ? 1 : -1;
        const bow = (e.hub ? 0.10 : 0.16) * len * sign;
        const cpx = mx + (-dy / len) * bow, cpy = my + (dx / len) * bow;
        const d = 'M ' + a.x + ' ' + a.y + ' Q ' + cpx + ' ' + cpy + ' ' + b.x + ' ' + b.y;
        const hubW = g.discMode ? 1.6 : 0.7 + e.strength * 0.34;
        let stroke = lightEdge, width = e.hub ? hubW : baseW, opacity;
        if (!dimmed) opacity = st.layout === 'rings' ? (e.hub ? 0.10 : 0.05) : (e.hub ? (g.discMode ? 0.5 : 0.34) : (0.14 + e.strength * 0.06));
        else if (touchesActive) { stroke = colorById(activeId); width = baseW + 0.8; opacity = 0.82; }
        else if (inFocus) { width = e.hub ? hubW : baseW; opacity = e.hub ? 0.55 : 0.26; }
        else { width = 1; opacity = 0.04; }
        return { d, stroke, width, opacity };
      });

      let selected = null;
      if (selectedId != null && !g.byId[selectedId].isHub) {
        const s = g.byId[selectedId];
        const gd = G[s.group] || { label: s.group, color: P.ink3, tint: P.chipBg };
        const neighborIds = [...g.adj[selectedId]].filter(id => id !== selectedId && id !== 0 && !g.byId[id].isHub);
        const mutuals = neighborIds.slice(0, 12).map(id => ({ id, name: g.byId[id].name, color: colorById(id) }));
        const totalN = neighborIds.length;
        const sm = statusMeta(s.status);
        const pHue = Math.round((Math.abs([...String(s.name)].reduce((a, c) => a * 31 + c.charCodeAt(0), 7)) % 360));
        selected = {
          id: s.id, name: s.name, initials: s.initials, relationship: s.relationship, note: s.note,
          location: s.location, color: gd.color, tint: gd.tint, groupLabel: gd.label,
          politicalLabel: politicalLabel(s.political), personalityLabel: personalityLabel(s.personality),
          politicalColor: politicalColor(s.political), personalityColor: personalityColor(s.personality),
          // all four instruments, each in its own type's colour — the same reading
          // the test lenses use, so a person's standing never depends on the mode
          standings: ['big5', 'politics', 'values', 'social'].map((k) => {
            const T = RL.TESTS[k];
            const v = s.id === 0 ? (RL.youVals(k) || RL.personVals('You', k, 3, 3))
                                 : RL.personVals(s.name, k, s.political, s.personality);
            const ty = T.typeOf(v);
            return { k, label: T.label, value: ty.label, color: ty.color };
          }),
          yearsLabel: yearsWord(s.years), age: s.age, ageColor: ageColor(s.age), mutuals,
          lastLabel: s.id === 0 ? '—' : s.lastLabel,
          statusLabel: sm.label, statusColor: sm.color, statusTint: sm.tint,
          mutualLabel: s.id === 0 ? 'Everyone connects to you'
            : ((totalN === 1 ? '1 shared connection' : totalN + ' shared connections') + (totalN > 12 ? ' · showing 12' : '')),
          // active test lens → axis-by-axis comparison against you
          lensDetail: isLens ? (() => {
            const T = RL.TESTS[mode];
            return {
              title: T.full,
              personType: T.typeOf(lensVals[s.id]),
              rows: T.axes.map(a => ({
                id: a.id, label: a.label, lo: a.lo, hi: a.hi,
                v: lensVals[s.id][a.id], you: lensVals[0][a.id],
                color: RL.axisColor(mode, lensVals[s.id][a.id]),
              })),
              activeAxis: st.lensAxis,
            };
          })() : null,
          // a portable record so PersonOverlay can render this person's mind map
          personRecord: {
            id: 'rm:' + s.id, name: s.name, init: s.initials, hue: pHue,
            match: Math.round(56 + (Math.max(1, Math.min(5, s.closeness)) / 5) * 36),
            role: s.relationship, rel: s.relationship, age: s.age, dist: gd.label + ' circle',
          },
        };
      }

      let selectedHub = null;
      if (selectedId != null && g.byId[selectedId].isHub) {
        const h = g.byId[selectedId];
        const gd = G[h.group] || { label: h.group, color: P.ink3, tint: P.chipBg };
        const members = (g.groupMembers[h.group] || []).map(id => ({ id, name: g.byId[id].name, color: colorById(id) }));
        const cnt = g.groupCounts[h.group];
        selectedHub = {
          name: gd.label, color: gd.color, tint: gd.tint, count: cnt,
          countLabel: cnt + ' people in this circle',
          averages: [
            ...(isLens ? [{ label: RL.TESTS[mode].full, value: RL.TESTS[mode].typeOf(lensVals[selectedId]).label, color: RL.TESTS[mode].typeOf(lensVals[selectedId]).color }] : []),
            { label: 'Politics', value: politicalLabel(h.avgPolitical), color: politicalColor(h.avgPolitical) },
            { label: 'Personality', value: personalityLabel(h.avgPersonality), color: personalityColor(h.avgPersonality) },
            { label: 'Age', value: h.avgAge != null ? '~' + Math.round(h.avgAge) : '—', color: ageColor(Math.round(h.avgAge || 34)) },
          ],
          members, drillKey: h.drillKey,
          drillable: !!h.collapsed && (st.drill || []).length < 4,
          names: h.collapsed ? (g.groupPeople[h.group] || []).map(q => q.name) : null,
        };
      }

      const degOf = (id) => g.adj[id].size - 1;
      let big = Object.keys(g.groupMembers)[0];
      Object.keys(g.groupCounts).forEach(kk => { if (big && g.groupCounts[kk] > g.groupCounts[big]) big = kk; });
      let mostId = null;
      g.nodes.forEach(n => { if (n.id !== 0 && !n.isHub && (mostId == null || degOf(n.id) > degOf(mostId))) mostId = n.id; });
      const stats = [
        { label: 'Connections', value: '' + g.peopleCount },
        { label: 'Largest circle', value: big ? ((G[big] || {}).label || big) + ' · ' + g.groupCounts[big] : '—' },
        // "Most connected" needs peer nodes, which a disc view doesn't draw —
        // an em dash is not a statistic, so at scale it reports closeness instead
        g.discMode
          ? { label: 'Close ties', value: '' + Object.keys(g.groupPeople).reduce((s, k) => s + g.groupPeople[k].filter(q => q.closeness >= 4).length, 0) }
          : { label: 'Most connected', value: mostId != null ? g.byId[mostId].name + ' · ' + degOf(mostId) : '—' },
      ];

      const modes = [['circles', 'Circles'], ['age', 'Age'], ['big5', 'Big 5'], ['politics', 'Politics'], ['values', 'Values'], ['social', 'Social']];
      const lensAxes = isLens ? RL.TESTS[mode].axes : null;
      return {
        viewBox: '0 0 ' + g.W + ' ' + g.H,
        gTransform: 'translate(' + panX + ' ' + panY + ') scale(' + zoom + ')',
        nodes, edges, legend, legendTitle, modes, lensAxes,
        selected, hasSelected: selected != null, selectedHub,
        totalPeople: g.peopleCount, groupCount: Object.keys(g.groupMembers).length,
        stats,
        showStatsPanel: selected == null && selectedHub == null && zoom === 1 && !q && !st.focusGroup && !(st.drill || []).length,
        editable: mode === 'circles',
        hasQuery: q.length > 0, resultText: resultCount === 0 ? 'No matches' : (resultCount === 1 ? '1 match' : resultCount + ' matches'),
        showReset: zoom !== 1 || panX !== 0 || panY !== 0 || Object.keys(positions).length > 0,
        ringGuides: st.layout === 'rings' ? g.ringGuides : null, ringCenter: posOf(0),
        focusLabel: st.focusGroup && G[st.focusGroup] ? G[st.focusGroup].label : null,
        drillLabel: g.drillLabel, drillDepth: (st.drill || []).length, scale: RMCore.mapScale ? RMCore.mapScale() : 0,
      };
    }

    render() {
      return this.props.compact ? this.renderCompact() : this.renderFull();
    }

    // ── shared SVG graph ──
    graphSvg(v, compact) {
      return (
        <svg ref={this.setSvg}
          onPointerDown={this.onPointerDown} onPointerMove={this.onPointerMove} onPointerUp={this.onPointerUp}
          viewBox={v.viewBox} preserveAspectRatio="xMidYMid meet"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', touchAction: 'none', cursor: compact ? 'pointer' : 'grab', pointerEvents: compact ? 'none' : 'auto' }}>
          <g transform={v.gTransform}>
            {v.ringGuides && (
              <g>
                {v.ringGuides.map((r, i) => (
                  <circle key={'rg' + i} cx={v.ringCenter.x} cy={v.ringCenter.y} r={r} fill="none" stroke={P.ruleSoft} strokeWidth="1" opacity="0.9" />
                ))}
              </g>
            )}
            <g>
              {v.edges.map((e, i) => (
                <path key={i} d={e.d} fill="none" stroke={e.stroke} strokeWidth={e.width} strokeLinecap="round" opacity={e.opacity}
                  style={{ transition: 'opacity 0.3s ease, stroke 0.3s ease, stroke-width 0.2s ease' }} />
              ))}
            </g>
            <g>
              {v.nodes.map((n) => (
                <g key={n.id} data-id={n.id} opacity={n.opacity}
                  onMouseEnter={() => { if (!this.drag && !compact) this.setState({ hoveredId: n.id }); }}
                  onMouseLeave={() => { if (!this.drag && !compact) this.setState({ hoveredId: null }); }}
                  style={{ cursor: 'pointer', transition: 'opacity 0.3s ease' }}>
                  <circle cx={n.cx} cy={n.cy} r={Math.max(n.hitR, n.r + 15)} fill="transparent" stroke="none"></circle>
                  {n.id === 0 && <circle className="rm-you-pulse" cx={n.cx} cy={n.cy} r={n.r + 4} fill={n.fill}></circle>}
                  <circle cx={n.cx} cy={n.cy} r={n.ringR} fill="none" stroke={n.color} strokeWidth="1.5" opacity={n.ringOpacity} style={{ transition: 'opacity 0.25s ease' }} />
                  <circle cx={n.cx} cy={n.cy} r={n.r} fill={n.fill} stroke={n.stroke} strokeWidth={n.strokeW} style={{ transition: 'fill 0.3s ease' }} />
                  <text x={n.cx} y={n.cy} textAnchor="middle" dominantBaseline="central" fontFamily="var(--sans)" fontSize={n.initSize} fontWeight="600" fill="oklch(0.99 0.005 90)" opacity={n.initOpacity} style={{ pointerEvents: 'none', transition: 'opacity 0.25s ease' }}>{n.initials}</text>
                </g>
              ))}
            </g>
            {/* drop target — while a person is in hand, the circle they would land in
                is ringed, so the gesture is aimed rather than guessed */}
            {this.state.dropGroup && this.drag ? (() => {
              const hub = (this._g.nodes || []).find((x) => x.isHub && x.group === this.state.dropGroup);
              const vn = hub ? v.nodes.find((x) => x.id === hub.id) : null;
              if (!vn) return null;
              return (
                <circle cx={vn.cx} cy={vn.cy} r={vn.r + 30} fill="none" stroke={vn.color} strokeWidth="2.5"
                  strokeDasharray="6 6" opacity="0.95" style={{ pointerEvents: 'none' }}></circle>
              );
            })() : null}
            {/* labels last, and haloed — a circle name has to stay readable where
                it crosses its own cluster of dots */}
            <g style={{ pointerEvents: 'none' }}>
              {v.nodes.map((n) => (
                <text key={'l' + n.id} x={n.labelX != null ? n.labelX : n.cx} y={n.labelY} textAnchor={n.labelAnchor || 'middle'} fontFamily="var(--sans)"
                  fontSize={n.labelSize} fontWeight={n.labelWeight} fill={n.labelFill}
                  opacity={n.labelOpacity * n.opacity}
                  style={{ transition: 'opacity 0.25s ease', stroke: P.canvas, strokeWidth: n.labelSize * 0.34, strokeLinejoin: 'round', paintOrder: 'stroke' }}>{n.name}</text>
              ))}
            </g>
          </g>
        </svg>
      );
    }

    // ── compact inline preview ──
    renderCompact() {
      const v = this.computeVals();
      // Fit the viewBox tightly to the graph so the preview reads large, and
      // drop the micro-labels — at this scale they'd be unreadable anyway.
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      v.nodes.forEach(n => {
        minX = Math.min(minX, n.cx - n.r); maxX = Math.max(maxX, n.cx + n.r);
        minY = Math.min(minY, n.cy - n.r); maxY = Math.max(maxY, n.cy + n.r);
      });
      const pad = 22, legendRoom = 46; // extra room at the foot for the legend chips
      const cv = {
        ...v,
        viewBox: (minX - pad).toFixed(1) + ' ' + (minY - pad).toFixed(1) + ' ' + (maxX - minX + pad * 2).toFixed(1) + ' ' + (maxY - minY + pad * 2 + legendRoom).toFixed(1),
        gTransform: 'translate(0 0) scale(1)',
        nodes: v.nodes.map(n => (n.id === 0 ? { ...n, labelOpacity: 0, r: n.r * 1.25, initSize: 14 } : { ...n, labelOpacity: 0 })),
        // At preview scale the hub spokes vanish — boost them so the star
        // structure (You → circles → people) actually reads.
        edges: v.edges.map(e => ({ ...e, opacity: Math.min(0.7, e.opacity * 2.4), width: e.width + 0.5 })),
      };
      return (
        <button type="button" className="btn-bare" onClick={this.props.onOpen} aria-label="Open the circle map" style={{ position: 'relative', width: '100%', height: '100%', background: P.canvas, overflow: 'hidden', cursor: 'pointer', borderRadius: 'inherit' }}>
          {this.graphSvg(cv, true)}
          {/* legend chips, compact */}
          <div style={{ position: 'absolute', left: 14, bottom: 12, right: 14, display: 'flex', flexWrap: 'wrap', gap: '5px 12px', pointerEvents: 'none' }}>
            {v.legend.map(gp => (
              <span key={gp.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 11, fontWeight: 600, color: P.ink3 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: gp.color }}></span>{gp.label}
              </span>
            ))}
          </div>
          <div style={{ position: 'absolute', top: 13, right: 15, display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: P.faint, textTransform: 'uppercase', pointerEvents: 'none' }}>
            Explore <span style={{ fontSize: 13 }}>↗</span>
          </div>
        </button>
      );
    }

    // ── full overlay body ──
    renderFull() {
      const v = this.computeVals();
      const st = this.state;
      const SANS = "'Hanken Grotesk', sans-serif";
      const SERIF = "'Hanken Grotesk', sans-serif";
      const inputStyle = { border: '1px solid ' + P.rule, outline: 'none', background: P.card, borderRadius: 8, padding: '7px 10px', fontFamily: SANS, fontSize: 13, color: P.ink };
      const card = { background: P.card, border: '1px solid ' + P.cardBorder, boxShadow: P.shadow };
      const pillBg = { background: P.card, border: '1px solid ' + P.rule, boxShadow: P.shadow };
      const upLabel = { fontFamily: SANS, fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: P.ink3 };

      return (
        <div style={{ position: 'relative', width: '100%', height: '100%', background: P.canvas, fontFamily: SANS, color: P.ink, overflow: 'hidden', userSelect: 'none' }}>
          {this.graphSvg(v, false)}

          {/* close */}
          {this.props.onClose && (
            <button onClick={(e) => { e.stopPropagation(); this.props.onClose(); }} title="Close"
              style={{ position: 'absolute', top: 16, right: 16, zIndex: 9, width: 34, height: 34, borderRadius: '50%', border: '1px solid ' + P.rule, background: P.card, boxShadow: P.shadow, cursor: 'pointer', color: P.ink2, fontSize: 15, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          )}

          {/* heading — hidden when embedded in a tab */}
          {!this.props.embedded && (
            <div style={{ position: 'absolute', top: 17, left: 20, right: 62, pointerEvents: 'none' }}>
              <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: P.faint, marginBottom: 5 }}>Relationship map</div>
              <h1 style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 'clamp(22px, 5vw, 30px)', lineHeight: 1, margin: 0, letterSpacing: '-0.01em', color: P.inkName }}>Your People</h1>
            </div>
          )}

          {/* embedded: one quiet door to the full tool */}
          {this.props.embedded && (
            <button onClick={(e) => { e.stopPropagation(); if (window.openOverlay) window.openOverlay('relmap'); }}
              style={{ position: 'absolute', top: 12, right: 14, zIndex: 7, display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 100, border: '1px solid ' + P.rule, background: P.card, boxShadow: P.shadow, cursor: 'pointer', fontFamily: SANS, fontSize: 12, fontWeight: 700, color: P.ink2, whiteSpace: 'nowrap' }}>
              Full map <span style={{ fontSize: 13, lineHeight: 1 }}>↗</span></button>
          )}
          {this.props.embedded && (v.focusLabel || v.showReset || v.drillDepth > 0) && (
            <button onClick={(e) => { e.stopPropagation(); this.setState({ zoom: 1, panX: 0, panY: 0, positions: {}, focusGroup: null, drill: [] }); }}
              style={{ position: 'absolute', top: 12, left: 14, zIndex: 6, cursor: 'pointer', fontFamily: SANS, fontSize: 12, fontWeight: 600, padding: '7px 13px', borderRadius: 100, color: P.ink2, background: P.card, border: '1px solid ' + P.rule, boxShadow: P.shadow }}>{v.focusLabel ? '← All circles' : 'Reset view'}</button>
          )}

          {/* lenses + search + view controls — full overlay only */}
          {!this.props.embedded && (
          <div style={{ position: 'absolute', top: 70, left: 20, right: 20, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 6, alignItems: 'flex-start' }}>
            {st.searchOpen ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, borderRadius: 100, padding: '8px 14px', width: '100%', boxSizing: 'border-box', ...pillBg }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={P.ink3} strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7"></circle><line x1="16.5" y1="16.5" x2="21" y2="21"></line></svg>
                <input autoFocus value={st.query} onChange={(e) => this.setState({ query: e.target.value, selectedId: null })} placeholder="Search people…"
                  autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} inputMode="search" enterKeyHint="search"
                  style={{ border: 'none', outline: 'none', background: 'transparent', fontFamily: SANS, fontSize: 13.5, color: P.ink, flex: 1, minWidth: 0 }} />
                {v.hasQuery && <span style={{ fontFamily: SANS, fontSize: 12, color: P.ink3, whiteSpace: 'nowrap' }}>{v.resultText}</span>}
                <button onClick={(e) => { e.stopPropagation(); this.setState({ searchOpen: false, query: '' }); }} aria-label="Close search"
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: P.ink3, fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, width: '100%', boxSizing: 'border-box' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 2, borderRadius: 12, padding: 3, flex: 1, minWidth: 0, ...pillBg }}>
                  {v.modes.map(([k, lab]) => (
                    <button key={k} onClick={(e) => { e.stopPropagation(); this.setState({ mode: k, lensAxis: null, hoveredLegend: null }); }}
                      style={{ border: 'none', cursor: 'pointer', fontFamily: SANS, fontSize: 11, fontWeight: 600, padding: '7px 2px', borderRadius: 9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', background: st.mode === k ? P.ink : 'transparent', color: st.mode === k ? P.canvas : P.ink3, transition: 'background 0.2s ease, color 0.2s ease' }}>{lab}</button>
                  ))}
                </div>
                <button onClick={(e) => { e.stopPropagation(); this.setState({ searchOpen: true }); }} aria-label="Search people"
                  style={{ flex: 'none', width: 38, borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', ...pillBg }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={P.ink2} strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7"></circle><line x1="16.5" y1="16.5" x2="21" y2="21"></line></svg>
                </button>
              </div>
            )}
            {/* axis focus — default is the overall type; pick one axis to re-color the map along it */}
            {!st.searchOpen && v.lensAxes && (
              <div className="rm-axisrow" style={{ display: 'flex', gap: 5, width: '100%', boxSizing: 'border-box', overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
                {[{ id: null, label: 'Type' }, ...v.lensAxes].map((a) => (
                  <button key={a.id || 'type'} onClick={(e) => { e.stopPropagation(); this.setState({ lensAxis: a.id, hoveredLegend: null }); }}
                    style={{ flex: 'none', border: '1px solid ' + (st.lensAxis === a.id ? P.ink : P.rule), cursor: 'pointer', fontFamily: SANS, fontSize: 11.5, fontWeight: 600, padding: '5px 11px', borderRadius: 100, whiteSpace: 'nowrap', background: st.lensAxis === a.id ? P.ink : P.card, color: st.lensAxis === a.id ? P.canvas : P.ink3, boxShadow: P.shadow, transition: 'background 0.2s ease, color 0.2s ease' }}>{a.label}</button>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 2, borderRadius: 100, padding: 3, ...pillBg }}>
                {[['web', 'Web'], ['rings', 'Rings']].map(([k, lab]) => (
                  <button key={k} onClick={(e) => { e.stopPropagation(); if (st.layout !== k) this.setState({ layout: k, positions: {}, focusGroup: null, selectedId: null, zoom: 1, panX: 0, panY: 0 }); }}
                    style={{ border: 'none', cursor: 'pointer', fontFamily: SANS, fontSize: 11.5, fontWeight: 600, padding: '5px 11px', borderRadius: 100, background: st.layout === k ? P.ink : 'transparent', color: st.layout === k ? P.canvas : P.ink3, transition: 'background 0.2s ease, color 0.2s ease' }}>{lab}</button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 2, borderRadius: 100, padding: 3, ...pillBg }} title="Scale harness">
                {[['Real', 0], ['60', 60], ['300', 300], ['1200', 1200]].map(([lab, n]) => (
                  <button key={lab} onClick={(e) => { e.stopPropagation(); if (v.scale !== n) this.setScale(n); }}
                    style={{ border: 'none', cursor: 'pointer', fontFamily: SANS, fontSize: 11.5, fontWeight: 600, padding: '5px 10px', borderRadius: 100, background: v.scale === n ? P.ink : 'transparent', color: v.scale === n ? P.canvas : P.ink2 }}>{lab}</button>
                ))}
              </div>
              {v.drillDepth > 0 && (
                <button onClick={(e) => { e.stopPropagation(); this.drillOut(); }}
                  style={{ cursor: 'pointer', fontFamily: SANS, fontSize: 12.5, fontWeight: 600, padding: '7px 13px', borderRadius: 100, color: P.ink, ...pillBg }}>{'\u2190 '}{v.drillLabel}</button>
              )}
              {v.focusLabel && v.drillDepth === 0 && (
                <button onClick={(e) => { e.stopPropagation(); this.setState({ focusGroup: null, zoom: 1, panX: 0, panY: 0 }); }}
                  style={{ cursor: 'pointer', fontFamily: SANS, fontSize: 12.5, fontWeight: 600, padding: '7px 13px', borderRadius: 100, color: P.ink, ...pillBg }}>← All circles</button>
              )}
              {v.showReset && !v.focusLabel && (
                <button onClick={(e) => { e.stopPropagation(); this.setState({ zoom: 1, panX: 0, panY: 0, positions: {}, focusGroup: null }); }}
                  style={{ cursor: 'pointer', fontFamily: SANS, fontSize: 12.5, fontWeight: 600, padding: '7px 13px', borderRadius: 100, color: P.ink2, ...pillBg }}>Reset view</button>
              )}
            </div>
          </div>
          )}

          {/* zoom buttons */}
          {!this.props.embedded && !v.selected && !v.selectedHub && (
            <div style={{ position: 'absolute', right: 16, bottom: 216, display: 'flex', flexDirection: 'column', gap: 6, zIndex: 5 }}>
              {[['+', 1.35], ['−', 1 / 1.35]].map(([lab, f]) => (
                <button key={lab} onClick={(e) => { e.stopPropagation(); this.zoomStep(f); }} aria-label={lab === '+' ? 'Zoom in' : 'Zoom out'}
                  style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid ' + P.rule, cursor: 'pointer', fontSize: 17, lineHeight: 1, color: P.ink2, display: 'flex', alignItems: 'center', justifyContent: 'center', background: P.card, boxShadow: P.shadow }}>{lab}</button>
              ))}
            </div>
          )}

          {/* legend */}
          {!this.props.embedded && (
          <div onMouseLeave={() => this.setState({ hoveredLegend: null })} style={{ position: 'absolute', bottom: 28, left: 28, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
              <span style={{ ...upLabel, letterSpacing: '0.12em' }}>{v.legendTitle}</span>
              {v.editable && (
                <button className="tap44" onClick={(e) => { e.stopPropagation(); this.setState(s => ({ editing: !s.editing, adding: false })); }}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: SANS, fontSize: 12, fontWeight: 600, color: P.faint, padding: 0 }}>{st.editing ? 'Done' : 'Edit'}</button>
              )}
            </div>
            {v.legend.map(gp => (
              <div key={gp.key} onMouseEnter={() => this.setState({ hoveredLegend: gp.key, selectedId: null })}
                style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: gp.rowOpacity, transition: 'opacity 0.2s ease' }}>
                <span style={{ width: 11, height: 11, borderRadius: '50%', background: gp.color, flex: 'none' }}></span>
                {st.editing ? (
                  <input value={gp.label} onChange={(e) => this.renameGroup(gp.key, e.target.value)}
                    // stopPropagation on Escape: this field sits inside the
                    // relmap dialog, whose Escape closes the whole overlay.
                    // Leaving the rename should not also close the map.
                    onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); else if (e.key === 'Escape') { e.stopPropagation(); e.currentTarget.blur(); } }}
                    aria-label={'Rename ' + gp.label} autoComplete="off" autoCapitalize="words" enterKeyHint="done"
                    style={{ ...inputStyle, width: 132, fontSize: 13.5, fontWeight: 500, padding: '4px 8px' }} />
                ) : (
                  <span style={{ fontFamily: SANS, fontSize: 13.5, fontWeight: 500, color: P.ink2 }}>{gp.label}</span>
                )}
                {st.editing && gp.removable && st.groups.length > 1 && (
                  <button onClick={(e) => { e.stopPropagation(); this.removeGroup(gp.key); }} title="Remove circle"
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: P.faint, width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                )}
              </div>
            ))}
            {/* Relations are a fixed set — the six wedges ARE the map's geometry, so
                adding a seventh resizes every one of them and breaks cross-circle
                comparison. Renaming is free. Anything genuinely custom is a GROUP
                (The Crew, Book Club), which lives in duels-data.js, not here. */}
            {v.editable && st.editing && (
              <span style={{ fontFamily: SANS, fontSize: 11.5, lineHeight: 1.45, color: P.faint, marginTop: 4, maxWidth: 210 }}>Rename to suit you. Drag anyone on the map into another circle to change how you know them.</span>
            )}
          </div>
          )}

          {/* stats */}
          {v.showStatsPanel && !this.props.embedded && (
            <div style={{ position: 'absolute', bottom: 28, right: 26, display: 'flex', flexDirection: 'column', gap: 1, borderRadius: 13, padding: 5, width: 184, zIndex: 5, background: P.card, border: '1px solid ' + P.cardBorder, boxShadow: '0 2px 10px -6px rgba(60,45,30,0.18)' }}>
              {v.stats.map((s, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '5px 9px' }}>
                  <span style={{ fontFamily: SANS, fontSize: 12, color: P.ink3 }}>{s.label}</span>
                  <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, color: P.ink, textAlign: 'right' }}>{s.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* selected person panel */}
          {v.selected && <RMPersonPanel s={v.selected} onSelect={(id) => this.setState({ selectedId: id })} onClose={() => this.setState({ selectedId: null })} />}
          {/* selected hub panel */}
          {v.selectedHub && <RMHubPanel h={v.selectedHub} onSelect={(id) => this.setState({ selectedId: id })} onDrill={(k) => this.drillInto(k)} onClose={() => this.setState({ selectedId: null })} />}
        </div>
      );
    }

  }

  // ── overlay shell — full-bleed warm canvas with a floating close ──
  function RelationshipMapOverlay({ onClose }) {
    const dlg = useDialog(onClose, 'Your relationship map');
    return (
      <div className="overlay" {...dlg} style={{ background: 'oklch(0.985 0.002 255)' }}>
        <RelationshipMap onClose={onClose} />
      </div>
    );
  }

  Object.assign(window, { RelationshipMap, RelationshipMapOverlay });
})();

