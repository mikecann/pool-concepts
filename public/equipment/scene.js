// three.js builders: the room, its surroundings, the spa, people and equipment.
// Mapping: three X = plan x (east), three Y = RL (up), three Z = -plan y (so south is +Z).
import * as THREE from 'three';
import { sideRect, dims, circlePoly } from './fit.js';
import {
  LOUNGE_POLY, OUTER_POLY, ROOM_POLY, ROOM_VOID, SPA, RL, STRIP_POLY, LOWER_STEPS, UPPER_STEPS, BENCH, BENCH_RL, TERRACE,
  EAST_STEPS, EAST_LOW_GROUND, CANAL_STRIP, CANAL, POOL, FENCE, HOUSE, HOUSE_OPENINGS, PATIO, ALFRESCO, POOL_PAVING, YARD_POLY, YARD_RL,
  WEST_FENCE, NORTH_FENCE,
} from './room.js';

export const M = 0.001;
export const P = (x, y, rl) => new THREE.Vector3(x * M, rl, -y * M);

export const COL = {
  bg: 0x0f1517, wall: 0x7b8583, paving: 0x8d9694, deck: 0xa08566, joist: 0x6f5e49, pad: 0x4b5658, lounge: 0x5f6a69,
  bench: 0x8b836d, step: 0x7e7a69, ground: 0x4c5b52, water: 0x2c7e8b, canalWall: 0x66706e, clash: 0xe5533d,
  clearance: 0x8fb4c9, lift: 0xd0b88a, plume: 0x7fcfc6, intake: 0x9fb4c0, ink: 0xe3eaea, spa: 0x6f7f8a, shell: 0x8ea3b8,
  fence: 0x8aa392, person: 0xcdd5d6, edge: 0x0b1011,
};

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0, ...extra });

function shapeOf(poly, holes = []) {
  const s = new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x * M, y * M)));
  for (const h of holes) s.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x * M, y * M))));
  return s;
}
function slab(poly, holes, rl0, rl1) {
  const g = new THREE.ExtrudeGeometry(shapeOf(poly, holes), { depth: rl1 - rl0, bevelEnabled: false, curveSegments: 48 });
  g.rotateX(-Math.PI / 2); g.translate(0, rl0, 0);
  return g;
}
function box(x0, y0, x1, y1, rl0, rl1) {
  const g = new THREE.BoxGeometry((x1 - x0) * M, rl1 - rl0, (y1 - y0) * M);
  g.translate(((x0 + x1) / 2) * M, (rl0 + rl1) / 2, (-(y0 + y1) / 2) * M);
  return g;
}
function edgesOf(geo, color = COL.edge, opacity = 0.55, angle = 30) {
  const l = new THREE.LineSegments(new THREE.EdgesGeometry(geo, angle), new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
  l.userData.edge = true;
  return l;
}
function part(geo, mat, edge = true) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, mat));
  if (edge) g.add(edgesOf(geo));
  return g;
}

// Merge the room ring and the outer ring into one polygon with a gap where the east door goes.
function ringWithDoor(door) {
  const outer = OUTER_POLY.map(p => [...p]);
  const hole = ROOM_VOID;
  const x0 = door.wallX0, x1 = door.wallX1;
  // find the room edge on x0 that holds both y0 and y1
  let ia = -1;
  for (let i = 0; i < hole.length; i++) {
    const a = hole[i], b = hole[(i + 1) % hole.length];
    if (a[0] === x0 && b[0] === x0 && a[1] < door.y0 && b[1] > door.y1) { ia = i; break; }
  }
  if (ia < 0) return null;
  const seq = [];
  for (let k = 1; k <= hole.length; k++) seq.push(hole[(ia + k) % hole.length]); // b ... a
  const idx1 = outer.findIndex(p => p[0] === x1 && p[1] === 5100);
  return [...outer.slice(0, idx1 + 1), [x1, door.y1], [x0, door.y1], ...seq, [x0, door.y0], [x1, door.y0], ...outer.slice(idx1 + 1)];
}

