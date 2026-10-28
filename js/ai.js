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
 *   easy   - the Medium move 60% of the time, otherwise a random spot
 *   random - random legal spot, claims something half the time (baseline only)
 *   medium - greedy: points now + its own unfinished features, ignores others
 *   hard   - the full evaluation below, farms included
 *
 * Traders & Builders: goods are worth their share of the 10-point majorities, a
 * tile that extends your builder's feature is worth an extra turn, the builder
 * is worth the extra turns its feature is likely to bring, the pig a third more
 * for a farm you hold. Hand of tiles: every held tile is ranked, the best played.
 */
(function () {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const T = node ? require('./tiles.js') : self.CarcTiles;
  const E = node ? require('./engine.js') : self.CarcEngine;
  const TYPES = T.TYPES;

  // Easy plays the Medium move this often and a random spot otherwise.
  const EASY_SKILL = 0.6;
  // How far below the best move (in expected points) a level still sometimes plays.
  const NEAR = { medium: 0.6, hard: 0.35 };
  const LEVELS = {
    medium: { opp: 0, farms: true, cityPer: 0.5, roadPer: 0.5, meeple: 1.5, flat: true },
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
  // special: the road has an inn / the city a cathedral (Inns & Cathedrals):
  // worth more when finished, nothing when not.
  function featureEV(st, L, type, tiles, sh, open, left, special) {
    if (type === 'road') {
      const per = special ? 2 : 1;
      if (!open) return per * tiles;
      const pc = pComplete(L, 'road', open, left);
      return pc * per * (tiles + 0.6 * open) + (1 - pc) * (special ? 0 : tiles);
    }
    if (!open) return E.cityPoints(st, tiles, sh, true, special);
    const pc = pComplete(L, 'city', open, left);
    const per = special ? 3 : 2;
    return pc * (per * (tiles + 0.6 * open) + per * sh) + (1 - pc) * (special ? 0 : tiles + sh);
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

  // Traders & Builders. A turn is worth about 3.5 points while tiles are left.
  const turnValue = (left) => (left > 1 ? 3.5 : 0);
  // The 10-point majority of one good, as a smooth function of my lead.
  const majority = (mine, best) => 10 / (1 + Math.exp(-(mine - best) / 1.2));
  function goodsValue(st, p, gd) {
    if (!st.goods) return 0;
    let v = 0;
    for (let k = 0; k < 3; k++) {
      if (!gd[k]) continue;
      const me = st.goods[p][k];
      let best = 0;
      st.goods.forEach((q, i) => { if (i !== p && q[k] > best) best = q[k]; });
      v += majority(me + gd[k], best) - majority(me, best);
    }
    return v;
  }
  function builderHere(st, roots, p) { return roots.some((g) => E.hasFig(st, st.groups[g], p, 'b')); }

  // Value of placing the tile in hand at (x,y,r) with a meeple on fi (-1 none),
  // from player p's point of view. A = E.analyze(...) can be passed in to reuse.
  // fig: 'b' builder / 'g' pig on fi instead of a meeple (Traders & Builders).
  function evaluate(st, p, x, y, r, fi, level, A, big, fig) {
    const L = LEVELS[level || 'hard'];
    const t = st.cur, R = TYPES[t].rot[r];
    A = A || E.analyze(st, x, y, t, r);
    const left = st.bag.length;
    let v = 0, extra = false;
    if (fig) {
      const C = A.comps[A.featComp[fi]];
      if (fig === 'b') v += C.open > 0 ? turnValue(left) * Math.min(1.5, 0.45 * C.open) * Math.min(1, left / 12) - 0.6 : -0.6;
      else if (st.opts.farmers && E.winners(C.m).includes(p)) {
        const newCityOpen = C.cityFis.map((cf) => A.comps[A.featComp[cf]].open);
        v += fieldEV(st, L, C.cities, newCityOpen, left - 1) / 3 - 0.3;
      }
      fi = -1;   // a figure is not a meeple: value the tile itself as placed without one
    }
    A.comps.forEach((C, ci) => {
      if (st.fig && !st.bonus && !extra && (C.type === 'city' || C.type === 'road') && builderHere(st, C.roots, p)) {
        extra = true; v += turnValue(left);
      }
      if (C.type === 'city' && C.open === 0 && st.goods && (C.gd[0] || C.gd[1] || C.gd[2])) v += goodsValue(st, p, C.gd);
      const mine = fi >= 0 && C.fis.includes(fi);
      const m = C.m.slice(); if (mine) m[p] += big ? 2 : 1;
      if (C.type === 'city' || C.type === 'road') {
        let before = 0;
        for (const g of C.roots) {
          const G = st.groups[g];
          before += rel(st, L, p, G.m, featureEV(st, L, C.type, G.tiles.length, G.sh, G.open, left, G.inn || G.cat));
        }
        const after = rel(st, L, p, m, featureEV(st, L, C.type, C.tiles, C.sh, C.open, left - 1, C.inn || C.cat));
        v += after - before;
        if (C.open === 0) {           // finished now: meeples come straight back
          const back = C.m[p] + (mine ? 1 : 0);   // meeples (not strength) coming home
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
    if (fi >= 0) v -= meepleCost(st, L, p, left) * (big ? 1.3 : 1);
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
      const small = E.hasMeeple(st, p, false), large = E.hasMeeple(st, p, true);
      out.push({ x: pl.x, y: pl.y, r: pl.r, fi: -1, v: evaluate(st, p, pl.x, pl.y, pl.r, -1, level, A) });
      for (const fi of spots) {
        if (small) out.push({ x: pl.x, y: pl.y, r: pl.r, fi, v: evaluate(st, p, pl.x, pl.y, pl.r, fi, level, A) });
        if (large) out.push({ x: pl.x, y: pl.y, r: pl.r, fi, big: true, v: evaluate(st, p, pl.x, pl.y, pl.r, fi, level, A, true) });
      }
      if (st.fig) {
        const fs = E.figSpotsFor(st, pl.x, pl.y, st.cur, pl.r, p);
        for (const kind of ['b', 'g']) for (const fi of fs[kind]) out.push({ x: pl.x, y: pl.y, r: pl.r, fi, fig: kind, v: evaluate(st, p, pl.x, pl.y, pl.r, fi, level, A, false, kind) });
      }
    }
    out.sort((a, b) => b.v - a.v);
    return out;
  }
  // Hand of tiles: rank the moves of every held tile (each move carries its tile t).
  function rankAll(st, p, level) {
    if (!st.hands || !st.hands[p] || st.hands[p].length < 2) return rankMoves(st, p, level).map((m) => Object.assign(m, { t: st.cur }));
    const cur = st.cur, out = [], seen = new Set();
    for (const t of st.hands[p]) {
      if (seen.has(t)) continue;
      seen.add(t);
      st.cur = t;
      for (const m of rankMoves(st, p, level)) { m.t = t; out.push(m); }
    }
    st.cur = cur;
    out.sort((a, b) => b.v - a.v);
    return out;
  }
  const act = (m) => {
    const a = { type: 'place', x: m.x, y: m.y, r: m.r, fi: m.fi, big: !!m.big };
    if (m.fig) a.fig = m.fig;
    if (m.t != null) a.t = m.t;
    return a;
  };

  function choose(st, level, rand) {
    rand = rand || Math.random;
    const p = st.turn;
    if (level === 'easy' && rand() < EASY_SKILL) return act(rankAll(st, p, 'medium')[0]);
    if (level === 'easy' || level === 'random') {
      // (hand of tiles: a random held tile that fits)
      const held = st.hands ? st.hands[p].filter((t) => E.legalFor(st, t).length) : [];
      const t = held.length ? held[Math.floor(rand() * held.length)] : st.cur, was = st.cur;
      st.cur = t;
      const L = E.legalPlacements(st);
      const m = L[Math.floor(rand() * L.length)];
      // A beginner claims something half the time, now and then a farm.
      const spots = E.meepleSpotsFor(st, m.x, m.y, st.cur, m.r, p);
      const farms = spots.filter((fi) => TYPES[st.cur].rot[m.r].feats[fi].type === 'field');
      const rest = spots.filter((fi) => !farms.includes(fi));
      const pool = rest.length && (!farms.length || rand() < 0.8) ? rest : farms;
      const fi = pool.length && rand() < 0.5 ? pool[Math.floor(rand() * pool.length)] : -1;
      st.cur = was;
      const a = { type: 'place', x: m.x, y: m.y, r: m.r, fi, big: fi >= 0 && !E.hasMeeple(st, p, false) };
      if (st.hands) a.t = t;
      return a;
    }
    const ranked = rankAll(st, p, level);
    // Not predictable: any move within NEAR points of the best may be played,
    // the closer the likelier (exact ties are an even pick).
    const near = NEAR[level] || 1e-9;
    const top = ranked.filter((m) => m.v >= ranked[0].v - near);
    const w = top.map((m) => Math.exp((m.v - ranked[0].v) / (near / 2)));
    let x = rand() * w.reduce((a, b) => a + b, 0), m = top[top.length - 1];
    for (let i = 0; i < top.length; i++) { x -= w[i]; if (x <= 0) { m = top[i]; break; } }
    return act(m);
  }

  const api = { evaluate, rankMoves, rankAll, choose, LEVELS };
  if (node) module.exports = api;
  else self.CarcAI = api;
})();
