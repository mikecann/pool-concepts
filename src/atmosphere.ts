// Sun, sky, environment light and exposure for a given date and time at the site.
//
// Units follow the Blender scene so the two can be compared: the sun's intensity is Blender's sun strength
// (W/m², 6.5 at full sun), point and spot lights are watts / 4π. The sky is three's Preetham SkyMesh; its
// extinction maths also gives the sun its colour and strength, so a low sun goes orange and weak on its own.
import {
  CircleGeometry, Color, DirectionalLight, Mesh, MeshBasicNodeMaterial, PMREMGenerator, Scene, Vector3, type RenderTarget, type WebGPURenderer,
} from 'three/webgpu';
import { cameraPosition, float, Fn, fract, max, mix, normalize, positionWorld, pow, smoothstep, sin, dot, uniform, vec3, vec4, floor } from 'three/tsl';
import { SkyMesh } from 'three/addons/objects/SkyMesh.js';
import { sunDirection, sunPosition } from './sun';

const LIGHT_SWAP_ATM = new URLSearchParams(location.search).has('lightswap');
const TOTAL_RAYLEIGH = [5.804542996261093e-6, 1.3562911419845635e-5, 3.0265902468824876e-5];
const MIE_CONST = [1.8399918514433978e14, 2.7798023919660528e14, 4.0790479543861094e14];
// a little hazier than a textbook clear sky: coastal air pales the blue towards the horizon, as in the renders
const SKY = { turbidity: 6, rayleigh: 1.15, mieCoefficient: 0.005, mieDirectionalG: 0.8 };

/** Transmittance of the atmosphere along the path to the sun (Preetham, same constants as SkyMesh). */
function extinction(elDeg: number) {
  const zen = Math.acos(Math.max(0, Math.sin((elDeg * Math.PI) / 180)));
  const inv = 1 / (Math.cos(zen) + 0.15 * Math.pow(93.885 - (zen * 180) / Math.PI, -1.253));
  const c = 0.2 * SKY.turbidity * 10e-18;
  return [0, 1, 2].map(i => {
    const bR = TOTAL_RAYLEIGH[i] * SKY.rayleigh, bM = 0.434 * c * MIE_CONST[i] * SKY.mieCoefficient;
    return Math.exp(-(bR * 8.4e3 * inv + bM * 1.25e3 * inv));
  });
}
const ZENITH = extinction(90);
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export type SunState = { az: number; el: number; dir: Vector3; day: number; night: number; dusk: number };

/** How tightly the haze hugs the horizon: 6 keeps the sky blue above ~20° (Cycles), 2.5 was the old overcast look. */
/** Round 9 day sky: how far toward a pale blue (0 = Round 8's sky) and how much brighter. ?skypale= / ?skylift= */
const SKY_PALE = Number(new URLSearchParams(location.search).get('skypale') ?? 0);
const SKY_LIFT = Number(new URLSearchParams(location.search).get('skylift') ?? 1.3);
const HAZE_POW = Number(new URLSearchParams(location.search).get('hazepow') ?? 6);

