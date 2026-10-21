// Round 21 tests: the dimensions overlay (off by default, Settings switch and L, ~56 by default, option-specific ones
// come and go with their options, the chips, Today, walk/fly and phone), the boundary fence options, Layout B's
// warnings, and crawling through the pump room round the spa in both layouts. Headless on the real GPU.
//   node scripts/r21-test.mjs [--out review/round21/test]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const OUT = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'review/round21/test';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ headless: true, channel: 'chromium', args: ['--enable-unsafe-webgpu', '--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'] });
let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(58)} ${info}`); if (!ok) fail++; };
const errs = [];
const open = async (viewport, q = '', ctxOpts = {}) => {
  const ctx = await b.newContext({ viewport, ...ctxOpts });
  const p = await ctx.newPage();
  p.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text().slice(0, 200)); });
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await p.goto(`http://localhost:4173/model/walk/?q=Medium&nohelp&date=2027-01-16&t=885${q}`);
  await p.waitForFunction(() => window.__marks?.some(m => m[0] === 'settled'), null, { timeout: 180000 });
  await p.addStyleTag({ content: '.fps,.joystick{display:none!important}' });
  return p;
};
const ids = p => p.evaluate(() => __viewer.dims.current().map(d => d.id));
const opt = (p, k, v) => p.evaluate(([k, v]) => __viewer.setOption(k, v), [k, v]);

