// Merge static meshes that share a material into one mesh each, so every pass (main, mirrors, shadow) issues
// a few hundred fewer draw calls and three has far fewer objects to update and compile.
//
// Meshes are only merged with others that would always be shown, hidden and lit the same way: same material,
// same scenario/option/people/lod tags, same collide and shadow flags, same vertex layout, and the same coarse
// region (our lot north of the canal wall, the rest in 60 m cells, so far-away groups still frustum-cull).
import { BufferAttribute, BufferGeometry, Mesh, type Material, type Object3D } from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const TAGS = ['set', 'option', 'people', 'lod', 'collide'] as const;

/** A float copy of the geometry in world space (quantised glTF attributes are de-normalised). */
function worldGeometry(mesh: Mesh) {
  const src = mesh.geometry as BufferGeometry, out = new BufferGeometry();
  for (const name of Object.keys(src.attributes)) {
    const a = src.getAttribute(name) as BufferAttribute, n = a.count, size = a.itemSize, arr = new Float32Array(n * size);
    for (let i = 0; i < n; i++) for (let k = 0; k < size; k++) arr[i * size + k] = a.getComponent(i, k);
    out.setAttribute(name, new BufferAttribute(arr, size));
  }
  if (src.index) out.setIndex(Array.from(src.index.array as ArrayLike<number>));
  else out.setIndex([...Array(src.getAttribute('position').count).keys()]);
  out.applyMatrix4(mesh.matrixWorld);
  return out;
}

/**
 * @param host where merged meshes are added (the glTF scene, so they're top-level like the originals)
 * @param keep meshes that must stay individual (water, gates, lawns, swapped fence panels, LEDs…)
 */
export function mergeStatic(root: Object3D, host: Object3D, keep: Set<Object3D>) {
  root.updateMatrixWorld(true);
  const groups = new Map<string, Mesh[]>();
  const p = { x: 0, z: 0 };
  root.traverse(o => {
    const m = o as Mesh;
    if (!m.isMesh || (m as any).isInstancedMesh || (m as any).isSkinnedMesh || keep.has(m) || Array.isArray(m.material)) return;
    const u = m.userData;
    if (u.water || u.gateLeaf || u.window || u.night || u.noMerge) return;
    let anc: Object3D | null = m.parent, gated = false;
    while (anc) { if (anc.userData.gateLeaf || keep.has(anc)) gated = true; anc = anc.parent; }
    if (gated) return;
    const g = m.geometry as BufferGeometry;
    if (!g.getAttribute('position')) return;
    g.computeBoundingBox();
    const c = g.boundingBox!.getCenter(new (g.boundingBox!.min.constructor as any)()).applyMatrix4(m.matrixWorld);
    p.x = c.x; p.z = c.z;
    const region = c.z < 11 && c.x > -12 && c.x < 20 ? 'lot' : `${Math.floor(c.x / 60)},${Math.floor(c.z / 60)}`;
    const attrs = Object.keys(g.attributes).sort().map(k => `${k}${g.getAttribute(k).itemSize}`).join(',');
    const key = [(m.material as Material).uuid, ...TAGS.map(t => String(u[t])), m.castShadow, m.receiveShadow, attrs, region].join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(m);
  });
  let before = 0, after = 0;
  for (const meshes of groups.values()) {
    before += meshes.length;
    if (meshes.length < 2) { after++; continue; }
    const merged = mergeGeometries(meshes.map(worldGeometry), false);
    if (!merged) { after += meshes.length; continue; }
    merged.computeBoundingBox(); merged.computeBoundingSphere();
    const first = meshes[0];
    const mesh = new Mesh(merged, first.material);
    mesh.name = `merged_${(first.material as Material).name || 'mat'}_${meshes.length}`;
    for (const t of TAGS) if (first.userData[t] !== undefined) mesh.userData[t] = first.userData[t];
    mesh.castShadow = first.castShadow; mesh.receiveShadow = first.receiveShadow;
    host.add(mesh);
    for (const m of meshes) { m.geometry.dispose?.(); m.removeFromParent(); }
    after++;
  }
  return { before, after };
}
