import * as THREE_NS from 'three/webgpu';
import { AgXToneMapping, BasicShadowMap, PCFShadowMap, VSMShadowMap, PerspectiveCamera, Scene, Vector2, Vector3, WebGPURenderer } from 'three/webgpu';
import { float, fog, rangeFogFactor, uniform } from 'three/tsl';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Atmosphere } from './atmosphere';
import { LIGHT_SWAP, Model, type CameraDef, type Gate, type Scenario } from './model';
import { Post, QUALITY, type Quality } from './post';
import { Walker } from './walk';
import { FAR_LAYER, inMirror } from './mirror';
import { AsyncPipelines, compileFor, pinRenderDepth, renderClean, uploadTextures } from './compile';
import { VIEW_NAMES } from './views';
import { FENCE_CHOICES, KITCHEN_CHOICES, NFENCE_CHOICES, PASSAGE_CHOICES, PIER_CHOICES, ROLLER_CHOICES, type Choice } from './choices';
import { compass, sunTimes } from './sun';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const app = $('app'), world = $('world'), canvas = $<HTMLCanvasElement>('canvas');
const isTouch = matchMedia('(pointer: coarse)').matches;
if (isTouch) document.documentElement.classList.add('touch');
const params = new URLSearchParams(location.search);
const store = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };

// ---------- remembered settings ----------
// One JSON blob in localStorage: quality, fps counter, people, scenario, the design options, the date and (only
// once you've moved it yourself) the time of day. A first visit uses the defaults: Medium, fps counter on.
type Settings = { quality?: Quality; fps?: boolean; people?: boolean; scenario?: Scenario; date?: string; minutes?: number;
  options?: Partial<Record<'roller' | 'kitchen' | 'fence' | 'pier' | 'nfence' | 'passage', string>> };
