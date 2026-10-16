// Parallel pipeline compilation.
//
// three's renderer.compileAsync() builds each object's shaders and then *waits for its pipeline* before
// starting the next object, so a few hundred objects compile one after another. It also compiles for
// whatever render target is current (the canvas), while our frames render into the post-processing pass's
// MRT target, so the first real frame compiled everything a second time, synchronously.
//
// compileFor() runs compileAsync against the target and MRT the frames really use, but hands the GPU
// pipeline promises to a shared list instead of awaiting them one by one: shader generation still runs on
// the main thread (yielding between objects), and the driver compiles all the pipelines in parallel.
import type { Camera, Object3D, RenderTarget, Scene, WebGPURenderer } from 'three/webgpu';

/**
 * three keys its per-target render contexts (and so every object's shaders) by how deeply nested the render
 * call is. Our scene pass is drawn at depth 1 by the boot pipeline but at depth 2 inside the full chain (SSGI
 * pulls it from within its own quad render), and compileAsync always uses depth 0, so the same objects were
 * built up to three times. Pin each of our scene targets to one depth so compiling and every frame agree.
 */
export function pinRenderDepth(renderer: WebGPURenderer, targets: Map<RenderTarget, number>) {
  const contexts = (renderer as any)._renderContexts, get = contexts.get;
  contexts.get = function (rt: RenderTarget | null, mrt: unknown, depth?: number) {
    const pinned = rt ? targets.get(rt) : undefined;
    return get.call(this, rt, mrt, pinned ?? depth);
  };
}

export async function compileFor(renderer: WebGPURenderer, scene: Scene | Object3D, camera: Camera,
  target: RenderTarget | null, mrt: any, onProgress?: (done: number, total: number) => void) {
  const r = renderer as any;
  const pipelines = r._pipelines;
  const original = pipelines.getForRender;
  const pending: Promise<unknown>[] = [];
  pipelines.getForRender = function (renderObject: unknown, promises: Promise<unknown>[] | null = null) {
    return original.call(this, renderObject, promises ? pending : null);
  };
  // shaders are generated for the renderer's current target and MRT throughout the compile, so they stay set
  // until it finishes; frames drawn meanwhile go through renderClean(), which hides this state from them
  const prevTarget = renderer.getRenderTarget(), prevMRT = renderer.getMRT();
  renderer.setRenderTarget(target);
  renderer.setMRT(mrt);
  try {
    await renderer.compileAsync(scene as Scene, camera, scene as Scene,
      onProgress ? ((e: ProgressEvent) => onProgress(e.loaded, e.total)) as any : null);
  } finally {
    pipelines.getForRender = original;
    renderer.setRenderTarget(prevTarget);
    renderer.setMRT(prevMRT);
  }
  await Promise.all(pending);
  return pending.length;
}

/**
 * While active, any pipeline the renderer needs mid-frame is created asynchronously: three skips drawing
 * that object until its pipeline is ready, so new shaders make things appear a frame or two later instead of
 * freezing the page. Used only while loading; afterwards it's off so nothing ever blinks out.
 */
export class AsyncPipelines {
  active = false;
  private bucket: Promise<unknown>[] = [];
  constructor(renderer: WebGPURenderer) {
    const pipelines = (renderer as any)._pipelines;
    const self = this;
    pipelines.updateForRender = function (renderObject: unknown) {
      if (self.active) this.getForRender(renderObject, self.bucket); else this.getForRender(renderObject);
    };
  }
  /** Promises for pipelines started since the last call. */
  take() { const b = this.bucket; this.bucket = []; return b; }
}

/** Upload textures to the GPU a few at a time, yielding between batches. */
export async function uploadTextures(renderer: WebGPURenderer, root: Object3D) {
  const seen = new Set<any>();
  root.traverse((o: any) => {
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'alphaMap', 'aoMap'])
      if (m[k]?.isTexture && m[k].image) seen.add(m[k]);
  });
  let i = 0;
  for (const t of seen) {
    renderer.initTexture(t);
    if (++i % 6 === 0) await new Promise(r => setTimeout(r, 0));
  }
  return seen.size;
}

/** Draw a frame with the default target and no MRT, even while a background compile has set its own. */
export function renderClean(renderer: WebGPURenderer, draw: () => void) {
  const target = renderer.getRenderTarget(), mrt = renderer.getMRT();
  if (target === null && mrt === null) { draw(); return; }
  renderer.setRenderTarget(null);
  renderer.setMRT(null);
  try { draw(); } finally { renderer.setRenderTarget(target); renderer.setMRT(mrt); }
}
