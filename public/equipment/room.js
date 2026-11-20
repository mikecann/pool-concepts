// Room geometry: the single source of truth, copied from
// the-pool/documents/equipment-room-access/sketch.py. Plan units are millimetres:
// origin = sunken lounge's inside south-west corner, x east, y north.
// RLs are metres. (Not equipment data: that lives in catalogue.js and layouts.js.)

export const LOUNGE_POLY = [[0, 0], [1380, 0], [1380, 920], [2120, 1660], [3925, 1660], [3925, 4860], [0, 4860]];
export const ROOM_POLY = [[0, -1450], [3495, -1450], [4695, -282], [4695, 1420], [2224, 1420], [1620, 777], [1620, -240], [0, -240]];
export const OUTER_POLY = [[-240, 5100], [4935, 5100], [4935, -380], [3600, -1690], [-240, -1690]];
export const SPA = { x: 2718, y: 318, r: 1000 };

// Deck-covered strip east of the lounge (from base_plan: x 4165..4695, y 1420..4860).
export const STRIP_POLY = [[4165, 1420], [4695, 1420], [4695, 4860], [4165, 4860]];

export const RL = {
  deck: 2.38, towerTop: 2.323, lounge: 1.623, pad: 1.12, strip: 1.02, water: 0.25,
  joistUnder: 2.215, wallBase: 0.88, flood: 1.15, terrace: 1.8, spaWater: 2.3,
};
export const T = { wall: 240, board: 20, joist: 145, pad: 100 };

export const LOWER_STEPS = { x0: 0, x1: 1380, y0: 0, y1: 920, count: 4 };
export const UPPER_STEPS = { x0: 0, x1: 1000, y0: 3960, y1: 4860, count: 4 };
export const BENCH = [[1000, 4860], [3925, 4860], [3925, 1660], [3025, 1660], [3025, 3960], [1000, 3960]];
export const BENCH_RL = 2.07;

export const TERRACE = { x0: 4935, x1: 9170, y0: 1165, y1: 5100, rl: 1.8 };
export const EAST_STEPS = [
  { y0: 953, y1: 1165, rl: 1.6 }, { y0: 650, y1: 953, rl: 1.4 }, { y0: 318, y1: 650, rl: 1.2 },
];
export const EAST_LOW_GROUND = { x0: 4935, x1: 9170, y0: -1690, y1: 318, rl: 1.02 };
export const CANAL_STRIP = { x0: -6000, x1: 9170, y0: -2890, y1: -1690, rl: 1.02 };
export const CANAL = { x0: -6000, x1: 9170, y0: -4200, y1: -2890, wallT: 240 };
export const POOL = { x0: -5165, x1: -1165, y0: 130, y1: 8130, floorRl: 0.6, waterRl: 2.3 };
export const FENCE = { x: 4815, y0: -380, y1: 5100, h: 1.2 };

// ---- side yard and house (plain massing, always drawn) -------------------------
export const HOUSE = { x0: -184, x1: 10300, y0: 9376, y1: 17400, rl0: 2.47, rl1: 5.2 };
export const HOUSE_OPENINGS = [ // on the west wall x = -184; y range, RL range
  { name: 'laundry door', y0: 15366, y1: 16936, rl0: 2.47, rl1: 4.62 },
  { name: 'kitchen window', y0: 11766, y1: 12176, rl0: 3.37, rl1: 4.10 },
  { name: 'kitchen window', y0: 13466, y1: 13876, rl0: 3.37, rl1: 4.10 },
];
export const PATIO = { x0: 3826, x1: 10300, y0: 5133, y1: 9376, rl: 2.47 };
export const ALFRESCO = { x0: -706, x1: 3826, y0: 5133, y1: 8825, rl: 2.38 };
// pool-side paving at RL 2.38 out to the boundary and north to the pool fence (pool is cut out of it)
export const POOL_PAVING = [[-7000, -400], [-240, -400], [-240, 5133], [-706, 5133], [-706, 8825], [-184, 8825], [-184, 11640], [-5683, 11640], [-6275, 8130], [-7000, 3800]];
export const YARD_POLY = [[-5683, 11640], [-184, 11640], [-184, 17400], [-4700, 17400]];
export const YARD_RL = 2.40;
// paved area north of the pool, inside the pool fence (house west wall is x = -184 from y 9376 north)
export const POOLSIDE = { x0: -5600, x1: -184, y0: 8900, y1: 11640, rl: 2.38 };
export const GATE = { x0: -2140, x1: -1234, y: 11640 };
export const WEST_FENCE = { h: 1.8, line: [[-7000, 3800], [-6275, 8130], [-5683, 11640], [-4700, 17400]] };
export const NORTH_FENCE = { h: 1.2, line: [[-5683, 11640], [-184, 11640]] };

// ---- sea levels, m AHD (Port Geographe tide gauge) ----------------------------------
export const SEA_LEVELS = [
  { id: 'today', label: 'Today', rl: 0.25 }, { id: '2', label: '2 yr', rl: 1.35 }, { id: '5', label: '5 yr', rl: 1.50 },
  { id: '10', label: '10 yr', rl: 1.61 }, { id: '25', label: '25 yr', rl: 1.82 }, { id: '50', label: '50 yr', rl: 1.98 },
  { id: '100', label: '100 yr', rl: 2.14 }, { id: '200', label: '200 yr', rl: 2.30 }, { id: '500', label: '500 yr', rl: 2.51 },
];

// ---- helpers (mm) ---------------------------------------------------------
export function polyArea(p) {
  let a = 0;
  for (let i = 0; i < p.length; i++) { const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length]; a += x1 * y2 - x2 * y1; }
  return Math.abs(a) / 2;
}
export function pointInPoly(x, y, p) {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i], [xj, yj] = p[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export const inSpa = (x, y) => (x - SPA.x) ** 2 + (y - SPA.y) ** 2 < SPA.r ** 2;
export const inRoomFree = (x, y) => pointInPoly(x, y, ROOM_POLY) && !inSpa(x, y);
export const inRect = (x, y, r) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;

// The room's hollow including the deck-covered strip (one ring, anticlockwise).
export const ROOM_VOID = (() => {
  const out = [];
  for (const p of ROOM_POLY) {
    out.push(p);
    if (p[0] === 4695 && p[1] === 1420) out.push([4695, 4860], [4165, 4860], [4165, 1420]);
  }
  return out;
})();

// Net floor area of the room (ROOM_POLY less the spa circle) and the volume under the joists.
export function roomStats() {
  const gross = polyArea(ROOM_POLY) / 1e6;
  const spa = (Math.PI * SPA.r * SPA.r) / 1e6;
  const net = gross - spa;
  const headroom = RL.joistUnder - RL.pad;
  return { gross, spa, net, headroom, volumeNet: net * headroom, volumeGross: gross * headroom };
}