// ---------- dimensions ----------
let p = await open({ width: 1440, height: 900 });
check('dimensions are off by default', await p.evaluate(() => !__viewer.dims.enabled && document.getElementById('dim-labels').hidden));
await p.evaluate(() => __viewer.setPanel(false));
await p.keyboard.press('KeyL'); await p.waitForTimeout(1200);
let st = await p.evaluate(() => ({ on: __viewer.dims.enabled, ...__viewer.dims.stats() }));
check('L switches them on', st.on);
check('  about 56 show by default (Proposed, default options)', st.dims >= 50 && st.dims <= 75, `${st.dims} dims, ${st.labels} labels on screen`);
check('  the settings switch follows', await p.evaluate(() => document.getElementById('opt-dims').checked));
// every option-specific dim comes and goes with its option
const all = await p.evaluate(() => fetch('../web/dims.json').then(r => r.json()));
const FIELD = { roller: 'roller', kitchen: 'kitchen', post: 'post', pump: 'pump', play: 'play', spa_cover: 'spaCover', pier: 'pier', nfence: 'nfence', passage: 'passage', bfence: 'bfence', bplant: 'bplant', wallcap: 'wallcap', deck: 'deck', corner: 'corner' };
const fieldFor = k => Object.entries(FIELD).find(([pre]) => k.startsWith(pre + '_') || k === pre)?.[1];
let bad = [], tried = 0;
for (const d of all.filter(d => d.option && d.set !== 'existing')) {
  const parts = d.option.split('+'), fields = parts.map(fieldFor);
  if (fields.some(f => !f)) continue;
  // choose it (the spa cover's 'rolled' state is an option value of its own)
  const before = await p.evaluate(fs => Object.fromEntries(fs.map(f => [f, __viewer.model[f]])), fields);
  for (const [i, part] of parts.entries()) await opt(p, fields[i], part);
  const on = (await ids(p)).includes(d.id);
  // and something else in its first group: gone
  const other = { roller: 'none', kitchen: 'kitchen_none', post: 'post_as_drawn', pump: 'pump_doors', play: 'play_as_is', spaCover: 'spa_cover_none', pier: 'pier_as_drawn', nfence: 'nfence_as_drawn', passage: 'passage_pavers', bfence: 'bfence_perforated' };
  const alt = other[fields[0]] === parts[0] ? { post: 'post_two', play: 'play_moved', pier: 'pier_tall', nfence: 'nfence_moved', passage: 'passage_aggregate', bfence: 'bfence_slat', kitchen: 'kitchen_split', pump: 'pump_open', spaCover: 'spa_cover_on', roller: 'roller_deep' }[fields[0]] : other[fields[0]];
  await opt(p, fields[0], alt);
  const off = !(await ids(p)).includes(d.id);
  for (const [f, v] of Object.entries(before)) await opt(p, f, v);
  tried++;
  if (!(on && off)) bad.push(`${d.id} (${d.option}: ${on ? '' : 'missing when chosen'}${off ? '' : ' still there without it'})`);
}
check(`option-specific dims follow their options (${tried} checked)`, bad.length === 0 && tried > 40, bad.slice(0, 4).join('; '));
const hideOnly = all.filter(d => d.hide_option);
for (const d of hideOnly) {
  // a dim that also has an option of its own (Round 28: the bench corner's heights) shows only with it chosen
  const own = d.option && !d.option.includes('+') ? [fieldFor(d.option), d.option] : null;
  const was = own && await p.evaluate(f => __viewer.model[f], own[0]);
  if (own) await opt(p, own[0], own[1]);
  const shownNow = (await ids(p)).includes(d.id);
  await opt(p, 'post', d.hide_option); const hidden = !(await ids(p)).includes(d.id);
  await opt(p, 'post', 'post_as_drawn');
  if (own) await opt(p, own[0], was);
  check(`  "${d.id}" hides with ${d.hide_option}`, shownNow && hidden);
}
// chips
await p.evaluate(() => document.getElementById('settings').showModal());
await p.locator('#opt-dimgroups button', { hasText: /^Pool$/ }).click();
const noPool = await p.evaluate(() => __viewer.dims.current().filter(d => d.group === 'pool').length);
check('the Pool chip hides the pool dims', noPool === 0 && (await p.evaluate(() => __viewer.dims.current().length)) > 20);
await p.screenshot({ path: `${OUT}/settings_dims.png` });
await p.locator('#opt-dimgroups button', { hasText: /^Pool$/ }).click();
await p.evaluate(() => document.getElementById('settings').close());
// Today
await p.evaluate(() => __viewer.setScenario('existing')); await p.waitForTimeout(400);
const today = await p.evaluate(() => __viewer.dims.current().map(d => d.set));
check('Today shows only its own dims', today.length > 0 && today.every(s => s !== 'proposed'), `${today.length}`);
await p.evaluate(() => __viewer.setScenario('proposed'));
// views: walk, fly, and flying high (from above the pool and lounge)
await p.evaluate(() => __viewer.place(1.3, 3.0, 2.6, 156, -12)); await p.waitForTimeout(1200);
await p.screenshot({ path: `${OUT}/dims_walk.png` });
st = await p.evaluate(() => __viewer.dims.stats());
check('walking: labels on screen', st.labels > 4, `${st.labels}`);
await p.evaluate(() => { __viewer.setMode('fly'); __viewer.walker.startFly(new __viewer.THREE.Vector3(-4.2, 6.5, -2.5), Math.PI * 0.95, -0.7); }); await p.waitForTimeout(1200);
await p.screenshot({ path: `${OUT}/dims_fly.png` });
check('flying: labels on screen', (await p.evaluate(() => __viewer.dims.stats())).labels > 4);
await p.evaluate(() => __viewer.setMode('fly')); await p.waitForTimeout(300);
await p.evaluate(() => __viewer.goToCam('17_pool_overview', true)); await p.waitForTimeout(1500);
await p.screenshot({ path: `${OUT}/dims_fly_high_pool_lounge.png` });
const dr = await p.evaluate(() => __viewer.dims.stats());
check('flying high, above the pool and lounge: labels on screen', dr.labels > 8, `${dr.labels} of ${dr.dims}`);
// labels don't overlap
const overlaps = await p.evaluate(() => { const r = [...document.querySelectorAll('.dim-label')].filter(e => e.style.display !== 'none').map(e => e.getBoundingClientRect()); let n = 0; for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) if (r[i].left < r[j].right - 2 && r[i].right > r[j].left + 2 && r[i].top < r[j].bottom - 2 && r[i].bottom > r[j].top + 2) n++; return n; });
check('  labels don\'t pile up', overlaps === 0, `${overlaps} overlapping`);
await p.keyboard.press('KeyL'); await p.waitForTimeout(300);
check('L again switches them off', await p.evaluate(() => !__viewer.dims.enabled && document.getElementById('dim-labels').hidden));
check('  and it\'s remembered', await p.evaluate(() => JSON.parse(localStorage.getItem('pool-settings')).dims === false));
check('the tape measure is still there', await p.locator('#measure-btn').isVisible());

