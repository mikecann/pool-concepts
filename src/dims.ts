// Dimensions overlay (Round 21): the key distances from the-pool's compile_site.py (web/dims.json, dims-b.json for
// Layout B), drawn as thin dashed lines with a small cross at each end and a label like "4.00 m". Which ones show
// follows the scenario and options exactly as the model's own parts do (set, option, hide_option), plus the group
// chips. Lines and crosses are two draw calls on the overlay layer (drawn over everything, not in the mirrors); the
// labels are HTML that fade with distance, and the nearer of two overlapping labels wins.
import { OVERLAY_LAYER } from './mirror';
import { BufferGeometry, Float32BufferAttribute, Group, LineBasicNodeMaterial, LineDashedNodeMaterial, LineSegments, Vector3, type Camera, type Material } from 'three/webgpu';

export type Dim = { id: string; label: string; group: string; a: number[]; b: number[]; value_m: number; set: string; option?: string; hide_option?: string; note?: string };

/** The chips, and which of the export's groups each one covers (the lounge wall and roof edge lines go with the alfresco). */
export const DIM_GROUPS: { id: string; name: string; groups: string[] }[] = [
  { id: 'pool', name: 'Pool', groups: ['pool'] },
  { id: 'lounge', name: 'Lounge', groups: ['lounge'] },
  { id: 'spa', name: 'Spa', groups: ['spa'] },
  { id: 'alfresco', name: 'Alfresco', groups: ['alfresco', 'alignment'] },
  { id: 'fences', name: 'Fences', groups: ['fences'] },
  { id: 'passage', name: 'Side passage', groups: ['passage'] },
  { id: 'levels', name: 'Levels', groups: ['levels'] },
];

const COLOR = 0xff6a1f, TICK = 0.12, FADE_NEAR = 12, FADE_FAR = 45, NAME_NEAR = 6;
const _m = new Vector3(), _p = new Vector3(), _d = new Vector3(), _t = new Vector3(), _u = new Vector3();

/** Round 23: Mike calls the pavilion's pier a pillar; the export's labels still say pier. */
const pillar = (t: string) => t.replace(/\b([Pp])ier(s?)\b/g, (_, p, s) => `${p === 'P' ? 'P' : 'p'}illar${s}`);

export class Dims {
  readonly group = new Group();
  /** Chip ids switched on. */
  readonly on = new Set(DIM_GROUPS.map(g => g.id));
  enabled = false;
  private list: Dim[] = [];
  private shown: { d: Dim; mid: Vector3; el: HTMLElement; w: number }[] = [];
  private dashMat = new LineDashedNodeMaterial({ color: COLOR, dashSize: 0.16, gapSize: 0.08 });
  private tickMat = new LineBasicNodeMaterial({ color: COLOR });
  private lines: LineSegments | null = null;
  private ticks: LineSegments | null = null;
  private key = '';
  private loading: Promise<void> | null = null;

  constructor(private camera: Camera, private labels: HTMLElement, private url: string, private visible: (d: Dim) => boolean, private stateKey: () => string) {
    this.group.name = 'dimensions';
    // brighter than 1: the scene's tone mapping (AgX) dulls a plain orange to brick red on a 1 px line
    for (const m of [this.dashMat, this.tickMat] as any[]) { m.depthTest = false; m.depthWrite = false; m.transparent = true; m.fog = false; m.color.setRGB(5, 1.5, 0.25); }
    this.group.visible = false;
  }

  /** The dims file is fetched the first time the overlay goes on. */
  private load() {
    this.loading ??= fetch(this.url).then(r => (r.ok ? r.json() : [])).catch(() => []).then((l: Dim[]) => { this.list = (Array.isArray(l) ? l : []).map(d => ({ ...d, label: pillar(d.label), note: d.note && pillar(d.note) })); this.key = ''; });
    return this.loading;
  }

  async setEnabled(on: boolean) {
    this.enabled = on;
    this.group.visible = on;
    this.labels.hidden = !on;
    if (on) await this.load();
  }

  /** The dims that show for the current scenario, options and chips (for the overlay and the tests). */
  current() {
    const groups = new Set(DIM_GROUPS.filter(g => this.on.has(g.id)).flatMap(g => g.groups));
    return this.list.filter(d => groups.has(d.group) && this.visible(d));
  }

