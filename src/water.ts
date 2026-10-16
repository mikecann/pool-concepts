// Water for the pool, spa and canal.
//
// A standard node material with no diffuse colour, so the lighting model supplies what water really
// reflects: the sun's glint (shadowed) and the sky or a planar reflection, with water's Fresnel (IOR 1.33).
// What you see *through* the surface is added as emission: the scene behind it from the viewport colour
// buffer, offset by the ripples, absorbed per colour channel by the depth of water the ray travels through,
// plus light scattered back out of the water body.
import { Color, MeshStandardNodeMaterial, Vector2 } from 'three/webgpu';
import {
  abs, cameraNear, cameraFar, cameraPosition, clamp, cos, dot, exp, float, Fn, If, length, Loop, max, mix, mx_noise_vec3,
  normalize, perspectiveDepthToViewZ, positionView, positionWorld, pow, screenUV, sin, smoothstep, time,
  transformNormalToView, uniform, vec2, vec3, viewportDepthTexture, viewportSharedTexture, select,
} from 'three/tsl';
import type { Atmosphere } from './atmosphere';
import type { Mirror } from './mirror';

export type WaterKind = 'pool' | 'spa' | 'canal';

const PRESETS: Record<WaterKind, {
  absorb: [number, number, number]; scatter: [number, number, number]; rough: number; refract: number;
  waves: [number, number, number, number, number][]; detail: number; detailScale: number; detailSpeed: number;
}> = {
  // absorption per metre (r, g, b): red goes first, which is what makes a pale shell read aqua
  pool: { absorb: [0.36, 0.1, 0.08], scatter: [0.004, 0.016, 0.024], rough: 0.02, refract: 0.03,
    // [dir angle, wavelength m, amplitude m, speed rad/s, unused]
    // a calm residential pool: a few millimetres of slow swell, so reflections wobble gently instead of striping
    waves: [[0.4, 2.3, 0.0009, 0.9, 0], [2.1, 1.4, 0.0005, 1.3, 0], [4.0, 0.8, 0.00022, 1.8, 0], [5.3, 0.45, 0.0001, 2.5, 0]],
    detail: 0.003, detailScale: 2.2, detailSpeed: 0.35 },
  spa: { absorb: [0.30, 0.085, 0.07], scatter: [0.005, 0.018, 0.026], rough: 0.04, refract: 0.05,
    waves: [[0.9, 0.7, 0.002, 2.6, 0], [2.7, 0.45, 0.0014, 3.4, 0], [4.6, 0.3, 0.0009, 4.2, 0]],
    detail: 0.07, detailScale: 5.5, detailSpeed: 1.4 },
  canal: { absorb: [1.2, 0.6, 0.55], scatter: [0.016, 0.045, 0.04], rough: 0.05, refract: 0.02,
    waves: [[1.2, 5.5, 0.03, 0.75, 0], [2.6, 2.7, 0.014, 1.1, 0], [0.3, 1.3, 0.006, 1.7, 0], [3.9, 0.7, 0.003, 2.4, 0]],
    detail: 0.05, detailScale: 1.4, detailSpeed: 0.3 },
};

/** Surface slope (dh/dx, dh/dz) of a sum of travelling sine waves plus a little noise. */
function slope(kind: WaterKind) {
  const P = PRESETS[kind];
  return Fn(([p]: [any]) => {
    const g = vec2(0, 0).toVar();
    for (const [ang, len, amp, speed] of P.waves) {
      const d = new Vector2(Math.cos(ang), Math.sin(ang));
      const k = (2 * Math.PI) / len;
      const phase = dot(p, vec2(d.x, d.y)).mul(k).add(time.mul(speed));
      g.addAssign(vec2(d.x, d.y).mul(cos(phase).mul(amp * k)));
    }
    const n = mx_noise_vec3(vec3(p.mul(P.detailScale), time.mul(P.detailSpeed)));
    g.addAssign(n.xy.mul(P.detail));
    return g;
  });
}

