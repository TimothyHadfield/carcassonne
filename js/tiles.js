/* Carcassonne tile set (base game, 72 tiles incl. the start tile).
 *
 * Every tile edge is split into three "ports" so roads and fields can be told
 * apart: side s (0=N, 1=E, 2=S, 3=W), position k (0,1,2) going clockwise round
 * the tile, port = 3*s + k. A city side owns all three ports of that side; a
 * road owns the middle port and the two fields either side own ports 0 and 2.
 * Rotating a tile 90° clockwise moves port p to (p + 3) % 12.
 *
 * Letters follow the usual A–X naming (Wikicarpedia). Counts checked in
 * docs/rules-check.md. Pictures are drawn by js/render.js from these features,
 * so the art can never disagree with the rules.
 */
(function () {
  'use strict';

  const SIDES = { N: 0, E: 1, S: 2, W: 3 };
  const PORT = { N0: 0, N1: 1, N2: 2, E0: 3, E1: 4, E2: 5, S0: 6, S1: 7, S2: 8, W0: 9, W1: 10, W2: 11 };

  // "N E0 S1" -> [0,1,2,3,7]: a bare side letter means the whole side.
  function ports(spec) {
    const out = [];
    for (const tok of spec.split(/\s+/).filter(Boolean)) {
      if (tok in SIDES) { const b = 3 * SIDES[tok]; out.push(b, b + 1, b + 2); }
      else if (tok in PORT) out.push(PORT[tok]);
      else throw new Error('bad port ' + tok);
    }
    return out;
  }

  // f: [type, ports, spot[x,y], extra]. Field "adj" lists the feature indexes of
  // cities that field touches (used for farm scoring).
  const C = (p, spot, x) => Object.assign({ type: 'city', p, spot }, x || {});
  const R = (p, spot) => ({ type: 'road', p, spot });
  const F = (p, spot, adj) => ({ type: 'field', p, spot, adj: adj || [] });
  const M = (spot) => ({ type: 'cloister', p: '', spot });

  const BASE = [
    { id: 'A', count: 2, f: [M([50, 46]), R('S1', [50, 88]), F('N E W S0 S2', [18, 18])] },
    { id: 'B', count: 4, f: [M([50, 50]), F('N E S W', [18, 18])] },
    { id: 'C', count: 1, f: [C('N E S W', [50, 50], { shield: 1 })] },
    { id: 'D', count: 4, f: [C('N', [50, 13]), R('E1 W1', [50, 50]), F('E0 W2', [80, 33], [0]), F('E2 S W0', [50, 78])] },
    { id: 'E', count: 5, f: [C('N', [50, 13]), F('E S W', [50, 65], [0])] },
    { id: 'F', count: 2, f: [C('E W', [50, 50], { shield: 1 }), F('N', [50, 9], [0]), F('S', [50, 91], [0])] },
    { id: 'G', count: 1, f: [C('N S', [50, 50]), F('E', [91, 50], [0]), F('W', [9, 50], [0])] },
    { id: 'H', count: 3, f: [C('N', [50, 12]), C('S', [50, 88]), F('E W', [50, 50], [0, 1])] },
    { id: 'I', count: 2, f: [C('E', [88, 50]), C('S', [50, 88]), F('N W', [30, 30], [0, 1])] },
    { id: 'J', count: 3, f: [C('N', [50, 13]), R('E1 S1', [68, 68]), F('E0 S2 W', [28, 55], [0]), F('E2 S0', [88, 88])] },
    { id: 'K', count: 3, f: [C('N', [50, 13]), R('S1 W1', [32, 68]), F('E S0 W2', [72, 55], [0]), F('S2 W0', [12, 88])] },
    { id: 'L', count: 3, f: [C('N', [50, 13]), R('E1', [82, 50]), R('S1', [50, 82]), R('W1', [18, 50]),
      F('E0 W2', [50, 34], [0]), F('E2 S0', [84, 84]), F('S2 W0', [16, 84])] },
    { id: 'M', count: 2, f: [C('N W', [28, 28], { shield: 1 }), F('E S', [72, 72], [0])] },
    { id: 'N', count: 3, f: [C('N W', [28, 28]), F('E S', [72, 72], [0])] },
    { id: 'O', count: 2, f: [C('N W', [26, 26], { shield: 1 }), R('E1 S1', [69, 69]), F('E0 S2', [80, 36], [0]), F('E2 S0', [89, 89])] },
    { id: 'P', count: 3, f: [C('N W', [26, 26]), R('E1 S1', [69, 69]), F('E0 S2', [80, 36], [0]), F('E2 S0', [89, 89])] },
    { id: 'Q', count: 1, f: [C('N E W', [50, 38], { shield: 1 }), F('S', [50, 90], [0])] },
    { id: 'R', count: 3, f: [C('N E W', [50, 38]), F('S', [50, 90], [0])] },
    { id: 'S', count: 2, f: [C('N E W', [50, 35], { shield: 1 }), R('S1', [50, 90]), F('S0', [80, 92], [0]), F('S2', [20, 92], [0])] },
    { id: 'T', count: 1, f: [C('N E W', [50, 35]), R('S1', [50, 90]), F('S0', [80, 92], [0]), F('S2', [20, 92], [0])] },
    { id: 'U', count: 8, f: [R('N1 S1', [50, 50]), F('N2 E S0', [80, 50]), F('S2 W N0', [20, 50])] },
    { id: 'V', count: 9, f: [R('S1 W1', [31, 69]), F('N E S0 W2', [65, 35]), F('S2 W0', [12, 88])] },
    { id: 'W', count: 4, f: [R('E1', [82, 50]), R('S1', [50, 82]), R('W1', [18, 50]),
      F('N E0 W2', [50, 25]), F('E2 S0', [84, 84]), F('S2 W0', [16, 84])] },
    { id: 'X', count: 1, f: [R('N1', [50, 18]), R('E1', [82, 50]), R('S1', [50, 82]), R('W1', [18, 50]),
      F('N2 E0', [80, 20]), F('E2 S0', [80, 80]), F('S2 W0', [20, 80]), F('W2 N0', [20, 20])] },
  ];
  const START_ID = 'D';

  function rotPt([x, y], r) { for (let i = 0; i < r; i++) [x, y] = [100 - y, x]; return [x, y]; }

  // Build TYPES[i] = { id, count, feats (base orientation), rot[r] = {portFeat[12], side[4], feats} }
  const TYPES = BASE.map((def, idx) => {
    const feats = def.f.map((f) => ({
      type: f.type, ports: ports(f.p), spot: f.spot, adj: f.adj || [], shield: f.shield || 0,
    }));
    const rot = [];
    for (let r = 0; r < 4; r++) {
      const portFeat = new Array(12).fill(-1);
      const rf = feats.map((f, fi) => {
        const ps = f.ports.map((p) => (p + 3 * r) % 12);
        ps.forEach((p) => { if (portFeat[p] !== -1) throw new Error(def.id + ' port used twice'); portFeat[p] = fi; });
        const sides = f.type === 'city' ? [...new Set(ps.map((p) => Math.floor(p / 3)))]
          : f.type === 'road' ? ps.filter((p) => p % 3 === 1).map((p) => (p - 1) / 3) : [];
        return { type: f.type, ports: ps, sides, shield: f.shield, adj: f.adj, spot: rotPt(f.spot, r) };
      });
      if (portFeat.includes(-1)) throw new Error(def.id + ' has an uncovered port');
      const side = [0, 1, 2, 3].map((s) => rf[portFeat[3 * s + 1]].type === 'city' ? 'C'
        : rf[portFeat[3 * s + 1]].type === 'road' ? 'R' : 'F');
      rot.push({ portFeat, side, feats: rf, sig: side.join('') });
    }
    return { idx, id: def.id, count: def.count, feats, rot };
  });

  const START = TYPES.findIndex((t) => t.id === START_ID);
  const byId = {}; TYPES.forEach((t) => { byId[t.id] = t.idx; });

  // The bag the players draw from: every tile except the start tile.
  function bagCounts() { return TYPES.map((t) => t.count - (t.idx === START ? 1 : 0)); }

  // Which tile types can fill a hole with these side requirements?
  // need[s] is 'C' | 'R' | 'F' | null (any). Returns type indexes.
  function typesFitting(need) {
    return TYPES.filter((t) => t.rot.some((R) => need.every((n, s) => !n || R.side[s] === n))).map((t) => t.idx);
  }

  const api = { TYPES, START, byId, bagCounts, typesFitting, rotPt, TOTAL: 72 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (typeof self !== 'undefined' ? self : window).CarcTiles = api;
})();
