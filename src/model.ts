// The GLB from the-pool's export_web.py plus lights.json, set up for the walkthrough: materials, water,
// caustics, the lighting scheme and fire pit for after dark, and Today / Proposed / option switching.
//
// Node extras from the export: set (existing | proposed | both), option (roller_*, kitchen_*, gate_*),
// people, night (light fittings), collide, lod ("far"), water (pool | spa | canal), window.
import {
  AdditiveBlending, Box3, Matrix4, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, InstancedMesh, Mesh, MeshBasicNodeMaterial, MeshStandardNodeMaterial, Object3D, PointLight, RectAreaLight, SpotLight, Vector3,
  type Light, type Material, type Texture, type WebGPURenderer, RectAreaLightNode,
} from 'three/webgpu';
import { abs, clamp, dot, float, floor, fract, fwidth, sin, materialColor, mix, normalWorld, smoothstep, uv, vec2, mx_noise_float, positionLocal, time, uniform, vec3 } from 'three/tsl';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RectAreaLightTexturesLib } from 'three/addons/lights/RectAreaLightTexturesLib.js';
import { FAR_LAYER, Mirror } from './mirror';
import { Grass, lawnColor } from './grass';
import { softenFarTrees } from './trees';
import { mergeStatic } from './merge';
import { causticsAlbedo, waterMaterial, type WaterKind } from './water';
import type { Atmosphere } from './atmosphere';

export type LightDef = {
  name: string; type: 'POINT' | 'SPOT' | 'AREA'; position: number[]; direction: number[]; color: number[];
  power: number; xaxis?: number[]; spotAngle?: number; spotBlend?: number; size?: number; sizeY?: number; set?: string; option?: string;
};
export type CameraDef = { name: string; pos: number[]; target: number[]; lens: number };
export type Scenario = 'existing' | 'proposed';

// Blender watts -> three's units in the same radiometric scale as the sun (strength 6.5): W / 4π for points
// and spots; area lights emit from one side, so W / (π · area) as radiance.
type AnyLight = Light & { shadow?: any };
const POINT_SCALE = 1 / (4 * Math.PI);
const KEY_SHADOW_LIGHTS = ['led_firepit_light', 'alfresco_downlight_1', 'alfresco_downlight_0+1'];

/** Merge lights of the given name prefixes two at a time (sorted by name): mean position and direction, summed power. */
function pairUp(defs: LightDef[], prefixes: string[]) {
  const out: LightDef[] = [];
  for (const p of prefixes) {
    const group = defs.filter(d => d.name.startsWith(p)).sort((a, b) => a.name.localeCompare(b.name));
    for (let i = 0; i < group.length; i += 2) {
      const a = group[i], b = group[i + 1];
      if (!b) { out.push(a); continue; }
      const mid = (x: number[], y: number[]) => x.map((v, k) => (v + y[k]) / 2);
      out.push({ ...a, name: `${a.name}+${b.name.split('_').pop()}`, position: mid(a.position, b.position), direction: mid(a.direction, b.direction),
        power: a.power + b.power, spotAngle: Math.max(a.spotAngle ?? 1, b.spotAngle ?? 1) * 1.15 });
    }
  }
  return [...defs.filter(d => !prefixes.some(p => d.name.startsWith(p))), ...out];
}
/** ?lightswap=1: the old behaviour (night lights made visible at dusk), for A/B. */
export const LIGHT_SWAP = new URLSearchParams(location.search).has('lightswap');

const INHERIT = ['set', 'option', 'people', 'night', 'collide', 'lod', 'water', 'window'];

/** The export's water bodies are closed solids; keep only the surface you look at (faces pointing up). */
function topFaces(mesh: Mesh) {
  const g = mesh.geometry as BufferGeometry, p = g.getAttribute('position'), idx = g.index;
  const n = idx ? idx.count : p.count;
  const a = new Vector3(), b = new Vector3(), c = new Vector3(), wa = new Vector3(), wb = new Vector3(), wc = new Vector3();
  const out: number[] = [];
  mesh.updateWorldMatrix(true, false);
  for (let i = 0; i < n; i += 3) {
    a.fromBufferAttribute(p, idx ? idx.getX(i) : i); b.fromBufferAttribute(p, idx ? idx.getX(i + 1) : i + 1); c.fromBufferAttribute(p, idx ? idx.getX(i + 2) : i + 2);
    wa.copy(a).applyMatrix4(mesh.matrixWorld); wb.copy(b).applyMatrix4(mesh.matrixWorld); wc.copy(c).applyMatrix4(mesh.matrixWorld);
    const nrm = wb.sub(wa).cross(wc.sub(wa)).normalize();
    if (nrm.y > 0.7) out.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  }
  if (!out.length) return;
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(out, 3));
  geo.computeVertexNormals();
  mesh.geometry = geo;
}

