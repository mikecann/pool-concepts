// First-person walking: a capsule against the yard's walls, fences and furniture (three-mesh-bvh), a ray
// down for the floor so you follow steps up to 0.25 m (down into the sunken lounge), gravity off ledges,
// and water you can't walk onto. Mouse look with pointer lock, WASD/arrows, Shift to run. Touch: a stick
// for walking and drag anywhere else to look.
import {
  BufferAttribute, BufferGeometry, DoubleSide, InstancedMesh, Line3, Matrix4, Mesh, Object3D, PerspectiveCamera, Ray, Vector3, Box3,
} from 'three/webgpu';
import { MeshBVH } from 'three-mesh-bvh';

/** How far a view may sit from standing eye height (seated, or a camera over lower ground). */
const liftFor = (eye: number) => Math.max(-1.0, Math.min(1.6, eye - 1.65));
const EYE = 1.65, RADIUS = 0.24, STEP = 0.26, WALK = 2.2, RUN = 4.5, GRAVITY = 9.8;
/** A small hop: 0.45 m. With the 0.26 m step-up that's well short of the 1.2 m pool fence. */
const JUMP = 0.45;

/** A moving obstacle the capsule can't pass, as a vertical strip from a to b (e.g. a gate leaf). */
export type Segment = { a: Vector3; b: Vector3; y0: number; y1: number };
const _v = new Vector3(), _v2 = new Vector3(), _m = new Matrix4(), _seg = new Line3(), _box = new Box3();

/** Merge world-space triangles of the given meshes (instanced meshes expanded) into one BVH. */
function buildBVH(meshes: Mesh[], limit?: Box3) {
  const pos: number[] = [];
  const tri = [new Vector3(), new Vector3(), new Vector3()];
  for (const mesh of meshes) {
    const geo = mesh.geometry as BufferGeometry;
    const p = geo.getAttribute('position') as BufferAttribute;
    if (!p) continue;
    const idx = geo.index;
    const count = idx ? idx.count : p.count;
    const mats: Matrix4[] = [];
    if ((mesh as InstancedMesh).isInstancedMesh) {
      const im = mesh as InstancedMesh;
      for (let i = 0; i < im.count; i++) { im.getMatrixAt(i, _m); mats.push(new Matrix4().multiplyMatrices(mesh.matrixWorld, _m)); }
    } else mats.push(mesh.matrixWorld);
    for (const mw of mats) {
      if (limit) { if (!geo.boundingBox) geo.computeBoundingBox(); _box.copy(geo.boundingBox!).applyMatrix4(mw); if (!_box.intersectsBox(limit)) continue; }
      for (let i = 0; i < count; i += 3) {
        for (let k = 0; k < 3; k++) tri[k].fromBufferAttribute(p, idx ? idx.getX(i + k) : i + k).applyMatrix4(mw);
        pos.push(tri[0].x, tri[0].y, tri[0].z, tri[1].x, tri[1].y, tri[1].z, tri[2].x, tri[2].y, tri[2].z);
      }
    }
  }
  if (!pos.length) return null;
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  return new MeshBVH(g);
}

export type Mode = 'walk' | 'drone';

export class Walker {
  readonly feet = new Vector3();
  yaw = 0; pitch = 0;
  mode: Mode = 'walk';
  private vy = 0;
  /**
   * Round 12: extra eye height so a "go to" lands exactly at the render camera's height: seated views sit lower,
   * and Today's lawn is lower than the proposed deck the camera was placed for. Eases to 0 once you walk.
   */
  private lift = 0;
  private liftFrom = 0;
  private liftTo = 0;
  private grounded = false;
  private walls: MeshBVH | null = null;
  private water: MeshBVH | null = null;
  private keys = new Set<string>();
  private stick = { x: 0, y: 0 };
  private ray = new Ray();
  /** Set while a "go to" glide is running. */
  private glide: { from: Vector3; to: Vector3; yaw0: number; yaw1: number; p0: number; p1: number; t: number; dur: number } | null = null;
  onMove?: () => void;
  /** Gate leaves and anything else that moves: checked every step on top of the static walls. */
  segments: () => Segment[] = () => [];

  constructor(private camera: PerspectiveCamera, private dom: HTMLElement) {
    addEventListener('keydown', e => {
      if ((e.target as HTMLElement)?.closest?.('input, select, textarea')) return;
      if (e.code === 'Space' && !e.repeat) this.jump();
      this.keys.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code) && document.activeElement === dom) e.preventDefault();
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    dom.addEventListener('mousemove', e => {
      if (document.pointerLockElement !== dom || this.mode !== 'walk') return;
      this.look(e.movementX * 0.0022, e.movementY * 0.0022);
    });
  }

