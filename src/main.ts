import { AgXToneMapping, PCFShadowMap, PerspectiveCamera, Scene, Vector2, Vector3, WebGPURenderer } from 'three/webgpu';
import { fog, rangeFogFactor, uniform } from 'three/tsl';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Atmosphere } from './atmosphere';
import { Model, type CameraDef, type Scenario } from './model';
import { Post, QUALITY, type Quality } from './post';
import { Walker } from './walk';
import { buildGallery, VIEW_NAMES, type Fly } from './gallery';
import { compass, sunTimes } from './sun';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const app = $('app'), world = $('world'), canvas = $<HTMLCanvasElement>('canvas');
const isTouch = matchMedia('(pointer: coarse)').matches;
if (isTouch) document.documentElement.classList.add('touch');
const params = new URLSearchParams(location.search);
const store = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };

// ---------- state ----------
const S = {
  date: params.get('date') ?? '2027-01-16',
  minutes: params.has('t') ? Number(params.get('t')) : 13 * 60,
  playing: false,
  scenario: 'proposed' as Scenario,
  quality: 'High' as Quality,
};

const loadText = $('load-text'), loadFill = $('load-fill');
const progress = (f: number, text?: string) => { loadFill.style.width = `${Math.round(f * 100)}%`; if (text) loadText.textContent = text; };
$('loading').style.backgroundImage = 'url(img/15_lounge_from_alfresco__proposed.jpg)';

function autoQuality(webgpu: boolean): Quality {
  const saved = store.get('pool-quality') as Quality | null;
  if (params.get('q') && params.get('q')! in QUALITY) return params.get('q') as Quality;
  if (saved && saved in QUALITY) return saved;
  if (isTouch) return 'Low';
  if (!webgpu) return 'Medium';
  return 'High';
}

