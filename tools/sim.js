// Measure computer strength: play many games between levels, print win rates
// and average scores. Usage: node tools/sim.js [games]
const E = require('../js/engine.js');
const AI = require('../js/ai.js');

function game(levels, seed) {
  let st = E.newGame({ players: levels.length, seed });
  const rand = E.rng(seed * 7919 + 1);
  while (!st.over) E.applyMut(st, AI.choose(st, levels[st.turn], rand));
  return st.scores;
}

// Seats rotate so nobody gains from going first.
function match(a, b, games) {
  let wa = 0, wb = 0, tie = 0, pa = 0, pb = 0, first = 0;
  for (let i = 0; i < games; i++) {
    const swap = i % 2 === 1;
    const s = game(swap ? [b, a] : [a, b], 1000 + i);
    first += s[0] > s[1] ? 1 : s[0] === s[1] ? 0.5 : 0;
    const sa = swap ? s[1] : s[0], sb = swap ? s[0] : s[1];
    pa += sa; pb += sb;
    if (sa > sb) wa++; else if (sb > sa) wb++; else tie++;
  }
  return { a, b, games, winA: (100 * (wa + tie / 2) / games).toFixed(1), avgA: (pa / games).toFixed(1), avgB: (pb / games).toFixed(1), firstSeatWins: (100 * first / games).toFixed(1) };
}

// One `who` against three `rest`, seat rotating. Fair share is 25%.
function four(who, rest, games) {
  let win = 0, pts = 0, ptsRest = 0;
  for (let i = 0; i < games; i++) {
    const seats = [rest, rest, rest]; seats.splice(i % 4, 0, who);
    const s = game(seats, 50000 + i);
    const top = Math.max(...s), me = s[i % 4];
    if (me === top) win += 1 / s.filter((v) => v === top).length;
    pts += me; ptsRest += (s.reduce((a, b) => a + b, 0) - me) / 3;
  }
  return { who, rest, games, win: (100 * win / games).toFixed(1), avg: (pts / games).toFixed(1), avgRest: (ptsRest / games).toFixed(1) };
}

const N = +process.argv[2] || 400;
const t0 = Date.now();
console.log(JSON.stringify(match('hard', 'medium', N)));
console.log(JSON.stringify(match('hard', 'easy', N)));
console.log(JSON.stringify(match('medium', 'easy', N)));
console.log(JSON.stringify(match('hard', 'hard', N)));
console.log(JSON.stringify(four('hard', 'medium', Math.round(N / 2))));
console.log(JSON.stringify(four('medium', 'easy', Math.round(N / 2))));
console.log('seconds', ((Date.now() - t0) / 1000).toFixed(1));
