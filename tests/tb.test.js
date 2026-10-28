// Traders & Builders (tiles, goods, builder, pig) and the "hand of tiles" house rule.
// ROOT=<other checkout> runs these against another copy of js/ (they fail on code without them).
const path = require('path');
const { ok, eq, done } = require('./helpers');
const ROOT = process.env.ROOT ? path.resolve(process.env.ROOT) : path.join(__dirname, '..');
const T = require(path.join(ROOT, 'js/tiles.js'));
const E = require(path.join(ROOT, 'js/engine.js'));
let AI = null;
try { AI = require(path.join(ROOT, 'js/ai.js')); } catch (e) { AI = null; }

const id = (L) => T.byId[L];
function play(st, L, x, y, r, fi, fig) {
  st.cur = id(L);
  return E.applyMut(st, { type: 'place', x, y, r, fi: fi == null ? -1 : fi, fig });
}
const fresh = (o) => E.newGame(Object.assign({ players: 2, seed: 7, tb: true }, o));
const tryIt = (f) => { try { f(); return true; } catch (e) { return false; } };

// ---- the tiles ----
const TB = T.TYPES.filter((t) => t.set === 'tb');
eq(TB.reduce((a, t) => a + t.count, 0), 24, '24 Traders & Builders tiles');
const goods = { w: 0, g: 0, c: 0 };
TB.forEach((t) => t.feats.forEach((f) => { if (f.good) goods[f.good] += t.count; }));
eq(goods, { w: 9, g: 6, c: 5 }, 'goods symbols: 9 wine, 6 grain, 5 cloth');
eq(TB.filter((t) => t.feats.some((f) => f.type === 'cloister')).length, 1, 'one monastery tile (three roads)');
eq(T.bagCounts({ tb: true }).reduce((a, b) => a + b, 0), 95, 'bag with T&B: 71 + 24');
eq(T.bagCounts({ tb: true, ic: true }).reduce((a, b) => a + b, 0), 113, 'bag with T&B and I&C: 71 + 24 + 18');
{
  const st = fresh();
  ok(st.fig && st.fig[0].b === 1 && st.fig[0].g === 1, 'each player has a builder and a pig');
  eq(st.goods, [[0, 0, 0], [0, 0, 0]], 'nobody has goods at the start');
  eq(st.bag.length + 1, 95, 'T&B game deals from a 95-tile bag (+1 in hand)');
  const off = E.newGame({ players: 2, seed: 7 });
  ok(!off.fig && !off.goods, 'T&B off by default: no figures, no goods');
}

// ---- goods: the player who finishes a city takes them, meeples or not ----
{
  const st = fresh();
  play(st, 'To', 0, -1, 1, -1);           // p0: wine city N-S joins the start city (no meeple)
  eq(st.goods[0], [0, 0, 0], 'no goods for an unfinished city');
  play(st, 'E', 0, -2, 2, -1);            // p1 closes it
  eq(st.goods[1], [1, 0, 0], 'the player who closed the city takes its wine');
  eq(st.goods[0], [0, 0, 0], 'the other player takes none');
  eq(st.scores, [0, 0], 'nobody had a meeple there: no points');
  eq(st.last.goods, [1, 0, 0], 'last move reports the goods taken');
  st.bag = [];
  play(st, 'U', 1, 0, 1, -1);             // last tile: game ends
  ok(st.over, 'game over');
  eq(st.scores, [0, 10], 'the most wine scores 10');
  eq(st.bd[1].goods, 10, 'breakdown: goods');
}
{
  // a tie for the most of a kind: both score 10
  const st = fresh();
  st.goods = [[2, 0, 1], [2, 0, 0]];
  st.bag = [];
  play(st, 'U', 1, 0, 1, -1);
  eq(st.scores, [20, 10], 'tie on wine: both 10; cloth: 10 to its only holder; grain: nobody');
}

