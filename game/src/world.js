// Duskport — world generation: deterministic city, spatial grid, collision, LOS.
import { WORLD, ROADS_X, ROADS_Y, DISTRICTS, COOLDOWN_ZONES } from './config.js';

const CELL = 160;

// Fixed shop/store buildings (x, y, w, h, label). They sit inside blocks so
// random generation must not overlap them.
export const SHOP_BUILDINGS = [
  { x: 1065, y: 505, w: 110, h: 70, label: 'GARAGE',  shop: 'garage' },
  { x: 590,  y: 505, w: 100, h: 70, label: 'GUNS',    shop: 'gunshop' },
  { x: 1565, y: 505, w: 110, h: 70, label: 'HOSPITAL', shop: 'hospital' },
  { x: 2085, y: 905, w: 110, h: 70, label: 'DPD',     shop: 'policeHQ' },
  { x: 1565, y: 905, w: 110, h: 70, label: 'STORE',   shop: 'storeA' },
  { x: 590,  y: 905, w: 100, h: 70, label: 'STORE',   shop: 'storeB' },
  { x: 2590, y: 505, w: 100, h: 70, label: 'STORE',   shop: 'storeC' },
];

export const WATER = { x: 3120, y: 0, w: 80, h: WORLD.height };

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function districtAt(x, y) {
  for (let i = 0; i < DISTRICTS.length; i++) {
    const d = DISTRICTS[i];
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return i;
  }
  return 0;
}

export function generateWorld(rng) {
  const buildings = [];
  const trees = [];
  const solids = []; // buildings + water, for the grid

  // Exclusion rects: park, pier, water, shop buildings.
  const exclusions = [
    ...COOLDOWN_ZONES.map(z => ({ x: z.x, y: z.y, w: z.w, h: z.h })),
    { x: WATER.x, y: WATER.y, w: WATER.w, h: WATER.h },
    ...SHOP_BUILDINGS,
  ];

  const xs = [0, ...ROADS_X, WORLD.width];
  const ys = [0, ...ROADS_Y, WORLD.height];
  const half = WORLD.roadWidth / 2 + WORLD.blockGap;

  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const bx0 = xs[i] + half, bx1 = xs[i + 1] - half;
      const by0 = ys[j] + half, by1 = ys[j + 1] - half;
      const bw = bx1 - bx0, bh = by1 - by0;
      if (bw < 70 || bh < 60) continue;
      // Split big blocks into 1-3 buildings.
      const n = (bw > 260 && bh > 200) ? 3 : (bw > 200 || bh > 170) ? 2 : 1;
      for (let k = 0; k < n; k++) {
        let r;
        if (n === 1) {
          r = { x: bx0 + rng.range(0, bw * 0.15), y: by0 + rng.range(0, bh * 0.15),
                w: bw * rng.range(0.6, 0.85), h: bh * rng.range(0.6, 0.85) };
        } else if (n === 2) {
          const vertical = bw > bh;
          if (vertical) {
            const cut = bx0 + bw * rng.range(0.45, 0.55);
            r = k === 0
              ? { x: bx0, y: by0, w: cut - bx0 - 12, h: bh * rng.range(0.65, 0.9) }
              : { x: cut + 12, y: by0, w: bx1 - cut - 12, h: bh * rng.range(0.65, 0.9) };
          } else {
            const cut = by0 + bh * rng.range(0.45, 0.55);
            r = k === 0
              ? { x: bx0, y: by0, w: bw * rng.range(0.65, 0.9), h: cut - by0 - 12 }
              : { x: bx0, y: cut + 12, w: bw * rng.range(0.65, 0.9), h: by1 - cut - 12 };
          }
        } else {
          // 3: two on top row, one below (or mirrored).
          if (k < 2) {
            const cut = bx0 + bw * rng.range(0.45, 0.55);
            r = k === 0
              ? { x: bx0, y: by0, w: cut - bx0 - 12, h: bh * 0.42 }
              : { x: cut + 12, y: by0, w: bx1 - cut - 12, h: bh * 0.42 };
          } else {
            r = { x: bx0, y: by0 + bh * 0.5, w: bw * rng.range(0.6, 0.85), h: bh * 0.42 };
          }
        }
        r.w = Math.max(56, Math.min(r.w, bw));
        r.h = Math.max(48, Math.min(r.h, bh));
        if (exclusions.some(e => rectsOverlap(r, e))) continue;
        const di = districtAt(r.x + r.w / 2, r.y + r.h / 2);
        buildings.push({ ...r, district: di, label: null });
      }
    }
  }

  // Shop buildings join the solid list with labels.
  for (const s of SHOP_BUILDINGS) {
    const di = districtAt(s.x + s.w / 2, s.y + s.h / 2);
    buildings.push({ ...s, district: di });
  }

  // Trees: park first, then roadside scatter.
  const park = COOLDOWN_ZONES[0];
  for (let i = 0; i < 26; i++) {
    trees.push({ x: park.x + rng.range(20, park.w - 20), y: park.y + rng.range(20, park.h - 20), r: rng.range(9, 15) });
  }
  for (let i = 0; i < 44; i++) {
    const x = rng.range(60, WORLD.width - 60);
    const y = rng.range(60, WORLD.height - 60);
    if (isOnRoad(x, y)) continue;
    if (buildings.some(b => x > b.x - 20 && x < b.x + b.w + 20 && y > b.y - 20 && y < b.y + b.h + 20)) continue;
    trees.push({ x, y, r: rng.range(8, 13) });
  }

  solids.push(...buildings, WATER);
  const grid = buildGrid(solids);
  return { buildings, trees, solids, grid };
}

