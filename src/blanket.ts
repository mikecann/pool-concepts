// Blanket boxes (Round 16): press E at an in-ground blanket box and the lids open, the bubble blanket unrolls out of
// the box across the pool to the far end, and the lids close behind it. E again opens the lids, rolls it back in
// and closes the box. The sheet is a translucent blue bubble blanket a little above the water, cut from the pool
// water's own top surface (so it follows the pool's shape) and revealed from the box end as it unrolls; the roll
// in the box shrinks as the sheet comes off it. The sheet is always in the scene while its box is (fully cut away
// while rolled up), so its shaders are compiled at load and unrolling never stalls a frame.
// Round 20: a roll with no lids (the open roller channel) works the same without the lid steps; E near the roll
// itself starts it, since there's no lid to aim at.
import {
  BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshStandardNodeMaterial, Quaternion, Vector3, type Object3D,
} from 'three/webgpu';
import { dot, float, floor, fract, length, mix, positionWorld, select, smoothstep, uniform, vec2, vec3 } from 'three/tsl';
import type { Hinge, Hinges } from './hinges';

type Phase = 'in' | 'opening' | 'unrolling' | 'closing-out' | 'out' | 'opening-in' | 'rolling' | 'closing-in';

export type BlanketBox = {
  group: string; hinge: Hinge | null; sheet: Mesh; roll: Group | null; progress: any;
  phase: Phase; t: number; dir: Vector3; origin: Vector3; length: number;
  /** Along the roll's axis and half its length: for finding a lidless roll to use with E. */
  axis: Vector3; half: number;
};

const OPEN_S = 0.9, ROLL_S = 4.5, LIFT = 0.012, CORE = 0.32;

export class Blankets {
  readonly boxes: BlanketBox[] = [];

  /** Find each box's rolled blanket (pit_roll) and lids (a lid hinge with blanket_from), if any, and build its sheet. */
  setup(root: Object3D, hinges: Hinges, poolWater: Mesh[]) {
    const rolls = new Map<string, Object3D>();
    root.traverse(o => { if (o.userData.pit_roll && !rolls.has(o.userData.pit_roll)) rolls.set(o.userData.pit_roll, o); });
    const top = poolTop(poolWater);
    if (!top) return 0;
    const lids = hinges.list.filter(h => h.kind === 'lid' && h.extras.blanket_from);
    const groups = new Set([...lids.map(h => h.group), ...[...rolls.values()].filter(o => o.userData.blanket_from).map(o => o.userData.pit_roll as string)]);
    for (const group of groups) {
      const h = lids.find(l => l.group === group) ?? null;
      const rollObj = rolls.get(group) ?? null;
      if (!h && !rollObj) continue;
      const u = rollObj?.userData ?? {};
      // across the pool, away from the box: perpendicular to the roll's axis, pointing at the pool's middle
      const axis = new Vector3().fromArray((u.roll_axis as number[]) ?? [1, 0, 0]).setY(0).normalize();
      const origin = new Vector3().fromArray((u.roll_center as number[]) ?? h!.centre.toArray());
      const dir = new Vector3(-axis.z, 0, axis.x);
      if (dir.dot(top.centre.clone().sub(origin)) < 0) dir.negate();
      // how far the sheet goes: to the far side of the pool's top along dir
      let length = 0;
      for (let i = 0; i < top.pos.length; i += 3) length = Math.max(length, (top.pos[i] - origin.x) * dir.x + (top.pos[i + 2] - origin.z) * dir.z);
      const progress = uniform(0);
      const sheet = this.makeSheet(top.pos, top.y + LIFT, origin, dir, length, progress);
      sheet.name = `blanket_${group}`;
      sheet.userData = { set: 'proposed', option: group, collide: false, noMerge: true };
      root.add(sheet);
      // the roll shrinks about its own axis: put it under a group aligned with that axis
      let roll: Group | null = null;
      if (rollObj && rollObj.parent) {
        roll = new Group();
        roll.name = `blanket_roll_${group}`;
        roll.position.copy(origin);
        roll.quaternion.copy(new Quaternion().setFromUnitVectors(new Vector3(1, 0, 0), axis));
        rollObj.parent.add(roll);
        roll.updateMatrixWorld(true);
        roll.attach(rollObj);
      }
      this.boxes.push({ group, hinge: h, sheet, roll, progress, phase: 'in', t: 0, dir, origin, length, axis, half: ((u.roll_length as number) ?? 4) / 2 });
    }
    return this.boxes.length;
  }