function cutterPlanes(c) {
  const [x0, x1, z0, z1] = [c.x0 * M, c.x1 * M, -c.y1 * M, -c.y0 * M];
  return [
    new THREE.Plane(new THREE.Vector3(1, 0, 0), -x1), new THREE.Plane(new THREE.Vector3(-1, 0, 0), x0),
    new THREE.Plane(new THREE.Vector3(0, 1, 0), -c.rl1), new THREE.Plane(new THREE.Vector3(0, -1, 0), c.rl0),
    new THREE.Plane(new THREE.Vector3(0, 0, 1), -z1), new THREE.Plane(new THREE.Vector3(0, 0, -1), z0),
  ];
}

function makeArrow(from, dir, len, color, r = 0.014) {
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len - 0.12, 8), m);
  shaft.position.y = (len - 0.12) / 2;
  const head = new THREE.Mesh(new THREE.ConeGeometry(r * 3.4, 0.12, 12), m);
  head.position.y = len - 0.06;
  g.add(shaft, head);
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  g.position.copy(from);
  return g;
}

// ---- the world ------------------------------------------------------------
export function buildWorld({ access, accessId, spaType, structures = [] }) {
  const root = new THREE.Group();
  const mats = {
    wall: std(COL.wall), paving: std(COL.paving), deck: std(COL.deck), joist: std(COL.joist),
    ghostable: [],
  };
  const groups = { walls: new THREE.Group(), deck: new THREE.Group(), context: new THREE.Group(), sea: new THREE.Group(), spa: new THREE.Group() };
  groups.walls.name = 'walls'; groups.deck.name = 'deck';
  mats.ghostable = [mats.wall, mats.paving, mats.deck, mats.joist];

  // masonry in bands so the east door can be a real opening
  const lounge = LOUNGE_POLY, stairsMode = accessId === 'stairs';
  const door = access.door;
  const bands = door
    ? [[RL.wallBase, door.sill, null], [door.sill, door.head, ringWithDoor(door)], [door.head, RL.towerTop, null]]
    : [[RL.wallBase, RL.towerTop, null]];
  for (const [r0, r1, ring] of bands) {
    const g = ring ? slab(ring, [lounge], r0, r1) : slab(OUTER_POLY, [lounge, ROOM_VOID], r0, r1);
    groups.walls.add(part(g, mats.wall));
  }
  // paving on top of the masonry (lounge surrounds), RL 2.38
  groups.walls.add(part(slab(OUTER_POLY, [lounge, ROOM_VOID], RL.towerTop, RL.deck), mats.paving));
  if (stairsMode && access.wallCut) mats.wall.clippingPlanes = cutterPlanes(access.wallCut), mats.wall.clipIntersection = true;

  // equipment room floor (concrete pad) and the deck-covered strip east of the lounge
  const padMat = std(COL.pad);
  // (with the stairs lifted, the standing well is part of the same pad polygon)
  const w = stairsMode && access.well;
  const padPoly = w ? ROOM_VOID.flatMap(p => (p[0] === 0 && p[1] === -240 ? [[w.x1, -240], [w.x1, w.y1], [0, w.y1], p] : [p])) : ROOM_VOID;
  root.add(part(slab(padPoly, [], RL.wallBase, RL.pad), padMat));
  if (w) root.add(part(box(w.x0, w.y1, w.x1, w.y1 + 240, w.rl, RL.lounge - 0.1), mats.wall));

  // lounge floor, bench, steps
  const loungeMat = std(COL.lounge);
  const loungePoly = stairsMode ? [[0, 920], [1380, 920], ...LOUNGE_POLY.slice(3)] : LOUNGE_POLY;
  root.add(part(slab(loungePoly, [], RL.lounge - 0.1, RL.lounge), loungeMat));
  root.add(part(slab(BENCH, [], RL.lounge, BENCH_RL), std(COL.bench)));
  const rise = (RL.deck - RL.lounge) / LOWER_STEPS.count;
  const stepMat = std(COL.step);
  for (let j = 0; j < UPPER_STEPS.count; j++) {
    const y0 = UPPER_STEPS.y0 + j * 225;
    root.add(part(box(UPPER_STEPS.x0, y0, UPPER_STEPS.x1, y0 + 225, RL.lounge, RL.lounge + rise * (j + 1)), stepMat));
  }
  if (!stairsMode) {
    for (let j = 0; j < LOWER_STEPS.count; j++) {
      root.add(part(box(0, 230 * j, LOWER_STEPS.x1, 230 * (j + 1), RL.lounge, RL.deck - rise * j - (j === 0 ? 0.001 : 0)), stepMat));
    }
  } else {
    // the flight, hinged at the top edge (y 0, RL 2.38) and swung up
    const hinge = new THREE.Group();
    hinge.position.copy(P(0, 0, RL.deck));
    const prof = new THREE.Shape();
    prof.moveTo(0, 0);
    for (let j = 0; j < 4; j++) { prof.lineTo(0.23 * (j + 1), -rise * j); prof.lineTo(0.23 * (j + 1), -rise * (j + 1)); }
    prof.lineTo(0, -rise * 4);
    const strGeo = new THREE.ExtrudeGeometry(prof, { depth: 0.045, bevelEnabled: false });
    strGeo.rotateY(Math.PI / 2); // shape x -> -Z (north), extrude -> +X
    const flight = new THREE.Group();
    for (const x of [0, 1.335]) { const s = part(strGeo.clone(), std(COL.deck)); s.position.x = x; flight.add(s); }
    for (let j = 0; j < 4; j++) {
      const t = part(new THREE.BoxGeometry(1.38, 0.04, 0.23), std(COL.deck), true);
      t.position.set(0.69, -rise * j - 0.02, -(0.23 * j + 0.115));
      flight.add(t);
    }
    hinge.add(flight);
    hinge.rotation.x = (access.stairs.liftDeg * Math.PI) / 180;
    root.add(hinge);
  }

  // spa (parametric)
  groups.spa.add(buildSpa(spaType));
  for (const t of structures) groups.walls.add(part(box(t.x0, t.y0, t.x1, t.y1, t.rl0, t.rl1), mats.wall));

  // deck: boards over joists, hole for the spa, hatch cut
  const spaHole = circlePoly(SPA.x, SPA.y, SPA.r, 72);
  const deckGroup = groups.deck;
  const boards = part(slab(ROOM_VOID, [spaHole], RL.deck - 0.02, RL.deck), mats.deck);
  const joists = part(slab(ROOM_VOID, [spaHole], RL.joistUnder, RL.deck - 0.02), mats.joist);
  deckGroup.add(boards, joists);
  if (access.hatch) {
    const h = access.hatch;
    const planes = cutterPlanes({ ...h, rl0: RL.joistUnder - 0.01, rl1: RL.deck + 0.01 });
    for (const m of [mats.deck, mats.joist]) { m.clippingPlanes = planes; m.clipIntersection = true; }
    // lid hinged along the south edge, swung open
    const hing = new THREE.Group();
    hing.position.copy(P((h.x0 + h.x1) / 2, h.y0, RL.deck));
    const lid = part(new THREE.BoxGeometry((h.x1 - h.x0) * M, 0.045, (h.y1 - h.y0) * M), std(COL.deck));
    lid.position.set(0, -0.0225, -((h.y1 - h.y0) * M) / 2);
    hing.add(lid);
    hing.rotation.x = (100 * Math.PI) / 180;
    if (h.name !== 'panels') deckGroup.add(hing); // lift-out panels: shown as a hole, panels set aside
    // outline of the opening
    const o = [[h.x0, h.y0], [h.x1, h.y0], [h.x1, h.y1], [h.x0, h.y1]].map(([x, y]) => P(x, y, RL.deck + 0.003));
    const outline = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(o), new THREE.LineBasicMaterial({ color: COL.ink, transparent: true, opacity: 0.6 }));
    outline.userData.edge = true;
    deckGroup.add(outline);
  }

  // east door leaf
  if (door) {
    const yc = (door.y0 + door.y1) / 2, hh = door.head - door.sill, g = new THREE.Group();
    const leafMat = std(0x8b7355);
    for (let k = 0; k < Math.floor(hh / 0.11); k++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.016, (door.y1 - door.y0) * M - 0.04), leafMat);
      slat.rotation.z = 0.6; slat.position.set(((door.wallX0 + door.wallX1) / 2) * M, door.sill + 0.06 + k * 0.11, -yc * M);
      g.add(slat);
    }
    root.add(g);
  }

  // pool-side paving (RL 2.38), pool basin
  const paveMat = std(COL.paving);
  const poolHole = [[POOL.x0, POOL.y0], [POOL.x1, POOL.y0], [POOL.x1, POOL.y1], [POOL.x0, POOL.y1]];
  groups.context.add(part(slab(POOL_PAVING, [poolHole], RL.towerTop, RL.deck), paveMat));
  const basin = new THREE.Mesh(box(POOL.x0, POOL.y0, POOL.x1, POOL.y1, POOL.floorRl, RL.deck), new THREE.MeshStandardMaterial({ color: 0x3f6f7d, side: THREE.BackSide, roughness: 1 }));
  groups.context.add(basin);
  groups.context.add(new THREE.Mesh(box(POOL.x0, POOL.y0, POOL.x1, POOL.y1, POOL.waterRl - 0.01, POOL.waterRl), new THREE.MeshStandardMaterial({ color: COL.water, transparent: true, opacity: 0.55 })));
  // side yard, house, patio, alfresco
  const yardMat = std(0x55684f);
  groups.context.add(part(slab(YARD_POLY, [], YARD_RL - 0.2, YARD_RL), yardMat));
  groups.context.add(part(box(PATIO.x0, PATIO.y0, PATIO.x1, PATIO.y1, PATIO.rl - 0.2, PATIO.rl), std(0x8c9693)));
  groups.context.add(part(box(ALFRESCO.x0, ALFRESCO.y0, ALFRESCO.x1, ALFRESCO.y1, ALFRESCO.rl - 0.2, ALFRESCO.rl), paveMat));
  groups.context.add(part(box(HOUSE.x0, HOUSE.y0, HOUSE.x1, HOUSE.y1, HOUSE.rl0, HOUSE.rl1), std(0x9a9488)));
  for (const o of HOUSE_OPENINGS) {
    const gl = new THREE.Mesh(box(HOUSE.x0 - 30, o.y0, HOUSE.x0, o.y1, o.rl0, o.rl1), new THREE.MeshStandardMaterial({ color: o.name === 'laundry door' ? 0x2f5560 : 0x24424b, roughness: 0.3 }));
    groups.context.add(gl);
  }
  const panelFence = (line, h, color, opacity) => {
    const m = new THREE.MeshStandardMaterial({ color, transparent: true, opacity, roughness: 0.8 });
    for (let k = 0; k < line.length - 1; k++) {
      const [x1, y1] = line[k], [x2, y2] = line[k + 1];
      const dx = (x2 - x1) * M, dz = -(y2 - y1) * M, len = Math.hypot(dx, dz);
      const p = new THREE.Mesh(new THREE.BoxGeometry(len, h, 0.04), m);
      p.position.set(((x1 + x2) / 2) * M, RL.deck + h / 2, (-(y1 + y2) / 2) * M);
      p.rotation.y = Math.atan2(-dz, dx);
      groups.context.add(p);
    }
  };
  panelFence(WEST_FENCE.line.map(([x, y]) => [x, y]), WEST_FENCE.h, 0x8a8f86, 0.8);
  panelFence(NORTH_FENCE.line, NORTH_FENCE.h, COL.fence, 0.5);

  // ground: canal strip, canal wall, water, the low ground east and the terrace with its steps
  const groundMat = std(COL.ground);
  const c = groups.context;
  c.add(part(box(CANAL_STRIP.x0, CANAL_STRIP.y0, CANAL_STRIP.x1, CANAL_STRIP.y1, 0.4, CANAL_STRIP.rl), groundMat));
  c.add(part(box(CANAL.x0, CANAL.y1 - CANAL.wallT, CANAL.x1, CANAL.y1, 0.0, RL.strip), std(COL.canalWall)));
  c.add(new THREE.Mesh(box(CANAL.x0, CANAL.y0, CANAL.x1, CANAL.y1 - CANAL.wallT, RL.water - 0.2, RL.water), new THREE.MeshStandardMaterial({ color: COL.water, transparent: true, opacity: 0.6 })));
  const L = EAST_LOW_GROUND;
  c.add(part(box(L.x0, L.y0, L.x1, L.y1, 0.4, L.rl), groundMat));
  for (const s of EAST_STEPS) c.add(part(box(TERRACE.x0, s.y0, TERRACE.x1, s.y1, 0.4, s.rl), std(0x66756b)));
  c.add(part(box(TERRACE.x0, TERRACE.y0, TERRACE.x1, TERRACE.y1, 0.4, TERRACE.rl), std(0x586a5f)));

  // pool fence on the east wall: top and bottom rails, posts, balusters
  const fenceMat = std(COL.fence);
  const fz0 = -FENCE.y0 * M, fz1 = -FENCE.y1 * M, len = fz0 - fz1, fx = FENCE.x * M;
  const fy0 = RL.deck, fy1 = RL.deck + FENCE.h;
  const rail = (y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, len), fenceMat); m.position.set(fx, y, (fz0 + fz1) / 2); return m; };
  const bal = new THREE.InstancedMesh(new THREE.BoxGeometry(0.014, FENCE.h - 0.1, 0.014), fenceMat, Math.floor(len / 0.11));
  const dm = new THREE.Object3D();
  for (let i = 0; i < bal.count; i++) { dm.position.set(fx, fy0 + FENCE.h / 2, fz1 + 0.05 + i * 0.11); dm.updateMatrix(); bal.setMatrixAt(i, dm.matrix); }
  const fence = new THREE.Group();
  fence.add(rail(fy1 - 0.02), rail(fy0 + 0.06), bal);
  for (let z = fz1; z <= fz0 + 0.01; z += 2.4) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.06, FENCE.h, 0.06), fenceMat); p.position.set(fx, fy0 + FENCE.h / 2, z); fence.add(p); }
  c.add(fence);

  root.add(groups.walls, groups.deck, groups.context, groups.sea, groups.spa);
  const materials = [mats.wall, mats.paving, mats.deck, mats.joist];
  return { root, groups, mats, materials };
}

