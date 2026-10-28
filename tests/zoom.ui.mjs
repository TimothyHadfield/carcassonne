// Board zoom test in Safari's engine (Playwright WebKit): auto fit on load at
// phone, rotated phone and laptop sizes; pinch / + / wheel light the Fit button;
// Fit glides back to the same box; a one-finger drag does nothing in auto mode;
// a long game (60+ tiles) still fits. Needs Playwright (Tim's ~/.claude/tools).
// Usage: node tests/zoom.ui.mjs [--shots <dir>]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(process.env.SITE_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..'));   // SITE_ROOT: test another checkout
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT || join(homedir(), '.claude/tools/node_modules/playwright'));
const E = require('../js/engine.js');
const AI = require('../js/ai.js');
const shotsAt = process.argv.includes('--shots') ? resolve(process.argv[process.argv.indexOf('--shots') + 1]) : null;

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL: ' + m); } };

// ---- a long game: 64 tiles on the board, your turn
function longGame() {
  const st = E.newGame({ players: 2, seed: 4242 });
  const rand = E.rng(99);
  while (!st.over && (Object.keys(st.board).length < 64 || st.turn !== 0)) E.applyMut(st, AI.choose(st, 'medium', rand));
  return st;
}
const saved = (st) => JSON.stringify({ tab: 'play', set: { seats: ['you', 'hard'], hints: true, hv: 1 }, game: { st, seats: ['you', 'hard'], lost: [], race: [st.scores.slice()], log: [] } });

// ---- static server for this folder
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

async function open(viewport, mobile, state) {
  const ctx = await browser.newContext(mobile ? { ...iphone, viewport } : { viewport });
  // the first-visit offer (coach 1.2.0 may sit at the top, over the zoom buttons) is answered already: this test is about zoom
  await ctx.addInitScript((s) => { try { localStorage.clear(); if (s) localStorage.setItem('carcassonne:v1', s); localStorage.setItem('coach-offer:carc-first', 'true'); } catch {} }, state || null);
  // Firebase is not needed here; keep the test offline.
  await ctx.route(/gstatic|firebase|googleapis/, (r) => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  await page.goto(URL);
  await page.waitForSelector('#world');
  await page.waitForTimeout(700);
  return { ctx, page, errors };
}
const box = (page) => page.evaluate(() => {
  const b = document.getElementById('board').getBoundingClientRect(), w = document.getElementById('world').getBoundingClientRect();
  const tile = document.querySelector('#world > g').getBoundingClientRect();
  return { b: [b.left, b.top, b.right, b.bottom], w: [w.left, w.top, w.right, w.bottom], tile: tile.width,
    lit: document.getElementById('zoom-fit').classList.contains('lit'), cands: document.querySelectorAll('#world .cand').length,
    set: document.getElementById('world').style.transform, now: getComputedStyle(document.getElementById('world')).transform };
});
const inside = (r) => r.w[0] >= r.b[0] - 1 && r.w[1] >= r.b[1] - 1 && r.w[2] <= r.b[2] + 1 && r.w[3] <= r.b[3] + 1;
const same = (a, b) => a.w.every((v, i) => Math.abs(v - b.w[i]) <= 2);
// Synthetic pointer gestures on the board (touch-style ids).
const gesture = (page, steps) => page.evaluate((steps) => {
  const svg = document.getElementById('board'), r = svg.getBoundingClientRect();
  for (const [type, id, x, y] of steps) svg.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: id === 1, clientX: r.left + x, clientY: r.top + y, bubbles: true }));
}, steps);
// Wait for the glide to finish (the board is heavy late in a game, so frames can be slow).
const settle = async (page) => {
  await page.waitForTimeout(400);
  await page.waitForFunction(() => {
    const w = document.getElementById('world');
    if (!w || !w.style.transform) return true;
    const a = new DOMMatrix(getComputedStyle(w).transform), b = new DOMMatrix(w.style.transform);
    return Math.abs(a.a - b.a) < 1e-3 && Math.abs(a.e - b.e) < 0.5 && Math.abs(a.f - b.f) < 0.5;
  }, null, { timeout: 4000 }).catch(() => {});
};

