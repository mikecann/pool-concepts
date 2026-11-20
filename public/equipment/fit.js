// Fit check. Pure maths (no three.js) so it also runs in Node.
// Plan units mm, RLs metres. Each placed item becomes a set of convex plan polygons with an RL range:
// body, clearance volumes, service-lift volume, airflow plume.
import { ROOM_POLY, SPA, RL, TERRACE, YARD_POLY, YARD_RL, SEA_LEVELS, pointInPoly, inSpa, inRoomFree, inRect, OUTER_POLY, LOUNGE_POLY } from './room.js';

const D2R = Math.PI / 180;
const EPS = 1;           // mm
const CEIL = RL.joistUnder;

export function circlePoly(cx, cy, r, n = 28) {
  return Array.from({ length: n }, (_, i) => [cx + r * Math.cos((i / n) * 2 * Math.PI), cy + r * Math.sin((i / n) * 2 * Math.PI)]);
}

// local (lx = left, lz = front) -> plan mm. Matches the three.js group transform in scene.js.
export function toPlan(pl, lx, lz) {
  const t = (pl.rotDeg || 0) * D2R;
  return [pl.x + lx * Math.cos(t) + lz * Math.sin(t), pl.y + lx * Math.sin(t) - lz * Math.cos(t)];
}
const rect = (pl, x0, x1, z0, z1) => [toPlan(pl, x0, z0), toPlan(pl, x1, z0), toPlan(pl, x1, z1), toPlan(pl, x0, z1)];

export function dims(item) {
  return item.shape === 'cylinder'
    ? { w: item.size.dia, d: item.size.dia, h: item.size.h }
    : { w: item.size.w, d: item.size.d, h: item.size.h };
}

// Local rectangle (x range, z range) just outside one face of the body, `len` mm deep.
export function sideRect(item, side, len) {
  const { w, d } = dims(item);
  switch (side) {
    case 'front': return [-w / 2, w / 2, d / 2, d / 2 + len];
    case 'back': return [-w / 2, w / 2, -d / 2 - len, -d / 2];
    case 'left': return [w / 2, w / 2 + len, -d / 2, d / 2];
    case 'right': return [-w / 2 - len, -w / 2, -d / 2, d / 2];
    default: return [-w / 2, w / 2, -d / 2, d / 2];
  }
}

export function geometry(item, pl) {
  const { w, d, h } = dims(item);
  const rl0 = pl.rl, rl1 = pl.rl + h / 1000;
  const body = item.shape === 'cylinder' ? circlePoly(pl.x, pl.y, w / 2, 24) : rect(pl, -w / 2, w / 2, -d / 2, d / 2);
  const footprint = rect(pl, -w / 2, w / 2, -d / 2, d / 2);
  const vols = [];
  for (const side of ['front', 'back', 'left', 'right']) {
    const len = item.clearance?.[side] || 0;
    if (len > 0) { const [a, b, c, e] = sideRect(item, side, len); vols.push({ kind: 'clearance', side, poly: rect(pl, a, b, c, e), rl0, rl1 }); }
  }
  if (item.clearance?.top > 0) vols.push({ kind: 'clearance', side: 'top', poly: footprint, rl0: rl1, rl1: rl1 + item.clearance.top / 1000 });
  if (item.serviceLift > 0) vols.push({ kind: 'lift', side: 'top', poly: footprint, rl0: rl1, rl1: rl1 + item.serviceLift / 1000 });
  let plume = null;
  const af = item.airflow;
  if (af && af.throwMm > 0) {
    if (af.discharge === 'top') plume = { poly: footprint, rl0: rl1, rl1: rl1 + af.throwMm / 1000, side: 'top' };
    else { const [a, b, c, e] = sideRect(item, af.discharge, af.throwMm); plume = { poly: rect(pl, a, b, c, e), rl0, rl1, side: af.discharge }; }
  }
  return { body, footprint, rl0, rl1, vols, plume, w, d, h };
}

// ---- convex polygon overlap (SAT), true only if they overlap by more than EPS mm ----
function axesOf(p) {
  const out = [];
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length];
    const nx = y2 - y1, ny = x1 - x2, l = Math.hypot(nx, ny) || 1;
    out.push([nx / l, ny / l]);
  }
  return out;
}
const proj = (p, [ax, ay]) => { let lo = 1e18, hi = -1e18; for (const [x, y] of p) { const v = x * ax + y * ay; if (v < lo) lo = v; if (v > hi) hi = v; } return [lo, hi]; };
export function polysOverlap(a, b) {
  for (const ax of [...axesOf(a), ...axesOf(b)]) {
    const [a0, a1] = proj(a, ax), [b0, b1] = proj(b, ax);
    if (Math.min(a1, b1) - Math.max(a0, b0) <= EPS) return false;
  }
  return true;
}
const rlOverlap = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0) > EPS / 1000;