function buildSpa(type) {
  const g = new THREE.Group();
  const r = SPA.r * M, cx = SPA.x * M, cz = -SPA.y * M;
  const place = (m, y) => { m.position.set(cx, y, cz); g.add(m); return m; };
  const waterMat = new THREE.MeshStandardMaterial({ color: COL.water, transparent: true, opacity: 0.7, roughness: 0.3 });
  const spaMat = std(type === 'cabinet' ? COL.spa : COL.shell);
  const innerMat = new THREE.MeshStandardMaterial({ color: 0x3b6b7a, side: THREE.BackSide, roughness: 1 });
  const rimMat = std(0xaab4b8);
  let bottom;
  if (type === 'cabinet') {
    bottom = RL.deck - 0.9;
    place(new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.9, 72), spaMat), bottom + 0.45);
    place(new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, bottom - RL.pad, 48), std(0x5d6967)), RL.pad + (bottom - RL.pad) / 2);
  } else {
    bottom = RL.deck - 1.0; // about 1.0 m deep, sitting on bedding on the pad
    const shellMat = new THREE.MeshStandardMaterial({ color: COL.shell, side: THREE.DoubleSide, roughness: 0.8 });
    place(new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.82, 1.0, 72, 1, true), shellMat), bottom + 0.5);
    place(new THREE.Mesh(new THREE.CircleGeometry(r * 0.82, 48).rotateX(Math.PI / 2), spaMat), bottom + 0.004);
    place(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.86, r * 0.9, bottom - RL.pad, 48), std(0xa09882)), RL.pad + (bottom - RL.pad) / 2);
  }
  const rim = place(new THREE.Mesh(new THREE.RingGeometry(0.8, r, 72).rotateX(-Math.PI / 2), rimMat), RL.deck + 0.002);
  void rim;
  place(new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.4, 72, 1, true), innerMat), RL.deck - 0.2);
  place(new THREE.Mesh(new THREE.CircleGeometry(0.8, 72).rotateX(-Math.PI / 2), waterMat), RL.spaWater);
  place(new THREE.Mesh(new THREE.CircleGeometry(0.8, 72).rotateX(-Math.PI / 2), std(0x3b6b7a)), RL.deck - 0.4);
  return g;
}

