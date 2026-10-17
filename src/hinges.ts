// Generic hinged interactions (Round 15), for the lids and doors coming in the next export. A part tagged in the
// GLB extras with
//   interact: "lid" | "door", group: "<id>", pivot: [x, y, z], axis: [x, y, z], open_deg: <degrees>
// (three.js world coordinates) swings about that axis through that pivot when you press E near it (or tap the
// button on phones). Parts sharing a group move together. Lids can also carry blanket_from: "deep" | "shallow",
// and the rolled blanket in the box `pit_roll`, for the roller-pit unrolling that follows. Like the gates, the
// swinging parts don't change any material or light, so opening one never recompiles anything.
import { Group, Quaternion, Vector3, type Object3D } from 'three/webgpu';

export type Hinge = {
  group: string; kind: 'lid' | 'door'; parts: Object3D[]; pivot: Group; axis: Vector3; openRad: number;
  /** 0 shut, 1 open; eased towards `to` over 0.8 s. */
  angle: number; to: number; from: number; t: number;
  centre: Vector3; extras: Record<string, unknown>;
};

export class Hinges {
  readonly list: Hinge[] = [];

  /** Find tagged parts under root and give each group a pivot to swing about. Call once after the model loads. */
  collect(root: Object3D) {
    const byGroup = new Map<string, Object3D[]>();
    root.traverse(o => {
      const u = o.userData;
      if ((u.interact === 'lid' || u.interact === 'door') && Array.isArray(u.pivot) && Array.isArray(u.axis)) {
        // a tagged node's children are part of it: only take the top-most tagged node
        let p = o.parent, nested = false;
        while (p) { if (p.userData?.interact) { nested = true; break; } p = p.parent; }
        if (nested) return;
        const g = String(u.group ?? o.name);
        if (!byGroup.has(g)) byGroup.set(g, []);
        byGroup.get(g)!.push(o);
      }
    });
    for (const [group, parts] of byGroup) this.add(group, parts);
    return this.list.length;
  }

  /** Make a hinge from parts (also used by the tests with a stand-in object). */
  add(group: string, parts: Object3D[]) {
    const u = parts[0].userData;
    const pivot = new Group();
    pivot.name = `hinge_${group}`;
    pivot.position.fromArray(u.pivot as number[]);
    parts[0].parent!.add(pivot);
    pivot.updateMatrixWorld(true);
    for (const p of parts) { pivot.attach(p); p.traverse(c => { c.userData.hingeGroup = group; }); }
    const centre = new Vector3();
    let n = 0;
    for (const p of parts) { centre.add(p.getWorldPosition(new Vector3())); n++; }
    centre.divideScalar(Math.max(1, n));
    const h: Hinge = {
      group, kind: u.interact as 'lid' | 'door', parts, pivot, axis: new Vector3().fromArray(u.axis as number[]).normalize(),
      openRad: ((u.open_deg as number) ?? 90) * Math.PI / 180, angle: 0, to: 0, from: 0, t: 1, centre, extras: { ...u },
    };
    this.list.push(h);
    return h;
  }

  toggle(h: Hinge, open = h.to === 0) {
    const to = open ? 1 : 0;
    if (h.to === to) return;
    h.from = h.angle; h.to = to; h.t = 0;
  }

  /** The nearest hinge within reach that you're roughly facing, or null. */
  nearest(feet: Vector3, yaw: number, reach = 1.8) {
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    let best = reach, out: Hinge | null = null;
    for (const h of this.list) {
      if (!visible(h.parts[0])) continue;
      const dx = h.centre.x - feet.x, dz = h.centre.z - feet.z, d = Math.hypot(dx, dz);
      if (d < best && (dx * fx + dz * fz) / Math.max(d, 1e-3) > 0.3) { best = d; out = h; }
    }
    return out;
  }

  /** Swing whatever is moving. Returns true while anything moved (so shadows can refresh). */
  update(dt: number) {
    let moved = false;
    const q = new Quaternion();
    for (const h of this.list) {
      if (h.t >= 1) continue;
      h.t = Math.min(1, h.t + dt / 0.8);
      const e = h.t < 0.5 ? 2 * h.t * h.t : 1 - (-2 * h.t + 2) ** 2 / 2;
      h.angle = h.from + (h.to - h.from) * e;
      h.pivot.quaternion.copy(q.setFromAxisAngle(h.axis, h.angle * h.openRad));
      moved = true;
    }
    return moved;
  }
}

function visible(o: Object3D) { let p: Object3D | null = o; while (p) { if (!p.visible) return false; p = p.parent; } return true; }
