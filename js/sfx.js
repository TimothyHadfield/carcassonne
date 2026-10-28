/* Carcassonne sounds on top of the shared js/fx.js (never edit fx.js here).
 * Defines the few tile/meeple sounds the shared palette lacks, and plan():
 * which sounds one finished move makes, in order, from the state before and
 * after it (so computer moves and other players' online moves sound the same).
 */
(function () {
  'use strict';
  const FX = self.FX;
  if (!FX) return;
  FX.init({
    game: 'carcassonne', accent: '#6ea8fe',
    // The dock buttons and the tiles grid make their own sounds.
    clickSelector: 'button:not(#btn-rotate):not(#btn-place):not(#btn-hint):not([data-t]):not([data-fi]), [role="button"]',
  });
  // A cardboard tile pulled out of a cloth bag: soft scrape, then a tick as it comes free.
  FX.define('tileDraw', (k) => { k.noise({ f: 900, f2: 1900, q: 0.8, dur: 0.2, a: 0.05, vol: 0.32 }); k.noise({ f: 2600, q: 2, dur: 0.03, vol: 0.18, at: 0.18 }); }, 'moves');
  // A quarter turn of the tile in your fingers.
  FX.define('tileTurn', (k) => { k.noise({ f: 1500, q: 1.6, dur: 0.06, vol: 0.28 }); k.tone({ f: 340, f2: 280, dur: 0.04, vol: 0.06, type: 'triangle' }); }, 'moves');
  // A small wooden meeple set down: a higher, lighter knock than a tile.
  FX.define('meeple', (k) => { k.tone({ f: 980, f2: 700, dur: 0.06, vol: 0.22 }); k.tone({ f: 2050, dur: 0.025, vol: 0.06, type: 'triangle' }); k.noise({ f: 3200, q: 1.5, dur: 0.02, vol: 0.14 }); }, 'moves');
  // A monastery finished: a low church bell.
  FX.define('bell', (k) => { k.tone({ f: 523, dur: 1.1, vol: 0.16 }); k.tone({ f: 1046, dur: 0.7, vol: 0.05 }); k.tone({ f: 1255, dur: 0.5, vol: 0.035 }); k.tone({ f: 1569, dur: 0.35, vol: 0.025 }); }, 'moves');

  const DONE = { city: 'coins', road: 'coin', cloister: 'bell', farm: 'coins' };
  const BIG_CITY = 20;   // a finished city worth this much gets the "big" sparkle

  // Returned meeples: on the board before, gone after (incl. one placed and scored at once).
  function returned(prev, next) {
    const out = [];
    for (const k in prev.board) {
      const a = prev.board[k], b = next.board[k];
      if (a.m && b && !b.m) out.push({ key: k, t: a.t, r: a.r, fi: a.m[1], p: a.m[0], big: !!a.m[2] });
    }
    const L = next.last;
    if (L && L.fi >= 0 && !L.fig) {
      const k = L.x + ',' + L.y, b = next.board[k];
      if (b && !b.m) out.push({ key: k, t: L.t, r: L.r, fi: L.fi, p: L.p, big: !!L.big });
    }
    return out;
  }

  // [{ at: ms, name, opts }] for one move: tile down, meeple, scoring, meeples home, next tile drawn.
  function plan(prev, next, mine) {
    const L = next.last, out = [];
    if (!L) return out;
    const vol = mine ? 1 : 0.85;   // the computers are never louder than you
    out.push({ at: 0, name: 'place', opts: { vol } });
    if (L.fi >= 0) out.push({ at: 110, name: 'meeple', opts: { vol, pitch: L.big ? 0.8 : 1 } });
    L.ev.forEach((e, i) => out.push({ at: 300 + i * 250, name: DONE[e.kind] || 'coin', opts: { vol } }));
    const back = returned(prev, next);
    if (back.length) out.push({ at: 300 + L.ev.length * 250 + 250, name: 'pop', opts: { vol: 0.7, pitch: 0.75 } });
    if (next.over) {
      if (next.final && next.final.length) out.push({ at: 400, name: 'drumroll', opts: {} });
    } else if (next.cur >= 0) out.push({ at: Math.max(450, 300 + L.ev.length * 250), name: 'tileDraw', opts: { vol: 0.8 } });
    return out;
  }
  const bigCity = (ev) => ev.kind === 'city' && ev.pts >= BIG_CITY;

  self.CarcSfx = { plan, returned, bigCity, BIG_CITY, DONE };
})();
