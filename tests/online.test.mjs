// The Carcassonne adapter for the shared online module (js/game.js + js/online.js).
// Run: node tests/online.test.mjs
import { createRequire } from 'node:module';
import { createLocal } from '../js/online.js';
const require = createRequire(import.meta.url);
const { ok, eq, done } = require('./helpers.js');
const game = require('../js/game.js');
const E = require('../js/engine.js');

function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const rt = (s) => JSON.parse(JSON.stringify(s));

// 1. Bot-only games through the adapter: never throws, toAct never empty
//    before the end, state survives JSON, same rules as the local game.
{
  let games = 0, throws = 0, emptyToAct = 0, jsonBad = 0, tiles = 0;
  for (let g = 0; g < 12; g++) {
    const rng = mulberry(100 + g);
    const n = 2 + (g % 4);
    let s = game.setup(n, { levels: Array(n).fill(g % 2 ? 'easy' : 'medium') }, rng, []);
    while (!game.isOver(s)) {
      const who = game.toAct(s);
      if (!who.length) { emptyToAct++; break; }
      const seat = who[0];
      const ctx = { pub: game.publicView(s), mine: game.privateView(s, seat), state: s };
      try { s = game.apply(rt(s), seat, game.bot(ctx, seat, rng)); } catch (e) { throws++; break; }
      if (JSON.stringify(rt(s)) !== JSON.stringify(s)) jsonBad++;
    }
    tiles += Object.keys(s.board).length + s.discards.length;
    games++;
  }
  eq(throws, 0, 'bot moves are always legal');
  eq(emptyToAct, 0, 'someone always has to move until the end');
  eq(jsonBad, 0, 'state round-trips through JSON');
  eq(tiles, 72 * games, 'every game uses all 72 tiles');
}

// 2. Rules options and per-seat computer levels reach the engine.
{
  const s = game.setup(3, { farmers: false, farm: '1st', smallCity: 2, levels: ['hard', 'easy', 'medium'] }, mulberry(1), [{ name: 'Tim' }, { name: 'Sam' }, { name: 'C' }]);
  eq([s.opts.farmers, s.opts.farm, s.opts.smallCity], [false, '1st', 2], 'rule options passed through');
  eq(s.opts.levels, ['hard', 'easy', 'medium'], 'computer levels per seat');
  eq(s.names, ['Tim', 'Sam', 'C'], 'seat names kept');
  eq(s.n, 3, 'three players');
}

// 3. Secrecy: the public view never gives away the order of the bag.
{
  const s = game.setup(2, {}, mulberry(7), []);
  const pub = game.publicView(s);
  eq(pub.bag.length, s.bag.length, 'public bag has the right size');
  ok(pub.bag.every((t, i) => i === 0 || pub.bag[i - 1] <= t), 'public bag is sorted, not in draw order');
  ok(JSON.stringify(pub.bag) !== JSON.stringify(s.bag), 'real bag order differs from what is shown');
  eq(game.privateView(s, 0), {}, 'nothing private');
  // the next tile drawn is not predictable from the view: the last entry of
  // the sorted list is not the next tile in more than a chance share of games
  let hits = 0;
  for (let g = 0; g < 200; g++) {
    const st = game.setup(2, {}, mulberry(1000 + g), []);
    const v = game.publicView(st);
    if (v.bag[v.bag.length - 1] === st.bag[st.bag.length - 1]) hits++;
  }
  ok(hits < 40, 'the view does not reveal the next tile (' + hits + '/200)');
}

// 4. Illegal moves are refused.
{
  const s = game.setup(2, {}, mulberry(3), []);
  const pl = E.legalPlacements(s)[0];
  let threw = 0;
  try { game.apply(rt(s), 1, { type: 'place', x: pl.x, y: pl.y, r: pl.r, fi: -1 }); } catch (e) { threw++; }
  try { game.apply(rt(s), 0, { type: 'place', x: 50, y: 50, r: 0, fi: -1 }); } catch (e) { threw++; }
  try { game.apply(rt(s), 0, { type: 'cheat' }); } catch (e) { threw++; }
  eq(threw, 3, 'wrong seat, floating tile and unknown action all throw');
}

// 5. createLocal (same code path as an online room's host): 1 human + 2 computers.
{
  const room = createLocal({ game, seats: ['human', 'computer', 'computer'], options: { levels: ['hard', 'medium', 'easy'] }, names: ['You'], botDelayMs: 0, rng: mulberry(11) });
  let last = null, errors = 0;
  room.on('change', (snap) => { last = snap; });
  room.on('error', () => errors++);
  room.start();
  for (let i = 0; i < 4000 && last.status !== 'finished'; i++) {
    if (last.myTurn) {
      const st = last.pub;
      const pl = E.legalPlacements(st)[0];
      room.act({ type: 'place', x: pl.x, y: pl.y, r: pl.r, fi: -1 });
    }
    await wait(1);
  }
  eq(last.status, 'finished', 'local room plays to the end');
  eq(errors, 0, 'no errors in the room');
  ok(last.pub.final !== null, 'end-of-game scoring ran');
  eq(room.act({ type: 'place', x: 0, y: 1, r: 0, fi: -1 }, 0).ok, false, 'moves after the end are refused');
}

done('online');
