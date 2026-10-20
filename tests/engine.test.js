// Rules engine tests: tile set facts, hand-worked scoring cases, and random
// full games checked against invariants.
const { ok, eq, done } = require('./helpers');
const T = require('../js/tiles.js');
const E = require('../js/engine.js');

const id = (L) => T.byId[L];
// Force the tile in hand (tests build exact boards).
function play(st, L, x, y, r, fi) { st.cur = id(L); return E.applyMut(st, { type: 'place', x, y, r, fi: fi == null ? -1 : fi }); }
function fresh(o) { const st = E.newGame(Object.assign({ players: 2, seed: 7 }, o)); return st; }

// ---- tile set ----
const BASE = T.TYPES.filter((t) => t.set === 'base');
const total = BASE.reduce((a, t) => a + t.count, 0);
eq(total, 72, '72 tiles in the base game');
eq(T.bagCounts().reduce((a, b) => a + b, 0), 71, '71 tiles in the bag (start tile set aside)');
eq(BASE.reduce((a, t) => a + t.count * t.feats.filter((f) => f.shield).length, 0), 10, '10 shields');
eq(BASE.reduce((a, t) => a + t.count * t.feats.filter((f) => f.type === 'cloister').length, 0), 6, '6 monasteries');
const expect = { A: 2, B: 4, C: 1, D: 4, E: 5, F: 2, G: 1, H: 3, I: 2, J: 3, K: 3, L: 3, M: 2, N: 3, O: 2, P: 3, Q: 1, R: 3, S: 2, T: 1, U: 8, V: 9, W: 4, X: 1 };
for (const L in expect) eq(T.TYPES[id(L)].count, expect[L], 'count of tile ' + L);
eq(T.TYPES[T.START].id, 'D', 'start tile is D (city top, straight road)');
eq(T.TYPES[id('D')].rot[0].sig, 'CRFR', 'D sides');
eq(T.TYPES[id('J')].rot[0].sig, 'CRRF', 'J: city N, road E-S');
eq(T.TYPES[id('K')].rot[0].sig, 'CFRR', 'K: city N, road S-W');
eq(T.TYPES[id('V')].rot[1].sig, 'RFFR', 'V rotated once: road W-N');
// Edge count totals across the full set (sum over tiles of city/road sides):
let citySides = 0, roadSides = 0;
for (const t of BASE) for (const s of t.rot[0].side) { if (s === 'C') citySides += t.count; if (s === 'R') roadSides += t.count; }
eq(citySides, 79, 'city edges across the set (hand-counted from the tile list)');
eq(roadSides, 94, 'road edges across the set (hand-counted from the tile list)');