// ---- people ---------------------------------------------------------------
export function buildPerson(kind, pos) {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: COL.person, roughness: 0.8, transparent: true, opacity: 0.9 });
  const add = (geo, x, y, z) => { const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); g.add(mesh); return mesh; };
  if (kind === 'standing') {
    add(new THREE.CapsuleGeometry(0.07, 0.72, 4, 10), -0.09, 0.44, 0);
    add(new THREE.CapsuleGeometry(0.07, 0.72, 4, 10), 0.09, 0.44, 0);
    add(new THREE.CapsuleGeometry(0.165, 0.42, 4, 12), 0, 1.17, 0);
    add(new THREE.CapsuleGeometry(0.05, 0.6, 4, 8), -0.24, 1.15, 0);
    add(new THREE.CapsuleGeometry(0.05, 0.6, 4, 8), 0.24, 1.15, 0);
    add(new THREE.SphereGeometry(0.105, 16, 12), 0, 1.645, 0);
  } else {
    // kneeling: shins on the floor, thighs and torso upright, about 1.1 m
    add(new THREE.CapsuleGeometry(0.07, 0.35, 4, 10).rotateX(Math.PI / 2), -0.09, 0.07, 0.18);
    add(new THREE.CapsuleGeometry(0.07, 0.35, 4, 10).rotateX(Math.PI / 2), 0.09, 0.07, 0.18);
    add(new THREE.CapsuleGeometry(0.08, 0.3, 4, 10), -0.09, 0.3, 0.0);
    add(new THREE.CapsuleGeometry(0.08, 0.3, 4, 10), 0.09, 0.3, 0.0);
    add(new THREE.CapsuleGeometry(0.15, 0.3, 4, 12), 0, 0.71, 0);
    add(new THREE.CapsuleGeometry(0.045, 0.5, 4, 8), -0.22, 0.66, 0.05);
    add(new THREE.CapsuleGeometry(0.045, 0.5, 4, 8), 0.22, 0.66, 0.05);
    add(new THREE.SphereGeometry(0.095, 16, 12), 0, 1.02, 0);
  }
  g.position.copy(P(pos.x, pos.y, pos.rl));
  return g;
}

