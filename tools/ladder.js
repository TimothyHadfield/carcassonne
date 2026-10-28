// The level ladder in one run: head-to-head win rates (seats swapped), the
// fair share against three of the level below, how often each level puts a
// farmer down, and how often Hard repeats itself from the same position.
// Usage: node tools/ladder.js [games]   (AI=<path> tests another ai.js)
const path = require('path');
const E = require('../js/engine.js');
const AI = require(process.env.AI ? path.resolve(process.env.AI) : '../js/ai.js');
const T = require('../js/tiles.js');

const farmers = {}, placed = {};
function game(levels, seed) {
  const st = E.newGame({ players: levels.length, seed });
  const rand = E.rng(seed * 7919 + 1);
  while (!st.over) {
    const lv = levels[st.turn], a = AI.choose(st, lv, rand);
    placed[lv] = (placed[lv] || 0) + 1;
    if (a.fi >= 0 && T.TYPES[st.cur].rot[a.r].feats[a.fi].type === 'field') farmers[lv] = (farmers[lv] || 0) + 1;
    E.applyMut(st, a);
  }
  return st.scores;
}
function match(a, b, games) {
  let wa = 0;
  for (let i = 0; i < games; i++) {
    const swap = i % 2 === 1, s = game(swap ? [b, a] : [a, b], 1000 + i);
    const sa = swap ? s[1] : s[0], sb = swap ? s[0] : s[1];
    wa += sa > sb ? 1 : sa === sb ? 0.5 : 0;
  }
  return `${a} vs ${b}: ${(100 * wa / games).toFixed(1)}%`;
}
function four(who, rest, games) {
  let win = 0;
  for (let i = 0; i < games; i++) {
    const seats = [rest, rest, rest]; seats.splice(i % 4, 0, who);
    const s = game(seats, 50000 + i), top = Math.max(...s);
    if (s[i % 4] === top) win += 1 / s.filter((v) => v === top).length;
  }
  return `${who} vs 3 ${rest}: ${(100 * win / games).toFixed(1)}% (fair 25%)`;
}
// Predictability: from the same 40 positions, how often does a level pick the
// same move twice in a row (different random streams)?
function repeats(level) {
  let same = 0, n = 0;
  for (let i = 0; i < 40; i++) {
    const st = E.newGame({ players: 2, seed: 777 + i });
    const r0 = E.rng(i);
    for (let k = 0; k < 10 + (i % 20); k++) E.applyMut(st, AI.choose(st, 'medium', r0));
    if (st.over) continue;
    const a = AI.choose(st, level, E.rng(1000 + i)), b = AI.choose(st, level, E.rng(5000 + i));
    n++; if (JSON.stringify(a) === JSON.stringify(b)) same++;
  }
  return `${level} same move twice: ${same}/${n}`;
}

const N = +process.argv[2] || 200;
const t0 = Date.now();
for (const [a, b] of [['hard', 'medium'], ['medium', 'easy'], ['hard', 'easy']]) console.log(match(a, b, N));
console.log(four('hard', 'medium', N / 2));
console.log(four('medium', 'easy', N / 2));
for (const lv of ['easy', 'medium', 'hard']) console.log(`${lv} farmers per 100 moves: ${(100 * (farmers[lv] || 0) / (placed[lv] || 1)).toFixed(1)}`);
for (const lv of ['easy', 'medium', 'hard']) console.log(repeats(lv));
console.log('seconds', ((Date.now() - t0) / 1000).toFixed(0));