// ---------- boundary fence ----------
await p.evaluate(() => { __viewer.setMode('walk'); __viewer.setPanel(true); window.__openCategory('boundary'); });
const titles = await p.locator('#cards-bfence .card b').allTextContents();
check('Boundary fence: six cards', titles.join(' | ') === 'Perforated | Colorbond | Slat screen | Raised wall | Taller tubular | Keep existing', titles.join(' | '));
check('  Perforated by default', await p.evaluate(() => __viewer.model.bfence === 'bfence_perforated'));
const warn = await p.locator('#cards-bfence .card-warn:not([hidden])').allTextContents();
check('  Keep existing is flagged', warn.length === 1 && /0\.83 m/.test(warn[0]), warn.join());
await p.locator('#cat-boundary .info-btn').click();
const rules = await p.locator('#bfence-note').innerText();
check('  the i explains the WA rules', /1\.8 m/.test(rules) && /900 mm/.test(rules) && /neighbour/.test(rules));
// by option tag: the fence's parts are merged with others of the same tag, so their names change
const vis = key => p.evaluate(k => { let n = 0, v = 0; __viewer.model.root.traverse(o => { if (o.isMesh && o.userData.option === k) { n++; let q = o, ok = true; while (q) { if (!q.visible) ok = false; q = q.parent; } if (ok) v++; } }); return [v, n]; }, key);
for (const k of ['bfence_colorbond', 'bfence_slat', 'bfence_masonry', 'bfence_tubular', 'bfence_existing', 'bfence_perforated']) {
  await opt(p, 'bfence', k); await p.waitForTimeout(200);
  const [v, n] = await vis(k), others = await vis(k === 'bfence_perforated' ? 'bfence_colorbond' : 'bfence_perforated');
  check(`  ${k} shows (and the others don't)`, n > 0 && v > 0 && others[0] === 0, `${v}/${n}`);
}
await p.evaluate(() => __viewer.goToCam('13_deep_end_to_house', true)); await p.waitForTimeout(1500);
await p.locator('#canvas').screenshot({ path: `${OUT}/bfence_perforated_13.png` });
await p.evaluate(() => __viewer.setScenario('existing')); await p.waitForTimeout(800);
const todayNew = await vis('bfence_perforated');
check('Today: the existing fence, not the new one', todayNew[0] === 0);
await p.locator('#canvas').screenshot({ path: `${OUT}/bfence_today_13.png` });
await p.evaluate(() => __viewer.setScenario('proposed'));
await p.close();

