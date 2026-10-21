// Weird-situation test in Safari's engine (Playwright WebKit): the odd moments a
// real table and a real phone produce. No meeples left, a tile set aside, Back
// with a sheet or a "?" open, New game by mistake, two tabs, storage blocked,
// an online room closing, a computer move pending when a room starts, ties,
// all-computer games, 6 players with 3-digit scores at every size.
// Usage: node tests/edge.ui.mjs [--shots <dir>]   (SITE_ROOT=<checkout> tests other code)
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
const T = require('../js/tiles.js');
const shotsAt = process.argv.includes('--shots') ? resolve(process.argv[process.argv.indexOf('--shots') + 1]) : null;
const only = process.env.ONLY || '';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL: ' + m); } };

// ---------------------------------------------------------------- saved games (built with the real engine)
function play(n, seed, until, o) {
  const st = E.newGame(Object.assign({ players: n, seed }, o || {}));
  const rand = E.rng(seed * 3);
  while (!st.over && !until(st)) E.applyMut(st, AI.choose(st, 'medium', rand));
  return st;
}
const saved = (st, seats, extra) => JSON.stringify(Object.assign({ tab: 'play', set: { seats, hints: true }, game: { st, seats, lost: [], race: [st.scores.slice()], log: [] } }, extra || {}));
const S2 = ['you', 'hard'];
const mid = play(2, 21, (s) => s.moves >= 16 && s.turn === 0);
const endSoon = play(2, 777, (s) => s.bag.length === 0 && s.turn === 0);

// ---------------------------------------------------------------- static server
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
const PHONE = { width: 393, height: 659 };

// A stand-in for the online room (js/net.js): the test plays the room's part.
const FAKE_NET = `self.__net = { acts: [], h: {}, left: 0 };
self.CarcNet = { createOnline: () => ({
  on(e, f) { self.__net.h[e] = f; },
  act(a) { self.__net.acts.push(a); return Promise.resolve({ ok: true }); },
  leave() { self.__net.left++; }, resume() {}, start() { return Promise.resolve({ ok: true }); },
  createRoom() { return Promise.resolve({ ok: true }); }, joinRoom() { return Promise.resolve({ ok: true }); },
}) };
window.dispatchEvent(new Event('carcnet'));`;

async function open(o) {
  const viewport = o.viewport || PHONE, mobile = o.mobile !== false;
  const ctx = o.ctx || await browser.newContext(mobile ? { ...iphone, viewport } : { viewport });
  if (!o.ctx) {
    await ctx.addInitScript(([s, room, block]) => {
      if (block) { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } }); return; }
      try { if (!localStorage.getItem('__seeded')) { localStorage.clear(); localStorage.setItem('__seeded', 1); if (s) localStorage.setItem('carcassonne:v1', s); if (room) localStorage.setItem('online.carcassonne', JSON.stringify({ code: 'ABCDE' })); } } catch (e) { /* */ }
    }, [o.state || null, !!o.net, !!o.block]);
    await ctx.route(/gstatic|firebase|googleapis/, (r) => r.abort());
    if (o.net) await ctx.route(/js\/net\.js/, (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FAKE_NET }));
  }
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message) + (process.env.STACK ? ' @ ' + e.stack : '')));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  if (o.room) await page.addInitScript((snap) => {
    const t = setInterval(() => { if (self.__net && self.__net.h.change) { clearInterval(t); self.__net.h.change(snap); } }, 2);
  }, o.room);
  await page.addInitScript(() => {
    // count what FX would cheer
    self.__cheer = [];
    const t = setInterval(() => { if (self.FX && !self.FX.__spied) { const c = self.FX.celebrate; self.FX.celebrate = (o) => { self.__cheer.push(o && o.kind); return c(o); }; self.FX.__spied = 1; clearInterval(t); } }, 5);
  });
  await page.goto(URL);
  await page.waitForSelector(o.state && /"tab":"(scores|tiles|settings)"/.test(o.state) ? '#tabs' : '#world');
  await page.waitForTimeout(o.wait == null ? 700 : o.wait);
  return { ctx, page, errors };
}
const app = (page, fn, arg) => page.evaluate(fn, arg);
const txt = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.textContent : null; }, sel);
const shot = async (page, name) => { if (shotsAt) await page.screenshot({ path: join(shotsAt, name + '.png') }); };
const overflow = (page) => page.evaluate(() => ({ x: document.documentElement.scrollWidth - innerWidth, y: document.documentElement.scrollHeight - innerHeight }));
const want = (name) => !only || only.split(',').includes(name);

