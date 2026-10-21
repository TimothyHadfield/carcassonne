// Can a player see what's happening? A late, crowded map (6 players, Inns &
// Cathedrals, ~80 tiles) at phone, small phone, phone on its side and laptop:
// meeples big enough to see, zoom tokens never covering a tile or a spot, the
// map getting the room, and a tap in a crowded map zooming in to that spot
// (then back to the whole map after Place). Safari's engine by default.
// Usage: node tests/vis.ui.mjs [--shots <dir>]   (ENGINE=chromium for Chrome)
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
const ENGINE = process.env.ENGINE || 'webkit';
const shotsAt = process.argv.includes('--shots') ? resolve(process.argv[process.argv.indexOf('--shots') + 1]) : null;

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL: ' + m); } };

function play(players, opts, until) {
  const st = E.newGame({ players, seed: 4242, ...opts });
  const rand = E.rng(99), race = [st.scores.slice()];
  while (!st.over && !until(st)) { E.applyMut(st, AI.choose(st, 'medium', rand)); race.push(st.scores.slice()); }
  return { st, race };
}
const n = (st) => Object.keys(st.board).length;
const saved = ({ st, race }, seats, ic) => JSON.stringify({ tab: 'play', set: { seats, hints: true, ic }, game: { st, seats, lost: [], race, log: [] } });
const S6 = ['you', 'hard', 'hard', 'hard', 'hard', 'hard'], S4 = ['you', 'hard', 'hard', 'hard'];
const LATE = play(6, { ic: true }, (st) => n(st) >= 78 && st.turn === 0);
const MID = play(4, {}, (st) => n(st) >= 30 && st.turn === 0);
const late = saved(LATE, S6, true), mid = saved(MID, S4, false);

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  try { const b = await readFile(join(ROOT, p === '/' ? 'index.html' : p)); res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' }); res.end(b); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const URL = `http://127.0.0.1:${server.address().port}/index.html`;
const browser = await pw[ENGINE].launch({ headless: true });
const iphone = pw.devices['iPhone 15'];

async function open(viewport, mobile, state) {
  const base = mobile ? { ...iphone, viewport } : { viewport };
  if (ENGINE !== 'webkit') delete base.defaultBrowserType;
  if (ENGINE === 'firefox') delete base.isMobile;
  const ctx = await browser.newContext(base);
  await ctx.addInitScript((s) => { try { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('carcassonne:v1', s); sessionStorage.setItem('seeded', '1'); } } catch {} }, state);
  await ctx.route(/gstatic|firebase|googleapis/, (r) => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  await page.goto(URL);
  await page.waitForSelector('#world');
  await settle(page);
  return { ctx, page, errors };
}
const settle = async (page) => {
  await page.waitForTimeout(450);
  await page.waitForFunction(() => {
    const w = document.getElementById('world');
    if (!w || !w.style.transform) return true;
    const a = new DOMMatrix(getComputedStyle(w).transform), b = new DOMMatrix(w.style.transform);
    return Math.abs(a.a - b.a) < 1e-3 && Math.abs(a.e - b.e) < 0.5 && Math.abs(a.f - b.f) < 0.5;
  }, null, { timeout: 5000 }).catch(() => {});
};
const look = (page) => page.evaluate(() => {
  const R = (e) => e.getBoundingClientRect();
  const b = R(document.getElementById('board'));
  const parts = [...document.querySelectorAll('#world > g:not(.ghost), #world > g.cand')].map(R).filter((r) => r.width > 0);
  const tools = [...document.querySelectorAll('.board-tools button')].map(R);
  const hit = (a, c) => Math.max(0, Math.min(a.right, c.right) - Math.max(a.left, c.left)) * Math.max(0, Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top));
  let covered = 0;
  for (const t of tools) for (const p of parts) if (hit(t, p) > 2) covered++;
  const meeples = [...document.querySelectorAll('#world .meeple use')].map((m) => R(m).height);
  return {
    tile: R(document.querySelector('#world > g')).width,
    board: [b.width, b.height], share: (b.width * b.height) / (innerWidth * innerHeight),
    covered, meeple: meeples.length ? Math.min(...meeples) : 0, meeples: meeples.length,
    lit: document.getElementById('zoom-fit').classList.contains('lit'),
    ghost: !!document.querySelector('#world .ghost'),
    ring: (() => { const g = document.querySelector('#world .ghost-ring'); if (!g) return null; const r = R(g); return r.left >= b.left - 1 && r.right <= b.right + 1 && r.top >= b.top - 1 && r.bottom <= b.bottom + 1; })(),
    place: (() => { const r = R(document.getElementById('btn-place')); return r.top >= 0 && r.bottom <= innerHeight + 0.5 && r.left >= 0 && r.right <= innerWidth + 0.5; })(),
  };
});
// A real finger tap (touch pointer events) at a screen point.
const tapXY = (page, x, y) => page.evaluate(([x, y]) => {
  const svg = document.getElementById('board');
  for (const type of ['pointerdown', 'pointerup']) svg.dispatchEvent(new PointerEvent(type, { pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true }));
}, [x, y]);
const centreOf = (page, sel) => page.evaluate((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel);
const shot = (page, name) => shotsAt ? page.screenshot({ path: join(shotsAt, `${ENGINE}-${name}.png`) }) : null;

try {
  console.log(`  late map: ${n(LATE.st)} tiles, 6 players; mid map: ${n(MID.st)} tiles, 4 players (${ENGINE})`);
  // ---- the crowded late map on a phone
  for (const [name, vp, minMeeple] of [['393', { width: 393, height: 659 }, 11.5], ['320', { width: 320, height: 568 }, 9.5]]) {
    const { ctx, page, errors } = await open(vp, true, late);
    const a = await look(page);
    ok(a.meeples > 10 && a.meeple >= minMeeple, `${name} late: meeples on the map >= ${minMeeple} px (got ${a.meeple.toFixed(1)} px, ${a.meeples})`);
    ok(a.covered === 0, `${name} late: zoom tokens cover no tile or spot (covered ${a.covered})`);
    await shot(page, `late-${name}`);

    // tap a lit spot in the crowd: it's picked and the map zooms in on it
    const [x, y] = await centreOf(page, '#world .cand:not(.dead)');
    await tapXY(page, x, y);
    await settle(page);
    const f = await look(page);
    ok(f.ghost, `${name} late: the tapped spot is picked`);
    ok(f.tile >= 56 && f.lit, `${name} late: a tap in a crowded map zooms in to the spot (tile ${a.tile.toFixed(1)} -> ${f.tile.toFixed(1)} px, Fit lit ${f.lit})`);
    ok(f.ring === true, `${name} late: the picked spot is on screen after the zoom`);
    await shot(page, `late-${name}-focus`);
    // the same square again turns the tile (still a tap on the picked spot after the zoom)
    const sel1 = await page.evaluate(() => JSON.stringify(self.CarcApp.sel || null));
    const [gx, gy] = await centreOf(page, '#world .ghost-ring');
    await tapXY(page, gx, gy); await page.waitForTimeout(500);   // (wait out the double-tap window)
    ok(await page.evaluate(() => !!document.querySelector('#world .ghost')), `${name} late: tapping the picked spot keeps it picked ${sel1}`);
    // Place: back to the whole map
    await page.click('#btn-place');
    await settle(page);
    const p = await look(page);
    ok(!p.lit && p.tile < f.tile * 0.8, `${name} late: after Place the whole map is back (tile ${p.tile.toFixed(1)} px, Fit lit ${p.lit})`);
    ok(!errors.length, `${name} late: no page errors ${errors.join(' | ')}`);
    await ctx.close();
  }

  // ---- a tap on a taken square in a crowded map magnifies there (no picking)
  {
    const { ctx, page, errors } = await open({ width: 393, height: 659 }, true, late);
    const a = await look(page);
    const [x, y] = await centreOf(page, '#world > g:nth-of-type(20)');
    await tapXY(page, x, y);
    await settle(page);
    const f = await look(page);
    ok(f.lit && f.tile >= 56 && !f.ghost, `393 late: a tap on a taken square magnifies there (tile ${a.tile.toFixed(1)} -> ${f.tile.toFixed(1)}, lit ${f.lit}, picked ${f.ghost})`);
    await page.click('#zoom-fit'); await settle(page);
    ok(!(await look(page)).lit, '393 late: Fit goes back to the whole map');
    // Hint in a crowded map: zooms to the best spot
    await page.click('#btn-hint'); await settle(page);
    const h = await look(page);
    ok(h.ghost && h.lit && h.tile >= 56 && h.ring === true, `393 late: Hint zooms to the best spot (tile ${h.tile.toFixed(1)}, ring on screen ${h.ring})`);
    ok(!errors.length, `393 late tap/hint: no page errors ${errors.join(' | ')}`);
    await ctx.close();
  }

  // ---- phone on its side: the map gets the room
  for (const [what, st] of [['mid', mid], ['late', late]]) {
    const { ctx, page, errors } = await open({ width: 659, height: 393 }, true, st);
    const a = await look(page);
    // (the tab bar and your edge's column take the rest; the old layout gave the map 38%)
    ok(a.share >= 0.44, `land ${what}: the map gets at least 44% of the screen (got ${(a.share * 100).toFixed(1)}%, ${a.board.map(Math.round)})`);
    ok(a.covered === 0, `land ${what}: zoom tokens cover no tile or spot (covered ${a.covered})`);
    ok(a.place, `land ${what}: Place on screen`);
    await shot(page, `land-${what}`);
    ok(!errors.length, `land ${what}: no page errors ${errors.join(' | ')}`);
    await ctx.close();
  }

  // ---- laptop: the map uses the full height (a tall map was 41 / 49 px a tile with your edge under it)
  for (const [name, vp, minTile] of [['1280', { width: 1280, height: 800 }, 48], ['1440', { width: 1440, height: 900 }, 56]]) {
    const { ctx, page } = await open(vp, false, mid);
    const t = (await look(page)).tile;
    ok(t >= minTile, `${name} mid (tall map): tiles >= ${minTile} px (got ${t.toFixed(1)})`);
    await ctx.close();
  }
  for (const [name, vp] of [['1280', { width: 1280, height: 800 }], ['1440', { width: 1440, height: 900 }]]) {
    const { ctx, page, errors } = await open(vp, false, late);
    const a = await look(page);
    ok(a.tile >= 43, `${name} late (wide map): tiles not smaller than before (got ${a.tile.toFixed(1)})`);
    ok(a.meeple >= 16, `${name} late: meeples >= 16 px (got ${a.meeple.toFixed(1)})`);
    ok(a.covered === 0, `${name} late: zoom tokens cover no tile or spot (covered ${a.covered})`);
    ok(a.place, `${name} late: Place on screen`);
    await shot(page, `late-${name}`);
    ok(!errors.length, `${name} late: no page errors ${errors.join(' | ')}`);
    await ctx.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(`vis.ui (${ENGINE}): ${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
