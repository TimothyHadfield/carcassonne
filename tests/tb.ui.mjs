// Traders & Builders + the hand-of-tiles house rule (2026-10-28), in Safari's engine:
// the Settings rows, the other held tile (tap it to play it instead), the dashed builder
// circle (tap, Place: the builder is on the map), the goods icons, and the rules sheet's
// new sections and videos (open in a new tab). No sideways scroll at 393 and 320 px.
// Usage: node tests/tb.ui.mjs [--shots <dir>]   (SITE_ROOT=<other checkout> tests old code)
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

// A T&B game with a hand of 2, played by the computer until it is your turn and the tile
// you hold can take a builder somewhere.
function builderSpot(st) {
  for (const pl of E.legalPlacements(st)) {
    const fs = E.figSpots(st, pl.x, pl.y, pl.r);
    if (fs.b.length) return { x: pl.x, y: pl.y, r: pl.r, fi: fs.b[0] };
  }
  return null;
}
function play(seed) {
  const opts = { players: 2, seed, tb: true, hand: 2 };
  const st = E.newGame(opts);
  const rand = E.rng(seed + 5), acts = [], race = [st.scores.slice()], log = [];
  while (!st.over && !(st.turn === 0 && st.moves >= 6 && !st.bonus && st.hands[0].length === 2 && builderSpot(st))) {
    const p = st.turn, a = AI.choose(st, 'medium', rand);
    E.applyMut(st, a);
    acts.push(JSON.parse(JSON.stringify(a)));
    race.push(st.scores.slice());
    for (const e of st.last.ev) log.push({ ...e, by: p });
  }
  return { st, acts, race, log, opts };
}
let G = null;
for (let seed = 1; seed < 60 && !G; seed++) { const g = play(seed); if (!g.st.over) G = g; }
const seats = ['you', 'medium'];
const SAVED = JSON.stringify({ tab: 'play', set: { seats, hv: 1, tb: true, hand: 2 }, game: { st: G.st, seats, lost: [], race: G.race, log: G.log, acts: G.acts, gid: 'tb-test', moved: true } });
const SPOT = builderSpot(G.st);

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
  await ctx.addInitScript((s) => { try { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); if (s) localStorage.setItem('carcassonne:v1', s); localStorage.setItem('coach:carcassonne:offered', '1'); sessionStorage.setItem('seeded', '1'); } } catch {} }, saved || null);
  await ctx.route(/gstatic|firebase|googleapis/, (r) => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  await page.goto(URL);
  await page.waitForSelector('#world');
  await page.waitForTimeout(500);
  return { ctx, page, errors };
}
const ev = (page, f, a) => page.evaluate(f, a);
const shot = (page, name) => (shotsAt ? page.screenshot({ path: join(shotsAt, `tb-${name}.png`) }) : null);
const wide = (page) => ev(page, () => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const closeOffer = (page) => ev(page, () => { const b = document.querySelector('.coach-offer [data-o="no"]'); if (b) b.click(); });

try {
  for (const w of [393, 320]) {
    // ---- Settings: the two new rows, and no sideways scroll
    {
      const { ctx, page, errors } = await open(null, { width: w, height: 659 });
      await closeOffer(page);
      await page.click('[data-tab="settings"]');
      await page.waitForTimeout(300);
      const s = await ev(page, () => {
        const txt = document.body.textContent;
        return { tb: /Traders & Builders/.test(txt), hand: /Hand of tiles/.test(txt), house: /House rules/.test(txt), sw: !!document.querySelector('[data-k="tb"], [data-sw="tb"], input[name="tb"], [data-set="tb"]') };
      });
      ok(s.tb && s.hand && s.house, `${w}px: Settings shows Traders & Builders, House rules, Hand of tiles (${JSON.stringify(s)})`);
      ok((await wide(page)) <= 0, `${w}px: Settings has no sideways scroll (${await wide(page)}px)`);
      const inner = await ev(page, () => { const v = document.getElementById('view-settings'); return v.scrollWidth - v.clientWidth; });
      ok(inner <= 0, `${w}px: the Settings panel itself has no sideways scroll (${inner}px)`);
      const row = await ev(page, () => { const r = [...document.querySelectorAll('.set-row')].find((e) => /Hand of tiles/.test(e.textContent)); if (!r) return null; r.scrollIntoView(); const b = r.getBoundingClientRect(); return { right: b.right, vw: innerWidth }; });
      ok(row && row.right <= row.vw + 0.5, `${w}px: the Hand of tiles row fits (${JSON.stringify(row)})`);
      await shot(page, `settings-${w}`);
      // ---- the rules sheet: T&B, house rules and 5 videos, each opening a new tab
      await page.click('#btn-rules');
      await page.waitForSelector('.coach-rules');
      const r = await ev(page, () => {
        const b = document.querySelector('.coach-rules-body');
        const links = [...b.querySelectorAll('a[href*="youtube.com/watch"]')];
        const secs = [...b.querySelectorAll('section h3')].map((h) => h.textContent);
        return { n: links.length, safe: links.every((a) => a.target === '_blank' && /noopener/.test(a.rel)), secs };
      });
      ok(r.n >= 2 && r.n <= 5, `${w}px: the rules sheet has 2-5 YouTube videos (${r.n})`);
      ok(r.safe, `${w}px: every video opens in a new tab with rel=noopener`);
      ok(r.secs.includes('Traders & Builders') && r.secs.includes('House rules'), `${w}px: rules sections ${r.secs.join(' | ')}`);
      await ev(page, () => { const n = document.querySelector('.coach-rules-nav [data-sec]:last-child'); if (n) n.click(); });
      await page.waitForTimeout(300);
      ok((await wide(page)) <= 0, `${w}px: the rules sheet has no sideways scroll`);
      await shot(page, `rules-${w}`);
      ok(!errors.length, `${w}px: no page errors (${errors.join(' | ')})`);
      await ctx.close();
    }
    // ---- a T&B game with a hand of 2
    {
      const { ctx, page, errors } = await open(SAVED, { width: w, height: 659 });
      await closeOffer(page);
      const h = await ev(page, () => { const el = document.getElementById('held'); return { shown: !!el && !el.hidden && el.offsetWidth > 0, n: el ? el.querySelectorAll('.held-t').length : 0, inView: el ? el.getBoundingClientRect().bottom <= innerHeight : false }; });
      ok(h.shown && h.n === 1, `${w}px: your other held tile shows next to the hand (${JSON.stringify(h)})`);
      ok(h.inView, `${w}px: the held tile is on screen without scrolling`);
      const figs = await ev(page, () => { const f = document.querySelector('.figs'); return f ? f.querySelectorAll('svg').length : 0; });
      ok(figs >= 1, `${w}px: the supply shows the builder and pig (${figs})`);
      await shot(page, `hand-${w}`);
      // swap to the other tile, then back
      const before = await ev(page, () => self.CarcApp.state.game.st.cur);
      const other = await ev(page, () => +document.querySelector('#held .held-t').dataset.held);
      await page.click('#held .held-t');
      await page.waitForTimeout(200);
      const after = await ev(page, () => ({ cur: self.CarcApp.state.game.st.cur, held: +document.querySelector('#held .held-t').dataset.held }));
      ok(after.cur === other && after.held === before, `${w}px: tapping the held tile plays it instead (${before}/${other} -> ${JSON.stringify(after)})`);
      await page.click('#held .held-t');
      await page.waitForTimeout(200);
      // the builder spot: pick the square, turn to the rotation, tap the dashed circle, Place
      const picked = await ev(page, (s) => {
        const A = self.CarcApp;
        A.pickCell(s.x, s.y);
        for (let k = 0; k < 4 && A.sel && A.sel.r !== s.r; k++) A.pickCell(s.x, s.y);
        return A.sel && A.sel.r === s.r;
      }, SPOT);
      ok(picked, `${w}px: picked the builder square at the right turn`);
      await page.waitForTimeout(200);
      const n = await ev(page, () => document.querySelectorAll('.spot.fig[data-fig="b"]').length);
      ok(n >= 1, `${w}px: a dashed builder circle shows (${n})`);
      await shot(page, `builder-${w}`);
      await ev(page, () => { const c = document.querySelector('.spot.fig[data-fig="b"]'); c && c.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
      await page.waitForTimeout(150);
      const lbl = await ev(page, () => ({ fig: self.CarcApp.sel && self.CarcApp.sel.fig, btn: document.getElementById('btn-place').textContent }));
      ok(lbl.fig === 'b' && /builder/i.test(lbl.btn), `${w}px: the builder is chosen and Place says so (${JSON.stringify(lbl)})`);
      const moves = await ev(page, () => self.CarcApp.state.game.st.moves);
      await page.click('#btn-place');
      await page.waitForTimeout(300);
      const res = await ev(page, (s) => { const st = self.CarcApp.state.game.st, t = st.board[s.x + ',' + s.y] || Object.values(st.board).find((q) => q.x && q.x[2] === 'b'); return { moves: st.moves, x: t && t.x, b: st.fig[0].b }; }, SPOT);
      ok(res.moves > moves && res.x && res.x[2] === 'b' && res.b === 0, `${w}px: the builder is on the map, none left in supply (${JSON.stringify(res)})`);
      ok((await wide(page)) <= 0, `${w}px: the game has no sideways scroll`);
      ok(!errors.length, `${w}px: no page errors (${errors.join(' | ')})`);
      await ctx.close();
    }
  }
} catch (e) {
  fail++; console.log('  FAIL: threw ' + (e && e.stack || e));
} finally {
  await browser.close();
  server.close();
}
console.log(`tb.ui: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