async function suite(name, viewport, mobile, state) {
  const { ctx, page, errors } = await open(viewport, mobile, state);
  const W = viewport.width;
  const a = await box(page);
  ok(inside(a), `${name}: board fits the board area on load ${JSON.stringify(a)}`);
  ok(a.cands > 0, `${name}: empty spots are drawn`);
  ok(!a.lit, `${name}: Fit is dimmed in auto mode`);
  if (shotsAt) await page.screenshot({ path: join(shotsAt, `${name}-auto.png`) });

  // one-finger drag in auto: nothing moves
  const cx = (a.b[2] - a.b[0]) / 2, cy = (a.b[3] - a.b[1]) / 2;
  await gesture(page, [['pointerdown', 1, cx, cy], ['pointermove', 1, cx + 30, cy + 20], ['pointermove', 1, cx + 90, cy + 60], ['pointerup', 1, cx + 90, cy + 60]]);
  await settle(page);
  ok(same(await box(page), a), `${name}: drag in auto mode does not move the board`);

  // pinch out
  await gesture(page, [['pointerdown', 1, cx - 30, cy], ['pointerdown', 2, cx + 30, cy], ['pointermove', 1, cx - 80, cy], ['pointermove', 2, cx + 80, cy], ['pointerup', 1, cx - 80, cy], ['pointerup', 2, cx + 80, cy]]);
  await settle(page);
  const p = await box(page);
  ok(p.lit, `${name}: Fit lights up after a pinch`);
  ok(p.tile > a.tile * 1.5, `${name}: pinch zooms in (${a.tile.toFixed(1)} -> ${p.tile.toFixed(1)} px)`);
  if (shotsAt) await page.screenshot({ path: join(shotsAt, `${name}-zoomed.png`) });

  // zoomed in: drag pans, but the board can't leave the screen
  await gesture(page, [['pointerdown', 1, cx, cy], ['pointermove', 1, cx + 20, cy], ['pointermove', 1, cx + 3000, cy + 3000], ['pointerup', 1, cx + 3000, cy + 3000]]);
  await settle(page);
  const d = await box(page);
  // (the clamp keeps the fit box on screen; the drawn part can be one empty ring cell inside it)
  const overlap = (i) => Math.min(d.w[i + 2], d.b[i + 2]) - Math.max(d.w[i], d.b[i]);
  ok(overlap(0) > 15 && overlap(1) > 15, `${name}: panned board stays on screen ${JSON.stringify(d)}`);

  await page.click('#zoom-fit');
  await settle(page);
  const f = await box(page);
  ok(same(f, a) && !f.lit, `${name}: Fit returns to the auto box ${JSON.stringify([a, f])}`);

  // + then − back down to the fit = auto again
  await page.click('#zoom-in'); await settle(page);
  ok((await box(page)).lit, `${name}: + lights Fit`);
  await page.click('#zoom-out'); await page.click('#zoom-out'); await settle(page);
  const o = await box(page);
  ok(same(o, a) && !o.lit, `${name}: zooming out stops at the fit and is auto again`);

  // wheel zooms in on laptop
  if (!mobile) {
    await page.mouse.move(a.b[0] + cx, a.b[1] + cy);
    await page.mouse.wheel(0, -300); await settle(page);
    ok((await box(page)).lit, `${name}: wheel zooms in`);
    await page.click('#zoom-fit'); await settle(page);
  }
  ok(errors.length === 0, `${name}: no page errors ${errors.join(' | ')}`);
  await ctx.close();
  return a;
}

try {
  await suite('phone', { width: 393, height: 659 }, true);
  await suite('phone-rotated', { width: 659, height: 393 }, true);
  await suite('laptop', { width: 1280, height: 800 }, false);
  const st = longGame();
  const n = Object.keys(st.board).length;
  const L = await suite('long-phone', { width: 393, height: 659 }, true, saved(st));
  console.log(`  long game: ${n} tiles, a tile is ${L.tile.toFixed(1)} px wide in auto at 393 px`);
  await suite('long-laptop', { width: 1280, height: 800 }, false, saved(st));

  // the board grows: auto keeps every tile and empty spot in view
  const { ctx, page } = await open({ width: 393, height: 659 }, true, saved(st));
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => { const A = self.CarcApp, s = A.state.game.st; A.submit(self.CarcAI.choose(s, 'hard')); });
    await page.waitForTimeout(1400);   // the computer answers after 750 ms, then the glide
    const g = await box(page);
    ok(inside(g) && !g.lit, `growing board still fits after move ${i + 1}`);
  }
  await ctx.close();
} finally {
  await browser.close();
  server.close();
}
console.log(`zoom.ui: ${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
