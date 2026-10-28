/* Tile and meeple pictures, drawn from the tile's features (js/tiles.js), so
 * the picture always matches the rules. Every tile is a 100 x 100 SVG group.
 * Original art: textured meadows, walled stone cities with battlements and
 * roofs, gravel roads with wheel ruts, a small monastery, blue shields.
 */
(function () {
  'use strict';
  const T = self.CarcTiles;

  const COL = {
    field: '#7cab52', fieldDark: '#6a9946', city: '#d9a866', wall: '#7b5228', road: '#f2ead6', roadEdge: '#8d7c5c',
    roof: '#b4553d', monk: '#efe3c6', shield: '#2f62b8',
    water: '#5fa8dc', bank: '#3b78a6', stone: '#c9c3b6', hedge: '#4c7a33',
  };
  const PLAYER = ['#4f8ff7', '#f0c43c', '#e5534b', '#4fbf6a', '#2a2d36', '#a3a8b4'];
  const PLAYER_NAME = ['Blue', 'Yellow', 'Red', 'Green', 'Black', 'Grey'];

  // Shared <defs>: put once in any SVG that draws tiles.
  const DEFS = `<defs>
    <pattern id="grass" width="28" height="28" patternUnits="userSpaceOnUse">
      <rect width="28" height="28" fill="${COL.field}"/>
      <path d="M0 6 Q7 3 14 6 T28 6 M0 20 Q7 17 14 20 T28 20" stroke="#8cba5e" stroke-width="5" fill="none" opacity=".35"/>
      <path d="M3 9 l1.5 -3 M9 4 l1.2 -2.6 M10 12 l1.4 -3 M18 25 l1.3 -3 M23 15 l1.4 -2.8 M5 23 l1 -2.5 M16 9 l-1 -2.4" stroke="${COL.fieldDark}" stroke-width="1.1" stroke-linecap="round" opacity=".75"/>
      <circle cx="21" cy="5" r="1" fill="#f3e9a0" opacity=".8"/><circle cx="6" cy="16" r=".9" fill="#fff" opacity=".7"/><circle cx="25" cy="24" r=".9" fill="#f3e9a0" opacity=".7"/>
    </pattern>
    <pattern id="roofs" width="24" height="22" patternUnits="userSpaceOnUse">
      <rect width="24" height="22" fill="${COL.city}"/>
      <path d="M0 11 H24 M12 0 V22" stroke="#c99554" stroke-width=".8" opacity=".5"/>
      <path d="M2.5 15.5 h7 v4.5 h-7 z M14.5 4.5 h7 v4.5 h-7 z" fill="#f1dcb2"/>
      <path d="M1.4 15.8 l4.6 -4.6 l4.6 4.6 z" fill="${COL.roof}"/><path d="M13.4 4.8 l4.6 -4.6 l4.6 4.6 z" fill="#9c4a35"/>
      <path d="M6 11.2 l4.6 4.6 h-2 z M18 .2 l4.6 4.6 h-2 z" fill="#000" opacity=".18"/>
      <rect x="4.6" y="17.2" width="1.6" height="2.8" fill="#7b5228"/><rect x="16.6" y="6.2" width="1.6" height="2.8" fill="#7b5228"/>
    </pattern>
    <pattern id="stones" width="8" height="6" patternUnits="userSpaceOnUse">
      <rect width="8" height="6" fill="#a99d88"/>
      <path d="M0 3 H8 M3 0 V3 M7 3 V6" stroke="#6f6454" stroke-width=".7"/>
    </pattern>
    <linearGradient id="bevel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".13"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity=".17"/>
    </linearGradient>
    <symbol id="meeple" viewBox="0 0 20 20"><path d="M10 0.6c2.7 0 4.4 2 4.4 4.4 0 1.5-.6 2.6-1.5 3.4l5.4 2c2 .8 1.8 3.8-.4 3.6l-3.6-.7 1.9 5.9c.2.6-.2 1-.8 1h-3.6l-1.8-3.8-1.8 3.8H4.6c-.6 0-1-.4-.8-1l1.9-5.9-3.6.7c-2.2.2-2.4-2.8-.4-3.6l5.4-2C6.2 7.6 5.6 6.5 5.6 5 5.6 2.6 7.3.6 10 .6z"/></symbol>
  </defs>`;

  const MID = [[50, 0], [100, 50], [50, 100], [0, 50]];

  // City for a set of sides, in base orientation: the filled area, then the
  // wall drawn only where the city meets the field (no seam on tile edges).
  function city(sides, own) {
    const set = sides.slice().sort().join('');
    if (own) return cityDraw(own[0], own[1], '');
    const shapes = {
      one: ['0', 'M0 0 H100 Q50 46 0 0 Z', 'M100 0 Q50 46 0 0'],
      opp: ['02', 'M0 0 H100 Q62 50 100 100 H0 Q38 50 0 0 Z', 'M100 0 Q62 50 100 100 M0 100 Q38 50 0 0'],
      adj: ['03', 'M0 0 H100 C62 18 18 62 0 100 Z', 'M100 0 C62 18 18 62 0 100'],
      three: ['013', 'M0 0 H100 V100 Q50 54 0 100 Z', 'M100 100 Q50 54 0 100'],
      four: ['0123', 'M0 0 H100 V100 H0 Z', ''],
    };
    for (const k in shapes) {
      const [canon, d, wall] = shapes[k];
      for (let r = 0; r < 4; r++) {
        const rs = canon.split('').map((c) => (+c + r) % 4).sort().join('');
        if (rs !== set) continue;
        return cityDraw(d, wall, `transform="rotate(${90 * r} 50 50)"`);
      }
    }
    return '';
  }
  // (tf: the rotation of a stock shape; a tile's own shape is already in place)
  function cityDraw(d, wall, tf) {
    let s = '';
    // under the roofs: the wall's shadow, then its battlements (only the half on the field side shows)
    if (wall) s += `<path d="${wall}" ${tf} fill="none" stroke="#000" stroke-opacity=".22" stroke-width="13"/>` +
      `<path d="${wall}" ${tf} fill="none" stroke="#6f6454" stroke-width="12.5" stroke-dasharray="3.6 2.6"/>` +
      `<path d="${wall}" ${tf} fill="none" stroke="#b9ad96" stroke-width="11" stroke-dasharray="2.6 3.6" stroke-dashoffset="-.5"/>`;
    s += `<path d="${d}" ${tf} fill="url(#roofs)"/>`;
    if (wall) s += `<path d="${wall}" ${tf} fill="none" stroke="#5e4a2c" stroke-width="6.4" stroke-linecap="round"/>` +
      `<path d="${wall}" ${tf} fill="none" stroke="url(#stones)" stroke-width="4.6" stroke-linecap="round"/>` +
      `<path d="${wall}" ${tf} fill="none" stroke="#fff" stroke-width="1" stroke-opacity=".25" transform="translate(-.6 -.6)"/>`;
    return s;
  }

  // Traders & Builders goods symbols (our own drawings): wine = a small barrel, grain = a sheaf,
  // cloth = a folded bolt; each on a pale disc so it reads on the city roofs.
  const GOODS = {
    w: '<ellipse cx="0" cy="0" rx="6.2" ry="7.4" fill="#7a3b5a" stroke="#3e1d2e" stroke-width="1.2"/><path d="M-6 -3 H6 M-6 3 H6" stroke="#d9b98a" stroke-width="1.4"/><ellipse cx="0" cy="-7" rx="3.2" ry="1.2" fill="#a2587a"/>',
    g: '<path d="M0 7 L-5 -6 M0 7 L0 -8 M0 7 L5 -6" stroke="#8a6a1c" stroke-width="1.6" stroke-linecap="round"/><ellipse cx="-5" cy="-5" rx="2.2" ry="3.4" fill="#e6bf3c"/><ellipse cx="0" cy="-7" rx="2.2" ry="3.4" fill="#f0cd4c"/><ellipse cx="5" cy="-5" rx="2.2" ry="3.4" fill="#e6bf3c"/><path d="M-3.5 2.5 H3.5" stroke="#8a6a1c" stroke-width="1.8"/>',
    c: '<path d="M-7 -4 L3 -6 L7 -2 L-3 0 Z" fill="#6f9ad8" stroke="#2b4f87" stroke-width="1"/><path d="M-7 -4 V3 L-3 7 V0 Z" fill="#4a77b8" stroke="#2b4f87" stroke-width="1"/><path d="M-3 0 L7 -2 V5 L-3 7 Z" fill="#5b88c8" stroke="#2b4f87" stroke-width="1"/><path d="M0 -1 V6" stroke="#dfe8f6" stroke-width="1"/>',
  };
  const GOOD_NAME = { w: 'wine', g: 'grain', c: 'cloth' };
  function goodIcon(k, x, y, size) {
    const s = (size || 15) / 18;
    return `<g transform="translate(${x} ${y}) scale(${s})"><circle r="9.5" fill="#f6ecd2" stroke="#7b5228" stroke-width="1.4"/>${GOODS[k]}</g>`;
  }

  function roadPath(sides, end) {
    if (sides.length === 2) {
      const [a, b] = sides;
      const [x1, y1] = MID[a], [x2, y2] = MID[b];
      if ((a + 2) % 4 === b) return `M${x1} ${y1} L${x2} ${y2}`;
      const cx = 50 + 12 * Math.sign(x1 - 50 + x2 - 50), cy = 50 + 12 * Math.sign(y1 - 50 + y2 - 50);
      return `M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}`;
    }
    const [x1, y1] = MID[sides[0]];
    const [ex, ey] = end || [50, 50];
    return `M${x1} ${y1} L${ex} ${ey}`;
  }

  // Inner drawing of a tile type in base orientation (no rotation).
  const cache = {};
  function tileBody(t) {
    if (cache[t]) return cache[t];
    const TT = T.TYPES[t], R = TT.rot[0];
    const base = (f) => TT.feats[R.feats.indexOf(f)];
    let s = `<rect width="100" height="100" fill="url(#grass)"/>`;
    if (TT.hedge) s += `<path d="${TT.hedge}" stroke="${COL.hedge}" stroke-width="5" fill="none" stroke-linecap="round" stroke-dasharray="1 6"/>`;
    // River under everything else (roads cross it on bridges).
    for (const f of R.feats.filter((q) => q.type === 'river')) {
      const d = roadPath(f.sides);
      s += `<path d="${d}" stroke="${COL.bank}" stroke-width="20" fill="none"/><path d="${d}" stroke="${COL.water}" stroke-width="15" fill="none"/>`;
      s += `<path d="${d}" stroke="#a9d3f0" stroke-width="1.6" fill="none" stroke-dasharray="5 9" opacity=".8"/>`;
      if (TT.spring) s += `<circle cx="50" cy="50" r="11" fill="${COL.water}" stroke="${COL.bank}" stroke-width="2.5"/><circle cx="50" cy="50" r="4" fill="#a9d3f0"/>`;
      if (TT.lake) s += `<ellipse cx="46" cy="52" rx="30" ry="22" fill="${COL.water}" stroke="${COL.bank}" stroke-width="2.5"/><path d="M30 50 q6 -4 12 0 M48 60 q6 -4 12 0" stroke="#a9d3f0" stroke-width="1.6" fill="none"/>`;
    }
    const roads = R.feats.filter((f) => f.type === 'road');
    const ends = roads.filter((f) => f.sides.length === 1).length;
    for (const f of roads) {
      const d = roadPath(f.sides, base(f).end);
      s += `<path d="${d}" stroke="${COL.roadEdge}" stroke-width="12" fill="none" stroke-linecap="butt"/>`;
      s += `<path d="${d}" stroke="${COL.road}" stroke-width="8" fill="none" stroke-linecap="butt"/>`;
      // gravel and two wheel ruts
      s += `<path d="${d}" stroke="#b9a983" stroke-width="7" fill="none" stroke-dasharray=".8 3.2" opacity=".7"/>`;
      s += `<path d="${d}" stroke="#cbbd99" stroke-width="4.2" fill="none" opacity=".55"/><path d="${d}" stroke="${COL.road}" stroke-width="2.4" fill="none"/>`;
    }
    const monk = R.feats.some((q) => q.type === 'cloister');
    if ((ends >= 3 && !monk) || TT.village) {
      s += `<rect x="40" y="40" width="20" height="20" rx="2" fill="${COL.monk}" stroke="${COL.wall}" stroke-width="2"/>`;
      s += `<path d="M38 42 L50 32 L62 42 Z" fill="${COL.roof}"/>`;
    }
    // Bridge (Traders & Builders): the north-south road crosses over the east-west one.
    if (TT.bridge) s += `<path d="M38 34 V66 M62 34 V66" stroke="#6f6454" stroke-width="3.2"/><path d="M38 34 V66 M62 34 V66" stroke="#b9ad96" stroke-width="1.8" stroke-dasharray="2.4 1.6"/>` +
      `<path d="M41 36 H59 V64 H41 Z" fill="${COL.road}"/><path d="M50 36 V64" stroke="#cbbd99" stroke-width="4.2" opacity=".55"/>`;
    for (const f of R.feats.filter((q) => q.type === 'city')) {
      s += city(f.sides, base(f).shape);
      if (f.shield) {
        const [x, y] = f.spot;
        const sx = x + (x < 50 ? 13 : x > 50 ? -13 : 15), sy = y + (y < 50 ? 4 : y > 50 ? -16 : -18);
        // Pennant: a blue shield with a white chevron, drawn a little larger than before.
        s += `<g transform="translate(${sx - 7.8} ${sy - 1}) scale(1.12)">
          <path d="M0 0 H14 V7 Q14 13 7 16 Q0 13 0 7 Z" fill="${COL.shield}" stroke="#fff" stroke-width="1.5"/>
          <path d="M3 5 L7 9 L11 5" stroke="#fff" stroke-width="1.6" fill="none"/></g>`;
      }
      const B = base(f);
      if (B.good) s += goodIcon(B.good, B.gs ? B.gs[0] : f.spot[0], B.gs ? B.gs[1] : f.spot[1] + 16);
    }
    // Inn: a small house with a pond beside the road (Inns & Cathedrals).
    for (const f of roads) {
      const at = base(f).inn;
      if (!at) continue;
      const [x, y] = at;
      s += `<g transform="translate(${x - 12} ${y - 11})">
        <ellipse cx="17" cy="19" rx="9" ry="4.5" fill="${COL.water}" stroke="${COL.bank}" stroke-width="1.2"/>
        <rect x="2" y="8" width="15" height="11" rx="1" fill="${COL.monk}" stroke="${COL.wall}" stroke-width="1.6"/>
        <path d="M0 9.5 L9.5 1.5 L19 9.5 Z" fill="#3f6fb0" stroke="${COL.wall}" stroke-width="1.3" stroke-linejoin="round"/>
        <rect x="7.5" y="13" width="4" height="6" fill="${COL.wall}"/></g>`;
    }
    // Cathedral: a big stone church in the middle of the city.
    for (const f of R.feats.filter((q) => q.cathedral)) {
      s += `<g transform="translate(34 28)">
        <rect x="2" y="18" width="30" height="20" rx="1" fill="${COL.stone}" stroke="${COL.wall}" stroke-width="2"/>
        <path d="M0 20 L17 8 L34 20 Z" fill="#8c8f99" stroke="${COL.wall}" stroke-width="1.6" stroke-linejoin="round"/>
        <rect x="12" y="0" width="10" height="20" fill="${COL.stone}" stroke="${COL.wall}" stroke-width="1.8"/>
        <path d="M10.5 1 L17 -8 L23.5 1 Z" fill="#8c8f99" stroke="${COL.wall}" stroke-width="1.4" stroke-linejoin="round"/>
        <path d="M14 30 a3 3 0 0 1 6 0 V38 H14 Z" fill="${COL.wall}"/><circle cx="17" cy="9" r="2.4" fill="#f4d58a"/></g>`;
    }
    for (const f of R.feats.filter((q) => q.type === 'cloister')) {
      const [x, y] = f.spot;
      s += `<g transform="translate(${x - 19.2} ${y - 19.2}) scale(1.2)">
        <ellipse cx="16" cy="30.5" rx="15" ry="3.2" fill="#000" opacity=".18"/>
        <rect x="4" y="13" width="24" height="17" rx="1.5" fill="${COL.monk}" stroke="${COL.wall}" stroke-width="2"/>
        <path d="M1 15 L16 3 L31 15 Z" fill="${COL.roof}" stroke="${COL.wall}" stroke-width="1.6" stroke-linejoin="round"/>
        <rect x="13" y="20" width="6" height="10" rx="3" fill="${COL.wall}"/>
      </g>`;
    }
    s += `<rect x="0.5" y="0.5" width="99" height="99" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="1"/>`;
    return (cache[t] = s);
  }

  // ---- who owns what (the Owners view): one feature's area, in tile coordinates, rotated r.
  // Fields have no drawn outline, so a field is a fan from its meeple spot to each of its stretches of
  // the tile's edge, cut back by the tile's cities, roads and river (one mask per tile type).
  const EDGE = [[0, 0, 100, 0], [100, 0, 100, 100], [100, 100, 0, 100], [0, 100, 0, 0]];
  function portSeg(p) {
    const [x1, y1, x2, y2] = EDGE[Math.floor(p / 3)], k = p % 3;
    const at = (t) => [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t];
    return [at(k / 3), at((k + 1) / 3)];
  }
  const AREAS = { one: ['0', 'M0 0 H100 Q50 46 0 0 Z'], opp: ['02', 'M0 0 H100 Q62 50 100 100 H0 Q38 50 0 0 Z'],
    adj: ['03', 'M0 0 H100 C62 18 18 62 0 100 Z'], three: ['013', 'M0 0 H100 V100 Q50 54 0 100 Z'], four: ['0123', 'M0 0 H100 V100 H0 Z'] };
  function cityArea(sides, attrs, own) {
    if (own) return `<path d="${own[0]}" ${attrs}/>`;
    const set = sides.slice().sort().join('');
    for (const k in AREAS) for (let r = 0; r < 4; r++) {
      const rs = AREAS[k][0].split('').map((c) => (+c + r) % 4).sort().join('');
      if (rs === set) return `<path d="${AREAS[k][1]}" transform="rotate(${90 * r} 50 50)" ${attrs}/>`;
    }
    return '';
  }
  function ownMask(t) {
    const TT = T.TYPES[t];
    let m = '';
    for (const [i, f] of TT.rot[0].feats.entries()) {
      if (f.type === 'city') m += cityArea(f.sides, 'fill="#000"', TT.feats[i].shape);
      else if (f.type === 'road' || f.type === 'river') m += `<path d="${roadPath(f.sides, TT.feats[i].end)}" stroke="#000" stroke-width="${f.type === 'river' ? 20 : 12}" fill="none"/>`;
    }
    return `<mask id="own-m${t}" maskUnits="userSpaceOnUse" x="-2" y="-2" width="104" height="104"><rect x="-2" y="-2" width="104" height="104" fill="#fff"/>${m}</mask>`;
  }
  function ownShape(t, r, fi, paint) {
    const f = T.TYPES[t].rot[0].feats[fi], end = T.TYPES[t].feats[fi].end;
    let s = '';
    if (f.type === 'city') s = cityArea(f.sides, `fill="${paint}" opacity=".62"`, T.TYPES[t].feats[fi].shape);
    else if (f.type === 'road') s = `<path d="${roadPath(f.sides, end)}" stroke="${paint}" stroke-width="10" fill="none" opacity=".9"/>`;
    else if (f.type === 'cloister') s = `<circle cx="${f.spot[0]}" cy="${f.spot[1]}" r="24" fill="${paint}" opacity=".55"/>`;
    else if (f.type === 'field') {
      const [sx, sy] = f.spot;
      const d = f.ports.map((p) => { const [[ax, ay], [bx, by]] = portSeg(p); return `M${sx} ${sy}L${ax} ${ay}L${bx} ${by}Z`; }).join('');
      s = `<path d="${d}" fill="${paint}" stroke="${paint}" stroke-width="3" stroke-linejoin="round" opacity=".5" mask="url(#own-m${t})"/>`;
    }
    return s ? `<g transform="rotate(${90 * r} 50 50)">${s}</g>` : '';
  }

  // A full tile group at (px,py) with size `size`, rotated r.
  function tile(t, r, px, py, size, extra) {
    const k = size / 100;
    // The light (bevel) stays top-left whatever the rotation, so it sits outside the rotate group.
    return `<g transform="translate(${px} ${py}) scale(${k})"><g transform="rotate(${90 * r} 50 50)">${tileBody(t)}</g><rect width="100" height="100" fill="url(#bevel)"/>${extra || ''}</g>`;
  }

  // A meeple standing on a feature spot (in 0..100 tile coords, already rotated).
  // A light outline and a soft shadow keep it readable on grass, road and city.
  function meeple(p, x, y, lying, size) {
    const s = size || 22;
    const stroke = p === 4 ? '#c9ccd6' : 'rgba(255,255,255,.9)';
    // (a large meeple is just drawn bigger: callers pass a bigger size)
    return `<g transform="translate(${x - s / 2} ${y - s / 2})" class="meeple"><g class="mbody">
      <ellipse cx="${s / 2 + s * 0.06}" cy="${s * (lying ? 0.78 : 0.97)}" rx="${s * 0.42}" ry="${s * 0.12}" fill="#000" opacity=".35"/>
      <use href="#meeple" width="${s}" height="${s}" fill="${PLAYER[p]}" stroke="${stroke}" stroke-width="1.3" paint-order="stroke"
        ${lying ? `transform="rotate(90 ${s / 2} ${s / 2})"` : ''}/></g></g>`;
  }

  // Traders & Builders figures, in tile units, standing on (x, y): the builder is a tall
  // figure with a hat; the pig a round pig seen from the side. Both in the player's colour.
  function figure(kind, p, x, y, size) {
    const s = size || 24, k = s / 20;
    const stroke = p === 4 ? '#c9ccd6' : 'rgba(255,255,255,.9)';
    const body = kind === 'b'
      ? `<path d="M10 0.5 c2.4 0 3.8 1.7 3.8 3.7 c0 .7 -.2 1.3 -.5 1.8 h2.2 v1.6 h-11 v-1.6 h2.2 c-.3 -.5 -.5 -1.1 -.5 -1.8 c0 -2 1.4 -3.7 3.8 -3.7 z M6.2 8.6 h7.6 l1.6 10.4 c.1 .5 -.3 .8 -.7 .8 h-3.4 l-1.3 -4 l-1.3 4 h-3.4 c-.4 0 -.8 -.3 -.7 -.8 z"/>`
      : `<path d="M3.2 8.8 c0 -3.4 3 -5.6 7 -5.6 c3.1 0 5.2 1.2 6.2 3 l1.2 -1.6 l.4 2.6 c1 .3 1.7 1 1.7 1.9 c0 .9 -.7 1.4 -1.5 1.5 c-.4 2.3 -2 3.8 -3.8 4.5 v3.4 h-2.6 v-2.9 h-3.2 v2.9 h-2.6 v-3.6 c-1.8 -.9 -2.8 -2.5 -2.8 -4.3 c-1 .2 -2 -.6 -2 -1.6 c.8 .3 1.5 .2 2 -.2 z"/>`;
    return `<g transform="translate(${x - s / 2} ${y - s / 2})" class="meeple fig"><g class="mbody">
      <ellipse cx="${s / 2}" cy="${s * 0.97}" rx="${s * 0.4}" ry="${s * 0.11}" fill="#000" opacity=".35"/>
      <g transform="scale(${k})" fill="${PLAYER[p]}" stroke="${stroke}" stroke-width="1.3" paint-order="stroke">${body}</g></g></g>`;
  }
  // The same as a small standalone SVG (supply, buttons).
  function figureSVG(kind, p, px) {
    return `<svg viewBox="0 0 24 24" width="${px}" height="${px}" class="fig-svg" aria-hidden="true">${figure(kind, p, 12, 11, 22)}</svg>`;
  }

  // Standalone SVG of one tile (for grids and the hand).
  function tileSVG(t, r, extra) {
    return `<svg viewBox="0 0 100 100" class="tile-svg" aria-hidden="true">${tile(t, r || 0, 0, 0, 100, extra)}</svg>`;
  }

  self.CarcRender = { DEFS, COL, PLAYER, PLAYER_NAME, tile, tileBody, tileSVG, meeple, figure, figureSVG, goodIcon, GOOD_NAME, ownMask, ownShape };
})();