export class Atmosphere {
  readonly sky = new SkyMesh();
  readonly sun = new DirectionalLight(0xffffff, 6.5);
  /**
   * A shadowless twin of the sun for materials with their own lights node (the far trees). Giving them the real
   * sun made three create a second shadow node for it, which took the shared needsUpdate flag first, so the
   * scene's own sun shadow map was never drawn. This copy is never added to the scene; set() keeps it in step.
   */
  readonly farSun = new DirectionalLight(0xffffff, 6.5);
  readonly state: SunState = { az: 0, el: 0, dir: new Vector3(0, 1, 0), day: 1, night: 0, dusk: 0 };
  /** 0 by day, 1 when it's properly dark: drives the lighting scheme, window glow and exposure. */
  readonly nightU = uniform(0);
  /** How much the horizon band hazes over: strong by day, faint at dusk so the sunset colours survive. */
  readonly hazeU = uniform(0.8);
  /** Strength of the twilight glow: 0 by day and at full night, peaking a few degrees after sunset. */
  readonly twilightU = uniform(0);
  /** Stars only once it's properly dark (nautical twilight). */
  readonly starsU = uniform(0);
  readonly sunColorU = uniform(new Color(1, 1, 1));
  readonly sunDirU = uniform(new Vector3(0, 1, 0));
  readonly sunIntensityU = uniform(6.5);
  /** Overall sky radiance relative to the sun, tuned against the Cycles renders. */
  readonly skyGain = uniform(0.08);
  readonly fogColor = new Color();
  exposure = 1;
  /** Sky brightness at full day, relative to the Preetham model's own scale. */
  skyBase = 0.08;
  private envScene = new Scene();
  private envSky = new SkyMesh();
  private groundColor = uniform(new Color(0.1, 0.1, 0.1));
  private pmrem: PMREMGenerator;
  private envRT: RenderTarget | null = null;
  private lastEnv = { dir: new Vector3(0, -1, 0), at: -1e9 };

  constructor(private renderer: WebGPURenderer, private scene: Scene) {
    for (const s of [this.sky, this.envSky]) {
      s.scale.setScalar(4000);
      s.turbidity.value = SKY.turbidity; s.rayleigh.value = SKY.rayleigh;
      s.mieCoefficient.value = SKY.mieCoefficient; s.mieDirectionalG.value = SKY.mieDirectionalG;
      s.cloudCoverage.value = 0.18; s.cloudDensity.value = 0.35; s.cloudScale.value = 0.00018; s.cloudElevation.value = 0.55;
      const base = s.material.colorNode as any;
      // horizon haze: towards the horizon the sky desaturates and lightens (coastal air), as in the Cycles stills;
      // the env map sky gets the same, so the IBL lighting desaturates with it
      const sky = base.rgb.mul(this.skyGain).toVar();
      const dirY = normalize(positionWorld.sub(cameraPosition)).y;
      const band = pow(float(1).sub(max(dirY, 0)), HAZE_POW).mul(this.hazeU);
      const lum = dot(sky, vec3(0.2126, 0.7152, 0.0722));
      const hazed = mix(sky, vec3(lum).mul(vec3(1.06, 1.09, 1.14)).mul(1.4), band);
      // Round 9: Cycles' day sky is a pale, milky blue right up to the zenith (ours was a deep Preetham blue,
      // which also tinted the pool's reflection and every shadow). Scaled with the haze so dusk keeps its colour.
      const lum2 = dot(hazed, vec3(0.2126, 0.7152, 0.0722));
      const pale = mix(hazed, vec3(lum2).mul(vec3(0.74, 0.9, 1.22)).mul(SKY_LIFT), this.hazeU.mul(SKY_PALE / 0.95));
      s.material.colorNode = vec4(pale.add(this.nightSky(s === this.sky)), 1);
      s.frustumCulled = false;
    }
    this.envSky.showSunDisc.value = 0;   // the directional light is the sun; a disc in the env map would light everything twice
    this.envSky.cloudCoverage.value = 0;
    // the ground under the env map: grass, paving and water seen from the yard, lit by the sun and the sky
    const groundMat = new MeshBasicNodeMaterial();
    groundMat.colorNode = this.groundColor;
    groundMat.fog = false;
    const ground = new Mesh(new CircleGeometry(1500, 48), groundMat);
    ground.rotation.x = -Math.PI / 2; ground.position.y = -3;
    this.envScene.add(this.envSky, ground);
    this.scene.add(this.sky);

    const s = this.sun;
    s.castShadow = true;
    s.shadow.bias = -0.00025;
    s.shadow.normalBias = 0.025;
    s.shadow.camera.near = 1; s.shadow.camera.far = 400;
    scene.add(s, s.target);
    this.pmrem = new PMREMGenerator(renderer);
  }