export type Gate = { leaf: Object3D; pivot: Group; hinge: Vector3; dir: Vector3; width: number; swing: number;
  angle: number; from: number; to: number; t: number; clear: number };
const UP = new Vector3(0, 1, 0);
const isAncestor = (a: Object3D, b: Object3D) => { let o: Object3D | null = b.parent; while (o) { if (o === a) return true; o = o.parent; } return false; };

/**
 * The export has 178 materials, 133 of them flat colours, many identical apart from their name. Every
 * distinct material is its own shader and pipeline, so share one material per identical flat colour.
 * Only plain opaque "flat" materials are merged; glass, water, LEDs, the lawn and anything textured
 * keep their own, because the viewer customises those individually.
 */
function dedupeMaterials(root: Object3D) {
  const canon = new Map<string, Material>();
  const all = new Set<Material>();
  root.traverse(o => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const out = list.map((m: any) => {
      const k = m.userData?.kind ?? m.userData?.web_kind;
      if (k !== 'flat' || m.map || m.normalMap || m.transparent || m.alphaTest > 0 || m.name === 'lawn' || /canopy/i.test(m.name) || m.userData?.led) { all.add(m); return m; }
      const e = m.emissive as Color | undefined;
      const key = [m.type, m.color.getHexString(), m.roughness.toFixed(3), m.metalness.toFixed(3), m.side, m.vertexColors,
        e ? e.getHexString() : '', m.emissiveIntensity, m.ior ?? '', m.specularIntensity ?? '', m.flatShading].join('|');
      let c = canon.get(key);
      if (!c) { c = m; canon.set(key, m); }
      all.add(c!);
      return c!;
    });
    mesh.material = Array.isArray(mesh.material) ? out : out[0];
  });
  return all.size;
}

/**
 * Tile joints that stay visible at any distance. The coping and the existing pavers have joints baked into
 * their textures (mats.py tiles_overlay), but at 3 px wide in a 1024 px tile they mip away to nothing a few
 * metres off. This draws the same grid analytically in the texture's own UV metres (joints at multiples of the
 * tile size, as the baked overlay), anti-aliased with fwidth, so a joint fades to a faint line rather than
 * vanishing. Ground faces only. ?joints0=1 turns it off.
 */
const JOINTS: Record<string, { tile: number; width: number; grout: [number, number, number] }> = {
  coping: { tile: 0.4, width: 0.009, grout: [0.2, 0.195, 0.185] },
  pavers_existing: { tile: 0.4, width: 0.01, grout: [0.26, 0.22, 0.17] },
};
const DUSK0 = new URLSearchParams(location.search).has('dusk0');
const NO_JOINTS = new URLSearchParams(location.search).has('joints0');
function tileJoints(base: any, j: { tile: number; width: number; grout: [number, number, number] }) {
  const u = uv().div(j.tile);
  const d = abs(fract(u.add(0.5)).sub(0.5));             // distance to the nearest joint, in tiles
  const fw = fwidth(u).max(1e-5);
  const half = vec2(j.width / j.tile / 2);
  const line = float(1).sub(smoothstep(half, half.add(fw.mul(1.2)), d).x.mul(smoothstep(half, half.add(fw.mul(1.2)), d).y));
  // a joint thinner than a pixel still darkens a little (its coverage), so the grid reads at a distance
  const coverage = clamp(half.x.div(fw.x.max(fw.y)).mul(1.6), 0.4, 1);
  const ground = smoothstep(0.6, 0.85, normalWorld.y);
  const grout = vec3(...j.grout);
  // each tile a touch lighter or darker, as laid stone is
  const cell = floor(u);
  const h = fract(sin(dot(cell, vec2(12.9898, 78.233))).mul(43758.5453));
  const tone = float(1).add(h.sub(0.5).mul(0.09).mul(ground));
  return mix(base.rgb.mul(tone), grout, line.mul(coverage).mul(ground).mul(0.9));
}