const SETTINGS_KEY = 'pool-settings';
const settings: Settings = (() => { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') ?? {}; } catch { return {}; } })();
const remember = (patch: Settings) => {
  if (fromUrl) return;
  Object.assign(settings, patch);
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* private mode: just don't remember */ }
};

// URL values are checked, and never written into the remembered settings (a renders-page link is a one-off visit)
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const urlDate = DATE_RE.test(params.get('date') ?? '') && !isNaN(Date.parse(params.get('date')!)) ? params.get('date')! : null;
const urlMinutes = (() => { const t = Number(params.get('t')); return params.has('t') && Number.isFinite(t) && t >= 0 && t < 1440 ? t : null; })();
let fromUrl = false;   // true while applying URL values, so remember() leaves them out

// ---------- state ----------
const S = {
  date: urlDate ?? (DATE_RE.test(settings.date ?? '') ? settings.date! : '2027-01-16'),
  minutes: urlMinutes ?? (Number.isFinite(settings.minutes) ? settings.minutes! : 13 * 60),
  playing: false,
  scenario: 'proposed' as Scenario,
  quality: 'High' as Quality,
};

/** Load-time marks for scripts/profile-load.mjs (ms since navigation start). */
const marks: [string, number][] = ((window as any).__marks = []);
const mark = (name: string) => marks.push([name, Math.round(performance.now())]);

const BASE = '../web/';
const nextFrame = () => new Promise<void>(r => requestAnimationFrame(() => r()));

const loadText = $('load-text'), loadFill = $('load-fill');
const progress = (f: number, text?: string) => { loadFill.style.width = `${Math.round(f * 100)}%`; if (text) loadText.textContent = text; };
$('loading').style.backgroundImage = 'url(../img/15_lounge_from_alfresco__proposed.jpg)';

function startQuality(): Quality {
  const q = params.get('q');
  if (q && q in QUALITY) return q as Quality;
  if (settings.quality && settings.quality in QUALITY) return settings.quality;
  return isTouch ? 'Low' : 'Medium';   // phones get the cheap path; desktops Medium
}

async function main() {
  // the download doesn't need the GPU, so start it straight away and bring WebGPU up alongside
  progress(0.02, 'Loading the model…');
  const modelData = Model.fetch(BASE, f => progress(0.02 + f * 0.6, `Loading the model… ${Math.round(f * 100)}%`));
  // ?gpu=1 turns on GPU timestamp queries for scripts/perf.mjs (they cost a little, so they're off normally)
  const renderer = new WebGPURenderer({ canvas, antialias: false, powerPreference: 'high-performance', trackTimestamp: params.has('gpu') });
  await renderer.init();
  mark('renderer');
  S.quality = startQuality();
  renderer.toneMapping = AgXToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = params.get('smt') === 'basic' ? BasicShadowMap : params.get('smt') === 'vsm' ? VSMShadowMap : PCFShadowMap;
  const scene = new Scene();
  const camera = new PerspectiveCamera(isTouch ? 70 : 62, 1, 0.08, 9000);
  camera.layers.enable(FAR_LAYER);   // the far tree canopies
  const atm = new Atmosphere(renderer, scene);
  const asyncPipes = new AsyncPipelines(renderer);
  const pinned = new Map<any, number>();
  pinRenderDepth(renderer, pinned);
  // distant haze: the far bank 70 to 200 m away softens a little, like the photos
  const fogColor = uniform(atm.fogColor);
  scene.fogNode = fog(fogColor, (params.has('haze0') ? rangeFogFactor(35, 1400) : rangeFogFactor(25, 900)).mul(params.has('mirrorfog') ? 1 : float(1).sub(inMirror)));

  const model = new Model(renderer, atm);
  model.people = settings.people ?? true;
  scene.add(model.root);
  const camsP: Promise<CameraDef[]> = fetch(BASE + 'cameras.json?v=' + __MODEL_V__).then(r => r.json()).catch(() => []);
  const data = await modelData;
  mark('glb');
  progress(0.64, 'Building the scene…');
  await nextFrame();   // let the text paint
  // mirrors are always built (so switching up from Low adds reflections); they're only drawn when the quality wants them
  model.setup(data as any, params.get('refl') !== '0', QUALITY[S.quality].reflectionScale);
  const cams = await camsP;
  for (const m of model.mirrors) pinned.set(m.target, 0);
  mark('model');

  const walker = new Walker(camera, canvas);
  const orbit = new OrbitControls(camera, canvas);
  orbit.enabled = false;
  orbit.enableDamping = true;
  orbit.maxPolarAngle = Math.PI * 0.49;
  orbit.minDistance = 2; orbit.maxDistance = 220;

  let post!: Post;
  let renderQualityChips: (() => void) | null = null;
  let booted = false;   // true once the first frame is up and the full post-processing is on
  let grassBuilt = -1, grassReady = false;
  const setQuality = (q: Quality, rebuild = true) => {
    S.quality = q;
    const cfg = QUALITY[q];
    renderer.setPixelRatio(Math.min(devicePixelRatio, cfg.pixelRatio));
    resize();
    model.showFar = cfg.far;
    for (const m of model.mirrors) m.scale = m.meshes.some(w => w.userData.water === 'canal') ? cfg.reflectionScale * 0.7 : cfg.reflectionScale;
    if (booted && cfg.reflections) prepareMirrors();
    if (grassReady && grassBuilt !== cfg.grass) { model.grass.matchTexture(model.lawns[0]?.material); model.grass.build(model.lawns, cfg.grass); grassBuilt = cfg.grass; }
    model.grass.radius.value = cfg.grassRadius;
    model.apply();
    if (rebuild) {
      post?.dispose();
      post = new Post(renderer, scene, camera, params.get('post') === '0' ? 'Low' : q);
      pinned.set(post.target.target, 1);
      if (booted) post.upgrade();
      post.setNight(atm.state.night);
    }
    renderQualityChips?.();
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
    renderClean(renderer, () => atm.set(S.date, S.minutes, force));   // the sky env map renders too
    const { az, el } = atm.state;
    sunread.textContent = el > -0.8 ? `sun ${Math.round(az)}° ${compass(az)}, ${Math.round(el)}° up` : el > -6 ? 'after sunset' : el > -12 ? 'twilight' : 'night';
    fogColor.value.copy(atm.fogColor);
    renderer.toneMappingExposure = atm.exposure;
    post?.setNight(atm.state.night);
    if (lastSunDir.angleTo(atm.state.dir) > 0.0015) { shadowDirty = true; lastSunDir.copy(atm.state.dir); }
  };
  const setDate = (d: string) => {
    S.date = d;
    remember({ date: d });
    $<HTMLInputElement>('date').value = d;
    document.querySelectorAll('[data-date]').forEach(b => b.setAttribute('aria-pressed', String((b as HTMLElement).dataset.date === d)));
    drawTicks();
    setTime(S.minutes, true);
  };
  timeInput.addEventListener('input', () => { setTime(Number(timeInput.value)); remember({ minutes: S.minutes }); });
  document.querySelectorAll<HTMLElement>('[data-date]').forEach(b => (b.onclick = () => setDate(b.dataset.date!)));
  $<HTMLInputElement>('date').addEventListener('change', e => { const v = (e.target as HTMLInputElement).value; if (v) setDate(v); });
  const play = $('play');
  play.onclick = () => { S.playing = !S.playing; if (!S.playing) remember({ minutes: Math.round(S.minutes) }); play.setAttribute('aria-pressed', String(S.playing)); play.setAttribute('aria-label', S.playing ? 'Pause' : 'Play the day'); };

  // ---------- scenario, options ----------
  const setScenario = (s: Scenario) => {
    S.scenario = s; model.scenario = s; model.apply(); walker.rebuild(model.root); shadowDirty = true;
    remember({ scenario: s });
    $('sc-existing').setAttribute('aria-pressed', String(s === 'existing'));
    $('sc-proposed').setAttribute('aria-pressed', String(s === 'proposed'));
    renderScenarioChips?.();
  };
  let renderScenarioChips: (() => void) | null = null;
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
  const optChanged = () => {
    model.apply(); walker.rebuild(model.root); shadowDirty = true;
    remember({ options: { roller: model.roller, kitchen: model.kitchen, fence: model.fence, pier: model.pier, nfence: model.nfence, passage: model.passage } });
  };
  renderScenarioChips = chipRow($('opt-scenario'), [['existing', 'Today'], ['proposed', 'Proposed']], () => S.scenario, v => setScenario(v as Scenario));

  // design choices as cards: each changes the world and moves you to where the change shows
  const cardGroups: (() => void)[] = [];
  const cards = (box: HTMLElement, items: Choice[], get: () => string, pick: (v: string) => void) => {
    const buttons = items.map(c => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'card';
      b.innerHTML = `<img src="../img/${c.img}" alt="" loading="lazy" width="104" height="65"><b>${c.title}</b><span>${c.note}</span>`;
      const pic = b.querySelector('img')!; pic.addEventListener('error', () => pic.classList.add('missing'));   // render not made yet
      b.onclick = () => { pick(c.value); cardGroups.forEach(r => r()); if (mobile.matches) setPanel(false); };
      box.appendChild(b);
      return b;
    });
    // only the pressed state changes, so the thumbnails never reload
    const render = () => buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(get() === items[i].value)));
    cardGroups.push(render);
    render();
  };
  const ensureProposed = () => { if (S.scenario !== 'proposed') setScenario('proposed'); };
  cards($('cards-roller'), ROLLER_CHOICES, () => model.roller, v => {
    ensureProposed(); model.roller = v; optChanged();
    // look down the pool from the opposite end, as the option renders do
    // the shallow-end roller sits behind camera 05, so look back up the pool from the deep end for that one
    goToCam(v === 'roller_shallow' ? '13_deep_end_to_house' : '05_pool_north_end');
  });
  cards($('cards-kitchen'), KITCHEN_CHOICES, () => model.kitchen, v => {
    ensureProposed(); model.kitchen = v; optChanged(); goToCam('16_outdoor_kitchen');
  });
  cards($('cards-fence'), FENCE_CHOICES, () => model.fence, v => {
    ensureProposed(); model.fence = v as 'perforated' | 'glass'; optChanged(); goToCam('03_lawn_to_terrace');
  });
  cards($('cards-pier'), PIER_CHOICES, () => model.pier, v => {
    ensureProposed(); model.pier = v; optChanged(); goToCam('18_pier_fence');
  });
  cards($('cards-nfence'), NFENCE_CHOICES, () => model.nfence, v => {
    ensureProposed(); model.nfence = v; optChanged(); goToCam('20_pool_north_seating');
  });
  cards($('cards-passage'), PASSAGE_CHOICES, () => model.passage, v => {
    ensureProposed(); model.passage = v; optChanged(); goToCam('19_play_area');
  });
  const renderRoller = () => cardGroups.forEach(r => r()), renderKitchen = renderRoller;
  void renderKitchen;

  const peopleBox = $<HTMLInputElement>('opt-people');
  peopleBox.checked = model.people;
  peopleBox.onchange = () => { model.people = peopleBox.checked; optChanged(); remember({ people: model.people }); };
  renderQualityChips = chipRow($('opt-quality'), (['Low', 'Medium', 'High', 'Ultra'] as Quality[]).map(q => [q, q === 'Ultra' ? 'Ultra (slow)' : q] as [string, string]), () => S.quality,
    v => { remember({ quality: v as Quality }); setQuality(v as Quality); });
  const fpsEl = $('fps');
  const fpsBox = $<HTMLInputElement>('opt-fps');
  fpsBox.checked = settings.fps ?? true;   // on by default
  fpsEl.hidden = !fpsBox.checked;
  fpsBox.onchange = () => { fpsEl.hidden = !fpsBox.checked; remember({ fps: fpsBox.checked }); };

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
  const goToCam = (name: string, matchLens = true, instant = false) => {
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
      const yaw = Math.atan2(-d.x, -d.z), pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
      if (instant) walker.place(p.x, p.y - 1.2, p.z, yaw, pitch); else walker.glideTo(new Vector3(p.x, p.y - 1.2, p.z), yaw, pitch);
    }
    void ground;
    shadowDirty = true;
  };
  goto.onchange = () => { if (goto.value) goToCam(goto.value); goto.value = ''; canvas.focus(); };
  const viewlist = $('viewlist');
  for (const c of cams) {
    const b = document.createElement('button'); b.type = 'button';
    b.innerHTML = `<b>${c.name.slice(0, 2)}</b>${VIEW_NAMES[c.name] ?? c.name}`;
    b.onclick = () => { goToCam(c.name); if (mobile.matches) setPanel(false); };
    viewlist.appendChild(b);
  }



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
  mark('ui');
  setQuality(S.quality);
  mark('post+grass');
  atm.placeShadow(new Vector3(1.3, 3, 2.6), QUALITY[S.quality].shadowHalf, QUALITY[S.quality].shadowMap);
  fromUrl = urlDate !== null; setDate(S.date); fromUrl = false;   // a ?date= link isn't remembered
  setTime(S.minutes, true);
  mark('sun+env');
  walker.rebuild(model.root);
  mark('collider');
  // on the alfresco, looking past the lounge to the pool and the canal
  walker.place(1.3, 3.0, 2.6, (156 * Math.PI) / 180, -0.08);
  // last visit's choices first; deep links from the renders page then override them
  const o = settings.options ?? {};
  const valid = (v: string | undefined, list: Choice[]) => (v && list.some(c => c.value === v) ? v : undefined);
  model.roller = valid(o.roller, ROLLER_CHOICES) ?? model.roller;
  model.kitchen = valid(o.kitchen, KITCHEN_CHOICES) ?? model.kitchen;
  model.fence = (valid(o.fence, FENCE_CHOICES) as 'perforated' | 'glass' | undefined) ?? model.fence;
  model.pier = valid(o.pier, PIER_CHOICES) ?? model.pier;
  model.nfence = valid(o.nfence, NFENCE_CHOICES) ?? model.nfence;
  model.passage = valid(o.passage, PASSAGE_CHOICES) ?? model.passage;
  if (settings.scenario === 'existing' && !params.has('scenario')) setScenario('existing');
  model.apply(); renderRoller();
  // deep links from the renders page: ?cam=05_pool_north_end&roller=roller_pit&kitchen=…&fence=glass&scenario=existing
  // (unknown values are ignored; the nfence_/passage_ prefixes are optional)
  fromUrl = true;
  const fromParam = (k: string, list: Choice[], prefix = '') => { const v = params.get(k); if (!v) return undefined; return valid(v.startsWith(prefix) ? v : prefix + v, list); };
  if (params.get('scenario') === 'existing' || params.get('scenario') === 'proposed') setScenario(params.get('scenario') as Scenario);
  model.roller = fromParam('roller', ROLLER_CHOICES) ?? model.roller;
  model.kitchen = fromParam('kitchen', KITCHEN_CHOICES) ?? model.kitchen;
  model.fence = (fromParam('fence', FENCE_CHOICES) as 'perforated' | 'glass' | undefined) ?? model.fence;
  model.pier = fromParam('pier', PIER_CHOICES) ?? model.pier;
  model.nfence = fromParam('nfence', NFENCE_CHOICES, 'nfence_') ?? model.nfence;
  model.passage = fromParam('passage', PASSAGE_CHOICES, 'passage_') ?? model.passage;
  if (['roller', 'kitchen', 'fence', 'pier', 'nfence', 'passage'].some(k => params.has(k))) { optChanged(); renderRoller(); }
  fromUrl = false;
  if (params.get('cam')) goToCam(params.get('cam')!, true, true);
  // compile the pipelines the first view needs, all at once, for the targets the frames really render into
  // (the post pass's MRT target), while the textures upload alongside. The water mirrors come afterwards.
  // the night lights' visibility is part of every shader's key: set it for this time of day before compiling
  model.update(atm.state.night, 0, 0);
  progress(0.7, 'Compiling shaders…');
  await nextFrame();
  if (params.get('compile') !== '0') {
    try {
      const { target, mrt } = post.target;
      const jobs: Promise<unknown>[] = [compileFor(renderer, scene, camera, target, mrt, (d, n) => progress(0.7 + 0.25 * (d / n), `Compiling shaders… ${d} of ${n}`)).then(() => mark('compile-main'))];
      jobs.push(uploadTextures(renderer, model.root).then(() => mark('textures')));
      await Promise.all(jobs);
    } catch (e) { console.warn('precompile failed, compiling lazily', e); }
  }
  // anything still missing (the sun's shadow casters, odd variants) compiles in the background, not mid-frame
  mark('compiled');
  asyncPipes.active = !params.has('noasync');
  progress(0.97, 'Drawing the first frame…');

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

  $('show-help').onclick = () => { welcome.hidden = false; if (mobile.matches) setPanel(false); };

  // ---------- gates: E (or the button on phones) opens the one you're facing; pool gates close themselves ----------
  const gateTip = $('gate-tip'), gateBtn = $('gate-btn');
  let nearGate: Gate | null = null;
  const toggleGate = () => { if (nearGate) model.swingGate(nearGate, nearGate.to === 0); };
  addEventListener('keydown', e => { if (e.code === 'KeyE' && !(e.target as HTMLElement)?.closest?.('input, select, textarea')) toggleGate(); });
  gateBtn.onclick = toggleGate;
  walker.segments = () => model.gates.filter(g => model.gateVisible(g)).map(g => {
    const d = model.gateDir(g);
    return { a: g.hinge, b: g.hinge.clone().addScaledVector(d, g.width), y0: g.hinge.y, y1: g.hinge.y + 1.25 };
  });
  const _gd = new Vector3();
  const updateGateUI = (dt: number) => {
    let best = 1.5, near: Gate | null = null;
    const f = walker.feet, fx = -Math.sin(walker.yaw), fz = -Math.cos(walker.yaw);
    for (const g of model.gates) {
      if (!model.gateVisible(g)) continue;
      model.gateDir(g, _gd);
      const cx = g.hinge.x + _gd.x * g.width / 2 - f.x, cz = g.hinge.z + _gd.z * g.width / 2 - f.z, dist = Math.hypot(cx, cz);
      if (walker.mode === 'walk' && dist < best && (cx * fx + cz * fz) / Math.max(dist, 1e-3) > 0.45) { best = dist; near = g; }
      // self-closing: once you're clear of the swing for 5 s, it shuts by itself
      if (g.to === 1) {
        const r = Math.hypot(f.x - g.hinge.x, f.z - g.hinge.z);
        g.clear = r > g.width + 0.45 ? g.clear + dt : 0;
        if (g.clear > 5) model.swingGate(g, false);
      }
    }
    nearGate = near;
    const label = near ? (near.to === 1 ? 'Close the gate' : 'Open the gate') : '';
    if (isTouch) {
      gateBtn.hidden = !near;
      if (near && gateBtn.textContent !== label) gateBtn.textContent = label;
      gateTip.hidden = true;
    } else {
      gateTip.hidden = !near;
      if (near) { const html = `Press <kbd>E</kbd> to ${near.to === 1 ? 'close' : 'open'} the gate`; if (gateTip.innerHTML !== html) gateTip.innerHTML = html; }
    }
  };

  // ---------- after the first frame: full post-processing, far trees, grass, pipelines for looking around ----------
  const status = $('status');
  const setStatus = (t: string | null) => { status.hidden = !t; if (t) status.textContent = t; };
  /** Wait for the pipelines started since the last call; keep shadows refreshing while casters pop in. */
  const settle = async () => {
    for (let i = 0; i < 40; i++) {
      await nextFrame();
      const p = asyncPipes.take();
      if (!p.length) return;
      await Promise.all(p);
      shadowDirty = true;
    }
  };
  /** Compile the water mirrors' pipelines in the background, then let them fade in. */
  let mirrorsPreparing: Promise<void> | null = null;
  function prepareMirrors() {
    if (!mirrorsPreparing) mirrorsPreparing = (async () => {
      const db = renderer.getDrawingBufferSize(new Vector2());
      for (const m of model.mirrors) { m.prepare(camera, db.x, db.y); await compileFor(renderer, scene, m.cam, m.target, null); m.ready = true; }
    })();
    return mirrorsPreparing;
  }

  let revealed = false;
  function reveal() {
    if (revealed) return;
    revealed = true;
    $('loading').classList.add('done'); requestAnimationFrame(firstVisitHelp);
  }

  async function finishLoading() {
    const { target, mrt } = post.target;
    try {
      progress(0.99, 'Adding soft shadows and reflections…');
      await settle();
      post.upgrade();               // the full chain warms up behind the boot image...
      await settle();
      post.commitUpgrade();         // ...and swaps in once its pipelines are ready
      booted = true; mark('upgraded');
      // the first frame of the full chain builds its nodes on the main thread (~0.5 s): keep the loading cover
      // up until it's done, so the first thing people can move in never freezes
      reveal();

      const db = renderer.getDrawingBufferSize(new Vector2());
      if (QUALITY[S.quality].reflections) await prepareMirrors();
      await settle();
      mark('mirrors');

      setStatus('Adding trees and grass…');
      await nextFrame();
      await model.finishFar();
      grassReady = true;
      await model.grass.build(model.lawns, QUALITY[S.quality].grass); grassBuilt = QUALITY[S.quality].grass;
      model.grass.radius.value = QUALITY[S.quality].grassRadius;
      await compileFor(renderer, scene, camera, target, mrt);
      await settle();
      mark('far+grass');

      // turn around, and the lighting scheme after dark, in the background, so neither stalls later
      setStatus('Getting the rest of the yard ready…');
      for (const turn of [Math.PI / 2, Math.PI, -Math.PI / 2]) {
        const c = camera.clone(); c.rotation.set(0, walker.yaw + turn, 0, 'YXZ'); c.updateMatrixWorld();
        await compileFor(renderer, scene, c, target, mrt);
      }
      for (const m of model.mirrors) { m.prepare(camera, db.x, db.y); await compileFor(renderer, scene, m.cam, m.target, null); }
      if (LIGHT_SWAP && atm.state.night < 0.004) {
        // (old behaviour only) the night lights change every material's lighting, so compile that variant too
        const lights = model.nightLights.map(l => l.light);
        lights.forEach(l => { l.visible = true; l.intensity = 0; });
        await compileFor(renderer, scene, camera, target, mrt);
        lights.forEach(l => { l.visible = false; });
      }
    } catch (e) { console.warn('background compile', e); }
    reveal();
    asyncPipes.active = false;
    mark('settled');
    setStatus(null);
  }

  const gpuTiming = params.has('gpu') && (renderer.backend as any).trackTimestamp === true;
  const perf = { draws: 0, tris: 0, gpu: 0, cpu: 0, pending: false, frames: 0 };

  // ---------- loop ----------
  let last = performance.now(), frames = 0, fpsT = last, firstFrame = true;
  const shadowFocus = new Vector3(), lastFocus = new Vector3(1e9, 0, 0);
  renderer.setAnimationLoop(() => {
    if (world.clientWidth < 1 || world.clientHeight < 1) return;   // nothing to draw into while hidden
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    const cpu0 = performance.now();
    if (S.playing) {
      // a day in about two minutes, slowing down through the evening so dusk lasts
      const el = atm.state.el;
      const rate = el > -1 && el < 10 ? 5 : 12;   // game minutes per real second
      setTime(S.minutes + rate * dt);
    }
    walker.update(dt);
    if (walker.mode === 'drone') orbit.update();
    if (Math.abs(camera.fov - targetFov) > 0.05) { camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 4); camera.updateProjectionMatrix(); }
    model.update(atm.state.night, now / 1000, dt);
    updateGateUI(dt);
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
    if (firstFrame) mark('frame-start');
    renderClean(renderer, () => { model.renderMirrors(renderer, scene, camera, db.x, db.y, QUALITY[S.quality].reflections); post.render(); });
    if (firstFrame) mark('first-frame');
    // per-frame counters for scripts/perf.mjs: draw calls, triangles and (with ?gpu=1) GPU time per frame
    const inf = renderer.info.render;
    perf.draws = perf.draws * 0.9 + inf.drawCalls * 0.1; perf.tris = perf.tris * 0.9 + inf.triangles * 0.1;
    perf.frames++;
    perf.cpu = perf.cpu * 0.9 + (performance.now() - cpu0) * 0.1;
    if (gpuTiming && !perf.pending) {
      // a resolve returns the GPU time of every pass since the last one, so divide by the frames it covers
      perf.pending = true;
      const n = perf.frames; perf.frames = 0;
      renderer.resolveTimestampsAsync('render').then((ms?: number) => { if (ms && n) { const f = ms / n; perf.gpu = perf.gpu ? perf.gpu * 0.8 + f * 0.2 : f; } perf.pending = false; });
    }
    if (firstFrame) { firstFrame = false; finishLoading(); }
    frames++;
    if (now - fpsT > 500) { fpsEl.textContent = `${Math.round((frames * 1000) / (now - fpsT))} fps · ${S.quality} · ${(renderer.backend as any).isWebGPUBackend ? 'WebGPU' : 'WebGL 2'}`; frames = 0; fpsT = now; }
  });

  // hooks for the review script
  (window as any).__viewer = {
    setTime: (m: number) => setTime(m, true), setDate, goToCam: (n: string, instant = false) => goToCam(n, true, instant), setScenario, setQuality, setMode,
    place: (x: number, y: number, z: number, yawDeg: number, pitchDeg = 0) => { setMode('walk'); walker.place(x, y, z, (yawDeg * Math.PI) / 180, (pitchDeg * Math.PI) / 180); shadowDirty = true; },
    state: () => ({ ...S, feet: walker.feet.toArray(), yaw: walker.yaw, pitch: walker.pitch, sun: atm.state, exposure: renderer.toneMappingExposure }),
    atm, model, renderer, camera, scene, walker, perf, THREE: THREE_NS, gpuTiming: () => gpuTiming,
    get post() { return post; },
    setPanel,
  };
}

main().catch(err => {
  console.error(err);
  loadText.innerHTML = `<span class="error">The 3D view couldn't start (${String(err?.message ?? err)}). The renders still work: <a href="../renders/">open the renders page</a>.</span>`;
});
