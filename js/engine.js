/* Carcassonne rules engine. Pure data in, pure data out.
 *
 *   newGame(opts)            -> state   (plain JSON, safe to store or send)
 *   apply(state, action)     -> new state (does not touch the old one)
 *   view(state, seat)        -> what that seat may see (bag order hidden)
 *   legalPlacements(state)   -> [{x,y,r}] for the tile in hand
 *   meepleSpots(state,x,y,r) -> feature indexes a meeple may go on
 *
 * Action: { type:'place', x, y, r, fi, big }   fi = feature index for a meeple,
 * -1 = none; big = use the large meeple (Inns & Cathedrals, counts as 2).
 *
 * Options: river (The River: spring start, river tiles first, lake last, no
 * U-turns), ic (Inns & Cathedrals: 18 tiles, inns, cathedrals, large meeple),
 * tb (Traders & Builders: 24 tiles, trade goods, builder, pig) and the house
 * rule hand (hold 2 or 3 tiles and play one; not with the River).
 *
 * Traders & Builders: action fig 'b' puts the builder (on a road/city where the
 * player has a meeple) or 'g' the pig (on a field where the player has a farmer)
 * on feature fi instead of a meeple. A tile that extends a road/city holding the
 * player's builder gives one extra turn (st.bonus). Whoever finishes a city takes
 * its goods; at the end the most of each good scores 10.
 *
 * Features are joined with a union-find over "groups". Each group keeps what
 * scoring needs: tiles, open edges, shields, meeples, adjacent cities (fields).
 * applyMut() is the in-place version the computer players use for speed.
 */