function samples(poly, n = 9) {
  // grid of points inside a convex quad/polygon, pulled 0.5% toward the centre
  let cx = 0, cy = 0; for (const [x, y] of poly) { cx += x; cy += y; } cx /= poly.length; cy /= poly.length;
  const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const pts = [];
  const step = Math.max(40, Math.max(x1 - x0, y1 - y0) / n);
  for (let x = x0; x <= x1 + 1e-6; x += step) for (let y = y0; y <= y1 + 1e-6; y += step) {
    const px = cx + (x - cx) * 0.995, py = cy + (y - cy) * 0.995;
    if (pointInPoly(px, py, poly)) pts.push([px, py]);
  }
  for (const [x, y] of poly) pts.push([cx + (x - cx) * 0.995, cy + (y - cy) * 0.995]);
  return pts;
}

const inExtra = (x, y, ctx) => (ctx.extraFloor || []).some(r => inRect(x, y, r));
export function zoneOf(g, pl, ctx) {
  if (pointInPoly(pl.x, pl.y, ROOM_POLY) || inExtra(pl.x, pl.y, ctx)) return 'room';
  if (inRect(pl.x, pl.y, TERRACE)) return 'terrace';
  if (pointInPoly(pl.x, pl.y, YARD_POLY)) return 'yard';
  return 'none';
}

const inTerrace = (x, y) => inRect(x, y, TERRACE);
function insideZone(zone, x, y, ctx) { return zone === 'yard' ? pointInPoly(x, y, YARD_POLY) : zone === 'terrace' ? inTerrace(x, y) : (inRoomFree(x, y) || inExtra(x, y, ctx)); }

// Is a point free air for a discharge plume to travel through?
function airFree(x, y, rl, ctx) {
  if (inRoomFree(x, y) || inExtra(x, y, ctx)) return true;
  if (inSpa(x, y)) return false;
  const door = ctx.doors.find(d => x >= d.x0 && x <= d.x1 && y >= d.y0 && y <= d.y1 && rl >= d.sill && rl <= d.head);
  if (door) return true;
  if (pointInPoly(x, y, OUTER_POLY) && !pointInPoly(x, y, LOUNGE_POLY)) return false; // inside masonry
  return true; // outdoors, or the open-topped lounge
}