  private makeSheet(pos: number[], y: number, origin: Vector3, dir: Vector3, reach: number, progress: any) {
    const out: number[] = [];
    for (let i = 0; i < pos.length; i += 3) out.push(pos[i], y, pos[i + 2]);
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(out, 3));
    g.setAttribute('normal', new Float32BufferAttribute(out.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    g.computeBoundingSphere();
    const m = new MeshStandardNodeMaterial();
    m.side = DoubleSide;
    m.transparent = true;
    m.depthWrite = false;
    m.roughness = 0.3;
    m.metalness = 0;
    // a bubble blanket: hexagonally packed 22 mm bubbles, 30 mm apart, a darker translucent blue between them
    const p = positionWorld.xz.div(0.03);
    const row = floor(p.y.div(0.866));
    const q = vec2(p.x.add(fract(row.mul(0.5)).mul(1)), p.y.div(0.866));
    const d = length(fract(q).sub(0.5).mul(vec2(1, 0.866)));
    const bubble = smoothstep(0.38, 0.3, d);
    m.colorNode = mix(vec3(0.03, 0.16, 0.36), vec3(0.2, 0.45, 0.72), bubble);
    // revealed from the box as it unrolls, with a soft 2 cm leading edge
    const s = dot(positionWorld.xz.sub(vec2(origin.x, origin.z)), vec2(dir.x, dir.z));
    const shown = smoothstep(progress.mul(reach).add(0.01), progress.mul(reach).sub(0.01), s);
    m.opacityNode = select(progress.greaterThan(0.001), shown.mul(mix(float(0.78), float(0.9), bubble)), float(0));
    m.alphaTest = 0.02;
    const mesh = new Mesh(g, m);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.renderOrder = 3;   // over the pool water
    return mesh;
  }

  /** The box whose lids these are, if any. */
  forHinge(h: Hinge | null) { return h ? this.boxes.find(b => b.hinge === h) ?? null : null; }

  /**
   * A lidless roll you could use from (x, z) at eye height eyeY: within reach of the roll (plan distance to its
   * length) and not far above or below it. Boxes with lids are found through their lids instead.
   */
  nearLidless(x: number, z: number, eyeY: number, usable: (b: BlanketBox) => boolean, reach = 1.6) {
    let best: BlanketBox | null = null, bestD = reach;
    for (const b of this.boxes) {
      if (b.hinge || !usable(b) || eyeY < b.origin.y - 0.5 || eyeY > b.origin.y + 3) continue;
      const px = x - b.origin.x, pz = z - b.origin.z, along = Math.max(-b.half, Math.min(b.half, px * b.axis.x + pz * b.axis.z));
      const d = Math.hypot(px - b.axis.x * along, pz - b.axis.z * along);
      if (d < bestD) { bestD = d; best = b; }
    }
    return best;
  }

  /** E at a box: unroll if it's rolled up, roll it back in if it's out. Ignored while it's moving. No lids: no lid steps. */
  toggle(b: BlanketBox, hinges: Hinges) {
    if (b.phase === 'in') { b.t = 0; if (b.hinge) { b.phase = 'opening'; hinges.toggle(b.hinge, true); } else b.phase = 'unrolling'; }
    else if (b.phase === 'out') { b.t = 0; if (b.hinge) { b.phase = 'opening-in'; hinges.toggle(b.hinge, true); } else b.phase = 'rolling'; }
  }

  /** Label for the E prompt. */
  label(b: BlanketBox) { return b.phase === 'out' ? 'roll the blanket in' : b.phase === 'in' ? 'unroll the blanket' : ''; }

  /** Advance the animations. Returns true while anything moves. */
  update(dt: number, hinges: Hinges) {
    let moving = false;
    for (const b of this.boxes) {
      if (b.phase === 'in' || b.phase === 'out') continue;
      moving = true;
      b.t += dt;
      const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
      switch (b.phase) {
        case 'opening': if (b.t > OPEN_S) { b.phase = 'unrolling'; b.t = 0; } break;
        case 'unrolling': b.progress.value = ease(Math.min(1, b.t / ROLL_S)); if (b.t > ROLL_S) { b.t = 0; if (b.hinge) { b.phase = 'closing-out'; hinges.toggle(b.hinge, false); } else b.phase = 'out'; } break;
        case 'closing-out': if (b.t > OPEN_S) b.phase = 'out'; break;
        case 'opening-in': if (b.t > OPEN_S) { b.phase = 'rolling'; b.t = 0; } break;
        case 'rolling': b.progress.value = 1 - ease(Math.min(1, b.t / ROLL_S)); if (b.t > ROLL_S) { b.progress.value = 0; b.t = 0; if (b.hinge) { b.phase = 'closing-in'; hinges.toggle(b.hinge, false); } else b.phase = 'in'; } break;
        case 'closing-in': if (b.t > OPEN_S) b.phase = 'in'; break;
      }
      // the roll in the box: full when the sheet is in, down to its core when it's all out
      if (b.roll) { const k = Math.sqrt(1 - (1 - CORE * CORE) * (b.progress.value as number)); b.roll.scale.set(1, k, k); }
    }
    return moving;
  }

  /** Back to rolled up (when the box is switched off, or for tests). */
  reset(b: BlanketBox, hinges: Hinges) {
    b.phase = 'in'; b.t = 0; b.progress.value = 0;
    if (b.roll) b.roll.scale.set(1, 1, 1);
    if (b.hinge) hinges.toggle(b.hinge, false);
  }
}

/** The pool water's up-facing top triangles in world space (flat array), their height and centre. */
function poolTop(waters: Mesh[]) {
  const pos: number[] = [];
  let y = -Infinity;
  const a = new Vector3(), b = new Vector3(), c = new Vector3(), centre = new Vector3();
  for (const w of waters) {
    w.updateWorldMatrix(true, false);
    const g = w.geometry, p = g.getAttribute('position'), idx = g.index;
    const n = idx ? idx.count : p.count;
    let top = -Infinity;
    for (let i = 0; i < p.count; i++) top = Math.max(top, a.fromBufferAttribute(p as any, i).applyMatrix4(w.matrixWorld).y);
    for (let i = 0; i < n; i += 3) {
      a.fromBufferAttribute(p as any, idx ? idx.getX(i) : i).applyMatrix4(w.matrixWorld);
      b.fromBufferAttribute(p as any, idx ? idx.getX(i + 1) : i + 1).applyMatrix4(w.matrixWorld);
      c.fromBufferAttribute(p as any, idx ? idx.getX(i + 2) : i + 2).applyMatrix4(w.matrixWorld);
      if (Math.max(Math.abs(a.y - top), Math.abs(b.y - top), Math.abs(c.y - top)) > 0.01) continue;
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
      centre.add(a).add(b).add(c);
    }
    y = Math.max(y, top);
  }
  if (!pos.length) return null;
  return { pos, y, centre: centre.divideScalar(pos.length / 3) };
}
