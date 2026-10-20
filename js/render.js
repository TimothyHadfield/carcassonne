/* Tile and meeple pictures, drawn from the tile's features (js/tiles.js), so
 * the picture always matches the rules. Every tile is a 100 x 100 SVG group.
 * Original art: flat fields, walled cities with roofs, pale roads, a small
 * monastery, blue shields.
 */
(function () {
  'use strict';
  const T = self.CarcTiles;

  const COL = {
    field: '#7cab52', fieldDark: '#6a9946', city: '#d9a866', wall: '#7b5228', road: '#f2ead6', roadEdge: '#8d7c5c',
    roof: '#b4553d', monk: '#efe3c6', shield: '#2f62b8',
  };
  const PLAYER = ['#4f8ff7', '#f0c43c', '#e5534b', '#4fbf6a', '#2a2d36'];
  const PLAYER_NAME = ['Blue', 'Yellow', 'Red', 'Green', 'Black'];

  // Shared <defs>: put once in any SVG that draws tiles.
  const DEFS = `<defs>
    <pattern id="grass" width="14" height="14" patternUnits="userSpaceOnUse">
      <rect width="14" height="14" fill="${COL.field}"/>
      <path d="M3 9 l1.5 -3 M9 4 l1.2 -2.6 M10 12 l1.4 -3" stroke="${COL.fieldDark}" stroke-width="1.1" stroke-linecap="round"/>
    </pattern>
    <pattern id="roofs" width="16" height="12" patternUnits="userSpaceOnUse">
      <rect width="16" height="12" fill="${COL.city}"/>
      <path d="M2 9 l3 -3.5 l3 3.5 z M10 4 l3 -3.2 l3 3.2 z" fill="${COL.roof}" opacity=".55"/>
    </pattern>
    <symbol id="meeple" viewBox="0 0 20 20"><path d="M10 0.6c2.7 0 4.4 2 4.4 4.4 0 1.5-.6 2.6-1.5 3.4l5.4 2c2 .8 1.8 3.8-.4 3.6l-3.6-.7 1.9 5.9c.2.6-.2 1-.8 1h-3.6l-1.8-3.8-1.8 3.8H4.6c-.6 0-1-.4-.8-1l1.9-5.9-3.6.7c-2.2.2-2.4-2.8-.4-3.6l5.4-2C6.2 7.6 5.6 6.5 5.6 5 5.6 2.6 7.3.6 10 .6z"/></symbol>
  </defs>`;

  const MID = [[50, 0], [100, 50], [50, 100], [0, 50]];

  // City shape for a set of sides, in base orientation, as a path.
  function cityPath(sides) {
    const set = sides.slice().sort().join('');
    const shapes = {
      one: ['0', 'M0 0 H100 Q50 46 0 0 Z'],
      opp: ['02', 'M0 0 H100 Q62 50 100 100 H0 Q38 50 0 0 Z'],
      adj: ['03', 'M0 0 H100 C62 18 18 62 0 100 Z'],
      three: ['013', 'M0 0 H100 V100 Q50 54 0 100 Z'],
      four: ['0123', 'M0 0 H100 V100 H0 Z'],
    };
    for (const k in shapes) {
      const [canon, d] = shapes[k];
      for (let r = 0; r < 4; r++) {
        const rs = canon.split('').map((c) => (+c + r) % 4).sort().join('');
        if (rs === set) return `<path d="${d}" transform="rotate(${90 * r} 50 50)"/>`;
      }
    }
    return '';
  }

  function roadPath(sides, ends) {
    if (sides.length === 2) {
      const [a, b] = sides;
      const [x1, y1] = MID[a], [x2, y2] = MID[b];
      if ((a + 2) % 4 === b) return `M${x1} ${y1} L${x2} ${y2}`;
      const cx = 50 + 12 * Math.sign(x1 - 50 + x2 - 50), cy = 50 + 12 * Math.sign(y1 - 50 + y2 - 50);
      return `M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}`;
    }
    const [x1, y1] = MID[sides[0]];
    return `M${x1} ${y1} L50 50`;
  }

  // Inner drawing of a tile type in base orientation (no rotation).
  const cache = {};
  function tileBody(t) {
    if (cache[t]) return cache[t];
    const R = T.TYPES[t].rot[0];
    let s = `<rect width="100" height="100" fill="url(#grass)"/>`;
    const roads = R.feats.filter((f) => f.type === 'road');
    const ends = roads.filter((f) => f.sides.length === 1).length;
    for (const f of roads) {
      const d = roadPath(f.sides, ends);
      s += `<path d="${d}" stroke="${COL.roadEdge}" stroke-width="12" fill="none" stroke-linecap="butt"/>`;
      s += `<path d="${d}" stroke="${COL.road}" stroke-width="8" fill="none" stroke-linecap="butt"/>`;
    }
    if (ends >= 3) {
      s += `<rect x="40" y="40" width="20" height="20" rx="2" fill="${COL.monk}" stroke="${COL.wall}" stroke-width="2"/>`;
      s += `<path d="M38 42 L50 32 L62 42 Z" fill="${COL.roof}"/>`;
    }
    for (const f of R.feats.filter((q) => q.type === 'city')) {
      const p = cityPath(f.sides);
      s += `<g fill="url(#roofs)" stroke="${COL.wall}" stroke-width="3" stroke-linejoin="round">${p}</g>`;
      if (f.shield) {
        const [x, y] = f.spot;
        const sx = x + (x < 50 ? 13 : x > 50 ? -13 : 15), sy = y + (y < 50 ? 4 : y > 50 ? -16 : -18);
        s += `<path transform="translate(${sx - 7} ${sy})" d="M0 0 H14 V7 Q14 13 7 16 Q0 13 0 7 Z" fill="${COL.shield}" stroke="#fff" stroke-width="1.6"/>`;
        s += `<path transform="translate(${sx - 7} ${sy})" d="M3 5 L7 9 L11 5" stroke="#fff" stroke-width="1.6" fill="none"/>`;
      }
    }
    for (const f of R.feats.filter((q) => q.type === 'cloister')) {
      const [x, y] = f.spot;
      s += `<g transform="translate(${x - 16} ${y - 16})">
        <rect x="4" y="13" width="24" height="17" rx="1.5" fill="${COL.monk}" stroke="${COL.wall}" stroke-width="2"/>
        <path d="M1 15 L16 3 L31 15 Z" fill="${COL.roof}" stroke="${COL.wall}" stroke-width="1.6" stroke-linejoin="round"/>
        <rect x="13" y="20" width="6" height="10" rx="3" fill="${COL.wall}"/>
      </g>`;
    }
    s += `<rect x="0.5" y="0.5" width="99" height="99" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="1"/>`;
    return (cache[t] = s);
  }

  // A full tile group at (px,py) with size `size`, rotated r.
  function tile(t, r, px, py, size, extra) {
    const k = size / 100;
    return `<g transform="translate(${px} ${py}) scale(${k})"><g transform="rotate(${90 * r} 50 50)">${tileBody(t)}</g>${extra || ''}</g>`;
  }

  // A meeple standing on a feature spot (in 0..100 tile coords, already rotated).
  function meeple(p, x, y, lying, size) {
    const s = size || 22;
    const stroke = p === 4 ? '#c9ccd6' : 'rgba(0,0,0,.55)';
    const rot = lying ? ` rotate(90 ${x} ${y})` : '';
    return `<g transform="translate(${x - s / 2} ${y - s / 2})${rot ? '' : ''}" class="meeple">
      <use href="#meeple" width="${s}" height="${s}" fill="${PLAYER[p]}" stroke="${stroke}" stroke-width="1.2"
        ${lying ? `transform="rotate(90 ${s / 2} ${s / 2})"` : ''}/></g>`;
  }

  // Standalone SVG of one tile (for grids and the hand).
  function tileSVG(t, r, extra) {
    return `<svg viewBox="0 0 100 100" class="tile-svg" aria-hidden="true">${tile(t, r || 0, 0, 0, 100, extra)}</svg>`;
  }

  self.CarcRender = { DEFS, COL, PLAYER, PLAYER_NAME, tile, tileBody, tileSVG, meeple };
})();
