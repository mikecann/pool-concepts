import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { CATALOGUE } from './catalogue.js';
import { WAYS, HEAT_PUMPS, DRAINS, makeLayout } from './layouts.js';
import { ROOM_POLY, RL, SPA, SEA_LEVELS, roomStats } from './room.js';
import { checkLayout, ctxFor, seaEntry } from './fit.js';
import { buildWorld, buildSea, buildItem, buildPerson, setItemStatus, dimLine, disposeTree, P, M, COL } from './scene.js';

const $ = (s, r = document) => r.querySelector(s);
const params = new URLSearchParams(location.search);
const narrow = matchMedia('(max-width: 760px)').matches;

const pick = (v, allowed, d) => (allowed.includes(v) ? v : d);
const state = {
  hp: pick(params.get('hp'), Object.keys(HEAT_PUMPS), 'kitchen'),
  way: pick(params.get('way'), Object.keys(WAYS), 'hatch'),
  drain: pick(params.get('drain'), Object.keys(DRAINS), 'canal'),
  sea: pick(params.get('sea'), SEA_LEVELS.map(l => l.id), 'today'),
  spa: 'shell',
  deck: params.get('deck') || 'solid', walls: params.get('walls') || 'solid',
  clearance: params.get('clearance') !== '0', airflow: params.get('airflow') !== '0',
  labels: params.get('labels') === '1',
  standing: true, kneeling: true,
  preset: null, cutAxis: 'x', cutAt: 800, panel: !narrow,
};
const currentLayout = () => makeLayout(state);
// the URL always describes what is on screen
function syncUrl() {
  const q = new URLSearchParams({ hp: state.hp, way: state.way, drain: state.drain, sea: state.sea, view: state.preset || 'overview' });
  history.replaceState(null, '', `?${q}`);
}

// ---- three.js -------------------------------------------------------------
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.localClippingEnabled = true;
const scene = new THREE.Scene();
scene.background = new THREE.Color(COL.bg);
const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 200);
const controls = new OrbitControls(camera, canvas);
controls.maxPolarAngle = Math.PI * 0.97;
controls.minDistance = 0.4; controls.maxDistance = 40;
scene.add(new THREE.HemisphereLight(0xf4f7f7, 0x3a4547, 1.15));
const sun = new THREE.DirectionalLight(0xffffff, 1.5); sun.position.set(6, 10, 7); scene.add(sun);
const fill = new THREE.DirectionalLight(0xaec4d0, 0.5); fill.position.set(-6, 4, -5); scene.add(fill);

const dyn = new THREE.Group(); scene.add(dyn);
let world, items = [], result, itemGroups = {}, peopleGroup, dimGroup, tags = [];
let dirty = true;
const cutPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0.8);
const invalidate = () => { dirty = true; };
controls.addEventListener('change', invalidate);

function resize() {
  const r = $('#stage').getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / r.height; camera.updateProjectionMatrix(); invalidate();
}
new ResizeObserver(resize).observe($('#stage'));

// ---- build ----------------------------------------------------------------
function rebuild() {
  while (dyn.children.length) { const o = dyn.children[0]; dyn.remove(o); disposeTree(o); }
  const layout = currentLayout(), access = WAYS[state.way];
  world = buildWorld({ access, accessId: state.way, spaType: state.spa });
  dyn.add(world.root);
  result = checkLayout(layout, CATALOGUE, ctxFor(layout, state.way, WAYS));
  itemGroups = {};
  const gi = new THREE.Group();
  for (const it of result.items) { const g = buildItem(it); setItemStatus(g, it.status); gi.add(g); itemGroups[it.id] = g; }
  for (const it of result.items) {
    // wall-mounted units outside stand on a post
    if (it.item.wallMount && (it.zone === 'yard' || it.zone === 'terrace' || it.zone === 'poolside') && it.pl.rl - it.floor > 0.1) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, it.pl.rl - it.floor, 0.08), new THREE.MeshStandardMaterial({ color: 0x8a8f86 }));
      post.position.copy(P(it.pl.x, it.pl.y, it.floor + (it.pl.rl - it.floor) / 2)); gi.add(post);
    }
  }
  dyn.add(gi);
  peopleGroup = new THREE.Group();
  const pe = layout.people || {};
  for (const kind of ['standing', 'kneeling']) for (const pos of [].concat(pe[kind] || [])) { const p = buildPerson(kind, pos); p.userData.kind = kind; peopleGroup.add(p); }
  dyn.add(peopleGroup);
  buildDims(layout, access);
  applySea();
  applyView();
  renderPanel();
}

