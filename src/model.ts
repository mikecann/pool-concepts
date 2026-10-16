// The GLB from the-pool's export_web.py plus lights.json, set up for the walkthrough: materials, water,
// caustics, the lighting scheme and fire pit for after dark, and Today / Proposed / option switching.
//
// Node extras from the export: set (existing | proposed | both), option (roller_*, kitchen_*, gate_*),
// people, night (light fittings), collide, lod ("far"), water (pool | spa | canal), window.
import {
  AdditiveBlending, Box3, Matrix4, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, InstancedMesh, Mesh, MeshBasicNodeMaterial, MeshStandardNodeMaterial, Object3D, PointLight, RectAreaLight, SpotLight, Vector3,
  type Light, type Material, type Texture, type WebGPURenderer, RectAreaLightNode,
} from 'three/webgpu';
import { abs, attribute, mrt, positionWorld, vec4, select, clamp, dot, max, materialRoughness, float, floor, fract, fwidth, sin, materialColor, mix, normalWorld, smoothstep, uv, vec2, mx_noise_float, positionLocal, time, uniform, vec3 } from 'three/tsl';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RectAreaLightTexturesLib } from 'three/addons/lights/RectAreaLightTexturesLib.js';
import { FAR_LAYER, Mirror } from './mirror';
import { Grass, lawnColor } from './grass';
import { softenFarTrees } from './trees';
import { mergeStatic } from './merge';
import { causticsAlbedo, quietUnderwater, underwaterMask, waterMaterial, type WaterKind } from './water';
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
// the fire pit light's 512 cube shadow drew a square patch on the lounge floor, so only a downlight casts shadows
const KEY_SHADOW_LIGHTS = ['alfresco_downlight_1', 'alfresco_downlight_0+1'];

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
const OLD_JOINTS = new URLSearchParams(location.search).has('jointsold');
const JOINTS: Record<string, { tile: number; width: number; grout: [number, number, number] }> = {
  coping: { tile: 0.4, width: OLD_JOINTS ? 0.009 : 0.011, grout: [0.2, 0.195, 0.185] },
  pavers_existing: { tile: 0.4, width: OLD_JOINTS ? 0.01 : 0.012, grout: [0.26, 0.22, 0.17] },
};
/**
 * Timber albedo graded against the Cycles stills (the baked textures came out far too light and saturated):
 * the composite decking and lounge steps are dark brown, the pavilion's hardwood a grey-brown rather than
 * purple-red, and the outdoor table set honey rather than red. ?timber0=1 turns it off.
 */
