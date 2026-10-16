// Sky visibility for the lot (Round 11). The environment light (sky + ground IBL) reached every surface in full,
// so narrow spaces like the side passage and play area were lit like open lawn: too bright and too blue (bark
// measured 66,70,79 where Cycles has 33,29,27). A top-down height map of the lot is ray-cast once after loading,
// and each cell gets the share of the sky it can see (horizon search in 16 directions, cosine weighted). Surfaces
// well below a cell's top (under a roof) count as covered. Only the environment light is scaled; the sun and its
// shadows are untouched.
import { DataTexture, DoubleSide, LinearFilter, Ray, RGBAFormat, Vector3, type Mesh, type Object3D, type Texture } from 'three/webgpu';
import { float, mix, pmremTexture, positionWorld, smoothstep, texture, vec2 } from 'three/tsl';
import type { MeshBVH } from 'three-mesh-bvh';

const X0 = -30, Z0 = -32, SIZE_X = 62, SIZE_Z = 58, CELL = 0.35;
const NX = Math.ceil(SIZE_X / CELL), NZ = Math.ceil(SIZE_Z / CELL);
const H0 = -2, HRANGE = 16;   // heights stored in 8 bits over -2..14 m
/** How much sky a surface under a roof still gets (from the open sides). */
const COVERED = 0.3;

export const SKYVIS_OFF = new URLSearchParams(location.search).has('skyvis0');

export class SkyVis {
  readonly tex: DataTexture;
  private data: Uint8Array;

  constructor() {
    this.data = new Uint8Array(NX * NZ * 4);
    for (let i = 0; i < NX * NZ; i++) { this.data[i * 4] = 255; this.data[i * 4 + 1] = 0; this.data[i * 4 + 3] = 255; }
    this.tex = new DataTexture(this.data, NX, NZ, RGBAFormat);
    this.tex.magFilter = LinearFilter; this.tex.minFilter = LinearFilter;
    this.tex.needsUpdate = true;
  }

  /** The visibility factor for the environment light at this fragment (1 outside the lot). */
  factor() {
    const wp = positionWorld;
    const uv = vec2(wp.x.sub(X0).div(NX * CELL), wp.z.sub(Z0).div(NZ * CELL));
    const s = texture(this.tex, uv);
    const top = s.g.mul(HRANGE).add(H0);
    const covered = smoothstep(top.sub(0.4), top.sub(1.2), wp.y);
    const v = mix(s.r, float(COVERED), covered);
    const inside = smoothstep(0, 0.02, uv.x).mul(smoothstep(1, 0.98, uv.x)).mul(smoothstep(0, 0.02, uv.y)).mul(smoothstep(1, 0.98, uv.y));
    return mix(float(1), v, inside);
  }

  /** Scale the environment light of every lit material under `root` (water and the far bank excluded). */
  apply(root: Object3D, env: Texture, toNode: (m: any) => any) {
    if (SKYVIS_OFF) return;
    const node = pmremTexture(env).mul(this.factor());
    const conv = new Map<object, any>();
    root.traverse(o => {
      const m = o as Mesh;
      if (!m.isMesh || Array.isArray(m.material) || m.userData.water || m.userData.lod === 'far') return;
      const src = m.material as any;
      if (!src || src.lights === false || src.isMeshBasicMaterial || src.envMap) return;
      let n = conv.get(src);
      if (!n) {
        n = src.isNodeMaterial ? src : toNode(src);
        if (n && !n.envNode && n.lights !== false) n.envNode = node;
        conv.set(src, n);
      }
      if (n) m.material = n;
    });
  }

  /** Ray-cast the height map and the horizon of every cell. Yields between rows so a frame never stalls. */
  async bake(bvh: MeshBVH, yieldFn: () => Promise<void>) {
    const t0 = performance.now();
    const H = new Float32Array(NX * NZ), ray = new Ray(new Vector3(), new Vector3(0, -1, 0));
    for (let j = 0; j < NZ; j++) {
      for (let i = 0; i < NX; i++) {
        ray.origin.set(X0 + (i + 0.5) * CELL, 30, Z0 + (j + 0.5) * CELL);
        const hit = bvh.raycastFirst(ray, DoubleSide);
        H[j * NX + i] = hit ? hit.point.y : 0;
      }
      if (j % 16 === 15) await yieldFn();
    }
    const dirs = 16, steps = [0.35, 0.7, 1.05, 1.4, 1.9, 2.5, 3.2, 4.0, 5.0, 6.5, 8.5];
    const dx = Array.from({ length: dirs }, (_, k) => Math.cos((k / dirs) * Math.PI * 2));
    const dz = Array.from({ length: dirs }, (_, k) => Math.sin((k / dirs) * Math.PI * 2));
    for (let j = 0; j < NZ; j++) {
      for (let i = 0; i < NX; i++) {
        const h = H[j * NX + i] + 0.05;
        let occl = 0;
        for (let k = 0; k < dirs; k++) {
          let s2 = 0;
          for (const d of steps) {
            const ii = Math.round(i + (dx[k] * d) / CELL), jj = Math.round(j + (dz[k] * d) / CELL);
            if (ii < 0 || jj < 0 || ii >= NX || jj >= NZ) break;
            const rise = H[jj * NX + ii] - h;
            if (rise > 0) { const sin2 = (rise * rise) / (rise * rise + d * d); if (sin2 > s2) s2 = sin2; }
          }
          occl += s2;
        }
        const vis = 1 - occl / dirs;
        const o = (j * NX + i) * 4;
        this.data[o] = Math.round(Math.max(0, Math.min(1, vis)) * 255);
        this.data[o + 1] = Math.round(Math.max(0, Math.min(1, (H[j * NX + i] - H0) / HRANGE)) * 255);
      }
      if (j % 32 === 31) await yieldFn();
    }
    this.tex.needsUpdate = true;
    return performance.now() - t0;
  }
}
