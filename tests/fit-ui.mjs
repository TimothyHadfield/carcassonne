// Fit pass (2026-11-27): can a player see everything? A crowded late game
// (5 players, long names, 55+ tiles) and an early 2-player game at 393x659,
// 320x568, 659x393, 1280x800 and 1440x900: no page scroll, readable numbers,
// tiles and meeples identifiable, nothing off screen or overlapping.
// Usage: node tests/fit-ui.mjs [--shots <dir>] [--audit]   (ENGINE=chromium for Chrome)
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
const AUDIT = process.argv.includes('--audit');
const PORT = +(process.env.PORT || 0);

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL: ' + m); } };

function play(players, opts, until) {
  const st = E.newGame({ players, seed: 777, ...opts });
  const rand = E.rng(31), race = [st.scores.slice()];
  while (!st.over && !until(st)) { E.applyMut(st, AI.choose(st, 'medium', rand)); race.push(st.scores.slice()); }
  return { st, race };
}
const n = (st) => Object.keys(st.board).length;
const saved = ({ st, race }, seats) => JSON.stringify({ tab: 'play', set: { seats, hints: true, hv: 1 }, game: { st, seats, lost: [], race, log: [] } });
// five players, four computers of one level: the longest names a local game has ("Medium yellow")
const S5 = ['you', 'medium', 'medium', 'medium', 'medium'];
const LATE = play(5, {}, (st) => n(st) >= 58 && st.turn === 0);
const EARLY = play(2, {}, (st) => n(st) >= 3 && st.turn === 0);
const THREE = play(3, {}, (st) => n(st) >= 20 && st.turn === 0);
const late = saved(LATE, S5), early = saved(EARLY, ['you', 'medium']), three = saved(THREE, ['you', 'medium', 'medium']);

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  try { const b = await readFile(join(ROOT, p === '/' ? 'index.html' : p)); res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' }); res.end(b); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const URL = `http://127.0.0.1:${server.address().port}/index.html`;
const browser = await pw[ENGINE].launch({ headless: true });
const iphone = pw.devices['iPhone 15'];

async function open(viewport, mobile, state) {
  const base = mobile ? { ...iphone, viewport } : { viewport };
  if (ENGINE !== 'webkit') delete base.defaultBrowserType;
  const ctx = await browser.newContext(base);
  await ctx.addInitScript((s) => { try { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('carcassonne:v1', s); localStorage.setItem('coach-offer:carc-first', '1'); sessionStorage.setItem('seeded', '1'); } } catch {} }, state);
  await ctx.route(/gstatic|firebase|googleapis/, (r) => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL);
  await page.waitForSelector('#world');
  await page.waitForTimeout(900);
  return { ctx, page, errors };
}

