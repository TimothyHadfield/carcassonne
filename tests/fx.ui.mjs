// Sound, celebration and animation test in Safari's engine (Playwright WebKit).
// A fake AudioContext stands in for the speaker (WebKit on Windows has none), so
// FX really "plays" and FX.stats.plays counts what would be heard.
// Checks: (a) a scripted short game fires the right sound names, (b) Sound off =
// nothing heard, Animations off = nothing moves, (c) game over celebrates with
// the right kind (win / lose), plus no sound before the first tap, Settings rows.
// Usage: node tests/fx.ui.mjs [--shots <dir>]   (SITE_ROOT=<other checkout> tests old code)
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

// ---- real game states, built with the engine + the computer
// Your turn (seat 0), and the best move finishes a city you own.
function cityState() {
  for (let seed = 1; seed < 400; seed++) {
    const st = E.newGame({ players: 2, seed });
    const rand = E.rng(seed * 7);
    while (!st.over && st.moves < 60) {
      if (st.turn === 0 && st.moves >= 6) {
        const a = AI.choose(st, 'hard');
        const after = E.apply(st, a);
        if (after.last.ev.some((e) => e.kind === 'city' && e.who.includes(0))) return { st, a };
      }
      E.applyMut(st, AI.choose(st, 'medium', rand));
    }
  }
  throw new Error('no city state found');
}
// Your turn with the last tile in the bag.
function lastTileState() {
  for (let seed = 777; seed < 900; seed++) {
    const st = E.newGame({ players: 2, seed });
    const rand = E.rng(seed);
    while (!st.over && !(st.bag.length === 0 && st.turn === 0)) E.applyMut(st, AI.choose(st, 'medium', rand));
    if (!st.over) return st;
  }
  throw new Error('no last-tile state found');
}
const saved = (st, extra) => JSON.stringify({ tab: 'play', set: { seats: ['you', 'hard'], hints: true, hv: 1 }, game: Object.assign({ st, seats: ['you', 'hard'], lost: [], race: [st.scores.slice()], log: [] }, extra || {}) });