async function main() {
  const webgpu = !!(navigator as any).gpu && !!(await (navigator as any).gpu.requestAdapter().catch(() => null));
  S.quality = autoQuality(webgpu);
  const renderer = new WebGPURenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  await renderer.init();
  renderer.toneMapping = AgXToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  const scene = new Scene();
  const camera = new PerspectiveCamera(isTouch ? 70 : 62, 1, 0.08, 9000);
  const atm = new Atmosphere(renderer, scene);
  // distant haze: the far bank 70 to 200 m away softens a little, like the photos
  const fogColor = uniform(atm.fogColor);
  scene.fogNode = fog(fogColor, rangeFogFactor(35, 1400));

  const model = new Model(renderer, atm);
  scene.add(model.root);
  progress(0.02, 'Loading the model…');
  const base = 'web/';
  const cams: CameraDef[] = await fetch(base + 'cameras.json').then(r => r.json()).catch(() => []);
  await model.load(base, f => progress(0.02 + f * 0.83, `Loading the model… ${Math.round(f * 100)}%`), QUALITY[S.quality].reflections && params.get('refl') !== '0', QUALITY[S.quality].reflectionScale);
  progress(0.88, 'Setting the sun…');

  const walker = new Walker(camera, canvas);
  const orbit = new OrbitControls(camera, canvas);
  orbit.enabled = false;
  orbit.enableDamping = true;
  orbit.maxPolarAngle = Math.PI * 0.49;
  orbit.minDistance = 2; orbit.maxDistance = 220;

  let post: Post;
  let grassBuilt = -1;
  const setQuality = (q: Quality, rebuild = true) => {
    S.quality = q;
    const cfg = QUALITY[q];
    renderer.setPixelRatio(Math.min(devicePixelRatio, cfg.pixelRatio));
    resize();
    model.showFar = cfg.far;
    if (grassBuilt !== cfg.grass) { model.grass.matchTexture(model.lawns[0]?.material); model.grass.build(model.lawns, cfg.grass); grassBuilt = cfg.grass; }
    model.grass.radius.value = cfg.grassRadius;
    model.apply();
    if (rebuild) { post?.dispose(); post = new Post(renderer, scene, camera, params.get('post') === '0' ? 'Low' : q); }
    document.querySelectorAll('#opt-quality button').forEach(b => b.setAttribute('aria-pressed', String((b as HTMLElement).dataset.q === q)));
    shadowDirty = true;
  };

  function resize() {
    const r = world.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;   // hidden or collapsed: keep the last size (a 0x0 canvas breaks WebGPU)
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / Math.max(1, r.height);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(world);

  // ---------- time ----------
  const timeInput = $<HTMLInputElement>('time'), clock = $('clock'), sunread = $('sunread');
  const fmt = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;
  let shadowDirty = true, shadowFrames = 0, frameNo = 0, lastSunDir = new Vector3();
  const drawTicks = () => {
    const t = sunTimes(S.date), ticks = $('ticks');
    ticks.innerHTML = [0, 3, 6, 9, 12, 15, 18, 21, 24].map(h => `<span style="left:${(h / 24) * 100}%">${String(h).padStart(2, '0')}</span>`).join('')
      + `<div class="band" style="left:${(t.rise / 1440) * 100}%;width:${((t.set - t.rise) / 1440) * 100}%"></div>`;
  };
  const setTime = (minutes: number, force = false) => {
    S.minutes = ((minutes % 1440) + 1440) % 1440;
    timeInput.value = String(Math.round(S.minutes));
    clock.textContent = fmt(S.minutes);
    atm.set(S.date, S.minutes, force);
    const { az, el } = atm.state;
    sunread.textContent = el > -0.8 ? `sun ${Math.round(az)}° ${compass(az)}, ${Math.round(el)}° up` : el > -6 ? 'after sunset' : el > -12 ? 'twilight' : 'night';
    fogColor.value.copy(atm.fogColor);
    renderer.toneMappingExposure = atm.exposure;
    post?.setNight(atm.state.night);
    if (lastSunDir.angleTo(atm.state.dir) > 0.0015) { shadowDirty = true; lastSunDir.copy(atm.state.dir); }
  };
  const setDate = (d: string) => {
    S.date = d;
    $<HTMLInputElement>('date').value = d;
    document.querySelectorAll('[data-date]').forEach(b => b.setAttribute('aria-pressed', String((b as HTMLElement).dataset.date === d)));
    drawTicks();
    setTime(S.minutes, true);
  };
  timeInput.addEventListener('input', () => setTime(Number(timeInput.value)));
  document.querySelectorAll<HTMLElement>('[data-date]').forEach(b => (b.onclick = () => setDate(b.dataset.date!)));
  $<HTMLInputElement>('date').addEventListener('change', e => { const v = (e.target as HTMLInputElement).value; if (v) setDate(v); });
  const play = $('play');
  play.onclick = () => { S.playing = !S.playing; play.setAttribute('aria-pressed', String(S.playing)); play.setAttribute('aria-label', S.playing ? 'Pause' : 'Play the day'); };

  // ---------- scenario, options ----------
  const setScenario = (s: Scenario) => {
    S.scenario = s; model.scenario = s; model.apply(); walker.rebuild(model.root); shadowDirty = true;
    $('sc-existing').setAttribute('aria-pressed', String(s === 'existing'));
    $('sc-proposed').setAttribute('aria-pressed', String(s === 'proposed'));
  };
  $('sc-existing').onclick = () => setScenario('existing');
  $('sc-proposed').onclick = () => setScenario('proposed');
  const chipRow = (box: HTMLElement, items: [string, string][], get: () => string, set: (v: string) => void) => {
    const render = () => {
      box.innerHTML = '';
      for (const [v, label] of items) {
        const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
        b.setAttribute('aria-pressed', String(get() === v));
        b.onclick = () => { set(v); render(); };
        box.appendChild(b);
      }
    };
    render();
    return render;
  };
  const optChanged = () => { model.apply(); walker.rebuild(model.root); shadowDirty = true; };
  const renderRoller = chipRow($('opt-roller'), [['none', 'None'], ['roller_shallow', 'Shallow end'], ['roller_deep', 'Deep end'], ['roller_pit', 'In-ground box']],
    () => model.roller, v => { model.roller = v; optChanged(); });
  const renderKitchen = chipRow($('opt-kitchen'), [['kitchen_split', 'Split by the gate'], ['kitchen_continuous', 'One long bench'], ['kitchen_freestanding', 'Freestanding']],
    () => model.kitchen, v => { model.kitchen = v; optChanged(); });
  $<HTMLInputElement>('opt-people').onchange = e => { model.people = (e.target as HTMLInputElement).checked; optChanged(); };
  chipRow($('opt-quality'), (['Low', 'Medium', 'High', 'Ultra'] as Quality[]).map(q => [q, q] as [string, string]), () => S.quality,
    v => { store.set('pool-quality', v); setQuality(v as Quality); });
  const fpsEl = $('fps');
  $<HTMLInputElement>('opt-fps').onchange = e => { fpsEl.hidden = !(e.target as HTMLInputElement).checked; };

  // ---------- camera modes ----------
  const DEFAULT_FOV = camera.fov;
  let targetFov = DEFAULT_FOV;
  const setMode = (m: 'walk' | 'drone') => {
    walker.mode = m;
    world.classList.toggle('drone', m === 'drone');
    $('mode-walk').setAttribute('aria-pressed', String(m === 'walk'));
    $('mode-drone').setAttribute('aria-pressed', String(m === 'drone'));
    orbit.enabled = m === 'drone';
    if (m === 'drone') {
      if (document.pointerLockElement) document.exitPointerLock();
      const fwd = new Vector3(); camera.getWorldDirection(fwd);
      if (camera.position.y < 8) {
        // lift off from where you're standing
        const tgt = camera.position.clone().addScaledVector(fwd, 10); tgt.y = 2.4;
        camera.position.add(new Vector3(-fwd.x * 14, 14, -fwd.z * 14));
        orbit.target.copy(tgt);
      } else orbit.target.copy(camera.position.clone().addScaledVector(fwd, 25));
      orbit.update();
    } else {
      const p = orbit.target;
      const fwd = new Vector3(); camera.getWorldDirection(fwd);
      walker.place(p.x, 3, p.z, Math.atan2(-fwd.x, -fwd.z), 0);
    }
    shadowDirty = true;
  };
  $('mode-walk').onclick = () => setMode('walk');
  $('mode-drone').onclick = () => setMode('drone');

  const goto = $<HTMLSelectElement>('goto');
  for (const c of cams) {
    const o = document.createElement('option'); o.value = c.name;
    o.textContent = `${c.name.slice(0, 2)} · ${VIEW_NAMES[c.name] ?? c.name}`;
    goto.appendChild(o);
  }
  const fovFor = (lens: number) => {
    const hfov = 2 * Math.atan(18 / lens);
    const v = 2 * Math.atan(Math.tan(hfov / 2) / Math.max(camera.aspect, 1)) * 180 / Math.PI;
    return Math.min(80, Math.max(35, v));
  };
  const goToCam = (name: string, matchLens = true) => {
    const c = cams.find(x => x.name === name);
    if (!c) return;
    const p = new Vector3(...(c.pos as [number, number, number])), t = new Vector3(...(c.target as [number, number, number]));
    const d = t.clone().sub(p);
    const ground = model.bounds.min.y;
    const aerial = p.y > 8 || /aerial|overview/.test(name);
    if (matchLens) targetFov = fovFor(c.lens);
    if (aerial) {
      if (walker.mode !== 'drone') setMode('drone');
      camera.position.copy(p); orbit.target.copy(t); orbit.update();
    } else {
      if (walker.mode !== 'walk') setMode('walk');
      // stand where the render camera is (its height says if it's seated or standing)
      walker.glideTo(new Vector3(p.x, p.y - 1.2, p.z), Math.atan2(-d.x, -d.z), Math.atan2(d.y, Math.hypot(d.x, d.z)));
    }
    void ground;
    shadowDirty = true;
  };
  goto.onchange = () => { if (goto.value) goToCam(goto.value); goto.value = ''; canvas.focus(); };

  // ---------- panel / drawer ----------
  const mobile = matchMedia('(max-width: 820px)');
  const panelToggle = $('panel-toggle');
  const setPanel = (open: boolean) => {
    if (mobile.matches) app.classList.toggle('drawer-open', open);
    else app.classList.toggle('panel-closed', !open);
    panelToggle.setAttribute('aria-expanded', String(open));
    store.set('pool-panel', open ? '1' : '0');
  };
  panelToggle.onclick = () => setPanel(mobile.matches ? !app.classList.contains('drawer-open') : app.classList.contains('panel-closed'));
  setPanel(!mobile.matches && store.get('pool-panel') !== '0' && params.get('panel') !== '0');
  if (mobile.matches) app.classList.remove('panel-closed');
  // drag the drawer's grab bar
  let dragY: number | null = null;
  $('grab').addEventListener('pointerdown', e => { dragY = e.clientY; (e.target as HTMLElement).setPointerCapture(e.pointerId); });
  $('grab').addEventListener('pointerup', e => { if (dragY !== null) { setPanel(e.clientY - dragY < 0 || Math.abs(e.clientY - dragY) < 6 ? !app.classList.contains('drawer-open') || e.clientY - dragY < 0 : false); } dragY = null; });

  buildGallery($('gallery'), (f: Fly) => {
    if (f.scenario) setScenario(f.scenario);
    if (f.roller) { model.roller = f.roller; renderRoller(); }
    if (f.kitchen) { model.kitchen = f.kitchen; renderKitchen(); }
    if (f.roller || f.kitchen) optChanged();
    if (f.date && f.date !== S.date) setDate(f.date);
    if (f.minutes !== undefined) setTime(f.minutes, true);
    if (f.cam) goToCam(f.cam);
    if (mobile.matches) setPanel(false);
  });

  // ---------- pointer lock, touch look, joystick ----------
  const hint = $('hint');
  const showHint = (html: string, ms = 3500) => { hint.innerHTML = html; hint.hidden = false; clearTimeout((showHint as any).t); (showHint as any).t = setTimeout(() => (hint.hidden = true), ms); };
  canvas.addEventListener('click', () => {
    if (walker.mode === 'walk' && !isTouch && document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
  });
  document.addEventListener('pointerlockchange', () => world.classList.toggle('locked', document.pointerLockElement === canvas));
  // drag to look (touch, or mouse without pointer lock)
  let look: { id: number; x: number; y: number } | null = null;
  canvas.addEventListener('pointerdown', e => {
    if (walker.mode !== 'walk' || document.pointerLockElement === canvas) return;
    if (e.pointerType === 'mouse' && !isTouch) return;
    look = { id: e.pointerId, x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointermove', e => {
    if (!look || e.pointerId !== look.id) return;
    walker.look((e.clientX - look.x) * 0.0045, (e.clientY - look.y) * 0.0045);
    look.x = e.clientX; look.y = e.clientY;
  });
  const endLook = (e: PointerEvent) => { if (look && e.pointerId === look.id) look = null; };
  canvas.addEventListener('pointerup', endLook); canvas.addEventListener('pointercancel', endLook);
  const joy = $('joystick'), knob = $('knob');
  let joyId: number | null = null;
  const joyMove = (e: PointerEvent) => {
    const r = joy.getBoundingClientRect();
    let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    knob.style.transform = `translate(${x * 34}px, ${y * 34}px)`;
    walker.setStick(x, -y);
  };
  joy.addEventListener('pointerdown', e => { joyId = e.pointerId; joy.setPointerCapture(e.pointerId); joyMove(e); });
  joy.addEventListener('pointermove', e => { if (e.pointerId === joyId) joyMove(e); });
  const joyEnd = () => { joyId = null; knob.style.transform = ''; walker.setStick(0, 0); };
  joy.addEventListener('pointerup', joyEnd); joy.addEventListener('pointercancel', joyEnd);
  walker.onMove = () => { targetFov = DEFAULT_FOV; };

  // ---------- start ----------
  setQuality(S.quality);
  atm.placeShadow(new Vector3(1.3, 3, 2.6), QUALITY[S.quality].shadowHalf, QUALITY[S.quality].shadowMap);
  setDate(S.date);
  setTime(S.minutes, true);
  walker.rebuild(model.root);
  // on the alfresco, looking past the lounge to the pool and the canal
  walker.place(1.3, 3.0, 2.6, (156 * Math.PI) / 180, -0.08);
  progress(0.94, 'Preparing materials…');
  if (params.get('compile') !== '0') try { await renderer.compileAsync(scene, camera); } catch { /* compiles lazily instead */ }
  progress(1, 'Ready');

  // ---------- first visit: how to walk (shown once, after the first frame, remembered) ----------
  const welcome = $('welcome');
  const closeWelcome = () => { if (welcome.hidden) return; welcome.hidden = true; store.set('pool-walk-help', '1'); };
  $('welcome-ok').onclick = () => { closeWelcome(); canvas.focus(); };
  addEventListener('keydown', e => { if (!welcome.hidden && (e.key === 'Escape' || e.key === 'Enter')) closeWelcome(); });
  canvas.addEventListener('pointerdown', closeWelcome);
  $('joystick').addEventListener('pointerdown', closeWelcome);
  function firstVisitHelp() {
    if (store.get('pool-walk-help') === '1' || params.has('nohelp')) {
      if (!isTouch) showHint('Click to look around<small>W A S D or arrows to walk · Shift to run · Esc to stop</small>', 3500);
      return;
    }
    welcome.hidden = false;
  }

  // ---------- loop ----------
  let last = performance.now(), frames = 0, fpsT = last, firstFrame = true;
  const shadowFocus = new Vector3(), lastFocus = new Vector3(1e9, 0, 0);
  renderer.setAnimationLoop(() => {
    if (world.clientWidth < 1 || world.clientHeight < 1) return;   // nothing to draw into while hidden
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (S.playing) {
      // a day in about two minutes, slowing down through the evening so dusk lasts
      const el = atm.state.el;
      const rate = el > -1 && el < 10 ? 5 : 12;   // game minutes per real second
      setTime(S.minutes + rate * dt);
    }
    walker.update(dt);
    if (walker.mode === 'drone') orbit.update();
    if (Math.abs(camera.fov - targetFov) > 0.05) { camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 4); camera.updateProjectionMatrix(); }
    model.update(atm.state.night, now / 1000);
    model.grass.update(camera, QUALITY[S.quality].grass > 0);
    // sun shadows: re-render only when the sun moves or the viewer leaves the snapped box
    const cfg = QUALITY[S.quality];
    const half = walker.mode === 'drone' ? Math.max(cfg.shadowHalf, 60) : cfg.shadowHalf;
    if (walker.mode === 'drone') shadowFocus.copy(orbit.target); else camera.getWorldPosition(shadowFocus).add(new Vector3(0, 0, 0));
    if (shadowFocus.distanceTo(lastFocus) > half * 0.25) { lastFocus.copy(shadowFocus); shadowDirty = true; }
    // A one-off needsUpdate sometimes left a stale map behind (the mirrors render the scene too), so after a
    // change keep refreshing for a few frames. During the timelapse the sun moves every frame: refresh every
    // third frame instead, which is plenty for a sun that moves a fraction of a degree per frame.
    if (shadowDirty && (!S.playing || frameNo % 3 === 0)) {
      atm.placeShadow(lastFocus, half, cfg.shadowMap);
      shadowFrames = 3;
      shadowDirty = false;
    }
    atm.sun.shadow.autoUpdate = false;
    if (shadowFrames > 0) { atm.sun.shadow.needsUpdate = true; shadowFrames--; }
    frameNo++;
    const db = renderer.getDrawingBufferSize(new Vector2());
    model.renderMirrors(renderer, scene, camera, db.x, db.y);
    post.render();
    if (firstFrame) { firstFrame = false; $('loading').classList.add('done'); requestAnimationFrame(firstVisitHelp); }
    frames++;
    if (now - fpsT > 500) { fpsEl.textContent = `${Math.round((frames * 1000) / (now - fpsT))} fps · ${S.quality} · ${(renderer.backend as any).isWebGPUBackend ? 'WebGPU' : 'WebGL 2'}`; frames = 0; fpsT = now; }
  });

  // hooks for the review script
  (window as any).__viewer = {
    setTime: (m: number) => setTime(m, true), setDate, goToCam: (n: string) => goToCam(n), setScenario, setQuality, setMode,
    place: (x: number, y: number, z: number, yawDeg: number, pitchDeg = 0) => { setMode('walk'); walker.place(x, y, z, (yawDeg * Math.PI) / 180, (pitchDeg * Math.PI) / 180); shadowDirty = true; },
    state: () => ({ ...S, feet: walker.feet.toArray(), yaw: walker.yaw, pitch: walker.pitch, sun: atm.state, exposure: renderer.toneMappingExposure }),
    atm, model, renderer, camera, scene, walker,
    get post() { return post; },
    setPanel,
  };
}

main().catch(err => {
  console.error(err);
  loadText.innerHTML = `<span class="error">The 3D view couldn't start (${String(err?.message ?? err)}). The renders in the panel still work.</span>`;
  try { buildGallery($('gallery'), () => {}); } catch { /* ignore */ }
});
