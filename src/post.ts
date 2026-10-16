// Post-processing with three's TSL RenderPipeline (WebGPU, falls back to WebGL 2).
//   High / Ultra: MRT scene pass -> SSGI (one-bounce indirect light + AO) -> TRAA -> bloom
//   Medium:       the same with the cheapest SSGI preset at a lower pixel ratio
//   Low:          scene pass -> bloom (phones)
// Tone mapping (AgX) and exposure are applied by the pipeline's output transform.
import { RenderPipeline, UnsignedByteType, type PerspectiveCamera, type Scene, type WebGPURenderer } from 'three/webgpu';
import { diffuseColor, float, max, packNormalToRGB, pow, unpackRGBToNormal, mrt, normalView, output, pass, sample, uniform, vec4, velocity } from 'three/tsl';
import { ssgi } from 'three/addons/tsl/display/SSGINode.js';
import { traa } from 'three/addons/tsl/display/TRAANode.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';

export type Quality = 'Low' | 'Medium' | 'High' | 'Ultra';

export const QUALITY: Record<Quality, { pixelRatio: number; shadowMap: number; shadowHalf: number; ssgi: [number, number] | null;
  taa: boolean; reflections: boolean; reflectionScale: number; far: boolean; plants: boolean;
  /** Grass tufts per m² near the viewer, and how far out they reach (m). 0 = texture only. */
  grass: number; grassRadius: number }> = {
  Low: { pixelRatio: 1.25, shadowMap: 2048, shadowHalf: 28, ssgi: null, taa: false, reflections: false, reflectionScale: 0.3, far: false, plants: true, grass: 0, grassRadius: 0 },
  Medium: { pixelRatio: 1, shadowMap: 4096, shadowHalf: 32, ssgi: [1, 12], taa: true, reflections: true, reflectionScale: 0.35, far: true, plants: true, grass: 0, grassRadius: 0 },
  High: { pixelRatio: 1.25, shadowMap: 4096, shadowHalf: 38, ssgi: [2, 10], taa: true, reflections: true, reflectionScale: 0.5, far: true, plants: true, grass: 110, grassRadius: 12 },
  Ultra: { pixelRatio: 1.5, shadowMap: 4096, shadowHalf: 32, ssgi: [3, 16], taa: true, reflections: true, reflectionScale: 0.75, far: true, plants: true, grass: 150, grassRadius: 18 },
};

/**
 * Blender's 'AgX - Medium High Contrast' look, which the Cycles renders use: about 1.2x contrast in log space around
 * mid grey, before AgX's curve. In linear terms that's a power around 0.18 (after exposure). ?look=1 for plain AgX.
 */
const LOOK = Number(new URLSearchParams(location.search).get('look') ?? 1.2);

export class Post {
  /** The tone-mapping exposure, so the look pivots on mid grey as displayed (set with renderer.toneMappingExposure). */
  readonly exposureU = uniform(1);
  private look(c: any) {
    if (LOOK === 1) return c;
    const e = this.exposureU;
    return vec4(pow(max(c.rgb.mul(e).div(0.18), float(1e-6)), float(LOOK)).mul(0.18).div(e), c.a);
  }

  pipeline: RenderPipeline;
  readonly bloomStrength = uniform(0.12);
  readonly bloomThreshold = uniform(6);
  private bloomNode: any;
  gi: any = null;
  /** How much of SSGI's one-bounce light to add on top of the IBL (which already has the sky). */
  readonly giMix = uniform(0.12);

  readonly scenePass: any;
  private cfg: typeof QUALITY[Quality];
  private upgraded = false;