// ---- equipment ------------------------------------------------------------
export function buildItem(entry) {
  const { item, pl, g: geo } = entry;
  const { w, d, h } = dims(item);
  const grp = new THREE.Group();
  grp.position.copy(P(pl.x, pl.y, pl.rl));
  grp.rotation.y = ((pl.rotDeg || 0) * Math.PI) / 180;
  const bodyGeo = item.shape === 'cylinder' ? new THREE.CylinderGeometry(w / 2000, w / 2000, h * M, 40) : new THREE.BoxGeometry(w * M, h * M, d * M);
  const bodyMat = std(new THREE.Color(item.colour || '#9aa'), { roughness: 0.7 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = (h * M) / 2;
  const edge = edgesOf(bodyGeo, COL.edge, 0.8, 35); edge.position.y = (h * M) / 2;
  // a short mark on the front face so rotation reads in the scene
  const front = new THREE.Mesh(new THREE.BoxGeometry(Math.min(w, 200) * M, 0.012, 0.012), new THREE.MeshBasicMaterial({ color: COL.edge }));
  front.position.set(0, h * M * 0.8, d * M / 2);
  grp.add(body, edge, front);

  const clearance = new THREE.Group(), airflow = new THREE.Group();
  const volMat = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false });
  const addVol = (parent, rect, y0, y1, color, opacity) => {
    const [a, b, c, e] = rect;
    const gg = new THREE.BoxGeometry((b - a) * M, y1 - y0, (e - c) * M);
    const m = new THREE.Mesh(gg, volMat(color, opacity));
    m.position.set(((a + b) / 2) * M, (y0 + y1) / 2, ((c + e) / 2) * M);
    const l = edgesOf(gg, color, 0.32); l.position.copy(m.position);
    parent.add(m, l);
  };
  for (const side of ['front', 'back', 'left', 'right']) {
    const len = item.clearance?.[side] || 0;
    if (len > 0) addVol(clearance, sideRect(item, side, len), 0, h * M, COL.clearance, 0.13);
  }
  if (item.clearance?.top > 0) addVol(clearance, sideRect(item, 'top', 0), h * M, h * M + item.clearance.top / 1000, COL.clearance, 0.1);
  if (item.serviceLift > 0) addVol(clearance, sideRect(item, 'top', 0), h * M, h * M + item.serviceLift / 1000, COL.lift, 0.16);

  const af = item.airflow;
  if (af) {
    const dirs = { front: [0, 0, 1], back: [0, 0, -1], left: [1, 0, 0], right: [-1, 0, 0], top: [0, 1, 0] };
    const faceOf = (side) => { const dv = new THREE.Vector3(...dirs[side]); return { dv, c: new THREE.Vector3(dv.x * w * M / 2, dv.y ? h * M : h * M / 2, dv.z * d * M / 2) }; };
    const across = (side) => (side === 'front' || side === 'back' ? new THREE.Vector3(1, 0, 0) : side === 'top' ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1));
    const span = (side) => (side === 'front' || side === 'back' || side === 'top' ? w : d) * M;
    for (const [side, isOut] of [[af.intake, false], [af.discharge, true]]) {
      if (!side) continue;
      const f = faceOf(side), ax = across(side), sp = span(side);
      for (const k of [-0.3, 0, 0.3]) {
        const base = f.c.clone().addScaledVector(ax, k * sp);
        if (side !== 'top') base.y = h * M * (0.35 + 0.15 * (k + 0.3) / 0.3);
        const len = 0.55;
        const from = isOut ? base.clone() : base.clone().addScaledVector(f.dv, len);
        const dir = isOut ? f.dv : f.dv.clone().negate();
        airflow.add(makeArrow(from, dir, len, isOut ? COL.plume : COL.intake));
      }
    }
    if (af.throwMm > 0) {
      const rect = sideRect(item, af.discharge, af.throwMm);
      if (af.discharge === 'top') addVol(airflow, sideRect(item, 'top', 0), h * M, h * M + af.throwMm / 1000, COL.plume, 0.1);
      else addVol(airflow, rect, 0, h * M, COL.plume, 0.12);
    }
  }
  grp.add(clearance, airflow);
  grp.userData = { id: entry.id, body, bodyMat, edge, clearance, airflow, baseColor: bodyMat.color.clone() };
  return grp;
}

