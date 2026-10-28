// The improvement pass (2026-10-27), in plain node:
// every computer level puts down farmers; no level is predictable; a game rebuilt from its
// move list is exactly the game (Undo and Replay depend on it); a finished game -> the right
// My stats record (rated / with help / friends / online / draw / the strongest computer).
// Usage: node tests/improve.test.js
const { ok, eq, done } = require('./helpers');
const E = require('../js/engine.js');
const AI = require('../js/ai.js');
const T = require('../js/tiles.js');
const CP = require('../js/carcprofile.js');

// ---- farmers and variety, per level (20 two-player games each against Medium)
for (const lv of ['easy', 'medium', 'hard']) {
  let farm = 0, moves = 0;
  for (let i = 0; i < 20; i++) {
    const st = E.newGame({ players: 2, seed: 300 + i }), rand = E.rng(9 + i);
    while (!st.over) {
      const who = st.turn === i % 2 ? lv : 'medium', a = AI.choose(st, who, rand);
      if (who === lv) { moves++; if (a.fi >= 0 && T.TYPES[st.cur].rot[a.r].feats[a.fi].type === 'field') farm++; }
      E.applyMut(st, a);
    }
  }
  ok(farm / moves >= 0.02, `${lv} puts down farmers (${farm} in ${moves} moves)`);
}
for (const lv of ['easy', 'medium', 'hard']) {
  let differ = 0;
  for (let i = 0; i < 30; i++) {
    const st = E.newGame({ players: 2, seed: 900 + i }), r0 = E.rng(i);
    for (let k = 0; k < 12 + (i % 15); k++) E.applyMut(st, AI.choose(st, 'medium', r0));
    if (st.over) continue;
    const seen = new Set();
    for (let s = 0; s < 4; s++) seen.add(JSON.stringify(AI.choose(st, lv, E.rng(1000 * s + i))));
    if (seen.size > 1) differ++;
  }
  ok(differ >= 8, `${lv} doesn't always play the same move from the same spot (${differ} of 30 positions vary)`);
}

// ---- a game rebuilt from its moves is the same game (what Undo and Replay do)
{
  const st = E.newGame({ players: 3, seed: 4242 }), rand = E.rng(5), acts = [];
  while (!st.over) { const a = AI.choose(st, ['hard', 'easy', 'medium'][st.turn], rand); acts.push(JSON.parse(JSON.stringify(a))); E.applyMut(st, a); }
  const re = E.newGame(JSON.parse(JSON.stringify(st.opts)));
  acts.forEach((a) => E.applyMut(re, a));
  eq(re.scores, st.scores, 'rebuilt game: same scores');
  ok(JSON.stringify(re.board) === JSON.stringify(st.board) && re.over, `rebuilt game: same map, finished (${acts.length} moves)`);
}

// ---- finished game -> My stats record
{
  const st = { scores: [90, 80], over: true, bd: [{ farm: 12 }, { farm: 3 }] };
  const log = [{ kind: 'city', who: [0], pts: 22 }, { kind: 'road', who: [0, 1], pts: 9 }, { kind: 'cloister', who: [0], pts: 9 }, { kind: 'city', who: [0], pts: 40, end: true }];
  const r = CP.result({ st, seats: ['you', 'hard'], log }, 0, {});
  eq([r.mode, r.level, r.won, r.draw], ['computer', 'hard', true, false], 'win vs Hard is rated vs Hard');
  eq([r.extra.city, r.extra.road, r.extra.monks, r.extra.farm, r.extra.score], [22, 9, 1, 12, 90], 'best city, road, monasteries, farms (end-of-game scoring ignored)');
  eq(CP.result({ st, seats: ['you', 'hard'], log }, 0, { helped: true }).mode, 'help', 'with Hint/Undo -> "with help"');
  eq(CP.result({ st, seats: ['you', 'hard'], log }, 0, { helped: true }).level, null, '"with help" has no level (not rated)');
  eq(CP.result({ st, seats: ['easy', 'you', 'medium'], log: [] }, 1, {}).level, 'medium', 'the strongest computer at the table');
  eq(CP.result({ st, seats: ['you', 'you'], log: [] }, 0, {}).mode, 'friends', 'two people at one phone -> pass and play');
  eq(CP.result({ st: { ...st, scores: [80, 80] }, seats: ['you', 'easy'], log: [] }, 0, {}).draw, true, 'tied for top = draw');
  const quit = CP.result({ st: { ...st, over: false, scores: [10, 2] }, seats: ['you', 'hard'], log: [] }, 0, {});
  eq([quit.won, quit.draw], [false, false], 'quit before the end = a loss even when ahead');
  ok(CP.LEVELS.every((l, i, a) => !i || l.rating > a[i - 1].rating), 'level ratings go up Easy < Medium < Hard');
}

done('improve');