  /**
   * Starts in a cheap "boot" state that shows the scene pass as it is (no SSGI, TRAA or bloom), so the first
   * frame only needs the scene's own pipelines. The pass already has the MRT outputs the full chain needs, so
   * nothing compiled for the first frame is wasted. upgrade() then adds the effects.
   */
  constructor(private renderer: WebGPURenderer, scene: Scene, private camera: PerspectiveCamera, q: Quality) {
    const dbg = new URLSearchParams(location.search);
    const cfg = { ...QUALITY[q] };
    if (dbg.get('ssgi') === '0') cfg.ssgi = null;
    if (dbg.get('taa') === '0') cfg.taa = false;
    this.cfg = cfg;
    this.pipeline = new RenderPipeline(renderer);
    this.scenePass = pass(scene, camera);
    if (cfg.ssgi || cfg.taa) {
      this.scenePass.setMRT(mrt({ output, diffuseColor, normal: packNormalToRGB(normalView), velocity }));
      this.scenePass.getTexture('diffuseColor').type = UnsignedByteType;
      this.scenePass.getTexture('normal').type = UnsignedByteType;
    }
    this.pipeline.outputNode = this.look(this.scenePass.getTextureNode('output'));
  }

  get isUpgraded() { return this.upgraded; }

  /** The render target and MRT the scene is drawn into, for precompiling its pipelines. */
  get target() { return { target: this.scenePass.renderTarget, mrt: this.scenePass.getMRT() }; }

  upgrade() {
    if (this.upgraded) return;
    this.upgraded = true;
    const cfg = this.cfg, camera = this.camera, scenePass = this.scenePass;
    const dbg = new URLSearchParams(location.search);
    let beauty: any;
    if (cfg.ssgi || cfg.taa) {
      const color = scenePass.getTextureNode('output');
      const depth = scenePass.getTextureNode('depth');
      const vel = scenePass.getTextureNode('velocity');
      let composite: any = color;
      if (cfg.ssgi) {
        const normalTex = scenePass.getTextureNode('normal');
        const diffuse = scenePass.getTextureNode('diffuseColor');
        const sceneNormal = sample((uv: any) => unpackRGBToNormal(normalTex.sample(uv)));
        const gi: any = ssgi(color, depth, sceneNormal, camera);
        gi.sliceCount.value = cfg.ssgi[0];
        gi.stepCount.value = cfg.ssgi[1];
        gi.radius.value = 6;          // metres of influence for the bounce
        gi.giIntensity.value = 6;
        gi.aoIntensity.value = 1.15;
        gi.thickness.value = 0.6;
        this.gi = gi;
        const mode = dbg.get('gimode');
        composite = mode === 'ao' ? vec4(color.rgb.mul(gi.a), color.a) : mode === 'none' ? color : mode === 'gi' ? vec4(gi.rgb, 1) : vec4(color.rgb.mul(gi.a).add(diffuse.rgb.mul(gi.rgb).mul(this.giMix)), color.a);
      }
      beauty = cfg.taa ? traa(composite, depth, vel, camera) : composite;
    } else {
      beauty = scenePass.getTextureNode('output');
    }
    this.bloomNode = bloom(beauty, 0.12, 0.45, 6);
    this.bloomNode.strength = this.bloomStrength;
    this.bloomNode.threshold = this.bloomThreshold;
    this.full = new RenderPipeline(this.renderer);
    this.full.outputNode = this.look(beauty.add(this.bloomNode));
  }

  /** The full chain, while it warms up (rendered every frame before the boot output covers it). */
  private full: RenderPipeline | null = null;

  /** Swap the warmed-up full chain in. */
  commitUpgrade() {
    if (!this.full) return;
    this.pipeline.dispose();
    this.pipeline = this.full;
    this.full = null;
    this.ready = true;
  }
  ready = false;

  /** Bloom is for the lights after dark; by day only the sun's glint on the water should catch it. */
  setNight(night: number) {
    this.bloomStrength.value = 0.05 + 0.1 * night;
    this.bloomThreshold.value = 9 - 7 * night;
    // SSGI's bounce goes strange at night (it lit the far bank), so by night it's AO only
    this.giMix.value = 0.12 * (1 - night);
  }

  render() {
    if (this.full) this.full.render();
    this.pipeline.render();
  }
  dispose() { this.pipeline.dispose(); this.full?.dispose(); }
}