// ---- builder: only on your own road/city, an extra turn when you extend it, then home ----
{
  const st = fresh();
  play(st, 'U', 1, 0, 1, 0);              // p0: road E-W joins the start road, meeple on it
  play(st, 'B', 0, 1, 0, -1);             // p1 elsewhere
  st.cur = id('U');
  eq(E.figSpots(st, 2, 0, 1).b, [0], 'p0 may put the builder on its own road');
  ok(!tryIt(() => E.apply(st, { type: 'place', x: 2, y: 0, r: 1, fi: 1, fig: 'b' })), 'no builder on a field');
  play(st, 'U', 2, 0, 1, 0, 'b');         // p0: builder on the road
  eq(st.fig[0].b, 0, 'builder is out');
  eq(st.meeples[0], 6, 'the builder is not a meeple');
  eq(st.turn, 1, 'placing the builder gives no extra turn');
  st.cur = id('U');
  eq(E.figSpots(st, -1, 0, 1).b, [], 'p1 has no meeple on the road: no builder spot');
  play(st, 'B', 0, 2, 0, -1);             // p1 elsewhere
  play(st, 'U', -1, 0, 1, -1);            // p0 extends the road with the builder on it
  eq(st.turn, 0, 'extending your builder\'s road: another turn');
  ok(st.bonus && st.last.bonus, 'flagged as the bonus turn');
  play(st, 'U', -2, 0, 1, -1);            // the bonus tile extends it again
  eq(st.turn, 1, 'only one extra turn, never a third');
  ok(!st.bonus, 'bonus over');
  play(st, 'B', 1, 1, 0, -1);             // p1
  play(st, 'A', 3, 0, 1, -1);             // p0 closes the east end (extra turn again)
  eq(st.turn, 0, 'extra turn again on a later turn');
  play(st, 'A', -3, 0, 3, -1);            // p0 closes the west end: road done
  eq(st.scores[0], 7, 'road of 7 tiles scores 7 (the builder adds nothing)');
  eq(st.fig[0].b, 1, 'builder comes home when the road is finished');
  eq(st.meeples[0], 7, 'meeple comes home too');
  ok(!Object.values(st.board).some((t) => t.x), 'no figure left on the board');
}

// ---- pig: 4 a finished city for its farm (3rd edition), +1 a city (1st edition) ----
for (const [farm, want] of [['3rd', 4], ['1st', 5]]) {
  const st = fresh({ farm });
  play(st, 'E', 0, -1, 2, 1);             // p0: closes the start city, farmer on the field round it
  play(st, 'B', 0, 1, 0, -1);             // p1
  st.cur = id('B');
  eq(E.figSpots(st, 1, -1, 0).g, [1], 'pig spot on the field with p0\'s farmer (' + farm + ')');
  play(st, 'B', 1, -1, 0, 1, 'g');        // p0: pig on that farm
  eq(st.fig[0].g, 0, 'pig is out');
  st.bag = [];
  play(st, 'B', 0, 2, 0, -1);             // p1: last tile
  eq(st.scores[0], want, 'farm with the pig: ' + want + ' for one finished city (' + farm + ' edition farms)');
}
{
  const st = fresh();
  play(st, 'E', 0, -1, 2, 1);
  play(st, 'B', 0, 1, 0, -1);
  st.bag = [];
  play(st, 'B', 1, -1, 0, -1);            // no pig
  eq(st.scores[0], 3, 'same farm without the pig: 3');
}

// ---- hand of tiles (house rule) ----
{
  const st = E.newGame({ players: 3, seed: 11, hand: 2 });
  ok(Array.isArray(st.hands) && st.hands.every((h) => h.length === 2), 'hand of 2: everyone holds 2 tiles');
  eq(st.cur, st.hands[0][0], 'the tile in play is the first held one');
  eq(st.bag.length, 71 - 6, 'six tiles dealt out of the bag');
  const other = st.hands[0][1];
  const legal = E.legalFor(st, other)[0];
  const s2 = E.apply(st, { type: 'place', x: legal.x, y: legal.y, r: legal.r, fi: -1, t: other });
  eq(s2.board[legal.x + ',' + legal.y].t, other, 'playing the second held tile');
  eq(s2.hands[0].length, 2, 'drew one back');
  ok(s2.hands[0].includes(st.hands[0][0]), 'kept the other tile');
  ok(!tryIt(() => E.apply(st, { type: 'place', x: legal.x, y: legal.y, r: legal.r, fi: -1, t: st.hands[1][0] === other ? -5 : (st.hands[0].includes(st.hands[1][0]) ? -5 : st.hands[1][0]) })), 'cannot play a tile you do not hold');
  const off = E.newGame({ players: 2, seed: 11 });
  ok(!off.hands, 'off by default');
  const rv = E.newGame({ players: 2, seed: 11, hand: 3, river: true });
  ok(!rv.hands, 'not with the River (the river is one stack)');
}

