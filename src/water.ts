// Water for the pool, spa and canal.
//
// A standard node material with no diffuse colour, so the lighting model supplies what water really
// reflects: the sun's glint (shadowed) and the sky or a planar reflection, with water's Fresnel (IOR 1.33).
// What you see *through* the surface is added as emission: the scene behind it from the viewport colour
// buffer, offset by the ripples, absorbed per colour channel by the depth of water the ray travels through,
// plus light scattered back out of the water body.
import { Color, DoubleSide, MeshStandardNodeMaterial, Vector2 } from 'three/webgpu';
import {
  abs, cameraNear, mx_noise_float, cameraFar, cameraPosition, clamp, cos, dot, exp, float, Fn, If, length, Loop, max, mix, mx_noise_vec3, mx_worley_noise_vec2,
  modelWorldMatrix, normalLocal, normalize, normalWorld, perspectiveDepthToViewZ, transformDirection, vertexStage, positionView, positionWorld, pow, screenUV, sin, smoothstep, time,
  transformNormalToView, frontFacing, uniform, specularColor, specularColorBlended, specularF90, diffuseColor, metalness, vec2, vec3, viewportDepthTexture, viewportSharedTexture, select,
} from 'three/tsl';
import type { Atmosphere } from './atmosphere';
import type { Mirror } from './mirror';

export type WaterKind = 'pool' | 'spa' | 'canal';

const OLD_PRESETS: Record<WaterKind, {
  absorb: [number, number, number]; scatter: [number, number, number]; rough: number; refract: number;
  waves: [number, number, number, number, number][]; detail: number; detailScale: number; detailSpeed: number;
}> = {
  // absorption per metre (r, g, b): red goes first, which is what makes a pale shell read aqua
  pool: new URLSearchParams(location.search).has('pool0') ? { absorb: [0.36, 0.1, 0.08], scatter: [0.004, 0.016, 0.024], rough: 0.02, refract: 0.03,
    // [dir angle, wavelength m, amplitude m, speed rad/s, unused]
    // a calm residential pool: a few millimetres of slow swell, so reflections wobble gently instead of striping
    waves: [[0.4, 2.3, 0.0009, 0.9, 0], [2.1, 1.4, 0.0005, 1.3, 0], [4.0, 0.8, 0.00022, 1.8, 0], [5.3, 0.45, 0.0001, 2.5, 0]],
    detail: 0.003, detailScale: 2.2, detailSpeed: 0.35 } : {
    // a deeper Mondo blue: more red and green absorbed per metre, more light scattered back out of the body
    absorb: [0.62, 0.17, 0.11], scatter: [0.006, 0.024, 0.04], rough: 0.02, refract: 0.03,
    waves: [[0.4, 2.3, 0.0009, 0.9, 0], [2.1, 1.4, 0.0005, 1.3, 0], [4.0, 0.8, 0.00022, 1.8, 0], [5.3, 0.45, 0.0001, 2.5, 0]],
    detail: 0.003, detailScale: 2.2, detailSpeed: 0.35 },
  spa: { absorb: [0.30, 0.085, 0.07], scatter: [0.005, 0.018, 0.026], rough: 0.04, refract: 0.05,
    waves: [[0.9, 0.7, 0.002, 2.6, 0], [2.7, 0.45, 0.0014, 3.4, 0], [4.6, 0.3, 0.0009, 4.2, 0]],
    detail: 0.07, detailScale: 5.5, detailSpeed: 1.4 },
  canal: { absorb: [1.2, 0.6, 0.55], scatter: [0.016, 0.045, 0.04], rough: 0.05, refract: 0.02,
    waves: [[1.2, 5.5, 0.03, 0.75, 0], [2.6, 2.7, 0.014, 1.1, 0], [0.3, 1.3, 0.006, 1.7, 0], [3.9, 0.7, 0.003, 2.4, 0]],
    detail: 0.05, detailScale: 1.4, detailSpeed: 0.3 },
};