// ---------- Layout B: the warnings ----------
p = await open({ width: 1440, height: 900 }, '&layout=b&post=post_as_drawn&kitchen=kitchen_lounge');
await p.evaluate(() => { __viewer.setPanel(true); window.__openCategory('alfresco'); });
const bw = await p.evaluate(() => {
  const card = t => [...document.querySelectorAll('.card')].find(c => c.querySelector('b')?.textContent === t);
  return { post: card('One post (as drawn)')?.querySelector('.card-warn:not([hidden])')?.textContent, kitchenWarn: card('Facing the lounge')?.querySelector('.card-warn:not([hidden])')?.textContent ?? null, kitchenNote: card('Facing the lounge')?.querySelector('.card-note:not([hidden])')?.textContent };
});
check('B: SK02\'s post still warns (0.35 m in front of the steps)', /0\.35 m/.test(bw.post ?? ''), bw.post);
check('B: the lounge kitchen no longer warns; a note says 1.85 m', !bw.kitchenWarn && /1\.85 m/.test(bw.kitchenNote ?? ''), bw.kitchenNote);
// measured: the post against the north-west steps, and the kitchen's west end against them
const geo = await p.evaluate(() => {
  const V = __viewer, T = V.THREE, bb = re => { const B = new T.Box3(); V.model.root.traverse(o => { if (o.isMesh && re.test(o.name)) { let q = o, ok = true; while (q) { if (!q.visible) ok = false; q = q.parent; } if (ok) B.expandByObject(o); } }); return B; };
  const tagged = k => { const B = new T.Box3(); V.model.root.traverse(o => { if (o.isMesh && String(o.userData.option ?? '').split('+').includes(k)) { let q = o, ok = true; while (q) { if (!q.visible) ok = false; q = q.parent; } if (ok) B.expandByObject(o); } }); return B; };
  const post = tagged('post_as_drawn'), kit = tagged('kitchen_lounge'), lounge = bb(/^sunken_floor$/);
  return { post: [post.min.x, post.max.x, post.min.z, post.max.z].map(v => +v.toFixed(2)), kitchen: [kit.min.x, kit.max.x].map(v => +v.toFixed(2)), lounge: [lounge.min.x, lounge.max.x].map(v => +v.toFixed(2)) };
});
console.log('     B geometry (x ranges): post', geo.post.slice(0, 2), 'kitchen', geo.kitchen, 'lounge floor', geo.lounge);
check('B: the kitchen starts east of the lounge\'s west wall + steps', geo.kitchen[0] > geo.lounge[0] + 0.9, `kitchen from x ${geo.kitchen[0]}, lounge floor from ${geo.lounge[0]}`);
check('B: the post is over the steps\' width', geo.post[1] > geo.lounge[0] && geo.post[0] < geo.lounge[0] + 1.0, `post x ${geo.post[0]}..${geo.post[1]}`);
await p.evaluate(() => __viewer.goToCam('15_lounge_from_alfresco', true)); await p.waitForTimeout(1500);
await p.locator('#canvas').screenshot({ path: `${OUT}/b_post_kitchen_15.png` });
await p.close();