// ---- 2-tile city ----
{
  const st = fresh();
  play(st, 'E', 0, -1, 2, 0);                 // city facing south, meeple on it
  eq(st.scores, [4, 0], 'two-tile city scores 4');
  eq(st.meeples, [7, 7], 'meeple comes back when the city is finished');
  eq(st.bd[0].city, 4, 'breakdown city');
  const s1 = fresh({ smallCity: 2 });
  play(s1, 'E', 0, -1, 2, 0);
  eq(s1.scores, [2, 0], 'old-rules two-tile city scores 2');
  // Old rule: 1 per tile and 1 per shield, so a 2-tile city with a shield is 3.
  eq(E.cityPoints(s1, 2, 1, true, false), 3, 'old-rules two-tile city with a shield scores 3');
  eq(E.cityPoints(st, 2, 1, true, false), 6, 'current-rules two-tile city with a shield scores 6');
}
{
  const st = fresh();
  play(st, 'M', 0, -1, 2, 0);                 // shield city (S+E) joins the start city
  play(st, 'E', 1, -1, 3, -1);                // closes its east side
  eq(st.scores[0], 8, 'finished 3-tile city with a shield = 2x3 + 2');
}
// ---- road closed at both ends ----
{
  const st = fresh();
  play(st, 'L', 1, 0, 0, 3);                  // L's west road joins the start road, meeple on it
  eq(st.meeples[0], 6, 'meeple out on the road');
  play(st, 'L', -1, 0, 0, -1);                // other end closes it
  eq(st.scores[0], 3, 'three-tile road scores 3 for its owner');
  eq(st.scores[1], 0, 'player 2 had no meeple there');
  eq(st.meeples[0], 7, 'road meeple returned');
}
// ---- cannot claim an occupied feature, majority ties ----
{
  const st = fresh();
  play(st, 'L', 1, 0, 0, 3);                  // P0 on the start road (east part)
  const spots = E.meepleSpots(Object.assign(st, { cur: id('L') }), -1, 0, 0);
  ok(!spots.includes(1), 'road already claimed: no meeple on its east end');
  ok(spots.includes(0), 'city of the new tile is free');
}
{
  const st = fresh();
  ok(!E.fits(st, 1, 0, id('E'), 3), 'city edge cannot touch a road edge');
  ok(E.fits(st, 0, -1, id('E'), 2), 'city edge meets city edge');
  ok(!E.fits(st, 5, 5, id('E'), 0), 'must touch the board');
  ok(!E.fits(st, 0, 0, id('E'), 0), 'cannot place on a used square');
  let threw = false; try { play(st, 'E', 5, 5, 0); } catch (e) { threw = true; }
  ok(threw, 'apply refuses an illegal placement');
}
{
  // Two cities claimed by different players, then joined: tie, both score in full.
  const st = fresh();
  play(st, 'R', 0, -1, 2, 0);   // P0: three-sided city joins the start city, meeple on it
  play(st, 'K', 1, 0, 0, 0);    // P1: separate city cap at (1,0), meeple on it
  eq(E.meepleSpots(Object.assign(st, { cur: id('N') }), 1, -1, 3).includes(0), false, 'joined city already has meeples');
  play(st, 'N', 1, -1, 3, -1);  // P0: joins both cities (open: west side of (0,-1))
  eq(st.scores, [0, 0], 'not finished yet');
  play(st, 'E', -1, -1, 1, -1); // P1: closes it
  eq(st.scores, [10, 10], 'tie: both get 2 x 5 tiles');
  eq(st.meeples, [7, 7], 'both meeples back');
}
{
  // Monastery: unfinished at the end = 1 + neighbours; surrounded = 9.
  const st = fresh();
  play(st, 'B', 0, 1, 0, 0);
  eq(st.meeples[0], 6, 'monk placed');
  st.bag = [];                                   // next move ends the game
  play(st, 'U', 1, 0, 1, -1);                    // road east of the start tile (diagonal to the monastery)
  ok(st.over, 'empty bag ends the game');
  eq(st.scores[0], 3, 'unfinished monastery: 1 + 2 neighbours');
  eq(st.bd[0].cloister, 3, 'breakdown cloister');
}
{
  const st = fresh();
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++)
    if (dx || dy) E._put(st, 10 + dx, 10 + dy, id('B'), 0, -1, -1);
  E._put(st, 10, 8, id('B'), 0, -1, -1);         // keeps the test board legal-looking
  play(st, 'B', 10, 10, 0, 0);
  eq(st.scores[0], 9, 'surrounded monastery scores 9');
  eq(st.meeples[0], 7, 'monk returned');
}
{
  // Farm: a farmer next to one finished city scores 3 at the end.
  const st = fresh();
  play(st, 'E', 0, -1, 2, 1);                    // closes the 2-tile city; farmer on its field
  eq(st.scores[0], 0, 'nobody on the city');
  eq(st.meeples[0], 6, 'farmer stays out');
  st.bag = [];
  play(st, 'U', 1, 0, 1, -1);
  eq(st.bd[0].farm, 3, 'farm next to one finished city = 3');
  for (const farm of ['3rd', '1st']) {
    // Two separate fields touch the same finished city: P0 on one, P1 on the other.
    const s = fresh({ farm });
    play(s, 'E', 0, -1, 2, 1);                     // P0 farmer north of the 2-tile city
    s.bag = [];
    play(s, 'K', 1, 0, 0, 2);                      // P1 farmer in the start tile's north field
    if (farm === '3rd') eq([s.bd[0].farm, s.bd[1].farm], [3, 3], 'current rules: each field scores the city (3 each)');
    else eq([s.bd[0].farm, s.bd[1].farm], [4, 4], 'first-edition farms: the city pays 4 to the tied farmers');
  }
  const s2 = fresh({ farmers: false });
  eq(E.meepleSpots(Object.assign(s2, { cur: id('E') }), 0, -1, 2), [0], 'no-farmers variant: fields cannot be claimed');
}
{
  // Unfinished city with a shield at the end: 1 per tile + 1 per shield.
  const st = fresh();
  play(st, 'M', 0, -1, 2, 0);                    // M turned: city S+E, joins the start city
  st.bag = [];
  play(st, 'U', 1, 0, 1, -1);
  eq(st.bd[0].city, 3, 'unfinished 2-tile city with a shield = 3');
}

