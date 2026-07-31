// Ported from design/spec-modules/relmap.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';

// RelationshipMap — a force-directed map of your people.
// You sit at the center; each circle (family, friends, work…) gathers around its
// own hub; members orbit their hub. Four lenses recolor the graph. Pan, zoom,
// drag a node to pin it, search to filter, tap a node for the full profile.
// Data + layout: relationship-map-core.js · panels: relationship-map-panels.jsx
(function () {
  const { DEFAULT_GROUPS, AGE_BANDS, ageBand, ageColor, statusMeta, yearsWord,
    politicalColor, personalityColor, politicalLabel, personalityLabel,
    P, groupDefs, buildGraph, defaultPeople } = window.RMCore;
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
        zoom: 1, panX: 0, panY: 0, positions: {}, focusGroup: null, searchOpen: false,
        groups: DEFAULT_GROUPS, people: defaultPeople(),
        adding: false, newLabel: '', editing: false,
      };
      this.setSvg = (el) => { this.svgEl = el; };
      ['onPointerDown', 'onPointerMove', 'onPointerUp', 'onWheel'].forEach(m => { this[m] = this[m].bind(this); });
    }
    componentDidMount() {
      if (this.svgEl && !this.props.compact && !this.props.embedded) this.svgEl.addEventListener('wheel', this.onWheel, { passive: false });
    }
    componentWillUnmount() {
      if (this.svgEl) this.svgEl.removeEventListener('wheel', this.onWheel);
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
      const sig = (this.props.compact ? 'c#' : this.props.embedded ? 'e#' : 'f#') + st.layout + '#' + st.groups.map(g => g.key + ':' + g.hue + ':' + g.label).join('|') + '#' + st.people.map(p => p.group + '/' + p.name).join(',');
      // Compact preview / embedded tab live in a tall phone-width frame — lay the
      // graph out portrait so it fills the frame instead of letterboxing a landscape fit.
      if (this._sig !== sig) { this._g = portrait ? buildGraph(st.groups, st.people, 660, 900, 0.05, this.props.compact ? 'web' : st.layout) : buildGraph(st.groups, st.people, 1000, 680, 0.012, st.layout); this._sig = sig; }
      return this._g;
    }

    newHue() {
      const used = this.state.groups.map(g => g.hue);
      const palette = [12, 128, 268, 50, 340, 95, 222, 175, 215, 62, 110, 290];
      for (const h of palette) { if (!used.some(u => Math.abs(((u - h + 540) % 360) - 180) > 166)) return h; }
      return Math.floor(Math.random() * 360);
    }
    startAdd() { this.setState({ adding: true, newLabel: '' }); }
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
        if (d.moved > 4) {
          const u = this.toUser(e.clientX, e.clientY);
          const { zoom, panX, panY } = this.state;
          const positions = { ...this.state.positions, [d.nodeId]: { x: (u.x - panX) / zoom, y: (u.y - panY) / zoom } };
          this.setState({ positions });
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
      if (d.moved < 5) {
        if (d.nodeId != null) {
          this.lastTap = null;
          const node = this.ensureGraph().byId[d.nodeId];
          if (node && node.isHub && this.state.focusGroup !== node.group) this.focusOnGroup(node.group);
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
      const G = groupDefs(this.state.groups);
      const st = this.state;
      const { selectedId, hoveredId, hoveredLegend, query, mode, zoom, panX, panY, positions } = st;
      const q = (query || '').trim().toLowerCase();

      const posOf = (id) => positions[id] || { x: g.byId[id].cx, y: g.byId[id].cy };
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
          if (n.isHub) lensVals[n.id] = RL.meanVals(g.groupMembers[n.group].map(id => lensVals[id]), mode);
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
          if (n.avgAge == null) return G[n.group].color;
          if (mode === 'age') return ageColor(n.avgAge);
          return G[n.group].color;
        }
        if (n.id === 0) {
          if (mode === 'age') return ageColor(n.age);
          return P.youDot;
        }
        if (mode === 'age') return ageColor(n.age);
        return G[n.group].color;
      };
      const colorById = (id) => colorOf(g.byId[id]);

      let legend = [], legendTitle = 'Circles';
      const legendSets = {};
      if (mode === 'circles') {
        legendTitle = 'Circles';
        legend = Object.keys(g.groupMembers).map(key => {
          legendSets[key] = new Set([0, g.groupHubId[key], ...g.groupMembers[key]]);
          return { key, label: G[key].label, color: G[key].color, count: g.groupMembers[key].length, removable: true };
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
          id: n.id, name: n.name, cx: p.x, cy: p.y, r: n.r, hitR: Math.max(n.r + 8, 22 / zoom),
          fill: col, color: col, stroke: P.nodeStroke, strokeW: n.isHub ? 2 : 1.5,
          opacity: inFocus ? 1 : 0.12,
          ringR: n.r + (n.isHub ? 7 : 6), ringOpacity: isActive ? 0.9 : (n.isHub ? 0.4 : 0),
          labelY: p.y + n.r + (n.isHub ? 17 : 14),
          labelSize: n.id === 0 ? 15 : (n.isHub ? 14 : Math.max(7.5, (n.closeness >= 4 ? 12.5 : 11.5) / Math.max(1, zoom * 0.72))),
          labelWeight: (n.id === 0 || n.isHub) ? 700 : (isActive ? 700 : 500),
          labelFill: n.isHub ? col : P.ink2,
          labelOpacity: labelShown ? 1 : 0,
          initials: n.initials, initSize: n.isHub ? 13 : Math.max(9, n.r * 0.8), initOpacity: showInit ? 1 : 0,
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
        let stroke = lightEdge, width = e.hub ? 1.1 : baseW, opacity;
        if (!dimmed) opacity = st.layout === 'rings' ? (e.hub ? 0.10 : 0.05) : (e.hub ? 0.34 : (0.14 + e.strength * 0.06));
        else if (touchesActive) { stroke = colorById(activeId); width = baseW + 0.8; opacity = 0.82; }
        else if (inFocus) { width = e.hub ? 1.1 : baseW; opacity = e.hub ? 0.4 : 0.26; }
        else { width = 1; opacity = 0.04; }
        return { d, stroke, width, opacity };
      });

      let selected = null;
      if (selectedId != null && !g.byId[selectedId].isHub) {
        const s = g.byId[selectedId];
        const gd = G[s.group];
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
        const gd = G[h.group];
        const members = g.groupMembers[h.group].map(id => ({ id, name: g.byId[id].name, color: colorById(id) }));
        const cnt = g.groupMembers[h.group].length;
        selectedHub = {
          name: gd.label, color: gd.color, tint: gd.tint, count: cnt,
          countLabel: cnt + ' people in this circle',
          averages: [
            ...(isLens ? [{ label: RL.TESTS[mode].full, value: RL.TESTS[mode].typeOf(lensVals[selectedId]).label, color: RL.TESTS[mode].typeOf(lensVals[selectedId]).color }] : []),
            { label: 'Politics', value: politicalLabel(h.avgPolitical), color: politicalColor(h.avgPolitical) },
            { label: 'Personality', value: personalityLabel(h.avgPersonality), color: personalityColor(h.avgPersonality) },
            { label: 'Age', value: h.avgAge != null ? '~' + Math.round(h.avgAge) : '—', color: ageColor(Math.round(h.avgAge || 34)) },
          ],
          members,
        };
      }

      const degOf = (id) => g.adj[id].size - 1;
      let big = Object.keys(g.groupMembers)[0];
      Object.keys(g.groupMembers).forEach(kk => { if (big && g.groupMembers[kk].length > g.groupMembers[big].length) big = kk; });
      let mostId = null;
      g.nodes.forEach(n => { if (n.id !== 0 && !n.isHub && (mostId == null || degOf(n.id) > degOf(mostId))) mostId = n.id; });
      const stats = [
        { label: 'Connections', value: '' + g.peopleCount },
        { label: 'Largest circle', value: big ? G[big].label + ' · ' + g.groupMembers[big].length : '—' },
        { label: 'Most connected', value: mostId != null ? g.byId[mostId].name + ' · ' + degOf(mostId) : '—' },
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
        showStatsPanel: selected == null && selectedHub == null && zoom === 1 && !q && !st.focusGroup,
        editable: mode === 'circles',
        hasQuery: q.length > 0, resultText: resultCount === 0 ? 'No matches' : (resultCount === 1 ? '1 match' : resultCount + ' matches'),
        showReset: zoom !== 1 || panX !== 0 || panY !== 0 || Object.keys(positions).length > 0,
        ringGuides: st.layout === 'rings' ? g.ringGuides : null, ringCenter: posOf(0),
        focusLabel: st.focusGroup && G[st.focusGroup] ? G[st.focusGroup].label : null,
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
                  <circle cx={n.cx} cy={n.cy} r={n.hitR} fill="transparent" stroke="none"></circle>
                  {n.id === 0 && <circle className="rm-you-pulse" cx={n.cx} cy={n.cy} r={n.r + 4} fill={n.fill}></circle>}
                  <circle cx={n.cx} cy={n.cy} r={n.ringR} fill="none" stroke={n.color} strokeWidth="1.5" opacity={n.ringOpacity} style={{ transition: 'opacity 0.25s ease' }} />
                  <circle cx={n.cx} cy={n.cy} r={n.r} fill={n.fill} stroke={n.stroke} strokeWidth={n.strokeW} style={{ transition: 'fill 0.3s ease' }} />
                  <text x={n.cx} y={n.cy} textAnchor="middle" dominantBaseline="central" fontFamily="var(--sans)" fontSize={n.initSize} fontWeight="600" fill="oklch(0.99 0.005 90)" opacity={n.initOpacity} style={{ pointerEvents: 'none', transition: 'opacity 0.25s ease' }}>{n.initials}</text>
                  <text x={n.cx} y={n.labelY} textAnchor="middle" fontFamily="var(--sans)" fontSize={n.labelSize} fontWeight={n.labelWeight} fill={n.labelFill} opacity={n.labelOpacity} style={{ transition: 'opacity 0.25s ease', pointerEvents: 'none' }}>{n.name}</text>
                </g>
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
        <button type="button" className="btn-bare" onClick={this.props.onOpen} aria-label="Explore your relationship map" style={{ position: 'relative', width: '100%', height: '100%', background: P.canvas, overflow: 'hidden', cursor: 'pointer', borderRadius: 'inherit' }}>
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
          {this.props.embedded && (v.focusLabel || v.showReset) && (
            <button onClick={(e) => { e.stopPropagation(); this.setState({ zoom: 1, panX: 0, panY: 0, positions: {}, focusGroup: null }); }}
              style={{ position: 'absolute', top: 12, left: 14, zIndex: 6, cursor: 'pointer', fontFamily: SANS, fontSize: 12, fontWeight: 600, padding: '7px 13px', borderRadius: 100, color: P.ink2, background: P.card, border: '1px solid ' + P.rule, boxShadow: P.shadow }}>{v.focusLabel ? '← All circles' : 'Reset view'}</button>
          )}

          {/* lenses + search + view controls — full overlay only */}
          {!this.props.embedded && (
          <div style={{ position: 'absolute', top: 70, left: 20, right: 20, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 6, alignItems: 'flex-start' }}>
            {st.searchOpen ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, borderRadius: 100, padding: '8px 14px', width: '100%', boxSizing: 'border-box', ...pillBg }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={P.ink3} strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7"></circle><line x1="16.5" y1="16.5" x2="21" y2="21"></line></svg>
                <input autoFocus value={st.query} onChange={(e) => this.setState({ query: e.target.value, selectedId: null })} placeholder="Search people…"
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
              {v.focusLabel && (
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
            <div style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: 6, zIndex: 5 }}>
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
                <button onClick={(e) => { e.stopPropagation(); this.setState(s => ({ editing: !s.editing, adding: false })); }}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: SANS, fontSize: 12, fontWeight: 600, color: P.faint, padding: 0 }}>{st.editing ? 'Done' : 'Edit'}</button>
              )}
            </div>
            {v.legend.map(gp => (
              <div key={gp.key} onMouseEnter={() => this.setState({ hoveredLegend: gp.key, selectedId: null })}
                style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: gp.rowOpacity, transition: 'opacity 0.2s ease' }}>
                <span style={{ width: 11, height: 11, borderRadius: '50%', background: gp.color, flex: 'none' }}></span>
                <span style={{ fontFamily: SANS, fontSize: 13.5, fontWeight: 500, color: P.ink2 }}>{gp.label}</span>
                {st.editing && gp.removable && st.groups.length > 1 && (
                  <button onClick={(e) => { e.stopPropagation(); this.removeGroup(gp.key); }} title="Remove circle"
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: P.faint, width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                )}
              </div>
            ))}
            {v.editable && st.editing && (st.adding ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <input value={st.newLabel} onChange={(e) => this.setState({ newLabel: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter') this.confirmAdd(); else if (e.key === 'Escape') this.cancelAdd(); }}
                  placeholder="Circle name…" style={{ ...inputStyle, width: 116 }} autoFocus />
                <button onClick={(e) => { e.stopPropagation(); this.confirmAdd(); }} style={{ border: 'none', background: P.ink, color: P.canvas, cursor: 'pointer', padding: '8px 13px', borderRadius: 8, fontFamily: SANS, fontSize: 13, fontWeight: 600 }}>Add</button>
                <button onClick={(e) => { e.stopPropagation(); this.cancelAdd(); }} title="Cancel" style={{ border: 'none', background: P.chipBg2, color: P.ink2, cursor: 'pointer', width: 31, height: 31, borderRadius: 8, fontSize: 16, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              </div>
            ) : (
              <button onClick={(e) => { e.stopPropagation(); this.startAdd(); }}
                style={{ display: 'flex', alignItems: 'center', gap: 7, border: '1px solid ' + P.faint, background: 'transparent', cursor: 'pointer', padding: '7px 12px', borderRadius: 9, color: P.ink3, fontFamily: SANS, fontSize: 13, fontWeight: 500, marginTop: 3, alignSelf: 'flex-start' }}>
                <span style={{ fontSize: 15, lineHeight: 1, marginTop: -1 }}>+</span>Add circle
              </button>
            ))}
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
          {v.selectedHub && <RMHubPanel h={v.selectedHub} onSelect={(id) => this.setState({ selectedId: id })} onClose={() => this.setState({ selectedId: null })} />}
        </div>
      );
    }

  }

  // ── overlay shell — full-bleed warm canvas with a floating close ──
  function RelationshipMapOverlay({ onClose }) {
    return (
      <div className="overlay" style={{ background: 'oklch(0.985 0.002 255)' }}>
        <RelationshipMap onClose={onClose} />
      </div>
    );
  }

  Object.assign(window, { RelationshipMap, RelationshipMapOverlay });
})();

