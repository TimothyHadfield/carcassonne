// Odds math checked against brute force (every ordering of a small bag) and
// hand-worked numbers.
const { eq, near, ok, done } = require('./helpers');
const O = require('../js/odds.js');
const T = require('../js/tiles.js');

// Hand-worked: 10 tiles, 1 good, 1 draw -> 10%. 2 good, 2 draws -> 1 - (8/10)(7/9) = 17/45.
near(O.pAtLeastOne(10, 1, 1), 0.1, 1e-12, '1 good in 10, one draw');
near(O.pAtLeastOne(10, 2, 2), 17 / 45, 1e-12, '2 good in 10, two draws');
eq(O.pAtLeastOne(5, 0, 3), 0, 'no good tiles left');
eq(O.pAtLeastOne(5, 3, 3), 1, 'more draws than bad tiles = certain');

// Brute force: every permutation of a bag of 7 tiles (3 good), 3 players,
// I'm seat 1, 0 drawn. Count orderings where a good tile lands on one of my turns.
function perms(a) { if (a.length <= 1) return [a]; const out = []; a.forEach((x, i) => { for (const p of perms(a.slice(0, i).concat(a.slice(i + 1)))) out.push([x].concat(p)); }); return out; }
for (const [N, K, P, seat, drawn] of [[7, 3, 3, 1, 0], [7, 1, 2, 0, 0], [8, 2, 4, 3, 1], [6, 2, 2, 1, 3]]) {
  const bag = []; for (let i = 0; i < N; i++) bag.push(i < K ? 1 : 0);
  let hit = 0, all = 0;
  for (const order of perms(bag)) {
    all++;
    let got = false;
    for (let j = 0; j < N; j++) if ((j + drawn) % P === seat && order[j]) got = true;
    if (got) hit++;
  }
  const { m } = O.myDraws(N + drawn, drawn, P, seat);
  near(O.pAtLeastOne(N, K, m), hit / all, 1e-12, `brute force N=${N} K=${K} P=${P} seat=${seat} drawn=${drawn}`);
}

// Turn counting
eq(O.myDraws(71, 0, 2, 0), { m: 36, untilNext: 0 }, '2 players: first player gets 36 of 71 draws');
eq(O.myDraws(71, 0, 2, 1), { m: 35, untilNext: 1 }, 'second player 35');
eq(O.myDraws(71, 70, 3, 1), { m: 1, untilNext: 0 }, 'last tile goes to seat 70 % 3 = 1');

// Which tiles fit a hole
const ids = (list) => list.map((i) => T.TYPES[i].id).sort().join('');
eq(ids(T.typesFitting(['C', 'C', 'C', 'C'])), 'C', 'only C closes a hole with city on 4 sides');
eq(ids(T.typesFitting(['R', 'R', 'R', 'R'])), 'X', 'crossroads');
eq(ids(T.typesFitting(['C', null, null, null])), 'CDEFGHIJKLMNOPQRST', 'any tile with a city side');
ok(T.typesFitting(['F', 'F', 'F', 'F']).length === 1, 'all-field hole: only the plain monastery');

done('odds');