const TIMBER: Record<string, { sat: number; mul: [number, number, number]; rough?: number }> = {
  // Round 12: the old pavers (Today, the promenade, the passage) render cream in Cycles; ours came out tan-brown
  pavers_existing: { sat: 0.5, mul: [1.92, 1.9, 1.88] },
  composite_deck: { sat: 0.7, mul: [0.42, 0.4, 0.38] },
  bench_slats: { sat: 0.75, mul: [0.6, 0.56, 0.52] },
  deck_hardwood: { sat: 0.55, mul: [0.92, 0.9, 0.72], rough: 0.8 },   // Round 12: less red (it went violet under the blue sky light),
  outdoor_table_chair_set_01_table: { sat: 0.6, mul: [1.2, 1.3, 0.75] },
  outdoor_table_chair_set_01_chair: { sat: 0.6, mul: [1.2, 1.3, 0.75] },
};
/** Round 9 basin glow strength (?glow=0 turns it off). */
const GLOW = Number(new URLSearchParams(location.search).get('glow') ?? 0.1);
/** Round 9: warmer lounge lighting at night, as Cycles' amber (?warm0=1 for Round 8's). */
const WARM = !new URLSearchParams(location.search).has('warm0');
const LOUNGE_GAIN = Number(new URLSearchParams(location.search).get('lounge') ?? (WARM ? 0.7 : 1));
const WET_LIGHTS = !new URLSearchParams(location.search).has('wet0');
const WET_PATH = Number(new URLSearchParams(location.search).get('wetpath') ?? 3);
const SPA_GAIN = Number(new URLSearchParams(location.search).get('spagain') ?? 2);
const WET_GAIN = Number(new URLSearchParams(location.search).get('wetgain') ?? 3);
const GLITTER = new URLSearchParams(location.search).has('glitter');
const CEIL = Number(new URLSearchParams(location.search).get('ceil') ?? 0.2);
const WIN_OPACITY = Number(new URLSearchParams(location.search).get('win') ?? (new URLSearchParams(location.search).has('rooms0') ? 0.82 : 0.4));
const ROOMS0 = new URLSearchParams(location.search).has('rooms0');
const ROOM_DAY = Number(new URLSearchParams(location.search).get('roomday') ?? 1.5);
const ROOM_NIGHT = Number(new URLSearchParams(location.search).get('roomnight') ?? 0.6);
const LAWN11 = new URLSearchParams(location.search).has('lawn11');
const LAWN_GRADE: [number, number, number] = [0.51, 0.54, 0.22];
const NO_BARK = new URLSearchParams(location.search).has('bark0');
const NO_TIMBER = new URLSearchParams(location.search).has('timber0');
const FLAME10 = new URLSearchParams(location.search).has('flame10');
const FLAME_GAIN = Number(new URLSearchParams(location.search).get('flamegain') ?? 0.65);
const DUSK0 = new URLSearchParams(location.search).has('dusk0');
const NO_JOINTS = new URLSearchParams(location.search).has('joints0');
function tileJoints(base: any, j: { tile: number; width: number; grout: [number, number, number] }) {
  const u = uv().div(j.tile);
  const d = abs(fract(u.add(0.5)).sub(0.5));             // distance to the nearest joint, in tiles
  const fw = fwidth(u).max(1e-5);
  const half = vec2(j.width / j.tile / 2);
  const line = float(1).sub(smoothstep(half, half.add(fw.mul(1.2)), d).x.mul(smoothstep(half, half.add(fw.mul(1.2)), d).y));
  // a joint thinner than a pixel still darkens a little (its coverage), so the grid reads at a distance
  const coverage = clamp(half.x.div(fw.x.max(fw.y)).mul(1.6), OLD_JOINTS ? 0.4 : 0.55, 1);
  const ground = smoothstep(0.6, 0.85, normalWorld.y);
  // Round 8: the joint is the stone's own colour in shadow (~0.45x), pulled a little toward the grout colour,
  // so it reads as a recess with contrast on both the pale coping and the older pavers. ?jointsold=1 for before.
  const grout = OLD_JOINTS ? vec3(...j.grout) : mix(base.rgb.mul(0.35), vec3(...j.grout), 0.2);
  // each tile a touch lighter or darker, as laid stone is
  const cell = floor(u);
  const h = fract(sin(dot(cell, vec2(12.9898, 78.233))).mul(43758.5453));
  const tone = float(1).add(h.sub(0.5).mul(0.09).mul(ground));
  return mix(base.rgb.mul(tone), grout, line.mul(coverage).mul(ground).mul(OLD_JOINTS ? 0.9 : 1));
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
  /** How strongly the pool and spa lights' bounce lights their basins (0 by day or with the light off). */
  private poolGlow = uniform(0);
  private spaGlow = uniform(0);
  private poolLight: AnyLight | null = null;
  private spaLight: AnyLight | null = null;
  private glowColor(kind: WaterKind) {
    // the light's colour after a few metres of water, as for the lights themselves (see setupLights)
    const a = kind === 'spa' ? [0.315, 0.14, 0.12] : [0.27, 0.12, 0.105], path = kind === 'spa' ? 2 : 7;
    const col = kind === 'spa' ? [0.75, 0.9, 1.0] : [0.55, 0.85, 1.0];
    return vec3(...col.map((v, i) => v * Math.exp(-a[i] * path)) as [number, number, number]);
  }
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
      loader.loadAsync(base + 'pool-model.glb?v=' + __MODEL_V__, e => { if (e.total) onProgress(e.loaded / e.total); }),
      fetch(base + 'lights.json?v=' + __MODEL_V__).then(r => (r.ok ? r.json() : [])).catch(() => []) as Promise<LightDef[]>,
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
        // Round 11: the aggregate and coping normal maps made every grain a tiny mirror, which glittered blue with
        // the night sky (the reviewer's "stars on the coping"); a quarter of the bump keeps the texture without it
        if (/^(aggregate|coping)$/.test(m.name) && m.normalScale && !GLITTER) m.normalScale.set(0.25, 0.25);
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
        n.opacity = u.window ? WIN_OPACITY : 0.28;
        n.depthWrite = !!u.window;
        n.envMapIntensity = 1;
        if (u.window) {
          // lit rooms behind the glass after dark
          n.emissiveNode = DUSK0 ? vec3(1.0, 0.58, 0.28).mul(this.atm.nightU).mul(0.018) : vec3(1.0, 0.72, 0.45).mul(this.atm.nightU).mul(0.28);   // rooms lit behind the glass
        }
        mesh.material = n;
        mesh.receiveShadow = false;   // the fire light's shadow put a person's silhouette on the spa glass
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
      if (mats[0]?.name === 'bark_chips' && !NO_BARK) {
        // Round 11: Cycles' bark is Voronoi chips (scale 28, ~3.5 cm), each a colour between #3E2B1E and #9C7552;
        // the export flattened it to one brown, which read as rubber matting. Chips by world XZ, plus 30 cm patches.
        const n = conv(mats[0]);
        if (!n.colorNode) {
          const p = positionWorld.xz.mul(40);
          const jitter = vec2(mx_noise_float(vec3(p.x.mul(0.37), p.y.mul(0.37), 1.3)), mx_noise_float(vec3(p.x.mul(0.37), p.y.mul(0.37), 7.1))).mul(0.6);
          const cell = floor(p.add(jitter));
          const r = fract(sin(dot(cell, vec2(12.9898, 78.233))).mul(43758.5453));
          const patch = mx_noise_float(vec3(positionWorld.x.mul(3.3), 0.7, positionWorld.z.mul(3.3))).mul(0.5).add(0.5);
          // sRGB #3E2B1E and #9C7552 in linear
          n.colorNode = mix(vec3(0.07, 0.038, 0.021), vec3(0.28, 0.15, 0.075), r).mul(mix(float(0.8), float(1.15), patch));
          n.roughness = 0.95;
        }
        mesh.material = n;
      }
      const grade = TIMBER[mats[0]?.name as string];
      if (grade && !NO_TIMBER) {
        const n = conv(mats[0]);
        if (!n.colorNode) {
          const c = materialColor.rgb, lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
          n.colorNode = mix(vec3(lum), c, grade.sat).mul(vec3(...grade.mul));
          // weathered boards: a glossy roughness map put a cold sky sheen over the whole floor
          if (grade.rough) n.roughnessNode = max(materialRoughness, float(grade.rough));
        }
        mesh.material = n;
      }
      const joint = JOINTS[mats[0]?.name as string];
      if (joint && !NO_JOINTS) {
        const n = conv(mats[0]);
        // on top of any grade (TIMBER) already on this material, once
        if (!n.userData.joints) { n.colorNode = tileJoints(n.colorNode ?? materialColor, joint); n.userData.joints = true; }
        mesh.material = n;
      }
      if (/^interior_/.test(mats[0]?.name ?? '') && !ROOMS0) {
        // Round 12: the rooms behind the sliders. Cycles fills them with daylight bounced off the floor and walls
        // (a bright cream room through the glass); here nothing bounces indoors, so the room glows with the light
        // the day would put into it, and warm after dark (the lit rooms the night renders show)
        const n = conv(mats[0]);
        const day = this.atm.sunIntensityU.mul(max(this.atm.sunDirU.y, 0)).mul(0.05).add(this.atm.skyGain.mul(1.2));
        n.emissiveNode = materialColor.mul(vec3(1.0, 0.93, 0.82)).mul(day.mul(ROOM_DAY)).add(materialColor.mul(vec3(1.0, 0.75, 0.5)).mul(this.atm.nightU).mul(ROOM_NIGHT));
        mesh.material = n;
      }
      if (mats[0]?.name === 'context_ground' && !LAWN11) {
        // the neighbours' and verge grass: the same sheen problem as the lawn (Round 12)
        const n = conv(mats[0]);
        if (!n.colorNode) { n.roughnessNode = max(materialRoughness, float(0.95)); n.colorNode = materialColor.mul(vec3(...LAWN_GRADE)); }
        mesh.material = n;
      }
      if (mats[0]?.name === 'lawn') {
        const n = conv(mats[0]);
        if (!n.colorNode) {
          n.colorNode = lawnColor();
          if (!LAWN11) {
            // Round 12: grass is a deep diffuse surface; its glossy texture roughness let the (Round 10, 4x) sky
            // sheen over it at grazing angles, so lawns read pale grey-olive where Cycles has them rich green
            n.roughnessNode = max(materialRoughness, float(0.95));
            n.colorNode = lawnColor().mul(vec3(...LAWN_GRADE));
          }
        }
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
      const g = mesh.geometry, pos = g.getAttribute('position');
      if (!FLAME10 && pos.count % 4 === 0) {
        // Round 11: Cycles cuts tongue shapes out of the crossed cards; ours had no UVs, so the cards were drawn whole
        // (tapered into one pleated cone). Each card is a quad, vertices 0 and 3 on one side, 1 and 2 on the other.
        const uvs = new Float32Array(pos.count * 2), ids = new Float32Array(pos.count);
        for (let i = 0; i < pos.count; i++) {
          const q = i % 4;
          uvs[i * 2] = q === 1 || q === 2 ? 1 : 0;
          uvs[i * 2 + 1] = (pos.getY(i) - bb.min.y) / Math.max(0.01, bb.max.y - bb.min.y);
          ids[i] = Math.floor(i / 4);
        }
        g.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
        g.setAttribute('card', new Float32BufferAttribute(ids, 1));
        const id = attribute('card', 'float'), u = uv().x, v = uv().y;
        const across = abs(u.sub(0.5)).mul(2);   // 0 in the middle of the card, 1 at its edges
        // a tongue: full width low down, rounding to a point, with a licking edge that rises with time
        const lick = mx_noise_float(vec3(u.mul(3).add(id.mul(7.3)), v.mul(2.2).sub(time.mul(1.6)), id)).mul(0.32).mul(v.add(0.15));
        const width = float(1).sub(v).pow(1.15).mul(0.8).add(lick.mul(0.7)).mul(smoothstep(0.0, 0.06, v).mul(0.4).add(0.6));
        fm.opacityNode = select(across.lessThan(width), float(1), float(0));
        fm.alphaTest = 0.5;
        // emissive: no AO or bounce from SSGI (post.ts skips pixels whose diffuse alpha is 0); its AO noise stippled them
        // only while an MRT pass is building: with no MRT (Low, the mirrors) three would use it as the whole output
        const flameMRT = mrt({ diffuseColor: vec4(0, 0, 0, 0) }), renderer = this.renderer;
        Object.defineProperty(fm, 'mrtNode', { get: () => (renderer.getMRT() ? flameMRT : null), set: () => {}, configurable: true });
        fm.positionNode = positionLocal.add(vec3(wob, wob.abs().mul(0.6), wob.mul(0.8)));
        // hot white-yellow core low and in the middle, orange towards the edges and up the tongue
        const edge = across.div(width.max(0.05)).max(v.mul(0.9)).clamp(0, 1);
        // Round 12: more saturated, so AgX's shoulder leaves them orange rather than white-yellow
        const col = mix(mix(vec3(1.0, 0.5, 0.16), vec3(1.0, 0.3, 0.04), smoothstep(0.1, 0.55, edge)), vec3(0.95, 0.18, 0.015), smoothstep(0.55, 1.0, edge));
        fm.colorNode = col.mul(float(FLAME_GAIN).mul(this.fireFlicker)).mul(this.atm.nightU);
        fm.side = DoubleSide;
      } else {
        // taller than the Blender cones (the Cycles flames stand well above the rim): stretch up from the base
        const c = bb.getCenter(new Vector3());
        // taper each tongue to a point towards the top, with a little height added
        const taper = float(1).sub(t.pow(1.3).mul(0.75));
        const stretch = DUSK0 ? positionLocal : vec3(positionLocal.x.sub(c.x).mul(taper).add(c.x), positionLocal.y.sub(bb.min.y).mul(1.15).add(bb.min.y), positionLocal.z.sub(c.z).mul(taper).add(c.z));
        fm.positionNode = stretch.add(vec3(wob, wob.abs().mul(0.6), wob.mul(0.8)));
        // solid emissive cones like Cycles': a yellow-white core at the base, orange body, deep orange tips.
        // Opaque (transparent flames turned into screen-door stripes under TRAA); hidden by day by model.update().
        const core = vec3(1.0, 0.62, 0.2), body = vec3(1.0, 0.36, 0.05), tip = vec3(0.8, 0.14, 0.01);
        const grad = mix(mix(core, body, smoothstep(0.0, 0.35, t)), tip, smoothstep(0.45, 1.0, t));
        fm.colorNode = grad.mul(float(0.85).mul(this.fireFlicker)).mul(this.atm.nightU);
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
      return { minX: b.min.x, maxX: b.max.x, minZ: b.min.z, maxZ: b.max.z, level: b.max.y, kind: w.userData.water as WaterKind };
    });
    if (!boxes.length) return;
    const done = new Set<Material>();
    this.root.traverse(o => {
      const m = o as Mesh;
      if (!m.isMesh || m.userData.water || m.userData.night) return;
      // Round 12: the pool only exists in the proposed scheme: Today's lawn and pavers on its footprint were being
      // lit as if under water (pale, caustic-netted squares in the Today views)
      let set: unknown; for (let q: Object3D | null = m; q && set === undefined; q = q.parent) set = q.userData.set;
      if (set === 'existing') return;
      const b = new Box3().setFromObject(m);
      const hit = boxes.filter(x => b.min.y < x.level - 0.02 && b.max.x > x.minX && b.min.x < x.maxX && b.max.z > x.minZ && b.min.z < x.maxZ);
      if (!hit.length || (m.material as any).isNodeMaterial && done.has(m.material as Material)) return;
      const n = (m.material as any).isNodeMaterial ? (m.material as MeshStandardNodeMaterial) : this.toNode(m.material as Material);
      // on top of the material's own colour node (grades, joints): starting from materialColor dropped them on any
      // big mesh whose box overlaps the pool, like the old pavers (Round 12)
      let c: any = n.colorNode ?? materialColor;
      let under: any = float(0), glow: any = vec3(0);
      for (const x of hit) {
        c = causticsAlbedo(c, x, this.atm.sunDirU);
        const u = underwaterMask(x);
        under = max(under, u);
        glow = glow.add(this.glowColor(x.kind).mul(x.kind === 'spa' ? this.spaGlow : this.poolGlow).mul(u));
      }
      n.colorNode = c;
      quietUnderwater(n, under);
      // the pool light bouncing round the basin through the water: Cycles' pool glows evenly teal at night, where
      // a single light with inverse-square falloff only lights the shell near it. Follows the light's own level.
      if (GLOW) n.emissiveNode = c.mul(glow);
      m.material = n;
      done.add(n);
    });
  }

  /**
   * Round 11: the alfresco ceiling at dusk and night. In Cycles it glows warm from the downlights' light coming back
   * off the floor, which is what makes its dusk frames feel lit; here it stayed dark grey. A soft pool of light
   * round each downlight plus a faint wash, on the ceiling's own colour, scaled by the night level. ?ceil=0 off.
   */
  private glowCeiling(downlights: LightDef[]) {
    if (!downlights.length || CEIL <= 0) return;
    let mat: any = null;
    this.root.traverse(o => { if (!mat && (o as Mesh).isMesh && (o as Mesh).name === 'alfresco_ceiling') mat = (o as Mesh).material; });
    if (!mat) return;
    const n = mat.isNodeMaterial ? mat : this.toNode(mat);
    let pool: any = float(0);
    for (const d of downlights) {
      const dx = positionWorld.x.sub(d.position[0]), dz = positionWorld.z.sub(d.position[2]);
      pool = pool.add(dx.mul(dx).add(dz.mul(dz)).negate().div(1.1).exp());
    }
    n.emissiveNode = materialColor.mul(vec3(1.0, 0.74, 0.48)).mul(pool.add(0.25).mul(CEIL)).mul(this.atm.nightU);
    this.root.traverse(o => { if ((o as Mesh).isMesh && (o as Mesh).material === mat) (o as Mesh).material = n; });
  }

  private setupLights(defs: LightDef[]) {
    // Every light in the scene is in every shader (they're kept on all day, see update()), so fewer is better:
    // the four boundary uplights and the four skillion downlights become two of each, each pair a single light
    // midway between the two with their combined power. The look barely changes; the shaders get 4 lights smaller.
    this.glowCeiling(defs.filter(d => d.name.startsWith('alfresco_downlight')));
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
        base = d.power / (Math.PI * w * h) * 2;
        if (d.name.startsWith('led_bench')) { if (WARM) r.color.setRGB(1.0, 0.56, 0.26); else r.color.setRGB(1.0, 0.66, 0.36); }   // ~2700 K, as the strips are specified
        light = r;
      } else {
        const p = new PointLight(col, 0, d.name.includes('pool') ? 9 : 14, 2);
        p.position.copy(pos);
        if (d.name.startsWith('led_firepit')) {
          // just below the bowl's rim: it lights the bowl and the floor round it, and the rim casts the dark ring
          p.position.y -= 0.12;
          if (WARM) p.color.setRGB(1.0, 0.46, 0.15); else p.color.setRGB(1.0, 0.55, 0.22);
        }
        base = d.power * POINT_SCALE;
        if (WET_LIGHTS && (d.name === 'pool_light' || d.name === 'led_spa_light')) {
          // Round 9: these sit under water, so everything they light is seen through metres of it. Cycles soaks up
          // the red on the way (pool_water: 0.27, 0.12, 0.105 per m), which is why its pool glows teal at night;
          // ours doesn't absorb light, so the colour carries a typical path's worth (4.5 m in the pool, 1.2 m in the spa)
          const path = (d.name === 'pool_light' ? 4.5 : 1.2) * WET_PATH, a = d.name === 'pool_light' ? [0.27, 0.12, 0.105] : [0.315, 0.14, 0.12];
          p.color.setRGB(col.r * Math.exp(-a[0] * path), col.g * Math.exp(-a[1] * path), col.b * Math.exp(-a[2] * path));
          base *= WET_GAIN * (d.name === "led_spa_light" ? SPA_GAIN : 1);   // Round 11: the spa glows bright cyan at dusk in Cycles
        }
        light = p;
        if (d.name === 'pool_light') this.poolLight = p;
        if (d.name === 'led_spa_light') this.spaLight = p;
      }
      // Round 9: the lounge floor (pale limestone) burned to white at night where Cycles has it amber
      if (d.name.startsWith('led_bench') || d.name.startsWith('led_firepit')) base *= LOUNGE_GAIN;
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
    this.poolGlow.value = this.poolLight?.visible ? night * GLOW : 0;
    this.spaGlow.value = this.spaLight?.visible ? night * GLOW * SPA_GAIN : 0;
    // shadow maps of the night lights: refresh while they're fading in, then they're static
    if (on !== this.wasOn) { this.wasOn = on; for (const l of this.shadowLights) l.shadow!.needsUpdate = true; }
    // (hiding a mesh doesn't change any shader, unlike the lights: the flames simply go away by day)
    if (this.flames) this.flames.visible = on && this.visibleFor(this.flames.userData);
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