  /** Rebuild the lines and labels when what should show has changed. */
  private rebuild() {
    const ds = this.current();
    const pos: number[] = [], tick: number[] = [];
    for (const d of ds) {
      const a = new Vector3().fromArray(d.a), b = new Vector3().fromArray(d.b);
      pos.push(...d.a, ...d.b);
      // a small cross at each end: across the line, both flat and upright (so it reads from the ground and from above)
      _d.subVectors(b, a).normalize();
      const across = Math.abs(_d.y) > 0.9 ? [new Vector3(1, 0, 0), new Vector3(0, 0, 1)] : [_t.set(-_d.z, 0, _d.x).normalize().clone(), new Vector3(0, 1, 0)];
      for (const end of [a, b]) for (const v of across) {
        _u.copy(v).multiplyScalar(TICK);
        tick.push(end.x - _u.x, end.y - _u.y, end.z - _u.z, end.x + _u.x, end.y + _u.y, end.z + _u.z);
      }
    }
    // new line objects each time (a geometry swapped under an object that was first drawn empty never showed)
    for (const l of [this.lines, this.ticks]) if (l) { l.geometry.dispose(); this.group.remove(l); }
    const make = (arr: number[], mat: Material) => {
      const g = new BufferGeometry();
      g.setAttribute('position', new Float32BufferAttribute(arr, 3));
      const l = new LineSegments(g, mat);
      l.frustumCulled = false; l.renderOrder = 9; l.layers.set(OVERLAY_LAYER); l.userData.collide = false;
      this.group.add(l);
      return l;
    };
    this.lines = make(pos, this.dashMat); this.lines.computeLineDistances();
    this.ticks = make(tick, this.tickMat);
    this.labels.textContent = '';
    this.shown = ds.map(d => {
      const el = document.createElement('div');
      el.className = 'dim-label';
      const text = `${d.value_m.toFixed(2)} m`;
      el.innerHTML = `${text}<small>${d.label}</small>`;
      this.labels.appendChild(el);
      return { d, mid: new Vector3().fromArray(d.a).add(_m.fromArray(d.b)).multiplyScalar(0.5), el, w: text.length * 7.5 + 14 };
    });
  }

  /** Call every frame: rebuild if the options changed, then place the labels, nearest first. */
  update(width: number, height: number) {
    if (!this.enabled || !this.list.length) return;
    const key = `${this.stateKey()}|${[...this.on].join()}`;
    if (key !== this.key) { this.key = key; this.rebuild(); }
    const cam = this.camera.position;
    const order = this.shown.map(s => ({ s, dist: s.mid.distanceTo(cam) })).sort((x, y) => x.dist - y.dist);
    const placed: number[][] = [];
    for (const { s, dist } of order) {
      _p.copy(s.mid).project(this.camera);
      const fade = 1 - Math.max(0, Math.min(1, (dist - FADE_NEAR) / (FADE_FAR - FADE_NEAR)));
      const x = ((_p.x + 1) / 2) * width, y = ((1 - _p.y) / 2) * height;
      const named = dist < NAME_NEAR, h = named ? 32 : 18, w = named ? Math.max(s.w, Math.min(234, s.d.label.length * 5.6 + 14)) : s.w;
      let show = _p.z < 1 && fade > 0.04 && x > -w && x < width + w && y > -h && y < height + h;
      // a label that would sit on a nearer one is left out (they're sorted nearest first)
      const box = [x - w / 2 - 3, y - h - 3, x + w / 2 + 3, y + 3];
      if (show && placed.some(p => box[0] < p[2] && box[2] > p[0] && box[1] < p[3] && box[3] > p[1])) show = false;
      if (show) placed.push(box);
      const st = s.el.style;
      st.display = show ? '' : 'none';
      if (!show) continue;
      st.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
      st.opacity = (0.35 + 0.65 * fade).toFixed(2);
      s.el.classList.toggle('named', named);
    }
  }

  /** What's on screen now, for the tests: [shown dims, labels visible]. */
  stats() { return { dims: this.shown.length, labels: this.shown.filter(s => s.el.style.display !== 'none').length }; }
}