(function () {
  'use strict';
  const T = typeof module !== 'undefined' && module.exports ? require('./tiles.js') : self.CarcTiles;
  const TYPES = T.TYPES;
  const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
  const K = (x, y) => x + ',' + y;
  const MEEPLES = 7;

  // Small seeded RNG so a stored seed replays the same bag.
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0; let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Variants: farmers off; old 2-tile city (2 points); first-edition farms;
  // The River; Inns & Cathedrals.
  const DEFAULT_OPTS = { players: 2, farmers: true, smallCity: 4, farm: '3rd', river: false, ic: false, tb: false, hand: 1, seed: 1 };
  const GOOD = { w: 0, g: 1, c: 2 };
  const isRiver = (t) => TYPES[t].river;

  function newGame(o) {
    const opts = Object.assign({}, DEFAULT_OPTS, o || {});
    const n = opts.players;
    const counts = T.bagCounts(opts);
    let bag = [];
    counts.forEach((c, t) => { for (let i = 0; i < c; i++) bag.push(t); });
    const rand = rng(opts.seed);
    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    shuffle(bag);
    if (opts.river) {
      // Drawn from the end: the ten river tiles first (shuffled), then the lake.
      const rv = [];
      TYPES.forEach((t) => { if (t.set === 'river' && !t.spring && !t.lake) for (let i = 0; i < t.count; i++) rv.push(t.idx); });
      bag = bag.concat([T.LAKE], shuffle(rv));
    }
    const st = {
      v: 1, opts, n, board: {}, groups: [], bag, cur: -1, turn: 0, moves: 0,
      scores: new Array(n).fill(0), meeples: new Array(n).fill(MEEPLES),
      big: new Array(n).fill(opts.ic ? 1 : 0),
      bd: Array.from({ length: n }, () => ({ city: 0, road: 0, cloister: 0, farm: 0, goods: 0 })),
      discards: [], last: null, over: false, final: null, river: null,
    };
    if (opts.tb) {
      st.fig = Array.from({ length: n }, () => ({ b: 1, g: 1 }));
      st.goods = Array.from({ length: n }, () => [0, 0, 0]);
      st.bonus = false;
    }
    if (opts.river) {
      putTile(st, 0, 0, T.SPRING, 0, -1, -1);
      // The river's open end: the square east of the spring, entered from its west side.
      st.river = { x: 1, y: 0, from: 3, turn: 0 };
    } else putTile(st, 0, 0, T.START, 0, -1, -1);
    if (opts.hand > 1 && !opts.river) {
      // House rule: everyone holds a hand of tiles, plays one a turn and draws one back.
      st.hands = Array.from({ length: n }, () => []);
      for (let k = 0; k < opts.hand; k++) for (let p = 0; p < n; p++) if (st.bag.length) st.hands[p].push(st.bag.pop());
      startHand(st);
    } else draw(st);
    return st;
  }

  // ---------------------------------------------------------------- union-find
  function find(st, g) {
    const G = st.groups;
    while (G[g].par !== g) { G[g].par = G[G[g].par].par; g = G[g].par; }
    return g;
  }
  function union(st, a, b) {
    a = find(st, a); b = find(st, b);
    if (a === b) return a;
    const A = st.groups[a], B = st.groups[b];
    if (A.tiles.length < B.tiles.length) return union(st, b, a);
    B.par = a;
    for (const k of B.tiles) if (!A.tiles.includes(k)) A.tiles.push(k);
    A.open += B.open; A.sh += B.sh;
    if (B.inn) A.inn = 1;
    if (B.cat) A.cat = 1;
    for (let i = 0; i < A.m.length; i++) A.m[i] += B.m[i];
    A.mk.push(...B.mk);
    if (B.gd) { A.gd = A.gd || [0, 0, 0]; for (let i = 0; i < 3; i++) A.gd[i] += B.gd[i]; }
    if (B.fk && B.fk.length) { A.fk = A.fk || []; A.fk.push(...B.fk); }
    for (const c of B.cities) if (!A.cities.includes(c)) A.cities.push(c);
    return a;
  }

  // ---------------------------------------------------------------- placement
  function fits(st, x, y, t, r) {
    if (st.board[K(x, y)]) return false;
    const side = TYPES[t].rot[r].side;
    let touches = false;
    for (let s = 0; s < 4; s++) {
      const nb = st.board[K(x + DX[s], y + DY[s])];
      if (!nb) continue;
      touches = true;
      if (TYPES[nb.t].rot[nb.r].side[(s + 2) % 4] !== side[s]) return false;
    }
    return touches;
  }

  // The River: a river tile must continue the river at its open end, its far
  // end must lead to an empty square, and two curves in a row may not turn the
  // same way (that would be a U-turn). Other tiles: the normal rule.
  function riverMove(st, t, r) {
    const R = TYPES[t].rot[r], rv = st.river;
    const f = R.feats.find((q) => q.type === 'river');
    if (!f.sides.includes(rv.from)) return null;
    const out = f.sides.find((sd) => sd !== rv.from);
    if (out === undefined) return { out: -1, turn: 0 };          // the lake
    const heading = (rv.from + 2) % 4;
    const turn = out === heading ? 0 : out === (heading + 1) % 4 ? 1 : -1;   // 1 right, -1 left
    if (turn && turn === rv.turn) return null;
    if (st.board[K(rv.x + DX[out], rv.y + DY[out])]) return null;
    return { out, turn };
  }
  function canPlace(st, x, y, t, r) {
    if (!fits(st, x, y, t, r)) return false;
    if (!isRiver(t)) return true;
    if (!st.river || x !== st.river.x || y !== st.river.y) return false;
    return !!riverMove(st, t, r);
  }

  function frontier(st) {
    const seen = {}, out = [];
    for (const k in st.board) {
      const [x, y] = k.split(',').map(Number);
      for (let s = 0; s < 4; s++) {
        const nx = x + DX[s], ny = y + DY[s], nk = K(nx, ny);
        if (!st.board[nk] && !seen[nk]) { seen[nk] = 1; out.push([nx, ny]); }
      }
    }
    return out;
  }

  function legalFor(st, t) {
    const out = [];
    if (isRiver(t)) {
      if (!st.river) return out;
      for (let r = 0; r < 4; r++) if (canPlace(st, st.river.x, st.river.y, t, r)) out.push({ x: st.river.x, y: st.river.y, r });
      return out;
    }
    for (const [x, y] of frontier(st)) for (let r = 0; r < 4; r++) if (fits(st, x, y, t, r)) out.push({ x, y, r });
    return out;
  }
  function legalPlacements(st) { return st.cur < 0 ? [] : legalFor(st, st.cur); }

  // Look before placing: which existing groups each feature of the new tile
  // would join, and what the joined feature would look like. The computer and
  // the hint numbers read this; putTile() must agree with it (tested).
  function analyze(st, x, y, t, r) {
    const R = TYPES[t].rot[r], nf = R.feats.length;
    const links = R.feats.map(() => []);
    const conn = new Array(nf).fill(0);
    for (let s = 0; s < 4; s++) {
      const nb = st.board[K(x + DX[s], y + DY[s])];
      if (!nb) continue;
      const NR = TYPES[nb.t].rot[nb.r];
      for (let k = 0; k < 3; k++) {
        const fa = R.portFeat[3 * s + k];
        const gb = find(st, nb.g[NR.portFeat[3 * ((s + 2) % 4) + 2 - k]]);
        if (!links[fa].includes(gb)) links[fa].push(gb);
        if (k === 1) { const ty = R.feats[fa].type; if (ty === 'city' || ty === 'road') conn[fa]++; }
      }
    }
    // Features of the new tile that reach the same group become one feature.
    const comp = R.feats.map((_, i) => i);
    const cf = (i) => { while (comp[i] !== i) i = comp[i]; return i; };
    for (let i = 0; i < nf; i++) for (let j = i + 1; j < nf; j++)
      if (links[i].some((g) => links[j].includes(g))) comp[cf(j)] = cf(i);
    const comps = [], featComp = new Array(nf);
    for (let i = 0; i < nf; i++) {
      const c = cf(i);
      let C = comps.find((q) => q.root === c);
      if (!C) {
        C = { root: c, fis: [], type: R.feats[i].type, roots: [], tiles: 1, open: 0, sh: 0, inn: 0, cat: 0, m: new Array(st.n).fill(0), cities: [], cityFis: [], gd: [0, 0, 0], fk: [] };
        comps.push(C);
      }
      featComp[i] = comps.indexOf(C);
      C.fis.push(i);
      const f = R.feats[i];
      C.open += f.sides.length - 2 * conn[i];
      C.sh += f.shield;
      if (f.inn) C.inn = 1;
      if (f.cathedral) C.cat = 1;
      if (f.good) C.gd[GOOD[f.good]]++;
      if (f.type === 'field') for (const a of f.adj) if (!C.cityFis.includes(a)) C.cityFis.push(a);
      for (const g of links[i]) if (!C.roots.includes(g)) {
        C.roots.push(g);
        const G = st.groups[g];
        C.tiles += G.tiles.length; C.open += G.open; C.sh += G.sh;
        if (G.inn) C.inn = 1;
        if (G.cat) C.cat = 1;
        for (let p = 0; p < st.n; p++) C.m[p] += G.m[p];
        if (G.gd) for (let k = 0; k < 3; k++) C.gd[k] += G.gd[k];
        if (G.fk) C.fk.push(...G.fk);
        for (const c of G.cities) { const rc = find(st, c); if (!C.cities.includes(rc)) C.cities.push(rc); }
      }
    }
    return { comps, featComp };
  }

  // Has player p a meeple to place (big = the large one)?
  function hasMeeple(st, p, big) { return big ? (st.big ? st.big[p] : 0) > 0 : st.meeples[p] > 0; }
  function meepleSpotsFor(st, x, y, t, r, p) {
    if (!hasMeeple(st, p, false) && !hasMeeple(st, p, true)) return [];
    const R = TYPES[t].rot[r];
    const A = analyze(st, x, y, t, r);
    const out = [];
    R.feats.forEach((f, fi) => {
      if (f.type === 'river') return;
      if (f.type === 'field' && !st.opts.farmers) return;
      const C = A.comps[A.featComp[fi]];
      if (C.m.every((v) => v === 0)) out.push(fi);
    });
    return out;
  }
  function meepleSpots(st, x, y, r) { return st.cur < 0 ? [] : meepleSpotsFor(st, x, y, st.cur, r, st.turn); }

  // Traders & Builders: where player p may put the builder (b: a road or city on this tile where p
  // already has a meeple) and the pig (g: a field where p already has a farmer).
  function figSpotsFor(st, x, y, t, r, p) {
    const out = { b: [], g: [] };
    if (!st.opts.tb || !st.fig) return out;
    const F = st.fig[p], R = TYPES[t].rot[r];
    if (!F.b && !F.g) return out;
    const A = analyze(st, x, y, t, r);
    R.feats.forEach((f, fi) => {
      const C = A.comps[A.featComp[fi]];
      if (!C.m[p]) return;
      if (F.b && (f.type === 'city' || f.type === 'road')) out.b.push(fi);
      if (F.g && f.type === 'field' && st.opts.farmers) out.g.push(fi);
    });
    return out;
  }
  function figSpots(st, x, y, r) { return st.cur < 0 ? { b: [], g: [] } : figSpotsFor(st, x, y, st.cur, r, st.turn); }
  // Does group g hold player p's figure of this kind ('b' builder, 'g' pig)?
  function hasFig(st, g, p, kind) {
    if (!g.fk) return false;
    for (const k of g.fk) { const x = st.board[k] && st.board[k].x; if (x && x[0] === p && x[2] === kind) return true; }
    return false;
  }

  // Put a tile down and join its features to the neighbours. p/fi: meeple.
  function putTile(st, x, y, t, r, p, fi, big, fig) {
    const key = K(x, y), R = TYPES[t].rot[r];
    const tile = { t, r, g: [], m: null };
    st.board[key] = tile;
    R.feats.forEach((f) => {
      const id = st.groups.length;
      st.groups.push({
        type: f.type, par: id, tiles: f.type === 'city' || f.type === 'road' ? [key] : [],
        open: f.sides.length, sh: f.shield, m: new Array(st.n).fill(0), mk: [], cities: [], done: 0, key,
      });
      if (f.inn) st.groups[id].inn = 1;
      if (f.cathedral) st.groups[id].cat = 1;
      if (f.good) { st.groups[id].gd = [0, 0, 0]; st.groups[id].gd[GOOD[f.good]] = 1; }
      tile.g.push(id);
    });
    R.feats.forEach((f, fi2) => { if (f.type === 'field') st.groups[tile.g[fi2]].cities = f.adj.map((a) => tile.g[a]); });
    for (let s = 0; s < 4; s++) {
      const nb = st.board[K(x + DX[s], y + DY[s])];
      if (!nb) continue;
      const NR = TYPES[nb.t].rot[nb.r];
      for (let k = 0; k < 3; k++) {
        const fa = R.portFeat[3 * s + k];
        const root = union(st, tile.g[fa], nb.g[NR.portFeat[3 * ((s + 2) % 4) + 2 - k]]);
        if (k === 1) { const ty = R.feats[fa].type; if (ty === 'city' || ty === 'road') st.groups[root].open -= 2; }
      }
    }
    if (fi >= 0 && fig) {
      const g = st.groups[find(st, tile.g[fi])];
      (g.fk = g.fk || []).push(key);
      tile.x = [p, fi, fig];
      st.fig[p][fig]--;
    } else if (fi >= 0) {
      const g = st.groups[find(st, tile.g[fi])];
      g.m[p] += big ? 2 : 1; g.mk.push(key);
      tile.m = big ? [p, fi, 1] : [p, fi];
      if (big) st.big[p]--; else st.meeples[p]--;
    }
    return tile;
  }

  // Who holds the most meeples on a group (ties all win). [] if nobody.
  function winners(m) {
    const top = Math.max(...m);
    if (top <= 0) return [];
    const w = []; m.forEach((v, i) => { if (v === top) w.push(i); });
    return w;
  }

  // cat: the city has a cathedral (3 per tile and shield when finished, 0 if not).
  function cityPoints(st, tiles, sh, complete, cat) {
    if (cat) return complete ? 3 * tiles + 3 * sh : 0;
    if (!complete) return tiles + sh;
    if (tiles === 2 && st.opts.smallCity === 2) return 2 + sh;   // old rule: 1 per tile and 1 per shield
    return 2 * tiles + 2 * sh;
  }
  // inn: the road has an inn (2 per tile when finished, 0 if not).
  function roadPoints(tiles, complete, inn) {
    if (inn) return complete ? 2 * tiles : 0;
    return tiles;
  }

  function award(st, who, pts, kind, ev, where) {
    for (const p of who) { st.scores[p] += pts; st.bd[p][kind] += pts; }
    if (who.length && pts) ev.push({ kind, who: who.slice(), pts, where });
  }

  function returnMeeples(st, g) {
    for (const k of g.mk) {
      const tl = st.board[k];
      if (tl && tl.m) { if (tl.m[2]) st.big[tl.m[0]]++; else st.meeples[tl.m[0]]++; tl.m = null; }
    }
    g.mk = []; g.m = g.m.map(() => 0);
    // the builder goes home with them (a pig is never on a finished feature)
    if (g.fk) for (const k of g.fk) {
      const tl = st.board[k];
      if (tl && tl.x) { st.fig[tl.x[0]][tl.x[2]]++; tl.x = null; }
    }
    if (g.fk) g.fk = [];
  }

  function cloisterNeighbours(st, x, y) {
    let c = 0;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++)
      if ((dx || dy) && st.board[K(x + dx, y + dy)]) c++;
    return c;
  }

  // Score everything the last tile finished.
  function scoreCompleted(st, x, y, ev, placer, got) {
    const tile = st.board[K(x, y)], R = TYPES[tile.t].rot[tile.r];
    R.feats.forEach((f, fi) => {
      if (f.type !== 'city' && f.type !== 'road') return;
      const gid = find(st, tile.g[fi]), g = st.groups[gid];
      if (g.done || g.open !== 0) return;
      g.done = 1;
      const pts = f.type === 'city' ? cityPoints(st, g.tiles.length, g.sh, true, g.cat) : roadPoints(g.tiles.length, true, g.inn);
      award(st, winners(g.m), pts, f.type, ev, g.tiles.slice());
      // Traders & Builders: whoever finishes a city takes its goods, meeples there or not.
      if (g.gd && st.goods && placer >= 0) {
        for (let k = 0; k < 3; k++) { st.goods[placer][k] += g.gd[k]; if (got) got[k] += g.gd[k]; }
      }
      returnMeeples(st, g);
    });
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const cx = x + dx, cy = y + dy, ct = st.board[K(cx, cy)];
      if (!ct) continue;
      const CR = TYPES[ct.t].rot[ct.r];
      CR.feats.forEach((f, fi) => {
        if (f.type !== 'cloister') return;
        const g = st.groups[ct.g[fi]];
        if (g.done || cloisterNeighbours(st, cx, cy) < 8) return;
        g.done = 1;
        award(st, winners(g.m), 9, 'cloister', ev, [K(cx, cy)]);
        returnMeeples(st, g);
      });
    }
  }

  // Draw the next tile; a tile that fits nowhere is set aside (rules).
  function draw(st) {
    st.cur = -1;
    while (st.bag.length) {
      const t = st.bag.pop();
      if (legalFor(st, t).length) { st.cur = t; return; }
      st.discards.push(t);
    }
    finish(st);
  }

  // House rule hand: the player to move drops any held tile that fits nowhere (and draws
  // another for it); an empty hand passes. The game ends when every hand and the bag are empty.
  function startHand(st) {
    st.cur = -1;
    for (let tries = 0; tries <= st.n; tries++) {
      const h = st.hands[st.turn];
      let i = 0;
      while (i < h.length) {
        if (legalFor(st, h[i]).length) i++;
        else { st.discards.push(h.splice(i, 1)[0]); if (st.bag.length) h.push(st.bag.pop()); }
      }
      if (h.length) { st.cur = h[0]; return; }
      if (!st.bag.length && st.hands.every((q) => !q.length)) break;
      st.turn = (st.turn + 1) % st.n; if (st.fig) st.bonus = false;
    }
    finish(st);
  }
  // Choose which held tile to play (hand rule): it becomes st.cur.
  function pick(st, t) {
    if (!st.hands || st.over) return false;
    const h = st.hands[st.turn], i = h.indexOf(t);
    if (i < 0) return false;
    h.splice(i, 1); h.unshift(t); st.cur = t;
    return true;
  }

  // End of game: unfinished cities, roads, cloisters, then farms.
  function finish(st) {
    if (st.over) return;
    st.over = true;
    const ev = [];
    const seen = {};
    for (let gid = 0; gid < st.groups.length; gid++) {
      const r = find(st, gid);
      if (seen[r]) continue;
      seen[r] = 1;
      const g = st.groups[r];
      if (g.done || g.type === 'field') continue;
      const w = winners(g.m);
      if (!w.length) continue;
      if (g.type === 'city') award(st, w, cityPoints(st, g.tiles.length, g.sh, false, g.cat), 'city', ev, g.tiles.slice());
      else if (g.type === 'road') award(st, w, roadPoints(g.tiles.length, false, g.inn), 'road', ev, g.tiles.slice());
      else if (g.type === 'cloister') {
        const [cx, cy] = g.key.split(',').map(Number);
        award(st, w, 1 + cloisterNeighbours(st, cx, cy), 'cloister', ev, [g.key]);
      }
    }
    if (st.opts.farmers && st.opts.farm === '1st') {
      // First-edition farms: each finished city pays 4 to whoever has the most
      // farmers across all the fields touching it.
      const perCity = {};
      const pigAt = {};
      for (const r in seen) {
        const g = st.groups[r];
        if (g.type !== 'field' || g.m.every((v) => v === 0)) continue;
        const cs = new Set(g.cities.map((c) => find(st, c)));
        for (const c of cs) {
          if (!st.groups[c].done) continue;
          const acc = perCity[c] || (perCity[c] = new Array(st.n).fill(0));
          g.m.forEach((v, i) => { acc[i] += v; if (hasFig(st, g, i, 'g')) (pigAt[c] = pigAt[c] || {})[i] = 1; });
        }
      }
      // (Traders & Builders, first edition: a pig in a farm feeding the city adds 1)
      for (const c in perCity) {
        const w = winners(perCity[c]), pig = pigAt[c] || {};
        award(st, w.filter((p) => !pig[p]), 4, 'farm', ev, st.groups[c].tiles.slice());
        award(st, w.filter((p) => pig[p]), 5, 'farm', ev, st.groups[c].tiles.slice());
      }
    } else if (st.opts.farmers) {
      for (const r in seen) {
        const g = st.groups[r];
        if (g.type !== 'field') continue;
        const w = winners(g.m);
        if (!w.length) continue;
        const done = new Set();
        for (const c of g.cities) { const rc = find(st, c); if (st.groups[rc].done) done.add(rc); }
        // Traders & Builders: a winner with their pig in this farm gets 4 a city instead of 3.
        const pig = w.filter((p) => hasFig(st, g, p, 'g'));
        award(st, w.filter((p) => !pig.includes(p)), 3 * done.size, 'farm', ev, [g.key]);
        award(st, pig, 4 * done.size, 'farm', ev, [g.key]);
      }
    }
    if (st.goods) {
      // Trade goods: the most of each kind scores 10 (a tie: everyone tied).
      for (let k = 0; k < 3; k++) award(st, winners(st.goods.map((q) => q[k])), 10, 'goods', ev, []);
    }
    st.final = ev;
  }

  // In-place move (used by the computer players and by apply()).
  function applyMut(st, a) {
    if (st.over) throw new Error('game over');
    if (!a || a.type !== 'place') throw new Error('unknown action');
    if (a.t != null && a.t !== st.cur && !pick(st, a.t)) throw new Error('that tile is not in your hand');
    const { x, y, r } = a, fi = a.fi == null ? -1 : a.fi, fig = fi >= 0 && (a.fig === 'b' || a.fig === 'g') ? a.fig : null, big = fi >= 0 && !fig && !!a.big;
    if (!canPlace(st, x, y, st.cur, r)) throw new Error('tile does not fit there');
    if (fig) {
      if (!figSpotsFor(st, x, y, st.cur, r, st.turn)[fig].includes(fi)) throw new Error((fig === 'b' ? 'builder' : 'pig') + ' not allowed there');
    } else {
      if (fi >= 0 && !meepleSpotsFor(st, x, y, st.cur, r, st.turn).includes(fi)) throw new Error('meeple not allowed there');
      if (fi >= 0 && !hasMeeple(st, st.turn, big)) throw new Error('no meeple of that size left');
    }
    const p = st.turn, t = st.cur;
    const rm = isRiver(t) ? riverMove(st, t, r) : null;
    const tile = putTile(st, x, y, t, r, p, fi, big, fig);
    if (rm) st.river = rm.out < 0 ? null : { x: x + DX[rm.out], y: y + DY[rm.out], from: (rm.out + 2) % 4, turn: rm.turn };
    // Builder: did this tile extend a road or city where p's builder already stood?
    let extra = false;
    if (st.fig && !st.bonus) {
      const key = K(x, y);
      TYPES[t].rot[r].feats.forEach((f, i) => {
        if (extra || (f.type !== 'city' && f.type !== 'road')) return;
        const g = st.groups[find(st, tile.g[i])];
        if (g.fk) for (const k of g.fk) { const xx = st.board[k].x; if (k !== key && xx && xx[0] === p && xx[2] === 'b') extra = true; }
      });
    }
    const ev = [], got = st.goods ? [0, 0, 0] : null;
    scoreCompleted(st, x, y, ev, p, got);
    st.last = { x, y, t, r, p, fi, big, ev };
    if (fig) st.last.fig = fig;
    if (got && got.some((v) => v)) st.last.goods = got;
    if (extra) st.last.bonus = true;
    st.moves++;
    if (st.hands) {
      const h = st.hands[p], i = h.indexOf(t);
      if (i >= 0) h.splice(i, 1);
      if (st.bag.length) h.push(st.bag.pop());
    }
    if (st.fig) st.bonus = extra;
    if (!extra) st.turn = (st.turn + 1) % st.n;
    if (st.hands) startHand(st); else draw(st);
    return st;
  }

  function clone(st) { return JSON.parse(JSON.stringify(st)); }
  function apply(st, a) { return applyMut(clone(st), a); }

  // What one seat may see: everything except the order of the bag. Which tiles
  // are left is public at a real table (anyone can count them), so the bag is
  // kept as a sorted list: counts and bag.length still work, the order is gone.
  function view(st) {
    const v = clone(st);
    v.bag.sort((a, b) => a - b);
    v.bagCounts = bagLeft(st);
    return v;
  }
  function bagLeft(st) {
    const c = new Array(TYPES.length).fill(0);
    for (const t of st.bag) c[t]++;
    return c;
  }

  const api = {
    newGame, apply, applyMut, view, clone, legalPlacements, legalFor, meepleSpots, meepleSpotsFor, hasMeeple,
    analyze, fits, canPlace, find, _put: putTile, figSpots, figSpotsFor, hasFig, pick, winners, cityPoints, roadPoints, cloisterNeighbours, bagLeft, frontier, rng, K, DX, DY, MEEPLES,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else self.CarcEngine = api;
})();