export class Model {
  readonly root = new Group();
  readonly nightLights: { light: AnyLight; base: number; def: LightDef }[] = [];
  readonly waters: Mesh[] = [];
  /** Lawn top surfaces the grass blades grow on. */
  readonly lawns: Mesh[] = [];
  readonly grass = new Grass();
  flames: Object3D | null = null;
  private ledMats: { mat: MeshStandardNodeMaterial; level: number }[] = [];
  readonly mirrors: Mirror[] = [];
  private fireFlicker = uniform(1);
  private shadowLights: AnyLight[] = [];
  bounds = new Box3();
  scenario: Scenario = 'proposed';
  roller = 'none';
  kitchen = 'kitchen_split';
  /** The east fence beside the pavilion pier: as drawn, a 1.8 m section, or taken round the pier. */
  pier = 'pier_as_drawn';
  /** The north pool fence across the side passage: as drawn, or moved 1.5 m north. */
  nfence = 'nfence_as_drawn';
  /** Side passage surface: existing pavers or new aggregate up to the play area. */
  passage = 'passage_pavers';
  people = true;   // the figures are there to judge scale, so they start on
  showFar = true;
  farReady = false;
  materialCount = 0;
  readonly gates: Gate[] = [];
  private wasOn = false;
  /** The night lights are always in the scene (only their intensity changes), so dusk never changes a shader. */
  lightsConstant = true;
  /** Pool fence infill: 'perforated' (the estimate) or 'glass' (SK02's frameless glass). */
  fence: 'perforated' | 'glass' = 'perforated';
  private fencePanels: { mesh: Mesh; perforated: Material }[] = [];
  private fenceGlass: MeshStandardNodeMaterial | null = null;

  constructor(private renderer: WebGPURenderer, private atm: Atmosphere) {
    RectAreaLightNode.setLTC(RectAreaLightTexturesLib.init());
  }

