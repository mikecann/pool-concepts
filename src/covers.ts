// Roll-on covers (Round 17): Australian Spa Covers' soft, segmented Roll-On, for the hot tub and the pool. E near the
// spa or the pool rolls the cover on or off, piece by piece: the parked roll travels across the water (shrinking as
// it lays its segments down) and the flat cover appears behind it one padded segment at a time; rolling it off is
// the same backwards. Built from the export's extras: `spa_cover` / `pool_cover` ("rolled" on the roll, "on" on the
// flat cover), roll_center, roll_axis, roll_radius, unroll_dir, and spa_center + cover_radius or pool_rect.
import { Group, MeshStandardNodeMaterial, Quaternion, Vector2, Vector3, type Material, type Mesh, type Object3D } from 'three/webgpu';
import { dot, float, positionWorld, select, uniform } from 'three/tsl';

type Roll = { obj: Object3D; group: Group; centre: Vector3; dir: Vector3; radius: number; end?: string };
export type Cover = {
  kind: 'pool' | 'spa'; flat: Mesh; rolls: Roll[]; segments: number; dur: number;
  /** 0 rolled up, 1 fully on. */
  progress: number; target: number; moving: boolean;
  /** Reveal: the laid edge's distance along `dir` from `origin` (uniforms in the flat cover's material). */
  originU: ReturnType<typeof uniform>; dirU: ReturnType<typeof uniform>; edgeU: ReturnType<typeof uniform>;
  /** The active roll's travel: where the cover starts and ends along its direction, from the roll's centre. */
  sMin: number; sMax: number; coverY: number; active: Roll | null;
  /** For "am I near it": the pool's rectangle or the spa's circle, in plan. */
  centre: Vector3; reach: (x: number, z: number) => number;
};

export class Covers {
  readonly list: Cover[] = [];

  setup(root: Object3D, toNode: (m: Material) => any) {
    const top = (o: Object3D, key: string) => !o.parent || o.parent.userData[key] === undefined;
    const flats: Record<string, Mesh> = {}, rolls: Record<string, Object3D[]> = { pool: [], spa: [] };
    root.traverse(o => {
      for (const kind of ['pool', 'spa'] as const) {
        const tag = o.userData[`${kind}_cover`];
        if (!tag || !top(o, `${kind}_cover`)) continue;
        if (tag === 'on') flats[kind] = o as Mesh; else rolls[kind].push(o);
      }
    });
    for (const kind of ['pool', 'spa'] as const) {
      const flat = flats[kind];
      if (!flat || !rolls[kind].length) continue;
      const u = flat.userData;
      const originU = uniform(new Vector2()), dirU = uniform(new Vector2(1, 0)), edgeU = uniform(1e3);
      // the flat cover shows up to the laid edge (whole segments), measured along the unrolling direction
      const meshes: Mesh[] = [];
      flat.traverse(o => { if ((o as Mesh).isMesh) meshes.push(o as Mesh); });
      for (const m of meshes) {
        // its own copy: both covers share the vinyl material, and a shared one would take the last cover's reveal
        const src = m.material as any, n = new MeshStandardNodeMaterial() as any;
        for (const k of ['color', 'roughness', 'metalness', 'map', 'normalMap', 'normalScale', 'roughnessMap', 'side', 'envMapIntensity', 'name']) if (src[k] !== undefined) n[k] = src[k]?.clone && k !== 'map' && k !== 'normalMap' && k !== 'roughnessMap' ? src[k].clone() : src[k];
        void toNode;
        const s = dot(positionWorld.xz.sub(originU), dirU);
        n.opacityNode = select(s.lessThan(edgeU), float(1), float(0));
        n.alphaTest = 0.5;
        m.material = n;
      }
      const rs: Roll[] = rolls[kind].map(r => {
        const ru = r.userData;
        const centre = new Vector3().fromArray(ru.roll_center as number[]);
        const axis = new Vector3().fromArray(ru.roll_axis as number[]).setY(0).normalize();
        const group = new Group();
        group.name = `cover_roll_${kind}_${ru.end ?? ''}`;
        group.position.copy(centre);
        group.quaternion.copy(new Quaternion().setFromUnitVectors(new Vector3(1, 0, 0), axis));
        r.parent!.add(group); group.updateMatrixWorld(true); group.attach(r);
        return { obj: r, group, centre, dir: new Vector3().fromArray(ru.unroll_dir as number[]).setY(0).normalize(), radius: ru.roll_radius as number, end: ru.end as string | undefined };
      });
      let centre: Vector3, reach: (x: number, z: number) => number, coverY: number;
      if (kind === 'spa') {
        centre = new Vector3().fromArray(u.spa_center as number[]);
        const R = (u.cover_radius as number) ?? 1;
        coverY = (u.spa_rim_z as number) ?? centre.y;
        reach = (x, z) => Math.max(0, Math.hypot(x - centre.x, z - centre.z) - R);
      } else {
        const rect = (u.pool_rect as number[][]).map(p => new Vector3().fromArray(p));
        centre = rect.reduce((a, p) => a.add(p), new Vector3()).divideScalar(rect.length);
        coverY = rect[0].y;
        reach = (x, z) => polygonDistance(rect, x, z);
      }
      this.list.push({
        kind, flat, rolls: rs, segments: kind === 'pool' ? 17 : 8, dur: kind === 'pool' ? 6 : 3,
        progress: 0, target: 0, moving: false, originU, dirU, edgeU, sMin: 0, sMax: 0, coverY, active: null, centre, reach,
      });
    }
    return this.list.length;
  }

