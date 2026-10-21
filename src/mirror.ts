// A planar reflection for a horizontal water level. The scene is rendered from the camera mirrored in the
// plane (with an oblique near plane so nothing below the water leaks in) into a half-res target, which the
// water material samples by projecting its world position with the mirror camera's matrices.
// (three's ReflectorNode does the same, but its shared targets were being disposed mid-frame with our
// MRT pipeline, so this keeps the lifetimes in our hands.)
import { Box3, Frustum, type Object3D, HalfFloatType, Matrix4, PerspectiveCamera, Plane, RenderTarget, Vector3, Vector4, type Mesh, type Scene, type WebGPURenderer } from 'three/webgpu';
import { positionWorld, texture, uniform, vec2, vec4 } from 'three/tsl';

/** Layer the far tree canopies live on (as well as being drawn by the main camera). */
export const FAR_LAYER = 2;
/** Overlays drawn on top of the view (the tape measure): the main camera only. */
export const OVERLAY_LAYER = 3;

const _frustum = new Frustum(), _m = new Matrix4(), _box = new Box3();

/** 1 while a mirror pass renders. The fog reads it: the canal's reflection of the far bank is only ~100 m of
 * real distance, so fogging it again in the mirror (with the doubled path) turned it into grey cloud. */
export const inMirror = uniform(0);

export class Mirror {
  // 4x MSAA: thin things like fence pickets alias into dashed lines in a half-res reflection otherwise
  readonly target = new RenderTarget(2, 2, { type: HalfFloatType, samples: 4 });
  readonly cam = new PerspectiveCamera();
  private viewProj = uniform(new Matrix4());
  readonly tex = texture(this.target.texture);
  meshes: Mesh[] = [];
  /** 0 until the mirror's pipelines are compiled, then eased to 1 (the water uses the sky env map meanwhile). */
  readonly on = uniform(0);
  ready = false;
  scale = 0.5;
  /** Whether this mirror shows the far trees (the canal does; the pool's walls and fences hide them). */
  farTrees = true;
  /**
   * Objects this mirror can skip, and when. The canal is only seen from the yard over the canal wall, looking
   * south, where it reflects the far bank: the house, pool and garden behind you can't appear in it. So while the
   * camera is in the yard the canal mirror leaves them out (from the jetty, the path or the air it doesn't).
   */
  skip: { objects: Object3D[]; when: (camera: PerspectiveCamera) => boolean } | null = null;

  constructor(public level: number) {}

  /** Reflection colour at this fragment, nudged by the ripple slope. */
  sample(offset: any) {
    const clip = this.viewProj.mul(vec4(positionWorld, 1));
    const uv = clip.xy.div(clip.w).mul(vec2(0.5, -0.5)).add(0.5);
    return this.tex.sample(uv.add(offset)).rgb;
  }

  /** Is any of our water on screen and the camera above it? */
  visible(camera: PerspectiveCamera) {
    if (camera.position.y < this.level) return false;
    _frustum.setFromProjectionMatrix(_m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    return this.meshes.some(m => m.visible && _frustum.intersectsBox(_box.setFromObject(m)));
  }

  /** Size the target and place the mirrored camera (also used to precompile the mirror's pipelines). */
  prepare(camera: PerspectiveCamera, width: number, height: number) {
    const w = Math.max(2, Math.round(width * this.scale)), h = Math.max(2, Math.round(height * this.scale));
    if (this.target.width !== w || this.target.height !== h) this.target.setSize(w, h);
    const c = this.cam;
    c.copy(camera, false);
    if (!this.farTrees) c.layers.disable(FAR_LAYER);
    c.layers.disable(OVERLAY_LAYER);   // the tape measure isn't reflected
    // mirror the camera in y = level
    const p = camera.position, L = this.level;
    c.position.set(p.x, 2 * L - p.y, p.z);
    const fwd = new Vector3(); camera.getWorldDirection(fwd);
    const up = new Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    c.up.set(up.x, -up.y, up.z);
    c.lookAt(c.position.x + fwd.x, c.position.y - fwd.y, c.position.z + fwd.z);
    c.updateMatrixWorld();
    c.projectionMatrix.copy(camera.projectionMatrix);
    // oblique near plane = the water plane (Lengyel)
    const plane = new Plane(new Vector3(0, 1, 0), -L).applyMatrix4(c.matrixWorldInverse);
    const cp = new Vector4(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const e = c.projectionMatrix.elements;
    const q = new Vector4((Math.sign(cp.x) + e[8]) / e[0], (Math.sign(cp.y) + e[9]) / e[5], -1, (1 + e[10]) / e[14]);
    cp.multiplyScalar(1 / cp.dot(q));
    e[2] = cp.x; e[6] = cp.y; e[10] = cp.z; e[14] = cp.w;   // WebGPU depth is 0..1, no +1 on z
    c.projectionMatrixInverse.copy(c.projectionMatrix).invert();
    // sample with the un-clipped projection so uvs line up with the image
    this.viewProj.value.multiplyMatrices(camera.projectionMatrix, c.matrixWorldInverse);
  }

  render(renderer: WebGPURenderer, scene: Scene, camera: PerspectiveCamera, width: number, height: number) {
    this.prepare(camera, width, height);
    const c = this.cam;

    const hide = this.skip && this.skip.when(camera) ? this.skip.objects.filter(o => o.visible) : [];
    for (const o of hide) o.visible = false;
    for (const m of this.meshes) m.userData._v = m.visible, m.visible = false;
    const rt = renderer.getRenderTarget(), mrt = renderer.getMRT();
    renderer.setMRT(null);
    renderer.setRenderTarget(this.target);
    inMirror.value = 1;
    renderer.render(scene, c);
    inMirror.value = 0;
    renderer.setRenderTarget(rt);
    renderer.setMRT(mrt);
    for (const m of this.meshes) m.visible = m.userData._v;
    for (const o of hide) o.visible = true;
  }
}