/** How much of the pool floor shows through (Round 8): a Mondo-blue body veils it, as in Cycles. ?veil=0 for the old clear water. */
/** The canal: how far the swell bends the reflection (0.35 smeared the far bank into blobs), and its strength. */
const CANAL_WOBBLE = Number(new URLSearchParams(location.search).get('wobble') ?? 0.15);
const TUB_GLOW = Number(new URLSearchParams(location.search).get('tubglow') ?? 0.012);
const MURK_COL = (new URLSearchParams(location.search).get('murkcol') ?? '0.035,0.06,0.085').split(',').map(Number) as [number, number, number];
const MURK = Number(new URLSearchParams(location.search).get('murk') ?? 0.8);
const STREAK_LEN = Number(new URLSearchParams(location.search).get('streaklen') ?? 0.012);
const STREAK0 = new URLSearchParams(location.search).has('streak0');
const STREAK = Number(new URLSearchParams(location.search).get('streak') ?? 3);
const CANAL_TINT: [number, number, number] | null = new URLSearchParams(location.search).has('canaltint0') ? null : [0.9, 0.97, 1.0];
const CANAL_REFLECT = Number(new URLSearchParams(location.search).get('creflect') ?? 0.6);
/** Round 9 underwater lighting (see causticsAlbedo). ?uw0=1 turns it off; ?uwwall= sets how dim the walls are. */
const NO_UNDERWATER = new URLSearchParams(location.search).has('uw0');
const UW_WALL = Number(new URLSearchParams(location.search).get('uwwall') ?? 0.15);
const UW_ABSORB: [number, number, number] = [0.27, 0.12, 0.105];
/** Round 9: the pool's water as Cycles has it (clear, light absorption, no body colour). ?water8=1 for Round 8. */
const CYCLES = !new URLSearchParams(location.search).has('water8');
/** Round 9 caustic net (Cycles' construction); ?net0=1 for Round 8's. Sun through the surface: lines / cells. */
const NET = !new URLSearchParams(location.search).has('net0');
const NET_HI = Number(new URLSearchParams(location.search).get('nethi') ?? 1.15), NET_LO = Number(new URLSearchParams(location.search).get('netlo') ?? 0.75);
const VEIL = Number(new URLSearchParams(location.search).get('veil') ?? 0.5);
type Preset = typeof OLD_PRESETS['pool'] & { glint?: number; caustic?: number; veil?: number; body?: [number, number, number] };
/** Round 7 water: a deeper Mondo teal pool and spa, and a calm, mirror-like canal. ?water0=1 for the old look. */
const PRESETS: Record<WaterKind, Preset> = new URLSearchParams(location.search).has('water0') ? OLD_PRESETS : {
  pool: CYCLES ? { absorb: [0.27, 0.12, 0.105], scatter: [0.001, 0.004, 0.006], rough: 0.015, refract: 0.03,
    waves: [[0.4, 2.3, 0.0009, 0.9, 0], [2.1, 1.4, 0.0005, 1.3, 0], [4.0, 0.8, 0.00022, 1.8, 0], [5.3, 0.45, 0.0001, 2.5, 0]],
    detail: 0.003, detailScale: 2.2, detailSpeed: 0.35, caustic: 1 } :
  { absorb: [0.55, 0.16, 0.1], scatter: [0.004, 0.03, 0.05], rough: 0.015, refract: 0.03,
    waves: [[0.4, 2.3, 0.0009, 0.9, 0], [2.1, 1.4, 0.0005, 1.3, 0], [4.0, 0.8, 0.00022, 1.8, 0], [5.3, 0.45, 0.0001, 2.5, 0]],
    detail: 0.003, detailScale: 2.2, detailSpeed: 0.35, caustic: 1, veil: VEIL, body: [0.09, 0.2, 0.32] },
  spa: CYCLES ? { absorb: [0.95, 0.24, 0.2],   // Round 15: a hot tub's aqua (was Cycles' 0.315, 0.14, 0.12)
    scatter: [0.001, 0.004, 0.006], rough: 0.03, refract: 0.04,
    waves: [[0.9, 0.7, 0.0012, 2.0, 0], [2.7, 0.45, 0.0008, 2.6, 0], [4.6, 0.3, 0.0005, 3.2, 0]],
    detail: 0.035, detailScale: 5.5, detailSpeed: 1.0, caustic: 1 } :
  { absorb: [1.05, 0.3, 0.17], scatter: [0.005, 0.034, 0.055], rough: 0.03, refract: 0.04,
    waves: [[0.9, 0.7, 0.0012, 2.0, 0], [2.7, 0.45, 0.0008, 2.6, 0], [4.6, 0.3, 0.0005, 3.2, 0]],
    detail: 0.035, detailScale: 5.5, detailSpeed: 1.0, caustic: 1, veil: VEIL, body: [0.09, 0.2, 0.32] },
  // a sheltered canal on a calm day: long, low swell in three directions (no repeating pattern), and a slow
  // broken noise on top; the sun's glitter is turned off so the far bank's reflection carries it
  canal: { absorb: [1.2, 0.6, 0.55], scatter: [0.012, 0.035, 0.034], rough: 0.09, refract: 0.02,
    waves: [[1.2, 11.0, 0.0075, 0.45, 0], [2.9, 6.3, 0.004, 0.6, 0], [0.2, 3.7, 0.0018, 0.85, 0]],
    detail: 0.022, detailScale: 0.6, detailSpeed: 0.12, glint: 0 },
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

/**
 * Round 15: the hot tub running. Four jets near the wall boil up foam that drifts and breaks up, a fine fizz of
 * bubbles over the surface, and a churned surface that's rougher near the jets. All in the surface shader.
 * Returns the foam cover (0..1) and an extra surface slope. ?tub0=1 for the plain spa water.
 */
function hotTub(tub: { cx: number; cz: number; r: number }) {
  const p = positionWorld.xz, c = vec2(tub.cx, tub.cz);
  let jets: any = float(0);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + 0.6, jx = tub.cx + Math.cos(a) * (tub.r - 0.14), jz = tub.cz + Math.sin(a) * (tub.r - 0.14);
    const d = p.sub(vec2(jx, jz));
    jets = jets.add(exp(dot(d, d).mul(-7)));
  }
  const rad = length(p.sub(c)).div(tub.r);
  // swirling flow: sample the noise in coordinates that turn slowly round the tub
  const ang = time.mul(0.25);
  const q = vec2(p.x.mul(cos(ang)).sub(p.y.mul(sin(ang))), p.x.mul(sin(ang)).add(p.y.mul(cos(ang))));
  const churn = mx_noise_vec3(vec3(q.mul(7), time.mul(1.6)));
  const froth = mx_noise_float(vec3(q.mul(34), time.mul(2.6))).mul(0.5).add(0.5).mul(mx_noise_float(vec3(q.mul(9), time.mul(1.1))).mul(0.4).add(0.8));
  const fizz = mx_noise_float(vec3(p.mul(110), time.mul(5))).mul(0.5).add(0.5);
  const near = jets.min(1).add(smoothstep(0.85, 1.0, rad).mul(0.12));
  const foam = smoothstep(0.3, 0.75, froth.mul(near.mul(1.25))).add(smoothstep(0.7, 0.82, fizz).mul(0.3)).clamp(0, 1);
  const slopeAdd = churn.xy.mul(float(0.09).add(near.mul(0.18)));
  return { foam, slopeAdd };
}

