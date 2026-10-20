/* Carcassonne app: Play (vs computer / pass the phone), Tiles + Scores (real
 * table companion), Settings. One state object, saved to localStorage on every
 * change; render functions write HTML strings; events are delegated.
 */
(function () {
  'use strict';
  const T = self.CarcTiles, E = self.CarcEngine, AI = self.CarcAI, O = self.CarcOdds, RD = self.CarcRender;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const KEY = 'carcassonne:v1';
  const BAG = 71;
  const LEVEL_NAME = { you: 'You', easy: 'Easy', medium: 'Medium', hard: 'Hard' };

  // ---------------------------------------------------------------- state
  const DEFAULTS = {
    tab: 'play',
    set: { seats: ['you', 'hard'], hints: true, study: false, farmers: true, farm: '3rd', smallCity: 4, river: false, ic: false },
    table: { names: ['You', 'Player 2'], me: 0, drawn: [], need: [null, null, null, null], scores: [0, 0], log: [], kind: 'cityDone' },
    game: null,
  };
  let S = load();
  function load() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) { s = null; }
    const d = JSON.parse(JSON.stringify(DEFAULTS));
    if (!s || typeof s !== 'object') return d;
    return { tab: s.tab || d.tab, set: Object.assign(d.set, s.set), table: Object.assign(d.table, s.table), game: s.game || null };
  }
  function save() {
    // An online game lives in the room, not here: keep the local game saved instead.
    const out = S.game && S.game.online ? Object.assign({}, S, { game: localBackup }) : S;
    try { localStorage.setItem(KEY, JSON.stringify(out)); } catch (e) { /* private mode: still works, just not saved */ }
  }

  // ---------------------------------------------------------------- online room (js/online.js via js/net.js)
  let net = null;          // createOnline(...) handle
  let netSnap = null;      // last snapshot from the room
  let netErr = '';
  let netBusy = false;
  let sentAt = -1;         // move number my last online move was sent at; my turn waits until the room moves on
  let localBackup = null;  // the local game, put back when the room ends
  const inRoom = () => !!(netSnap && ['lobby', 'playing', 'finished', 'joining'].includes(netSnap.status));
  function getNet() {
    if (net) return net;
    if (!self.CarcNet) return null;
    net = self.CarcNet.createOnline({ game: self.CarcGame, gameId: 'carcassonne', botDelayMs: 750 });
    net.on('change', onNet);
    net.on('error', (m) => { netErr = String(m || ''); if (S.tab === 'settings') renderSettings(); else if (S.tab === 'play' && S.game) $('substatus').textContent = netErr; });
    return net;
  }
  function netSeats(snap) {
    const lv = (snap.pub && snap.pub.opts.levels) || [];
    return snap.seats.map((s, i) => (i === snap.mySeat ? 'you' : s.kind === 'computer' ? (lv[i] || 'hard') : 'net'));
  }
  function onNet(snap) {
    netSnap = snap;
    if (snap.error) netErr = snap.error;
    const live = snap.pub && (snap.status === 'playing' || snap.status === 'finished');
    if (live) {
      const g = S.game;
      if (!g || !g.online) {
        localBackup = S.game;
        S.game = { online: true, st: snap.pub, seats: netSeats(snap), lost: [], race: [snap.pub.scores.slice()], log: [] };
        sel = null; ranked = null; rankedAt = -1; study = null; showBest = null; vs.user = false;
        save();
        if (S.tab !== 'play') setTab('play'); else renderPlay(true);
        tick();
        return;
      }
      const moved = snap.pub.moves > g.st.moves;
      g.st = snap.pub; g.seats = netSeats(snap);
      if (moved) {
        g.race.push(g.st.scores.slice());
        if (g.st.last) for (const e of g.st.last.ev) g.log.push({ ...e, by: g.st.last.p });
        logFinal(g);
        sel = null; handR = 0; showBest = null;
      }
      if (S.tab === 'play') { renderPlay(); if (moved && g.st.last) floatEvents(g.st.last.ev); }
      tick();
      return;
    }
    if (!inRoom() && S.game && S.game.online) leaveOnline(true);
    if (S.tab === 'settings') renderSettings();
  }
  function leaveOnline(already) {
    if (net && !already) net.leave();
    netSnap = null;
    if (S.game && S.game.online) {
      S.game = localBackup; localBackup = null;
      gen++; sel = null; ranked = null; rankedAt = -1; study = null; showBest = null;
      save();
      if (S.tab === 'play') renderPlay(true);
      if (S.game) tick();
    }
    if (S.tab === 'settings') renderSettings();
  }
  async function createRoom() {
    const n = getNet(); if (!n || netBusy) return;
    netBusy = true; netErr = ''; renderSettings();
    const name = S.set.oname || 'Player';
    const seats = S.set.seats.map((k, i) => (k === 'you' ? 'human' : { kind: 'computer', name: LEVEL_NAME[k] }));
    const levels = S.set.seats.map((k) => (k === 'you' ? 'hard' : k));
    const r = await n.createRoom({ name, seats, options: { farmers: S.set.farmers, farm: S.set.farm, smallCity: S.set.smallCity, river: S.set.river, ic: S.set.ic, levels } });
    netBusy = false;
    if (!r.ok) netErr = r.message;
    renderSettings();
  }
  async function joinRoom(code) {
    const n = getNet(); if (!n || netBusy) return;
    netBusy = true; netErr = ''; renderSettings();
    const r = await n.joinRoom(code, S.set.oname || 'Player');
    netBusy = false;
    if (!r.ok) netErr = r.message;
    renderSettings();
  }

  // ---------------------------------------------------------------- help text (the "?" buttons say WHY)
  const HELP = {
    tap: 'Tap the picture of each tile as it comes out of the bag. The counts and the odds above update straight away. Undo fixes a mis-tap.',
    need: 'Tap each side of the hole you want to fill: city, road or field (tap again to change, a blank side means anything). The app finds every tile that fits, counts how many are still in the bag, and works out the chance one lands on one of your turns before the bag runs out.',
    hints: 'Each lit square shows the most you can expect from putting your tile there (best turn and meeple). It counts points you score now, the likely value of unfinished cities, roads and monasteries, and subtracts a share of what you hand the others.',
    study: 'After each of your moves you see the best move and how many points yours gave up by the same measure. Squares where no tile left in the bag can ever fit are marked in red.',
    farm: 'Current rules: each farm scores 3 for every finished city it touches. First edition: each finished city pays 4 to whoever has the most farmers in all the farms touching it.',
    river: 'The River expansion: the game starts from the spring and the 12 river tiles are laid first, one per turn, ending with the lake. A river may not turn the same way twice in a row (no U-turns). Meeples can go on the land beside the river, never on the water.',
    ic: 'Inns & Cathedrals: 18 more tiles. A road with an inn scores 2 per tile when finished but nothing if unfinished at the end; a city with a cathedral scores 3 per tile and shield, or nothing if unfinished. Each player also gets one big meeple that counts as two (tap a circle twice to use it). Up to 6 players.',
    small: 'Current rules: a finished 2-tile city is worth 4 like any other city (2 per tile). Before 2004 (first editions) it was only worth 2 (1 per tile, plus 1 per shield).',
    strength: 'Measured by letting the computers play thousands of full games against each other with the same tile bags and seats swapped. The table shows how often the row player wins.',
    online: 'Create a room and friends type its 5-letter code on their own phone to join. Every "You" seat above becomes a seat for a person; computer seats stay computers. Your phone runs the game and the computers, so keep this page open until the game ends. Free: no account needed.',
    tally: 'Pick what was scored, set its size, then tap each player once for every meeple they have on it. Whoever has the most gets the points; ties all score.',
  };

  // ================================================================ PLAY
  let gen = 0;          // bumps on every new game so old timers can't act on it
  let sel = null;       // {x,y,r,fi} tentative placement
  let handR = 0;
  let ranked = null, rankedAt = -1;
  let study = null;     // {lost, best, mine} for the last human move
  let showBest = null;
  let animatedAt = -1;
  const vs = { s: 0.6, tx: 0, ty: 0, user: false };

  function seatName(i) {
    const g = S.game, k = g.seats[i];
    if (g.online && k === 'you') return 'You';
    if (k === 'net') return (netSnap && netSnap.seats[i] && netSnap.seats[i].name) || RD.PLAYER_NAME[i];
    if (k === 'you') return g.seats.filter((q) => q === 'you').length > 1 ? RD.PLAYER_NAME[i] : 'You';
    // Computers go by level; the meeple colour tells two of the same apart.
    return g.seats.filter((q) => q === k).length > 1 ? LEVEL_NAME[k] + ' ' + RD.PLAYER_NAME[i].toLowerCase() : LEVEL_NAME[k];
  }
  function newGame() {
    if (S.game && S.game.online) leaveOnline();
    gen++;
    const seats = S.set.seats.slice();
    const st = E.newGame({ players: seats.length, farmers: S.set.farmers, farm: S.set.farm, smallCity: S.set.smallCity, river: !!S.set.river, ic: !!S.set.ic, seed: (Math.random() * 2 ** 31) >>> 0 });
    S.game = { st, seats, lost: [], race: [st.scores.slice()], log: [] };
    sel = null; handR = 0; ranked = null; rankedAt = -1; study = null; showBest = null; vs.user = false;
    save();
    closeSheet();
    renderPlay(true);
    tick();
  }

  function isHumanTurn() {
    const g = S.game;
    if (!g || g.st.over) return false;
    if (g.online) return !!(netSnap && netSnap.myTurn && sentAt !== g.st.moves);
    return g.seats[g.st.turn] === 'you';
  }

  function getRanked() {
    const st = S.game.st;
    if (rankedAt !== st.moves || !ranked) { ranked = AI.rankMoves(st, st.turn, 'hard'); rankedAt = st.moves; }
    return ranked;
  }
  function valueOf(m) {
    const r = getRanked().find((q) => q.x === m.x && q.y === m.y && q.r === m.r && q.fi === m.fi && !!q.big === !!m.big);
    return r ? r.v : 0;
  }

  function tick() {
    const g = S.game;
    if (!g) return;
    if (g.st.over) {
      renderPlay();
      // Only counts as shown once the Play tab is open, so ending on another tab still shows it later.
      if (g.shown !== g.st.moves && S.tab === 'play') { g.shown = g.st.moves; setTimeout(showFinal, 700); }
      return;
    }
    if (isHumanTurn() || g.online) { renderPlay(); return; }   // online: the host's browser runs the computers
    renderPlay();
    const my = gen;
    setTimeout(() => {
      if (my !== gen || !S.game || S.game.st.over || isHumanTurn()) return;
      const a = AI.choose(S.game.st, S.game.seats[S.game.st.turn]);
      submit(a);
    }, 750);
  }

  function submit(a) {
    const g = S.game;
    const human = isHumanTurn();
    if (human && S.set.study) {
      const best = getRanked()[0];
      const mine = valueOf(a);
      study = { lost: Math.max(0, best.v - mine), best, mine };
      g.lost.push(study.lost);
    }
    if (g.online) {
      // The room applies it (and checks it again); the new state comes back as a change.
      sentAt = g.st.moves;
      sel = null; showBest = null; renderPlay();
      net.act(a).then((r) => {
        if (r.ok) return;
        sentAt = -1; netErr = r.message; renderPlay(); $('substatus').textContent = netErr;
      });
      return;
    }
    const p = g.st.turn;
    g.st = E.apply(g.st, a);
    g.race.push(g.st.scores.slice());
    const evs = g.st.last.ev.map((e) => ({ ...e, by: p }));
    for (const e of evs) g.log.push(e);
    logFinal(g);
    sel = null; handR = 0; showBest = null;
    save();
    renderPlay();
    floatEvents(g.st.last.ev);
    tick();
  }

  // ---------------------------------------------------------------- board view
  function bounds(st) {
    let x0 = 0, x1 = 0, y0 = 0, y1 = 0;
    for (const k in st.board) {
      const [x, y] = k.split(',').map(Number);
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    return { x0: x0 - 1, x1: x1 + 1, y0: y0 - 1, y1: y1 + 1 };
  }
  function fit() {
    const svg = $('board'), W = svg.clientWidth, H = svg.clientHeight;
    if (!W || !H || !S.game) return;
    const b = bounds(S.game.st);
    const w = (b.x1 - b.x0 + 1) * 100, h = (b.y1 - b.y0 + 1) * 100;
    const max = W < 600 ? 0.78 : 1.05;
    vs.s = Math.min(max, (W - 16) / w, (H - 16) / h);
    vs.tx = W / 2 - vs.s * ((b.x0 + b.x1 + 1) * 50);
    vs.ty = H / 2 - vs.s * ((b.y0 + b.y1 + 1) * 50);
  }
  function applyView() {
    const w = $('world');
    if (w) w.style.transform = `translate(${vs.tx}px, ${vs.ty}px) scale(${vs.s})`;
  }
  function scaleLabel(v, lo, hi) {
    const t = hi - lo < 1e-6 ? 1 : (v - lo) / (hi - lo);
    return `hsl(${Math.round(t * 120)}, 75%, 62%)`;
  }
  const fmt = (v) => (v >= 0 ? '+' : '−') + (Math.abs(v) < 10 ? Math.abs(v).toFixed(1) : Math.round(Math.abs(v)));

  function deadCells(st) {
    const left = E.bagLeft(st);
    const out = [];
    for (const [x, y] of E.frontier(st)) {
      let any = false;
      for (let t = 0; t < left.length && !any; t++) {
        if (!left[t] && t !== st.cur) continue;
        for (let r = 0; r < 4 && !any; r++) if (E.canPlace(st, x, y, t, r)) any = true;
      }
      if (!any) out.push([x, y]);
    }
    return out;
  }

  function renderBoard() {
    const g = S.game, st = g.st, svg = $('board');
    let s = '';
    for (const k in st.board) {
      const [x, y] = k.split(',').map(Number), tl = st.board[k];
      let extra = '';
      if (tl.m) {
        const f = T.TYPES[tl.t].rot[tl.r].feats[tl.m[1]];
        extra = RD.meeple(tl.m[0], f.spot[0], f.spot[1], f.type === 'field', tl.m[2] ? 44 : 32);
      }
      const isLast = st.last && st.last.x === x && st.last.y === y;
      // Drop-in motion plays once per move, not on every redraw.
      const anim = isLast && animatedAt !== st.moves;
      s += `<g class="${anim ? 'placed' : ''}">${RD.tile(tl.t, tl.r, x * 100, y * 100, 100, extra)}</g>`;
      if (isLast) s += `<rect class="last" x="${x * 100 + 2}" y="${y * 100 + 2}" width="96" height="96" rx="3" stroke="${RD.PLAYER[st.last.p]}"/>`;
    }
    if (isHumanTurn()) {
      const R = getRanked();
      const best = {};
      for (const m of R) { const k = m.x + ',' + m.y; if (!(k in best)) best[k] = m.v; }
      const vals = Object.values(best), lo = Math.min(...vals), hi = Math.max(...vals);
      for (const k in best) {
        const [x, y] = k.split(',').map(Number);
        const on = sel && sel.x === x && sel.y === y;
        if (on) continue;
        const top = S.set.hints && hi - best[k] < 0.05;   // the best square(s) get a solid outline
        s += `<g class="cand${top ? ' top' : ''}" data-x="${x}" data-y="${y}"><rect x="${x * 100 + 5}" y="${y * 100 + 5}" width="90" height="90" rx="8"/>`;
        if (S.set.hints) s += `<text x="${x * 100 + 50}" y="${y * 100 + 52}" fill="${scaleLabel(best[k], lo, hi)}">${fmt(best[k])}</text>`;
        s += '</g>';
      }
      if (S.set.hints || S.set.study) for (const [x, y] of deadCells(st)) {
        if (best[x + ',' + y] !== undefined) continue;
        s += `<g class="cand dead"><rect x="${x * 100 + 5}" y="${y * 100 + 5}" width="90" height="90" rx="8"/><path d="M${x * 100 + 38} ${y * 100 + 38} l24 24 m0 -24 l-24 24" stroke="#f08c8c" stroke-width="4" opacity=".7"/></g>`;
      }
      if (sel) {
        const f = sel.fi >= 0 ? T.TYPES[st.cur].rot[sel.r].feats[sel.fi] : null;
        const extra = f ? RD.meeple(st.turn, f.spot[0], f.spot[1], f.type === 'field', sel.big ? 44 : 32) : '';
        const turn = spinFrom('ghost', sel.x + ',' + sel.y, sel.r);
        s += `<g class="ghost${turn ? ' spin' : ''}" style="--from:${turn}deg">${RD.tile(st.cur, sel.r, sel.x * 100, sel.y * 100, 100, extra)}</g>`;
        s += `<rect class="ghost-ring" x="${sel.x * 100}" y="${sel.y * 100}" width="100" height="100" rx="3"/>`;
      } else spinFrom('ghost', '', 0);
      if (showBest && !(sel && sel.x === showBest.x && sel.y === showBest.y)) s += `<rect class="best-ring" x="${showBest.x * 100 - 4}" y="${showBest.y * 100 - 4}" width="108" height="108" rx="6"/>`;
    }
    svg.innerHTML = `<g id="world">${s}</g>`;
    animatedAt = st.moves;
    applyView();
  }

  function renderPlayers() {
    const g = S.game, st = g.st;
    $('players').classList.toggle('many', g.seats.length >= 5);
    $('players').classList.toggle('stack', g.seats.length >= 5 || (st.opts.ic && g.seats.length >= 3));
    $('players').innerHTML = g.seats.map((k, i) => `
      <div class="pchip ${i === st.turn && !st.over ? 'turn' : ''}">
        <svg viewBox="0 0 20 20"><use href="#meeple" fill="${RD.PLAYER[i]}" stroke="${i === 4 ? '#c9ccd6' : 'rgba(0,0,0,.5)'}" stroke-width="1"/></svg>
        <div class="col"><span class="nm">${esc(seatName(i))}</span>
        <span class="sc">${st.scores[i]}</span></div>
        <span class="mp" title="Meeples left">${st.meeples[i]}<svg viewBox="0 0 20 20" style="width:11px;height:11px;vertical-align:-1px;margin-left:1px"><use href="#meeple" fill="#969db4"/></svg>${st.opts.ic ? ` ${st.big[i]}<svg viewBox="0 0 20 20" style="width:15px;height:15px;vertical-align:-2px;margin-left:1px"><use href="#meeple" fill="#969db4"/></svg>` : ''}</span>
      </div>`).join('');
  }

  function renderHand() {
    const g = S.game, st = g.st, el = $('hand');
    if (st.over || st.cur < 0) { el.className = 'hand empty'; el.innerHTML = ''; return; }
    el.className = 'hand';
    const r = sel ? sel.r : handR;
    let extra = '';
    if (sel && isHumanTurn()) {
      const spots = E.meepleSpots(st, sel.x, sel.y, sel.r);
      const R = T.TYPES[st.cur].rot[sel.r];
      for (const fi of spots) {
        const [x, y] = R.feats[fi].spot;
        const on = sel.fi === fi;
        extra += `<g class="spot ${on ? 'on' : ''}" data-fi="${fi}"><circle cx="${x}" cy="${y}" r="15" fill="transparent"/>` +
          (on ? RD.meeple(st.turn, x, y, R.feats[fi].type === 'field', sel.big ? 34 : 25) : '') +
          `<circle class="halo" cx="${x}" cy="${y}" r="${on ? 14 : 8}"/><circle class="ring" cx="${x}" cy="${y}" r="${on ? 14 : 8}"/></g>`;
      }
    }
    el.innerHTML = RD.tileSVG(st.cur, r, extra);
    const turn = spinFrom('hand', st.moves + ':' + st.cur, r);
    if (turn) { const svg = el.firstChild; svg.style.setProperty('--from', turn + 'deg'); svg.classList.add('spin'); }
  }

  // Turning a tile animates the quarter turn instead of jumping: returns the
  // start angle (negative degrees) when `r` changed for the same tile and place.
  const spun = {};
  function spinFrom(key, where, r) {
    const was = spun[key];
    spun[key] = { where, r };
    if (!was || was.where !== where || was.r === r || !where) return 0;
    return -((r - was.r + 4) % 4) * 90;
  }

  // End-of-game scoring (farms, unfinished features) goes into the log once.
  function logFinal(g) {
    if (!g.st.over || !g.st.final || g.loggedFinal) return;
    g.loggedFinal = true;
    for (const e of g.st.final) g.log.push({ ...e, end: true });
  }
  function describe(e) {
    const who = e.who.map((p) => seatName(p)).join(' + ');
    const what = { city: 'city', road: 'road', cloister: 'monastery', farm: 'farm' }[e.kind];
    return `${who}: ${what} +${e.pts}${e.end ? ' (end)' : ''}`;
  }

  function renderDock() {
    const g = S.game, st = g.st;
    $('left').textContent = (g.online && netSnap && netSnap.code ? `Room ${netSnap.code} · ` : '') + (st.over ? 'Game over' : `${st.bag.length} left in bag`);
    const status = $('status'), sub = $('substatus');
    const human = isHumanTurn();
    $('btn-rotate').disabled = !human;
    $('btn-hint').disabled = !human;
    $('btn-place').disabled = !(human && sel);
    $('btn-place').textContent = sel && sel.fi >= 0 ? (sel.big ? 'Place + big meeple' : 'Place + meeple') : 'Place';
    if (st.over) {
      const top = Math.max(...st.scores);
      const w = st.scores.map((v, i) => (v === top ? seatName(i) : null)).filter(Boolean);
      status.textContent = w.length > 1 ? 'Tie: ' + w.join(' & ') : (w[0] === 'You' ? 'You win!' : w[0] + ' wins');
      sub.innerHTML = `<button class="btn small" id="btn-results">Results</button> <button class="btn small primary" id="btn-new2">New game</button>`;
      return;
    }
    const lastEv = st.last && st.last.ev.length ? st.last.ev.map(describe).join(' · ') : '';
    if (!human) {
      status.textContent = g.online && g.seats[st.turn] === 'you' ? 'Sending…' : `${seatName(st.turn)} is placing…`;
      sub.textContent = lastEv;
      return;
    }
    const multi = g.seats.filter((k) => k === 'you').length > 1;
    const R = getRanked();
    if (!sel) {
      status.textContent = multi ? `${seatName(st.turn)}: your turn` : 'Your turn: tap a lit square';
      let h = '';
      if (study && S.set.study) {
        h = study.lost < 0.05 ? `<b class="g">Last move was the best one.</b>` : `Last move gave up <b class="r">${study.lost.toFixed(1)}</b> (best ${fmt(study.best.v)})`;
        const tot = g.lost.reduce((a, b) => a + b, 0);
        h += ` · total <b class="w">${tot.toFixed(1)}</b>`;
      } else if (S.set.hints && R.length) h = `Best spot ${fmt(R[0].v)} expected points <button class="q" data-help="hints">?</button>`;
      else if (lastEv) h = esc(lastEv);
      sub.innerHTML = h;
    } else {
      status.textContent = sel.fi >= 0 ? 'Meeple set. Place it?' : 'Tap a circle for a meeple';
      if (S.set.hints) {
        const v = valueOf(sel);
        sub.innerHTML = `This move <b class="${v >= R[0].v - 0.05 ? 'g' : 'w'}">${fmt(v)}</b> · best ${fmt(R[0].v)} <button class="q" data-help="hints">?</button>`;
      } else sub.textContent = 'Tap the tile again to turn it.';
    }
  }

  function renderSide() {
    const g = S.game, st = g.st;
    const left = E.bagLeft(st);
    let h = '';
    if (S.set.study && g.lost.length) {
      const tot = g.lost.reduce((a, b) => a + b, 0);
      h += `<div><h3>Points given up <button class="q" data-help="study">?</button></h3><div style="font-size:22px;font-weight:800">${tot.toFixed(1)} <span class="muted">over ${g.lost.length} moves</span></div></div>`;
    }
    const inGame = T.TYPES.filter((t) => t.set === 'base' || (t.set === 'ic' && st.opts.ic) || (t.set === 'river' && st.opts.river && !t.spring));
    h += `<div><h3>Still in the bag</h3><div class="bag">${inGame.map((t) =>
      `<div class="${left[t.idx] ? '' : 'z'}">${RD.tileSVG(t.idx, 0)}<span>${left[t.idx]}</span></div>`).join('')}</div></div>`;
    const recent = g.log.slice(-12).reverse();
    h += `<div><h3>Scoring</h3><ul class="log">${recent.length ? recent.map((e) => `<li>${esc(describe(e))}</li>`).join('') : '<li>Nothing scored yet</li>'}</ul></div>`;
    $('side-extra').innerHTML = h;
  }

  function renderPlay(refit) {
    if (!S.game) { newGame(); return; }
    renderPlayers();
    if (refit || !vs.user) fit();
    renderBoard();
    renderHand();
    renderDock();
    if (window.innerWidth >= 900) renderSide();
  }

  function floatEvents(evs) {
    const host = $('floaters');
    evs.forEach((e, i) => {
      let sx = 0, sy = 0;
      for (const k of e.where) { const [x, y] = k.split(',').map(Number); sx += x; sy += y; }
      const cx = (sx / e.where.length + 0.5) * 100, cy = (sy / e.where.length + 0.5) * 100;
      const d = document.createElement('div');
      d.className = 'floater';
      d.style.left = vs.tx + vs.s * cx + 'px';
      d.style.top = vs.ty + vs.s * cy + 'px';
      d.style.color = RD.PLAYER[e.who[0]] === '#2a2d36' ? '#e8eaf0' : RD.PLAYER[e.who[0]];
      d.style.animationDelay = i * 0.25 + 's';
      d.textContent = '+' + e.pts;
      host.appendChild(d);
      setTimeout(() => d.remove(), 2200 + i * 250);
    });
  }

  function showFinal() {
    const g = S.game;
    if (!g || !g.st.over || S.tab !== 'play') return;
    const st = g.st;
    const order = st.scores.map((v, i) => i).sort((a, b) => st.scores[b] - st.scores[a]);
    const rows = order.map((i) => `<tr><td><svg viewBox="0 0 20 20" style="width:16px;height:16px;vertical-align:-3px"><use href="#meeple" fill="${RD.PLAYER[i]}"/></svg> ${esc(seatName(i))}</td>
      <td>${st.bd[i].city}</td><td>${st.bd[i].road}</td><td>${st.bd[i].cloister}</td><td>${st.bd[i].farm}</td><td class="tot">${st.scores[i]}</td></tr>`).join('');
    // Score race chart
    const W = 440, H = 130, n = g.race.length - 1 || 1, max = Math.max(10, ...g.race.flat());
    const lines = `<line x1="5" x2="${W - 5}" y1="${H - 6}" y2="${H - 6}" stroke="#2a3042"/>` + g.seats.map((_, p) => {
      const pts = g.race.map((sc, i) => `${(i / n * (W - 10) + 5).toFixed(1)},${(H - 6 - sc[p] / max * (H - 16)).toFixed(1)}`).join(' ');
      return `<polyline points="${pts}" fill="none" stroke="${p === 4 ? '#c9ccd6' : RD.PLAYER[p]}" stroke-width="3" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
    }).join('');
    const finalAt = g.race.length - 1;
    const lost = g.lost.length ? `<p class="muted">Study: you gave up <b>${g.lost.reduce((a, b) => a + b, 0).toFixed(1)}</b> expected points over ${g.lost.length} moves.</p>` : '';
    openSheet(`<div class="final">
      <h2>${esc($('status').textContent)}</h2>
      <p class="muted">Farms and unfinished features were scored at the end.</p>
      <table><colgroup><col style="width:28%"><col style="width:13%"><col style="width:13%"><col style="width:20%"><col style="width:13%"><col style="width:13%"></colgroup><tr><th></th><th>City</th><th>Road</th><th>Monastery</th><th>Farm</th><th>Total</th></tr>${rows}</table>
      <svg class="race" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><line x1="${(finalAt - 1) / n * (W - 10) + 5}" x2="${(finalAt - 1) / n * (W - 10) + 5}" y1="0" y2="${H}" stroke="#2a3042" stroke-dasharray="3 4"/>${lines}</svg>
      <p class="muted" style="margin-top:-4px">Score after each tile; the jump at the end is farms and unfinished features.</p>
      ${lost}
      <div class="acts"><button class="btn" data-close>Look at board</button><button class="btn primary" id="btn-new3">New game</button></div></div>`);
  }

  // ---------------------------------------------------------------- board input: tap, drag, pinch, wheel
  (function boardInput() {
    const svg = $('board');
    const pts = new Map();
    let start = null, moved = false, pinch = null;
    svg.addEventListener('pointerdown', (e) => {
      svg.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) { start = { x: e.clientX, y: e.clientY, tx: vs.tx, ty: vs.ty }; moved = false; }
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: vs.s, tx: vs.tx, ty: vs.ty, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
        moved = true;
      }
    });
    svg.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const rect = svg.getBoundingClientRect();
      if (pts.size === 2 && pinch) {
        const [a, b] = [...pts.values()];
        const k = Math.hypot(a.x - b.x, a.y - b.y) / pinch.d;
        zoomAt(pinch.cx - rect.left, pinch.cy - rect.top, Math.max(0.12, Math.min(2, pinch.s * k)), pinch);
        return;
      }
      if (!start) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (!moved && Math.hypot(dx, dy) > 7) { moved = true; svg.classList.add('dragging'); }
      if (moved) { vs.tx = start.tx + dx; vs.ty = start.ty + dy; vs.user = true; applyView(); }
    });
    function end(e) {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (pts.size === 0) {
        svg.classList.remove('dragging');
        if (!moved && start) tapAt(e.clientX, e.clientY);
        start = null;
      }
    }
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
    svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.max(0.12, Math.min(2, vs.s * (e.deltaY < 0 ? 1.12 : 1 / 1.12))));
    }, { passive: false });
    function zoomAt(px, py, ns, from) {
      const f = from || vs;
      const wx = (px - f.tx) / f.s, wy = (py - f.ty) / f.s;
      vs.s = ns; vs.tx = px - wx * ns; vs.ty = py - wy * ns; vs.user = true;
      svg.classList.add('dragging'); applyView(); svg.classList.remove('dragging');
    }
    $('zoom-in').onclick = () => { const r = svg.getBoundingClientRect(); vs.user = true; zoomStep(r, 1.25); };
    $('zoom-out').onclick = () => { const r = svg.getBoundingClientRect(); vs.user = true; zoomStep(r, 0.8); };
    $('zoom-fit').onclick = () => { vs.user = false; fit(); applyView(); };
    function zoomStep(r, k) {
      const px = r.width / 2, py = r.height / 2, wx = (px - vs.tx) / vs.s, wy = (py - vs.ty) / vs.s;
      vs.s = Math.max(0.12, Math.min(2, vs.s * k)); vs.tx = px - wx * vs.s; vs.ty = py - wy * vs.s; applyView();
    }
  })();

  function tapAt(cx, cy) {
    if (!isHumanTurn()) return;
    const rect = $('board').getBoundingClientRect();
    const wx = (cx - rect.left - vs.tx) / vs.s, wy = (cy - rect.top - vs.ty) / vs.s;
    const x = Math.floor(wx / 100), y = Math.floor(wy / 100);
    pickCell(x, y);
  }
  function legalRots(x, y) { const st = S.game.st; return [0, 1, 2, 3].filter((r) => E.canPlace(st, x, y, st.cur, r)); }
  function pickCell(x, y) {
    const rots = legalRots(x, y);
    if (!rots.length) return;
    if (sel && sel.x === x && sel.y === y) { rotateSel(); return; }
    let r = rots.includes(handR) ? handR : rots[0];
    if (S.set.hints) { const b = getRanked().find((m) => m.x === x && m.y === y); if (b) r = b.r; }
    sel = { x, y, r, fi: -1 };
    showBest = null;
    renderBoard(); renderHand(); renderDock();
  }
  function rotateSel() {
    if (!sel) { handR = (handR + 1) % 4; renderHand(); return; }
    const rots = legalRots(sel.x, sel.y);
    sel.r = rots[(rots.indexOf(sel.r) + 1) % rots.length];
    sel.fi = -1;
    renderBoard(); renderHand(); renderDock();
  }

  // ================================================================ TILES (companion)
  function tablePlayers() { return S.table.names.length; }
  function remainingCounts() {
    const c = T.bagCounts();
    for (const t of S.table.drawn) c[t]--;
    return c;
  }
  function renderTiles() {
    const tb = S.table, rem = remainingCounts();
    const left = BAG - tb.drawn.length;
    $('tt-left').textContent = left;
    const P = tablePlayers();
    $('tt-next').textContent = left ? tb.names[tb.drawn.length % P] : 'Bag empty';
    $('tt-undo').disabled = !tb.drawn.length;
    const anyNeed = tb.need.some((n) => n);
    const match = anyNeed ? new Set(T.typesFitting(tb.need)) : new Set();
    $('tgrid').innerHTML = T.TYPES.filter((t) => t.set === 'base').map((t) => `<button class="tbtn ${rem[t.idx] ? '' : 'out'} ${match.has(t.idx) ? 'match' : ''}" data-t="${t.idx}" aria-label="Tile ${t.id}, ${rem[t.idx]} left">${RD.tileSVG(t.idx, 0)}<span class="cnt">${rem[t.idx]}</span></button>`).join('');
    // need picker
    document.querySelectorAll('#need-pick .ns').forEach((b) => {
      const v = tb.need[+b.dataset.side];
      b.className = 'ns ' + ['n', 'e', 's', 'w'][+b.dataset.side] + (v ? ' ' + v : '');
      b.textContent = v ? { C: 'City', R: 'Road', F: 'Field' }[v] : 'any';
    });
    const out = $('need-out');
    if (!anyNeed) {
      out.innerHTML = `<div class="lbl">Tap the sides of the hole you need to fill <button class="q" data-help="need">?</button></div>`;
      return;
    }
    let K = 0; match.forEach((t) => { K += rem[t]; });
    const my = O.myDraws(BAG, tb.drawn.length, P, tb.me);
    const pEnd = O.pAtLeastOne(left, K, my.m);
    const pNext = my.m ? K / Math.max(1, left) : 0;
    const p3 = O.pAtLeastOne(left, K, Math.min(3, my.m));
    const col = `hsl(${Math.round(pEnd * 120)}, 70%, 62%)`;
    out.innerHTML = `<div class="big" style="color:${col}">${Math.round(pEnd * 100)}%</div>
      <div class="lbl">chance you draw one before the bag runs out <button class="q" data-help="need">?</button></div>
      <div class="row"><span>Next turn <b>${Math.round(pNext * 100)}%</b></span><span>In 3 turns <b>${Math.round(p3 * 100)}%</b></span>
      <span>Fits <b>${K}</b> left</span><span>Your turns <b>${my.m}</b></span></div>`;
  }

  // ================================================================ SCORES (companion)
  const KINDS = [
    ['cityDone', 'City'], ['cityOpen', 'Unfinished city'], ['road', 'Road'], ['cloister', 'Monastery'], ['farm', 'Farm'], ['other', 'Other'],
  ];
  let tally = { tiles: 2, shields: 0, cities: 1, n: 9, pts: 1, m: [] };
  function tallyPoints() {
    const k = S.table.kind, t = tally;
    if (k === 'cityDone') return t.tiles === 2 && S.set.smallCity === 2 ? 2 + t.shields : 2 * t.tiles + 2 * t.shields;
    if (k === 'cityOpen') return t.tiles + t.shields;
    if (k === 'road') return t.tiles;
    if (k === 'cloister') return t.n;
    if (k === 'farm') return (S.set.farm === '1st' ? 4 : 3) * t.cities;
    return t.pts;
  }
  function stepper(key, label, min, max) {
    return `<div class="stepper"><span class="lbl">${label}</span><span class="ctl"><button data-step="${key}" data-d="-1" data-min="${min}" data-max="${max}" aria-label="less">−</button><span class="v">${tally[key]}</span><button data-step="${key}" data-d="1" data-min="${min}" data-max="${max}" aria-label="more">+</button></span></div>`;
  }
  function meepleIcon(i, size) {
    return `<svg viewBox="0 0 20 20" style="width:${size}px;height:${size}px"><use href="#meeple" fill="${RD.PLAYER[i]}" stroke="${i === 4 ? '#c9ccd6' : 'rgba(0,0,0,.5)'}" stroke-width="1"/></svg>`;
  }
  function renderScores() {
    const tb = S.table, P = tablePlayers();
    while (tb.scores.length < P) tb.scores.push(0);
    tb.scores.length = P;
    while (tally.m.length < P) tally.m.push(0);
    tally.m.length = P;
    $('sc-list').innerHTML = tb.names.map((n, i) => `<div class="sc-row">${meepleIcon(i, 22)}
      <span class="nm">${esc(n)}${i === tb.me ? '<span class="me">ME</span>' : ''}</span>
      <button class="step" data-adj="${i}" data-d="-1" aria-label="minus one">−</button>
      <span class="pts">${tb.scores[i]}</span>
      <button class="step" data-adj="${i}" data-d="1" aria-label="plus one">+</button></div>`).join('');
    const k = tb.kind;
    let calc = '';
    if (k === 'cityDone' || k === 'cityOpen') calc = stepper('tiles', 'Tiles', 1, 60) + stepper('shields', 'Shields', 0, 10);
    else if (k === 'road') calc = stepper('tiles', 'Tiles', 1, 60);
    else if (k === 'cloister') calc = stepper('n', 'Tiles incl. itself', 1, 9);
    else if (k === 'farm') calc = stepper('cities', 'Finished cities', 0, 30);
    else calc = stepper('pts', 'Points', 1, 200);
    const pts = tallyPoints();
    const top = Math.max(...tally.m);
    const win = top > 0 ? tally.m.map((v, i) => (v === top ? i : -1)).filter((i) => i >= 0) : [];
    $('sc-add').innerHTML = `<h3 style="margin:0 0 8px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)">Score something <button class="q" data-help="tally">?</button></h3>
      <div class="kinds">${KINDS.map(([id, l]) => `<button data-kind="${id}" aria-pressed="${k === id}">${l}</button>`).join('')}</div>
      <div class="calc">${calc}</div>
      <div class="who-row">${tb.names.map((n, i) => `<button class="who ${tally.m[i] ? 'on' : ''}" data-who="${i}">${meepleIcon(i, 18)}${esc(n)}<span class="n">${tally.m[i] || ''}</span></button>`).join('')}</div>
      <div class="add-row"><span class="res">${win.length ? win.map((i) => esc(tb.names[i])).join(' + ') + ' get <b>' + pts + '</b>' : 'Tap who has meeples there · <b>' + pts + '</b> pts'}</span>
      <button class="btn primary" id="sc-go" ${win.length ? '' : 'disabled'}>Add</button></div>`;
    $('sc-log').innerHTML = tb.log.length ? tb.log.slice().reverse().map((e, j) => `<li><span>${esc(e.who.map((i) => tb.names[i] || '?').join(' + '))}: ${esc(e.what)} <b>+${e.pts}</b></span><button class="undo" data-undo="${tb.log.length - 1 - j}">Undo</button></li>`).join('')
      : '<li>Nothing scored yet</li>';
  }

  // ================================================================ SETTINGS
  function seg(name, opts, cur) {
    return `<span class="seg" data-seg="${name}">${opts.map(([v, l]) => `<button data-v="${v}" aria-pressed="${String(cur) === String(v)}">${l}</button>`).join('')}</span>`;
  }
  function sw(name, on) { return `<button class="switch" role="switch" data-sw="${name}" aria-checked="${!!on}" aria-label="${name}"></button>`; }
  function renderSettings() {
    const s = S.set, tb = S.table;
    const seats = s.seats.map((k, i) => `<div class="seat">${meepleIcon(i, 22)}${seg('seat' + i, [['you', 'You'], ['easy', 'Easy'], ['medium', 'Med'], ['hard', 'Hard']], k)}</div>`).join('');
    $('settings').innerHTML = `
      <section class="card set-sec"><h3>Play</h3>
        <div class="set-row"><span class="l">Players</span>${seg('nseats', [[2, '2'], [3, '3'], [4, '4'], [5, '5']].concat(s.ic ? [[6, '6']] : []), s.seats.length)}</div>
        ${seats}
        <div class="set-row"><span class="l">Hints <button class="q" data-help="hints">?</button></span>${sw('hints', s.hints)}</div>
        <div class="set-row"><span class="l">Study mode <button class="q" data-help="study">?</button></span>${sw('study', s.study)}</div>
        <div class="set-row"><span class="muted">Seats and rules start with the next game.</span><button class="btn primary small" id="btn-new">New game</button></div>
      </section>
      ${renderOnline()}
      <section class="card set-sec"><h3>Rules</h3>
        <div class="set-row"><span class="l">River <button class="q" data-help="river">?</button></span>${sw('river', s.river)}</div>
        <div class="set-row"><span class="l">Inns &amp; Cathedrals <button class="q" data-help="ic">?</button></span>${sw('ic', s.ic)}</div>
        <div class="set-row"><span class="l">Farmers</span>${sw('farmers', s.farmers)}</div>
        <div class="set-row"><span class="l">Farm scoring <button class="q" data-help="farm">?</button></span>${seg('farm', [['3rd', 'Current'], ['1st', '1st edition']], s.farm)}</div>
        <div class="set-row"><span class="l">2-tile city <button class="q" data-help="small">?</button></span>${seg('smallCity', [[4, '4 points'], [2, '2 points']], s.smallCity)}</div>
      </section>
      <section class="card set-sec"><h3>At the table</h3>
        <div class="set-row"><span class="l">Players</span>${seg('tplayers', [[2, '2'], [3, '3'], [4, '4'], [5, '5']], tb.names.length)}</div>
        ${tb.names.map((n, i) => `<div class="seat">${meepleIcon(i, 22)}<input data-name="${i}" value="${esc(n)}" maxlength="16" aria-label="Player ${i + 1} name"><button class="btn small ${i === tb.me ? 'warm' : 'ghost'}" data-me="${i}">${i === tb.me ? 'Me' : 'Is me'}</button></div>`).join('')}
        <div class="set-row"><span class="muted">First in the list draws first.</span><button class="btn small" id="btn-reset-table">New table game</button></div>
      </section>
      <section class="card set-sec"><h3>How strong? <button class="q" data-help="strength">?</button></h3>${STRENGTH}</section>
      <section class="set-sec"><a href="../" class="muted">← more board &amp; card games</a></section>`;
  }
  function renderOnline() {
    const err = netErr ? `<div class="net-err">${esc(netErr)}</div>` : '';
    const busy = netBusy ? 'disabled' : '';
    const sn = netSnap;
    if (sn && sn.status === 'joining') return `<section class="card set-sec"><h3>Online</h3><div class="set-row"><span class="muted">Waiting for the host to let you in…</span><button class="btn small ghost" id="net-leave">Cancel</button></div>${err}</section>`;
    if (sn && inRoom()) {
      const lv = (sn.options && sn.options.levels) || [];
      const seats = sn.seats.map((s, i) => `<div class="seat">${meepleIcon(i, 22)}<span>${s.kind === 'empty' ? '<span class="muted">Open seat</span>' : esc(s.kind === 'computer' ? LEVEL_NAME[lv[i]] || s.name : s.name)}${i === sn.mySeat ? ' <span class="muted">(you)</span>' : ''}${s.kind === 'human' && !s.online ? ' <span class="muted">· away</span>' : ''}</span></div>`).join('');
      const lobby = sn.status === 'lobby';
      return `<section class="card set-sec"><h3>Online <button class="q" data-help="online">?</button></h3>
        <div class="set-row"><span class="l">Room code</span><span class="net-code">${esc(sn.code || '')}</span></div>
        ${seats}
        <div class="set-row"><span class="muted">${lobby ? (sn.isHost ? 'Open seats left at the start become Hard computers.' : 'Waiting for the host to start.') : 'Game on: see Play.'}</span>
        <span>${lobby && sn.isHost ? `<button class="btn small primary" id="net-start" ${busy}>Start</button> ` : ''}<button class="btn small ghost" id="net-leave">Leave</button></span></div>${err}</section>`;
    }
    return `<section class="card set-sec"><h3>Online <button class="q" data-help="online">?</button></h3>
      <div class="set-row"><span class="l">Your name</span><input class="net-in" id="net-name" maxlength="16" value="${esc(S.set.oname || '')}" placeholder="Name" aria-label="Your name"></div>
      <div class="set-row"><span class="muted">Uses the seats above</span><button class="btn small primary" id="net-create" ${busy}>Create room</button></div>
      <div class="set-row"><input class="net-in code" id="net-code" maxlength="5" placeholder="CODE" aria-label="Room code" autocapitalize="characters" autocomplete="off"><button class="btn small" id="net-join" ${busy}>Join</button></div>
      ${err}</section>`;
  }
  // Filled from tools/sim.js output (see progress.md for the run).
  // Run 2026-10-19: 1000 two-player games per pair, 500 four-player games.
  const STRENGTH = `<table class="str">
      <tr><th>Match</th><th>Wins</th><th>Avg points</th></tr>
      <tr><td>Hard vs Medium</td><td>81%</td><td>112 – 93</td></tr>
      <tr><td>Hard vs Easy</td><td>98%</td><td>113 – 69</td></tr>
      <tr><td>Medium vs Easy</td><td>95%</td><td>101 – 72</td></tr>
      <tr><td>Hard vs 3 Medium</td><td>84%</td><td>71 – 50</td></tr>
      <tr><td>Medium vs 3 Easy</td><td>70%</td><td>55 – 41</td></tr>
    </table>
    <p class="muted" style="margin:8px 0 0">Going first: Hard vs Hard, the first player wins 55.5% (1000 games). With 4 players a fair share is 25%.</p>`;

  // ================================================================ sheet + help popup
  function openSheet(html) { $('sheet').innerHTML = html; $('sheet-back').hidden = false; }
  function closeSheet() { $('sheet-back').hidden = true; $('sheet').innerHTML = ''; }
  function showHelp(btn) {
    const pop = $('pop');
    pop.textContent = HELP[btn.dataset.help] || '';
    pop.hidden = false;
    const r = btn.getBoundingClientRect();
    const w = Math.min(320, window.innerWidth - 24);
    pop.style.left = Math.max(12, Math.min(window.innerWidth - w - 12, r.left - w / 2)) + 'px';
    const below = r.bottom + 8;
    pop.style.top = (below + 160 < window.innerHeight ? below : Math.max(12, r.top - 8 - pop.offsetHeight)) + 'px';
  }

  // ================================================================ tabs + events
  function setTab(t, push) {
    S.tab = t; save();
    document.querySelectorAll('#tabs button').forEach((b) => b.toggleAttribute('aria-current', b.dataset.tab === t));
    document.querySelectorAll('#tabs button').forEach((b) => { if (b.dataset.tab === t) b.setAttribute('aria-current', 'page'); });
    for (const v of ['play', 'tiles', 'scores', 'settings']) $('view-' + v).hidden = v !== t;
    if (push !== false && location.hash !== '#' + t) history.pushState(null, '', '#' + t);
    render();
    if (t === 'play' && S.game && S.game.st.over) tick();
  }
  function render() {
    if (S.tab === 'play') { renderPlay(); }
    else if (S.tab === 'tiles') renderTiles();
    else if (S.tab === 'scores') renderScores();
    else renderSettings();
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('button, [data-fi]');
    const pop = $('pop');
    if (!pop.hidden && !(b && b.dataset.help)) pop.hidden = true;
    if (e.target === $('sheet-back')) { closeSheet(); return; }
    if (!b) return;
    const d = b.dataset;
    if (d.help) { showHelp(b); return; }
    if (d.tab) { setTab(d.tab); return; }
    if (d.close !== undefined) { closeSheet(); return; }
    // ---- play
    if (b.closest('#hand') && d.fi !== undefined) {
      if (!sel) return;
      const fi = +d.fi, st = S.game.st, p = st.turn;
      const small = E.hasMeeple(st, p, false), large = E.hasMeeple(st, p, true);
      if (sel.fi !== fi) { sel.fi = fi; sel.big = !small; }
      else if (!sel.big && large) sel.big = true;
      else { sel.fi = -1; sel.big = false; }
      renderBoard(); renderHand(); renderDock(); return;
    }
    if (b.id === 'btn-rotate') { rotateSel(); return; }
    if (b.id === 'btn-place') { if (sel && isHumanTurn()) submit({ type: 'place', x: sel.x, y: sel.y, r: sel.r, fi: sel.fi, big: sel.fi >= 0 && !!sel.big }); return; }
    if (b.id === 'btn-hint') {
      if (!isHumanTurn()) return;
      const best = getRanked()[0];
      sel = { x: best.x, y: best.y, r: best.r, fi: best.fi, big: !!best.big };
      showBest = { x: best.x, y: best.y };
      renderBoard(); renderHand(); renderDock(); return;
    }
    if (b.id === 'btn-new' || b.id === 'btn-new2' || b.id === 'btn-new3') { if (b.id === 'btn-new') setTab('play'); newGame(); return; }
    if (b.id === 'btn-results') { showFinal(); return; }
    // ---- tiles
    if (d.t !== undefined) {
      const t = +d.t, rem = remainingCounts();
      if (!rem[t] || S.table.drawn.length >= BAG) return;
      S.table.drawn.push(t); save(); renderTiles();
      const nb = document.querySelector(`.tbtn[data-t="${t}"]`); if (nb) nb.classList.add('bump');
      return;
    }
    if (b.id === 'tt-undo') { S.table.drawn.pop(); save(); renderTiles(); return; }
    if (d.side !== undefined) {
      const cyc = [null, 'C', 'R', 'F'], i = +d.side;
      S.table.need[i] = cyc[(cyc.indexOf(S.table.need[i]) + 1) % 4]; save(); renderTiles(); return;
    }
    // ---- scores
    if (d.adj !== undefined) { S.table.scores[+d.adj] = Math.max(0, S.table.scores[+d.adj] + +d.d); save(); renderScores(); return; }
    if (d.kind) { S.table.kind = d.kind; save(); renderScores(); return; }
    if (d.step) { tally[d.step] = Math.max(+d.min, Math.min(+d.max, tally[d.step] + +d.d)); renderScores(); return; }
    if (d.who !== undefined) { const i = +d.who; tally.m[i] = (tally.m[i] + 1) % 4; renderScores(); return; }
    if (b.id === 'sc-go') {
      const top = Math.max(...tally.m);
      if (top <= 0) return;
      const who = tally.m.map((v, i) => (v === top ? i : -1)).filter((i) => i >= 0);
      const pts = tallyPoints();
      const kindName = KINDS.find((q) => q[0] === S.table.kind)[1];
      const what = S.table.kind === 'other' ? 'points' : kindName.toLowerCase();
      for (const i of who) S.table.scores[i] += pts;
      S.table.log.push({ who, pts, what });
      tally.m = tally.m.map(() => 0);
      save(); renderScores(); return;
    }
    if (d.undo !== undefined) {
      const e2 = S.table.log.splice(+d.undo, 1)[0];
      if (e2) for (const i of e2.who) S.table.scores[i] = Math.max(0, S.table.scores[i] - e2.pts);
      save(); renderScores(); return;
    }
    // ---- settings
    if (d.v !== undefined) {
      const sg = b.closest('[data-seg]').dataset.seg, v = d.v;
      if (sg === 'nseats') {
        const n = +v; const s = S.set.seats;
        while (s.length < n) s.push('hard');
        s.length = n;
      } else if (sg.startsWith('seat')) S.set.seats[+sg.slice(4)] = v;
      else if (sg === 'farm') S.set.farm = v;
      else if (sg === 'smallCity') S.set.smallCity = +v;
      else if (sg === 'tplayers') {
        const n = +v, nm = S.table.names;
        while (nm.length < n) nm.push('Player ' + (nm.length + 1));
        nm.length = n;
        if (S.table.me >= n) S.table.me = 0;
      }
      save(); renderSettings(); return;
    }
    if (d.sw) {
      S.set[d.sw] = !S.set[d.sw];
      if (d.sw === 'ic' && !S.set.ic && S.set.seats.length > 5) S.set.seats.length = 5;   // 6 players needs the 6th colour from I&C
      save(); renderSettings();
      if (S.game && (d.sw === 'hints' || d.sw === 'study')) rankedAt = -1;
      return;
    }
    if (d.me !== undefined) { S.table.me = +d.me; save(); renderSettings(); return; }
    // ---- online
    if (b.id === 'net-create') { createRoom(); return; }
    if (b.id === 'net-join') {
      const c = ($('net-code').value || '').trim().toUpperCase();
      if (c.length !== 5) { netErr = 'Room codes have 5 letters.'; renderSettings(); return; }
      joinRoom(c); return;
    }
    if (b.id === 'net-start') {
      netBusy = true; renderSettings();
      net.start().then((r) => { netBusy = false; if (!r.ok) netErr = r.message; if (S.tab === 'settings') renderSettings(); });
      return;
    }
    if (b.id === 'net-leave') { netErr = ''; leaveOnline(); return; }
    if (b.id === 'btn-reset-table') {
      S.table.drawn = []; S.table.scores = S.table.names.map(() => 0); S.table.log = []; S.table.need = [null, null, null, null];
      save(); setTab('tiles'); return;
    }
  });
  document.addEventListener('input', (e) => {
    if (e.target.id === 'net-name') { S.set.oname = e.target.value.slice(0, 16); save(); return; }
    const i = e.target.dataset && e.target.dataset.name;
    if (i === undefined) return;
    S.table.names[+i] = e.target.value.slice(0, 16) || 'Player ' + (+i + 1);
    save();
  });
  window.addEventListener('popstate', () => {
    const t = (location.hash || '#play').slice(1);
    if (!$('sheet-back').hidden) { closeSheet(); }
    if (['play', 'tiles', 'scores', 'settings'].includes(t)) setTab(t, false);
  });
  window.addEventListener('resize', () => { if (S.tab === 'play' && S.game) { if (!vs.user) fit(); renderPlay(); } });

  // ---------------------------------------------------------------- boot
  $('defs-host').innerHTML = RD.DEFS;
  const startTab = (location.hash || '').slice(1);
  if (['play', 'tiles', 'scores', 'settings'].includes(startTab)) S.tab = startTab;
  history.replaceState(null, '', '#' + S.tab);
  setTab(S.tab, false);
  if (S.game && !S.game.st.over) tick();
  // Back into an online room after a reload (only if this browser was in one).
  function tryResume() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem('online.carcassonne')); } catch (e) { saved = null; }
    if (saved && saved.code && getNet()) net.resume();
  }
  if (self.CarcNet) tryResume(); else window.addEventListener('carcnet', tryResume, { once: true });
  self.CarcApp = { get state() { return S; }, get net() { return netSnap; }, newGame, submit, pickCell };
})();