function buildDims(layout, access) {
  dimGroup = new THREE.Group();
  tags = [];
  const tag = (pos, text, sub) => tags.push({ pos, text, sub });
  const st = roomStats();
  // headroom at the west wall
  const hx = 40, hy = -330;
  dimGroup.add(dimLine(P(hx, hy, RL.pad), P(hx, hy, RL.joistUnder)));
  tag(P(hx, hy, (RL.pad + RL.joistUnder) / 2), `${Math.round(st.headroom * 1000)}`, 'headroom');
  tag(P(hx, hy, RL.deck + 0.02), `deck ${RL.deck}`);
  tag(P(260, -1300, RL.pad), `floor ${RL.pad}`);
  tag(P(SPA.x, SPA.y, RL.deck + 0.02), `Ø${SPA.r * 2}`, state.spa === 'cabinet' ? 'cabinet' : 'in-ground');
  if (access.hatch) { const h = access.hatch; tag(P((h.x0 + h.x1) / 2, (h.y0 + h.y1) / 2, RL.deck + 0.03), `${h.x1 - h.x0} × ${h.y1 - h.y0}`, 'hatch'); }
  if (access.stairs) { const s = access.stairs; tag(P((s.x0 + s.x1) / 2, 300, 3.3), 'stairs up'); }
  const lv = seaLevel(); tag(P(3000, -2300, lv.rl), `sea ${lv.rl.toFixed(2)}`, lv.label);
  for (const it of result.items) {
    const { w, d, h } = it.g;
    tag(P(it.pl.x, it.pl.y, it.pl.rl + h / 1000), it.item.name.replace(/ \(.*\)/, ''), `${w}×${d}×${h}`);
  }
  const box = $('#labels'); box.replaceChildren();
  for (const t of tags) {
    const el = document.createElement('div'); el.className = 'tag'; el.textContent = t.text;
    if (t.sub) { const s = document.createElement('small'); s.textContent = t.sub; el.append(s); }
    box.append(el); t.el = el;
  }
  dyn.add(dimGroup);
}

const seaLevel = () => SEA_LEVELS.find(l => l.id === state.sea) || SEA_LEVELS[0];
let seaMesh = null;
function applySea() {
  const layout = currentLayout(), lv = seaLevel();
  if (seaMesh) { world.groups.sea.remove(seaMesh); disposeTree(seaMesh); }
  seaMesh = buildSea(lv.rl, layout.seaEntersRoomAtRl ?? 99);
  world.groups.sea.add(seaMesh);
  const note = $('#sea-note');
  if (note) note.textContent = lv.rl > RL.pad ? (seaMesh.userData.roomWet ? 'Room: sea inside' : 'Room: dry') : '';
  const tg = tags.find(t => t.sub && /yr|Today/.test(t.sub));
  if (tg) { tg.el.firstChild.textContent = `sea ${lv.rl.toFixed(2)}`; tg.el.lastChild.textContent = lv.label; tg.pos.y = lv.rl; }
  invalidate();
}
function applyView() {
  const { deck, walls } = world.groups, mats = world.mats;
  const ghost = (ms, on) => ms.forEach(m => { m.transparent = on; m.opacity = on ? 0.13 : 1; m.depthWrite = !on; m.needsUpdate = true; });
  deck.visible = state.deck !== 'off';
  ghost([mats.deck, mats.joist], state.deck === 'ghost');
  ghost([mats.wall, mats.paving], state.walls === 'ghost');
  dimGroup.visible = state.labels;
  $('#labels').style.display = state.labels ? '' : 'none';
  for (const g of Object.values(itemGroups)) { g.userData.clearance.visible = state.clearance; g.userData.airflow.visible = state.airflow; }
  for (const p of peopleGroup.children) p.visible = state[p.userData.kind];
  const cut = state.preset === 'cutaway';
  renderer.clippingPlanes = cut ? [cutPlane] : [];
  scene.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) { const s = m.side === THREE.BackSide ? THREE.BackSide : cut ? THREE.DoubleSide : THREE.FrontSide; if (m.side !== s) { m.side = s; m.needsUpdate = true; } } });
  invalidate();
}

