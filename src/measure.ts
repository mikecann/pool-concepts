// Tape measure (Round 15): click (or tap) two points on the model and read the distance, plus its horizontal and
// vertical parts. Each measurement is a thin line with a dot at each end, drawn over everything, and a label that
// follows it on screen. Several can be up at once; Clear or Esc removes them. A click lands on the nearest vertex
// or edge of the face you hit when one is within a few centimetres, so corners and edges are easy to catch.
import { OVERLAY_LAYER } from './mirror';
import {
  BufferGeometry, Float32BufferAttribute, Group, Line, LineBasicNodeMaterial, Mesh, MeshBasicNodeMaterial, Raycaster, SphereGeometry, Vector2, Vector3,
  type Camera, type Intersection, type Object3D,
} from 'three/webgpu';

const SNAP_VERTEX = 0.06, SNAP_EDGE = 0.035;
const _a = new Vector3(), _b = new Vector3(), _c = new Vector3(), _p = new Vector3(), _q = new Vector3();

type Item = { a: Vector3; b: Vector3; line: Line; label: HTMLElement };

export class TapeMeasure {
  readonly group = new Group();
  active = false;
  private items: Item[] = [];
  private pending: Vector3 | null = null;
  private dot = new SphereGeometry(1, 12, 8);
  private dotMat = new MeshBasicNodeMaterial({ color: 0xffd84a });
  private lineMat = new LineBasicNodeMaterial({ color: 0xffd84a });
  private pendingDot: Mesh;
  private ray = new Raycaster();

  constructor(private root: Object3D, private camera: Camera, private labels: HTMLElement, private onChange: (text: string) => void) {
    this.group.name = 'tape_measure';
    for (const m of [this.dotMat, this.lineMat]) { m.depthTest = false; m.depthWrite = false; m.transparent = true; m.fog = false; }
    this.pendingDot = this.makeDot(new Vector3());
    this.pendingDot.visible = false;
    this.group.add(this.pendingDot);
    this.group.renderOrder = 10;
  }

  get count() { return this.items.length; }
  get hasPending() { return this.pending !== null; }

  /** Raycast the model at a point in normalised device coordinates (-1..1); returns the snapped point or null. */
  pick(ndc: Vector2): Vector3 | null {
    this.ray.setFromCamera(ndc, this.camera);
    this.ray.far = 400;
    const hits = this.ray.intersectObject(this.root, true);
    const hit = hits.find(h => this.measurable(h));
    if (!hit) return null;
    return this.snap(hit);
  }

  private measurable(h: Intersection) {
    let o: Object3D | null = h.object;
    while (o) { if (!o.visible || o === this.group) return false; o = o.parent; }
    const m = h.object as Mesh;
    return (m as any).isMesh && m.userData.lod !== 'far' && h.object.parent?.name !== 'grass_blades';
  }

  /** The hit point, or the face's nearest corner or edge when one is close by. */
  private snap(h: Intersection) {
    const p = h.point.clone();
    const m = h.object as Mesh, face = h.face;
    if (!face || (m as any).isInstancedMesh) return p;   // trees, tufts: no snapping
    const pos = (m.geometry as BufferGeometry).getAttribute('position');
    if (!pos) return p;
    const toWorld = (i: number, v: Vector3) => v.fromBufferAttribute(pos as any, i).applyMatrix4(m.matrixWorld);
    toWorld(face.a, _a); toWorld(face.b, _b); toWorld(face.c, _c);
    let best = SNAP_VERTEX, out: Vector3 | null = null;
    for (const v of [_a, _b, _c]) { const d = v.distanceTo(p); if (d < best) { best = d; out = v.clone(); } }
    if (out) return out;
    best = SNAP_EDGE;
    for (const [u, v] of [[_a, _b], [_b, _c], [_c, _a]] as const) {
      const t = Math.max(0, Math.min(1, _q.subVectors(p, u).dot(_p.subVectors(v, u)) / Math.max(1e-9, _p.lengthSq())));
      const e = u.clone().addScaledVector(_p, t), d = e.distanceTo(p);
      if (d < best) { best = d; out = e; }
    }
    return out ?? p;
  }

  /** Add a point (from a click or tap): the first starts a measurement, the second finishes it. */
  add(point: Vector3) {
    if (!this.pending) {
      this.pending = point.clone();
      this.pendingDot.position.copy(point); this.pendingDot.visible = true;
      this.onChange('Now click the second point');
      return null;
    }
    const a = this.pending, b = point.clone();
    this.pending = null; this.pendingDot.visible = false;
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute([a.x, a.y, a.z, b.x, b.y, b.z], 3));
    const line = new Line(g, this.lineMat);
    line.renderOrder = 10; line.frustumCulled = false; line.layers.set(OVERLAY_LAYER);
    line.add(this.makeDot(a), this.makeDot(b));
    this.group.add(line);
    const label = document.createElement('div');
    label.className = 'measure-label';
    const d = a.distanceTo(b), h = Math.hypot(b.x - a.x, b.z - a.z), v = Math.abs(b.y - a.y);
    label.innerHTML = `${fmt(d)}<small>&#8596; ${fmt(h)} &nbsp;&#8597; ${fmt(v)}</small>`;
    this.labels.appendChild(label);
    const item = { a, b, line, label };
    this.items.push(item);
    this.onChange(`${fmt(d)} (across ${fmt(h)}, up ${fmt(v)}). Click to measure again.`);
    return { distance: d, horizontal: h, vertical: v };
  }

  private makeDot(p: Vector3) {
    const m = new Mesh(this.dot, this.dotMat);
    m.position.copy(p); m.renderOrder = 11; m.frustumCulled = false;
    m.userData.collide = false;
    m.layers.set(OVERLAY_LAYER);
    return m;
  }

  /** Keep the dots a constant size on screen and the labels on their lines. Call every frame. */
  update(width: number, height: number) {
    const cam = this.camera as any;
    const scale = (p: Vector3) => Math.max(0.012, p.distanceTo(cam.position) * 0.0045);
    this.group.traverse(o => { if ((o as Mesh).isMesh) o.scale.setScalar(scale(o.getWorldPosition(_p))); });
    for (const it of this.items) {
      _p.addVectors(it.a, it.b).multiplyScalar(0.5).project(this.camera);
      const behind = _p.z > 1;
      it.label.style.display = behind ? 'none' : '';
      it.label.style.left = `${((_p.x + 1) / 2) * width}px`;
      it.label.style.top = `${((1 - _p.y) / 2) * height}px`;
    }
  }

  clear() {
    for (const it of this.items) { it.line.geometry.dispose(); this.group.remove(it.line); it.label.remove(); }
    this.items = [];
    this.pending = null; this.pendingDot.visible = false;
    this.onChange('Click two points to measure');
  }

  /** The measurements so far, for tests. */
  list() { return this.items.map(it => ({ a: it.a.toArray(), b: it.b.toArray(), distance: it.a.distanceTo(it.b) })); }
}

const fmt = (m: number) => (m < 1 ? `${Math.round(m * 1000)} mm` : `${m.toFixed(2)} m`);
