// The improvement pass (2026-10-27), in Safari's engine at phone size:
// a clean start (no "+N.N" on every lit square), the guided first game offered once,
// Undo vs the computer, the Owners view, the end-of-game Replay, My stats (rated / with
// help / quitting = a loss / the guided game never counts), the Daily game, the rules sheet
// (tabs wrap, no sideways scroll), the home-screen manifest.
// Usage: node tests/improve.ui.mjs [--shots <dir>]   (SITE_ROOT=<other checkout> tests old code)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(process.env.SITE_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..'));
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT || join(homedir(), '.claude/tools/node_modules/playwright'));
const E = require('../js/engine.js');
const AI = require('../js/ai.js');
const shotsAt = process.argv.includes('--shots') ? resolve(process.argv[process.argv.indexOf('--shots') + 1]) : null;

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL: ' + m); } };

// Games built in node (same engine): `acts` so Undo/Replay can rebuild them.
function play(players, seed, until, level) {
  const st = E.newGame({ players, seed });
  const rand = E.rng(seed + 5), acts = [], race = [st.scores.slice()], log = [];
  while (!st.over && !until(st)) {
    const p = st.turn, a = AI.choose(st, level || 'medium', rand);
    E.applyMut(st, a);
    acts.push(JSON.parse(JSON.stringify(a)));
    race.push(st.scores.slice());
    for (const e of st.last.ev) log.push({ ...e, by: p });
  }
  return { st, acts, race, log };
}
const state = (G, seats, extra) => JSON.stringify({ tab: 'play', set: { seats, hv: 1, ...(extra && extra.set) }, game: { st: G.st, seats, lost: [], race: G.race, log: G.log, acts: G.acts, gid: 'test', moved: G.acts.length > 0, ...(extra && extra.game) } });
const START = play(2, 31, () => true);                                         // nothing played yet
const MID = play(2, 8, (st) => st.moves >= 24 && st.turn === 0);               // meeples on the map
const LAST = play(2, 12, (st) => st.bag.length === 0 && st.turn === 0 && st.cur >= 0);   // your last tile
const DONE = play(2, 12, () => false);                                         // finished

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  try { const b = await readFile(join(ROOT, p === '/' ? 'index.html' : p)); res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' }); res.end(b); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const URL = `http://127.0.0.1:${server.address().port}/index.html?nosw`;
const browser = await pw.webkit.launch({ headless: true });
const iphone = pw.devices['iPhone 15'];

async function open(saved, viewport) {
  const ctx = await browser.newContext({ ...iphone, viewport: viewport || { width: 393, height: 659 } });
  await ctx.addInitScript((s) => { try { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); if (s) localStorage.setItem('carcassonne:v1', s); sessionStorage.setItem('seeded', '1'); } } catch {} }, saved || null);
  await ctx.route(/gstatic|firebase|googleapis/, (r) => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  await page.goto(URL);
  await page.waitForSelector('#world');
  await page.waitForTimeout(500);
  return { ctx, page, errors };
}
const G = (page, f) => page.evaluate(f);
const shot = (page, name) => (shotsAt ? page.screenshot({ path: join(shotsAt, `improve-${name}.png`) }) : null);
// a human move through the app's own path (pick the square, then Place)
const placeFirst = (page) => page.evaluate(() => {
  const A = self.CarcApp, st = A.state.game.st, L = self.CarcEngine.legalPlacements(st)[0];
  A.pickCell(L.x, L.y);
  document.getElementById('btn-place').click();
});
const stats = (page) => page.evaluate(() => (self.Profile && self.Profile.stats ? self.Profile.stats() : null));
const untilP = (page, f, ms) => page.waitForFunction(f, null, { timeout: ms || 6000 }).then(() => true, () => false);