export function waterMaterial(kind: WaterKind, atm: Atmosphere, mirror: Mirror | null, tub?: { cx: number; cz: number; r: number }, tubGlow: any = vec3(0.1, 0.55, 0.62)) {
  const P = PRESETS[kind];
  const m = new MeshStandardNodeMaterial();
  m.transparent = true;   // drawn after the opaque scene so the viewport buffer holds what's underneath
  m.opacity = 1;
  m.depthWrite = true;
  m.metalness = 0;
  m.roughness = P.rough;
  (m as any).ior = 1.33;
  if (P.glint === 0) (m as any).specularIntensity = 0;   // no sun glitter; the mirror and Fresnel do the work
  m.colorNode = vec3(0);
  if (kind !== 'canal') m.side = DoubleSide;   // Round 15: the surface seen from under the water

  const T0 = tub && !new URLSearchParams(location.search).has('tub0') ? hotTub(tub) : null;
  const g = T0 ? slope(kind)(positionWorld.xz).add(T0.slopeAdd) : slope(kind)(positionWorld.xz);
  if (T0) {
    // foam is a lit, rough white surface; clear water stays a mirror
    m.colorNode = vec3(0.82, 0.86, 0.87).mul(T0.foam);
    m.roughnessNode = mix(float(P.rough), float(0.7), T0.foam);
  }
  const nWorld = normalize(vec3(g.x.negate(), 1, g.y.negate()));
  m.normalNode = transformNormalToView(nWorld);

  // planar reflection, nudged by the ripples. It replaces the sky env reflection (added with Fresnel below),
  // so the lighting model only contributes the sun's glint.
  // how far the ripples push the reflection around: gentle on the pool and spa, choppier on the canal
  // the canal's swell smears the reflection along the view (vertical streaks, as Cycles and real water show), much
  // less across it (Round 11; ?streak0=1 for the old even wobble)
  const wobble = kind === 'canal' && !STREAK0 ? g.mul(vec2(CANAL_WOBBLE * 0.3, CANAL_WOBBLE * STREAK)) : g.mul({ pool: 0.05, spa: 0.12, canal: P.glint === 0 ? CANAL_WOBBLE : 0.25 }[kind]);
  // Round 11: on the canal the light in the reflection is also drawn out into vertical streaks (lit windows and
  // wall lights at night), so it's sampled at five heights along the view and averaged (?streak0=1 for one tap)
  const reflection = !mirror ? null : kind === 'canal' && !STREAK0
    ? [-2, -1, 0, 1, 2].map(k => mirror.sample(wobble.add(vec2(0, k * STREAK_LEN)))).reduce((a: any, b: any) => a.add(b)).div(5)
    : mirror.sample(wobble);
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
    // the light's way down to the floor is in the floor's own lighting (causticsAlbedo) from Round 9
    const path = CYCLES && kind !== 'canal' ? thickness : thickness.mul(float(1).add(abs(V.y)));
    const T = exp(absorb.mul(path).negate());
    const behind = viewportSharedTexture(uvR).rgb;
    // in-scattered light from the sun and sky, plus whatever the pool light puts in at night
    const ambient = atm.sunIntensityU.mul(max(atm.sunDirU.y, 0)).mul(0.11).add(atm.skyGain.mul(0.16)).add(atm.nightU.mul(kind === 'canal' ? 0.004 : CYCLES ? 0 : 0.03));   // Round 9: no night glow in the water itself
    const body = scatter.mul(ambient).mul(float(1).sub(T));
    const NdV = max(dot(nWorld, V), 0);
    const F = float(0.02).add(float(0.98).mul(pow(float(1).sub(NdV), 5)));
    let seen = behind.mul(T).add(body);
    // Round 11: the canal is murky (silt), so the near water shows a lit grey-green body, not the dark bed
    if (kind === 'canal' && MURK > 0) seen = mix(seen, vec3(...MURK_COL).mul(ambient), float(MURK));
    if (P.veil) {
      // the water body itself: a deep Mondo blue lit by the sun and sky, which hides part of the shell, more so
      // where the water is deep (as Cycles shows it: you mostly see the surface and its colour, not the floor)
      const deep = float(1).sub(exp(thickness.mul(-0.9)));
      seen = mix(seen, vec3(...P.body!).mul(ambient), deep.mul(P.veil));
    }
    let through = seen.mul(float(1).sub(F));
    if (T0) {
      // foam hides the water below; at dusk and night the spa light glows through the clear water (Round 25: in the
      // lighting scheme's spa colour, and not at all when the scheme has no spa light)
      through = through.mul(float(1).sub(T0.foam.mul(0.9))).add(tubGlow.mul(atm.nightU).mul(TUB_GLOW).mul(float(1).sub(T0.foam.mul(0.6))));
    }
    // the canal mirror's sky is a touch dimmer than the real one, as Cycles shows it (the far bank stays the brightest)
    // Round 11: murky canal water tints what it reflects (Cycles' canal_water absorbs into #17463F), rather than
    // just dimming it: the far bank's trees come back dark and the sky mid-blue, not near-white
    const canalR = reflection && CANAL_TINT ? mix(reflection, vec3(dot(reflection, vec3(0.2126, 0.7152, 0.0722))), 0.35).mul(vec3(...CANAL_TINT)) : reflection;
    const r = reflection && kind === 'canal' ? (CANAL_TINT ? canalR : reflection.mul(CANAL_REFLECT)) : reflection;
    const above = r ? through.add(r.mul(F).mul(mirror!.on)) : through;
    if (kind === 'canal') return above;
    // Round 15: from under the water you see the surface from below: a bright, rippling teal window (Snell's window
    // of the sky in the middle, the pool's own walls reflected at the edges, folded into one tone here)
    const below = vec3(0.12, 0.36, 0.4).mul(ambient.mul(5).add(0.004)).mul(float(0.75).add(abs(g.x).add(abs(g.y)).mul(40).min(0.5)));
    return select(frontFacing, above, below);
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
  // floors and steps only: projected straight down, the net smeared into vertical streaks on the walls
  // floors and steps only (projected straight down, the net smeared into streaks on the walls). The facing is
  // taken in the vertex stage: normalWorld in a colour node broke the sun's shadow pass for every caustic material.
  const up = vertexStage(transformDirection(normalLocal, modelWorldMatrix).y);
  const strength = smoothstep(0.1, 0.6, sunDir.y).mul(inside).mul(smoothstep(0.5, 0.85, up));
  // Round 7: a sharper, brighter net like Cycles' (the old soft blotches with ?water0=1)
  let sharp = new URLSearchParams(location.search).has('water0') ? float(0.84).add(cst.mul(0.95)) : float(0.62).add(pow(cst, 1.6).mul(2.4));
  if (NET) {
    // Round 9: Cycles' net (mats.py pool_water): Voronoi distance-to-edge at scale 4.2, warped by a noise at 1.4,
    // as the sun's colour through the surface: 1.0 on the lines easing to 0.75 in the cells. Ours drifts slowly.
    const q = vec3(wp.x, wp.z, time.mul(0.08));
    const warp = mx_noise_vec3(q.mul(1.4)).mul(0.6 * 0.5);
    const f = mx_worley_noise_vec2(vec3(wp.x, wp.z, time.mul(0.05)).add(warp).mul(4.2));
    const edge = f.y.sub(f.x).mul(0.5);
    sharp = mix(float(NET_HI), float(NET_LO), smoothstep(0.0, 0.11, edge));
  }
  const gain = select(inside.greaterThan(0), mix(float(1), sharp, strength), float(1));
  if (NO_UNDERWATER) return base.mul(gain);
  // Round 9: light under water. Sun and sky only get in through the surface, bent to within ~49° of straight
  // down, so walls catch them at a grazing angle (dark navy in Cycles) while the floor gets nearly all of it;
  // and on the way down it's absorbed like the view ray is (Cycles' pool_water: density 0.32, #6FCFD6).
  const depth = clamp(level.sub(wp.y), 0, 3);
  const down = exp(vec3(...UW_ABSORB).mul(depth).negate());
  const facing = mix(float(UW_WALL), float(1), smoothstep(0.2, 0.9, up));
  const around = underwaterMask(box);
  const uw = mix(vec3(1), down.mul(facing), around);
  return base.mul(gain).mul(uw);
}