  private nightSky(withStars: boolean) {
    const night = this.nightU;
    return Fn(() => {
      const d = normalize(positionWorld.sub(cameraPosition));
      const up = max(d.y, 0);
      // deep blue overhead, a little lighter at the horizon (light pollution from Busselton to the east)
      const grad = mix(vec3(0.0022, 0.0032, 0.0065), vec3(0.0006, 0.0009, 0.0021), pow(up, 0.5));
      let c = grad.mul(night);
      // civil twilight (sun 0 to -8 deg): the Preetham sky has already gone dark, but the real one is a deep
      // blue overhead with a warm band low in the west where the sun went down
      const toSun = max(dot(normalize(vec3(d.x, 0, d.z)), normalize(vec3(this.sunDirU.x, 0, this.sunDirU.z))), 0);
      const low = pow(float(1).sub(up), 3);
      const zenith = vec3(0.0055, 0.009, 0.022), warm = vec3(0.05, 0.022, 0.008), band = vec3(0.012, 0.012, 0.016);
      const tw = mix(zenith, band, low).add(warm.mul(low).mul(pow(toSun, 2.5)));
      c = c.add(tw.mul(this.twilightU));
      if (withStars) {
        const cell = floor(d.mul(420));
        const h = fract(sin(dot(cell, vec3(12.9898, 78.233, 45.164))).mul(43758.5453));
        const star = smoothstep(0.9975, 1, h).mul(smoothstep(0.02, 0.25, up)).mul(0.25);
        c = c.add(vec3(star).mul(this.starsU));
      }
      return c;
    })();
  }

  /** Set the date and minute of the day (AWST). Updates sun, sky, colours and exposure; refreshes the env map when needed. */
  set(date: string, minutes: number, force = false) {
    const { az, el } = sunPosition(date, minutes);
    const st = this.state;
    st.az = az; st.el = el;
    st.dir.set(...sunDirection(az, el));
    st.day = smooth(-4, 6, el);
    st.night = 1 - smooth(-3.5, 0.5, el);      // the lighting scheme comes on at sunset, full by 20 minutes after
    st.dusk = smooth(-6, 2, el) * (1 - smooth(4, 14, el));

    // sky: the sun position drives the scattering; below the horizon keep it at -2.5 deg so twilight still glows
    const skyEl = Math.max(el, -1.2);   // Preetham goes black past ~-2 deg; hold it there and fade the gain instead
    const sd = new Vector3(...sunDirection(az, skyEl));
    this.sky.sunPosition.value.copy(sd);
    this.envSky.sunPosition.value.copy(sd);
    // fade the whole sky towards night as the sun sinks past -2.5
    const twilight = Math.pow(smooth(-12, 1, el), 1.6);
    this.skyGain.value = this.skyBase * Math.max(0.012, twilight);

    // the sun: Preetham extinction for colour and strength, normalised so the noon sun is white at 6.5
    const ext = extinction(Math.max(el, 0.5));
    const lum = (v: number[]) => 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
    const col = ext.map((v, i) => v / ZENITH[i]);
    const m = Math.max(...col);
    this.sunColorU.value.setRGB(col[0] / m, col[1] / m, col[2] / m);
    const strength = 6.5 * (lum(ext) / lum(ZENITH)) * smooth(-0.8, 2.5, el);
    this.sun.color.copy(this.sunColorU.value);
    this.farSun.color.copy(this.sunColorU.value);
    this.farSun.intensity = strength;
    this.farSun.position.copy(st.dir).multiplyScalar(100);
    this.farSun.updateMatrixWorld(); this.farSun.target.updateMatrixWorld();
    this.sun.intensity = strength;
    // the sun stays in the scene at night with zero intensity: hiding it changes every shader's light set
    this.sun.visible = LIGHT_SWAP_ATM ? strength > 0.001 : true;   // never toggles
    this.sunIntensityU.value = strength;
    this.sunDirU.value.copy(st.dir);
    this.nightU.value = st.night;
    this.twilightU.value = new URLSearchParams(location.search).has('dusk0') ? 0 : smooth(1.5, -2.5, el) * (1 - smooth(-6, -11, el));
    this.hazeU.value = new URLSearchParams(location.search).has('haze0') ? 0 : 0.95 * smooth(2, 15, el);
    this.starsU.value = smooth(-5, -13, el);

    // haze colour for distant fog and the env ground
    const dayFog = new Color(0.62, 0.7, 0.8).multiplyScalar(0.62 * (this.skyGain.value / this.skyBase));
    const duskTint = new Color(0.95, 0.62, 0.45).multiplyScalar(0.55 * (this.skyGain.value / this.skyBase));
    this.fogColor.copy(dayFog).lerp(duskTint, st.dusk * 0.6).lerp(new Color(0.008, 0.011, 0.02), st.night);
    const sunOnGround = strength * Math.max(0, st.dir.y) / Math.PI;
    const skyOnGround = 0.55 * (this.skyGain.value / this.skyBase);
    this.groundColor.value.setRGB(0.2, 0.19, 0.15).multiplyScalar(sunOnGround + skyOnGround)
      .add(new Color(0.003, 0.004, 0.007).multiplyScalar(st.night));

    // exposure (EV), like the renders: 0 by day, +0.6 at dusk, +1.0 at night, plus our calibration
    const ev = lerp(0, 0.7, smooth(10, -1, el)) + lerp(0, 1.5, smooth(-1, -10, el));
    this.exposure = Math.pow(2, ev - 0.15);

    this.updateEnv(force);
  }