const measure = (page) => page.evaluate(() => {
  const R = (e) => e.getBoundingClientRect();
  const vis = (e) => { if (!e) return false; const r = R(e); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const inView = (e) => { const r = R(e); return r.left >= -0.5 && r.top >= -0.5 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5; };
  const fs = (e) => (e && vis(e) ? parseFloat(getComputedStyle(e).fontSize) : null);
  const de = document.documentElement;
  // placed tiles: the <g>s of #world holding a tile body (not the meeple layer, spots or the ghost)
  const tiles = [...document.querySelectorAll('#world > g:not(.ghost):not(.cand):not(.meeple)')].map(R).filter((r) => r.width > 0 && Math.abs(r.width - r.height) < 2).sort((a, b) => a.width - b.width);
  const tileW = tiles.length ? tiles[Math.floor(tiles.length / 2)].width : 0;
  const meeples = [...document.querySelectorAll('#world .meeple use')].map((m) => R(m).height);
  const plates = [...document.querySelectorAll('#players .pchip')].map((c) => {
    const nm = c.querySelector('.nm'), sc = c.querySelector('.sc');
    const sup = [...c.querySelectorAll('.sup .tbl-meeple')].map((m) => R(m).height);
    return {
      seen: vis(c) && inView(c),
      name: vis(nm) ? nm.textContent : '', nameFs: fs(nm), nameCut: vis(nm) ? nm.scrollWidth > nm.clientWidth + 1 || nm.scrollHeight > nm.clientHeight + 1 : null,
      score: fs(sc), scoreCut: vis(sc) ? sc.scrollWidth > sc.clientWidth + 1 : null,
      sup: sup.length, supMin: sup.length ? Math.min(...sup) : 0,
      supSeen: [...c.querySelectorAll('.sup .tbl-meeple')].every(inView),
    };
  });
  const badge = document.querySelector('#deck .tbl-badge');
  const hand = document.querySelector('#hand svg') || document.getElementById('hand');
  const btns = [...document.querySelectorAll('#play-btns .btn, .board-tools button')].filter(vis).map((b) => ({ id: b.id, w: R(b).width, h: R(b).height, fs: fs(b), seen: inView(b) }));
  const mine = [...document.querySelectorAll('#mine .tbl-meeple')].map((m) => R(m).height);
  const box = (id) => { const e = document.getElementById(id); return vis(e) ? R(e) : null; };
  const areas = ['far', 'ptrack', 'board-wrap', 'dock', 'side', 'tabs'].map((id) => [id, box(id)]).filter(([, r]) => r);
  const hit = (a, c) => Math.max(0, Math.min(a.right, c.right) - Math.max(a.left, c.left)) * Math.max(0, Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top));
  const overlaps = [];
  for (let i = 0; i < areas.length; i++) for (let j = i + 1; j < areas.length; j++) if (hit(areas[i][1], areas[j][1]) > 4) overlaps.push(areas[i][0] + '/' + areas[j][0]);
  const b = R(document.getElementById('board'));
  // the side panel (laptop): track + bag + log
  const side = document.getElementById('side');
  const sideCut = vis(side) ? [...side.querySelectorAll('.side-extra > *')].filter((e) => R(e).bottom > Math.min(innerHeight, R(side).bottom) + 1).length : 0;
  const status = document.getElementById('status');
  return {
    vw: innerWidth, vh: innerHeight, sw: de.scrollWidth, sh: de.scrollHeight, bsw: document.body.scrollWidth,
    tiles: tiles.length, tile: tileW,
    tilesOut: tiles.filter((r) => r.left < b.left - 1 || r.right > b.right + 1 || r.top < b.top - 1 || r.bottom > b.bottom + 1).length,
    meeples: meeples.length, meeple: meeples.length ? Math.min(...meeples) : 0,
    board: [Math.round(b.width), Math.round(b.height)], share: +((b.width * b.height) / (innerWidth * innerHeight)).toFixed(3),
    plates,
    badge: badge ? { fs: fs(badge), seen: vis(badge) && inView(badge), text: badge.textContent } : null,
    hand: hand && vis(hand) ? { w: R(hand).width, h: R(hand).height, seen: inView(hand) } : null,
    btns, mine: mine.length, mineMin: mine.length ? Math.min(...mine) : 0,
    mineSeen: [...document.querySelectorAll('#mine .tbl-meeple')].every(inView),
    status: { fs: fs(status), seen: vis(status) && inView(status), cut: vis(status) ? status.scrollWidth > status.clientWidth + 1 : null, text: status.textContent },
    overlaps, sideCut,
  };
});
const shot = (page, name) => shotsAt ? page.screenshot({ path: join(shotsAt, `${ENGINE}-${name}.png`) }) : null;