// ---- random full games: every tile is used, pieces are never lost ----
function randomGame(o, seed, useAI) {
  const st = E.newGame(Object.assign({ players: 3, seed }, o));
  const rand = E.rng(seed * 31 + 5);
  let guard = 0;
  while (!st.over && guard++ < 400) {
    let a;
    if (useAI && AI) a = AI.choose(st, ['easy', 'medium', 'hard'][st.turn % 3], rand);
    else {
      const ts = st.hands ? st.hands[st.turn].slice() : [st.cur];
      const t = ts[Math.floor(rand() * ts.length)];
      const L = E.legalFor(st, t);
      if (!L.length) { a = { type: 'place', x: 0, y: 0, r: 0, fi: -1, t }; }
      const m = L[Math.floor(rand() * L.length)] || L[0];
      if (st.hands) E.pick(st, t);
      const fs = E.figSpots(st, m.x, m.y, m.r), ms = E.meepleSpots(st, m.x, m.y, m.r);
      const roll = rand();
      if (fs.b.length && roll < 0.3) a = { type: 'place', x: m.x, y: m.y, r: m.r, fi: fs.b[0], fig: 'b' };
      else if (fs.g.length && roll < 0.5) a = { type: 'place', x: m.x, y: m.y, r: m.r, fi: fs.g[0], fig: 'g' };
      else if (ms.length && roll < 0.8) a = { type: 'place', x: m.x, y: m.y, r: m.r, fi: ms[Math.floor(rand() * ms.length)], big: !E.hasMeeple(st, st.turn, false) };
      else a = { type: 'place', x: m.x, y: m.y, r: m.r, fi: -1 };
      a.t = t;
    }
    E.applyMut(st, a);
    // pieces: out on the board + in the supply = what you started with
    for (let p = 0; p < st.n; p++) {
      let men = 0, figs = { b: 0, g: 0 };
      for (const k in st.board) { const tl = st.board[k]; if (tl.m && tl.m[0] === p && !tl.m[2]) men++; if (tl.x && tl.x[0] === p) figs[tl.x[2]]++; }
      if (men + st.meeples[p] !== 7) { ok(false, 'meeples lost seed ' + seed); return st; }
      if (st.fig && (figs.b + st.fig[p].b !== 1 || figs.g + st.fig[p].g !== 1)) { ok(false, 'figures lost seed ' + seed); return st; }
    }
  }
  return st;
}
let used = true, ended = true, bonus = 0, goodsTaken = 0;
for (let i = 0; i < 40; i++) {
  const o = { tb: true, ic: i % 2 === 0, hand: [1, 2, 3][i % 3] };
  const st = randomGame(o, 900 + i, i >= 20);
  if (!st.over) ended = false;
  const total = T.bagCounts(o).reduce((a, b) => a + b, 0) + 1;
  if (Object.keys(st.board).length + st.discards.length !== total) used = false;
  goodsTaken += st.goods.reduce((a, q) => a + q[0] + q[1] + q[2], 0);
}
ok(ended, '40 random T&B / hand games all end');
ok(used, 'every tile is placed or set aside (hands emptied at the end)');
ok(goodsTaken > 100, 'goods are taken in random games (' + goodsTaken + ')');

if (AI) {
  // the computer uses the new pieces
  let b = 0, g = 0, tFromHand = 0;
  for (let i = 0; i < 6; i++) {
    const st = E.newGame({ players: 2, seed: 300 + i, tb: true, hand: 2 });
    const rand = E.rng(i + 1);
    while (!st.over) {
      const a = AI.choose(st, 'hard', rand);
      if (a.fig === 'b') b++;
      if (a.fig === 'g') g++;
      if (a.t != null && a.t !== st.cur) tFromHand++;
      E.applyMut(st, a);
    }
  }
  ok(b >= 3, 'Hard puts its builder out (' + b + ' in 6 games)');
  ok(g >= 2, 'Hard puts its pig out (' + g + ' in 6 games)');
  ok(tFromHand >= 20, 'Hard plays the second tile of its hand when it is better (' + tFromHand + ')');
}
done('tb');