// ---------- the pump room: walk (crouched) from the doors round the spa, both layouts ----------
for (const L of ['a', 'b']) {
  p = await open({ width: 1280, height: 720 }, `&layout=${L}&panel=0`);
  // plan on a 10 cm grid where the walker's capsule fits with kneeling headroom, then walk it with the keys
  const plan = await p.evaluate(() => {
    const V = __viewer, T = V.THREE, w = V.walker, B = new T.Box3();
    V.model.root.traverse(o => { if (o.isMesh && o.name === 'pump_floor') B.expandByObject(o); });
    const fy = B.max.y, step = 0.1, nx = Math.round((B.max.x - B.min.x) / step), nz = Math.round((B.max.z - B.min.z) / step);
    const ok = (x, z) => { const g = w.walkableAt(x, z, fy + 0.5); if (g === null || Math.abs(g - fy) > 0.08 || w.headroomAt(x, z, g) < 0.75) return false;
      return [[0.25, 0], [-0.25, 0], [0, 0.25], [0, -0.25]].every(([dx, dz]) => { const h = w.walkableAt(x + dx, z + dz, fy + 0.5); return h !== null && Math.abs(h - fy) < 0.08 && w.headroomAt(x + dx, z + dz, h) >= 0.75; }); };
    const cell = (i, k) => [B.min.x + (i + 0.5) * step, B.min.z + (k + 0.5) * step];
    const door = V.hinges.list.find(h => h.group === 'pump_doors').centre;
    // start: the free cell nearest the doors; goal: the free cell furthest from it along the room (round the spa)
    const free = []; for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) { const [x, z] = cell(i, k); if (ok(x, z)) free.push([i, k]); }
    const id = (i, k) => i * nz + k, set = new Set(free.map(([i, k]) => id(i, k)));
    let start = free.reduce((a, c) => { const [x, z] = cell(...c), [ax, az] = cell(...a); return Math.hypot(x - door.x, z - door.z) < Math.hypot(ax - door.x, az - door.z) ? c : a; });
    const prev = new Map([[id(...start), null]]), q = [start];
    while (q.length) { const [i, k] = q.shift(); for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = id(i + di, k + dk); if (set.has(n) && !prev.has(n)) { prev.set(n, id(i, k)); q.push([i + di, k + dk]); } } }
    // the far end: the reachable cell furthest (by path) from the door, i.e. round the spa
    let far = id(...start), fd = 0;
    for (const n of prev.keys()) { let d = 0, c = n; while (prev.get(c) !== null) { c = prev.get(c); d++; } if (d > fd) { fd = d; far = n; } }
    const path = []; for (let c = far; c !== null; c = prev.get(c)) path.unshift(cell(Math.floor(c / nz), c % nz));
    const spa = new T.Box3(); V.model.root.traverse(o => { if (o.isMesh && /^spa_cabinet/.test(o.name)) spa.expandByObject(o); });
    return { path: path.filter((_, i) => i % 4 === 0 || i === path.length - 1), steps: fd * step, fy, door: door.toArray(), spa: [spa.min.x, spa.max.x, spa.min.z, spa.max.z] };
  });
  const end = plan.path[plan.path.length - 1];
  // round the spa: from the doors' side of it to beyond its centre on the far side (it's round, so not its box)
  const round = end[0] > (plan.spa[0] + plan.spa[1]) / 2 && end[1] < (plan.spa[2] + plan.spa[3]) / 2 && plan.door[2] > plan.spa[3];
  check(`${L}: a crawl path from the doors round the spa (>= 0.75 m headroom)`, plan.steps > 3 && round, `${plan.steps.toFixed(1)} m long, ends at ${end.map(v => v.toFixed(2))} (spa x ${plan.spa[0].toFixed(2)}..${plan.spa[1].toFixed(2)})`);
  // walk it: the doors open, from the promenade in, steering for each point in turn
  await p.evaluate(([d]) => { const h = __viewer.hinges.list.find(h => h.group === 'pump_doors'); __viewer.hinges.toggle(h, true); __viewer.place(d[0], d[1], d[2] + 1.0, 0, -10); }, [plan.door]);
  await p.waitForTimeout(1200);
  for (const [x, z] of [[plan.door[0], plan.door[2] - 0.4], ...plan.path]) {
    for (let t = 0; t < 40; t++) {
      const r = await p.evaluate(([x, z]) => { const w = __viewer.walker, f = w.feet, dx = x - f.x, dz = z - f.z; w.yaw = Math.atan2(-dx, -dz); return Math.hypot(dx, dz); }, [x, z]);
      if (r < 0.12) break;
      await p.keyboard.down('KeyW'); await p.waitForTimeout(90); await p.keyboard.up('KeyW');
    }
  }
  const at = await p.evaluate(() => { const w = __viewer.walker; return { feet: w.feet.toArray(), crouch: w.crouching }; });
  const dist = Math.hypot(at.feet[0] - end[0], at.feet[2] - end[1]);
  check(`${L}: walked it, kneeling, to the far end`, dist < 0.35 && at.crouch && Math.abs(at.feet[1] - plan.fy) < 0.1, `${dist.toFixed(2)} m from the end, at ${at.feet.map(v => v.toFixed(2))}`);
  await p.locator('#canvas').screenshot({ path: `${OUT}/pump_${L}_far_end.png` });
  await p.close();
}

// ---------- phone ----------
p = await open({ width: 390, height: 844 }, '&cam=17_pool_overview', { deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await p.evaluate(() => __viewer.setPanel(true));
await p.locator('#settings-btn').click();
await p.locator('#opt-dims').check(); await p.waitForTimeout(300);
await p.screenshot({ path: `${OUT}/phone_settings.png` });
await p.evaluate(() => document.getElementById('settings').close());
await p.evaluate(() => __viewer.setPanel(false)); await p.waitForTimeout(1500);
await p.screenshot({ path: `${OUT}/phone_dims.png` });
const ph = await p.evaluate(() => ({ ...__viewer.dims.stats(), overflow: document.documentElement.scrollWidth > innerWidth }));
check('phone: the switch works and labels show, no sideways scroll', ph.labels > 3 && !ph.overflow, `${ph.labels} labels`);
await p.close();

check('console clean', errs.length === 0, errs.slice(0, 3).join(' | '));
console.log(fail ? `${fail} FAILED` : 'PASS');
await b.close();
process.exit(fail ? 1 : 0);