// ---- camera presets -------------------------------------------------------
function bounds() {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const [x, y] of ROOM_POLY) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  for (const it of result.items) if (it.zone === 'room') for (const [x, y] of it.g.body) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  for (const p of Object.values(currentLayout().people).flat()) if (p.x > -300 && p.x < 6000 && p.y < 5000) { x0 = Math.min(x0, p.x - 300); x1 = Math.max(x1, p.x + 300); y0 = Math.min(y0, p.y - 300); y1 = Math.max(y1, p.y + 300); }
  return { x0: x0 - 400, x1: x1 + 400, y0: y0 - 400, y1: y1 + 400 };
}
function setCam(pos, target, fov = 45) {
  camera.fov = fov; camera.updateProjectionMatrix();
  camera.position.copy(pos); controls.target.copy(target); camera.up.set(0, 1, 0); camera.lookAt(target); controls.update(); invalidate();
}
function setPreset(name) {
  state.preset = name;
  const layout = currentLayout(), b = bounds();
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, ex = (b.x1 - b.x0) * M, ey = (b.y1 - b.y0) * M;
  const th = Math.tan((45 / 2) * Math.PI / 180), asp = camera.aspect;
  const dist = Math.max(ey / 2 / th, ex / 2 / (th * asp)) * 1.12;
  if (name === 'overview') {
    // the whole pool area from above the canal: pool, room, both fences and the house
    state.deck = 'solid'; state.walls = 'solid';
    setCam(P(-1500, -13500, 15.5), P(-1500, 5200, 2.0));
  } else if (name === 'plan') {
    state.deck = state.deck === 'off' ? 'off' : 'ghost';
    setCam(P(cx, cy - 20, 2.4 + dist), P(cx, cy, 2.4));
  } else if (name === 'canal') {
    state.deck = state.deck === 'off' ? 'off' : 'ghost'; state.walls = 'ghost';
    const t = P(cx, cy, 1.7); setCam(t.clone().add(new THREE.Vector3(0, dist * 0.62, dist * 0.95)), t);
  } else if (name === 'inside') {
    const v = layout.views?.inside || { eye: [60, -820, 1.75], target: [2400, -900, 1.3] };
    state.deck = 'solid'; state.walls = 'solid';
    setCam(P(v.eye[0], v.eye[1], v.eye[2]), P(v.target[0], v.target[1], v.target[2]), 70);
  } else if (name === 'cutaway') {
    const cut = layout.views?.cut || { axis: 'x', at: 800 };
    state.cutAxis = cut.axis; state.cutAt = cut.at;
    state.deck = 'ghost'; state.walls = 'ghost';
    updateCut(true);
  } else if (name === 'heatpump') {
    // frames the chosen heat pump spot from the pool side, above
    const v = HEAT_PUMPS[state.hp].view;
    state.deck = 'solid'; state.walls = 'solid';
    setCam(P(...v.eye), P(...v.target));
  }
  for (const btn of document.querySelectorAll('#presets button')) btn.setAttribute('aria-pressed', btn.dataset.preset === name);
  $('#cut').hidden = name !== 'cutaway';
  applyView(); syncSegs(); syncUrl();
}
function updateCut(moveCamera = false) {
  const b = bounds();
  if (state.cutAxis === 'x') {
    cutPlane.normal.set(-1, 0, 0); cutPlane.constant = state.cutAt * M;
    $('#cut').min = Math.round(b.x0); $('#cut').max = Math.round(b.x1);
  } else {
    cutPlane.normal.set(0, 0, -1); cutPlane.constant = -state.cutAt * M;
    $('#cut').min = Math.round(b.y0); $('#cut').max = Math.round(b.y1);
  }
  $('#cut').value = state.cutAt;
  if (moveCamera) {
    const cy = (b.y0 + b.y1) / 2;
    const t = state.cutAxis === 'x' ? P(state.cutAt, 0, 1.7) : P(2350, state.cutAt, 1.7);
    const off = state.cutAxis === 'x' ? new THREE.Vector3(4.6, 1.3, 0.8) : new THREE.Vector3(0.5, 1.6, 5.2);
    setCam(t.clone().add(off), t);
  }
  invalidate();
}