export function checkLayout(layout, catalogue, ctx) {
  // ctx: { overhead: [rect], doors: [{x0,y0,x1,y1,sill,head}], airPath: bool, spaType }
  const byId = Object.fromEntries(catalogue.map(i => [i.id, i]));
  const seen = {};
  const entries = (layout.placements || []).map(pl => {
    const item = byId[pl.item];
    seen[pl.item] = (seen[pl.item] || 0) + 1;
    const id = seen[pl.item] > 1 ? `${pl.item}#${seen[pl.item]}` : pl.item;
    if (!item) return { id, pl, item: { id: pl.item, name: pl.item + ' (not in catalogue)', shape: 'box', size: { w: 100, d: 100, h: 100 } }, missing: true };
    return { id, pl, item };
  });
  const spaPoly = circlePoly(SPA.x, SPA.y, SPA.r, 48);
  for (const e of entries) e.g = geometry(e.item, e.pl);
  const structs = (layout.structures || []).map(t => ({ ...t, poly: [[t.x0, t.y0], [t.x1, t.y0], [t.x1, t.y1], [t.x0, t.y1]] }));
  const floorUnder = (e, zone) => {
    const t = structs.find(t => pointInPoly(e.pl.x, e.pl.y, t.poly) && e.pl.rl >= t.rl1 - 0.02);
    if (t) return t.rl1;
    return zone === 'room' ? RL.pad : zone === 'terrace' ? TERRACE.rl : zone === 'yard' ? YARD_RL : e.pl.rl;
  };
  const res = {};
  const add = (id, status, note) => {
    const r = (res[id] ||= { status: 'fits', notes: [] });
    const rank = { fits: 0, tight: 1, clash: 2 };
    if (rank[status] > rank[r.status]) r.status = status;
    if (note) r.notes.push({ status, note });
  };
  const m = v => (Math.round(v * 1000) / 1000);

  for (const e of entries) {
    const { id, item, pl, g } = e;
    res[id] = { status: 'fits', notes: [] };
    if (e.missing) { add(id, 'clash', 'not in the catalogue'); continue; }
    const zone = zoneOf(g, pl, ctx);
    e.zone = zone;
    // footprint inside room or terrace
    const wm = item.wallMount;
    // wall-mounted units may touch the wall: allow 30 mm of their back to sit in it
    const pts = samples(wm && item.shape !== 'cylinder' ? (() => { const { w, d } = g; return rect(pl, -w / 2, w / 2, -d / 2 + 30, d / 2); })() : g.body);
    const floor = floorUnder(e, zone); e.floor = floor;
    if (zone === 'none') add(id, 'clash', 'outside the room');
    else {
      const out = pts.filter(([x, y]) => !insideZone(zone, x, y, ctx));
      if (out.length) {
        const touchesSpa = zone === 'room' && out.some(([x, y]) => inSpa(x, y));
        add(id, 'clash', touchesSpa ? 'overlaps the spa' : zone === 'room' ? 'pokes through a wall' : 'off the terrace');
      }
    }
    if (zone === 'room' && item.outdoorOnly) add(id, 'clash', 'maker says outdoors only');
    if (zone === 'room' && item.mustBeOutsideRoom) add(id, 'clash', 'maker says outside the room');
    if (item.mountMinAboveFloor) {
      const short = item.mountMinAboveFloor / 1000 - (pl.rl - floor);
      if (short > 0.004) add(id, 'tight', `${short.toFixed(2)} m below the maker's mounting height`);
      if (zone === 'room' && g.rl1 > CEIL + 0.001) add(id, 'clash', 'top is above the joists');
    }
    // headroom
    if (zone === 'room') {
      const over = Math.round((g.rl1 - CEIL) * 1000);
      const open = (ctx.overhead || []).find(r => pts.every(([x, y]) => inRect(x, y, r)));
      if (over > 0 && !item.mountMinAboveFloor) {
        if (open) add(id, 'tight', `${over} mm over the joists: only under the opening`);
        else add(id, 'clash', `${over} mm too tall for the joists`);
      }
      if (g.rl0 < RL.pad - 0.001) add(id, 'clash', 'below the floor');
    }
    // service lift
    if (item.serviceLift > 0) {
      const lift = g.rl1 + item.serviceLift / 1000;
      if (zone === 'room' && lift > CEIL) {
        const open = (ctx.overhead || []).find(r => pts.every(([x, y]) => inRect(x, y, r)));
        if (open) add(id, 'fits', `lifts out through the ${open.name || 'opening'}`);
        else add(id, 'tight', `lift needs ${Math.round((lift - CEIL) * 1000)} mm more headroom`);
      }
    }
    // clearance volumes inside the room (or terrace)?
    if (zone !== 'none') {
      for (const v of g.vols) {
        if (v.kind !== 'clearance' || v.side === 'top') continue;
        const vp = samples(v.poly, 6);
        if (!vp.length) continue;
        const outside = vp.filter(([x, y]) => !insideZone(zone, x, y, ctx)).length / vp.length;
        if (outside > 0.2) { add(id, item.airflow ? 'clash' : 'tight', `${v.side} clearance runs into ${zone === 'room' ? 'a wall or the spa' : 'the boundary'}`); break; }
      }
    }
  }

  // body vs body, body vs spa, bodies inside someone else's service volumes and plumes
  for (let i = 0; i < entries.length; i++) {
    const a = entries[i];
    if (a.missing) continue;
    if (a.zone === 'room' && rlOverlap(a.g.rl0, a.g.rl1, RL.pad, RL.deck) && polysOverlap(a.g.body, spaPoly)) add(a.id, 'clash', 'overlaps the spa');
    for (let j = 0; j < entries.length; j++) {
      if (i === j || entries[j].missing) continue;
      const b = entries[j];
      if (j > i && rlOverlap(a.g.rl0, a.g.rl1, b.g.rl0, b.g.rl1) && polysOverlap(a.g.body, b.g.body)) {
        add(a.id, 'clash', `hits ${b.item.name.toLowerCase()}`); add(b.id, 'clash', `hits ${a.item.name.toLowerCase()}`);
      }
      // b standing in a's service space
      for (const v of a.g.vols) {
        if (rlOverlap(v.rl0, v.rl1, b.g.rl0, b.g.rl1) && polysOverlap(v.poly, b.g.body)) {
          add(a.id, 'tight', `${v.kind === 'lift' ? 'lift path' : v.side + ' space'} blocked by ${b.item.name.toLowerCase()}`);
          break;
        }
      }
      if (a.g.plume && rlOverlap(a.g.plume.rl0, a.g.plume.rl1, b.g.rl0, b.g.rl1) && polysOverlap(a.g.plume.poly, b.g.body)) {
        add(a.id, 'tight', `discharge hits ${b.item.name.toLowerCase()}`);
      }
    }
    if (a.zone === 'room') for (const v of a.g.vols) {
      if (v.kind === 'clearance' && rlOverlap(v.rl0, v.rl1, RL.pad, RL.deck) && polysOverlap(v.poly, spaPoly)) { add(a.id, a.item.airflow ? 'clash' : 'tight', `${v.side} space meets the spa`); break; }
    }
  }

  // structures (shelf, plinth): bodies inside them clash; bodies standing on them must be fully supported
  for (const e of entries) {
    if (e.missing) continue;
    for (const t of structs) {
      if (rlOverlap(e.g.rl0, e.g.rl1, t.rl0, t.rl1) && polysOverlap(e.g.body, t.poly)) add(e.id, 'clash', `sits inside the ${t.name || 'structure'}`);
      else if (Math.abs(e.pl.rl - t.rl1) < 0.02 && polysOverlap(e.g.body, t.poly)) {
        const pts = samples(e.g.body);
        const off = pts.filter(([x, y]) => !pointInPoly(x, y, t.poly));
        if (off.length) {
          let over = 0;
          for (const [x, y] of off) over = Math.max(over, Math.max(t.x0 - x, x - t.x1, t.y0 - y, y - t.y1));
          add(e.id, 'tight', `hangs ${Math.round(over)} mm off the ${t.name || 'structure'}`);
        }
      }
    }
  }

  // airflow: how far does the discharge run before a wall, the spa or another body stops it?
  for (const a of entries) {
    const af = a.item.airflow;
    if (!af || !a.g.plume || a.missing) continue;
    const { pl, g } = a;
    const [x0, x1, z0, z1] = sideRect(a.item, af.discharge, af.throwMm);
    let free = af.throwMm;
    const mid = (g.rl0 + g.rl1) / 2;
    if (af.discharge === 'top') { free = a.zone === 'room' ? Math.max(0, Math.round((CEIL - g.rl1) * 1000)) : af.throwMm; }
    else for (const f of [0, -0.25, 0.25]) {
      const along = (af.discharge === 'front' || af.discharge === 'back');
      for (let s = 25; s <= af.throwMm; s += 25) {
        let lx, lz;
        if (af.discharge === 'front') { lx = f * g.w; lz = g.d / 2 + s; }
        else if (af.discharge === 'back') { lx = f * g.w; lz = -g.d / 2 - s; }
        else if (af.discharge === 'left') { lx = g.w / 2 + s; lz = f * g.d; }
        else { lx = -g.w / 2 - s; lz = f * g.d; }
        void along; void x0; void x1; void z0; void z1;
        const [px, py] = toPlan(pl, lx, lz);
        let blocked = !airFree(px, py, mid, ctx);
        if (!blocked) for (const b of entries) if (b !== a && !b.missing && rlOverlap(mid - 0.01, mid + 0.01, b.g.rl0, b.g.rl1) && pointInPoly(px, py, b.g.body)) { blocked = true; break; }
        if (blocked) { free = Math.min(free, s - 25); break; }
      }
    }
    a.free = free;
    if (free < af.throwMm * 0.5) add(a.id, 'clash', `discharge stops after ${m(free / 1000)} m of ${m(af.throwMm / 1000)} m`);
    else if (free < af.throwMm) add(a.id, 'tight', `discharge has ${m(free / 1000)} m of ${m(af.throwMm / 1000)} m`);
    if (a.zone === 'room' && !ctx.airPath) add(a.id, 'tight', 'no air path in or out of the room');
  }

  const enters = layout.seaEntersRoomAtRl ?? 99;
  for (const e of entries) {
    const base = e.pl.rl, inRoom = e.zone === 'room';
    const need = inRoom ? Math.max(base, enters) : base;
    const lv = SEA_LEVELS.filter(l => l.id !== 'today').find(l => l.rl >= need);
    res[e.id].sea = lv ? { id: lv.id, text: `wet at the ${lv.label.replace(' yr', '-year')} level` } : { id: null, text: 'dry to the 500-year level' };
  }
  const items = entries.map(e => ({ id: e.id, item: e.item, pl: e.pl, g: e.g, zone: e.zone, free: e.free, floor: e.floor, ...res[e.id] }));
  const summary = { fits: 0, tight: 0, clash: 0 };
  for (const it of items) summary[it.status]++;
  const heatW = items.filter(i => i.zone === 'room').reduce((s, i) => s + (i.item.heatW || 0), 0);
  return { items, summary, heatW };
}

// Build the check context from an access option (see ACCESS in layouts.js).
export function ctxFor(layout, accessId, ACCESS) {
  const a = ACCESS[accessId] || ACCESS.sideYard;
  return {
    overhead: [...(a.overhead || []), ...(layout.openings || [])],
    doors: a.door ? [{ x0: a.door.wallX0, x1: a.door.wallX1, y0: a.door.y0, y1: a.door.y1, sill: a.door.sill, head: a.door.head }] : [],
    airPath: !!a.airPath,
    extraFloor: a.well ? [a.well] : [],
  };
}

// The first level (from the list) at which sea gets into the room.
export function seaEntry(layout) {
  const lv = SEA_LEVELS.filter(l => l.id !== 'today').find(l => l.rl >= (layout.seaEntersRoomAtRl ?? 99));
  return lv ? lv.label.replace(' yr', '-year') : null;
}