export function setItemStatus(grp, status) {
  const { bodyMat, edge, baseColor } = grp.userData;
  if (status === 'clash') { bodyMat.color.setHex(COL.clash); edge.material.color.setHex(COL.clash); edge.material.opacity = 1; }
  else {
    bodyMat.color.copy(baseColor);
    edge.material.color.setHex(status === 'tight' ? COL.ink : COL.edge);
    edge.material.opacity = status === 'tight' ? 1 : 0.8;
  }
}

// ---- dimension lines ------------------------------------------------------
export function dimLine(a, b, color = COL.ink) {
  const g = new THREE.Group();
  g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 })));
  const dir = b.clone().sub(a).normalize();
  const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0));
  if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
  side.normalize().multiplyScalar(0.06);
  for (const p of [a, b]) g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([p.clone().sub(side), p.clone().add(side)]), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 })));
  return g;
}

export function disposeTree(o) {
  o.traverse(n => {
    if (n.geometry) n.geometry.dispose();
    if (n.material) (Array.isArray(n.material) ? n.material : [n.material]).forEach(m => m.dispose());
  });
}

// ---- sea water at a chosen level ---------------------------------------------------
// Water over every piece of outside ground lower than the level; the room only fills when the level reaches
// the layout's seaEntersRoomAtRl (below that it stays dry even though the water outside is higher).
export function buildSea(level, entersRl) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0x3aa0b4, transparent: true, opacity: 0.3, depthWrite: false });
  const slabBox = (x0, y0, x1, y1, rl0, rl1) => { if (rl1 > rl0 + 0.002) g.add(new THREE.Mesh(box(x0, y0, x1, y1, rl0, rl1), mat)); };
  slabBox(CANAL.x0, CANAL.y0, CANAL.x1, CANAL.y1 - CANAL.wallT, 0, level);
  if (level > RL.strip) {
    slabBox(CANAL_STRIP.x0, CANAL_STRIP.y0, CANAL_STRIP.x1, CANAL_STRIP.y1 + CANAL.wallT, RL.strip, level);
    const L = EAST_LOW_GROUND; slabBox(L.x0, L.y0, L.x1, L.y1, L.rl, level);
    for (const s of EAST_STEPS) slabBox(TERRACE.x0, s.y0, TERRACE.x1, s.y1, s.rl, level);
    slabBox(TERRACE.x0, TERRACE.y0, TERRACE.x1, TERRACE.y1, TERRACE.rl, level);
  }
  const roomWet = level >= entersRl - 1e-6 && level > RL.pad;
  if (roomWet) {
    const top = Math.min(level, RL.joistUnder);
    g.add(new THREE.Mesh(slab(ROOM_VOID, [], RL.pad, top), new THREE.MeshBasicMaterial({ color: 0x3aa0b4, transparent: true, opacity: 0.42, depthWrite: false })));
  }
  g.userData.roomWet = roomWet;
  return g;
}