// ---- panel ----------------------------------------------------------------
function el(tag, props = {}, ...kids) {
  const e = Object.assign(document.createElement(tag), props);
  for (const k of kids) e.append(k);
  return e;
}
function seg(id, options, current, onPick) {
  const wrap = el('div', { className: 'seg', id });
  for (const [v, label] of options) {
    const b = el('button', { textContent: label, type: 'button' }); b.dataset.v = v;
    b.setAttribute('aria-pressed', v === current);
    b.onclick = () => { onPick(v); syncSegs(); };
    wrap.append(b);
  }
  return wrap;
}
function toggle(key, label) {
  const b = el('button', { textContent: label, type: 'button' }); b.dataset.k = key;
  b.setAttribute('aria-pressed', !!state[key]);
  b.onclick = () => { state[key] = !state[key]; syncSegs(); applyView(); };
  return b;
}
function syncSegs() {
  for (const [id, key] of [['seg-hp', 'hp'], ['seg-way', 'way'], ['seg-drain', 'drain'], ['seg-sea', 'sea'], ['seg-deck', 'deck'], ['seg-walls', 'walls']]) {
    const w = $('#' + id); if (!w) continue;
    for (const b of w.children) b.setAttribute('aria-pressed', b.dataset.v === state[key]);
  }
  for (const b of document.querySelectorAll('[data-k]')) b.setAttribute('aria-pressed', !!state[b.dataset.k]);
}
const fmt = (n, d = 2) => n.toFixed(d);

// The heat pump's own fit result, shown under its choice so it is not buried in the list below.
function hpStatus() {
  const it = result.items.find(i => i.id === 'pool_heat_pump');
  if (!it) return [];
  const notes = it.notes.filter(n => n.status !== 'fits');
  if (!notes.length) return [el('p', { className: 'verdict', textContent: 'Fits, with its clearances and 2.5 m of clear air in front.' })];
  return notes.map(n => el('p', { className: 'verdict' + (n.status === 'clash' ? ' hp-clash' : ''), textContent: n.note.charAt(0).toUpperCase() + n.note.slice(1) + '.' }));
}

function renderPanel() {
  const panel = $('#panel'), layout = currentLayout(), st = roomStats(), top = panel.scrollTop;
  panel.replaceChildren();
  // Each choice moves the camera to what it changes, so a click always shows something.
  const choose = (key, v) => {
    state[key] = v; rebuild();
    if (key === 'hp') setPreset('heatpump');
    else if (key === 'way' && (state.preset === 'heatpump' || state.preset === 'overview')) setPreset('canal');
    else if (state.preset === 'heatpump') setPreset('heatpump');
    syncUrl();
  };
  panel.append(el('h1', { textContent: 'Pool equipment room' }));
  panel.append(el('section', {}, el('h2', { textContent: 'Heat pump' }),
    seg('seg-hp', Object.entries(HEAT_PUMPS).map(([k, v]) => [k, v.label]), state.hp, v => choose('hp', v)),
    el('p', { className: 'verdict', textContent: HEAT_PUMPS[state.hp].line }),
    ...hpStatus()));
  panel.append(el('section', {}, el('h2', { textContent: 'Way in' }),
    seg('seg-way', Object.entries(WAYS).map(([k, v]) => [k, v.label]), state.way, v => choose('way', v)),
    el('p', { className: 'verdict', textContent: WAYS[state.way].line })));
  const entry = seaEntry(layout);
  panel.append(el('section', {}, el('h2', { textContent: 'Sea level' }),
    seg('seg-sea', SEA_LEVELS.map(l => [l.id, l.label]), state.sea, v => { state.sea = v; applySea(); syncUrl(); }),
    el('div', { style: 'height:8px' }),
    el('div', { className: 'seg-row' }, el('span', { className: 'verdict', textContent: 'Floor drain' }),
      seg('seg-drain', Object.entries(DRAINS).map(([k, v]) => [k, v.label]), state.drain, v => choose('drain', v))),
    el('p', { className: 'verdict', textContent: entry ? `Sea gets into the room at the ${entry} level.` : 'Sea does not get into the room.' }),
    el('p', { className: 'verdict', id: 'sea-note' })));
  panel.append(el('section', {}, el('div', { className: 'readout', id: 'readout', innerHTML:
    `<div>${fmt(st.net)} m² <span>floor</span></div><div>${fmt(st.volumeNet)} m³ <span>volume</span></div><div>${Math.round(st.headroom * 1000)} mm <span>headroom</span></div><div>${Math.round(result.heatW)} W <span>heat</span></div>` })));
  const c = result.summary;
  const counts = el('div', { className: 'counts', innerHTML: `<b>${c.fits}</b> fit · <b>${c.tight}</b> tight · <b class="${c.clash ? 'c' : ''}">${c.clash}</b> clash` });
  const ul = el('ul', { className: 'fit' });
  for (const it of result.items) {
    const important = it.notes.filter(n => n.status !== 'fits');
    const why = (important[0] || it.notes[0])?.note || '';
    const extra = important.length > 1 ? ` (+${important.length - 1})` : '';
    const li = el('li', {}, el('span', { className: `dot ${it.status}` }), el('div', { className: 'n', textContent: it.item.name }));
    li.title = it.notes.map(n => n.note).join('\n');
    if (why) li.append(el('div', { className: 'why' + (it.status === 'clash' ? ' clash-text' : ''), textContent: why + extra }));
    li.append(el('div', { className: 'why sea', textContent: it.sea.text }));
    li.onmouseenter = () => hi(it.id, true); li.onmouseleave = () => hi(it.id, false);
    ul.append(li);
  }
  panel.append(el('section', {}, el('h2', { textContent: 'Fit' }), counts, ul));
  panel.append(el('section', {}, el('h2', { textContent: 'View' }),
    seg('seg-deck', [['solid', 'Deck'], ['ghost', 'Ghost'], ['off', 'Off']], state.deck, v => { state.deck = v; applyView(); }),
    el('div', { style: 'height:6px' }),
    seg('seg-walls', [['solid', 'Walls'], ['ghost', 'Ghost']], state.walls, v => { state.walls = v; applyView(); }),
    el('div', { style: 'height:8px' }),
    el('div', { className: 'seg' }, toggle('clearance', 'Clearance'), toggle('airflow', 'Airflow'), toggle('labels', 'Labels'))));
  syncSegs(); applySea();
  panel.scrollTop = top;
}
function hi(id, on) {
  const g = itemGroups[id]; if (!g) return;
  g.userData.bodyMat.emissive.setHex(on ? 0x445055 : 0x000000); invalidate();
}