const tests = {
  // 5: no meeples left -> the hand has no circles, so the text must not ask for one
  async noMeeples() {
    const st = E.clone(mid); st.meeples[0] = 0;
    const { ctx, page, errors } = await open({ state: saved(st, S2) });
    await app(page, () => { const st = self.CarcApp.state.game.st, m = E2(); function E2() { return self.CarcEngine.legalPlacements(st)[0]; } self.CarcApp.pickCell(m.x, m.y); });
    const s = await txt(page, '#status');
    ok(!/circle/i.test(s) && /no meeples/i.test(s), `no meeples: status says so (got "${s}")`);
    ok(await page.evaluate(() => document.querySelectorAll('#hand .spot').length === 0), 'no meeples: no circles on the tile');
    ok(!errors.length, 'no meeples: no errors ' + errors.join(' | '));
    await ctx.close();
  },
  // 3: a tile that fits nowhere is set aside -> say so
  async setAside() {
    const st = E.clone(mid);
    st.bag.push(T.TYPES.findIndex((t) => t.set === 'river' && !t.spring && !t.lake));   // can never be placed in a base game
    const before = st.bag.length;
    const { ctx, page, errors } = await open({ state: saved(st, S2) });
    await app(page, () => { const st = self.CarcApp.state.game.st, a = self.CarcAI.choose(st, 'hard'); self.CarcApp.submit(a); });
    await page.waitForTimeout(200);
    const r = await app(page, () => ({ sub: document.getElementById('substatus').textContent, d: self.CarcApp.state.game.st.discards.length, bag: self.CarcApp.state.game.st.bag.length }));
    ok(r.d === 1 && r.bag === before - 2, `set aside: engine set one tile aside ${JSON.stringify(r)}`);
    ok(/set aside/i.test(r.sub), `set aside: the player is told (got "${r.sub}")`);
    await shot(page, 'set-aside-393');
    ok(!errors.length, 'set aside: no errors ' + errors.join(' | '));
    await ctx.close();
  },
  // 28 + 29 + 30: Back closes the sheet / the "?" bubble first, then walks back through the tabs
  async back() {
    const { ctx, page, errors } = await open({ state: saved(E.clone(endSoon), S2) });
    await page.click('#tabs [data-tab="settings"]');
    await page.click('#tabs [data-tab="play"]');
    await app(page, () => { const s = self.CarcApp.state.game.st; self.CarcApp.submit(self.CarcAI.choose(s, 'hard')); });
    await page.waitForFunction(() => !document.getElementById('sheet-back').hidden, null, { timeout: 8000 }).catch(() => {});
    ok(await page.evaluate(() => !document.getElementById('sheet-back').hidden), 'back: results sheet opened');
    await page.evaluate(() => history.back()); await page.waitForTimeout(400);
    const a = await page.evaluate(() => ({ h: location.hash, sheet: !document.getElementById('sheet-back').hidden }));
    ok(a.h === '#play' && !a.sheet, `back: first Back only closes the results sheet ${JSON.stringify(a)}`);
    await page.evaluate(() => history.back()); await page.waitForTimeout(400);
    ok(await page.evaluate(() => location.hash) === '#settings', 'back: second Back goes to Settings (where you were)');
    // "?" bubble
    await page.click('#settings .q[data-help="hints"]');
    ok(await page.evaluate(() => !document.getElementById('pop').hidden), 'back: help bubble open');
    await page.evaluate(() => history.back()); await page.waitForTimeout(400);
    const b = await page.evaluate(() => ({ h: location.hash, pop: !document.getElementById('pop').hidden }));
    ok(b.h === '#settings' && !b.pop, `back: Back closes the help bubble and stays on Settings ${JSON.stringify(b)}`);
    // closing the sheet with its own button leaves no dead Back step
    await page.click('#tabs [data-tab="play"]');
    await page.click('#btn-results'); await page.waitForTimeout(300);
    await page.click('#sheet [data-close]'); await page.waitForTimeout(300);
    await page.evaluate(() => history.back()); await page.waitForTimeout(400);
    ok(await page.evaluate(() => location.hash) === '#settings', 'back: after closing the sheet by hand, Back goes to the last tab');
    ok(!errors.length, 'back: no errors ' + errors.join(' | '));
    await ctx.close();
  },
  // 27: New game tapped by mistake in the middle of a game
  async newGameGuard() {
    const { ctx, page, errors } = await open({ state: saved(E.clone(mid), S2) });
    await page.click('#tabs [data-tab="settings"]');
    await page.click('#btn-new'); await page.waitForTimeout(300);
    const a = await app(page, () => ({ m: self.CarcApp.state.game.st.moves, tab: self.CarcApp.state.tab, t: document.getElementById('btn-new') && document.getElementById('btn-new').textContent }));
    ok(a.m === mid.moves && a.tab === 'settings', `new game: one tap mid-game does not throw the game away ${JSON.stringify(a)}`);
    await page.click('#btn-new'); await page.waitForTimeout(300);
    const b = await app(page, () => ({ m: self.CarcApp.state.game.st.moves, tab: self.CarcApp.state.tab }));
    ok(b.m === 0 && b.tab === 'play', `new game: the second tap starts it ${JSON.stringify(b)}`);
    // a finished game or a fresh one starts with one tap
    await page.click('#tabs [data-tab="settings"]');
    await page.click('#btn-new'); await page.waitForTimeout(300);
    ok(await app(page, () => self.CarcApp.state.tab) === 'play', 'new game: a game with no moves yet starts with one tap');
    ok(!errors.length, 'new game: no errors ' + errors.join(' | '));
    await ctx.close();
  },
  // 41: two tabs of the same game
  async twoTabs() {
    const A = await open({ state: saved(E.clone(mid), S2) });
    const B = await open({ ctx: A.ctx });
    const m0 = await app(B.page, () => self.CarcApp.state.game.st.moves);
    await app(A.page, () => { const s = self.CarcApp.state.game.st; self.CarcApp.submit(self.CarcAI.choose(s, 'hard')); });
    await A.page.waitForFunction((m) => self.CarcApp.state.game.st.moves >= m + 2, m0, { timeout: 8000 }).catch(() => {});   // the computer answers in tab A
    await B.page.waitForTimeout(300);
    const a = await app(A.page, () => self.CarcApp.state.game.st.moves);
    const b = await app(B.page, () => self.CarcApp.state.game.st.moves);
    ok(a >= m0 + 2 && b === a, `two tabs: the other tab follows the game (start ${m0}, A ${a}, B ${b})`);
    // B now makes a move: it must build on A's game, not overwrite it
    await app(B.page, () => { const s = self.CarcApp.state.game.st; if (self.CarcApp.state.game.seats[s.turn] === 'you') self.CarcApp.submit(self.CarcAI.choose(s, 'hard')); });
    await B.page.waitForFunction((m) => self.CarcApp.state.game.st.moves >= m + 2, a, { timeout: 8000 }).catch(() => {});
    await A.page.waitForTimeout(300);
    const saved2 = await app(B.page, () => JSON.parse(localStorage.getItem('carcassonne:v1')).game.st.moves);
    ok(saved2 >= a + 1, `two tabs: a move in the second tab keeps the first tab's moves (saved ${saved2}, A had ${a})`);
    const a2 = await app(A.page, () => self.CarcApp.state.game.st.moves);
    ok(a2 === saved2, `two tabs: and the first tab follows back (${a2} vs ${saved2})`);
    ok(!A.errors.length && !B.errors.length, 'two tabs: no errors ' + A.errors.concat(B.errors).join(' | '));
    await A.ctx.close();
  },
  // 40: storage blocked (private mode / blocked site data)
  async noStorage() {
    const { ctx, page, errors } = await open({ block: true });
    const r = await app(page, () => { const st = self.CarcApp.state.game.st; self.CarcApp.submit(self.CarcAI.choose(st, 'hard')); return self.CarcApp.state.game.st.moves; });
    ok(r === 1, 'no storage: a game starts and a move goes in');
    await page.click('#tabs [data-tab="settings"]');
    ok(await page.evaluate(() => !!document.querySelector('#fx-box .fx-set, #fx-box *')), 'no storage: settings render');
    ok(!errors.length, 'no storage: no errors ' + errors.join(' | '));
    await ctx.close();
  },
  // 20 + 19: online room starts while a local computer move is pending; the room closes mid-game
  async online() {
    // local: the computer moves first (seat 0 hard), so its move is pending when the room starts
    const local = E.newGame({ players: 2, seed: 5 });
    const room = E.newGame({ players: 2, seed: 9 }); room.opts.levels = ['hard', 'hard'];
    const snap = { mode: 'online', status: 'playing', code: 'ABCDE', seats: [{ kind: 'computer', name: 'Hard', online: true }, { kind: 'human', name: 'Me', online: true }], mySeat: 1, isHost: false, pub: E.view(room), toAct: [0], myTurn: false };
    const { ctx, page, errors } = await open({ state: saved(local, ['hard', 'you']), net: true, room: snap, wait: 0 });
    await page.waitForTimeout(1500);
    const acts = await app(page, () => self.__net.acts.length);
    ok(acts === 0, `online: a local computer move is not sent to the room as yours (sent ${acts})`);
    ok(/placing/.test(await txt(page, '#status')), 'online: shows the room computer placing');
    await app(page, () => self.__net.h.change({ mode: 'online', status: 'closed', code: 'ABCDE' }));
    await page.waitForTimeout(400);
    const r = await app(page, () => ({ online: !!self.CarcApp.state.game.online, sub: document.getElementById('substatus').textContent, st: document.getElementById('status').textContent }));
    ok(!r.online, 'online: room closed -> back to your own game');
    ok(/room/i.test(r.sub + r.st), `online: and you are told the room closed (got "${r.st}" / "${r.sub}")`);
    await shot(page, 'room-closed-393');
    ok(!errors.length, 'online: no errors ' + errors.join(' | '));
    await ctx.close();
  },
  // 16: one player with 4+ meeples on a city at a real table
  async tally() {
    const { ctx, page, errors } = await open({ state: saved(E.clone(mid), S2, { tab: 'scores' }) });
    await page.waitForSelector('#sc-add [data-who="0"]');
    for (let i = 0; i < 4; i++) await page.click('#sc-add [data-who="0"]');
    const n = await txt(page, '#sc-add [data-who="0"] .n');
    ok(n === '4', `tally: a fourth meeple counts (got "${n}")`);
    for (let i = 0; i < 4; i++) await page.click('#sc-add [data-who="0"]');
    ok((await txt(page, '#sc-add [data-who="0"] .n')) === '', 'tally: tapping past 7 clears it');
    ok(!errors.length, 'tally: no errors ' + errors.join(' | '));
    await ctx.close();
  },
  // 1: a tie for first; you are in it -> "Tie" and the win cheer
  async tie() {
    const st = E.clone(endSoon); st.over = true; st.cur = -1; st.bag = []; st.final = []; st.scores = [80, 80];
    const { ctx, page, errors } = await open({ state: saved(st, S2) });
    await page.waitForFunction(() => !document.getElementById('sheet-back').hidden, null, { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const r = await app(page, () => ({ h: document.querySelector('#sheet h2') && document.querySelector('#sheet h2').textContent, c: self.__cheer }));
    ok(/^Tie/.test(r.h || ''), `tie: results say Tie (got "${r.h}")`);
    ok(r.c.includes('win'), `tie: a tie you share is cheered as a win ${JSON.stringify(r.c)}`);
    ok(!errors.length, 'tie: no errors ' + errors.join(' | '));
    await ctx.close();
  },
  // 12: a table of computers only plays out; no win/lose cheer
  async allComputers() {
    const st = play(3, 41, (s) => s.bag.length <= 2);
    const { ctx, page, errors } = await open({ state: saved(st, ['hard', 'medium', 'easy']) });
    await page.waitForFunction(() => !document.getElementById('sheet-back').hidden, null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const r = await app(page, () => ({ over: self.CarcApp.state.game.st.over, sheet: !document.getElementById('sheet-back').hidden, c: self.__cheer }));
    ok(r.over && r.sheet, `all computers: game ends and results show ${JSON.stringify(r)}`);
    ok(!r.c.includes('win') && !r.c.includes('lose'), 'all computers: no win/lose cheer');
    ok(!errors.length, 'all computers: no errors ' + errors.join(' | '));
    await ctx.close();
  },
  // 39: reload while the computer is thinking -> it carries on
  async reloadComputer() {
    const st = E.clone(mid); const a = AI.choose(st, 'hard'); E.applyMut(st, a);   // now the computer's turn
    const { ctx, page, errors } = await open({ state: saved(st, S2), wait: 2200 });
    ok(await app(page, () => self.CarcApp.state.game.st.moves) === st.moves + 1, 'reload: the computer moves after a reload');
    ok(!errors.length, 'reload: no errors ' + errors.join(' | '));
    await ctx.close();
  },
  // 24/25/23: taps on the board and buttons during a computer turn, double Place
  async taps() {
    const { ctx, page, errors } = await open({ state: saved(E.clone(mid), S2) });
    await app(page, () => { const st = self.CarcApp.state.game.st, m = self.CarcAI.rankMoves(st, st.turn, 'hard')[0]; self.CarcApp.pickCell(m.x, m.y); });
    // all in one go, before the computer's 750 ms think: Place twice, then Hint / Rotate / Place and a board tap
    const r = await page.evaluate(() => {
      const b = document.getElementById('btn-place'); b.click(); b.click();
      const one = self.CarcApp.state.game.st.moves;
      for (const id of ['btn-hint', 'btn-rotate', 'btn-place']) document.getElementById(id).click();
      const svg = document.getElementById('board'), q = svg.getBoundingClientRect();
      for (const type of ['pointerdown', 'pointerup']) svg.dispatchEvent(new PointerEvent(type, { pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: q.left + q.width / 2, clientY: q.top + q.height / 2, bubbles: true }));
      return { one, after: self.CarcApp.state.game.st.moves };
    });
    const r0 = mid.moves + 1;
    ok(r.one === r0, `taps: double Place makes one move ${JSON.stringify(r)}`);
    ok(r.after === r0, `taps: taps during the computer turn change nothing ${JSON.stringify(r)}`);
    await page.waitForTimeout(1600);
    ok(await app(page, () => self.CarcApp.state.game.st.moves) === r0 + 1, 'taps: the computer still moves');
    ok(!errors.length, 'taps: no errors ' + errors.join(' | '));
    await ctx.close();
  },
  // 32 + 33: animations off mid-game; tab switching while a computer tile flies
  async animTabs() {
    const { ctx, page, errors } = await open({ state: saved(E.clone(mid), S2) });
    await app(page, () => { const s = self.CarcApp.state.game.st; self.CarcApp.submit(self.CarcAI.choose(s, 'hard')); });
    await page.waitForTimeout(800);
    await page.click('#tabs [data-tab="tiles"]'); await page.click('#tabs [data-tab="play"]');
    await page.waitForTimeout(1200);
    ok(await page.evaluate(() => document.querySelectorAll('#world .incoming').length) === 0, 'tabs mid-flight: the computer tile is visible on the board');
    await app(page, () => self.FX.set('animations', false));
    await app(page, () => { const s = self.CarcApp.state.game.st; self.CarcApp.submit(self.CarcAI.choose(s, 'hard')); });
    await page.waitForTimeout(1300);
    ok(await page.evaluate(() => document.querySelectorAll('#world .incoming').length) === 0, 'animations off: computer tile visible');
    ok(!errors.length, 'anim/tabs: no errors ' + errors.join(' | '));
    await ctx.close();
  },
  // 35-38 + 43 + 44 + 48-50: sizes, 6 players with 3-digit scores, results, the table pieces
  async sizes() {
    const six = play(6, 61, (s) => s.moves >= 40 && s.turn === 0, { ic: true });
    six.scores = [188, 104, 99, 150, 7, 120];
    const sizes = [['320', { width: 320, height: 568 }, true], ['393', PHONE, true], ['land', { width: 659, height: 393 }, true], ['laptop', { width: 1280, height: 800 }, false], ['huge', { width: 1920, height: 1080 }, false], ['zoom200', { width: 640, height: 400 }, false]];
    for (const [nm, viewport, mobile] of sizes) for (const [what, st, seats] of [['mid', mid, S2], ['six', six, ['you', 'hard', 'medium', 'easy', 'hard', 'medium']]]) {
      const { ctx, page, errors } = await open({ state: saved(E.clone(st), seats, { set: { seats, hints: true, ic: what === 'six' } }), viewport, mobile });
      const o = await overflow(page);
      ok(o.x <= 0 && o.y <= 0, `${nm} ${what}: no page overflow ${JSON.stringify(o)}`);
      const m = await page.evaluate(() => {
        const vis = (el) => { const r = el && el.getBoundingClientRect(); return !!r && r.width > 0 && r.top >= 0 && r.bottom <= innerHeight + 0.5 && r.left >= 0 && r.right <= innerWidth + 0.5; };
        const scs = [...document.querySelectorAll('#players .sc')];
        return {
          scores: scs.every((e) => { const r = e.getBoundingClientRect(), pl = e.closest('.plate').getBoundingClientRect(); return vis(e) && r.right <= pl.right + 0.5 && e.scrollWidth <= e.clientWidth + 1; }),
          place: vis(document.getElementById('btn-place')),
          zoom: [...document.querySelectorAll('.board-tools button')].every((b) => { const r = b.getBoundingClientRect(); return vis(b) && r.width >= 40 && r.height >= 40; }),
          track: vis(document.querySelector('#track svg, #ptrack svg')),
        };
      });
      ok(m.scores, `${nm} ${what}: every score plate readable`);
      ok(m.place, `${nm} ${what}: Place button on screen`);
      ok(m.zoom, `${nm} ${what}: zoom pieces on screen and >= 40 px`);
      ok(m.track, `${nm} ${what}: a score track is on the table`);
      await shot(page, `${what}-${nm}`);
      if (what === 'six' && (nm === '320' || nm === 'land')) {
        await app(page, () => { const s = self.CarcApp.state.game; s.st.over = true; s.st.cur = -1; s.st.final = []; s.shown = -1; self.CarcApp.newGame.length; });
        await page.click('#tabs [data-tab="settings"]'); await page.click('#tabs [data-tab="play"]');
        await page.waitForTimeout(2600);
        const r = await page.evaluate(() => { const s = document.getElementById('sheet'), n = document.getElementById('btn-new3').getBoundingClientRect(), x = document.elementFromPoint(n.left + n.width / 2, n.top + n.height / 2); return { open: !document.getElementById("sheet-back").hidden, fits: n.top >= 0 && n.bottom <= innerHeight + 1 && !!x && !!x.closest("#btn-new3"), rows: s.querySelectorAll("tr").length, n: [n.top, n.bottom, innerHeight], x: x && (x.id || x.className || x.tagName) }; });
        ok(r.open && r.fits && r.rows === 7, `${nm} six: results sheet with 6 players: New game in view and tappable ${JSON.stringify(r)}`);
        await shot(page, `six-results-${nm}`);
      }
      ok(!errors.length, `${nm} ${what}: no errors ` + errors.join(' | '));
      await ctx.close();
    }
  },
};

try {
  for (const [name, fn] of Object.entries(tests)) {
    if (!want(name)) continue;
    const f0 = fail;
    try { await fn(); } catch (e) { fail++; console.log(`  FAIL: ${name} crashed: ${e.message.split('\n')[0]}`); }
    console.log(`${fail === f0 ? 'PASS' : 'FAIL'} ${name}`);
  }
} finally {
  await browser.close(); server.close();
}
console.log(`edge: ${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
