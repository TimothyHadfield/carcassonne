/* Computer players and the placement hints.
 *
 * evaluate() scores one move (spot, turn, meeple) as "expected points for me,
 * minus a share of what it hands the others". It looks one tile ahead only:
 * an unfinished city/road/monastery is worth its finished value times a rough
 * chance of finishing it, which falls with every open edge and with fewer
 * tiles left. Hints and the study mode use the same function as the Hard
 * computer, so "the best move" always means the same thing.
 *
 * Levels (strength measured by tools/sim.js, see progress.md):
 *   easy   - random legal spot, claims something about half the time
 *   medium - greedy: points now + its own unfinished features, ignores others
 *   hard   - the full evaluation below, farms included
 */
(function () {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const T = node ? require('./tiles.js') : self.CarcTiles;
  const E = node ? require('./engine.js') : self.CarcEngine;
  const TYPES = T.TYPES;

  const LEVELS = {
    medium: { opp: 0, farms: false, cityPer: 0.5, roadPer: 0.5, meeple: 1.5, flat: true },
    hard: { opp: 1, farms: true, cityPer: 0.58, roadPer: 0.72, meeple: 1, flat: false },
  };

  function pComplete(L, type, open, left) {
    if (open <= 0) return 1;
    if (left <= 0) return 0;
    if (L.flat) return 0.5;
    const per = type === 'city' ? L.cityPer : L.roadPer;
    return Math.pow(per, open - 1) * 0.85 * Math.min(1, left / (open * 4));
  }
  function cloisterEV(nb, left) {
    const miss = 8 - nb;
    if (!miss) return 9;
    const pc = Math.max(0, 1 - miss * 0.085) * Math.min(1, left / (miss * 3));
    return pc * 9 + (1 - pc) * (1 + nb);
  }
  function featureEV(st, L, type, tiles, sh, open, left) {
    if (type === 'road') {
      if (!open) return tiles;
      const pc = pComplete(L, 'road', open, left);
      return pc * (tiles + 0.6 * open) + (1 - pc) * tiles;
    }
    if (!open) return E.cityPoints(st, tiles, sh, true);
    const pc = pComplete(L, 'city', open, left);
    return pc * (2 * (tiles + 0.6 * open) + 2 * sh) + (1 - pc) * (tiles + sh);
  }
  // What a group is worth to p: own share minus (a weight of) the others' share.
  function rel(st, L, p, m, ev) {
    const w = E.winners(m);
    if (!w.length) return 0;
    const mine = w.includes(p) ? ev : 0;
    const others = (w.length - (mine ? 1 : 0)) * ev;
    return mine - L.opp * others / Math.max(1, st.n - 1);
  }
  function meepleCost(st, L, p, left) {
    const have = st.meeples[p];
    const scarce = have <= 1 ? 2.2 : have <= 3 ? 1.5 : 1;
    return L.meeple * (0.6 + 2.4 * left / 71) * scarce;
  }
  function fieldEV(st, L, cityRoots, newCityOpen, left) {
    let s = 0;
    for (const c of cityRoots) {
      const g = st.groups[c];
      s += g.done ? 1 : pComplete(L, 'city', g.open, left - 1) * 0.9;
    }
    for (const o of newCityOpen) s += o === 0 ? 1 : pComplete(L, 'city', o, left - 1) * 0.9;
    return 3 * s;
  }

  // Value of placing the tile in hand at (x,y,r) with a meeple on fi (-1 none),
  // from player p's point of view. A = E.analyze(...) can be passed in to reuse.
  function evaluate(st, p, x, y, r, fi, level, A) {
    const L = LEVELS[level || 'hard'];
    const t = st.cur, R = TYPES[t].rot[r];
    A = A || E.analyze(st, x, y, t, r);
    const left = st.bag.length;
    let v = 0;
    A.comps.forEach((C, ci) => {
      const mine = fi >= 0 && C.fis.includes(fi);
      const m = C.m.slice(); if (mine) m[p]++;
      if (C.type === 'city' || C.type === 'road') {
        let before = 0;
        for (const g of C.roots) {
          const G = st.groups[g];
          before += rel(st, L, p, G.m, featureEV(st, L, C.type, G.tiles.length, G.sh, G.open, left));
        }
        const after = rel(st, L, p, m, featureEV(st, L, C.type, C.tiles, C.sh, C.open, left - 1));
        v += after - before;
        if (C.open === 0) {           // finished now: meeples come straight back
          const back = m[p];
          v += back * meepleCost(st, L, p, left) * 0.5;
          if (mine) v += meepleCost(st, L, p, left);   // cancels the cost charged below
        }
      } else if (C.type === 'field' && L.farms && st.opts.farmers) {
        if (!mine && C.m.every((q) => q === 0)) return;
        const newCityOpen = C.cityFis.map((cf) => A.comps[A.featComp[cf]].open);
        let before = 0;
        for (const g of C.roots) {
          const G = st.groups[g];
          const roots = [...new Set(G.cities.map((c) => E.find(st, c)))];
          before += rel(st, L, p, G.m, fieldEV(st, L, roots, [], left));
        }
        const after = rel(st, L, p, m, fieldEV(st, L, C.cities, newCityOpen, left - 1));
        v += after - before;
        if (mine) v -= meepleCost(st, L, p, left) * 0.6;   // a farmer never comes back
      } else if (C.type === 'cloister' && mine) {
        v += cloisterEV(E.cloisterNeighbours(st, x, y), left - 1);
      }
    });
    if (fi >= 0) v -= meepleCost(st, L, p, left);
    // Neighbouring monasteries gain a tile.
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      if (!dx && !dy) continue;
      const ct = st.board[E.K(x + dx, y + dy)];
      if (!ct || !ct.m) continue;
      const f = TYPES[ct.t].rot[ct.r].feats[ct.m[1]];
      if (f.type !== 'cloister') continue;
      const nb = E.cloisterNeighbours(st, x + dx, y + dy);
      const gain = (nb + 1 === 8 ? 9 : cloisterEV(nb + 1, left - 1)) - cloisterEV(nb, left);
      const owner = ct.m[0];
      if (owner === p) v += gain + (nb + 1 === 8 ? meepleCost(st, L, p, left) * 0.5 : 0);
      else v -= L.opp * gain / Math.max(1, st.n - 1);
    }
    return v;
  }

  // Every legal move with its value. Used for hints, study mode and Hard/Medium.
  function rankMoves(st, p, level) {
    const out = [];
    for (const pl of E.legalPlacements(st)) {
      const A = E.analyze(st, pl.x, pl.y, st.cur, pl.r);
      const spots = E.meepleSpotsFor(st, pl.x, pl.y, st.cur, pl.r, p);
      for (const fi of [-1].concat(spots)) {
        out.push({ x: pl.x, y: pl.y, r: pl.r, fi, v: evaluate(st, p, pl.x, pl.y, pl.r, fi, level, A) });
      }
    }
    out.sort((a, b) => b.v - a.v);
    return out;
  }

  function choose(st, level, rand) {
    rand = rand || Math.random;
    const p = st.turn;
    if (level === 'easy') {
      const L = E.legalPlacements(st);
      const m = L[Math.floor(rand() * L.length)];
      const spots = E.meepleSpotsFor(st, m.x, m.y, st.cur, m.r, p)
        .filter((fi) => TYPES[st.cur].rot[m.r].feats[fi].type !== 'field');
      const fi = spots.length && rand() < 0.5 ? spots[Math.floor(rand() * spots.length)] : -1;
      return { type: 'place', x: m.x, y: m.y, r: m.r, fi };
    }
    const ranked = rankMoves(st, p, level);
    // Break exact ties at random so games differ.
    const top = ranked.filter((m) => m.v >= ranked[0].v - 1e-9);
    const m = top[Math.floor(rand() * top.length)];
    return { type: 'place', x: m.x, y: m.y, r: m.r, fi: m.fi };
  }

  const api = { evaluate, rankMoves, choose, LEVELS };
  if (node) module.exports = api;
  else self.CarcAI = api;
})();
