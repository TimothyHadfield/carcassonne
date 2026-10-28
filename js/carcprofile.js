// Carcassonne's part of the player profile (shared kit: js/profile.js, never edit that one here):
// the computer levels' ratings, the achievement list and turning a finished game into a result.
(function (root) {
  'use strict';
  // Elo of each level from the measured one-on-one games (tools/sim.js, 400 games each, 2026-10-27):
  // Hard beats Medium 78.5% (+225). Medium beats Easy 95.5% (+530, capped at +400). Easy anchored at 1000.
  const LEVELS = [
    { id: 'easy', name: 'Easy', rating: 1000 },
    { id: 'medium', name: 'Medium', rating: 1400 },
    { id: 'hard', name: 'Hard', rating: 1625 },
  ];
  const RANK = { easy: 0, medium: 1, hard: 2 };
  const won = (c) => !!(c.last && c.last.won);
  const ex = (c) => (c.last && c.last.extra) || {};
  const achievements = () => [
    { id: 'first', title: 'First win', desc: 'Win a game', test: (c) => c.stats.wins >= 1 },
    { id: 'medium', title: 'Builder', desc: 'Beat Medium', test: (c) => won(c) && RANK[c.last.level] >= 1 },
    { id: 'hard', title: 'Master builder', desc: 'Beat Hard', test: (c) => won(c) && c.last.level === 'hard' },
    { id: 'crowd', title: 'Full table', desc: 'Win against 4 computers', test: (c) => won(c) && ex(c).players >= 5 },
    { id: 'city', title: 'Cathedral town', desc: 'Finish a city worth 20 or more', test: (c) => ex(c).city >= 20 },
    { id: 'road', title: 'Long road', desc: 'Finish a road worth 8 or more', test: (c) => ex(c).road >= 8 },
    { id: 'monks', title: 'Abbot', desc: 'Finish 3 monasteries in one game', test: (c) => ex(c).monks >= 3 },
    { id: 'farm', title: 'Farmer', desc: 'Score 15 or more from farms in one game', test: (c) => ex(c).farm >= 15 },
    { id: 'hundred', title: 'Hundred', desc: 'Score 100 points in a game', test: (c) => ex(c).score >= 100 },
    { id: 'streak', title: 'Hat trick', desc: 'Win 3 in a row', test: (c) => c.stats.bestStreak >= 3 },
    { id: 'daily', title: 'Daily player', desc: '3-day Daily streak', test: (c) => c.daily.streak >= 3 },
  ];

  // What `me` did this game, from the scoring log ({kind, who, pts, end}).
  function extra(st, me, log, seats) {
    const o = { players: seats.length, score: st.scores[me] || 0, farm: (st.bd[me] && st.bd[me].farm) || 0, city: 0, road: 0, monks: 0 };
    for (const e of log || []) {
      if (e.end || !e.who || !e.who.includes(me)) continue;
      if (e.kind === 'city') o.city = Math.max(o.city, e.pts);
      if (e.kind === 'road') o.road = Math.max(o.road, e.pts);
      if (e.kind === 'cloister') o.monks++;
    }
    return o;
  }

  // A game (finished, or quit after your first move = a loss) -> Profile.recordResult input.
  // helped: Hint, hint numbers, study mode or Undo was used -> "with help", not rated.
  // Only one person against computers counts against a level; more people at this phone = pass and play.
  function result(g, me, opts) {
    opts = opts || {};
    const st = g.st, seats = g.seats;
    const x = extra(st, me, g.log, seats);
    const top = Math.max(...st.scores);
    const best = st.scores.map((v, i) => (v === top ? i : -1)).filter((i) => i >= 0);
    const finished = !!st.over;
    const iWon = finished && best.length === 1 && best[0] === me;
    const draw = finished && best.length > 1 && best.includes(me);
    if (opts.online) return { mode: 'online', won: iWon, draw, score: x.score, extra: x };
    if (seats.filter((k) => k === 'you').length > 1) return { mode: 'friends', won: null, score: x.score, extra: x };
    const levels = seats.filter((k, i) => i !== me && RANK[k] != null);
    const level = levels.length ? levels.reduce((a, b) => (RANK[b] > RANK[a] ? b : a)) : null;   // the strongest computer at the table
    const mode = opts.helped ? 'help' : 'computer';
    return { mode, level: mode === 'computer' ? level : null, won: iWon, draw, score: x.score, daily: !!opts.daily, extra: x };
  }

  const api = { LEVELS, achievements, result, extra };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CarcProfile = api;
})(typeof window !== 'undefined' ? window : globalThis);
