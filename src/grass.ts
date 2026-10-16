// Lawn close up. Two parts:
//  1. Every quality: the lawn texture gets large, soft colour variation (greener and drier patches) so the
//     2 m tile doesn't read as one repeated mat.
//  2. High / Ultra: short instanced grass tufts scattered over the lawn's top faces, in 4 m cells. Only cells
//     near the viewer are drawn, and the blades sink into the ground with distance so they fade into the
//     texture instead of ending in a hard line. They sway a little and receive the sun's shadow.
import {
  BufferAttribute, BufferGeometry, Color, DoubleSide, InstancedMesh, Matrix4, Mesh, MeshStandardNodeMaterial, Object3D, Quaternion, Vector3,
  type Material,
} from 'three/webgpu';
import { attribute, cameraPosition, cos, float, materialColor, mix, mx_noise_float, positionLocal, positionWorld, sin, smoothstep, time, uniform, vec3 } from 'three/tsl';

const CELL = 4;

/** One tuft: 12 blades of two segments each, leaning a little, heights 4 to 9 cm. `lift` = height above the root. */
function tuftGeometry() {
  const pos: number[] = [], lift: number[] = [], tip: number[] = [], idx: number[] = [];
  let v = 0;
  const rnd = mulberry(7);
  for (let b = 0; b < 12; b++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 0.05;
    const x0 = Math.cos(a) * r, z0 = Math.sin(a) * r;
    const h = 0.035 + rnd() * 0.045, w = 0.004 + rnd() * 0.0025;
    const face = rnd() * Math.PI, lean = (rnd() - 0.3) * 0.4 * h, la = rnd() * Math.PI * 2;
    const dx = Math.cos(face) * w, dz = Math.sin(face) * w;
    const lx = Math.cos(la) * lean, lz = Math.sin(la) * lean;
    // root pair, mid pair, tip
    const pts: [number, number, number, number][] = [
      [x0 - dx, 0, z0 - dz, 0], [x0 + dx, 0, z0 + dz, 0],
      [x0 - dx * 0.7 + lx * 0.35, h * 0.55, z0 - dz * 0.7 + lz * 0.35, 0.55], [x0 + dx * 0.7 + lx * 0.35, h * 0.55, z0 + dz * 0.7 + lz * 0.35, 0.55],
      [x0 + lx, h, z0 + lz, 1],
    ];
    for (const [x, y, z, t] of pts) { pos.push(x, y, z); lift.push(y); tip.push(t); }
    idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2, v + 2, v + 3, v + 4);
    v += 5;
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  // every blade lit like the ground it grows from, so the lawn and its blades shade the same way
  g.setAttribute('normal', new BufferAttribute(new Float32Array(pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.setAttribute('lift', new BufferAttribute(new Float32Array(lift), 1));
  g.setAttribute('tip', new BufferAttribute(new Float32Array(tip), 1));
  g.setIndex(idx);
  return g;
}

function mulberry(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

type Cell = { mesh: InstancedMesh; center: Vector3; owner: Object3D };

export class Grass {
  readonly group = new Object3D();
  private cells: Cell[] = [];
  readonly radius = uniform(12);
  /** Average linear albedo of the lawn texture (set from the texture when the model loads). */
  readonly lawnAvg = uniform(new Color(0.12, 0.16, 0.05));
  private material: MeshStandardNodeMaterial;
  private geo = tuftGeometry();

  constructor() {
    this.group.name = 'grass_blades';
    const m = new MeshStandardNodeMaterial();
    m.side = DoubleSide;
    m.roughness = 0.85;
    const lift = attribute('lift', 'float'), tip = attribute('tip', 'float');
    const p = positionLocal;   // instance matrices are world-space and the cells sit at the origin
    const d = p.sub(cameraPosition).length();
    const f = smoothstep(this.radius, this.radius.mul(0.55), d);
    const t = time;
    const sway = vec3(sin(t.mul(1.7).add(p.x.mul(1.3)).add(p.z.mul(0.7))), 0, cos(t.mul(1.3).add(p.z.mul(1.1)).add(p.x.mul(0.4))))
      .mul(0.012).mul(tip.mul(tip)).mul(f);
    // sink the blade into the ground as it fades, a touch below the surface so it never z-fights the lawn
    m.positionNode = p.add(sway).sub(vec3(0, lift.mul(float(1).sub(f)).add(float(1).sub(f).mul(0.004)), 0));
    const patch = mx_noise_float(vec3(p.x.mul(0.35), 0, p.z.mul(0.35))).mul(0.5).add(0.5);
    const fine = mx_noise_float(vec3(p.x.mul(4.1), 1.7, p.z.mul(4.1))).mul(0.5).add(0.5);
    // root a little darker than the lawn texture's average colour, tips lighter and slightly greener
    const avg = this.lawnAvg as any;
    const root = avg.mul(0.6), tipCol = mix(avg.mul(vec3(1.0, 1.32, 1.1)), avg.mul(vec3(1.2, 1.28, 0.95)), patch);
    m.colorNode = mix(root, tipCol, tip.pow(0.8)).mul(mix(float(0.85), float(1.12), fine));
    this.material = m;
  }

  /** Read the lawn texture's average colour so the blades match the ground they grow from. */
  matchTexture(material: any) {
    const img = material?.map?.image as CanvasImageSource | undefined;
    if (!img) return;
    try {
      const c = new OffscreenCanvas(32, 32), ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0, 32, 32);
      const d = ctx.getImageData(0, 0, 32, 32).data;
      const lin = (v: number) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < d.length; i += 4) { r += lin(d[i]); g += lin(d[i + 1]); b += lin(d[i + 2]); }
      const n = d.length / 4, col = material.color ?? new Color(1, 1, 1);
      this.lawnAvg.value.setRGB((r / n) * col.r, (g / n) * col.g, (b / n) * col.b);
    } catch { /* keep the default green */ }
  }

  /** Scatter tufts over the up-facing triangles of the lawn meshes, `density` per m². */
  async build(lawns: Mesh[], density: number) {
    for (const c of this.cells) { this.group.remove(c.mesh); c.mesh.dispose(); }
    this.cells = [];
    if (density <= 0) return;
    const rnd = mulberry(1234);
    const a = new Vector3(), b = new Vector3(), c = new Vector3(), e1 = new Vector3(), e2 = new Vector3(), n = new Vector3(), pt = new Vector3();
    const q = new Quaternion(), up = new Vector3(0, 1, 0), s = new Vector3(1, 1, 1), mtx = new Matrix4();
    for (const lawn of lawns) {
      await new Promise(r => setTimeout(r, 0));   // one lawn per task, so building never stalls a frame for long
      lawn.updateWorldMatrix(true, false);
      const g = lawn.geometry, pos = g.getAttribute('position'), index = g.index;
      const count = index ? index.count : pos.count;
      const buckets = new Map<string, Matrix4[]>();
      for (let i = 0; i < count; i += 3) {
        a.fromBufferAttribute(pos as any, index ? index.getX(i) : i).applyMatrix4(lawn.matrixWorld);
        b.fromBufferAttribute(pos as any, index ? index.getX(i + 1) : i + 1).applyMatrix4(lawn.matrixWorld);
        c.fromBufferAttribute(pos as any, index ? index.getX(i + 2) : i + 2).applyMatrix4(lawn.matrixWorld);
        e1.subVectors(b, a); e2.subVectors(c, a); n.crossVectors(e1, e2);
        const area = n.length() / 2;
        if (area < 1e-4 || n.normalize().y < 0.85) continue;
        let k = area * density;
        let num = Math.floor(k); if (rnd() < k - num) num++;
        for (let j = 0; j < num; j++) {
          let u = rnd(), v = rnd(); if (u + v > 1) { u = 1 - u; v = 1 - v; }
          pt.copy(a).addScaledVector(e1, u).addScaledVector(e2, v);
          q.setFromAxisAngle(up, rnd() * Math.PI * 2);
          const sc = 0.75 + rnd() * 0.55; s.set(sc, 0.7 + rnd() * 0.6, sc);
          mtx.compose(pt, q, s);
          const key = `${Math.floor(pt.x / CELL)},${Math.floor(pt.z / CELL)}`;
          if (!buckets.has(key)) buckets.set(key, []);
          buckets.get(key)!.push(mtx.clone());
        }
      }
      for (const [key, mats] of buckets) {
        const im = new InstancedMesh(this.geo, this.material as unknown as Material, mats.length);
        mats.forEach((m, i) => im.setMatrixAt(i, m));
        im.instanceMatrix.needsUpdate = true;
        im.frustumCulled = false;
        im.castShadow = false; im.receiveShadow = true;
        im.userData.collide = false;
        const [cx, cz] = key.split(',').map(Number);
        const center = new Vector3((cx + 0.5) * CELL, mats[0].elements[13], (cz + 0.5) * CELL);
        im.visible = false;
        this.group.add(im);
        this.cells.push({ mesh: im, center, owner: lawn });
      }
    }
  }

  /** Show the cells near the camera whose lawn is visible. */
  update(camera: Object3D, enabled: boolean) {
    const r = this.radius.value + CELL;
    for (const c of this.cells) {
      let vis = enabled && c.owner.visible && c.center.distanceTo(camera.position) < r;
      if (vis) { let o: Object3D | null = c.owner.parent; while (o) { if (!o.visible) { vis = false; break; } o = o.parent; } }
      c.mesh.visible = vis;
    }
  }

  get count() { return this.cells.reduce((n, c) => n + c.mesh.count, 0); }
}

/** World-space patchiness for the lawn texture: greener and drier patches over a few metres, finer mottling. */
export const lawnColor = () => {
  const p = positionWorld;
  const big = mx_noise_float(vec3(p.x.mul(0.18), 0.3, p.z.mul(0.18))).mul(0.5).add(0.5);
  const mid = mx_noise_float(vec3(p.x.mul(0.9), 2.1, p.z.mul(0.9))).mul(0.5).add(0.5);
  const dry = vec3(1.06, 1.0, 0.85), lush = vec3(0.9, 1.04, 0.9);
  return materialColor.mul(vec3(0.94, 1.06, 1.0)).mul(mix(lush, dry, big)).mul(mix(float(0.9), float(1.08), mid));
};
