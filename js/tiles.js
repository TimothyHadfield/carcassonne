/* Carcassonne tile sets: base game (72 tiles incl. the start tile), The River
 * (12, first edition) and Inns & Cathedrals (18).
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
  const R = (p, spot, x) => Object.assign({ type: 'road', p, spot }, x || {});
  const F = (p, spot, adj) => ({ type: 'field', p, spot, adj: adj || [] });
  const M = (spot) => ({ type: 'cloister', p: '', spot });
  const I = (p) => ({ type: 'river', p, spot: [50, 50] });   // river: joins like a road, never claimed or scored

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
  BASE.forEach((d) => { d.set = 'base'; });

  // The River (first edition, 2001): 12 tiles. Layout and counts checked against
  // the JCloisterZone tile file (river.xml, set river/1:1) and the Complete
  // Annotated Rules v7.3 p.30 tile picture list. See docs/rules-check.md.
  // Spring and lake are one field all round, as in the official rules.
  const RIVER = [
    { id: 'RS', count: 1, spring: 1, f: [I('E1'), F('N E0 E2 S W', [24, 24])] },
    { id: 'RL', count: 1, lake: 1, f: [I('W1'), F('N E S W0 W2', [80, 20])] },
    { id: 'RA', count: 1, f: [C('N', [50, 12]), C('S', [50, 88]), I('W1 E1'), F('E0 W2', [22, 33], [0]), F('E2 W0', [78, 67], [1])] },
    { id: 'RB', count: 1, f: [C('N', [50, 12]), R('S1', [50, 84], { end: [50, 22] }), I('W1 E1'),
      F('E0', [84, 32], [0]), F('W2', [16, 32], [0]), F('E2 S0', [82, 80]), F('W0 S2', [18, 80])] },
    { id: 'RC', count: 1, f: [M([50, 24]), R('S1', [50, 84], { end: [50, 34] }), I('W1 E1'),
      F('W2 N E0', [16, 16]), F('E2 S0', [82, 82]), F('W0 S2', [18, 82])] },
    { id: 'RD', count: 1, f: [R('W1 E1', [30, 50]), I('N1 S1'), F('W2 N0', [18, 18]), F('N2 E0', [82, 18]), F('E2 S0', [82, 82]), F('W0 S2', [18, 82])] },
    { id: 'RE', count: 2, f: [I('W1 E1'), F('W2 N E0', [50, 20]), F('W0 S E2', [50, 80])] },
    { id: 'RF', count: 1, f: [C('N W', [26, 26]), I('S1 E1'), F('S2 E0', [52, 56], [0]), F('E2 S0', [89, 89])] },
    { id: 'RG', count: 1, f: [R('N1 E1', [69, 31]), I('W1 S1'), F('W2 N0 E2 S0', [46, 50]), F('N2 E0', [89, 11]), F('W0 S2', [11, 89])] },
    { id: 'RH', count: 2, f: [I('W1 S1'), F('W2 N E S0', [65, 35]), F('W0 S2', [12, 88])] },
  ];
  RIVER.forEach((d) => { d.set = 'river'; });

  // Inns & Cathedrals: 18 tiles (6 inns, 2 cathedrals). Layout and counts from
  // the JCloisterZone file (inns_and_cathedrals.xml, first-edition set), count
  // checked against the Hans im Glueck rules ("18 new land tiles").
  const IC = [
    { id: 'Ka', count: 2, f: [C('N E S W', [30, 72], { cathedral: 1 })] },
    { id: 'Kb', count: 1, f: [M([50, 50]), R('W1', [14, 50], { end: [36, 50] }), R('E1', [86, 50], { end: [64, 50] }), F('E0 N W2', [50, 14]), F('E2 S W0', [50, 86])] },
    { id: 'Kc', count: 1, f: [C('N', [50, 11]), C('W', [11, 50]), C('E', [89, 50]), C('S', [50, 89]), F('', [50, 50], [0, 1, 2, 3])] },
    { id: 'Kd', count: 1, f: [C('N', [50, 12]), C('W', [12, 50]), C('E', [88, 50]), F('S', [50, 72], [0, 1, 2])] },
    { id: 'Ke', count: 1, village: 1, f: [C('N', [50, 11]), C('S', [50, 89]), R('W1', [22, 50]), R('E1', [78, 50]),
      F('E2', [88, 72], [1]), F('W0', [12, 72], [1]), F('E0', [88, 28], [0]), F('W2', [12, 28], [0])] },
    { id: 'Kf', count: 1, f: [C('N W', [26, 26], { shield: 1 }), C('S', [50, 89]), F('E', [74, 52], [0, 1])] },
    { id: 'Kg', count: 1, hedge: 'M62 21 Q78 60 100 100', f: [C('N', [42, 12]), F('E', [90, 50], [0]), F('W S', [36, 66], [0])] },
    { id: 'Kh', count: 1, f: [C('N', [50, 12]), R('S1', [50, 80], { end: [50, 22] }), F('W S2', [22, 60], [0]), F('E S0', [78, 60], [0])] },
    { id: 'Ki', count: 1, f: [C('N W', [26, 26]), R('E1', [82, 50], { end: [44, 50] }), F('E0', [84, 28], [0]), F('E2 S', [66, 80], [0])] },
    { id: 'Kj', count: 1, f: [C('E W', [50, 50], { shield: 1 }), R('N1', [50, 8], { end: [50, 22] }), R('S1', [50, 92], { end: [50, 78] }),
      F('N0', [24, 7], [0]), F('N2', [76, 7], [0]), F('S0', [76, 93], [0]), F('S2', [24, 93], [0])] },
    { id: 'Kk', count: 1, f: [C('N W', [26, 26]), R('S1', [50, 84], { inn: [70, 74], end: [46, 46] }), F('S2', [22, 88], [0]), F('S0 E', [80, 46], [0])] },
    { id: 'Kl', count: 1, f: [C('N', [50, 12]), R('W1 S1', [34, 66], { inn: [64, 64] }), F('S2 W0', [12, 88]), F('W2 E S0', [76, 42], [0])] },
    { id: 'Km', count: 1, f: [C('N W', [26, 26], { shield: 1 }), R('E1 S1', [69, 69], { inn: [64, 47] }), F('S0 E2', [89, 89]), F('S2 E0', [82, 34], [0])] },
    { id: 'Kn', count: 1, f: [R('E1', [82, 50], { inn: [78, 28] }), R('W1', [18, 50]), R('S1', [50, 82]),
      F('W2 N E0', [40, 22]), F('W0 S2', [16, 84]), F('E2 S0', [84, 84])] },
    { id: 'Ko', count: 1, f: [R('W1 E1', [30, 50], { inn: [64, 28] }), F('W2 N E0', [30, 20]), F('E2 S W0', [50, 80])] },
    { id: 'Kp', count: 1, f: [R('W1 S1', [31, 69], { inn: [70, 34] }), F('W2 N E S0', [50, 22]), F('S2 W0', [12, 88])] },
    { id: 'Kq', count: 1, f: [R('N1 W1', [31, 31]), R('S1 E1', [69, 69]), F('N0 W2', [11, 11]), F('S0 E2', [89, 89]), F('N2 E0 S2 W0', [74, 26])] },
  ];
  IC.forEach((d) => { d.set = 'ic'; });

  // Traders & Builders: 24 tiles, 20 trade-good symbols on cities (9 wine, 6 grain, 5 cloth).
  // Layout and counts from the JCloisterZone file (traders_and_builders.xml, set
  // traders-and-builders:1); JCZ's "XL"/"XR" = our port X0/X2, "I" = an inner field with
  // no edge. good: 'w' wine, 'g' grain, 'c' cloth. gs = where the goods symbol is drawn.
  // shape = a narrower city band [fill, wall] where the usual one would cover a road or field.
  // Three tiles ("!") have a hedge splitting a corner field. See docs/rules-check.md.
  const BAND = ['M0 0 Q50 50 100 0 V100 Q50 50 0 100 Z', 'M100 0 Q50 50 0 0 M0 100 Q50 50 100 100'];
  const BAND_HI = ['M0 0 Q50 44 100 0 V100 Q50 30 0 100 Z', 'M100 0 Q50 44 0 0 M0 100 Q50 30 100 100'];
  const CAP_S = ['M0 100 H100 Q50 70 0 100 Z', 'M100 100 Q50 70 0 100'];
  const TB = [
    { id: 'Ta', count: 1, f: [C('N W', [26, 26], { good: 'g', gs: [12, 40] }), F('E S', [72, 72], [0])] },
    { id: 'Tb', count: 1, f: [C('N W', [26, 26], { good: 'w', gs: [12, 40] }), F('E S', [72, 72], [0])] },
    { id: 'Tc', count: 1, f: [C('W E', [50, 38], { good: 'c', gs: [74, 44], shape: BAND_HI }), C('S', [50, 93], { shape: CAP_S }), F('N', [50, 9], [0]), F('', [50, 77], [0, 1])] },
    { id: 'Td', count: 1, f: [C('W E', [50, 38], { good: 'w', gs: [74, 44], shape: BAND_HI }), C('S', [50, 93], { shape: CAP_S }), F('N', [50, 9], [0]), F('', [50, 77], [0, 1])] },
    { id: 'Te', count: 1, f: [C('N E W', [50, 32], { good: 'g', gs: [76, 50] }), F('S', [50, 90], [0])] },
    { id: 'Tf', count: 1, f: [C('N W', [24, 24], { good: 'c', gs: [10, 40] }), C('S', [50, 89]), C('E', [89, 50]), F('', [62, 62], [0, 1, 2])] },
    { id: 'Tg', count: 1, hedge: 'M100 100 L62 62', f: [C('N W', [22, 22], { good: 'c', gs: [36, 12] }), R('S1', [50, 80], { end: [44, 44] }), R('E1', [80, 50], { end: [44, 44] }),
      F('S2', [20, 82], [0]), F('S0', [66, 90], [0]), F('E2', [90, 66], [0]), F('E0', [82, 22], [0])] },
    { id: 'Th', count: 1, f: [C('N W', [22, 22], { good: 'w', gs: [36, 12] }), R('S1', [50, 80], { end: [44, 44] }), R('E1', [80, 50], { end: [44, 44] }),
      F('S2', [20, 82], [0]), F('S0 E2', [78, 78], [0]), F('E0', [82, 22], [0])] },
    { id: 'Ti', count: 1, f: [C('N W', [24, 24], { good: 'c', gs: [10, 40] }), C('S', [50, 89]), R('E1', [80, 49], { end: [44, 44] }), F('E0', [82, 24], [0]), F('E2', [74, 66], [0, 1])] },
    { id: 'Tj', count: 1, f: [C('N W', [24, 24], { good: 'g', gs: [10, 40] }), C('S', [50, 89]), R('E1', [80, 49], { end: [44, 44] }), F('E0', [82, 24], [0]), F('E2', [74, 66], [0, 1])] },
    { id: 'Tk', count: 1, f: [C('N W', [24, 24], { good: 'c', gs: [10, 40] }), R('E1', [80, 49], { end: [44, 44] }), F('E0', [82, 24], [0]), F('E2 S', [62, 78], [0])] },
    { id: 'Tl', count: 1, hedge: 'M100 100 L64 62', f: [C('N W', [24, 24], { good: 'w', gs: [10, 40] }), R('E1', [80, 49], { end: [44, 44] }), F('E0', [82, 24], [0]), F('E2', [90, 64], [0]), F('S', [46, 80], [0])] },
    { id: 'Tm', count: 1, f: [C('N E W', [50, 32], { good: 'w', gs: [76, 50] }), R('S1', [50, 90]), F('S0', [80, 92], [0]), F('S2', [20, 92], [0])] },
    { id: 'Tn', count: 1, f: [C('N W', [22, 22], { good: 'w', gs: [36, 10] }), C('E S', [78, 78]), F('', [50, 50], [0, 1])] },
    { id: 'To', count: 1, f: [C('E W', [50, 50], { good: 'w', gs: [74, 50] }), F('N', [50, 9], [0]), F('S', [50, 91], [0])] },
    { id: 'Tp', count: 1, f: [C('N', [36, 12]), R('E1', [82, 50], { end: [60, 22] }), F('E0', [86, 26], [0]), F('W S E2', [36, 66], [0])] },
    { id: 'Tq', count: 1, f: [C('W E', [30, 50], { good: 'g', gs: [74, 50], shape: BAND }), R('S1', [50, 88], { end: [50, 74] }), F('N', [50, 10], [0]), F('S2', [20, 90], [0]), F('S0', [80, 90], [0])] },
    { id: 'Tr', count: 1, f: [C('W E', [30, 50], { good: 'w', gs: [74, 50], shape: BAND }), R('S1', [50, 88], { end: [50, 74] }), F('N', [50, 10], [0]), F('S2', [20, 90], [0]), F('S0', [80, 90], [0])] },
    { id: 'Ts', count: 1, f: [C('E W', [28, 50], { good: 'w', gs: [74, 50], shape: BAND }), R('N1', [50, 12], { end: [50, 26] }), R('S1', [50, 88], { end: [50, 74] }),
      F('N0', [20, 10], [0]), F('N2', [80, 10], [0]), F('S2', [20, 90], [0]), F('S0', [80, 90], [0])] },
    { id: 'Tt', count: 1, f: [M([50, 44]), R('E1', [86, 50], { end: [66, 50] }), R('S1', [50, 88], { end: [50, 66] }), R('W1', [14, 50], { end: [34, 50] }),
      F('W2 N E0', [50, 12]), F('E2 S0', [82, 82]), F('W0 S2', [18, 82])] },
    { id: 'Tu', count: 1, f: [C('N W', [22, 22], { good: 'g', gs: [36, 10] }), R('S1', [50, 82], { end: [44, 44] }), F('S2', [20, 80], [0]), F('S0 E', [76, 66], [0])] },
    { id: 'Tv', count: 1, hedge: 'M100 100 L64 64', f: [C('N W', [22, 22], { good: 'g', gs: [36, 10] }), R('S1', [50, 82], { end: [44, 44] }), F('S2', [20, 80], [0]), F('S0', [68, 90], [0]), F('E', [86, 58], [0])] },
    { id: 'Tw', count: 1, f: [C('N', [26, 12]), R('W1', [18, 50], { end: [46, 50] }), R('S1', [50, 82], { end: [50, 22] }), F('W2', [16, 30], [0]), F('W0 S2', [22, 80]), F('E S0', [78, 60], [0])] },
    { id: 'Tx', count: 1, bridge: 1, f: [R('N1 S1', [50, 24]), R('W1 E1', [24, 50]), F('W2 N0', [18, 18]), F('N2 E0', [82, 18]), F('E2 S0', [82, 82]), F('S2 W0', [18, 82])] },
  ];
  TB.forEach((d) => { d.set = 'tb'; });

  const ALL = BASE.concat(RIVER, IC, TB);
  const START_ID = 'D';

  function rotPt([x, y], r) { for (let i = 0; i < r; i++) [x, y] = [100 - y, x]; return [x, y]; }

  // Build TYPES[i] = { id, count, feats (base orientation), rot[r] = {portFeat[12], side[4], feats} }
  const TYPES = ALL.map((def, idx) => {
    const feats = def.f.map((f) => ({
      type: f.type, ports: ports(f.p), spot: f.spot, adj: f.adj || [], shield: f.shield || 0,
      inn: f.inn || null, cathedral: f.cathedral || 0, end: f.end || null,
      good: f.good || null, gs: f.gs || null, shape: f.shape || null,
    }));
    const rot = [];
    for (let r = 0; r < 4; r++) {
      const portFeat = new Array(12).fill(-1);
      const rf = feats.map((f, fi) => {
        const ps = f.ports.map((p) => (p + 3 * r) % 12);
        ps.forEach((p) => { if (portFeat[p] !== -1) throw new Error(def.id + ' port used twice'); portFeat[p] = fi; });
        const sides = f.type === 'city' ? [...new Set(ps.map((p) => Math.floor(p / 3)))]
          : f.type === 'road' || f.type === 'river' ? ps.filter((p) => p % 3 === 1).map((p) => (p - 1) / 3) : [];
        return { type: f.type, ports: ps, sides, shield: f.shield, adj: f.adj, spot: rotPt(f.spot, r), inn: !!f.inn, cathedral: f.cathedral, good: f.good };
      });
      if (portFeat.includes(-1)) throw new Error(def.id + ' has an uncovered port');
      const side = [0, 1, 2, 3].map((s) => ({ city: 'C', road: 'R', river: 'I' }[rf[portFeat[3 * s + 1]].type] || 'F'));
      rot.push({ portFeat, side, feats: rf, sig: side.join('') });
    }
    const river = feats.some((f) => f.type === 'river');
    return { idx, id: def.id, set: def.set, count: def.count, feats, rot, river, spring: !!def.spring, lake: !!def.lake, village: !!def.village, hedge: def.hedge || null, bridge: !!def.bridge };
  });

  const START = TYPES.findIndex((t) => t.id === START_ID);
  const byId = {}; TYPES.forEach((t) => { byId[t.id] = t.idx; });

  const SPRING = TYPES.findIndex((t) => t.spring), LAKE = TYPES.findIndex((t) => t.lake);

  // The land tiles shuffled into the main bag. Base game: every base tile but
  // the start tile. o.ic adds Inns & Cathedrals. o.river: the start tile goes
  // into the bag too (the spring starts the game; River rules), and the river
  // tiles are handled by the engine as their own stack.
  function bagCounts(o) {
    o = o || {};
    return TYPES.map((t) => {
      if (t.set === 'base') return t.count - (t.idx === START && !o.river ? 1 : 0);
      if (t.set === 'ic') return o.ic ? t.count : 0;
      if (t.set === 'tb') return o.tb ? t.count : 0;
      return 0;
    });
  }

  // Which tile types can fill a hole with these side requirements?
  // need[s] is 'C' | 'R' | 'F' | null (any). Returns type indexes (base set).
  function typesFitting(need) {
    return TYPES.filter((t) => t.set === 'base' && t.rot.some((R) => need.every((n, s) => !n || R.side[s] === n))).map((t) => t.idx);
  }

  const api = { TYPES, START, SPRING, LAKE, byId, bagCounts, typesFitting, rotPt, TOTAL: 72 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (typeof self !== 'undefined' ? self : window).CarcTiles = api;
})();
