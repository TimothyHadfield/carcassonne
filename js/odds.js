/* Draw odds for the real-table companion.
 *
 * The bag is shuffled, so the tiles you will draw are a random handful of the
 * tiles left: if you have m draws left out of N tiles and K of them would fit
 * your hole, the chance you get none is C(N-K, m) / C(N, m). Other players'
 * draws in between don't change that (they're just other random positions).
 */
(function () {
  'use strict';

  // P(no "good" tile among m draws from N tiles holding K good ones).
  function pNone(N, K, m) {
    if (m <= 0 || K <= 0) return 1;
    if (m > N - K) return 0;
    let p = 1;
    for (let i = 0; i < m; i++) p *= (N - K - i) / (N - i);
    return p;
  }
  function pAtLeastOne(N, K, m) { return 1 - pNone(N, K, m); }

  // How many of the remaining draws are mine. `drawn` = tiles already drawn
  // (start tile not counted), players draw in turn starting with seat 0.
  function myDraws(total, drawn, players, seat) {
    let m = 0, next = -1;
    for (let j = drawn; j < total; j++) if (j % players === seat) { m++; if (next < 0) next = j - drawn; }
    return { m, untilNext: next };
  }

  const api = { pNone, pAtLeastOne, myDraws };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else self.CarcOdds = api;
})();