/** 1 for a surface under this pool's water (walls included: they stand on the water's box, so it reaches 15 cm past it). */
export function underwaterMask(box: { minX: number; maxX: number; minZ: number; maxZ: number; level: number }) {
  const wp = positionWorld, m = 0.15;
  return smoothstep(box.minX - m, box.minX - m + 0.03, wp.x).mul(smoothstep(box.maxX + m, box.maxX + m - 0.03, wp.x))
    .mul(smoothstep(box.minZ - m, box.minZ - m + 0.03, wp.z)).mul(smoothstep(box.maxZ + m, box.maxZ + m - 0.03, wp.z))
    .mul(smoothstep(box.level, box.level - 0.03, wp.y));
}

/**
 * Under water a surface has next to no specular (gelcoat against water is index 1.5 against 1.33, F0 ~0.004
 * instead of 0.04), so the shell stops mirroring the bright sky: that sheen was what kept the walls pale.
 */
export function quietUnderwater(n: MeshStandardNodeMaterial, mask: any) {
  if (NO_UNDERWATER) return;
  (n as any).setupSpecular = () => {
    const k = float(1).sub(mask.mul(0.9));
    specularColor.assign(vec3(0.04).mul(k));
    specularColorBlended.assign(mix(vec3(0.04), diffuseColor.rgb, metalness).mul(k));
    specularF90.assign(k);
  };
}

export const WATER_TINT = new Color(0x2c7e8b);