try {
  // ---- 1. first visit: a clean table and the guided game offered once
  {
    const { ctx, page, errors } = await open(null);
    const nums = await G(page, () => document.querySelectorAll('#world .cand text').length);
    const lit = await G(page, () => document.querySelectorAll('#world .cand:not(.dead)').length);
    ok(lit > 0 && nums === 0, `fresh start: lit squares without "+N.N" numbers (lit ${lit}, numbers ${nums})`);
    const offer = await G(page, () => !!document.querySelector('.coach-offer'));
    ok(offer, 'first visit: "New to Carcassonne?" is offered');
    await shot(page, 'first-visit');
    if (offer) {
      await page.click('.coach-offer .primary, .coach-offer [data-coach="yes"], .coach-offer button:last-child');
      await page.waitForTimeout(600);
      const g = await G(page, () => { const g = self.CarcApp.state.game; return { tut: !!g.tut, seats: g.seats.join(','), bubble: !!document.querySelector('.coach-bubble') }; });
      ok(g.tut && g.seats === 'you,easy' && g.bubble, `"Show me" starts the guided game vs Easy with the coach (${JSON.stringify(g)})`);
      await shot(page, 'guided-1');
      // walk it: Next, tap the square above the start tile, Next, a knight, Place
      await page.click('.coach-bubble [data-coach="next"]');
      await page.evaluate(() => self.CarcApp.pickCell(0, -1));
      await page.waitForTimeout(500);
      const step = await G(page, () => document.querySelector('.coach-bubble .coach-title') && document.querySelector('.coach-bubble .coach-title').textContent);
      ok(step === 'Turn it', `guided: tapping the square moves the coach on (now "${step}")`);
      await page.click('.coach-bubble [data-coach="next"]');
      await page.waitForTimeout(300);
      await page.click('#hand .spot');
      await page.waitForTimeout(300);
      await page.click('#btn-place');
      await page.waitForTimeout(400);
      const sc = await G(page, () => self.CarcApp.state.game.st.scores[0]);
      ok(sc === 4, `guided: your city cap closes the start city for 4 points (got ${sc})`);
      await shot(page, 'guided-2');
      // the guided game never counts, even if you leave it
      await page.evaluate(() => self.CarcApp.newGame());
      const s = await stats(page);
      ok(s && s.games === 0, `guided game is never counted in My stats (games ${s && s.games})`);
    }
    ok(!errors.length, `first visit: no page errors ${errors.join(' | ')}`);
    await ctx.close();
  }
  // a second visit is not offered again
  {
    const { ctx, page } = await open(state(START, ['you', 'hard']));
    ok(!(await G(page, () => !!document.querySelector('.coach-offer'))), 'a returning player is not offered the guided game');
    await ctx.close();
  }

  // ---- 2. Undo vs the computer
  {
    const { ctx, page, errors } = await open(state(START, ['you', 'hard']));
    const before = await G(page, () => ({ hidden: document.getElementById('btn-undo') ? document.getElementById('btn-undo').hidden : true, dis: document.getElementById('btn-undo') && document.getElementById('btn-undo').disabled }));
    ok(before.hidden === false && before.dis === true, `Undo is on the table from the start, off until you move (${JSON.stringify(before)})`);
    for (const [w, h] of [[393, 659], [320, 568], [659, 393]]) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(250);
      const fit = await G(page, () => [...document.querySelectorAll('#play-btns .btn')].map((b) => { const r = b.getBoundingClientRect(); return { t: b.textContent, l: Math.round(r.left), r: Math.round(r.right), sw: b.scrollWidth, cw: b.clientWidth }; }));
      ok(fit.length === 4 && fit.every((b) => b.l >= 0 && b.r <= w && b.sw <= b.cw + 1), `${w}x${h}: Undo, Rotate, Hint, Place all fit on screen, text not cut (${JSON.stringify(fit)})`);
      if (w === 320) await shot(page, 'dock-320');
    }
    await page.setViewportSize({ width: 393, height: 659 });
    await page.waitForTimeout(250);
    const cur0 = await G(page, () => self.CarcApp.state.game.st.cur);
    await placeFirst(page);
    ok(await untilP(page, () => self.CarcApp.state.game.st.moves === 2 && self.CarcApp.isHumanTurn()), 'the computer answers your tile');
    await page.click('#btn-undo');
    await page.waitForTimeout(300);
    const u = await G(page, () => { const g = self.CarcApp.state.game; return { moves: g.st.moves, cur: g.st.cur, helped: g.helped, acts: g.acts.length, dis: document.getElementById('btn-undo').disabled, tiles: Object.keys(g.st.board).length }; });
    ok(u.moves === 0 && u.acts === 0 && u.tiles === 1 && u.cur === cur0, `Undo takes back your tile and the computer's (${JSON.stringify(u)})`);
    ok(u.helped === true && u.dis === true, 'after Undo the game is "with help" and there is nothing left to undo');
    await shot(page, 'undo');
    ok(!errors.length, `undo: no page errors ${errors.join(' | ')}`);
    await ctx.close();
  }

  // ---- 3. the Owners view
  {
    const { ctx, page, errors } = await open(state(MID, ['you', 'hard']));
    const men = await G(page, () => document.querySelectorAll('#world .meeple').length);
    await page.click('#zoom-own');
    await page.waitForTimeout(300);
    const o = await G(page, () => ({ layer: !!document.querySelector('#world .owners'), shapes: document.querySelectorAll('#world .owners g g').length, lit: document.getElementById('zoom-own').classList.contains('lit') }));
    ok(o.layer && o.shapes >= men && o.lit, `Owners tints every claimed feature (${o.shapes} shapes for ${men} meeples, lit ${o.lit})`);
    await shot(page, 'owners');
    await page.click('#zoom-own');
    await page.waitForTimeout(200);
    ok(!(await G(page, () => !!document.querySelector('#world .owners'))), 'a second tap hides it');
    ok(!errors.length, `owners: no page errors ${errors.join(' | ')}`);
    await ctx.close();
  }

  // ---- 4. the last tile: My stats counts a rated win/loss; then Replay
  {
    const { ctx, page, errors } = await open(state(LAST, ['you', 'hard']));
    await placeFirst(page);
    ok(await untilP(page, () => !document.getElementById('sheet-back').hidden, 6000), 'results sheet after the last tile');
    const s = await stats(page);
    const lv = s && s.byLevel && s.byLevel.hard;
    ok(s && s.games === 1 && lv && lv.g === 1, `the game is counted once, rated vs Hard (${JSON.stringify(s && { games: s.games, hard: lv, elo: s.elo })})`);
    ok(await G(page, () => /Counted in My stats/.test(document.getElementById('sheet').textContent)), 'the results say how it counted');
    await shot(page, 'results');
    await page.click('#btn-replay');
    await page.waitForTimeout(300);
    const r0 = await G(page, () => ({ rv: !document.getElementById('review-btns').hidden, status: document.getElementById('status').textContent, tiles: document.querySelectorAll('#world > g:not(.owners)').length }));
    ok(r0.rv && /Replay/.test(r0.status) && r0.tiles === 1, `Replay starts from the start tile (${JSON.stringify(r0)})`);
    await page.click('#rv-next'); await page.click('#rv-next');
    await page.waitForTimeout(300);
    const r1 = await G(page, () => ({ status: document.getElementById('status').textContent, k: self.CarcApp.state.game.k }));
    ok(r1.k === 2 && /tile 2 of/.test(r1.status), `▶ steps one tile at a time (${JSON.stringify(r1)})`);
    await shot(page, 'replay');
    await page.click('#rv-done');
    await page.waitForTimeout(300);
    const r2 = await G(page, () => ({ over: self.CarcApp.state.game.st.over, review: !!self.CarcApp.state.game.review, saved: JSON.parse(localStorage.getItem('carcassonne:v1')).game.st.over }));
    ok(r2.over && !r2.review && r2.saved, `Done goes back to the finished game, which stayed saved (${JSON.stringify(r2)})`);
    ok((await stats(page)).games === 1, 'replaying never counts the game again');
    ok(!errors.length, `last tile: no page errors ${errors.join(' | ')}`);
    await ctx.close();
  }
  // Hint makes it "with help" (not rated)
  {
    const { ctx, page } = await open(state(LAST, ['you', 'hard']));
    await page.click('#btn-hint');
    await page.click('#btn-place');
    await untilP(page, () => !document.getElementById('sheet-back').hidden, 6000);
    const s = await stats(page);
    ok(s && s.games === 1 && s.byMode && s.byMode.help && s.byMode.help.g === 1 && !(s.byLevel.hard && s.byLevel.hard.g), `a game with Hint counts as "with help", not rated (${JSON.stringify(s && s.byMode)})`);
    await ctx.close();
  }
  // quitting after your first tile counts as a loss
  {
    const { ctx, page } = await open(state(START, ['you', 'hard']));
    await placeFirst(page);
    await page.waitForTimeout(200);
    await page.click('#tabs [data-tab="settings"]');
    await page.click('#btn-new'); await page.click('#btn-new');
    await page.waitForTimeout(300);
    const s = await stats(page);
    ok(s && s.games === 1 && s.losses === 1, `New game after your first tile = a loss (${JSON.stringify(s && { games: s.games, losses: s.losses })})`);
    await ctx.close();
  }

  // ---- 5. Settings: Daily game, rules sheet
  {
    const { ctx, page, errors } = await open(state(START, ['you', 'medium']), { width: 393, height: 659 });
    await page.click('#tabs [data-tab="settings"]');
    const btns = await G(page, () => [...document.querySelectorAll('.set-btns button')].map((b) => { const r = b.getBoundingClientRect(); return { t: b.textContent.trim(), vis: r.bottom <= innerHeight && r.top >= 0 }; }));
    ok(btns.length === 4 && btns.every((b) => b.vis), `Settings: My stats, Daily, Rules, Guided game in view without scrolling (${JSON.stringify(btns)})`);
    await shot(page, 'settings');
    await page.click('#btn-rules');
    await page.waitForTimeout(400);
    const rl = await G(page, () => { const n = document.querySelector('.coach-rules .coach-rules-nav'); return n ? { sw: n.scrollWidth, cw: n.clientWidth, tabs: n.children.length } : null; });
    ok(rl && rl.tabs >= 6 && rl.sw <= rl.cw + 1, `rules sheet: every tab on screen, no sideways scroll (${JSON.stringify(rl)})`);
    await shot(page, 'rules');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.click('#btn-daily');
    await page.waitForTimeout(400);
    const d = await G(page, () => { const g = self.CarcApp.state.game; return { daily: g.daily, seats: g.seats.join(','), undo: document.getElementById('btn-undo').hidden, tab: self.CarcApp.state.tab }; });
    ok(/^\d{4}-\d\d-\d\d$/.test(d.daily || '') && d.seats === 'you,hard' && d.undo && d.tab === 'play', `Daily game: today vs Hard, no Undo (${JSON.stringify(d)})`);
    const seed1 = await G(page, () => self.CarcApp.state.game.st.opts.seed);
    ok(seed1 === await G(page, () => (self.Profile.daily.seed(self.Profile.daily.date(), 'carcassonne') >>> 0) || 1), 'the Daily bag is today\'s shared seed');
    ok(!errors.length, `settings: no page errors ${errors.join(' | ')}`);
    await ctx.close();
  }

  // ---- 6. home-screen install
  {
    const { ctx, page } = await open(state(START, ['you', 'hard']));
    const m = await G(page, async () => { const l = document.querySelector('link[rel="manifest"]'); if (!l) return null; const j = await (await fetch(l.href)).json(); return { name: j.name, icons: j.icons.length, pwa: !!self.PWA }; });
    ok(m && m.name === 'Carcassonne' && m.icons >= 3 && m.pwa, `manifest + pwa.js loaded (${JSON.stringify(m)})`);
    await ctx.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(`improve: ${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
