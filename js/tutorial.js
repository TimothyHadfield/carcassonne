// The rules sheet and the guided first game (shared kit: js/coach.js, never edit that one here).
// Rules are in our own words, written from what the engine plays (docs/rules-check.md).
(function (root) {
  'use strict';
  // The guided game: you against one Easy computer, standard rules. This bag deals you a city
  // cap first, which closes the start tile's city for 4 points straight away.
  const SEED = 20261046;
  const ID = 'carc-first';

  function rules() {
    return {
      title: 'Carcassonne rules',
      intro: 'The standard rules (current edition). The River, Inns & Cathedrals, Traders & Builders, first-edition farms, the old 2-tile city and house rules are in Settings → Rules.',
      foot: 'Fan-made; not affiliated with the game\'s publisher.',
      sections: [
        { id: 'goal', title: 'Goal', short: 'Goal', html: '<p>Build a landscape of cities, roads, monasteries and fields one tile at a time, and score the most points by claiming them with your meeples.</p><p class="tip">Points come mostly from finished cities and, at the end, from farms.</p>' },
        { id: 'setup', title: 'Setup', short: 'Setup', html: '<ul><li>2 to 5 players (6 with Inns &amp; Cathedrals). Everyone has 7 meeples.</li><li>The start tile goes face up in the middle; the other 71 tiles are shuffled face down.</li></ul>' },
        { id: 'turn', title: 'Your turn', short: 'Turn', html: '<ol><li><b>Draw</b> a tile and <b>lay it</b> next to the map. Every side must match its neighbours: city to city, road to road, field to field.</li><li>You may put <b>one meeple</b> on that tile, on a city, road, monastery or field, but only if nobody already has a meeple on the whole feature it joins.</li><li><b>Score</b> anything the tile finished. Meeples on it come home.</li></ol><p class="tip">A tile that fits nowhere is set aside and you draw another.</p>' },
        { id: 'score', title: 'Scoring', short: 'Score', html: '<table><tr><th></th><th>Finished</th><th>At the end</th></tr><tr><td>City</td><td>2 per tile + 2 per shield</td><td>1 per tile + 1 per shield</td></tr><tr><td>Road</td><td>1 per tile</td><td>1 per tile</td></tr><tr><td>Monastery</td><td>9 (with all 8 tiles round it)</td><td>1 + 1 per tile round it</td></tr></table><p>Most meeples on a feature takes the points; a tie scores for everyone tied.</p>' },
        { id: 'share', title: 'Sharing', short: 'Share', html: '<p>You can\'t put a meeple straight onto a feature someone holds, but two separate cities or roads can be joined later by a tile. Then both sides own it, and whoever has more meeples there wins it.</p>' },
        { id: 'farms', title: 'Farmers', short: 'Farms', html: '<ul><li>A meeple on a field lies down: a farmer. It stays until the end of the game.</li><li>At the end, each farm scores <b>3 for every finished city</b> it touches, for whoever has the most farmers in it.</li><li>Roads and cities split fields apart.</li></ul><p class="tip">The Owners button on the map tints every claimed city, road and field in its owner\'s colour.</p>' },
        { id: 'end', title: 'The end', short: 'End', html: '<p>When the last tile is laid, unfinished cities, roads and monasteries score their end-of-game value, then farms score. Most points wins.</p>' },
        { id: 'tb', title: 'Traders & Builders', short: 'T&B', html: '<p>Settings → Rules. 24 more tiles, plus a builder and a pig for each player.</p><ul><li><b>Goods:</b> 20 city spots show wine, grain or cloth. Whoever lays the tile that <b>finishes</b> a city takes its goods, even with no meeple there. At the end the most of each kind scores <b>10</b> (a tie: all 10).</li><li><b>Builder:</b> instead of a meeple, put it on a road or city where you already have a meeple. Each later turn you extend that road or city, lay a <b>second tile</b> straight away (never a third). It comes home when the feature is finished.</li><li><b>Pig:</b> instead of a meeple, put it on a field where you have a farmer. If you win that farm, it scores <b>4</b> per finished city instead of 3.</li></ul><p class="tip">Builder and pig spots show as dashed circles on your tile.</p>' },
        { id: 'house', title: 'House rules', short: 'House', html: '<ul><li><b>Farmers off</b>: no meeples on fields. The usual way to teach a first game.</li><li><b>Hand of tiles</b> (2 or 3): everyone holds that many tiles; on your turn pick one, lay it, draw one back. More planning, less luck. The game ends when every tile is laid.</li></ul>' },
        { id: 'learn', title: 'Learn more: videos', short: 'Videos', html: '<ul class="vids"><li><a href="https://www.youtube.com/watch?v=R1qh-lhxy9s" target="_blank" rel="noopener">Carcassonne - How To Play</a><br><span>Watch It Played: the full rules, step by step</span></li><li><a href="https://www.youtube.com/watch?v=040LA3Zt_8c" target="_blank" rel="noopener">How farmers work in Carcassonne</a><br><span>The Dark Imp: fields and farm scoring</span></li><li><a href="https://www.youtube.com/watch?v=uoSNY8BLKA0" target="_blank" rel="noopener">Carcassonne Strategy – Stop Finishing Everything Too Early</a><br><span>Rules in Minutes: strategy</span></li><li><a href="https://www.youtube.com/watch?v=ScZ2HqXoIqM" target="_blank" rel="noopener">How To Count Tiles In Carcassonne</a><br><span>Alexey&#39;s Carcassonne Channel: what the Tiles tab does for you</span></li><li><a href="https://www.youtube.com/watch?v=khbUGAd4h-4" target="_blank" rel="noopener">Carcassonne Expansions: River, Inns &amp; Cathedrals, Traders &amp; Builders: How to Play and Tips</a><br><span>Games Made Easy: the three expansions on this site</span></li></ul><p class="tip">They open on YouTube in a new tab.</p>' },
      ],
    };
  }

  // ctx: { game: () => the guided game (or null), sel: () => the square picked (or null) }
  function steps(ctx) {
    const G = () => ctx.game();
    const mine = () => { const g = G(); return !!g && !g.st.over && g.seats[g.st.turn] === 'you'; };
    const moved = () => { const g = G(); return !!g && g.st.moves >= 1; };
    return [
      { title: 'Your first game', text: 'You against an easy computer. This is your tile. Every turn you lay one tile next to the map.', target: '#hand' },
      { title: 'Lay it', text: 'Lit squares are where it fits. Tap the one above the start tile: your city cap closes its city.', target: '#board-wrap', skipIf: moved, until: () => !!ctx.sel() || moved() },
      { title: 'Turn it', text: 'Tap the tile again (or Rotate) to try another way round. Sides must match: city to city, road to road.', target: '#btn-rotate', skipIf: moved, next: true },
      { title: 'Claim it', text: 'The circles on your tile are spots for a meeple. Tap the one in the city: a knight.', target: '#hand', skipIf: moved, until: () => { const s = ctx.sel(); return (s && s.fi >= 0) || moved(); }, next: true },
      { title: 'Place', text: 'Tap Place. A city closed on both sides is finished: it scores at once and your meeple comes home.', target: '#btn-place', skipIf: moved, until: moved },
      { title: 'Scores', text: '2 points per tile for a finished city. Your score plate and the track show it.', target: '#players', when: mine },
      { title: 'Farmers', text: 'A meeple on a field lies down as a farmer and stays to the end: then it scores 3 for each finished city its field touches.', target: '#board-wrap', when: mine },
      { title: 'Owners', text: 'This button tints every claimed city, road and field in its owner\'s colour. Tap it again to hide it.', target: '#zoom-own', when: mine },
      { title: 'Hint and Undo', text: 'Hint shows the best move; Undo takes back your last tile. A game with either counts as "with help" in My stats.', target: '#btn-hint, #btn-undo', when: mine },
      { title: 'That\'s it', text: 'Play on to the end. The full rules are in Settings whenever you need them.', target: () => (document.querySelector('#tabs [data-tab="settings"]')) },
    ];
  }

  root.CarcTutorial = { rules, steps, SEED, ID };
})(typeof window !== 'undefined' ? window : globalThis);