for (const b of document.querySelectorAll('#presets button')) b.onclick = () => setPreset(b.dataset.preset);
$('#cut').oninput = e => { state.cutAt = +e.target.value; updateCut(false); };
$('#panel-toggle').onclick = () => setPanel(!state.panel);
function setPanel(open) { state.panel = open; $('#panel').classList.toggle('collapsed', !open); document.body.classList.toggle('panel-open', open); $('#panel-toggle').setAttribute('aria-expanded', open); }

// ---- loop -----------------------------------------------------------------
const v3 = new THREE.Vector3();
function draw() {
  renderer.render(scene, camera);
  if (state.labels) {
    const r = canvas.getBoundingClientRect(), placed = [];
    for (const t of tags) {
      v3.copy(t.pos).project(camera);
      let vis = v3.z < 1 && Math.abs(v3.x) < 1.05 && Math.abs(v3.y) < 1.05;
      if (vis) {
        t.el.style.display = '';
        const w = t.el.offsetWidth, h = t.el.offsetHeight, x = ((v3.x + 1) / 2) * r.width, y = ((1 - v3.y) / 2) * r.height - 4;
        const box = [x - w / 2, y - h, x + w / 2, y];
        // hide a label that would sit on top of one already placed (the dimension labels come first)
        if (placed.some(p => box[0] < p[2] && box[2] > p[0] && box[1] < p[3] && box[3] > p[1])) vis = false;
        else { placed.push(box); t.el.style.left = x + 'px'; t.el.style.top = y + 'px'; }
      }
      t.el.style.display = vis ? '' : 'none';
    }
  }
  dirty = false;
}
function loop() { if (dirty) draw(); requestAnimationFrame(loop); }

setPanel(state.panel);
resize();
rebuild();
setPreset(pick(params.get('view'), ['overview', 'plan', 'canal', 'inside', 'cutaway', 'heatpump'], 'overview'));
for (const k of ['deck', 'walls']) if (params.get(k)) state[k] = params.get(k);
applyView(); syncSegs();
loop();

// hooks for the screenshot script
window.__eq = {
  ready: true,
  state,
  async show({ hp, way, drain, view, labels, sea }) {
    if (hp) state.hp = hp;
    if (way) state.way = way;
    if (drain) state.drain = drain;
    if (sea) state.sea = sea;
    if (labels !== undefined) state.labels = labels;
    rebuild(); setPreset(view || state.preset || 'canal'); draw();
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    draw();
    return result.items.map(i => ({ id: i.id, status: i.status, notes: i.notes.map(n => n.note) }));
  },
  errors: [],
};
window.addEventListener('error', e => window.__eq.errors.push(String(e.message)));