  /** Point the reveal and the travel at this roll (the one whose option is chosen). */
  private aim(c: Cover, roll: Roll) {
    c.active = roll;
    (c.originU.value as Vector2).set(roll.centre.x, roll.centre.z);
    (c.dirU.value as Vector2).set(roll.dir.x, roll.dir.z);
    const along = (p: Vector3) => (p.x - roll.centre.x) * roll.dir.x + (p.z - roll.centre.z) * roll.dir.z;
    const u = c.flat.userData;
    if (c.kind === 'spa') {
      const R = (u.cover_radius as number) ?? 1, mid = along(c.centre);
      c.sMin = mid - R; c.sMax = mid + R;
    } else {
      const ps = (u.pool_rect as number[][]).map(p => along(new Vector3().fromArray(p)));
      c.sMin = Math.min(...ps); c.sMax = Math.max(...ps);
    }
  }

  /** Start rolling a cover on (to 1) or off (to 0) from this roll. */
  start(c: Cover, on: boolean, roll: Roll) {
    this.aim(c, roll);
    c.progress = on ? 0 : 1; c.target = on ? 1 : 0; c.moving = true;
    roll.group.visible = true;
    this.pose(c);
  }

  /** Show a cover fully on or fully rolled up at once (a card picked, an option switched). */
  set(c: Cover, on: boolean, roll: Roll | null) {
    if (roll) this.aim(c, roll);
    c.progress = c.target = on ? 1 : 0; c.moving = false;
    this.pose(c);
  }

  private pose(c: Cover) {
    const roll = c.active;
    const p = c.progress;
    // laid segments: whole pieces behind the roll
    const laid = Math.floor(p * c.segments + 1e-6) / c.segments;
    c.edgeU.value = p >= 1 ? 1e3 : c.sMin + (c.sMax - c.sMin) * laid;
    for (const r of c.rolls) {
      if (r !== roll) { r.group.position.copy(r.centre); r.group.scale.set(1, 1, 1); r.group.visible = true; continue; }
      // the roll travels from its parking spot to the far edge, getting thinner, and drops to the cover's level.
      // Rolled up it sits exactly where the export parks it; over the first segment it moves on to the near rim, where
      // the cover starts (it used to be drawn at the rim even when parked: 0.35 m off its spot in A, 0.53 m in B, on
      // the spa's rim beside the bather)
      const k = Math.sqrt(Math.max(0.0025, 1 - p * 0.9975));
      const travel = Math.max(0, c.sMin * Math.min(1, p * c.segments) + (c.sMax - c.sMin) * p);
      r.group.position.copy(r.centre).addScaledVector(r.dir, travel);
      r.group.position.y = c.coverY + (r.centre.y - c.coverY) * k;
      if (c.kind === 'spa' && c.sMin > 0) {
        // the spa's rim stands above the deck: rest the roll on the rim and cover (its bottom at the rim's top) rather
        // than sink it 5 cm into them, rising from its parked height as it slides over from the deck
        const rest = c.coverY + r.radius * k;
        r.group.position.y = travel < c.sMin ? r.centre.y + (rest - r.centre.y) * (travel / c.sMin) : rest;
      }
      r.group.scale.set(1, k, k);
      r.group.visible = p < 0.999;
    }
  }

  /** Advance. Returns the covers that finished this frame. */
  update(dt: number) {
    const done: Cover[] = [];
    for (const c of this.list) {
      if (!c.moving) continue;
      const step = dt / c.dur;
      c.progress = c.target > c.progress ? Math.min(c.target, c.progress + step) : Math.max(c.target, c.progress - step);
      this.pose(c);
      if (c.progress === c.target) { c.moving = false; done.push(c); }
    }
    return done;
  }
}

/** Distance in plan from (x, z) to a convex polygon (0 inside). */
function polygonDistance(poly: Vector3[], x: number, z: number) {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const ex = b.x - a.x, ez = b.z - a.z, px = x - a.x, pz = z - a.z;
    const t = Math.max(0, Math.min(1, (px * ex + pz * ez) / (ex * ex + ez * ez)));
    best = Math.min(best, Math.hypot(px - ex * t, pz - ez * t));
  }
  // the rectangle's winding isn't known: inside if all cross products share a sign
  let pos = true, neg = true;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const c = (b.x - a.x) * (z - a.z) - (b.z - a.z) * (x - a.x);
    if (c < 0) pos = false; if (c > 0) neg = false;
  }
  return pos || neg ? 0 : best;
}