export function buildGrid(solids) {
  const grid = new Map();
  for (let i = 0; i < solids.length; i++) {
    const s = solids[i];
    const x0 = Math.floor(s.x / CELL), x1 = Math.floor((s.x + s.w) / CELL);
    const y0 = Math.floor(s.y / CELL), y1 = Math.floor((s.y + s.h) / CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const key = cx + ',' + cy;
        let arr = grid.get(key);
        if (!arr) { arr = []; grid.set(key, arr); }
        arr.push(i);
      }
    }
  }
  return grid;
}

function candidatesFor(grid, x, y, r) {
  const out = [];
  const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL);
  const y0 = Math.floor((y - r) / CELL), y1 = Math.floor((y + r) / CELL);
  for (let cx = x0; cx <= x1; cx++) {
    for (let cy = y0; cy <= y1; cy++) {
      const arr = grid.get(cx + ',' + cy);
      if (arr) for (const i of arr) if (!out.includes(i)) out.push(i);
    }
  }
  return out;
}

export function pointSolid(world, x, y) {
  if (x < 0 || y < 0 || x > WORLD.width || y > WORLD.height) return true;
  for (const i of candidatesFor(world.grid, x, y, 0)) {
    const s = world.solids[i];
    if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return true;
  }
  return false;
}

// Push a circle out of solid rects. Returns corrected {x, y, hit}.
export function collideCircle(world, x, y, r) {
  let hit = false;
  for (const i of candidatesFor(world.grid, x, y, r)) {
    const s = world.solids[i];
    const cx = Math.max(s.x, Math.min(x, s.x + s.w));
    const cy = Math.max(s.y, Math.min(y, s.y + s.h));
    const dx = x - cx, dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * r;
        y = cy + (dy / d) * r;
      } else {
        // Centre inside rect: push along the smallest penetration axis.
        const pl = x - s.x, pr = s.x + s.w - x, pt = y - s.y, pb = s.y + s.h - y;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) x = s.x - r; else if (m === pr) x = s.x + s.w + r;
        else if (m === pt) y = s.y - r; else y = s.y + s.h + r;
      }
    }
  }
  // World bounds.
  if (x < r) { x = r; hit = true; }
  if (y < r) { y = r; hit = true; }
  if (x > WORLD.width - r) { x = WORLD.width - r; hit = true; }
  if (y > WORLD.height - r) { y = WORLD.height - r; hit = true; }
  return { x, y, hit };
}

// Line of sight: true when no solid blocks the segment (sampled).
export function losClear(world, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 18));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (pointSolid(world, x0 + dx * t, y0 + dy * t)) return false;
  }
  return true;
}

export function isOnRoad(x, y) {
  const hw = WORLD.roadWidth / 2;
  for (const rx of ROADS_X) if (Math.abs(x - rx) <= hw) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) <= hw) return true;
  return false;
}

// Nearest point on the road network to (x, y) — used to snap spawns.
export function nearestRoadPoint(x, y) {
  let best = null, bestD = Infinity;
  for (const rx of ROADS_X) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { x: rx, y }; }
  }
  for (const ry of ROADS_Y) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { x, y: ry }; }
  }
  return best;
}
