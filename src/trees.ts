// The far trees (lod: "far" canopies across the canal and the treeline) are 120-triangle instanced lumps.
// Make them read as soft, leafy canopies for almost no cost, keeping the instancing:
//  - normals bent out from the canopy centre (mixed with the smoothed surface normal) for soft foliage light
//  - a ragged, alpha-tested edge: the silhouette is eaten into by noise where the surface turns away from you
//  - leafy clumps (darker gaps), darker undersides, and per-instance colour, size and rotation variation
import { BufferAttribute, Color, DoubleSide, type Light, InstancedMesh, Matrix4, MeshStandardNodeMaterial, Quaternion, Vector3, type BufferGeometry } from 'three/webgpu';
import { abs, dot, float, fract, lights, materialColor, mix, mx_noise_float, normalView, positionViewDirection, positionWorld, normalWorld, sin, smoothstep, vec2, vec3 } from 'three/tsl';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

function softGeometry(src: BufferGeometry) {
  // drop the faceted normals, weld, then bend the smooth normals towards "away from the centre"
  const g = src.clone();
  g.deleteAttribute('normal');
  const pos = g.getAttribute('position');
  const plain = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) { plain[i * 3] = pos.getX(i); plain[i * 3 + 1] = pos.getY(i); plain[i * 3 + 2] = pos.getZ(i); }
  g.setAttribute('position', new BufferAttribute(plain, 3));
  const w = mergeVertices(g, 1e-3);
  w.computeVertexNormals();
  const n = w.getAttribute('normal'), p = w.getAttribute('position');
  const v = new Vector3(), r = new Vector3();
  for (let i = 0; i < n.count; i++) {
    v.fromBufferAttribute(n, i);
    r.fromBufferAttribute(p, i).normalize();
    v.multiplyScalar(0.35).addScaledVector(r, 0.65).normalize();
    n.setXYZ(i, v.x, v.y, v.z);
  }
  w.computeBoundingSphere();
  return w;
}

function foliageMaterial(base: Color, sun: Light | null) {
  const m = new MeshStandardNodeMaterial();
  // only the sun reaches trees 70 m away; skipping the 14 garden lights keeps night frame rates up
  if (sun) m.lightsNode = lights([sun]);
  m.side = DoubleSide;
  m.roughness = 0.92;
  m.metalness = 0;
  m.alphaTest = 0.5;
  // per-tree seed from which 5 m cell the tree stands in (positionWorld includes the instance transform)
  const seed = () => fract(sin(dot(positionWorld.xz.div(5).floor(), vec2(12.9898, 78.233))).mul(43758.5453));
  // noise in world metres (positionLocal is already instance-transformed for instanced meshes)
  // each noise is evaluated once per fragment and shared by colour and edge (night shading is the busy case)
  const s1 = seed();
  const clumpsN = mx_noise_float(positionWorld.mul(1.1).add(s1.mul(17.0))).mul(0.5).add(0.5).toVar();
  const fineN = mx_noise_float(positionWorld.mul(3.2).add(s1.mul(31.0))).mul(0.5).add(0.5).toVar();
  const clumps = () => clumpsN, fine = () => fineN;
  // darker underneath, where the bent normal points down
  const under = smoothstep(-0.7, 0.6, normalWorld.y);
  // per-tree tint: some greyer and olive (eucalypts), some deeper green, a few a touch yellow
  const tint = mix(vec3(0.8, 0.9, 0.84), vec3(1.08, 1.05, 0.86), s1);
  m.color.copy(base);
  m.colorNode = materialColor.mul(tint).mul(mix(float(0.55), float(1.15), clumps())).mul(mix(float(0.55), float(1.0), under)).mul(mix(float(0.85), float(1.08), fine()));
  // ragged edge: where the (bent) normal turns side-on to the eye, noise cuts leaf-shaped holes
  const rim = float(1).sub(abs(dot(normalView, positionViewDirection)));
  m.opacityNode = float(1).sub(smoothstep(0.42, 0.78, rim.add(fine().sub(0.5).mul(0.55)).add(clumps().sub(0.5).mul(0.3))));
  return m;
}

/** Soften every far canopy; returns how many instanced canopies were changed. */
export function softenFarTrees(meshes: InstancedMesh[], sun: Light | null = null) {
  const geos = new Map<BufferGeometry, BufferGeometry>();
  const mats = new Map<string, MeshStandardNodeMaterial>();
  const m4 = new Matrix4(), pos = new Vector3(), q = new Quaternion(), s = new Vector3(), spin = new Quaternion(), up = new Vector3(0, 1, 0);
  let n = 0;
  for (const mesh of meshes) {
    let g = geos.get(mesh.geometry);
    if (!g) { g = softGeometry(mesh.geometry); geos.set(mesh.geometry, g); }
    mesh.geometry = g;
    const base = ((mesh.material as any).color as Color)?.clone() ?? new Color(0x46532f);
    const key = base.getHexString();
    if (!mats.has(key)) mats.set(key, foliageMaterial(base, sun));
    mesh.material = mats.get(key)!;
    // size, squash and spin per tree (deterministic, so it's the same every visit)
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, m4);
      m4.decompose(pos, q, s);
      const h = Math.sin((pos.x * 12.9898 + pos.z * 78.233) * 43758.5453) * 0.5 + 0.5;
      const h2 = Math.sin((pos.x * 39.346 + pos.z * 11.135) * 24634.6345) * 0.5 + 0.5;
      // kept modest so canopies still sit on their (separately instanced) trunks
      const k = 0.9 + 0.2 * h;
      s.multiplyScalar(k); s.y *= 0.95 + 0.15 * h2;
      spin.setFromAxisAngle(up, h2 * Math.PI * 2);
      q.premultiply(spin);
      m4.compose(pos, q, s);
      mesh.setMatrixAt(i, m4);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    n += mesh.count;
  }
  return n;
}