// ---- The River ----
const sets = (name) => T.TYPES.filter((t) => t.set === name);
eq(sets('river').reduce((a, t) => a + t.count, 0), 12, 'River: 12 tiles');
eq(sets('river').filter((t) => t.spring || t.lake).length, 2, 'River: one spring, one lake');
eq(sets('river').map((t) => t.id + t.count).join(' '), 'RS1 RL1 RA1 RB1 RC1 RD1 RE2 RF1 RG1 RH2', 'River: tile mix (JCloisterZone river/1:1 + Annotated Rules p.30)');
{
  const st = fresh({ river: true });
  eq(st.board['0,0'].t, T.SPRING, 'River: the spring starts the game');
  ok(T.TYPES[st.cur].river, 'River: river tiles are drawn first');
  ok(E.legalPlacements(st).every((m) => m.x === 1 && m.y === 0), 'River: must continue the river at its open end');
  eq(T.bagCounts({ river: true })[T.START], 4, 'River: the base start tile goes into the bag');
  // U-turn: a right-hand curve, then another right-hand curve is not allowed.
  st.cur = id('RH');
  E.applyMut(st, { type: 'place', x: 1, y: 0, r: 0, fi: -1 });   // W->S: turns right
  eq([st.river.x, st.river.y, st.river.turn], [1, 1, 1], 'River: open end moves on, turn remembered');
  ok(!E.canPlace(st, 1, 1, id('RH'), 1), 'River: second right turn in a row (U-turn) refused');
  ok(E.canPlace(st, 1, 1, id('RH'), 2), 'River: turning back left is fine');
  ok(!E.canPlace(st, 0, 1, id('RE'), 0), 'River: cannot place a river tile away from the open end');
}
{
  // Whole river laid first, lake last, in every game.
  let bad = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const st = E.newGame({ players: 2, river: true, seed });
    const rand = E.rng(seed);
    const order = [];
    while (!st.over) {
      const L = E.legalPlacements(st), m = L[Math.floor(rand() * L.length)];
      order.push(st.cur);
      E.applyMut(st, { type: 'place', x: m.x, y: m.y, r: m.r, fi: -1 });
    }
    const firstLand = order.findIndex((t) => !T.TYPES[t].river);
    if (order.slice(firstLand).some((t) => T.TYPES[t].river)) bad++;
    if (order[firstLand - 1] !== T.LAKE && !st.discards.includes(T.LAKE)) bad++;
  }
  eq(bad, 0, 'River: river tiles all come before land tiles, lake last');
}

// ---- Inns & Cathedrals ----
eq(sets('ic').reduce((a, t) => a + t.count, 0), 18, 'I&C: 18 tiles');
eq(sets('ic').reduce((a, t) => a + t.count * t.feats.filter((f) => f.inn).length, 0), 6, 'I&C: 6 inns');
eq(sets('ic').reduce((a, t) => a + t.count * t.feats.filter((f) => f.cathedral).length, 0), 2, 'I&C: 2 cathedrals');
{
  // Inn on a finished road: 2 per tile. Road (-1,0)..(2,0) = 4 tiles = 8.
  const st = fresh({ ic: true });
  play(st, 'Ko', 1, 0, 0, 0);                    // P0: inn road joins the start road, meeple on it
  play(st, 'A', 2, 0, 1, -1);                    // P1: monastery ends the road in the east
  play(st, 'A', -1, 0, 3, -1);                   // P0: ends it in the west
  eq(st.scores[0], 8, 'I&C: finished road with an inn = 2 x 4 tiles');
  const s2 = fresh({ ic: true });
  play(s2, 'Ko', 1, 0, 0, 0);
  s2.bag = [];
  play(s2, 'U', 0, 1, 1, -1);
  eq(s2.bd[0].road, 0, 'I&C: unfinished road with an inn scores 0');
}
{
  // Cathedral: start city + cathedral + 3 caps = 5 tiles x 3 = 15.
  const st = fresh({ ic: true });
  play(st, 'Ka', 0, -1, 0, 0);                   // P0: cathedral joins the start city, meeple on it
  play(st, 'E', 0, -2, 2, -1);
  play(st, 'E', 1, -1, 3, -1);
  eq(st.scores[0], 0, 'I&C: not finished yet');
  play(st, 'E', -1, -1, 1, -1);
  eq(st.scores[0], 15, 'I&C: finished cathedral city = 3 x 5 tiles');
  const s2 = fresh({ ic: true });
  play(s2, 'Ka', 0, -1, 0, 0);
  s2.bag = [];
  play(s2, 'U', 0, 1, 1, -1);
  eq(s2.bd[0].city, 0, 'I&C: unfinished cathedral city scores 0');
}
{
  // Large meeple counts as two: P0 (large) beats P1 (one normal) on a joined road.
  const st = fresh({ ic: true });
  eq(st.big, [1, 1], 'I&C: one large meeple each');
  st.cur = id('U'); E.applyMut(st, { type: 'place', x: 1, y: 0, r: 1, fi: 0, big: true });
  eq([st.big[0], st.meeples[0]], [0, 7], 'I&C: the large meeple left the supply, not a normal one');
  E._put(st, -2, 0, id('U'), 1, 1, 0);           // P1: separate road with a normal meeple
  play(st, 'U', -1, 0, 1, -1);                   // joins both roads
  play(st, 'A', 2, 0, 1, -1);
  play(st, 'A', -3, 0, 3, -1);                   // 6-tile road finished
  eq(st.scores, [6, 0], 'I&C: large meeple (2) beats one meeple (1)');
  eq([st.big[0], st.meeples[1]], [1, 7], 'I&C: both come home');
  let threw = false;
  const s3 = fresh({ ic: true }); s3.big[0] = 0;
  s3.cur = id('U'); try { E.applyMut(s3, { type: 'place', x: 1, y: 0, r: 1, fi: 0, big: true }); } catch (e) { threw = true; }
  ok(threw, 'I&C: no second large meeple');
}