const SIZES = [['393', { width: 393, height: 659 }, true], ['320', { width: 320, height: 568 }, true], ['land', { width: 659, height: 393 }, true], ['1280', { width: 1280, height: 800 }, false], ['1440', { width: 1440, height: 900 }, false]];
try {
  console.log(`  late: ${n(LATE.st)} tiles, 5 players, bag ${LATE.st.bag.length}; early: ${n(EARLY.st)} tiles (${ENGINE})`);
  for (const [what, state] of [['late', late], ['early', early], ['three', three]]) {
    for (const [name, vp, mobile] of SIZES) {
      const { ctx, page, errors } = await open(vp, mobile, state);
      const m = await measure(page);
      await shot(page, `${what}-${name}`);
      if (AUDIT) console.log(what, name, JSON.stringify(m));
      const at = `${what} ${name}`;
      const phone = vp.width < 900;
      ok(m.sw <= m.vw + 1 && m.bsw <= m.vw + 1, `${at}: no sideways page scroll (scrollWidth ${m.sw}/${m.bsw} vs ${m.vw})`);
      ok(m.sh <= m.vh + 1, `${at}: no page scroll (scrollHeight ${m.sh} vs ${m.vh})`);
      ok(m.tilesOut === 0, `${at}: every tile is inside the map (${m.tilesOut} outside)`);
      ok(!m.overlaps.length, `${at}: areas do not overlap (${m.overlaps.join(', ')})`);
      ok(m.plates.every((p) => p.seen), `${at}: every score plate is on screen`);
      ok(m.plates.every((p) => p.score >= 12 && !p.scoreCut), `${at}: scores >= 12 px and not cut (${m.plates.map((p) => p.score + (p.scoreCut ? ' cut' : '')).join(', ')})`);
      ok(m.plates.every((p) => !p.name || (p.nameFs >= 10 && !p.nameCut)), `${at}: names shown are >= 10 px and not cut (${m.plates.map((p) => `${p.name}@${p.nameFs}${p.nameCut ? ' CUT' : ''}`).join(', ')})`);
      if (!phone) ok(m.plates.every((p) => p.name), `${at}: laptop shows every name`);
      ok(m.plates.every((p) => !p.sup || (p.supMin >= (phone ? 8 : 12) && p.supSeen)), `${at}: others' meeples left on screen, >= ${phone ? 8 : 12} px (${m.plates.map((p) => p.sup + '@' + p.supMin.toFixed(1) + (p.supSeen ? '' : ' OFF')).join(', ')})`);
      ok(m.mine && m.mineMin >= 12 && m.mineSeen, `${at}: your meeples on screen, >= 12 px (${m.mine} @ ${m.mineMin.toFixed(1)})`);
      ok(m.badge && m.badge.seen && m.badge.fs >= 12, `${at}: tiles-left count on screen, >= 12 px (${JSON.stringify(m.badge)})`);
      ok(m.hand && m.hand.seen && m.hand.w >= 56, `${at}: your tile on screen, >= 56 px (${m.hand && m.hand.w.toFixed(1)})`);
      ok(m.btns.every((b) => b.seen && b.h >= 36 && b.w >= 36), `${at}: buttons on screen, >= 36 px (${m.btns.map((b) => `${b.id} ${b.w.toFixed(0)}x${b.h.toFixed(0)}${b.seen ? '' : ' OFF'}`).join(', ')})`);
      ok(m.btns.filter((b) => /^btn-/.test(b.id)).every((b) => b.fs >= 13), `${at}: button labels >= 13 px`);
      ok(m.status.seen && m.status.fs >= 12 && !m.status.cut, `${at}: status line readable (${m.status.fs} px${m.status.cut ? ', cut' : ''}: "${m.status.text}")`);
      if (what === 'late') {
        ok(m.meeples >= 8 && m.meeple >= (phone ? 11 : 16), `${at}: meeples on the map >= ${phone ? 11 : 16} px (${m.meeples} @ ${m.meeple.toFixed(1)})`);
        // (a whole late map on a small phone is small by nature: a tap zooms in to 64 px tiles, tests/vis.ui.mjs)
        const minTile = !phone ? 40 : name === '393' ? 14 : 11;
        ok(m.tile >= minTile, `${at}: tiles >= ${minTile} px (${m.tile.toFixed(1)})`);
      }
      ok(m.sideCut === 0, `${at}: side panel has nothing below the screen (${m.sideCut})`);
      ok(!errors.length, `${at}: no console errors ${errors.join(' | ')}`);
      await ctx.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}
console.log(`fit.ui (${ENGINE}): ${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
