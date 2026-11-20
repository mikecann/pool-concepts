import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { CATALOGUE } from './catalogue.js';
import { WAYS, HEAT_PUMPS, makeLayout } from './layouts.js';
import { RL, SPA, SEA_LEVELS, roomStats } from './room.js';
import { checkLayout, ctxFor } from './fit.js';
import { buildWorld, buildSea, buildItem, buildPerson, setItemStatus, dimLine, disposeTree, P, M, COL } from './scene.js';

const $ = (s, r = document) => r.querySelector(s);
const params = new URLSearchParams(location.search);
const narrow = matchMedia('(max-width: 760px)').matches;

const pick = (v, allowed, d) => (allowed.includes(v) ? v : d);
const state = {
  hp: pick(params.get('hp'), Object.keys(HEAT_PUMPS), 'kitchen'),
  way: pick(params.get('way'), Object.keys(WAYS), 'hatch'),
  sea: 'today',
  spa: 'shell',
  deck: params.get('deck') || 'ghost', walls: params.get('walls') || 'ghost',
  clearance: params.get('clearance') !== '0', airflow: params.get('airflow') !== '0',
  labels: params.get('labels') !== '0',
  standing: true, kneeling: true,
  panel: !narrow,
};
const currentLayout = () => makeLayout(state);
// the URL always describes what is on screen
function syncUrl() {
  const q = new URLSearchParams({ hp: state.hp, way: state.way });
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

// The canal's water, at today's level.
let seaMesh = null;
function applySea() {
  if (seaMesh) { world.groups.sea.remove(seaMesh); disposeTree(seaMesh); }
  seaMesh = buildSea(SEA_LEVELS[0].rl, 99);
  world.groups.sea.add(seaMesh);
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
  invalidate();
}

// ---- camera ---------------------------------------------------------------
// One view: from above the canal, far enough out to take in the pool, the room, the fences and the house.
function setCam(pos, target, fov = 45) {
  camera.fov = fov; camera.updateProjectionMatrix();
  camera.position.copy(pos); controls.target.copy(target); camera.up.set(0, 1, 0); camera.lookAt(target); controls.update(); invalidate();
}
function homeView() {
  const target = P(-1300, 4300, 2.0), eye = P(-1300, -9800, 11.2);
  // a tall, narrow screen sees less width, so stand further back
  const back = camera.aspect < 1 ? 1.75 : 1;
  setCam(target.clone().add(eye.sub(target).multiplyScalar(back)), target);
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
  for (const [id, key] of [['seg-hp', 'hp'], ['seg-way', 'way'], ['seg-deck', 'deck'], ['seg-walls', 'walls']]) {
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
  const panel = $('#panel'), st = roomStats(), top = panel.scrollTop;
  const wasOpen = $('#workings')?.open ?? false;
  panel.replaceChildren();
  // A choice changes the model and leaves the camera where the viewer put it.
  const choose = (key, v) => { state[key] = v; rebuild(); syncUrl(); };
  panel.append(el('h1', { textContent: 'Pool equipment room' }));
  panel.append(el('section', {}, el('h2', { textContent: 'Heat pump' }),
    seg('seg-hp', Object.entries(HEAT_PUMPS).map(([k, v]) => [k, v.label]), state.hp, v => choose('hp', v)),
    el('p', { className: 'verdict', textContent: HEAT_PUMPS[state.hp].line }),
    ...hpStatus()));
  panel.append(el('section', {}, el('h2', { textContent: 'Way in' }),
    seg('seg-way', Object.entries(WAYS).map(([k, v]) => [k, v.label]), state.way, v => choose('way', v)),
    el('p', { className: 'verdict', textContent: WAYS[state.way].line })));
  panel.append(el('section', {}, el('h2', { textContent: 'View' }),
    seg('seg-deck', [['solid', 'Deck'], ['ghost', 'Ghost'], ['off', 'Off']], state.deck, v => { state.deck = v; applyView(); }),
    el('div', { style: 'height:6px' }),
    seg('seg-walls', [['solid', 'Walls'], ['ghost', 'Ghost']], state.walls, v => { state.walls = v; applyView(); }),
    el('div', { style: 'height:8px' }),
    el('div', { className: 'seg' }, toggle('clearance', 'Clearance'), toggle('airflow', 'Airflow'), toggle('labels', 'Labels'))));
  // The room's numbers and the item-by-item fit check, folded away until asked for.
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
    li.onmouseenter = () => hi(it.id, true); li.onmouseleave = () => hi(it.id, false);
    ul.append(li);
  }
  const workings = el('details', { id: 'workings', open: wasOpen }, el('summary', { textContent: 'Sizes and fit check' }),
    el('div', { className: 'readout', id: 'readout', innerHTML:
      `<div>${fmt(st.net)} m² <span>floor</span></div><div>${fmt(st.volumeNet)} m³ <span>volume</span></div><div>${Math.round(st.headroom * 1000)} mm <span>headroom</span></div><div>${Math.round(result.heatW)} W <span>heat</span></div>` }),
    counts, ul);
  panel.append(el('section', {}, workings));
  syncSegs();
  panel.scrollTop = top;
}
function hi(id, on) {
  const g = itemGroups[id]; if (!g) return;
  g.userData.bodyMat.emissive.setHex(on ? 0x445055 : 0x000000); invalidate();
}

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
homeView();
syncSegs(); syncUrl();
loop();

// hooks for the screenshot script
window.__eq = {
  ready: true,
  state,
  async show({ hp, way, labels, deck, walls, home }) {
    if (hp) state.hp = hp;
    if (way) state.way = way;
    if (labels !== undefined) state.labels = labels;
    if (deck) state.deck = deck;
    if (walls) state.walls = walls;
    rebuild(); if (home) homeView(); draw();
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    draw();
    return result.items.map(i => ({ id: i.id, status: i.status, notes: i.notes.map(n => n.note) }));
  },
  errors: [],
};
window.addEventListener('error', e => window.__eq.errors.push(String(e.message)));