  /** Start downloading the model and lights. Doesn't need the renderer, so it runs while WebGPU starts up. */
  static fetch(base: string, onProgress: (f: number) => void) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    return Promise.all([
      loader.loadAsync(base + 'pool-model.glb', e => { if (e.total) onProgress(e.loaded / e.total); }),
      fetch(base + 'lights.json').then(r => (r.ok ? r.json() : [])).catch(() => []) as Promise<LightDef[]>,
    ]);
  }

  setup([gltf, lights]: [{ scene: Group }, LightDef[]], reflections: boolean, reflectionScale: number) {
    const scene = gltf.scene;
    scene.traverse(o => {
      // a node with several primitives becomes a Group of meshes: hand the node's extras down
      if (o.parent && o.parent !== scene) for (const k of INHERIT) if (o.userData[k] === undefined && o.parent.userData[k] !== undefined) o.userData[k] = o.parent.userData[k];
    });
    this.root.add(scene);
    this.root.add(this.grass.group);
    this.root.updateMatrixWorld(true);
    this.materialCount = dedupeMaterials(this.root);
    this.setupMaterials();
    this.setupGates();
    this.setupFence();
    this.setupWater(reflections, reflectionScale);
    this.setupLights(lights);
    if (!new URLSearchParams(location.search).has('merge0')) {
      const keep = new Set<Object3D>([...this.waters, ...this.lawns, ...this.fencePanels.map(p => p.mesh)]);
      if (this.flames) keep.add(this.flames);
      this.mergeStats = mergeStatic(this.root, this.root.children[0], keep);
    }
    this.setupMirrorSkips();
    this.bounds.setFromObject(this.root);
    this.apply();
  }

  mergeStats = { before: 0, after: 0 };
  /** The canal mirror leaves out our lot while the camera is in it (see Mirror.skip). Run after merging. */
  private setupMirrorSkips() {
    const canal = this.mirrors.find(m => m.meshes.some(w => w.userData.water === 'canal'));
    if (!canal || new URLSearchParams(location.search).has('canalyard')) return;
    // our lot north of the canal wall (z < 11): top-level nodes, so hiding them is a short loop
    const yard: Object3D[] = [], b = new Box3(), c = new Vector3();
    for (const o of this.root.children[0]?.children ?? []) {
      if (/^(ctx_|nb_)/.test(o.name) || o.userData.lod === 'far' || o.userData.water) continue;
      b.setFromObject(o); if (b.isEmpty()) continue;
      b.getCenter(c);
      if (c.z < 11 && b.max.z < 12.5 && c.x > -12 && c.x < 20) yard.push(o);
    }
    canal.skip = { objects: yard, when: cam => cam.position.z < 11 && cam.position.y < 8 };
  }

  /** Far trees are hidden for the first frame and softened afterwards (see trees.ts). */
  async finishFar() {
    if (this.farReady) return;
    const far = this.farCanopies();
    await softenFarTrees(far, this.atm.farSun);
    for (const m of far) m.layers.set(FAR_LAYER);   // so the pool mirror can skip them
    this.farReady = true;
    this.apply();
  }

  // ---------- gates ----------
  /**
   * Gate leaves carry extras gate, gate_hinge, gate_dir (closed leaf direction), gate_width and gate_swing in
   * three.js coordinates. The optimiser moved node origins, so each leaf is re-parented into a pivot group
   * at its hinge and swung by rotating the pivot about +Y.
   */
  private setupGates() {
    const leaves: Object3D[] = [];
    this.root.traverse(o => { if (o.userData.gate && !leaves.some(l => isAncestor(l, o))) leaves.push(o); });
    for (const leaf of leaves) {
      const u = leaf.userData;
      const hinge = new Vector3(...(u.gate_hinge as [number, number, number]));
      const pivot = new Group();
      pivot.name = leaf.name + '_pivot';
      pivot.position.copy(hinge);
      leaf.parent!.add(pivot);
      pivot.updateMatrixWorld(true);
      pivot.attach(leaf);
      leaf.traverse(m => { m.userData.gateLeaf = true; });
      this.gates.push({ leaf, pivot, hinge, dir: new Vector3(...(u.gate_dir as [number, number, number])).normalize(),
        width: u.gate_width ?? 0.86, swing: Math.sign(u.gate_swing ?? 1) || 1, angle: 0, from: 0, to: 0, t: 1, clear: 0 });
    }
  }

  private setupFence() {
    this.root.traverse(o => {
      const m = o as Mesh;
      if (m.isMesh && /^fence_pool_.*(infill|gate\d+_2)$/.test(m.name)) this.fencePanels.push({ mesh: m, perforated: m.material as Material });
    });
    const g = new MeshStandardNodeMaterial();
    g.color = new Color(0xa8c2bf);    // 12 mm toughened glass, seen edge-on it's green; face-on it's barely there
    g.roughness = 0.03; g.metalness = 0;
    g.transparent = true; g.opacity = 0.2; g.depthWrite = false; g.side = DoubleSide;
    this.fenceGlass = g;
  }

  /** Open (1) or close (0) a gate with a quick eased swing. */
  swingGate(g: Gate, open: boolean) {
    const to = open ? 1 : 0;
    if (g.to === to) return;
    g.from = g.angle; g.to = to; g.t = 0; g.clear = 0;
  }

  /** The leaf's current direction from the hinge. */
  gateDir(g: Gate, out = new Vector3()) {
    return out.copy(g.dir).applyAxisAngle(UP, g.swing * g.angle * Math.PI / 2);
  }

  gateVisible(g: Gate) {
    let o: Object3D | null = g.leaf;
    while (o) { if (!o.visible) return false; o = o.parent; }
    return true;
  }

  private updateGates(dt: number) {
    for (const g of this.gates) {
      if (g.t >= 1) continue;
      g.t = Math.min(1, g.t + dt / 0.6);
      const e = g.t < 0.5 ? 2 * g.t * g.t : 1 - (-2 * g.t + 2) ** 2 / 2;
      g.angle = g.from + (g.to - g.from) * e;
      g.pivot.rotation.y = g.swing * g.angle * Math.PI / 2;
    }
  }

  private farCanopies() {
    const out: InstancedMesh[] = [];
    this.root.traverse(o => {
      const m = o as InstancedMesh;
      if (m.isInstancedMesh && m.userData.lod === 'far' && /canopy/i.test(((m.material as any)?.name ?? '') + m.name)) out.push(m);
    });
    return out;
  }

  private toNode(m: Material): MeshStandardNodeMaterial {
    return (this.renderer as any).library.fromMaterial(m) as MeshStandardNodeMaterial;
  }

  private setupMaterials() {
    const converted = new Map<Material, MeshStandardNodeMaterial>();
    const conv = (m: Material) => { let n = converted.get(m); if (!n) { n = this.toNode(m); converted.set(m, n); } return n; };
    const maxAniso = this.renderer.getMaxAnisotropy?.() ?? 8;
    this.root.traverse(o => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      const u = mesh.userData;
      const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as any[];
      for (const m of mats) {
        for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap']) {
          const t = m[key] as Texture | null;
          if (t) t.anisotropy = Math.min(8, maxAniso);
        }
      }
      const kind = mats[0]?.userData?.kind ?? mats[0]?.userData?.web_kind;
      mesh.receiveShadow = true;
      mesh.castShadow = !(u.water || kind === 'water' || kind === 'glass' || u.lod === 'far');
      if (u.water) return;
      if (kind === 'glass' || u.window) {
        const n = conv(mats[0]);
        n.transparent = true;
        n.roughness = 0.04; n.metalness = 0;
        n.color = new Color(u.window ? 0x1b2227 : 0x9fb3b8);
        n.opacity = u.window ? 0.82 : 0.28;
        n.depthWrite = !!u.window;
        n.envMapIntensity = 1;
        if (u.window) {
          // lit rooms behind the glass after dark
          n.emissiveNode = DUSK0 ? vec3(1.0, 0.58, 0.28).mul(this.atm.nightU).mul(0.018) : vec3(1.0, 0.72, 0.45).mul(this.atm.nightU).mul(0.14);   // rooms lit behind the glass
        }
        mesh.material = n;
        return;
      }
      if (u.night || mats[0]?.userData?.led) {
        // the brick lights in the canal wall share the markers' material but should read as small, low-glare
        // step lights rather than headlights: their own copy, a much lower level, under the bloom threshold
        const wallLights = o.name.startsWith('led_wall_lights');
        const n = wallLights ? this.toNode(mats[0]) : conv(mats[0]);
        const e = (mats[0] as any).emissive as Color | undefined;
        const col = e && (e.r + e.g + e.b) > 0 ? e.clone() : new Color(1, 0.72, 0.45);
        const level = wallLights ? 1.1 : mats[0]?.userData?.ledLevel ?? (o.name.includes('flame') ? 1.6 : 9);
        n.emissiveNode = vec3(col.r, col.g, col.b).mul(float(level)).mul(this.atm.nightU).mul(o.name.includes('flame') ? this.fireFlicker : float(1));
        n.color = new Color(0x2a2a2a);
        mesh.material = n;
        mesh.castShadow = false;
        this.ledMats.push({ mat: n, level });
        if (o.name.startsWith('firepit_flames')) this.flames = mesh;
      }
      const joint = JOINTS[mats[0]?.name as string];
      if (joint && !NO_JOINTS) {
        const n = conv(mats[0]);
        if (!n.colorNode) n.colorNode = tileJoints(materialColor, joint);
        mesh.material = n;
      }
      if (mats[0]?.name === 'lawn') {
        const n = conv(mats[0]);
        if (!n.colorNode) n.colorNode = lawnColor();
        mesh.material = n;
        if (/lawn_grass$|lawn_kept_grass$|^front_lawn/.test(o.name)) this.lawns.push(mesh);
      }
      if (mats[0]?.alphaTest > 0) {
        mats[0].side = DoubleSide;
        (mats[0] as any).alphaToCoverage = true;
      }
    });
    // fire pit flames: the Blender cones, coloured from a hot yellow base to orange-red tips, fading out at the
    // top, with a noisy wobble and additive blending so they read as gas flame rather than solid shapes
    if (this.flames) {
      const mesh = this.flames as Mesh;
      // unlit: the fire pit's own point light sits inside the cones and would light them white
      const fm = new MeshBasicNodeMaterial();
      mesh.material = fm;
      mesh.geometry.computeBoundingBox();
      const bb = mesh.geometry.boundingBox!;
      const t = positionLocal.y.sub(bb.min.y).div(Math.max(0.01, bb.max.y - bb.min.y)).clamp(0, 1);
      const wob = mx_noise_float(vec3(positionLocal.x.mul(6), positionLocal.y.mul(4).sub(time.mul(3.1)), positionLocal.z.mul(6))).mul(0.045).mul(t);
      // taller than the Blender cones (the Cycles flames stand well above the rim): stretch up from the base
      const c = bb.getCenter(new Vector3());
      const stretch = DUSK0 ? positionLocal : vec3(positionLocal.x.sub(c.x).mul(1.15).add(c.x), positionLocal.y.sub(bb.min.y).mul(2.0).add(bb.min.y), positionLocal.z.sub(c.z).mul(1.15).add(c.z));
      fm.positionNode = stretch.add(vec3(wob, wob.abs().mul(0.6), wob.mul(0.8)));
      const hot = DUSK0 ? vec3(1.0, 0.62, 0.22) : vec3(1.0, 0.45, 0.12), tip = DUSK0 ? vec3(0.9, 0.22, 0.03) : vec3(0.75, 0.13, 0.02);
      // kept under the night bloom threshold so the tongues keep their shape instead of blooming white
      fm.colorNode = mix(hot, tip, t.pow(0.7)).mul(float(DUSK0 ? 2.6 : 3.2).mul(this.fireFlicker)).mul(this.atm.nightU).mul(float(1).sub(t.pow(2).mul(0.85)));
      fm.transparent = true; fm.depthWrite = false;
      if (DUSK0) fm.blending = AdditiveBlending;
      else {
        // solid orange tongues that thin out towards the tips (additive blending washed them into the lit bowl)
        fm.opacityNode = float(1).sub(t.pow(1.6)).mul(0.9).mul(this.atm.nightU);
        fm.side = DoubleSide;
      }
    }
  }

  private setupWater(reflections: boolean, scale: number) {
    const groups = new Map<WaterKind, Mesh[]>();
    this.root.traverse(o => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      let kind = m.userData.water as WaterKind | undefined;
      const mk = (m.material as any)?.userData?.kind ?? (m.material as any)?.userData?.web_kind;
      if (!kind && mk === 'water') kind = /canal/i.test(m.name) ? 'canal' : /spa/i.test(m.name) ? 'spa' : 'pool';
      if (!kind) return;
      m.userData.water = kind;
      m.userData.collide = false;
      topFaces(m);
      if (!groups.has(kind)) groups.set(kind, []);
      groups.get(kind)!.push(m);
    });
    // one planar reflection per water level (pool and spa share theirs when they sit at the same height)
    const levels: { y: number; kinds: WaterKind[] }[] = [];
    for (const [kind, meshes] of groups) {
      const y = new Box3().setFromObject(meshes[0]).max.y;
      // pool (2.22) and spa (2.26) share one mirror: 4 cm of plane offset is invisible, a whole scene render isn't
      const l = levels.find(l => Math.abs(l.y - y) < (new URLSearchParams(location.search).has('mirror3') ? 0.03 : 0.06));
      if (l) l.kinds.push(kind); else levels.push({ y, kinds: [kind] });
    }
    for (const l of levels) {
      let mirror: Mirror | null = null;
      if (reflections) {
        mirror = new Mirror(l.y);
        mirror.scale = l.kinds.includes('canal') ? scale * 0.7 : scale;
        mirror.farTrees = l.kinds.includes('canal') || new URLSearchParams(location.search).has('poolfar');
        this.mirrors.push(mirror);
      }
      for (const kind of l.kinds) {
        const mat = waterMaterial(kind, this.atm, mirror);
        for (const m of groups.get(kind)!) { m.material = mat; m.castShadow = false; m.receiveShadow = true; this.waters.push(m); mirror?.meshes.push(m); }
      }
    }
    // caustics on whatever sits under the pool and spa water
    const boxes = [...(groups.get('pool') ?? []), ...(groups.get('spa') ?? [])].map(w => {
      const b = new Box3().setFromObject(w);
      return { minX: b.min.x, maxX: b.max.x, minZ: b.min.z, maxZ: b.max.z, level: b.max.y };
    });
    if (!boxes.length) return;
    const done = new Set<Material>();
    this.root.traverse(o => {
      const m = o as Mesh;
      if (!m.isMesh || m.userData.water || m.userData.night) return;
      const b = new Box3().setFromObject(m);
      const hit = boxes.filter(x => b.min.y < x.level - 0.02 && b.max.x > x.minX && b.min.x < x.maxX && b.max.z > x.minZ && b.min.z < x.maxZ);
      if (!hit.length || (m.material as any).isNodeMaterial && done.has(m.material as Material)) return;
      const n = (m.material as any).isNodeMaterial ? (m.material as MeshStandardNodeMaterial) : this.toNode(m.material as Material);
      let c: any = materialColor;
      for (const x of hit) c = causticsAlbedo(c, x, this.atm.sunDirU);
      n.colorNode = c;
      m.material = n;
      done.add(n);
    });
  }

  private setupLights(defs: LightDef[]) {
    // Every light in the scene is in every shader (they're kept on all day, see update()), so fewer is better:
    // the four boundary uplights and the four skillion downlights become two of each, each pair a single light
    // midway between the two with their combined power. The look barely changes; the shaders get 4 lights smaller.
    if (!new URLSearchParams(location.search).has('lights13')) defs = pairUp(defs, ['led_uplight', 'alfresco_downlight']);
    for (const d of defs) {
      if (d.name.startsWith('int_light')) continue;   // interior lamps would shine through the walls; the windows glow instead
      const col = new Color(d.color[0], d.color[1], d.color[2]);
      const pos = new Vector3(...(d.position as [number, number, number]));
      let light: AnyLight;
      let base: number;
      if (d.type === 'SPOT') {
        const s = new SpotLight(col, 0, 18, (d.spotAngle ?? 1) / 2, d.spotBlend ?? 0.2, 2);
        s.position.copy(pos);
        s.target.position.copy(pos).add(new Vector3(...(d.direction as [number, number, number])));
        this.root.add(s.target);
        base = d.power * POINT_SCALE;
        light = s;
      } else if (d.type === 'AREA') {
        const w = Math.max(0.05, d.size ?? 0.5), h = Math.max(0.03, d.sizeY || d.size || 0.5);
        const r = new RectAreaLight(col, 0, w, h);
        r.position.copy(pos);
        r.lookAt(pos.clone().add(new Vector3(...(d.direction as [number, number, number]))));
        if (d.xaxis) {
          // lookAt can't know the strip's spin about its axis: build the basis from the exported long side, so the
          // 2.5 m bench strips run along their benches (one of them ran across its bench before)
          const z = new Vector3(...(d.direction as [number, number, number])).negate().normalize();
          const x = new Vector3(...(d.xaxis as [number, number, number])).normalize();
          const y = new Vector3().crossVectors(z, x).normalize();
          r.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(x, y, z));
        }
        // three's LTC area lights come out darker than Cycles' for a thin strip a few cm off the floor: x4 matches the
        // floor wash in the 19:40 and 21:00 renders
        base = d.power / (Math.PI * w * h) * (DUSK0 ? 1 : 4);
        light = r;
      } else {
        const p = new PointLight(col, 0, d.name.includes('pool') ? 9 : 14, 2);
        p.position.copy(pos);
        base = d.power * POINT_SCALE;
        light = p;
      }
      light.name = d.name;
      light.userData.set = d.set ?? 'proposed';
      if (d.option) light.userData.option = d.option;
      if (KEY_SHADOW_LIGHTS.includes(d.name) && light.shadow && !new URLSearchParams(location.search).has('nightshadow0')) {
        light.castShadow = true;
        light.shadow.mapSize.set(512, 512);
        light.shadow.bias = -0.002;
        light.shadow.autoUpdate = false;
        light.shadow.needsUpdate = true;
        this.shadowLights.push(light);
      }
      this.root.add(light);
      this.nightLights.push({ light, base, def: d });
    }
  }

  /** Called every frame: dusk fade, fire flicker, flame visibility. */
  update(night: number, t: number, dt = 0) {
    this.updateGates(dt);
    const flick = 0.82 + 0.1 * Math.sin(t * 13.1) + 0.06 * Math.sin(t * 23.7 + 1.3) + 0.05 * Math.sin(t * 7.3 + 0.4);
    this.fireFlicker.value = flick;
    // The set of visible lights is part of every material's shader key, so switching the lighting scheme on at
    // dusk by making lights visible rebuilt every shader in the scene (a 2 s stall, every time you crossed dusk).
    // So the lights stay in the scene all day and only their intensity goes to 0; likewise the flames, whose
    // emission is scaled by the night uniform. Their visibility only follows the scenario and options.
    const swap = LIGHT_SWAP || !this.lightsConstant;
    const on = night > 0.004;
    for (const { light, base, def } of this.nightLights) {
      const vis = (swap ? on : true) && this.visibleFor(light.userData);
      if (light.visible !== vis) { light.visible = vis; if (light.castShadow) light.shadow!.needsUpdate = true; }
      light.intensity = base * night * (def.name.startsWith('led_firepit') ? flick : 1);
    }
    // shadow maps of the night lights: refresh while they're fading in, then they're static
    if (on !== this.wasOn) { this.wasOn = on; for (const l of this.shadowLights) l.shadow!.needsUpdate = true; }
    if (this.flames) this.flames.visible = (swap ? on : true) && this.visibleFor(this.flames.userData);
  }

  visibleFor(u: Record<string, any>) {
    if (u.set && u.set !== 'both' && u.set !== this.scenario) return false;
    if (u.option) {
      if (this.scenario !== 'proposed') return false;
      const gate = this.kitchen === 'kitchen_continuous' ? 'gate_south' : 'gate_sk02';
      // "a+b" options (e.g. gate_sk02+pier_tall) show only when every part is chosen
      const chosen = [this.roller, this.kitchen, gate, this.pier, this.nfence, this.passage];
      if (!String(u.option).split('+').every(part => chosen.includes(part))) return false;
    }
    if (u.people && !this.people) return false;
    if (u.lod === 'far' && (!this.showFar || !this.farReady)) return false;
    return true;
  }

  /** Show the right objects for the scenario, options, people and quality. */
  apply() {
    this.root.traverse(o => {
      if (o === this.root || (o as any).isLight) return;
      const u = o.userData;
      if (u.set === undefined && u.option === undefined && u.people === undefined && u.lod === undefined) return;
      o.visible = this.visibleFor(u);
    });
    for (const l of this.shadowLights) l.shadow!.needsUpdate = true;
    for (const p of this.fencePanels) {
      p.mesh.material = this.fence === 'glass' && this.fenceGlass ? this.fenceGlass : p.perforated;
      p.mesh.castShadow = this.fence !== 'glass';
    }
  }

  /** Render the planar reflections whose water is on screen. */
  renderMirrors(renderer: WebGPURenderer, scene: any, camera: any, w: number, h: number, enabled = true) {
    // Shadow maps must not be drawn inside a mirror pass: the canal mirror hides our whole lot while it renders
    // (Mirror.skip), and a shadow map drawn then had no yard in it, so the sun cast no shadows in the yard.
    // Hold every pending shadow update until the main pass, which sees the whole scene.
    const stars = this.atm.starsU.value; this.atm.starsU.value = 0;   // stars reflected in rippling water glitter like noise
    const shadows = [this.atm.sun, ...this.shadowLights].map(l => (l as any).shadow).filter(Boolean);
    const pending = shadows.map(sh => sh.needsUpdate);
    for (const sh of shadows) sh.needsUpdate = false;
    try { this.drawMirrors(renderer, scene, camera, w, h, enabled); }
    finally { shadows.forEach((sh, i) => { if (pending[i]) sh.needsUpdate = true; }); this.atm.starsU.value = stars; }
  }

  private drawMirrors(renderer: WebGPURenderer, scene: any, camera: any, w: number, h: number, enabled: boolean) {
    for (const m of this.mirrors) {
      if (!m.ready || !enabled) {   // not compiled yet, or this quality has no reflections: the sky env map reflects
        if (m.on.value !== 0) { m.on.value = 0; for (const w of m.meshes) (w.material as any).envMapIntensity = 1; }
        continue;
      }
      m.on.value = Math.min(1, m.on.value + 0.08);
      for (const w of m.meshes) (w.material as any).envMapIntensity = 1 - m.on.value;
      if (m.visible(camera)) m.render(renderer, scene, camera, w, h);
    }
  }
}