export function waterMaterial(kind: WaterKind, atm: Atmosphere, mirror: Mirror | null) {
  const P = PRESETS[kind];
  const m = new MeshStandardNodeMaterial();
  m.transparent = true;   // drawn after the opaque scene so the viewport buffer holds what's underneath
  m.opacity = 1;
  m.depthWrite = true;
  m.metalness = 0;
  m.roughness = P.rough;
  (m as any).ior = 1.33;
  m.colorNode = vec3(0);

  const g = slope(kind)(positionWorld.xz);
  const nWorld = normalize(vec3(g.x.negate(), 1, g.y.negate()));
  m.normalNode = transformNormalToView(nWorld);

  // planar reflection, nudged by the ripples. It replaces the sky env reflection (added with Fresnel below),
  // so the lighting model only contributes the sun's glint.
  // how far the ripples push the reflection around: gentle on the pool and spa, choppier on the canal
  const reflection = mirror ? mirror.sample(g.mul({ pool: 0.05, spa: 0.15, canal: 0.25 }[kind])) : null;
  // until the mirror's shaders are ready (it's built after the first frame) the sky env map reflects instead;
  // mirror.on fades from one to the other, and the material's envMapIntensity follows it each frame
  if (reflection) m.userData.mirror = mirror;

  const absorb = vec3(...P.absorb), scatter = vec3(...P.scatter);
  m.emissiveNode = Fn(() => {
    const surfaceZ = positionView.z;
    const dist = length(positionView);
    const offset = g.mul(P.refract).div(max(dist.mul(0.12), 1));
    const uvR = screenUV.add(offset).toVar();
    const sceneZ = perspectiveDepthToViewZ(viewportDepthTexture(uvR).x, cameraNear, cameraFar).toVar();
    // something in front of the water at the refracted spot: don't refract
    If(sceneZ.greaterThan(surfaceZ), () => {
      uvR.assign(screenUV);
      sceneZ.assign(perspectiveDepthToViewZ(viewportDepthTexture(screenUV).x, cameraNear, cameraFar));
    });
    const thickness = clamp(surfaceZ.sub(sceneZ), 0, 60);
    // the light also travels down to the floor, roughly the vertical depth again
    const V = normalize(cameraPosition.sub(positionWorld));
    const path = thickness.mul(float(1).add(abs(V.y)));
    const T = exp(absorb.mul(path).negate());
    const behind = viewportSharedTexture(uvR).rgb;
    // in-scattered light from the sun and sky, plus whatever the pool light puts in at night
    const ambient = atm.sunIntensityU.mul(max(atm.sunDirU.y, 0)).mul(0.11).add(atm.skyGain.mul(0.16)).add(atm.nightU.mul(kind === 'canal' ? 0.004 : 0.03));
    const body = scatter.mul(ambient).mul(float(1).sub(T));
    const NdV = max(dot(nWorld, V), 0);
    const F = float(0.02).add(float(0.98).mul(pow(float(1).sub(NdV), 5)));
    const through = behind.mul(T).add(body).mul(float(1).sub(F));
    return reflection ? through.add(reflection.mul(F).mul(mirror!.on)) : through;
  })();
  m.userData.waterKind = kind;
  return m;
}

/**
 * Sunlight focused by the ripples onto the pool floor and walls. It modulates the albedo of anything under
 * the water inside the pool's footprint, so it follows the real sun shadow for free (in shade there's no
 * direct light for it to brighten).
 */
export function causticsAlbedo(base: any, box: { minX: number; maxX: number; minZ: number; maxZ: number; level: number }, sunDir: any) {
  const bounds = uniform(new Vector2(box.minX, box.maxX)), boundsZ = uniform(new Vector2(box.minZ, box.maxZ));
  const level = uniform(box.level);
  const caustic = Fn(([uv0]: [any]) => {
    // after Dave Hoskins' tileable water caustic
    const p = uv0.mul(6.2831).mod(6.2831).sub(250).toVar();
    const i = p.toVar();
    const c = float(1).toVar();
    const inten = 0.005;
    Loop(4, ({ i: n }: any) => {
      const t = time.mul(0.35).mul(float(1).sub(float(3.5).div(float(n).add(1))));
      i.assign(p.add(vec2(cos(t.sub(i.x)).add(sin(t.add(i.y))), sin(t.sub(i.y)).add(cos(t.add(i.x))))));
      c.addAssign(float(1).div(length(vec2(p.x.div(sin(i.x.add(t)).div(inten)), p.y.div(cos(i.y.add(t)).div(inten))))));
    });
    c.divAssign(4);
    c.assign(float(1.17).sub(pow(c, 1.4)));
    return pow(abs(c), 8);
  });
  const wp = positionWorld;
  const inside = smoothstep(bounds.x, bounds.x.add(0.05), wp.x).mul(smoothstep(bounds.y, bounds.y.sub(0.05), wp.x))
    .mul(smoothstep(boundsZ.x, boundsZ.x.add(0.05), wp.z)).mul(smoothstep(boundsZ.y, boundsZ.y.sub(0.05), wp.z))
    .mul(smoothstep(level, level.sub(0.05), wp.y));
  const cst = caustic(wp.xz.mul(0.42)).add(caustic(wp.xz.mul(0.42).add(vec2(0.013, 0.008))).mul(0.6));
  // a high sun focuses crisp caustics; a low evening sun through calm water gives only a faint shimmer
  const strength = smoothstep(0.15, 0.75, sunDir.y).mul(inside);
  const gain = select(inside.greaterThan(0), mix(float(1), float(0.84).add(cst.mul(0.95)), strength), float(1));
  return base.mul(gain);
}

export const WATER_TINT = new Color(0x2c7e8b);
