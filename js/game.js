/* Carcassonne for the shared online module (js/online.js, see
 * "Board and Card Games/_online/README.md"). Pure functions around the engine.
 *
 * Nothing in Carcassonne is secret except the order of the bag, so the public
 * view is the whole state with the bag sorted, and the private view is empty.
 * options: { farmers, farm, smallCity, river, ic, levels: ['hard', ...] per seat }.
 */
(function () {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const E = node ? require('./engine.js') : self.CarcEngine;
  const AI = node ? require('./ai.js') : self.CarcAI;

  const game = {
    id: 'carcassonne',
    minSeats: 2,
    maxSeats: 6,
    setup(n, options, rng, seats) {
      const o = options || {};
      const st = E.newGame({
        players: n,
        farmers: o.farmers !== false,
        farm: o.farm === '1st' ? '1st' : '3rd',
        smallCity: o.smallCity === 2 ? 2 : 4,
        river: !!o.river,
        ic: !!o.ic && n <= 6,
        seed: Math.floor((rng || Math.random)() * 2 ** 31),
      });
      st.opts.levels = Array.from({ length: n }, (_, i) => (o.levels && o.levels[i]) || 'hard');
      st.names = (seats || []).map((s, i) => (s && s.name) || 'Player ' + (i + 1));
      return st;
    },
    toAct(st) { return st.over ? [] : [st.turn]; },
    apply(st, seat, action) {
      if (seat !== st.turn) throw new Error('not your turn');
      return E.applyMut(st, action);
    },
    publicView(st) { return E.view(st); },
    privateView() { return {}; },
    // Plays from the public view only: the bag order is not peeked at.
    bot(ctx, seat, rng) {
      const pub = ctx.pub;
      const level = (pub.opts.levels && pub.opts.levels[seat]) || 'hard';
      return AI.choose(pub, level, rng);
    },
    isOver(st) { return !!st.over; },
  };

  if (node) module.exports = game;
  else self.CarcGame = game;
})();
