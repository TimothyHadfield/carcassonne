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
    // hints: the expected points on every lit square (off by default: a cleaner table, and games count as rated)
    set: { seats: ['you', 'hard'], hints: false, hv: 1, owners: false, study: false, farmers: true, farm: '3rd', smallCity: 4, river: false, ic: false, tb: false, hand: 1 },
    table: { names: ['You', 'Player 2'], me: 0, drawn: [], need: [null, null, null, null], scores: [0, 0], log: [], kind: 'cityDone' },
    game: null,
  };
  let firstVisit = false;   // nothing saved yet: offer the guided first game
  let S = load();
  function load() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) { s = null; }
    const d = JSON.parse(JSON.stringify(DEFAULTS));
    if (!s || typeof s !== 'object') { firstVisit = true; return d; }
    const set = Object.assign(d.set, s.set);
    // Hint numbers used to be on by default: switch the old default off once (they now make a game "with help").
    if (set.hv !== 1) { set.hints = false; set.hv = 1; }
    return { tab: s.tab || d.tab, set, table: Object.assign(d.table, s.table), game: s.game || null };
  }
  function save() {
    // An online game lives in the room, not here: keep the local game saved instead.
    const out = S.game && S.game.online ? Object.assign({}, S, { game: localBackup })
      : S.game && S.game.review ? Object.assign({}, S, { game: S.game.real }) : S;
    try { localStorage.setItem(KEY, JSON.stringify(out)); } catch (e) { /* private mode: still works, just not saved */ }
  }

  // ---------------------------------------------------------------- sound + effects (js/fx.js, js/sfx.js)
  // FX is looked up at call time (and may be missing): every effect is optional.
  const fx = () => self.FX || null;
  const sfx = (name, o) => { const F = fx(); return F ? F.play(name, o) : false; };
  const anims = () => { const F = fx(); return !!(F && F.settings.animations); };
  const speed = () => { const F = fx(); return F && F.settings.animSpeed === 'fast' ? 0.55 : 1; };
  function fxClasses() {
    const root = document.documentElement;
    root.classList.toggle('fx-still', !anims());
    root.classList.toggle('fx-fast', anims() && speed() < 1);
  }
  if (fx()) fx().onChange(fxClasses);
  fxClasses();

  // Screen point of a spot in board units (100 per tile).
  function boardPoint(wx, wy) {
    const r = $('board').getBoundingClientRect();
    return { x: r.left + vs.tx + vs.s * wx, y: r.top + vs.ty + vs.s * wy };
  }
  // Everything one finished move does besides the redraw: sounds in order,
  // scores counting up on the chips, meeples flying home, a sparkle for a big city.
  function moveFx(prev, g) {
    const st = g.st, L = st.last, F = fx(), SX = self.CarcSfx;
    if (!L || !F || !SX) return;
    const my = gen, mine = g.seats[L.p] === 'you', k = speed(), vis = anims() && S.tab === 'play';
    const chipAt = (p) => document.querySelector(`#players .pchip[data-seat="${p}"]`);
    // where a player's meeples stand: yours at your edge of the table, the others' in their seat
    const homeOf = (p) => (p === meSeat() && $('mine').firstChild ? $('mine') : chipAt(p) && (chipAt(p).querySelector('.sup') || chipAt(p)));
    for (const s of SX.plan(prev, st, mine)) setTimeout(() => { if (my === gen) sfx(s.name, s.opts); }, s.at * k);
    // Meeples go back to their owner's chip.
    if (vis) for (const m of SX.returned(prev, st)) {
      const [x, y] = m.key.split(',').map(Number);
      const f = T.TYPES[m.t].rot[m.r].feats[m.fi];
      const at = boardPoint(x * 100 + f.spot[0], y * 100 + f.spot[1]);
      const size = Math.max(14, (m.big ? 44 : 32) * vs.s);
      const el = document.createElement('div');
      el.innerHTML = `<svg viewBox="0 0 20 20" width="${size}" height="${size}"><use href="#meeple" fill="${RD.PLAYER[m.p]}" stroke="rgba(255,255,255,.9)" stroke-width="1.3" paint-order="stroke"/></svg>`;
      el.style.cssText = `position:fixed;left:${at.x - size / 2}px;top:${at.y - size / 2}px;width:${size}px;height:${size}px;pointer-events:none;z-index:30`;
      document.body.appendChild(el);
      setTimeout(() => {
        const home = homeOf(m.p);
        if (my !== gen || !home) { el.remove(); return; }
        F.flyTo(el, home, { clone: false, duration: 520, scale: 0.6 }).then(() => el.remove());
      }, (300 + L.ev.length * 250) * k);
    }
    // Scores count up on the chips (the end-of-game farms included).
    st.scores.forEach((v, p) => {
      const was = prev.scores[p];
      if (v === was || !vis || !chipAt(p)) return;
      chipAt(p).querySelector('.sc').textContent = was;
      setTimeout(() => {
        const c = chipAt(p);
        if (my !== gen || !c) return;
        F.countUp(c.querySelector('.sc'), was, v, { duration: st.over ? 900 : 600 }); F.pop(c);
      }, 300 * k);
    });
    for (const e of L.ev) {
      if (!SX.bigCity(e) || !e.who.some((p) => g.seats[p] === 'you')) continue;
      setTimeout(() => { if (my === gen) F.celebrate({ kind: 'big', at: chipAt(e.who[0]), colors: [RD.PLAYER[e.who[0]], '#f0b354', '#e8eaf0'] }); }, 450 * k);
    }
    if (vis && st.over && st.final) floatEvents(st.final.filter((e) => e.kind === 'farm').slice(0, 12), 0.1);
  }
  // "Your turn": a chime and a pulse of your tile, once per turn, after the last move's sounds.
  let chimedAt = -1;
  function turnFx() {
    const g = S.game;
    if (!g || g.st.over || !isHumanTurn() || chimedAt === g.st.moves) return;
    chimedAt = g.st.moves;
    const my = gen, at = g.st.moves;
    setTimeout(() => {
      if (my !== gen || !S.game || S.game.st.moves !== at || !isHumanTurn()) return;
      sfx('turn');
      if (fx() && S.tab === 'play') fx().pulse($('hand'));
    }, g.st.moves ? 500 * speed() : 0);
  }

  // ---------------------------------------------------------------- online room (js/online.js via js/net.js)
  let net = null;          // createOnline(...) handle
  let netSnap = null;      // last snapshot from the room
  let netErr = '';
  let netBusy = false;
  let sentAt = -1;         // move number my last online move was sent at; my turn waits until the room moves on
  let localBackup = null;  // the local game, put back when the room ends
  let notice = null;       // a one-off line under the status ({g, at, text}), gone after the next move
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
        gen++;   // a local computer move still pending must not land in the room
        localBackup = S.game;
        S.game = { online: true, st: snap.pub, seats: netSeats(snap), lost: [], race: [snap.pub.scores.slice()], log: [] };
        sel = null; ranked = null; rankedAt = -1; study = null; showBest = null; vs.user = false;
        save();
        if (S.tab !== 'play') setTab('play'); else renderPlay(true);
        tick();
        return;
      }
      const moved = snap.pub.moves > g.st.moves;
      const prev = g.st;
      const byOther = moved && snap.pub.moves === prev.moves + 1 && g.seats[prev.turn] !== 'you';
      const src = byOther ? handSource(prev) : null;   // their tile flies from the middle to its square
      g.st = snap.pub; g.seats = netSeats(snap);
      if (src && g.st.last) incomingAt = g.st.moves;
      if (moved) {
        noteAside(prev, g);
        g.race.push(g.st.scores.slice());
        if (g.st.last) for (const e of g.st.last.ev) g.log.push({ ...e, by: g.st.last.p });
        logFinal(g);
        sel = null; handR = 0; showBest = null;
      }
      if (S.tab === 'play') { renderPlay(); if (moved && g.st.last) floatEvents(g.st.last.ev); flyToBoard(src, g.st); }
      else if (incomingAt === g.st.moves) incomingAt = -1;
      tick();
      if (moved && g.st.last) moveFx(prev, g);
      return;
    }
    if (!inRoom() && S.game && S.game.online) {
      leaveOnline(true);
      if (S.game && (snap.status === 'closed' || snap.status === 'left')) {
        notice = { g: S.game, at: S.game.st.moves, text: snap.status === 'closed' ? 'The room closed. Back to your game.' : 'You are out of the room. Back to your game.' };
        if (S.tab === 'play') renderDock();
      }
    }
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
    const r = await n.createRoom({ name, seats, options: { farmers: S.set.farmers, farm: S.set.farm, smallCity: S.set.smallCity, river: S.set.river, ic: S.set.ic, tb: !!S.set.tb, hand: S.set.river ? 1 : +S.set.hand || 1, levels } });
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
    tb: 'Traders & Builders: 24 more tiles. 20 city spots show wine, grain or cloth: whoever lays the tile that finishes a city takes its goods, even with no meeple there; at the end the most of each kind scores 10 (ties: all 10). Each player also gets a builder and a pig. The builder goes on a road or city where you already have a meeple; whenever you later extend that road or city, you lay a second tile straight away (once a turn). It comes home when the feature is finished. The pig goes on a field where you have a farmer: if you win that farm, it scores 4 per city instead of 3. Builder and pig circles show on your tile where they can go.',
    hand: 'House rule: everyone holds 2 or 3 tiles instead of drawing one. On your turn pick one of yours (tap it), lay it, and draw one back. Tiles that fit nowhere are swapped for new ones. The game ends when every tile is laid. Not with the River (the river is one stack).',
    small: 'Current rules: a finished 2-tile city is worth 4 like any other city (2 per tile). Before 2004 (first editions) it was only worth 2 (1 per tile, plus 1 per shield).',
    strength: 'Measured by letting the computers play thousands of full games against each other with the same tile bags and seats swapped. The table shows how often the row player wins.',
    online: 'Create a room and friends type its 5-letter code on their own phone to join. Every "You" seat above becomes a seat for a person; computer seats stay computers. Your phone runs the game and the computers, so keep this page open until the game ends. Free: no account needed.',
    tally: 'Pick what was scored, set its size, then tap each player once for every meeple they have on it. Whoever has the most gets the points; ties all score.',
  };

  // ================================================================ PLAY
  let gen = 0;          // bumps on every new game so old timers can't act on it
  let leader = true;    // two tabs of one game: only the one that moved last runs the computers
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
  // kind: undefined (Settings' seats and rules), 'daily' (today's game vs Hard, standard rules, same bag
  // for everyone) or 'tut' (the guided first game vs Easy, a fixed bag).
  function newGame(kind) {
    if (S.game && S.game.online) leaveOnline();
    if (S.game && S.game.review) endReview();
    recordQuit(S.game);   // leaving a game after your first tile counts as a loss
    gen++;
    let seats = S.set.seats.slice(), o = { farmers: S.set.farmers, farm: S.set.farm, smallCity: S.set.smallCity, river: !!S.set.river, ic: !!S.set.ic, tb: !!S.set.tb, hand: S.set.river ? 1 : +S.set.hand || 1, seed: (Math.random() * 2 ** 31) >>> 0 };
    let day = null;
    if (kind === 'daily' && PF()) {
      day = Profile.daily.date();
      seats = ['you', 'hard'];
      o = { farmers: true, farm: '3rd', smallCity: 4, river: false, ic: false, seed: (Profile.daily.seed(day, 'carcassonne') >>> 0) || 1 };
    } else if (kind === 'tut' && self.CarcTutorial) {
      seats = ['you', 'easy'];
      o = { farmers: true, farm: '3rd', smallCity: 4, river: false, ic: false, seed: CarcTutorial.SEED };
    }
    const st = E.newGame(Object.assign({ players: seats.length }, o));
    S.game = { st, seats, lost: [], race: [st.scores.slice()], log: [], acts: [], gid: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), helped: false, moved: false, recorded: false };
    if (day) S.game.daily = day;
    if (kind === 'tut') S.game.tut = true;
    sel = null; handR = 0; ranked = null; rankedAt = -1; study = null; showBest = null; vs.user = false;
    save();
    closeSheet();
    renderPlay(true);
    tick();
  }

  function isHumanTurn() {
    const g = S.game;
    if (!g || g.st.over) return false;
    if (g.review) return false;
    if (g.online) return !!(netSnap && netSnap.myTurn && sentAt !== g.st.moves);
    return g.seats[g.st.turn] === 'you';
  }

  function getRanked() {
    const st = S.game.st;
    if (rankedAt !== st.moves || !ranked) { ranked = AI.rankMoves(st, st.turn, 'hard'); rankedAt = st.moves; }
    return ranked;
  }
  function valueOf(m) {
    const r = getRanked().find((q) => q.x === m.x && q.y === m.y && q.r === m.r && q.fi === m.fi && !!q.big === !!m.big && (q.fig || null) === (m.fig || null));
    return r ? r.v : 0;
  }

  function tick() {
    const g = S.game;
    if (!g) return;
    if (g.review) { renderPlay(); return; }
    if (g.st.over) {
      recordEnd(g);
      renderPlay();
      // Only counts as shown once the Play tab is open, so ending on another tab still shows it later.
      if (g.shown !== g.st.moves && S.tab === 'play') { g.shown = g.st.moves; setTimeout(showFinal, 700); }
      return;
    }
    if (isHumanTurn() || g.online) { renderPlay(); turnFx(); return; }   // online: the host's browser runs the computers
    renderPlay();
    if (!leader) return;   // another tab of this game runs the computers
    const my = gen;
    setTimeout(() => {
      if (my !== gen || !S.game || S.game.st.over || isHumanTurn() || !leader) return;
      const a = AI.choose(S.game.st, S.game.seats[S.game.st.turn]);
      submit(a);
    }, 750);
  }

  function submit(a) {
    const g = S.game;
    const human = isHumanTurn();
    if (human && vs.focus) { vs.user = false; vs.focus = false; }   // zoomed in to place: back to the whole map
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
    const p = g.st.turn, prev = g.st;
    const src = human ? null : handSource(g.st);   // a computer's tile flies from the middle to its square
    g.st = E.apply(g.st, a);
    // every move, so Undo and the end-of-game replay can rebuild any point of the game from the bag's seed
    if (g.acts) {
      const rec = { x: a.x, y: a.y, r: a.r, fi: a.fi == null ? -1 : a.fi, big: !!a.big, p };
      if (a.fig) rec.fig = a.fig;
      if (prev.hands) rec.t = a.t != null ? a.t : prev.cur;
      g.acts.push(rec);
    }
    if (human) {
      g.moved = true;
      if (S.set.hints || S.set.study) g.helped = true;   // the numbers on the squares (or study mode) are help
    }
    noteAside(prev, g);
    leader = true;   // this tab moved: it runs the computers now (see the storage listener)
    if (src) incomingAt = g.st.moves;
    g.race.push(g.st.scores.slice());
    const evs = g.st.last.ev.map((e) => ({ ...e, by: p }));
    for (const e of evs) g.log.push(e);
    logFinal(g);
    sel = null; handR = 0; showBest = null;
    save();
    renderPlay();
    flyToBoard(src, g.st);
    floatEvents(g.st.last.ev);
    tick();
    if (S.game === g) moveFx(prev, g);
  }

  // ---------------------------------------------------------------- Undo + replay (local games)
  // Every move is kept (g.acts), and the bag comes from the game's seed, so any point of the game can be
  // rebuilt exactly. Old saved games without the list get neither.
  function replayTo(g, k) {
    const st = E.newGame(g.st.opts), race = [st.scores.slice()], log = [];
    for (let i = 0; i < k; i++) {
      const p = st.turn;
      E.applyMut(st, g.acts[i]);
      race.push(st.scores.slice());
      for (const e of st.last.ev) log.push({ ...e, by: p });
    }
    return { st, race, log };
  }
  const hasActs = (g) => !!(g && !g.online && Array.isArray(g.acts) && g.acts.length === g.st.moves);
  // the move index of this phone's player's last tile (-1 = none yet)
  function lastMine(g) {
    const me = g.seats.indexOf('you');
    // (who moved: kept with each move since the builder's extra turns; older games went in seat order)
    for (let i = g.acts.length - 1; i >= 0; i--) if ((g.acts[i].p != null ? g.acts[i].p : i % g.seats.length) === me) return i;
    return -1;
  }
  // Undo: one person against computers, not in the Daily or the guided game.
  function canUndo() {
    const g = S.game;
    return !!(hasActs(g) && !g.review && !g.daily && !g.tut && !g.st.over && g.seats.filter((k) => k === 'you').length === 1 && lastMine(g) >= 0);
  }
  function undo() {
    if (!canUndo()) return;
    const g = S.game, k = lastMine(g), me = g.seats.indexOf('you');
    const r = replayTo(g, k);
    let mineBefore = 0;
    for (let i = 0; i < k; i++) if ((g.acts[i].p != null ? g.acts[i].p : i % g.seats.length) === me) mineBefore++;
    g.st = r.st; g.race = r.race; g.log = r.log; g.acts = g.acts.slice(0, k); g.lost = g.lost.slice(0, mineBefore);
    g.helped = true; g.aside = null; g.loggedFinal = false; g.shown = null; g.cheered = false;
    gen++; leader = true;
    sel = null; handR = 0; ranked = null; rankedAt = -1; study = null; showBest = null; incomingAt = -1; handKey = null; vs.user = false;
    notice = { g, at: g.st.moves, text: 'Took back your last tile: this game now counts as "with help".' };
    sfx('tileTurn');
    save(); renderPlay(true); tick();
  }
  // End-of-game replay: step through the game tile by tile on the board. The finished game waits in .real.
  let rpTimer = 0;
  function startReview() {
    const g = S.game;
    if (!hasActs(g) || !g.st.over || g.review) return;
    closeSheet();
    const st = replayTo(g, 0).st;
    S.game = { review: true, real: g, k: 0, st, seats: g.seats, lost: g.lost, race: g.race, log: g.log, acts: g.acts };
    gen++; sel = null; showBest = null; incomingAt = -1; handKey = null;
    renderPlay(true);
  }
  function reviewTo(k, playing) {
    const R = S.game;
    if (!R || !R.review) return;
    const n = R.real.acts.length;
    k = Math.max(0, Math.min(n, k));
    if (k === R.k) { if (!playing) stopPlay(); return; }
    const fwd = k === R.k + 1;
    R.k = k; R.st = k === n ? R.real.st : replayTo(R.real, k).st;
    if (!playing) stopPlay();
    animatedAt = fwd ? -1 : R.st.moves;   // a step forward drops the new tile in
    renderPlay();
    if (fwd && R.st.last) { floatEvents(R.st.last.ev); sfx('place', { vol: 0.6 }); }
    if (k === n && R.st.final) floatEvents(R.st.final.filter((e) => e.kind === 'farm').slice(0, 12), 0.1);
  }
  function stopPlay() { if (rpTimer) { clearInterval(rpTimer); rpTimer = 0; } const b = $('rv-play'); if (b) b.textContent = 'Play'; }
  function togglePlay() {
    const R = S.game;
    if (!R || !R.review) return;
    if (rpTimer) { stopPlay(); return; }
    if (R.k >= R.real.acts.length) reviewTo(0);
    $('rv-play').textContent = 'Pause';
    rpTimer = setInterval(() => {
      const Q = S.game;
      if (!Q || !Q.review || Q.k >= Q.real.acts.length) { stopPlay(); return; }
      reviewTo(Q.k + 1, true);
    }, 700 * speed());
  }
  function endReview(quiet) {
    stopPlay();
    if (!S.game || !S.game.review) return;
    S.game = S.game.real;
    gen++; animatedAt = S.game.st.moves;
    if (!quiet) renderPlay(true);
  }

  // ---------------------------------------------------------------- My stats (js/profile.js + js/carcprofile.js)
  // One result per game. Leaving a game after your first tile counts as a loss; Hint, the hint numbers,
  // study mode or Undo make it "with help" (not rated); the guided first game never counts.
  let pfReady = false;
  const PF = () => (pfReady && self.Profile ? self.Profile : null);
  function recordFrom(g, online) {
    const P = PF();
    if (!P || !g || g.recorded || g.tut || g.review) return null;
    const me = online ? (netSnap ? netSnap.mySeat : -1) : g.seats.indexOf('you');
    if (me < 0) return null;   // computers only: nobody here to count
    g.recorded = true;
    let out = null;
    try {
      const r = CarcProfile.result(g, me, { helped: !!g.helped, daily: !!g.daily, online });
      if (g.daily) r.date = g.daily;   // a Daily finished after midnight still belongs to the day it was dealt
      out = P.recordResult(r);
    } catch (e) { /* the stats never stop the game */ }
    save();
    return out;
  }
  function recordEnd(g) {
    if (!g || !g.st.over || g.recorded || g.review) return;
    if (g.online) {
      // once per room (a reload shows the same finished room again)
      if (!netSnap || netSnap.mySeat < 0) return;
      const key = (netSnap.code || '') + ':' + g.st.moves;
      if (S.set.recOnline === key) { g.recorded = true; return; }
      S.set.recOnline = key;
      recordFrom(g, true);
      return;
    }
    if (hasActs(g) || g.daily || g.moved) recordFrom(g, false);
  }
  function recordQuit(g) {
    if (!g || g.online || g.review || g.st.over || !g.moved || g.tut || g.recorded) return;
    if (g.seats.filter((k) => k === 'you').length !== 1) return;   // pass and play: no loser
    recordFrom(g, false);
  }
  const dailyDone = () => { try { return !!(PF() && Profile.daily.played()); } catch (e) { return false; } };
  function openStats(tab) {
    const P = PF();
    if (!P) return;
    closeSheet(); hidePop();
    P.openPanel(tab ? { tab } : undefined);
  }
  // a line on the results sheet: how this game counted
  function statsLine(g) {
    if (!PF() || !g || g.online && !(netSnap && netSnap.mySeat >= 0)) return '';
    const why = g.tut ? 'The guided game is not counted in My stats.' : g.online ? 'Counted in My stats (online).'
      : g.seats.filter((k) => k === 'you').length > 1 ? 'Counted as pass the phone.'
      : g.helped ? 'Counted as "with help" (Hint, hint numbers, study or Undo): not rated.' : g.daily ? 'Today\'s Daily game is in My stats.' : 'Counted in My stats.';
    return `<div class="stats-line"><span class="muted">${esc(why)}</span><button class="btn small pf-open" id="btn-stats2">My stats</button></div>`;
  }

  // ---------------------------------------------------------------- the guided first game + rules (js/coach.js + js/tutorial.js)
  let tour = null;
  const tutOn = () => !!(S.game && S.game.tut && !S.game.online && !S.game.review);
  function openRules() { if (self.COACH && self.CarcTutorial) { closeSheet(); hidePop(); COACH.rules(CarcTutorial.rules()); } }
  function startTutorial() {
    if (!tour) return;
    if (COACH.closeOffer) COACH.closeOffer();
    tour.reset();
    if (S.tab !== 'play') setTab('play');
    newGame('tut');
    tour.start();
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
  // One zoom only: auto mode fits the whole board (tiles + every empty spot the
  // tile could go) in the board area. Pinch / wheel / + leave auto mode;
  // Fit, double-tap on empty board, or zooming back out to the fit return to it.
  const AUTO_MAX = 1.5;   // a 1-tile board shouldn't fill the screen
  // The zoom tokens get a strip of their own, so they never cover a tile or a spot: a column
  // down the right or a row along the top, whichever leaves the map bigger.
  const TOOLS = 56;       // 42 px token + its 8 px inset + a small gap
  let toolsRow = false;
  function fitBox() {
    const svg = $('board'), W = svg.clientWidth, H = svg.clientHeight;
    if (!W || !H || !S.game) return null;
    const b = bounds(S.game.st);
    const w = (b.x1 - b.x0 + 1) * 100, h = (b.y1 - b.y0 + 1) * 100;
    const sc = (aw, ah) => Math.min(AUTO_MAX, (aw - 16) / w, (ah - 16) / h);
    const col = sc(W - TOOLS, H), row = sc(W, H - TOOLS);
    // (only switch sides for a clear gain, so the tokens don't hop about as the map grows)
    const r = toolsRow ? row * 1.04 >= col : row > col * 1.04;
    const s = r ? row : col, ax = 0, ay = r ? TOOLS : 0, aw = r ? W : W - TOOLS, ah = r ? H - TOOLS : H;
    return { s, row: r, tx: ax + aw / 2 - s * ((b.x0 + b.x1 + 1) * 50), ty: ay + ah / 2 - s * ((b.y0 + b.y1 + 1) * 50), W, H,
      bx0: b.x0 * 100, bx1: (b.x1 + 1) * 100, by0: b.y0 * 100, by1: (b.y1 + 1) * 100 };
  }
  function fit() {
    const f = fitBox();
    if (!f) return;
    vs.s = f.s; vs.tx = f.tx; vs.ty = f.ty;
    if (f.row !== toolsRow) { toolsRow = f.row; $('board-wrap').classList.toggle('tools-row', toolsRow); }
  }
  // A crowded map on a small screen: a tap (or Hint) zooms in on that spot, so the
  // tiles, meeples and lit squares around it are big enough to see and tap. Place
  // (or Fit) goes back to the whole map.
  const FOCUS_BELOW = 40, FOCUS_PX = 64;   // tile size on screen (px)
  function focusOn(wx, wy) {
    const f = fitBox();
    if (!f || vs.user || f.s * 100 >= FOCUS_BELOW) return false;
    vs.s = Math.min(maxZoom(), FOCUS_PX / 100);
    vs.tx = f.W / 2 - vs.s * wx; vs.ty = f.H / 2 - vs.s * wy;
    vs.user = true; vs.focus = true;
    clampView();
    return true;
  }
  const maxZoom = () => { const f = fitBox(); return Math.max(2.5, (f ? f.s : 1) * 2); };
  // Manual mode: never smaller than the fit, and the board can't be dragged off-screen.
  function clampView() {
    const f = fitBox();
    if (!f) return;
    if (vs.s <= f.s * 1.001) { vs.user = false; vs.focus = false; fit(); return; }
    const m = 8;
    const lim = (t, a0, a1, size) => {
      const lo = Math.min(size - m - vs.s * a1, m - vs.s * a0), hi = Math.max(size - m - vs.s * a1, m - vs.s * a0);
      return Math.max(lo, Math.min(hi, t));
    };
    vs.tx = lim(vs.tx, f.bx0, f.bx1, f.W);
    vs.ty = lim(vs.ty, f.by0, f.by1, f.H);
  }
  let shown = null;       // the transform on screen, so a redrawn board glides from it
  function applyView(instant) {
    const w = $('world');
    const fb = $('zoom-fit');
    if (fb) fb.classList.toggle('lit', vs.user);
    if (!w) return;
    const t = `translate(${vs.tx}px, ${vs.ty}px) scale(${vs.s})`;
    const svg = $('board'), jump = instant || !shown;
    if (jump) svg.classList.add('dragging');
    else void w.getBoundingClientRect();   // a freshly drawn #world: let its start point register first
    w.style.transform = t;
    shown = t;
    if (jump) { void w.getBoundingClientRect(); svg.classList.remove('dragging'); }
  }
  function toAuto() { vs.user = false; vs.focus = false; fit(); applyView(); }
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

  // Meeple size in tile units (a tile is 100): about 17 px on screen at the whole-map
  // zoom, between 32 (the old size) and 62 (about the real piece on its tile).
  function meepleSize() {
    const f = fitBox(), s = f ? f.s : vs.s;
    return Math.round(Math.max(32, Math.min(62, 17 / s)));
  }
  function renderBoard() {
    const g = S.game, st = g.st, svg = $('board');
    let s = '';
    // Cardboard under the map: one path for every tile's edge and one for its shadow on the table
    // (paths, not groups, so the first group in #world is still a tile).
    let under = '';
    for (const k in st.board) { const [x, y] = k.split(',').map(Number); under += `M${x * 100} ${y * 100}h100v100h-100z`; }
    s += `<path class="t-shadow" d="${under}" transform="translate(6 10)" opacity=".16"/><path class="t-shadow" d="${under}" transform="translate(3.5 6)" opacity=".2"/><path class="t-edge" d="${under}" transform="translate(2 3)"/>`;
    // Meeples keep a readable size on a big, zoomed-out map (up to about the real piece:
    // ~60% of a tile), so they go on top of all the tiles in a layer of their own.
    const ms = meepleSize();
    let men = '';
    for (const k in st.board) {
      const [x, y] = k.split(',').map(Number), tl = st.board[k];
      const isLast = st.last && st.last.x === x && st.last.y === y;
      // Drop-in motion plays once per move, not on every redraw; a tile still flying in stays hidden.
      const anim = isLast && animatedAt !== st.moves;
      const cls = isLast && incomingAt === st.moves ? 'incoming' : anim ? 'placed' : '';
      if (tl.m) {
        const f = T.TYPES[tl.t].rot[tl.r].feats[tl.m[1]];
        men += `<g class="${cls}"><g transform="translate(${x * 100} ${y * 100})">${RD.meeple(tl.m[0], f.spot[0], f.spot[1], f.type === 'field', tl.m[2] ? ms * 1.375 : ms)}</g></g>`;
      }
      if (tl.x) {   // Traders & Builders: builder or pig
        const f = T.TYPES[tl.t].rot[tl.r].feats[tl.x[1]];
        men += `<g class="${cls}"><g transform="translate(${x * 100} ${y * 100})">${RD.figure(tl.x[2], tl.x[0], f.spot[0], f.spot[1], ms * 1.1)}</g></g>`;
      }
      s += `<g class="${cls}">${RD.tile(tl.t, tl.r, x * 100, y * 100, 100)}</g>`;
      if (isLast) s += `<rect class="last" x="${x * 100 + 2}" y="${y * 100 + 2}" width="96" height="96" rx="3" stroke="${RD.PLAYER[st.last.p]}"/>`;
    }
    if (S.set.owners) s += ownersLayer(st, under);
    // a finished city, road or monastery lights up in its owner's colour, once (the move that finished it)
    if (st.last && animatedAt !== st.moves && incomingAt !== st.moves) s += flashes(st);
    s += men;
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
        const extra = !f ? '' : sel.fig ? RD.figure(sel.fig, st.turn, f.spot[0], f.spot[1], ms * 1.1) : RD.meeple(st.turn, f.spot[0], f.spot[1], f.type === 'field', sel.big ? ms * 1.375 : ms);
        const turn = spinFrom('ghost', sel.x + ',' + sel.y, sel.r);
        // held just above its square: a bigger, softer shadow than the laid tiles
        s += `<rect x="${sel.x * 100 + 7}" y="${sel.y * 100 + 12}" width="100" height="100" rx="3" fill="#000" opacity=".3"/>`;
        s += `<g class="ghost${turn ? ' spin' : ''}" style="--from:${turn}deg">${RD.tile(st.cur, sel.r, sel.x * 100, sel.y * 100, 100, extra)}</g>`;
        s += `<rect class="ghost-ring" x="${sel.x * 100}" y="${sel.y * 100}" width="100" height="100" rx="3"/>`;
      } else spinFrom('ghost', '', 0);
      if (showBest && !(sel && sel.x === showBest.x && sel.y === showBest.y)) s += `<rect class="best-ring" x="${showBest.x * 100 - 4}" y="${showBest.y * 100 - 4}" width="108" height="108" rx="6"/>`;
    }
    // The new board starts where the old one is right now (even mid-glide), so redraws never jump.
    const old = $('world'), from = old ? getComputedStyle(old).transform : '';
    svg.innerHTML = `<g id="world"${from && from !== 'none' ? ` style="transform:${from}"` : ''}>${s}</g>`;
    animatedAt = st.moves;
    applyView();
  }

  // The finished features of the last move, outlined tile by tile in the scorer's colour (CSS fades them in and out).
  function flashes(st) {
    let s = '';
    for (const e of (st.last && st.last.ev) || []) {
      if (e.kind === 'farm') continue;
      const col = RD.PLAYER[e.who[0]] === '#2a2d36' ? '#e8eaf0' : RD.PLAYER[e.who[0]];
      for (const k of e.where) { const [x, y] = k.split(',').map(Number); s += `<rect class="done-flash" x="${x * 100 + 4}" y="${y * 100 + 4}" width="92" height="92" rx="4" stroke="${col}"/>`; }
    }
    return s;
  }
  // The Owners view: the map dimmed, every claimed city, road, monastery and field tinted in the colour of
  // whoever holds it (a tie: stripes of both). Unclaimed land stays dim.
  function ownersLayer(st, under) {
    let defs = '', body = '';
    const masks = new Set(), pats = new Set();
    const paint = (w) => {
      if (w.length === 1) return RD.PLAYER[w[0]];
      const id = 'own-p' + w.join('');
      if (!pats.has(id)) {
        pats.add(id);
        const k = 14 / w.length;
        defs += `<pattern id="${id}" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">${w.map((p, i) => `<rect x="${i * k}" width="${k}" height="14" fill="${RD.PLAYER[p]}"/>`).join('')}</pattern>`;
      }
      return `url(#${id})`;
    };
    for (const key in st.board) {
      const tl = st.board[key], [x, y] = key.split(',').map(Number), R = T.TYPES[tl.t].rot[tl.r];
      let one = '';
      R.feats.forEach((f, fi) => {
        if (f.type === 'river') return;
        const w = E.winners(st.groups[E.find(st, tl.g[fi])].m);
        if (!w.length) return;
        if (f.type === 'field' && !masks.has(tl.t)) { masks.add(tl.t); defs += RD.ownMask(tl.t); }
        one += RD.ownShape(tl.t, tl.r, fi, paint(w));
      });
      if (one) body += `<g transform="translate(${x * 100} ${y * 100})">${one}</g>`;
    }
    return `<g class="owners" pointer-events="none"><defs>${defs}</defs><path d="${under}" fill="#0f1117" opacity=".42"/>${body}</g>`;
  }

  // The one seat at this device (single player or online); -1 when several people share the phone.
  function meSeat() {
    const g = S.game;
    if (!g) return -1;
    const you = g.seats.map((k, i) => (k === 'you' ? i : -1)).filter((i) => i >= 0);
    return you.length === 1 ? you[0] : -1;
  }
  // A player's meeples standing on the table: wooden pieces (css/table.css), the big one taller.
  // They stand in a small loose crowd (a back row and a front row in the gaps), like pieces
  // set down in front of a player, not lined up like a star rating.
  function supply(p, size) {
    const st = S.game.st, n = st.meeples[p], big = st.opts.ic ? st.big[p] : 0;
    const figs = st.fig ? (st.fig[p].b ? RD.figureSVG('b', p, Math.round(size * 1.35)) : '') + (st.fig[p].g ? RD.figureSVG('g', p, Math.round(size * 1.35)) : '') : '';
    if (!n && !big) return figs ? `<span class="figs">${figs}</span>` : '<span class="none">0</span>';
    const back = Math.ceil(n / 2), step = size * (size <= 10 ? 0.75 : 0.9), drop = size * 0.42, B = big ? Math.round(size * 1.4) : 0;
    const lead = B ? B * 0.8 : 0;
    const one = (sz, i, x, y, z) => {
      // each piece a little turned and nudged (seeded, so it never jiggles on redraw)
      const j = self.TABLE ? TABLE.jitter('m' + p, i, { rot: 9, off: 1 }) : { x: 0, y: 0, r: 0 };
      return `<span class="tbl-meeple" style="--piece:${RD.PLAYER[p]};--size:${sz}px;left:${(x + j.x / 2).toFixed(1)}px;top:${(y + j.y / 2).toFixed(1)}px;rotate:${j.r}deg;z-index:${z}"></span>`;
    };
    let out = '';
    for (let i = 0; i < n; i++) {
      const front = i >= back, k = front ? i - back : i;
      out += one(size, i, lead + k * step + (front ? step / 2 : 0), front ? drop : 0, front ? 2 : 1);
    }
    const h = Math.max(n > 1 ? drop + size : size, B);
    if (B) out += one(B, 9, 0, h - B, 3);
    const w = lead + Math.max(back * step, (n - back) * step + step / 2) + (size - step);
    return `<span class="crowd" style="width:${Math.ceil(w)}px;height:${Math.ceil(h)}px">${out}</span>` + (figs ? `<span class="figs">${figs}</span>` : '');
  }
  function renderPlayers() {
    const g = S.game, st = g.st, me = meSeat(), wide = window.innerWidth >= 900;
    $('players').classList.toggle('many', g.seats.length >= 4);   // phone: colour + score only (names cut to "Y..")
    $('players').dataset.n = g.seats.length;   // (phone on its side: plates in rows of 2 or 3)
    // Far side of the table: everyone's score plate; the others' meeples stand under theirs (yours are at your edge).
    $('players').innerHTML = g.seats.map((k, i) => `
      <div class="pchip ${i === st.turn && !st.over ? 'turn' : ''}" data-seat="${i}" style="--pc:${RD.PLAYER[i]}">
        <div class="plate"><svg viewBox="0 0 20 20"><use href="#meeple" fill="${RD.PLAYER[i]}" stroke="${i === 4 ? '#c9ccd6' : 'rgba(0,0,0,.5)'}" stroke-width="1"/></svg>
        <span class="nm">${esc(seatName(i))}</span><span class="sc">${st.scores[i]}</span></div>
        <div class="sup" title="Meeples left">${i === me ? '' : supply(i, wide ? 14 : g.seats.length >= 5 ? 9 : 12)}</div>
      </div>`).join('');
    // Your meeples, standing in front of you (pass the phone: whoever's turn it is).
    const mine = me >= 0 ? me : g.seats[st.turn] === 'you' ? st.turn : -1;
    $('mine').innerHTML = mine >= 0 ? supply(mine, wide ? 17 : 14) : '';
    // The face-down tiles, in two stacks like on a real table (the badge counts both).
    const left = st.over ? 0 : st.bag.length, front = Math.ceil(left / 2);
    if (window.TABLE) {
      TABLE.deck($('deck2'), left - front, { pattern: 'lattice', cls: 'tile-back', perCard: 0.3, max: 9, badge: false });
      TABLE.deck($('deck'), front, { pattern: 'lattice', cls: 'tile-back', perCard: 0.3, max: 9, badge: false });
      if (left) $('deck').insertAdjacentHTML('beforeend', `<span class="tbl-badge">${left}</span>`);
    }
    $('deck').setAttribute('aria-label', `${left} tiles left`);
  }

  // The score track, 0-49 around the edge like the real board; each player's meeple stands
  // on their score (lying down with a 50 / 100 token past a lap). Laptop: the board with its
  // picture (16 x 11 squares). Phone: the same loop squeezed to a strip of 25 x 2 squares.
  const loop = (C, R) => {
    const out = [];
    for (let i = 0; i < C; i++) out.push([i, 0]);
    for (let j = 1; j < R; j++) out.push([C - 1, j]);
    for (let i = C - 2; i >= 0; i--) out.push([i, R - 1]);
    for (let j = R - 2; j >= 1; j--) out.push([0, j]);
    return out;   // 50 squares, 0 top-left, clockwise
  };
  const TRACKS = { track: { sq: loop(16, 11), W: 296, H: 206, pic: true }, ptrack: { sq: loop(25, 2), W: 458, H: 44, pic: false } };
  function renderTrack(id) {
    id = id || 'track';
    const g = S.game, st = g.st, el = $(id), Z = 18, TR = TRACKS[id], TRACK = TR.sq;
    if (!el) return;
    const key = g.seats.length + ':' + gen;
    if (el.dataset.key !== key) {
      el.dataset.key = key;
      const sq = TRACK.map(([i, j], n) => `<g transform="translate(${i * Z + 4} ${j * Z + 4})"><rect width="${Z - 1}" height="${Z - 1}" rx="2" fill="${n % 5 ? '#efe4c7' : '#e3cf9c'}" stroke="#8a6a3c" stroke-width=".8"/>` +
        `<text x="${(Z - 1) / 2}" y="${(Z - 1) / 2 + 0.5}" font-size="${n > 9 ? 7 : 8}" font-weight="700" fill="#6b4f2a" text-anchor="middle" dominant-baseline="central">${n}</text></g>`).join('');
      // the picture in the middle: a few of our own tiles, like the landscape on the real board
      // (a monastery road, the start tile, a straight, a crossing under a city, a bend)
      const pic = [['A', 3], ['D', 0], ['U', 1], ['L', 0], ['V', 0]];
      const art = TR.pic ? pic.map(([id2, r], c) => { const t = T.TYPES.find((q) => q.id === id2); return t ? RD.tile(t.idx, r, 33 + c * 46, 80, 46) : ''; }).join('') : '';
      const inner = TR.pic ? `<rect x="22" y="22" width="252" height="162" rx="3" fill="url(#grass)"/>${art}<rect x="22" y="22" width="252" height="162" rx="3" fill="url(#bevel)"/>` : '';
      el.innerHTML = `<svg viewBox="0 0 ${TR.W} ${TR.H}" aria-hidden="true">
        <rect x="1" y="1" width="${TR.W - 2}" height="${TR.H - 2}" rx="${TR.pic ? 6 : 4}" fill="#6f4b26" stroke="#3f2914" stroke-width="2"/>${inner}${sq}
        ${g.seats.map((_, p) => `<g class="tm" data-p="${p}"></g>`).join('')}</svg>`;
    }
    // where each player stands; players on the same square stand side by side
    const at = {};
    st.scores.forEach((v, p) => {
      const n = v % 50, laps = Math.floor(v / 50), [i, j] = TRACK[n];
      const k = at[n] = (at[n] || 0) + 1;
      const x = i * Z + 4 + 2 + (k - 1) % 3 * 4, y = j * Z + 4 - 4 + Math.floor((k - 1) / 3) * 5;
      const m = el.querySelector(`.tm[data-p="${p}"]`);
      if (!m) return;
      m.style.transform = `translate(${x}px, ${y}px)`;
      const tok = laps ? `<circle cx="7" cy="13" r="7" fill="#d8b46a" stroke="#3b2a12" stroke-width="1"/><text x="7" y="13.5" font-size="${laps > 1 ? 6 : 7}" font-weight="800" fill="#3b2a12" text-anchor="middle" dominant-baseline="central">${laps * 50}</text>` : '';
      const html = tok + `<ellipse cx="8" cy="18" rx="6" ry="1.8" fill="#000" opacity=".35"/><use href="#meeple" width="14" height="14" x="1" y="4" fill="${RD.PLAYER[p]}" stroke="rgba(255,255,255,.85)" stroke-width="1.2" paint-order="stroke"${laps ? ' transform="rotate(90 8 11)"' : ''}/>`;
      if (m.dataset.v !== String(v)) { m.dataset.v = v; m.innerHTML = html; }
    });
  }

  // ---------------------------------------------------------------- tiles moving like real ones
  let incomingAt = -1;   // move number of a tile still flying onto the board (hidden there until it lands)
  let handKey = null, dealing = false;
  // A ghost drawn at `to` that starts at `from` (size and place) and glides into place.
  function glide(html, from, to, ms) {
    const el = document.createElement('div');
    el.innerHTML = html;
    el.style.cssText = `position:fixed;left:${to.left}px;top:${to.top}px;width:${to.width}px;height:${to.height}px;pointer-events:none;z-index:30;transform-origin:0 0`;
    document.body.appendChild(el);
    const k = from.width / (to.width || 1);
    const a = el.animate([{ transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${k})` }, { transform: 'none' }],
      { duration: ms * speed(), easing: 'cubic-bezier(.3,.7,.3,1)' });
    return new Promise((res) => { const done = () => { el.remove(); res(); }; a.onfinish = done; a.oncancel = done; setTimeout(done, ms * speed() + 200); });
  }
  // The next tile comes off the face-down stack into the hand, then turns face up.
  function dealToHand() {
    const deck = $('deck').querySelector('.tbl-back'), hand = $('hand');
    if (!deck) return;
    const my = gen;
    dealing = true; hand.classList.add('await');
    const back = `<div class="tbl-card tbl-back tbl-lattice tbl-square tile-back" style="--card-w:${hand.offsetWidth}px;width:100%;height:100%"></div>`;
    glide(back, deck.getBoundingClientRect(), hand.getBoundingClientRect(), 380).then(() => {
      dealing = false;
      const h = $('hand');
      h.classList.remove('await');
      if (my !== gen) return;
      h.classList.add('flipin');
      setTimeout(() => h.classList.remove('flipin'), 400 * speed());
    });
  }
  // Someone else's tile goes from the middle of the table (the hand) onto its square.
  function flyToBoard(src, st) {
    if (!src || !st.last || incomingAt !== st.moves) return;
    const L = st.last, p0 = boardPoint(L.x * 100, L.y * 100), size = vs.s * 100;
    const my = gen;
    glide(RD.tileSVG(src.t, L.r).replace('<svg ', '<svg style="width:100%;height:100%;display:block;border-radius:3px;box-shadow:3px 6px 12px rgba(0,0,0,.5)" '),
      src.rect, { left: p0.x, top: p0.y, width: size, height: size }, 420).then(() => {
      if (incomingAt === st.moves) incomingAt = -1;
      if (my !== gen) return;
      // (the tile and, in its own layer, its meeple)
      for (const g of document.querySelectorAll('#world .incoming')) { g.classList.remove('incoming'); g.classList.add('placed'); }
      const w = $('world'), fl = flashes(st);
      if (w && fl && S.game && S.game.st === st) w.insertAdjacentHTML('beforeend', fl);
    });
  }
  // Before a move by someone not at this device: where their tile is now (the hand).
  function handSource(st) {
    const h = $('hand');
    if (!anims() || S.tab !== 'play' || st.cur < 0 || !h || h.classList.contains('empty')) return null;
    const r = h.getBoundingClientRect();
    return r.width ? { rect: r, t: st.cur } : null;
  }

  function renderHand() {
    const g = S.game, st = g.st, el = $('hand');
    if (st.over || st.cur < 0) { el.className = 'hand empty'; el.innerHTML = ''; handKey = null; return; }
    const key = gen + ':' + st.moves + ':' + st.cur, fresh = handKey !== null && handKey !== key;
    handKey = key;
    const theirs = !isHumanTurn() && !(g.online && g.seats[st.turn] === 'you');
    el.className = 'hand' + (dealing ? ' await' : '') + (theirs ? ' theirs' : '');
    el.style.setProperty('--who', RD.PLAYER[st.turn]);
    if (fresh && anims() && S.tab === 'play') dealToHand();
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
    if (sel && isHumanTurn() && st.fig) {
      // Traders & Builders: builder / pig circles (dashed) where you already hold the feature
      const fs = E.figSpots(st, sel.x, sel.y, sel.r);
      const R = T.TYPES[st.cur].rot[sel.r];
      for (const kind of ['b', 'g']) for (const fi of fs[kind]) {
        const [x, y] = R.feats[fi].spot, on = sel.fi === fi && sel.fig === kind;
        extra += `<g class="spot fig ${on ? 'on' : ''}" data-fi="${fi}" data-fig="${kind}" aria-label="${kind === 'b' ? 'Builder' : 'Pig'}"><circle cx="${x}" cy="${y}" r="15" fill="transparent"/>` +
          (on ? RD.figure(kind, st.turn, x, y, 30) : '') +
          `<circle class="halo" cx="${x}" cy="${y}" r="${on ? 14 : 8}"/><circle class="ring" cx="${x}" cy="${y}" r="${on ? 14 : 8}"/></g>`;
      }
    }
    el.innerHTML = RD.tileSVG(st.cur, r, extra);
    renderHeld();
    const turn = spinFrom('hand', st.moves + ':' + st.cur, r);
    if (turn) { const svg = el.firstChild; svg.style.setProperty('--from', turn + 'deg'); svg.classList.add('spin'); }
  }

  // Hand of tiles (house rule): your other held tiles beside the one in play; tap one to play it instead.
  function renderHeld() {
    const g = S.game, st = g.st, el = $('held');
    if (!el) return;
    const me = meSeat(), who = isHumanTurn() ? st.turn : me;
    const h = st.hands && who >= 0 && st.hands[who] && !st.over ? st.hands[who] : null;
    el.hidden = !h;
    $('hand').parentNode.classList.toggle('with-held', !!h);
    if (!h) { el.innerHTML = ''; return; }
    const rest = who === st.turn ? h.filter((t, i) => i !== h.indexOf(st.cur)) : h;
    const can = who === st.turn && isHumanTurn();
    el.innerHTML = rest.map((t) => `<button class="held-t" data-held="${t}" ${can ? '' : 'disabled'} aria-label="Play this tile instead">${RD.tileSVG(t, 0)}</button>`).join('');
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

  // A drawn tile that fits nowhere is set aside (rules); say so, or the stack just shrinks by two.
  function noteAside(prev, g) {
    const n = (g.st.discards || []).length - (prev.discards || []).length;
    if (n > 0) g.aside = { at: g.st.moves, n };
  }
  function asideText(g) {
    const a = g.aside;
    if (!a || a.at !== g.st.moves) return '';
    return a.n > 1 ? `${a.n} tiles fit nowhere: set aside.` : 'A tile fit nowhere: set aside.';
  }
  function noticeText(g) { return notice && notice.g === g && notice.at === g.st.moves ? notice.text : ''; }

  // End-of-game scoring (farms, unfinished features) goes into the log once.
  function logFinal(g) {
    if (!g.st.over || !g.st.final || g.loggedFinal) return;
    g.loggedFinal = true;
    for (const e of g.st.final) g.log.push({ ...e, end: true });
  }
  function describe(e) {
    const who = e.who.map((p) => seatName(p)).join(' + ');
    const what = { city: 'city', road: 'road', cloister: 'monastery', farm: 'farm', goods: 'most goods' }[e.kind];
    return `${who}: ${what} +${e.pts}${e.end ? ' (end)' : ''}`;
  }

  function goodsText(gd) {
    return gd.map((v, k) => (v ? `${v} ${RD.GOOD_NAME['wgc'[k]]}` : '')).filter(Boolean).join(', ');
  }
  function renderDock() {
    const g = S.game, st = g.st;
    if (tour && tutOn()) setTimeout(() => tour && tour.update(), 0);   // the guided game moves on at once, not on the coach's next check
    // (tiles left: the badge on the face-down stack)
    $('left').textContent = g.online && netSnap && netSnap.code ? `Room ${netSnap.code}` : '';
    const status = $('status'), sub = $('substatus');
    const human = isHumanTurn();
    $('play-btns').hidden = !!g.review;
    $('review-btns').hidden = !g.review;
    if (g.review) {
      const n = g.real.acts.length, L = st.last;
      status.textContent = g.k ? `Replay: tile ${g.k} of ${n}` : `Replay: the start (${n} tiles)`;
      const what = L && g.k ? (L.ev.length ? L.ev.map(describe).join(' · ') : `${seatName(L.p)} laid a tile${L.fi >= 0 ? ' and a meeple' : ''}`) : 'Tap Play or ▶ to step through the game.';
      sub.textContent = g.k === n && st.final ? 'End of game: farms and unfinished features scored.' : what;
      $('rv-prev').disabled = g.k <= 0; $('rv-next').disabled = g.k >= n;
      return;
    }
    const undoOk = canUndo();
    $('btn-undo').hidden = !undoOk && !(hasActs(g) && !g.daily && !g.tut && !g.st.over && g.seats.filter((k) => k === 'you').length === 1);
    $('btn-undo').disabled = !undoOk;
    $('btn-rotate').disabled = !human;
    $('btn-hint').disabled = !human;
    $('btn-place').disabled = !(human && sel);
    $('btn-place').textContent = sel && sel.fi >= 0 ? (sel.fig ? (sel.fig === 'b' ? 'Place + builder' : 'Place + pig') : sel.big ? 'Place + big meeple' : 'Place + meeple') : 'Place';
    if (st.over) {
      const top = Math.max(...st.scores);
      const w = st.scores.map((v, i) => (v === top ? seatName(i) : null)).filter(Boolean);
      status.textContent = w.length > 1 ? 'Tie: ' + w.join(' & ') : (w[0] === 'You' ? 'You win!' : w[0] + ' wins');
      sub.innerHTML = `<button class="btn small" id="btn-results">Results</button> <button class="btn small primary" id="btn-new2">New game</button>`;
      return;
    }
    let lastEv = st.last && st.last.ev.length ? st.last.ev.map(describe).join(' · ') : '';
    if (st.last && st.last.goods) lastEv = [lastEv, `${seatName(st.last.p)} took ${goodsText(st.last.goods)}`].filter(Boolean).join(' · ');
    const extra = [noticeText(g), asideText(g), st.bonus && st.last && st.last.bonus ? `Builder: ${seatName(st.turn) === 'You' ? 'you lay' : seatName(st.turn) + ' lays'} a second tile.` : ''].filter(Boolean).join(' ');
    if (!human) {
      status.textContent = g.online && g.seats[st.turn] === 'you' ? 'Sending…' : `${seatName(st.turn)} is placing…`;
      sub.textContent = [extra, lastEv].filter(Boolean).join(' · ');
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
      sub.innerHTML = extra ? esc(extra) + (h ? ' ' + h : '') : h;
    } else {
      // no circles on the tile: say why instead of asking for one
      const any = E.hasMeeple(st, st.turn, false) || E.hasMeeple(st, st.turn, true);
      const fs = st.fig ? E.figSpots(st, sel.x, sel.y, sel.r) : { b: [], g: [] };
      status.textContent = sel.fi >= 0 ? (sel.fig ? (sel.fig === 'b' ? 'Builder' : 'Pig') + ' set. Place it?' : 'Meeple set. Place it?')
        : E.meepleSpots(st, sel.x, sel.y, sel.r).length || fs.b.length || fs.g.length ? 'Tap a circle for a meeple'
        : any ? 'No meeple spot here. Place it?' : 'No meeples left. Place it?';
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
    const inGame = T.TYPES.filter((t) => t.set === 'base' || (t.set === 'ic' && st.opts.ic) || (t.set === 'tb' && st.opts.tb) || (t.set === 'river' && st.opts.river && !t.spring));
    h += `<div><h3>Still in the bag</h3><div class="bag">${inGame.map((t) =>
      `<div class="${left[t.idx] ? '' : 'z'}">${RD.tileSVG(t.idx, 0)}<span>${left[t.idx]}</span></div>`).join('')}</div></div>`;
    const recent = g.log.slice(-12).reverse();
    h += `<div><h3>Scoring</h3><ul class="log">${recent.length ? recent.map((e) => `<li>${esc(describe(e))}</li>`).join('') : '<li>Nothing scored yet</li>'}</ul></div>`;
    $('side-extra').innerHTML = h;
  }

  function renderPlay(refit) {
    if (!S.game) { newGame(); return; }
    renderPlayers();
    const own = $('zoom-own');
    own.classList.toggle('lit', !!S.set.owners); own.setAttribute('aria-pressed', String(!!S.set.owners));
    if (refit || !vs.user) { vs.user = false; fit(); } else clampView();
    renderBoard();
    renderHand();
    renderDock();
    if (window.innerWidth >= 900) { renderTrack(); renderSide(); } else renderTrack('ptrack');
  }

  function floatEvents(evs, gap) {
    const host = $('floaters');
    if (!anims()) return;   // Animations off: the scores just change
    const step = (gap || 0.25) * speed();
    evs.forEach((e, i) => {
      let sx = 0, sy = 0;
      for (const k of e.where) { const [x, y] = k.split(',').map(Number); sx += x; sy += y; }
      const cx = (sx / e.where.length + 0.5) * 100, cy = (sy / e.where.length + 0.5) * 100;
      const d = document.createElement('div');
      d.className = 'floater';
      d.style.left = vs.tx + vs.s * cx + 'px';
      d.style.top = vs.ty + vs.s * cy + 'px';
      d.style.color = RD.PLAYER[e.who[0]] === '#2a2d36' ? '#e8eaf0' : RD.PLAYER[e.who[0]];
      d.style.animationDelay = i * step + 's';
      d.textContent = '+' + e.pts;
      host.appendChild(d);
      setTimeout(() => d.remove(), (2200 + i * step * 1000) * speed());
    });
  }

  function showFinal() {
    const g = S.game;
    if (!g || g.review || !g.st.over || S.tab !== 'play') return;
    const st = g.st;
    const order = st.scores.map((v, i) => i).sort((a, b) => st.scores[b] - st.scores[a]);
    const rows = order.map((i) => `<tr><td><svg viewBox="0 0 20 20" style="width:16px;height:16px;vertical-align:-3px"><use href="#meeple" fill="${RD.PLAYER[i]}"/></svg> ${esc(seatName(i))}</td>
      <td>${st.bd[i].city}</td><td>${st.bd[i].road}</td><td>${st.bd[i].cloister}</td><td data-farm="${i}">${st.bd[i].farm}</td>${st.goods ? `<td>${st.bd[i].goods || 0}</td>` : ''}<td class="tot" data-tot="${i}">${st.scores[i]}</td></tr>`).join('');
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
      ${st.goods
        ? `<table><colgroup><col style="width:26%"><col style="width:12%"><col style="width:12%"><col style="width:14%"><col style="width:12%"><col style="width:12%"><col style="width:12%"></colgroup><tr><th></th><th>City</th><th>Road</th><th>Mon.</th><th>Farm</th><th>Goods</th><th>Total</th></tr>${rows}</table>
          <p class="muted">Goods taken (wine, grain, cloth): ${order.map((i) => `${esc(seatName(i))} ${st.goods[i].join('/')}`).join(' · ')}</p>`
        : `<table><colgroup><col style="width:28%"><col style="width:13%"><col style="width:13%"><col style="width:20%"><col style="width:13%"><col style="width:13%"></colgroup><tr><th></th><th>City</th><th>Road</th><th>Monastery</th><th>Farm</th><th>Total</th></tr>${rows}</table>`}
      <svg class="race" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><line x1="${(finalAt - 1) / n * (W - 10) + 5}" x2="${(finalAt - 1) / n * (W - 10) + 5}" y1="0" y2="${H}" stroke="#2a3042" stroke-dasharray="3 4"/>${lines}</svg>
      <p class="muted" style="margin-top:-4px">Score after each tile; the jump at the end is farms and unfinished features.</p>
      ${lost}
      ${statsLine(g)}
      <div class="acts"><button class="btn" data-close>Look at board</button>${hasActs(g) ? '<button class="btn" id="btn-replay">Replay</button>' : ''}<button class="btn primary" id="btn-new3">New game</button></div></div>`);
    if (!g.cheered) { g.cheered = true; save(); finalFx(g); }
  }
  // The first time the results show: farms and totals count up, then you win (or lose).
  function finalFx(g) {
    const F = fx(), st = g.st;
    if (!F) return;
    const pre = st.scores.slice();
    for (const e of st.final || []) for (const p of e.who) pre[p] -= e.pts;
    const counts = [];
    st.scores.forEach((v, p) => {
      const fe = document.querySelector(`[data-farm="${p}"]`), te = document.querySelector(`[data-tot="${p}"]`);
      if (fe && st.bd[p].farm) counts.push(F.countUp(fe, 0, st.bd[p].farm, { duration: 900 }));
      if (te && v !== pre[p]) counts.push(F.countUp(te, pre[p], v, { duration: 900 }));
    });
    const you = g.seats.map((k, i) => (k === 'you' ? i : -1)).filter((i) => i >= 0);
    if (!you.length) return;   // computers only: nobody here to cheer for
    const top = Math.max(...st.scores);
    const winners = st.scores.map((v, i) => (v === top ? i : -1)).filter((i) => i >= 0);
    const kind = winners.some((i) => you.includes(i)) ? 'win' : 'lose';
    const colors = winners.map((i) => (i === 4 ? '#c9ccd6' : RD.PLAYER[i])).concat(['#f0b354', '#e8eaf0', '#6ea8fe']);
    const my = gen;
    Promise.all(counts).then(() => { if (my === gen) F.celebrate({ kind, colors }); });
  }

  // ---------------------------------------------------------------- board input: tap, drag, pinch, wheel
  (function boardInput() {
    const svg = $('board');
    const pts = new Map();
    let start = null, moved = false, pinch = null, lastTap = null;
    svg.addEventListener('pointerdown', (e) => {
      try { svg.setPointerCapture(e.pointerId); } catch (err) { /* synthetic or already gone */ }
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) { start = { x: e.clientX, y: e.clientY, tx: vs.tx, ty: vs.ty }; moved = false; }
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, s: vs.s, tx: vs.tx, ty: vs.ty, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
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
        zoomAt(pinch.cx - rect.left, pinch.cy - rect.top, pinch.s * k, pinch);
        return;
      }
      if (!start || pts.size !== 1) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (!moved && Math.hypot(dx, dy) > 7) { moved = true; start = { x: e.clientX, y: e.clientY, tx: vs.tx, ty: vs.ty }; return; }
      // Auto mode: one finger never moves the board. Zoomed in: drag pans (clamped).
      if (moved && vs.user) { vs.tx = start.tx + e.clientX - start.x; vs.ty = start.ty + e.clientY - start.y; clampView(); applyView(true); }
    });
    function end(e) {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (pts.size === 1) { const [p] = [...pts.values()]; start = { x: p.x, y: p.y, tx: vs.tx, ty: vs.ty }; }
      if (pts.size === 0) {
        if (!moved && start) tap(e.clientX, e.clientY);
        start = null;
      }
    }
    // A tap picks a spot; a quick second tap away from any spot goes back to auto.
    function tap(cx, cy) {
      const now = Date.now();
      const twice = lastTap && now - lastTap.t < 350 && Math.hypot(cx - lastTap.x, cy - lastTap.y) < 30;
      if (twice && vs.user && !spotAt(cx, cy)) { lastTap = null; toAuto(); return; }
      lastTap = { t: now, x: cx, y: cy };
      tapAt(cx, cy);
    }
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
    svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      // Trackpad pinch arrives as ctrl+wheel with small steps; a mouse wheel as bigger ones.
      const k = Math.exp(-Math.max(-60, Math.min(60, e.deltaY)) * (e.ctrlKey ? 0.01 : 0.0025));
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, vs.s * k);
    }, { passive: false });
    function zoomAt(px, py, ns, from) {
      const f = from || vs;
      const wx = (px - f.tx) / f.s, wy = (py - f.ty) / f.s;
      ns = Math.min(maxZoom(), ns);
      vs.s = ns; vs.tx = px - wx * ns; vs.ty = py - wy * ns; vs.user = true; vs.focus = false;
      clampView(); applyView(true);
    }
    $('zoom-in').onclick = () => zoomStep(1.25);
    $('zoom-out').onclick = () => zoomStep(0.8);
    $('zoom-fit').onclick = toAuto;
    function zoomStep(k) {
      const px = svg.clientWidth / 2, py = svg.clientHeight / 2, wx = (px - vs.tx) / vs.s, wy = (py - vs.ty) / vs.s;
      vs.s = Math.min(maxZoom(), vs.s * k); vs.tx = px - wx * vs.s; vs.ty = py - wy * vs.s; vs.user = true; vs.focus = false;
      clampView(); applyView();
    }
    // The board area changes size (rotation, toolbar, panels): auto re-fits, manual stays in bounds.
    if (self.ResizeObserver) new ResizeObserver(() => {
      if (S.tab !== 'play' || !S.game || !svg.clientWidth) return;
      if (vs.user) clampView(); else fit();
      applyView();
    }).observe(svg);
  })();

  function spotAt(cx, cy) {
    const st = S.game && S.game.st;
    if (!st || st.over || !isHumanTurn()) return false;
    const rect = $('board').getBoundingClientRect();
    const x = Math.floor((cx - rect.left - vs.tx) / vs.s / 100), y = Math.floor((cy - rect.top - vs.ty) / vs.s / 100);
    return legalRots(x, y).length > 0;
  }

  function tapAt(cx, cy) {
    if (!isHumanTurn()) return;
    const rect = $('board').getBoundingClientRect();
    const wx = (cx - rect.left - vs.tx) / vs.s, wy = (cy - rect.top - vs.ty) / vs.s;
    const x = Math.floor(wx / 100), y = Math.floor(wy / 100);
    if (!legalRots(x, y).length) {   // a tile can't go there (in a tiny crowded map: look closer)
      if (focusOn(wx, wy)) applyView(); else sfx('error');
      return;
    }
    focusOn(x * 100 + 50, y * 100 + 50);
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
    sfx('cardSlide', { pitch: 0.6, vol: 0.6 });   // the tile slid onto the square
    renderBoard(); renderHand(); renderDock();
  }
  function rotateSel() {
    sfx('tileTurn');
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
        <div class="set-btns">${PF() ? `<button class="btn small pf-open" id="btn-stats">${Profile.avatarSVG(Profile.avatar, 20)}My stats</button><button class="btn small" id="btn-daily">${dailyDone() ? 'Daily ✓' : 'Daily game'}</button>` : ''}${self.COACH && self.CarcTutorial ? '<button class="btn small" id="btn-rules">Rules</button><button class="btn small" id="btn-tut">Guided game</button>' : ''}</div>
      </section>
      ${renderOnline()}
      <section class="card set-sec"><h3>Rules</h3>
        <div class="set-row"><span class="l">River <button class="q" data-help="river">?</button></span>${sw('river', s.river)}</div>
        <div class="set-row"><span class="l">Inns &amp; Cathedrals <button class="q" data-help="ic">?</button></span>${sw('ic', s.ic)}</div>
        <div class="set-row"><span class="l">Traders &amp; Builders <button class="q" data-help="tb">?</button></span>${sw('tb', s.tb)}</div>
        <div class="set-row"><span class="l">Farmers</span>${sw('farmers', s.farmers)}</div>
        <div class="set-row"><span class="l">Farm scoring <button class="q" data-help="farm">?</button></span>${seg('farm', [['3rd', 'Current'], ['1st', '1st edition']], s.farm)}</div>
        <div class="set-row"><span class="l">2-tile city <button class="q" data-help="small">?</button></span>${seg('smallCity', [[4, '4 points'], [2, '2 points']], s.smallCity)}</div>
        <h4 class="set-sub">House rules</h4>
        <div class="set-row"><span class="l">Hand of tiles <button class="q" data-help="hand">?</button></span>${seg('hand', [[1, 'Off'], [2, '2'], [3, '3']], s.river ? 1 : s.hand || 1)}</div>
        <p class="set-note">Farmers off is the usual beginners' house rule. A hand of tiles turns the River off.</p>
      </section>
      <section class="card set-sec"><h3>Sound &amp; effects</h3><div id="fx-box"></div></section>
      <section class="card set-sec"><h3>At the table</h3>
        <div class="set-row"><span class="l">Players</span>${seg('tplayers', [[2, '2'], [3, '3'], [4, '4'], [5, '5']], tb.names.length)}</div>
        ${tb.names.map((n, i) => `<div class="seat">${meepleIcon(i, 22)}<input data-name="${i}" value="${esc(n)}" maxlength="16" aria-label="Player ${i + 1} name"><button class="btn small ${i === tb.me ? 'warm' : 'ghost'}" data-me="${i}">${i === tb.me ? 'Me' : 'Is me'}</button></div>`).join('')}
        <div class="set-row"><span class="muted">First in the list draws first.</span><button class="btn small" id="btn-reset-table">New table game</button></div>
      </section>
      <section class="card set-sec"><h3>How strong? <button class="q" data-help="strength">?</button></h3>${STRENGTH}</section>
      <section class="set-sec"><a href="../" class="muted">← more board &amp; card games</a></section>`;
    if (fx()) fx().renderSettings($('fx-box'));
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
  // Run 2026-10-27 (after every level got farmers): 400 two-player games per pair, 200 four-player games.
  const STRENGTH = `<table class="str">
      <tr><th>Match</th><th>Wins</th><th>Avg points</th></tr>
      <tr><td>Hard vs Medium</td><td>79%</td><td>113 – 96</td></tr>
      <tr><td>Hard vs Easy</td><td>97%</td><td>111 – 68</td></tr>
      <tr><td>Medium vs Easy</td><td>96%</td><td>114 – 80</td></tr>
      <tr><td>Hard vs 3 Medium</td><td>63%</td><td>72 – 58</td></tr>
      <tr><td>Medium vs 3 Easy</td><td>63%</td><td>65 – 50</td></tr>
    </table>
    <p class="muted" style="margin:8px 0 0">Going first: Hard vs Hard, the first player wins 56.9% (400 games). With 4 players a fair share is 25%.</p>
    <p class="muted" style="margin:6px 0 0">Traders &amp; Builders (200 games a pair): Hard beats Medium 73%, Medium beats Easy 93%. Hand of 2 tiles: 83% and 94%.</p>`;

  // ================================================================ sheet + help popup
  // The results sheet and the "?" bubble each get a history step, so Back closes them first
  // (and only then goes to the tab you were on). Closing one by hand takes its step back out.
  let popSkip = false, afterPop = null;
  const overlayStep = () => { if (!(history.state && history.state.overlay)) history.pushState({ overlay: 1 }, '', location.hash); };
  function dropStep() { if (history.state && history.state.overlay) { popSkip = true; history.back(); } }
  function openSheet(html) { $('sheet').innerHTML = html; $('sheet-back').hidden = false; $('pop').hidden = true; overlayStep(); }
  function closeSheet(fromBack) {
    if ($('sheet-back').hidden) return;
    $('sheet-back').hidden = true; $('sheet').innerHTML = '';
    if (!fromBack) dropStep();
  }
  function hidePop(fromBack) {
    if ($('pop').hidden) return;
    $('pop').hidden = true;
    if (!fromBack && $('sheet-back').hidden) dropStep();
  }
  function showHelp(btn) {
    const pop = $('pop');
    if ($('sheet-back').hidden) overlayStep();
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
    if (popSkip && push !== false) { afterPop = t; return; }   // a closing bubble is still stepping back: go after it
    if (t === 'play' && S.tab !== 'play') vs.user = false;   // back on the board: auto fit
    if (t !== 'play' && S.game && S.game.review) endReview(true);
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
    if (!pop.hidden && !(b && b.dataset.help)) hidePop();
    if (e.target === $('sheet-back')) { closeSheet(); return; }
    if (!b) return;
    const d = b.dataset;
    if (d.help) { showHelp(b); return; }
    if (d.tab) { setTab(d.tab); return; }
    if (d.close !== undefined) { closeSheet(); return; }
    // ---- play
    if (b.closest('#hand') && d.fig) {
      if (!sel) return;
      const fi = +d.fi;
      if (sel.fi === fi && sel.fig === d.fig) { sel.fi = -1; sel.fig = null; sfx('tap'); }
      else { sel.fi = fi; sel.fig = d.fig; sel.big = false; sfx('meeple', { pitch: 0.7 }); }
      renderBoard(); renderHand(); renderDock(); return;
    }
    if (d.held !== undefined) {
      const g = S.game;
      if (!isHumanTurn() || !g.st.hands) return;
      E.pick(g.st, +d.held);
      sel = null; showBest = null; ranked = null; rankedAt = -1; handR = 0; handKey = null;
      sfx('tileDraw');
      save(); renderPlay(); return;
    }
    if (b.closest('#hand') && d.fi !== undefined) {
      if (!sel) return;
      const fi = +d.fi, st = S.game.st, p = st.turn;
      sel.fig = null;
      const small = E.hasMeeple(st, p, false), large = E.hasMeeple(st, p, true);
      if (sel.fi !== fi) { sel.fi = fi; sel.big = !small; }
      else if (!sel.big && large) sel.big = true;
      else { sel.fi = -1; sel.big = false; }
      if (sel.fi >= 0) sfx('meeple', { pitch: sel.big ? 0.8 : 1 }); else sfx('tap');
      renderBoard(); renderHand(); renderDock(); return;
    }
    if (b.id === 'btn-rotate') { rotateSel(); return; }
    if (b.id === 'btn-undo') { undo(); return; }
    if (b.id === 'btn-replay') { startReview(); return; }
    if (b.id === 'rv-prev') { reviewTo(S.game.k - 1); return; }
    if (b.id === 'rv-next') { reviewTo(S.game.k + 1); return; }
    if (b.id === 'rv-play') { togglePlay(); return; }
    if (b.id === 'rv-done') { endReview(); return; }
    if (b.id === 'zoom-own') { S.set.owners = !S.set.owners; save(); sfx('tap'); renderPlay(); return; }
    if (b.id === 'btn-stats' || b.id === 'btn-stats2') { openStats(); return; }
    if (b.id === 'btn-rules') { openRules(); return; }
    if (b.id === 'btn-place') {
      if (!sel || !isHumanTurn()) return;
      const a = { type: 'place', x: sel.x, y: sel.y, r: sel.r, fi: sel.fi, big: sel.fi >= 0 && !sel.fig && !!sel.big };
      if (sel.fi >= 0 && sel.fig) a.fig = sel.fig;
      if (S.game.st.hands) a.t = S.game.st.cur;
      submit(a); return;
    }
    if (b.id === 'btn-hint') {
      if (!isHumanTurn()) return;
      S.game.helped = true; save();   // a game with Hint counts as "with help"
      const best = getRanked()[0];
      sel = { x: best.x, y: best.y, r: best.r, fi: best.fi, big: !!best.big, fig: best.fig || null };
      showBest = { x: best.x, y: best.y };
      focusOn(best.x * 100 + 50, best.y * 100 + 50);
      sfx('cardSlide', { pitch: 0.6, vol: 0.6 });
      renderBoard(); renderHand(); renderDock(); return;
    }
    if (b.id === 'btn-new' || b.id === 'btn-daily' || b.id === 'btn-tut') {
      if (b.id === 'btn-daily' && dailyDone()) { openStats('daily'); return; }
      // a game under way (or an online room) isn't thrown away by one stray tap
      const real = S.game && S.game.review ? S.game.real : S.game;
      const live = real && !real.st.over && (real.st.moves > 0 || real.online);
      if (live && !b.classList.contains('armed')) {
        const was = b.innerHTML;
        b.classList.add('armed'); b.textContent = 'Start over?';
        setTimeout(() => { if (b.isConnected) { b.classList.remove('armed'); b.innerHTML = was; } }, 4000);
        return;
      }
      if (b.id === 'btn-tut') { startTutorial(); return; }
      setTab('play'); newGame(b.id === 'btn-daily' ? 'daily' : undefined); return;
    }
    if (b.id === 'btn-new2' || b.id === 'btn-new3') { newGame(); return; }
    if (b.id === 'btn-results') { showFinal(); return; }
    // ---- tiles
    if (d.t !== undefined) {
      const t = +d.t, rem = remainingCounts();
      if (!rem[t] || S.table.drawn.length >= BAG) { sfx('error'); if (fx()) fx().shake(b); return; }
      S.table.drawn.push(t); save(); renderTiles();
      sfx('tileDraw');
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
    if (d.who !== undefined) { const i = +d.who; tally.m[i] = (tally.m[i] + 1) % 8; renderScores(); return; }
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
      save(); renderScores();
      sfx(pts >= 10 ? 'coins' : 'coin');
      const F = fx(), rows = document.querySelectorAll('#sc-list .sc-row');
      if (F) for (const i of who) if (rows[i]) { F.countUp(rows[i].querySelector('.pts'), S.table.scores[i] - pts, S.table.scores[i]); F.pop(rows[i].querySelector('.pts')); }
      return;
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
      else if (sg === 'hand') { S.set.hand = +v; if (+v > 1) S.set.river = false; }
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
      if (d.sw === 'river' && S.set.river) S.set.hand = 1;   // the river is one stack: no hands
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
    if (popSkip) { popSkip = false; const t = afterPop; afterPop = null; if (t) setTab(t); return; }
    // Back with the rules sheet or My stats open: close it and stay put
    const kitOpen = (self.COACH && COACH.rulesOpen()) || (self.Profile && Profile.isOpen && Profile.isOpen());
    if (kitOpen) {
      try { if (COACH.rulesOpen()) COACH.closeRules(); if (Profile.isOpen()) Profile.closePanel(); } catch (err) { /* never stops the game */ }
      history.pushState(null, '', '#' + S.tab);
      return;
    }
    const t = (location.hash || '#play').slice(1);
    // Back with the results sheet or a "?" bubble open: close it and stay put
    if (!$('sheet-back').hidden || !$('pop').hidden) { closeSheet(true); hidePop(true); return; }
    if (['play', 'tiles', 'scores', 'settings'].includes(t)) setTab(t, false);
  });
  // Two tabs of the same game: a tab that sees the other one save takes its game, so
  // neither wipes the other's moves. Only the tab that moved last (or was touched) runs the computers.
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY || !e.newValue || (S.game && S.game.online)) return;
    if (S.game && S.game.review) endReview(true);
    let n;
    try { n = JSON.parse(e.newValue); } catch (err) { return; }
    if (!n || typeof n !== 'object') return;
    S.set = Object.assign(S.set, n.set); S.table = Object.assign(S.table, n.table);
    if (JSON.stringify(n.game || null) === JSON.stringify(S.game)) { if (S.tab !== 'play') render(); return; }
    S.game = n.game || null;
    leader = false;
    gen++; sel = null; ranked = null; rankedAt = -1; study = null; showBest = null; incomingAt = -1; handKey = null;
    if (!S.game) return;
    render();
    tick();
  });
  const lead = () => { if (leader) return; leader = true; if (S.game && !S.game.st.over && !isHumanTurn()) tick(); };
  document.addEventListener('pointerdown', lead, true);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) lead(); });
  window.addEventListener('resize', () => { if (S.tab === 'play' && S.game) { if (!vs.user) fit(); renderPlay(); } });

  // ---------------------------------------------------------------- boot
  $('defs-host').innerHTML = RD.DEFS;
  // My stats, achievements and the Daily game (optional: the game runs without them)
  if (self.Profile && self.CarcProfile) {
    try {
      Profile.init({
        game: 'carcassonne', levels: CarcProfile.LEVELS, achievements: CarcProfile.achievements(),
        modes: { help: { name: 'Computers, with help' }, friends: { name: 'Pass the phone' }, online: { name: 'Online' } },
        daily: { title: 'Daily game', onPlay: () => { Profile.closePanel(); setTab('play'); newGame('daily'); } },
        draws: true,
        onChange: (what) => { if (S.tab === 'settings' && (what === 'me' || what === 'import' || what === 'result' || what === 'reset')) renderSettings(); },
      });
      pfReady = true;
    } catch (e) { pfReady = false; }
  }
  // The guided first game: the coach follows the game's own state and steps aside on other tabs and under sheets.
  if (self.COACH && self.CarcTutorial) {
    tour = COACH.tour({
      id: CarcTutorial.ID,
      steps: CarcTutorial.steps({ game: () => (tutOn() ? S.game : null), sel: () => (tutOn() ? sel : null) }),
      pauseIf: () => S.tab !== 'play' || !tutOn() || !$('sheet-back').hidden || (self.Profile && Profile.isOpen && Profile.isOpen()),
    });
  }
  // A new version of the site reloads itself only at a quiet moment (js/pwa.js): no room, nothing open,
  // not typing, no computer about to move, and the game over, not started, or out of sight on another tab.
  if (self.PWA) PWA.safeToReload = () => {
    if (inRoom() || (S.game && S.game.online) || !$('sheet-back').hidden || !$('pop').hidden) return false;
    if (self.Profile && Profile.isOpen && Profile.isOpen()) return false;
    if (self.COACH && (COACH.rulesOpen() || tutOn())) return false;
    const a = document.activeElement;
    if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) return false;
    const g = S.game;
    if (!g || g.review || g.st.over || g.st.moves === 0) return !(g && g.review);
    return S.tab !== 'play' && isHumanTurn();
  };
  const startTab = (location.hash || '').slice(1);
  if (['play', 'tiles', 'scores', 'settings'].includes(startTab)) S.tab = startTab;
  history.replaceState(null, '', '#' + S.tab);
  setTab(S.tab, false);
  if (S.game && !S.game.st.over) tick();
  if (tour && tutOn() && !S.game.st.over) tour.resume();   // carry on the guided game after a reload
  // First visit: offer the guided game once.
  if (firstVisit && tour && !tour.seen() && !COACH.offered(CarcTutorial.ID)) {
    COACH.offer({ id: CarcTutorial.ID, title: 'New to Carcassonne?', text: 'Play one guided game against an easy computer.', yes: 'Show me', no: 'No thanks', onYes: () => startTutorial() });
  }
  // Back into an online room after a reload (only if this browser was in one).
  function tryResume() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem('online.carcassonne')); } catch (e) { saved = null; }
    if (saved && saved.code && getNet()) net.resume();
  }
  if (self.CarcNet) tryResume(); else window.addEventListener('carcnet', tryResume, { once: true });
  self.CarcApp = { get state() { return S; }, get net() { return netSnap; }, get sel() { return sel; }, newGame, submit, pickCell, undo, startReview, reviewTo, endReview, isHumanTurn, replayTo };
})();