// ---- static server for the site
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  try { const b = await readFile(join(ROOT, p === '/' ? 'index.html' : p)); res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' }); res.end(b); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const URL = `http://127.0.0.1:${server.address().port}/index.html`;
const browser = await pw.webkit.launch({ headless: true });
const iphone = pw.devices['iPhone 15'];

// Runs before any page script: a fake speaker, and spies on FX as soon as fx.js sets it.
function setup([state, fxSettings]) {
  try { localStorage.clear(); if (state) localStorage.setItem('carcassonne:v1', state); if (fxSettings) localStorage.setItem('fx:carcassonne', fxSettings); } catch (e) { /* blocked */ }
  class Param { constructor() { this.value = 0; } setValueAtTime() {} linearRampToValueAtTime() {} exponentialRampToValueAtTime() {} setTargetAtTime() {} }
  class Node { constructor() { this.gain = new Param(); this.frequency = new Param(); this.Q = new Param(); this.pan = new Param(); } connect() {} start() {} stop() {} }
  class Ctx {
    constructor() { this.state = 'running'; this.sampleRate = 44100; this.destination = {}; self.__ctx = (self.__ctx || 0) + 1; }
    get currentTime() { return performance.now() / 1000; }
    resume() { return Promise.resolve(); }
    createGain() { return new Node(); } createOscillator() { return new Node(); } createBiquadFilter() { return new Node(); }
    createBufferSource() { return new Node(); } createDynamicsCompressor() { return new Node(); } createStereoPanner() { return new Node(); }
    createBuffer(c, n) { return { getChannelData: () => new Float32Array(n) }; }
  }
  self.AudioContext = Ctx; self.webkitAudioContext = Ctx;
  self.__log = []; self.__cel = []; self.__anim = [];
  let fx = null;
  Object.defineProperty(self, 'FX', {
    configurable: true,
    get() { return fx; },
    set(v) {
      fx = v;
      const play = v.play, cel = v.celebrate;
      v.play = function (n, o) { const r = play.call(v, n, o); self.__log.push({ n, r, t: Math.round(performance.now()) }); return r; };
      v.celebrate = function (o) { self.__cel.push((o && o.kind) || 'win'); return cel.call(v, o); };
      for (const k of ['pop', 'shake', 'pulse', 'flash', 'flyTo', 'floatText', 'countUp']) { const f = v[k]; v[k] = function () { self.__anim.push(k); return f.apply(v, arguments); }; }
    },
  });
}

async function open({ state, fx, viewport, desktop } = {}) {
  const ctx = await browser.newContext(desktop ? { viewport: { width: 1280, height: 800 } } : { ...iphone, viewport: viewport || { width: 393, height: 659 } });
  await ctx.addInitScript(setup, [state || null, fx ? JSON.stringify(fx) : null]);
  await ctx.route(/gstatic|firebase|googleapis/, (r) => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL);
  await page.waitForSelector('#world');
  await page.waitForTimeout(800);
  return { ctx, page, errors };
}
const plays = (page) => page.evaluate(() => (self.FX && self.FX.stats ? self.FX.stats.plays : -1));
const names = (page) => page.evaluate(() => self.__log.map((e) => e.n));
const clearLog = (page) => page.evaluate(() => { self.__log.length = 0; self.__anim.length = 0; });
// A tap that isn't on the board or a button: this is "the user's first tap".
const firstTap = (page) => page.tap('#players');
const tapBoard = (page, sel) => page.evaluate((sel) => {
  const svg = document.getElementById('board'), r = document.querySelector(sel).getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  for (const type of ['pointerdown', 'pointerup']) svg.dispatchEvent(new PointerEvent(type, { pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true }));
}, sel);

try {
  // ---------------------------------------------------------------- (a) a scripted short game
  const C = cityState();
  {
    const { ctx, page, errors } = await open({ state: saved(C.st) });
    ok(await page.evaluate(() => !!(self.FX && self.FX.version)), 'fx.js is loaded');
    ok((await plays(page)) === 0 && (await page.evaluate(() => !self.__ctx)), 'no sound (and no audio context) before the first tap');
    await firstTap(page);
    await clearLog(page);
    await tapBoard(page, '#world > g');                     // a tile that's already down: illegal
    // (when the map is drawn under 40 px a tile, that first tap zooms in on the spot instead,
    // by design; the test was flaky on this. Tap the same tile again, now zoomed in, then Fit
    // so the rest runs on the whole map as before.)
    let zoomed = false;
    if (!(await names(page)).includes('error')) { zoomed = true; await page.waitForTimeout(400); await tapBoard(page, '#world > g'); }
    ok((await names(page)).includes('error'), `tap on a taken square: error sound (${await names(page)})`);
    if (zoomed) { await page.click('#zoom-fit'); await page.waitForTimeout(600); }
    await clearLog(page);
    await page.click('#btn-rotate');
    ok((await names(page)).join() === 'tileTurn', `rotate: tileTurn only, no extra tap (${await names(page)})`);
    await clearLog(page);
    await page.evaluate((a) => self.CarcApp.pickCell(a.x, a.y), C.a);
    ok((await names(page)).includes('cardSlide'), 'picking a square: the tile slides');
    await clearLog(page);
    const before = await plays(page);
    await page.evaluate((a) => self.CarcApp.submit(a), C.a);
    await page.waitForTimeout(3200);                        // your move, the computer's reply, your-turn chime
    const n = await names(page);
    // (a meeple of yours was on the city, so one comes home: "pop")
    const want = ['place', 'coins', 'pop', 'tileDraw', 'turn'].concat(C.a.fi >= 0 ? ['meeple'] : []);
    for (const w of want) ok(n.includes(w), `move that finishes a city plays "${w}" (${n.join(' ')})`);
    ok(n.filter((x) => x === 'place').length === 2, `two tiles placed (you + computer): ${n.join(' ')}`);
    ok(n.indexOf('place') < n.indexOf('coins') && n.indexOf('coins') < n.indexOf('tileDraw'), 'order: place, city coins, next tile');
    ok(n.lastIndexOf('turn') > n.lastIndexOf('place'), 'your-turn chime after the computer placed');
    ok(n.filter((x) => x === 'turn').length === 1, 'chime once, only for your turn');
    ok((await plays(page)) - before >= want.length, 'the sounds were really played (fake speaker)');
    const an = await page.evaluate(() => self.__anim.slice());
    ok(an.includes('countUp') && an.includes('pop') && an.includes('pulse'), `score count-up, chip pop, your-turn pulse (${an.join(' ')})`);
    ok(an.includes('flyTo'), 'meeple flies home');
    const log = await page.evaluate(() => self.__log.filter((e) => e.n === 'place').map((e) => e.t));
    ok(log.length === 2 && log[1] - log[0] >= 700, 'the computer moves after a pause, not on top of your sound');
    ok(errors.length === 0, 'no console errors: ' + errors.join(' | '));
    if (shotsAt) await page.screenshot({ path: join(shotsAt, 'mid-game-393.png') });
    await ctx.close();
  }

  // ---------------------------------------------------------------- (b) Sound off / Animations off
  {
    const { ctx, page, errors } = await open({ state: saved(C.st), fx: { sound: false } });
    await firstTap(page); await clearLog(page);
    const before = await plays(page);
    await page.evaluate((a) => self.CarcApp.submit(a), C.a);
    await page.waitForTimeout(2600);
    ok((await names(page)).length > 0 && (await plays(page)) === before, `Sound off: game asks, nothing is heard (${await plays(page) - before} played)`);
    ok(errors.length === 0, 'Sound off: no errors ' + errors.join(' | '));
    await ctx.close();
  }
  {
    const { ctx, page, errors } = await open({ state: saved(C.st), fx: { animations: false } });
    await firstTap(page); await clearLog(page);
    await page.evaluate((a) => self.CarcApp.submit(a), C.a);
    let moving = 0, floaters = 0, extra = 0;
    for (let i = 0; i < 30; i++) {
      const s = await page.evaluate(() => ({ a: document.getAnimations().length, f: document.querySelectorAll('.floater').length, x: document.body.children.length }));
      moving = Math.max(moving, s.a); floaters = Math.max(floaters, s.f); extra = Math.max(extra, s.x);
      await page.waitForTimeout(80);
    }
    ok(moving === 0, `Animations off: nothing animates (max ${moving} running)`);
    ok(floaters === 0, 'Animations off: no +N floaters');
    ok((await plays(page)) > 0, 'Animations off: sounds still play');
    ok(errors.length === 0, 'Animations off: no errors ' + errors.join(' | '));
    await ctx.close();
  }
  {
    // sanity for the check above: with animations on, things do move
    const { ctx, page } = await open({ state: saved(C.st) });
    await firstTap(page);
    await page.evaluate((a) => self.CarcApp.submit(a), C.a);
    let moving = 0;
    for (let i = 0; i < 10; i++) { moving = Math.max(moving, await page.evaluate(() => document.getAnimations().length)); await page.waitForTimeout(80); }
    ok(moving > 0, `Animations on: the move animates (${moving})`);
    await ctx.close();
  }

  // ---------------------------------------------------------------- (c) game over: win / lose
  const L = lastTileState();
  for (const [kind, seat] of [['win', 0], ['lose', 1]]) {
    const st = JSON.parse(JSON.stringify(L));
    st.scores[seat] += 300;                                 // decide the winner
    const { ctx, page, errors } = await open({ state: saved(st) });
    await firstTap(page); await clearLog(page);
    await page.evaluate(() => { const s = self.CarcApp.state.game.st; self.CarcApp.submit(self.CarcAI.choose(s, 'hard')); });
    // results at ~0.7 s, farms and totals count up for 0.9 s, then the celebration
    await page.waitForFunction(() => self.__cel.length > 0, null, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(400);
    if (shotsAt) await page.screenshot({ path: join(shotsAt, `${kind}-393.png`) });
    await page.waitForTimeout(600);
    const cel = await page.evaluate(() => self.__cel.slice());
    ok(cel.length === 1 && cel[0] === kind, `game over (${kind}): celebrate("${kind}") once, got ${JSON.stringify(cel)}`);
    ok(await page.evaluate(() => !document.getElementById('sheet-back').hidden), `${kind}: results sheet shown`);
    ok((await names(page)).includes('drumroll'), `${kind}: drumroll while the end scoring counts up`);
    // Results again: no second celebration
    await page.evaluate(() => { document.querySelector('[data-close]').click(); document.getElementById('btn-results').click(); });
    await page.waitForTimeout(400);
    ok((await page.evaluate(() => self.__cel.length)) === 1, `${kind}: reopening results does not celebrate again`);
    ok(errors.length === 0, `${kind}: no console errors ` + errors.join(' | '));
    await ctx.close();
  }
  {
    // Celebrations off: no celebration sound at game end
    const st = JSON.parse(JSON.stringify(L)); st.scores[0] += 300;
    const { ctx, page } = await open({ state: saved(st), fx: { celebrations: false } });
    await firstTap(page); await clearLog(page);
    await page.evaluate(() => { const s = self.CarcApp.state.game.st; self.CarcApp.submit(self.CarcAI.choose(s, 'hard')); });
    let canvas = false;
    for (let i = 0; i < 30; i++) { canvas = canvas || await page.evaluate(() => !!document.querySelector('canvas')); await page.waitForTimeout(100); }
    ok(!canvas, 'Celebrations off: no confetti');
    await ctx.close();
  }

  // ---------------------------------------------------------------- Settings
  for (const desktop of [false, true]) {
    const { ctx, page, errors } = await open({ desktop });
    await page.click('[data-tab="settings"]');
    await page.waitForSelector('#fx-box .fx-set');
    const rows = await page.evaluate(() => [...document.querySelectorAll('#fx-box [data-row]')].map((r) => r.dataset.row));
    ok(rows.join() === 'sound,volume,moves,alerts,ui,celebrations,animations,animSpeed', 'Settings has every Sound & effects row: ' + rows);
    // the switch looks like the others: off -> on toggles the green knob
    const look = await page.evaluate(() => {
      const sw = document.querySelector('#fx-box [data-row="animations"] .switch'), ref = document.querySelector('.switch[data-sw="farmers"]');   // on by default (hints are off by default since 2026-10-27)
      const a = sw.getBoundingClientRect(), b = ref.getBoundingClientRect();
      return { w: a.width, h: a.height, rw: b.width, rh: b.height, bg: getComputedStyle(sw).backgroundColor, rbg: getComputedStyle(ref).backgroundColor };
    });
    ok(look.w === look.rw && look.h === look.rh && look.bg === look.rbg, 'Sound switches match the game switches ' + JSON.stringify(look));
    await page.click('#fx-box [data-row="animations"] .switch');
    ok(await page.evaluate(() => self.FX.settings.animations === false && document.documentElement.classList.contains('fx-still')), 'Animations switch turns animations off');
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok(over <= 0, 'no horizontal overflow in Settings');
    if (shotsAt) {
      await page.click('#fx-box [data-row="animations"] .switch');
      await page.evaluate(() => document.getElementById('fx-box').scrollIntoView({ block: 'center' }));
      await page.screenshot({ path: join(shotsAt, `settings-${desktop ? 'laptop' : '393'}.png`) });
    }
    ok(errors.length === 0, 'Settings: no console errors ' + errors.join(' | '));
    await ctx.close();
  }
  {
    // storage blocked: still runs
    const ctx = await browser.newContext({ ...iphone, viewport: { width: 393, height: 659 } });
    await ctx.addInitScript(() => { Object.defineProperty(self, 'localStorage', { get() { throw new Error('blocked'); } }); });
    await ctx.route(/gstatic|firebase|googleapis/, (r) => r.abort());
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message)));
    await page.goto(URL);
    await page.waitForSelector('#world');
    await page.click('[data-tab="settings"]');
    ok(await page.evaluate(() => !!document.querySelector('#fx-box .fx-set')), 'storage blocked: Settings still has the sound rows');
    ok(errors.length === 0, 'storage blocked: no errors ' + errors.join(' | '));
    await ctx.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(`fx.ui: ${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