  /** Re-render the sky into the PMREM env map, throttled: only when the sun has moved enough, at most every 120 ms. */
  updateEnv(force = false) {
    const now = performance.now();
    const moved = this.lastEnv.dir.angleTo(this.state.dir);
    if (!force && (moved < 0.004 || now - this.lastEnv.at < 120)) return;
    this.lastEnv.dir.copy(this.state.dir); this.lastEnv.at = now;
    this.envRT = this.pmrem.fromScene(this.envScene, 0, 0.1, 5000, { size: 256, renderTarget: this.envRT } as any);
    this.scene.environment = this.envRT.texture;
  }

  /** Keep the sun's shadow box centred on the viewer, snapped to whole shadow texels so edges don't crawl. */
  placeShadow(focus: Vector3, halfSize: number, mapSize: number) {
    const s = this.sun, cam = s.shadow.camera;
    // The map size is fixed once the shadow map exists: resizing a live map destroys its depth texture while three
    // still has bind groups pointing at it (shadows vanished and every frame logged errors after a quality change,
    // and swapping in a new light didn't fully clear it either). A new size applies on the next load.
    if (!s.shadow.map) s.shadow.mapSize.set(mapSize, mapSize);
    if (cam.right !== halfSize) {
      cam.left = -halfSize; cam.right = halfSize; cam.top = halfSize; cam.bottom = -halfSize;
      cam.updateProjectionMatrix();
    }
    const texel = (2 * halfSize) / s.shadow.mapSize.x;
    // snap in light space
    const dir = this.state.dir.clone().normalize();
    const up = Math.abs(dir.y) > 0.99 ? new Vector3(0, 0, 1) : new Vector3(0, 1, 0);
    const right = new Vector3().crossVectors(up, dir).normalize();
    const up2 = new Vector3().crossVectors(dir, right);
    const x = Math.round(focus.dot(right) / texel) * texel, y = Math.round(focus.dot(up2) / texel) * texel, z = focus.dot(dir);
    const center = right.multiplyScalar(x).add(up2.multiplyScalar(y)).add(dir.clone().multiplyScalar(z));
    s.target.position.copy(center);
    s.position.copy(center).addScaledVector(dir, 200);
    s.target.updateMatrixWorld(); s.updateMatrixWorld();
  }
}