// ---- random full games: invariants + the look-ahead agrees with the real move ----
{
  let games = 0, moves = 0, mismatch = 0, conserve = 0, sumOk = 0, legalOk = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const opts = { players: 2 + (seed % 4), seed, river: seed % 4 === 1 || seed % 4 === 3, ic: seed % 4 >= 2 };
    let st = E.newGame(opts);
    const rand = E.rng(seed * 31);
    while (!st.over) {
      const L = E.legalPlacements(st);
      if (!L.length) { legalOk++; break; }
      const m = L[Math.floor(rand() * L.length)];
      const spots = E.meepleSpots(st, m.x, m.y, m.r);
      const fi = spots.length && rand() < 0.5 ? spots[Math.floor(rand() * spots.length)] : -1;
      const big = fi >= 0 && (!E.hasMeeple(st, st.turn, false) || (E.hasMeeple(st, st.turn, true) && rand() < 0.3));
      const A = E.analyze(st, m.x, m.y, st.cur, m.r);
      const nst = E.apply(st, { type: 'place', x: m.x, y: m.y, r: m.r, fi, big });
      // every city/road feature: predicted open edges == real open edges after joining
      const tile = nst.board[E.K(m.x, m.y)];
      A.comps.forEach((C) => {
        if (C.type !== 'city' && C.type !== 'road') return;
        const g = nst.groups[E.find(nst, tile.g[C.fis[0]])];
        if (g.open !== C.open) mismatch++;
        if (C.fis.some((f) => E.find(nst, tile.g[f]) !== E.find(nst, tile.g[C.fis[0]]))) mismatch++;
      });
      st = nst; moves++;
      const onBoard = new Array(st.n).fill(0), bigOn = new Array(st.n).fill(0);
      for (const k in st.board) { const tm = st.board[k].m; if (tm) (tm[2] ? bigOn : onBoard)[tm[0]]++; }
      if (onBoard.some((v, p) => v + st.meeples[p] !== 7)) conserve++;
      if (bigOn.some((v, p) => v + st.big[p] !== (opts.ic ? 1 : 0))) conserve++;
    }
    const bdSum = st.bd.map((b) => b.city + b.road + b.cloister + b.farm);
    if (JSON.stringify(bdSum) === JSON.stringify(st.scores)) sumOk++;
    eq(Object.keys(st.board).length + st.discards.length, 72 + (opts.river ? 12 : 0) + (opts.ic ? 18 : 0), 'every tile used or set aside (seed ' + seed + ')');
    games++;
  }
  eq(mismatch, 0, 'look-ahead matches the real placement in ' + moves + ' moves');
  eq(conserve, 0, 'meeples always 7 per player (board + supply)');
  eq(sumOk, games, 'score = city + road + cloister + farm');
  eq(legalOk, 0, 'a drawn tile always has somewhere to go');
}
{
  // view() hides the bag order but keeps the counts
  const st = E.newGame({ seed: 3 });
  const v = E.view(st, 0);
  eq(v.bag.every((t, i) => i === 0 || v.bag[i - 1] <= t), true, 'bag order hidden (sorted)');
  eq(v.bag.length, st.bag.length, 'bag size kept');
  eq(JSON.stringify(v.bag.slice().sort((a, b) => a - b)), JSON.stringify(st.bag.slice().sort((a, b) => a - b)), 'same tiles left');
  eq(v.bagCounts.reduce((a, b) => a + b, 0), st.bag.length, 'bag counts shown');
  const a = E.legalPlacements(st)[0];
  const before = JSON.stringify(st);
  E.apply(st, { type: 'place', x: a.x, y: a.y, r: a.r, fi: -1 });
  eq(JSON.stringify(st), before, 'apply() does not change the old state');
}

done('engine');