  look(dx: number, dy: number) {
    this.yaw -= dx;
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch - dy));
    this.glide = null;
  }

  /** The static collider (for the sky-visibility bake). */
  get wallsBVH() { return this.walls; }

  setStick(x: number, y: number) { this.stick.x = x; this.stick.y = y; }

  /** Rebuild the colliders from what's visible now (scenario and options change what you bump into). */
  rebuild(root: Object3D) {
    const walls: Mesh[] = [], water: Mesh[] = [];
    root.updateMatrixWorld(true);
    root.traverseVisible(o => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      if (m.userData.water) { water.push(m); return; }
      if (m.userData.gateLeaf) return;   // gates move: handled as segments
      if ((m.userData.collide === false && !m.userData.window) || m.userData.lod === 'far') return;
      walls.push(m);
    });
    // only the lot and its surroundings need to be walkable; the far bank stays GPU-only
    const limit = new Box3(new Vector3(-60, -10, -60), new Vector3(60, 30, 60));
    this.walls = buildBVH(walls, limit);
    this.water = buildBVH(water, limit);
  }

  private groundAt(x: number, z: number, fromY: number) {
    if (!this.walls) return -Infinity;
    this.ray.origin.set(x, fromY, z); this.ray.direction.set(0, -1, 0);
    const hit = this.walls.raycastFirst(this.ray, DoubleSide);
    return hit ? hit.point.y : -Infinity;
  }

  private waterAt(x: number, z: number, fromY: number) {
    if (!this.water) return -Infinity;
    this.ray.origin.set(x, fromY, z); this.ray.direction.set(0, -1, 0);
    const hit = this.water.raycastFirst(this.ray, DoubleSide);
    return hit ? hit.point.y : -Infinity;
  }

  /** The floor height you could stand on at (x, z), or null: no floor, under water, or down in the canal (Round 13). */
  walkableAt(x: number, z: number, fromY = 4.5) {
    const g = this.groundAt(x, z, fromY);
    if (!Number.isFinite(g) || g < 1.0) return null;
    const w = this.waterAt(x, z, fromY);
    if (Number.isFinite(w) && w > g - 0.01) return null;
    return g;
  }
  /** Where the walker last stood on solid ground (for leaving drone mode somewhere sensible). */
  readonly lastStood = new Vector3(1.3, 2.37, 2.6);

  /** Put the walker on the floor under (x, z) near height y, facing the given direction. */
  place(x: number, y: number, z: number, yaw: number, pitch = 0, eyeY?: number) {
    const g = this.groundAt(x, z, y + 0.5);
    this.feet.set(x, Number.isFinite(g) ? g : y, z);
    this.yaw = yaw; this.pitch = pitch; this.vy = 0; this.glide = null;
    this.lift = eyeY === undefined ? 0 : liftFor(eyeY - this.feet.y);
    this.apply();
  }

  /** Glide to a spot (used by "go to" and the render buttons). */
  glideTo(to: Vector3, yaw: number, pitch: number, dur = 1.4, eyeY?: number) {
    const g = this.groundAt(to.x, to.z, to.y + 0.6);
    const target = new Vector3(to.x, Number.isFinite(g) ? g : to.y, to.z);
    this.liftFrom = this.lift; this.liftTo = eyeY === undefined ? 0 : liftFor(eyeY - target.y);
    let y1 = yaw;
    while (y1 - this.yaw > Math.PI) y1 -= Math.PI * 2;
    while (y1 - this.yaw < -Math.PI) y1 += Math.PI * 2;
    this.glide = { from: this.feet.clone(), to: target, yaw0: this.yaw, yaw1: y1, p0: this.pitch, p1: pitch, t: 0, dur };
  }

  /** Resolve the capsule against the walls. The bottom sphere sits STEP above the feet so steps don't block. */
  private push(p: Vector3) {
    if (!this.walls) return;
    _seg.start.set(p.x, p.y + STEP + RADIUS, p.z);
    _seg.end.set(p.x, p.y + EYE - 0.05, p.z);
    _box.makeEmpty(); _box.expandByPoint(_seg.start); _box.expandByPoint(_seg.end);
    _box.min.addScalar(-RADIUS); _box.max.addScalar(RADIUS);
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      this.walls.shapecast({
        intersectsBounds: b => b.intersectsBox(_box),
        intersectsTriangle: t => {
          const d = t.closestPointToSegment(_seg, _v, _v2);
          if (d < RADIUS) {
            const dir = _v2.sub(_v); dir.y = 0;    // walls push sideways only; floors are the ray's job
            if (dir.lengthSq() < 1e-8) return;
            dir.normalize();
            const depth = RADIUS - d;
            _seg.start.addScaledVector(dir, depth); _seg.end.addScaledVector(dir, depth);
            moved = true;
          }
        },
      });
      if (!moved) break;
    }
    p.x = _seg.start.x; p.z = _seg.start.z;
    // moving obstacles, in plan: push the capsule's circle out of each strip it overlaps at this height
    for (const s of this.segments()) {
      if (p.y + EYE < s.y0 || p.y + STEP > s.y1) continue;
      const ax = s.a.x, az = s.a.z, dx = s.b.x - ax, dz = s.b.z - az;
      const len2 = dx * dx + dz * dz || 1e-6;
      const t = Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.z - az) * dz) / len2));
      let nx = p.x - (ax + dx * t), nz = p.z - (az + dz * t);
      const d = Math.hypot(nx, nz), min = RADIUS + 0.03;
      if (d >= min) continue;
      if (d < 1e-5) { nx = -dz; nz = dx; } // dead centre: pick the leaf's normal
      const n = Math.hypot(nx, nz);
      p.x += (nx / n) * (min - d); p.z += (nz / n) * (min - d);
    }
  }

  jump() {
    if (this.mode !== 'walk' || !this.grounded || this.glide) return;
    this.vy = Math.sqrt(2 * GRAVITY * JUMP);
    this.grounded = false;
  }

  get onGround() { return this.grounded; }

  update(dt: number) {
    if (this.glide) {
      const g = this.glide;
      g.t = Math.min(1, g.t + dt / g.dur);
      const e = g.t < 0.5 ? 4 * g.t ** 3 : 1 - (-2 * g.t + 2) ** 3 / 2;
      this.feet.lerpVectors(g.from, g.to, e);
      this.yaw = g.yaw0 + (g.yaw1 - g.yaw0) * e;
      this.pitch = g.p0 + (g.p1 - g.p0) * e;
      this.lift = this.liftFrom + (this.liftTo - this.liftFrom) * e;
      if (g.t >= 1) this.glide = null;
      this.apply();
      return;
    }
    if (this.mode !== 'walk') return;
    dt = Math.min(dt, 0.05);
    const k = this.keys;
    let fx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0) + this.stick.x;
    let fz = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) + this.stick.y;
    const len = Math.hypot(fx, fz);
    if (len > 1) { fx /= len; fz /= len; }
    const speed = (k.has('ShiftLeft') || k.has('ShiftRight') || Math.hypot(this.stick.x, this.stick.y) > 0.92 ? RUN : WALK);
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    // forward is -Z rotated by yaw
    const dx = (fx * cos - fz * sin) * speed * dt, dz = (-fx * sin - fz * cos) * speed * dt;
    const before = this.feet.clone();
    // walking (or jumping) eases a "go to" view height back to standing height
    if ((dx || dz || this.vy > 0) && this.lift) { this.lift *= Math.exp(-dt * 5); if (Math.abs(this.lift) < 0.005) this.lift = 0; }
    if (dx || dz) {
      const next = this.feet.clone(); next.x += dx; next.z += dz;
      this.push(next);
      // no walking onto water: test the spot, then each axis on its own so you slide along the coping
      const blocked = (p: Vector3) => {
        const w = this.waterAt(p.x, p.z, p.y + STEP + 0.3);
        if (!Number.isFinite(w)) return false;
        const gr = this.groundAt(p.x, p.z, p.y + STEP + 0.3);
        return w > gr - 0.01;
      };
      if (blocked(next)) {
        const a = this.feet.clone(); a.x = next.x;
        const b = this.feet.clone(); b.z = next.z;
        if (!blocked(a)) next.copy(a); else if (!blocked(b)) next.copy(b); else next.copy(this.feet);
      }
      this.feet.x = next.x; this.feet.z = next.z;
    }
    // floor: anything up to STEP above the feet is a step; below, fall under gravity
    const g = this.groundAt(this.feet.x, this.feet.z, this.feet.y + STEP + 0.02);
    if (Number.isFinite(g) && g >= this.feet.y - 0.06 && this.vy <= 0) {
      this.feet.y = g; this.vy = 0; this.grounded = true;
      if (g >= 1.0) this.lastStood.copy(this.feet);
    } else {
      this.grounded = false;
      this.vy -= GRAVITY * dt;
      this.feet.y += this.vy * dt;
      if (Number.isFinite(g) && this.feet.y <= g) { this.feet.y = g; this.vy = 0; this.grounded = true; }
      if (this.feet.y < -20) { this.feet.copy(before); this.vy = 0; }
    }
    this.apply();
    if (dx || dz) this.onMove?.();
  }

  apply() {
    if (this.mode !== 'walk' && !this.glide) return;
    this.camera.position.set(this.feet.x, this.feet.y + EYE + this.lift, this.feet.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  get eye() { return EYE; }
}
